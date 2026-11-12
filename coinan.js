/* NEON//TERMINAL v7.8 — COIN ANALİZ agent: one Binance USDⓈ-M perpetual, analysed from free public Binance Futures endpoints (no API key).
   • multi-timeframe chart analysis (15m / 1h / 4h / 1d): trend, EMA20/50/200, RSI14, MACD(12,26,9), daily VWAP, ATR14, support/resistance (pivot clusters),
     breakout / breakdown of the last 20 bars
   • derivatives: long/short ratio (all accounts + top traders), open interest and its 1h/24h change, funding rate, taker buy/sell volume (1h)
   • whale flow: large aggTrades (taker buys vs sells, dynamic size threshold), net whale delta; live liquidations (@forceOrder) while the panel is open
   • verdict LONG / SHORT / BEKLE with a confidence % (= how strongly the signals agree, NOT a probability), entry zone, stop, TP1/TP2, R:R — drawn on the chart.
   It is analysis, not a guarantee. It never places orders: "İŞLEM'E AKTAR" only fills the existing İŞLEM form; the order still needs EMRİ HAZIRLA → ONAYLA.
   Pure math is exported as CAN (window.CAN in the page, module.exports in Node tests). */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.CAN = M; })(typeof self !== "undefined" ? self : this, function (){
const last = a => a[a.length - 1];
function ema(v, n){ const k = 2/(n + 1), out = []; let e = null; for (let i = 0; i < v.length; i++){ if (i < n - 1){ out.push(null); continue; } if (e === null){ let s = 0; for (let j = i - n + 1; j <= i; j++) s += v[j]; e = s/n; } else e = v[i]*k + e*(1 - k); out.push(e); } return out; }
function rsi(v, n = 14){ const out = v.map(() => null); if (v.length <= n) return out; let g = 0, l = 0; for (let i = 1; i <= n; i++){ const d = v[i] - v[i - 1]; if (d > 0) g += d; else l -= d; } g /= n; l /= n;
  out[n] = l === 0 ? 100 : 100 - 100/(1 + g/l); for (let i = n + 1; i < v.length; i++){ const d = v[i] - v[i - 1]; g = (g*(n - 1) + Math.max(d, 0))/n; l = (l*(n - 1) + Math.max(-d, 0))/n; out[i] = l === 0 ? 100 : 100 - 100/(1 + g/l); } return out; }
function macd(v, f = 12, s = 26, sig = 9){ const ef = ema(v, f), es = ema(v, s), m = v.map((_, i) => ef[i] !== null && es[i] !== null ? ef[i] - es[i] : null);
  const idx = m.findIndex(x => x !== null), sg = idx < 0 ? m.map(() => null) : Array(idx).fill(null).concat(ema(m.slice(idx), sig)); return { macd: m, signal: sg, hist: m.map((x, i) => x !== null && sg[i] !== null ? x - sg[i] : null) }; }
function atr(b, n = 14){ const tr = b.map((x, i) => i ? Math.max(x.h - x.l, Math.abs(x.h - b[i - 1].c), Math.abs(x.l - b[i - 1].c)) : x.h - x.l); const out = tr.map(() => null); if (b.length < n) return out;
  let a = tr.slice(0, n).reduce((s, x) => s + x, 0)/n; out[n - 1] = a; for (let i = n; i < b.length; i++){ a = (a*(n - 1) + tr[i])/n; out[i] = a; } return out; }
function vwap(b){ const out = []; let day = null, pv = 0, vv = 0; for (const x of b){ const d = Math.floor(x.t/86400000); if (d !== day){ day = d; pv = 0; vv = 0; } const tp = (x.h + x.l + x.c)/3; pv += tp*x.v; vv += x.v; out.push(vv ? pv/vv : x.c); } return out; }
/* pivot highs/lows (w bars each side) clustered within tol → levels with touch counts */
function levels(b, w = 3, tol){ const piv = []; for (let i = w; i < b.length - w; i++){ let hi = true, lo = true; for (let j = i - w; j <= i + w; j++){ if (j === i) continue; if (j < i ? b[j].h >= b[i].h : b[j].h > b[i].h) hi = false; if (j < i ? b[j].l <= b[i].l : b[j].l < b[i].l) lo = false; } if (hi) piv.push(b[i].h); if (lo) piv.push(b[i].l); }
  piv.sort((a, c) => a - c); const cl = []; for (const p of piv){ const c = last(cl); if (c && p - c.p <= tol){ c.s += p; c.n++; c.p = c.s/c.n; } else cl.push({ p, s: p, n: 1 }); } return cl.map(c => ({ p: c.p, n: c.n })); }
function nearest(lv, px){ let sup = null, res = null; for (const l of lv){ if (l.p < px && (!sup || l.p > sup.p)) sup = l; if (l.p > px && (!res || l.p < res.p)) res = l; } return { sup, res }; }
/* one timeframe: bars [{t,o,h,l,c,v}] oldest → newest; the last bar may still be open, so signals use the last CLOSED bar */
function tfAnalyze(b){ if (!b || b.length < 60) return null; const cl = b.slice(0, -1), c = cl.map(x => x.c), n = c.length, px = last(b).c, lc = c[n - 1];
  const e20 = ema(c, 20), e50 = ema(c, 50), e200 = n >= 200 ? ema(c, 200) : null, r = rsi(c), m = macd(c), a = atr(cl), vw = vwap(b);
  const E20 = last(e20), E50 = last(e50), E200 = e200 ? last(e200) : null, slope = (E20 - e20[n - 6])/(a[n - 1] || 1);
  const A1 = a[n - 1] || lc*0.005, sgn = (x, band) => x > band ? 1 : x < -band ? -1 : 0; /* dead bands (0.25 ATR price vs EMA, 0.1 ATR EMA20 vs EMA50) so a flat market does not vote */
  let trend = sgn(c[n - 1] - E20, 0.25*A1) + sgn(E20 - E50, 0.1*A1) + sgn(slope, 0.1) + (E200 !== null ? 0.5*sgn(c[n - 1] - E200, 0.25*A1) : 0);
  const hh = Math.max(...cl.slice(-21, -1).map(x => x.h)), ll = Math.min(...cl.slice(-21, -1).map(x => x.l));
  const brk = lc > hh ? "breakout" : lc < ll ? "breakdown" : null, hist = m.hist, H = hist[n - 1], H1 = hist[n - 2];
  return { px, close: lc, e20: E20, e50: E50, e200: E200, rsi: r[n - 1], macd: m.macd[n - 1], sig: m.signal[n - 1], hist: H, histUp: H !== null && H1 !== null && H > H1, atr: a[n - 1], vwap: last(vw),
    trend, dir: trend >= 1.5 ? 1 : trend <= -1.5 ? -1 : 0, hi20: hh, lo20: ll, brk, lv: levels(cl.slice(-200), 3, (a[n - 1] || lc*0.005)*0.5) }; }
/* whales: aggTrades [{p,q,m,T}] (m=true → buyer is maker → taker SOLD). threshold = max(minUsd, 97th percentile notional) */
function whales(ag, minUsd = 20000){ if (!ag || !ag.length) return { n: 0, thr: minUsd, buy: 0, sell: 0, net: 0, share: 0, tot: 0, big: [] };
  const usd = ag.map(x => (+x.p)*(+x.q)), s = usd.slice().sort((a, b) => a - b), thr = Math.max(minUsd, s[Math.floor(s.length*0.97)] || 0); let buy = 0, sell = 0, tot = 0; const big = [];
  ag.forEach((x, i) => { tot += usd[i]; if (usd[i] >= thr){ if (x.m) sell += usd[i]; else buy += usd[i]; big.push({ t: +x.T, p: +x.p, usd: usd[i], side: x.m ? "SELL" : "BUY" }); } });
  return { n: big.length, thr, buy, sell, net: buy - sell, share: tot ? (buy + sell)/tot : 0, tot, big: big.slice(-12).reverse(), from: +ag[0].T, to: +last(ag).T }; }
/* verdict: each factor votes −1…+1 with a weight; confidence = |agreement| mapped to 50–90 % (not a probability) */
const WT = { tf15: 0.5, tf1h: 1.2, tf4h: 1.5, tf1d: 1, brk: 1, rsi: 0.5, macd: 0.8, vwap: 0.4, oi: 0.6, fund: 0.4, gls: 0.3, tls: 0.4, taker: 0.6, whale: 0.8 };
function verdict(A){ const f = []; const add = (k, v, why) => { if (v === null || v === undefined || !isFinite(v)) return; f.push({ k, v: Math.max(-1, Math.min(1, v)), w: WT[k], why }); };
  const T = A.tf || {}; for (const [k, tf] of [["tf15", "15m"], ["tf1h", "1h"], ["tf4h", "4h"], ["tf1d", "1d"]]) if (T[tf]) add(k, T[tf].trend/3.5, `${tf} trend ${T[tf].dir > 0 ? "yukarı" : T[tf].dir < 0 ? "aşağı" : "yatay"}`);
  const h = T["1h"], h4 = T["4h"];
  if (h){ add("brk", h.brk === "breakout" ? 1 : h.brk === "breakdown" ? -1 : 0, h.brk ? `1h ${h.brk === "breakout" ? "20 mum tepesi kırıldı" : "20 mum dibi kırıldı"}` : "1h aralık içinde");
    add("rsi", h.rsi > 75 ? -0.6 : h.rsi < 25 ? 0.6 : (h.rsi - 50)/50, `1h RSI ${h.rsi.toFixed(0)}${h.rsi > 75 ? " aşırı alım" : h.rsi < 25 ? " aşırı satım" : ""}`);
    { const d = (h.px - h.vwap)/(h.atr || h.px*0.005); add("vwap", Math.abs(d) < 0.25 ? 0 : d > 0 ? 1 : -1, `fiyat VWAP ${Math.abs(d) < 0.25 ? "üzerinde (düz)" : d > 0 ? "üstünde" : "altında"}`); } }
  if (h && h4){ const mv = x => Math.abs(x.hist) < 0.02*(x.atr || 1) ? 0 : x.hist > 0 ? 0.5 : -0.5; add("macd", mv(h) + mv(h4), `MACD 1h ${h.hist > 0 ? "+" : "−"} · 4h ${h4.hist > 0 ? "+" : "−"}`); }
  const D = A.der || {};
  if (isFinite(D.oiCh24) && h){ const pu = h.px > (A.px24 || h.px); add("oi", D.oiCh24 > 3 ? (pu ? 1 : -1) : D.oiCh24 < -3 ? (pu ? 0.3 : -0.3)*-1 : 0, `OI 24s ${D.oiCh24 >= 0 ? "+" : ""}${D.oiCh24.toFixed(1)}% · fiyat ${pu ? "↑" : "↓"}`); }
  if (isFinite(D.fund)) add("fund", D.fund > 0.0005 ? -1 : D.fund > 0.0002 ? -0.4 : D.fund < -0.0003 ? 1 : D.fund < 0 ? 0.3 : 0, `funding %${(D.fund*100).toFixed(4)}`);
  if (isFinite(D.gls)) add("gls", D.gls > 2.5 ? -1 : D.gls > 1.8 ? -0.4 : D.gls < 0.7 ? 1 : D.gls < 0.9 ? 0.4 : 0, `tüm hesaplar L/S ${D.gls.toFixed(2)} (kalabalığa karşı)`);
  if (isFinite(D.tls)) add("tls", D.tls > 1.3 ? 1 : D.tls > 1.1 ? 0.5 : D.tls < 0.75 ? -1 : D.tls < 0.9 ? -0.5 : 0, `büyük oyuncu L/S ${D.tls.toFixed(2)}`);
  if (isFinite(D.taker)) add("taker", D.taker > 1.15 ? 1 : D.taker > 1.03 ? 0.4 : D.taker < 0.87 ? -1 : D.taker < 0.97 ? -0.4 : 0, `taker alış/satış ${D.taker.toFixed(2)}x`);
  const W = A.wh; if (W && W.buy + W.sell > 0){ const r = W.net/(W.buy + W.sell); add("whale", Math.abs(r) < 0.1 ? 0 : r*1.5, `balina net ${W.net >= 0 ? "+" : "−"}$${Math.abs(W.net/1000).toFixed(0)}k`); }
  const sw = f.reduce((s, x) => s + x.w, 0), sc = sw ? f.reduce((s, x) => s + x.v*x.w, 0)/sw : 0;
  let v = sc >= 0.25 ? "LONG" : sc <= -0.25 ? "SHORT" : "BEKLE";
  /* never chase straight into an extreme: 1h RSI > 80 blocks LONG, < 20 blocks SHORT */
  if (h && v === "LONG" && h.rsi > 80){ v = "BEKLE"; f.push({ k: "veto", v: 0, w: 0, why: "1h RSI > 80 — kovalamaya karşı bekle" }); }
  if (h && v === "SHORT" && h.rsi < 20){ v = "BEKLE"; f.push({ k: "veto", v: 0, w: 0, why: "1h RSI < 20 — kovalamaya karşı bekle" }); }
  const conf = Math.round(Math.min(90, 50 + 45*Math.min(1, Math.abs(sc)/0.7)));
  return { v, score: +sc.toFixed(3), conf: v === "BEKLE" ? Math.round(50 + 40*Math.max(0, 1 - Math.abs(sc)/0.25)) : conf, factors: f, plan: plan(v, A) }; }
/* plan from the 1h ATR and the nearest 1h/4h levels. LONG: entry zone [px − 0.4 ATR, px], stop under support (or 1.5 ATR), TP1 1.5R (snapped to resistance in 1–2R), TP2 3R */
function plan(v, A){ const h = A.tf && A.tf["1h"]; if (!h || !(h.atr > 0)) return null; const px = h.px, a = h.atr, lv = (h.lv || []).concat((A.tf["4h"] && A.tf["4h"].lv) || []), N = nearest(lv, px);
  if (v === "BEKLE") return { side: null, sup: N.sup && N.sup.p, res: N.res && N.res.p, longAbove: h.hi20, shortBelow: h.lo20 };
  const L = v === "LONG", s = L ? 1 : -1, z1 = px - s*0.4*a, z2 = px, mid = (z1 + z2)/2;
  const lvl = L ? N.sup : N.res; let stop = mid - s*1.5*a; if (lvl && Math.abs(mid - lvl.p) < 2.8*a && Math.abs(mid - lvl.p) > 0.4*a) stop = lvl.p - s*0.25*a;
  const R = Math.abs(mid - stop); let tp1 = mid + s*1.5*R; const opp = L ? N.res : N.sup; if (opp){ const d = Math.abs(opp.p - mid)/R; if (d >= 1 && d <= 2) tp1 = opp.p - s*0.1*a; }
  const tp2 = mid + s*3*R; return { side: v, zone: [Math.min(z1, z2), Math.max(z1, z2)], entry: mid, stop, tp1, tp2, rr1: Math.abs(tp1 - mid)/R, rr2: Math.abs(tp2 - mid)/R, riskPct: R/mid*100, sup: N.sup && N.sup.p, res: N.res && N.res.p }; }
return { ema, rsi, macd, atr, vwap, levels, nearest, tfAnalyze, whales, verdict, plan, WT };
});
/* ------------------------- UI (page only) ------------------------- */
if (typeof window !== "undefined" && typeof document !== "undefined") window.COINAN = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const F = "https://fapi.binance.com", TFS = ["15m", "1h", "4h", "1d"], LBL = { "15m": "15dk", "1h": "1s", "4h": "4s", "1d": "1G" };
const j = async p => { const r = await fetch(F + p, { cache: "no-store" }); if (!r.ok) throw new Error("Binance HTTP " + r.status); return r.json(); };
const S = { list: [], vol: new Map(), sym: localStorage.getItem("neon.can.sym") || "BTCUSDT", tf: localStorage.getItem("neon.can.tf") || "1h", A: null, bars: {}, busy: false, err: null, at: 0, liq: [], ws: null, chart: null, lines: [], dec: 2, n: 0 };
const big = x => !isFinite(x) ? "—" : Math.abs(x) >= 1e9 ? (x/1e9).toFixed(2) + "B" : Math.abs(x) >= 1e6 ? (x/1e6).toFixed(2) + "M" : Math.abs(x) >= 1e3 ? (x/1e3).toFixed(1) + "k" : x.toFixed(0);
const fp = x => !isFinite(x) ? "—" : (+x).toFixed(S.dec);
const pc = x => !isFinite(x) ? "—" : (x >= 0 ? "+" : "") + x.toFixed(2) + "%";
function html(){ return `<div class="can-search"><input id="can-q" placeholder="coin ara (BTC, SOL, PEPE…)" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(S.sym)}"><button type="button" id="can-go" class="mini">ANALİZ</button></div>
  <div id="can-list" class="can-list hidden"></div>
  <div class="tfbar can-tf">${TFS.map(t => `<button type="button" data-ctf="${t}" class="${t === S.tf ? "on" : ""}">${LBL[t]}</button>`).join("")}<span id="can-at" class="dim"></span></div>
  <div id="can-chart" class="can-chart"></div><div class="legend can-lg"><span class="lg e">▭ Giriş bölgesi</span><span class="lg s">━ Stop</span><span class="lg t">━ TP1/TP2</span><span class="lg y">━ EMA20</span><span class="lg m">━ EMA50</span><span class="lg v">━ VWAP</span><span class="lg o">┅ destek/direnç</span></div>
  <div id="can-v" class="can-v"><div class="empty">coin seç → ANALİZ</div></div><div id="can-d"></div>
  <div class="can-btns"><button type="button" id="can-ref" class="mini wide">YENİLE</button><button type="button" id="can-trade" class="mini wide" disabled>İŞLEM'E AKTAR → ONAYLA</button></div>
  <div class="plan-foot">COIN ANALİZ yalnızca <b>analizdir, garanti değildir</b>; güven % sinyallerin ne kadar aynı yönü gösterdiğidir, kazanma olasılığı değildir. Bu ajan <b>emir göndermez</b>: İŞLEM'E AKTAR yalnızca İŞLEM formunu doldurur, emir yine EMRİ HAZIRLA → ONAYLA ve risk kontrolünden geçer. Veri: Binance USDⓈ-M Futures herkese açık uç noktalar (anahtarsız). Yatırım tavsiyesi değildir.</div>`; }
