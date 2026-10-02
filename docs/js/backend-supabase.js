/* REAL backend — the lab's Supabase database.
 *
 * Same functions as js/backend-demo.js, so the app and the wall dashboard
 * work with either one. It's switched on by filling in supabaseUrl and
 * supabaseKey in js/config.js (see js/backend.js).
 *
 * The website never touches the tables directly. It only calls the database
 * functions in supabase/setup.sql, and those check the PIN (or the admin
 * session) inside the database. That's why the "publishable" key in
 * config.js is safe to have in a public repo.
 */
window.LAB = window.LAB || {};

LAB.createSupabaseBackend = function (url, key) {
  const BASE = url.replace(/\/+$/, '') + '/rest/v1/rpc/';
  const POLL_MS = 10 * 1000;                     // the wall checks for changes every 10 s
  const POSITIONS = ((LAB.CONFIG || {}).positions || [{ name: 'Visitor' }]).map((p) => p.name);
  const listeners = [];
  let board = null, boardAt = 0, connected = true;

  /* call one database function; turns {ok:false, error} into a normal error */
  async function rpc(fn, args = {}) {
    let res;
    try {
      res = await fetch(BASE + fn, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        cache: 'no-store',
      });
    } catch (e) {
      throw new Error('no connection — check the Wi-Fi and try again');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const why = (data && (data.message || data.hint)) || res.statusText;
      throw new Error(`database error (${res.status}): ${why}`);
    }
    if (data && data.ok === false) throw new Error(data.error || 'something went wrong');
    return data;
  }

  const ms = (v) => (v == null ? null : Date.parse(v));
  const statusMs = (s) => ({
    is_in: !!(s && s.is_in),
    last_check_in: ms(s && s.last_check_in),
    last_check_out: ms(s && s.last_check_out),
    feeling_emoji: (s && s.feeling_emoji) || null,
    feeling_text: (s && s.feeling_text) || null,
  });
  const fullName = (m) => ({ ...m, full_name: m.full_name || '' });

  /* the public board: active members + live status + today's events */
  async function loadBoard(maxAgeMs = 0) {
    if (board && Date.now() - boardAt <= maxAgeMs) return board;
    board = await rpc('board');
    boardAt = Date.now();
    return board;
  }

  /* shape the dashboard expects (same as the demo backend) */
  function state() {
    const b = board || { members: [], status: {}, events: [] };
    const toDate = (v) => (v == null ? null : new Date(v));
    const status = {};
    b.members.forEach((m) => {
      const s = statusMs(b.status[m.id]);
      status[m.id] = { ...s, last_check_in: toDate(s.last_check_in), last_check_out: toDate(s.last_check_out) };
    });
    const events = (b.events || []).map((e) => ({ ...e, timestamp: new Date(e.timestamp) }));
    return {
      members: b.members.map(fullName),
      status, events,
      lastEvent: events[events.length - 1] || null,
      connected: connected && navigator.onLine,
      demo: false,
    };
  }
  function emit() { const s = state(); listeners.forEach((cb) => cb(s)); }

  let pollTimer = null;
  async function poll() {
    clearTimeout(pollTimer);
    try { await loadBoard(); connected = true; }
    catch (e) { connected = false; }
    emit();
    pollTimer = setTimeout(poll, POLL_MS);
  }
  window.addEventListener('online', poll);
  window.addEventListener('offline', emit);
  // a tab that was hidden (phone in pocket, screen off) refreshes when it comes back
  document.addEventListener('visibilitychange', () => { if (!document.hidden && listeners.length) poll(); });

  /* after any change, refresh the wall data right away (if this page shows it) */
  const changed = () => { boardAt = 0; if (listeners.length) poll(); };

  return {
    name: 'supabase',
    demo: false,
    positions: POSITIONS,
    subscribe(cb) { listeners.push(cb); if (listeners.length === 1) poll(); else cb(state()); },

    /* is the database empty? (then the app shows the "first admin" setup) */
    async setupNeeded() { return !!(await loadBoard()).setup_needed; },
    async setupFirstAdmin({ full_name, nickname, position, pin, initials, avatar }) {
      const r = await rpc('setup_first_admin', {
        p_full_name: full_name || '', p_nickname: nickname || '', p_initials: initials || '',
        p_position: position || '', p_pin: pin || '', p_avatar: avatar || null,
      });
      changed();
      return { id: r.id, nickname: r.nickname };
    },

    /* active members (no full names — those are only for admins) */
    async members() { return (await loadBoard(2000)).members.map(fullName); },
    async statusOf(id) { return statusMs((await loadBoard(2000)).status[id]); },

    async signUp({ full_name, nickname, position, pin, initials, avatar }) {
      const r = await rpc('sign_up', {
        p_full_name: full_name || '', p_nickname: nickname || '', p_initials: initials || '',
        p_position: position || '', p_pin: pin || '', p_avatar: avatar || null,
      });
      return { id: r.id, nickname: r.nickname };
    },
    async verify(id, pin) { await rpc('verify', { p_id: id, p_pin: pin }); },

    async checkIn(id, pin, feeling = {}) {
      const r = await rpc('check_in', { p_id: id, p_pin: pin, p_emoji: feeling.emoji || null, p_text: feeling.text || null });
      changed();
      return statusMs(r.status);
    },
    async checkOut(id, pin) {
      const r = await rpc('check_out', { p_id: id, p_pin: pin });
      changed();
      return statusMs(r.status);
    },
    async setFeeling(id, pin, feeling = {}) {
      const r = await rpc('set_feeling', { p_id: id, p_pin: pin, p_emoji: feeling.emoji || null, p_text: feeling.text || null });
      changed();
      return statusMs(r.status);
    },
    async setProfile(id, pin, { initials, avatar }) {
      const r = await rpc('set_profile', { p_id: id, p_pin: pin, p_initials: initials || '', p_avatar: avatar || null });
      changed();
      return { initials: r.initials, avatar: r.avatar };
    },
    async changePin(id, oldPin, newPin) { await rpc('change_pin', { p_id: id, p_old: oldPin, p_new: newPin }); },

    /* ── admin (session = what adminLogin returned) ── */
    async adminLogin(id, pin) { const r = await rpc('admin_login', { p_id: id, p_pin: pin }); return { id: r.id, nickname: r.nickname, key: r.key }; },
    /* everyone, including pending and inactive, with full names and live status */
    async adminMembers(session) {
      const r = await rpc('admin_members', { p_token: session.key });
      return r.members.map((m) => ({ ...m, created_at: ms(m.created_at), state: statusMs(m.state) }));
    },
    async approve(session, id) { await rpc('admin_approve', { p_token: session.key, p_id: id }); changed(); },
    async reject(session, id) { await rpc('admin_reject', { p_token: session.key, p_id: id }); changed(); },
    async setActive(session, id, active) { await rpc('admin_set_active', { p_token: session.key, p_id: id, p_active: !!active }); changed(); },
    async setAdmin(session, id, isAdmin) { await rpc('admin_set_admin', { p_token: session.key, p_id: id, p_admin: !!isAdmin }); changed(); },
    async resetPin(session, id) { return (await rpc('admin_reset_pin', { p_token: session.key, p_id: id })).pin; },
    async forceCheckOut(session, id) { await rpc('admin_force_checkout', { p_token: session.key, p_id: id }); changed(); },
  };
};
