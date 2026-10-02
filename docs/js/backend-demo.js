/* DEMO backend — stores everything in this browser (localStorage).
 *
 * Both the check-in app (app/) and the wall dashboard use this same
 * interface. Later a real database (Supabase) will implement exactly the
 * same functions, so the pages won't need to change — only this file.
 *
 * Because it lives in the browser, demo data is per device: open the app and
 * the dashboard in two tabs of the same browser and they update each other
 * live. A phone and the wall screen will NOT share demo data.
 *
 *   Demo PIN for every seeded member: 123456   (admins: karnt, ittipat)
 *
 * PINs are never stored in plain text: they're salted and hashed (SHA-256).
 */
window.LAB = window.LAB || {};

LAB.createDemoBackend = function () {
  const KEY = 'ddl-demo-v2';
  const MIN = 60 * 1000;
  const MAX_TRIES = 5, LOCK_MS = 30 * 1000;
  const POSITIONS = ((LAB.CONFIG || {}).positions || [{ name: 'Visitor' }]).map((p) => p.name);   // the list lives in config.js
  const listeners = [];
  const tries = {};                                         // member id → { n, until }

  /* ── storage ───────────────────────────────────────────── */
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  let db = load() || seed();
  housekeeping();
  save(false);

  function save(notify = true) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* private mode: keep in memory */ }
    if (notify) emit();
  }
  // another tab (e.g. the app) changed the data → refresh (e.g. the dashboard)
  window.addEventListener('storage', (e) => { if (e.key === KEY) { db = load() || seed(); emit(); } });

  /* ── demo starting data ────────────────────────────────── */
  function seed() {
    const now = Date.now();
    const m = (id, nickname, full_name, position, extra = {}) => ({
      id, nickname, full_name, position, status: 'active', is_admin: false,
      pin_hash: 'plain:123456', salt: '', created_at: now - 30 * 24 * 60 * MIN, ...extra,
    });
    // avatar codes are skin.hair.hairColor.eyes.mouth.extra.bg (see js/avatar.js) — just demo looks
    const members = [
      m('m1', 'ittipat', 'Asst. Prof. Dr. Ittipat', 'PI', { is_admin: true, initials: 'IT', avatar: '1.0.0.0.0.1.0' }),
      m('m2', 'nopphon', 'Dr. Nopphon', 'Researcher', { initials: 'NP', avatar: '2.6.1.1.1.2.2' }),
      m('m3', 'karnt', 'Karnt', 'PhD Student', { is_admin: true, initials: 'KT', avatar: '1.1.0.5.4.4.1' }),
      m('m4', 'meme', 'Meme', "Master's Student", { initials: 'ME', avatar: '0.2.1.2.0.6.5' }),
      m('m5', 'fey', 'Fey', "Master's Student", { initials: 'FY', avatar: '1.4.0.4.1.0.3' }),
      m('m6', 'newbie', 'New Student (demo sign-up)', 'Visitor', { status: 'pending', created_at: now - 2 * 60 * MIN, initials: 'NB', avatar: '2.5.5.1.0.3.7' }),
    ];
    const status = {};
    members.forEach((x) => { status[x.id] = { is_in: false, last_check_in: null, last_check_out: null, feeling_emoji: null, feeling_text: null }; });
    const d = { members, status, events: [] };
    const ev = (minsAgo, id, type, emoji = null, text = null) => {
      const ts = now - minsAgo * MIN;
      if (new Date(ts).toDateString() !== new Date(now).toDateString()) return;   // keep the demo inside today
      d.events.push({ member_id: id, type, timestamp: ts, feeling_emoji: emoji, feeling_text: text });
      Object.assign(d.status[id], type === 'check_in'
        ? { is_in: true, last_check_in: ts, feeling_emoji: emoji, feeling_text: text }
        : { is_in: false, last_check_out: ts, feeling_emoji: null, feeling_text: null });
    };
    ev(290, 'm1', 'check_in', '☕', 'grant deadline this week');
    ev(265, 'm2', 'check_in', '🔥', 'new results!');
    ev(150, 'm1', 'check_out');
    ev(128, 'm5', 'check_in', '🧫', 'cells look happy today');
    ev(96, 'm1', 'check_in', '🎯', 'meetings all afternoon');
    return d;
  }

  /* auto check-out: anyone still "in" from a previous day is checked out at midnight */
  function housekeeping() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    Object.entries(db.status).forEach(([id, s]) => {
      if (s.is_in && s.last_check_in < +today) {
        const end = new Date(s.last_check_in); end.setHours(23, 59, 59, 0);
        db.events.push({ member_id: id, type: 'check_out', timestamp: +end, auto: true });
        Object.assign(s, { is_in: false, last_check_out: +end, feeling_emoji: null, feeling_text: null });
      }
    });
    if (db.events.length > 1000) db.events = db.events.slice(-1000);
  }

  /* ── PINs ──────────────────────────────────────────────── */
  async function hash(pin, salt) {
    const text = `${salt}:${pin}`;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261;                                     // fallback when opened as a local file
    for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return 'fnv' + (h >>> 0).toString(16);
  }
  const newSalt = () => Math.random().toString(36).slice(2, 12);
  const validPin = (pin) => /^\d{6}$/.test(pin);

  async function setPin(m, pin) {
    m.salt = newSalt();
    m.pin_hash = await hash(pin, m.salt);
  }

  async function checkPin(id, pin) {
    const m = member(id);
    const t = tries[id] || (tries[id] = { n: 0, until: 0 });
    if (Date.now() < t.until) {
      throw new Error(`too many tries — wait ${Math.ceil((t.until - Date.now()) / 1000)}s`);
    }
    const ok = m.pin_hash.startsWith('plain:') ? pin === m.pin_hash.slice(6) : (await hash(pin, m.salt)) === m.pin_hash;
    if (!ok) {
      t.n++;
      if (t.n >= MAX_TRIES) { t.n = 0; t.until = Date.now() + LOCK_MS; throw new Error('too many tries — locked for 30s'); }
      throw new Error(`wrong PIN (${MAX_TRIES - t.n} tries left)`);
    }
    t.n = 0;
    if (m.pin_hash.startsWith('plain:')) { await setPin(m, pin); save(false); }   // upgrade demo PINs to hashes
    return m;
  }

  /* ── helpers ───────────────────────────────────────────── */
  function member(id) {
    const m = db.members.find((x) => x.id === id);
    if (!m) throw new Error('member not found');
    return m;
  }
  const autoInitials = (nick) => (nick.length > 1 ? nick[0] + nick[nick.length - 1] : nick).toUpperCase();
  const publicMember = (m) => ({
    id: m.id, nickname: m.nickname, full_name: m.full_name, position: m.position, status: m.status,
    is_admin: m.is_admin, created_at: m.created_at,
    initials: m.initials || autoInitials(m.nickname), avatar: m.avatar || null,
  });
  /* initials: 1–3 characters, no spaces (Thai letters are fine) */
  function cleanInitials(v, nick) {
    const t = (v || '').trim().toUpperCase();
    if (!t) return autoInitials(nick);
    if (!/^\S{1,3}$/u.test(t) || [...t].length > 3) throw new Error('initials: 1–3 letters, no spaces');
    return t;
  }
  function cleanAvatar(v) {
    if (v == null || v === '') return null;
    if (!/^\d{1,2}(\.\d{1,2}){6}$/.test(v)) throw new Error('avatar code looks wrong');
    return v;
  }
  const cleanFeeling = (f = {}) => ({
    emoji: f.emoji || null,
    text: (f.text || '').trim().slice(0, 40) || null,
  });
  function addEvent(id, type, f = {}) {
    const ts = Date.now();
    db.events.push({ member_id: id, type, timestamp: ts, feeling_emoji: f.emoji || null, feeling_text: f.text || null });
    return ts;
  }
  function requireAdmin(session) {
    const m = session && db.members.find((x) => x.id === session.id);
    if (!m || !m.is_admin || m.status !== 'active' || session.key !== db.adminKey) throw new Error('please log in as admin again');
    return m;
  }

  /* ── what the dashboard needs ──────────────────────────── */
  function state() {
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const toDate = (v) => (v == null ? null : new Date(v));
    const status = {};
    Object.entries(db.status).forEach(([id, s]) => {
      status[id] = { ...s, last_check_in: toDate(s.last_check_in), last_check_out: toDate(s.last_check_out) };
    });
    const events = db.events.filter((e) => e.timestamp >= +midnight).map((e) => ({ ...e, timestamp: new Date(e.timestamp) }));
    return {
      members: db.members.map(publicMember),
      status, events,
      lastEvent: events[events.length - 1] || null,
      connected: navigator.onLine,
      demo: true,
    };
  }
  function emit() { const s = state(); listeners.forEach((cb) => cb(s)); }
  window.addEventListener('online', emit);
  window.addEventListener('offline', emit);
  setInterval(() => { const before = JSON.stringify(db.status); housekeeping(); if (JSON.stringify(db.status) !== before) save(); }, 60 * 1000);

  /* optional: random fake activity so the wall looks alive (config.js → demoActivity) */
  if ((LAB.CONFIG || {}).demoActivity) {
    setInterval(() => {
      const active = db.members.filter((x) => x.status === 'active');
      const m = active[Math.floor(Math.random() * active.length)];
      const s = db.status[m.id];
      if (s.is_in) { addEvent(m.id, 'check_out'); Object.assign(s, { is_in: false, last_check_out: Date.now(), feeling_emoji: null, feeling_text: null }); }
      else {
        const e = (LAB.CONFIG.feelings || ['🙂'])[Math.floor(Math.random() * 6)];
        const ts = addEvent(m.id, 'check_in', { emoji: e });
        Object.assign(s, { is_in: true, last_check_in: ts, feeling_emoji: e, feeling_text: null });
      }
      save();
    }, 90 * 1000);
  }

  /* ── public interface ──────────────────────────────────── */
  return {
    name: 'demo',
    demo: true,
    positions: POSITIONS,
    subscribe(cb) { listeners.push(cb); cb(state()); },

    /* everyone (including pending / inactive), without PIN data */
    async members() { return db.members.map(publicMember); },
    async statusOf(id) { const s = db.status[id]; return { ...s }; },

    /* new member asks to join; an admin must approve before they can check in */
    async signUp({ full_name, nickname, position, pin, initials, avatar }) {
      full_name = (full_name || '').trim();
      nickname = (nickname || '').trim().toLowerCase();
      if (full_name.length < 2) throw new Error('please enter your full name');
      if (!/^[a-z0-9_-]{2,12}$/.test(nickname)) throw new Error('nickname: 2–12 letters, numbers, _ or -');
      if (db.members.some((x) => x.nickname === nickname)) throw new Error(`"${nickname}" is already taken`);
      if (!POSITIONS.includes(position)) throw new Error('please choose your position');
      if (!validPin(pin)) throw new Error('PIN must be 6 digits');
      const m = {
        id: 'm' + Date.now().toString(36), full_name, nickname, position, status: 'pending', is_admin: false, created_at: Date.now(),
        initials: cleanInitials(initials, nickname), avatar: cleanAvatar(avatar),
      };
      await setPin(m, pin);
      db.members.push(m);
      db.status[m.id] = { is_in: false, last_check_in: null, last_check_out: null, feeling_emoji: null, feeling_text: null };
      save();
      return publicMember(m);
    },

    /* check the PIN only (to open someone's screen) */
    async verify(id, pin) {
      const m = await checkPin(id, pin);
      if (m.status === 'pending') throw new Error('waiting for admin approval');
      if (m.status !== 'active') throw new Error('this account is inactive — ask an admin');
      return publicMember(m);
    },

    async checkIn(id, pin, feeling) {
      await this.verify(id, pin);
      const s = db.status[id];
      if (s.is_in) throw new Error('already checked in');
      const f = cleanFeeling(feeling);
      const ts = addEvent(id, 'check_in', f);
      Object.assign(s, { is_in: true, last_check_in: ts, feeling_emoji: f.emoji, feeling_text: f.text });
      save();
      return { ...s };
    },

    async checkOut(id, pin) {
      await this.verify(id, pin);
      const s = db.status[id];
      if (!s.is_in) throw new Error('not checked in');
      const ts = addEvent(id, 'check_out');
      Object.assign(s, { is_in: false, last_check_out: ts, feeling_emoji: null, feeling_text: null });
      save();
      return { ...s };
    },

    /* change mood without checking out (status only, not logged as an event) */
    async setFeeling(id, pin, feeling) {
      await this.verify(id, pin);
      const s = db.status[id];
      if (!s.is_in) throw new Error('check in first');
      const f = cleanFeeling(feeling);
      Object.assign(s, { feeling_emoji: f.emoji, feeling_text: f.text });
      save();
      return { ...s };
    },

    /* change your own initials / pixel face */
    async setProfile(id, pin, { initials, avatar }) {
      const m = await checkPin(id, pin);
      m.initials = cleanInitials(initials, m.nickname);
      m.avatar = cleanAvatar(avatar);
      save();
      return publicMember(m);
    },

    async changePin(id, oldPin, newPin) {
      const m = await checkPin(id, oldPin);
      if (!validPin(newPin)) throw new Error('PIN must be 6 digits');
      await setPin(m, newPin);
      save(false);
    },

    /* ── admin ── */
    async adminLogin(id, pin) {
      const m = await checkPin(id, pin);
      if (!m.is_admin || m.status !== 'active') throw new Error('not an admin');
      db.adminKey = db.adminKey || Math.random().toString(36).slice(2);
      save(false);
      return { id: m.id, nickname: m.nickname, key: db.adminKey };
    },
    async approve(session, id) { requireAdmin(session); member(id).status = 'active'; save(); },
    async reject(session, id) {
      requireAdmin(session);
      const m = member(id);
      if (m.status !== 'pending') throw new Error('only pending requests can be rejected');
      db.members = db.members.filter((x) => x.id !== id); delete db.status[id];
      save();
    },
    async setActive(session, id, active) {
      const me = requireAdmin(session);
      if (me.id === id && !active) throw new Error("you can't deactivate yourself");
      const m = member(id);
      m.status = active ? 'active' : 'inactive';
      if (!active && db.status[id].is_in) await this.forceCheckOut(session, id);
      save();
    },
    async setAdmin(session, id, isAdmin) {
      const me = requireAdmin(session);
      if (me.id === id && !isAdmin) throw new Error("you can't remove your own admin rights");
      member(id).is_admin = isAdmin; save();
    },
    /* gives the member a new random PIN, shown once to the admin */
    async resetPin(session, id) {
      requireAdmin(session);
      const pin = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
      await setPin(member(id), pin);
      delete tries[id];
      save(false);
      return pin;
    },
    async forceCheckOut(session, id) {
      requireAdmin(session);
      const s = db.status[id];
      if (!s.is_in) return;
      const ts = addEvent(id, 'check_out');
      Object.assign(s, { is_in: false, last_check_out: ts, feeling_emoji: null, feeling_text: null });
      save();
    },
    async resetDemo(session) { requireAdmin(session); db = seed(); save(); },
  };
};
