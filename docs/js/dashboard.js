/* Drug Disco Lab — wall dashboard (portrait screen)
 * Draws the live presence board from whatever data source is plugged in.
 * Right now that's the demo source; the real database comes next.
 *
 * Handy URL options (for testing on a laptop):
 *   ?day=friday   preview another day's colour theme
 *   ?fx=0         turn the animations off
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const CFG = LAB.CONFIG || {};
  const FX = CFG.effects !== false && params.get('fx') !== '0';
  if (!FX) document.documentElement.classList.add('no-fx');

  const POSITION_TAG = {
    'PI': 'pi',
    'Postdoc': 'postdoc',
    'Researcher': 'researcher',
    'PhD Student': 'phd_student',
    "Master's Student": 'masters_student',
    'Research Assistant': 'research_asst',
    'Visitor': 'visitor',
  };
  const WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  /* ── small helpers ─────────────────────────────────────── */
  const pad2 = (n) => String(n).padStart(2, '0');
  const hhmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const hhmmss = (d) => `${hhmm(d)}:${pad2(d.getSeconds())}`;
  const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
  const initials = (nick) => (nick.length > 1 ? nick[0] + nick[nick.length - 1] : nick).toUpperCase();

  function duration(from, to) {
    const mins = Math.max(0, Math.floor((to - from) / 60000));
    const h = Math.floor(mins / 60);
    return h ? `${h}h ${pad2(mins % 60)}m` : `${mins}m`;
  }

  /* Build an element safely — text always goes in as text, never as HTML,
     so a nickname or feeling can't break the page. */
  function el(tag, cls, ...children) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    for (const c of children) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  /* Restart a one-off CSS animation class on an element. */
  function replay(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  /* ── sizing: portrait column, everything scales with its width ── */
  let charRatio = 0.6;                       // width of one monospace char / font size

  function measureChar() {
    const probe = el('span', '', '██████████');
    probe.style.cssText = 'position:absolute;visibility:hidden;font-size:100px;white-space:pre;font-family:var(--mono)';
    document.body.append(probe);
    charRatio = probe.getBoundingClientRect().width / 1000 || 0.6;
    probe.remove();
  }

  function layout() {
    const W = innerWidth, H = innerHeight;
    const stageW = W > H ? Math.min(W, Math.round(H * 9 / 16)) : W;
    const root = document.documentElement.style;
    const base = Math.max(11, Math.min(30, stageW * 0.0195));
    $('stage').style.width = `${stageW}px`;
    root.setProperty('--base', `${base}px`);
    root.setProperty('--stage-w', `${stageW}px`);

    // ASCII day name: same letter size every day, sized so WEDNESDAY (widest) fits
    const widest = Math.max(...Object.entries(LAB.BANNERS)
      .filter(([k]) => !k.startsWith('_')).map(([, v]) => v.split('\n')[0].length));
    const inner = stageW - base * (0.6 * 2 + 1.1 * 2) - 4;       // stage + hero padding
    root.setProperty('--banner-size', `${Math.floor((inner / (widest * charRatio)) * 10) / 10}px`);

    const bootCols = LAB.BANNERS._boot1.split('\n')[0].length;
    root.setProperty('--boot-size', `${Math.floor(((stageW - base * 2.8) / (bootCols * charRatio)) * 10) / 10}px`);

    if (lastState) render(lastState);
  }

  /* ── day theme, banner and typed motto ─────────────────── */
  let currentDayKey = null;

  function themeFor(date) {
    const forced = (params.get('day') || '').toLowerCase();
    const byName = LAB.THEMES.find((t) => t.key === forced || t.key.slice(0, 3) === forced);
    return byName || LAB.THEMES[date.getDay()];
  }

  function updateDay(now) {
    const theme = themeFor(now);
    if (theme.key === currentDayKey) return false;
    currentDayKey = theme.key;
    LAB.applyTheme(theme);

    $('dayName').textContent = theme.name;
    $('banner').textContent = LAB.BANNERS[theme.key];
    $('banner').dataset.text = LAB.BANNERS[theme.key];
    $('prompt').textContent = `$ lab --status --day=${theme.key} --live`;

    const todayIdx = LAB.THEMES.indexOf(theme);            // 0 = Sunday
    const weekIdx = (todayIdx + 6) % 7;                     // 0 = Monday
    $('week').replaceChildren(...WEEK.map((d, i) => el('span', i === weekIdx ? 'today' : '', d)));
    typeMotto();
    return true;
  }

  let typingTimer = null;
  function typeMotto() {
    const text = LAB.THEMES.find((t) => t.key === currentDayKey).motto;
    const box = $('motto');
    clearTimeout(typingTimer);
    if (!FX) { box.textContent = text; return; }
    // reserve the final height first, so nothing jumps while it types
    const line = $('mottoLine');
    line.style.minHeight = '';
    box.textContent = text;
    const fs = parseFloat(getComputedStyle(line).fontSize) || 1;
    line.style.minHeight = `${line.offsetHeight / fs}em`;
    replay($('mottoBox'), 'sweep');
    let i = 0;
    box.textContent = '';
    (function next() {
      box.textContent = text.slice(0, ++i);
      if (i < text.length) typingTimer = setTimeout(next, 40 + Math.random() * 60);
    })();
  }

  function glitch() {
    if (FX) replay($('banner'), 'glitch');
  }

  /* ── boot screen ───────────────────────────────────────── */
  const BOOT_MS = 3400;

  function boot(memberCount) {
    if (!FX) return;
    const box = $('bootInner');
    const lines = el('div', 'lines');
    box.replaceChildren(el('pre', '', LAB.BANNERS._boot1), el('pre', '', LAB.BANNERS._boot2), lines);
    $('boot').hidden = false;

    const steps = [
      ['mounting /lab/members', 'OK'],
      [`loading theme :: ${currentDayKey}`, 'OK'],
      ['connecting to database', lastState && lastState.demo ? 'DEMO' : 'OK'],
      [`members found :: ${memberCount}`, 'OK'],
    ];
    steps.forEach(([text, status], i) => setTimeout(() => {
      lines.append(el('div', '', el('span', 'ok', `[ ${status} ] `), el('span', 'dim', text)));
    }, 500 + i * 450));
    setTimeout(() => lines.append(el('div', '', '> starting presence.sh', el('span', 'cursor'))), 500 + steps.length * 450);
    setTimeout(() => {
      $('boot').classList.add('done');
      setTimeout(() => { $('boot').hidden = true; }, 800);
    }, BOOT_MS);
  }

  /* ── member cards ──────────────────────────────────────── */
  const cards = new Map();          // member id → card element (kept between redraws)
  let firstRender = true;
  const introDelay = FX ? BOOT_MS / 1000 : 0;

  function buildCard() {
    const r = {
      idx: el('span', 'idx'),
      avatar: el('span', 'avatar'),
      nick: el('span', 'nick'),
      pos: el('span', 'pos'),
      since: el('span', 'since'),
      dur: el('span', 'dur'),
      meter: el('span', 'meter'),
      feel: el('div', 'feel'),
    };
    const card = el('div', 'card',
      r.idx, r.avatar,
      el('div', 'who',
        el('div', 'who-top', r.nick, r.pos),
        el('div', 'who-mid', r.since, r.meter, r.dur),
        r.feel),
      el('span', 'badge', 'IN'));
    card._r = r;
    card.addEventListener('animationend', (e) => {
      if (e.target === card && (e.animationName === 'flash-bg' || e.animationName === 'slide-in')) {
        card.classList.remove('enter', 'intro');
        card.style.animationDelay = '';
      }
    });
    return card;
  }

  function meterText(from, now) {
    const full = (CFG.fullDayHours || 9) * 3600000;
    const n = Math.max(0, Math.min(10, Math.round(((now - from) / full) * 10)));
    return [document.createTextNode('█'.repeat(n)), el('span', 'rest', '░'.repeat(10 - n))];
  }

  function updateCard(card, m, s, i, now) {
    const r = card._r;
    r.idx.textContent = pad2(i + 1);
    r.avatar.textContent = initials(m.nickname);
    r.nick.replaceChildren(m.nickname, el('span', 'at', '@lab'));
    r.pos.textContent = `[${POSITION_TAG[m.position] || 'member'}]`;
    r.since.textContent = `since ${hhmm(s.last_check_in)}`;
    r.dur.textContent = duration(s.last_check_in, now);
    r.meter.replaceChildren(...meterText(s.last_check_in, now));

    const feelKey = `${s.feeling_emoji || ''}|${s.feeling_text || ''}`;
    if (card._feel !== feelKey) {
      const emo = s.feeling_emoji ? el('span', 'emo', s.feeling_emoji) : null;
      if (emo) emo.style.animationDelay = `${-(i * 0.7)}s`;       // bob out of step
      r.feel.replaceChildren(...[emo, s.feeling_text ? el('span', 'txt', `// ${s.feeling_text}`) : null].filter(Boolean));
      if (card._feel !== undefined && emo && FX) emo.classList.add('pop');
      card._feel = feelKey;
    }
  }

  function renderIn(ins, st, now) {
    const list = $('inList');
    list.classList.toggle('two', ins.length > 8);
    const keep = new Set();
    let ref = list.firstElementChild;

    ins.forEach((m, i) => {
      let card = cards.get(m.id);
      const isNew = !card;
      if (isNew) { card = buildCard(); cards.set(m.id, card); }
      updateCard(card, m, st(m), i, now);
      keep.add(m.id);

      // put the card in position i without re-inserting cards that are already
      // in the right place (re-inserting would restart their animations)
      while (ref && ref.classList.contains('leave')) ref = ref.nextElementSibling;
      if (card !== ref) list.insertBefore(card, ref); else ref = ref.nextElementSibling;

      if (isNew && FX) {
        if (firstRender) {
          card.classList.add('intro');
          card.style.animationDelay = `${introDelay + i * 0.12}s`;
        } else {
          card.classList.add('enter');
          const hello = el('span', 'hello', '>> just checked in');
          card.append(hello);
          setTimeout(() => hello.remove(), 5200);
        }
      }
    });

    for (const [id, card] of cards) {
      if (keep.has(id)) continue;
      cards.delete(id);
      if (!FX) { card.remove(); continue; }
      card.classList.remove('enter', 'intro');
      card.classList.add('leave');
      setTimeout(() => { card.remove(); fitToScreen(); }, 950);
    }
  }

  /* ── rendering ─────────────────────────────────────────── */
  let lastState = null;

  function setStat(id, value) {
    const node = $(id);
    if (node.textContent === value) return;
    node.textContent = value;
    if (!firstRender && FX) replay(node, 'tick');
  }

  function render(state) {
    lastState = state;
    const now = new Date();
    const active = state.members.filter((m) => m.status === 'active');
    const st = (m) => state.status[m.id] || {};

    const ins = active
      .filter((m) => st(m).is_in)
      .sort((a, b) => st(a).last_check_in - st(b).last_check_in);   // first arrival = 01

    const outs = active
      .filter((m) => !st(m).is_in)
      .sort((a, b) => {
        const ta = sameDay(st(a).last_check_out, now) ? +st(a).last_check_out : 0;
        const tb = sameDay(st(b).last_check_out, now) ? +st(b).last_check_out : 0;
        return tb - ta || a.nickname.localeCompare(b.nickname);
      });

    setStat('statIn', pad2(ins.length));
    setStat('statOut', pad2(outs.length));
    setStat('statTotal', pad2(active.length));

    $('inHead').textContent = `// members :: status=IN [${ins.length}]`;
    $('inEmpty').hidden = ins.length > 0;
    renderIn(ins, st, now);

    $('outHead').textContent = `// members :: status=OUT [${outs.length}]`;
    $('outList').replaceChildren(...outs.map((m, i) => {
      const s = st(m);
      const left = sameDay(s.last_check_out, now) ? `left ${hhmm(s.last_check_out)}` : '-- not in today';
      return el('div', 'out-row',
        el('span', 'idx', pad2(i + 1)),
        el('span', 'ini', initials(m.nickname)),
        el('span', 'nick', m.nickname, el('span', 'at', '@lab')),
        el('span', 'pos', `[${POSITION_TAG[m.position] || 'member'}]`),
        el('span', 'left', left));
    }));

    $('demoTag').hidden = !state.demo;
    $('livePill').classList.toggle('off', !state.connected);
    $('liveText').textContent = state.connected ? 'LIVE' : 'OFFLINE';
    $('offlineBanner').hidden = state.connected;
    $('syncText').textContent = `// updated ${hhmmss(now)}${state.demo ? ' · source=demo' : ''}`;

    fitToScreen();
    firstRender = false;
  }

  /* Member list zoom: start big (160 %) and shrink until everyone fits
     (down to 60 %). Few people → large cards readable from across the room.
     Whatever space is left over goes to the spinning DNA. */
  function fitToScreen() {
    const root = document.documentElement.style;
    const box = $('members');
    const amb = $('ambient');
    amb.hidden = true;
    let fit = 1.45;
    root.setProperty('--mfit', fit);
    while (box.scrollHeight > box.clientHeight + 1 && fit > 0.6) {
      fit = Math.round((fit - 0.05) * 100) / 100;
      root.setProperty('--mfit', fit);
    }
    const cs = getComputedStyle(box);
    const free = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      - $('membersInner').offsetHeight - 12;
    helix.resize(free);
  }

  /* ── animation of the day (see ambient.js) ─────────────────
     Most days draw with text blocks on three <pre> layers; some (Mon, Tue)
     draw smooth lines on a <canvas>. */
  const helix = (function () {
    const layers = document.querySelectorAll('#helix pre');
    const canvas = $('ambCanvas');
    const g = canvas.getContext('2d');
    const low = document.createElement('canvas');                // small canvas for the 8-bit look
    const gl = low.getContext('2d', { willReadFrequently: true });
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
    let px = 1;                                                  // screen pixels per "8-bit" pixel
    let rows = 0, cols = 0, cw = 0, ch = 0, timer = null, dayKey = null, draw = null, entry = null, colors = null;
    const t0 = performance.now();

    function textFrame(t) {
      const L = [0, 1, 2].map(() => Array.from({ length: rows }, () => Array(cols).fill(' ')));
      const put = (l, x, y, c) => {
        x = Math.round(x); y = Math.round(y);
        if (x >= 0 && x < cols && y >= 0 && y < rows) L[l][y][x] = c;
      };
      const ctx = {
        cols, rows, ar: charRatio, put,
        text(l, x, y, str) { [...str].forEach((c, i) => put(l, x + i, y, c)); },
        line(l, x0, y0, x1, y1, c) {                      // straight line of characters
          const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
          for (let i = 1; i < n; i++) put(l, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
        },
      };
      draw(ctx, t);
      // a character on a higher layer hides whatever is behind it
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (L[2][y][x] !== ' ') { L[1][y][x] = ' '; L[0][y][x] = ' '; }
        else if (L[1][y][x] !== ' ') L[0][y][x] = ' ';
      }
      layers.forEach((pre, i) => { pre.textContent = L[i].map((r) => r.join('')).join('\n'); });
    }

    function canvasFrame(t) {
      const dpr = window.devicePixelRatio || 1;
      if (!entry.pixel) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, cw, ch);
        draw(g, cw, ch, t, colors);
        return;
      }
      // 8-bit mode: draw small, snap every pixel to fully on/off (fades become
      // a dither pattern), then scale up with hard edges
      const lw = low.width, lh = low.height;
      gl.setTransform(1, 0, 0, 1, 0, 0);
      gl.clearRect(0, 0, lw, lh);
      const labels = [];
      draw(gl, lw, lh, t, colors, { pixel: true, label: (...a) => labels.push(a) });
      const img = gl.getImageData(0, 0, lw, lh), d = img.data;
      for (let y = 0; y < lh; y++) {
        for (let x = 0; x < lw; x++) {
          const i = (y * lw + x) * 4, a = d[i + 3];
          if (!a) continue;
          const k = (a / 255 - 0.3) / 0.35;                      // sharpen soft edges, keep fades
          d[i + 3] = k > BAYER[((y & 3) << 2) | (x & 3)] ? 255 : 0;
        }
      }
      gl.putImageData(img, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(low, 0, 0, lw * px * dpr, lh * px * dpr);
      // labels stay sharp and readable
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.textAlign = 'center';
      g.fillStyle = colors.muted;
      const placed = [];
      labels.forEach(([text, x, y, alpha, size]) => {
        g.globalAlpha = alpha;
        const fs = Math.round(size * px);
        g.font = `${fs}px 'JetBrains Mono', 'DejaVu Sans Mono', monospace`;
        const half = g.measureText(text).width / 2 + 4;                // keep the whole label on screen
        const lx = Math.max(half, Math.min(cw - half, x * px));
        let ly = y * px;
        // step aside if another label is already there
        for (const p of placed) {
          if (Math.abs(p.x - lx) < p.half + half && Math.abs(p.y - ly) < fs * 1.2) ly = p.y - fs * 1.3;
        }
        placed.push({ x: lx, y: ly, half });
        g.fillText(text, lx, ly);
      });
      g.globalAlpha = 1;
    }

    let cost = 0, slow = false;                                  // average ms per frame
    function frame() {
      if (!draw) return;
      const start = performance.now();
      const t = (start - t0) / 1000;
      try { if (entry.canvas) canvasFrame(t); else textFrame(t); } catch (e) { console.error(e); }
      // if the Pi struggles, drop to fewer frames per second instead of stuttering everything
      cost = cost * 0.9 + (performance.now() - start) * 0.1;
      if (!slow && cost > 35 && timer) { slow = true; clearInterval(timer); timer = setInterval(frame, 200); }
    }

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const v = (name) => cs.getPropertyValue(name).trim();
      colors = { accent: v('--accent'), ink: v('--accent-ink'), soft: v('--accent-soft'),
                 surface: v('--surface'), line: v('--line'), muted: '#6e7782' };
    }

    function pickDay() {
      if (dayKey === currentDayKey) return;
      dayKey = currentDayKey;
      rows = cols = cw = ch = 0;
      entry = LAB.AMBIENT[dayKey] || LAB.AMBIENT.wednesday;
      draw = null;
      $('ambCmd').textContent = `$ ${entry.cmd}`;
      $('ambNote').textContent = entry.note;
      canvas.hidden = !entry.canvas;
      layers.forEach((pre) => { pre.hidden = !!entry.canvas; pre.textContent = ''; });
      readColors();
      clearInterval(timer); timer = null;
    }

    return {
      resize(free) {
        const amb = $('ambient');
        const base = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base')) || 20;
        pickDay();
        const size = Math.round(base * (entry.size || 1.1));
        if (Math.floor((free - base * 2.4) / size) < 7) {       // not enough room: hide
          amb.hidden = true; clearInterval(timer); timer = null; return;
        }
        amb.hidden = false;
        amb.style.height = `${free}px`;
        const box = $('helix');

        if (entry.canvas) {
          const w = box.clientWidth, h = box.clientHeight;
          if (w !== cw || h !== ch || !draw) {
            const dpr = window.devicePixelRatio || 1;
            cw = w; ch = h;
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            px = entry.pixel ? Math.max(2, Math.round(base * 0.14)) : 1;
            low.width = Math.ceil(w / px); low.height = Math.ceil(h / px);
            draw = entry.make();
          }
        } else {
          document.documentElement.style.setProperty('--helix-size', `${size}px`);
          const nr = Math.min(entry.maxRows || 15, Math.floor(box.clientHeight / size)) | 1;   // odd = centred
          const nc = Math.max(10, Math.floor(box.clientWidth / (size * charRatio)) - 1);
          if (nr !== rows || nc !== cols || !draw) { rows = nr; cols = nc; draw = entry.make(); }
        }
        frame();
        if (FX && !timer) timer = setInterval(frame, slow ? 200 : entry.canvas ? 80 : 100);   // ~12 / 10 fps
      },
    };
  })();

  /* ── clock ─────────────────────────────────────────────── */
  let ticks = 0;
  function tick() {
    const now = new Date();
    $('hh').textContent = pad2(now.getHours());
    $('mm').textContent = pad2(now.getMinutes());
    $('ss').textContent = pad2(now.getSeconds());
    $('dateText').textContent = `${pad2(now.getDate())} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

    const changed = updateDay(now);
    ticks++;
    if (lastState && (ticks % 30 === 0 || changed)) render(lastState);   // durations
    if (changed && ticks > 1) glitch();
    if (ticks % 17 === 0) glitch();                                      // every ~17 s
    if (ticks % 180 === 0) typeMotto();                                  // retype every 3 min
  }

  /* ── hide the mouse pointer when it isn't moving ───────── */
  let cursorTimer;
  function wakeCursor() {
    document.body.classList.remove('hide-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 3000);
  }
  document.addEventListener('mousemove', wakeCursor);

  /* ── start ─────────────────────────────────────────────── */
  measureChar();
  layout();
  updateDay(new Date());
  tick();
  setInterval(tick, 1000);
  wakeCursor();
  window.addEventListener('resize', layout);
  if (document.fonts) document.fonts.ready.then(() => { measureChar(); layout(); });

  const source = LAB.createDemoSource();   // later: the real database source
  source.subscribe(render);
  boot(lastState ? lastState.members.filter((m) => m.status === 'active').length : 0);
})();
