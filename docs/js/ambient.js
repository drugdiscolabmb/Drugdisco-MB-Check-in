/* Ambient block-art animations — one per day, shown in the empty space
 * under the member list. Chunky shapes made of █ blocks, like the DNA.
 *
 *   Mon  drugs.sh      2D drug molecules in atom colours, coming and going (canvas)
 *   Tue  protein.sh    3D protein cartoons (real PDB structures) coloured by
 *                      helix / strand / loop, drawn 2.5D, coming and going (canvas)
 *   Wed  dna.sh        DNA double helix with random mutations (and the odd repair)
 *   Thu  culture.sh    cells growing and dividing over time
 *   Fri  train.py      a small neural network processing data
 *   Sat  virus.sh      a virus spreading copies of itself
 *   Sun  molecule.sh   a small molecule slowly turning (zzz)
 *
 * Drawing happens on a character grid with three layers:
 *   0 = back (pale)   1 = middle   2 = front (full day colour)
 * ctx.put(layer, x, y, char) — x in columns, y in rows.
 * ctx.ar = width of one character ÷ its height (≈ 0.6); used so circles
 * come out round instead of squashed.
 */
window.LAB = window.LAB || {};

(function () {
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* filled circle; cx in columns, cy and r in rows */
  function disc(c, l, cx, cy, r, ch = '█') {
    const rx = r / c.ar;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) * c.ar, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) c.put(l, x, y, ch);
      }
    }
    c.put(l, cx, cy, ch);
  }

  /* thick line between two points (columns/rows), width w in rows */
  function bar(c, l, x0, y0, x1, y1, w, ch = '█') {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      disc(c, l, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, w / 2, ch);
    }
  }

  /* ── Wed: DNA, with random mutations ───────────────────── */
  function dna() {
    const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
    const PURINE = { A: 1, G: 1 };                       // A<->G and C<->T swaps are "transitions"
    const bases = [];                                     // the sequence, one base per rung column
    const baseAt = (x) => bases[x] || (bases[x] = 'ATGC'[(x * x * 31 + x * 7 + 3) % 4]);
    const mutated = new Map();                            // column → { from, t0 }
    let event = null, nextAt = 4, last = 0;

    function mutate(c, t) {
      // sometimes the cell's repair machinery fixes an earlier mutation
      if (mutated.size && Math.random() < 0.3) {
        const [x, m] = [...mutated.entries()][Math.floor(Math.random() * mutated.size)];
        const bad = baseAt(x);
        bases[x] = m.from; mutated.delete(x);
        event = { x, t0: t, repair: true, text: `DNA repair @ bp ${1000 + x}: ${bad}→${m.from} fixed ✓` };
        return;
      }
      if (mutated.size >= 12) {                           // too many: roll back to the clean sequence
        for (const [x, m] of mutated) bases[x] = m.from;
        mutated.clear();
        event = { x: -1, t0: t, repair: true, text: '>> genome restored from backup. phew.' };
        return;
      }
      const cols = [];
      for (let x = 2; x < c.cols - 2; x += 2) if (!mutated.has(x)) cols.push(x);
      const x = cols[Math.floor(Math.random() * cols.length)];
      const from = baseAt(x);
      const to = pick('ATGC'.replace(from, '').split(''));
      bases[x] = to;
      mutated.set(x, { from, t0: t });
      const kind = !PURINE[from] === !PURINE[to] ? 'transition' : 'transversion';
      event = { x, t0: t, text: `!! mutation @ bp ${1000 + x}: ${from}→${to} (${kind})` };
    }

    return (c, t) => {
      if (t < last) nextAt = t + 4;                       // clock restarted
      last = t;
      if (t >= nextAt) { mutate(c, t); nextAt = t + 6 + Math.random() * 6; }

      const rows = Math.min(c.rows - 2, 11) | 1;          // leave a row above (marker) and below (message)
      const oy = Math.max(1, Math.floor((c.rows - rows) / 2));
      const flashing = event && t - event.t0 < 3.5;
      const blinkOn = Math.floor(t * 4) % 2 === 0;

      for (let x = 0; x < c.cols; x++) {
        const ph = x * 0.21 + t * 0.9;
        const frontA = Math.cos(ph) > 0;
        const ya = Math.round(((Math.sin(ph) + 1) / 2) * (rows - 1));
        const yb = rows - 1 - ya;
        c.put(frontA ? 2 : 0, x, oy + ya, '█');
        c.put(frontA ? 0 : 2, x, oy + yb, '█');
        if (x % 2 === 0 && Math.abs(ya - yb) > 2) {
          const top = Math.min(ya, yb), bot = Math.max(ya, yb);
          const b = baseAt(x);
          const isNew = flashing && event.x === x && !event.repair;
          const hot = mutated.has(x);                     // mutated bases stay bold
          const l = hot ? 2 : 1;
          c.put(l, x, oy + top + 1, isNew && !blinkOn ? '█' : b);
          c.put(l, x, oy + bot - 1, isNew && !blinkOn ? '█' : PAIR[b]);
          for (let y = top + 2; y < bot - 1; y++) c.put(l, x, oy + y, hot ? '┆' : '│');
        }
      }

      // marker above the changed base pair, and the message underneath
      if (flashing && event.x >= 0) c.put(2, event.x, oy - 1, event.repair ? '✓' : blinkOn ? '▼' : '▽');
      const msg = flashing ? event.text : `mutations: ${mutated.size}`;
      c.text(flashing ? 2 : 1, Math.max(0, c.cols - msg.length - 1), c.rows - 1, msg);
    };
  }

  /* ── Sat: virus spreading ───────────────────────────────── */
  function virus() {
    let kids = [], last = null, lastSpawn = 0, outbreakAt = null;
    return (c, t) => {
      const dt = last == null ? 0 : Math.min(0.5, t - last);
      last = t;
      const R = c.rows * 0.24;
      const cx = R / c.ar + 4, cy = (c.rows - 1) / 2;

      // the big virus: round body + knobbed spikes, slowly turning
      for (let i = 0; i < 10; i++) {
        const a = (i * TAU) / 10 + t * 0.4;
        const len = R + 1.3 + 0.3 * Math.sin(t * 3 + i);
        const ex = cx + (Math.cos(a) * len) / c.ar, ey = cy + Math.sin(a) * len;
        bar(c, 1, cx + (Math.cos(a) * R) / c.ar, cy + Math.sin(a) * R, ex, ey, 0.5);
        disc(c, 2, ex, ey, 0.7);
      }
      disc(c, 2, cx, cy, R);
      [[0.35, -0.3], [-0.35, 0.25], [0.15, 0.45]].forEach(([u, v]) =>
        disc(c, 2, cx + (u * R) / c.ar, cy + v * R, R * 0.18, '▓'));

      // copies drift away and copy themselves
      if (outbreakAt == null) {
        if (t - lastSpawn > 1.1) {
          lastSpawn = t;
          kids.push({ x: cx + R / c.ar + 3, y: cy + rand(-R, R), vx: rand(3, 6), vy: rand(-1.2, 1.2), born: t });
        }
        const born = [];
        kids.forEach((k) => {
          k.x += k.vx * dt; k.y += k.vy * dt;
          if (k.y < 1 || k.y > c.rows - 2) k.vy *= -1;
          if (t - k.born > 2 && Math.random() < dt * 0.6) {
            born.push({ x: k.x, y: k.y, vx: rand(1, 4), vy: rand(-1.5, 1.5), born: t });
            k.born = t;
          }
        });
        kids = kids.concat(born).filter((k) => k.x < c.cols + 2);
        if (kids.length > 26) outbreakAt = t;
      } else if (t - outbreakAt > 2.5) {
        kids = []; outbreakAt = null;
      }
      kids.forEach((k) => {
        c.put(2, k.x, k.y, '█');
        c.put(1, k.x - 1, k.y, '▪'); c.put(1, k.x + 1, k.y, '▪');
        c.put(1, k.x, k.y - 1, '▪'); c.put(1, k.x, k.y + 1, '▪');
      });
      const msg = outbreakAt != null ? '!! outbreak — containing...' : `copies: ${kids.length}`;
      c.text(outbreakAt != null ? 2 : 1, c.cols - msg.length - 1, c.rows - 1, msg);
    };
  }

  /* ── Fri: neural network processing data ────────────────── */
  function neural() {
    const LAYERS = [3, 4, 4, 2];
    const OUT = ['weekend', 'working day'];
    return (c, t) => {
      const period = 2.6;
      const epoch = (Math.floor(t / period) % 40) + 1;          // training restarts after 40 epochs
      const p = (t % period) / period;
      const nL = LAYERS.length;
      const H = c.rows - 1;                                     // last row = training stats
      const gap = (H - 1) / (Math.max(...LAYERS) + 1);         // rows between nodes
      const big = gap >= 3.2;
      const node = (l, x, y) => {                               // a node: small bar, or a round-ish block if there's room
        for (let dx = -2; dx <= 2; dx++) c.put(l, x + dx, y, '█');
        if (big) for (let dx = -1; dx <= 1; dx++) { c.put(l, x + dx, y - 1, '█'); c.put(l, x + dx, y + 1, '█'); }
      };
      const r = big ? 1.2 : 0.6;                                // node half-height, for label spacing
      const xs = LAYERS.map((_, i) => Math.round(c.cols * (0.13 + (0.54 * i) / (nL - 1))));
      const nodes = LAYERS.map((n, i) => Array.from({ length: n }, (_, j) => ({ x: xs[i], y: Math.round(((H - 1) * (j + 1)) / (n + 1)) })));

      // connections
      for (let i = 0; i < nL - 1; i++)
        nodes[i].forEach((a) => nodes[i + 1].forEach((b) => c.line(0, a.x, a.y, b.x, b.y, '·')));

      // the signal travels one layer at a time, then the answer shows
      const s = p * nL, k = Math.floor(s), f = s - k;
      if (k < nL - 1) {
        nodes[k].forEach((a) => nodes[k + 1].forEach((b) =>
          c.put(1, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, '•')));
      }
      nodes.forEach((layer, i) => layer.forEach((n, j) => {
        const lit = i === k || (i === k + 1 && f > 0.85) || (i === nL - 1 && k === nL - 1 && j === 0);
        node(lit ? 2 : i < k ? 1 : 0, n.x, n.y);
      }));

      // input data coming in on the left
      nodes[0].forEach((n, j) => {
        const bits = ((epoch * 37 + j * 11) % 16).toString(2).padStart(4, '0');
        const slide = k === 0 ? Math.round(f * 2) : 2;
        c.text(k === 0 ? 2 : 1, n.x - 10 + slide, n.y, bits);
      });

      // output labels, with confidence once the signal arrives
      const conf = Math.min(99, 55 + epoch * 3);
      nodes[nL - 1].forEach((n, j) => {
        const done = k === nL - 1;
        const label = done ? `${OUT[j]} ${j === 0 ? conf : 100 - conf}%` : OUT[j];
        c.text(done && j === 0 ? 2 : 1, n.x + 4, n.y, label);
      });

      const loss = (0.9 * Math.exp(-epoch / 6) + 0.03).toFixed(3);
      c.text(1, 1, c.rows - 1, `epoch ${String(epoch).padStart(2, '0')}   loss ${loss}   acc ${conf}%`);
    };
  }

  /* ── Thu: cell culture growing ──────────────────────────── */
  function culture() {
    let cells = [], last = null, hours = 0, fullAt = null;
    return (c, t) => {
      const dt = last == null ? 0 : Math.min(0.5, t - last);
      last = t;
      const W = c.cols * c.ar, H = c.rows - 1;           // area in row units (last row = label)
      const cap = Math.max(4, Math.floor((W * H) / (Math.PI * Math.pow(Math.max(1.6, c.rows * 0.17) * 1.55, 2))));
      const r0 = Math.max(1.6, c.rows * 0.17), rMax = r0 * 1.5;       // newborn / ready-to-divide size
      if (!cells.length) { cells = [{ x: W / 2, y: H / 2, r: r0 }]; hours = 0; }

      if (fullAt == null) {
        hours += dt * 2;
        cells.forEach((k) => { k.r += dt * r0 * 0.07; });
        const next = [];
        cells.forEach((k) => {
          if (k.r >= rMax && cells.length + next.length < cap) {
            const a = rand(0, TAU);
            next.push({ x: k.x + Math.cos(a) * 0.6, y: k.y + Math.sin(a) * 0.4, r: r0 },
                      { x: k.x - Math.cos(a) * 0.6, y: k.y - Math.sin(a) * 0.4, r: r0 });
          } else next.push(k);
        });
        cells = next;
        if (cells.length >= cap && cells.every((k) => k.r >= rMax * 0.95)) fullAt = t;
      } else if (t - fullAt > 3) {
        cells = []; fullAt = null;
      }
      // cells push each other apart and stay inside the dish
      for (let n = 0; n < 3; n++) {
        for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i], b = cells[j];
          let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
          const min = a.r + b.r + 0.2;
          if (d < min) {
            const push = (min - d) * 0.25;
            dx /= d; dy /= d;
            a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
          }
        }
        cells.forEach((k) => {
          k.x = Math.max(k.r, Math.min(W - k.r, k.x));
          k.y = Math.max(k.r * 0.8, Math.min(H - k.r * 0.8, k.y));
        });
      }
      cells.forEach((k) => {
        disc(c, 1, k.x / c.ar, k.y, k.r - 0.35);
        disc(c, 2, k.x / c.ar, k.y, (k.r - 0.35) * 0.42);
      });
      const msg = fullAt != null ? '100% confluent — passaging 1:10...' : `t = ${Math.floor(hours)}h   cells = ${cells.length}`;
      c.text(fullAt != null ? 2 : 1, 1, c.rows - 1, msg);
    };
  }

  /* ── Sun: small molecule, slowly turning, sleeping ──────── */
  function molecule() {
    // a ring of six atoms plus two side groups (x, y in ring units)
    const ATOMS = [];
    for (let i = 0; i < 6; i++) ATOMS.push({ x: Math.cos((i * TAU) / 6), y: Math.sin((i * TAU) / 6), r: 0.9 });
    ATOMS.push({ x: 2.0, y: 0, r: 1.15 }, { x: -1.0, y: 1.75, r: 1.0 });
    const BONDS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 6], [2, 7]];
    return (c, t) => {
      const cx = c.cols * 0.45, cy = (c.rows - 1) / 2;
      const S = c.rows * 0.24;
      const spin = t * 0.25, wob = Math.sin(t * 0.6) * 0.55;
      const P = ATOMS.map((p) => {
        const x0 = p.x * Math.cos(spin) - p.y * Math.sin(spin);
        const y0 = p.x * Math.sin(spin) + p.y * Math.cos(spin);
        const x = x0 * Math.cos(wob), z = x0 * Math.sin(wob);
        return { sx: cx + (x * S) / c.ar, sy: cy + y0 * S, z, r: p.r * S * 0.42 };
      });
      BONDS.forEach(([i, j]) => bar(c, 1, P[i].sx, P[i].sy, P[j].sx, P[j].sy, S * 0.13, '▓'));
      P.slice().sort((p, q) => p.z - q.z).forEach((p) => disc(c, p.z >= -0.15 ? 2 : 0, p.sx, p.sy, p.r));
      // z z z floating up
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.5 + k / 3) % 1;
        c.put(1, cx + (S * 2.6) / c.ar + ph * 6, cy - S * 1.2 - ph * (c.rows * 0.35), ph < 0.5 ? 'z' : 'Z');
      }
    };
  }

  /* ══ Canvas animations (Mon + Tue) ═══════════════════════════
   * These draw real lines on a <canvas> instead of text blocks.
   * draw(g, W, H, t, col): g = canvas 2D context, W/H in CSS pixels,
   * col = the day's colours { accent, ink, soft, surface, line, muted }.
   * Items come and go: each one fades in, drifts for a while, fades out,
   * and a different one takes its place somewhere else.
   * With `pixel: true` the dashboard draws them on a small canvas and blows it
   * up with hard pixel edges and dithered fades, for the 8-bit look. */

  function hexRgb(h) {
    h = h.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = (a) => `rgb(${a.map(Math.round).join(',')})`;
  const blend = (A, B, k) => A.map((v, i) => v + (B[i] - v) * k);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* A crowd of floating items that appear, drift, and disappear.
     opts: target (how many at once), life [min, max] seconds,
           create(W, H, others) → { r, depth, ... } or null */
  function crowd(opts) {
    let items = [], lastSpawn = -99, started = false;
    function spawn(W, H, t, age) {
      const it = opts.create(W, H, items);
      if (!it) return;
      // find a free spot: try a few random places, keep the one furthest from the others
      let best = null, bestD = -Infinity;
      for (let k = 0; k < 14; k++) {
        const x = it.r + Math.random() * Math.max(1, W - 2 * it.r);
        const y = Math.min(it.r, H / 2) + Math.random() * Math.max(1, H - 2 * it.r);
        const d = Math.min(1e9, ...items.map((o) => Math.hypot(o.x - x, o.y - y) - o.r - it.r));
        if (d > bestD) { bestD = d; best = [x, y]; }
      }
      const sp = (4 + it.depth * 4);
      Object.assign(it, {
        x: best[0], y: best[1], age, life: opts.life[0] + Math.random() * (opts.life[1] - opts.life[0]),
        vx: sp * (Math.random() < 0.5 ? -1 : 1), vy: (Math.random() - 0.5) * sp,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.3,
      });
      items.push(it);
      lastSpawn = t;
    }
    return {
      update(W, H, t, dt) {
        if (!started) {                                            // start with a staggered set
          started = true;
          for (let i = 0; i < opts.target; i++) spawn(W, H, t, 1.5 + Math.random() * opts.life[0] * 0.7);
        }
        items.forEach((it) => {
          it.age += dt;
          const fadeIn = Math.min(1, it.age / 1.6), fadeOut = Math.min(1, Math.max(0, (it.life - it.age) / 2.2));
          it.alpha = Math.min(fadeIn, fadeOut);
          it.grow = 0.85 + 0.15 * fadeIn;
        });
        items = items.filter((it) => it.age < it.life);
        if (items.length < opts.target && t - lastSpawn > 2.5) spawn(W, H, t, 0);
        // drift, keep inside the box, and gently push apart
        for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = (a.r + b.r) * 1.0;
          if (d < min) {
            const push = ((min - d) / d) * 0.5 * Math.min(1, dt * 4);
            a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
          }
        }
        items.forEach((it) => {
          it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
          if ((it.x < it.r && it.vx < 0) || (it.x > W - it.r && it.vx > 0)) it.vx *= -1;
          if ((it.y < it.r && it.vy < 0) || (it.y > H - it.r && it.vy > 0)) it.vy *= -1;
          it.y = Math.max(Math.min(it.r, H / 2), Math.min(H - Math.min(it.r, H / 2), it.y));   // never drift off the edge
        });
        return items.slice().sort((a, b) => a.depth - b.depth);   // far ones first
      },
    };
  }

  /* ── Mon: 2D drug molecules, coloured by element ─────────── */
  // standard atom colours (CPK / Jmol), slightly darkened to read on a light background
  const ATOM_COLOR = {
    C: '#454b54', O: '#e0303a', N: '#3558e8', S: '#d4a100', P: '#ee7a00',
    F: '#43b02a', L: '#1e9a3c', B: '#a3312c', I: '#8b1fa0',
  };
  function drugs2d() {
    const names = Object.keys(LAB.MOLECULES);
    const recent = [];
    const pool = crowd({
      target: 5, life: [14, 24],
      create(W, H, others) {
        const shown = new Set(others.map((o) => o.name).concat(recent));
        const name = pick(names.filter((n) => !shown.has(n)).length ? names.filter((n) => !shown.has(n)) : names);
        recent.push(name); if (recent.length > 8) recent.shift();
        const m = LAB.MOLECULES[name];
        const depth = pick([0, 1, 1, 2, 2]);
        const rad = Math.max(...m.a.map(([x, y]) => Math.hypot(x, y)));
        const L = Math.min(H * (0.065 + depth * 0.02), (H * 0.42) / rad);    // bond length in px
        return { name, m, depth, L, r: rad * L + L * 0.5 };
      },
    });
    let last = null, surf = null, surfKey = '';
    return (g, W, H, t, col, ui = {}) => {
      const dt = last == null ? 0 : Math.min(0.5, t - last);
      last = t;
      if (surfKey !== col.surface) { surfKey = col.surface; surf = hexRgb(col.surface); }
      g.lineCap = 'round'; g.lineJoin = 'round';
      pool.update(W, H, t, dt).forEach((it) => {
        const fade = [0.5, 0.22, 0][it.depth];
        const colorOf = (e) => rgb(blend(hexRgb(ATOM_COLOR[e] || ATOM_COLOR.C), surf, fade));
        const L = it.L * it.grow, c = Math.cos(it.rot), s = Math.sin(it.rot);
        const P = it.m.a.map(([x, y]) => [it.x + (x * c - y * s) * L, it.y + (x * s + y * c) * L]);
        const lw = ui.pixel ? Math.max(1.7, L * 0.13) : Math.max(1.3, L * 0.09);
        const paths = {};                                          // colour → list of line segments
        const addSeg = (e, x0, y0, x1, y1) => (paths[e] = paths[e] || []).push([x0, y0, x1, y1]);
        it.m.b.forEach(([i, j, order, side]) => {
          const [ax, ay] = P[i], [bx, by] = P[j], ei = it.m.e[i], ej = it.m.e[j];
          const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len;
          const line = (o, shrink) => {                            // each half of a bond takes its atom's colour
            const x0 = ax + dx * shrink + nx * o, y0 = ay + dy * shrink + ny * o;
            const x1 = bx - dx * shrink + nx * o, y1 = by - dy * shrink + ny * o;
            const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
            addSeg(ei, x0, y0, mx, my); addSeg(ej, mx, my, x1, y1);
          };
          if (order === 1) line(0, 0);
          else if (order === 2 && side) { line(0, 0); line(side * L * 0.2, 0.16); }   // ring double bond
          else if (order === 2) { line(L * 0.09, 0); line(-L * 0.09, 0); }           // e.g. C=O
          else { line(0, 0); line(L * 0.15, 0.05); line(-L * 0.15, 0.05); }
        });
        g.globalAlpha = it.alpha;
        g.lineWidth = lw;
        for (const e in paths) {
          g.strokeStyle = colorOf(e);
          g.beginPath();
          paths[e].forEach(([x0, y0, x1, y1]) => { g.moveTo(x0, y0); g.lineTo(x1, y1); });
          g.stroke();
        }
        // a small coloured dot on every atom that isn't carbon
        it.m.e.split('').forEach((e, i) => {
          if (e === 'C') return;
          g.fillStyle = colorOf(e);
          g.beginPath(); g.arc(P[i][0], P[i][1], lw * 1.25, 0, Math.PI * 2); g.fill();
        });
      });
      g.globalAlpha = 1;
    };
  }

  /* ── Tue: 3D protein cartoons, drawn 2.5D ─────────────────── */
  // colour by structure: helix, beta strand, loop
  const SS_COLOR = { H: '#e0457b', E: '#f0a500', C: '#9aa5b1' };
  function proteins3d() {
    const cache = {};
    /* smooth the C-alpha trace with a Catmull-Rom spline */
    function smoothTrace(pr, sub) {
      const out = [];
      const p = pr.p, n = p.length, brk = new Set(pr.brk);
      for (let i = 0; i < n - 1; i++) {
        const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(n - 1, i + 2)];
        for (let k = 0; k < sub; k++) {
          const u = k / sub, u2 = u * u, u3 = u2 * u;
          const v = [0, 1, 2].map((d) => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * u +
            (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3));
          out.push({ v, ss: pr.s[u < 0.5 ? i : i + 1], gapAfter: brk.has(i + 1) && k === sub - 1,
                     strandEnd: pr.s[i] === 'E' && pr.s[i + 1] !== 'E' && k === 0 });
        }
      }
      out.push({ v: p[n - 1], ss: pr.s[n - 1], gapAfter: true, strandEnd: pr.s[n - 1] === 'E' });
      return out;
    }
    const recent = [];
    const pool = crowd({
      target: 3, life: [20, 32],
      create(W, H, others) {
        // our lab's proteins come up three times as often; keep the total size on
        // screen within budget so the Raspberry Pi can keep up
        const BUDGET = 850;
        const onScreen = others.reduce((sum, o) => sum + o.pr.p.length, 0);
        const shown = new Set(others.map((o) => o.pr.name).concat(recent));
        const fits = (p) => onScreen + p.p.length <= BUDGET;
        let options = LAB.PROTEINS.filter((p) => fits(p) && !shown.has(p.name));
        if (!options.length) options = LAB.PROTEINS.filter((p) => fits(p) && !others.some((o) => o.pr === p));
        if (!options.length) return null;
        const weighted = options.flatMap((p) => (p.lab ? [p, p, p] : [p]));
        const pr = pick(weighted);
        recent.push(pr.name); if (recent.length > 5) recent.shift();
        const n = pr.p.length;
        const sub = n > 300 ? 1 : n > 150 ? 2 : 3;
        if (!cache[pr.name]) cache[pr.name] = smoothTrace(pr, sub);
        const depth = n > 300 ? pick([1, 2]) : pick([0, 1, 1, 2]);
        const r = H * Math.min(0.36, 0.17 + 0.09 * Math.log2(n / 36)) * (0.8 + depth * 0.1);
        return { pr, pts: cache[pr.name], depth, r, tilt: (Math.random() - 0.5) * 0.8 };
      },
    });
    const LEVELS = 8;
    let last = null, palette = null, palKey = '';
    return (g, W, H, t, col, ui = {}) => {
      const dt = last == null ? 0 : Math.min(0.5, t - last);
      last = t;
      if (palKey !== col.surface) {                                 // colour shades, near → far
        palKey = col.surface;
        const surf = hexRgb(col.surface);
        palette = {};
        for (const ss in SS_COLOR) {
          const base = hexRgb(SS_COLOR[ss]), dark = blend(base, [0, 0, 0], 0.35);
          palette[ss] = Array.from({ length: LEVELS }, (_, lv) => {
            const fade = (1 - lv / (LEVELS - 1)) * 0.6;
            return { fill: rgb(blend(base, surf, fade)), edge: rgb(blend(dark, surf, fade)) };
          });
        }
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      const fontPx = ui.pixel ? H * 0.045 : Math.max(10, Math.round(H * 0.042));

      pool.update(W, H, t, dt).forEach((it) => {
        const R = it.r * it.grow;
        const ry = it.rot, rx = it.tilt + 0.25 * Math.sin(t * 0.2 + it.depth);
        const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
        const depthFade = [0.45, 0.2, 0][it.depth];
        const P = it.pts.map((q) => {
          const x1 = q.v[0] * cy + q.v[2] * sy, z1 = -q.v[0] * sy + q.v[2] * cy;
          const y2 = q.v[1] * cx - z1 * sx, z2 = q.v[1] * sx + z1 * cx;
          return [it.x + x1 * R, it.y - y2 * R, z2];
        });
        const segs = [];
        for (let i = 0; i < P.length - 1; i++) if (!it.pts[i].gapAfter) segs.push(i);
        segs.sort((a, b) => (P[a][2] + P[a + 1][2]) - (P[b][2] + P[b + 1][2]));   // back to front
        const thick = Math.pow(it.r / (H * 0.44), 0.35);
        g.globalAlpha = it.alpha;
        segs.forEach((i) => {
          const q = it.pts[i], z = (P[i][2] + P[i + 1][2]) / 2;
          const lv = Math.max(0, Math.min(LEVELS - 1, Math.round(((z + 1) / 2) * (LEVELS - 1) * (1 - depthFade))));
          const c = palette[q.ss][lv];
          const w = Math.max(ui.pixel ? 1 : 0, H * (q.ss === 'C' ? 0.0065 : 0.022) * thick * (1 + z * 0.2));
          if (q.ss !== 'C') {                                      // dark edge gives the ribbon its 3D look
            g.strokeStyle = c.edge; g.lineWidth = w + (ui.pixel ? 1.2 : 2.2);
            g.beginPath(); g.moveTo(P[i][0], P[i][1]); g.lineTo(P[i + 1][0], P[i + 1][1]); g.stroke();
          }
          g.strokeStyle = c.fill; g.lineWidth = w;
          g.beginPath(); g.moveTo(P[i][0], P[i][1]); g.lineTo(P[i + 1][0], P[i + 1][1]); g.stroke();
          if (q.strandEnd && i > 0) {                              // arrow head at the end of a beta strand
            const dx = P[i + 1][0] - P[i - 1][0], dy = P[i + 1][1] - P[i - 1][1], len = Math.hypot(dx, dy) || 1;
            const ux = dx / len, uy = dy / len, hw = w * 1.3;
            g.fillStyle = c.fill;
            g.beginPath();
            g.moveTo(P[i][0] + ux * hw * 1.6, P[i][1] + uy * hw * 1.6);
            g.lineTo(P[i][0] - uy * hw, P[i][1] + ux * hw);
            g.lineTo(P[i][0] + uy * hw, P[i][1] - ux * hw);
            g.closePath(); g.fill();
          }
        });
        // name of the protein under it
        const ly = Math.min(H - 2, it.y + R * 0.95 + fontPx);
        const la = it.alpha * [0.55, 0.75, 0.9][it.depth];
        if (ui.label) ui.label(it.pr.name, it.x, ly, la, fontPx);  // pixel mode: drawn sharp on top
        else {
          g.font = `${fontPx}px 'JetBrains Mono', 'DejaVu Sans Mono', monospace`;
          g.textAlign = 'center'; g.fillStyle = col.muted; g.globalAlpha = la;
          g.fillText(it.pr.name, it.x, ly);
        }
      });
      g.globalAlpha = 1;
    };
  }

  LAB.AMBIENT = {
    // size = character size compared with normal text (smaller = finer drawing)
    monday:    { cmd: 'drugs.sh --float',          note: '// no labels. name them all.',      canvas: true, pixel: true, make: drugs2d },
    tuesday:   { cmd: 'protein.sh --cartoon',      note: '// proteins from our lab, via the PDB', canvas: true, pixel: true, make: proteins3d },
    wednesday: { cmd: 'dna.sh --spin --mutate',    note: "// 5'→3', mistakes included",         size: 1.1, make: dna },
    thursday:  { cmd: 'culture.sh --grow',         note: '// feed them before the weekend',   size: 1.0, make: culture },
    friday:    { cmd: 'train.py --epochs=inf',     note: '// model predicts: weekend',        size: 1.0, make: neural },
    saturday:  { cmd: 'virus.sh --spread',         note: '// contained. probably.',          size: 1.0, make: virus },
    sunday:    { cmd: 'molecule.sh --relax',       note: '// take a rest. zzz',               size: 1.0, make: molecule },
  };
})();
