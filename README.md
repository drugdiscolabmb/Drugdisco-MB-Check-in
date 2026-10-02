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

## Check-in app (phones)

`docs/app/` — members open `https://drugdiscolabmb.github.io/Drugdisco-MB-Check-in/app/` on their phone,
pick their name, type their 6-digit PIN, and check in / update their feeling / check out.
New members sign up there too; an admin approves them in the app's **admin** screen.

**Demo mode (for now):** data is stored in the browser only, so the app and the wall dashboard
only share data when opened in the same browser (e.g. two tabs on one laptop).
Demo PIN for every member: `123456` · admins: `karnt`, `ittipat`.
The real shared database (Supabase) replaces `docs/js/backend-demo.js` next.

## Settings

`docs/js/config.js` — turn animations on/off, feeling emoji list. Edit, then Commit + Push in GitHub Desktop.

The dashboard is designed for a **portrait (vertical) screen**. On a normal landscape screen it shows as a centred column.
Each day has its own colour, motto and ASCII animation (see `docs/js/ambient.js`).
Add `?fx=0` to the address to preview it without animations.

The dashboard currently runs on **demo data** (fake members, marked `DEMO DATA` in the title bar).
The real database comes next.

> ⚠️ This repository is public. Never put passwords, PINs or secret keys in these files.
