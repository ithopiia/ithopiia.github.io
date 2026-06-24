window.Timer = {
  _interval: null,
  _remaining: 0,
  _onTick: null,
  _onComplete: null,

  start(hours, onTick, onComplete) {
    this.stop()
    this._remaining = hours * 3600
    this._onTick = onTick
    this._onComplete = onComplete
    if (this._onTick) this._onTick(this._remaining)
    this._interval = setInterval(() => {
      this._remaining--
      if (this._remaining <= 0) {
        this.stop()
        if (this._onComplete) this._onComplete()
      }
      if (this._onTick) this._onTick(this._remaining)
    }, 1000)
  },

  startDayTimer(onTick, onComplete) {
    const now = new Date()
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)
    this._remaining = Math.floor((endOfDay - now) / 1000)
    this._onTick = onTick
    this._onComplete = onComplete
    if (this._onTick) this._onTick(this._remaining)
    this._interval = setInterval(() => {
      this._remaining--
      if (this._remaining <= 0) {
        this.stop()
        if (this._onComplete) this._onComplete()
      }
      if (this._onTick) this._onTick(this._remaining)
    }, 1000)
  },

  stop() {
    if (this._interval) { clearInterval(this._interval); this._interval = null }
  },

  getRemaining() { return this._remaining },

  formatTime(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  },
}
