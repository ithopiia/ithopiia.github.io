window.Auth = {
  _currentUser: null,
  _listeners: [],
  _unsubscribe: null,

  init() {
    if (CONFIG.useFirebase) {
      this._unsubscribe = firebase.auth().onAuthStateChanged(authUser => {
        if (authUser) {
          const users = Store.get('users') || []
          let profile = users.find(u => u.uid === authUser.uid)
          if (!profile && CONFIG.adminEmails.includes(authUser.email)) {
            profile = {
              id: authUser.uid, uid: authUser.uid, email: authUser.email,
              fullName: 'Admin', status: 'approved', role: 'admin', rooms: [],
              cumulativePoints: 0, createdAt: new Date().toISOString()
            }
            Store.push('users', profile)
          }
          this._currentUser = profile || null
        } else {
          this._currentUser = null
        }
        this._notify()
      })
    }
    return this._currentUser
  },

  _notify() {
    this._listeners.forEach(fn => fn(this._currentUser))
  },

  onAuth(fn) {
    this._listeners.push(fn)
    if (this._currentUser !== undefined) fn(this._currentUser)
    return () => { this._listeners = this._listeners.filter(f => f !== fn) }
  },

  async signInWithGoogle() {
    if (!CONFIG.useFirebase) return { ok: false, error: 'Firebase غير متاح.' }
    try {
      const provider = new firebase.auth.GoogleAuthProvider()
      const result = await firebase.auth().signInWithPopup(provider)
      const authUser = result.user
      const users = Store.get('users') || []
      let profile = users.find(u => u.uid === authUser.uid)
      if (!profile) {
        const isAdminEmail = CONFIG.adminEmails.includes(authUser.email)
        profile = {
          id: authUser.uid, uid: authUser.uid, email: authUser.email,
          fullName: authUser.displayName || 'User',
          status: 'approved',
          role: isAdminEmail ? 'admin' : 'user', rooms: [],
          cumulativePoints: 0,
          needsProfile: true,
          createdAt: new Date().toISOString()
        }
        Store.push('users', profile)
      }
      this._currentUser = profile
      this._notify()
      return { ok: true, user: profile }
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
    return this._currentUser.needsProfile || !this.hasCompleteProfile(this._currentUser)
  },

  async completeProfile(data) {
    if (!this._currentUser) return { ok: false, error: 'لا يوجد مستخدم.' }
    Store.update('users', u => u.id === this._currentUser.id, {
      fullName: data.fullName,
      birthdate: data.birthdate || '',
      whatsapp: data.whatsapp || '',
      gender: data.gender,
      attendedElKaraza: data.attendedElKaraza,
      needsProfile: false
    })
    this._currentUser = Store.get('users').find(u => u.id === this._currentUser.id) || this._currentUser
    this._notify()
    return { ok: true }
  },

  logout() {
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

  destroy() {
    if (this._unsubscribe) this._unsubscribe()
  }
}
