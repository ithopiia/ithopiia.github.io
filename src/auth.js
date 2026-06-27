window.Auth = {
  _currentUser: null,
  _listeners: [],
  _unsubscribe: null,
  _userRef: null,
  _userListener: null,

  init() {
    if (CONFIG.useFirebase) {
      this._unsubscribe = firebase.auth().onAuthStateChanged(authUser => {
        this._detachUserListener()
        if (authUser) {
          let users = Store.get('users') || []
          let profile = users.find(u => u.uid === authUser.uid)
          if (!profile) {
            profile = {
              id: authUser.uid, uid: authUser.uid, email: authUser.email,
              fullName: authUser.displayName || '',
              status: 'approved',
              role: CONFIG.adminEmails.includes(authUser.email) ? 'admin' : 'user',
              rooms: [], cumulativePoints: 0,
              needsProfile: true,
              createdAt: new Date().toISOString()
            }
            Store.push('users', profile)
          }
          this._currentUser = profile
          this._attachUserListener(authUser.uid)
        } else {
          this._currentUser = null
        }
        this._notify()
      })
    }
    return this._currentUser
  },

  _attachUserListener(uid) {
    this._detachUserListener()
    if (!CONFIG.useFirebase) return
    const db = firebase.database()
    this._userRef = db.ref(`ithopiia/users/${uid}`)
    this._userListener = this._userRef.on('value', snap => {
      if (snap.exists() && this._currentUser) {
        const data = snap.val()
        const roleChanged = data.role !== this._currentUser.role
        const statusChanged = data.status !== this._currentUser.status
        Object.assign(this._currentUser, data)
        if (roleChanged || statusChanged) {
          this._notify()
        }
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
      this._attachUserListener(authUser.uid)
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

  destroy() {
    this._detachUserListener()
    if (this._unsubscribe) this._unsubscribe()
  }
}
