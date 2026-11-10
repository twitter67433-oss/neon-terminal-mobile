/* NEON//TERMINAL v5 — PUMP.FUN canlı akış.
   New tokens: PumpPortal data WebSocket (wss://pumpportal.fun/api/data · subscribeNewToken · free, no key, works from the browser).
   Live trades / market cap of one token WITHOUT a key: Solana RPC WebSocket accountSubscribe on the token's bonding-curve account
   (wss://solana-rpc.publicnode.com) — every buy/sell changes the curve reserves; we decode them (buy = SOL in, sell = SOL out).
   With a funded PumpPortal API key, subscribeTokenTrade gives the exact trades too.
   Metadata (image, socials) from the token's IPFS uri via a CORS-enabled gateway (ipfs.io now returns 429 to browsers).
   pump.fun's own frontend API is behind a Cloudflare challenge (403) → not used.
   Trades: PumpPortal trade-local returns an unsigned tx → signed by Phantom (popup) or by the BOT CÜZDANI (locally). */
"use strict";
const PUMP = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (x, d = 2) => (x === null || x === undefined || !isFinite(+x)) ? "—" : (+x).toLocaleString("en-US", { maximumFractionDigits: d });
const usd = x => { x = +x; if (!isFinite(x)) return "—"; const a = Math.abs(x); return "$" + (a >= 1e6 ? (x/1e6).toFixed(2) + "M" : a >= 1e3 ? (x/1e3).toFixed(1) + "K" : a >= 1 ? x.toFixed(0) : x.toPrecision(3)); };
const short = a => a ? String(a).slice(0, 4) + "…" + String(a).slice(-4) : "—";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
const tm = ms => new Date(ms).toLocaleTimeString("tr-TR", { timeZone: TZ });
const age = ms => { const s = Math.max(0, Math.floor((Date.now() - ms)/1000)); return s < 60 ? s + "sn" : s < 3600 ? Math.floor(s/60) + "dk " + (s % 60) + "sn" : Math.floor(s/3600) + "sa " + Math.floor(s/60) % 60 + "dk"; };
const T = () => window.TRADE;
const S = { ws: null, on: false, manualOff: false, feed: [], all: new Map(), creators: new Map(), names: new Map(), rate: [], key: localStorage.getItem("neon.pp.key") || "", solUsd: null, sel: null, subs: new Set(), paintQ: false };
const PS = () => Object.assign({ slip: 15, prio: 0.0005, pool: "auto", amt: 0.05, wallet: "phantom", hideRisk: false, onlySoc: false }, (() => { try { return JSON.parse(localStorage.getItem("neon.pp") || "{}"); } catch(e){ return {}; } })());
const PSset = o => localStorage.setItem("neon.pp", JSON.stringify(Object.assign(PS(), o)));
const SUPPLY = 1e9, INIT_REAL_TOK = 793100000, FEE = 0.0125;
/* ------------------------- PumpPortal data WS ------------------------- */
function start(){ if (S.ws) return; S.on = true; const url = "wss://pumpportal.fun/api/data" + (S.key ? "?api-key=" + encodeURIComponent(S.key) : "");
  let ws; try { ws = new WebSocket(url); } catch(e){ stat("✖ bağlanamadı"); return; } S.ws = ws; stat("○ bağlanıyor");
  ws.onopen = () => { ws.send(JSON.stringify({ method: "subscribeNewToken" })); ws.send(JSON.stringify({ method: "subscribeMigration" })); if (S.sel && S.key) ws.send(JSON.stringify({ method: "subscribeTokenTrade", keys: [S.sel.mint] })); stat("● CANLI"); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch(e){ return; }
    if (m.message){ if (/only available/i.test(m.message)) note("Tam işlem akışı (subscribeTokenTrade) için en az 0.02 SOL yüklü PumpPortal API anahtarı gerekir — anahtarsız da canlı mcap/işlemler bonding curve'den çözülüyor."); return; }
    if (m.txType === "create") onCreate(m);
    else if (m.txType === "migrate" || (m.pool && !m.txType)){ const t = S.all.get(m.mint); if (t){ t.migrated = true; paint(); } }
    else if ((m.txType === "buy" || m.txType === "sell") && S.sel && m.mint === S.sel.mint){ addTrade({ t: Date.now(), side: m.txType, sol: +m.solAmount, who: m.traderPublicKey, mcap: +m.marketCapSol, src: "pp" }); } };
  ws.onclose = () => { S.ws = null; stat("○ kapalı"); if (S.on) setTimeout(() => S.on && start(), 3000); };
  ws.onerror = () => {}; }
