#!/usr/bin/env bash
# =============================================================================
#  Sandscape · FBX <-> GLB Converter — macOS double-click setup
#
#  Finder runs ".command" files in Terminal on double-click. This just runs the
#  real setup script (setup.sh) from this folder, then waits so the window stays
#  open to show the result.
# =============================================================================
cd "$(dirname "$0")"
bash ./setup.sh
status=$?
echo
read -n 1 -s -r -p "Setup finished (exit $status) — press any key to close."
echo
exit $status
