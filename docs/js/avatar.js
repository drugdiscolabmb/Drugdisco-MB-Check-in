/* Pixel-face avatars (16 × 16, 8-bit style) built from preset parts.
 *
 * An avatar is stored as a short code: "skin.hair.hairColor.eyes.mouth.extra.bg"
 * e.g. "1.3.0.2.1.0.4" — seven numbers, each picking one preset below.
 * LAB.AVATAR.svg(code) turns that into a small SVG picture.
 *
 * Pixel maps: one string per row, 16 characters each.
 *   .  empty        S skin        s skin shadow     H hair      h hair shade
 *   E  eye (dark)   W white       M mouth           C lab coat  c coat shadow
 *   A  extra colour a extra colour 2               K dark outline
 */
window.LAB = window.LAB || {};

(function () {
  const BASE = [
    '................',
    '................',
    '................',
    '.....SSSSSS.....',
    '....SSSSSSSS....',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '..sSSSSSSSSSSs..',
    '..sSSSSSSSSSSs..',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '....SSSSSSSS....',
    '.....SSSSSS.....',
    '......ssss......',
    '..CCCCcSScCCCC..',
    '.CCCCCCccCCCCCC.',
  ];

  const HAIR = {
    'short': [
      '................',
      '....HHHHHHHH....',
      '...HHHHHHHHHH...',
      '..HHHHHHHHHHHH..',
      '..HHhHHHHHHhHH..',
      '..HH........HH..',
    ],
    'spiky': [
      '...H..H..H..H...',
      '...HH.HH.HH.HH..',
      '..HHHHHHHHHHHH..',
      '..HHHHHHHHHHHH..',
      '..HHhHhHHhHhHH..',
      '..H..........H..',
    ],
    'long': [
      '................',
      '....HHHHHHHH....',
      '...HHHHHHHHHH...',
      '..HHHHHHHHHHHH..',
      '..HHHHhhhhHHHH..',
      '..HH........HH..',
      '..HH........HH..',
      '..HH........HH..',
      '..HH........HH..',
      '..HH........HH..',
      '..HH........HH..',
      '...H........H...',
    ],
    'bob': [
      '................',
      '....HHHHHHHH....',
      '...HHHHHHHHHH...',
      '..HHHHHHHHHHHH..',
      '..HHHHHHHHHHHH..',
      '..HHH......HHH..',
      '..HH........HH..',
      '..HH........HH..',
      '..HH........HH..',
      '..HH........HH..',
    ],
    'bun': [
      '......HHHH......',
      '.....HHhhHH.....',
      '....HHHHHHHH....',
      '...HHHHHHHHHH...',
      '..HHHHHHHHHHHH..',
      '..HH........HH..',
    ],
    'curly': [
      '...HH.HHHH.HH...',
      '..HHHHHHHHHHHH..',
      '.HHHhHHhHHhHHHH.',
      '.HHHHHHHHHHHHHH.',
      '.HHhHHHHHHHHhHH.',
      '.HHH........HHH.',
      '.HH..........HH.',
      '.H............H.',
    ],
    'side part': [
      '................',
      '....HHHHHHHH....',
      '...HHHHHHHHHH...',
      '..HHHHHHHHHHHH..',
      '..HHHHHHHHhh.H..',
      '..HHHHHH.....H..',
      '..HH............',
    ],
    'bald': [],
  };

  const EYES = {
    'dots': [[], [], [], [], [], [], [], [],
      '.....E....E.....'],
    'big': [[], [], [], [], [], [], [],
      '.....WE..WE.....',
      '.....EE..EE.....'],
    'happy': [[], [], [], [], [], [], [],
      '.....E....E.....',
      '....E.E..E.E....'],
    'sleepy': [[], [], [], [], [], [], [], [],
      '....EE....EE....'],
    'wink': [[], [], [], [], [], [], [],
      '..........E.....',
      '....EE...EE.....'],
    'sparkle': [[], [], [], [], [], [], [],
      '.....W....W.....',
      '....EEE..EEE....'],
  };

  const MOUTH = {
    'smile': [[], [], [], [], [], [], [], [], [], [],
      '.....M....M.....',
      '......MMMM......'],
    'grin': [[], [], [], [], [], [], [], [], [], [],
      '.....MMMMMM.....',
      '......WWWW......'],
    'flat': [[], [], [], [], [], [], [], [], [], [], [],
      '......MMMM......'],
    'oh': [[], [], [], [], [], [], [], [], [], [],
      '.......MM.......',
      '.......MM.......'],
    'smirk': [[], [], [], [], [], [], [], [], [], [], [],
      '.......MMM.M....'],
  };

  const EXTRA = {
    'none': [],
    'glasses': [[], [], [], [], [], [], [],
      '...AAAA..AAAA...',
      '..AA..AAAA..AA..',
      '...AAAA..AAAA...'],
    'goggles': [[], [], [], [], [], [],
      '..AAAAAAAAAAAA..',
      '.AaaaaaAAaaaaaA.',
      '.AaaaaaAAaaaaaA.',
      '..AAAAAAAAAAAA..'],
    'mask': [[], [], [], [], [], [], [], [], [],
      '..A.aaaaaaaa.A..',
      '...aaaaaaaaaa...',
      '....aaaaaaaa....',
      '.....aaaaaa.....'],
    'headphones': [[], [],
      '....AAAAAAAA....',
      '...A........A...',
      '..A..........A..',
      '..A..........A..',
      '.aA..........Aa.',
      '.aa..........aa.',
      '.aa..........aa.'],
    'party hat': [
      '.......A........',
      '......aAa.......',
      '.....AaAaA......',
      '....aAaAaAa.....'],
    'blush': [[], [], [], [], [], [], [], [], [],
      '....A......A....'],
  };

  const SKINS = ['#f6d6bd', '#ecbf98', '#d6a074', '#a8704a', '#6f452c'];
  const HAIR_COLORS = ['#2b2320', '#5a3a22', '#a0612b', '#e3c16f', '#b9bcc2', '#7c5cc4', '#2f9e8f', '#e05a8a'];
  const EXTRA_COLORS = {
    'glasses': ['#2b2b2b', '#2b2b2b'], 'goggles': ['#3b6fb6', '#cfe6ff'], 'mask': ['#8fb7e0', '#cfe3f7'],
    'headphones': ['#3a3a3a', '#e05a5a'], 'party hat': ['#f0a500', '#e05a8a'], 'blush': ['#f29aa0', '#f29aa0'], 'none': ['#000', '#000'],
  };
  const BGS = ['#dae7f6', '#e7dff7', '#d3ece8', '#f5e6c6', '#f8dcd4', '#f6d9e7', '#e1e5ea', '#d8f0c8'];

  const PARTS = {
    skin: SKINS.length,
    hair: Object.keys(HAIR).length,
    hairColor: HAIR_COLORS.length,
    eyes: Object.keys(EYES).length,
    mouth: Object.keys(MOUTH).length,
    extra: Object.keys(EXTRA).length,
    bg: BGS.length,
  };
  const ORDER = ['skin', 'hair', 'hairColor', 'eyes', 'mouth', 'extra', 'bg'];
  const NAMES = {
    hair: Object.keys(HAIR), eyes: Object.keys(EYES), mouth: Object.keys(MOUTH), extra: Object.keys(EXTRA),
  };

  /* code string ↔ object; anything out of range wraps around, so codes are always safe */
  function parse(code) {
    const n = String(code || '').split('.').map((x) => parseInt(x, 10) || 0);
    const o = {};
    ORDER.forEach((k, i) => { o[k] = ((n[i] || 0) % PARTS[k] + PARTS[k]) % PARTS[k]; });
    return o;
  }
  const stringify = (o) => ORDER.map((k) => o[k] || 0).join('.');
  const random = () => stringify(Object.fromEntries(ORDER.map((k) => [k, Math.floor(Math.random() * PARTS[k])])));
  const isCode = (code) => typeof code === 'string' && /^\d{1,2}(\.\d{1,2}){6}$/.test(code);

  function shade(hex, k) {                                    // darken a colour a little
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(v * (1 - k));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  /* build the picture: 16×16 grid of colours, then merge runs into <rect>s */
  function svg(code, opts = {}) {
    const o = parse(code);
    const grid = Array.from({ length: 16 }, () => Array(16).fill(null));
    const paint = (map, colors) => map.forEach((row, y) => {
      if (typeof row !== 'string') return;
      for (let x = 0; x < 16; x++) { const c = colors[row[x]]; if (c) grid[y][x] = c; }
    });
    const skin = SKINS[o.skin], hair = HAIR_COLORS[o.hairColor];
    const extraName = NAMES.extra[o.extra];
    const [ea, eb] = EXTRA_COLORS[extraName];
    paint(BASE, { S: skin, s: shade(skin, 0.12), C: '#fbfbfb', c: '#cfd5dc' });
    paint(EYES[NAMES.eyes[o.eyes]], { E: '#1e1a18', W: '#ffffff' });
    if (o.skin >= 3) {                                        // darker skin: add a white glint so eyes stand out
      for (let y = 6; y < 10; y++) for (let x = 1; x < 15; x++) {
        if (grid[y][x] === '#1e1a18' && grid[y - 1][x] === skin) grid[y - 1][x] = '#f4efe9';
      }
    }
    paint(MOUTH[NAMES.mouth[o.mouth]], { M: '#7a3b33', W: '#ffffff' });
    if (extraName === 'blush' || extraName === 'mask') paint(EXTRA[extraName], { A: ea, a: eb });
    paint(HAIR[NAMES.hair[o.hair]], { H: hair, h: shade(hair, 0.25) });
    if (extraName !== 'blush' && extraName !== 'mask') paint(EXTRA[extraName], { A: ea, a: eb });

    let rects = '';
    for (let y = 0; y < 16; y++) {
      let x = 0;
      while (x < 16) {
        const c = grid[y][x];
        if (!c) { x++; continue; }
        let w = 1; while (x + w < 16 && grid[y][x + w] === c) w++;
        rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
        x += w;
      }
    }
    const bg = opts.transparent ? '' : `<rect width="16" height="16" fill="${BGS[o.bg]}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges" width="100%" height="100%" aria-hidden="true">${bg}${rects}</svg>`;
  }

  LAB.AVATAR = { svg, parse, stringify, random, isCode, PARTS, ORDER, NAMES, SKINS, HAIR_COLORS, BGS };
})();
