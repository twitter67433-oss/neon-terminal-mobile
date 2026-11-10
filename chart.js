/* NEON//TERMINAL v5 — Binance-style chart: 15 timeframes (1m … 1M) from Binance USDⓈ-M futures klines,
   live kline WebSocket for the chosen interval, candles + volume histogram, EMA20/EMA50/VWAP overlays,
   signal entry/stop/target lines and the opening-range box. */
"use strict";
const CHART = (() => {
const $ = s => document.querySelector(s);
const TFS = ["1m","3m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w","1M"];
const LBL = { "1m":"1dk","3m":"3dk","5m":"5dk","15m":"15dk","30m":"30dk","1h":"1s","2h":"2s","4h":"4s","6h":"6s","8h":"8s","12h":"12s","1d":"1G","3d":"3G","1w":"1H","1M":"1A" };
const SEC = { "1m":60,"3m":180,"5m":300,"15m":900,"30m":1800,"1h":3600,"2h":7200,"4h":14400,"6h":21600,"8h":28800,"12h":43200,"1d":86400,"3d":259200,"1w":604800,"1M":2592000 };
let tf = TFS.includes(localStorage.getItem("neon.tf")) ? localStorage.getItem("neon.tf") : "5m";
const OVD = { vol: true, ema20: true, ema50: false, vwap: true, lv: true };
let ov = Object.assign({}, OVD); try { Object.assign(ov, JSON.parse(localStorage.getItem("neon.ov") || "{}")); } catch(e){}
let chart = null, cs = null, vs = null, e20 = null, e50 = null, vw = null, bars = [], D = null, off = 0, req = 0, prec = 4, lines = [], lastLoad = 0;
let E20 = [], E50 = [], VW = [];
const tfBar = $("#tfbar"), ovBar = $("#ovbar");
function bar(){
  if (tfBar) tfBar.innerHTML = TFS.map(t => `<button type="button" data-tf="${t}" class="${t === tf ? "on" : ""}">${LBL[t]}</button>`).join("");
  if (ovBar) ovBar.innerHTML = [["vol","HACİM"],["ema20","EMA20"],["ema50","EMA50"],["vwap","VWAP"],["lv","SEVİYELER"]].map(([k, n]) => `<button type="button" data-ov="${k}" class="${ov[k] ? "on" : ""} ov-${k}">${n}</button>`).join("");
}
bar();
tfBar && tfBar.addEventListener("click", e => { const b = e.target.closest("[data-tf]"); if (!b || b.dataset.tf === tf) return; const old = tf; tf = b.dataset.tf; localStorage.setItem("neon.tf", tf); bar();
  const sel = tfBar.querySelector(".on"); sel && sel.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  window.liveResub && window.liveResub("kline_" + old, "kline_" + tf); if (D) load(); });
ovBar && ovBar.addEventListener("click", e => { const b = e.target.closest("[data-ov]"); if (!b) return; ov[b.dataset.ov] = !ov[b.dataset.ov]; localStorage.setItem("neon.ov", JSON.stringify(ov)); bar(); applyOv(); });
function tzOff(ts){ const d = new Date(ts*1000), TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  return (new Date(d.toLocaleString("en-US", { timeZone: TZ })) - new Date(d.toLocaleString("en-US", { timeZone: "UTC" })))/1000; }
const intraday = () => SEC[tf] < 86400;
function emaAll(n){ const k = 2/(n + 1), out = []; let e = null; for (const b of bars){ e = e === null ? b.c : b.c*k + e*(1 - k); out.push(e); } return out; }
function vwapAll(){ const out = []; let day = null, pv = 0, v = 0; for (const b of bars){ const d = Math.floor(b.t/86400); if (d !== day){ day = d; pv = 0; v = 0; } const tp = (b.h + b.l + b.c)/3; pv += tp*b.v; v += b.v; out.push(v ? pv/v : b.c); } return out; }
const vcol = b => b.c >= b.o ? "rgba(57,255,20,.38)" : "rgba(255,51,85,.38)";
function plan(){ const S = D && D.data.signal; return S && S.dir === "SHORT" ? S.active : (D && (D.data.plan || (S && S.active))); }
function build(){
  const el = $("#chart"); if (chart){ chart.remove(); chart = null; }
  chart = LightweightCharts.createChart(el, { autoSize: true,
    layout: { background: { type: "solid", color: "transparent" }, textColor: "#6fa5b5", fontFamily: "Share Tech Mono, monospace" },
    grid: { vertLines: { color: "#0e2230" }, horzLines: { color: "#0e2230" } },
    crosshair: { mode: 0, vertLine: { color: "#ff2bd6", labelBackgroundColor: "#ff2bd6" }, horzLine: { color: "#00f0ff", labelBackgroundColor: "#00a8b5" } },
    rightPriceScale: { borderColor: "#12324a", scaleMargins: { top: .08, bottom: .22 } }, timeScale: { borderColor: "#12324a", timeVisible: intraday(), secondsVisible: false, rightOffset: 6 } });
  const pf = { type: "price", precision: prec, minMove: Math.pow(10, -prec) };
  cs = chart.addCandlestickSeries({ upColor: "#39ff14", downColor: "#ff3355", borderUpColor: "#39ff14", borderDownColor: "#ff3355", wickUpColor: "#39ff14aa", wickDownColor: "#ff3355aa", priceFormat: pf,
    autoscaleInfoProvider: orig => { const r = orig(); const P = ov.lv && plan(); if (r && P && intraday()){ const pr = r.priceRange; pr.minValue = Math.min(pr.minValue, P.stop, P.target, P.entry); pr.maxValue = Math.max(pr.maxValue, P.stop, P.target, P.entry); } return r; } });
  vs = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false });
  chart.priceScale("vol").applyOptions({ scaleMargins: { top: .82, bottom: 0 } });
  const ln = (c, w) => chart.addLineSeries({ color: c, lineWidth: w || 1, priceFormat: pf, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
  e20 = ln("#ffe600"); e50 = ln("#ff2bd6"); vw = ln("#9d7bff", 2);
  chart.subscribeCrosshairMove(p => { const o = $("#ch-ohlc"); if (!o) return; const b = p && p.time ? bars.find(x => x.t + off === p.time) : bars[bars.length - 1]; o.innerHTML = b ? ohlc(b) : ""; });
  const cv = $("#orbox"); el.appendChild(cv);
  chart.timeScale().subscribeVisibleLogicalRangeChange(() => requestAnimationFrame(drawOR));
  new ResizeObserver(() => requestAnimationFrame(drawOR)).observe(el);
}
const fnum = x => { const a = Math.abs(x); return a >= 1e9 ? (x/1e9).toFixed(2) + "B" : a >= 1e6 ? (x/1e6).toFixed(2) + "M" : a >= 1e3 ? (x/1e3).toFixed(1) + "K" : x.toFixed(a >= 10 ? 0 : 2); };
function ohlc(b){ const c = b.c >= b.o ? "up" : "dn", ch = (b.c/b.o - 1)*100;
  return `<span>A <b>${b.o.toFixed(prec)}</b></span><span>Y <b>${b.h.toFixed(prec)}</b></span><span>D <b>${b.l.toFixed(prec)}</b></span><span>K <b class="${c}">${b.c.toFixed(prec)}</b></span><span class="${c}">${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%</span><span>Hcm <b>${fnum(b.v)}</b></span>`; }
function applyOv(){ if (!chart) return;
  vs.applyOptions({ visible: ov.vol }); e20.applyOptions({ visible: ov.ema20 }); e50.applyOptions({ visible: ov.ema50 }); vw.applyOptions({ visible: ov.vwap && intraday() });
  for (const l of lines) try { cs.removePriceLine(l); } catch(e){} lines = [];
  const P = plan(); if (ov.lv && P){ const L = (p, c, t, s) => lines.push(cs.createPriceLine({ price: p, color: c, lineWidth: 2, lineStyle: s, axisLabelVisible: true, title: t }));
    const pre = P.side === "short" ? "SHORT " : ""; L(P.target, "#39ff14", pre + "HEDEF", 2); L(P.entry, "#00f0ff", pre + "GİRİŞ", 0); L(P.stop, "#ff3355", pre + "STOP", 2); }
  drawOR(); }
function setAll(){
  off = bars.length ? tzOff(bars[bars.length - 1].t) : 0;
  E20 = emaAll(20); E50 = emaAll(50); VW = vwapAll();
  cs.setData(bars.map(b => ({ time: b.t + off, open: b.o, high: b.h, low: b.l, close: b.c })));
  vs.setData(bars.map(b => ({ time: b.t + off, value: b.v, color: vcol(b) })));
  e20.setData(bars.map((b, i) => ({ time: b.t + off, value: E20[i] }))); e50.setData(bars.map((b, i) => ({ time: b.t + off, value: E50[i] })));
  vw.setData(intraday() ? bars.map((b, i) => ({ time: b.t + off, value: VW[i] })) : []);
  const E = D && D.data.entry; if (E && E.trigger && SEC[tf] <= 3600){ const t = Math.floor((E.trigger.t - 300)/SEC[tf])*SEC[tf];
    if (bars.some(b => b.t === t)) cs.setMarkers([{ time: t + off, position: "belowBar", color: "#ffe600", shape: "arrowUp", text: "TETİK" }]); else cs.setMarkers([]); } else cs.setMarkers([]);
  const n = bars.length, show = { "1m": 180, "3m": 160, "5m": 200, "15m": 160, "30m": 140, "1h": 140 }[tf] || 120;
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - show), to: n + 5 });
  const o = $("#ch-ohlc"); if (o && n) o.innerHTML = ohlc(bars[n - 1]);
  applyOv(); }
