# Raspberry Pi 3 — Wall Display Setup Guide
> Drug Disco Lab · presence dashboard · beginner guide

**The Pi's only job is to show a web page full-screen on the monitor.**
The app and the database live online, so the Pi just needs to get onto the internet and open one address.
You'll do this once. It takes about 1.5–2 hours, most of it waiting for downloads.

---

## Part 0 — What you need

| Item | Notes |
|---|---|
| Raspberry Pi 3 | |
| microSD card, 16 GB or larger | Class 10 / "A1" is ideal. Everything on it will be erased. |
| SD card reader for your laptop | if your laptop has no slot |
| Power supply: **5 V 2.5 A, micro-USB** | A weak phone charger causes random crashes. The official Pi 3 supply is best. |
| HDMI cable | The Pi 3 has a **full-size** HDMI port. Portable monitors often have **mini-HDMI** → you need a mini-HDMI ↔ HDMI cable. A monitor with USB-C input only won't work. |
| Power for the monitor | The Pi can't power the monitor — give it its own charger. |
| USB keyboard + mouse | only needed during setup |
| USB stick | to carry the setup files to the Pi |

---

## Part 1 — Prepare the SD card (on your laptop)

1. Download and install **Raspberry Pi Imager** from https://www.raspberrypi.com/software/
2. Put the microSD card into your laptop and open Raspberry Pi Imager.
3. Choose:
   - **Device:** Raspberry Pi 3
   - **Operating system:** *Raspberry Pi OS* — the one marked **(Recommended)** at the top. It must be a version **with desktop** (not "Lite").
   - **Storage:** your SD card. Double-check it's the SD card and not another drive!
4. When Imager offers **customisation**, fill in:
   - **Hostname:** `labpi`
   - **Localisation:** time zone `Asia/Bangkok`, keyboard layout of your keyboard
   - **Username & password:** e.g. username `lab` and a password you'll remember. **Write them down.**
   - **Wi-Fi:** leave empty / skip. The university Wi-Fi uses a web login page, which we'll do on the Pi itself.
   - **SSH:** you can leave it off for now.
5. Write the card. It takes 5–15 minutes. When Imager says it's done, remove the card.

---

## Part 2 — First boot

1. Put the microSD card into the Pi (slot on the underside, contacts facing the board).
2. Plug in: HDMI to the monitor, keyboard, mouse. Turn the monitor on.
3. **Plug in the Pi's power last.** The Pi has no power button — plugging in turns it on.
4. The first boot is slow (a few minutes, may restart once by itself). Wait until you see the **desktop** with a taskbar at the top.

✅ **Checkpoint:** you see the Raspberry Pi desktop.

> ⚡ If you see a **lightning-bolt icon** in the top-right corner, the power supply is too weak. Replace it before going further.

---

## Part 3 — Get the Pi online

### Option A — LAN cable (recommended, more stable)

1. Plug the LAN cable into the Pi's network port (next to the USB ports). Do this before or after power — either is fine.
2. Wait ~30 seconds. The network icon in the top-right should change to two arrows (wired connection).
3. Open the web browser and go to `https://www.google.com`.
   - **Loads?** You're online — skip to Part 4.
   - **University login page appears instead?** The LAN also needs a login. Log in with your university account, then test Google again.
   - **Nothing loads at all?** The wall socket may be inactive or need the Pi registered. Get the Pi's wired address with `cat /sys/class/net/eth0/address` and ask IT to activate the socket for it.

### Option B — University Wi-Fi (web login page)

1. Click the **network icon** in the top-right of the taskbar.
2. Click the university Wi-Fi network name.
3. Open the web browser (globe icon, top-left).
4. The university login page usually appears by itself. If it doesn't, type this address and press Enter:
   `http://neverssl.com`
   (it must be **http**, not https — this makes the login page pop up)
5. Log in with your university account.
6. Test: open `https://www.google.com`. If it loads, you're online.

✅ **Checkpoint:** Google loads on the Pi.

> ⚠️ **Important — find out how long the login lasts.**
> Many university portals log devices out after some hours, or every day. When that happens, the wall display loses internet until someone logs in again.
> Note the time you logged in, and check tomorrow whether the Pi is still online.
> If it gets logged out, see **Part 7**.

---

## Part 4 — Update the software

1. Open the **Terminal**: click the black `>_` icon on the taskbar, or press `Ctrl` + `Alt` + `T`.
2. Type this command exactly and press Enter:
   ```
   sudo apt update && sudo apt full-upgrade -y
   ```
   - If it asks for a password, type the Pi password from Part 1. **Nothing appears on screen while you type the password — that's normal.** Press Enter.
   - This takes **20–40 minutes** on a Pi 3. Let it finish until you get the `lab@labpi:~ $` prompt back.
