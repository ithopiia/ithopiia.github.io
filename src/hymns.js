window.HYMNS_CONFIG = {
  'طوليثوس': { maxScore: 5 },
  'خين إفران': { maxScore: 5 },
  'كي أبرطو': { maxScore: 20 },
}

const HYMN_CLASSES = {
  'طوليثوس': 'hymn-tolithos',
  'خين إفران': 'hymn-khen',
  'كي أبرطو': 'hymn-ki',
}

window.Hymns = {
  _expandedHymn: null,

  getScores(hymnId) {
    const scores = []
    ;(Store._data.users || []).forEach(u => {
      const val = u.hymns && u.hymns[hymnId]
      if (val) scores.push({ userId: u.id, score: val })
    })
    return scores
  },

  getStudentScore(hymnId, userId) {
    const user = (Store._data.users || []).find(u => u.id === userId)
    return (user && user.hymns && user.hymns[hymnId]) || 0
  },

  render() {
    const el = document.getElementById('admin-tab-hymns')
    if (!el) return

    const users = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')
      .sort((a, b) => (b.cumulativePoints || 0) - (a.cumulativePoints || 0))

    let html = ''
    const hymnIds = Object.keys(HYMNS_CONFIG)

    hymnIds.forEach(hymnId => {
      const config = HYMNS_CONFIG[hymnId]
      const isExpanded = this._expandedHymn === hymnId
      const scores = this.getScores(hymnId)
      const totalStudents = users.length
      const hymnClass = HYMN_CLASSES[hymnId] || ''

      html += `
      <div class="hymn-card ${hymnClass}" data-hymn-id="${hymnId}">
        <span class="hymn-center-title">${hymnId}</span>
        <div class="controls-left-wrapper">
          <span class="hymn-score-limit">من ${config.maxScore}</span>
          <span class="student-count-badge">${scores.filter(s => s.score > 0).length}/${totalStudents}</span>
          <span class="dropdown-arrow-icon">${isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      <div class="students-hymn-list ${isExpanded ? 'open' : ''}" data-hymn-target="${hymnId}">
        ${users.length === 0 ? '<p class="text-muted" style="text-align:center;padding:16px">لا يوجد طلاب معتمدون</p>' : ''}
        ${users.map((u, i) => {
          const score = this.getStudentScore(hymnId, u.id)
          return `
          <div class="student-hymn-row" data-student-id="${u.id}">
            <span class="hymn-student-name">${i + 1}. ${u.fullName}</span>
            <div class="stepper">
              <button class="stepper-btn" onclick="Hymns.changeScore('${hymnId}', '${u.id}', -1)" ${score <= 0 ? 'disabled' : ''}>−</button>
              <span class="hymn-score-value" id="hymn-score-${hymnId}-${u.id}">${score}</span>
              <button class="stepper-btn" onclick="Hymns.changeScore('${hymnId}', '${u.id}', 1)" ${score >= config.maxScore ? 'disabled' : ''}>+</button>
            </div>
          </div>
          `
        }).join('')}
        <div class="hymn-save-container">
          <button class="hymn-save-btn" id="hymn-save-btn-${hymnId}">💾 حفظ التسميع</button>
        </div>
      </div>`
    })

    el.innerHTML = `<div class="hymns-panel-wrapper">${html}</div>`
  },

  toggleHymn(hymnId) {
    const isSame = this._expandedHymn === hymnId
    this._expandedHymn = isSame ? null : hymnId

    document.querySelectorAll('.students-hymn-list').forEach(el => {
      el.classList.remove('open')
    })
    document.querySelectorAll('.hymn-card .dropdown-arrow-icon').forEach(el => {
      el.textContent = '▼'
    })

    if (!isSame) {
      const list = document.querySelector(`.students-hymn-list[data-hymn-target="${hymnId}"]`)
      if (list) list.classList.add('open')
      const arrow = document.querySelector(`.hymn-card[data-hymn-id="${hymnId}"] .dropdown-arrow-icon`)
      if (arrow) arrow.textContent = '▲'
    }
  },

  changeScore(hymnId, userId, delta) {
    const config = HYMNS_CONFIG[hymnId]
    const user = (Store._data.users || []).find(u => u.id === userId)
    const current = (user && user.hymns && user.hymns[hymnId]) || 0
    const newScore = Math.max(0, Math.min(config.maxScore, current + delta))

    if (user) {
      if (!user.hymns) user.hymns = {}
      user.hymns[hymnId] = newScore
    }

    const el = document.getElementById(`hymn-score-${hymnId}-${userId}`)
    if (el) el.textContent = newScore

    const row = el?.closest('.student-hymn-row')
    if (row) {
      const btns = row.querySelectorAll('.stepper-btn')
      if (btns[0]) btns[0].disabled = newScore <= 0
      if (btns[1]) btns[1].disabled = newScore >= config.maxScore
    }

    const listContainer = document.querySelector(`.students-hymn-list[data-hymn-target="${hymnId}"]`)
    if (listContainer) {
      let statusEl = listContainer.querySelector('.save-status-msg')
      if (!statusEl) {
        statusEl = document.createElement('span')
        statusEl.className = 'save-status-msg'
        statusEl.style.marginRight = '10px'
        statusEl.style.color = '#f43f5e'
        const container = listContainer.querySelector('.hymn-save-container')
        if (container) container.prepend(statusEl)
      }
      statusEl.innerText = '⚠️ لم يتم الحفظ بعد'
    }

    Store.debounce(`hymn-save-${hymnId}`, () => {
      const listContainer = document.querySelector(`.students-hymn-list[data-hymn-target="${hymnId}"]`)
      saveSingleHymn(hymnId, listContainer, true)
    }, 1500)
  },
}

