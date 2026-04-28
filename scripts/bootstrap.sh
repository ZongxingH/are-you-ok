#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/4] Checking Node.js..."
node --version
npm --version

echo "[2/4] Installing npm dependencies..."
npm install

echo "[3/4] Initializing auok home..."
npm run auok -- init

echo "[4/4] Verifying project..."
npm run verify-env

echo "Bootstrap complete."
