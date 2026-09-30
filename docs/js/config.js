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

  /* The time bar on each card is "full" after this many hours in the lab. */
  fullDayHours: 9,
};
