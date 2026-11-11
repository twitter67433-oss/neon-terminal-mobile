// NEON//TERMINAL v7 — SUNUCU: runs the MEME bot 24/7 on an always-on machine and exposes a token-protected remote-control API.
// The bot is the unchanged web app (meme.js + exec.js + copy.js + pump.js …) running in headless Chrome with a persistent profile,
// so settings, the SIM account and the PIN-encrypted bot wallet persist in that profile's localStorage (outside the repo).
// The phone reaches it through a Cloudflare quick tunnel (https://<random>.trycloudflare.com, no account). Every /api call needs the token.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright-core")); } catch { ({ chromium } = require("/workspace/crypto-terminal/tools/node_modules/playwright-core")); }

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");
const DATA = process.env.NEON_DATA || "/workspace/neon-bot-data";
const PORT = +(process.env.NEON_PORT || 8899);
const CHROME = process.env.NEON_CHROME || "/usr/bin/google-chrome";
const SITE = process.env.NEON_SITE || "https://twitter67433-oss.github.io/neon-terminal-mobile/";
const TUNNEL = process.env.NEON_TUNNEL !== "0";
fs.mkdirSync(DATA, { recursive: true, mode: 0o700 }); try { fs.chmodSync(DATA, 0o700); } catch {}
const F = n => path.join(DATA, n);
const wsecret = (n, s) => { fs.writeFileSync(F(n), s, { mode: 0o600 }); fs.chmodSync(F(n), 0o600); };

/* ---------------- log ---------------- */
const LOG = F("server.log");
function log(...a){ const line = new Date().toISOString() + " " + a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ") + "\n";
  try { if (fs.existsSync(LOG) && fs.statSync(LOG).size > 5e6) fs.renameSync(LOG, LOG + ".1"); fs.appendFileSync(LOG, line, { mode: 0o600 }); } catch {} process.stdout.write(line); }
const ERRS = []; const err = m => { ERRS.unshift({ t: Date.now(), m: String(m).slice(0, 300) }); ERRS.length = Math.min(ERRS.length, 20); log("ERR", m); };

/* ---------------- token (generated once, chmod 600) ---------------- */
let TOKEN; try { TOKEN = fs.readFileSync(F("token"), "utf8").trim(); } catch {}
if (!TOKEN || TOKEN.length < 32){ TOKEN = crypto.randomBytes(32).toString("base64url"); wsecret("token", TOKEN + "\n"); log("new token generated →", F("token")); }
const TB = Buffer.from(TOKEN);
function authed(req, bd){ const h = req.headers.authorization || ""; const t = h.startsWith("Bearer ") ? h.slice(7).trim() : (req.headers["x-neon-token"] || (bd && typeof bd.t === "string" ? bd.t : ""));
  const b = Buffer.from(String(t)); return b.length === TB.length && crypto.timingSafeEqual(b, TB); }
const FAILS = new Map(); /* ip → [timestamps] — throttle bad tokens */
const ipOf = req => String(req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "?");

/* ---------------- persistent server state (non-secret) ---------------- */
let STATE = { lastOn: false, lastMode: "SIM" }; try { Object.assign(STATE, JSON.parse(fs.readFileSync(F("state.json"), "utf8"))); } catch {}
const stSave = () => { try { fs.writeFileSync(F("state.json"), JSON.stringify(STATE), { mode: 0o600 }); } catch {} };

