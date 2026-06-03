#!/usr/bin/env bash
# =============================================================================
#  Sandscape · FBX <-> GLB Converter — one-shot setup (macOS / Linux)
#
#  Installs everything a fresh machine needs to run the app:
#    1. Node.js 20+            (via Homebrew on macOS, apt/snap on Linux)
#    2. Blender 3.6+           (the conversion engine for BOTH directions)
#    3. JS dependencies        (npm install — also applies patch-package patches)
#    4. Local env files        (apps/api/.env, apps/web/.env.local)
#    5. Verifies with doctor
#
#  FBX2glTF is NOT required — Blender now drives FBX->GLB as well; FBX2glTF is
#  only an optional fallback (see SETUP.md). Re-running this script is safe.
#
#  Usage:   bash setup.sh        (or: chmod +x setup.sh && ./setup.sh)
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

bold=$(printf '\033[1m'); green=$(printf '\033[32m'); yellow=$(printf '\033[33m')
red=$(printf '\033[31m'); dim=$(printf '\033[2m'); reset=$(printf '\033[0m')
step() { printf '\n%s==> %s%s\n' "$bold" "$1" "$reset"; }
ok()   { printf '%s  ✓ %s%s\n' "$green" "$1" "$reset"; }
warn() { printf '%s  ! %s%s\n' "$yellow" "$1" "$reset"; }
die()  { printf '%s  ✗ %s%s\n' "$red" "$1" "$reset"; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

OS="$(uname -s)"
printf '%sSandscape FBX <-> GLB Converter — setup (%s)%s\n' "$bold" "$OS" "$reset"

# --------------------------------------------------------------------------
# 1. Node.js 20+
# --------------------------------------------------------------------------
step "Checking Node.js (need 20+)"
node_major() { node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0; }
if have node && [ "$(node_major)" -ge 20 ]; then
  ok "Node $(node -v) already installed"
else
  warn "Node 20+ not found — installing"
  if [ "$OS" = "Darwin" ]; then
    if have brew; then
      brew install node
    else
      die "Homebrew not found. Install it from https://brew.sh then re-run, or install Node 20+ from https://nodejs.org/"
    fi
  else # Linux
    if have snap; then sudo snap install node --classic --channel=20 || true; fi
    if ! { have node && [ "$(node_major)" -ge 20 ]; }; then
      if have apt-get; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs || true
      fi
    fi
    have node && [ "$(node_major)" -ge 20 ] || die "Could not install Node 20+. Install it from https://nodejs.org/ and re-run."
  fi
  ok "Node $(node -v) installed"
fi

# --------------------------------------------------------------------------
# 2. Blender (required — drives both FBX->GLB and GLB->FBX)
# --------------------------------------------------------------------------
step "Checking Blender (need 3.6+)"
blender_found() {
  [ -n "${BLENDER_PATH:-}" ] && [ -x "${BLENDER_PATH}" ] && return 0
  have blender && return 0
  [ "$OS" = "Darwin" ] && [ -x "/Applications/Blender.app/Contents/MacOS/Blender" ] && return 0
  return 1
}
if blender_found; then
  ok "Blender found"
else
  warn "Blender not found — installing"
  if [ "$OS" = "Darwin" ]; then
    if have brew; then brew install --cask blender || true; fi
  else # Linux
    if have snap; then sudo snap install blender --classic || true
    elif have flatpak; then flatpak install -y flathub org.blender.Blender || true
    elif have apt-get; then sudo apt-get update && sudo apt-get install -y blender || true
    fi
  fi
  if blender_found; then ok "Blender installed"
  else warn "Could not auto-install Blender. Install 3.6+ from https://www.blender.org/download/ then re-run (conversions need it)."
  fi
fi

# --------------------------------------------------------------------------
# 3. JS dependencies
# --------------------------------------------------------------------------
step "Installing JavaScript dependencies (npm install)"
npm install
ok "Dependencies installed"

# --------------------------------------------------------------------------
# 4. Local env files (engine paths left blank => auto-detected)
# --------------------------------------------------------------------------
step "Seeding local config"
if [ ! -f apps/api/.env ]; then cp .env.example apps/api/.env; ok "Created apps/api/.env"; else ok "apps/api/.env already exists"; fi
if [ ! -f apps/web/.env.local ]; then cp apps/web/.env.local.example apps/web/.env.local; ok "Created apps/web/.env.local"; else ok "apps/web/.env.local already exists"; fi

# --------------------------------------------------------------------------
# 5. Verify
# --------------------------------------------------------------------------
step "Verifying engines (npm run doctor)"
npm run doctor || warn "doctor reported a problem — see above. Set BLENDER_PATH in apps/api/.env if Blender wasn't detected."

printf '\n%s%sSetup complete.%s  Start the app with:\n\n    %snpm run dev%s   %s(or ./start.sh)%s\n\nThen open %shttp://localhost:3000%s\n' \
  "$bold" "$green" "$reset" "$bold" "$reset" "$dim" "$reset" "$bold" "$reset"
