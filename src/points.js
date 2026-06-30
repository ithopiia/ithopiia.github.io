
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
    const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser() : null
    const canWrite = currentUser && (currentUser.role === 'admin' || currentUser.role === 'member') && !window._leaderboardWritesBlocked
    if (canWrite) {
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
    }

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
      .filter(p => p.userId === userId && p.saved !== false)
      .reduce((sum, p) => sum + (p.finalScore ?? p.basePoints), 0)
  },

  getUserPointsBreakdown(userId) {
    const all = Store.get('dailyPoints') || []
    const saved = all.filter(p => p.userId === userId && p.saved !== false)
    var baseTotal = 0
    var bonusTotal = 0
    var minusTotal = 0
    saved.forEach(function (p) {
      var ev = Number(p.evaluationScore) || 0
      var mb = Number(p.manualBonus) || 0
      baseTotal += ev
      if (mb > 0) bonusTotal += mb
      else if (mb < 0) minusTotal += Math.abs(mb)
    })
    return {
      basePoints: baseTotal,
      totalBonus: bonusTotal,
      totalMinus: minusTotal,
      grandTotal: baseTotal + bonusTotal - minusTotal
    }
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
    return today.length > 0 && today.every(p => p.saved !== false)
  },

  claim(userId) {
    this.ensureTodayPoints(userId)
    return { ok: true }
  },

  getMonths() {
    const all = Store.get('dailyPoints') || []
    const months = new Set()
    all.forEach(p => {
      if (p.saved !== false && p.dateKey) {
        months.add(p.dateKey.substring(0, 7))
      }
    })
    return Array.from(months).sort().reverse()
  },

  getMonthlyPoints(userId, yearMonth) {
    const all = Store.get('dailyPoints') || []
    return all
      .filter(p => p.userId === userId && p.saved !== false && p.dateKey && p.dateKey.startsWith(yearMonth))
      .reduce((sum, p) => sum + (p.finalScore ?? 0), 0)
  },

  getMonthlyLeaderboard(yearMonth, genderFilter) {
    let users = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')
    if (genderFilter) {
      users = users.filter(u => u.gender === genderFilter)
    }
    const standings = users.map(u => ({
      userId: u.id,
      fullName: u.fullName,
      gender: u.gender,
      total: this.getMonthlyPoints(u.id, yearMonth),
      rooms: u.rooms,
    }))
    standings.sort((a, b) => b.total - a.total)
    return standings.map((s, i) => ({ ...s, rank: i + 1 }))
  },

  getMonthName(yearMonth) {
    const names = {
      '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'إبريل',
      '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
      '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
    }
    const m = yearMonth.split('-')[1]
    return names[m] || m
  },
}

window.Points = Points
