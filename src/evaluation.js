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
      entry = this._defaultEntry(userId, dateKey)
      all.push(entry)
      var defaultData = {}
      this.COLUMNS.forEach(function (c) { defaultData[c.key] = 0 })
      defaultData.totalScore = 0
      defaultData.saved = false
      Store.writePath('evaluation/' + dateKey + '/' + userId, defaultData)
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

  _defaultEntry(userId, dateKey) {
    const scores = {}
    let total = 0
    this.COLUMNS.forEach(function (c) {
      scores[c.key] = 0
      total += 0
    })
    return { userId, dateKey, ...scores, totalScore: total, saved: false }
  },

  _evalSnapshots: {},

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

  async onSmartAction(sel, userId) {
    const val = sel.value
    if (!val) return
    if (val === 'neutral') {
      const reason = await this._showReasonModal()
      if (!reason) { sel.value = ''; return }
      this._pendingZeroReason = reason
    }
    switch (val) {
      case 'bonus': this.fillRow(userId, 'max'); break
      case 'reduce': this.fillRow(userId, 'reduce'); break
      case 'neutral':
        this.fillRow(userId, 'zero')
        await this._executeAbsoluteUserReset(userId, this._dateKey, this._pendingZeroReason)
        break
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
              const snapKey = u.id + '_' + dateKey
              this._evalSnapshots[snapKey] = entry ? { ...entry } : {}
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
                          <div class="eval-detail-group" id="eval-detail-group-${u.id}" style="display:none">
                            <div class="action-buttons-container">
                              <button class="btn-detail btn-detail-pos" onclick="Evaluation._toggleDetailInput('${u.id}','pos')" type="button">🟢 تفصيل التقييم الموجب</button>
                              <button class="btn-detail btn-detail-neg" onclick="Evaluation._toggleDetailInput('${u.id}','neg')" type="button">🔴 تفصيل التقييم السالب</button>
                            </div>
                            <div class="eval-detail-fields" id="eval-detail-fields-${u.id}">
                              <input type="text" id="eval-pos-reason-${u.id}" class="eval-detail-input eval-detail-input-pos" placeholder="اكتب سبب النقاط الموجبة هنا..." dir="rtl" style="display:none">
                              <input type="text" id="eval-neg-reason-${u.id}" class="eval-detail-input eval-detail-input-neg" placeholder="اكتب سبب النقاط السالبة هنا..." dir="rtl" style="display:none">
                            </div>
                          </div>
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
          <button class="btn-sm btn-primary" onclick="Evaluation.saveDay()">💾 حفظ اليوم والتاريخ</button>
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

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.stepper-btn:not(:disabled)')
      if (!btn) return
      const userId = btn.dataset.user
      const col = btn.dataset.col
      const step = parseInt(btn.dataset.step)
      if (!userId || !col || !step) return

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
      this._checkScoreChangesForVisibility(userId)
    })
  },

  _checkScoreChangesForVisibility(userId) {
    const capturedDateKey = this._dateKey
    const all = Store.get('evaluation') || []
    let entry = all.find(e => e.userId === userId && e.dateKey === capturedDateKey)
    if (!entry) return
    const hasChanges = this.COLUMNS.some(c => {
      const val = Number(entry[c.key]) || 0
      return val !== 0
    })
    const group = document.getElementById('eval-detail-group-' + userId)
    if (group) group.style.display = hasChanges ? 'block' : 'none'
  },

  _toggleDetailInput(userId, type) {
    var el = document.getElementById('eval-' + type + '-reason-' + userId)
    if (!el) return
    if (el.style.display === 'none') {
      el.style.display = 'block'
      el.focus()
    } else {
      el.style.display = 'none'
    }
  },

  updateCell(userId, col, value) {
    const capturedDateKey = this._dateKey
    const all = Store.get('evaluation') || []
    let entry = all.find(e => e.userId === userId && e.dateKey === capturedDateKey)
    if (!entry) {
      entry = this._defaultEntry(userId, capturedDateKey)
      all.push(entry)
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
        finalScore: 0,
        adminNotes: '',
        saved: true,
      }
      dailyPoints.push(dp)
    }
    var bonusVal = evalEntry ? (Number(evalEntry.bonus) || 0) : 0
    dp.manualBonus = bonusVal
    dp.evaluationScore = (adjustment || 0)
    dp.finalScore = (adjustment || 0)
    dp.saved = true

    if (dp.finalScore <= 0) {
      if (this._pendingZeroReason) {
        dp.zeroReason = this._pendingZeroReason
        this._pendingZeroReason = null
      } else if (!dp.zeroReason) {
        dp.zeroReason = ''
      }
    }

    const db = firebase.database()
    const updates = {}

    updates['/ithopiia/dailyPoints/' + dateKey + '/' + userId] = {
      basePoints: dp.basePoints,
      evaluationScore: dp.evaluationScore,
      manualBonus: dp.manualBonus,
      finalScore: dp.finalScore,
      overwritten: true,
      adminNotes: dp.adminNotes ?? '',
      zeroReason: dp.zeroReason ?? '',
      saved: true,
      date: dp.date ?? new Date().toISOString(),
    }

    if (evalEntry) {
      const { userId: uid, dateKey: dk, totalScore, saved, ...evalScores } = evalEntry
      updates['/ithopiia/evaluation/' + dateKey + '/' + userId] = {
        ...evalScores, totalScore, saved,
        evaluationScore: dp.evaluationScore,
        finalScore: dp.finalScore,
        manualBonus: dp.manualBonus,
        zeroReason: dp.zeroReason ?? '',
      }
    }

    var cumulativeTotal = (Store.get('dailyPoints') || [])
      .filter(function (p) { return p.userId === userId && p.saved !== false })
      .reduce(function (sum, p) { return sum + calcEntryScore(p) }, 0)
    var user = (Store.get('users') || []).find(function (u) { return u.id === userId })
    if (user) user.cumulativePoints = cumulativeTotal
    updates['/ithopiia/users/' + userId + '/cumulativePoints'] = cumulativeTotal

    db.ref().update(updates).catch(function (err) {
      console.error('Atomic update in _applyAdjustment failed:', err)
    })
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

  async _executeAbsoluteUserReset(userId, dateKey, finalReason, actionType = "zero") {
    if (!userId || !dateKey) {
      console.error("[Reset Engine] Missing vital identifiers.");
      return;
    }

    let targetScore = 0;

    let resetPayload = {};

    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/totalScore`] = targetScore;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/evaluationScore`] = targetScore;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/finalScore`] = targetScore;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/zeroReason`] = finalReason;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/saved`] = true;

    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/acting`] = 0;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/bonus`] = 0;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/clothing`] = 0;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/exercises`] = 0;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/moral`] = 0;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/movement`] = 0;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/rehearsal`] = 0;
    resetPayload[`/ithopiia/evaluation/${dateKey}/${userId}/spiritual`] = 0;

    resetPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/evaluationScore`] = targetScore;
    resetPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/finalScore`] = targetScore;
    resetPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/manualBonus`] = 0;
    resetPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/zeroReason`] = finalReason;
    resetPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/saved`] = true;
    resetPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/overwritten`] = true;

    console.log(`[Namespace Guard] Executing ${actionType} write for total: ${targetScore} on date: ${dateKey}`);

    return firebase.database().ref().update(resetPayload)
      .then(() => {
        console.log("[Reset Engine Success] Namespace synced flawlessly.");
        if (typeof renderEvaluationTable === "function") {
          renderEvaluationTable();
        }
      })
      .catch((error) => {
        console.error("[Reset Engine Fatal Error]:", error);
        alert("خطأ حرج في الصلاحيات: تأكد من تفعيل البادئة الصحيحة!");
      });
  },

  fillRow(userId, direction) {
    const capturedDateKey = this._dateKey
    const all = Store.get('evaluation') || []
    let entry = all.find(e => e.userId === userId && e.dateKey === capturedDateKey)
    if (!entry) {
      entry = this._defaultEntry(userId, capturedDateKey)
      all.push(entry)
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
    this._checkScoreChangesForVisibility(userId)
  },

  updateStats() {
    const el = document.getElementById('eval-stats')
    if (!el) return
    const dayData = this.getEvaluation(this._dateKey)
    const total = dayData.reduce((s, e) => s + this.BASELINE_POINTS + this.calculateTotal(e), 0)
    const count = dayData.length
    el.textContent = `📊 ${count} أعضاء — إجمالي النقاط: ${total}`
  },

  _openUnifiedSaveModal(userId) {
    const dateKey = this._dateKey
    const currentUser = Auth.currentUser()
    if (!currentUser) return
    if (currentUser.role !== 'admin' && currentUser.role !== 'member') return

    const all = Store.get('evaluation') || []
    const entry = all.find(e => e.userId === userId && e.dateKey === dateKey)
    if (!entry) {
      showCustomAlert('لم يتم العثور على بيانات التقييم لهذا المستخدم.')
      return
    }

    const snapshotKey = userId + '_' + dateKey
    const snapshot = this._evalSnapshots[snapshotKey] || {}

    const regularChanges = []
    let bonusChange = null

    this.COLUMNS.forEach(c => {
      const currentVal = Number(entry[c.key]) || 0
      const originalVal = Number(snapshot[c.key]) || 0
      if (currentVal !== originalVal) {
        const diff = currentVal - originalVal
        if (c.key === 'bonus') {
          bonusChange = { label: c.label, diff, current: currentVal }
        } else {
          regularChanges.push({ label: c.label, diff, current: currentVal })
        }
      }
    })

    if (regularChanges.length === 0 && !bonusChange) {
      showCustomAlert('لم تقم بإجراء أي تغيير في الدرجات لحفظه!')
      return
    }

    const overlay = document.createElement('div')
    overlay.className = 'custom-modal-overlay'
    overlay.innerHTML = `
      <div class="custom-modal-card animate-pop">
        <div class="modal-header">
          <span class="modal-icon">📝</span>
          <h3>تفاصيل التقييم</h3>
        </div>
        <p class="modal-subtitle">مراجعة تغييرات النقاط قبل الحفظ</p>
        <div class="modal-score-summary" id="modal-score-summary"></div>
        <div class="modal-footer-actions">
          <button id="submit-global-grade" class="btn-modal-save">حفظ اليوم</button>
          <button id="close-global-modal" class="btn-modal-cancel">إلغاء</button>
        </div>
      </div>`
    document.body.appendChild(overlay)

    {
      const lines = []
      regularChanges.forEach(function (c) {
        const sign = c.diff > 0 ? '+' : ''
        lines.push('<span class="change-line"><span class="change-label">' + c.label + '</span> <span class="change-diff">' + sign + c.diff + '</span></span>')
      })
      if (bonusChange) {
        const bSign = bonusChange.diff > 0 ? '+' : ''
        lines.push('<span class="change-line"><span class="change-label">' + bonusChange.label + '</span> <span class="change-diff">' + bSign + bonusChange.diff + '</span></span>')
      }
      const totalScore = this.calculateTotal(entry)
      lines.push('<span class="change-total"><strong>المجموع: +' + totalScore + '</strong></span>')
      document.getElementById('modal-score-summary').innerHTML = lines.join('')
    }

    document.getElementById('submit-global-grade').addEventListener('click', async () => {
      var posEl = document.getElementById('eval-pos-reason-' + userId)
      var negEl = document.getElementById('eval-neg-reason-' + userId)
      const positiveReason = posEl ? posEl.value.trim() : ''
      const negativeReason = negEl ? negEl.value.trim() : ''
      const sharedReason = [positiveReason, negativeReason].filter(Boolean).join(' | ') || 'تم التقييم اليومي العادي'

      const db = firebase.database()
      const updates = {}
      var hasMinusChanges = false

      if (regularChanges.length > 0) {
        hasMinusChanges = regularChanges.some(function (c) { return c.diff < 0 })
        const changesStr = regularChanges.map(c => `${c.label} (${c.diff > 0 ? '+' : ''}${c.diff})`).join(' ، ')
        const logType = hasMinusChanges ? 'minus' : 'bonus'

        const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
        updates['/ithopiia/pointsHistory/' + userId + '/' + logId] = {
          timestamp: new Date().toISOString(),
          date: dateKey,
          summary: changesStr,
          reason: sharedReason,
          positiveReason: positiveReason,
          negativeReason: negativeReason,
          type: logType,
          changedBy: currentUser.fullName,
          changedByUid: currentUser.id,
        }
      }

      if (bonusChange) {
        const bonusSign = bonusChange.diff > 0 ? '+' : ''
        const bonusStr = 'بونص (' + bonusSign + bonusChange.diff + ')'
        const bonusLogId = 'log_' + Date.now() + '_b' + Math.random().toString(36).substr(2, 4)
        updates['/ithopiia/pointsHistory/' + userId + '/' + bonusLogId] = {
          timestamp: new Date().toISOString(),
          date: dateKey,
          summary: bonusStr,
          reason: sharedReason,
          positiveReason: positiveReason,
          negativeReason: negativeReason,
          type: bonusChange.diff > 0 ? 'bonus' : 'minus',
          changedBy: currentUser.fullName,
          changedByUid: currentUser.id,
        }
      }

      const totalScore = this.calculateTotal(entry)
      entry.totalScore = totalScore
      entry.saved = true

      var bonusVal = Number(entry.bonus) || 0
      const dailyPoints = Store.get('dailyPoints') || []
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
      dp.manualBonus = bonusVal
      dp.evaluationScore = totalScore
      dp.finalScore = totalScore
      dp.saved = true
      dp.positiveReason = positiveReason
      dp.negativeReason = negativeReason

      if (dp.finalScore <= 0) {
        if (this._pendingZeroReason) {
          dp.zeroReason = this._pendingZeroReason
          this._pendingZeroReason = null
        } else if (!dp.zeroReason) {
          dp.zeroReason = ''
        }
      }

      var cumulativeTotal = (Store.get('dailyPoints') || [])
        .filter(function (p) { return p.userId === userId && p.saved !== false })
        .reduce(function (sum, p) { return sum + calcEntryScore(p) }, 0)

      var localUser = (Store.get('users') || []).find(function (u) { return u.id === userId })
      if (localUser) localUser.cumulativePoints = cumulativeTotal

      var bonusCounterUpdate = {}
      bonusCounterUpdate['/ithopiia/users/' + userId + '/cumulativePoints'] = cumulativeTotal

      try {
        const userRef = db.ref('/ithopiia/users/' + userId)
        const userSnap = await userRef.once('value')
        const userData = userSnap.val() || {}
        if (bonusVal > 0) {
          bonusCounterUpdate['/ithopiia/users/' + userId + '/bonusCounter'] = (userData.bonusCounter || 0) + 1
        } else if (bonusVal < 0) {
          bonusCounterUpdate['/ithopiia/users/' + userId + '/minusCounter'] = (userData.minusCounter || 0) + 1
        }
      } catch (e) {
      }

      await db.ref().update(bonusCounterUpdate).catch(function (e) {
        console.error('Counter update failed:', e)
      })

      var scorePayload = {
        acting: entry.acting,
        bonus: entry.bonus,
        clothing: entry.clothing,
        exercises: entry.exercises,
        moral: entry.moral,
        movement: entry.movement,
        rehearsal: entry.rehearsal,
        spiritual: entry.spiritual,
      }
      await saveAssessmentFinalSync(userId, dateKey, scorePayload, sharedReason, positiveReason, negativeReason)

      overlay.remove()

      var userName = ''
      var allUsers = Store.get('users') || []
      var userObj = allUsers.find(function (u) { return u.id === userId })
      if (userObj) userName = userObj.fullName
      this._showSavedNotice(userName || userId)
    })

    document.getElementById('close-global-modal').addEventListener('click', () => {
      overlay.remove()
    })
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove() })
  },

  _showSavedNotice(userName) {
    const container = document.getElementById('tab-evaluation')
    if (!container) return
    const existing = container.querySelector('.eval-toast-notice')
    if (existing) existing.remove()
    const notice = document.createElement('div')
    notice.className = 'eval-toast-notice'
    notice.innerHTML = '✅ تم حفظ تقييم <strong>' + userName + '</strong> بنجاح!'
    container.appendChild(notice)
    setTimeout(() => { notice.remove() }, 3000)
  },

  async saveDay() {
    const dateKey = this._dateKey
    const confirmed = await this._showCustomConfirm(`هل تريد حفظ يوم ${this.formatDate(dateKey)} والتاريخ؟`)
    if (!confirmed) return

    const all = Store.get('evaluation') || []
    const dailyPoints = Store.get('dailyPoints') || []

    const dayEntries = all.filter(e => e.dateKey === dateKey)
    dayEntries.forEach(e => {
      const posEl = document.getElementById('eval-pos-reason-' + e.userId)
      const negEl = document.getElementById('eval-neg-reason-' + e.userId)
      const positiveReason = posEl ? posEl.value.trim() : ''
      const negativeReason = negEl ? negEl.value.trim() : ''

      e.totalScore = this.calculateTotal(e)
      e.saved = true
      e.positiveReason = positiveReason
      e.negativeReason = negativeReason

      const existing = dailyPoints.find(p => p.userId === e.userId && p.dateKey === dateKey)
      const isZero = (e.totalScore || 0) <= 0
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
          evaluationScore: e.totalScore || 0,
          manualBonus: bonusVal,
          overwritten: false,
          finalScore: e.totalScore || 0,
          adminNotes: '',
          zeroReason: reason,
          positiveReason: positiveReason,
          negativeReason: negativeReason,
          saved: true,
        })
      } else {
        existing.positiveReason = positiveReason
        existing.negativeReason = negativeReason
      }
    })

    const allPaths = {}
    dayEntries.forEach(e => {
      const { userId, dateKey: dk, totalScore, saved, ...evalScores } = e
      allPaths[`evaluation/${dateKey}/${userId}`] = { ...evalScores, totalScore, evaluationScore: totalScore, finalScore: totalScore, saved }
      allPaths[`dailyPoints/${dateKey}/${userId}`] = {
        basePoints: this.BASELINE_POINTS,
        evaluationScore: totalScore,
        manualBonus: Number(e.bonus) || 0,
        finalScore: totalScore,
        overwritten: true,
        adminNotes: '',
        zeroReason: '',
        positiveReason: e.positiveReason || '',
        negativeReason: e.negativeReason || '',
        saved: true,
        date: new Date().toISOString(),
      }
    })
    Object.entries(allPaths).forEach(([path, val]) => {
      Store.writePath(path, val)
    })

    const notice = document.getElementById('eval-saved-notice')
    if (notice) {
      notice.style.display = 'block'
      setTimeout(() => { notice.style.display = 'none' }, 5000)
    }

    this._pendingZeroReason = null
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