async function loadList(){ try { const [ei, t] = await Promise.all([j("/fapi/v1/exchangeInfo"), j("/fapi/v1/ticker/24hr")]);
    for (const x of t) S.vol.set(x.symbol, { qv: +x.quoteVolume, chg: +x.priceChangePercent, last: +x.lastPrice });
    S.list = ei.symbols.filter(s => s.contractType === "PERPETUAL" && s.quoteAsset === "USDT" && s.status === "TRADING").map(s => ({ s: s.symbol, b: s.baseAsset, tick: +((s.filters.find(f => f.filterType === "PRICE_FILTER") || {}).tickSize || 0.01) }))
      .sort((a, b) => ((S.vol.get(b.s) || {}).qv || 0) - ((S.vol.get(a.s) || {}).qv || 0)); } catch(e){ S.err = "liste: " + e.message; } }
function search(q){ q = String(q || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); const L = S.list; if (!q) return L.slice(0, 30);
  return L.filter(x => x.s.startsWith(q) || x.b.startsWith(q) || x.b.replace(/^1000+|^1M/, "").startsWith(q)).concat(L.filter(x => !(x.s.startsWith(q) || x.b.startsWith(q)) && x.s.includes(q))).slice(0, 30); }
function paintList(q){ const el = $("#can-list"); if (!el) return; const r = search(q); el.classList.remove("hidden");
  el.innerHTML = r.length ? r.map(x => { const v = S.vol.get(x.s) || {}; return `<button type="button" data-cs="${x.s}"><b>${x.s}</b><span class="${v.chg >= 0 ? "up" : "dn"}">${pc(v.chg)}</span><small>$${big(v.qv)} 24s</small></button>`; }).join("") : `<div class="empty">eşleşen perp yok (${S.list.length} perp)</div>`; }
