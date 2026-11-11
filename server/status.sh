#!/usr/bin/env bash
DATA="${NEON_DATA:-/workspace/neon-bot-data}"
for n in supervisor server tunnel; do p=$(cat "$DATA/$n.pid" 2>/dev/null); printf "%-12s %s %s\n" "$n" "${p:--}" "$( [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo çalışıyor || echo YOK)"; done
echo "tünel: $(cat "$DATA/tunnel-url.txt" 2>/dev/null)"
curl -s -m 10 -H "authorization: Bearer $(cat "$DATA/token")" http://127.0.0.1:${NEON_PORT:-8899}/api/status | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s),x=j.snap||{};console.log("mod",x.mode,"· OTO",x.on?"AÇIK":"kapalı","· equity",x.equity,"· açık poz",(x.pos||[]).length,"· işlem",x.trades,"· sayfa",j.srv.page,"· yeniden yükleme",j.srv.reloads)}catch(e){console.log("API cevap yok")}})'
