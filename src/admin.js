window.Admin = {
  _editingDateKey: null,
  _activeGenderUsers: 'all',
  _roomsStoreUnsub: null,

  render() {
    this.renderUsers()
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
          <thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>الغرفة</th><th>النقاط</th><th>بونص اليوم</th><th>الحالة</th><th>النوع</th><th>الإجراء</th></tr></thead>
          <tbody id="admin-users-tbody">
            ${filtered.map(u => {
              const todayKey = Evaluation ? Evaluation.getTodayKey() : ''
              const todayDp = todayKey ? (Store.get('dailyPoints') || []).find(p => p.userId === u.id && p.dateKey === todayKey) : null
              const bonusVal = todayDp ? (todayDp.manualBonus ?? 0) : 0
              return `
              <tr>
                <td><span class="name-link" onclick="Admin.showUserProfile('${u.id}')">${u.fullName}</span></td>
                <td>${u.email || '-'}</td>
                <td>${u.room || '-'}</td>
                <td>${u.cumulativePoints || 0}</td>
                <td>
                  <div class="stepper stepper-sm">
                    <button class="stepper-btn stepper-down" data-admin-bonus="${u.id}" data-step="-1" aria-label="إنقاص">▼</button>
                    <span class="stepper-value" id="admin-bonus-val-${u.id}">${bonusVal}</span>
                    <button class="stepper-btn stepper-up" data-admin-bonus="${u.id}" data-step="1" aria-label="زيادة">▲</button>
                  </div>
                </td>
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

    this.bindAdminStepperEvents()

    // Danger zone: reset all points
    const dangerZone = document.getElementById('admin-danger-zone')
    if (!dangerZone) {
      const dz = document.createElement('div')
      dz.id = 'admin-danger-zone'
      dz.style.cssText = 'margin-top:24px;padding:16px;border:2px dashed var(--danger,#e74c3c);border-radius:8px'
      dz.innerHTML = `
        <h3 style="color:var(--danger,#e74c3c);margin:0 0 8px">⚠️ منطقة الخطر</h3>
        <p style="font-size:13px;margin:0 0 8px">سيؤدي هذا إلى تصفير جميع النقاط التراكمية وحذف سجلات النقاط اليومية والتقييم. لا يمكن التراجع.</p>
        <button class="btn-sm btn-danger" onclick="Admin.resetAllPoints()">🔄 إعادة تعيين جميع النقاط إلى صفر</button>
        <span id="reset-status" style="margin-left:12px;font-size:13px"></span>`
      document.getElementById('tab-users').appendChild(dz)
    }
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

  bindAdminStepperEvents() {
    const tbody = document.getElementById('admin-users-tbody')
    if (!tbody) return

    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.stepper-btn:not(:disabled)')
      if (!btn) return
      const userId = btn.dataset.adminBonus
      const step = parseInt(btn.dataset.step)
      if (!userId || !step) return

      const todayKey = Evaluation ? Evaluation.getTodayKey() : ''
      if (!todayKey) return

      const dailyPoints = Store.get('dailyPoints') || []
      let dp = dailyPoints.find(p => p.userId === userId && p.dateKey === todayKey)
      if (!dp) {
        dp = {
          userId, dateKey: todayKey,
          date: new Date().toISOString(),
          basePoints: CONFIG.pointsPerDay ?? 0,
          evaluationScore: 0,
          manualBonus: 0,
          overwritten: false,
          finalScore: CONFIG.pointsPerDay ?? 0,
          adminNotes: '',
          saved: true,
        }
        dailyPoints.push(dp)
      }

      const current = dp.manualBonus ?? 0
      const next = Math.max(-5, Math.min(5, current + step))
      dp.manualBonus = next
      const base = dp.overwritten ? dp.basePoints : (CONFIG.pointsPerDay ?? 0)
      dp.finalScore = (base || 0) + (dp.evaluationScore || 0) + next

      const valEl = document.getElementById(`admin-bonus-val-${userId}`)
      if (valEl) valEl.textContent = next

      Store.writePath(`dailyPoints/${todayKey}/${userId}`, {
        basePoints: dp.basePoints,
        evaluationScore: dp.evaluationScore ?? 0,
        manualBonus: next,
        finalScore: dp.finalScore,
        overwritten: dp.overwritten ?? false,
        adminNotes: dp.adminNotes ?? '',
        saved: true,
        date: dp.date ?? new Date().toISOString(),
      })

      if (window.Evaluation && window.Evaluation._syncCumulativeToFirebase) {
        Evaluation._syncCumulativeToFirebase(userId)
      }
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
                <span style="color:var(--text-muted)">أساسي: ${p.basePoints || 0}</span>
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
    Store.writePath(`users/${id}`, null)
  },

  async resetAllPoints() {
    if (!confirm('هل أنت متأكد من إعادة تعيين جميع النقاط إلى صفر؟ سيؤدي هذا إلى حذف جميع النقاط اليومية وسجلات التقييم.')) return
    if (!confirm('تأكيد نهائي: لا يمكن التراجع عن هذا الإجراء!')) return

    const statusEl = document.getElementById('reset-status')
    if (statusEl) statusEl.textContent = 'جارٍ التنفيذ...'

    const users = Store.get('users') || []
    const promises = users.map(u => Store.writePath(`users/${u.id}/cumulativePoints`, 0))
    promises.push(Store.writePath('dailyPoints', {}))
    promises.push(Store.writePath('evaluation', {}))
    await Promise.all(promises)

    if (statusEl) statusEl.textContent = '✅ تم التصفير بنجاح!'
    setTimeout(() => { if (statusEl) statusEl.textContent = '' }, 3000)
    this.render()
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
