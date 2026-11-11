# NEON//TERMINAL · SUNUCU (7/24 MEME bot)

Runs the unchanged MEME engine (meme.js + exec.js + copy.js + pump.js) in headless Chrome on an always-on Linux machine, so the bot keeps trading when the phone page is closed. The phone site becomes a remote control (⚡ MEME → 🖥 SUNUCU).

```
bash server/start.sh     # start (idempotent) — prints the tunnel URL; pairing link in $NEON_DATA/pair-link.txt
bash server/status.sh    # PIDs, tunnel, mode / OTO / equity
bash server/stop.sh      # stop everything (bot state is kept)
```

* Data dir `NEON_DATA` (default `/workspace/neon-bot-data`, chmod 700, **not in the repo**): Chrome profile (localStorage: settings, SIM account, PIN-encrypted bot wallet), `token` (600), `pair-link.txt`, `tunnel-url.txt`, logs.
* `supervise.sh` restarts `server.mjs` 5 s after any exit; `server.mjs` restarts the bot page if it crashes / stops answering for 20 s, and resumes OTO (SIM always; GERÇEK only while the wallet is unlocked).
* Public access: Cloudflare quick tunnel if outbound 7844 works, else LocalToLink (HTTPS :443, no account, links renewed every ~2 h). The URL changes on renewal/restart; the phone finds the new one by itself through an AES-GCM-encrypted message (key and topic derived from the token) on ntfy.sh. `NEON_DISCOVERY=0` disables that.
* Every `/api/*` call needs the token (Bearer header or `t` in a text/plain JSON body — no CORS preflight). The phone uploads only the PIN-encrypted wallet record; the PIN is sent over HTTPS to unlock and is kept in server memory only. After a process restart the wallet is locked and GERÇEK trading stays off until the PIN is entered again from the phone.
* Env: `NEON_PORT` (8899), `NEON_CHROME`, `NEON_SITE`, `NEON_TUNNEL=0`, `NEON_TUNNEL_ORDER=cloudflared,localtolink`.
