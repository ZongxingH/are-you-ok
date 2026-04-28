#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TARGET="${AUOK_AGENT_TARGET:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --agent-target)
      TARGET="${2:-}"
      shift 2
      ;;
    --codex)
      TARGET="codex"
      shift
      ;;
    --claude)
      TARGET="claude"
      shift
      ;;
    --no-agent)
      TARGET="none"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "[1/5] Checking Node.js..."
node --version
npm --version

echo "[2/5] Installing npm dependencies..."
npm install

echo "[2.5/5] Initializing auok home..."
npm run auok -- init

echo "[3/5] Verifying OpenSpec availability..."
if command -v openspec >/dev/null 2>&1; then
  openspec --version
else
  echo "OpenSpec CLI not found. Install it separately when OpenSpec validation is required."
fi

echo "[4/5] Configuring Agent environment..."
if [ -z "$TARGET" ]; then
  if [ -t 0 ]; then
    echo "Choose Agent environment:"
    echo "  1) Codex"
    echo "  2) Claude"
    echo "  3) None"
    printf "Selection [3]: "
    read -r choice
    case "${choice:-3}" in
      1) TARGET="codex" ;;
      2) TARGET="claude" ;;
      3) TARGET="none" ;;
      *) echo "Invalid selection"; exit 1 ;;
    esac
  else
    TARGET="none"
  fi
fi

case "$TARGET" in
  codex)
    bash scripts/install-superpowers-codex.sh
    ;;
  claude)
    bash scripts/install-superpowers-claude.sh
    ;;
  none)
    echo "Skipping Agent-specific Superpowers install."
    ;;
  *)
    echo "Unsupported AUOK_AGENT_TARGET: $TARGET"
    exit 1
    ;;
esac

echo "[5/5] Verifying project..."
npm link || echo "Skipping global auok link; use: npm run auok -- <command>"
npm run verify-env

echo "Bootstrap complete."
