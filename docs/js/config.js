/* ─────────────────────────────────────────────────────────────
 *  LAB SETTINGS — safe to edit.
 *  Change a value, save, then Commit + Push in GitHub Desktop.
 *  The wall display picks it up after its next reload.
 * ───────────────────────────────────────────────────────────── */
window.LAB = window.LAB || {};

LAB.CONFIG = {

  /* Animations and effects (boot screen, glitch, scan line, typing…).
     Set to false if the Raspberry Pi ever feels slow or choppy. */
  effects: true,

  /* Emoji choices members can pick as their "feeling" when checking in. */
  feelings: ['☕', '🔥', '🧪', '🧫', '💻', '📚', '🎯', '💪', '🙂', '😴', '🤯', '🥲', '🎉', '🍜'],

  /* Demo mode only: make random fake check-ins every 90 s so the wall looks
     alive. Leave false while testing the check-in app. */
  demoActivity: false,

  /* The time bar on each card is "full" after this many hours in the lab. */
  fullDayHours: 8,

  /* Positions people can pick when they sign up (a fixed list — no typing).
     name = shown in the app's dropdown · tag = shown on the wall, e.g. [phd_student].
     Add, remove or reorder lines here; the app and the wall both use this list. */
  positions: [
    { name: 'PI',                 tag: 'pi' },
    { name: 'Postdoc',            tag: 'postdoc' },
    { name: 'Researcher',         tag: 'researcher' },
    { name: 'PhD Student',        tag: 'phd_student' },
    { name: "Master's Student",   tag: 'masters_student' },
    { name: 'Research Assistant', tag: 'research_asst' },
    { name: 'Intern',             tag: 'intern' },
    { name: 'Visitor',            tag: 'visitor' },
  ],
};
