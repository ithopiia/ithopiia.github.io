window.Store = {
  _data: null,
  _db: null,
  _listeners: [],
  _authReady: false,
  _initialLoadDone: false,
  _recalculating: false,
  _readyCount: 0,
  _debounceTimers: {},
  TOTAL_PATHS: 6,

  _defaults() {
    return { users: [], dailyPoints: [], evaluation: [], settings: {}, rooms: [], notes: [] }
  },

  async init() {
    if (this._data) return
    this._data = this._defaults()
    if (CONFIG.useFirebase) {
      try {
        this._db = firebase.database()
        this._attachListeners()
        this._authReady = true
      } catch (e) {
        CONFIG.useFirebase = false
      }
    }
  },

  _pathRef(path) {
    return this._db && this._db.ref('ithopiia/' + path)
  },

  _attachListeners() {
    const ready = () => {
      this._readyCount++
      if (this._readyCount === this.TOTAL_PATHS) {
        this._initialLoadDone = true
        this._notify()
      }
    }

    this._pathRef('users').on('value', snap => {
      this._data.users = snap.exists() ? Object.values(snap.val()) : []
      if (this._initialLoadDone) this._notify()
      else ready()
    })

    this._pathRef('rooms').on('value', snap => {
      this._data.rooms = snap.exists() ? Object.values(snap.val()) : []
      if (this._initialLoadDone) this._notify()
      else ready()
    })

    this._pathRef('dailyPoints').on('value', snap => {
      this._data.dailyPoints = []
      if (snap.exists()) {
        Object.keys(snap.val()).forEach(dateKey => {
          Object.keys(snap.val()[dateKey]).forEach(userId => {
            this._data.dailyPoints.push({ userId, dateKey, ...snap.val()[dateKey][userId] })
          })
        })
      }
      this._recalcCumulative()
      if (this._initialLoadDone) this._notify()
      else ready()
    })

    this._pathRef('evaluation').on('value', snap => {
      this._data.evaluation = []
      if (snap.exists()) {
        Object.keys(snap.val()).forEach(dateKey => {
          Object.keys(snap.val()[dateKey]).forEach(userId => {
            this._data.evaluation.push({ userId, dateKey, ...snap.val()[dateKey][userId] })
          })
        })
      }
      if (this._initialLoadDone) this._notify()
      else ready()
    })

    this._pathRef('settings').on('value', snap => {
      this._data.settings = snap.exists() ? snap.val() : {}
      if (this._initialLoadDone) this._notify()
      else ready()
    })

    this._pathRef('notes').on('value', snap => {
      this._data.notes = []
      if (snap.exists()) {
        Object.keys(snap.val()).forEach(noteId => {
          this._data.notes.push({ id: noteId, ...snap.val()[noteId] })
        })
      }
      if (this._initialLoadDone) this._notify()
      else ready()
    })
  },

  _recalcCumulative() {
    if (this._recalculating) return
    this._recalculating = true
    const totals = {}
    this._data.dailyPoints.forEach(p => {
      if (p.saved) {
        totals[p.userId] = (totals[p.userId] || 0) + (p.finalScore ?? 0)
      }
    })
    const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser() : null
    const canWrite = currentUser && (currentUser.role === 'admin' || currentUser.role === 'member')
    let changed = false
    this._data.users.forEach(u => {
      const total = totals[u.id] || 0
      if (u.cumulativePoints !== total) {
        u.cumulativePoints = total
        changed = true
        if (canWrite) {
          this.writePath(`users/${u.id}/cumulativePoints`, total)
        }
      }
    })
    this._recalculating = false
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
    const ref = this._pathRef(key)
    if (!ref) return
    if (Array.isArray(val)) {
      const obj = {}
      if (key === 'dailyPoints' || key === 'evaluation') {
        val.forEach(item => {
          if (!item.dateKey || !item.userId) return
          if (!obj[item.dateKey]) obj[item.dateKey] = {}
          const { userId, dateKey, ...rest } = item
          obj[item.dateKey][userId] = rest
        })
      } else {
        val.forEach(item => { if (item.id) obj[item.id] = item })
      }
      ref.set(obj)
    } else {
      ref.set(val)
    }
  },

  push(key, item) {
    if (key === 'evaluation' || key === 'dailyPoints') {
      if (item.dateKey && item.userId) {
        const { userId, dateKey, ...rest } = item
        this.writePath(`${key}/${dateKey}/${userId}`, rest)
      }
    } else if (item.id) {
      this.writePath(`${key}/${item.id}`, item)
    }
  },

  update(key, predicate, changes) {
    const item = (this._data[key] || []).find(predicate)
    if (item) {
      Object.assign(item, changes)
      this.set(key, this._data[key])
    }
    return item
  },

  remove(key, predicate) {
    this._data[key] = this._data[key].filter(predicate)
    this.set(key, this._data[key])
  },

  async writePath(path, value) {
    if (!this._db) return
    try {
      await this._pathRef(path).set(value)
    } catch (e) {
      if (e.code === 'PERMISSION_DENIED') return
      console.warn('Firebase write failed', path, e)
    }
  },

  debounce(key, fn, delay) {
    if (this._debounceTimers[key]) clearTimeout(this._debounceTimers[key])
    this._debounceTimers[key] = setTimeout(() => {
      delete this._debounceTimers[key]
      fn()
    }, delay)
  },

  setAuthReady() {
    // Listeners are always active from init()
  },

  async saveProfileData(uid, profileData) {
    const user = (this._data.users || []).find(u => u.id === uid)
    if (!user) return null
    Object.assign(user, profileData)
    const authUser = this._db && firebase.auth().currentUser
    const fullProfile = {
      ...user,
      ...profileData,
      needsProfile: false,
      email: authUser?.email || user.email || '',
      role: user.role || 'user',
      status: user.status || 'approved',
      cumulativePoints: user.cumulativePoints ?? 0,
      createdAt: user.createdAt || new Date().toISOString(),
    }
    await this.writePath(`users/${uid}`, fullProfile)
    return user
  },

  _notify() {
    this._listeners.forEach(fn => fn(this._data))
  },

  onChange(fn) {
    this._listeners.push(fn)
    return () => { this._listeners = this._listeners.filter(f => f !== fn) }
  },
}