async function saveSingleHymn(hymnId, listContainer, isAuto) {
  const currentUser = Auth.currentUser()
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'member')) return
  if (window._leaderboardWritesBlocked) return

  const studentRows = listContainer.querySelectorAll('.student-hymn-row')
  const updatesPayload = {}
  studentRows.forEach(row => {
    const studentId = row.getAttribute('data-student-id')
    const scoreInput = row.querySelector('.hymn-score-value')
    if (studentId && scoreInput) {
      const finalScore = parseInt(scoreInput.innerText || scoreInput.value || 0, 10)
      const user = (Store._data.users || []).find(u => u.id === studentId)
      if (user) {
        if (!user.hymns) user.hymns = {}
        user.hymns[hymnId] = finalScore
      }
      updatesPayload[studentId] = isNaN(finalScore) ? 0 : finalScore
    }
  })

  try {
    const promises = Object.entries(updatesPayload).map(async ([studentId, score]) => {
      const studentRef = firebase.database().ref(`ithopiia/users/${studentId}`)
      const snapshot = await studentRef.once('value')
      const studentData = snapshot.val() || {}
      let currentTotal = parseInt(studentData.cumulativePoints || 0, 10)
      let oldHymnScore = parseInt((studentData.hymns && studentData.hymns[hymnId]) || 0, 10)
      let calculatedNewTotal = currentTotal - oldHymnScore + score
      await studentRef.update({
        [`hymns/${hymnId}`]: score,
        cumulativePoints: calculatedNewTotal
      })
    })
    await Promise.all(promises)
    Store._recalcCumulative()
    Object.keys(updatesPayload).forEach(studentId => {
      const container = document.querySelector(`[data-student-container-id="${studentId}"]`)
      if (container) {
        const totalEl = container.querySelector('.global-total-score-value')
        if (totalEl) {
          const user = (Store._data.users || []).find(u => u.id === studentId)
          if (user) totalEl.innerText = user.cumulativePoints || 0
        }
      }
    })
    let statusEl = listContainer.querySelector('.save-status-msg')
    if (!statusEl) {
      statusEl = document.createElement('span')
      statusEl.className = 'save-status-msg'
      statusEl.style.marginRight = '10px'
      const container = listContainer.querySelector('.hymn-save-container')
      if (container) container.prepend(statusEl)
    }
    statusEl.style.color = '#34d399'
    statusEl.innerText = 'تم الحفظ بنجاح ✅'
    setTimeout(() => { if (statusEl.parentNode) statusEl.remove() }, isAuto ? 2000 : 3000)
  } catch (err) {
    console.error('Hymn save failed:', err)
    let statusEl = listContainer.querySelector('.save-status-msg')
    if (!statusEl) {
      statusEl = document.createElement('span')
      statusEl.className = 'save-status-msg'
      statusEl.style.marginRight = '10px'
      const container = listContainer.querySelector('.hymn-save-container')
      if (container) container.prepend(statusEl)
    }
    statusEl.style.color = '#f43f5e'
    statusEl.innerText = '⚠️ فشل الحفظ'
  }
}

