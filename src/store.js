window.Store = {
  _data: null,
  _db: null,
  _listeners: [],
  _authReady: false,
  _initialLoadDone: false,
  _recalculating: false,
  _syncLock: false,
  _totalsCache: null,
  _readyCount: 0,
  _debounceTimers: {},
  TOTAL_PATHS: 8,

  _defaults() {
    return { users: [], dailyPoints: [], evaluation: [], settings: {}, rooms: [], notes: [], hymns: [], individualAwards: [] }
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
        this._migrateLegacyEvaluationData()
        this._autoSyncTotals()
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
      this._data.dailyPoints = this._flattenDailyPoints(snap)
      if (this._initialLoadDone) {
        this._autoSyncTotals()
        this._notify()
      } else {
        ready()
      }
    })

    this._pathRef('evaluation').on('value', snap => {
      this._data.evaluation = []
      if (snap.exists()) {
        Object.keys(snap.val()).forEach(dateKey => {
          const dateNode = snap.val()[dateKey] || {}
        Object.keys(dateNode).forEach(secondKey => {
          const secondVal = dateNode[secondKey]
          if (!secondVal || typeof secondVal !== 'object') return
          const pathRoomId = secondKey === '_unassigned' ? null : secondKey
          const secondKeys = Object.keys(secondVal)
          const looksLikeEntry = secondKeys.some(k => this._isEvalEntryField(k))
          if (looksLikeEntry) {
            const entry = { userId: secondKey, dateKey, roomId: null, ...secondVal }
            this._data.evaluation.push(entry)
          } else {
            secondKeys.forEach(userId => {
              const e = secondVal[userId]
              if (e && typeof e === 'object') {
                const entry = { userId, dateKey, roomId: pathRoomId, ...e }
                if (entry.roomId == null) entry.roomId = pathRoomId
                this._data.evaluation.push(entry)
              }
            })
          }
        })
        })
      }
      if (this._initialLoadDone) {
        this._autoSyncTotals()
        this._notify()
      } else {
        ready()
      }
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

    this._pathRef('hymns').on('value', snap => {
      this._data.hymns = []
      if (snap.exists()) {
        Object.keys(snap.val()).forEach(hymnId => {
          Object.keys(snap.val()[hymnId]).forEach(userId => {
            this._data.hymns.push({ hymnId, userId, ...snap.val()[hymnId][userId] })
          })
        })
      }
      this._recalcCumulative()
      if (this._initialLoadDone) this._notify()
      else ready()
    })

    this._pathRef('individualAwards').on('value', snap => {
      this._data.individualAwards = []
      if (snap.exists()) {
        Object.keys(snap.val()).forEach(showId => {
          Object.keys(snap.val()[showId]).forEach(userId => {
            this._data.individualAwards.push({ showId, userId, ...snap.val()[showId][userId] })
          })
        })
      }
      this._recalcCumulative()
      if (this._initialLoadDone) this._notify()
      else ready()
    })
  },

  _isEntryField(k) {
    return ['finalScore', 'basePoints', 'evaluationScore', 'manualBonus', 'overwritten', 'adminNotes', 'saved', 'bonusPoints', 'totalScore', 'points', 'score', 'bonus', 'minus', 'total', 'date', 'roomId'].indexOf(k) !== -1
  },

  _isEvalEntryField(k) {
    return ['spiritual', 'exercises', 'moral', 'rehearsal', 'acting', 'movement', 'clothing', 'bonus', 'totalScore', 'evaluationScore', 'finalScore', 'saved', 'zeroReason', 'bonusReason', 'manualBonus'].indexOf(k) !== -1
  },

  _primaryRoomOf(userId) {
    const u = (this._data.users || []).find(x => x.id === userId)
    const rooms = (u && u.rooms) || []
    return rooms.length ? rooms[0] : null
  },

  _flattenDailyPoints(snap) {
    const out = []
    if (!snap.exists()) return out
    const val = snap.val()
    Object.keys(val).forEach(dateKey => {
      const dateNode = val[dateKey] || {}
      Object.keys(dateNode).forEach(secondKey => {
        const secondVal = dateNode[secondKey]
        if (!secondVal || typeof secondVal !== 'object') return
        const pathRoomId = secondKey === '_unassigned' ? null : secondKey
        const secondKeys = Object.keys(secondVal)
        const looksLikeEntry = secondKeys.some(k => this._isEntryField(k))
        if (looksLikeEntry) {
          const entry = { userId: secondKey, dateKey, roomId: null, ...secondVal }
          out.push(entry)
        } else {
          secondKeys.forEach(userId => {
            const e = secondVal[userId]
            if (e && typeof e === 'object') {
              const entry = { userId, dateKey, roomId: pathRoomId, ...e }
              if (entry.roomId == null) entry.roomId = pathRoomId
              out.push(entry)
            }
          })
        }
      })
    })
    return out
  },

  _autoSyncTotals() {
    if (window.Points && typeof Points.recalculateLeaderboardTotals === 'function') {
      Points.recalculateLeaderboardTotals()
    } else {
      this._recalcCumulative()
    }
  },

  _migrateLegacyEvaluationData() {
    const evalEntries = this._data.evaluation || []
    const dp = this._data.dailyPoints || []
    const updates = {}

    evalEntries.forEach(entry => {
      if (entry.roomId != null) return
      if (!entry.userId || !entry.dateKey) return

      const matchingDp = dp.find(p => p.userId === entry.userId && p.dateKey === entry.dateKey)
      const roomId = matchingDp ? (matchingDp.roomId || null) : null
      const roomPath = roomId || '_unassigned'

      const { userId, dateKey, roomId: _rid, ...rest } = entry
      updates[`/ithopiia/evaluation/${dateKey}/${roomPath}/${userId}`] = rest
      updates[`/ithopiia/evaluation/${dateKey}/${userId}`] = null
    })

    if (Object.keys(updates).length > 0) {
      console.log(`[Migration] Repairing ${Object.keys(updates).length / 2} legacy evaluation entries...`)
      const db = firebase.database()
      db.ref().update(updates).then(() => {
        console.log('[Migration] Legacy evaluation data repaired successfully.')
      }).catch(err => {
        console.error('[Migration] Failed to repair legacy evaluation data:', err)
      })
    }
  },

  _recalcCumulative() {
    if (this._recalculating) return
    this._recalculating = true
    const totals = {}
    const roomTotals = {}
    this._data.dailyPoints.forEach(p => {
      if (p && p.userId && p.dateKey) {
        totals[p.userId] = (totals[p.userId] || 0) + calcEntryScore(p)
        const pRoom = p.roomId || this._primaryRoomOf(p.userId)
        if (pRoom) {
          if (!roomTotals[p.userId]) roomTotals[p.userId] = {}
          roomTotals[p.userId][pRoom] = (roomTotals[p.userId][pRoom] || 0) + calcEntryScore(p)
        }
      }
    })
    this._data.users.forEach(u => {
      if (u.hymns) {
        Object.values(u.hymns).forEach(score => {
          totals[u.id] = (totals[u.id] || 0) + (parseInt(score, 10) || 0)
        })
      }
    })
    ;(this._data.individualAwards || []).forEach(a => {
      if (a && a.userId && a.awarded) {
        totals[a.userId] = (totals[a.userId] || 0) + (parseInt(a.points, 10) || 0)
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
      const newRoomPoints = roomTotals[u.id] || {}
      const oldRoomPoints = u.roomPoints || {}
      const keys = new Set([...Object.keys(oldRoomPoints), ...Object.keys(newRoomPoints)])
      let roomChanged = false
      keys.forEach(rid => {
        const nv = newRoomPoints[rid] || 0
        if ((oldRoomPoints[rid] || 0) !== nv) {
          oldRoomPoints[rid] = nv
          roomChanged = true
        }
      })
      if (roomChanged) {
        u.roomPoints = { ...oldRoomPoints }
        if (canWrite) {
          this.writePath(`users/${u.id}/roomPoints`, u.roomPoints)
        }
      }
    })
    if (changed) {
      this._updateRanks(canWrite)
    } else if (this._data.users.some(u => u.currentRank == null)) {
      this._updateRanks(canWrite)
    }
    this._recalculating = false
  },

  _updateRanks(canWrite) {
    const ranked = (this._data.users || [])
      .filter(u => u.status === 'approved' && u.role !== 'admin')
      .sort((a, b) => (b.cumulativePoints || 0) - (a.cumulativePoints || 0))
    ranked.forEach((u, i) => {
      const newRank = i + 1
      if (u.currentRank !== newRank || u.currentRank == null) {
        const oldCurr = u.currentRank
        u.previousRank = oldCurr ?? null
        u.currentRank = newRank
        if (canWrite) {
          this.writePath(`users/${u.id}/previousRank`, oldCurr ?? null)
          this.writePath(`users/${u.id}/currentRank`, newRank)
        }
      }
    })
  },

  getUserRank(userId) {
    const users = (this._data.users || [])
      .filter(u => u.status === 'approved' && u.role !== 'admin')
      .sort((a, b) => (b.cumulativePoints || 0) - (a.cumulativePoints || 0))
    const idx = users.findIndex(u => u.id === userId)
    return idx >= 0 ? idx + 1 : null
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
      if (key === 'dailyPoints') {
        val.forEach(item => {
          if (!item.dateKey || !item.userId) return
          const roomKey = item.roomId || '_unassigned'
          if (!obj[item.dateKey]) obj[item.dateKey] = {}
          if (!obj[item.dateKey][roomKey]) obj[item.dateKey][roomKey] = {}
          const { userId, dateKey, roomId, ...rest } = item
          obj[item.dateKey][roomKey][userId] = rest
        })
      } else if (key === 'evaluation') {
        val.forEach(item => {
          if (!item.dateKey || !item.userId) return
          const roomKey = item.roomId || '_unassigned'
          if (!obj[item.dateKey]) obj[item.dateKey] = {}
          if (!obj[item.dateKey][roomKey]) obj[item.dateKey][roomKey] = {}
          const { userId, dateKey, roomId, ...rest } = item
          obj[item.dateKey][roomKey][userId] = rest
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
    if (key === 'evaluation') {
      if (item.dateKey && item.userId) {
        const { userId, dateKey, roomId, ...rest } = item
        this.writePath(`${key}/${dateKey}/${roomId || '_unassigned'}/${userId}`, rest)
      }
    } else if (key === 'dailyPoints') {
      if (item.dateKey && item.userId) {
        const { userId, dateKey, roomId, ...rest } = item
        this.writePath(`${key}/${dateKey}/${roomId || '_unassigned'}/${userId}`, rest)
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
    let user = (this._data.users || []).find(u => u.id === uid)
    if (!user) {
      user = { id: uid, uid }
      this._data.users.push(user)
    }
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
