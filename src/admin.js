window.Admin = {
  _editingDateKey: null,
  _activeGenderUsers: 'all',
  _roomsStoreUnsub: null,
  _lastLeaderboardState: null,
  _schedulerLastVisible: undefined,

  render() {
    this.renderUsers()
    this.renderNotesTab()
    this.renderLeaderboardTab()
    this.renderSchedulerTab()
    this.renderUserInfoTab()
    this.renderRoomsTab()
    this.bindTabs()
    if (window.Evaluation) {
      Evaluation.render()
    }
  },

  bindTabs() {
    document.querySelectorAll('#view-admin .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#view-admin .tab-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        document.querySelectorAll('#view-admin .tab-content').forEach(c => c.classList.remove('active'))
        const tabId = btn.dataset.tab
        const tab = document.getElementById(tabId)
        if (tab) tab.classList.add('active')
        if (tabId === 'tab-evaluation' && window.Evaluation) {
          Evaluation.render()
        } else if (tabId === 'admin-tab-notes') {
          this.renderNotesTab()
        } else if (tabId === 'tab-users') {
          this.renderUsers()
        } else if (tabId === 'admin-tab-leaderboard') {
          this.renderLeaderboardTab()
        } else if (tabId === 'admin-tab-userinfo') {
          this.renderUserInfoTab()
        } else if (tabId === 'admin-tab-scheduler') {
          this.renderSchedulerTab()
        } else if (tabId === 'admin-tab-rooms') {
          this.renderRoomsTab()
        }
        localStorage.setItem('ithopiia_activeTab_admin', tabId)
      })
    })
  },

  renderUsers() {
    const users = (Store.get('users') || []).filter(u => u.role !== 'admin')
    const activeGender = this._activeGenderUsers || 'all'
    let filtered = users
    if (activeGender !== 'all') {
      filtered = users.filter(u => u.gender === activeGender)
    }
    const totalMale = users.filter(u => u.gender === 'male').length
    const totalFemale = users.filter(u => u.gender === 'female').length
    const el = document.getElementById('tab-users')
    el.innerHTML = `
      <input type="text" id="admin-search" class="search-input" placeholder="بحث عن مستخدمين..." oninput="Admin.filterUsers()">
      <div class="gender-tabs">
        <button class="filter-btn ${activeGender === 'all' ? 'active' : ''}" onclick="Admin.setUsersGender('all')">الكل (${users.length})</button>
        <button class="filter-btn ${activeGender === 'male' ? 'active' : ''}" onclick="Admin.setUsersGender('male')">الأولاد (${totalMale})</button>
        <button class="filter-btn ${activeGender === 'female' ? 'active' : ''}" onclick="Admin.setUsersGender('female')">البنات (${totalFemale})</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>النقاط</th><th>الحالة</th><th>النوع</th><th>الإجراء</th></tr></thead>
          <tbody id="admin-users-tbody">
            ${filtered.map(u => {
              return `
              <tr>
                <td><span class="name-link" onclick="Admin.showUserProfile('${u.id}')">${u.fullName}</span></td>
                <td>${u.email || '-'}</td>
                <td>${u.cumulativePoints || 0}</td>
                <td>${u.status === 'approved' ? 'مقبول' : u.status === 'rejected' ? 'مرفوض' : u.status || '-'}</td>
                <td>${u.role === 'member' ? '👤 عضو' : 'مستخدم'}</td>
                <td class="table-actions">
                  <button class="btn-sm ${u.role === 'member' ? 'btn-danger' : 'btn-primary'}" onclick="Admin.toggleMemberRole('${u.id}')">${u.role === 'member' ? 'إلغاء العضوية' : 'ترقية لعضو'}</button>
                  <button class="btn-sm btn-danger" onclick="Admin.deleteUser('${u.id}')">حذف</button>
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>`
    const search = document.getElementById('admin-search')
    if (search && search.value) this.filterUsers()
  },

  setUsersGender(gender) {
    this._activeGenderUsers = gender
    this.renderUsers()
  },

  async toggleMemberRole(id) {
    const user = Store.get('users').find(u => u.id === id)
    if (!user) return
    let newRole
    if (user.role === 'member') {
      if (!confirm('إلغاء صلاحيات العضو لهذا المستخدم؟')) return
      newRole = 'user'
    } else {
      if (!confirm('ترقية هذا المستخدم إلى عضو؟ سيحصل على صلاحيات المشرف مع بقائه ظاهرًا في الموقع.')) return
      newRole = 'member'
    }
    user.role = newRole
    await Store.writePath(`users/${id}/role`, newRole)
    this.renderUsers()
  },

  filterUsers() {
    const q = document.getElementById('admin-search').value.toLowerCase()
    document.querySelectorAll('#admin-users-tbody tr').forEach(tr => {
      const name = tr.children[0]?.textContent.toLowerCase() || ''
      tr.style.display = name.includes(q) ? '' : 'none'
    })
  },

  showUserProfile(userId) {
    const currentUser = Auth.currentUser()
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'member')) return
    const user = (Store.get('users') || []).find(u => u.id === userId)
    if (!user) return

    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    const renderModal = () => {
      const freshUser = (Store.get('users') || []).find(u => u.id === userId) || user
      const dailyPoints = Store.get('dailyPoints') || []
      const userPoints = dailyPoints.filter(p => p.userId === userId && p.saved)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))

      const notes = Store.get('notes') || []
      const userNotes = notes.filter(n => n.targetUserId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      const genderMap = { male: 'ذكر', female: 'أنثى' }
      const rooms = Store.get('rooms') || []
      const userRoomNames = (freshUser.rooms || []).map(id => {
        const r = rooms.find(room => room.id === id)
        return r ? r.name : id
      }).join(', ') || '-'

      const currentRank = freshUser.currentRank ?? Store.getUserRank(userId)
      const previousRank = freshUser.previousRank

      const prevLabel = previousRank ? 'السابق' : null

      const penaltyDates = userPoints.filter(p => (p.manualBonus || 0) < 0).map(p => p.dateKey).reverse()
      const bonusDates = userPoints.filter(p => (p.manualBonus || 0) > 0).map(p => p.dateKey).reverse()
      const zeroDates = userPoints.filter(p => (p.finalScore || 0) <= 0).map(p => p.dateKey).reverse()

      overlay.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        <div class="modal-header">
          <h2>${freshUser.fullName}</h2>
          <span class="badge" style="background:var(--accent);color:#000">${freshUser.role === 'member' ? 'عضو لجنة' : 'مستخدم'}</span>
        </div>
        <div class="modal-body">
          <div class="stats-grid" style="grid-template-columns:1fr 1fr">
            <div class="stat-card">
              <div class="stat-value" id="modal-cumulative-${userId}">${freshUser.cumulativePoints || 0}</div>
              <div class="stat-label">إجمالي النقاط</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${userPoints.length}</div>
              <div class="stat-label">أيام مسجلة</div>
            </div>
          </div>
          ${currentRank > 0 ? `
          <div class="rank-history-line" style="margin-top:12px;text-align:center;padding:10px;background:var(--surface2);border-radius:var(--radius);border:1px solid var(--border)">
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">تحديث الترتيب</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap">
              <span style="font-size:0.85rem;color:var(--text-muted)">الحالي:</span>
              <span style="font-size:1.3rem;font-weight:700;color:var(--accent)">#${currentRank}</span>
              ${previousRank != null && previousRank !== currentRank ? `
              <span style="color:var(--text-muted)">|</span>
              <span style="color:var(--accent);font-size:0.95rem;font-weight:600">ترتيبه كان #${previousRank} وأصبح #${currentRank}</span>
              ` : previousRank != null ? `
              <span style="color:var(--text-muted)">|</span>
              <span style="color:var(--accent);font-size:0.95rem;font-weight:600">ترتيبه #${currentRank}</span>
              ` : '<span style="font-size:0.8rem;color:var(--text-muted)">(لا تبيانات سابقة)</span>'}
            </div>
          </div>` : ''}
          <div class="info-grid" style="margin-top:12px">
            <div class="info-item"><span class="info-label">البريد</span><span class="info-value">${freshUser.email || '-'}</span></div>
            <div class="info-item"><span class="info-label">النوع</span><span class="info-value">${genderMap[freshUser.gender] || freshUser.gender || '-'}</span></div>
            <div class="info-item"><span class="info-label">الغرف التقييمية</span><span class="info-value">${userRoomNames}</span></div>
            <div class="info-item"><span class="info-label">تاريخ الميلاد</span><span class="info-value">${freshUser.birthdate || '-'}</span></div>
            <div class="info-item"><span class="info-label">واتساب</span><span class="info-value">${freshUser.whatsapp || '-'}</span></div>
            <div class="info-item"><span class="info-label">الكرازة</span><span class="info-value">${freshUser.attendedElKaraza === 'yes' ? 'نعم' : freshUser.attendedElKaraza === 'no' ? 'لا' : '-'}</span></div>
            ${freshUser.createdAt ? `<div class="info-item"><span class="info-label">تاريخ التسجيل</span><span class="info-value">${new Date(freshUser.createdAt).toLocaleDateString('en-CA')}</span></div>` : ''}
          </div>
          ${userNotes.length > 0 ? `
            <h3 style="margin-top:16px;font-size:1rem;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:8px">الملاحظات المكتوبة من كل الليدرز عليه</h3>
            ${userNotes.map(n => `
              <div class="feedback-item">
                <div class="feedback-meta">
                  <span class="feedback-author">${n.authorName}</span>
                  <span class="feedback-date">${new Date(n.createdAt).toLocaleDateString('en-CA')}</span>
                </div>
                <div class="feedback-text" style="font-size:0.85rem">${n.text}</div>
              </div>
            `).join('')}
          ` : ''}
          <h3 style="margin-top:16px;font-size:1rem;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:8px">إحصائيات شاملة</h3>
          <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr;cursor:pointer">
            <div class="stat-card ${Admin._activeStatTab === 'penalty' ? 'stat-card-active' : ''}" onclick="Admin._selectStatTab('penalty')">
              <div class="stat-value">${penaltyDates.length}</div>
              <div class="stat-label">عدد مرات التمينص</div>
            </div>
            <div class="stat-card ${Admin._activeStatTab === 'bonus' ? 'stat-card-active' : ''}" onclick="Admin._selectStatTab('bonus')">
              <div class="stat-value">${bonusDates.length}</div>
              <div class="stat-label">عدد مرات البونص</div>
            </div>
            <div class="stat-card ${Admin._activeStatTab === 'zero' ? 'stat-card-active' : ''}" onclick="Admin._selectStatTab('zero')">
              <div class="stat-value">${zeroDates.length}</div>
              <div class="stat-label">عدد مرات التصفير</div>
            </div>
          </div>
          <div class="stats-timeline" id="stats-timeline-${userId}">
            ${Admin._renderTimeline(Admin._activeStatTab, penaltyDates, bonusDates, zeroDates, userPoints)}
          </div>
        </div>
      </div>`
    }

    renderModal()

    Admin._renderCurrentProfile = renderModal

    const unsub = Store.onChange(() => renderModal())

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        Admin._renderCurrentProfile = null
        unsub()
        overlay.remove()
      }
    })
    document.body.appendChild(overlay)
  },

  _selectStatTab(tab) {
    Admin._activeStatTab = tab
    const modalBody = document.querySelector('.modal-overlay .modal-body')
    const savedScroll = modalBody ? modalBody.scrollTop : 0
    if (Admin._renderCurrentProfile) Admin._renderCurrentProfile()
    requestAnimationFrame(() => {
      const newBody = document.querySelector('.modal-overlay .modal-body')
      if (newBody) newBody.scrollTop = savedScroll > 0 ? savedScroll : 0
      const timeline = document.querySelector('.modal-overlay .stats-timeline')
      if (timeline) timeline.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  },

  _renderTimeline(activeTab, penaltyDates, bonusDates, zeroDates, userPoints) {
    if (activeTab === 'penalty' && penaltyDates.length > 0) {
      return penaltyDates.map(d => `
        <div class="timeline-item">
          <div class="timeline-marker timeline-marker-penalty"></div>
          <div class="timeline-content">
            <div class="timeline-date">${d}</div>
            <div class="timeline-desc">تمنص</div>
          </div>
        </div>
      `).join('')
    }
    if (activeTab === 'bonus' && bonusDates.length > 0) {
      return bonusDates.map(d => `
        <div class="timeline-item">
          <div class="timeline-marker timeline-marker-bonus"></div>
          <div class="timeline-content">
            <div class="timeline-date">${d}</div>
            <div class="timeline-desc">بونص</div>
          </div>
        </div>
      `).join('')
    }
    if (activeTab === 'zero' && zeroDates.length > 0) {
      return zeroDates.map(d => {
        const dp = userPoints.find(p => p.dateKey === d)
        const reason = dp && dp.zeroReason ? dp.zeroReason : ''
        return `
        <div class="timeline-item">
          <div class="timeline-marker timeline-marker-zero"></div>
          <div class="timeline-content">
            <div class="timeline-date">${d}</div>
            <div class="timeline-desc">${reason ? `${reason}` : 'تصفير'}</div>
          </div>
        </div>`
      }).join('')
    }
    return '<p class="text-muted" style="text-align:center;padding:16px">اختر إحدى الإحصائيات أعلاه</p>'
  },

  deleteUser(id) {
    if (!confirm('هل تريد حذف هذا المستخدم؟')) return
    Store.writePath(`users/${id}`, null)
  },

  _schedTimerInterval: null,

  _getLeaderboardState() {
    if (this._lastLeaderboardState) return this._lastLeaderboardState
    const settings = Store.get('settings') || {}
    const lb = settings.leaderboard || {}
    return {
      openAt: lb.openAt || settings.leaderboardReleasedFrom || null,
      closeAt: lb.closeAt || settings.leaderboardReleasedUntil || null,
      forceOverride: lb.forceOverride || settings.leaderboardForceOverride || null,
      mode: lb.mode || null,
      visible: lb.visible !== undefined ? lb.visible : null
    }
  },

  _computeVisible(state) {
    const now = Date.now()
    if (state.forceOverride === 'open') return true
    if (state.forceOverride === 'closed') return false
    if (state.openAt && state.closeAt) return now >= state.openAt && now < state.closeAt
    if (state.openAt) return now >= state.openAt
    if (state.closeAt) return now < state.closeAt
    return false
  },

  renderLeaderboardTab() {
    const el = document.getElementById('admin-tab-leaderboard')
    el.innerHTML = window.Leaderboard ? Leaderboard.renderAdmin() : '<p class="text-muted">لا توجد بيانات.</p>'
  },

  renderSchedulerTab() {
    const el = document.getElementById('admin-tab-scheduler')
    if (!el) return

    if (this._schedTimerInterval) clearInterval(this._schedTimerInterval)

    const state = this._getLeaderboardState()
    const isVisible = this._computeVisible(state)
    this._schedulerLastVisible = isVisible

    const fromDate = state.openAt ? new Date(state.openAt) : new Date()
    const untilDate = state.closeAt ? new Date(state.closeAt) : new Date(Date.now() + 3600000)

    const fmtNum = n => String(n).padStart(2, '0')

    el.innerHTML = `
      <div class="lb-scheduler-card">
        <div class="lb-scheduler-header">
          <span class="lb-scheduler-icon">⏰</span>
          <span>جدولة ظهور المتصدرين</span>
        </div>
        <div class="lb-scheduler-status ${isVisible ? 'status-visible' : 'status-hidden'}">
          ${isVisible
            ? '<span class="lb-status-dot green"></span> 🟢 المتصدرين <strong>مرئي</strong> للمستخدمين'
            : '<span class="lb-status-dot red"></span> 🔴 المتصدرين <strong>مخفي</strong> عن المستخدمين'}
          <span id="sched-countdown" class="sched-countdown"></span>
        </div>
        <div class="lb-scheduler-override">
          <button class="btn btn-success" onclick="Admin.forceOpenLeaderboard()">🔓 فتح الآن</button>
          <button class="btn btn-danger" onclick="Admin.forceCloseLeaderboard()">🔒 إغلاق الآن</button>
          ${state.forceOverride ? '<button class="btn btn-ghost" onclick="Admin.clearLeaderboardOverride()">↩️ العودة للجدولة التلقائية</button>' : ''}
        </div>
        <hr>
        <div class="lb-dual-section">
          <h4>وقت الفتح التلقائي</h4>
          <div class="lb-scheduler-fields">
            <div class="lb-field-group">
              <label class="lb-field-label">التاريخ</label>
              <input type="date" id="lb-open-date" class="lb-input" value="${fmtNum(fromDate.getFullYear())}-${fmtNum(fromDate.getMonth() + 1)}-${fmtNum(fromDate.getDate())}">
            </div>
            <div class="lb-field-group">
              <label class="lb-field-label">الساعة</label>
              <input type="number" id="lb-open-hour" class="lb-input lb-input-narrow" value="${fmtNum(fromDate.getHours())}" min="0" max="23">
            </div>
            <div class="lb-field-group">
              <label class="lb-field-label">الدقائق</label>
              <input type="number" id="lb-open-minute" class="lb-input lb-input-narrow" value="${fmtNum(fromDate.getMinutes())}" min="0" max="59">
            </div>
            <div class="lb-field-group">
              <label class="lb-field-label">الثواني</label>
              <input type="number" id="lb-open-second" class="lb-input lb-input-narrow" value="${fmtNum(fromDate.getSeconds())}" min="0" max="59">
            </div>
          </div>
        </div>
        <div class="lb-dual-section">
          <h4>وقت القفل التلقائي</h4>
          <div class="lb-scheduler-fields">
            <div class="lb-field-group">
              <label class="lb-field-label">التاريخ</label>
              <input type="date" id="lb-close-date" class="lb-input" value="${fmtNum(untilDate.getFullYear())}-${fmtNum(untilDate.getMonth() + 1)}-${fmtNum(untilDate.getDate())}">
            </div>
            <div class="lb-field-group">
              <label class="lb-field-label">الساعة</label>
              <input type="number" id="lb-close-hour" class="lb-input lb-input-narrow" value="${fmtNum(untilDate.getHours())}" min="0" max="23">
            </div>
            <div class="lb-field-group">
              <label class="lb-field-label">الدقائق</label>
              <input type="number" id="lb-close-minute" class="lb-input lb-input-narrow" value="${fmtNum(untilDate.getMinutes())}" min="0" max="59">
            </div>
            <div class="lb-field-group">
              <label class="lb-field-label">الثواني</label>
              <input type="number" id="lb-close-second" class="lb-input lb-input-narrow" value="${fmtNum(untilDate.getSeconds())}" min="0" max="59">
            </div>
          </div>
        </div>
        <div class="lb-scheduler-actions">
          <button class="btn btn-primary" onclick="Admin.saveLeaderboardSchedule()">💾 حفظ الجدولة</button>
          <button class="btn btn-ghost btn-danger-text" onclick="Admin.clearLeaderboardSchedule()">🗑️ إلغاء الجدولة</button>
        </div>
      </div>`

    this._startSchedulerTimer()
  },

  _startSchedulerTimer() {
    if (this._schedTimerInterval) clearInterval(this._schedTimerInterval)
    this._schedTimerInterval = setInterval(() => this._updateSchedulerStatus(), 1000)
  },

  _updateSchedulerStatus() {
    const statusEl = document.querySelector('#admin-tab-scheduler .lb-scheduler-status')
    if (!statusEl) { clearInterval(this._schedTimerInterval); return }

    const state = this._getLeaderboardState()
    const isVisible = this._computeVisible(state)
    const now = Date.now()

    if (this._schedulerLastVisible !== undefined && this._schedulerLastVisible !== isVisible) {
      if (!state.forceOverride) {
        Store.writePath('settings/leaderboard/visible', isVisible)
      }
      if (this._lastLeaderboardState) {
        this._lastLeaderboardState.visible = isVisible
      }
    }
    this._schedulerLastVisible = isVisible

    let nextChange = Infinity
    if (!state.forceOverride) {
      if (!isVisible && state.openAt && now < state.openAt) nextChange = state.openAt
      if (isVisible && state.closeAt && now < state.closeAt) nextChange = state.closeAt
    }

    statusEl.className = 'lb-scheduler-status ' + (isVisible ? 'status-visible' : 'status-hidden')
    statusEl.innerHTML = `
      ${isVisible
        ? '<span class="lb-status-dot green"></span> 🟢 المتصدرين <strong>مرئي</strong> للمستخدمين'
        : '<span class="lb-status-dot red"></span> 🔴 المتصدرين <strong>مخفي</strong> عن المستخدمين'}
      ${nextChange !== Infinity
        ? `<span id="sched-countdown" class="sched-countdown"> — ${isVisible ? 'يغلق' : 'يفتح'} بعد ${Timer.formatTime(Math.floor((nextChange - now) / 1000))}</span>`
        : ''}`
  },

  saveLeaderboardSchedule() {
    const dateOpen = document.getElementById('lb-open-date')?.value
    const hrOpen = parseInt(document.getElementById('lb-open-hour')?.value)
    const minOpen = parseInt(document.getElementById('lb-open-minute')?.value)
    const secOpen = parseInt(document.getElementById('lb-open-second')?.value)

    const dateClose = document.getElementById('lb-close-date')?.value
    const hrClose = parseInt(document.getElementById('lb-close-hour')?.value)
    const minClose = parseInt(document.getElementById('lb-close-minute')?.value)
    const secClose = parseInt(document.getElementById('lb-close-second')?.value)

    if (!dateOpen || !dateClose) return

    const openTime = new Date(dateOpen + 'T' +
      String(hrOpen != null ? hrOpen : 0).padStart(2, '0') + ':' +
      String(minOpen != null ? minOpen : 0).padStart(2, '0') + ':' +
      String(secOpen != null ? secOpen : 0).padStart(2, '0')).getTime()

    const closeTime = new Date(dateClose + 'T' +
      String(hrClose != null ? hrClose : 0).padStart(2, '0') + ':' +
      String(minClose != null ? minClose : 0).padStart(2, '0') + ':' +
      String(secClose != null ? secClose : 0).padStart(2, '0')).getTime()

    if (isNaN(openTime) || isNaN(closeTime)) return
    if (closeTime <= openTime) { alert('يجب أن يكون وقت القفل بعد وقت الفتح'); return }

    const now = Date.now()
    const visible = now >= openTime && now < closeTime
    const data = { openAt: openTime, closeAt: closeTime, forceOverride: null, mode: 'auto', visible }
    this._lastLeaderboardState = data
    Store.writePath('settings/leaderboard', data)
    this.renderSchedulerTab()
  },

  clearLeaderboardSchedule() {
    if (!confirm('هل تريد إلغاء الجدولة بالكامل؟')) return
    const data = { openAt: null, closeAt: null, forceOverride: null, mode: null, visible: false }
    this._lastLeaderboardState = data
    Store.writePath('settings/leaderboard', data)
    this.renderSchedulerTab()
  },

  forceOpenLeaderboard() {
    const data = { forceOverride: 'open', mode: 'manual', visible: true }
    this._lastLeaderboardState = data
    Store.writePath('settings/leaderboard', data)
    this.renderSchedulerTab()
  },

  forceCloseLeaderboard() {
    const data = { forceOverride: 'closed', mode: 'manual', visible: false }
    this._lastLeaderboardState = data
    Store.writePath('settings/leaderboard', data)
    this.renderSchedulerTab()
  },

  clearLeaderboardOverride() {
    const settings = Store.get('settings') || {}
    const lb = settings.leaderboard || {}
    const openAt = lb.openAt || settings.leaderboardReleasedFrom || null
    const closeAt = lb.closeAt || settings.leaderboardReleasedUntil || null
    const now = Date.now()
    const visible = openAt && closeAt ? now >= openAt && now < closeAt : (openAt ? now >= openAt : (closeAt ? now < closeAt : false))
    const data = { openAt, closeAt, forceOverride: null, mode: 'auto', visible }
    this._lastLeaderboardState = data
    Store.writePath('settings/leaderboard', data)
    this.renderSchedulerTab()
  },

  renderNotesTab() {
    const el = document.getElementById('admin-tab-notes')
    const user = Auth.currentUser()
    if (!user) return

    const notes = Store.get('notes') || []
    const myNotes = notes.filter(n => n.authorId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    const allUsers = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin' && u.id !== user.id)

    el.innerHTML = `
      <div class="feedback-section">
        <div class="feedback-form">
          <h3>كتابة ملاحظة عن عضو</h3>
          <select id="admin-note-target" class="note-select">
            <option value="">اختر العضو...</option>
            ${allUsers.map(u => `<option value="${u.id}">${u.fullName}</option>`).join('')}
          </select>
          <textarea id="admin-note-input" class="feedback-input" placeholder="اكتب الملاحظة هنا..." rows="3"></textarea>
          <button class="btn-sm btn-primary" onclick="Admin.submitNote()">إرسال</button>
          <div id="admin-note-error" class="auth-error" style="margin-top:8px"></div>
        </div>
        <div class="feedback-list">
          <h3>ملاحظاتي</h3>
          ${myNotes.length === 0 ? '<p class="text-muted" style="font-size:13px">لا توجد ملاحظات بعد.</p>' : ''}
          ${myNotes.map(n => `
            <div class="feedback-item feedback-admin">
              <div class="feedback-meta">
                <span class="feedback-author">إلى: ${n.targetUserName}</span>
                <span class="feedback-date">${new Date(n.createdAt).toLocaleDateString('en-CA')}</span>
              </div>
              <div class="feedback-text">${n.text}</div>
              <button class="btn-sm btn-danger note-delete-btn" onclick="Admin.deleteNote('${n.id}')">حذف</button>
            </div>
          `).join('')}
        </div>
      </div>`
  },

  deleteNote(noteId) {
    if (!confirm('هل تريد حذف هذه الملاحظة؟')) return
    Store.writePath(`notes/${noteId}`, null)
  },

  submitNote() {
    const user = Auth.currentUser()
    if (!user) return
    const targetId = document.getElementById('admin-note-target')?.value
    const input = document.getElementById('admin-note-input')
    const errorEl = document.getElementById('admin-note-error')
    if (!targetId) {
      if (errorEl) errorEl.textContent = 'يرجى اختيار العضو.'
      return
    }
    if (!input || !input.value.trim()) {
      if (errorEl) errorEl.textContent = 'يرجى كتابة الملاحظة.'
      return
    }
    if (targetId === user.id) {
      if (errorEl) errorEl.textContent = 'لا يمكنك كتابة ملاحظة عن نفسك.'
      return
    }
    const target = (Store.get('users') || []).find(u => u.id === targetId)
    const note = {
      id: 'note_' + Date.now(),
      targetUserId: targetId,
      targetUserName: target ? target.fullName : '',
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role || 'user',
      text: input.value.trim(),
      createdAt: new Date().toISOString(),
    }
    Store.writePath(`notes/${note.id}`, note)
    if (errorEl) errorEl.textContent = ''
    input.value = ''
    document.getElementById('admin-note-target').value = ''
  },

  renderUserInfoTab() {
    const el = document.getElementById('admin-tab-userinfo')
    const users = (Store.get('users') || []).filter(u => u.role !== 'admin')
    const rooms = Store.get('rooms') || []
    const genderMap = { male: 'ذكر', female: 'أنثى' }
    el.innerHTML = `
      <h3>المعلومات الشخصية لجميع الأعضاء</h3>
      <input type="text" id="userinfo-search" class="search-input" placeholder="بحث..." oninput="Admin.filterUserInfo()">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد</th>
              <th>النوع</th>
              <th>تاريخ الميلاد</th>
              <th>الغرف التقييمية</th>
              <th>واتساب</th>
              <th>الكرازة</th>
              <th>الدور</th>
              <th>النقاط</th>
              <th>تاريخ التسجيل</th>
            </tr>
          </thead>
          <tbody id="userinfo-tbody">
            ${users.map(u => {
              const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-CA') : '-'
              const userRoomNames = (u.rooms || []).map(id => {
                const r = rooms.find(room => room.id === id)
                return r ? r.name : id
              }).join(', ') || '-'
              return `
                <tr>
                  <td>${u.fullName || '-'}</td>
                  <td>${u.email || '-'}</td>
                  <td>${genderMap[u.gender] || u.gender || '-'}</td>
                  <td>${u.birthdate || '-'}</td>
                  <td>${userRoomNames}</td>
                  <td>${u.whatsapp || '-'}</td>
                  <td>${u.attendedElKaraza === 'yes' ? 'نعم' : u.attendedElKaraza === 'no' ? 'لا' : '-'}</td>
                  <td>${u.role === 'member' ? 'عضو لجنة' : 'مستخدم'}</td>
                  <td>${u.cumulativePoints || 0}</td>
                  <td>${created}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </div>`
  },

  filterUserInfo() {
    const q = document.getElementById('userinfo-search').value.toLowerCase()
    document.querySelectorAll('#userinfo-tbody tr').forEach(tr => {
      const text = Array.from(tr.children).map(td => td.textContent.toLowerCase()).join(' ')
      tr.style.display = text.includes(q) ? '' : 'none'
    })
  },

  renderRoomsTab() {
    const el = document.getElementById('admin-tab-rooms')
    const user = Auth.currentUser()
    const rooms = Store.get('rooms') || []
    const allUsers = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')

    if (!this._roomsStoreUnsub) {
      this._roomsStoreUnsub = Store.onChange(() => {
        const tab = document.getElementById('admin-tab-rooms')
        if (tab && tab.classList.contains('active')) {
          this.renderRoomsTab()
        }
      })
    }

    el.innerHTML = `
      <h3>إدارة الغرف</h3>
      <div class="room-form">
        <input type="text" id="room-name-input" placeholder="اسم الغرفة الجديدة" style="padding:8px;width:250px">
        <button class="btn-sm btn-success" onclick="Admin.createRoom()">➕ إنشاء غرفة</button>
        <div id="room-error" class="auth-error" style="margin-top:4px"></div>
      </div>
      <hr style="margin:16px 0">
      <div class="room-list">
        ${rooms.length === 0 ? '<p class="text-muted">لا توجد غرف بعد. أنشئ غرفة جديدة.</p>' : ''}
        ${rooms.map(r => {
          const roomUsers = allUsers.filter(u => (u.rooms || []).includes(r.id))
          const nonMembers = allUsers.filter(u => !(u.rooms || []).includes(r.id))
          return `
            <div class="room-card">
              <div class="room-header">
                <span class="room-name">${r.name}</span>
                <span class="room-count">${roomUsers.length} عضو</span>
                <button class="btn-sm btn-danger" onclick="Admin.deleteRoom('${r.id}')">🗑️ حذف</button>
              </div>
              <div class="room-members">
                <h4>الأعضاء</h4>
                <div class="room-member-list">
                  ${roomUsers.map(u => `
                    <div class="room-member-item">
                      <span>${u.fullName}</span>
                      <button class="btn-sm btn-ghost" onclick="Admin.removeFromRoom('${r.id}','${u.id}')">إزالة</button>
                    </div>
                  `).join('')}
                  ${roomUsers.length === 0 ? '<span style="color:var(--text-muted);font-size:13px">لا يوجد أعضاء</span>' : ''}
                </div>
                <div class="room-add-member">
                  <select id="room-add-select-${r.id}" class="note-select">
                    <option value="">إضافة عضو...</option>
                    ${nonMembers.map(u => `<option value="${u.id}">${u.fullName}</option>`).join('')}
                  </select>
                  <button class="btn-sm btn-primary" onclick="Admin.addToRoom('${r.id}')">إضافة</button>
                </div>
              </div>
            </div>
          `
        }).join('')}
      </div>`
  },

  createRoom() {
    const input = document.getElementById('room-name-input')
    const errorEl = document.getElementById('room-error')
    const name = input?.value.trim()
    if (!name) { if (errorEl) errorEl.textContent = 'يرجى إدخال اسم الغرفة.'; return }
    const newRoom = {
      id: 'room_' + Date.now(),
      name,
      createdBy: Auth.currentUser()?.id,
      createdAt: new Date().toISOString(),
    }
    const rooms = Store.get('rooms')
    rooms.push(newRoom)
    Store.writePath(`rooms/${newRoom.id}`, newRoom)
    if (errorEl) errorEl.textContent = ''
    input.value = ''
    this.renderRoomsTab()
  },

  deleteRoom(roomId) {
    if (!confirm('حذف الغرفة سيؤدي إلى إزالة جميع الأعضاء منها. هل تريد المتابعة؟')) return
    const rooms = Store.get('rooms')
    const idx = rooms.findIndex(r => r.id === roomId)
    if (idx !== -1) rooms.splice(idx, 1)
    Store.writePath(`rooms/${roomId}`, null)
    const users = Store.get('users')
    users.forEach(u => {
      if ((u.rooms || []).includes(roomId)) {
        u.rooms = (u.rooms || []).filter(id => id !== roomId)
        Store.writePath(`users/${u.id}/rooms`, u.rooms)
      }
    })
    this.renderRoomsTab()
  },

  addToRoom(roomId) {
    const sel = document.getElementById('room-add-select-' + roomId)
    const userId = sel?.value
    if (!userId) return
    const user = Store.get('users').find(u => u.id === userId)
    if (user) {
      if (!user.rooms) user.rooms = []
      if (!user.rooms.includes(roomId)) user.rooms.push(roomId)
      Store.writePath(`users/${userId}/rooms`, user.rooms)
    }
    sel.value = ''
    this.renderRoomsTab()
  },

  removeFromRoom(roomId, userId) {
    const user = Store.get('users').find(u => u.id === userId)
    if (user) {
      user.rooms = (user.rooms || []).filter(id => id !== roomId)
      Store.writePath(`users/${userId}/rooms`, user.rooms)
    }
    this.renderRoomsTab()
  }
}
