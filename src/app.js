window.App = {
  async init() {
    await Store.init()

    Auth.init()

    Auth.onAuth(user => {
      if (user) {
        Store.setAuthReady()
        if (!Auth.needsProfile()) {
          Points.grantDailyPoints()
        }
      }
      this.render()
    })

    document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout())
    document.getElementById('google-auth-btn')?.addEventListener('click', () => this.handleGoogleSignIn())
    document.getElementById('comp-btn')?.addEventListener('click', () => this.handleCompleteProfile())

    this.initDatePicker()
    this.render()
  },

  initDatePicker() {
    const yearSel = document.getElementById('comp-year')
    if (!yearSel) return
    const cur = new Date().getFullYear()
    for (let y = cur; y >= 1950; y--) {
      const opt = document.createElement('option')
      opt.value = y; opt.textContent = y
      yearSel.appendChild(opt)
    }
    const monthSel = document.getElementById('comp-month')
    const daySel = document.getElementById('comp-day')
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    yearSel.addEventListener('change', () => {
      monthSel.innerHTML = '<option value="">الشهر</option>'
      daySel.innerHTML = '<option value="">اليوم</option>'
      daySel.style.display = 'none'
      if (!yearSel.value) { monthSel.style.display = 'none'; return }
      monthSel.style.display = 'block'
      months.forEach((m, i) => {
        const opt = document.createElement('option')
        opt.value = i + 1; opt.textContent = m
        monthSel.appendChild(opt)
      })
    })
    monthSel.addEventListener('change', () => {
      daySel.innerHTML = '<option value="">اليوم</option>'
      if (!monthSel.value || !yearSel.value) { daySel.style.display = 'none'; return }
      const daysInMonth = new Date(parseInt(yearSel.value), parseInt(monthSel.value), 0).getDate()
      daySel.style.display = 'block'
      for (let d = 1; d <= daysInMonth; d++) {
        const opt = document.createElement('option')
        opt.value = d; opt.textContent = d
        daySel.appendChild(opt)
      }
    })
  },

  validateProfileForm() {
    const name = document.getElementById('comp-name')?.value.trim()
    const year = document.getElementById('comp-year')?.value
    const month = document.getElementById('comp-month')?.value
    const day = document.getElementById('comp-day')?.value
    const elkaraza = document.getElementById('comp-elkaraza')?.value
    const gender = document.getElementById('comp-gender')?.value
    const whatsapp = document.getElementById('comp-whatsapp')?.value.trim()
    const btn = document.getElementById('comp-btn')
    if (!btn) return
    const valid = !!(name && year && month && day && elkaraza && gender && whatsapp)
    btn.disabled = !valid
  },

  handleLogout() {
    Auth.logout()
    this.render()
  },

  async handleGoogleSignIn() {
    const btn = document.getElementById('google-auth-btn')
    const errorEl = document.getElementById('auth-error')
    errorEl.textContent = ''
    btn.disabled = true; btn.textContent = 'جارٍ...'
    const res = await Auth.signInWithGoogle()
    if (res.ok) {
      this.render()
    } else {
      errorEl.textContent = res.error
      btn.disabled = false; btn.textContent = 'تسجيل الدخول باستخدام Google'
    }
  },

  async handleCompleteProfile() {
    const fullName = document.getElementById('comp-name').value.trim()
    const year = document.getElementById('comp-year').value
    const month = document.getElementById('comp-month').value
    const day = document.getElementById('comp-day').value
    const whatsapp = document.getElementById('comp-whatsapp').value.trim()
    const gender = document.getElementById('comp-gender').value
    const attendedElKaraza = document.getElementById('comp-elkaraza').value
    const errorEl = document.getElementById('comp-error')
    errorEl.textContent = ''

    if (!fullName || !year || !month || !day || !attendedElKaraza || !gender || !whatsapp) {
      errorEl.textContent = 'يرجى ملء جميع الحقول المطلوبة.'; return
    }

    const birthdate = year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0')

    const btn = document.getElementById('comp-btn')
    btn.disabled = true; btn.textContent = 'جارٍ الحفظ...'

    const uid = Auth.currentUser()?.id
    if (!uid) {
      errorEl.textContent = 'خطأ في تعريف المستخدم.'
      btn.disabled = false; btn.textContent = 'حفظ'
      return
    }

    const profileData = { fullName, birthdate, whatsapp, gender, attendedElKaraza, needsProfile: false }

    await Store.saveProfileData(uid, profileData)

    const saved = (Store.get('users') || []).find(u => u.id === uid)
    if (saved && Auth.currentUser()) {
      Object.assign(Auth.currentUser(), saved)
    }

    this.showDashboard()
  },

  showAdmin() {
    localStorage.setItem('ithopiia_activeView', 'admin')
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
    document.getElementById('view-admin')?.classList.add('active')
    Admin.render()
    document.getElementById('admin-nav-btn').style.display = 'none'
    document.getElementById('profile-nav-btn').style.display = Auth.isMember() ? '' : 'none'
    setTimeout(() => this._restoreTab('admin'), 50)
  },

  showDashboard() {
    localStorage.setItem('ithopiia_activeView', 'dashboard')
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
    document.getElementById('view-dashboard')?.classList.add('active')
    Dashboard.render()
    document.getElementById('profile-nav-btn').style.display = 'none'
    document.getElementById('admin-nav-btn').style.display = Auth.isMember() ? '' : 'none'
    setTimeout(() => this._restoreTab('dashboard'), 50)
  },

  _restoreTab(view) {
    const savedTab = localStorage.getItem('ithopiia_activeTab_' + view)
    if (savedTab) {
      const btn = document.querySelector(`#view-${view} .tab-btn[data-tab="${savedTab}"]`)
      if (btn) btn.click()
    }
  },

  render() {
    const user = Auth.currentUser()
    const role = user?.role
    const logoutBtn = document.getElementById('logout-btn')
    const adminNavBtn = document.getElementById('admin-nav-btn')
    const profileNavBtn = document.getElementById('profile-nav-btn')

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
    if (logoutBtn) logoutBtn.style.display = user ? '' : 'none'

    const savedView = localStorage.getItem('ithopiia_activeView')

    if (user && role === 'admin') {
      if (adminNavBtn) adminNavBtn.style.display = 'none'
      if (profileNavBtn) profileNavBtn.style.display = 'none'
      document.getElementById('view-admin')?.classList.add('active')
      Admin.render()
      setTimeout(() => this._restoreTab('admin'), 50)
    } else if (user && role === 'member' && !Auth.needsProfile()) {
      if (savedView === 'admin') {
        if (adminNavBtn) adminNavBtn.style.display = 'none'
        if (profileNavBtn) profileNavBtn.style.display = ''
        document.getElementById('view-admin')?.classList.add('active')
        Admin.render()
        setTimeout(() => this._restoreTab('admin'), 50)
      } else {
        if (profileNavBtn) profileNavBtn.style.display = 'none'
        if (adminNavBtn) adminNavBtn.style.display = ''
        document.getElementById('view-dashboard')?.classList.add('active')
        Dashboard.render()
        setTimeout(() => this._restoreTab('dashboard'), 50)
      }
    } else if (user && !Auth.needsProfile()) {
      if (adminNavBtn) adminNavBtn.style.display = 'none'
      if (profileNavBtn) profileNavBtn.style.display = 'none'
      document.getElementById('view-dashboard')?.classList.add('active')
      Dashboard.render()
      setTimeout(() => this._restoreTab('dashboard'), 50)
    } else if (user && Auth.needsProfile()) {
      if (adminNavBtn) adminNavBtn.style.display = 'none'
      if (profileNavBtn) profileNavBtn.style.display = 'none'
      document.getElementById('view-auth')?.classList.add('active')
      document.getElementById('auth-google').style.display = 'none'
      document.getElementById('auth-complete-profile').style.display = 'block'
      const nameInput = document.getElementById('comp-name')
      if (nameInput && user.fullName) nameInput.value = user.fullName
      setTimeout(() => this.validateProfileForm(), 100)
    } else {
      if (adminNavBtn) adminNavBtn.style.display = 'none'
      if (profileNavBtn) profileNavBtn.style.display = 'none'
      document.getElementById('view-auth')?.classList.add('active')
      document.getElementById('auth-complete-profile').style.display = 'none'
      document.getElementById('auth-google').style.display = 'block'
      document.getElementById('auth-error').textContent = ''
    }
  },
}

document.addEventListener('DOMContentLoaded', () => App.init())
