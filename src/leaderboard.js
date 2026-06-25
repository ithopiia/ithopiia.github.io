window.Leaderboard = {
  _activeGender: 'all',

  render() {
    const users = Store.get('users') || []
    const currentUser = Auth.currentUser()
    const isHiddenAdmin = Auth.isHiddenAdmin()

    let approved = users.filter(u => u.status === 'approved' && u.role !== 'admin')

    const isMember = currentUser?.role === 'member'
    if (!isHiddenAdmin && !isMember && currentUser) {
      const userRooms = currentUser.rooms || []
      approved = approved.filter(u => {
        if (u.id === currentUser.id) return true
        const otherRooms = u.rooms || []
        return otherRooms.some(r => userRooms.includes(r))
      })
    }

    const totalMale = approved.filter(u => u.gender === 'male').length
    const totalFemale = approved.filter(u => u.gender === 'female').length

    let filtered = approved
    if (this._activeGender !== 'all') {
      filtered = approved.filter(u => u.gender === this._activeGender)
    }

    const sorted = [...filtered].sort((a, b) => (b.cumulativePoints || 0) - (a.cumulativePoints || 0))

    if (!sorted.length) return '<p class="text-muted">لا يوجد أعضاء بعد.</p>'

    return `
      <div class="gender-tabs">
        <button class="filter-btn ${this._activeGender === 'all' ? 'active' : ''}" onclick="Leaderboard.setGender('all')">الكل (${approved.length})</button>
        <button class="filter-btn ${this._activeGender === 'male' ? 'active' : ''}" onclick="Leaderboard.setGender('male')">الأولاد (${totalMale})</button>
        <button class="filter-btn ${this._activeGender === 'female' ? 'active' : ''}" onclick="Leaderboard.setGender('female')">البنات (${totalFemale})</button>
      </div>
      <input type="text" class="lb-search" placeholder="بحث..." oninput="Leaderboard.filter(this)">
      <div class="lb-list">
        ${sorted.map((u, i) => `
          <div class="leaderboard-item ${u.id === currentUser?.id ? 'highlight' : ''}" data-name="${u.fullName.toLowerCase()}">
            <span class="rank">${i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : '#' + (i + 1)}</span>
            <span class="name"><span class="name-link" onclick="Admin.showUserProfile('${u.id}')">${u.fullName}</span> ${u.room ? '<span class="text-muted">(' + u.room + ')</span>' : ''}</span>
            <span class="points">${u.cumulativePoints || 0} نقطة</span>
          </div>
        `).join('')}
      </div>`
  },

  setGender(gender) {
    this._activeGender = gender
    document.querySelectorAll('#admin-tab-leaderboard, #dash-leaderboard-content').forEach(el => {
      el.innerHTML = this.render()
    })
  },

  filter(input) {
    const q = input.value.toLowerCase()
    const list = input.parentElement.querySelector('.lb-list')
    if (!list) return
    list.querySelectorAll('.leaderboard-item').forEach(item => {
      item.style.display = item.dataset.name.includes(q) ? '' : 'none'
    })
  }
}