/* ---------------- static files for the local headless page ---------------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".ico": "image/x-icon", ".md": "text/plain; charset=utf-8" };
function serveStatic(req, res, url){ let p = decodeURIComponent(url.pathname); if (p === "/") p = "/index.html";
  const f = path.normalize(path.join(ROOT, p)); const rel = path.relative(ROOT, f);
  if (rel.startsWith("..") || rel.split(path.sep).some(s => s.startsWith(".")) || rel.startsWith("server") || !fs.existsSync(f) || !fs.statSync(f).isFile()){ res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-cache" }); fs.createReadStream(f).pipe(res); }

/* ---------------- headless bot page ---------------- */
let ctx = null, page = null, pageState = "başlıyor", reloads = 0, starting = null, SNAP = null, SNAPAT = 0, snapFails = 0, PIN = null; /* PIN: memory only, never written */
const T0 = Date.now();
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(what + " zaman aşımı")), ms))]);
async function ev(fn, arg, ms = 15000){ if (!page) throw new Error("bot sayfası hazır değil (" + pageState + ")"); return withTimeout(page.evaluate(fn, arg), ms, "bot"); }
async function startBrowser(){ if (starting) return starting; starting = (async () => {
  try { if (ctx) await withTimeout(ctx.close(), 15000, "close").catch(() => {}); } catch {} ctx = null; page = null; pageState = "başlıyor";
  try { for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) fs.rmSync(path.join(DATA, "chrome", f), { force: true }); } catch {}
  ctx = await chromium.launchPersistentContext(path.join(DATA, "chrome"), { executablePath: CHROME, headless: true, viewport: { width: 390, height: 844 }, reducedMotion: "reduce", locale: "tr-TR", timezoneId: "Europe/Berlin",
    args: ["--no-sandbox", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=IntensiveWakeUpThrottling,CalculateNativeWinOcclusion", "--mute-audio", "--disable-gpu"] });
  await ctx.addInitScript(() => { window.NEON_SRV = true; /* headless page is never hidden; make sure no document.hidden check pauses the bot */
    try { Object.defineProperty(Document.prototype, "hidden", { get(){ return false; }, configurable: true }); Object.defineProperty(Document.prototype, "visibilityState", { get(){ return "visible"; }, configurable: true }); } catch(e){} });
  ctx.on("close", () => { if (pageState !== "kapanıyor") { pageState = "kapandı"; page = null; } });
  page = ctx.pages()[0] || await ctx.newPage();
  page.on("pageerror", e => err("pageerror: " + e.message));
  page.on("crash", () => { err("bot sayfası çöktü → yeniden başlatılıyor"); page = null; setTimeout(restartPage, 2000); });
  page.on("console", m => { if (m.type() === "error" && !/favicon|ERR_|net::|Failed to load resource|WebSocket/.test(m.text())) log("console.error", m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?srv=1#meme`, { waitUntil: "load", timeout: 60000 });
  await page.waitForFunction(() => window.MEME && MEME.snap && window.WALLET, null, { timeout: 60000 });
  pageState = "çalışıyor"; snapFails = 0; log("bot page ready");
  if (PIN){ try { await ev(p => MEME.ctl("walletUnlock", { pin: p }), PIN, 30000); log("wallet re-unlocked after page restart (PIN from memory)"); } catch(e){ err("yeniden kilit açma başarısız: " + e.message); PIN = null; } }
  await new Promise(r => setTimeout(r, 2500));
  const s = await ev(() => MEME.snap()).catch(() => null);
  if (s && STATE.lastOn && !s.on){ /* resume: SIM always; GERÇEK only when the wallet is unlocked (after a process restart it is locked → stays off) */
    if (s.mode === "SIM" || s.wallet.unlocked){ try { await ev(() => MEME.ctl("arm")); log("resumed OTO (" + s.mode + ")"); } catch(e){ err("OTO devam ettirilemedi: " + e.message); } }
    else log("GERÇEK mod, cüzdan kilitli → OTO kapalı kalıyor (telefondan PIN gir)"); }
  })().catch(e => { err("tarayıcı başlatılamadı: " + e.message); pageState = "hata"; page = null; setTimeout(() => { starting = null; startBrowser(); }, 15000); throw e; }).finally(() => { starting = null; });
  return starting; }
async function restartPage(){ reloads++; log("restarting bot page #" + reloads); return startBrowser().catch(() => {}); }

/* snapshot loop + watchdog */
setInterval(async () => { if (!page || starting) return;
  try { const s = await ev(() => { const s = MEME.snap(); s.heap = performance.memory ? performance.memory.usedJSHeapSize : null; return s; }, null, 8000);
    SNAP = s; SNAPAT = Date.now(); snapFails = 0;
    if (s.on !== STATE.lastOn || s.mode !== STATE.lastMode){ STATE.lastOn = s.on; STATE.lastMode = s.mode; stSave(); }
    if (s.heap && s.heap > 1.2e9){ err("bot sayfası belleği " + Math.round(s.heap/1e6) + " MB → yeniden yükleniyor"); restartPage(); }
    push(); }
  catch(e){ if (++snapFails >= 20){ err("bot sayfası 20 sn cevap vermedi → yeniden başlatılıyor (" + e.message + ")"); snapFails = 0; restartPage(); } } }, 1000);

/* ---------------- SSE clients ---------------- */
const CLIENTS = new Set();
const meta = () => ({ uptime: Math.round((Date.now() - T0)/1000), page: pageState, reloads, snapAt: SNAPAT, tunnel: TUN.kind, tunExp: TUN.exp, errs: ERRS.slice(0, 5), pin: !!PIN });
function push(){ if (!CLIENTS.size || !SNAP) return; const d = "data: " + JSON.stringify({ snap: SNAP, srv: meta() }) + "\n\n"; for (const r of CLIENTS) try { r.write(d); } catch {} }
setInterval(() => { for (const r of CLIENTS) try { r.write(": ka\n\n"); } catch {} }, 15000);

/* ---------------- API ---------------- */
const PINF = []; /* unlock failures */
const body = req => new Promise((ok, no) => { let b = ""; req.on("data", c => { b += c; if (b.length > 64e3){ no(new Error("çok büyük")); req.destroy(); } }); req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch(e){ no(new Error("geçersiz JSON")); } }); });
const send = (res, code, o) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(o)); };
async function freshSnap(){ try { SNAP = await ev(() => MEME.snap(), null, 8000); SNAPAT = Date.now(); } catch {} return SNAP; }
const ACT = {
  "POST /api/arm": async b => { const s = await freshSnap(); if (s && s.mode === "GERÇEK" && b.confirm !== "GERÇEK") throw new Error("GERÇEK OTO için onay (GERÇEK) gerekli"); return ev(() => MEME.ctl("arm"), null, 30000); },
  "POST /api/stop": async () => ev(() => MEME.ctl("stop")),
  "POST /api/kill": async b => ev(a => MEME.ctl("kill", a), { sell: !!b.sell }, 120000),
  "POST /api/endpause": async () => ev(() => MEME.ctl("endPause")),
  "POST /api/pause": async b => ev(a => MEME.ctl("pause", a), { min: +b.min || 30 }),
  "POST /api/set": async b => { if (typeof b.key !== "string") throw new Error("key gerekli"); return ev(a => MEME.ctl("set", a), { key: b.key, value: b.value }); },
  "POST /api/autostart": async b => ev(a => MEME.ctl("autoStart", a), { on: !!b.on }),
  "POST /api/sell": async b => ev(a => MEME.ctl("sell", a), { mint: String(b.mint || "") }, 90000),
  "POST /api/mode": async b => { if (b.mode === "GERÇEK" && b.confirm !== "GERÇEK") throw new Error("GERÇEK mod için onay (GERÇEK) gerekli"); return ev(a => MEME.ctl("mode", a), { mode: b.mode }); },
  "POST /api/simreset": async b => { if (b.confirm !== "SIFIRLA") throw new Error("onay (SIFIRLA) gerekli"); return ev(() => MEME.ctl("simReset")); },
  "POST /api/track": async b => ev(a => MEME.ctl("track", a), { addr: String(b.addr || ""), label: String(b.label || "").slice(0, 24) }),
  "POST /api/untrack": async b => ev(a => MEME.ctl("untrack", a), { addr: String(b.addr || "") }),
  "POST /api/wtoggle": async b => ev(a => MEME.ctl("wtoggle", a), { addr: String(b.addr || ""), on: !!b.on }),
  "POST /api/wallet/upload": async b => { const r = await ev(a => MEME.ctl("walletUpload", a), { blob: b.blob, replace: !!b.replace }); PIN = null; log("encrypted wallet uploaded", r); return r; },
  "POST /api/wallet/unlock": async b => { const now = Date.now(); while (PINF.length && now - PINF[0] > 15*60000) PINF.shift(); if (PINF.length >= 5) throw new Error("çok fazla yanlış PIN — 15 dk bekle");
    const pin = String(b.pin || ""); if (!pin || pin.length > 128) throw new Error("PIN gerekli");
    try { const r = await ev(p => MEME.ctl("walletUnlock", { pin: p }), pin, 30000); PIN = pin; log("wallet unlocked", r); return r; } catch(e){ PINF.push(now); throw e; } },
  "POST /api/wallet/lock": async () => { const r = await ev(() => MEME.ctl("walletLock")); PIN = null; log("wallet locked"); return r; },
  "POST /api/wallet/remove": async b => { if (b.confirm !== "SİL") throw new Error("onay (SİL) gerekli"); const r = await ev(() => MEME.ctl("walletRemove")); PIN = null; log("wallet removed from server"); return r; },
  "POST /api/reload": async () => { restartPage(); return "bot sayfası yeniden başlatılıyor"; },
  "POST /api/context": async () => ({ context: await ev(() => MEME.context(), null, 8000) }),
  "POST /api/status": async () => ({ snap: SNAP || await freshSnap(), srv: meta() }),
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x"), viaTunnel = !!req.headers["cf-connecting-ip"] || !!req.headers["cf-ray"];
  if (url.pathname.startsWith("/api/")){
    res.setHeader("access-control-allow-origin", "*"); res.setHeader("access-control-allow-headers", "authorization, content-type, x-neon-token"); res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS"); res.setHeader("access-control-max-age", "600");
    if (req.method === "OPTIONS"){ res.writeHead(204); return res.end(); }
    if (url.pathname === "/api/ping") return send(res, 200, { ok: true, app: "neon-terminal-server" });
    const ip = ipOf(req), fl = (FAILS.get(ip) || []).filter(t => Date.now() - t < 600000);
    if (fl.length >= 30) return send(res, 429, { ok: false, error: "çok fazla hatalı token — 10 dk bekle" });
    /* the phone sends CORS-"simple" requests (POST text/plain, token in the JSON body) so no preflight is needed — some tunnels swallow OPTIONS */
    let b = {}; if (req.method === "POST"){ try { b = await body(req); } catch(e){ return send(res, 400, { ok: false, error: e.message }); } }
    if (!authed(req, b)){ fl.push(Date.now()); FAILS.set(ip, fl); return send(res, 401, { ok: false, error: "token geçersiz" }); }
    delete b.t;
    if (url.pathname === "/api/events"){
      res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no", connection: "keep-alive" });
      res.write(": hi\n\n"); CLIENTS.add(res); if (SNAP) res.write("data: " + JSON.stringify({ snap: SNAP, srv: meta() }) + "\n\n");
      req.on("close", () => CLIENTS.delete(res)); return; }
    const ro = url.pathname === "/api/status" || url.pathname === "/api/context", h = ACT["POST " + url.pathname]; if (!h) return send(res, 404, { ok: false, error: "bilinmeyen uç" });
    if (!ro && req.method !== "POST") return send(res, 405, { ok: false, error: "POST gerekli" });
    try { const r = await h(b);
      if (!ro) log("api", url.pathname, url.pathname.includes("wallet") ? "" : JSON.stringify(b).slice(0, 200), "→", typeof r === "string" ? r : "ok");
      const out = (r && typeof r === "object" && !Array.isArray(r)) ? r : { result: r };
      if (!ro){ await freshSnap(); out.snap = SNAP; out.srv = meta(); push(); }
      return send(res, 200, Object.assign({ ok: true }, out)); }
    catch(e){ if (!ro) log("api", url.pathname, "✖", e.message); return send(res, 400, { ok: false, error: e.message }); } }
  if (viaTunnel){ /* the phone uses the GitHub Pages site; the tunnel only serves the API */ res.writeHead(302, { location: SITE }); return res.end(); }
  if (req.method !== "GET" && req.method !== "HEAD"){ res.writeHead(405); return res.end(); }
  serveStatic(req, res, url); });