function stop(){ S.on = false; if (S.ws) try { S.ws.close(); } catch(e){} S.ws = null; stat("○ kapalı"); }
function stat(t){ const el = $("#pf-st"); if (el){ el.textContent = t; el.className = "pill " + (/CANLI/.test(t) ? "g" : ""); } }
function note(t){ const el = $("#pf-note"); if (el) el.textContent = t; }
function onCreate(m){ const t = { mint: m.mint, name: m.name || "", symbol: m.symbol || "?", uri: m.uri || "", creator: m.traderPublicKey, devTok: +m.initialBuy || 0, devSol: +m.solAmount || 0,
    mcap0: +m.marketCapSol || null, mcap: +m.marketCapSol || null, pool: m.pool || (m.solInPool ? "bonk/launchlab" : "?"), curve: m.bondingCurveKey || null, at: Date.now(), sig: m.signature, mayhem: !!m.is_mayhem_mode, meta: null, metaErr: false, hist: [] };
  t.devPct = t.devTok/SUPPLY*100; const c = (S.creators.get(t.creator) || 0) + 1; S.creators.set(t.creator, c); t.serial = c;
  const nk = (t.symbol + "|" + t.name).toLowerCase().replace(/[^a-z0-9|]/g, ""); t.copy = (S.names.get(nk) || 0); S.names.set(nk, t.copy + 1); if (S.names.size > 3000) S.names.clear();
  if (t.mcap) t.hist.push([t.at, t.mcap]);
  S.feed.unshift(t); S.all.set(t.mint, t); if (S.feed.length > 80){ const x = S.feed.pop(); if (x !== S.sel && !(window.AUTO && AUTO.watching(x.mint))) S.all.delete(x.mint); }
  S.rate.push(Date.now()); while (S.rate.length && S.rate[0] < Date.now() - 60000) S.rate.shift();
  risk(t); window.BUS && BUS.emit("pump"); S.subs.forEach(f => { try { f(t); } catch(e){ console.error(e); } }); paint(); metaQ(t); }
/* ------------------------- metadata (IPFS via CORS gateways) ------------------------- */
/* tested 2026-11-10: ipfs.io/dweb.link 429 browsers; pump.mypinata.cloud serves images but 403s most metadata JSON */
const GW = ["https://gateway.pinata.cloud/ipfs/", "https://ipfs.4everland.io/ipfs/", "https://pump.mypinata.cloud/ipfs/"], IMGW = "https://pump.mypinata.cloud/ipfs/";
const cidOf = u => { const m = /\/ipfs\/([A-Za-z0-9]+)/.exec(u || "") || /^ipfs:\/\/([A-Za-z0-9]+)/.exec(u || ""); return m ? m[1] : null; };
const img = u => { const c = cidOf(u); return c ? IMGW + c : u; };
let mq = [], mrun = 0;
function metaQ(t, prio){ if (t.meta || t.metaErr || t._mq) return; t._mq = true; prio ? mq.unshift(t) : mq.push(t); if (mq.length > 40) mq.length = 40; pump(); }
function pump(){ while (mrun < 4 && mq.length){ const t = mq.shift(); mrun++; loadMeta(t).finally(() => { mrun--; pump(); }); } }
const BADIMG = new Set(); function badImg(el){ BADIMG.add(el.getAttribute("src")); el.remove(); }
const badHost = new Set(); /* hosts that refused CORS once are skipped (they spam console errors) */
async function loadMeta(t){ const c = cidOf(t.uri), urls = c ? GW.map(g => g + c) : t.uri ? [t.uri] : [];
  for (const u of urls){ let h = ""; try { h = new URL(u).host; } catch(e){ continue; } if (badHost.has(h)) continue;
    try { const r = await fetch(u, { signal: AbortSignal.timeout(6000) }).catch(e => { if (!c && e.name === "TypeError") badHost.add(h); throw e; }); if (!r.ok) continue; const j = await r.json(); t.meta = { image: j.image ? img(j.image) : null, tw: j.twitter || j.x || null, tg: j.telegram || null, web: j.website || null, desc: (j.description || "").slice(0, 280) }; break; } catch(e){} }
  if (!t.meta) t.metaErr = true; risk(t); paint(); if (S.sel === t) detail(); }
/* ------------------------- rug-risk score (heuristic) ------------------------- */
function risk(t){ const F = [];
  if (t.devPct > 10) F.push([25, `geliştirici arzın %${t.devPct.toFixed(1)}'ini aldı`]); else if (t.devPct > 5) F.push([12, `geliştirici payı %${t.devPct.toFixed(1)}`]); else if (t.devSol === 0) F.push([6, "geliştirici hiç almadı"]);
  if (t.meta){ const n = [t.meta.tw, t.meta.tg, t.meta.web].filter(Boolean).length; if (!n) F.push([20, "sosyal hesap yok"]); else if (n === 1) F.push([8, "tek sosyal bağlantı"]); if (!t.meta.image) F.push([8, "görsel yok"]); }
  else if (t.metaErr) F.push([15, "metadata okunamadı"]);
  if (t.serial > 1) F.push([Math.min(30, 12*t.serial), `aynı yaratıcının bu oturumdaki ${t.serial}. tokenı`]);
  if (t.copy > 0) F.push([12, "aynı isim/sembol daha önce çıktı (kopya)"]);
  if (t.mcap && t.mcap0 && t.mcap < t.mcap0*0.85) F.push([12, "çıkıştan beri piyasa değeri düştü"]);
  if (t.top10 !== undefined && t.top10 > 35) F.push([18, `ilk 10 sahip %${t.top10.toFixed(0)}`]);
  if (t.auth) F.push([25, t.auth]);
  if (t.odd) F.push([30, `standart dışı bonding curve (sanal SOL ${fmt(t.odd, 2)} ≠ 30) — fiyat PumpPortal mcap'inden çok farklı`]);
  t.riskF = F; t.risk = Math.min(100, F.reduce((s, f) => s + f[0], 0)); return t.risk; }
