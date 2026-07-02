window.Leaderboard = {
  _selectedMonth: null,
  _activeTab: 'monthly',

  _getMonths() {
    return Points.getMonths()
  },

  _monthOptions() {
    return this._getMonths().map(m => {
      const label = Points.getMonthName(m) + ' ' + m.split('-')[0]
      return `<option value="${m}" ${m === this._selectedMonth ? 'selected' : ''}>${label}</option>`
    }).join('')
  },

  _renderList(standings, currentUser) {
    if (!standings.length) return '<p class="text-muted">لا توجد بيانات.</p>'
    const canViewProfile = currentUser && (currentUser.role === 'admin' || currentUser.role === 'member')
    const highest = standings[0]
    const lowest = standings[standings.length - 1]

    return `<div class="lb-list">
      ${standings.map((u, i) => {
        const isHighest = u.total > 0 && u.userId === highest.userId
        const isLowest = u.total > 0 && standings.length > 1 && u.userId === lowest.userId && lowest.total < highest.total
        return `
        <div class="leaderboard-item ${u.userId === currentUser?.id ? 'highlight' : ''} ${isHighest ? 'lb-highest' : ''} ${isLowest ? 'lb-lowest' : ''}" data-name="${u.fullName.toLowerCase()}">
          <span class="rank">${i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : '#' + (i + 1)}</span>
          <span class="name">${canViewProfile ? `<span class="name-link" onclick="Admin.showUserProfile('${u.userId}')">${u.fullName}</span>` : u.fullName}</span>
          <span class="points">${u.total} نقطة</span>
          ${isHighest ? '<span class="lb-badge lb-badge-gold">🏆 أعلى واحد له مكافأة</span>' : ''}
          ${isLowest ? '<span class="lb-badge lb-badge-danger">⚠️ أقل واحد له عقاب</span>' : ''}
        </div>`
      }).join('')}
    </div>`
  },

  _renderMonthSection(yearMonth, standings, currentUser) {
    const label = Points.getMonthName(yearMonth) + ' ' + yearMonth.split('-')[0]
    return `
      <div class="lb-month-section">
        <h3 class="lb-month-title">شهر ${label}</h3>
        ${this._renderList(standings, currentUser)}
      </div>`
  },

  _renderTabSwitcher() {
    return `
      <div class="lb-tab-switcher">
        <button class="lb-tab-btn ${this._activeTab === 'monthly' ? 'active' : ''}" onclick="Leaderboard.switchTab('monthly')">
          📅 الترتيب الحالي (شهري)
        </button>
        <button class="lb-tab-btn ${this._activeTab === 'cumulative' ? 'active' : ''}" onclick="Leaderboard.switchTab('cumulative')">
          🏆 المجموع العام (كل الشهور)
        </button>
      </div>`
  },

  switchTab(tab) {
    this._activeTab = tab
    const dashEl = document.getElementById('dash-leaderboard-content')
    if (dashEl) {
      const released = Auth.isLeaderboardReleased()
      if (released) dashEl.innerHTML = this.renderDashboard()
    }
    const adminLb = document.getElementById('admin-tab-leaderboard')
    if (adminLb && adminLb.closest('.tab-content')?.classList.contains('active')) {
      adminLb.innerHTML = this.renderAdmin()
    }
  },

  selectMonth(yearMonth) {
    this._selectedMonth = yearMonth
    if (this._activeTab !== 'monthly') return
    const dashEl = document.getElementById('dash-leaderboard-content')
    if (dashEl) {
      const released = Auth.isLeaderboardReleased()
      if (released) dashEl.innerHTML = this.renderDashboard()
    }
    const adminLb = document.getElementById('admin-tab-leaderboard')
    if (adminLb && adminLb.closest('.tab-content')?.classList.contains('active')) {
      adminLb.innerHTML = this.renderAdmin()
    }
  },

  _getFilteredApprovedUsers(currentUser) {
    const users = Store.get('users') || []
    let approved = users.filter(u => u.status === 'approved' && u.role !== 'admin')
    const isHiddenAdmin = Auth.isHiddenAdmin()
    const isMember = currentUser?.role === 'member'
    if (!isHiddenAdmin && !isMember && currentUser) {
      const userRooms = currentUser.rooms || []
      approved = approved.filter(u => {
        if (u.id === currentUser.id) return true
        const otherRooms = u.rooms || []
        return otherRooms.some(r => userRooms.includes(r))
      })
    }
    approved = approved.filter(u => u.gender === currentUser.gender)
    return approved
  },

  renderDashboard() {
    const currentUser = Auth.currentUser()
    if (!currentUser) return '<p class="text-muted">لا يوجد أعضاء بعد.</p>'

    const months = this._getMonths()
    if (!this._selectedMonth && months.length > 0) {
      this._selectedMonth = months[0]
    }

    if (!this._selectedMonth) return '<p class="text-muted">لا توجد بيانات شهرية.</p>'

    let tabContent = ''

    if (this._activeTab === 'monthly') {
      const approved = this._getFilteredApprovedUsers(currentUser)
      const approvedIds = new Set(approved.map(u => u.id))
      const standings = Points.getMonthlyLeaderboard(this._selectedMonth)
        .filter(s => approvedIds.has(s.userId))
      tabContent = `
        <div class="lb-controls">
          <label class="lb-filter-label">تصفية بالشهر:</label>
          <select class="lb-month-select" onchange="Leaderboard.selectMonth(this.value)">
            ${this._monthOptions()}
          </select>
        </div>
        <input type="text" class="lb-search" placeholder="بحث..." oninput="Leaderboard.filter(this)">
        ${this._renderMonthSection(this._selectedMonth, standings, currentUser)}`
    } else {
      const approved = this._getFilteredApprovedUsers(currentUser)
      const approvedIds = new Set(approved.map(u => u.id))
      const standings = Points.getLeaderboard()
        .filter(s => approvedIds.has(s.userId))
      tabContent = `
        <input type="text" class="lb-search" placeholder="بحث..." oninput="Leaderboard.filter(this)">
        <div class="lb-month-section">
          <h3 class="lb-month-title">المجموع العام (كل الشهور)</h3>
          ${this._renderList(standings, currentUser)}
        </div>`
    }

    return `
      ${this._renderTabSwitcher()}
      ${tabContent}`
  },

  renderAdmin() {
    const currentUser = Auth.currentUser()
    const months = this._getMonths()
    if (!this._selectedMonth && months.length > 0) {
      this._selectedMonth = months[0]
    }

    if (!this._selectedMonth) return '<p class="text-muted">لا توجد بيانات شهرية.</p>'

    let bodyContent = ''

    if (this._activeTab === 'monthly') {
      const boyStandings = Points.getMonthlyLeaderboard(this._selectedMonth, 'male')
      const girlStandings = Points.getMonthlyLeaderboard(this._selectedMonth, 'female')
      bodyContent = `
        <div class="lb-controls" style="margin-bottom:16px">
          <label class="lb-filter-label">تصفية بالشهر:</label>
          <select class="lb-month-select" onchange="Leaderboard.selectMonth(this.value)">
            ${this._monthOptions()}
          </select>
        </div>
        <div class="admin-lb-split">
          <div class="lb-gender-section">
            <h3 class="lb-gender-title">ترتيب الأولاد</h3>
            <input type="text" class="lb-search" placeholder="بحث في الأولاد..." oninput="Leaderboard.filter(this)">
            ${this._renderList(boyStandings, currentUser)}
          </div>
          <div class="lb-gender-section">
            <h3 class="lb-gender-title">ترتيب البنات</h3>
            <input type="text" class="lb-search" placeholder="بحث في البنات..." oninput="Leaderboard.filter(this)">
            ${this._renderList(girlStandings, currentUser)}
          </div>
        </div>`
    } else {
      const boyStandings = Points.getLeaderboard('male')
      const girlStandings = Points.getLeaderboard('female')
      bodyContent = `
        <div class="admin-lb-split">
          <div class="lb-gender-section">
            <h3 class="lb-gender-title">ترتيب الأولاد - المجموع العام</h3>
            <input type="text" class="lb-search" placeholder="بحث في الأولاد..." oninput="Leaderboard.filter(this)">
            ${this._renderList(boyStandings, currentUser)}
          </div>
          <div class="lb-gender-section">
            <h3 class="lb-gender-title">ترتيب البنات - المجموع العام</h3>
            <input type="text" class="lb-search" placeholder="بحث في البنات..." oninput="Leaderboard.filter(this)">
            ${this._renderList(girlStandings, currentUser)}
          </div>
        </div>`
    }

    return `
      ${this._renderTabSwitcher()}
      ${bodyContent}`
  },

  filter(input) {
    const q = input.value.toLowerCase()
    const list = input.parentElement.querySelector('.lb-list')
    if (!list) return
    list.querySelectorAll('.leaderboard-item').forEach(item => {
      item.style.display = item.dataset.name.includes(q) ? '' : 'none'
    })
  }
}
