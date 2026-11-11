#!/usr/bin/env bash
# Start the 24/7 MEME bot server (idempotent). Prints the pairing link once the tunnel is up.
DATA="${NEON_DATA:-/workspace/neon-bot-data}"; HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DATA"; chmod 700 "$DATA"; rm -f "$DATA/STOP"
if [ -f "$DATA/supervisor.pid" ] && kill -0 "$(cat "$DATA/supervisor.pid")" 2>/dev/null; then echo "zaten çalışıyor (supervisor $(cat "$DATA/supervisor.pid"))";
else rm -f "$DATA/pair-link.txt" "$DATA/tunnel-url.txt"; setsid nohup bash "$HERE/supervise.sh" >/dev/null 2>&1 < /dev/null & echo "başlatıldı"; fi
for i in $(seq 1 120); do [ -s "$DATA/pair-link.txt" ] && break; sleep 1; done
echo "tünel: $(cat "$DATA/tunnel-url.txt" 2>/dev/null)"; echo "eşleşme linki dosyası: $DATA/pair-link.txt"