window.forceAbsoluteDatabaseOverwrite = function (userId, scorePayload, finalReason) {
  if (!finalReason) finalReason = ''
  var currentDate = new Date().toISOString().split('T')[0]
  var userTargetRef = firebase.database().ref('/ithopiia/users/' + userId + '/scores/' + currentDate)
  var values = Object.values(scorePayload)
  var isResetAction = values.every(function (v) { return v === 0 || v === '0' })

  var finalPayload = {
    acting: Number(scorePayload.acting || 0),
    bonus: Number(scorePayload.bonus || 0),
    clothing: Number(scorePayload.clothing || 0),
    exercises: Number(scorePayload.exercises || 0),
    moral: Number(scorePayload.moral || 0),
    movement: Number(scorePayload.movement || 0),
    rehearsal: Number(scorePayload.rehearsal || 0),
    spiritual: Number(scorePayload.spiritual || 0),
    saved: true,
    zeroReason: isResetAction ? finalReason : '',
  }

  if (isResetAction) {
    finalPayload.evaluationScore = 0
    finalPayload.finalScore = 0
    finalPayload.manualBonus = 0
  } else {
    var calculatedSum = finalPayload.acting + finalPayload.clothing + finalPayload.exercises + finalPayload.moral + finalPayload.movement + finalPayload.rehearsal + finalPayload.spiritual
    finalPayload.evaluationScore = calculatedSum
    finalPayload.finalScore = calculatedSum + finalPayload.bonus
    finalPayload.manualBonus = finalPayload.bonus
  }

  return userTargetRef.set(finalPayload).then(function () {
    console.log('Scores successfully synced with summaries.')
    return firebase.database().ref('/ithopiia/pointsHistory/' + userId).push({
      date: currentDate,
      summary: isResetAction ? '⚠️ تم تصفير كافة الدرجات' : '🔄 تم تعديل وتحديث تفاصيل التقييم',
      reason: finalReason || 'تحديث من لوحة التحكم',
      type: isResetAction ? 'minus' : 'bonus',
    })
  }).catch(function (err) {
    console.error('Atomic save failed deeply at child path:', err)
  })
}

