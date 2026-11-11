// v7.5 unit tests: pump score on synthetic trade flows + dynamic exits on synthetic price paths. Run: node tests/score.test.js
const S = require("../score.js");
let fail = 0; const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i ? "  · " + i : "")); if (!c) fail++; };
const T0 = 1_000_000, DEV = "DEVwallet";
let rnd = 7; const r = () => (rnd = (rnd*16807) % 2147483647)/2147483647;
const mc = (n, f) => Array.from({ length: n }, (_, i) => [T0 + 3000 + i*1000, f(i)]);
// 1. good organic: 40 distinct wallets, varied sizes, spread over 20 s, some sells, rising mcap
const organic = { dev: DEV, t0: T0, mcap0: 30, trades: [], mcaps: mc(18, i => 32 + i*1.2 + (i%3)*0.3) };
for (let i = 0; i < 40; i++) organic.trades.push({ t: T0 + 3000 + i*450, user: "w" + i, sol: +(0.05 + r()*0.6).toFixed(4), isBuy: true });
for (let i = 0; i < 9; i++) organic.trades.push({ t: T0 + 8000 + i*1200, user: "w" + i, sol: +(0.03 + r()*0.2).toFixed(4), isBuy: false });
const g = S.pumpScore(organic, T0 + 22000, { min: 65 });
ok("organic: passes (score ≥ 65, no hard reject)", g.pass && g.score >= 65 && !g.hard, `skor ${g.score} · ${g.why.join(", ")}`);
// 2. bundled/sniped: 8 wallets buy the same 0.5 SOL inside the first 1.5 s, then little
const bundle = { dev: DEV, t0: T0, mcap0: 30, trades: [], mcaps: mc(15, i => 60 + i*0.2) };
for (let i = 0; i < 8; i++) bundle.trades.push({ t: T0 + 200 + i*150, user: "b" + i, sol: 0.5, isBuy: true });
for (let i = 0; i < 4; i++) bundle.trades.push({ t: T0 + 6000 + i*2000, user: "o" + i, sol: 0.1 + i*0.03, isBuy: true });
const b = S.pumpScore(bundle, T0 + 20000, { min: 65 });
ok("bundled/sniped: rejected", !b.pass && /paket|aynı boyut|az alıcı/.test(b.hard || ""), `skor ${b.score} · ${b.hard}`);
// 3. dev dump: organic flow but the dev sells
const dump = JSON.parse(JSON.stringify(organic)); dump.trades.push({ t: T0 + 15000, user: DEV, sol: 0.9, isBuy: false });
const d = S.pumpScore(dump, T0 + 22000, { min: 65 });
ok("dev dump: hard reject 'dev sattı'", !d.pass && d.hard === "dev sattı", `skor ${d.score} · ${d.hard}`);
// 4. whale-concentrated: one wallet buys 5 SOL, 8 small wallets
const whale = { dev: DEV, t0: T0, mcap0: 30, trades: [{ t: T0 + 5000, user: "WHALE", sol: 5, isBuy: true }], mcaps: mc(18, i => 35 + i*2) };
for (let i = 0; i < 8; i++) whale.trades.push({ t: T0 + 4000 + i*1500, user: "s" + i, sol: 0.08 + i*0.01, isBuy: true });
const w = S.pumpScore(whale, T0 + 22000, { min: 65 });
ok("whale-concentrated: rejected (top wallet)", !w.pass && /tek cüzdan/.test(w.hard || ""), `skor ${w.score} · ${w.hard}`);
// 5. curve-only (no wallets): cannot reach 65 by design
const cv = { dev: DEV, t0: T0, trades: organic.trades.map(x => ({ ...x, user: null })), mcaps: organic.mcaps, src: "curve" };
const c = S.pumpScore(cv, T0 + 22000, { min: 65 });
ok("curve-only flow (no wallets) is never bought", !c.pass && /cüzdan verisi yok/.test(c.hard), `skor ${c.score}`);
ok("weights sum to 100", Object.values(S.W).reduce((a, x) => a + x, 0) === 100);

