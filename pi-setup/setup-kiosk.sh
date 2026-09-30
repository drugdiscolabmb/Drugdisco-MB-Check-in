#!/bin/bash
# One-time setup: turns this Pi into a full-screen dashboard display.
# Run with:  bash /media/$USER/*/pi-setup/setup-kiosk.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/lab-kiosk"

echo "==> Copying kiosk files to $DEST"
mkdir -p "$DEST"
cp "$HERE/kiosk.sh" "$DEST/kiosk.sh"
chmod +x "$DEST/kiosk.sh"
if [ ! -f "$DEST/kiosk.conf" ]; then
  cp "$HERE/kiosk.conf" "$DEST/kiosk.conf"
else
  echo "    (kept your existing kiosk.conf)"
fi

echo "==> Installing the colour emoji font (for the feelings on the dashboard)"
sudo apt install -y fonts-noto-color-emoji

echo "==> Starting the dashboard automatically at login"
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/lab-kiosk.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Lab Kiosk
Exec=$DEST/kiosk.sh
X-GNOME-Autostart-enabled=true
DESKTOP

echo "==> Logging in to the desktop automatically on boot"
sudo raspi-config nonint do_boot_behaviour B4

echo "==> Keeping the screen on (no blanking)"
sudo raspi-config nonint do_blanking 1

echo "==> Setting time zone to Asia/Bangkok"
sudo timedatectl set-timezone Asia/Bangkok

echo "==> Restarting the Pi every day at 05:00 (keeps it fresh)"
( sudo crontab -l 2>/dev/null | grep -v 'lab-kiosk-reboot' ; \
  echo '0 5 * * * /sbin/shutdown -r now # lab-kiosk-reboot' ) | sudo crontab -

echo
echo "All done. Restart the Pi with:  sudo reboot"
echo "The dashboard page should open full-screen about 15 seconds after the desktop appears."
