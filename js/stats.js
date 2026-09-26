// Session stats (profit, wagered, wins, losses) and the cumulative profit chart.
class LiveStats {
  constructor(els) {
    this.els = els;
    this.maxPoints = 400;
    new ResizeObserver(() => this.drawChart()).observe(els.chart);
    this.reset();
  }

  reset() {
    this.profit = 0;
    this.wagered = 0;
    this.wins = 0;
    this.losses = 0;
    this.series = [0];
    this.render();
  }

  add(bet, payout) {
    this.wagered += bet;
    this.profit += payout - bet;
    if (payout > bet) this.wins++; else this.losses++;
    this.series.push(this.profit);
    if (this.series.length > this.maxPoints) this.series.shift();
    this.render();
  }

  render() {
    const { profit, wagered, wins, losses } = this.els;
    profit.textContent = formatMoney(this.profit);
    profit.classList.toggle('pos', this.profit > 0);
    profit.classList.toggle('neg', this.profit < 0);
    wagered.textContent = formatMoney(this.wagered);
    wins.textContent = this.wins;
    losses.textContent = this.losses;
    this.drawChart();
  }

  drawChart() {
    const canvas = this.els.chart;
    const dpr = window.devicePixelRatio || 1;
    const { width: w, height: h } = canvas.getBoundingClientRect();
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const s = this.series;
    const max = Math.max(0, ...s), min = Math.min(0, ...s);
    const span = max - min || 1;
    const pad = 6;
    const x = (i) => pad + (i / Math.max(1, s.length - 1)) * (w - pad * 2);
    const y = (v) => pad + ((max - v) / span) * (h - pad * 2);
    const zero = y(0);

    ctx.strokeStyle = 'rgba(255,248,233,.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, zero); ctx.lineTo(w, zero); ctx.stroke();
    ctx.setLineDash([]);

    const line = new Path2D();
    s.forEach((v, i) => (i ? line.lineTo(x(i), y(v)) : line.moveTo(x(i), y(v))));
    const area = new Path2D(line);
    area.lineTo(x(s.length - 1), zero);
    area.lineTo(x(0), zero);
    area.closePath();

    // Green above the zero line, red below.
    [['#2fd36b', 0, zero], ['#ff4d4d', zero, h]].forEach(([color, top, bottom]) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, top, w, bottom - top); ctx.clip();
      ctx.globalAlpha = 0.28; ctx.fillStyle = color; ctx.fill(area);
      ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(line);
      ctx.restore();
    });
  }
}