// exits: run a price path (pnl % per second) through exitDecide like the monitor does
function run(path, opt = {}){ let hi = null, hiAt = 0, part = false; const ev = [];
  for (let i = 0; i < path.length; i++){ const pnl = path[i], t = i; if (hi === null || pnl > hi + 0.5) hiAt = t; hi = Math.max(hi === null ? -1e9 : hi, pnl);
    const flow = opt.flow ? opt.flow(i) : {}; const dd = S.exitDecide({ pnl, hi, ageSec: t, partDone: part, sinceHiSec: t - hiAt, complete: false, flow }, opt.x);
    if (!dd) continue; ev.push({ t, ...dd }); if (dd.act === "part"){ part = true; continue; } break; } return ev; }
const early = run([-3, -5, -9, -14, -20, -30]);
ok("early fail → ERKEN STOP before hard SL", early.length === 1 && early[0].k === "early" && early[0].t === 3, JSON.stringify(early.map(e => [e.t, e.why])));
const momf = run([...Array(25).fill(0).map((_, i) => -2 - i*0.1), -9]);
ok("no momentum in first minute → MOMENTUM YOK", momf.length === 1 && momf[0].k === "mom", JSON.stringify(momf.map(e => [e.t, e.why])));
const ptp = []; for (let i = 0; i <= 30; i++) ptp.push(-3 + i*5); for (let i = 1; i <= 20; i++) ptp.push(147 - i*3);
const pe = run(ptp);
ok("partial TP at +40 then tight trail (zirve > +100 → %12)", pe.length === 2 && pe[0].k === "ptp" && pe[1].k === "trail" && /%12/.test(pe[1].why), JSON.stringify(pe.map(e => [e.t, e.why])));
const lowTrail = []; for (let i = 0; i <= 12; i++) lowTrail.push(-3 + i*5); for (let i = 1; i <= 20; i++) lowTrail.push(57 - i*2);
const le = run(lowTrail);
ok("below +100 the trail is %20 off the high", le.length === 2 && le[0].k === "ptp" && le[1].k === "trail" && /%20/.test(le[1].why), JSON.stringify(le.map(e => [e.t, e.why])));
const be = run([...Array(30).fill(0).map((_, i) => i < 15 ? i*1.6 : 24 - (i - 15)*2)]);
ok("breakeven stop after +20 (or the trail first)", be.length === 1 && (be[0].k === "be" || be[0].k === "trail") && be[0].t > 15, JSON.stringify(be.map(e => [e.t, e.why])));
const rev = run(Array(40).fill(8), { flow: i => ({ sellDom: i >= 12 }) });
ok("flow reversal → AKIŞ DÖNDÜ", rev.length === 1 && rev[0].k === "rev" && rev[0].t === 12, JSON.stringify(rev.map(e => [e.t, e.why])));
const dv = run(Array(40).fill(3), { flow: i => ({ devSell: i >= 9 ? 0.5 : 0 }) });
ok("dev sells while held → DEV SATTI", dv.length === 1 && dv[0].k === "dev", JSON.stringify(dv.map(e => [e.t, e.why])));
const flat = run([...Array(30).fill(0).map((_, i) => i*0.2), ...Array(400).fill(4)]);
ok("flat → YATAY time stop after 4 min without a new high", flat.length === 1 && flat[0].k === "flat" && flat[0].t >= 240 && flat[0].t < 300, JSON.stringify(flat.map(e => [e.t, e.why])));
const hard = run([-2, -26]);
ok("hard SL still fires first", hard[0].k === "sl");
// SIM haircut
ok("haircut 1% when calm, larger on fast moves, capped 15%", S.simHaircut(0) === 0.01 && Math.abs(S.simHaircut(20) - 0.11) < 1e-9 && S.simHaircut(80) === 0.15);
// flow window helpers
const fw = S.flowWin([{ t: 10000, user: "a", sol: 0.1, isBuy: true }, { t: 11000, user: "b", sol: 0.4, isBuy: false }, { t: 11500, user: "c", sol: 0.3, isBuy: false }, { t: 12000, user: "d", sol: 0.3, isBuy: false }], 12500, 6, DEV);
ok("flowWin: sellers dominate", fw.sellDom === true);
ok("topDump: top buyer dumps half", S.topDump([{ t: 1000, user: "T", sol: 1, isBuy: true }, { t: 9000, user: "T", sol: 0.6, isBuy: false }], 10000, 10, DEV) === true);
console.log(fail ? `\n${fail} FAIL` : "\nALL PASS"); process.exit(fail ? 1 : 0);
