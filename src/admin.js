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
            <div class="info-item"><span class="info-label">الغرف التقييمية</span><span class="info-value">${userRoomNames}</span></div>
            <div class="info-item"><span class="info-label">تاريخ الميلاد</span><span class="info-value">${user.birthdate || '-'}</span></div>
            <div class="info-item"><span class="info-label">واتساب</span><span class="info-value">${user.whatsapp || '-'}</span></div>
            <div class="info-item"><span class="info-label">الكرازة</span><span class="info-value">${user.attendedElKaraza === 'yes' ? 'نعم' : user.attendedElKaraza === 'no' ? 'لا' : '-'}</span></div>
            ${user.createdAt ? `<div class="info-item"><span class="info-label">تاريخ التسجيل</span><span class="info-value">${new Date(user.createdAt).toLocaleDateString('en-CA')}</span></div>` : ''}
          </div>
          ${userNotes.length > 0 ? `
            <h3 style="margin-top:16px;font-size:1rem;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:8px">الملاحظات</h3>
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
          ${userPoints.length > 0 ? `
            <h3 style="margin-top:16px;font-size:1rem;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:8px">إحصائيات شاملة</h3>
            <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr">
              <div class="stat-card">
                <div class="stat-value">${userPoints.filter(p => (p.manualBonus || 0) < 0).length}</div>
                <div class="stat-label">عدد مرات التمينص</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${userPoints.filter(p => (p.manualBonus || 0) > 0).length}</div>
                <div class="stat-label">عدد مرات البونص</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${userPoints.filter(p => (p.finalScore || 0) <= 0).length}</div>
                <div class="stat-label">عدد مرات التصفير</div>
              </div>
            </div>
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

  _lbTimerInterval: null,
  _lbScheduleTimer: null,

  renderLeaderboardTab() {
    const el = document.getElementById('admin-tab-leaderboard')
    const settings = Store.get('settings') || {}
    const until = settings.leaderboardReleasedUntil
    const isActive = until && Date.now() < until
    const remaining = isActive ? Math.max(0, Math.floor((until - Date.now()) / 1000)) : 0

    if (this._lbTimerInterval) clearInterval(this._lbTimerInterval)
    if (this._lbScheduleTimer) clearInterval(this._lbScheduleTimer)

    const now = new Date()
    const defaultDate = now.toISOString().slice(0, 10)
    const defaultHour = String(now.getHours()).padStart(2, '0')
    const defaultMin = String(now.getMinutes()).padStart(2, '0')
    const defaultSec = String(now.getSeconds()).padStart(2, '0')

    el.innerHTML = `
      <div class="lb-scheduler-card">
        <div class="lb-scheduler-header">
          <span class="lb-scheduler-icon">⏰</span>
          <span>التحكم في ظهور المتصدرين</span>
        </div>
        <div class="lb-scheduler-status">
          ${isActive
            ? `<span class="lb-status-dot green"></span> المتصدرين مرئي للمستخدمين — الوقت المتبقي: <strong id="lb-countdown-admin">${Timer.formatTime(remaining)}</strong>`
            : '<span class="lb-status-dot red"></span> المتصدرين مخفي عن المستخدمين'}
        </div>
        <div class="lb-scheduler-fields">
          <div class="lb-field-group">
            <label class="lb-field-label">اليوم</label>
            <input type="date" id="lb-sched-date" class="lb-input" value="${defaultDate}">
          </div>
          <div class="lb-field-group">
            <label class="lb-field-label">الساعة</label>
            <input type="number" id="lb-sched-hour" class="lb-input lb-input-narrow" value="${defaultHour}" min="0" max="23">
          </div>
          <div class="lb-field-group">
            <label class="lb-field-label">الدقائق</label>
            <input type="number" id="lb-sched-minute" class="lb-input lb-input-narrow" value="${defaultMin}" min="0" max="59">
          </div>
          <div class="lb-field-group">
            <label class="lb-field-label">الثواني</label>
            <input type="number" id="lb-sched-second" class="lb-input lb-input-narrow" value="${defaultSec}" min="0" max="59">
          </div>
        </div>
        <div class="lb-scheduler-actions">
          <button class="btn btn-primary" onclick="Admin.scheduleLeaderboard()">${isActive ? 'إعادة جدولة' : 'جدولة الظهور'}</button>
          ${isActive ? `<button class="btn btn-ghost btn-danger-text" onclick="Admin.cancelLeaderboardRelease()">إلغاء الجدولة</button>` : ''}
        </div>
      </div>
      ${window.Leaderboard ? Leaderboard.renderAdmin() : '<p class="text-muted">لا توجد بيانات.</p>'}
    `

    if (isActive) {
      this._lbTimerInterval = setInterval(() => {
        const el2 = document.getElementById('lb-countdown-admin')
        if (!el2) { clearInterval(this._lbTimerInterval); return }
        const s = Math.max(0, Math.floor((until - Date.now()) / 1000))
        el2.textContent = Timer.formatTime(s)
        if (s <= 0) {
          clearInterval(this._lbTimerInterval)
          this.renderLeaderboardTab()
        }
      }, 1000)
    }
  },

  scheduleLeaderboard() {
    const dateVal = document.getElementById('lb-sched-date')?.value
    const hour = parseInt(document.getElementById('lb-sched-hour')?.value)
    const minute = parseInt(document.getElementById('lb-sched-minute')?.value)
    const second = parseInt(document.getElementById('lb-sched-second')?.value)
    if (!dateVal) return
    const target = new Date(dateVal + 'T' +
      String(hour != null ? hour : 0).padStart(2, '0') + ':' +
      String(minute != null ? minute : 0).padStart(2, '0') + ':' +
      String(second != null ? second : 0).padStart(2, '0'))
    if (isNaN(target.getTime())) return
    Store.writePath('settings/leaderboardReleasedUntil', target.getTime())
    this.renderLeaderboardTab()
  },

  cancelLeaderboardRelease() {
    Store.writePath('settings/leaderboardReleasedUntil', null)
    if (this._lbTimerInterval) clearInterval(this._lbTimerInterval)
    if (this._lbScheduleTimer) clearInterval(this._lbScheduleTimer)
    this.renderLeaderboardTab()
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
