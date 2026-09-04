#!/usr/bin/env bash
set -euo pipefail

CACHE="${PLAY_SPYMISSION_HOME:-${HOME}/.cache/play-spymission}"
PUPPETEER_VERSION="${PLAY_SPYMISSION_PUPPETEER_VERSION:-25.10.0}"
mkdir -p "$CACHE"

if [[ ! -d "${CACHE}/node_modules/puppeteer-core" ]]; then
  cd "$CACHE"
  if [[ ! -f package.json ]]; then
    npm init -y >/dev/null
  fi
  npm install --save-exact "puppeteer-core@${PUPPETEER_VERSION}"
fi

echo "ok ${CACHE}"
