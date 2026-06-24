window.Leaderboard = {
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

    const sorted = [...approved].sort((a, b) => (b.cumulativePoints || 0) - (a.cumulativePoints || 0))

    if (!sorted.length) return '<p class="text-muted">لا يوجد أعضاء بعد.</p>'

    return `
      <input type="text" class="lb-search" placeholder="بحث..." oninput="Leaderboard.filter(this)">
      <div class="lb-list">
        ${sorted.map((u, i) => `
          <div class="leaderboard-item ${u.id === currentUser?.id ? 'highlight' : ''}" data-name="${u.fullName.toLowerCase()}">
            <span class="rank">${i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : '#' + (i + 1)}</span>
            <span class="name">${u.fullName} ${u.room ? '<span class="text-muted">(' + u.room + ')</span>' : ''}</span>
            <span class="points">${u.cumulativePoints || 0} نقطة</span>
          </div>
        `).join('')}
      </div>`
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
