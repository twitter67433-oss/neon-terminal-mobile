#!/usr/bin/env bash
# Keeps server.mjs running: restarts it 5 s after any exit. Single instance (flock). Started by start.sh.
DATA="${NEON_DATA:-/workspace/neon-bot-data}"; HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DATA"; chmod 700 "$DATA"
exec 9>"$DATA/supervisor.lock"; flock -n 9 || { echo "supervisor zaten çalışıyor"; exit 0; }
echo $$ > "$DATA/supervisor.pid"
trap 'kill -TERM "$child" 2>/dev/null; wait "$child"; rm -f "$DATA/supervisor.pid"; exit 0' TERM INT
while :; do
  [ -f "$DATA/STOP" ] && { rm -f "$DATA/supervisor.pid"; exit 0; }
  node "$HERE/server.mjs" >>"$DATA/stdout.log" 2>&1 &
  child=$!; wait "$child"; code=$?
  echo "$(date -Is) server.mjs exited ($code) — restart in 5 s" >>"$DATA/stdout.log"
  [ -f "$DATA/STOP" ] && { rm -f "$DATA/supervisor.pid"; exit 0; }
  [ $(stat -c %s "$DATA/stdout.log" 2>/dev/null || echo 0) -gt 5000000 ] && mv -f "$DATA/stdout.log" "$DATA/stdout.log.1"
  sleep 5
done