async function fetchK(sym, src, limit){
  const u = src === "spot" ? `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${limit}` : `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${tf}&limit=${limit}`;
  const r = await fetch(u, { cache: "no-store" }); if (!r.ok) throw new Error("kline HTTP " + r.status); const a = await r.json();
  return a.map(k => ({ t: k[0]/1000, o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] })); }
async function load(){
  if (!D) return; const my = ++req, sym = D.symbol, info = $("#ch-info");
  if (info) info.textContent = `${LBL[tf]} · yükleniyor…`;
  try { const b = await fetchK(sym, D.src, SEC[tf] <= 300 ? 1000 : 500); if (my !== req || !D || D.symbol !== sym) return;
    bars = b; lastLoad = Date.now(); if (!chart || chart._tfIntraday !== intraday()){ build(); chart._tfIntraday = intraday(); } else chart.applyOptions({ timeScale: { timeVisible: intraday() } });
    setAll(); if (info) info.textContent = `${sym} · ${LBL[tf]} · ${D.src === "fut" ? "PERP" : "SPOT"} · ${bars.length} mum`; window.BUS && BUS.emit("tick", {});
  } catch(e){ if (info) info.textContent = "✖ " + e.message; if (!bars.length) throw e; }
}
function render(d){ const same = D && D.symbol === d.symbol; D = d; prec = (d.pdec !== undefined && d.pdec !== null) ? Math.min(d.pdec, 10) : d.price >= 1000 ? 2 : d.price >= 1 ? 4 : d.price >= 0.01 ? 5 : 8;
  if (!same){ bars = []; if (chart){ chart.remove(); chart = null; } }
  if (chart) chart.remove(), chart = null; build(); chart._tfIntraday = intraday();
  return load(); }
