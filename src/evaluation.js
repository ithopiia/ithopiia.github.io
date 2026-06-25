window.Evaluation = {
  _dateKey: null,

  COLUMNS: [
    { key: 'spiritual', label: 'الجزء الروحي', max: 1 },
    { key: 'exercises', label: 'التمارين', max: 1 },
    { key: 'moral', label: 'الالتزام الأخلاقي', max: 1 },
    { key: 'rehearsal', label: 'الالتزام بالبروفة', max: 1 },
    { key: 'acting', label: 'الأداء التمثيلي', max: 1 },
    { key: 'movement', label: 'الأداء الحركي', max: 1 },
    { key: 'clothing', label: 'ملابس مناسبة', max: 1 },
    { key: 'bonus', label: '+/-', max: 1 },
  ],

  getTodayKey() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  formatDate(key) {
    const [y, m, d] = key.split('-')
    return `${d}/${m}/${y}`
  },

  getEvaluation(dateKey) {
    return (Store.get('evaluation') || []).filter(e => e.dateKey === dateKey)
  },

  getOrCreateEntry(userId, dateKey) {
    const all = Store.get('evaluation') || []
    let entry = all.find(e => e.userId === userId && e.dateKey === dateKey)
    if (!entry) {
      const newEntry = {
        userId,
        dateKey,
        spiritual: 0,
        exercises: 0,
        moral: 0,
        rehearsal: 0,
        acting: 0,
        movement: 0,
        clothing: 0,
        bonus: 0,
        totalScore: 0,
        saved: false,
      }
      Store.push('evaluation', newEntry)
      return newEntry
    }
    return entry
  },

  calculateTotal(entry) {
    return (Number(entry.spiritual) || 0)
      + (Number(entry.exercises) || 0)
      + (Number(entry.moral) || 0)
      + (Number(entry.rehearsal) || 0)
      + (Number(entry.acting) || 0)
      + (Number(entry.movement) || 0)
      + (Number(entry.clothing) || 0)
      + (Number(entry.bonus) || 0)
  },

  render(dateKey) {
    if (!dateKey) dateKey = this.getTodayKey()
    this._dateKey = dateKey
    const el = document.getElementById('tab-evaluation')
    if (!el) return

    const rooms = Store.get('rooms') || []
    if (!this._selectedRoom && rooms.length > 0) {
      this._selectedRoom = localStorage.getItem('ithopiia_evalRoom') || rooms[0].id
    }

    const allUsers = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')
    const users = this._selectedRoom
      ? allUsers.filter(u => (u.rooms || []).includes(this._selectedRoom))
      : allUsers
    const dayData = this.getEvaluation(dateKey)
    const saved = dayData.length > 0 && dayData.every(e => e.saved)
    const isTodayKey = dateKey === this.getTodayKey()

    el.innerHTML = `
      <div class="eval-header-section">
        <div class="eval-date">📅 ${this.formatDate(dateKey)}</div>
        <div class="eval-status">${isTodayKey
          ? '<span class="badge badge-success">اليوم الحالي — مفتوح دائمًا</span>'
          : (saved ? '<span class="badge badge-info">تم حفظ اليوم</span>' : '<span class="badge badge-success">إدخال التقييم</span>')}
        </div>
      </div>
      ${rooms.length > 0 ? `
        <div style="margin:12px 0;display:flex;gap:8px;align-items:center">
          <label style="font-size:14px">الغرفة:</label>
          <select id="eval-room-select" class="note-select" onchange="Evaluation.selectRoom(this.value)">
            ${rooms.map(r => `<option value="${r.id}" ${r.id === this._selectedRoom ? 'selected' : ''}>${r.name}</option>`).join('')}
          </select>
        </div>
      ` : '<p class="text-muted" style="margin:12px 0">يرجى إنشاء غرفة أولاً من تبويب الغرف.</p>'}
      ${this._selectedRoom ? `
      <div class="eval-grid-wrapper">
        <table class="eval-grid" id="eval-grid-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-name">الاسم</th>
              ${this.COLUMNS.map(c => `
                <th class="col-score ${c.key === 'bonus' ? 'col-bonus' : ''}">
                  <span class="col-label">${c.label}</span>
                  ${c.max ? `<span class="col-max">/${c.max}</span>` : ''}
                </th>
              `).join('')}
              <th class="col-total">المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${users.length === 0 ? '<tr><td colspan="10" style="text-align:center;color:var(--text-muted)">لا يوجد أعضاء في هذه الغرفة</td></tr>' : ''}
            ${users.map((u, i) => {
                  const entry = dayData.find(e => e.userId === u.id)
                  const total = entry ? this.calculateTotal(entry) : 0
                  const inputDisabled = !isTodayKey && saved
                  return `
                    <tr data-user-id="${u.id}" class="eval-row">
                      <td class="col-num">${i + 1}</td>
                      <td class="col-name">${u.fullName}</td>
                      ${this.COLUMNS.map(c => `
                        <td class="col-score ${c.key === 'bonus' ? 'col-bonus' : ''}">
                          <input type="number"
                            class="eval-input eval-input-${c.key}"
                            data-user="${u.id}"
                            data-col="${c.key}"
                            value="${entry ? (entry[c.key] ?? 0) : 0}"
                            ${inputDisabled ? 'disabled' : ''}
                            min="-1" max="1"
                            step="1"
                            inputmode="numeric">
                        </td>
                      `).join('')}
                      <td class="col-total eval-total" id="eval-total-${u.id}">${total}</td>
                    </tr>
                  `
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="eval-footer">
        ${isTodayKey ? `
          <button class="btn-sm btn-primary" onclick="Evaluation.saveDay()">💾 حفظ اليوم</button>
          <button class="btn-sm btn-ghost" onclick="Evaluation.render()">🔄 تحديث</button>
        ` : (saved ? `
          <button class="btn-sm btn-ghost" onclick="Evaluation.unlockDay()">🔓 فتح اليوم للتعديل</button>
        ` : `
          <button class="btn-sm btn-primary" onclick="Evaluation.saveDay()">💾 حفظ اليوم وإنهاؤه</button>
          <button class="btn-sm btn-ghost" onclick="Evaluation.render()">🔄 تحديث</button>
        `)}
        <span class="eval-stats" id="eval-stats"></span>
      </div>
      ` : ''}
      <div id="eval-saved-notice" style="display:none" class="eval-reset-notice">
        <p>✅ تم حفظ اليوم بنجاح! تم دمج النقاط في المجموع التراكمي.</p>
        <p class="eval-next-day">📅 ورقة تقييم جديدة ليوم <strong>${this.formatDate(dateKey)}</strong> جاهزة.</p>
      </div>`

    if ((isTodayKey || !saved) && this._selectedRoom) {
      this.bindInputEvents()
    }
  },

  selectRoom(roomId) {
    this._selectedRoom = roomId
    localStorage.setItem('ithopiia_evalRoom', roomId)
    this.render()
  },

  bindInputEvents() {
    const grid = document.getElementById('eval-grid-table')
    if (!grid) return

    grid.addEventListener('input', (e) => {
      const input = e.target.closest('.eval-input')
      if (!input) return
      this.updateCell(input.dataset.user, input.dataset.col, input.value)
    })

    grid.addEventListener('keydown', (e) => {
      const navKeys = ['Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      if (!navKeys.includes(e.key)) return
      e.preventDefault()

      const input = e.target.closest('.eval-input')
      if (!input) return

      const allInputs = Array.from(grid.querySelectorAll('.eval-input:not(:disabled)'))
      const idx = allInputs.indexOf(input)
      if (idx === -1) return

      const cols = this.COLUMNS.length
      let nextIdx = -1

      switch (e.key) {
        case 'Tab': nextIdx = e.shiftKey ? Math.max(0, idx - 1) : Math.min(allInputs.length - 1, idx + 1); break
        case 'Enter':
        case 'ArrowDown': nextIdx = Math.min(allInputs.length - 1, idx + cols); break
        case 'ArrowUp': nextIdx = Math.max(0, idx - cols); break
        case 'ArrowRight': nextIdx = Math.min(allInputs.length - 1, idx + 1); break
        case 'ArrowLeft': nextIdx = Math.max(0, idx - 1); break
      }

      if (nextIdx >= 0 && nextIdx < allInputs.length) {
        allInputs[nextIdx].focus()
        allInputs[nextIdx].select()
      }
    })
  },

  updateCell(userId, col, value) {
    const all = Store.get('evaluation') || []
    let entry = all.find(e => e.userId === userId && e.dateKey === this._dateKey)
    if (!entry) {
      const newEntry = {
        userId, dateKey: this._dateKey,
        spiritual: 0, exercises: 0, moral: 0,
        rehearsal: 0, acting: 0, movement: 0, clothing: 0,
        bonus: 0, totalScore: 0, saved: false,
      }
      all.push(newEntry)
      entry = newEntry
    }

    entry[col] = Math.max(-1, Math.min(1, Number(value) || 0))

    const total = this.calculateTotal(entry)
    entry.totalScore = total
    Store.set('evaluation', all)

    this._applyAdjustment(userId, total)

    const totalEl = document.getElementById(`eval-total-${userId}`)
    if (totalEl) totalEl.textContent = total
    this.updateStats()
  },

  _applyAdjustment(userId, adjustment) {
    const dailyPoints = Store.get('dailyPoints') || []
    let dp = dailyPoints.find(p => p.userId === userId && p.dateKey === this._dateKey)
    if (!dp) {
      dp = {
        userId, dateKey: this._dateKey,
        date: new Date().toISOString(),
        basePoints: CONFIG.pointsPerDay,
        bonusPoints: 0,
        overwritten: false,
        finalScore: CONFIG.pointsPerDay,
        adminNotes: '',
        saved: true,
      }
      dailyPoints.push(dp)
    }
    dp.bonusPoints = adjustment
    dp.finalScore = CONFIG.pointsPerDay + (adjustment || 0)
    dp.saved = true

    const users = Store.get('users') || []
    const user = users.find(u => u.id === userId)
    if (user) {
      const userPoints = dailyPoints.filter(p => p.userId === userId && p.saved)
      user.cumulativePoints = userPoints.reduce((sum, p) => sum + (p.finalScore || p.basePoints || 0), 0)
    }

    // Single sync with both changes
    Store._data.dailyPoints = dailyPoints
    Store._data.users = users
    Store._sync()

    // Direct Firebase writes for immediate persistence
    Store.writePath(`dailyPoints/${this._dateKey}/${userId}`, {
      basePoints: dp.basePoints,
      bonusPoints: dp.bonusPoints,
      finalScore: dp.finalScore,
      overwritten: dp.overwritten ?? false,
      adminNotes: dp.adminNotes ?? '',
      saved: true,
      date: dp.date ?? new Date().toISOString(),
    })
    if (user) {
      Store.writePath(`users/${userId}/cumulativePoints`, user.cumulativePoints)
    }
  },

  updateStats() {
    const el = document.getElementById('eval-stats')
    if (!el) return
    const dayData = this.getEvaluation(this._dateKey)
    const total = dayData.reduce((s, e) => s + this.calculateTotal(e), 0)
    const count = dayData.length
    el.textContent = `📊 ${count} أعضاء — إجمالي النقاط: ${total}`
  },

  saveDay() {
    const dateKey = this._dateKey
    if (!confirm(`هل تريد حفظ يوم ${this.formatDate(dateKey)} وإنهاؤه؟`)) return

    const all = Store.get('evaluation') || []
    const users = Store.get('users') || []
    const dailyPoints = Store.get('dailyPoints') || []

    const dayEntries = all.filter(e => e.dateKey === dateKey)
    dayEntries.forEach(e => {
      e.totalScore = this.calculateTotal(e)
      e.saved = true
      const existing = dailyPoints.find(p => p.userId === e.userId && p.dateKey === dateKey)
      if (!existing) {
        dailyPoints.push({
          userId: e.userId, dateKey,
          date: new Date().toISOString(),
          basePoints: CONFIG.pointsPerDay,
          bonusPoints: e.totalScore,
          overwritten: false,
          finalScore: CONFIG.pointsPerDay + (e.totalScore || 0),
          adminNotes: '',
          saved: true,
        })
      }
    })

    users.forEach(u => {
      const userPoints = dailyPoints.filter(p => p.userId === u.id && p.saved)
      u.cumulativePoints = userPoints.reduce((sum, p) => sum + (p.finalScore || p.basePoints || 0), 0)
    })

    // Single sync with all changes
    Store._data.evaluation = all
    Store._data.dailyPoints = dailyPoints
    Store._data.users = users
    Store._sync()

    // Direct Firebase writes for every saved entry
    const fbEval = {}
    const fbDP = {}
    dayEntries.forEach(e => {
      const { userId, dateKey: dk, totalScore, saved, ...evalScores } = e
      fbEval[`evaluation/${dateKey}/${userId}`] = { ...evalScores, totalScore, saved }
      const dp = dailyPoints.find(p => p.userId === userId && p.dateKey === dateKey)
      if (dp) {
        fbDP[`dailyPoints/${dateKey}/${userId}`] = {
          basePoints: dp.basePoints,
          bonusPoints: dp.bonusPoints,
          finalScore: dp.finalScore,
          overwritten: dp.overwritten ?? false,
          adminNotes: dp.adminNotes ?? '',
          saved: true,
          date: dp.date ?? new Date().toISOString(),
        }
      }
    })
    const fbUsers = {}
    users.forEach(u => {
      fbUsers[`users/${u.id}/cumulativePoints`] = u.cumulativePoints
    })
    const allPaths = { ...fbEval, ...fbDP, ...fbUsers }
    Object.entries(allPaths).forEach(([path, val]) => {
      Store.writePath(path, val)
    })

    const notice = document.getElementById('eval-saved-notice')
    if (notice) {
      notice.style.display = 'block'
      setTimeout(() => { notice.style.display = 'none' }, 5000)
    }

    this.render()
  },

  unlockDay() {
    const dateKey = this._dateKey
    if (!confirm('فتح اليوم سيسمح بالتعديل مرة أخرى. هل تريد المتابعة؟')) return
    const all = Store.get('evaluation') || []
    all.forEach(e => { if (e.dateKey === dateKey) e.saved = false })
    Store.set('evaluation', all)
    this.render()
  },
}