const rlab = r => r >= 60 ? ["YÜKSEK", "r"] : r >= 30 ? ["ORTA", "y"] : ["DÜŞÜK", "g"];
/* ------------------------- bonding curve live (RPC WS accountSubscribe) ------------------------- */
const CW = { ws: null, id: 1, byReq: new Map(), bySub: new Map(), want: new Map(), open: false, retry: 0 };
function cwOpen(){ if (CW.ws) return; const ws = new WebSocket("wss://solana-rpc.publicnode.com"); CW.ws = ws;
  ws.onopen = () => { CW.open = true; CW.retry = 0; for (const k of CW.want.keys()) cwSend(k); };
  ws.onmessage = ev => { let j; try { j = JSON.parse(ev.data); } catch(e){ return; }
    if (j.id && CW.byReq.has(j.id)){ const k = CW.byReq.get(j.id); CW.byReq.delete(j.id); if (typeof j.result === "number"){ CW.bySub.set(j.result, k); const w = CW.want.get(k); if (w) w.sub = j.result; } return; }
    if (j.method === "accountNotification"){ const k = CW.bySub.get(j.params.subscription), w = k && CW.want.get(k); if (!w) return; const c = decode(j.params.result.value.data[0]); if (c) w.cbs.forEach(f => { try { f(c); } catch(e){} }); } };
  ws.onclose = () => { CW.ws = null; CW.open = false; CW.bySub.clear(); for (const w of CW.want.values()) w.sub = null; if (CW.want.size) setTimeout(cwOpen, Math.min(15000, 1000*2**CW.retry++)); };
  ws.onerror = () => {}; }
function cwSend(k){ if (!CW.open) return; const id = CW.id++; CW.byReq.set(id, k); CW.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method: "accountSubscribe", params: [k, { encoding: "base64", commitment: "confirmed" }] })); }
function curveSub(k, cb){ if (!k) return () => {}; let w = CW.want.get(k); if (!w){ w = { cbs: new Set(), sub: null }; CW.want.set(k, w); if (CW.open) cwSend(k); else cwOpen(); } w.cbs.add(cb);
  return () => { w.cbs.delete(cb); if (!w.cbs.size){ CW.want.delete(k); if (w.sub !== null && CW.open) try { CW.ws.send(JSON.stringify({ jsonrpc: "2.0", id: CW.id++, method: "accountUnsubscribe", params: [w.sub] })); } catch(e){} if (!CW.want.size && CW.ws) setTimeout(() => { if (!CW.want.size && CW.ws) CW.ws.close(); }, 5000); } }; }
function decode(b64){ try { const b = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); if (b.length < 49) return null; const v = new DataView(b.buffer); const u = o => Number(v.getBigUint64(o, true));
    const vTok = u(8)/1e6, vSol = u(16)/1e9, rTok = u(24)/1e6, rSol = u(32)/1e9, sup = u(40)/1e6, complete = b[48] === 1;
    return { vTok, vSol, rTok, rSol, sup, complete, price: vSol/vTok, mcap: vSol/vTok*(sup || SUPPLY), prog: Math.max(0, Math.min(100, 100 - rTok/INIT_REAL_TOK*100)) }; } catch(e){ return null; } }
