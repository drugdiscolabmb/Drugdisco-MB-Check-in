# Drug Disco Lab — Presence System

Live "who's in the lab" board for the Drug Disco Lab.

| Folder | What it is |
|---|---|
| `docs/` | The website (published with GitHub Pages). `index.html` = wall dashboard. |
| `pi-setup/` | Raspberry Pi 3 wall-display setup guide and scripts. |
| `PROJECT.md` | Project plan and design notes. |

## Preview the dashboard

- Online: `https://drugdiscolabmb.github.io/Drugdisco-MB-Check-in/`
- Try other day themes: add `?day=friday` (or `mon`, `tue`, …) to the address.

## Settings

`docs/js/config.js` — turn animations on/off, feeling emoji list. Edit, then Commit + Push in GitHub Desktop.

The dashboard is designed for a **portrait (vertical) screen**. On a normal landscape screen it shows as a centred column.
Each day has its own colour, motto and ASCII animation (see `docs/js/ambient.js`).
Add `?fx=0` to the address to preview it without animations.

The dashboard currently runs on **demo data** (fake members, marked `DEMO DATA` in the title bar).
The real database comes next.

> ⚠️ This repository is public. Never put passwords, PINs or secret keys in these files.
