window.Dashboard = {
  _unsubscribe: null,
  _lbPollInterval: null,

  render() {
    const user = Auth.currentUser()
    if (!user) return

    this.renderUserInfo(user)
    this.renderClaimArea(user)
    this.renderStats(user)
    this.renderAccountInfo(user)
    this.renderFeedback(user)
    this.renderLeaderboard()
    this.bindTabs()
    this.updateLeaderboardTabVisibility()

    if (this._unsubscribe) this._unsubscribe()
    this._unsubscribe = Store.onChange(() => this.autoRefresh(user))

    if (this._lbPollInterval) clearInterval(this._lbPollInterval)
    this._lbPollInterval = setInterval(() => {
      this.updateLeaderboardTabVisibility()
    }, 3000)
  },

  autoRefresh(user) {
    this.renderUserInfo(user)
    this.renderStats(user)
    this.renderLeaderboard()
    this.renderAccountInfo(user)
    this.renderFeedback(user)
    this.renderClaimArea(user)
  },

  bindTabs() {
    document.querySelectorAll('#view-dashboard .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#view-dashboard .tab-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        document.querySelectorAll('#view-dashboard .tab-content').forEach(c => c.classList.remove('active'))
        document.getElementById(btn.dataset.tab)?.classList.add('active')
        localStorage.setItem('ithopiia_activeTab_dashboard', btn.dataset.tab)
      })
    })
  },

  renderUserInfo(user) {
    const el = document.getElementById('dash-user-info')
    const fresh = (Store.get('users') || []).find(u => u.id === user.id) || user
    const showCumulative = Auth.isLeaderboardReleased()
    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${fresh.fullName}</div>
          <div class="stat-label">الاسم</div>
        </div>
        ${showCumulative ? `
        <div class="stat-card">
          <div class="stat-value">${fresh.cumulativePoints || 0}</div>
          <div class="stat-label">إجمالي النقاط</div>
        </div>
        ` : ''}
      </div>`
  },

  renderClaimArea(user) {
    const el = document.getElementById('dash-claim-area')
    const todayKey = Points.getTodayKey()
    const dailyPoints = Store.get('dailyPoints') || []
    let todayEntry = dailyPoints.find(p => p.userId === user.id && p.dateKey === todayKey)

    if (!todayEntry) {
      todayEntry = Points.ensureTodayPoints(user.id)
    }

    const total = todayEntry.finalScore || 0

    const remaining = Timer.getRemaining()
    const timeStr = Timer.formatTime(remaining > 0 ? remaining : 0)

    el.innerHTML = `
      <div class="clock-card">
        <div class="clock-glass">
          <div class="clock-display" id="dash-timer">${timeStr}</div>
          <div class="clock-unit">متبقي حتى نهاية اليوم</div>
        </div>
        <div class="clock-today-points">
          <span class="clock-points-label">نقاط اليوم</span>
          <span class="clock-points-value" id="dash-today-points">${total}</span>
        </div>
      </div>`

    Timer.startDayTimer((remaining) => {
      const timerEl = document.getElementById('dash-timer')
      if (timerEl) timerEl.textContent = Timer.formatTime(remaining)
    }, () => {
      const timerEl = document.getElementById('dash-timer')
      if (timerEl) timerEl.textContent = '00:00:00'
    })
  },

  renderStats(user) {
    const el = document.getElementById('dash-stats')
    const userRooms = user.rooms || []
    let visibleUsers = (Store.get('users') || []).filter(u => u.role !== 'admin')
    const isMember = user?.role === 'member'
    if (userRooms.length > 0 && !isMember) {
      visibleUsers = visibleUsers.filter(u => {
        if (u.id === user.id) return true
        return (u.rooms || []).some(r => userRooms.includes(r))
      })
    }
    const sorted = [...visibleUsers].sort((a, b) => (b.cumulativePoints || 0) - (a.cumulativePoints || 0))
    const rank = sorted.findIndex(u => u.id === user.id) + 1
    const lbReleased = Auth.isLeaderboardReleased()

    const todayKey = Points.getTodayKey()
    const dailyPoints = Store.get('dailyPoints') || []
    const todayEntry = dailyPoints.find(p => p.userId === user.id && p.dateKey === todayKey)
    const todayPoints = todayEntry ? (todayEntry.finalScore || 0) : 0

    el.innerHTML = `
      <h3>${lbReleased ? 'الترتيب' : 'الإحصائيات'}</h3>
      <div class="stats-grid">
        ${lbReleased ? `
        <div class="stat-card">
          <div class="stat-value">${rank > 0 ? '#' + rank : '-'}</div>
          <div class="stat-label">ترتيبك</div>
        </div>
        ` : ''}
        <div class="stat-card">
          <div class="stat-value">${todayPoints}</div>
          <div class="stat-label">نقاط اليوم</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${sorted.length}</div>
          <div class="stat-label">إجمالي الأعضاء</div>
        </div>
      </div>`
  },

  renderAccountInfo(user) {
    const el = document.getElementById('dash-account-info')
    const fresh = (Store.get('users') || []).find(u => u.id === user.id) || user

    const genderMap = { male: 'ذكر', female: 'أنثى' }
    const elkarazaMap = { yes: 'نعم', no: 'لا' }
    const createdDate = fresh.createdAt ? new Date(fresh.createdAt).toLocaleDateString('en-CA') : '-'

    const roleLabel = fresh.role === 'member' ? 'عضو لجنة' : fresh.role === 'admin' ? 'مشرف' : 'مستخدم'

    el.innerHTML = `
      <div class="account-info">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">الاسم الكامل</span>
            <span class="info-value">${fresh.fullName || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">البريد الإلكتروني</span>
            <span class="info-value">${fresh.email || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">النوع</span>
            <span class="info-value">${genderMap[fresh.gender] || fresh.gender || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">تاريخ الميلاد</span>
            <span class="info-value">${fresh.birthdate || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">الغرف التقييمية</span>
            <span class="info-value">${this._getUserRoomNames(fresh)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">رقم واتساب</span>
            <span class="info-value">${fresh.whatsapp || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">حضور الكرازة</span>
            <span class="info-value">${elkarazaMap[fresh.attendedElKaraza] || fresh.attendedElKaraza || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">تاريخ التسجيل</span>
            <span class="info-value">${createdDate}</span>
          </div>
          <div class="info-item">
            <span class="info-label">الدور</span>
            <span class="info-value">${roleLabel}</span>
          </div>
        </div>
      </div>`
  },

  renderFeedback(user) {
    const el = document.getElementById('dash-feedback')
    const notes = Store.get('notes') || []
    const aboutUser = notes.filter(n => n.targetUserId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    el.innerHTML = `
      <div class="feedback-section">
        <div class="feedback-list">
          <h3>الملاحظات عنك</h3>
          ${aboutUser.length === 0 ? '<p class="text-muted" style="font-size:13px">لا توجد ملاحظات بعد.</p>' : ''}
          ${aboutUser.map(n => `
            <div class="feedback-item feedback-admin">
              <div class="feedback-meta">
                <span class="feedback-author">${n.authorName}</span>
                <span class="feedback-role">${n.authorRole === 'member' ? 'عضو لجنة' : 'مشرف'}</span>
                <span class="feedback-date">${new Date(n.createdAt).toLocaleDateString('en-CA')}</span>
              </div>
              <div class="feedback-text">${n.text}</div>
            </div>
          `).join('')}
        </div>
      </div>`
  },

  renderLeaderboard() {
    const el = document.getElementById('dash-leaderboard-content')
    const released = Auth.isLeaderboardReleased()
    if (!released) {
      el.innerHTML = '<div class="lb-locked"><div class="lb-lock-icon">🔒</div><p>لوحة المتصدرين غير متاحة حاليًا</p></div>'
      return
    }
    if (window.Leaderboard) {
      el.innerHTML = Leaderboard.renderDashboard()
    }
  },

  updateLeaderboardTabVisibility() {
    const released = Auth.isLeaderboardReleased()
    const btn = document.getElementById('dash-lb-tab-btn')
    if (!btn) return
    btn.style.display = released ? '' : 'none'
    if (!released) {
      const tab = document.getElementById('dash-tab-leaderboard')
      if (tab && tab.classList.contains('active')) {
        document.querySelectorAll('#view-dashboard .tab-btn').forEach(b => b.classList.remove('active'))
        document.querySelectorAll('#view-dashboard .tab-content').forEach(c => c.classList.remove('active'))
        const firstTab = document.querySelector('#view-dashboard .tab-btn')
        if (firstTab) firstTab.classList.add('active')
        const firstContent = document.getElementById(firstTab?.dataset?.tab)
        if (firstContent) firstContent.classList.add('active')
      }
    }
  },

  _getUserRoomNames(user) {
    const rooms = Store.get('rooms') || []
    const userRoomIds = user.rooms || []
    if (userRoomIds.length === 0) return '-'
    return userRoomIds.map(id => {
      const r = rooms.find(room => room.id === id)
      return r ? r.name : id
    }).join(', ')
  }
}
