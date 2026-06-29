window.Auth = {
  _currentUser: null,
  _listeners: [],
  _unsubscribe: null,
  _userRef: null,
  _userListener: null,
  _isInitialized: false,

  init() {
    if (CONFIG.useFirebase) {
      this._unsubscribe = firebase.auth().onAuthStateChanged(authUser => {
        this._detachUserListener()
        if (authUser) {
          this._currentUser = {
            id: authUser.uid, uid: authUser.uid, email: authUser.email,
            fullName: authUser.displayName || '',
            status: 'approved',
            role: CONFIG.adminEmails.includes(authUser.email) ? 'admin' : 'user',
            rooms: [], cumulativePoints: 0,
            needsProfile: true,
            createdAt: new Date().toISOString()
          }
          this._attachUserListener(authUser.uid)
        } else {
          this._currentUser = null
          this._isInitialized = true
          this._notify()
        }
      })
    } else {
      this._isInitialized = true
    }
    return this._currentUser
  },

  _attachUserListener(uid) {
    this._detachUserListener()
    if (!CONFIG.useFirebase) return
    const db = firebase.database()
    this._userRef = db.ref(`ithopiia/users/${uid}`)
    this._userListener = this._userRef.on('value', snap => {
      if (!this._currentUser) return
      if (snap.exists()) {
        const data = snap.val()
        data.needsProfile = false
        const roleChanged = data.role !== this._currentUser.role
        const statusChanged = data.status !== this._currentUser.status
        Object.assign(this._currentUser, data)
        if (!this._isInitialized) {
          this._isInitialized = true
        }
        if (roleChanged || statusChanged || this._isInitialized) {
          this._notify()
        }
      } else if (!this._isInitialized) {
        this._isInitialized = true
        this._notify()
      }
    })
  },

  _detachUserListener() {
    if (this._userRef && this._userListener) {
      this._userRef.off('value', this._userListener)
    }
    this._userRef = null
    this._userListener = null
  },

  _notify() {
    this._listeners.forEach(fn => fn(this._currentUser))
  },

  onAuth(fn) {
    this._listeners.push(fn)
    if (this._isInitialized) fn(this._currentUser)
    return () => { this._listeners = this._listeners.filter(f => f !== fn) }
  },

  isInitialized() { return this._isInitialized },

  async signInWithGoogle() {
    if (!CONFIG.useFirebase) return { ok: false, error: 'Firebase غير متاح.' }
    try {
      const provider = new firebase.auth.GoogleAuthProvider()
      const result = await firebase.auth().signInWithPopup(provider)
      const authUser = result.user
      if (!this._currentUser) {
        this._currentUser = {
          id: authUser.uid, uid: authUser.uid, email: authUser.email,
          fullName: authUser.displayName || 'User',
          status: 'approved',
          role: CONFIG.adminEmails.includes(authUser.email) ? 'admin' : 'user',
          rooms: [], cumulativePoints: 0,
          needsProfile: true,
          createdAt: new Date().toISOString()
        }
        this._attachUserListener(authUser.uid)
      }
      return { ok: true, user: this._currentUser }
    } catch (e) {
      return { ok: false, error: e.message || 'فشل تسجيل الدخول عبر Google.' }
    }
  },

  hasCompleteProfile(user) {
    if (!user) return false
    if (user.role === 'admin' || user.role === 'member') return true
    return !!(
      user.fullName &&
      user.birthdate &&
      user.gender &&
      user.whatsapp &&
      (user.attendedElKaraza === 'yes' || user.attendedElKaraza === 'no')
    )
  },

  needsProfile() {
    if (!this._currentUser) return false
    if (this._currentUser.role === 'admin' || this._currentUser.role === 'member') return false
    return this._currentUser.needsProfile === true
  },

  async completeProfile(data) {
    if (!this._currentUser) return { ok: false, error: 'لا يوجد مستخدم.' }
    const uid = this._currentUser.id

    const profileData = {
      fullName: data.fullName,
      birthdate: data.birthdate || '',
      whatsapp: data.whatsapp || '',
      gender: data.gender,
      attendedElKaraza: data.attendedElKaraza,
      needsProfile: false
    }

    Object.assign(this._currentUser, profileData)

    const updated = await Store.saveProfileData(uid, profileData)
    if (updated) this._currentUser = updated

    this._notify()
    return { ok: true }
  },

  logout() {
    this._detachUserListener()
    this._currentUser = null
    this._notify()
    if (CONFIG.useFirebase) firebase.auth().signOut()
  },

  currentUser() { return this._currentUser },

  isAdmin() {
    return this._currentUser && (this._currentUser.role === 'admin' || this._currentUser.role === 'member' || CONFIG.adminEmails.includes(this._currentUser.email))
  },

  isMember() {
    return this._currentUser && this._currentUser.role === 'member'
  },

  isHiddenAdmin() {
    return this._currentUser && this._currentUser.role === 'admin'
  },

  isLeaderboardReleased() {
    const user = this._currentUser
    if (!user) return false
    if (user.role === 'admin' || user.role === 'member') return true
    if (typeof Store === 'undefined' || !Store._data) return false
    const settings = Store.get('settings') || {}
    const lb = settings.leaderboard

    // 1. Manual override is the source of truth
    if (lb?.forceOverride === 'open') return true
    if (lb?.forceOverride === 'closed') return false

    // 2. Legacy manual override (pre-leaderboard object path)
    const legacyOverride = settings.leaderboardForceOverride
    if (legacyOverride === 'open') return true
    if (legacyOverride === 'closed') return false

    // 3. Auto-schedule evaluation against real-time clock
    const from = lb?.openAt || settings.leaderboardReleasedFrom
    const until = lb?.closeAt || settings.leaderboardReleasedUntil
    const now = Date.now()
    if (from && until) return now >= from && now < until
    if (from) return now >= from
    if (until) return now < until

    // 4. Fallback to legacy visible flag (may be stale)
    if (lb && lb.visible !== undefined) return lb.visible

    return false
  },

  destroy() {
    this._detachUserListener()
    if (this._unsubscribe) this._unsubscribe()
  }
}