function bars(k){ return k.map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[5] })); }
async function analyze(sym){ sym = sym || S.sym; if (S.busy) return; S.busy = true; S.err = null; const my = ++S.n; paintV(true);
  try { const info = S.list.find(x => x.s === sym); if (S.list.length && !info) throw new Error(sym + " Binance USDⓈ-M perp listesinde yok");
    if (info) S.dec = Math.max(0, Math.min(8, Math.round(-Math.log10(info.tick))));
    const K = await Promise.all(TFS.map(t => j(`/fapi/v1/klines?symbol=${sym}&interval=${t}&limit=300`).then(bars)));
    const opt = p => j(p).catch(() => null);
    const [prem, oiNow, oiH, oi5, gls, tls, tlp, tk, ag, t24] = await Promise.all([opt(`/fapi/v1/premiumIndex?symbol=${sym}`), opt(`/fapi/v1/openInterest?symbol=${sym}`), opt(`/futures/data/openInterestHist?symbol=${sym}&period=1h&limit=25`),
      opt(`/futures/data/openInterestHist?symbol=${sym}&period=5m&limit=13`), opt(`/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=1h&limit=1`), opt(`/futures/data/topLongShortAccountRatio?symbol=${sym}&period=1h&limit=1`),
      opt(`/futures/data/topLongShortPositionRatio?symbol=${sym}&period=1h&limit=1`), opt(`/futures/data/takerlongshortRatio?symbol=${sym}&period=5m&limit=12`), opt(`/fapi/v1/aggTrades?symbol=${sym}&limit=1000`), opt(`/fapi/v1/ticker/24hr?symbol=${sym}`)]);
    if (my !== S.n) return; TFS.forEach((t, i) => S.bars[t] = K[i]);
    const tf = {}; TFS.forEach((t, i) => tf[t] = CAN.tfAnalyze(K[i]));
    const ch = (a, k) => a && a.length > 1 && +a[0][k] ? (+a[a.length - 1][k]/+a[0][k] - 1)*100 : NaN;
    const bv = tk ? tk.reduce((s, x) => s + +x.buyVol, 0) : 0, sv = tk ? tk.reduce((s, x) => s + +x.sellVol, 0) : 0;
    const der = { fund: prem ? +prem.lastFundingRate : NaN, next: prem ? +prem.nextFundingTime : 0, mark: prem ? +prem.markPrice : NaN, oi: oiNow ? +oiNow.openInterest : NaN,
      oiUsd: oiH && oiH.length ? +oiH[oiH.length - 1].sumOpenInterestValue : NaN, oiCh24: ch(oiH, "sumOpenInterestValue"), oiCh1: ch(oi5, "sumOpenInterestValue"),
      gls: gls && gls[0] ? +gls[0].longShortRatio : NaN, glsL: gls && gls[0] ? +gls[0].longAccount : NaN, tls: tlp && tlp[0] ? +tlp[0].longShortRatio : NaN, tlsL: tlp && tlp[0] ? +tlp[0].longAccount : NaN,
      tla: tls && tls[0] ? +tls[0].longShortRatio : NaN, taker: sv ? bv/sv : NaN, bv, sv };
    const wh = CAN.whales(ag || [], Math.max(20000, ((S.vol.get(sym) || {}).qv || 0)/1e5)), px24 = t24 ? +t24.openPrice : NaN;
    const liq = S.liq.filter(x => x.s === sym);
    S.A = { sym, at: Date.now(), tf, der, wh, px24, chg24: t24 ? +t24.priceChangePercent : NaN, liq }; S.A.v = CAN.verdict(S.A); S.sym = sym; S.at = Date.now(); localStorage.setItem("neon.can.sym", sym); liqWs(sym);
  } catch(e){ if (my === S.n) S.err = e.message; } finally { if (my === S.n){ S.busy = false; paintV(); draw(); } } }
