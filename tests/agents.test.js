// v7.6 unit tests: AKILLI PARA PnL, RUG score, ZAMAN MAKİNESİ, GİRİŞ, ÇIKIŞ plan, perp setups, alarm. Run: node tests/agents.test.js
const A = require("../agentcore.js"), S = require("../score.js");
let fail = 0; const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i ? "  · " + i : "")); if (!c) fail++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
// --- smart money: average cost per wallet × mint
const tr = [
  { user: "W", mint: "M1", sol: 1, tok: 1000, isBuy: true, t: 1 }, { user: "W", mint: "M1", sol: 1, tok: 500, isBuy: true, t: 2 },   // cost 2 for 1500
  { user: "W", mint: "M1", sol: 1.5, tok: 750, isBuy: false, t: 3 },                                                                  // basis 1 → +0.5
  { user: "W", mint: "M1", sol: 0.4, tok: 750, isBuy: false, t: 4 },                                                                  // basis 1 → −0.6
  { user: "W", mint: "M2", sol: 0.5, tok: 100, isBuy: true, t: 5 }, { user: "W", mint: "M2", sol: 2, tok: 100, isBuy: false, t: 6 },  // +1.5
  { user: "L", mint: "M1", sol: 1, tok: 1000, isBuy: true, t: 1 }, { user: "L", mint: "M1", sol: 0.2, tok: 1000, isBuy: false, t: 9 }, // −0.8
  { user: "E", mint: "M3", sol: 3, tok: 100, isBuy: false, t: 9 } ];                                                                   // sell without a seen buy → not realized
const B = A.smPnl(tr);
ok("smPnl: W realized = +0.5 −0.6 +1.5 = +1.4", near(B.get("W").real, 1.4), B.get("W").real);
ok("smPnl: W 2 wins / 1 loss", B.get("W").wins === 2 && B.get("W").losses === 1);
ok("smPnl: L −0.8", near(B.get("L").real, -0.8));
ok("smPnl: sell without seen buy realizes nothing", B.get("E").real === 0 && B.get("E").wins === 0);
const B2 = A.smPnl(tr.slice(0, 3)); A.smPnl(tr.slice(3), B2); ok("smPnl incremental = batch", near(B2.get("W").real, 1.4));
const top = A.smTop(B, { minReal: 0.3 }); ok("smTop: only W qualifies", top.length === 1 && top[0].addr === "W" && top[0].rate === 0.67, JSON.stringify(top));
// --- rug score
const clean = A.rugScore({ mintAuth: false, freezeAuth: false, serial: 1, devTx: 40, devPct: 3, top10: 18, bundle: 0.1, sameFrac: 0, earlyJump: 0, oddCurve: false, devSold: false, noSoc: false });
ok("rug: clean token low (<20)", clean.risk < 20, clean.risk);
const bad = A.rugScore({ mintAuth: true, freezeAuth: true, serial: 3, devTx: 300, devPct: 12, top10: 55, bundle: 0.7, sameFrac: 0.5, earlyJump: 1.2, oddCurve: false, devSold: true, noSoc: true });
ok("rug: everything bad caps at 100", bad.risk === 100 && bad.F.length >= 8, bad.risk);
const mid = A.rugScore({ serial: 2, top10: 35, bundle: 0.3 }); ok("rug: serial + concentration + early buys → middle (40–60)", mid.risk >= 40 && mid.risk <= 60, mid.risk + " " + mid.F.map(f => f[1]).join("; "));
ok("rug: unknown fields are skipped", A.rugScore({}).risk === 0);
// --- time machine
const X = Object.assign({}, S.X_DEF);
const up = []; for (let i = 0; i < 300; i++) up.push(1 + Math.min(i, 60)*0.03);      // climbs to 2.8x then flat
const dn = []; for (let i = 0; i < 300; i++) dn.push(1 - Math.min(i, 30)*0.01);       // drops 30 % in 30 s
const fl = Array(300).fill(1.02);                                                        // flat
const R = A.tmReplay([{ s: 70, p: up }, { s: 70, p: dn }, { s: 70, p: fl }], X, { exitDecide: S.exitDecide });
ok("tm: 3 paths → 1 TP first, 1 SL first, 1 neither", R.n === 3 && R.tp === 1 && R.sl === 1 && R.ne === 1, JSON.stringify(R));
ok("tm: average R finite and the up path dominates (> 0)", isFinite(R.avgR) && R.avgR > 0, R.avgR);
ok("tm: odds sum to 1", near(R.pTp + R.pSl + R.pNe, 1));
ok("tm: short paths ignored", A.tmReplay([{ p: [1, 1.1] }], X, { exitDecide: S.exitDecide }).n === 0);
// --- entry trigger
const path = []; for (let i = 0; i <= 20; i++) path.push([i*1000, i <= 8 ? 30 + (i%2) : 31 + (i - 8)*0.5]);
const e1 = A.entryState(path, { orSec: 8, brk: 3, expSec: 30, now: 20000 }); ok("entry: break above range high +3% → tetiklendi", e1.st === "tetiklendi", JSON.stringify(e1));
const e2 = A.entryState(path.slice(0, 5), { orSec: 8, now: 4000 }); ok("entry: inside range window → bekliyor", e2.st === "bekliyor");
const flatP = []; for (let i = 0; i <= 40; i++) flatP.push([i*1000, 30]); ok("entry: no break by expiry → süresi doldu", A.entryState(flatP, { orSec: 8, brk: 3, expSec: 30, now: 40000 }).st === "süresi doldu");
// --- exit plan
const x = Object.assign({}, X, { trailLo: 20 });
const p1 = A.exitPlan({ pnl: -3, hi: -1, ageSec: 5, partDone: false, sinceHiSec: 3 }, x); ok("plan: early phase → stop = erken −12", p1.stop.k === "early" && p1.stop.lvl === -12 && p1.target.k === "ptp", JSON.stringify(p1.stop));
const p2 = A.exitPlan({ pnl: 120, hi: 150, ageSec: 200, partDone: true, sinceHiSec: 20 }, x); ok("plan: above +100 → trail 12% off 150 → +120 stop", p2.stop.k === "trail" && near(p2.stop.lvl, 120, 0.1) && p2.target.k === "tp", JSON.stringify(p2));
// --- perp setups
const c = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i)*0.5); c.push(110); ok("perps: 20-bar high breakout tagged", A.perpSetups(c).tags.includes("20 bar zirve kırılımı"));
// --- alert
ok("alert fires once", A.alertHit({ op: ">=", lvl: 5 }, 6) && !A.alertHit({ op: ">=", lvl: 5, fired: true }, 6) && !A.alertHit({ op: "<=", lvl: 5 }, 6));
console.log(fail ? `\n${fail} FAIL` : "\nALL PASS"); process.exit(fail ? 1 : 0);
