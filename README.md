<p align="center">
  <img src="docs/icons/logo.svg" width="96" height="96" alt="Lab check-in logo">
</p>

<h1 align="center">Drug Disco Lab — Check-in</h1>

<p align="center">
  Let the lab know when you're in.<br>
  <b>📱 Check-in app:</b> <a href="https://drugdiscolabmb.github.io/Drugdisco-MB-Check-in/app/">drugdiscolabmb.github.io/Drugdisco-MB-Check-in/app</a><br>
  <b>🖥️ Wall screen:</b> <a href="https://drugdiscolabmb.github.io/Drugdisco-MB-Check-in/">drugdiscolabmb.github.io/Drugdisco-MB-Check-in</a>
</p>

---

## 1. Put the app on your phone

Open the **check-in app** link above on your phone, then add it to your home screen. It then opens like a normal app.

- **iPhone (Safari):** tap **Share** ⬆️ and choose **Add to Home Screen**.
- **Android (Chrome):** tap **⋮** and choose **Add to Home screen** (or **Install app**).

## 2. Join the lab board (first time only)

1. Open the app and tap **+ sign up**.
2. Fill in:
   - **Full name.** Only admins see this.
   - **Nickname.** Shown on the wall screen. Use 2–12 lowercase letters or numbers, e.g. `meme`.
   - **Initials.** Shown on your card, e.g. `ME`.
   - **Position.** Choose from the list.
   - **Avatar.** Build a little pixel face, or choose *initials only*.
   - **PIN.** Pick 6 digits you'll remember. Don't use your birthday or bank PIN.
3. Tap **request to join**.
4. Wait for an admin to approve you. After that, your name appears in the app and on the wall.

## 3. Every day

| When | What to do |
|---|---|
| **Arriving** | Open the app → tap your name → type your PIN → (optional) pick a feeling and write a short status → **▶ CHECK IN** |
| **Mood changes** | Open the app → your name → PIN → pick a new feeling → **✎ update feeling** |
| **Leaving** | Open the app → your name → PIN → **◀ CHECK OUT** |

The app remembers you, so your name is at the top under **continue as**.

**Forgot to check out?** Everyone still checked in at midnight is checked out automatically at 23:59. Your hours for that day will look very long, so please check out when you leave. 🙏

## 4. Your profile

After typing your PIN you'll also see:

- **edit my look:** change your initials or pixel face.
- **change my PIN:** pick a new 6-digit PIN. You type it twice.

**Forgot your PIN?** Ask an admin to reset it. They'll give you a new PIN, which you can change right away.

**"too many tries"?** After 5 wrong PINs, your account is locked for 30 seconds. Then try again.

## 5. The wall screen

The screen by the lab door shows who's **IN** and who's **OUT** today:

- Your **initials**, **avatar**, **nickname** and **position**.
- The time you checked in, and a bar that fills up over an 8-hour day.
- Your feeling emoji and status message.

People walking past can see this screen. It never shows full names, so only write a status you're happy for visitors to read.

Each day of the week has its own color, motto and animation. Mon is drugs, Tue proteins, Wed DNA, Thu cells, Fri neural nets, Sat virus, Sun molecules.

## 6. For admins

Open the app → **⚙ admin** → your name → your PIN.

- **requests:** **✓ approve** or **✕ reject** new sign-ups. Reject asks you to tap twice.
- **members:** for each person you can:
  - **◀ check out:** check them out if they forgot.
  - **⟲ reset PIN:** gives them a new PIN, shown once. Tell it to them in person.
  - **deactivate:** for people who have left the lab. Their history is kept, and you can **activate** them again.
  - **make admin / remove admin.**

The admin panel logs you out by itself after a while.

## Problems?

| What you see | Try this |
|---|---|
| "can't reach the lab database" | Check your Wi-Fi or mobile data, then tap **⟲ try again**. |
| Your name isn't in the list | Your sign-up may still be waiting for approval. Ask an admin. |
| The app or wall looks old after an update | Pull down to refresh. On a computer, press **Ctrl + F5**. |
| Something else | Tell an admin. |

---

<details>
<summary><b>For maintainers</b> (how this is built)</summary>

| Folder / file | What it is |
|---|---|
| `docs/` | The website, published by GitHub Pages. `index.html` is the wall screen and `app/` is the check-in app. |
| `docs/js/config.js` | Settings: Supabase URL and publishable key, feelings list, positions, animations on/off, full-day hours. |
| `docs/icons/` | App logo and icons. `make-logo.py` re-creates them. |
| `supabase/` | Database setup: `setup.sql`, plus a step-by-step guide in `SUPABASE_SETUP.md`. |
| `pi-setup/` | Raspberry Pi 3 wall-display guide and scripts. |
| `PROJECT.md` | Project plan and design notes. |

- **Changing something:** edit the file, then in **GitHub Desktop** click **Commit to main** → **Push origin**. The site updates in about a minute.
- **Preview a day theme:** add `?day=friday` (or `mon`, `tue`, …) to the address. Add `?fx=0` to turn animations off.
- **Demo mode:** add `?demo` to the address to use fake data stored only in that browser. Demo PIN is `123456`.
- **Data:** check-ins are stored in Supabase. You can view and export them in **Table Editor** → `events`.

> ⚠️ This repository is public. Never put passwords, PINs or the Supabase **secret** key in these files. Only the **publishable** key goes in `config.js`.

</details>