function liqWs(sym){ if (S.ws && S.ws.sym === sym) return; try { S.ws && S.ws.close(); } catch(e){} try { const ws = new WebSocket(`wss://fstream.binance.com/ws/${sym.toLowerCase()}@forceOrder`); ws.sym = sym;
    ws.onmessage = ev => { try { const o = JSON.parse(ev.data).o; if (!o) return; const p = +o.ap || +o.p, q = +o.z || +o.q; S.liq.unshift({ s: o.s, t: +o.T, p, usd: p*q, side: o.S }); if (S.liq.length > 60) S.liq.length = 60; if (S.A && o.s === S.A.sym){ S.A.liq = S.liq.filter(x => x.s === S.A.sym); paintD(); } } catch(e){} };
    S.ws = ws; } catch(e){} }
const row = (k, v, c) => `<div><span>${k}</span><b class="${c || ""}">${v}</b></div>`;
function paintV(loading){ const el = $("#can-v"); if (!el) return; const A = S.A, bt = $("#can-trade");
  if (S.err){ el.innerHTML = `<div class="err-line">✖ ${esc(S.err)}</div>`; if (bt) bt.disabled = true; return; }
  if (!A){ el.innerHTML = `<div class="empty">${loading ? "analiz ediliyor… (15dk/1s/4s/1G + türev + balina)" : "coin seç → ANALİZ"}</div>`; return; }
  const V = A.v, P = V.plan, h = A.tf["1h"], cls = V.v === "LONG" ? "up" : V.v === "SHORT" ? "dn" : "y";
  el.innerHTML = `<div class="can-head"><div><b class="can-sym">${esc(A.sym)}</b> <span>${fp(h ? h.px : NaN)}</span> <small class="${A.chg24 >= 0 ? "up" : "dn"}">${pc(A.chg24)} 24s</small></div>
    <div class="can-verd ${cls}">${V.v}<small>güven %${V.conf}</small></div></div>
    ${P && P.side ? `<div class="can-plan">${row("giriş bölgesi", fp(P.zone[0]) + " – " + fp(P.zone[1]))}${row("stop", fp(P.stop) + ` <small>(risk %${P.riskPct.toFixed(2)})</small>`, "dn")}${row("TP1", fp(P.tp1) + ` <small>R:R ${P.rr1.toFixed(1)}</small>`, "up")}${row("TP2", fp(P.tp2) + ` <small>R:R ${P.rr2.toFixed(1)}</small>`, "up")}</div>`
      : P ? `<div class="can-plan">${row("LONG için", "1s kapanış > " + fp(P.longAbove))}${row("SHORT için", "1s kapanış < " + fp(P.shortBelow))}${row("destek / direnç", fp(P.sup) + " / " + fp(P.res))}</div>` : ""}
    <div class="can-f">${V.factors.map(f => `<span class="${f.v > 0.15 ? "up" : f.v < -0.15 ? "dn" : "dim"}">${f.v > 0.15 ? "▲" : f.v < -0.15 ? "▼" : "•"} ${esc(f.why)}</span>`).join("")}</div>
    <div class="dim can-note">skor ${V.score >= 0 ? "+" : ""}${V.score} (−1…+1) · ${loading ? "yenileniyor…" : "güncel"} · analiz, garanti değil</div>`;
  if (bt) bt.disabled = !(P && P.side); paintD(); const at = $("#can-at"); if (at) at.textContent = new Date(A.at).toLocaleTimeString("tr-TR"); }
