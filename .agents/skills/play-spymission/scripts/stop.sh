#!/usr/bin/env bash
set -euo pipefail

CACHE="${PLAY_SPYMISSION_HOME:-${HOME}/.cache/play-spymission}"
PID_PATH="${CACHE}/watch.pid"

if [[ ! -f "${PID_PATH}" ]]; then
  echo "No Spy Mission watcher is running."
  exit 0
fi

PID="$(tr -d '[:space:]' < "${PID_PATH}")"
if [[ ! "${PID}" =~ ^[0-9]+$ ]] || ! kill -0 "${PID}" 2>/dev/null; then
  rm -f "${PID_PATH}"
  echo "Removed a stale Spy Mission watcher record."
  exit 0
fi

COMMAND="$(ps -p "${PID}" -o command= 2>/dev/null || true)"
if [[ "${COMMAND}" != *"watch.mjs"* ]]; then
  echo "Refusing to stop PID ${PID}; it is not a Spy Mission watcher." >&2
  exit 1
fi

kill -TERM "${PID}"
for _ in {1..50}; do
  if ! kill -0 "${PID}" 2>/dev/null; then
    rm -f "${PID_PATH}"
    echo "Stopped the Spy Mission watcher."
    exit 0
  fi
  sleep 0.1
done

echo "The Spy Mission watcher did not stop cleanly." >&2
exit 1
