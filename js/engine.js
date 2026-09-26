// Plinko game rules: payout tables and outcome generation (no DOM).
const Plinko = (() => {
  // Left half of each payout table, edge to center. The right half mirrors it.
  const HALF = {
    low: {
      8: [5.6, 2.1, 1.1, 1, 0.5],
      9: [5.6, 2, 1.6, 1, 0.7],
      10: [8.9, 3, 1.4, 1.1, 1, 0.5],
      11: [8.4, 3, 1.9, 1.3, 1, 0.7],
      12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5],
      13: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7],
      14: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5],
      15: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7],
      16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5],
    },
    medium: {
      8: [13, 3, 1.3, 0.7, 0.4],
      9: [18, 4, 1.7, 0.9, 0.5],
      10: [22, 5, 2, 1.4, 0.6, 0.4],
      11: [24, 6, 3, 1.8, 0.7, 0.5],
      12: [33, 11, 4, 2, 1.1, 0.6, 0.3],
      13: [43, 13, 6, 3, 1.3, 0.7, 0.4],
      14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2],
      15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3],
      16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3],
    },
    high: {
      8: [29, 4, 1.5, 0.3, 0.2],
      9: [43, 7, 2, 0.6, 0.2],
      10: [76, 10, 3, 0.9, 0.3, 0.2],
      11: [120, 14, 5.2, 1.4, 0.4, 0.2],
      12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2],
      13: [260, 37, 11, 4, 1, 0.2, 0.2],
      14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2],
      15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2],
      16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2],
    },
  };

  const RISKS = ['low', 'medium', 'high'];
  const ROWS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

  function multipliers(risk, rows) {
    const half = HALF[risk][rows];
    const tail = (rows + 1) % 2 ? half.slice(0, -1) : half.slice();
    return half.concat(tail.reverse());
  }

  // Each peg sends the ball left (0) or right (1) with equal odds; the slot is the count of rights.
  function play(risk, rows) {
    const bits = new Uint32Array(rows);
    crypto.getRandomValues(bits);
    const path = Array.from(bits, (v) => v & 1);
    const slot = path.reduce((a, b) => a + b, 0);
    return { risk, rows, path, slot, multiplier: multipliers(risk, rows)[slot] };
  }

  function label(m) {
    if (m >= 1000) return m / 1000 + 'K';
    if (m >= 100) return String(m);
    return m + '×';
  }

  // Slot color from gold (center) to red (edges), shared by the board and the history list.
  function slotColor(slot, rows) {
    const t = Math.abs(slot - rows / 2) / (rows / 2);
    const from = [255, 198, 65], to = [227, 45, 35];
    const c = from.map((v, i) => Math.round(v + (to[i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  return { RISKS, ROWS, multipliers, play, label, slotColor };
})();