server.on("error", e => { log("FATAL listen", e.message); process.exit(1); });
server.listen(PORT, "127.0.0.1", () => { log(`listening http://127.0.0.1:${PORT} · data ${DATA} · keşif konusu ${DISC ? "açık" : "kapalı"}`); startBrowser().catch(() => {}); startTunnel(); });

/* ---------------- public tunnel ----------------
   1) Cloudflare quick tunnel (https://<random>.trycloudflare.com, no account, no expiry) — needs outbound TCP/UDP 7844.
   2) fallback: LocalToLink (https://<random>.localtolink.com, no account, works over plain HTTPS :443, links expire after ~2 h → renewed automatically).
   The URL changes whenever a tunnel is renewed. The phone follows it automatically: the server publishes the current URL, AES-GCM-encrypted with a key
   derived from the token, on a secret ntfy.sh topic derived from the token (NEON_DISCOVERY=0 turns this off). Without the token the message is useless. */
const TUN = { proc: null, url: null, fails: 0, since: 0, kind: null, exp: null, pubAt: 0 };
const ORDER = (process.env.NEON_TUNNEL_ORDER || "cloudflared,localtolink").split(",").map(x => x.trim()).filter(Boolean);
const DISC = process.env.NEON_DISCOVERY !== "0";
const sha = s => crypto.createHash("sha256").update(s).digest();
const TOPIC = "neon" + sha("neon-topic:" + TOKEN).toString("hex").slice(0, 40), UKEY = sha("neon-url:" + TOKEN);
function sealUrl(u){ const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", UKEY, iv); const ct = Buffer.concat([c.update(JSON.stringify({ u, t: Date.now() })), c.final(), c.getAuthTag()]); return Buffer.concat([iv, ct]).toString("base64url"); }
async function publishUrl(){ if (!DISC || !TUN.url) return; try { const r = await fetch("https://ntfy.sh/" + TOPIC, { method: "POST", body: sealUrl(TUN.url), headers: { "x-cache": "yes", "x-firebase": "no", title: "x" }, signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error("HTTP " + r.status); TUN.pubAt = Date.now(); log("discovery: encrypted URL published"); } catch(e){ err("keşif yayını başarısız: " + e.message); } }
setInterval(() => { if (TUN.url && Date.now() - TUN.pubAt > 6*3600000) publishUrl(); }, 600000); /* ntfy keeps messages ~12 h → refresh every 6 h */
function writeLinks(){ const pair = `${SITE}#pair=${encodeURIComponent(TUN.url)}|${TOKEN}`;
  wsecret("tunnel-url.txt", TUN.url + "\n"); wsecret("pair-link.txt", pair + "\n");
  log("TUNNEL", TUN.kind, TUN.url, TUN.exp ? "(bitiş " + TUN.exp + ")" : "", "· eşleşme linki →", F("pair-link.txt")); publishUrl(); }
function setUrl(u, kind, exp){ if (TUN.url === u) return; TUN.url = u; TUN.kind = kind; TUN.exp = exp || null; TUN.fails = 0; TUN.since = Date.now(); writeLinks(); }
const LTL = (() => { try { return require.resolve("localtolink/package.json").replace(/package\.json$/, ""); } catch { return null; } })();
function pickKind(){ const skip = STATE.cfFailAt && Date.now() - STATE.cfFailAt < 24*3600000; for (const k of ORDER){ if (k === "cloudflared" && skip) continue; return k; } return ORDER[ORDER.length - 1]; }
let tunGen = 0, tunBackoff = 5000;
function killTunnel(){ const p = TUN.proc; TUN.proc = null; if (p) try { process.kill(-p.pid, "SIGTERM"); } catch { try { p.kill("SIGTERM"); } catch {} } }
function startTunnel(kind){ if (!TUNNEL) return; kind = kind || pickKind(); const gen = ++tunGen; killTunnel();
  try { const old = +fs.readFileSync(F("tunnel.pid"), "utf8"); if (old) process.kill(-old, "SIGTERM"); } catch {}
  let p; if (kind === "cloudflared") p = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${PORT}`], { stdio: ["ignore", "pipe", "pipe"], detached: true });
  else { const bin = LTL ? path.join(LTL, JSON.parse(fs.readFileSync(path.join(LTL, "package.json"), "utf8")).bin?.localtolink || "bin/localtolink.js") : null;
    p = bin && fs.existsSync(bin) ? spawn(process.execPath, [bin, "--port", String(PORT), "--json", "--no-qr"], { stdio: ["ignore", "pipe", "pipe"], detached: true }) : spawn("npx", ["-y", "localtolink", "--port", String(PORT), "--json", "--no-qr"], { stdio: ["ignore", "pipe", "pipe"], detached: true }); }
  TUN.proc = p; TUN.kind = kind; wsecret("tunnel.pid", String(p.pid)); log("tunnel starting:", kind);
  let okSeen = false; const cfT = kind === "cloudflared" ? setTimeout(async () => { if (gen !== tunGen) return; /* cloudflared prints a URL even when the edge is unreachable → verify */
    let ok = false; if (TUN.url) try { const r = await fetch(TUN.url + "/api/ping", { signal: AbortSignal.timeout(10000) }); ok = r.ok; } catch {}
    if (!ok){ err("cloudflared bağlanamadı (7844 kapalı olabilir) → LocalToLink'e geçiliyor"); STATE.cfFailAt = Date.now(); stSave(); TUN.url = null; startTunnel("localtolink"); } }, 40000) : null;
  const onOut = d => { const s = d.toString(); if (gen !== tunGen) return;
    if (kind === "cloudflared"){ const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m && TUN.url !== m[0]){ TUN.url = null; TUN.pend = m[0]; /* publish only after it answers */
        setTimeout(async () => { try { const r = await fetch(m[0] + "/api/ping", { signal: AbortSignal.timeout(10000) }); if (r.ok && gen === tunGen){ clearTimeout(cfT); setUrl(m[0], kind); } } catch {} }, 8000); }
      if (/ERR/.test(s)) fs.appendFile(F("tunnel.log"), s, () => {}); return; }
    for (const line of s.split("\n")){ if (!line.trim()) continue; let j; try { j = JSON.parse(line); } catch { fs.appendFile(F("tunnel.log"), line + "\n", () => {}); continue; }
      if (j.status === "connected" && j.url){ okSeen = true; tunBackoff = 5000; setUrl(j.url, kind, j.expiresAt); }
      else { fs.appendFile(F("tunnel.log"), line + "\n", () => {}); if (j.code === "RATE_LIMITED") tunBackoff = 60000; } } };
  p.stdout.on("data", onOut); p.stderr.on("data", onOut);
  p.on("exit", c => { clearTimeout(cfT); if (gen !== tunGen) return; log("tunnel exited", kind, c); TUN.proc = null; TUN.url = null; const wait = okSeen ? 3000 : tunBackoff; tunBackoff = Math.min(300000, tunBackoff*2); setTimeout(() => { if (gen === tunGen) startTunnel(); }, wait); }); }
setInterval(async () => { if (!TUN.url || !TUN.proc || Date.now() - TUN.since < 60000) return; /* health: 3 failed pings in a row (or expiry) → new tunnel (new URL) */
  if (TUN.exp && Date.parse(TUN.exp) - Date.now() < 60000){ log("tunnel expiring → renewing"); TUN.url = null; return startTunnel(); }
  try { const r = await fetch(TUN.url + "/api/ping", { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error("HTTP " + r.status); TUN.fails = 0; }
  catch(e){ if (++TUN.fails >= 3){ err("tünel cevap vermiyor → yeni tünel açılıyor (adres değişecek): " + e.message); TUN.url = null; startTunnel(); } } }, 60000);

/* ---------------- lifecycle ---------------- */
async function shutdown(sig){ log("shutdown", sig); pageState = "kapanıyor"; tunGen++; killTunnel();
  try { if (ctx) await withTimeout(ctx.close(), 10000, "close"); } catch {} process.exit(0); }
process.on("SIGTERM", () => shutdown("SIGTERM")); process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", e => err("unhandledRejection: " + (e && e.message || e)));
wsecret("server.pid", String(process.pid));
