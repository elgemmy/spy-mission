#!/usr/bin/env bash
set -euo pipefail

CACHE="${PLAY_SPYMISSION_HOME:-${HOME}/.cache/play-spymission}"
mkdir -p "$CACHE"

if [[ ! -d "${CACHE}/node_modules/puppeteer-core" ]]; then
  cd "$CACHE"
  if [[ ! -f package.json ]]; then
    npm init -y >/dev/null
  fi
  npm install puppeteer-core@latest
fi

echo "ok ${CACHE}"