function initiateAbsoluteLiveSyncTrigger(userId, dateKey) {
    if (!userId || !dateKey) return;
    
    const evaluationTotalRef = firebase.database().ref(`/evaluation/${dateKey}/${userId}/totalScore`);
    const evaluationBonusRef = firebase.database().ref(`/evaluation/${dateKey}/${userId}/bonus`);

    console.log(`[Trigger Active] Shielding live synchronization for user: ${userId}`);

    evaluationTotalRef.on('value', (snapshot) => {
        const liveTotal = snapshot.val();
        if (liveTotal !== null && liveTotal !== undefined) {
            evaluationBonusRef.once('value').then((bonusSnap) => {
                const liveBonus = Number(bonusSnap.val() || 0);
                const numericTotal = Number(liveTotal);

                let correctionPayload = {
                    evaluationScore: numericTotal,
                    finalScore: numericTotal,
                    manualBonus: liveBonus,
                    saved: true,
                    overwritten: true,
                    date: new Date().toISOString()
                };

                return firebase.database().ref(`/dailyPoints/${dateKey}/${userId}`).update(correctionPayload);
            }).then(() => {
                console.log(`[Trigger Success] dailyPoints forcefully synced to match totalScore: ${liveTotal}`);
            }).catch(err => {
                console.error("[Trigger Failed] Sync block failed:", err);
            });
        }
    });
}

