/* Day themes: accent colour + motto for each day of the week.
 * Index matches JavaScript's Date.getDay(): 0 = Sunday … 6 = Saturday.
 *
 *   bg      page background (soft tint, never black)
 *   surface terminal window background
 *   line    borders / dividers
 *   accent  main day colour (dots, borders, big day name)
 *   ink     darker accent, used for small accent-coloured text (readable)
 *   soft    very light accent tint (badges, avatars)
 */
window.LAB = window.LAB || {};

LAB.THEMES = [
  { key: 'sunday',    name: 'SUNDAY',    motto: 'Take a rest!',
    bg: '#e6f2f0', surface: '#f7fbfa', line: '#c9e0dc', accent: '#1f8a7d', ink: '#146458', soft: '#d3ece8' },
  { key: 'monday',    name: 'MONDAY',    motto: "Not sure if it's the end of the world or just monday.",
    bg: '#eceef1', surface: '#f9fafb', line: '#d5d9df', accent: '#66717f', ink: '#434c57', soft: '#e1e5ea' },
  { key: 'tuesday',   name: 'TUESDAY',   motto: 'Still not Monday, not yet Wednesday. Limbo.',
    bg: '#efebf8', surface: '#faf8fd', line: '#dcd3f0', accent: '#7c5cc4', ink: '#5a3fa0', soft: '#e7dff7' },
  { key: 'wednesday', name: 'WEDNESDAY', motto: 'What a week, huh?',
    bg: '#e8f0f9', surface: '#f8fbfe', line: '#cfdff1', accent: '#2f6fb5', ink: '#1f5390', soft: '#dae7f6' },
  { key: 'thursday',  name: 'THURSDAY',  motto: 'Tomorrow is Friday. Hold on.',
    bg: '#f7f0e1', surface: '#fdfaf3', line: '#ecdcb9', accent: '#a36b12', ink: '#7f5610', soft: '#f5e6c6' },
  { key: 'friday',    name: 'FRIDAY',    motto: "Feel that? That's Friday.",
    bg: '#faebe6', surface: '#fef9f7', line: '#f1d2c8', accent: '#d4533b', ink: '#a63a25', soft: '#f8dcd4' },
  { key: 'saturday',  name: 'SATURDAY',  motto: 'Why are you here??',
    bg: '#faeaf2', surface: '#fef8fb', line: '#f0cfe0', accent: '#c94f86', ink: '#9c3464', soft: '#f6d9e7' },
];

/* Apply a theme by writing CSS variables onto <html>. */
LAB.applyTheme = function (theme) {
  const r = document.documentElement.style;
  r.setProperty('--bg', theme.bg);
  r.setProperty('--surface', theme.surface);
  r.setProperty('--line', theme.line);
  r.setProperty('--accent', theme.accent);
  r.setProperty('--accent-ink', theme.ink);
  r.setProperty('--accent-soft', theme.soft);
  document.documentElement.dataset.day = theme.key;
};
