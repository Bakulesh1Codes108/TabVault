#!/bin/bash
# Builds TabVault.app (Safari extension) and installs it to ~/Applications.
# Safe by design: never deletes anything. Old builds are moved aside with a timestamp.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"; STAMP=$(date +%Y%m%d-%H%M%S)
BUILD="$ROOT/build"; APP_DEST="$HOME/Applications/TabVault.app"
TEAM="${TEAM:-}"   # optional: TEAM=ABCDE12345 ./build.sh  (permanent signing)

if ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  echo "❌ Full Xcode is required (App Store → Xcode), then run:"
  echo "   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

[ -d "$BUILD" ] && mv "$BUILD" "$ROOT/build-old-$STAMP"

echo "▶ Generating Xcode project…"
xcrun safari-web-extension-converter "$ROOT/extension" \
  --project-location "$BUILD" --app-name TabVault --bundle-identifier com.brane.TabVault \
  --macos-only --swift --copy-resources --no-open --no-prompt

PROJ=$(find "$BUILD" -maxdepth 3 -name "*.xcodeproj" | head -1)
HANDLER=$(find "$BUILD" -name SafariWebExtensionHandler.swift | head -1)
cp "$ROOT/native/SafariWebExtensionHandler.swift" "$HANDLER"

echo "▶ Granting the extension write access to Downloads…"
while IFS= read -r ENT; do
  /usr/libexec/PlistBuddy -c "Add :com.apple.security.files.downloads.read-write bool true" "$ENT" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :com.apple.security.files.downloads.read-write true" "$ENT"
done < <(find "$BUILD" -name "*.entitlements")

SCHEME=$(xcodebuild -list -project "$PROJ" | awk '/Schemes:/{f=1;next} f&&NF{sub(/^ +/,"");print;exit}')
echo "▶ Building scheme: $SCHEME"
if [ -n "$TEAM" ]; then SIGN=(DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates)
else SIGN=(CODE_SIGN_IDENTITY="-" CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="" ENABLE_HARDENED_RUNTIME=NO); fi
xcodebuild -project "$PROJ" -scheme "$SCHEME" -configuration Release \
  -derivedDataPath "$BUILD/DerivedData" "${SIGN[@]}" build | grep -E "error|warning: .*TabVault|BUILD" || true

APP=$(find "$BUILD/DerivedData/Build/Products/Release" -maxdepth 1 -name "*.app" | head -1)
[ -z "$APP" ] && { echo "❌ Build failed – open $PROJ in Xcode to see details."; exit 1; }

mkdir -p "$HOME/Applications"
[ -d "$APP_DEST" ] && mv "$APP_DEST" "$HOME/Applications/TabVault-old-$STAMP.app"
cp -R "$APP" "$APP_DEST"
open "$APP_DEST"
echo "✅ Installed $APP_DEST"
echo "   Safari → Settings → Extensions → tick TabVault (allow on all websites not needed)."
[ -z "$TEAM" ] && echo "   Unsigned build: enable Safari → Develop → 'Allow Unsigned Extensions' (re-enable after each Safari restart)."