function paintD(){ const el = $("#can-d"), A = S.A; if (!el || !A) return; const D = A.der, W = A.wh;
  const tfr = TFS.map(t => { const x = A.tf[t]; if (!x) return `<tr><td>${LBL[t]}</td><td colspan="5" class="dim">veri az</td></tr>`;
    return `<tr><td>${LBL[t]}</td><td class="${x.dir > 0 ? "up" : x.dir < 0 ? "dn" : "y"}">${x.dir > 0 ? "▲ yukarı" : x.dir < 0 ? "▼ aşağı" : "◆ yatay"}</td><td>${x.rsi.toFixed(0)}</td><td class="${x.hist > 0 ? "up" : "dn"}">${x.hist > 0 ? "+" : "−"}${x.histUp ? "↑" : "↓"}</td><td class="${x.px > x.vwap ? "up" : "dn"}">${x.px > x.vwap ? "üst" : "alt"}</td><td>${x.brk === "breakout" ? '<b class="up">KIRILIM↑</b>' : x.brk === "breakdown" ? '<b class="dn">KIRILIM↓</b>' : "—"}</td></tr>`; }).join("");
  const lq = (A.liq || []).slice(0, 6), lL = lq.filter(x => x.side === "SELL").reduce((s, x) => s + x.usd, 0), lS = lq.filter(x => x.side === "BUY").reduce((s, x) => s + x.usd, 0);
  el.innerHTML = `<details class="keys" open><summary>📊 Çoklu zaman dilimi</summary><table class="can-t"><tr><th>TF</th><th>trend</th><th>RSI</th><th>MACD</th><th>VWAP</th><th>20 mum</th></tr>${tfr}</table>
      <div class="can-kv">${row("1s EMA20 / 50 / 200", fp(A.tf["1h"] && A.tf["1h"].e20) + " / " + fp(A.tf["1h"] && A.tf["1h"].e50) + " / " + fp(A.tf["1h"] && A.tf["1h"].e200))}${row("1s ATR14", fp(A.tf["1h"] && A.tf["1h"].atr))}${row("1s destek / direnç", fp(A.v.plan && A.v.plan.sup) + " / " + fp(A.v.plan && A.v.plan.res))}</div></details>
    <details class="keys"><summary>⚖ Türev verisi · L/S · OI · funding</summary><div class="can-kv">
      ${row("L/S tüm hesaplar (1s)", isFinite(D.gls) ? `${D.gls.toFixed(2)} <small>(L %${(D.glsL*100).toFixed(0)})</small>` : "—")}${row("L/S büyük oyuncu · pozisyon", isFinite(D.tls) ? `${D.tls.toFixed(2)} <small>(L %${(D.tlsL*100).toFixed(0)})</small>` : "—")}${row("L/S büyük oyuncu · hesap", isFinite(D.tla) ? D.tla.toFixed(2) : "—")}
      ${row("açık pozisyon (OI)", "$" + big(D.oiUsd))}${row("OI değişim 1s / 24s", pc(D.oiCh1) + " / " + pc(D.oiCh24), D.oiCh24 >= 0 ? "up" : "dn")}
      ${row("funding (8s)", isFinite(D.fund) ? `%${(D.fund*100).toFixed(4)}` : "—", D.fund > 0.0003 ? "dn" : D.fund < 0 ? "up" : "")}${row("taker alış / satış (1s)", isFinite(D.taker) ? `${D.taker.toFixed(2)}x <small>${D.taker >= 1 ? "alıcı baskın" : "satıcı baskın"}</small>` : "—", D.taker >= 1 ? "up" : "dn")}</div></details>
    <details class="keys"><summary>🐋 Balina akışı · likidasyon</summary><div class="can-kv">
      ${row("eşik", "≥ $" + big(W.thr) + " / işlem")}${row("balina alış / satış", "$" + big(W.buy) + " / $" + big(W.sell))}${row("net balina delta", (W.net >= 0 ? "+$" : "−$") + big(Math.abs(W.net)), W.net >= 0 ? "up" : "dn")}${row("balina payı", "%" + (W.share*100).toFixed(1) + ` <small>son ${W.n} büyük / ${W.to ? Math.max(1, Math.round((W.to - W.from)/60000)) + " dk" : "—"}</small>`)}</div>
      <div class="can-wh">${W.big.slice(0, 8).map(x => `<span class="${x.side === "BUY" ? "up" : "dn"}">${new Date(x.t).toLocaleTimeString("tr-TR")} ${x.side === "BUY" ? "AL" : "SAT"} $${big(x.usd)} @ ${fp(x.p)}</span>`).join("") || '<span class="dim">eşik üstü işlem yok</span>'}</div>
      <div class="sub-h">LİKİDASYON · canlı (panel açıldığından beri)</div><div class="can-wh">${lq.length ? lq.map(x => `<span class="${x.side === "SELL" ? "dn" : "up"}">${new Date(x.t).toLocaleTimeString("tr-TR")} ${x.side === "SELL" ? "LONG likide" : "SHORT likide"} $${big(x.usd)}</span>`).join("") + `<span class="dim">long likide $${big(lL)} · short likide $${big(lS)}</span>` : '<span class="dim">henüz yok — Binance geçmiş likidasyonu anahtarsız vermiyor, yalnızca canlı akış</span>'}</div></details>`; }
