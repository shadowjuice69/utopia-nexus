#!/bin/sh
set -eu

node /opt/bgutil/server/build/main.js --port 4416 &
POT_PID=$!

cleanup() {
  kill "$POT_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

sleep 1
exec java -jar Lavalink.jar
