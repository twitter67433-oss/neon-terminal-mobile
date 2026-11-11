#!/usr/bin/env bash
# Independent tunnel watchdog: if the public tunnel URL stops answering /api/ping (e.g. LocalToLink link expired → 410),
# kill the tunnel process; server.mjs then opens a new tunnel and publishes the new URL. Single instance (flock).
DATA="${NEON_DATA:-/workspace/neon-bot-data}"
exec 8>"$DATA/tunnel-watch.lock"; flock -n 8 || exit 0
fails=0
while :; do
  [ -f "$DATA/STOP" ] && exit 0
  sleep 45
  u=$(cat "$DATA/tunnel-url.txt" 2>/dev/null); [ -z "$u" ] && continue
  c=$(curl -s -m 15 -o /dev/null -w "%{http_code}" "$u/api/ping")
  if [ "$c" = "200" ]; then fails=0; else fails=$((fails+1)); fi
  if [ $fails -ge 2 ]; then
    echo "$(date -Is) tunnel-watch: $u -> HTTP $c, restarting tunnel" >>"$DATA/stdout.log"
    p=$(cat "$DATA/tunnel.pid" 2>/dev/null); [ -n "$p" ] && { kill -TERM -"$p" 2>/dev/null || kill -TERM "$p" 2>/dev/null; }
    fails=0; sleep 60
  fi
done