async function curveNow(k){ const r = await T().ph.rpc("getAccountInfo", [k, { encoding: "base64", commitment: "confirmed" }]); return r && r.value ? decode(r.value.data[0]) : null; }
const sellQuote = (c, tokens) => c ? Math.max(0, (c.vSol - c.vSol*c.vTok/(c.vTok + tokens))*(1 - FEE)) : null;
/* ------------------------- feed UI ------------------------- */
function rowHTML(t){ const [rl, rc] = rlab(t.risk), sol = S.solUsd, m = t.meta || {};
  return `<div class="pf-row ${S.sel === t ? "sel" : ""}" data-mint="${esc(t.mint)}"><div class="pf-img">${m.image && !BADIMG.has(m.image) ? `<img src="${esc(m.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="PUMP.badImg(this)">` : `<span>${esc((t.symbol || "?").slice(0, 2))}</span>`}</div>
    <div class="pf-mid"><div><b>${esc(t.symbol.slice(0, 12))}</b> <span class="pf-name">${esc(t.name.slice(0, 26))}</span></div>
      <div class="pf-sub"><span>mcap <b>${t.mcap ? fmt(t.mcap, 1) + " SOL" : "—"}</b>${sol && t.mcap ? " · " + usd(t.mcap*sol) : ""}</span><span data-age="${t.at}">${age(t.at)}</span></div>
      <div class="pf-sub dim"><span>dev ${short(t.creator)} · %${fmt(t.devPct, 1)} · ${fmt(t.devSol, 2)} SOL</span><span>${m.tw ? "𝕏" : ""}${m.tg ? " ✈" : ""}${m.web ? " 🌐" : ""}${t.pool !== "pump" ? ` <span class="pill">${esc(t.pool)}</span>` : ""}${t.migrated ? ` <span class="pill g">AMM</span>` : ""}</span></div></div>
    <div class="pf-r"><span class="risk ${rc}" title="rug riski">${t.risk}<small>${rl}</small></span><span class="pf-l"><a href="https://pump.fun/coin/${esc(t.mint)}" target="_blank" rel="noopener" title="pump.fun">pf↗</a><a href="https://solscan.io/token/${esc(t.mint)}" target="_blank" rel="noopener" title="Solscan">ss↗</a></span></div></div>`; }
function visible(){ const s = PS(); return S.feed.filter(t => (!s.hideRisk || t.risk < 60) && (!s.onlySoc || (t.meta && (t.meta.tw || t.meta.tg || t.meta.web)))); }
function paint(){ if (S.paintQ) return; S.paintQ = true; setTimeout(() => { S.paintQ = false; const el = $("#pf-feed"); if (!el) return; const v = visible().slice(0, 30);
    el.innerHTML = v.length ? v.map(rowHTML).join("") : `<div class="empty">${S.ws ? "yeni token bekleniyor… (dakikada onlarca çıkar)" : "akış kapalı — CANLI AKIŞI BAŞLAT"}</div>`;
    const r = $("#pf-rate"); if (r) r.textContent = `${S.rate.length}/dk · ${S.feed.length} token`; }, 300); }
setInterval(() => { if (document.hidden) return; document.querySelectorAll("[data-age]").forEach(e => e.textContent = age(+e.dataset.age)); const a = $("#pfd-age"); if (a && S.sel) a.textContent = age(S.sel.at); }, 1000);
/* ------------------------- detail ------------------------- */
let unsubSel = null, trades = [], lastC = null;
function select(mint){ const t = S.all.get(mint); if (!t) return; if (unsubSel){ unsubSel(); unsubSel = null; } if (S.sel && S.key && S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ method: "unsubscribeTokenTrade", keys: [S.sel.mint] }));
  S.sel = t; trades = []; lastC = null; metaQ(t, true); detail(); paint();
  if (S.key && S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ method: "subscribeTokenTrade", keys: [t.mint] }));
  if (t.curve){ curveNow(t.curve).then(c => { if (c && S.sel === t){ onCurve(t, c, true); } }).catch(() => {}); unsubSel = curveSub(t.curve, c => onCurve(t, c)); }
  holders(t); const d = $("#pf-detail"); d && d.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }); }
function oddCheck(t, c){ /* some new pump.fun curves start with non-standard virtual SOL (seen on-chain: 0.67 and 964 SOL instead of 30) */
  const v0 = c.vSol - c.rSol; if (t.odd === undefined){ t.odd = Math.abs(v0 - 30) > 1.5 ? v0 : 0; if (t.odd){ t.mcap0 = c.mcap; t.hist = []; } } }
function onCurve(t, c, first){ oddCheck(t, c); const prev = lastC; lastC = c; t.mcap = c.mcap; t.prog = c.prog; t.complete = c.complete; t.hist.push([Date.now(), c.mcap]); if (t.hist.length > 400) t.hist.shift();
  if (prev && !first && !S.key){ const d = c.vSol - prev.vSol; if (Math.abs(d) > 1e-6) addTrade({ t: Date.now(), side: d > 0 ? "buy" : "sell", sol: Math.abs(d), mcap: c.mcap, src: "curve" }); }
  risk(t); detailLive(); }
function addTrade(x){ trades.unshift(x); if (trades.length > 40) trades.length = 40; window.BUS && BUS.emit("pump"); const el = $("#pfd-trades"); if (el) el.innerHTML = tradesHTML(); detailLive(); }
const tradesHTML = () => trades.length ? trades.map(x => `<div class="${x.side === "buy" ? "up" : "dn"}"><small>${tm(x.t)}</small> ${x.side === "buy" ? "▲ AL" : "▼ SAT"} <b>${fmt(x.sol, 4)} SOL</b>${S.solUsd ? " ≈ $" + (x.sol*S.solUsd).toFixed(2) : ""}${x.who ? " · " + short(x.who) : ""} · mcap ${fmt(x.mcap, 1)}</div>`).join("")
  : `<div class="empty">işlem bekleniyor… (bonding curve izleniyor)</div>`;
async function holders(t){ if (t._hAt && Date.now() - t._hAt < 60000) return; t._hAt = Date.now();
  try { const mi = await T().ph.rpc("getAccountInfo", [t.mint, { encoding: "jsonParsed" }]); const inf = mi && mi.value && mi.value.data && mi.value.data.parsed && mi.value.data.parsed.info;
    if (inf) t.auth = inf.mintAuthority ? "mint yetkisi açık (yeni token basılabilir)" : inf.freezeAuthority ? "dondurma yetkisi açık" : null; } catch(e){}
  // getTokenLargestAccounts is a heavy call that free RPCs rate-limit; failure only leaves "top 10" unknown
  try { const r = await T().ph.rpc("getTokenLargestAccounts", [t.mint, { commitment: "confirmed" }]); const a = (r.value || []).map(x => +x.uiAmount || 0);
    // the largest account is usually the bonding curve's own token account → exclude it while the token is on the curve
    if (a.length){ const rest = t.migrated || t.complete ? a : a.slice(1); t.top10 = rest.slice(0, 10).reduce((s, x) => s + x, 0)/SUPPLY*100; } } catch(e){ t.top10err = true; }
  risk(t); if (S.sel === t) detail(); paint(); }
function spark(){ const c = $("#pfd-spark"), t = S.sel; if (!c || !t || t.hist.length < 2) return; const r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); c.width = r.width*dpr; c.height = r.height*dpr;
  const g = c.getContext("2d"); g.scale(dpr, dpr); const v = t.hist.map(x => x[1]), lo = Math.min(...v), hi = Math.max(...v), sp = hi - lo || 1, W = r.width, H = r.height;
  g.beginPath(); v.forEach((y, i) => { const X = i/(v.length - 1)*(W - 2) + 1, Y = H - 3 - (y - lo)/sp*(H - 6); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); const up = v[v.length - 1] >= v[0];
  g.strokeStyle = up ? "#39ff14" : "#ff3355"; g.lineWidth = 1.6; g.shadowColor = g.strokeStyle; g.shadowBlur = 6; g.stroke(); g.shadowBlur = 0; g.fillStyle = "#6fa5b5"; g.font = "9px Share Tech Mono"; g.fillText(fmt(hi, 1) + " SOL", 3, 10); g.fillText(fmt(lo, 1), 3, H - 3); }
function detailLive(){ const t = S.sel; if (!t) return; const m = $("#pfd-mcap"); if (m) m.innerHTML = `${t.mcap ? fmt(t.mcap, 2) + " SOL" : "—"} <small>${S.solUsd && t.mcap ? usd(t.mcap*S.solUsd) : ""}</small>`;
  const p = $("#pfd-prog"); if (p && t.prog !== undefined){ p.querySelector("div").style.width = t.prog.toFixed(1) + "%"; p.querySelector("span").textContent = t.complete ? "bonding curve TAMAM → AMM" : "bonding curve %" + t.prog.toFixed(1); }
  const ch = $("#pfd-ch"); if (ch && t.mcap0 && t.mcap){ const x = (t.mcap/t.mcap0 - 1)*100; ch.textContent = (x >= 0 ? "+" : "") + x.toFixed(1) + "% çıkıştan beri"; ch.className = x >= 0 ? "up" : "dn"; }
  const pos = window.WALLET && WALLET.pos.get(t.mint), pe = $("#pfd-pos"); if (pe) pe.innerHTML = pos ? posLine(pos, lastC) : "";
  spark(); }
function posLine(p, c){ const v = p.tokens && c ? sellQuote(c, p.tokens) : null, pn = v !== null ? (v/p.solIn - 1)*100 : null;
  return `<div class="pos ${pn === null ? "" : pn >= 0 ? "l" : "s"}"><b>BOT pozisyonu ${p.auto ? "· OTO" : ""}</b><span>${fmt(p.tokens, 0)} ${esc(p.sym)} · maliyet ${fmt(p.solIn, 4)} SOL</span><span class="${pn >= 0 ? "up" : "dn"}">${v === null ? "değer —" : "değer ≈ " + fmt(v, 4) + " SOL (" + (pn >= 0 ? "+" : "") + pn.toFixed(1) + "%)"}</span></div>`; }
function detail(){ const el = $("#pf-detail"), t = S.sel; if (!el) return; if (!t){ el.innerHTML = ""; return; } const m = t.meta || {}, [rl, rc] = rlab(t.risk), s = PS();
  const bot = window.WALLET && WALLET.exists();
  el.innerHTML = `<div class="pfd"><div class="pfd-h"><div class="pf-img big">${m.image && !BADIMG.has(m.image) ? `<img src="${esc(m.image)}" alt="" referrerpolicy="no-referrer" onerror="PUMP.badImg(this)">` : `<span>${esc(t.symbol.slice(0, 2))}</span>`}</div>
      <div class="pfd-t"><b>${esc(t.symbol)}</b> <span>${esc(t.name)}</span><small class="pfd-mint">${esc(t.mint)}</small><small>yaratıcı <a href="https://solscan.io/account/${esc(t.creator)}" target="_blank" rel="noopener">${short(t.creator)} ↗</a> · yaş <span id="pfd-age">${age(t.at)}</span></small></div>
      <button type="button" class="mini" id="pfd-x" aria-label="kapat">✕</button></div>
    <div class="pfd-links"><a href="https://pump.fun/coin/${esc(t.mint)}" target="_blank" rel="noopener">pump.fun ↗</a><a href="https://solscan.io/token/${esc(t.mint)}" target="_blank" rel="noopener">Solscan ↗</a><a href="https://dexscreener.com/solana/${esc(t.mint)}" target="_blank" rel="noopener">DexScreener ↗</a>${m.tw ? `<a href="${esc(m.tw)}" target="_blank" rel="noopener nofollow">𝕏 ↗</a>` : ""}${m.tg ? `<a href="${esc(m.tg)}" target="_blank" rel="noopener nofollow">Telegram ↗</a>` : ""}${m.web ? `<a href="${esc(m.web)}" target="_blank" rel="noopener nofollow">Web ↗</a>` : ""}<button type="button" class="mini" id="pfd-copy">MINT KOPYALA</button></div>
    ${m.desc ? `<div class="pfd-desc">${esc(m.desc)}</div>` : ""}
    <div class="pfd-grid"><div><small>CANLI PİYASA DEĞERİ</small><b id="pfd-mcap">—</b><span id="pfd-ch"></span></div><div><small>RUG RİSKİ</small><b class="risk ${rc}">${t.risk} · ${rl}</b><span class="dim">sezgisel skor</span></div></div>
    <div class="pfd-prog" id="pfd-prog"><div></div><span>bonding curve —</span></div><canvas id="pfd-spark"></canvas>
    <details class="pfd-rf"><summary>Risk faktörleri (${t.riskF.length})</summary>${t.riskF.length ? t.riskF.map(f => `<div><span class="dn">+${f[0]}</span> ${esc(f[1])}</div>`).join("") : "<div>belirgin risk bulunamadı — bu, güvenli olduğu anlamına gelmez</div>"}${t.top10 !== undefined ? `<div class="dim">ilk 10 sahip (curve hariç): %${t.top10.toFixed(1)}</div>` : ""}</details>
    <div id="pfd-pos"></div>
    <div class="sub-h">CANLI İŞLEMLER <small>${S.key ? "PumpPortal" : "bonding curve (RPC WS)"}</small></div><div id="pfd-trades" class="tlog">${tradesHTML()}</div>
    <div class="sub-h">AL / SAT</div>
    <div class="wsel"><button type="button" data-w="phantom" class="${s.wallet !== "bot" ? "on" : ""}">PHANTOM</button><button type="button" data-w="bot" class="${s.wallet === "bot" ? "on" : ""}">BOT CÜZDANI ${bot ? (WALLET.unlocked() ? "●" : "🔒") : "(yok)"}</button></div>
    <div class="f2"><label>Miktar (AL: SOL · SAT: adet ya da %)<input id="pf-amt" inputmode="decimal" value="${esc(s.amt)}"></label><label>Kayma %<input id="pf-slip" inputmode="decimal" value="${esc(s.slip)}"></label></div>
    <div class="f2"><label>Öncelik ücreti (SOL)<input id="pf-prio" inputmode="decimal" value="${esc(s.prio)}"></label><label>Havuz<select id="pf-pool">${["auto","pump","pump-amm","raydium","raydium-cpmm","launchlab","bonk"].map(x => `<option ${x === s.pool ? "selected" : ""}>${x}</option>`).join("")}</select></label></div>
    <div class="side-btns"><button type="button" id="pf-buy" class="l on">▲ AL → ONAY</button><button type="button" id="pf-sell" class="s on">▼ SAT → ONAY</button></div>
    <div class="cf-warn">⚠ pump.fun tokenlarının büyük çoğunluğu kısa sürede değerinin neredeyse tamamını kaybeder; rug-pull, bot ve sandviç saldırıları yaygındır. Kaybetmeyi göze alamayacağın parayı kullanma.</div></div>`;
  $("#pfd-x").onclick = () => { if (unsubSel){ unsubSel(); unsubSel = null; } S.sel = null; detail(); paint(); };
  $("#pfd-copy").onclick = () => navigator.clipboard && navigator.clipboard.writeText(t.mint).then(() => NOTIFY.toast("Mint kopyalandı"));
  el.querySelectorAll(".wsel button").forEach(b => b.onclick = () => { PSset({ wallet: b.dataset.w }); detail(); });
  $("#pf-buy").onclick = () => manual("buy"); $("#pf-sell").onclick = () => manual("sell");
  detailLive(); }
/* ------------------------- trading ------------------------- */
async function tradeLocal(pubkey, o){ const r = await fetch("https://pumpportal.fun/api/trade-local", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey: pubkey, action: o.action, mint: o.mint, amount: o.amount, denominatedInSol: o.denominatedInSol, slippage: o.slip, priorityFee: o.prio, pool: o.pool || "auto" }) });
  if (r.status !== 200){ const tx = await r.text().catch(() => ""); throw new Error("PumpPortal HTTP " + r.status + (tx ? ": " + tx.slice(0, 160) : "")); }
  return new Uint8Array(await r.arrayBuffer()); }
/* bot-wallet trade (no popup). Used by manual BOT trades after ONAYLA, and by OTO AL-SAT. */
async function botTrade(o){ const W = window.WALLET; if (!W || !W.unlocked()) throw new Error("BOT CÜZDANI kilitli ya da yok");
  const pre = await W.solBal(); const bytes = await tradeLocal(W.pub(), o); const sig = await W.signSendVersioned(bytes); window.BUS && BUS.emit("order", { to: "pf", from: "bt" });
  let post = await W.solBal(), tokens = null; if (o.action === "buy") for (let i = 0; i < 6; i++){ tokens = await W.tokenBal(o.mint).catch(() => 0); if (tokens > 0) break; await new Promise(r => setTimeout(r, 1500)); }
  if (o.action === "buy" && post >= pre) post = await W.solBal();
  W.recordTrade({ venue: "pump.fun", mint: o.mint, sym: o.sym, side: o.action, solDelta: post - pre, sig, auto: !!o.auto, reason: o.reason, tokens, mcapSol: o.mcap, curve: o.curve });
  setTimeout(() => W.paintBal && W.paintBal(), 1500); return { sig, solDelta: post - pre, tokens }; }
function plog(msg, cls){ const el = $("#pf-log"); if (!el) return; el.insertAdjacentHTML("afterbegin", `<div class="${cls || ""}"><small>${tm(Date.now())}</small> ${msg}</div>`); while (el.children.length > 40) el.lastChild.remove(); }
async function manual(action){ const t = S.sel; if (!t){ plog("✖ Önce akıştan bir token seç.", "dn"); return; } const s = PS(), useBot = s.wallet === "bot";
  const v = { slip: +($("#pf-slip").value || "").replace(",", "."), prio: +($("#pf-prio").value || "").replace(",", "."), pool: $("#pf-pool").value }, raw = ($("#pf-amt").value || "").trim().replace(",", ".");
  if (!(v.slip >= 0.5 && v.slip <= 50)){ plog("✖ Kayma %0.5–50 olmalı.", "dn"); return; } if (!(v.prio >= 0 && v.prio <= 0.01)){ plog("✖ Öncelik ücreti 0–0.01 SOL olmalı.", "dn"); return; }
  const pctSell = action === "sell" && /%$/.test(raw), amt = pctSell ? raw : +raw;
  if (pctSell ? !(+raw.slice(0, -1) > 0 && +raw.slice(0, -1) <= 100) : !(amt > 0)){ plog("✖ Miktar gir (alımda SOL; satışta adet ya da %, ör. 100%).", "dn"); return; }
  if (action === "buy" && amt > 5){ plog("✖ Güvenlik sınırı: tek alım en fazla 5 SOL.", "dn"); return; }
  PSset(Object.assign({}, v, action === "buy" ? { amt } : {}));
  let who; if (useBot){ if (!WALLET.exists()){ plog("✖ BOT CÜZDANI yok — aşağıdaki BOT bölümünden oluştur.", "dn"); return; } if (!WALLET.unlocked()){ plog("✖ BOT CÜZDANI kilitli — PIN ile aç.", "dn"); window.BOTUI && BOTUI.open("w"); return; } who = "BOT " + short(WALLET.pub()); }
  else { const P = T().ph, p = P.prov(); if (!p){ plog("✖ Phantom yok: siteyi Phantom uygulamasının tarayıcısında aç (BAĞLANTILAR → PHANTOM) ya da BOT CÜZDANI seç.", "dn"); return; }
    if (!P.pk){ try { const r = await p.connect(); P.pk = (r.publicKey || p.publicKey).toString(); } catch(e){ plog("✖ Phantom bağlanamadı: " + esc(e.message || e), "dn"); return; } } who = "Phantom " + short(P.pk); }
  const est = action === "sell" && lastC && useBot ? (() => { const p = WALLET.pos.get(t.mint); return p && p.tokens ? sellQuote(lastC, pctSell ? p.tokens*(+raw.slice(0, -1))/100 : amt) : null; })() : null;
  const rows = [["Ağ", "Solana MAINNET (gerçek)", "dn"], ["Cüzdan", who], ["Token", `${t.symbol} · ${short(t.mint)}`], ["İşlem", action === "buy" ? "AL (BUY)" : "SAT (SELL)", action === "buy" ? "up" : "dn"],
    ["Miktar", action === "buy" ? `${amt} SOL${S.solUsd ? " ≈ $" + (amt*S.solUsd).toFixed(2) : ""}` : pctSell ? `tokenların ${raw}` : `${fmt(amt, 4)} ${t.symbol}`], ["Kayma", "%" + v.slip], ["Öncelik ücreti", v.prio + " SOL"], ["Havuz", v.pool],
    ["Piyasa değeri", t.mcap ? fmt(t.mcap, 1) + " SOL" : "—"], ["Rug riski", t.risk + " / 100 · " + rlab(t.risk)[0], t.risk >= 60 ? "dn" : ""]];
  if (est !== null) rows.push(["Tahmini dönüş", "≈ " + fmt(est, 4) + " SOL"]);
  if (!(await T().confirmSheet({ title: "PUMP.FUN İŞLEMİNİ ONAYLA", rows, mode: "GERÇEK", warn: useBot ? "BOT CÜZDANI bu cihazda imzalar ve <b>hemen gönderir</b> (Phantom penceresi açılmaz). Zincire gidince geri alınamaz." : "İşlem PumpPortal tarafından hazırlanır, Phantom'da <b>sen imzalarsın</b>; Phantom ayrıca kendi onayını gösterecek.", okText: useBot ? "ONAYLA · BOT İLE GÖNDER" : "ONAYLA · PHANTOM'DA İMZALA" }))){ plog("İşlem iptal edildi."); return; }
  const o = { action, mint: t.mint, sym: t.symbol, amount: amt, denominatedInSol: action === "buy" ? "true" : "false", slip: v.slip, prio: v.prio, pool: v.pool, mcap: t.mcap, curve: t.curve };
  try { plog("İşlem hazırlanıyor (PumpPortal trade-local)…");
    if (useBot){ const r = await botTrade(o); plog(`✔ Onaylandı: <a href="https://solscan.io/tx/${esc(r.sig)}" target="_blank" rel="noopener">${esc(r.sig.slice(0, 10))}…</a> · SOL ${r.solDelta >= 0 ? "+" : ""}${r.solDelta.toFixed(5)}`, "up"); NOTIFY.ping("good", `${t.symbol} ${action === "buy" ? "alındı" : "satıldı"} (BOT)`); }
    else { const P = T().ph, p = P.prov(), bytes = await tradeLocal(P.pk, o), W = await P.web3(), tx = W.VersionedTransaction.deserialize(bytes);
      const res = await p.signAndSendTransaction(tx); const sig = res.signature || res; window.BUS && BUS.emit("order", { to: "pf" });
      JOURNAL.add({ venue: "pump.fun", mode: "MANUEL", wallet: "PHANTOM", sym: t.symbol, mint: t.mint, side: action === "buy" ? "AL" : "SAT", [action === "buy" ? "in" : "out"]: action === "buy" ? amt : null, unit: "SOL", [action === "buy" ? "sigIn" : "sigOut"]: String(sig), note: action === "sell" ? "satış miktarı: " + raw : "" });
      plog(`✔ Gönderildi: <a href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener">${esc(String(sig).slice(0, 10))}… (Solscan)</a>`, "up"); }
  } catch(e){ plog("✖ " + esc(e.code === 4001 ? "Phantom'da reddedildi" : (e.message || String(e))), "dn"); }
  detailLive(); }
