// UI strings per language. Add a language by adding a dictionary with the same keys;
// pick it with ?lang=xx (remembered in localStorage).
const I18N = {
  'zh-TW': {
    title: 'PLINKO 彈珠台',
    back: '返回大廳',
    balance: '餘額',
    demo: '示範',
    refill: '補充示範餘額',
    manual: '手動',
    auto: '自動',
    betAmount: '投注金額',
    half: '½',
    double: '2×',
    risk: '風險',
    riskLow: '低',
    riskMedium: '中',
    riskHigh: '高',
    rows: '列數',
    bet: '投注',
    numberOfBets: '投注次數',
    infiniteHint: '0 為無限次',
    startAuto: '開始自動投注',
    stopAuto: '停止自動投注',
    liveStats: '即時統計',
    reset: '重設',
    profit: '盈利',
    wagered: '總投注',
    wins: '勝',
    losses: '負',
    history: '最近結果',
    insufficient: '餘額不足',
    locked: '球落下中，暫時無法變更',
    refilled: '已補充示範餘額',
  },
};

const DEFAULT_LANG = 'zh-TW';

const lang = (() => {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  let saved = null;
  try {
    if (fromUrl) localStorage.setItem('plinko.lang', fromUrl);
    saved = localStorage.getItem('plinko.lang');
  } catch (e) { /* storage unavailable */ }
  const pick = fromUrl || saved;
  return I18N[pick] ? pick : DEFAULT_LANG;
})();

function t(key) {
  return I18N[lang][key] ?? I18N[DEFAULT_LANG][key] ?? key;
}

function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
}

function formatMoney(n) {
  return n.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
