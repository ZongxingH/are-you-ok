#!/usr/bin/env bash
set -euo pipefail

SUPERPOWERS_DIR="${HOME}/.claude/superpowers"

if [ "${AUOK_SKIP_SUPERPOWERS_INSTALL:-}" = "1" ]; then
  echo "Skipping Superpowers install because AUOK_SKIP_SUPERPOWERS_INSTALL=1."
  exit 0
fi

mkdir -p "${HOME}/.claude"

if [ ! -d "$SUPERPOWERS_DIR/.git" ]; then
  git clone https://github.com/obra/superpowers.git "$SUPERPOWERS_DIR"
else
  git -C "$SUPERPOWERS_DIR" pull --ff-only
fi

cat > "${HOME}/.claude/AUOK_SUPERPOWERS.md" <<EOF
# auok Superpowers Notes

Superpowers has been cloned to:

${SUPERPOWERS_DIR}

Claude Code integration varies by local setup. Use the project's AGENTS.md,
superpowers/usage.md, and the cloned Superpowers materials as behavior guidance.
EOF

echo "Superpowers materials installed for Claude at ${SUPERPOWERS_DIR}."
echo "Review ${HOME}/.claude/AUOK_SUPERPOWERS.md for local Claude setup notes."
