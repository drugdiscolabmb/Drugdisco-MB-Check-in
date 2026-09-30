# Lab Presence System — Project Plan
> Drug Disco Lab · internal tool · v0.1 planning doc

---

## Overview

A real-time lab presence tracker with two surfaces:
- **Mobile check-in app** — lab members check in/out from their phones
- **Wall dashboard** — monitor connected via Raspberry Pi showing live lab status

The aesthetic is **CMD / terminal style** with soft day-based color themes (not black backgrounds). Monospace fonts, prompt syntax, bracket notation, comment-style labels throughout.

---

## Authentication

**Method:** PIN-based. No external accounts needed.

### Sign-up flow (one time)
1. Enter full name
2. Enter nickname (shown on dashboard)
3. Select position from fixed list
4. Set a 4-digit PIN

**Position list (fixed dropdown):**
`PI` · `Postdoc` · `Researcher` · `PhD Student` · `Master's Student` · `Research Assistant` · `Visitor`

### Daily check-in flow
1. Open app on phone
2. Tap nickname from list (or search)
3. PIN pad appears → enter PIN
4. Optionally set a feeling (emoji + short text)
5. Checked in ✓

### Design decisions
- PIN is 4 digits — fast and familiar
- No email/password dependency
- Anyone who knows your PIN can check you in — intentional, useful in a lab context
- This is a **presence tracker**, not a strict audit system

### Forgotten PINs
- Admin resets manually
- Or: admin deletes account → member re-registers

### Admin controls
- Approve / remove members
- Reset PINs
- Mark members as inactive (left the lab) without deleting history

---

## Data Model

Three collections. Keep them separate — they serve different purposes.

### 1. `members`
Identity and credentials.

| Field | Type | Notes |
|---|---|---|
| `id` | auto string | unique, generated on sign-up |
| `full_name` | string | |
| `nickname` | string | shown on dashboard |
| `position` | enum | from fixed list |
| `pin_hash` | string | **never store plain text** |
| `status` | enum | `active` / `inactive` |
| `created_at` | timestamp | |

### 2. `events`
Immutable log of every check-in and check-out. Never delete.

| Field | Type | Notes |
|---|---|---|
| `id` | auto string | |
| `member_id` | ref → members | |
| `type` | enum | `check_in` / `check_out` |
| `timestamp` | timestamp | |
| `feeling_emoji` | string? | optional, single emoji |
| `feeling_text` | string? | optional, max ~40 chars |

Use this for: attendance history, session duration, analytics, mood history.

### 3. `status`
Lightweight live state per member. Updated on every event. Exists for fast dashboard reads.

| Field | Type | Notes |
|---|---|---|
| `member_id` | ref → members | 1-to-1 |
| `is_in` | boolean | |
| `last_check_in` | timestamp? | |
| `last_check_out` | timestamp? | |
| `feeling_emoji` | string? | clears on check-out |
| `feeling_text` | string? | clears on check-out |

> **Atomicity:** every check-in/out must write to both `events` (append) and `status` (update) together. Use transactions so the dashboard never shows stale state.

---

## Feelings Feature

On check-in, members can optionally express a mood. Shown live on dashboard next to their name.

- **Emoji** — curated set of ~12–15 options (faster to tap than free picker)
- **Short text** — optional, ~40 char max, free text
- Feeling is **optional** — skip it in one tap
- Feeling **clears automatically on check-out**
- Members can **update feeling mid-session** without checking out (updates `status` only, no new event)
- Feeling is **recorded in the event log** for historical fun (e.g. "most used Monday emoji")

---

## Dashboard Design

### Layout
Terminal / CMD aesthetic. Monospace font throughout. Structure:

