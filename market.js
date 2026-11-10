/* NEON//TERMINAL v5 — market microstructure panels (Binance USDⓈ-M futures, public endpoints, no keys):
   12 · order-book depth heat map (REST /fapi/v1/depth, time × price) + live liquidations (@forceOrder WS)
   13 · open interest (24h), global & top-trader long/short ratios, taker buy/sell ratio. */
"use strict";
const MARKET = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const F = "https://fapi.binance.com";
const big = x => { x = +x; const a = Math.abs(x); return !isFinite(x) ? "—" : "$" + (a >= 1e9 ? (x/1e9).toFixed(2) + "B" : a >= 1e6 ? (x/1e6).toFixed(2) + "M" : a >= 1e3 ? (x/1e3).toFixed(1) + "K" : x.toFixed(0)); };
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
let D = null, sym = null, vis = false, hT = null, oT = null, hist = [], grid = null, liqs = [], dec = 4;
const NB = 64, MAXC = 90;
async function j(p){ const r = await fetch(F + p, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
function onAnalysis(d){ D = d; if (sym !== d.symbol){ hist = []; grid = null; liqs = []; } sym = d.symbol; dec = (d.pdec ?? 4);
  const ok = d.src === "fut"; $("#mk-info").textContent = ok ? sym + " · 4 sn" : "yalnızca vadeli";
  if (!ok){ $("#depth-sum").innerHTML = `<div class="empty">SPOT verisinde vadeli derinlik / OI yok.</div>`; $("#oi-box").innerHTML = `<div class="empty">Vadeli sözleşme yok.</div>`; stop(); return; }
  $("#liq-log").innerHTML = `<div class="empty">likidasyon bekleniyor… (Binance @forceOrder, ${esc(sym)})</div>`; start(); }
function start(){ stop(); depth(); oi(); hT = setInterval(() => { if (vis && !document.hidden) depth(); }, 4000); oT = setInterval(() => { if (!document.hidden) oi(); }, 60000); }
function stop(){ clearInterval(hT); clearInterval(oT); }
async function depth(){ if (!sym) return; const s = sym;
  try { const b = await j(`/fapi/v1/depth?symbol=${s}&limit=500`); if (s !== sym) return;
    const bids = b.bids.map(x => [+x[0], +x[1]]), asks = b.asks.map(x => [+x[0], +x[1]]); if (!bids.length || !asks.length) return;
    const mid = (bids[0][0] + asks[0][0])/2;
    if (!grid || mid < grid.lo + (grid.hi - grid.lo)*.2 || mid > grid.hi - (grid.hi - grid.lo)*.2){
      const span = Math.max(mid*0.004, Math.min(mid - bids[bids.length - 1][0], asks[asks.length - 1][0] - mid));
      grid = { lo: mid - span, hi: mid + span }; hist = []; }
    const col = { t: Date.now(), mid, b: new Float32Array(NB), a: new Float32Array(NB) }, w = (grid.hi - grid.lo)/NB;
    for (const [p, q] of bids){ const i = Math.floor((p - grid.lo)/w); if (i >= 0 && i < NB) col.b[i] += p*q; }
    for (const [p, q] of asks){ const i = Math.floor((p - grid.lo)/w); if (i >= 0 && i < NB) col.a[i] += p*q; }
    hist.push(col); if (hist.length > MAXC) hist.shift();
    const bt = bids.reduce((s, x) => s + x[0]*x[1], 0), at = asks.reduce((s, x) => s + x[0]*x[1], 0), imb = (bt - at)/(bt + at)*100;
    const bw = bids.reduce((m, x) => x[1]*x[0] > m[1]*m[0] ? x : m, bids[0]), aw = asks.reduce((m, x) => x[1]*x[0] > m[1]*m[0] ? x : m, asks[0]);
    $("#depth-sum").innerHTML = `<span class="k">Alış / satış derinliği (500 kademe)</span><span class="v"><span class="up">${big(bt)}</span> / <span class="dn">${big(at)}</span></span>
      <span class="k">Dengesizlik</span><span class="v ${imb >= 0 ? "up" : "dn"}">${imb >= 0 ? "+" : ""}${imb.toFixed(1)}% ${imb >= 0 ? "alıcı ağır" : "satıcı ağır"}</span>
      <span class="k">En büyük alış duvarı</span><span class="v up">${bw[0].toFixed(dec)} · ${big(bw[0]*bw[1])}</span><span class="k">En büyük satış duvarı</span><span class="v dn">${aw[0].toFixed(dec)} · ${big(aw[0]*aw[1])}</span>
      <span class="k">Spread</span><span class="v">${(asks[0][0] - bids[0][0]).toFixed(dec)} (${((asks[0][0]/bids[0][0] - 1)*1e4).toFixed(2)} bp)</span>`;
    draw(); window.BUS && BUS.emit("depth", { imb });
  } catch(e){ $("#mk-info").textContent = "derinlik: " + e.message; } }
function draw(){ const cv = $("#heat"); if (!cv || !grid) return; const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); if (!r.width) return;
  cv.width = r.width*dpr; cv.height = r.height*dpr; const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); const W = r.width - 52, H = r.height, n = hist.length; g.clearRect(0, 0, r.width, H);
  let mx = 1; for (const c of hist) for (let i = 0; i < NB; i++) mx = Math.max(mx, c.b[i], c.a[i]); const lm = Math.log1p(mx);
  const cw = W/MAXC, ch = H/NB, x0 = W - n*cw, Y = p => H - (p - grid.lo)/(grid.hi - grid.lo)*H;
  hist.forEach((c, k) => { const x = x0 + k*cw; for (let i = 0; i < NB; i++){ const y = H - (i + 1)*ch;
    if (c.b[i] > 0){ const a = Math.log1p(c.b[i])/lm; g.fillStyle = `rgba(0,240,255,${(a*a*.95).toFixed(3)})`; g.fillRect(x, y, cw + .5, ch + .5); }
    if (c.a[i] > 0){ const a = Math.log1p(c.a[i])/lm; g.fillStyle = `rgba(255,43,214,${(a*a*.95).toFixed(3)})`; g.fillRect(x, y, cw + .5, ch + .5); } } });
  g.beginPath(); hist.forEach((c, k) => { const x = x0 + k*cw + cw/2, y = Y(c.mid); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.strokeStyle = "#ffe600"; g.lineWidth = 1.5; g.shadowColor = "#ffe600"; g.shadowBlur = 6; g.stroke(); g.shadowBlur = 0;
  const t0 = n ? hist[0].t : Date.now(), t1 = n ? hist[n - 1].t : Date.now();
  for (const L of liqs){ if (L.t < t0 - 4000 || L.p < grid.lo || L.p > grid.hi) continue; const x = n > 1 ? x0 + (L.t - t0)/(t1 - t0 || 1)*(n - 1)*cw + cw/2 : W - 4, rr = Math.min(9, 2 + Math.log10(1 + L.usd/1000)*2.2);
    g.beginPath(); g.arc(Math.min(W - 2, x), Y(L.p), rr, 0, 6.283); g.fillStyle = L.side === "SELL" ? "rgba(255,51,85,.85)" : "rgba(57,255,20,.85)"; g.fill(); }
  g.fillStyle = "#6fa5b5"; g.font = "10px Share Tech Mono"; g.textAlign = "left";
  for (let k = 0; k <= 4; k++){ const p = grid.lo + (grid.hi - grid.lo)*k/4; g.fillText(p.toFixed(dec), W + 4, Math.min(H - 2, Math.max(9, Y(p) + 3))); }
  g.fillText("◉ likidasyon  ▮ alış  ▮ satış", 4, 11); }
function onLiq(o){ if (!o || o.s !== sym) return; const p = +o.ap || +o.p, q = +o.z || +o.q, L = { t: +o.T || Date.now(), p, usd: p*q, side: o.S };
  liqs.push(L); if (liqs.length > 200) liqs.shift();
  const el = $("#liq-log"); if (el){ if (el.querySelector(".empty")) el.innerHTML = "";
    el.insertAdjacentHTML("afterbegin", `<div class="${o.S === "SELL" ? "dn" : "up"}"><small>${new Date(L.t).toLocaleTimeString("tr-TR", { timeZone: TZ })}</small> ${o.S === "SELL" ? "LONG likide" : "SHORT likide"} · ${big(L.usd)} @ ${p.toFixed(dec)}</div>`);
    while (el.children.length > 20) el.lastChild.remove(); }
  if (L.usd > 50000 && window.NOTIFY) NOTIFY.ping("info", `${sym} büyük likidasyon ${big(L.usd)}`, true); draw(); }
async function oi(){ if (!sym) return; const s = sym, box = $("#oi-box");
  try { const [h, g, t, k] = await Promise.all([j(`/futures/data/openInterestHist?symbol=${s}&period=1h&limit=25`), j(`/futures/data/globalLongShortAccountRatio?symbol=${s}&period=5m&limit=1`),
      j(`/futures/data/topLongShortPositionRatio?symbol=${s}&period=5m&limit=1`).catch(() => []), j(`/futures/data/takerlongshortRatio?symbol=${s}&period=5m&limit=12`).catch(() => [])]);
    if (s !== sym) return; const last = h[h.length - 1] || {}, first = h[0] || {}, ch = first.sumOpenInterestValue ? (last.sumOpenInterestValue/first.sumOpenInterestValue - 1)*100 : null;
    const gl = g[0] || {}, tp = t[0] || {}, bv = k.reduce((a, x) => a + +x.buyVol, 0), sv = k.reduce((a, x) => a + +x.sellVol, 0);
    const barH = (l, sl, lab) => { l = +l*100; if (!isFinite(l)) return ""; return `<div class="lsr"><div class="lab"><span>${lab}</span><span><b class="up">L %${l.toFixed(1)}</b> · <b class="dn">S %${(100 - l).toFixed(1)}</b>${sl ? ` · oran ${(+sl).toFixed(2)}` : ""}</span></div><div class="lsbar"><div style="width:${l.toFixed(1)}%"></div></div></div>`; };
    box.innerHTML = `<div class="oi-top"><div><small>AÇIK POZİSYON (OI)</small><b>${big(last.sumOpenInterestValue)}</b><span class="${ch >= 0 ? "up" : "dn"}">${ch === null ? "—" : (ch >= 0 ? "+" : "") + ch.toFixed(2) + "% 24s"}</span></div><canvas id="oi-spark" width="140" height="44"></canvas></div>
      ${barH(gl.longAccount, gl.longShortRatio, "Tüm hesaplar")}${barH(tp.longAccount, tp.longShortRatio, "Büyük oyuncular (pozisyon)")}
      ${bv + sv ? `<div class="lsr"><div class="lab"><span>Taker alış / satış (1 saat)</span><span class="${bv >= sv ? "up" : "dn"}">${(bv/(sv || 1)).toFixed(2)}x ${bv >= sv ? "alıcı baskın" : "satıcı baskın"}</span></div><div class="lsbar"><div style="width:${(bv/(bv + sv)*100).toFixed(1)}%"></div></div></div>` : ""}
      <div class="plan-foot">Kaynak: Binance futures/data (5 dk) · ${new Date().toLocaleTimeString("tr-TR", { timeZone: TZ })} · Kalabalık tek yöne yığıldığında (örn. %75+ long) ters yönde likidasyon dalgası riski artar; bu bir sinyal değil, bağlam bilgisidir.</div>`;
    const c = $("#oi-spark"), v = h.map(x => +x.sumOpenInterestValue); if (c && v.length > 1){ const dpr = Math.min(2, devicePixelRatio || 1); c.width = 140*dpr; c.height = 44*dpr; const g2 = c.getContext("2d"); g2.scale(dpr, dpr);
      const lo = Math.min(...v), hi = Math.max(...v), sp = hi - lo || 1; g2.beginPath(); v.forEach((y, i) => { const X = i/(v.length - 1)*138 + 1, Y = 42 - (y - lo)/sp*40; i ? g2.lineTo(X, Y) : g2.moveTo(X, Y); });
      g2.strokeStyle = ch >= 0 ? "#39ff14" : "#ff3355"; g2.lineWidth = 1.5; g2.shadowColor = g2.strokeStyle; g2.shadowBlur = 5; g2.stroke(); }
  } catch(e){ box.innerHTML = `<div class="err-line">✖ OI / long-short verisi alınamadı: ${esc(e.message)}</div>`; } }
const cvh = $("#heat"); if (cvh){ if ("IntersectionObserver" in window) new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) draw(); }).observe(cvh); else vis = true; new ResizeObserver(() => draw()).observe(cvh); }
return { onAnalysis, onLiq, _h: () => hist.length };
})();
window.MARKET = MARKET;
