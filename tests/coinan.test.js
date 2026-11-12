// v7.8 COIN ANALİZ pure math tests: node tests/coinan.test.js
const C = require("../coinan.js"); let f = 0; const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
ok("ema: SMA seed then smoothing", near(C.ema([1, 2, 3, 4, 5], 3)[2], 2) && near(C.ema([1, 2, 3, 4, 5], 3)[4], 4));
const up = Array.from({ length: 30 }, (_, i) => i + 1); ok("rsi: monotonic rise → 100", C.rsi(up)[29] === 100);
const zz = Array.from({ length: 60 }, (_, i) => 100 + (i % 2 ? 1 : -1)); ok("rsi: zig-zag ≈ 50", Math.abs(C.rsi(zz)[59] - 50) < 5, C.rsi(zz)[59].toFixed(1));
const m = C.macd(Array.from({ length: 80 }, (_, i) => 100 + i)); ok("macd: rising series → macd > 0", m.macd[79] > 0 && m.signal[79] !== null);
const mk = (n, fn, vol = 1) => Array.from({ length: n }, (_, i) => { const c = fn(i), o = fn(i - 1); return { t: 1.7e12 + i*3600e3, o, h: Math.max(o, c)*1.002, l: Math.min(o, c)*0.998, c, v: vol }; });
ok("atr > 0 and vwap within range", (() => { const b = mk(50, i => 100 + Math.sin(i/3)*3); const a = C.atr(b)[49], v = C.vwap(b)[49]; return a > 0 && v > 95 && v < 105; })());
const lv = C.levels(mk(120, i => 100 + Math.sin(i/5)*5), 3, 0.5); ok("levels: finds pivot clusters near 95 and 105", lv.some(l => Math.abs(l.p - 105) < 1) && lv.some(l => Math.abs(l.p - 95) < 1), lv.map(l => l.p.toFixed(1)).join(","));
// whales: 97th-percentile threshold, buyer-maker = taker sell
const ag = Array.from({ length: 200 }, (_, i) => ({ p: 100, q: 1, m: i % 2 === 0, T: i*1000 })); ag.push({ p: 100, q: 1000, m: false, T: 300000 }, { p: 100, q: 400, m: true, T: 301000 });
const w = C.whales(ag, 20000); ok("whales: big taker buy/sell split + net delta", w.n === 2 && w.buy === 100000 && w.sell === 40000 && w.net === 60000, JSON.stringify({ n: w.n, buy: w.buy, sell: w.sell }));
ok("whales: empty input safe", C.whales([], 1).n === 0);
// verdicts on synthetic markets
const nz = i => Math.sin(i*1.7)*0.8 + Math.sin(i*0.37)*0.6; /* noisy trend so RSI is not pinned at 100 */
const trend = s => ({ "15m": C.tfAnalyze(mk(300, i => 100*Math.exp(s*i/3000) + nz(i))), "1h": C.tfAnalyze(mk(300, i => 100*Math.exp(s*i/1000) + nz(i))), "4h": C.tfAnalyze(mk(300, i => 100*Math.exp(s*i/400) + nz(i))), "1d": C.tfAnalyze(mk(300, i => 100*Math.exp(s*i/200) + nz(i))) });
console.log("  synthetic 1h RSI up/down:", trend(1)["1h"].rsi.toFixed(0), trend(-1)["1h"].rsi.toFixed(0));
const U = C.verdict({ tf: trend(1), der: { fund: 0.0001, gls: 1.2, tls: 1.2, taker: 1.2, oiCh24: 5 }, px24: 90, wh: { buy: 2e5, sell: 5e4, net: 1.5e5 } });
const P = U.plan || {}; ok("uptrend + supportive flow → LONG", U.v === "LONG" && U.conf >= 60, U.v + " " + U.conf + " score " + U.score);
ok("LONG plan: stop < zone < TP1 < TP2, R:R ≥ 1", !!P && P.side === "LONG" && (P.stop < P.zone[0] && P.zone[0] < P.zone[1] && P.entry < P.tp1 && P.tp1 < P.tp2 && P.rr1 >= 1 && P.rr2 >= 2.9), JSON.stringify(P && { st: P.stop.toFixed(2), z: P.zone.map(x => x.toFixed(2)), t1: P.tp1.toFixed(2), t2: P.tp2.toFixed(2), rr1: P.rr1.toFixed(2) }));
const D = C.verdict({ tf: trend(-1), der: { fund: -0.0001, gls: 0.8, tls: 0.8, taker: 0.8, oiCh24: 5 }, px24: 120, wh: { buy: 5e4, sell: 2e5, net: -1.5e5 } });
const Q = D.plan || {}; ok("downtrend + selling flow → SHORT with stop above, targets below", D.v === "SHORT" && Q.stop > Q.zone[1] && Q.tp1 < Q.entry && Q.tp2 < Q.tp1, D.v + " " + D.score);
const fz = i => 100 + Math.sin(i*2.1)*0.15, flat = { "15m": C.tfAnalyze(mk(300, fz)), "1h": C.tfAnalyze(mk(300, fz)), "4h": C.tfAnalyze(mk(300, fz)), "1d": C.tfAnalyze(mk(300, fz)) };
const B = C.verdict({ tf: flat, der: { fund: 0.0001, gls: 1.2, tls: 1, taker: 1 }, wh: { buy: 1e5, sell: 1e5, net: 0 } }); ok("flat market → BEKLE with long/short triggers, no entry", B.v === "BEKLE" && B.plan && B.plan.side === null && B.plan.longAbove > B.plan.shortBelow, B.v + " " + B.score);
const hot = trend(1); hot["1h"].rsi = 85; const V = C.verdict({ tf: hot, der: { taker: 1.3, tls: 1.4 }, wh: { buy: 3e5, sell: 0, net: 3e5 } }); ok("RSI > 80 vetoes chasing a LONG", V.v === "BEKLE" && V.factors.some(x => x.k === "veto"));
ok("confidence bounded 50–90", [U, D, B, V].every(x => x.conf >= 50 && x.conf <= 90), [U, D, B, V].map(x => x.conf).join(","));
ok("too few bars → null (no fake analysis)", C.tfAnalyze(mk(30, i => i + 1)) === null);
console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0);
