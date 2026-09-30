/* DEMO data source — real lab members, but made-up check-ins, so the
 * dashboard looks alive before the real database is connected.
 *
 * Every data source (this one, and later the real Supabase one) exposes the
 * same small interface, so dashboard.js never needs to change:
 *
 *   source.subscribe(callback)   callback(state) runs on every change
 *
 *   state = {
 *     members:   [{ id, nickname, full_name, position, status }],
 *     status:    { [member_id]: { is_in, last_check_in, last_check_out,
 *                                 feeling_emoji, feeling_text } },
 *     events:    today's check-ins/outs, oldest first:
 *                [{ member_id, type: 'check_in'|'check_out', timestamp,
 *                   feeling_emoji, feeling_text }],
 *     lastEvent: newest entry of events, or null,
 *     connected: true | false,
 *     demo:      true
 *   }
 * Timestamps are JavaScript Date objects.
 */
window.LAB = window.LAB || {};

LAB.createDemoSource = function () {
  const MIN = 60 * 1000;

  const members = [
    { id: 'm1', nickname: 'ittipat', full_name: 'Asst. Prof. Dr. Ittipat', position: 'PI' },
    { id: 'm2', nickname: 'nopphon', full_name: 'Dr. Nopphon',             position: 'Researcher' },
    { id: 'm3', nickname: 'karnt',   full_name: 'Karnt',                   position: 'PhD Student' },
    { id: 'm4', nickname: 'meme',    full_name: 'Meme',                    position: "Master's Student" },
    { id: 'm5', nickname: 'fey',     full_name: 'Fey',                     position: "Master's Student" },
  ].map((m) => ({ ...m, status: 'active' }));

  /* A made-up day so far (minutes before "now"). */
  const now = Date.now();
  const ev = (minsAgo, id, type, emoji = null, text = null) => ({
    member_id: id, type, timestamp: new Date(now - minsAgo * MIN),
    feeling_emoji: emoji, feeling_text: text,
  });
  const events = [
    ev(292, 'm1', 'check_in',  '☕', 'grant deadline this week'),
    ev(265, 'm2', 'check_in',  '🧪', 'running HPLC all morning'),
    ev(238, 'm3', 'check_in',  '💻', 'docking runs queued'),
    ev(191, 'm4', 'check_in',  '📚', 'thesis writing. do not disturb'),
    ev(152, 'm1', 'check_out'),
    ev(128, 'm5', 'check_in',  '🧫', 'cells look happy today'),
    ev(96,  'm1', 'check_in',  '🎯', 'meetings all afternoon'),
    ev(41,  'm4', 'check_out'),
  ];

  /* Work out everyone's current status by replaying the events. */
  const status = {};
  members.forEach((m) => {
    status[m.id] = { is_in: false, last_check_in: null, last_check_out: null, feeling_emoji: null, feeling_text: null };
  });
  function apply(e) {
    const s = status[e.member_id];
    if (e.type === 'check_in') {
      Object.assign(s, { is_in: true, last_check_in: e.timestamp, feeling_emoji: e.feeling_emoji, feeling_text: e.feeling_text });
    } else {
      Object.assign(s, { is_in: false, last_check_out: e.timestamp, feeling_emoji: null, feeling_text: null });
    }
  }
  events.forEach(apply);
  // nopphon updated his feeling mid-session (changes status only, no event)
  Object.assign(status.m2, { feeling_emoji: '🔥', feeling_text: 'new results!' });

  const listeners = [];
  const state = () => ({
    members, status, events,
    lastEvent: events[events.length - 1] || null,
    connected: navigator.onLine,
    demo: true,
  });
  const emit = () => listeners.forEach((cb) => cb(state()));

  /* Every minute something happens: someone arrives, leaves, or changes mood. */
  const MOODS = [
    ['☕', 'need coffee badly'], ['🔥', 'new results!'], ['🧪', 'column is running'],
    ['🤯', 'reviewer 2 strikes again'], ['😴', 'running on 4h sleep'], ['🍜', 'who wants lunch?'],
    ['💪', 'productive day'], ['🥲', 'experiment failed. again.'], ['🙂', null], [null, null],
  ];
  function randomEvent() {
    const ins = members.filter((m) => status[m.id].is_in);
    const outs = members.filter((m) => !status[m.id].is_in);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const r = Math.random();
    const t = new Date();

    if ((r < 0.4 && outs.length) || ins.length < 2) {
      const f = pick(MOODS);
      const e = { member_id: pick(outs).id, type: 'check_in', timestamp: t, feeling_emoji: f[0], feeling_text: f[1] };
      events.push(e); apply(e);
    } else if (r < 0.7 && ins.length > 2) {
      const e = { member_id: pick(ins).id, type: 'check_out', timestamp: t, feeling_emoji: null, feeling_text: null };
      events.push(e); apply(e);
    } else {
      const f = pick(MOODS);
      Object.assign(status[pick(ins).id], { feeling_emoji: f[0], feeling_text: f[1] });
    }
    emit();
  }

  window.addEventListener('online', emit);
  window.addEventListener('offline', emit);

  return {
    name: 'demo',
    subscribe(cb) {
      listeners.push(cb);
      cb(state());
      if (listeners.length === 1) setInterval(randomEvent, 60 * 1000);
    },
  };
};
