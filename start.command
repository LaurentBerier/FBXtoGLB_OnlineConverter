#!/usr/bin/env bash
# ===========================================================================
#  FBX <-> GLB Converter - local dev launcher (macOS)
#  Starts the API (:4000) and the web UI (:3000) together.
#  Does NOT open a browser - open http://localhost:3000 yourself.
#
#  Run from Terminal:   ./start.command
#  (or double-click it in Finder once it's executable)
# ===========================================================================
set -euo pipefail

# Move to the directory this script lives in, so it works from anywhere.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js was not found on PATH. Install Node 20+ and try again."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[setup] Installing dependencies (first run)..."
  if ! npm install; then
    echo "[ERROR] npm install failed."
    exit 1
  fi
fi

echo
echo "==========================================================="
echo "  Starting servers..."
echo "    Web UI : http://localhost:3000   <-- open this manually"
echo "    API    : http://localhost:4000/api/health"
echo
echo "  Press Ctrl+C to stop both servers."
echo "==========================================================="
echo

exec npm run dev