3. Restart:
   ```
   sudo reboot
   ```

> If the update fails with network errors, the Wi-Fi login has probably expired. Redo Part 3, step 3–5, then try again.

---

## Part 5 — Turn the Pi into a dashboard display

1. On your **laptop**, copy the whole `pi-setup` folder (the folder this guide is in) onto the **USB stick**.
2. Plug the USB stick into the Pi. A window may pop up asking what to do — just close it.
3. Open the **Terminal** and type:
   ```
   bash /media/$USER/*/pi-setup/setup-kiosk.sh
   ```
   Enter the password if asked. You should see a few lines starting with `==>` and finally **All done.**
4. Remove the USB stick and restart:
   ```
   sudo reboot
   ```

✅ **Checkpoint:** after the desktop appears, wait ~15 seconds. The **lab wall screen** opens full-screen, with no browser bars.

**What the setup script did for you:**
- Installs a colour emoji font, so the members' feeling emojis show properly
- Makes the browser open full-screen automatically every time the Pi starts
- Logs in to the desktop automatically (no password needed at boot)
- Stops the screen from going black after 10 minutes
- Sets the time zone to Bangkok
- Restarts the Pi every day at 05:00 to keep it running smoothly

---

## Part 5b — Turn the screen vertical (portrait)

The dashboard is designed for a monitor standing **upright**.

1. Stand the monitor upright where it will hang.
2. Press `Alt` + `F4` to close the full-screen page so you can see the desktop.
3. Open the Raspberry menu (top-left) → **Preferences** → **Screen Configuration**.
   (On newer Raspberry Pi OS versions this may be called **Control Centre → Screens**.)
4. Right-click the screen (or select it) → **Orientation** → choose **left** or **right** — whichever makes the desktop the right way up.
5. Click **Apply**, then **OK** / **Keep** to confirm. The setting is remembered after restarts.
6. Restart: open Terminal → `sudo reboot`

✅ **Checkpoint:** after the restart, the dashboard fills the upright screen, top to bottom.

---

## Part 6 — Useful things to know

| I want to… | Do this |
|---|---|
| Get out of the full-screen page | Press `Alt` + `F4`. You're back on the desktop. |
| Bring the full-screen page back | Restart: open Terminal → `sudo reboot` |
| Change the web page shown | Terminal → `nano ~/lab-kiosk/kiosk.conf` → edit the line `URL="..."` → press `Ctrl`+`O`, `Enter` to save, `Ctrl`+`X` to exit → `sudo reboot` |
| Turn the Pi off safely | Terminal → `sudo shutdown now`, wait until the green light stops blinking, then unplug. **Don't just pull the plug** — it can corrupt the SD card. |
| Find the Pi's hardware address (MAC) | LAN: `cat /sys/class/net/eth0/address` · Wi-Fi: `cat /sys/class/net/wlan0/address` |

---

## Part 7 — If the Wi-Fi login keeps expiring

Options, best first:

1. **Ask university IT to register the Pi's MAC address** so it doesn't need the login page. Many universities do this for lab devices, printers and displays. Get the MAC address with the command in Part 6 and tell them it's a lab information display.
2. **Ethernet:** if there's a network socket near the monitor spot, a cable is more stable than Wi-Fi. Ask IT whether it also needs registering.
3. **Auto-login script:** the Pi can re-submit the login form by itself. This depends on how your university's login page works — send Claude a screenshot of the login page and we'll build it.
4. **Separate internet:** a cheap 4G pocket Wi-Fi router just for the Pi.

---

## Troubleshooting

| Problem | Try |
|---|---|
| Black screen, nothing at all | Is the monitor on and on the right input? Plug the HDMI in **before** powering the Pi. |
| Rainbow square, then nothing | Weak power supply or a badly written SD card — rewrite it with Imager. |
| Lightning-bolt icon | Power supply too weak. Use a proper 5 V 2.5 A supply. |
| Full-screen page doesn't open after reboot | Wait 30 s. Still nothing → Terminal → `bash ~/lab-kiosk/kiosk.sh` and note any error message for Claude. |
| Page says no internet / shows the university login page | Wi-Fi login expired → `Alt`+`F4`, log in again in the browser (Part 3), then `sudo reboot`. See Part 7 for a permanent fix. |
| Pop-up asking to "unlock keyring" | Shouldn't happen (the script prevents it). If it does, tell Claude. |

---

### Files in this folder
- `PI_SETUP.md` — this guide
- `setup-kiosk.sh` — one-time setup script (Part 5)
- `kiosk.sh` — opens the browser full-screen at boot
- `kiosk.conf` — the web address the display shows
