window.Leaderboard = {
  _selectedMonth: null,
  _selectedRoom: null,
  _activeTab: 'monthly',

  _getMonths() {
    return Points.getMonths()
  },

  _getRooms() {
    return Store.get('rooms') || []
  },

  _monthOptions() {
    return this._getMonths().map(m => {
      const label = Points.getMonthName(m) + ' ' + m.split('-')[0]
      return `<option value="${m}" ${m === this._selectedMonth ? 'selected' : ''}>${label}</option>`
    }).join('')
  },

  _resolveRoom(preferUserRoom) {
    const rooms = this._getRooms()
    if (this._selectedRoom && rooms.some(r => r.id === this._selectedRoom)) return this._selectedRoom
    const saved = localStorage.getItem('ithopiia_lbRoom')
    if (saved && rooms.some(r => r.id === saved)) return saved
    if (preferUserRoom) {
      const currentUser = Auth.currentUser()
      const primary = currentUser ? Points.getPrimaryRoomId(currentUser.id) : null
      if (primary) return primary
    }
    return rooms.length ? rooms[0].id : null
  },

  _roomOptions() {
    const selected = this._resolveRoom(true)
    return this._getRooms().map(r =>
      `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${r.name}</option>`
    ).join('')
  },

  _renderRoomControls() {
    if (!this._getRooms().length) return ''
    return `
      <div class="lb-controls" style="margin-bottom:12px">
        <label class="lb-filter-label">الغرفة:</label>
        <select class="lb-month-select" onchange="Leaderboard.selectRoom(this.value)">
          ${this._roomOptions()}
        </select>
      </div>`
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

  _rerender() {
    const dashEl = document.getElementById('dash-leaderboard-content')
    if (dashEl && Auth.isLeaderboardReleased()) {
      dashEl.innerHTML = this.renderDashboard()
    }
    const adminLb = document.getElementById('admin-tab-leaderboard')
    if (adminLb && adminLb.closest('.tab-content')?.classList.contains('active')) {
      adminLb.innerHTML = this.renderAdmin()
    }
  },

  switchTab(tab) {
    this._activeTab = tab
    this._rerender()
  },

  selectMonth(yearMonth) {
    this._selectedMonth = yearMonth
    if (this._activeTab !== 'monthly') return
    this._rerender()
  },

  selectRoom(roomId) {
    this._selectedRoom = roomId || null
    localStorage.setItem('ithopiia_lbRoom', roomId || '')
    this._rerender()
  },

  _getFilteredApprovedUsers(currentUser, roomId) {
    const users = Store.get('users') || []
    let approved = users.filter(u => u.status === 'approved' && u.role !== 'admin')
    if (roomId) {
      approved = approved.filter(u => u.id === currentUser.id || Points.isUserInRoom(u, roomId))
    } else {
      const isHiddenAdmin = Auth.isHiddenAdmin()
      if (!isHiddenAdmin && currentUser) {
        const userRooms = currentUser.rooms || []
        approved = approved.filter(u => {
          if (u.id === currentUser.id) return true
          const otherRooms = u.rooms || []
          return otherRooms.some(r => userRooms.includes(r))
        })
      }
    }
    approved = approved.filter(u => u.gender === currentUser.gender)
    return approved
  },

  renderDashboard() {
    const currentUser = Auth.currentUser()
    if (!currentUser) return '<p class="text-muted">لا يوجد أعضاء بعد.</p>'

    const roomId = this._resolveRoom(true)

    const months = this._getMonths()
    if (!this._selectedMonth && months.length > 0) {
      this._selectedMonth = months[0]
    }

    if (!this._selectedMonth) return '<p class="text-muted">لا توجد بيانات شهرية.</p>'

    const roomControls = this._renderRoomControls()

    let tabContent = ''

    if (this._activeTab === 'monthly') {
      const approved = this._getFilteredApprovedUsers(currentUser, roomId)
      const approvedIds = new Set(approved.map(u => u.id))
      const isFutureMonth = this._selectedMonth > Points.getCurrentYearMonth()
      const standings = isFutureMonth
        ? []
        : Points.getMonthlyLeaderboard(roomId, this._selectedMonth)
            .filter(s => approvedIds.has(s.userId))
      const monthBody = isFutureMonth
        ? '<p class="text-muted">الشهر لم يبدأ بعد.</p>'
        : this._renderMonthSection(this._selectedMonth, standings, currentUser)
      tabContent = `
        <div class="lb-controls">
          <label class="lb-filter-label">تصفية بالشهر:</label>
          <select class="lb-month-select" onchange="Leaderboard.selectMonth(this.value)">
            ${this._monthOptions()}
          </select>
        </div>
        <input type="text" class="lb-search" placeholder="بحث..." oninput="Leaderboard.filter(this)">
        ${monthBody}`
    } else {
      const approved = this._getFilteredApprovedUsers(currentUser, roomId)
      const approvedIds = new Set(approved.map(u => u.id))
      const standings = Points.getLeaderboard(roomId)
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
      ${roomControls}
      ${tabContent}`
  },

  renderAdmin() {
    const currentUser = Auth.currentUser()
    const roomId = this._resolveRoom(false)
    const months = this._getMonths()
    if (!this._selectedMonth && months.length > 0) {
      this._selectedMonth = months[0]
    }

    if (!this._selectedMonth) return '<p class="text-muted">لا توجد بيانات شهرية.</p>'

    const roomControls = this._renderRoomControls()
    let bodyContent = ''

    if (this._activeTab === 'monthly') {
      const isFutureMonth = this._selectedMonth > Points.getCurrentYearMonth()
      const genderSections = isFutureMonth
        ? '<p class="text-muted">الشهر لم يبدأ بعد.</p>'
        : `
        <div class="admin-lb-split">
          <div class="lb-gender-section">
            <h3 class="lb-gender-title">ترتيب الأولاد</h3>
            <input type="text" class="lb-search" placeholder="بحث في الأولاد..." oninput="Leaderboard.filter(this)">
            ${this._renderList(Points.getMonthlyLeaderboard(roomId, this._selectedMonth, 'male'), currentUser)}
          </div>
          <div class="lb-gender-section">
            <h3 class="lb-gender-title">ترتيب البنات</h3>
            <input type="text" class="lb-search" placeholder="بحث في البنات..." oninput="Leaderboard.filter(this)">
            ${this._renderList(Points.getMonthlyLeaderboard(roomId, this._selectedMonth, 'female'), currentUser)}
          </div>
        </div>`
      bodyContent = `
        <div class="lb-controls" style="margin-bottom:16px">
          <label class="lb-filter-label">تصفية بالشهر:</label>
          <select class="lb-month-select" onchange="Leaderboard.selectMonth(this.value)">
            ${this._monthOptions()}
          </select>
        </div>
        ${genderSections}`
    } else {
      const boyStandings = Points.getLeaderboard(roomId, 'male')
      const girlStandings = Points.getLeaderboard(roomId, 'female')
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
      ${roomControls}
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
