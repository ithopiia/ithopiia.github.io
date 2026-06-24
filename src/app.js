window.App = {
  async init() {
    await Store.init()

    Points.grantDailyPoints()

    Auth.init()

    Auth.onAuth(() => this.render())

    document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout())
    document.getElementById('google-auth-btn')?.addEventListener('click', () => this.handleGoogleSignIn())
    document.getElementById('comp-btn')?.addEventListener('click', () => this.handleCompleteProfile())
    document.getElementById('local-btn')?.addEventListener('click', () => this.handleLocalLogin())

    this.populateRooms()
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

  populateRooms() {
    const sel = document.getElementById('local-room')
    if (!sel) return
    sel.innerHTML = '<option value="">اختر الغرفة</option>'
    CONFIG.rooms.forEach(r => {
      const opt = document.createElement('option')
      opt.value = r; opt.textContent = r
      sel.appendChild(opt)
    })
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

    if (!fullName || !year || !month || !day || !attendedElKaraza || !gender) {
      errorEl.textContent = 'يرجى ملء جميع الحقول المطلوبة.'; return
    }

    const birthdate = year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0')

    const btn = document.getElementById('comp-btn')
    btn.disabled = true; btn.textContent = 'جارٍ الحفظ...'

    const result = await Auth.completeProfile({ fullName, birthdate, whatsapp, gender, attendedElKaraza })
    if (result.ok) {
      location.reload()
    } else {
      errorEl.textContent = result.error
      btn.disabled = false; btn.textContent = 'حفظ'
    }
  },

  async handleLocalLogin() {
    const name = document.getElementById('local-name').value.trim()
    const gender = document.getElementById('local-gender').value
    const room = document.getElementById('local-room').value
    const errorEl = document.getElementById('local-error')
    errorEl.textContent = ''
    if (!name || !gender || !room) { errorEl.textContent = 'يرجى ملء جميع الحقول.'; return }
    const btn = document.getElementById('local-btn')
    btn.disabled = true; btn.textContent = 'جارٍ...'
    const res = await Auth.loginLocal(name, gender, room)
    if (res.ok) {
      this.render()
    } else {
      errorEl.textContent = res.error
      btn.disabled = false; btn.textContent = 'دخول'
    }
  },

  showAdmin() {
    localStorage.setItem('ithopiia_activeView', 'admin')
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
    document.getElementById('view-admin')?.classList.add('active')
    Admin.render()
    document.getElementById('admin-nav-btn').style.display = 'none'
    document.getElementById('profile-nav-btn').style.display = ''
    setTimeout(() => this._restoreTab('admin'), 50)
  },

  showDashboard() {
    localStorage.setItem('ithopiia_activeView', 'dashboard')
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
    document.getElementById('view-dashboard')?.classList.add('active')
    Dashboard.render()
    document.getElementById('profile-nav-btn').style.display = 'none'
    document.getElementById('admin-nav-btn').style.display = ''
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
    const isHiddenAdmin = Auth.isHiddenAdmin()
    const isAdminOrMember = Auth.isAdmin()
    const logoutBtn = document.getElementById('logout-btn')
    const adminNavBtn = document.getElementById('admin-nav-btn')
    const profileNavBtn = document.getElementById('profile-nav-btn')

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
    if (logoutBtn) logoutBtn.style.display = user ? '' : 'none'

    const savedView = localStorage.getItem('ithopiia_activeView')

    if (user && isHiddenAdmin) {
      if (adminNavBtn) adminNavBtn.style.display = 'none'
      if (profileNavBtn) profileNavBtn.style.display = ''
      document.getElementById('view-admin')?.classList.add('active')
      Admin.render()
      setTimeout(() => this._restoreTab('admin'), 50)
    } else if (user && isAdminOrMember && !Auth.needsProfile()) {
      if (adminNavBtn) adminNavBtn.style.display = ''
      if (profileNavBtn) profileNavBtn.style.display = 'none'
      if (savedView === 'admin' && isAdminOrMember) {
        document.getElementById('view-admin')?.classList.add('active')
        Admin.render()
        setTimeout(() => this._restoreTab('admin'), 50)
      } else {
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
      document.getElementById('auth-local').style.display = 'none'
      const nameInput = document.getElementById('comp-name')
      if (nameInput && user.fullName) nameInput.value = user.fullName
    } else {
      if (adminNavBtn) adminNavBtn.style.display = 'none'
      if (profileNavBtn) profileNavBtn.style.display = 'none'
      document.getElementById('view-auth')?.classList.add('active')
      document.getElementById('auth-complete-profile').style.display = 'none'
      if (CONFIG.useFirebase) {
        document.getElementById('auth-google').style.display = 'block'
        document.getElementById('auth-local').style.display = 'none'
      } else {
        document.getElementById('auth-google').style.display = 'none'
        document.getElementById('auth-local').style.display = 'block'
      }
      document.getElementById('auth-error').textContent = ''
    }
  },
}

document.addEventListener('DOMContentLoaded', () => App.init())
