/* NEON//TERMINAL v7.6 — AGENT CORE: pure, testable math for the crypto versions of the day-trader-skill agents.
   No DOM, no network. window.ACORE in the page, module.exports in Node tests.
   • smPnl(trades)            AKILLI PARA: realized PnL per wallet from an observed trade stream (average-cost per wallet × mint)
   • smTop(book, o)           ranked list of profitable wallets
   • rugScore(f)              RUG DEDEKTÖRÜ: 0–100 rug risk with factors
   • perpSetups(closes)       TARAYICI (perps): 20-bar closing-high breakout, bull flag, oversold / oversold bounce
   • entryState(path, o)      GİRİŞ: opening-range / momentum-break trigger on a candidate's mcap path
   • exitPlan(s, x)           ÇIKIŞ: the live stop / target levels the exit rules imply for one position
   • tmReplay(paths, x, o)    ZAMAN MAKİNESİ: replay the exit plan on recorded candidate price paths → odds + average R (an estimate)
   • alertHit(a, v)           ALARM: does a price / level alert fire for value v */
"use strict";
(function (root){
const cl = (x, a, b) => Math.max(a, Math.min(b, x));
/* ---------------- AKILLI PARA ---------------- */
/* trades: [{ user, mint, sol, tok, isBuy, t }] in time order. A sell realizes sol − avgCost × tokSold; selling more than we saw bought
   (wallet bought before we watched) only realizes against the part we saw. Returns Map wallet → { real, buys, sells, wins, losses, vol, mints:Set, open } */
function smPnl(trades, book){ const B = book || new Map(), pos = B._pos || (B._pos = new Map());
  for (const x of trades || []){ if (!x || !x.user || !(x.sol > 0)) continue; const k = x.user + "|" + x.mint; const p = pos.get(k) || { tok: 0, cost: 0 };
    const w = B.get(x.user) || { real: 0, buys: 0, sells: 0, wins: 0, losses: 0, vol: 0, mints: new Set(), last: 0 }; w.vol += x.sol; w.mints.add(x.mint); w.last = Math.max(w.last, x.t || 0);
    if (x.isBuy){ w.buys++; p.tok += x.tok || 0; p.cost += x.sol; }
    else { w.sells++; const tok = x.tok || 0; if (p.tok > 0 && tok > 0){ const f = Math.min(1, tok/p.tok), basis = p.cost*f, pnl = x.sol - basis; w.real += pnl; pnl >= 0 ? w.wins++ : w.losses++; p.tok -= Math.min(tok, p.tok); p.cost -= basis; } }
    pos.set(k, p); B.set(x.user, w); }
  return B; }
function smTop(book, o = {}){ const minReal = o.minReal ?? 0.3, minWins = o.minWins ?? 2, minRate = o.minRate ?? 0.6, n = o.n ?? 20; const L = [];
  for (const [addr, w] of book){ if (addr === "_pos" || !w || typeof w !== "object" || !("real" in w)) continue; const closed = w.wins + w.losses, rate = closed ? w.wins/closed : 0;
    if (w.real >= minReal && w.wins >= minWins && rate >= minRate) L.push({ addr, real: +w.real.toFixed(4), wins: w.wins, losses: w.losses, rate: +rate.toFixed(2), mints: w.mints.size, vol: +w.vol.toFixed(3), last: w.last }); }
  return L.sort((a, b) => b.real - a.real).slice(0, n); }
/* ---------------- RUG DEDEKTÖRÜ ---------------- */
/* f: { mintAuth, freezeAuth, serial, devTx, devPct, top10, bundle (0–1), earlyJump, oddCurve, sameFrac, devSold, noSoc } — unknown fields are skipped */
function rugScore(f){ const F = []; const add = (w, why) => F.push([w, why]);
  if (f.mintAuth) add(35, "mint yetkisi açık"); if (f.freezeAuth) add(30, "dondurma yetkisi açık");
  if (f.devSold) add(40, "dev sattı");
  if (f.serial > 1) add(Math.min(30, 10*(f.serial - 1) + 10), `seri yaratıcı (oturumda ${f.serial}. token)`);
  if (f.devTx != null && f.devTx >= 300) add(15, `dev cüzdanı çok aktif (${f.devTx}+ işlem: bot/seri)`); else if (f.devTx != null && f.devTx <= 2) add(8, "dev cüzdanı yepyeni");
  if (f.devPct > 10) add(15, `dev arzın %${f.devPct.toFixed(1)}'ini tutuyor`); else if (f.devPct > 5) add(6, `dev payı %${f.devPct.toFixed(1)}`);
  if (f.top10 != null){ if (f.top10 > 45) add(25, `ilk 10 sahip %${f.top10.toFixed(0)}`); else if (f.top10 > 30) add(12, `ilk 10 sahip %${f.top10.toFixed(0)}`); }
  if (f.bundle > 0.5) add(25, `paket alım: alımların %${Math.round(f.bundle*100)}'i ilk 2 sn'de`); else if (f.bundle > 0.25) add(10, `erken alım payı %${Math.round(f.bundle*100)}`);
  if (f.sameFrac >= 0.4) add(15, "aynı boyutta tekrarlı alım");
  if (f.earlyJump >= 1) add(12, `ilk sn'lerde +%${Math.round(f.earlyJump*100)} sıçrama`);
  if (f.oddCurve) add(30, "standart dışı bonding curve");
  if (f.noSoc) add(8, "sosyal hesap yok");
  return { risk: Math.min(100, F.reduce((a, x) => a + x[0], 0)), F }; }
/* ---------------- TARAYICI (perps) ---------------- */
function rsi(c, n = 14){ if (c.length < n + 1) return null; let g = 0, l = 0; for (let i = c.length - n; i < c.length; i++){ const d = c[i] - c[i-1]; d > 0 ? g += d : l -= d; } return l === 0 ? 100 : 100 - 100/(1 + g/l); }
function perpSetups(c){ if (!c || c.length < 22) return { tags: [], rsi: null };
  const last = c[c.length-1], hi20 = Math.max(...c.slice(-21, -1)), ma20 = c.slice(-20).reduce((a, b) => a + b, 0)/20, ma20p = c.slice(-21, -1).reduce((a, b) => a + b, 0)/20,
    run = c[c.length-6]/c[c.length-16] - 1, rng5 = (Math.max(...c.slice(-5)) - Math.min(...c.slice(-5)))/last, r = rsi(c), rp = rsi(c.slice(0, -1)); const tags = [];
  if (last > hi20) tags.push("20 bar zirve kırılımı"); if (run > 0.10 && rng5 < 0.05) tags.push("boğa bayrağı"); if (c[c.length-2] < ma20p && last > ma20) tags.push("20 ort. geri alındı");
  if (r !== null && r < 30) tags.push("aşırı satım"); if (rp !== null && rp < 30 && last > c[c.length-2]) tags.push("aşırı satımdan sıçrama");
  return { tags, rsi: r === null ? null : +r.toFixed(1), hi20, ma20 }; }
/* ---------------- GİRİŞ ---------------- */
/* path: [[t, mcap]] from the start of the watch; range = first orSec seconds; trigger = a later point ≥ range high × (1 + brk%) */
function entryState(path, o = {}){ const orSec = o.orSec ?? 8, brk = o.brk ?? 3, exp = o.expSec ?? 30, now = o.now ?? (path.length ? path[path.length-1][0] : 0);
  if (!path || !path.length) return { st: "bekliyor", why: "veri yok" }; const t0 = path[0][0], R = path.filter(p => p[0] - t0 <= orSec*1000);
  if (now - t0 < orSec*1000) return { st: "bekliyor", why: `aralık oluşuyor (${Math.ceil((orSec*1000 - (now - t0))/1000)} sn)` };
  const hi = Math.max(...R.map(p => p[1])), lo = Math.min(...R.map(p => p[1])), lvl = hi*(1 + brk/100);
  const hit = path.find(p => p[0] - t0 > orSec*1000 && p[1] >= lvl); if (hit) return { st: "tetiklendi", at: hit[0], px: hit[1], hi, lo, lvl, why: `aralık üstü +%${brk} kırıldı` };
  if (now - t0 > exp*1000) return { st: "süresi doldu", hi, lo, lvl, why: `${exp} sn içinde kırılım yok` };
  const last = path[path.length-1][1]; return { st: "bekliyor", hi, lo, lvl, why: `tetik ${lvl.toFixed(1)} · şu an ${last.toFixed(1)} (%${((lvl/last - 1)*100).toFixed(1)} uzak)` }; }
/* ---------------- ÇIKIŞ ---------------- */
/* the price levels (pnl %) at which each rule would fire right now */
function exitPlan(s, x){ const hi = Math.max(s.hi ?? s.pnl, s.pnl), L = [];
  L.push({ k: "sl", lvl: -x.sl, lab: `sert stop −%${x.sl}` });
  if (x.early > 0 && s.ageSec <= x.earlySec) L.push({ k: "early", lvl: -x.early, lab: `erken stop −%${x.early} (${Math.max(0, Math.ceil(x.earlySec - s.ageSec))} sn)` });
  if (x.be > 0 && hi >= x.be){ L.push({ k: "be", lvl: x.beLock, lab: `başa baş +%${x.beLock}` }); const w = hi >= x.trailSw ? x.trailHi : x.trailLo; if (w > 0) L.push({ k: "trail", lvl: ((1 + hi/100)*(1 - w/100) - 1)*100, lab: `iz %${w} (zirve ${hi.toFixed(0)}%)` }); }
  const stop = L.reduce((a, b) => b.lvl > a.lvl ? b : a);
  const tgt = !s.partDone && x.ptp > 0 ? { k: "ptp", lvl: x.ptp, lab: `kısmi %${x.ptpPct} @ +%${x.ptp}` } : { k: "tp", lvl: x.tp, lab: `tam kâr +%${x.tp}` };
  return { stop: { k: stop.k, lvl: +stop.lvl.toFixed(1), lab: stop.lab }, target: tgt, timeLeftMin: Math.max(0, x.holdMin - s.ageSec/60), flatIn: x.flatMin > 0 ? Math.max(0, x.flatMin*60 - (s.sinceHiSec || 0)) : null }; }
/* ---------------- ZAMAN MAKİNESİ ---------------- */
/* paths: [{ s: score, p: [rel mcap per second, 1.0 = entry] }]; exitDecide from SCORE. Fees: round trip `fee` (default 3 %).
   tp-first = first exit was a take-profit (ptp/tp or a trail/breakeven that closed in profit); sl-first = sl/early/mom; neither = time/flat/end or a ≤0 trail. R = exit pnl / hard SL. */
function tmReplay(paths, x, o = {}){ const ED = o.exitDecide, fee = o.fee ?? 0.03; let tp = 0, sl = 0, ne = 0, Rs = [], n = 0;
  for (const P of paths || []){ if (!P || !P.p || P.p.length < 10) continue; n++; let hi = null, hiAt = 0, part = false, partPnl = 0, res = null, closed = false;
    for (let i = 0; i < P.p.length; i++){ const pnl = (P.p[i]*(1 - fee) - 1)*100; if (hi === null || pnl > hi + 0.5) hiAt = i; hi = Math.max(hi === null ? -1e9 : hi, pnl);
      const d = ED({ pnl, hi, ageSec: i, partDone: part, sinceHiSec: i - hiAt, complete: false, flow: {} }, x); if (!d) continue;
      if (d.act === "part"){ part = true; partPnl = pnl; if (!res) res = "tp"; continue; }
      const tot = part ? (partPnl*x.ptpPct + pnl*(100 - x.ptpPct))/100 : pnl; const k = d.k;
      res = res || (k === "sl" || k === "early" || k === "mom" ? "sl" : (k === "tp" || ((k === "trail" || k === "be") && pnl > 0)) ? "tp" : "ne"); Rs.push(tot/x.sl); closed = true; break; }
    if (!closed){ const last = (P.p[P.p.length-1]*(1 - fee) - 1)*100, tot = part ? (partPnl*x.ptpPct + last*(100 - x.ptpPct))/100 : last; Rs.push(tot/x.sl); res = res || "ne"; }
    res === "tp" ? tp++ : res === "sl" ? sl++ : ne++; }
  const avgR = Rs.length ? Rs.reduce((a, b) => a + b, 0)/Rs.length : null;
  return { n, tp, sl, ne, pTp: n ? tp/n : null, pSl: n ? sl/n : null, pNe: n ? ne/n : null, avgR: avgR === null ? null : +avgR.toFixed(2) }; }
/* ---------------- ALARM ---------------- */
function alertHit(a, v){ if (!a || a.fired || !isFinite(v)) return false; return a.op === ">=" ? v >= a.lvl : a.op === "<=" ? v <= a.lvl : false; }
const api = { smPnl, smTop, rugScore, perpSetups, rsi, entryState, exitPlan, tmReplay, alertHit };
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ACORE = api;
})(typeof window !== "undefined" ? window : globalThis);
