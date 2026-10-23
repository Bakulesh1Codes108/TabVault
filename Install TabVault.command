#!/bin/bash
# Installs TabVault.app into ~/Applications and adds it to the Dock. No Xcode needed.
# Safe: never deletes anything; an older TabVault.app is moved to the Trash (recoverable).
set -euo pipefail
cd "$(dirname "$0")"
DEST="$HOME/Applications/TabVault.app"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$HOME/Applications"
if [ -d "$DEST" ]; then mv "$DEST" "$HOME/.Trash/TabVault-$STAMP.app"; echo "• Old version moved to Trash"; fi

echo "▶ Building TabVault.app…"
osacompile -l JavaScript -o "$DEST" app/TabVault.js

echo "▶ Adding icon…"
if iconutil -c icns app/TabVault.iconset -o "$DEST/Contents/Resources/applet.icns" 2>/dev/null; then
  /usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$DEST/Contents/Info.plist" 2>/dev/null || true
  [ -f "$DEST/Contents/Resources/Assets.car" ] && mv "$DEST/Contents/Resources/Assets.car" "$HOME/.Trash/TabVault-Assets-$STAMP.car" || true
fi
/usr/libexec/PlistBuddy -c "Add :NSAppleEventsUsageDescription string 'TabVault reads your Safari tabs to save them, then closes them.'" "$DEST/Contents/Info.plist" 2>/dev/null || true
codesign --force --sign - "$DEST" >/dev/null 2>&1 || true
touch "$DEST"

echo "▶ Adding to Dock…"
if ! defaults read com.apple.dock persistent-apps 2>/dev/null | grep -q "TabVault.app"; then
  defaults write com.apple.dock persistent-apps -array-add "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>file://$DEST/</string><key>_CFURLStringType</key><integer>15</integer></dict></dict></dict>"
  killall Dock
fi
mkdir -p "$HOME/Downloads/TabVault"
echo
echo "✅ TabVault installed: $DEST  (also in your Dock)"
echo "   Click the Dock icon any time. First run: click OK when macOS asks to let TabVault control Safari."
