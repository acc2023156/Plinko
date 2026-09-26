// Synthesized sound effects (Web Audio, no files) and a confetti overlay.
const Sound = (() => {
  let ctx = null;
  let enabled = true;
  let lastTick = 0;
  try { enabled = localStorage.getItem('plinko.sound') !== 'off'; } catch (e) { /* storage unavailable */ }

  // Browsers only allow audio after a user gesture, so the context is created on first use.
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, { at = 0, dur = 0.08, type = 'sine', gain = 0.12, slide = 0 } = {}) {
    const ac = enabled && audio();
    if (!ac) return;
    const t = ac.currentTime + at;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('plinko.sound', enabled ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
      return enabled;
    },
    unlock() { if (enabled) audio(); },
    drop() { tone(520, { dur: 0.09, type: 'triangle', gain: 0.08, slide: 1.5 }); },
    // Many balls hit pegs at once during auto play; cap the tick rate so it stays pleasant.
    peg() {
      const now = performance.now();
      if (now - lastTick < 45) return;
      lastTick = now;
      tone(1300 + Math.random() * 500, { dur: 0.035, type: 'triangle', gain: 0.035 });
    },
    land(multiplier) {
      if (multiplier < 1) return tone(220, { dur: 0.12, type: 'sine', gain: 0.1, slide: 0.7 });
      if (multiplier === 1) return tone(440, { dur: 0.1, type: 'sine', gain: 0.1 });
      const notes = multiplier >= 10 ? [523, 659, 784, 1047, 1319] : [659, 784, 1047];
      notes.forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.16, type: 'square', gain: 0.05 }));
    },
  };
})();

class Confetti {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'confetti';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.parts = [];
    this.running = false;
    this.colors = ['#ffc641', '#fff0aa', '#e33d29', '#cf161d', '#2fd36b', '#ffffff'];
    this.tick = this.tick.bind(this);
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.w = innerWidth; this.h = innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Burst upward from a viewport point; bigger wins get more pieces.
  burst(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 4 + Math.random() * 6;
      this.parts.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.4,
        color: this.colors[(Math.random() * this.colors.length) | 0],
        life: 1,
      });
    }
    if (!this.running) { this.running = true; requestAnimationFrame(this.tick); }
  }

  tick() {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    this.parts = this.parts.filter((p) => p.life > 0 && p.y < this.h + 20);
    for (const p of this.parts) {
      p.vy += 0.22;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      p.life -= 0.012;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (this.parts.length) requestAnimationFrame(this.tick);
    else this.running = false;
  }
}
