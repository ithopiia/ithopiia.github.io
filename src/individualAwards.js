window.INDIVIDUAL_AWARDS_CONFIG = [
  { id: 'show_tasweer',  name: 'عرض التصوير',     icon: '🎬', color: '#f43f5e' },
  { id: 'show_elhokam',  name: 'عرض قدام الحكام',  icon: '⚖️', color: '#8b5cf6' },
  { id: 'show_umbo',     name: 'عرض كوم أمبو',     icon: '🎭', color: '#f59e0b' },
  { id: 'show_aswan6',   name: 'عرض 6 أسوان',     icon: '🏙️', color: '#38bdf8' },
  { id: 'show_aswan7',   name: 'عرض 7 أسوان',     icon: '🏛️', color: '#34d399' },
  { id: 'show_nakeda',   name: 'عرض نقادة',       icon: '🎪', color: '#fb923c' },
]

const AWARD_POINTS = 10

window.IndividualAwards = {
  _expandedShow: null,

  getAwardedUsers(showId) {
    const awards = (Store._data && Store._data.individualAwards) || []
    return awards.filter(a => a.showId === showId && a.awarded)
  },

  getUserAwards(userId) {
    const awards = (Store._data && Store._data.individualAwards) || []
    return awards.filter(a => a.userId === userId && a.awarded).map(a => a.showId)
  },

  getUserTotalAwardPoints(userId) {
    const awards = (Store._data && Store._data.individualAwards) || []
    return awards.filter(a => a.userId === userId && a.awarded)
      .reduce((sum, a) => sum + (parseInt(a.points, 10) || 0), 0)
  },

  isUserAwarded(userId, showId) {
    const awards = (Store._data && Store._data.individualAwards) || []
    return awards.some(a => a.userId === userId && a.showId === showId && a.awarded)
  },

  render() {
    const el = document.getElementById('admin-tab-individual-awards')
    if (!el) return

    const users = (Store.get('users') || [])
      .filter(u => u.status === 'approved' && u.role !== 'admin')
      .sort((a, b) => (b.cumulativePoints || 0) - (a.cumulativePoints || 0))

    const totalAwardsGiven = INDIVIDUAL_AWARDS_CONFIG.reduce((sum, show) => {
      return sum + this.getAwardedUsers(show.id).length
    }, 0)

    let html = `
    <div class="awards-panel-wrapper">
      <div class="awards-header">
        <div class="awards-header-stat">
          <span class="awards-header-value">${totalAwardsGiven}</span>
          <span class="awards-header-label">جوائز مُنحت</span>
        </div>
        <div class="awards-header-stat">
          <span class="awards-header-value">${totalAwardsGiven * AWARD_POINTS}</span>
          <span class="awards-header-label">نقاط فردية</span>
        </div>
      </div>
    `

    INDIVIDUAL_AWARDS_CONFIG.forEach(show => {
      const isExpanded = this._expandedShow === show.id
      const awarded = this.getAwardedUsers(show.id)
      const awardedCount = awarded.length
      const colorClass = 'award-show-' + show.id

      html += `
      <div class="award-show-card ${colorClass} ${isExpanded ? 'expanded' : ''}" data-show-id="${show.id}">
        <span class="award-card-title">${show.icon} ${show.name}</span>
        <div class="award-card-meta">
          <span class="award-count-badge">${awardedCount}/${users.length}</span>
          <span class="award-points-badge">+${AWARD_POINTS} لكل مُختار</span>
          <span class="award-card-arrow">${isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>
      <div class="award-student-list ${isExpanded ? 'open' : ''}" data-show-target="${show.id}">
        ${users.length === 0 ? '<p class="text-muted" style="text-align:center;padding:16px">لا يوجد طلاب معتمدون</p>' : ''}
        ${users.map((u, i) => {
          const isAwarded = this.isUserAwarded(u.id, show.id)
          return `
          <div class="award-student-row ${isAwarded ? 'row-awarded' : ''}" data-user-id="${u.id}">
            <span class="award-student-name">${i + 1}. ${u.fullName}</span>
            <button class="award-toggle-btn ${isAwarded ? 'awarded' : ''}"
                    onclick="IndividualAwards.toggleAward('${show.id}', '${u.id}')"
                    data-show-id="${show.id}" data-user-id="${u.id}">
              ${isAwarded ? '🏆 تم التكريم' : 'ترشيح'}
            </button>
          </div>
          `
        }).join('')}
      </div>`
    })

    html += '</div>'
    el.innerHTML = html
  },

  toggleShow(showId) {
    const isSame = this._expandedShow === showId
    this._expandedShow = isSame ? null : showId

    document.querySelectorAll('.award-student-list').forEach(el => {
      el.classList.remove('open')
    })
    document.querySelectorAll('.award-show-card').forEach(el => {
      el.classList.remove('expanded')
      const arrow = el.querySelector('.award-card-arrow')
      if (arrow) arrow.textContent = '▼'
    })

    if (!isSame) {
      const list = document.querySelector(`.award-student-list[data-show-target="${showId}"]`)
      if (list) list.classList.add('open')
      const card = document.querySelector(`.award-show-card[data-show-id="${showId}"]`)
      if (card) {
        card.classList.add('expanded')
        const arrow = card.querySelector('.award-card-arrow')
        if (arrow) arrow.textContent = '▲'
      }
    }
  },

  async toggleAward(showId, userId) {
    const currentUser = Auth.currentUser()
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'member')) return

    const isAwarded = this.isUserAwarded(userId, showId)

    if (isAwarded) {
      await this._removeAward(userId, showId)
    } else {
      await this._grantAward(userId, showId)
    }

    Store._recalcCumulative()
    this.render()
  },

  async _grantAward(userId, showId) {
    const user = (Store._data.users || []).find(u => u.id === userId)
    if (!user) return

    const userRef = firebase.database().ref(`ithopiia/users/${userId}`)
    const snapshot = await userRef.once('value')
    const userData = snapshot.val() || {}
    let currentTotal = parseInt(userData.cumulativePoints || 0, 10)

    const db = firebase.database()
    await Promise.all([
      db.ref(`ithopiia/individualAwards/${showId}/${userId}`).set({
        awarded: true,
        awardedAt: Date.now(),
        points: AWARD_POINTS,
      }),
      db.ref(`ithopiia/users/${userId}/individualAwards/${showId}`).set(AWARD_POINTS),
      db.ref(`ithopiia/users/${userId}/cumulativePoints`).set(currentTotal + AWARD_POINTS),
    ])

    const awards = Store._data.individualAwards || []
    const existing = awards.find(a => a.userId === userId && a.showId === showId)
    if (existing) {
      existing.awarded = true
      existing.awardedAt = Date.now()
      existing.points = AWARD_POINTS
    } else {
      awards.push({ userId, showId, awarded: true, awardedAt: Date.now(), points: AWARD_POINTS })
      Store._data.individualAwards = awards
    }

    user.cumulativePoints = currentTotal + AWARD_POINTS
    if (!user.individualAwards) user.individualAwards = {}
    user.individualAwards[showId] = AWARD_POINTS
  },

  async _removeAward(userId, showId) {
    const user = (Store._data.users || []).find(u => u.id === userId)
    if (!user) return

    const userRef = firebase.database().ref(`ithopiia/users/${userId}`)
    const snapshot = await userRef.once('value')
    const userData = snapshot.val() || {}
    let currentTotal = parseInt(userData.cumulativePoints || 0, 10)

    const db = firebase.database()
    await Promise.all([
      db.ref(`ithopiia/individualAwards/${showId}/${userId}`).remove(),
      db.ref(`ithopiia/users/${userId}/individualAwards/${showId}`).remove(),
      db.ref(`ithopiia/users/${userId}/cumulativePoints`).set(Math.max(0, currentTotal - AWARD_POINTS)),
    ])

    Store._data.individualAwards = (Store._data.individualAwards || [])
      .filter(a => !(a.userId === userId && a.showId === showId))

    user.cumulativePoints = Math.max(0, currentTotal - AWARD_POINTS)
    if (user.individualAwards) {
      delete user.individualAwards[showId]
    }
  },
}

document.addEventListener('click', function(e) {
  const card = e.target.closest('.award-show-card')
  if (card) {
    const showId = card.dataset.showId
    if (showId) IndividualAwards.toggleShow(showId)
    return
  }
})
