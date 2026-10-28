#!/usr/bin/env bash
cd "$(dirname "$(readlink -f "$0")")"
if [ ! -d .next ] || [ -n "$(find app components lib messages db -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]; then
  npm run build || { read -rp "Build failed. Press Enter to close."; exit 1; }
fi
(sleep 4; xdg-open http://localhost:3000 >/dev/null 2>&1) &
echo "Site: http://localhost:3000  |  LAN: http://192.168.5.236:3000"
echo "Close this window to stop the site."
npx next start -H 0.0.0.0 -p 3000
read -rp "Server stopped. Press Enter to close."
