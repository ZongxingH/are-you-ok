#!/usr/bin/env bash
set -euo pipefail

SUPERPOWERS_DIR="${HOME}/.codex/superpowers"
SKILLS_LINK="${HOME}/.agents/skills/superpowers"

if [ "${AUOK_SKIP_SUPERPOWERS_INSTALL:-}" = "1" ]; then
  echo "Skipping Superpowers install because AUOK_SKIP_SUPERPOWERS_INSTALL=1."
  exit 0
fi

mkdir -p "${HOME}/.codex" "${HOME}/.agents/skills"

if [ ! -d "$SUPERPOWERS_DIR/.git" ]; then
  git clone https://github.com/obra/superpowers.git "$SUPERPOWERS_DIR"
else
  git -C "$SUPERPOWERS_DIR" pull --ff-only
fi

if [ ! -e "$SKILLS_LINK" ]; then
  ln -s "$SUPERPOWERS_DIR/skills" "$SKILLS_LINK"
fi

echo "Superpowers installed for Codex."
echo "Restart Codex so skills are discovered."
