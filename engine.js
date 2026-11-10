/* NEON//TERMINAL mobile — data + analysis engine (browser only, no backend, no orders, no wallets).
   Method ported from github.com/Jakeschincariol/day-trader-skill (MIT) via the desktop crypto.py adapter. */
"use strict";
const ENGINE = (() => {
const DEFAULTS = { account_size: 1000, max_loss_per_trade: 10, daily_loss_limit: 30, position_cap_pct: 50, cash_buffer: 0,
  min_reward_risk: 1.5, min_order_usd: 1, qty_decimals: 6, or_minutes: 60, stop_rule: "or-mid", fallback_stop_pct: 2.0,
  min_stop_pct: 0.5, max_stop_pct: 5.0, target_r: 2, hold_hours: 8, replays: 10000, replay_window_bars: 6, history_days: 60, news_max: 8 };
function config(){ let s = {}; try { s = JSON.parse(localStorage.getItem("neon.cfg") || "{}"); } catch(e){} return Object.assign({}, DEFAULTS, s); }
function saveConfig(c){ localStorage.setItem("neon.cfg", JSON.stringify(c)); }

const HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];
let hostIdx = 0;
async function bx(path){
  let last;
  for (let k = 0; k < HOSTS.length; k++){
    const h = HOSTS[(hostIdx + k) % HOSTS.length];
    try {
      const r = await fetch(h + path, {cache:"no-store"});
      if (r.status === 400){ const j = await r.json().catch(() => ({})); const e = new Error(j.msg || "bad request"); e.code = 400; throw e; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      hostIdx = (hostIdx + k) % HOSTS.length; return await r.json();
    } catch(e){ if (e.code === 400) throw e; last = e; }
  }
  throw new Error("Binance erişilemedi (" + (last && last.message) + ")");
}
async function getJSON(url){ const r = await fetch(url, {cache:"no-store"}); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }

const ALIASES = { bitcoin:"BTC", xbt:"BTC", ethereum:"ETH", ether:"ETH", solana:"SOL", ripple:"XRP", dogecoin:"DOGE",
  binance:"BNB", binancecoin:"BNB", cardano:"ADA", avalanche:"AVAX", chainlink:"LINK", toncoin:"TON", tron:"TRX",
  polkadot:"DOT", litecoin:"LTC", shiba:"SHIB", "shiba-inu":"SHIB", "bitcoin-cash":"BCH", uniswap:"UNI", stellar:"XLM",
  monero:"XMR", aptos:"APT", arbitrum:"ARB", hedera:"HBAR", cosmos:"ATOM", "ethereum-classic":"ETC", filecoin:"FIL",
  polygon:"POL", matic:"POL", "internet-computer":"ICP", initia:"INIT", pepe:"PEPE", sui:"SUI", near:"NEAR" };
const GECKO = { BTC:"bitcoin", ETH:"ethereum", SOL:"solana", XRP:"ripple", DOGE:"dogecoin", BNB:"binancecoin", ADA:"cardano",
  AVAX:"avalanche-2", LINK:"chainlink", TON:"the-open-network", TRX:"tron", DOT:"polkadot", LTC:"litecoin", SHIB:"shiba-inu",
  BCH:"bitcoin-cash", NEAR:"near", UNI:"uniswap", XLM:"stellar", SUI:"sui", PEPE:"pepe", APT:"aptos", ARB:"arbitrum",
  HBAR:"hedera-hashgraph", ATOM:"cosmos", ETC:"ethereum-classic", FIL:"filecoin", POL:"polygon-ecosystem-token", ICP:"internet-computer", INIT:"initia" };

function normalize(q){
  let s = String(q || "").trim();
  const low = s.toLowerCase();
  if (ALIASES[low]) return ALIASES[low];
  s = s.toUpperCase().replace(/[\s_]/g, "");
  const stripped = s.replace(/[-\/]?(USDT|USDC|FDUSD|BUSD|USD)$/, "");
  if (stripped.length >= 2) s = stripped;
  s = s.replace(/[^A-Z0-9]/g, "");
  return ALIASES[s.toLowerCase()] || s;
}
async function resolve(q){
  const base = normalize(q);
  if (!base || base.length < 2) throw new Error("Coin adı boş ya da geçersiz: '" + q + "'");
  let all = null;
  try { const cached = sessionStorage.getItem("neon.usdt"); if (cached){ const o = JSON.parse(cached); if (Date.now() - o.t < 3600e3) all = new Set(o.s); } } catch(e){}
  if (!all){ const d = await bx("/api/v3/ticker/price"); all = new Set(d.map(x => x.symbol).filter(x => x.endsWith("USDT")));
    try { sessionStorage.setItem("neon.usdt", JSON.stringify({ t: Date.now(), s: [...all] })); } catch(e){} }
  const tryBase = async b => { if (!all.has(b + "USDT")) return null; try { const info = await bx("/api/v3/exchangeInfo?symbol=" + b + "USDT");
      const s = info.symbols && info.symbols[0]; if (s && s.status === "TRADING") return { sym: s.symbol, base: s.baseAsset }; } catch(e){ if (e.code !== 400) throw e; } return null; };
  let r = await tryBase(base);
  if (!r){ // CoinGecko name search fallback (e.g. "render" -> RENDER)
    try { const d = await getJSON("https://api.coingecko.com/api/v3/search?query=" + encodeURIComponent(q));
      const c = (d.coins || []).sort((a, b) => (a.market_cap_rank || 1e9) - (b.market_cap_rank || 1e9))[0];
      if (c && c.symbol && c.symbol.toUpperCase() !== base) r = await tryBase(c.symbol.toUpperCase());
    } catch(e){}
  }
  if (!r) throw new Error("Coin bulunamadı ya da Binance'te USDT paritesi yok: '" + q + "' (" + base + "USDT)");
  return r;
}
async function klines(sym, interval, startMs, endMs, limit = 1000){
  let p = `/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;
  if (startMs) p += "&startTime=" + startMs; if (endMs) p += "&endTime=" + endMs;
  const d = await bx(p);
  return d.map(k => ({ t: Math.floor(k[0]/1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], ct: Math.floor(k[6]/1000) }));
}
async function bars5m(sym, days, onProg){
  const now = Date.now(), span = 1000*300*1000, start = now - days*86400000;
  const wins = []; for (let s = start; s < now; s += span) wins.push(s);
  const out = new Array(wins.length); let done = 0;
  const worker = async () => { while (wins.length){ const i = out.length - wins.length; const s = wins.shift();
      out[i] = await klines(sym, "5m", s, Math.min(now, s + span - 1)); done++; onProg && onProg(done, out.length); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const seen = new Set(); return out.flat().filter(b => !seen.has(b.t) && seen.add(b.t)).sort((a, b) => a.t - b.t);
}

/* ---------------- math ---------------- */
function rsi(c, n = 14){ if (c.length < n + 1) return null; let ag = 0, al = 0;
  for (let i = 1; i <= n; i++){ const d = c[i] - c[i-1]; ag += Math.max(d, 0); al += Math.max(-d, 0); } ag /= n; al /= n;
  for (let i = n + 1; i < c.length; i++){ const d = c[i] - c[i-1]; ag = (ag*(n-1) + Math.max(d, 0))/n; al = (al*(n-1) + Math.max(-d, 0))/n; }
  return al === 0 ? 100 : 100 - 100/(1 + ag/al); }
const pct = (a, b) => b ? (a/b - 1)*100 : 0;
const decFor = p => p >= 1000 ? 2 : p >= 1 ? 4 : p >= 0.01 ? 6 : 10;
const floorTo = (x, d) => Math.floor(x * 10**d) / 10**d;
const roundTo = (x, d) => Math.round(x * 10**d) / 10**d;
function findSetups(c){
  const last = c[c.length-1], hi20 = Math.max(...c.slice(-21, -1)), ma20 = c.slice(-20).reduce((a, b) => a + b, 0)/20,
    ma20p = c.slice(-21, -1).reduce((a, b) => a + b, 0)/20, run = c[c.length-6]/c[c.length-16] - 1,
    rng5 = (Math.max(...c.slice(-5)) - Math.min(...c.slice(-5)))/last, r = rsi(c), rp = rsi(c.slice(0, -1));
  const tags = [];
  if (last > hi20) tags.push("20 günlük kapanış zirvesi kırılımı");
  if (run > 0.10 && rng5 < 0.05) tags.push("boğa bayrağı");
  if (c[c.length-2] < ma20p && last > ma20) tags.push("20g ortalamayı geri aldı");
  if (r !== null && r < 30) tags.push("aşırı satım (RSI<30)");
  if (rp !== null && rp < 30 && last > c[c.length-2]) tags.push("aşırı satımdan sıçrama");
  return { tags, rsi: r, hi20, ma20 };
}
function openingRange(bars, day0, orMin){
  const n = Math.max(1, Math.floor(orMin/5)); const rng = bars.filter(b => b.t >= day0 && b.t < day0 + orMin*60);
  if (rng.length < n) return null;
  return { high: Math.max(...rng.map(b => b.h)), low: Math.min(...rng.map(b => b.l)), end: day0 + orMin*60 };
}

/* ---------------- steps ---------------- */
async function stepScanner(ctx){
  const d = await klines(ctx.sym, "1d", null, null, 120);
  const nowS = Date.now()/1000, done = d.filter(b => b.ct < nowS);
  const closes = done.map(b => b.c);
  if (closes.length < 31) throw new Error("yeterli günlük veri yok (" + closes.length + " gün)");
  const s = findSetups(closes), last = ctx.price, all = d.map(b => b.c);
  ctx.out.scan = { rsi: rsi(all.slice(0, -1).concat([last])), sma20: s.ma20, hi20: s.hi20,
    chg1: pct(last, closes[closes.length-1]), chg7: pct(last, closes[closes.length-7]), chg30: pct(last, closes[closes.length-30]),
    closes: d.slice(-90).map(b => [b.t, b.c]), hits: s.tags, setup: s.tags.length ? s.tags.join(", ") : "kurulum yok", rsi_closed: s.rsi };
  return "Günlük kapanış taraması: " + ctx.out.scan.setup + " · RSI " + (ctx.out.scan.rsi ?? 0).toFixed(1);
}
async function stepNews(ctx, cfg){
  const name = ctx.name || ctx.base, items = []; let source = null;
    { try { const d = await getJSON(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(name)}&tags=story&hitsPerPage=60&numericFilters=created_at_i>${Math.floor(Date.now()/1000) - 30*86400}`);
    const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp("\\b(" + [name, ctx.base.length >= 3 ? ctx.base : null, "crypto", "cryptocurrency"].filter(Boolean).map(esc).join("|") + ")\\b", "i");
    const nameRx = new RegExp("\\b(" + [name, ctx.base.length >= 3 ? ctx.base : null].filter(Boolean).map(esc).join("|") + ")\\b", "i");
    for (const h of (d.hits || []).filter(h => h.title && nameRx.test(h.title) && rx.test(h.title))) items.push({ title: h.title, link: h.url || ("https://news.ycombinator.com/item?id=" + h.objectID), time: h.created_at, tags: ["HN"], source: "Hacker News" });
    if (items.length) source = "Hacker News (son 30 gün)"; } catch(e){} }
  ctx.out.news = { moves: [{ pct: ctx.chg24 }], count: items.length, items: items.slice(0, cfg.news_max), source };
  return items.length ? `${items.length} başlık · kaynak: ${source}` : "haber kaynağı yok / sonuç yok";
}
function stepEntry(ctx, cfg){
  const now = Date.now()/1000, done = ctx.bars.filter(b => b.t + 300 <= now), hold = cfg.hold_hours, orMin = cfg.or_minutes;
  const day0 = Math.floor(now/86400)*86400; let used = day0, orr = openingRange(done, day0, orMin);
  if (!orr){ used = day0 - 86400; orr = openingRange(done, used, orMin); }
  if (!orr) throw new Error("açılış aralığı mumları eksik");
  const after = done.filter(b => b.t >= orr.end && b.t < used + 86400), trig = after.find(b => b.c > orr.high), price = ctx.price;
  let status, entry, etime;
  if (trig){ const tc = trig.t + 300; status = now > tc + hold*3600 ? "expired" : "triggered"; entry = status === "triggered" ? trig.c : price; etime = status === "triggered" ? tc : now; }
  else { status = "waiting"; entry = price <= orr.high ? orr.high : price; etime = now; }
  const last24 = done.filter(b => b.t >= now - 86400);
  ctx.entry = entry; ctx.entry_time = etime; ctx.orr = orr; ctx.entry_status = status;
  const label = { waiting: "BEKLİYOR", triggered: "TETİKLENDİ", expired: "SÜRESİ DOLDU" }[status];
  ctx.out.entry = { status, label, or_high: orr.high, or_low: orr.low, or_start: used, or_end: orr.end, entry, entry_time: etime,
    trigger: trig ? { t: trig.t + 300, price: trig.c } : null, hi24: Math.max(...last24.map(b => b.h)), lo24: Math.min(...last24.map(b => b.l)), price, or_minutes: orMin };
  return `Açılış aralığı (UTC ilk ${orMin}dk) ${orr.low} – ${orr.high} → ${label}`;
}
function stepExit(ctx, cfg){
  const e = ctx.entry, orr = ctx.orr, mid = (orr.high + orr.low)/2, dist = (e - mid)/e*100, dec = decFor(e);
  let stop, label, note = "";
  if (cfg.stop_rule === "or-mid" && dist >= cfg.min_stop_pct && dist <= cfg.max_stop_pct){ stop = floorTo(mid, dec); label = "açılış aralığı ortası"; }
  else { stop = floorTo(e*(1 - cfg.fallback_stop_pct/100), dec); label = `%${cfg.fallback_stop_pct} giriş altı`;
    note = dist < cfg.min_stop_pct ? ` (aralık ortası çok yakın <%${cfg.min_stop_pct})` : ` (aralık ortası çok uzak >%${cfg.max_stop_pct})`; }
  const target = roundTo(e + cfg.target_r*(e - stop), dec);
  ctx.plan = { entry: e, stop, target, risk_per_share: e - stop, reward_risk: cfg.target_r, stop_label: label, flat_by_ts: ctx.entry_time + cfg.hold_hours*3600 };
  ctx.out.plan = ctx.plan;
  return `Giriş ${e} · Stop ${stop} (${label}${note}) · Hedef ${target} (${cfg.target_r}R)`;
}
function stepTM(ctx, cfg, onProg){
  return new Promise((res, rej) => {
    const w = new Worker("tm-worker.js"); const B = ctx.bars;
    const t = new Float64Array(B.length), h = new Float64Array(B.length), l = new Float64Array(B.length), c = new Float64Array(B.length);
    B.forEach((b, i) => { t[i] = b.t; h[i] = b.h; l[i] = b.l; c[i] = b.c; });
    w.onmessage = ev => { const m = ev.data; if (m.type === "progress") { onProg && onProg(m.k); return; }
      w.terminate(); if (m.type === "error") return rej(new Error(m.error));
      ctx.out.tm = m.result; res(`${m.result.n} simülasyon: önce hedef %${m.result.target.toFixed(1)} · önce stop %${m.result.stop.toFixed(1)} · ort. ${m.result.avg_r.toFixed(2)}R`); };
    w.onerror = e => { w.terminate(); rej(new Error(e.message || "worker hatası")); };
    w.postMessage({ t, h, l, c, plan: ctx.plan, entry_time: ctx.entry_time, cfg }, [t.buffer, h.buffer, l.buffer, c.buffer]);
  });
}
function stepBudget(ctx, cfg){
  const p = ctx.plan, e = p.entry, rpu = e - p.stop, dec = cfg.qty_decimals;
  const lim = [["işlem başı max zarar", cfg.max_loss_per_trade/rpu], [`pozisyon tavanı %${cfg.position_cap_pct}`, cfg.account_size*cfg.position_cap_pct/100/e],
    ["nakit (tampon sonrası)", (cfg.account_size - cfg.cash_buffer)/e]];
  let w = lim[0]; for (const x of lim) if (x[1] < w[1]) w = x;
  let qty = floorTo(w[1], dec); if (qty*e < cfg.min_order_usd) qty = 0;
  ctx.qty = qty;
  ctx.out.budget = { account: cfg.account_size, max_loss: cfg.max_loss_per_trade, rpu, limits: lim.map(([name, q]) => ({ name, qty: q, usd: q*e })),
    which: w[0], qty, notional: qty*e, loss: qty*rpu, base: ctx.base, cap_pct: cfg.position_cap_pct };
  return `Miktar ${qty} ${ctx.base} ≈ $${(qty*e).toFixed(2)} (belirleyen: ${w[0]})`;
}
async function stepRisk(ctx, cfg){
  const p = ctx.plan, qty = ctx.qty || 0, e = p.entry, s = p.stop, tg = p.target;
  let fresh = ctx.price; try { fresh = +(await bx("/api/v3/ticker/price?symbol=" + ctx.sym)).price || fresh; } catch(err){}
  const worst = Math.max(e, fresh), loss = (worst - s)*qty, rr = worst > s ? (tg - worst)/(worst - s) : -1, cap = cfg.account_size*cfg.position_cap_pct/100;
  const f = x => "$" + (x >= 1 ? x.toFixed(2) : x.toPrecision(4));
  const checks = [["Stop var ve girişin altında", 0 < s && s < e], ["Hedef girişin üstünde", tg > e],
    [`Stopta zarar $${loss.toFixed(2)} ≤ $${cfg.max_loss_per_trade} (taze fiyat ${f(fresh)} ile)`, loss <= cfg.max_loss_per_trade*1.0001 && qty > 0],
    [`Ödül:risk ${rr.toFixed(2)} ≥ ${cfg.min_reward_risk}`, rr >= cfg.min_reward_risk],
    [`Pozisyon $${(qty*e).toFixed(2)} ≤ tavan $${cap.toFixed(2)}`, qty*e <= cap + 0.01],
    [`Günlük zarar limiti $${cfg.daily_loss_limit} (bu işlem tek başına)`, loss <= cfg.daily_loss_limit],
    ctx.entry_status === "waiting" ? [`Bekleyen alış-stop: fiyat ${f(fresh)} tetik seviyesinin altında`, fresh < e] : ["Fiyat stopun üstünde", fresh > s],
    ["Fiyat henüz hedefe ulaşmadı", fresh < tg], ["Piyasa açık (kripto 7/24)", true]];
  const ok = checks.every(c => c[1]);
  ctx.risk_ok = ok; ctx.out.risk = { checks: checks.map(([name, ok]) => ({ name, ok: !!ok })), ok, fresh, verdict: ok ? "ONAYLANDI (kağıt)" : "REDDEDİLDİ" };
  return ctx.out.risk.verdict + ` · ${checks.filter(c => c[1]).length}/${checks.length} kontrol`;
}
function stepTicket(ctx, cfg){
  const p = ctx.plan, dec = decFor(p.entry), waiting = ctx.entry_status === "waiting";
  const order = { symbol: ctx.base + "/USDT", qty: (ctx.qty || 0).toFixed(cfg.qty_decimals), side: "buy", type: waiting ? "stop_limit" : "limit",
    time_in_force: "gtc", limit_price: String(roundTo(p.entry*1.001, dec)) };
  if (waiting) order.stop_price = String(roundTo(p.entry, dec));
  ctx.out.ticket = { order, status: "PAPER / NOT PLACED", entry: p.entry, stop: p.stop, target: p.target, flat_by_ts: p.flat_by_ts, risk: ctx.out.risk ? ctx.out.risk.verdict : "-" };
  return "Kağıt emir fişi hazır · HİÇBİR EMİR GÖNDERİLMEDİ";
}
function stepAlerts(ctx){
  const p = ctx.plan;
  ctx.out.alerts = { price: ctx.price, low: ctx.t24.low, high: ctx.t24.high, prev_close: ctx.t24.open, levels: { entry: p.entry, stop: p.stop, target: p.target }, flat_by_ts: p.flat_by_ts };
  return `Fiyat ${ctx.price} · giriş ${pct(p.entry, ctx.price).toFixed(2)}% · stop ${pct(p.stop, ctx.price).toFixed(2)}% · hedef ${pct(p.target, ctx.price).toFixed(2)}%`;
}
async function stepAnalyst(ctx){
  let id = GECKO[ctx.base];
  if (!id){ const s = await getJSON("https://api.coingecko.com/api/v3/search?query=" + encodeURIComponent(ctx.base));
    const c = (s.coins || []).filter(c => (c.symbol || "").toUpperCase() === ctx.base).sort((a, b) => (a.market_cap_rank || 1e9) - (b.market_cap_rank || 1e9));
    if (!c.length) throw new Error("CoinGecko'da " + ctx.base + " bulunamadı"); id = c[0].id; }
  const d = await getJSON(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${id}&price_change_percentage=24h,7d,30d,1y`);
  if (!Array.isArray(d) || !d.length) throw new Error("CoinGecko verisi yok");
  ctx.out.analyst = d[0]; ctx.name = d[0].name;
  return `${d[0].name} #${d[0].market_cap_rank} · piyasa değeri $${(d[0].market_cap/1e9).toFixed(2)}B · ATH ${(d[0].ath_change_percentage||0).toFixed(1)}%`;
}
function stepCongress(ctx){
  ctx.out.pelosi = { mobile: true };
  return "Kongre (STOCK Act) verisi tarayıcıdan erişilebilir değil (CORS yok) — yalnızca masaüstü sürümde.";
}

const STEPS = [["Tarayıcı", stepScanner], ["Haberler", stepNews], ["Giriş", stepEntry], ["Çıkış Planı", stepExit], ["Zaman Makinesi", stepTM],
  ["Büyüklük", stepBudget], ["Risk", stepRisk], ["Emir Fişi", stepTicket], ["Alarmlar", stepAlerts], ["Analist", stepAnalyst], ["Kongre", stepCongress]];
const NEEDS = { 4: "entry", 5: "plan", 6: "plan", 7: "plan", 8: "plan", 9: "plan" };
const KEY = { 4: "entry", 5: "plan", 6: "plan", 7: "plan", 8: "plan", 9: "plan" };

/* run: calls onEvent like the desktop server's NDJSON stream */
async function run(q, onEvent){
  const cfg = config();
  let r;
  try { r = await resolve(q); } catch(e){ onEvent({ type: "error", error: e.message }); return; }
  const t24 = await bx("/api/v3/ticker/24hr?symbol=" + r.sym);
  const ctx = { sym: r.sym, base: r.base, price: +t24.lastPrice, chg24: +t24.priceChangePercent,
    t24: { low: +t24.lowPrice, high: +t24.highPrice, open: +t24.openPrice }, out: {}, name: (GECKO[r.base] || "").replace(/-/g, " ") };
  onEvent({ type: "start", symbol: r.sym, base: r.base, price: ctx.price });
  try { ctx.bars = await bars5m(r.sym, cfg.history_days, (d, n) => onEvent({ type: "load", done: d, total: n })); }
  catch(e){ onEvent({ type: "error", error: "5dk mum verisi indirilemedi: " + e.message }); return; }
  if (ctx.bars.length < 300){ onEvent({ type: "error", error: `${r.sym} için yeterli 5dk mum yok (${ctx.bars.length})` }); return; }
  ctx.price = ctx.bars[ctx.bars.length-1].c || ctx.price;
  // analyst first (quietly) so the news step knows the coin's name
  for (let i = 0; i < STEPS.length; i++){
    const n = i + 1, [title, fn] = STEPS[i], t0 = performance.now(); let err = null, log = "";
    if (NEEDS[n] && !(KEY[n] in ctx)) err = "önceki adım başarısız, atlandı";
    else { try { log = await fn(ctx, cfg, k => onEvent({ type: "tmprog", k })) || ""; } catch(e){ err = (e && e.message) || String(e); } }
    onEvent({ type: "step", n, title, ok: !err, error: err, log, ms: Math.round(performance.now() - t0) });
  }
  const now = Date.now()/1000, h1 = new Map();
  for (const b of ctx.bars){ const k = Math.floor(b.t/3600)*3600, x = h1.get(k);
    if (!x) h1.set(k, { t: k, o: b.o, h: b.h, l: b.l, c: b.c }); else { x.h = Math.max(x.h, b.h); x.l = Math.min(x.l, b.l); x.c = b.c; } }
  const O = ctx.out, fp = x => x === undefined || x === null ? "—" : (x >= 1000 ? "$" + x.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "$" + (+x).toPrecision(5));
  const summary = [["Fiyat", fp(ctx.price)], ["Tarama", O.scan ? `${O.scan.setup} (RSI ${(O.scan.rsi||0).toFixed(1)})` : "—"],
    ["Haber", O.news ? `${O.news.count} başlık` : "—"], ["Giriş", O.entry ? O.entry.label : "—"],
    ["Plan", O.plan ? `${fp(O.plan.entry)} / stop ${fp(O.plan.stop)} / hedef ${fp(O.plan.target)}` : "—"],
    ["Simülasyon", O.tm ? `hedef %${O.tm.target.toFixed(0)} / stop %${O.tm.stop.toFixed(0)} / ort. ${O.tm.avg_r >= 0 ? "+" : ""}${O.tm.avg_r.toFixed(2)}R` : "—"],
    ["Büyüklük", O.budget ? `${O.budget.qty} ${ctx.base} ≈ $${O.budget.notional.toFixed(2)} (risk $${O.budget.loss.toFixed(2)})` : "—"],
    ["Risk", O.risk ? O.risk.verdict : "—"], ["Analist", O.analyst ? `#${O.analyst.market_cap_rank}, ATH ${(O.analyst.ath_change_percentage||0).toFixed(0)}%` : "—"],
    ["Kongre", "yalnızca masaüstü"]];
  onEvent({ type: "done", symbol: r.sym, base: r.base, price: ctx.price, chg24: ctx.chg24, data: O, summary,
    disclaimer: "Bu bir analizdir, yatırım tavsiyesi değildir. Hiçbir emir gönderilmedi, hiçbir cüzdana dokunulmadı.",
    bars5m: ctx.bars.filter(b => b.t >= now - 36*3600).map(b => [b.t, b.o, b.h, b.l, b.c]),
    bars1h: [...h1.values()].slice(-24*14).map(x => [x.t, x.o, x.h, x.l, x.c]) });
}
async function tape(bases){
  const syms = bases.map(b => b + "USDT"); const d = await bx("/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(syms)));
  const m = new Map(d.map(x => [x.symbol, x]));
  return syms.filter(s => m.has(s)).map(s => ({ base: s.replace(/USDT$/, ""), price: +m.get(s).lastPrice, chg: +m.get(s).priceChangePercent }));
}
async function price(sym){ return +(await bx("/api/v3/ticker/price?symbol=" + sym)).price; }
return { run, tape, price, config, saveConfig, DEFAULTS, normalize };
})();