function draw(){ const el = $("#can-chart"); if (!el || !window.LightweightCharts) return; const b = S.bars[S.tf]; if (!b || !b.length) return;
  if (!S.chart){ S.chart = LightweightCharts.createChart(el, { autoSize: true, layout: { background: { type: "solid", color: "transparent" }, textColor: "#6fa5b5", fontFamily: "Share Tech Mono, monospace" },
      grid: { vertLines: { color: "#0e2230" }, horzLines: { color: "#0e2230" } }, rightPriceScale: { borderColor: "#12324a" }, timeScale: { borderColor: "#12324a", timeVisible: true, secondsVisible: false, rightOffset: 4 } });
    S.cs = S.chart.addCandlestickSeries({ upColor: "#39ff14", downColor: "#ff3355", borderUpColor: "#39ff14", borderDownColor: "#ff3355", wickUpColor: "#39ff14aa", wickDownColor: "#ff3355aa" });
    const ln = (c, w) => S.chart.addLineSeries({ color: c, lineWidth: w || 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false }); S.e20 = ln("#ffe600"); S.e50 = ln("#ff2bd6"); S.vw = ln("#9d7bff", 2); }
  const pf = { type: "price", precision: S.dec, minMove: Math.pow(10, -S.dec) }; for (const s of [S.cs, S.e20, S.e50, S.vw]) s.applyOptions({ priceFormat: pf });
  const T = x => Math.floor(x.t/1000), c = b.map(x => x.c), e20 = CAN.ema(c, 20), e50 = CAN.ema(c, 50), vw = CAN.vwap(b), sl = (a) => b.map((x, i) => a[i] === null ? null : { time: T(x), value: a[i] }).filter(Boolean);
  S.cs.setData(b.map(x => ({ time: T(x), open: x.o, high: x.h, low: x.l, close: x.c }))); S.e20.setData(sl(e20)); S.e50.setData(sl(e50)); S.vw.setData(S.tf === "1d" ? [] : sl(vw));
  for (const l of S.lines) try { S.cs.removePriceLine(l); } catch(e){} S.lines = [];
  const L = (p, col, t, st, w) => { if (isFinite(p)) S.lines.push(S.cs.createPriceLine({ price: p, color: col, lineWidth: w || 2, lineStyle: st || 0, axisLabelVisible: true, title: t })); };
  const P = S.A && S.A.sym && S.A.v.plan; if (P){ if (P.side){ L(P.zone[0], "#00f0ff", "giriş", 2, 1); L(P.zone[1], "#00f0ff", "giriş", 2, 1); L(P.stop, "#ff3355", "STOP"); L(P.tp1, "#39ff14", "TP1"); L(P.tp2, "#39ff14", "TP2", 0, 1); }
    else { L(P.longAbove, "#39ff14", "LONG >", 2, 1); L(P.shortBelow, "#ff3355", "SHORT <", 2, 1); } L(P.sup, "#6fa5b5", "destek", 3, 1); L(P.res, "#6fa5b5", "direnç", 3, 1); }
  S.chart.timeScale().fitContent(); }
