/* Drug Disco Lab — mobile check-in app
 *
 * Screens:  home (pick your name) → PIN → check in / update feeling / check out
 *           sign up (waits for admin approval) · change PIN · admin panel
 *
 * All data goes through `api` (js/backend-demo.js for now). When the real
 * database is connected, only that file changes — not this one.
 */
(function () {
  const api = LAB.createDemoBackend();
  const CFG = LAB.CONFIG || {};
  const FEELINGS = CFG.feelings || ['🙂'];
  const LAST_USER = 'ddl-last-user';
  const IDLE_MS = 60 * 1000;                     // personal screens close after 1 min of no taps
  const params = new URLSearchParams(location.search);
  const $view = document.getElementById('view');

  const POSITION_TAG = Object.fromEntries(((LAB.CONFIG || {}).positions || []).map((p) => [p.name, p.tag]));   // from config.js
  const BYE = [
    'go rest. the cells will be fine.', "don't forget your samples in the incubator.",
    'lab coat off, brain off.', 'see you tomorrow (probably).', 'good work today.',
    "the PCR can finish without you.", 'remember to drink water.',
  ];
  const HELLO = [
    "let's get some data.", 'the pipettes missed you.', 'may your gels be straight.',
    'coffee first, science second.', 'today is a good day for results.', 'p < 0.05 vibes only.',
  ];

  /* ── helpers ──────────────────────────────────────────────── */
  const pad2 = (n) => String(n).padStart(2, '0');
  const hhmm = (ms) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const dur = (from) => { const m = Math.max(0, Math.floor((Date.now() - from) / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${pad2(m % 60)}m` : `${m}m`; };
  const initials = (n) => (n.length > 1 ? n[0] + n[n.length - 1] : n).toUpperCase();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const remember = (id) => { try { localStorage.setItem(LAST_USER, id); } catch (e) { /* ignore */ } };
  const remembered = () => { try { return localStorage.getItem(LAST_USER); } catch (e) { return null; } };

  /* el('div', {class: 'x', onclick: fn}, child, 'text', …) — text is always inserted as text */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return n;
  }

  /* swap the screen; `cleanup` runs when we leave it */
  let cleanup = null, idleTimer = null;
  function show(...nodes) {
    if (cleanup) { cleanup(); cleanup = null; }
    clearTimeout(idleTimer);
    $view.classList.add('swap'); void $view.offsetWidth; $view.classList.remove('swap');
    $view.replaceChildren(...nodes.flat().filter(Boolean));
    window.scrollTo(0, 0);
  }
  /* go back home if nobody touches a personal screen for a while */
  function guardIdle() {
    const reset = () => { clearTimeout(idleTimer); idleTimer = setTimeout(home, IDLE_MS); };
    ['pointerdown', 'keydown'].forEach((e) => document.addEventListener(e, reset));
    reset();
    return () => { clearTimeout(idleTimer); ['pointerdown', 'keydown'].forEach((e) => document.removeEventListener(e, reset)); };
  }

  /* the little square picture: pixel face if they made one, otherwise their initials */
  function avatarEl(m, cls = 'avatar') {
    const s = el('span', { class: `${cls}${m.avatar ? ' face' : ''}` });
    if (m.avatar && LAB.AVATAR) s.innerHTML = LAB.AVATAR.svg(m.avatar);   // built only from preset parts
    else s.textContent = m.initials || initials(m.nickname);
    return s;
  }

  const back = (to = home, label = 'back') => el('button', { class: 'back', onclick: () => to() }, '← ', label);
  const prompt = (text) => el('div', { class: 'prompt' }, text, el('span', { class: 'cursor' }));
  const whoHead = (m, line) => el('div', { class: 'who-head' },
    avatarEl(m, 'avatar big'),
    el('div', {}, el('div', { class: 'nick' }, m.nickname, el('span', { class: 'at' }, '@lab')),
      el('div', { class: 'pos' }, line || `[${POSITION_TAG[m.position] || 'member'}]`)));

  /* ── day colours ──────────────────────────────────────────── */
  (function theme() {
    const forced = (params.get('day') || '').toLowerCase();
    const t = LAB.THEMES.find((x) => x.key === forced || x.key.slice(0, 3) === forced) || LAB.THEMES[new Date().getDay()];
    LAB.applyTheme(t);
    document.querySelector('meta[name=theme-color]').setAttribute('content', t.accent);
    document.getElementById('dayLine').textContent = `// [${t.name}] ${t.motto}`;
  })();
  document.getElementById('demoTag').hidden = !api.demo;

  /* ══ HOME: who are you? ═══════════════════════════════════════ */
  async function home() {
    const all = await api.members();
    const members = all.filter((m) => m.status === 'active').sort((a, b) => a.nickname.localeCompare(b.nickname));
    const status = {};
    for (const m of members) status[m.id] = await api.statusOf(m.id);

    const row = (m, extra) => {
      const s = status[m.id];
      return el('li', {}, el('button', { class: `member ${s.is_in ? 'in' : ''} ${extra || ''}`, onclick: () => pinScreen(m) },
        avatarEl(m),
        el('span', { class: 'who' },
          el('span', { class: 'nick' }, m.nickname, el('span', { class: 'at' }, '@lab')),
          el('span', { class: 'pos' }, s.is_in ? `in since ${hhmm(s.last_check_in)} · ${dur(s.last_check_in)}` : `[${POSITION_TAG[m.position] || 'member'}]`)),
        el('span', { class: `badge ${s.is_in ? 'in' : ''}` }, s.is_in ? 'IN' : 'OUT')));
    };

    const list = el('ul', { class: 'members' });
    const draw = (q = '') => {
      const f = members.filter((m) => !q || m.nickname.includes(q.toLowerCase()) || m.full_name.toLowerCase().includes(q.toLowerCase()));
      list.replaceChildren(...(f.length ? f.map((m) => row(m)) : [el('li', { class: 'empty' }, '> no one by that name. new here? sign up below.')]));
    };
    draw();

    const last = members.find((m) => m.id === remembered());
    show(
      prompt('$ whoami'),
      el('h1', { class: 'big' }, "who's there?"),
      last ? el('div', {}, el('h2', {}, '// continue as'), el('ul', { class: 'members' }, row(last, 'continue'))) : null,
      el('h2', {}, `// lab members [${members.length}]`),
      el('label', { class: 'field' }, el('span', { class: 'label' }, '> search'),
        el('input', { type: 'search', placeholder: 'type your nickname…', autocomplete: 'off', oninput: (e) => draw(e.target.value.trim()) })),
      list,
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: signUp }, '+ sign up'),
        el('button', { class: 'btn', onclick: adminLogin }, '⚙ admin')),
    );
  }

  /* ══ PIN pad (used for check-in, admin login, PIN change) ═════ */
  function pinPad({ onPin }) {
    let digits = '';
    let busy = false;
    const dots = el('div', { class: 'pin-dots', 'aria-hidden': 'true' }, ...Array.from({ length: 6 }, () => el('span')));
    const msg = el('div', { class: 'msg', role: 'status' });
    const sr = el('span', { class: 'small muted' });
    const paint = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i < digits.length));
    const fail = (text) => {
      msg.className = 'msg err'; msg.textContent = text;
      dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
      if (navigator.vibrate) navigator.vibrate(120);
      digits = ''; paint();
    };
    async function press(k) {
      if (busy) return;
      if (k === 'del') digits = digits.slice(0, -1);
      else if (k === 'clr') digits = '';
      else if (digits.length < 6) digits += k;
      paint();
      if (digits.length === 6) {
        busy = true; msg.className = 'msg'; msg.textContent = 'checking…';
        try { await onPin(digits); } catch (e) { fail(e.message); }
        busy = false;
      } else if (k !== 'del' && k !== 'clr') { msg.className = 'msg'; msg.textContent = ''; }
    }
    const key = (label, k, cls = 'key', aria) => el('button', { class: cls, 'aria-label': aria || label, onclick: () => press(k) }, label);
    const pad = el('div', { class: 'keypad' },
      ...'123456789'.split('').map((d) => key(d, d)),
      key('clear', 'clr', 'key ghost'), key('0', '0'), key('⌫', 'del', 'key ghost', 'delete'));
    // typing on a computer keyboard works too
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Escape') press('clr');
    };
    document.addEventListener('keydown', onKey);
    const reset = () => { digits = ''; paint(); msg.className = 'msg'; msg.textContent = ''; };
    return { node: el('div', {}, dots, msg, pad, sr), stop: () => document.removeEventListener('keydown', onKey), fail, reset };
  }

  /* ══ enter PIN for a member ═══════════════════════════════════ */
  async function pinScreen(m) {
    const s = await api.statusOf(m.id);
    const pad = pinPad({
      onPin: async (pin) => { await api.verify(m.id, pin); remember(m.id); memberScreen(m, pin); },
    });
    show(back(), whoHead(m, s.is_in ? `IN since ${hhmm(s.last_check_in)}` : 'currently OUT'),
      prompt(`$ login --user=${m.nickname}`),
      el('h1', { class: 'big' }, 'enter your PIN'),
      pad.node,
      el('p', { class: 'small muted', style: 'text-align:center' }, 'forgot it? ask an admin to reset your PIN.'));
    cleanup = pad.stop;
  }

  /* ── feeling picker ───────────────────────────────────────── */
  function feelingPicker(initial = {}) {
    let emoji = initial.emoji || null;
    const grid = el('div', { class: 'emojis', role: 'group', 'aria-label': 'feeling' });
    const draw = () => grid.replaceChildren(...FEELINGS.map((e) =>
      el('button', { class: `emoji ${e === emoji ? 'on' : ''}`, 'aria-pressed': String(e === emoji), onclick: () => { emoji = emoji === e ? null : e; draw(); } }, e)));
    draw();
    const counter = el('span', { class: 'counter' }, `${(initial.text || '').length}/40`);
    const input = el('input', { type: 'text', maxlength: '40', placeholder: 'say something… (optional)', value: initial.text || '',
      oninput: (e) => { counter.textContent = `${e.target.value.length}/40`; } });
    return {
      node: el('div', {}, el('h2', {}, '// how are you feeling? (optional)'), grid,
        el('label', { class: 'field' }, el('span', { class: 'label' }, '> status message', counter), input)),
      value: () => ({ emoji, text: input.value.trim() }),
    };
  }

  /* ══ after the PIN: check in / feeling / check out ═══════════ */
  async function memberScreen(m, pin) {
    const s = await api.statusOf(m.id);
    const msg = el('div', { class: 'msg', role: 'status' });
    const run = async (fn) => { try { await fn(); } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; } };

    if (!s.is_in) {
      const picker = feelingPicker();
      show(back(home, 'not you?'), whoHead(m, 'currently OUT'),
        prompt(`$ checkin --user=${m.nickname}`),
        picker.node, msg,
        el('button', { class: 'btn primary', onclick: () => run(async () => {
          const f = picker.value();
          const st = await api.checkIn(m.id, pin, f);
          done([`$ checkin --user=${m.nickname}`, '> verifying PIN ........ <ok>OK</ok>', '> writing to lab log ... <ok>OK</ok>',
            f.emoji || f.text ? `> feeling: ${[f.emoji, f.text].filter(Boolean).join(' ')}` : null,
            `<hl>✓ welcome in, ${m.nickname} — ${hhmm(st.last_check_in)}</hl>`, `> ${pick(HELLO)}`]);
        }) }, '▶ CHECK IN'),
        el('div', { class: 'row' },
          el('button', { class: 'linkbtn', onclick: () => profileScreen(m, pin) }, 'edit my look'),
          el('button', { class: 'linkbtn', onclick: () => changePin(m, pin) }, 'change my PIN')));
    } else {
      const picker = feelingPicker({ emoji: s.feeling_emoji, text: s.feeling_text });
      show(back(home, 'not you?'), whoHead(m),
        el('div', { class: 'statusbox' },
          el('div', { class: 'big' }, `IN since ${hhmm(s.last_check_in)}`),
          el('div', { class: 'small muted' }, `${dur(s.last_check_in)} in the lab today`)),
        picker.node, msg,
        el('button', { class: 'btn', onclick: () => run(async () => {
          const f = picker.value();
          await api.setFeeling(m.id, pin, f);
          done([`$ mood --set --user=${m.nickname}`, `> feeling: ${[f.emoji, f.text].filter(Boolean).join(' ') || '(cleared)'}`,
            '<hl>✓ feeling updated</hl>', '> the wall screen shows it now.'], 3);
        }) }, '✎ update feeling'),
        el('button', { class: 'btn danger primary', onclick: () => run(async () => {
          const since = s.last_check_in;
          await api.checkOut(m.id, pin);
          done([`$ checkout --user=${m.nickname}`, '> verifying PIN ........ <ok>OK</ok>', '> writing to lab log ... <ok>OK</ok>',
            `<hl>✓ see you, ${m.nickname} — ${dur(since)} today</hl>`, `> ${pick(BYE)}`]);
        }) }, '◀ CHECK OUT'),
        el('div', { class: 'row' },
          el('button', { class: 'linkbtn', onclick: () => profileScreen(m, pin) }, 'edit my look'),
          el('button', { class: 'linkbtn', onclick: () => changePin(m, pin) }, 'change my PIN')));
    }
    cleanup = guardIdle();
  }

  /* ══ success screen: terminal output, then back home ══════════ */
  function done(lines, seconds = 5) {
    const term = el('div', { class: 'terminal', role: 'status' });
    const bar = el('i'); bar.style.animationDuration = `${seconds}s`;
    show(el('div', { class: 'bigmark' }, '✓'), term,
      el('div', { class: 'countdown' }, bar),
      el('button', { class: 'btn', onclick: home }, 'done'));
    // type the lines out one by one; <ok> and <hl> mark coloured bits
    lines.filter(Boolean).forEach((line, i) => setTimeout(() => {
      const div = el('div');
      line.split(/(<ok>.*?<\/ok>|<hl>.*?<\/hl>)/).forEach((part) => {
        const mOk = part.match(/^<ok>(.*)<\/ok>$/), mHl = part.match(/^<hl>(.*)<\/hl>$/);
        div.append(mOk ? el('span', { class: 'ok' }, mOk[1]) : mHl ? el('span', { class: 'hl' }, mHl[1]) : part);
      });
      term.append(div);
    }, 120 + i * 230));
    const t = setTimeout(home, seconds * 1000);
    cleanup = () => clearTimeout(t);
  }

  /* ══ change PIN (already verified with the old one) ══════════ */
  function changePin(m, oldPin) {
    let first = null;
    const title = el('h1', { class: 'big' }, 'new PIN');
    const hint = el('p', { class: 'small muted', style: 'text-align:center' }, 'choose 6 digits you will remember');
    const pad = pinPad({
      onPin: async (pin) => {
        if (!first) { first = pin; title.textContent = 'type it again'; hint.textContent = 'confirm your new PIN'; setTimeout(pad.reset, 150); return; }
        if (pin !== first) { first = null; title.textContent = 'new PIN'; hint.textContent = 'choose 6 digits you will remember'; throw new Error("didn't match — start again"); }
        await api.changePin(m.id, oldPin, pin);
        done([`$ passwd --user=${m.nickname}`, '> hashing new PIN ..... <ok>OK</ok>', '<hl>✓ PIN changed</hl>', '> use the new one next time.'], 4);
      },
    });
    show(back(() => memberScreen(m, oldPin)), whoHead(m), prompt(`$ passwd --user=${m.nickname}`), title, pad.node, hint);
    const stopIdle = guardIdle();
    cleanup = () => { pad.stop(); stopIdle(); };
  }

  /* ══ avatar builder: pixel face from preset parts, or just initials ══ */
  function avatarBuilder(code, getInitials) {
    const A = LAB.AVATAR;
    let mode = code === null ? 'initials' : 'face';
    let o = A.parse(code || A.random());
    const preview = el('div', { class: 'av-preview', 'aria-hidden': 'true' });
    const iniTag = el('div', { class: 'av-ini' });
    const controls = el('div', { class: 'av-controls' });
    const modeBtns = el('div', { class: 'tabs' });

    function paint() {
      preview.classList.toggle('face', mode === 'face');
      if (mode === 'face') preview.innerHTML = A.svg(A.stringify(o));
      else preview.textContent = getInitials();
      iniTag.textContent = `initials: ${getInitials()}`;
      controls.hidden = mode !== 'face';
      modeBtns.replaceChildren(
        el('button', { type: 'button', class: `tab ${mode === 'face' ? 'on' : ''}`, onclick: () => { mode = 'face'; paint(); } }, 'pixel face'),
        el('button', { type: 'button', class: `tab ${mode === 'initials' ? 'on' : ''}`, onclick: () => { mode = 'initials'; paint(); } }, 'initials only'));
    }
    const stepper = (key, label) => {
      const val = el('span', { class: 'av-val' }, A.NAMES[key][o[key]]);
      const step = (d) => { o[key] = (o[key] + d + A.PARTS[key]) % A.PARTS[key]; val.textContent = A.NAMES[key][o[key]]; paint(); };
      return el('div', { class: 'av-row' }, el('span', { class: 'av-label' }, label),
        el('button', { type: 'button', class: 'av-btn', 'aria-label': `previous ${label}`, onclick: () => step(-1) }, '◀'), val,
        el('button', { type: 'button', class: 'av-btn', 'aria-label': `next ${label}`, onclick: () => step(1) }, '▶'));
    };
    const swatches = (key, label, colors) => {
      const wrap = el('div', { class: 'av-sw' });
      const draw = () => wrap.replaceChildren(...colors.map((c, i) => el('button', {
        type: 'button', class: `sw ${o[key] === i ? 'on' : ''}`, style: `background:${c}`, 'aria-label': `${label} ${i + 1}`,
        onclick: () => { o[key] = i; draw(); paint(); } })));
      draw();
      return el('div', { class: 'av-row' }, el('span', { class: 'av-label' }, label), wrap);
    };
    function build() {
      controls.replaceChildren(
        swatches('skin', 'skin', A.SKINS),
        stepper('hair', 'hair'),
        swatches('hairColor', 'hair color', A.HAIR_COLORS),
        stepper('eyes', 'eyes'),
        stepper('mouth', 'mouth'),
        stepper('extra', 'extra'),
        swatches('bg', 'backdrop', A.BGS),
        el('button', { type: 'button', class: 'btn', onclick: () => { o = A.parse(A.random()); build(); paint(); } }, '🎲 shuffle'));
    }
    build(); paint();
    return {
      node: el('div', { class: 'builder' }, el('h2', {}, '// your avatar'), modeBtns,
        el('div', { class: 'av-top' }, preview, iniTag), controls),
      value: () => (mode === 'face' ? A.stringify(o) : null),
      refresh: paint,
    };
  }

  /* initials input that suggests itself from the nickname until you type your own */
  function initialsField(startValue, nicknameInput, onChange) {
    let touched = !!startValue;
    const auto = () => { const n = (nicknameInput ? nicknameInput.value : '').trim(); return n ? initials(n) : ''; };
    const input = el('input', { type: 'text', maxlength: '3', autocapitalize: 'characters', placeholder: 'e.g. KT', value: startValue || '',
      oninput: (e) => { touched = e.target.value.trim() !== ''; e.target.value = e.target.value.toUpperCase(); onChange(); } });
    if (nicknameInput) nicknameInput.addEventListener('input', () => { if (!touched) { input.value = auto(); onChange(); } });
    return { input, value: () => input.value.trim().toUpperCase() || auto() || '?' };
  }

  /* ══ edit my look (initials + avatar) ═════════════════════════ */
  function profileScreen(m, pin) {
    const msg = el('div', { class: 'msg', role: 'status' });
    let builder;
    const ini = initialsField(m.initials, null, () => builder && builder.refresh());
    builder = avatarBuilder(m.avatar, ini.value);
    show(back(() => memberScreen(m, pin)), whoHead(m), prompt(`$ profile --user=${m.nickname}`),
      el('h1', { class: 'big' }, 'edit my look'),
      el('label', { class: 'field' }, el('span', { class: 'label' }, '> initials'), ini.input,
        el('span', { class: 'hint' }, '1–3 letters · used when there is no picture')),
      builder.node, msg,
      el('button', { class: 'btn primary', onclick: async () => {
        try {
          const updated = await api.setProfile(m.id, pin, { initials: ini.value(), avatar: builder.value() });
          Object.assign(m, updated);
          done([`$ profile --save --user=${m.nickname}`, '> saving look ......... <ok>OK</ok>', '<hl>✓ looking good</hl>', '> the wall screen shows it now.'], 3);
        } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; }
      } }, 'save my look'));
    cleanup = guardIdle();
  }

  /* ══ sign up ══════════════════════════════════════════════════ */
  function signUp() {
    const msg = el('div', { class: 'msg', role: 'status' });
    const f = {
      full: el('input', { type: 'text', autocomplete: 'name', placeholder: 'e.g. Somchai Jaidee' }),
      nick: el('input', { type: 'text', autocomplete: 'nickname', autocapitalize: 'none', placeholder: 'e.g. bank', maxlength: '12' }),
      pos: el('select', {}, el('option', { value: '' }, 'choose…'), ...api.positions.map((p) => el('option', { value: p }, p))),
      pin: el('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6', autocomplete: 'new-password', placeholder: '••••••' }),
      pin2: el('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6', autocomplete: 'new-password', placeholder: '••••••' }),
    };
    const field = (label, input, hint) => el('label', { class: 'field' }, el('span', { class: 'label' }, label), input, hint ? el('span', { class: 'hint' }, hint) : null);
    let builder;
    const ini = initialsField('', f.nick, () => builder && builder.refresh());
    builder = avatarBuilder(LAB.AVATAR.random(), ini.value);
    const submit = async (e) => {
      e.preventDefault();
      if (f.pin.value !== f.pin2.value) { msg.className = 'msg err'; msg.textContent = "PINs don't match"; return; }
      try {
        const m = await api.signUp({ full_name: f.full.value, nickname: f.nick.value, position: f.pos.value, pin: f.pin.value, initials: ini.value(), avatar: builder.value() });
        done([`$ useradd ${m.nickname}`, '> request saved ......... <ok>OK</ok>', '<hl>✓ request sent</hl>',
          '> an admin will approve you soon.', '> then pick your name and use your PIN.'], 7);
      } catch (err) { msg.className = 'msg err'; msg.textContent = err.message; }
    };
    show(back(), prompt('$ useradd --new'), el('h1', { class: 'big' }, 'join the lab board'),
      el('form', { onsubmit: submit, novalidate: true },
        field('> full_name', f.full),
        field('> nickname', f.nick, 'shown on the wall screen · 2–12 letters/numbers'),
        field('> initials', ini.input, 'fills in from your nickname · change it if you like (1–3 letters)'),
        field('> position', f.pos),
        builder.node,
        field('> PIN (6 digits)', f.pin, 'you type this every time you check in'),
        field('> confirm PIN', f.pin2),
        msg,
        el('button', { class: 'btn primary', type: 'submit' }, 'request to join')),
      el('p', { class: 'small muted' }, 'an admin approves new members before they appear on the wall.'));
  }

  /* ══ admin ════════════════════════════════════════════════════ */
  async function adminLogin() {
    const admins = (await api.members()).filter((m) => m.is_admin && m.status === 'active');
    show(back(), prompt('$ sudo -i'), el('h1', { class: 'big' }, 'admin login'),
      el('h2', {}, '// who are you?'),
      el('ul', { class: 'members' }, ...admins.map((m) => el('li', {}, el('button', { class: 'member', onclick: () => adminPin(m) },
        avatarEl(m),
        el('span', { class: 'who' }, el('span', { class: 'nick' }, m.nickname, el('span', { class: 'at' }, '@lab')), el('span', { class: 'pos' }, '[admin]')),
        el('span', { class: 'badge' }, '→'))))));
  }

  function adminPin(m) {
    const pad = pinPad({ onPin: async (pin) => { const session = await api.adminLogin(m.id, pin); adminPanel(session, 'pending'); } });
    show(back(adminLogin), whoHead(m, '[admin]'), prompt(`$ sudo -u ${m.nickname}`), el('h1', { class: 'big' }, 'enter your PIN'), pad.node);
    cleanup = pad.stop;
  }

  /* a button that needs a second tap to confirm */
  function armed(label, onConfirm, cls = 'chip danger') {
    let timer = null;
    const b = el('button', { class: cls, onclick: async () => {
      if (!b.classList.contains('armed')) {
        b.classList.add('armed'); b.textContent = 'tap again';
        timer = setTimeout(() => { b.classList.remove('armed'); b.textContent = label; }, 3000);
        return;
      }
      clearTimeout(timer); await onConfirm();
    } }, label);
    return b;
  }

  async function adminPanel(session, tab) {
    const all = await api.members();
    const pending = all.filter((m) => m.status === 'pending');
    const others = all.filter((m) => m.status !== 'pending').sort((a, b) => a.nickname.localeCompare(b.nickname));
    const msg = el('div', { class: 'msg', role: 'status' });
    const act = async (fn, ok) => {
      try { await fn(); await adminPanel(session, tab); if (ok) { const m2 = $view.querySelector('.msg'); m2.className = 'msg ok'; m2.textContent = ok; } }
      catch (e) { msg.className = 'msg err'; msg.textContent = e.message; if (/log in/.test(e.message)) setTimeout(adminLogin, 1500); }
    };

    const pendingCards = pending.length ? pending.map((m) => el('div', { class: 'card' },
      el('div', { class: 'nick' }, m.nickname, el('span', { class: 'at' }, '@lab')),
      el('div', { class: 'meta' }, `${m.full_name} · ${m.position} · asked ${hhmm(m.created_at)} ${new Date(m.created_at).toLocaleDateString()}`),
      el('div', { class: 'chips' },
        el('button', { class: 'chip', onclick: () => act(() => api.approve(session, m.id), `✓ ${m.nickname} approved`) }, '✓ approve'),
        armed('✕ reject', () => act(() => api.reject(session, m.id), `${m.nickname}'s request removed`)))))
      : [el('div', { class: 'empty' }, '> no requests waiting.')];

    const statusAll = {};
    for (const m of others) statusAll[m.id] = await api.statusOf(m.id);
    const memberCards = others.map((m) => {
      const s = statusAll[m.id], me = m.id === session.id;
      const pinBox = el('div');
      return el('div', { class: `card ${m.status === 'inactive' ? 'inactive' : ''}` },
        el('div', {}, el('span', { class: 'nick' }, m.nickname, el('span', { class: 'at' }, '@lab')), ' ',
          s.is_in ? el('span', { class: 'badge in' }, 'IN') : null, ' ',
          m.is_admin ? el('span', { class: 'badge' }, 'admin') : null, ' ',
          m.status === 'inactive' ? el('span', { class: 'badge' }, 'inactive') : null),
        el('div', { class: 'meta' }, `${m.full_name} · ${m.position}${s.is_in ? ` · in since ${hhmm(s.last_check_in)}` : ''}`),
        el('div', { class: 'chips' },
          s.is_in ? el('button', { class: 'chip', onclick: () => act(() => api.forceCheckOut(session, m.id), `${m.nickname} checked out`) }, '◀ check out') : null,
          el('button', { class: 'chip', onclick: async () => {
            try {
              const pin = await api.resetPin(session, m.id);
              pinBox.replaceChildren(el('div', { class: 'pinshow' }, pin), el('div', { class: 'small muted' }, `new PIN for ${m.nickname} — shown only once. they can change it after logging in.`));
            } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; }
          } }, '⟲ reset PIN'),
          me ? null : m.status === 'active'
            ? armed('deactivate', () => act(() => api.setActive(session, m.id, false), `${m.nickname} deactivated (history kept)`))
            : el('button', { class: 'chip', onclick: () => act(() => api.setActive(session, m.id, true), `${m.nickname} is active again`) }, 'activate'),
          me ? null : m.is_admin
            ? armed('remove admin', () => act(() => api.setAdmin(session, m.id, false), `${m.nickname} is no longer admin`))
            : el('button', { class: 'chip', onclick: () => act(() => api.setAdmin(session, m.id, true), `${m.nickname} is now an admin`) }, 'make admin')),
        pinBox);
    });

    const tabBtn = (key, label) => el('button', { class: `tab ${tab === key ? 'on' : ''}`, onclick: () => adminPanel(session, key) }, label);
    show(
      el('div', { class: 'row', style: 'align-items:center' }, prompt(`$ admin --user=${session.nickname}`),
        el('button', { class: 'linkbtn', style: 'margin-left:auto', onclick: home }, 'log out')),
      el('h1', { class: 'big' }, 'admin panel'),
      el('div', { class: 'tabs' }, tabBtn('pending', `requests [${pending.length}]`), tabBtn('members', `members [${others.length}]`)),
      msg,
      ...(tab === 'pending' ? pendingCards : memberCards),
      api.demo && tab === 'members'
        ? el('div', {}, el('h2', {}, '// demo tools'), armed('reset all demo data', async () => { await api.resetDemo(session); home(); }, 'btn danger'))
        : null,
    );
    cleanup = guardIdle();
  }

  home();
})();
