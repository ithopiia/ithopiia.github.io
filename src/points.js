
function calcEntryScore(entry) {
  if (entry == null) return 0
  if (entry.finalScore != null) {
    const n = Number(entry.finalScore)
    if (!isNaN(n)) return n
  }
  const base = entry.basePoints != null ? (Number(entry.basePoints) || 0) : 0
  const evalScore = Number(entry.evaluationScore) || 0
  const bonus = Number(entry.manualBonus) || 0
  const composed = base + evalScore + bonus
  if (composed !== 0) return composed
  const oldBonus = Number(entry.bonus) || 0
  const oldMinus = Number(entry.minus) || 0
  if (base !== 0 || oldBonus !== 0 || oldMinus !== 0) return base + oldBonus - oldMinus
  const total = Number(entry.total) || 0
  const points = Number(entry.points) || 0
  const score = Number(entry.score) || 0
  if (total !== 0) return total
  if (points !== 0) return points
  if (score !== 0) return score
  return 0
}

const Points = {
  getTodayKey() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  getCurrentYearMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  },

  getDateKey(date) {
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  getPrimaryRoomId(userId) {
    const user = (Store.get('users') || []).find(u => u.id === userId)
    const rooms = (user && user.rooms) || []
    return rooms.length > 0 ? rooms[0] : null
  },

  resolveRoomPath(roomId) {
    return roomId || '_unassigned'
  },

  _effectiveRoomId(p, roomId) {
    if (p.roomId) return p.roomId
    const primary = this.getPrimaryRoomId(p.userId)
    if (primary) return primary
    return roomId || null
  },

  _matchRoom(p, roomId) {
    if (roomId === undefined) return true
    return this._effectiveRoomId(p, roomId) === (roomId || null)
  },

  isUserInRoom(u, roomId) {
    if (!roomId) return true
    const userRooms = (u && u.rooms) || []
    if (userRooms.includes(roomId)) return true
    if (userRooms.length === 0) return true
    return false
  },

  ensureTodayPoints(userId, roomId) {
    if (roomId === undefined || roomId === null) roomId = this.getPrimaryRoomId(userId)
    const key = this.getTodayKey()
    const all = Store.get('dailyPoints') || []
    const existing = all.find(p => p.userId === userId && p.dateKey === key && this._matchRoom(p, roomId))
    if (existing) return existing

    const entry = {
      userId,
      dateKey: key,
      roomId,
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
      Store.writePath(`dailyPoints/${key}/${this.resolveRoomPath(roomId)}/${userId}`, {
        basePoints: entry.basePoints,
        evaluationScore: entry.evaluationScore,
        manualBonus: entry.manualBonus,
        finalScore: entry.finalScore,
        overwritten: entry.overwritten,
        adminNotes: entry.adminNotes,
        saved: entry.saved,
        roomId,
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

    users.forEach(u => {
      const rooms = (u.rooms && u.rooms.length) ? u.rooms : [null]
      rooms.forEach(roomId => this.ensureTodayPoints(u.id, roomId))
    })
  },

  getUserTodayPoints(userId, roomId) {
    if (roomId === undefined || roomId === null) roomId = this.getPrimaryRoomId(userId)
    return this.ensureTodayPoints(userId, roomId)
  },

  getUserDailyPoints(userId, roomId) {
    if (roomId === undefined || roomId === null) roomId = this.getPrimaryRoomId(userId)
    const all = Store.get('dailyPoints') || []
    return all
      .filter(p => p.userId === userId && this._matchRoom(p, roomId))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  },

  getUserTotalPoints(userId, roomId) {
    const all = Store.get('dailyPoints') || []
    return all
      .filter(p => p.userId === userId && this._matchRoom(p, roomId))
      .reduce((sum, p) => sum + calcEntryScore(p), 0)
  },

  getUserPointsBreakdown(userId, roomId) {
    const all = Store.get('dailyPoints') || []
    const saved = all.filter(p => p.userId === userId && this._matchRoom(p, roomId))
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

  getAllUsersTotalPoints(roomId) {
    let users = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')
    if (roomId) {
      users = users.filter(u => this.isUserInRoom(u, roomId))
    }
    return users.map(u => ({
      userId: u.id,
      fullName: u.fullName,
      gender: u.gender,
      total: this.getUserTotalPoints(u.id, roomId),
      rooms: u.rooms,
    }))
  },

  getLeaderboard(roomId, genderFilter) {
    let standings = this.getAllUsersTotalPoints(roomId)
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
    const currentMonth = this.getCurrentYearMonth()
    const months = new Set()
    all.forEach(p => {
      if (p.dateKey) {
        const m = p.dateKey.substring(0, 7)
        if (m <= currentMonth) months.add(m)
      }
    })
    months.add(currentMonth)
    return Array.from(months).sort().reverse()
  },

  getMonthlyPoints(userId, yearMonth, roomId) {
    const all = Store.get('dailyPoints') || []
    return all
      .filter(p => p.userId === userId && p.dateKey && p.dateKey.startsWith(yearMonth) && this._matchRoom(p, roomId))
      .reduce((s, p) => s + calcEntryScore(p), 0)
  },

  getMonthlyLeaderboard(roomId, yearMonth, genderFilter) {
    let users = (Store.get('users') || []).filter(u => u.status === 'approved' && u.role !== 'admin')
    if (roomId) {
      users = users.filter(u => this.isUserInRoom(u, roomId))
    }
    if (genderFilter) {
      users = users.filter(u => u.gender === genderFilter)
    }
    const standings = users.map(u => ({
      userId: u.id,
      fullName: u.fullName,
      gender: u.gender,
      total: this.getMonthlyPoints(u.id, yearMonth, roomId),
      rooms: u.rooms,
    }))
    standings.sort((a, b) => b.total - a.total)
    return standings
      .filter(s => s.total > 0)
      .map((s, i) => ({ ...s, rank: i + 1 }))
  },

  _buildTotalsCache() {
    const users = Store.get('users') || []
    const dp = Store.get('dailyPoints') || []
    const totals = {}
    const init = () => ({ overall: 0, rooms: {}, months: {} })
    dp.forEach(p => {
      if (!p || !p.userId || !p.dateKey) return
      const score = calcEntryScore(p)
      const room = p.roomId || this.getPrimaryRoomId(p.userId) || null
      const month = p.dateKey.substring(0, 7)
      const T = totals[p.userId] || (totals[p.userId] = init())
      T.overall += score
      T.rooms[room] = (T.rooms[room] || 0) + score
      const M = T.months[month] || (T.months[month] = { overall: 0, rooms: {} })
      M.overall += score
      M.rooms[room] = (M.rooms[room] || 0) + score
    })
    users.forEach(u => {
      if (u.hymns) {
        const T = totals[u.id] || (totals[u.id] = init())
        Object.values(u.hymns).forEach(score => {
          T.overall += (parseInt(score, 10) || 0)
        })
      }
    })
    const indAwards = (Store._data && Store._data.individualAwards) || []
    indAwards.forEach(a => {
      if (a && a.userId && a.awarded) {
        const T = totals[a.userId] || (totals[a.userId] = init())
        T.overall += (parseInt(a.points, 10) || 0)
      }
    })
    return totals
  },

  recalculateLeaderboardTotals() {
    if (Store._syncLock) return Store._totalsCache || {}
    Store._syncLock = true
    try {
      Store._recalcCumulative()
      Store._totalsCache = this._buildTotalsCache()
    } finally {
      Store._syncLock = false
    }
    return Store._totalsCache || {}
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
