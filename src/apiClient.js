window.ApiClient = {
  async _token() {
    try {
      const user = firebase.auth().currentUser
      return user ? await user.getIdToken() : null
    } catch (e) {
      return null
    }
  },

  async request(method, path, body, params) {
    let url = CONFIG.apiBaseUrl + path
    if (params && typeof params === 'object') {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v)
      })
      const q = qs.toString()
      if (q) url += '?' + q
    }

    const token = await this._token()
    const res = await fetch(url, {
      method,
      headers: Object.assign(
        { 'Accept': 'application/json' },
        body !== undefined ? { 'Content-Type': 'application/json' } : {},
        token ? { 'Authorization': 'Bearer ' + token } : {}
      ),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    let data = {}
    try { data = await res.json() } catch (e) {}

    if (!res.ok) {
      const err = new Error(data.error || ('API error ' + res.status))
      err.status = res.status
      err.data = data
      throw err
    }
    return data
  },

  getLeaderboard(params) {
    return this.request('GET', '/leaderboard', undefined, params)
  },

  saveEvaluation(payload) {
    return this.request('POST', '/evaluations/save', payload)
  },

  toggleAward(showId, userId) {
    return this.request('POST', '/awards/toggle', { showId, userId })
  },

  getMyProfile() {
    return this.request('GET', '/auth/me')
  },

  getUsers() {
    return this.request('GET', '/users')
  },

  getUser(userId) {
    return this.request('GET', '/users/' + encodeURIComponent(userId))
  },

  getAwards() {
    return this.request('GET', '/awards')
  }
}