/* hand-off to the existing İŞLEM flow: loads the symbol in VADELİ, then fills side/stop/target. The order itself still needs EMRİ HAZIRLA → ONAYLA. */
async function toTrade(){ const A = S.A, P = A && A.v.plan; if (!P || !P.side){ window.NOTIFY && NOTIFY.toast("BEKLE: aktarılacak plan yok", "bad"); return false; }
  const inp = $("#cmd-input"), f0 = $("#cmd"); if (!inp || !f0) return false; inp.value = A.sym; f0.requestSubmit ? f0.requestSubmit() : f0.dispatchEvent(new Event("submit", { cancelable: true }));
  const t0 = Date.now(); while (Date.now() - t0 < 45000){ await new Promise(r => setTimeout(r, 500)); const f = $("#bfx-form");
    if (f && !$("#dash").classList.contains("hidden") && [...document.querySelectorAll("#trade-box .sub-h")].some(x => x.textContent.includes(A.sym.replace(/USDT$/, "")))){ await new Promise(r => setTimeout(r, 1500));
      const b = f.querySelector(`.side-btns button[data-side="${P.side === "LONG" ? "long" : "short"}"]`); b && b.click();
      const set = (id, v) => { const e = $(id); if (e){ e.value = (+v).toFixed(S.dec); e.dispatchEvent(new Event("input", { bubbles: true })); } }; set("#bfx-stop", P.stop); set("#bfx-tgt", P.tp1);
      $("#trade").scrollIntoView({ block: "start" }); window.NOTIFY && NOTIFY.toast(`COIN ANALİZ planı İŞLEM'e aktarıldı (${P.side} · stop ${fp(P.stop)} · TP1 ${fp(P.tp1)}). Emir için EMRİ HAZIRLA → ONAYLA.`, "good"); return true; } }
  window.NOTIFY && NOTIFY.toast("İŞLEM formu yüklenemedi", "bad"); return false; }
