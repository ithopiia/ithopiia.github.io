window.Admin = {
  _editingDateKey: null,
  _activeGenderUsers: 'all',

  render() {
    this.renderUsers()
    this.renderSheet()
    this.renderNotesTab()
    this.renderLeaderboardTab()
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
        } else if (tabId === 'tab-sheet') {
          this.renderSheet()
        } else if (tabId === 'admin-tab-userinfo') {
          this.renderUserInfoTab()
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
          <thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>الغرفة</th><th>النقاط</th><th>الحالة</th><th>النوع</th><th>الإجراء</th></tr></thead>
          <tbody id="admin-users-tbody">
            ${filtered.map(u => `
              <tr>
                <td><span class="name-link" onclick="Admin.showUserProfile('${u.id}')">${u.fullName}</span></td>
                <td>${u.email || '-'}</td>
                <td>${u.room || '-'}</td>
                <td>${u.cumulativePoints || 0}</td>
                <td>${u.status === 'approved' ? 'مقبول' : u.status === 'rejected' ? 'مرفوض' : u.status || '-'}</td>
                <td>${u.role === 'member' ? '👤 عضو' : 'مستخدم'}</td>
                <td class="table-actions">
                  <button class="btn-sm ${u.role === 'member' ? 'btn-danger' : 'btn-primary'}" onclick="Admin.toggleMemberRole('${u.id}')">${u.role === 'member' ? 'إلغاء العضوية' : 'ترقية لعضو'}</button>
                  <button class="btn-sm btn-danger" onclick="Admin.deleteUser('${u.id}')">حذف</button>
                </td>
              </tr>
            `).join('')}
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

  toggleMemberRole(id) {
    const users = Store.get('users') || []
    const user = users.find(u => u.id === id)
    if (!user) return
    if (user.role === 'member') {
      if (!confirm('إلغاء صلاحيات العضو لهذا المستخدم؟')) return
      Store.update('users', u => u.id === id, { role: 'user' })
    } else {
      if (!confirm('ترقية هذا المستخدم إلى عضو؟ سيحصل على صلاحيات المشرف مع بقائه ظاهرًا في الموقع.')) return
      Store.update('users', u => u.id === id, { role: 'member' })
    }
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

    const dailyPoints = Store.get('dailyPoints') || []
    const userPoints = dailyPoints.filter(p => p.userId === userId && p.saved)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))

    const notes = Store.get('notes') || []
    const userNotes = notes.filter(n => n.targetUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    const genderMap = { male: 'ذكر', female: 'أنثى' }
    const rooms = Store.get('rooms') || []
    const userRoomNames = (user.rooms || []).map(id => {
      const r = rooms.find(room => room.id === id)
      return r ? r.name : id
    }).join(', ') || '-'

    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        <div class="modal-header">
          <h2>${user.fullName}</h2>
          <span class="badge" style="background:var(--accent);color:#000">${user.role === 'member' ? 'عضو لجنة' : 'مستخدم'}</span>
        </div>
        <div class="modal-body">
          <div class="stats-grid" style="grid-template-columns:1fr 1fr">
            <div class="stat-card">
              <div class="stat-value">${user.cumulativePoints || 0}</div>
              <div class="stat-label">إجمالي النقاط</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${userPoints.length}</div>
              <div class="stat-label">أيام مسجلة</div>
            </div>
          </div>
          <div class="info-grid" style="margin-top:12px">
            <div class="info-item"><span class="info-label">البريد</span><span class="info-value">${user.email || '-'}</span></div>
            <div class="info-item"><span class="info-label">النوع</span><span class="info-value">${genderMap[user.gender] || user.gender || '-'}</span></div>
            <div class="info-item"><span class="info-label">الغرفة</span><span class="info-value">${user.room || '-'}</span></div>
            <div class="info-item"><span class="info-label">الغرف التقييمية</span><span class="info-value">${userRoomNames}</span></div>
            <div class="info-item"><span class="info-label">تاريخ الميلاد</span><span class="info-value">${user.birthdate || '-'}</span></div>
            <div class="info-item"><span class="info-label">واتساب</span><span class="info-value">${user.whatsapp || '-'}</span></div>
            <div class="info-item"><span class="info-label">الكرازة</span><span class="info-value">${user.attendedElKaraza === 'yes' ? 'نعم' : user.attendedElKaraza === 'no' ? 'لا' : '-'}</span></div>
            ${user.createdAt ? `<div class="info-item"><span class="info-label">تاريخ التسجيل</span><span class="info-value">${new Date(user.createdAt).toLocaleDateString('ar-EG')}</span></div>` : ''}
          </div>
          ${userNotes.length > 0 ? `
            <h3 style="margin-top:16px;font-size:1rem;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:8px">الملاحظات</h3>
            ${userNotes.map(n => `
              <div class="feedback-item">
                <div class="feedback-meta">
                  <span class="feedback-author">${n.authorName}</span>
                  <span class="feedback-date">${new Date(n.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
                <div class="feedback-text" style="font-size:0.85rem">${n.text}</div>
              </div>
            `).join('')}
          ` : ''}
          ${userPoints.length > 0 ? `
            <h3 style="margin-top:16px;font-size:1rem;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:8px">النقاط اليومية (آخر ١٤ يوم)</h3>
            ${userPoints.slice(0, 14).map(p => `
              <div class="info-item" style="font-size:0.82rem;padding:10px 12px">
                <span class="info-label">${p.dateKey}</span>
                <span style="color:var(--text-muted)">أساسي: ${p.basePoints || CONFIG.pointsPerDay}</span>
                <span style="color:var(--text-muted)">تقيم: ${p.evaluationScore || 0}</span>
                <span style="color:var(--text-muted)">يدوي: ${p.manualBonus || 0}</span>
                <span class="info-value" style="font-size:0.85rem">= ${p.finalScore || 0}</span>
              </div>
            `).join('')}
          ` : ''}
        </div>
      </div>`
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove()
    })
    document.body.appendChild(overlay)
  },

  deleteUser(id) {
    if (!confirm('هل تريد حذف هذا المستخدم؟')) return
    const users = (Store.get('users') || []).filter(u => u.id !== id)
    Store.set('users', users)
    this.render()
  },

  renderSheet() {
    const el = document.getElementById('tab-sheet')
    const todayKey = Points.getTodayKey()
    this._editingDateKey = this._editingDateKey || localStorage.getItem('ithopiia_sheetDate') || todayKey

    const allPoints = Store.get('dailyPoints') || []
    const dayEntries = allPoints.filter(p => p.dateKey === this._editingDateKey)
    const users = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')
    const daySaved = dayEntries.length > 0 && dayEntries.every(p => p.saved)
    const isToday = this._editingDateKey === todayKey
    const inputsDisabled = !isToday && daySaved
    const dayEnded = !isToday && daySaved

    el.innerHTML = `
      <div class="sheet-controls">
        <div class="sheet-nav">
          <label>التاريخ:</label>
          <input type="date" id="sheet-date" value="${this._editingDateKey}" onchange="Admin.changeDate(this.value)">
        </div>
        <div class="sheet-status">
          ${isToday ? '<span class="badge badge-success">اليوم الحالي — مفتوح دائمًا</span>' : (dayEnded ? '<span class="badge badge-warning">تم إنهاء اليوم</span>' : '<span class="badge" style="background:var(--accent)">غير محفوظ</span>')}
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="sheet-table">
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم</th>
              <th>الغرفة</th>
              <th>النقاط الأساسية</th>
              <th>مكافأة</th>
              <th>المجموع</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((u, i) => {
              const entry = dayEntries.find(p => p.userId === u.id)
              const base = entry ? entry.basePoints : CONFIG.pointsPerDay
               const manualBonus = entry ? (entry.manualBonus ?? 0) : 0
              const evaluationScore = entry ? (entry.evaluationScore ?? 0) : 0
              const total = entry ? (entry.finalScore || base + manualBonus + evaluationScore) : base
              const notes = entry ? (entry.adminNotes || '') : ''
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td><span class="name-link" onclick="Admin.showUserProfile('${u.id}')">${u.fullName}</span></td>
                  <td>${u.room || '-'}</td>
                  <td class="cell-points">${isToday ? CONFIG.pointsPerDay : base}</td>
                  <td><input type="number" class="sheet-bonus-input" data-user="${u.id}" value="${manualBonus}" ${inputsDisabled ? 'disabled' : ''} style="width:70px"></td>
                  <td class="cell-total" id="sheet-total-${u.id}">${total}</td>
                  <td><input type="text" class="sheet-notes-input" data-user="${u.id}" value="${notes}" ${inputsDisabled ? 'disabled' : ''} style="width:120px" placeholder="ملاحظات..."></td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="sheet-actions">
        ${!isToday && !daySaved ? `<button class="btn-sm btn-primary" onclick="Admin.saveDay()">💾 حفظ اليوم</button>` : ''}
        ${!isToday && daySaved ? `<button class="btn-sm btn-ghost" onclick="Admin.unlockDay()">🔓 فتح التحرير</button>` : ''}
        <button class="btn-sm btn-ghost" onclick="Admin.changeDate('${todayKey}')">📅 اليوم</button>
      </div>`
    if (!inputsDisabled) this.bindSheetInputs()
  },

  bindSheetInputs() {
    const table = document.querySelector('#tab-sheet .sheet-table')
    if (!table) return
    table.addEventListener('input', (e) => {
      if (this._editingDateKey !== Points.getTodayKey()) return
      const bonus = e.target.closest('.sheet-bonus-input')
      const notes = e.target.closest('.sheet-notes-input')
      if (!bonus && !notes) return
      const userId = (bonus || notes).dataset.user
      Store.debounce(`sheet_${this._editingDateKey}_${userId}`, () => {
        this._autoSaveRow(userId)
      }, 500)
    })
  },

  saveDay() {
    const dateKey = this._editingDateKey
    const all = Store.get('dailyPoints') || []
    const users = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')
    users.forEach(u => {
      const manualBonus = parseInt(document.querySelector(`.sheet-bonus-input[data-user="${u.id}"]`)?.value) || 0
      const notes = document.querySelector(`.sheet-notes-input[data-user="${u.id}"]`)?.value || ''
      let entry = all.find(p => p.userId === u.id && p.dateKey === dateKey)
      const base = entry ? entry.basePoints : CONFIG.pointsPerDay
      if (entry) {
        entry.manualBonus = manualBonus
        entry.adminNotes = notes
        entry.overwritten = true
        entry.finalScore = base + (entry.evaluationScore || 0) + manualBonus
        entry.saved = true
      } else {
        all.push({
          userId: u.id, dateKey,
          date: new Date().toISOString(),
          basePoints: base,
          evaluationScore: 0,
          manualBonus: manualBonus,
          overwritten: true,
          finalScore: base + manualBonus,
          adminNotes: notes,
          saved: true,
        })
      }
    })
    Store.set('dailyPoints', all)
    this.renderSheet()
    this._autoRefresh()
  },

  _autoSaveRow(userId) {
    const dateKey = this._editingDateKey
    const manualBonus = parseInt(document.querySelector(`.sheet-bonus-input[data-user="${userId}"]`)?.value) || 0
    const notes = document.querySelector(`.sheet-notes-input[data-user="${userId}"]`)?.value || ''
    const users = Store.get('users') || []
    const user = users.find(u => u.id === userId)
    if (!user || user.createdAt && user.createdAt.split('T')[0] > dateKey) return
    const all = Store.get('dailyPoints') || []
    let entry = all.find(p => p.userId === userId && p.dateKey === dateKey)
    if (entry) {
      entry.manualBonus = manualBonus
      entry.adminNotes = notes
      entry.overwritten = true
      entry.finalScore = CONFIG.pointsPerDay + (entry.evaluationScore || 0) + manualBonus
      entry.saved = true
    } else {
      all.push({
        userId, dateKey,
        date: new Date().toISOString(),
        basePoints: CONFIG.pointsPerDay,
        evaluationScore: 0,
        manualBonus: manualBonus,
        overwritten: true,
        finalScore: CONFIG.pointsPerDay + manualBonus,
        adminNotes: notes,
        saved: true,
      })
    }
    Store.set('dailyPoints', all)

    const finalScore = CONFIG.pointsPerDay + (entry ? (entry.evaluationScore || 0) : 0) + manualBonus
    const totalEl = document.getElementById(`sheet-total-${userId}`)
    if (totalEl) totalEl.textContent = finalScore

    this._autoRefresh()
  },

  _autoRefresh() {
    const active = document.querySelector('#view-admin .tab-content.active')?.id
    if (active !== 'tab-sheet') {
      if (active === 'tab-users') this.renderUsers()
      else if (active === 'admin-tab-userinfo') this.renderUserInfoTab()
      else if (active === 'admin-tab-leaderboard') this.renderLeaderboardTab()
      else if (active === 'admin-tab-notes') this.renderNotesTab()
      else if (active === 'admin-tab-rooms') this.renderRoomsTab()
    }
  },

  changeDate(dateKey) {
    this._editingDateKey = dateKey
    localStorage.setItem('ithopiia_sheetDate', dateKey)
    this.renderSheet()
  },

  unlockDay() {
    if (!confirm('فتح اليوم سيسمح بالتعديل مرة أخرى. هل تريد المتابعة؟')) return
    const dateKey = this._editingDateKey
    const all = Store.get('dailyPoints') || []
    all.forEach(p => {
      if (p.dateKey === dateKey) p.saved = false
    })
    Store.set('dailyPoints', all)
    this.renderSheet()
  },

  renderLeaderboardTab() {
    const el = document.getElementById('admin-tab-leaderboard')
    if (window.Leaderboard) {
      el.innerHTML = Leaderboard.renderAdmin()
    } else {
      el.innerHTML = '<p class="text-muted">لا توجد بيانات.</p>'
    }
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
                <span class="feedback-date">${new Date(n.createdAt).toLocaleDateString('ar-EG')}</span>
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
    const notes = Store.get('notes') || []
    Store.set('notes', notes.filter(n => n.id !== noteId))
    this.renderNotesTab()
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
    const notes = Store.get('notes') || []
    notes.push({
      id: 'note_' + Date.now(),
      targetUserId: targetId,
      targetUserName: target ? target.fullName : '',
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role || 'user',
      text: input.value.trim(),
      createdAt: new Date().toISOString(),
    })
    Store.set('notes', notes)
    if (errorEl) errorEl.textContent = ''
    input.value = ''
    document.getElementById('admin-note-target').value = ''
    this.renderNotesTab()
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
              <th>الغرفة</th>
              <th>الغرف التقييمية</th>
              <th>واتساب</th>
              <th>الكرازة</th>
              <th>النوع</th>
              <th>النقاط</th>
              <th>تاريخ التسجيل</th>
            </tr>
          </thead>
          <tbody id="userinfo-tbody">
            ${users.map(u => {
              const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : '-'
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
                  <td>${u.room || '-'}</td>
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
    const rooms = Store.get('rooms') || []
    rooms.push({
      id: 'room_' + Date.now(),
      name,
      createdBy: Auth.currentUser()?.id,
      createdAt: new Date().toISOString(),
    })
    Store.set('rooms', rooms)
    if (errorEl) errorEl.textContent = ''
    input.value = ''
    this.renderRoomsTab()
  },

  deleteRoom(roomId) {
    if (!confirm('حذف الغرفة سيؤدي إلى إزالة جميع الأعضاء منها. هل تريد المتابعة؟')) return
    const rooms = (Store.get('rooms') || []).filter(r => r.id !== roomId)
    Store.set('rooms', rooms)
    const users = Store.get('users') || []
    users.forEach(u => {
      if ((u.rooms || []).includes(roomId)) {
        u.rooms = (u.rooms || []).filter(id => id !== roomId)
      }
    })
    Store.set('users', users)
    this.renderRoomsTab()
  },

  addToRoom(roomId) {
    const sel = document.getElementById('room-add-select-' + roomId)
    const userId = sel?.value
    if (!userId) return
    const users = Store.get('users') || []
    const user = users.find(u => u.id === userId)
    if (user) {
      if (!user.rooms) user.rooms = []
      if (!user.rooms.includes(roomId)) user.rooms.push(roomId)
      Store.set('users', users)
    }
    this.renderRoomsTab()
  },

  removeFromRoom(roomId, userId) {
    const users = Store.get('users') || []
    const user = users.find(u => u.id === userId)
    if (user) {
      user.rooms = (user.rooms || []).filter(id => id !== roomId)
      Store.set('users', users)
    }
    this.renderRoomsTab()
  }
}
