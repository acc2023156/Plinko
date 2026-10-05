// Canvas peg board. Positions are kept in "grid units" (1 unit = peg spacing),
// measured from the top peg row's center, so a resize never disturbs balls in flight.
class Board {
  constructor(canvas, onLand, onPeg) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onLand = onLand;
    this.onPeg = onPeg;
    this.balls = [];
    this.pegHits = new Map();
    this.slotHits = [];
    this.rows = 16;
    this.multipliers = [];
    this.tick = this.tick.bind(this);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    requestAnimationFrame(this.tick);
  }

  get active() { return this.balls.length; }

  setup(risk, rows) {
    this.rows = rows;
    this.multipliers = Plinko.multipliers(risk, rows);
    this.slotHits = new Array(rows + 1).fill(-1e9);
    this.pegHits.clear();
    this.layout();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.canvas.getBoundingClientRect();
    this.w = width; this.h = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
  }

  layout() {
    const r = this.rows;
    // Width fits the widest peg row plus margin; height fits drop zone + pegs + slots.
    this.gap = Math.min(this.w / (r + 2.2), this.h / (r + 2.6));
    this.cx = this.w / 2;
    this.y0 = (this.h - (r + 1.4) * this.gap) / 2 + this.gap * 0.8;
  }

  toPx(x, y) { return [this.cx + x * this.gap, this.y0 + y * this.gap]; }

  // Viewport coordinates of a slot's center, for effects drawn outside the canvas.
  slotPoint(slot) {
    const [x, y] = this.toPx(slot - this.rows / 2, this.rows - 1 + 0.9);
    const rect = this.canvas.getBoundingClientRect();
    return [rect.left + x, rect.top + y];
  }

  // Waypoints: drop point, the contact on one peg per row, then the slot.
  drop(result, payload) {
    this.release().fall(result, payload);
  }

  // 按下就先放一顆球停在頂端；結果回來再呼叫 fall 沿路徑落下，投注失敗則 cancel 收回。
  release() {
    const ball = { pending: true, pts: [[(Math.random() - 0.5) * 0.3, -1.1]], seg: 0, segStart: performance.now() };
    this.balls.push(ball);
    return {
      fall: (result, payload) => {
        const pts = [ball.pts[0]];
        let rights = 0;
        result.path.forEach((dir, row) => {
          const pegX = rights - row / 2;
          const side = dir ? 1 : -1;
          pts.push([pegX + side * 0.12 + (Math.random() - 0.5) * 0.06, row - 0.33, row, rights + 1]);
          rights += dir;
        });
        pts.push([result.slot - this.rows / 2, this.rows - 1 + 0.55]);
        Object.assign(ball, { pending: false, result, payload, pts, seg: 0, segStart: performance.now() });
      },
      cancel: () => {
        const i = this.balls.indexOf(ball);
        if (i >= 0) this.balls.splice(i, 1);
      },
    };
  }

  tick(now) {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.pending) continue;
      const dur = b.seg === 0 ? 260 : 150;
      while (now - b.segStart >= dur && b.seg < b.pts.length - 1) {
        b.segStart += dur;
        b.seg++;
        const p = b.pts[b.seg];
        if (p.length > 2) {
          this.pegHits.set(`${p[2]}:${p[3]}`, now);
          if (this.onPeg) this.onPeg();
        }
      }
      if (b.seg >= b.pts.length - 1) {
        this.balls.splice(i, 1);
        this.slotHits[b.result.slot] = now;
        this.onLand(b.result, b.payload);
      } else {
        b.t = Math.min(1, (now - b.segStart) / dur);
      }
    }
    this.draw(now);
    requestAnimationFrame(this.tick);
  }

  ballPos(b) {
    if (b.pending) return b.pts[0];
    const [x0, y0] = b.pts[b.seg];
    const [x1, y1] = b.pts[b.seg + 1];
    const t = b.t || 0;
    if (b.seg === 0) return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t * t];
    // Small hop off the peg, then gravity down to the next contact.
    const up = 0.45, dy = y1 - y0;
    return [x0 + (x1 - x0) * t, y0 - up * t + (dy + up) * t * t];
  }

  draw(now) {
    const { ctx, gap, rows } = this;
    ctx.clearRect(0, 0, this.w, this.h);

    const pegR = Math.max(1.5, gap * 0.1);
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < r + 3; i++) {
        const [x, y] = this.toPx(i - (r + 2) / 2, r);
        const age = now - (this.pegHits.get(`${r}:${i}`) ?? -1e9);
        if (age < 400) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(255,198,65,${0.45 * (1 - age / 400)})`;
          ctx.arc(x, y, pegR * (2 + age / 200), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.fillStyle = '#fff8e9';
        ctx.arc(x, y, pegR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const sw = gap * 0.9, sh = gap * 0.78;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.max(7, gap * 0.3)}px "Noto Sans TC", sans-serif`;
    this.multipliers.forEach((m, s) => {
      const age = now - this.slotHits[s];
      const bump = age < 300 ? Math.sin((age / 300) * Math.PI) * gap * 0.22 : 0;
      const [x, y] = this.toPx(s - rows / 2, rows - 1 + 0.55);
      const top = y + bump;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      roundRect(ctx, x - sw / 2, top + 3, sw, sh, 4); ctx.fill();
      ctx.fillStyle = Plinko.slotColor(s, rows);
      roundRect(ctx, x - sw / 2, top, sw, sh, 4); ctx.fill();
      ctx.fillStyle = '#3a0d08';
      ctx.fillText(Plinko.label(m), x, top + sh / 2 + 0.5, sw - 2);
    });

    const ballR = gap * 0.22;
    for (const b of this.balls) {
      const [x, y] = this.toPx(...this.ballPos(b));
      const g = ctx.createRadialGradient(x - ballR * 0.35, y - ballR * 0.35, ballR * 0.1, x, y, ballR);
      g.addColorStop(0, '#ff8a7a');
      g.addColorStop(1, '#d4141c');
      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(x, y, ballR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