window.saveAssessmentFinalSync = function(userId, dateKey, scorePayload, finalReason = "", positiveReason = "", negativeReason = "") {
    if (!userId || !dateKey) return;

    // 1. Force strict absolute numbers straight from the current active payload
    const acting = Number(scorePayload.acting || scorePayload["الأداء التمثيلي"] || 0);
    const bonus = Number(scorePayload.bonus || scorePayload["بونص"] || scorePayload["البونص"] || 0);
    const clothing = Number(scorePayload.clothing || scorePayload["ملابس مناسبة"] || 0);
    const exercises = Number(scorePayload.exercises || scorePayload["التمارين"] || 0);
    const moral = Number(scorePayload.moral || scorePayload["الالتزام الأخلاقي"] || 0);
    const movement = Number(scorePayload.movement || scorePayload["الأداء الحركي"] || 0);
    const rehearsal = Number(scorePayload.rehearsal || scorePayload["الالتزام بالبروفة"] || 0);
    const spiritual = Number(scorePayload.spiritual || scorePayload["الجزء الروحي"] || 0);

    const absoluteTotal = acting + clothing + exercises + moral + movement + rehearsal + spiritual + bonus;

    let atomicPayload = {};
    
    // Hard Overwrite Evaluation Leaf Nodes
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/acting`] = acting;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/bonus`] = bonus;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/clothing`] = clothing;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/exercises`] = exercises;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/moral`] = moral;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/movement`] = movement;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/rehearsal`] = rehearsal;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/spiritual`] = spiritual;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/totalScore`] = absoluteTotal;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/evaluationScore`] = absoluteTotal;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/finalScore`] = absoluteTotal;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/saved`] = true;
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/positiveReason`] = positiveReason || "";
    atomicPayload[`/ithopiia/evaluation/${dateKey}/${userId}/negativeReason`] = negativeReason || "";

    // Hard Overwrite DailyPoints Leaf Nodes
    atomicPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/evaluationScore`] = absoluteTotal;
    atomicPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/finalScore`] = absoluteTotal;
    atomicPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/manualBonus`] = bonus;
    atomicPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/positiveReason`] = positiveReason || "";
    atomicPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/negativeReason`] = negativeReason || "";
    atomicPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/saved`] = true;
    atomicPayload[`/ithopiia/dailyPoints/${dateKey}/${userId}/overwritten`] = true;

    console.log(`[Forced Re-Sync] Overwriting user ${userId} branches with strict total: ${absoluteTotal}`);

    // 2. Push unified update to root to sync both nodes simultaneously
    return firebase.database().ref().update(atomicPayload)
        .then(() => {
            console.log("[Sync Done] Both branches synchronized identical payloads.");
            
            // Immediately patch the local store so cumulative recalc sees fresh data
            const allDp = Store._data.dailyPoints || [];
            let localEntry = allDp.find(p => p.userId === userId && p.dateKey === dateKey);
            if (localEntry) {
                localEntry.evaluationScore = absoluteTotal;
                localEntry.finalScore = absoluteTotal;
                localEntry.positiveReason = positiveReason || "";
                localEntry.negativeReason = negativeReason || "";
            } else {
                allDp.push({
                    userId, dateKey,
                    evaluationScore: absoluteTotal,
                    finalScore: absoluteTotal,
                    positiveReason: positiveReason || "",
                    negativeReason: negativeReason || "",
                    saved: true,
                    overwritten: true,
                });
            }
            
            // Recalculate all cumulative totals and ranks from the patched store
            Store._recalcCumulative();
            
            // Refresh the dashboard UI — stats, leaderboard, user info, points
            if (typeof Dashboard?.autoRefresh === "function") {
                const user = Auth.currentUser();
                if (user) Dashboard.autoRefresh(user);
            }
        })
        .catch((error) => {
            console.error("[Sync Fatal Error]:", error);
        });
};
