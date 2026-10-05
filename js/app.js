// Wires the controls, wallet, board and stats together.
(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    balance: $('balance'), balanceValue: $('balanceValue'), back: $('back'), sound: $('sound'),
    boardCard: document.querySelector('.board-card'), tapHint: $('tapHint'), tapHintText: $('tapHintText'),
    marquee: $('marquee'),
    betAmount: $('betAmount'), half: $('half'), double: $('double'),
    risk: $('risk'), rows: $('rows'), numberOfBets: $('numberOfBets'),
    betBtn: $('betBtn'), history: $('history'), toast: $('toast'), verifyRound: $('verifyRound'),
    tabs: document.querySelectorAll('.tab'), controls: document.querySelector('.controls'),
  };

  const HISTORY_SIZE = 6;
  const AUTO_INTERVAL = 280;
  const AUTO_BATCH_SIZE = 10;
  const MAX_PENDING_BETS = 20;
  const BOT_REFRESH_INTERVAL = 30000;
  const platform = new ShaPlinkoApi();

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('plinko.' + key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('plinko.' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
  };

  const settings = store.get('settings', { bet: 1, risk: 'medium', rows: 16 });
  let balance = 0;
  let displayBalance = 0;
  let mode = 'auto';
  let autoRun = null;
  let autoCount = 0;
  let platformReady = false;
  let betInFlight = false;
  let pendingBets = 0;
  let betQueue = Promise.resolve(true);
  let verificationUrl = null;

  applyI18n();
  document.title = t('title');

  // Lobby can pass its own URL back: index.html?return=<lobby url>
  const ret = new URLSearchParams(location.search).get('return');
  if (ret && /^https?:\/\//.test(ret)) els.back.href = ret;

  Plinko.ROWS.forEach((r) => els.rows.add(new Option(r, r)));
  els.rows.value = settings.rows;
  els.risk.value = settings.risk;
  els.betAmount.value = settings.bet.toFixed(2);

  const board = new Board($('board'), onLand, () => Sound.peg());
  const confetti = new Confetti();
  const stats = new LiveStats({
    profit: $('statProfit'), wagered: $('statWagered'),
    wins: $('statWins'), losses: $('statLosses'), chart: $('chart'),
  });
  board.setup(settings.risk, settings.rows);
  renderBalance();
  startMarquee();

  function renderBalance() {
    els.balanceValue.textContent = formatMoney(displayBalance);
  }

  function roundMoney(value) { return Math.round(value * 1000) / 1000; }

  function saveSettings() {
    settings.bet = betValue();
    settings.risk = els.risk.value;
    settings.rows = +els.rows.value;
    store.set('settings', settings);
  }

  function betValue() {
    const v = Math.max(0, parseFloat(els.betAmount.value) || 0);
    return Math.round(v * 100) / 100;
  }

  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  // Risk and rows stay locked while balls are falling or auto play runs, like the reference game.
  function syncLocks() {
    const autoOn = !!autoRun;
    const busy = board.active > 0 || pendingBets > 0 || betInFlight || autoOn;
    els.risk.disabled = busy;
    els.rows.disabled = busy;
    els.betAmount.disabled = els.half.disabled = els.double.disabled = autoOn;
    els.numberOfBets.disabled = autoOn;
    els.tabs.forEach((tab) => { tab.disabled = autoOn; });
    els.betBtn.disabled = !platformReady;
    els.betBtn.classList.toggle('stop', autoOn);
    els.betBtn.textContent = mode === 'manual' ? t('bet') : t(autoOn ? 'stopAuto' : 'startAuto');
    els.tapHint.classList.toggle('show', !autoOn);
    els.tapHintText.textContent = t(mode === 'manual' ? 'tapToBet' : 'tapToAuto');
  }

  // Activity shown here comes from the platform. The browser does not create bot activity.
  function startMarquee() {
    const sep = '　✦　';
    const render = (events = []) => {
      const activity = events.map((event) => `${event.display_name} 投注 ${platform.moneyValue(event.wager).toFixed(2)}`);
      const text = [t('marqueeBrand'), ...activity].join(sep) + sep;
      els.marquee.innerHTML = '';
      for (let i = 0; i < 2; i++) els.marquee.appendChild(document.createElement('span')).textContent = text;
      els.marquee.style.animationDuration = text.length * 0.32 + 's';
    };
    const refresh = async () => {
      try { render((await platform.roomSnapshot()).bot_events); }
      catch (_) { render(); }
    };
    refresh();
    setInterval(refresh, BOT_REFRESH_INTERVAL);
  }

  function queueBet() {
    if (!platformReady) return Promise.resolve(false);
    if (pendingBets >= MAX_PENDING_BETS) {
      toast('投注處理中，請稍候');
      return Promise.resolve(false);
    }
    const request = { bet: betValue(), risk: els.risk.value, rows: +els.rows.value };
    pendingBets++;
    syncLocks();
    const queued = betQueue.then(() => placeBet(request));
    betQueue = queued.catch(() => false).finally(() => {
      pendingBets--;
      syncLocks();
    });
    return queued;
  }

  async function placeBet({ bet, risk, rows }) {
    if (bet > balance) {
      toast(t('insufficient'));
      return false;
    }
    betInFlight = true;
    syncLocks();
    try {
      const response = await platform.placeBet({ amount: bet, risk, rows });
      verificationUrl = platform.verificationUrl(response);
      els.verifyRound.disabled = !verificationUrl;
      const payout = platform.moneyValue(response.payout);
      const finalBalance = platform.moneyValue(response.balance);
      balance = finalBalance;
      displayBalance = roundMoney(displayBalance - bet);
      renderBalance();
      board.drop(response.outcome, { bet, payout });
      Sound.drop();
      return true;
    } catch (error) {
      toast(error.message || '平台連線失敗');
      try {
        const session = await platform.openSession();
        balance = platform.moneyValue(session.balance);
        if (board.active === 0) {
          displayBalance = balance;
          renderBalance();
        }
      } catch (_) { /* keep the last confirmed balance */ }
      return false;
    } finally {
      betInFlight = false;
      syncLocks();
    }
  }

  async function placeAutoBatch(count) {
    if (betValue() > balance) {
      toast(t('insufficient'));
      return 0;
    }
    betInFlight = true;
    syncLocks();
    try {
      const bet = betValue();
      const affordable = Math.floor(balance / bet);
      const requested = Math.min(count, AUTO_BATCH_SIZE, affordable);
      if (requested < 1) {
        toast(t('insufficient'));
        return 0;
      }
      const response = await platform.placeBetBatch({
        amount: bet, risk: els.risk.value, rows: +els.rows.value, count: requested,
      });
      if (!response.bets.length) throw new Error(response.error?.message || '批次投注失敗');
      balance = platform.moneyValue(response.bets[response.bets.length - 1].balance);
      for (const result of response.bets) {
        verificationUrl = platform.verificationUrl(result);
        els.verifyRound.disabled = !verificationUrl;
        displayBalance = roundMoney(displayBalance - bet);
        renderBalance();
        board.drop(result.outcome, { bet, payout: platform.moneyValue(result.payout) });
        Sound.drop();
        await new Promise((resolve) => setTimeout(resolve, AUTO_INTERVAL));
      }
      if (response.error) toast(response.error.message || '部分投注未完成');
      return response.bets.length;
    } catch (error) {
      toast(error.message || '平台連線失敗');
      try {
        const session = await platform.openSession();
        balance = platform.moneyValue(session.balance);
        if (board.active === 0) {
          displayBalance = balance;
          renderBalance();
        }
      } catch (_) { /* keep the last confirmed balance */ }
      return 0;
    } finally {
      betInFlight = false;
      syncLocks();
    }
  }

  function onLand(result, { bet, payout }) {
    displayBalance = roundMoney(displayBalance + payout);
    renderBalance();
    stats.add(bet, payout);
    pushHistory(result);
    celebrate(result);
    syncLocks();
  }

  function celebrate(result) {
    Sound.land(result.multiplier);
    if (result.multiplier <= 1) return;
    const [x, y] = board.slotPoint(result.slot);
    confetti.burst(x, y, result.multiplier >= 10 ? 90 : 24);
  }

  function renderSound() {
    els.sound.textContent = Sound.enabled ? '🔊' : '🔇';
    els.sound.classList.toggle('off', !Sound.enabled);
  }

  function pushHistory(result) {
    const li = document.createElement('li');
    li.textContent = Plinko.label(result.multiplier);
    li.style.background = Plinko.slotColor(result.slot, result.rows);
    els.history.prepend(li);
    while (els.history.children.length > HISTORY_SIZE) els.history.lastChild.remove();
  }

  async function startAuto() {
    autoCount = Math.max(0, Math.floor(+els.numberOfBets.value || 0));
    let remaining = autoCount;
    const infinite = remaining === 0;
    const run = { cancelled: false };
    autoRun = run;
    syncLocks();
    while (!run.cancelled) {
      const batchSize = infinite ? AUTO_BATCH_SIZE : Math.min(remaining, AUTO_BATCH_SIZE);
      const completed = await placeAutoBatch(batchSize);
      if (!completed) break;
      if (!infinite) {
        remaining -= completed;
        els.numberOfBets.value = remaining;
        if (remaining <= 0) break;
      }
    }
    if (autoRun === run) stopAuto();
  }

  function stopAuto() {
    if (autoRun) autoRun.cancelled = true;
    autoRun = null;
    els.numberOfBets.value = autoCount;
    syncLocks();
  }

  els.tabs.forEach((tab) => tab.addEventListener('click', () => {
    mode = tab.dataset.mode;
    els.tabs.forEach((x) => x.classList.toggle('active', x === tab));
    els.controls.classList.toggle('is-auto', mode === 'auto');
    syncLocks();
  }));

  // Tapping the board works like the main button, but never stops a running auto play.
  els.boardCard.addEventListener('click', () => {
    if (autoRun) return;
    els.betBtn.click();
  });

  els.betBtn.addEventListener('click', () => {
    Sound.unlock();
    if (mode === 'manual') queueBet();
    else if (autoRun) stopAuto();
    else startAuto();
  });

  els.half.addEventListener('click', () => { els.betAmount.value = (betValue() / 2).toFixed(2); saveSettings(); });
  els.double.addEventListener('click', () => {
    els.betAmount.value = Math.min(balance, betValue() * 2 || 0.01).toFixed(2);
    saveSettings();
  });
  els.betAmount.addEventListener('change', () => { els.betAmount.value = betValue().toFixed(2); saveSettings(); });

  [els.risk, els.rows].forEach((sel) => sel.addEventListener('change', () => {
    board.setup(els.risk.value, +els.rows.value);
    saveSettings();
  }));

  els.balance.addEventListener('click', () => toast(`Player: ${platform.playerId}`));

  els.sound.addEventListener('click', () => { Sound.toggle(); Sound.unlock(); renderSound(); });
  renderSound();

  $('resetStats').addEventListener('click', () => stats.reset());
  els.verifyRound.addEventListener('click', () => {
    if (verificationUrl) window.open(verificationUrl, '_blank', 'noopener');
  });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || /INPUT|SELECT|BUTTON/.test(e.target.tagName)) return;
    e.preventDefault();
    els.betBtn.click();
  });

  async function connectPlatform() {
    try {
      const session = await platform.connect();
      balance = platform.moneyValue(session.balance);
      displayBalance = balance;
      platformReady = true;
      renderBalance();
    } catch (error) {
      toast(`${error.message || '平台連線失敗'}；本機測試請加 ?dev=1`);
    } finally {
      syncLocks();
    }
  }

  syncLocks();
  connectPlatform();
})();
