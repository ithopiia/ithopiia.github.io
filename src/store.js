window.Store = {
  _data: null,
  _db: null,
  _rootRef: null,
  _listeners: [],
  _authReady: false,
  _pendingSync: false,

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
      if (CONFIG.useFirebase && this._rootRef && this._authReady) {
        this._listen()
      }
    }
    this._migrateSavedFlag()
  },

  _listen() {
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
      if (changed) { this._saveLocal(); this._notify() }
    })
  },

  _migrateSavedFlag() {
    const dailyPoints = this._data.dailyPoints || []
    dailyPoints.forEach(p => {
      if (p.saved === false) {
        p.saved = true
        p.finalScore = (p.finalScore || p.basePoints || CONFIG.pointsPerDay) + (p.bonusPoints || 0)
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

  _notify() {
    this._listeners.forEach(fn => fn(this._data))
  },

  onChange(fn) {
    this._listeners.push(fn)
    return () => { this._listeners = this._listeners.filter(f => f !== fn) }
  },

  _defaults() {
    return { users: [], dailyPoints: [], evaluation: [], settings: {}, rooms: [] }
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
    return { users, dailyPoints, evaluation, settings: this._data.settings || {}, rooms }
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
    try {
      const rtdb = this._buildRTDB()
      const writes = [
        this._rootRef.child('users').set(rtdb.users),
        this._rootRef.child('dailyPoints').set(rtdb.dailyPoints),
        this._rootRef.child('evaluation').set(rtdb.evaluation),
        this._rootRef.child('rooms').set(rtdb.rooms),
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
  remove(key, predicate) {
    this._data[key] = this._data[key].filter(predicate)
    this._sync()
  },
}
