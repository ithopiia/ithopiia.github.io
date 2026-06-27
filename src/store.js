window.Store = {
  _data: null,
  _db: null,
  _rootRef: null,
  _listeners: [],
  _authReady: false,
  _listening: false,
  _pendingSync: false,
  _debounceTimers: {},

  async init() {
    if (this._data) return
    this._loadLocal()
    if (CONFIG.useFirebase) {
      try {
        this._db = firebase.database()
        this._rootRef = this._db.ref('ithopiia')
        const snap = await Promise.race([
          this._rootRef.once('value'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ])
        if (snap.exists()) {
          const remote = snap.val()
          if (remote.users) this._data.users = Object.values(remote.users)
          if (remote.dailyPoints) {
            this._data.dailyPoints = []
            Object.keys(remote.dailyPoints).forEach(dateKey => {
              Object.keys(remote.dailyPoints[dateKey]).forEach(userId => {
                this._data.dailyPoints.push({ userId, dateKey, ...remote.dailyPoints[dateKey][userId] })
              })
            })
          }
          if (remote.evaluation) {
            this._data.evaluation = []
            Object.keys(remote.evaluation).forEach(dateKey => {
              Object.keys(remote.evaluation[dateKey]).forEach(userId => {
                this._data.evaluation.push({ userId, dateKey, ...remote.evaluation[dateKey][userId] })
              })
            })
          }
          if (remote.settings) this._data.settings = remote.settings
          if (remote.rooms) this._data.rooms = Object.values(remote.rooms)
          if (remote.notes) {
            this._data.notes = []
            Object.keys(remote.notes).forEach(noteId => {
              this._data.notes.push({ id: noteId, ...remote.notes[noteId] })
            })
          }
        }
        this._saveLocal()
        this._authReady = true
      } catch (e) {
        if (e.code === 'PERMISSION_DENIED') {
          this._authReady = false
        } else {
          CONFIG.useFirebase = false
        }
      }
    }
    this._migrateSavedFlag()
  },

  _listen() {
    if (this._listening) return
    this._listening = true
    this._rootRef.on('value', snap => {
      if (!snap.exists()) return
      const remote = snap.val()
      let changed = false
      if (remote.users) {
        const arr = Object.values(remote.users)
        if (JSON.stringify(arr) !== JSON.stringify(this._data.users)) {
          this._data.users = arr; changed = true
        }
      }
      if (remote.dailyPoints) {
        const arr = []
        Object.keys(remote.dailyPoints).forEach(dateKey => {
          Object.keys(remote.dailyPoints[dateKey]).forEach(userId => {
            arr.push({ userId, dateKey, ...remote.dailyPoints[dateKey][userId] })
          })
        })
        if (JSON.stringify(arr) !== JSON.stringify(this._data.dailyPoints)) {
          this._data.dailyPoints = arr; changed = true
        }
      }
      if (remote.evaluation) {
        const arr = []
        Object.keys(remote.evaluation).forEach(dateKey => {
          Object.keys(remote.evaluation[dateKey]).forEach(userId => {
            arr.push({ userId, dateKey, ...remote.evaluation[dateKey][userId] })
          })
        })
        if (JSON.stringify(arr) !== JSON.stringify(this._data.evaluation)) {
          this._data.evaluation = arr; changed = true
        }
      }
      if (remote.settings) {
        if (JSON.stringify(remote.settings) !== JSON.stringify(this._data.settings)) {
          this._data.settings = remote.settings; changed = true
        }
      }
      if (remote.rooms) {
        const arr = Object.values(remote.rooms)
        if (JSON.stringify(arr) !== JSON.stringify(this._data.rooms)) {
          this._data.rooms = arr; changed = true
        }
      }
      if (remote.notes) {
        const arr = []
        Object.keys(remote.notes).forEach(noteId => {
          arr.push({ id: noteId, ...remote.notes[noteId] })
        })
        if (JSON.stringify(arr) !== JSON.stringify(this._data.notes)) {
          this._data.notes = arr; changed = true
        }
      }
      if (changed) { this._saveLocal(); this._notify() }

      // Reactive running total: after every data change, recompute
      // cumulativePoints from all dailyPoints entries and write back.
      if (remote.dailyPoints && remote.users && !this._recalculatingPts && this._authReady) {
        this._recalculatingPts = true
        this._recalcCumulativeFromRemote(remote).then(() => {
          this._recalculatingPts = false
        }, () => {
          this._recalculatingPts = false
        })
      }
    })
  },

  async _recalcCumulativeFromRemote(remote) {
    const currentUser = Auth.currentUser()
    const canWriteCumulative = currentUser && (currentUser.role === 'admin' || currentUser.role === 'member')
    const userIds = Object.keys(remote.users)
    const promises = []
    for (const userId of userIds) {
      let total = 0
      for (const dateKey of Object.keys(remote.dailyPoints)) {
        const entry = remote.dailyPoints[dateKey]?.[userId]
        if (entry?.finalScore) total += entry.finalScore
      }
      const current = remote.users[userId]?.cumulativePoints ?? 0
      if (total !== current) {
        const localUser = (this._data.users || []).find(u => u.id === userId)
        if (localUser) localUser.cumulativePoints = total
        if (canWriteCumulative) {
          promises.push(this.writePath(`users/${userId}/cumulativePoints`, total))
        }
      }
    }
    if (promises.length > 0 && this._authReady) {
      await Promise.all(promises)
      this._saveLocal()
      this._notify()
    } else if (promises.length === 0) {
      this._saveLocal()
      this._notify()
    }
  },

  _migrateSavedFlag() {
    const dailyPoints = this._data.dailyPoints || []
    dailyPoints.forEach(p => {
      if (p.bonusPoints !== undefined && p.evaluationScore === undefined && p.manualBonus === undefined) {
        p.evaluationScore = p.bonusPoints
        delete p.bonusPoints
      }
      if (p.saved === false) {
        p.saved = true
        p.finalScore = (p.finalScore || p.basePoints || CONFIG.pointsPerDay) + (p.evaluationScore || 0) + (p.manualBonus || 0)
      }
    })
    const users = this._data.users || []
    let changed = false
    users.forEach(u => {
      const userPoints = dailyPoints.filter(p => p.userId === u.id && p.saved)
      const total = userPoints.reduce((sum, p) => sum + (p.finalScore || 0), 0)
      if (u.cumulativePoints !== total) {
        u.cumulativePoints = total
        changed = true
      }
    })
    if (changed) this._saveLocal()
  },

  debounce(key, fn, delay) {
    if (this._debounceTimers[key]) clearTimeout(this._debounceTimers[key])
    this._debounceTimers[key] = setTimeout(() => {
      delete this._debounceTimers[key]
      fn()
    }, delay)
  },

  _notify() {
    this._listeners.forEach(fn => fn(this._data))
  },

  onChange(fn) {
    this._listeners.push(fn)
    return () => { this._listeners = this._listeners.filter(f => f !== fn) }
  },

  _defaults() {
    return { users: [], dailyPoints: [], evaluation: [], settings: {}, rooms: [], notes: [] }
  },

  _loadLocal() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey)
      this._data = raw ? JSON.parse(raw) : this._defaults()
    } catch {
      this._data = this._defaults()
    }
  },

  _saveLocal() {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(this._data)) } catch {}
  },

  _buildRTDB() {
    const users = {}
    this._data.users.forEach(u => { if (u.id) users[u.id] = u })
    const dailyPoints = {}
    this._data.dailyPoints.forEach(p => {
      if (!p.dateKey || !p.userId) return
      if (!dailyPoints[p.dateKey]) dailyPoints[p.dateKey] = {}
      const { userId, dateKey, ...rest } = p
      dailyPoints[p.dateKey][userId] = rest
    })
    const evaluation = {}
    this._data.evaluation.forEach(e => {
      if (!e.dateKey || !e.userId) return
      if (!evaluation[e.dateKey]) evaluation[e.dateKey] = {}
      const { userId, dateKey, ...rest } = e
      evaluation[e.dateKey][userId] = rest
    })
    const rooms = {}
    this._data.rooms.forEach(r => { if (r.id) rooms[r.id] = r })
    const notes = {}
    this._data.notes.forEach(n => { if (n.id) notes[n.id] = n })
    return { users, dailyPoints, evaluation, settings: this._data.settings || {}, rooms, notes }
  },

  setAuthReady() {
    this._authReady = true
    if (this._rootRef) this._listen()
    if (this._pendingSync) {
      this._pendingSync = false
      this._syncRTDB()
    }
  },

  async _syncRTDB() {
    if (!CONFIG.useFirebase || !this._rootRef) return
    if (!this._authReady) { this._pendingSync = true; return }
    const user = Auth.currentUser()
    if (!user || user.needsProfile || !Auth.hasCompleteProfile(user)) return
    try { await this._rootRef.once('value') } catch { return }
    try {
      const rtdb = this._buildRTDB()
      const writes = [
        this._rootRef.child('users').set(rtdb.users),
        this._rootRef.child('dailyPoints').set(rtdb.dailyPoints),
        this._rootRef.child('evaluation').set(rtdb.evaluation),
        this._rootRef.child('rooms').set(rtdb.rooms),
        this._rootRef.child('notes').set(rtdb.notes),
      ]
      if (Auth.isAdmin()) {
        writes.push(this._rootRef.child('settings').set(rtdb.settings))
      }
      await Promise.all(writes)
    } catch (e) {
      if (e.code === 'PERMISSION_DENIED') return
      console.warn('RTDB sync failed', e)
    }
  },

  async writePath(path, value) {
    if (!CONFIG.useFirebase || !this._rootRef) return
    if (!this._authReady) return
    try {
      await this._rootRef.child(path).set(value)
    } catch (e) {
      if (e.code === 'PERMISSION_DENIED') return
      console.warn('Direct FB write failed', path, e)
    }
  },

  _sync() {
    this._saveLocal()
    if (CONFIG.useFirebase && this._rootRef) this._syncRTDB()
  },

  _resolve(obj, key) {
    if (!key.includes('.')) return { parent: obj, prop: key }
    const parts = key.split('.')
    let cur = obj
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {}
      cur = cur[parts[i]]
    }
    return { parent: cur, prop: parts[parts.length - 1] }
  },

  get(key) {
    const { parent, prop } = this._resolve(this._data, key)
    return parent?.[prop]
  },
  set(key, val) {
    const { parent, prop } = this._resolve(this._data, key)
    parent[prop] = val
    this._sync()
  },
  push(key, item) { this._data[key].push(item); this._sync() },
  update(key, predicate, changes) {
    const items = this._data[key]
    const idx = items.findIndex(predicate)
    if (idx !== -1) { Object.assign(items[idx], changes); this._sync(); return items[idx] }
  },
  async updateUserProfile(uid, data) {
    const users = this._data.users || []
    const idx = users.findIndex(u => u.id === uid)
    if (idx === -1) return null
    Object.assign(users[idx], data)
    this._saveLocal()
    if (CONFIG.useFirebase && this._rootRef && this._authReady) {
      const { cumulativePoints, ...profileData } = users[idx]
      await this._rootRef.child(`users/${uid}`).set(profileData)
    }
    return users[idx]
  },
  async saveProfileData(uid, profileData) {
    const users = this._data.users || []
    const idx = users.findIndex(u => u.id === uid)
    if (idx === -1) return null
    Object.assign(users[idx], profileData)
    this._saveLocal()
    if (CONFIG.useFirebase && this._rootRef && this._authReady) {
      const allowed = {
        fullName: profileData.fullName,
        whatsapp: profileData.whatsapp,
        birthdate: profileData.birthdate,
        gender: profileData.gender,
        attendedElKaraza: profileData.attendedElKaraza,
        needsProfile: false
      }
      await this._rootRef.child(`users/${uid}`).set(allowed)
    }
    return users[idx]
  },
  remove(key, predicate) {
    this._data[key] = this._data[key].filter(predicate)
    this._sync()
  },
}
