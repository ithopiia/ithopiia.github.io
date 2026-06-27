
const Points = {
  getTodayKey() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  getDateKey(date) {
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  ensureTodayPoints(userId) {
    const key = this.getTodayKey()
    const all = Store.get('dailyPoints') || []
    const existing = all.find(p => p.userId === userId && p.dateKey === key)
    if (existing) return existing

    const entry = {
      userId,
      dateKey: key,
      date: new Date().toISOString(),
      basePoints: CONFIG.pointsPerDay,
      evaluationScore: 0,
      manualBonus: 0,
      overwritten: false,
      finalScore: CONFIG.pointsPerDay,
      adminNotes: '',
      saved: true,
    }
    Store.writePath(`dailyPoints/${key}/${userId}`, {
      basePoints: entry.basePoints,
      evaluationScore: entry.evaluationScore,
      manualBonus: entry.manualBonus,
      finalScore: entry.finalScore,
      overwritten: entry.overwritten,
      adminNotes: entry.adminNotes,
      saved: entry.saved,
      date: entry.date,
    })

    return entry
  },

  grantDailyPoints() {
    const users = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')
    const campaignActive = Store.get('settings.campaignActive')
    const lastDay = Store.get('settings.lastDayOfKaraza')
    const today = this.getTodayKey()

    if (!campaignActive) return
    if (lastDay && today > lastDay) return

    users.forEach(u => this.ensureTodayPoints(u.id))
  },

  getUserTodayPoints(userId) {
    return this.ensureTodayPoints(userId)
  },

  getUserDailyPoints(userId) {
    const all = Store.get('dailyPoints') || []
    return all
      .filter(p => p.userId === userId)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  },

  getUserTotalPoints(userId) {
    const all = Store.get('dailyPoints') || []
    return all
      .filter(p => p.userId === userId && p.saved)
      .reduce((sum, p) => sum + (p.finalScore ?? p.basePoints), 0)
  },

  getAllUsersTotalPoints() {
    const users = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')
    return users.map(u => ({
      userId: u.id,
      fullName: u.fullName,
      gender: u.gender,
      total: this.getUserTotalPoints(u.id),
      rooms: u.rooms,
    }))
  },

  getLeaderboard(genderFilter) {
    let standings = this.getAllUsersTotalPoints()
    if (genderFilter) {
      standings = standings.filter(s => s.gender === genderFilter)
    }
    standings.sort((a, b) => b.total - a.total)
    return standings.map((s, i) => ({ ...s, rank: i + 1 }))
  },

  updateDailyPoints(userId, dateKey, updates) {
    const entry = Store.update(
      'dailyPoints',
      p => p.userId === userId && p.dateKey === dateKey,
      updates
    )
    if (entry) {
      const base = entry.overwritten ? entry.basePoints : CONFIG.pointsPerDay
      entry.finalScore = (base || 0) + (entry.evaluationScore || 0) + (entry.manualBonus || 0)
      Store.update(
        'dailyPoints',
        p => p.userId === userId && p.dateKey === dateKey,
        { finalScore: entry.finalScore }
      )
    }
    return entry
  },

  saveDay(dateKey) {
    const all = Store.get('dailyPoints') || []
    all.forEach(p => {
      if (p.dateKey === dateKey && !p.saved) {
        const base = p.overwritten ? p.basePoints : CONFIG.pointsPerDay
        p.finalScore = (base || 0) + (p.evaluationScore || 0) + (p.manualBonus || 0)
        p.saved = true
      }
    })
    Store.set('dailyPoints', all)
  },

  isDaySaved(dateKey) {
    const all = Store.get('dailyPoints') || []
    const today = all.filter(p => p.dateKey === dateKey)
    return today.length > 0 && today.every(p => p.saved)
  },

  claim(userId) {
    this.ensureTodayPoints(userId)
    return { ok: true }
  },
}

window.Points = Points
