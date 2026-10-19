#!/usr/bin/env bash
# Agent Trace installer.
#   curl -fsSL https://www.davidfromkansas.com/viz/install.sh | bash -s -- claude
#   (use "codex" or "all" in place of "claude")
set -euo pipefail

TARGET="${1:-all}"
BASE="${AGENT_TRACE_BASE:-https://www.davidfromkansas.com/viz/agent-trace}"
DIR="$HOME/.agent-trace"
FILES="server.js hook.js agent-trace.js viewer.html"

case "$TARGET" in claude|codex|all) ;; *) echo "Choose what to install: claude, codex, or all." >&2; exit 1 ;; esac

if ! command -v node >/dev/null 2>&1; then
  echo "Agent Trace needs Node.js 18 or newer. Install it from https://nodejs.org and run this again." >&2
  exit 1
fi
MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$MAJOR" -lt 18 ]; then
  echo "Agent Trace needs Node.js 18 or newer (found $(node -v))." >&2
  exit 1
fi

mkdir -p "$DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for f in $FILES; do
  curl -fsSL "$BASE/$f" -o "$TMP/$f"
done
for f in $FILES; do mv "$TMP/$f" "$DIR/$f"; done

# Stop an older copy of the server so the new one starts next time.
node "$DIR/agent-trace.js" stop >/dev/null 2>&1 || true
node "$DIR/agent-trace.js" install "$TARGET"
