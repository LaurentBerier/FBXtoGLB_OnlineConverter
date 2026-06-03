#!/usr/bin/env bash
# ===========================================================================
#  Sandscape · FBX <-> GLB Converter - local dev launcher (macOS / Linux)
#  Starts the API (:4000) and the web UI (:3000) together.
#  Does NOT open a browser - open http://localhost:3000 yourself.
#
#  First time on this machine? Run ./setup.sh instead (installs Node + Blender).
# ===========================================================================
set -euo pipefail
cd "$(dirname "$0")"

# First run on this machine? Hand off to setup.sh, which installs Node + Blender,
# the JS dependencies and the local env files.
if [ ! -d node_modules ] || ! command -v node >/dev/null 2>&1; then
  echo "[first run] Running setup.sh (installs Node, Blender & dependencies)..."
  bash ./setup.sh
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js still not on PATH. Open a NEW terminal and run ./start.sh again." >&2
  exit 1
fi

cat <<'EOF'

===========================================================
  Starting servers...
    Web UI : http://localhost:3000   <-- open this manually
    API    : http://localhost:4000/api/health

  Press Ctrl+C to stop both servers.
===========================================================

EOF

npm run dev
