#!/usr/bin/env bash
# Stop the server (bot page, tunnel, supervisor). The bot state in the profile is kept.
DATA="${NEON_DATA:-/workspace/neon-bot-data}"; touch "$DATA/STOP"
[ -f "$DATA/supervisor.pid" ] && kill -TERM "$(cat "$DATA/supervisor.pid")" 2>/dev/null
[ -f "$DATA/server.pid" ] && kill -TERM "$(cat "$DATA/server.pid")" 2>/dev/null
sleep 3; [ -f "$DATA/cloudflared.pid" ] && kill -TERM "$(cat "$DATA/cloudflared.pid")" 2>/dev/null; echo durduruldu
