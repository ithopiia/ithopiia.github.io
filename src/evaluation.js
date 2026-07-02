window.Evaluation = {
  _dateKey: null,
  _activeGender: 'male',
  _pendingZeroReason: null,
  BASELINE_POINTS: 0,

  COLUMNS: [
    { key: 'spiritual', label: 'الجزء الروحي', min: -3, max: 3 },
    { key: 'exercises', label: 'التمارين', min: -2, max: 2 },
    { key: 'moral', label: 'الالتزام الأخلاقي', min: -1, max: 1 },
    { key: 'rehearsal', label: 'الالتزام بالبروفة', min: -1, max: 1 },
    { key: 'acting', label: 'الأداء التمثيلي', min: -1, max: 1 },
    { key: 'movement', label: 'الأداء الحركي', min: -1, max: 1 },
    { key: 'clothing', label: 'ملابس مناسبة', min: -1, max: 1 },
    { key: 'bonus', label: 'بونص (+/-)', min: -1, max: 1 },
  ],

  getTodayKey() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  formatDate(key) {
    const [y, m, d] = key.split('-')
    return `${d}/${m}/${y}`
  },

  onDateChange(dateKey) {
    this._dateKey = dateKey
    this.render()
  },

  getEvaluation(dateKey) {
    return (Store.get('evaluation') || []).filter(e => e.dateKey === dateKey)
  },

  getOrCreateEntry(userId, dateKey) {
    const all = Store.get('evaluation')
    let entry = all.find(e => e.userId === userId && e.dateKey === dateKey)
    if (!entry) {
      entry = {
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
      all.push(entry)
      Store.writePath(`evaluation/${dateKey}/${userId}`, { spiritual:0, exercises:0, moral:0, rehearsal:0, acting:0, movement:0, clothing:0, bonus:0, totalScore:0, saved:false })
      return entry
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

  _pendingEditReason: null,

  _showReasonModal() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.className = 'custom-alert-overlay'
      overlay.innerHTML = `
        <div class="custom-alert-box animate-pop">
          <h4>⚠️ تسجيل سبب التصفير</h4>
          <p>اكتب سبب تصفير هذا الشخص فوراً لضمان التسجيل في السجل الرقمي:</p>
          <textarea id="modal-reason-input" placeholder="مثال: غياب بدون إذن عن البروفة..."></textarea>
          <div class="alert-actions">
            <button id="btn-modal-confirm" class="btn-alert-success">تأكيد التصفير</button>
            <button id="btn-modal-cancel" class="btn-alert-danger">إلغاء</button>
          </div>
        </div>`
      document.body.appendChild(overlay)
      const input = overlay.querySelector('#modal-reason-input')
      const confirm = () => {
        const text = input.value.trim()
        if (!text) return
        overlay.remove()
        resolve(text)
      }
      const cancel = () => { overlay.remove(); resolve(null) }
      overlay.querySelector('#btn-modal-confirm').addEventListener('click', confirm)
      overlay.querySelector('#btn-modal-cancel').addEventListener('click', cancel)
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel() })
      setTimeout(() => input.focus(), 100)
    })
  },

  _showCustomConfirm(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.className = 'custom-alert-overlay'
      overlay.innerHTML = `
        <div class="custom-alert-box animate-pop">
          <h3>تأكيد</h3>
          <p>${message}</p>
          <div class="alert-actions">
            <button id="btn-custom-confirm-yes" class="btn-alert-success">نعم</button>
            <button id="btn-custom-confirm-no" class="btn-alert-danger">لا</button>
          </div>
        </div>`
      document.body.appendChild(overlay)
      const confirm = () => { overlay.remove(); resolve(true) }
      const cancel = () => { overlay.remove(); resolve(false) }
      overlay.querySelector('#btn-custom-confirm-yes').addEventListener('click', confirm)
      overlay.querySelector('#btn-custom-confirm-no').addEventListener('click', cancel)
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel() })
    })
  },

  _showEditReasonModal() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.className = 'custom-alert-overlay'
      overlay.innerHTML = `
        <div class="custom-alert-box edit-reason-modal animate-pop">
          <h4>📝 تعديل خانة</h4>
          <p>اكتب سبب التعديل هنا (اختياري)...</p>
          <textarea id="modal-edit-reason-input" placeholder="اكتب سبب التعديل هنا (اختياري)..."></textarea>
          <div class="alert-actions">
            <button id="btn-modal-edit-confirm" class="btn-alert-success">حفظ التعديل</button>
            <button id="btn-modal-edit-cancel" class="btn-alert-secondary">إلغاء</button>
          </div>
        </div>`
      document.body.appendChild(overlay)
      const input = overlay.querySelector('#modal-edit-reason-input')
      const confirm = () => {
        const text = input.value.trim()
        overlay.remove()
        resolve(text || 'بدون سبب')
      }
      const cancel = () => { overlay.remove(); resolve(null) }
      overlay.querySelector('#btn-modal-edit-confirm').addEventListener('click', confirm)
      overlay.querySelector('#btn-modal-edit-cancel').addEventListener('click', cancel)
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel() })
      setTimeout(() => input.focus(), 100)
    })
  },

  _savePointsHistory(userId, adjustment, dateKey, evalEntry) {
    if (!this._pendingEditReason) return
    const currentUser = Auth.currentUser()
    if (!currentUser) return
    if (currentUser.role !== 'admin' && currentUser.role !== 'member') return

    const changedCategories = []
    if (evalEntry) {
      this.COLUMNS.forEach(c => {
        const val = Number(evalEntry[c.key]) || 0
        if (val !== 0) {
          changedCategories.push(`${c.label} (${val > 0 ? '+' : ''}${val})`)
        }
      })
    }
    const categoryStr = changedCategories.length > 0 ? changedCategories.join(' ، ') : `المجموع (${adjustment >= 0 ? '+' : ''}${adjustment})`

    const logEntry = {
      timestamp: new Date().toISOString(),
      category: categoryStr,
      amount: (adjustment >= 0 ? '+' : '') + adjustment,
      reason: this._pendingEditReason,
      changedBy: currentUser.fullName,
      changedByUid: currentUser.id,
    }

    const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
    Store.writePath(`pointsHistory/${userId}/${logId}`, logEntry)
  },

  async onSmartAction(sel, userId) {
    const val = sel.value
    if (!val) return
    if (val === 'neutral') {
      const reason = await this._showReasonModal()
      if (!reason) { sel.value = ''; return }
      this._pendingZeroReason = reason
    }
    if (!this._pendingEditReason) {
      const reason = await this._showEditReasonModal()
      if (!reason) { sel.value = ''; return }
      this._pendingEditReason = reason
    }
    switch (val) {
      case 'bonus': this.fillRow(userId, 'max'); break
      case 'reduce': this.fillRow(userId, 'reduce'); break
      case 'neutral': this.fillRow(userId, 'zero'); break
      case 'normal': this.fillRow(userId, 'normal'); break
    }
    sel.value = ''
  },

  render(dateKey) {
    if (dateKey) {
      this._dateKey = dateKey
    } else if (!this._dateKey) {
      this._dateKey = this.getTodayKey()
    }
    dateKey = this._dateKey
    const el = document.getElementById('tab-evaluation')
    if (!el) return

    const rooms = Store.get('rooms') || []
    if (!this._selectedRoom && rooms.length > 0) {
      this._selectedRoom = localStorage.getItem('ithopiia_evalRoom') || rooms[0].id
    }

    const allUsers = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')
    const genderUsers = allUsers.filter(u => u.gender === this._activeGender)
    const users = this._selectedRoom
      ? genderUsers.filter(u => (u.rooms || []).includes(this._selectedRoom))
      : genderUsers
    const dayData = this.getEvaluation(dateKey)
    const saved = dayData.length > 0 && dayData.every(e => e.saved)
    const isTodayKey = dateKey === this.getTodayKey()

    el.innerHTML = `
      <div class="eval-header-section">
        <div class="eval-date-picker">
          <label style="font-size:14px;margin-left:8px">📅 اختر التاريخ:</label>
          <input type="date" id="eval-date-input" value="${dateKey}" onchange="Evaluation.onDateChange(this.value)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--card-bg);color:var(--text);font-size:14px">
        </div>
        <div class="eval-status" style="margin-top:8px">${isTodayKey
          ? '<span class="badge badge-success">اليوم الحالي — مفتوح دائمًا</span>'
          : (saved ? '<span class="badge badge-info">تم حفظ اليوم</span>' : '<span class="badge badge-success">إدخال التقييم</span>')}
        </div>
      </div>
      <div class="gender-tabs" style="margin-bottom:8px">
        <button class="filter-btn ${this._activeGender === 'male' ? 'active' : ''}" onclick="Evaluation.setEvalGender('male')">الأولاد</button>
        <button class="filter-btn ${this._activeGender === 'female' ? 'active' : ''}" onclick="Evaluation.setEvalGender('female')">البنات</button>
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
                <th class="col-score">
                  <span class="col-label">${c.label}</span>
                  <span class="col-max">±${c.max}</span>
                </th>
              `).join('')}
              <th class="col-total">المجموع</th>
              <th class="col-actions">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            ${users.length === 0 ? '<tr><td colspan="12" style="text-align:center;color:var(--text-muted)">لا يوجد أعضاء في هذه الغرفة</td></tr>' : ''}
            ${users.map((u, i) => {
                  const entry = dayData.find(e => e.userId === u.id)
                  const offsetSum = entry ? this.calculateTotal(entry) : 0
                  const total = this.BASELINE_POINTS + offsetSum
                  const inputDisabled = !isTodayKey && saved
                  return `
                    <tr data-user-id="${u.id}" class="eval-row">
                      <td class="col-num">${i + 1}</td>
                      <td class="col-name">${u.fullName}</td>
                      ${this.COLUMNS.map(c => {
                        const val = entry ? (entry[c.key] ?? 0) : 0
                        return `
                        <td class="col-score" data-label="${c.label}">
                          <div class="stepper ${inputDisabled ? 'stepper-disabled' : ''}">
                            <button class="stepper-btn stepper-down" data-user="${u.id}" data-col="${c.key}" data-step="-1" ${inputDisabled ? 'disabled' : ''} aria-label="إنقاص">▼</button>
                            <span class="stepper-value" id="stepper-val-${u.id}-${c.key}">${val}</span>
                            <button class="stepper-btn stepper-up" data-user="${u.id}" data-col="${c.key}" data-step="1" ${inputDisabled ? 'disabled' : ''} aria-label="زيادة">▲</button>
                          </div>
                        </td>`
                      }).join('')}
                      <td class="col-total eval-total" id="eval-total-${u.id}">${total}</td>
                      <td class="col-actions">
                        ${!inputDisabled ? `
                          <select class="eval-smart-action" data-user="${u.id}" onchange="Evaluation.onSmartAction(this, '${u.id}')">
                            <option value="">تطبيق تلقائي</option>
                            <option value="bonus">تقفيل بونص (+11)</option>
                            <option value="reduce">تصغير عقاب (9)</option>
                            <option value="neutral">تثبيت محايد (0)</option>
                            <option value="normal">تقفيل عادي (10)</option>
                          </select>
                        ` : ''}
                      </td>
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
          <button class="btn-sm btn-primary" onclick="Evaluation.saveDay()">💾 حفظ يوم والتاريخ</button>
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

  setEvalGender(gender) {
    this._activeGender = gender
    this.render()
  },

  bindInputEvents() {
    const grid = document.getElementById('eval-grid-table')
    if (!grid) return

    grid.addEventListener('click', async (e) => {
      const btn = e.target.closest('.stepper-btn:not(:disabled)')
      if (!btn) return
      const userId = btn.dataset.user
      const col = btn.dataset.col
      const step = parseInt(btn.dataset.step)
      if (!userId || !col || !step) return

      if (!this._pendingEditReason) {
        const reason = await this._showEditReasonModal()
        if (!reason) return
        this._pendingEditReason = reason
      }

      const capturedDateKey = this._dateKey
      const all = Store.get('evaluation') || []
      let entry = all.find(e => e.userId === userId && e.dateKey === capturedDateKey)
      if (!entry) {
        const newEntry = {
          userId, dateKey: capturedDateKey,
          spiritual: 0, exercises: 0, moral: 0,
          rehearsal: 0, acting: 0, movement: 0, clothing: 0, bonus: 0,
          totalScore: 0, saved: false,
        }
        all.push(newEntry)
        entry = newEntry
      }

      const column = this.COLUMNS.find(c => c.key === col)
      const minVal = column ? column.min : -1
      const maxVal = column ? column.max : 1
      const current = Number(entry[col]) || 0
      let next = current + step
      next = Math.max(minVal, Math.min(maxVal, next))

      entry[col] = next
      const total = this.calculateTotal(entry)
      entry.totalScore = total

      const valEl = document.getElementById(`stepper-val-${userId}-${col}`)
      if (valEl) valEl.textContent = next

      const totalEl = document.getElementById(`eval-total-${userId}`)
      if (totalEl) totalEl.textContent = this.BASELINE_POINTS + total
      this.updateStats()

      Store.debounce(`eval_${capturedDateKey}_${userId}`, () => {
        this._applyAdjustment(userId, entry.totalScore, capturedDateKey, entry)
      }, 500)
    })
  },

  async updateCell(userId, col, value) {
    if (!this._pendingEditReason) {
      const reason = await this._showEditReasonModal()
      if (!reason) return
      this._pendingEditReason = reason
    }

    const capturedDateKey = this._dateKey
    const all = Store.get('evaluation') || []
    let entry = all.find(e => e.userId === userId && e.dateKey === capturedDateKey)
    if (!entry) {
      const newEntry = {
        userId, dateKey: capturedDateKey,
        spiritual: 0, exercises: 0, moral: 0,
        rehearsal: 0, acting: 0, movement: 0, clothing: 0, bonus: 0,
        totalScore: 0, saved: false,
      }
      all.push(newEntry)
      entry = newEntry
    }

    const column = this.COLUMNS.find(c => c.key === col)
    const minVal = column ? column.min : -1
    const maxVal = column ? column.max : 1
    entry[col] = Math.max(minVal, Math.min(maxVal, Number(value) || 0))

    const total = this.calculateTotal(entry)
    entry.totalScore = total

    const valEl = document.getElementById(`stepper-val-${userId}-${col}`)
    if (valEl) valEl.textContent = entry[col]

    const totalEl = document.getElementById(`eval-total-${userId}`)
    if (totalEl) totalEl.textContent = this.BASELINE_POINTS + total
    this.updateStats()

    Store.debounce(`eval_${capturedDateKey}_${userId}`, () => {
      this._applyAdjustment(userId, entry.totalScore, capturedDateKey, entry)
    }, 500)
  },

  _applyAdjustment(userId, adjustment, dateKey, evalEntry) {
    if (!dateKey) dateKey = this._dateKey
    const dailyPoints = Store.get('dailyPoints')
    let dp = dailyPoints.find(p => p.userId === userId && p.dateKey === dateKey)
    if (!dp) {
      dp = {
        userId, dateKey,
        date: new Date().toISOString(),
        basePoints: this.BASELINE_POINTS,
        evaluationScore: 0,
        manualBonus: 0,
        overwritten: false,
        finalScore: this.BASELINE_POINTS,
        adminNotes: '',
        saved: true,
      }
      dailyPoints.push(dp)
    }
    var bonusVal = evalEntry ? (Number(evalEntry.bonus) || 0) : 0
    dp.manualBonus = bonusVal
    dp.evaluationScore = (adjustment || 0) - bonusVal
    dp.finalScore = this.BASELINE_POINTS + (adjustment || 0)
    dp.saved = true

    if (dp.finalScore <= 0) {
      if (this._pendingZeroReason) {
        dp.zeroReason = this._pendingZeroReason
        this._pendingZeroReason = null
      } else if (!dp.zeroReason) {
        dp.zeroReason = ''
      }
    }

    Store.writePath(`dailyPoints/${dateKey}/${userId}`, {
      basePoints: dp.basePoints,
      evaluationScore: dp.evaluationScore,
      manualBonus: dp.manualBonus,
      finalScore: dp.finalScore,
      overwritten: dp.overwritten ?? false,
      adminNotes: dp.adminNotes ?? '',
      zeroReason: dp.zeroReason ?? '',
      saved: true,
      date: dp.date ?? new Date().toISOString(),
    })

    if (evalEntry) {
      const { userId: uid, dateKey: dk, totalScore, saved, ...evalScores } = evalEntry
      Store.writePath(`evaluation/${dateKey}/${userId}`, { ...evalScores, totalScore, saved })
    }

    this._savePointsHistory(userId, adjustment, dateKey, evalEntry)

    this._syncCumulativeToFirebase(userId)
  },

  _syncCumulativeToFirebase(userId) {
    const dailyPoints = Store.get('dailyPoints') || []
    const total = dailyPoints
      .filter(p => p.userId === userId && p.saved !== false)
      .reduce((sum, p) => sum + calcEntryScore(p), 0)
    const users = Store.get('users') || []
    const user = users.find(u => u.id === userId)
    if (user) {
      user.cumulativePoints = total
      Store.writePath(`users/${userId}/cumulativePoints`, total)
    }
  },

  fillRow(userId, direction) {
    const capturedDateKey = this._dateKey
    const all = Store.get('evaluation') || []
    let entry = all.find(e => e.userId === userId && e.dateKey === capturedDateKey)
    if (!entry) {
      const newEntry = {
        userId, dateKey: capturedDateKey,
        spiritual: 0, exercises: 0, moral: 0,
        rehearsal: 0, acting: 0, movement: 0, clothing: 0, bonus: 0,
        totalScore: 0, saved: false,
      }
      all.push(newEntry)
      entry = newEntry
    }

    this.COLUMNS.forEach(c => {
      let val
      if (direction === 'reduce') {
        val = c.key === 'bonus' ? -1 : c.max
      } else if (direction === 'normal') {
        val = c.key === 'bonus' ? 0 : c.max
      } else {
        switch (direction) {
          case 'max': val = c.max; break
          case 'min': val = c.min; break
          case 'zero': val = 0; break
          case 'minusone': val = -1; break
          default: val = 0
        }
      }
      entry[c.key] = val
      const valEl = document.getElementById(`stepper-val-${userId}-${c.key}`)
      if (valEl) valEl.textContent = val
    })

    const total = this.calculateTotal(entry)
    entry.totalScore = total
    const totalEl = document.getElementById(`eval-total-${userId}`)
    if (totalEl) totalEl.textContent = this.BASELINE_POINTS + total
    this.updateStats()

    Store.debounce(`eval_${capturedDateKey}_${userId}`, () => {
      this._applyAdjustment(userId, entry.totalScore, capturedDateKey, entry)
    }, 500)
  },

  updateStats() {
    const el = document.getElementById('eval-stats')
    if (!el) return
    const dayData = this.getEvaluation(this._dateKey)
    const total = dayData.reduce((s, e) => s + this.BASELINE_POINTS + this.calculateTotal(e), 0)
    const count = dayData.length
    el.textContent = `📊 ${count} أعضاء — إجمالي النقاط: ${total}`
  },

  async saveDay() {
    const dateKey = this._dateKey
    const confirmed = await this._showCustomConfirm(`هل تريد حفظ يوم ${this.formatDate(dateKey)} والتاريخ؟`)
    if (!confirmed) return

    const all = Store.get('evaluation') || []
    const dailyPoints = Store.get('dailyPoints') || []

    const dayEntries = all.filter(e => e.dateKey === dateKey)
    dayEntries.forEach(e => {
      e.totalScore = this.calculateTotal(e)
      e.saved = true
      const existing = dailyPoints.find(p => p.userId === e.userId && p.dateKey === dateKey)
      const isZero = this.BASELINE_POINTS + (e.totalScore || 0) <= 0
      let reason = ''
      if (isZero) {
        reason = this._pendingZeroReason || (existing?.zeroReason) || ''
        if (this._pendingZeroReason && !existing?.zeroReason) {
          if (existing) existing.zeroReason = this._pendingZeroReason
        }
      }
      if (!existing) {
        var bonusVal = Number(e.bonus) || 0
        dailyPoints.push({
          userId: e.userId, dateKey,
          date: new Date().toISOString(),
          basePoints: this.BASELINE_POINTS,
          evaluationScore: (e.totalScore || 0) - bonusVal,
          manualBonus: bonusVal,
          overwritten: false,
          finalScore: this.BASELINE_POINTS + (e.totalScore || 0),
          adminNotes: '',
          zeroReason: reason,
          saved: true,
        })
      }
    })

    const allPaths = {}
    dayEntries.forEach(e => {
      const { userId, dateKey: dk, totalScore, saved, ...evalScores } = e
      allPaths[`evaluation/${dateKey}/${userId}`] = { ...evalScores, totalScore, saved }
      const dp = dailyPoints.find(p => p.userId === userId && p.dateKey === dateKey)
      if (dp) {
        allPaths[`dailyPoints/${dateKey}/${userId}`] = {
          basePoints: dp.basePoints,
          evaluationScore: dp.evaluationScore ?? 0,
          manualBonus: dp.manualBonus ?? 0,
          finalScore: dp.finalScore,
          overwritten: dp.overwritten ?? false,
          adminNotes: dp.adminNotes ?? '',
          zeroReason: dp.zeroReason ?? '',
          saved: true,
          date: dp.date ?? new Date().toISOString(),
        }
      }
    })
    Object.entries(allPaths).forEach(([path, val]) => {
      Store.writePath(path, val)
    })

    if (this._pendingEditReason) {
      const savedReason = this._pendingEditReason
      dayEntries.forEach(e => {
        const currentUser = Auth.currentUser()
        if (!currentUser) return
        const changedCategories = []
        this.COLUMNS.forEach(c => {
          const val = Number(e[c.key]) || 0
          if (val !== 0) {
            changedCategories.push(`${c.label} (${val > 0 ? '+' : ''}${val})`)
          }
        })
        const totalScore = e.totalScore || 0
        const categoryStr = changedCategories.length > 0 ? changedCategories.join(' ، ') : `المجموع (${totalScore >= 0 ? '+' : ''}${totalScore})`
        const logEntry = {
          timestamp: new Date().toISOString(),
          category: categoryStr,
          amount: (totalScore >= 0 ? '+' : '') + totalScore,
          reason: savedReason,
          changedBy: currentUser.fullName,
          changedByUid: currentUser.id,
        }
        const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
        Store.writePath(`pointsHistory/${e.userId}/${logId}`, logEntry)
      })
    }

    const notice = document.getElementById('eval-saved-notice')
    if (notice) {
      notice.style.display = 'block'
      setTimeout(() => { notice.style.display = 'none' }, 5000)
    }

    this._pendingZeroReason = null
    this._pendingEditReason = null
    this.render()
  },

  async unlockDay() {
    const dateKey = this._dateKey
    const confirmed = await this._showCustomConfirm('فتح اليوم سيسمح بالتعديل مرة أخرى. هل تريد المتابعة؟')
    if (!confirmed) return
    const all = Store.get('evaluation')
    all.forEach(e => {
      if (e.dateKey === dateKey) {
        e.saved = false
        Store.writePath(`evaluation/${dateKey}/${e.userId}/saved`, false)
      }
    })
    this.render()
  },
}
