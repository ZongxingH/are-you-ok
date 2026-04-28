#!/usr/bin/env bash
set -euo pipefail

command -v node >/dev/null
command -v npm >/dev/null

HOME_DIR="${AUOK_HOME:-auok}"

test -d "${HOME_DIR}/openspec/specs"
if [ -d "${HOME_DIR}/orchestration/workflows" ]; then
  test -d "${HOME_DIR}/orchestration/workflows"
else
  test -d "${HOME_DIR}/agent-orchestration/workflows"
fi
test -f "AGENTS.md"
test -f "harness/cli/main.js"

npm run auok -- validate --all
npm run auok -- --help >/dev/null

echo "Environment OK."