async function saveHymnScoresToDatabase(hymnId, updatesPayload) {
  const currentUser = Auth.currentUser()
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'member')) return
  if (window._leaderboardWritesBlocked) return

  Object.keys(updatesPayload).forEach(studentId => {
    const score = updatesPayload[studentId]
    const user = (Store._data.users || []).find(u => u.id === studentId)
    if (user) {
      if (!user.hymns) user.hymns = {}
      user.hymns[hymnId] = score
    }
  })

  try {
    const promises = Object.entries(updatesPayload).map(async ([studentId, score]) => {
      const studentRef = firebase.database().ref(`ithopiia/users/${studentId}`)
      const snapshot = await studentRef.once('value')
      const studentData = snapshot.val() || {}
      let currentTotal = parseInt(studentData.cumulativePoints || 0, 10)
      let oldHymnScore = parseInt((studentData.hymns && studentData.hymns[hymnId]) || 0, 10)
      let calculatedNewTotal = currentTotal - oldHymnScore + score
      await studentRef.update({
        [`hymns/${hymnId}`]: score,
        cumulativePoints: calculatedNewTotal
      })
    })
    await Promise.all(promises)
    Store._recalcCumulative()
  } catch (err) {
    console.error('Hymn save failed:', err)
  }
}

document.addEventListener('click', function(e) {
  const card = e.target.closest('.hymn-card')
  if (card) {
    const hymnId = card.dataset.hymnId
    if (hymnId) Hymns.toggleHymn(hymnId)
    return
  }
})

document.addEventListener('click', async function(e) {
  const saveBtn = e.target.closest('.hymn-save-btn')
  if (!saveBtn) return
  e.preventDefault()

  const listContainer = saveBtn.closest('.students-hymn-list')
  if (!listContainer) {
    console.error('Could not find student list container.')
    return
  }

  const hymnId = listContainer.getAttribute('data-hymn-target')

  const updatesPayload = {}

  const studentRows = document.querySelectorAll(`.students-hymn-list[data-hymn-target="${hymnId}"] .student-hymn-row`)

  if (studentRows.length === 0) {
    console.error("No student rows found under container for:", hymnId)
    return
  }

  studentRows.forEach(row => {
    const studentId = row.getAttribute('data-student-id')

    const counterElement = row.querySelector('.hymn-score-value, .counter-num, .score-value, .counter-value, span[class*="count"]')

    let score = 0
    if (counterElement) {
      score = parseInt(counterElement.innerText || counterElement.textContent || 0, 10)
    } else {
      const dynamicSpan = Array.from(row.querySelectorAll('span')).find(el => !isNaN(parseInt(el.innerText, 10)))
      if (dynamicSpan) score = parseInt(dynamicSpan.innerText, 10)
    }

    if (studentId) {
      updatesPayload[studentId] = isNaN(score) ? 0 : score
    }
  })

  console.log("CRITICAL - Executing Firebase Sync with verified payload:", updatesPayload)

  let statusEl = listContainer.querySelector('.save-status-msg')
  if (!statusEl) {
    statusEl = document.createElement('span')
    statusEl.className = 'save-status-msg'
    statusEl.style.marginRight = '10px'
    const container = listContainer.querySelector('.hymn-save-container')
    if (container) container.prepend(statusEl)
  }
  statusEl.style.color = '#f43f5e'
  statusEl.innerText = '⏳ جاري الحفظ...'

  try {
    const promises = Object.entries(updatesPayload).map(async ([studentId, score]) => {
      const studentRef = firebase.database().ref(`ithopiia/users/${studentId}`)

      const snapshot = await studentRef.once('value')
      const studentData = snapshot.val() || {}

      let currentTotal = parseInt(studentData.cumulativePoints || 0, 10)
      let oldHymnScore = parseInt((studentData.hymns && studentData.hymns[hymnId]) || 0, 10)

      let calculatedNewTotal = currentTotal - oldHymnScore + score

      await studentRef.update({
        [`hymns/${hymnId}`]: score,
        cumulativePoints: calculatedNewTotal
      })
    })

    await Promise.all(promises)

    statusEl.style.color = '#34d399'
    statusEl.innerText = "تم الحفظ والتثبيت في السيرفر بنجاح ✅"
    setTimeout(() => statusEl.remove(), 4000)
  } catch (dbError) {
    console.error("Firebase Sync Failed:", dbError)
    statusEl.style.color = '#f43f5e'
    statusEl.innerText = "⚠️ فشل الاتصال بالسيرفر، راجع الـ Console"
  }
})

async function saveHymnAndTotalToDatabase(studentId, hymnId, newHymnScore, newGlobalTotal) {
  try {
    await firebase.database().ref(`ithopiia/users/${studentId}/cumulativePoints`).set(newGlobalTotal)
    console.log(`Database synced: Student ${studentId} cumulativePoints = ${newGlobalTotal}`)
  } catch (err) {
    console.error('Failed to sync cumulativePoints for', studentId, err)
  }
}