function bind(){ const q = $("#can-q"); q.oninput = () => paintList(q.value); q.onfocus = () => { q.select(); paintList(""); };
  q.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); const r = search(q.value)[0]; if (r) pick(r.s); } };
  $("#can-list").onclick = e => { const b = e.target.closest("[data-cs]"); if (b) pick(b.dataset.cs); };
  $("#can-go").onclick = () => { const r = search(q.value)[0]; pick(r ? r.s : q.value.trim().toUpperCase()); };
  document.querySelector(".can-tf").onclick = e => { const b = e.target.closest("[data-ctf]"); if (!b) return; S.tf = b.dataset.ctf; localStorage.setItem("neon.can.tf", S.tf); document.querySelectorAll("[data-ctf]").forEach(x => x.classList.toggle("on", x === b)); draw(); };
  $("#can-ref").onclick = () => analyze(); $("#can-trade").onclick = () => toTrade();
  document.addEventListener("click", e => { if (!e.target.closest(".can-search") && !e.target.closest("#can-list")){ const l = $("#can-list"); l && l.classList.add("hidden"); } }); }
function pick(sym){ const q = $("#can-q"); q.value = sym; $("#can-list").classList.add("hidden"); q.blur(); analyze(sym); }
function init(){ const box = $("#coinan-box"); if (!box) return; box.innerHTML = html(); bind(); loadList().then(() => { if (document.body.dataset.pg === "fut") analyze(); });
  setInterval(() => { if (!document.hidden && document.body.dataset.pg === "fut" && S.A && Date.now() - S.at > 60000) analyze(); }, 5000);
  window.addEventListener("hashchange", () => { if (document.body.dataset.pg === "fut" && !S.A && !S.busy) analyze(); }); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { analyze, search, toTrade, pick, get S(){ return S; } };
})();
