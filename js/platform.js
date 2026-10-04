// Thin browser adapter for SHA-Platform. It owns identity, commitment rotation and money conversion.
class ShaPlinkoApi {
  constructor() {
    const query = new URLSearchParams(location.search);
    const fragment = new URLSearchParams(location.hash.slice(1));
    const cloudflareDevelopmentApi = 'https://sha-platform-dev.sha-platform.workers.dev/api/v1';
    const storedApi = localStorage.getItem('plinko.api');
    const migratedApi = storedApi === 'http://localhost:3000/api/v1' ? null : storedApi;
    this.baseUrl = (query.get('api') || migratedApi || cloudflareDevelopmentApi).replace(/\/$/, '');
    this.developmentMode = query.get('dev') === '1' || this.baseUrl === cloudflareDevelopmentApi;
    localStorage.setItem('plinko.api', this.baseUrl);
    this.playerId = localStorage.getItem('plinko.playerId') || `demo-${crypto.randomUUID()}`;
    this.launchToken = fragment.get('token') || sessionStorage.getItem('plinko.launchToken');
    if (this.launchToken) {
      sessionStorage.setItem('plinko.launchToken', this.launchToken);
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    }
    this.clientSeed = localStorage.getItem('plinko.clientSeed') || crypto.randomUUID();
    localStorage.setItem('plinko.playerId', this.playerId);
    localStorage.setItem('plinko.clientSeed', this.clientSeed);
    this.commitment = null;
  }

  async connect() {
    try {
      return await this.openSession();
    } catch (error) {
      if (error.status !== 404 || !this.developmentMode) throw error;
      await this.request(`/dev/players/${encodeURIComponent(this.playerId)}/bootstrap`, {
        method: 'POST',
        body: JSON.stringify({ initial_units: '1000000' }),
      });
      return this.openSession();
    }
  }

  async openSession() {
    const session = await this.request('/games/plinko/session', { method: 'POST', body: '{}' });
    this.commitment = session.commitment;
    return session;
  }

  async placeBet({ amount, risk, rows }) {
    if (!this.commitment) throw new Error('平台連線尚未完成');
    const response = await this.request('/games/plinko/bets', {
      method: 'POST',
      body: JSON.stringify({
        request_id: crypto.randomUUID(),
        commitment_id: this.commitment.id,
        client_seed: this.clientSeed,
        wager: { units: String(Math.round(amount * 1000)), currency: 'TWD', scale: 3 },
        risk,
        rows,
      }),
    });
    this.commitment = response.next_commitment;
    return response;
  }

  roomSnapshot() {
    return this.request('/rooms/plinko/snapshot', { method: 'GET' });
  }

  moneyValue(money) {
    return Number(money.units) / (10 ** money.scale);
  }

  verificationUrl(round) {
    const token = round?.fairness?.proof_token;
    if (!round?.round_id || !token) return null;
    const url = new URL('https://sha-fairness-dev.pages.dev/');
    url.searchParams.set('game_id', 'plinko');
    url.searchParams.set('round_id', round.round_id);
    url.searchParams.set('token', token);
    return url.href;
  }

  async request(path, options) {
    const identity = this.launchToken
      ? { authorization: `Bearer ${this.launchToken}` }
      : { 'x-player-id': this.playerId };
    const response = await fetch(this.baseUrl + path, {
      ...options,
      headers: { 'content-type': 'application/json', ...identity, ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error?.message || `平台錯誤 (${response.status})`);
      error.status = response.status;
      error.code = payload.error?.code;
      throw error;
    }
    return payload;
  }
}
