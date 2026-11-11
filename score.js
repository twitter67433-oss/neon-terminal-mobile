/* NEON//TERMINAL v7.5 — SCORE: pure, testable decision math for the MEME watcher and the position monitor.
   No DOM, no network. Loaded in the page (window.SCORE) and in Node tests (module.exports).
   • pumpScore(flow, now, cfg)  → 0–100 "pump skoru" from the token's own trade flow during the wait window + hard rejects
   • exitDecide(s, x)           → dynamic exit: hard SL, fast early stop, early momentum fail, dev / top-holder dump, flow reversal,
                                  hard TP, partial take-profit, breakeven stop, tightening trail, flat time stop, max hold, graduation
   • simHaircut(volPct, side)   → extra SIM fill haircut, larger when the price moves fast (SIM must not be over-optimistic)
   flow = { dev, t0, trades: [{ t, user|null, sol, isBuy, mcap }], mcaps: [[t, mcap]], src: "logs"|"curve" } */
"use strict";
(function (root){
const cl = (x, a, b) => Math.max(a, Math.min(b, x));
const lin = (x, x0, x1) => x1 === x0 ? (x >= x1 ? 1 : 0) : cl((x - x0)/(x1 - x0), 0, 1);
/* weights sum to 100 — shown in the UI so the score is transparent */
const W = { buyers: 20, ratio: 12, inflow: 13, conc: 15, vel: 15, dd: 10, clean: 15 };
const SC_DEF = { min: 65, minBuyers: 5, maxTop: 45, maxDd: 25, bundleSec: 2 };
function metrics(flow, now){
  const dev = flow.dev || null, t0 = flow.t0 || 0, T = (flow.trades || []).filter(x => x && isFinite(x.sol) && x.sol > 0);
  const other = T.filter(x => !dev || x.user !== dev), devTr = T.filter(x => dev && x.user === dev);
  const buys = other.filter(x => x.isBuy), sells = other.filter(x => !x.isBuy);
  const solBuy = buys.reduce((a, x) => a + x.sol, 0), solSell = sells.reduce((a, x) => a + x.sol, 0);
  const known = other.some(x => x.user);
  const by = new Map(); for (const x of other){ if (!x.user) continue; const w = by.get(x.user) || { b: 0, s: 0, first: x.t }; x.isBuy ? w.b += x.sol : w.s += x.sol; by.set(x.user, w); }
  const buyers = known ? [...by.values()].filter(w => w.b > 0).length : null;
  let top = 0, topW = null; for (const [u, w] of by){ if (w.b > top){ top = w.b; topW = u; } }
  const topShare = known && solBuy > 0 ? top/solBuy : null;
  /* bundle / sniper: buys from distinct wallets inside the first bundleSec of the token's life */
  const early = buys.filter(x => t0 && x.t - t0 <= SC_DEF.bundleSec*1000);
  const earlyW = new Set(early.map(x => x.user).filter(Boolean)).size, earlySol = early.reduce((a, x) => a + x.sol, 0);
  const earlyShare = solBuy > 0 ? earlySol/solBuy : 0;
  /* same SOL size repeated across different wallets (scripted buys) */
  const g = new Map(); for (const x of buys){ const k = x.sol.toFixed(3); const s = g.get(k) || new Set(); s.add(x.user || ("?" + x.t)); g.set(k, s); }
  const sameMax = [...g.values()].reduce((a, s) => Math.max(a, s.size), 0), sameFrac = buys.length >= 5 ? sameMax/buys.length : 0;
  /* velocity: least-squares slope of mcap over the window, % of mean mcap per 10 s; drawdown from the local high */
  const M = (flow.mcaps || []).filter(p => p && isFinite(p[1]) && p[1] > 0);
  let vel = null, dd = null, last = null, hi = null;
  if (M.length >= 2){ const n = M.length, ts = M.map(p => (p[0] - M[0][0])/1000), ys = M.map(p => p[1]); const mt = ts.reduce((a, b) => a + b, 0)/n, my = ys.reduce((a, b) => a + b, 0)/n;
    let nu = 0, de = 0; for (let i = 0; i < n; i++){ nu += (ts[i] - mt)*(ys[i] - my); de += (ts[i] - mt)**2; } vel = de > 0 ? nu/de*10/my*100 : 0;
    hi = Math.max(...ys); last = ys[n - 1]; dd = (1 - last/hi)*100; }
  /* sniped before we could watch: first observed mcap far above the creation mcap within the first 4 s */
  const m0 = +flow.mcap0 || 0, firstObs = M.length ? M[0] : null, earlyJump = m0 > 0 && firstObs && t0 && firstObs[0] - t0 <= 4000 ? firstObs[1]/m0 - 1 : 0;
  return { earlyJump, n: other.length, nBuy: buys.length, nSell: sells.length, solBuy, solSell, net: solBuy - solSell, ratio: buys.length/Math.max(1, sells.length), solRatio: solBuy/Math.max(0.01, solSell),
    buyers, topShare, topW, devSold: devTr.some(x => !x.isBuy), devSellSol: devTr.filter(x => !x.isBuy).reduce((a, x) => a + x.sol, 0), earlyW, earlyShare, sameMax, sameFrac, vel, dd, last, hi, known, src: flow.src || (known ? "logs" : "curve") };
}
function pumpScore(flow, now, cfg){ const c = Object.assign({}, SC_DEF, cfg || {}), m = metrics(flow, now || Date.now());
  const P = {
    buyers: m.buyers === null ? 0 : W.buyers*lin(m.buyers, 3, 40),
    ratio: W.ratio*lin(m.ratio, 1, 3.5),
    inflow: W.inflow*(0.5*lin(m.solRatio, 1, 4) + 0.5*lin(m.net, 0, 3)),
    conc: m.topShare === null ? 0 : W.conc*(1 - lin(m.topShare, 0.08, 0.35)),
    vel: m.vel === null ? 0 : W.vel*lin(m.vel, 0, 15),
    dd: m.dd === null ? 0 : W.dd*(1 - lin(m.dd, 0, 20)),
    clean: W.clean*(1 - lin(m.earlyShare, 0.2, 0.6))*(1 - lin(m.sameFrac, 0.15, 0.45))*(1 - 0.5*lin(m.earlyJump, 0.3, 1)) };
  const bonus = Math.max(0, Math.min(20, +c.bonus || 0)), score = Math.min(100, Math.round(Object.values(P).reduce((a, b) => a + b, 0) + bonus));
  let hard = null;
  if (m.devSold) hard = "dev sattı";
  else if (m.nBuy + m.nSell === 0) hard = "işlem akışı yok";
  else if (!m.known) hard = "cüzdan verisi yok (yalnızca curve) — körlemesine alınmaz";
  else if (m.buyers !== null && m.buyers < c.minBuyers) hard = `az alıcı (${m.buyers} < ${c.minBuyers})`;
  else if (m.topShare !== null && m.topShare*100 > c.maxTop && m.nBuy >= 3) hard = `tek cüzdan alımların %${Math.round(m.topShare*100)}'i`;
  else if (m.earlyW >= 4 && m.earlyShare > 0.5) hard = `paket/sniper: ilk ${c.bundleSec} sn'de ${m.earlyW} cüzdan, alımların %${Math.round(m.earlyShare*100)}'i`;
  else if (m.sameFrac >= 0.4 && m.sameMax >= 4) hard = `aynı boyutta tekrarlı alım (${m.sameMax}×)`;
  else if (m.dd !== null && m.dd > c.maxDd) hard = `zirveden %${Math.round(m.dd)} düştü`;
  else if (m.net <= 0) hard = "net SOL girişi yok (satıcılar baskın)";
  const why = [];
  why.push(m.buyers === null ? "alıcı ? (yalnızca curve)" : `${m.buyers} alıcı`);
  why.push(`alım/satım ${m.ratio.toFixed(1)}`);
  why.push(`net ${m.net >= 0 ? "+" : ""}${m.net.toFixed(2)} SOL`);
  if (m.topShare !== null) why.push(`top cüzdan %${Math.round(m.topShare*100)}`);
  if (m.vel !== null) why.push(`hız ${m.vel >= 0 ? "+" : ""}${m.vel.toFixed(1)}%/10sn`);
  if (m.dd !== null && m.dd >= 5) why.push(`zirveden −%${m.dd.toFixed(0)}`);
  if (m.earlyJump >= 0.3) why.push(`ilk sn'lerde +%${Math.round(m.earlyJump*100)} sıçrama`);
  if (m.earlyW >= 2) why.push(`ilk ${c.bundleSec} sn ${m.earlyW} cüzdan`);
  if (bonus) why.push(`bonus +${bonus}`);
  const pass = !hard && score >= c.min;
  return { score, pass, hard, parts: P, m, why, min: c.min };
}
/* recent flow helpers for exits */
function flowWin(trades, now, sec, dev){ const cut = now - sec*1000; let bS = 0, sS = 0, nB = 0, nS = 0, devSell = 0;
  for (const x of trades || []){ if (x.t < cut) continue; if (dev && x.user === dev){ if (!x.isBuy) devSell += x.sol; continue; } x.isBuy ? (bS += x.sol, nB++) : (sS += x.sol, nS++); }
  return { bS, sS, nB, nS, devSell, sellDom: nS >= 3 && sS > Math.max(0.05, bS*1.5) }; }
/* the biggest non-dev buyer (by SOL bought) sold ≥ half of it inside the last `sec` seconds */
function topDump(trades, now, sec, dev){ const by = new Map(); for (const x of trades || []){ if (!x.user || (dev && x.user === dev)) continue; const w = by.get(x.user) || { b: 0, rs: 0 }; if (x.isBuy) w.b += x.sol; else if (x.t >= now - sec*1000) w.rs += x.sol; by.set(x.user, w); }
  let top = null; for (const w of by.values()) if (!top || w.b > top.b) top = w; return !!(top && top.b >= 0.2 && top.rs >= top.b*0.5); }
const X_DEF = { sl: 25, tp: 250, holdMin: 15, early: 12, earlySec: 20, momUp: 5, momFail: 8, be: 20, beLock: 1, ptp: 40, ptpPct: 50, trailLo: 20, trailHi: 12, trailSw: 100, rev: true, revSec: 6, flatMin: 4, flatBand: 10 };
/* s: { pnl, hi, ageSec, partDone, sinceHiSec, complete, flow: { sellDom, devSell, topDump } } — pnl/hi in % of cost (remaining part) */
function exitDecide(s, xc){ const x = Object.assign({}, X_DEF, xc || {}), pnl = s.pnl, hi = Math.max(s.hi == null ? pnl : s.hi, pnl), f = s.flow || {}, pc = v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
  if (!isFinite(pnl)) return null;
  if (pnl <= -x.sl) return { act: "sell", why: `ZARAR KES ${pc(pnl)}`, k: "sl" };
  if (x.early > 0 && s.ageSec <= x.earlySec && pnl <= -x.early) return { act: "sell", why: `ERKEN STOP ${pc(pnl)} (ilk ${x.earlySec} sn)`, k: "early" };
  if (x.momFail > 0 && s.ageSec > x.earlySec && s.ageSec <= x.earlySec*3 && hi < x.momUp && pnl <= -x.momFail) return { act: "sell", why: `MOMENTUM YOK ${pc(pnl)} (zirve ${pc(hi)})`, k: "mom" };
  if (f.devSell > 0) return { act: "sell", why: `DEV SATTI (${f.devSell.toFixed(2)} SOL)`, k: "dev" };
  if (f.topDump) return { act: "sell", why: "BÜYÜK CÜZDAN BOŞALTIYOR", k: "top" };
  if (x.rev && f.sellDom && s.ageSec >= 5) return { act: "sell", why: `AKIŞ DÖNDÜ: son ${x.revSec} sn satıcılar baskın ${pc(pnl)}`, k: "rev" };
  if (x.tp > 0 && pnl >= x.tp) return { act: "sell", why: `KÂR AL ${pc(pnl)}`, k: "tp" };
  if (x.ptp > 0 && x.ptpPct > 0 && !s.partDone && pnl >= x.ptp) return { act: "part", pct: x.ptpPct, why: `KISMİ KÂR %${x.ptpPct} @ ${pc(pnl)}`, k: "ptp" };
  if (x.be > 0 && hi >= x.be){
    const w = hi >= x.trailSw ? x.trailHi : x.trailLo, off = (1 - (1 + pnl/100)/(1 + hi/100))*100;
    if (w > 0 && off >= w) return { act: "sell", why: `İZ SÜREN STOP %${w} (zirve ${pc(hi)} → ${pc(pnl)})`, k: "trail" };
    if (pnl <= x.beLock) return { act: "sell", why: `BAŞA BAŞ STOP (zirve ${pc(hi)})`, k: "be" }; }
  if (x.flatMin > 0 && s.sinceHiSec >= x.flatMin*60 && pnl < x.flatBand) return { act: "sell", why: `YATAY: ${x.flatMin} dk yeni zirve yok ${pc(pnl)}`, k: "flat" };
  if (s.ageSec >= x.holdMin*60) return { act: "sell", why: `SÜRE DOLDU (${x.holdMin} dk)`, k: "time" };
  if (s.complete) return { act: "sell", why: "curve tamamlandı (mezun)", k: "grad" };
  return null; }
/* SIM haircut: 1 % base + half of the absolute move seen in the last seconds, capped at 15 % */
function simHaircut(volPct){ const v = Math.abs(+volPct || 0); return cl(0.01 + 0.5*v/100, 0.01, 0.15); }
const api = { pumpScore, metrics, flowWin, topDump, exitDecide, simHaircut, W, SC_DEF, X_DEF };
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SCORE = api;
})(typeof window !== "undefined" ? window : globalThis);
