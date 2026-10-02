// Thin browser adapter for SHA-Platform. It owns identity, commitment rotation and money conversion.
class ShaPlinkoApi {
  constructor() {
    const query = new URLSearchParams(location.search);
    this.baseUrl = (query.get('api') || localStorage.getItem('plinko.api') || 'http://localhost:3000/api/v1').replace(/\/$/, '');
    localStorage.setItem('plinko.api', this.baseUrl);
    this.playerId = localStorage.getItem('plinko.playerId') || `demo-${crypto.randomUUID()}`;
    this.clientSeed = localStorage.getItem('plinko.clientSeed') || crypto.randomUUID();
    localStorage.setItem('plinko.playerId', this.playerId);
    localStorage.setItem('plinko.clientSeed', this.clientSeed);
    this.commitment = null;
  }

  async connect() {
    try {
      return await this.openSession();
    } catch (error) {
      const query = new URLSearchParams(location.search);
      if (error.status !== 404 || query.get('dev') !== '1') throw error;
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

  moneyValue(money) {
    return Number(money.units) / (10 ** money.scale);
  }

  async request(path, options) {
    const response = await fetch(this.baseUrl + path, {
      ...options,
      headers: { 'content-type': 'application/json', 'x-player-id': this.playerId, ...(options.headers || {}) },
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