/* live kline from the futures WS (stream <sym>@kline_<tf>) */
function onKline(k){ if (!cs || !D || k.i !== tf || k.s !== D.symbol) return; const b = { t: k.t/1000, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v };
  const n = bars.length; if (!n) return; const last = bars[n - 1];
  if (b.t === last.t) bars[n - 1] = b; else if (b.t > last.t){ bars.push(b); if (bars.length > 1500) bars.shift(); } else return;
  const i = bars.length - 1, k20 = 2/21, k50 = 2/51;
  E20[i] = i ? b.c*k20 + E20[i - 1]*(1 - k20) : b.c; E50[i] = i ? b.c*k50 + E50[i - 1]*(1 - k50) : b.c;
  if (intraday()){ let pv = 0, v = 0; const day = Math.floor(b.t/86400); for (let j = i; j >= 0 && Math.floor(bars[j].t/86400) === day; j--){ pv += (bars[j].h + bars[j].l + bars[j].c)/3*bars[j].v; v += bars[j].v; } VW[i] = v ? pv/v : b.c; }
  try { cs.update({ time: b.t + off, open: b.o, high: b.h, low: b.l, close: b.c }); vs.update({ time: b.t + off, value: b.v, color: vcol(b) });
    e20.update({ time: b.t + off, value: E20[i] }); e50.update({ time: b.t + off, value: E50[i] }); if (intraday()) vw.update({ time: b.t + off, value: VW[i] }); } catch(e){}
  const o = $("#ch-ohlc"); if (o && !o.matches(":hover")) o.innerHTML = ohlc(b); }
/* REST fallback while the WS is down */
async function poll(){ if (!D || !cs) return; try { const b = await fetchK(D.symbol, D.src, 2); for (const x of b) onKline({ i: tf, s: D.symbol, t: x.t*1000, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v }); } catch(e){} }
function drawOR(){
  const el = $("#chart"), cv = $("#orbox"); if (!el || !cv || !chart) return; const r = el.getBoundingClientRect(); cv.width = r.width; cv.height = r.height; const g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height);
  const E = D && D.data.entry; if (!E || !ov.lv || SEC[tf] > 3600) return; const st = SEC[tf], ts = chart.timeScale();
  let x1 = ts.timeToCoordinate(Math.floor(E.or_start/st)*st + off), x2 = ts.timeToCoordinate(Math.floor((E.or_end - 1)/st)*st + off);
  if (x1 === null && x2 === null) return; if (x1 === null) x1 = 0; if (x2 === null) x2 = cv.width - 60; x2 += Math.max(4, (ts.options().barSpacing || 6)/2);
  const y1 = cs.priceToCoordinate(E.or_high), y2 = cs.priceToCoordinate(E.or_low); if (y1 === null || y2 === null) return;
  g.fillStyle = "rgba(255,230,0,0.10)"; g.strokeStyle = "rgba(255,230,0,0.85)"; g.lineWidth = 1; g.setLineDash([4, 3]);
  g.fillRect(x1, y1, Math.max(2, x2 - x1), y2 - y1); g.strokeRect(x1, y1, Math.max(2, x2 - x1), y2 - y1);
  g.setLineDash([]); g.fillStyle = "#ffe600"; g.font = "11px Share Tech Mono"; g.fillText("AÇILIŞ ARALIĞI", x1 + 3, y1 - 4); }
return { render, onKline, poll, get tf(){ return tf; }, TFS, _bars: () => bars };
})();
window.CHART = CHART;
