#!/bin/bash
# Opens the lab dashboard full-screen. Started automatically when the Pi boots.
source "$HOME/lab-kiosk/kiosk.conf"

# Give Wi-Fi a moment to connect after boot
sleep 15

# The browser is called "chromium" on newer Raspberry Pi OS, "chromium-browser" on older
BROWSER="$(command -v chromium || command -v chromium-browser)"

"$BROWSER" --kiosk "$URL" \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --password-store=basic \
  --check-for-update-interval=31536000