/* ------------------------- section UI ------------------------- */
async function solPrice(){ try { const j = await (await fetch("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112", { cache: "no-store" })).json(); S.solUsd = +(j.So11111111111111111111111111111111111111112 || {}).usdPrice || S.solUsd; } catch(e){}
  const el = $("#pf-sol"); if (el && S.solUsd) el.textContent = "SOL $" + S.solUsd.toFixed(2); }
function init(){ const box = $("#pump-box"); if (!box) return; const s = PS();
  box.innerHTML = `<div class="mode-row"><span class="mode-badge real">SOLANA MAINNET</span><span id="pf-st" class="pill">○ kapalı</span><span id="pf-rate" class="dim"></span><span id="pf-sol" class="dim"></span></div>
    <div class="f2"><button type="button" id="pf-toggle" class="mini wide">AKIŞI DURDUR</button><label class="chk"><input type="checkbox" id="pf-hide" ${s.hideRisk ? "checked" : ""}> yüksek riskliyi gizle</label></div>
    <label class="chk"><input type="checkbox" id="pf-soc" ${s.onlySoc ? "checked" : ""}> yalnızca sosyal hesabı olanlar</label>
    <div id="pf-detail"></div>
    <div class="sub-h">YENİ TOKENLAR · CANLI <small>dokun → detay</small></div><div id="pf-feed" class="pf-feed"></div><div id="pf-note" class="plan-foot"></div>
    <div class="sub-h">KAYIT</div><div id="pf-log" class="tlog"></div>
    <details class="keys"><summary>⚙ PumpPortal API anahtarı (isteğe bağlı)</summary><div class="plan-foot">Ücretsiz: yeni token + migrasyon akışı ve bonding curve'den canlı mcap/işlemler. Tam işlem akışı (cüzdan adresleriyle) PumpPortal'da en az 0.02 SOL yüklü anahtar ister. Anahtar yalnızca bu cihazda saklanır.</div>
      <label>API key<input id="pf-key" type="password" autocomplete="off" value="${esc(S.key)}"></label><div class="sheet-btns"><button type="button" id="pf-key-save" class="save">KAYDET</button></div></details>
    <div class="plan-foot">Kaynaklar: PumpPortal WebSocket (yeni tokenlar), Solana RPC WebSocket (bonding curve), IPFS (görsel/sosyal), Jupiter (SOL fiyatı). pump.fun'ın kendi API'si Cloudflare korumalı olduğu için kullanılmıyor. İşlem: PumpPortal <b>trade-local</b> imzasız işlem döndürür; imzayı Phantom ya da BOT CÜZDANI atar — PumpPortal anahtarını görmez. PumpPortal işlem başına ~%0.5 ücret alır.</div>`;
  $("#pf-toggle").onclick = () => { if (S.on){ S.manualOff = true; stop(); $("#pf-toggle").textContent = "CANLI AKIŞI BAŞLAT"; } else { S.manualOff = false; start(); $("#pf-toggle").textContent = "AKIŞI DURDUR"; } paint(); };
  $("#pf-hide").onchange = e => { PSset({ hideRisk: e.target.checked }); paint(); }; $("#pf-soc").onchange = e => { PSset({ onlySoc: e.target.checked }); paint(); };
  $("#pf-key-save").onclick = () => { S.key = $("#pf-key").value.trim(); if (S.key) localStorage.setItem("neon.pp.key", S.key); else localStorage.removeItem("neon.pp.key"); if (S.ws){ stop(); start(); } plog("PumpPortal anahtarı " + (S.key ? "kaydedildi" : "silindi"), "up"); };
  $("#pf-feed").addEventListener("click", e => { if (e.target.closest("a")) return; const r = e.target.closest(".pf-row"); if (r) select(r.dataset.mint); });
  start(); solPrice(); setInterval(solPrice, 60000); paint(); }
init();
return { onNew: f => S.subs.add(f), curveSub, curveNow, sellQuote, botTrade, get solUsd(){ return S.solUsd; }, get(m){ return S.all.get(m); }, risk, metaQ, select, start, stop, get live(){ return !!S.ws; }, _S: S, decode, badImg };
})();
window.PUMP = PUMP;