```
┌─────────────────────────────────────────────────────┐
│ ● ● ●  DRUG_DISCO_LAB — presence.sh        HH:MM:SS │
├─────────────────────────────────────────────────────┤
│ [DAY_NAME]                                          │
│ > "Day motto here"                                  │
├────────────┬────────────┬────────────┬──────────────┤
│ in_lab: 05 │ out: 03    │ total: 08  │ last_event   │
├─────────────────────────────────────────────────────┤
│ // members :: status=IN [5]                         │
│  01  KT  karnt@lab  [phd_student]                   │
│            since 08:12  3h 41m    ☕ // need coffee │
│  02  PY  ploy@lab   [postdoc]                       │
│            since 09:37  2h 16m    🔥 // new results │
│  ...                                                │
├─────────────────────────────────────────────────────┤
│ // members :: status=OUT [3]   (dimmed / 40% opacity│
│  01  MW  mint@lab   [phd_student]   left 11:30      │
│  ...                                                │
├─────────────────────────────────────────────────────┤
│  MON   TUE   WED   THU   FRI   SAT   SUN            │
└─────────────────────────────────────────────────────┘
```

### Terminal language conventions
| Element | Format |
|---|---|
| Username | `karnt@lab` |
| Position | `[phd_student]` |
| Section headers | `// members :: status=IN [5]` |
| Feelings | `// need coffee badly` |
| Motto output | `> "Feel that? That's Friday."` |
| Prompt line | `$ lab --status --day=friday --live` |
| Status badges | `IN` / `OUT` (square corners, monospace) |
| Row index | `01` `02` `03` zero-padded |

### Day themes
Each day gets a unique color accent + motto. The accent color bleeds into: titlebar, day name, live pill, IN count, card left-border, status tags.

| Day | Color | Motto |
|---|---|---|
| Monday | Gray | *"Not sure if it's the end of the world or just monday."* |
| Tuesday | Purple | *"Still not Monday, not yet Wednesday. Limbo."* |
| Wednesday | Blue | *"What a week, huh?"* |
| Thursday | Amber | *"Tomorrow is Friday. Hold on."* |
| Friday | Coral/Red | *"Feel that? That's Friday."* |
| Saturday | Pink | *"Why are you here??"* |
| Sunday | Teal | *"Take a rest!"* |

---

## Suggested Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend / DB | Firebase Firestore | Real-time, handles transactions, generous free tier |
| Auth | Custom PIN (hashed) | No Google dependency, stored in Firestore |
| Mobile UI | PWA (web app) | Works on any phone, no app store needed |
| Dashboard | Web app in Chromium kiosk mode | Runs on Raspberry Pi, auto-refreshes |
| Hosting | Firebase Hosting | Free, fast, same ecosystem |
| Real-time updates | Firestore listeners | Push updates, no polling needed |

---

## Operational Considerations

### Forgotten check-outs
People will forget to check out. Options:
- **Auto check-out at midnight** — safest default
- **Admin manual override** — admin can force check-out
- Session duration caps (e.g. flag sessions > 16h as suspicious)

### Offline resilience
- Raspberry Pi dashboard should show a graceful "reconnecting…" state if internet drops
- Mobile app can queue a check-in locally and sync when back online (Firebase handles this natively)

### Privacy
- Dashboard URL should not be public — restrict to lab network or require a simple shared passphrase
- Event log is internal only
- History is not shown on the dashboard — only current status

### Onboarding new members
- Admin adds them (or open registration with admin approval)
- They sign up via the mobile app URL
- Admin can deactivate accounts when members leave without losing their history

---

## Open Questions / Next Steps

- [ ] Design mobile check-in UI (terminal aesthetic, PIN pad, feeling picker)
- [ ] Decide: open registration or admin-invite only?
- [ ] Decide: emoji set — curated list or free picker?
- [ ] Decide: should the feeling update mid-session write to the event log or just update status silently?
- [ ] Raspberry Pi setup — kiosk mode config, auto-start on boot, screen timeout behaviour
- [ ] Admin panel — what does it look like? Same terminal aesthetic?
