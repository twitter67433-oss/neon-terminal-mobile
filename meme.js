/* NEON//TERMINAL v7.5 — MEME platform: fully automatic pump.fun trading with four agents.
   WATCHER (new tokens + filters) · COPIER (mirror tracked wallets) · EXECUTOR (exec.js) · RISK (protect the account first, grow it second).
   Modes: SIM (default · paper money, real live market data, realistic fills/fees/latency, nothing sent) and GERÇEK (BOT CÜZDANI, real SOL).
   Auto is OFF after every page load unless "otomatik başlat" is on. Manual trades always need ONAYLA; Grok can only suggest.
   v7.4: optional compounding (entry = equity × %), animated USD goal bar, win/loss effects, simplified MEME layout.
   v7.9: measured funnel (see FN) → moderately looser selection: dev buy ≥ 0.05 SOL (was 0.15), dev share ≤ 20 % (16), momentum ≥ −5 % (3),
         wait 15 s, pump score ≥ 55 (65), ≥ 3 buyers (5), top wallet ≤ 55 % (45). Wallet-level backfill now runs for every scored candidate
         (the logs stream misses the first trades). Hard rug rejects (dev sold, bundle, rug ≥ 70, net ≤ 0, dd > 25 %) and all risk limits unchanged.
   v7.7: SIM = GERÇEK. SIM runs the exact same settings and code path as GERÇEK (filters, pump score, exits, compounding, maxTrade, budget,
         dailyLoss, maxPos, half size after a loss, pause after 2 losses, same fee buffer, Jito tip when on); only the fills are virtual
         (+ the v7.5 haircut). "Serbest mod" removed (one-time migration turns it off); SIM start = BOT CÜZDANI SOL balance (public RPC, no unlock) or 0.212 SOL.
   v7.6: agent cards (TARAYICI, GİRİŞ, ÇIKIŞ, BÜTÇE, ALARM, HABER, AKILLI PARA, RUG DEDEKTÖRÜ, ZAMAN MAKİNESİ — agents.js); rug risk + entry gate +
         smart-money bonus feed the buy decision; none of them can place orders.
   v7.5: "pump skoru" from each candidate's own trade flow (keyless Solana RPC logsSubscribe → pump.fun TradeEvents) with hard rejects,
         "alırdı" learning log while OTO is off, dynamic exits (early stop, breakeven, partial take-profit, tightening trail, flow reversal,
         dev/top-holder dump, flat time stop) and a SIM fill haircut on fast moves. Risk limits (maxTrade, budget, dailyLoss, maxPos, pauses) unchanged. */
"use strict";
const MEME = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (x, d = 4) => (x === null || x === undefined || !isFinite(+x)) ? "—" : (+x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: Math.min(d, 2) });
const sg = (x, d = 4) => (x >= 0 ? "+" : "") + fmt(x, d);
const pc = x => !isFinite(x) || x === null ? "—" : (x >= 0 ? "+" : "") + x.toFixed(1) + "%";
const short = a => a ? String(a).slice(0, 4) + "…" + String(a).slice(-4) : "—";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin", tm = ms => new Date(ms).toLocaleTimeString("tr-TR", { timeZone: TZ });
const ms = x => x === null || x === undefined || !isFinite(x) ? "—" : x >= 1000 ? (x/1000).toFixed(2) + " sn" : Math.round(x) + " ms";
const T = () => window.TRADE, W = () => window.WALLET, X = () => window.EXEC;
const K = "neon.meme";
const SIM_FALLBACK = 0.212; /* last known real BOT CÜZDANI balance — used when the wallet balance cannot be read */
const DEF = { mode: "SIM", dep: SIM_FALLBACK, autoStart: false, base: 0.05, maxTrade: 0.1, budget: 0.5, dailyLoss: 0.25, maxPos: 3, tp: 250, sl: 25, trail: 20, holdMin: 15, slip: 20, prio: 0.0005,
  w: { on: true, minInit: 0.05, minMcap: 15, maxMcap: 120, needSoc: true, maxDev: 20, maxRisk: 58, waitSec: 15, minMom: -5 },
  sc: { on: true, min: 55, minBuyers: 3, maxTop: 55, learn: true },
  x: { on: true, early: 12, earlySec: 20, momUp: 5, momFail: 8, be: 20, beLock: 1, ptp: 40, ptpPct: 50, trailHi: 12, trailSw: 100, rev: true, revSec: 6, flatMin: 4, flatBand: 10, simHc: true },
  cp: { on: true, minSrc: 0.3, maxMcap: 300, follow: true, cool: 120, max10: 3, sizeMode: "fixed", ratio: 0.1 },
  rules: { half: true, pause2: true, pauseMin: 60, upHigh: true },
  gk: { gate: false, timeout: 2500, fallback: "rules" },
  cmp: { on: false, pct: 10, winX: 1.25 },
  fx: { sound: true },
  goal: { targetUsd: 2000, startUsd: null, startAt: null },
  };
const deep = (a, b) => { const o = JSON.parse(JSON.stringify(a)); /* v7.9: never alias DEF's nested objects (migrations used to mutate DEF) */ for (const k in b) o[k] = (a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) ? Object.assign({}, a[k], b[k] || {}) : b[k]; return o; };
let C = deep(DEF, (() => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch(e){ return {}; } })());
const save = () => localStorage.setItem(K, JSON.stringify(C));
/* v7.3: one-time move to the looser watcher filters (risk limits untouched) */
if ((C.fv|0) < 2){ Object.assign(C.w, { minInit: 0.15, minMcap: 15, maxMcap: 120, maxDev: 16, maxRisk: 58, waitSec: 15, minMom: 3 }); C.fv = 2; try { save(); } catch(e){} }
/* v7.5: one-time move to the new exit + score defaults (risk limits — base, maxTrade, budget, dailyLoss, maxPos, rules — untouched) */
if ((C.fv|0) < 3){ C.tp = DEF.tp; C.trail = DEF.trail; C.w.waitSec = DEF.w.waitSec; C.x = Object.assign({}, DEF.x); C.sc = Object.assign({}, DEF.sc); C.fv = 3; try { save(); } catch(e){} }
/* v7.7: one-time — SIM becomes a 1:1 preview of GERÇEK. Serbest mod off for good, SIM account restarts at the real wallet balance
   (0.212 SOL now; replaced by the live BOT CÜZDANI balance right after load if it can be read). Real-mode data and all limits untouched. */
let MIG77 = false;
if ((C.fv|0) < 4){ delete C.freeSim; C.dep = SIM_FALLBACK; C.fv = 4; MIG77 = true;
  try { ["neon.sim", "neon.meme.risk.sim", "neon.meme.eq.sim", "neon.meme.eq.sim.mk"].forEach(k => localStorage.removeItem(k)); localStorage.setItem("neon.meme.sim77", "1"); save(); } catch(e){} }
delete C.freeSim;
/* v7.9: one-time — looser selection from the measured funnel. Only these selection keys change; risk limits, exits and rug rejects are untouched. */
if ((C.fv|0) < 5){ Object.assign(C.w, { minInit: 0.05, maxDev: 20, minMom: -5, waitSec: 15 }); Object.assign(C.sc, { min: 55, minBuyers: 3, maxTop: 55 }); C.fv = 5; try { save(); } catch(e){} }
const RANGE = { base: [0.001, 1], maxTrade: [0.001, 2], budget: [0.01, 20], dailyLoss: [0.005, 20], maxPos: [1, 10], tp: [5, 1000], sl: [3, 90], trail: [0, 80], holdMin: [1, 1440], slip: [1, 50], prio: [0, 0.005], dep: [0.01, 10000],
  "w.minInit": [0, 50], "w.minMcap": [0, 1000], "w.maxMcap": [1, 5000], "w.maxDev": [0, 100], "w.maxRisk": [0, 100], "w.waitSec": [3, 600], "w.minMom": [-50, 500],
  "cp.minSrc": [0, 100], "cp.maxMcap": [1, 10000], "cp.cool": [0, 3600], "cp.max10": [1, 50], "cp.ratio": [0.001, 10], "rules.pauseMin": [1, 1440], "gk.timeout": [500, 15000],
  "cmp.pct": [1, 25], "cmp.winX": [1, 2], "goal.targetUsd": [1, 1000000], "goal.startUsd": [0.01, 1000000],
  "sc.min": [0, 100], "sc.minBuyers": [0, 500], "sc.maxTop": [1, 100],
  "x.early": [0, 90], "x.earlySec": [0, 600], "x.momUp": [0, 100], "x.momFail": [0, 90], "x.be": [0, 500], "x.beLock": [-20, 50], "x.ptp": [0, 1000], "x.ptpPct": [0, 90],
  "x.trailHi": [0, 80], "x.trailSw": [10, 2000], "x.revSec": [2, 120], "x.flatMin": [0, 1440], "x.flatBand": [-50, 500] };
const BOOL = new Set(["w.on", "w.needSoc", "cp.on", "cp.follow", "rules.half", "rules.pause2", "rules.upHigh", "gk.gate", "cmp.on", "fx.sound", "sc.on", "sc.learn", "x.on", "x.rev", "x.simHc"]);
const getP = p => p.split(".").reduce((o, k) => o && o[k], C);
function setP(p, v){ if (BOOL.has(p)) v = v === true || v === "true" || v === 1; else if (p === "cp.sizeMode") { if (!["fixed", "ratio"].includes(v)) throw new Error("sizeMode fixed|ratio"); } else if (p === "gk.fallback") { if (!["rules", "deny"].includes(v)) throw new Error("fallback rules|deny"); }
  else { const r = RANGE[p]; if (!r) throw new Error("bilinmeyen ayar: " + p); v = +String(v).replace(",", "."); if (!(v >= r[0] && v <= r[1])) throw new Error(`${p} ${r[0]}–${r[1]} olmalı`); }
  const ks = p.split("."); let o = C; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = v; save(); ruleApply(p); return v; }
function ruleApply(p){ if (typeof R === "undefined" || !(R.pauseUntil > Date.now())) return;
  if (p === "rules.pause2" && !C.rules.pause2){ R.pauseUntil = 0; R.consec = 0; rSave(); tl("risk", "◆ RİSK: ara kuralı kapatıldı → ara bitti", "up"); }
  else if (p === "rules.pauseMin"){ R.pauseUntil = (R.pauseAt || Date.now()) + C.rules.pauseMin*60000; if (R.pauseUntil <= Date.now()){ R.pauseUntil = 0; tl("risk", `◆ RİSK: ara süresi ${C.rules.pauseMin} dk → ara bitti`, "up"); } else tl("risk", `◆ RİSK: ara süresi ${C.rules.pauseMin} dk → ${tm(R.pauseUntil)}'e kadar`, "y"); rSave(); } }
function endPause(){ R.pauseUntil = 0; R.consec = 0; rSave(); tl("risk", "◆ RİSK: ara elle bitirildi", "up"); paint(true); }
/* ------------------------- SIM account ------------------------- */
const SK = "neon.sim";
const simNew = dep => ({ dep, cash: dep, pos: [], start: Date.now(), n: 0 });
let SIM = (() => { try { const s = JSON.parse(localStorage.getItem(SK) || "null"); if (s && isFinite(s.cash)) return s; } catch(e){} return simNew(C.dep); })();
const simSave = () => localStorage.setItem(SK, JSON.stringify(SIM));
/* ------------------------- risk state (per mode) ------------------------- */
const RK = m => "neon.meme.risk." + (m === "GERÇEK" ? "real" : "sim");
const rLoad = m => Object.assign({ mult: 1, consec: 0, pauseUntil: 0, eqHigh: null, wins: 0, losses: 0, cmpMult: 1 }, (() => { try { return JSON.parse(localStorage.getItem(RK(m)) || "{}"); } catch(e){ return {}; } })());
let R = rLoad(C.mode); const rSave = () => localStorage.setItem(RK(C.mode), JSON.stringify(R));
/* ------------------------- equity series + timeline ------------------------- */
const EK = m => "neon.meme.eq." + (m === "GERÇEK" ? "real" : "sim");
let EQ = (() => { try { return JSON.parse(localStorage.getItem(EK(C.mode)) || "[]"); } catch(e){ return []; } })();
const eqSave = () => { if (EQ.length > 1500) EQ = EQ.slice(-1500); localStorage.setItem(EK(C.mode), JSON.stringify(EQ)); };
let MK = (() => { try { return JSON.parse(localStorage.getItem(EK(C.mode) + ".mk") || "[]"); } catch(e){ return []; } })();
const mark = (kind, sym, pnl) => { MK.push({ t: Date.now(), k: kind, s: sym, p: pnl }); if (MK.length > 300) MK = MK.slice(-300); localStorage.setItem(EK(C.mode) + ".mk", JSON.stringify(MK)); };
const TLK = "neon.meme.tl"; let TL = (() => { try { return JSON.parse(localStorage.getItem(TLK) || "[]"); } catch(e){ return []; } })();
function tl(kind, html, cls, extra){ TL.unshift(Object.assign({ t: Date.now(), k: kind, h: html, c: cls || "", m: C.mode }, extra || {})); if (TL.length > 250) TL.length = 250; localStorage.setItem(TLK, JSON.stringify(TL)); paintTLQ(); }
const TAPE = []; function tape(x){ TAPE.unshift(Object.assign({ t: Date.now() }, x)); if (TAPE.length > 60) TAPE.length = 60; paintTapeQ(); }
/* ------------------------- runtime state ------------------------- */
const FN = {}; /* v7.9 funnel: stage → reason → count (since page load) */
const fnKey = r => String(r).replace(/\([^)]*\)/g, "").replace(/[0-9][0-9.,]*/g, "#").replace(/\s+/g, " ").trim();
const fnInc = (st, r) => { const o = FN[st] = FN[st] || {}; const k = r === undefined ? "_" : fnKey(r); o[k] = (o[k] || 0) + 1; };
const ST = { scN: 0, scPass: 0, scores: [], wb: 0, wbLive: 0, on: false, wake: null, cands: new Map(), mons: new Map(), busy: new Set(), buying: 0, curves: new Map(), cpLog: new Map(), lastCopy: null, seen: 0, passed: 0, entered: 0, wLast: "", gk: { n: 0, yes: 0, no: 0, to: 0, last: null }, real: { bal: null, at: 0 }, orb: 0 };
const isReal = () => C.mode === "GERÇEK";
/* v7.7: no unrestricted SIM any more — SIM obeys every GERÇEK limit. Kept as a constant so the shared sizing/risk code has one path. */
const simFree = () => false;
const SRV = !!window.NEON_SRV; /* true inside the always-on server bot (server/server.mjs) */
const RMT = () => !SRV && !!(window.REMOTE && REMOTE.paired()); /* phone paired with the server bot: local engine stays idle, UI mirrors the server */
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return +d; };
const walletTag = () => isReal() ? "BOT" : "SIM";
const todayPnl = () => JOURNAL.todayPnl("SOL", e => e.venue === "pump.fun" && e.wallet === walletTag());
const posList = () => isReal() ? W().pos.list().filter(p => (p.venue || "pump.fun") === "pump.fun") : SIM.pos;
const posGet = m => posList().find(p => p.mint === m);
function posUpd(m, patch){ if (isReal()){ const a = W().pos.list(), p = a.find(x => x.mint === m); if (p){ Object.assign(p, patch); W().pos.save(a); } } else { const p = SIM.pos.find(x => x.mint === m); if (p){ Object.assign(p, patch); simSave(); } } }
function posAdd(p){ if (isReal()) W().pos.add(p); else { SIM.pos.push(p); simSave(); } }
function posDel(m){ if (isReal()) W().pos.del(m); else { SIM.pos = SIM.pos.filter(p => p.mint !== m); simSave(); } }
const deployed = () => posList().reduce((s, p) => s + (p.solIn || 0), 0);
const posVal = p => { const mo = ST.mons.get(p.mint); return mo && isFinite(mo.val) && mo.val !== null ? mo.val : p.solIn; };
const cashNow = () => isReal() ? ST.real.bal : SIM.cash;
function equity(){ const c = cashNow(); if (c === null || c === undefined) return null; return c + posList().reduce((s, p) => s + posVal(p), 0); }
function depBase(){ if (!isReal()) return SIM.dep; const J = JOURNAL.list(); const d = J.filter(e => e.venue === "transfer" && e.side === "YÜKLE").reduce((s, e) => s + (+e.in || 0), 0) - J.filter(e => e.venue === "transfer" && e.side === "ÇEK").reduce((s, e) => s + (+e.out || 0), 0);
  if (d > 0) return d; let b = +localStorage.getItem("neon.meme.realdep"); if (!(b > 0)){ const e = equity(); if (e > 0){ b = e; localStorage.setItem("neon.meme.realdep", String(e)); } } return b > 0 ? b : null; }
async function realBal(force){ if (!isReal() || !W().exists()) return; if (!force && Date.now() - ST.real.at < 12000) return; ST.real.at = Date.now(); try { ST.real.bal = await W().solBal(); } catch(e){} }
/* ------------------------- curve cache ------------------------- */
let w3 = null; async function web3(){ return w3 = w3 || await T().ph.web3(); }
async function curveKey(mint, hint){ if (hint) return hint; const t = PUMP.get(mint); if (t && t.curve) return t.curve; const w = await web3();
  return w.PublicKey.findProgramAddressSync([new TextEncoder().encode("bonding-curve"), new w.PublicKey(mint).toBytes()], new w.PublicKey(COPY.PUMPPROG))[0].toBase58(); }
function watchCurve(mint, key){ let e = ST.curves.get(mint); if (e){ e.refs++; return e; } e = { key, c: null, at: 0, refs: 1, unsub: null };
  e.unsub = PUMP.curveSub(key, c => { e.c = c; e.at = Date.now(); }); PUMP.curveNow(key).then(c => { if (c && !e.c){ e.c = c; e.at = Date.now(); } }).catch(() => {}); ST.curves.set(mint, e); return e; }
function unwatchCurve(mint){ const e = ST.curves.get(mint); if (!e) return; if (--e.refs <= 0){ e.unsub && e.unsub(); ST.curves.delete(mint); } }
const curveOf = m => { const e = ST.curves.get(m); return e && e.c; };
/* ------------------------- FLOW: per-token trade flow, keyless -------------------------
   Checked 2026-11-11: PumpPortal subscribeTokenTrade needs a funded API key; Solana RPC logsSubscribe({ mentions: [mint] }) on publicnode
   streams every pump.fun trade of that token (TradeEvent → wallet, SOL, buy/sell). Subscribes are paced ~650 ms (publicnode drops bursts).
   Fallback when logs stay silent: buy/sell deltas from the bonding-curve account (no wallet → buyer count and concentration unknown). */
const AGT = () => window.AGENTS; const agTrade = (m, r) => { try { AGT() && AGT().onTrade(m, r); } catch(e){} };
const FLOW = (() => {
  const S = { ws: null, open: false, id: 1, q: [], qT: null, last: 0, req: new Map(), reqAt: new Map(), bySub: new Map(), want: new Map(), retry: 0, notes: 0, trades: 0 };
  const url = () => { const c = X().C.ws; return /^wss:\/\//.test(c || "") ? c : "wss://solana-rpc.publicnode.com"; };
  const trim = a => { if (a.length > 3000) a.splice(0, a.length - 3000); };
  function wsOpen(){ if (S.ws) return; let ws; try { ws = new WebSocket(url()); } catch(e){ return; } S.ws = ws;
    ws.onopen = () => { S.open = true; S.retry = 0; for (const [m, e] of S.want) if (e.sub == null && !S.q.includes(m)) S.q.push(m); pumpQ(); };
    ws.onmessage = ev => { let j; try { j = JSON.parse(ev.data); } catch(e){ return; }
      if (j.id && S.req.has(j.id)){ const m = S.req.get(j.id); S.req.delete(j.id); S.reqAt.delete(j.id); const e = S.want.get(m); if (typeof j.result === "number"){ if (e){ e.sub = j.result; S.bySub.set(j.result, m); } else unsubId(j.result); } return; }
      if (j.method !== "logsNotification") return; const m = S.bySub.get(j.params.subscription), e = m && S.want.get(m); if (!e) return; const v = j.params.result.value; if (!v || v.err) return; S.notes++;
      if (e.sigs.has(v.signature)) return; e.sigs.add(v.signature); if (e.sigs.size > 4000) e.sigs.clear();
      const me = isReal() && W().exists() ? W().pub() : null, now = Date.now();
      for (const l of v.logs || []){ const t = COPY.decodeTrade(l); if (!t || t.mint !== m || (me && t.user === me)) continue; S.trades++; const rec = { t: now, user: t.user, sol: t.sol, tok: t.tok, isBuy: t.isBuy, mcap: t.mcap }; e.tr.push(rec); trim(e.tr); agTrade(m, rec); } };
    ws.onclose = () => { S.ws = null; S.open = false; S.bySub.clear(); S.req.clear(); S.reqAt.clear(); S.q = []; clearTimeout(S.qT); S.qT = null; for (const e of S.want.values()) e.sub = null; if (S.want.size) setTimeout(wsOpen, Math.min(15000, 1000*2**S.retry++)); };
    ws.onerror = () => {}; }
  function step(){ S.qT = null; const m = S.q.shift(); if (m === undefined) return; if (!S.open || !S.ws || S.ws.readyState !== 1){ S.q.unshift(m); return; }
    const e = S.want.get(m); if (e && e.sub == null){ const id = S.id++; S.req.set(id, m); S.reqAt.set(id, Date.now()); S.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method: "logsSubscribe", params: [{ mentions: [m] }, { commitment: "processed" }] })); S.last = Date.now(); } pumpQ(); }
  function pumpQ(){ if (S.qT || !S.q.length) return; S.qT = setTimeout(step, Math.max(0, 650 - (Date.now() - S.last))); }
  function unsubId(id){ if (S.open && S.ws && S.ws.readyState === 1) try { S.ws.send(JSON.stringify({ jsonrpc: "2.0", id: S.id++, method: "logsUnsubscribe", params: [id] })); } catch(e){} }
  setInterval(() => { const cut = Date.now() - 8000; for (const [id, t] of S.reqAt) if (t < cut){ const m = S.req.get(id); S.reqAt.delete(id); S.req.delete(id); if (m && S.want.has(m) && S.want.get(m).sub == null && !S.q.includes(m)) S.q.push(m); } pumpQ(); if (S.want.size) wsOpen(); }, 4000);
  function curveOn(e, key){ e.cunsub = PUMP.curveSub(key, c => { const now = Date.now(); e.mc.push([now, c.mcap]); trim(e.mc);
    if (e.lastC){ const d = c.vSol - e.lastC.vSol; if (Math.abs(d) > 1e-6){ e.ctr.push({ t: now, user: null, sol: Math.abs(d), isBuy: d > 0, mcap: c.mcap }); trim(e.ctr); } } e.lastC = c; }); }
  function track(mint, key, dev, t0, mcap0){ let e = S.want.get(mint); if (e){ e.refs++; return e; }
    e = { refs: 1, sub: null, sigs: new Set(), tr: [], ctr: [], mc: [], dev: dev || null, t0: t0 || Date.now(), mcap0: mcap0 || null, lastC: null, cunsub: null, dead: false }; S.want.set(mint, e);
    if (key) curveOn(e, key); else curveKey(mint).then(k => { if (!e.dead) curveOn(e, k); }).catch(() => {});
    S.q.push(mint); wsOpen(); pumpQ(); return e; }
  function untrack(mint){ const e = S.want.get(mint); if (!e || --e.refs > 0) return; e.dead = true; S.want.delete(mint); S.q = S.q.filter(x => x !== mint); if (e.sub != null){ S.bySub.delete(e.sub); unsubId(e.sub); } e.cunsub && e.cunsub(); }
  /* HTTP backfill (publicnode's logs stream is sometimes silent for a token): latest signatures → getTransaction (4 at a time) → TradeEvents.
     Used once per candidate at decision time when no wallet-level trade arrived; deduped by signature with the WS path. */
  async function backfill(mint, ms = 5000){ const e = S.want.get(mint); if (!e) return 0; const end = Date.now() + ms, me = isReal() && W().exists() ? W().pub() : null; let n = 0;
    try { const L = await T().ph.rpc("getSignaturesForAddress", [mint, { limit: 50, commitment: "confirmed" }]); const q = (L || []).filter(x => !x.err && !e.sigs.has(x.signature)).slice(0, 40);
      for (let i = 0; i < q.length && Date.now() < end; i += 4) await Promise.all(q.slice(i, i + 4).map(async x => { try { const tx = await T().ph.rpc("getTransaction", [x.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
        if (!tx || !tx.meta || tx.meta.err || e.sigs.has(x.signature)) return; e.sigs.add(x.signature); const at = (tx.blockTime || x.blockTime || Date.now()/1000)*1000;
        for (const l of tx.meta.logMessages || []){ const t = COPY.decodeTrade(l); if (!t || t.mint !== mint || (me && t.user === me)) continue; n++; S.trades++; const rec = { t: at, user: t.user, sol: t.sol, tok: t.tok, isBuy: t.isBuy, mcap: t.mcap, bf: true }; e.tr.push(rec); agTrade(mint, rec); } } catch(err){} }));
      e.tr.sort((a, b) => a.t - b.t); } catch(err){} S.bf = (S.bf || 0) + 1; S.bfN = (S.bfN || 0) + n; return n; }
  function flow(mint){ const e = S.want.get(mint); if (!e) return null; const logs = e.tr.length > 0; return { dev: e.dev, t0: e.t0, mcap0: e.mcap0, trades: logs ? e.tr : e.ctr, mcaps: e.mc, src: logs ? "logs" : "curve", subbed: e.sub != null }; }
  return { track, untrack, flow, backfill, get stat(){ return { bf: S.bf || 0, bfN: S.bfN || 0, open: S.open, subs: [...S.want.values()].filter(e => e.sub != null).length, want: S.want.size, notes: S.notes, trades: S.trades }; } };
})();
const volOf = (mc, now, win) => { const L = (mc || []).filter(p => p[0] >= now - win).map(p => p[1]); if (L.length < 2) return 0; const lo = Math.min(...L), hi = Math.max(...L); return lo > 0 ? (hi - lo)/lo*100 : 0; };
const simHcNow = mc => !isReal() && C.x && C.x.simHc ? SCORE.simHaircut(volOf(mc, Date.now(), 3000)) : 0;
/* ------------------------- RISK agent ------------------------- */
/* Pure size math (exported for tests). Caps never raise a limit; they only shrink the ticket.
   Compounding ON: raw = equity × (pct/100) × cmpMult; OFF: base (or copy-ratio / wallet size).
   Then × risk ladder (R.mult), then min(maxTrade, budget left, cash − fee buffer, optional wallet cap). */
function sizeCalc(o){ return sizeExplain(o).size; }
/* same math as before, plus which limit decided the ticket (BÜTÇE agent) */
function sizeExplain(o){
  const riskMult = isFinite(+o.riskMult) && +o.riskMult > 0 ? +o.riskMult : 1;
  let raw, by;
  if (o.cmpOn){
    const eq = +o.equity;
    const pct = Math.max(1, Math.min(25, +o.pct || 10));
    const cm = Math.max(1, Math.min(2, +o.cmpMult || 1));
    raw = (eq > 0 && isFinite(eq)) ? eq*(pct/100)*cm : (+o.base || 0)*cm; by = `bileşik %${pct} × ${cm}x`;
  } else if (o.src === "copy" && o.sizeMode === "ratio" && o.srcSol){ raw = +o.srcSol * (+o.ratio || 0); by = "kopya oranı"; }
  else if (o.walletSize > 0){ raw = +o.walletSize; by = "cüzdan boyutu"; }
  else { raw = +o.base || 0; by = "temel boyut"; }
  if (riskMult !== 1) by += ` × risk ${riskMult}x`;
  let size = raw * riskMult, room = null, cashRoom = null;
  const out = (sz, b) => ({ size: sz, by: b, raw, riskMult, room, cashRoom, free: !!o.free });
  if (o.cmpOn && o.walletSize > 0 && +o.walletSize * riskMult < size){ size = +o.walletSize * riskMult; by = "cüzdan boyutu"; }
  if (!(size > 0) || !isFinite(size)) return out(0, "giriş yok");
  if (!o.free){
    if (+o.maxTrade < size){ size = +o.maxTrade; by = "işlem başı max"; }
    room = +o.budget - (o.deployed || 0) - (o.infl || 0);
    if (isFinite(room) && room < size){ size = room; by = "toplam bütçe"; }
  }
  const feeBuf = o.feeBuf == null ? 0.004 : +o.feeBuf;
  if (o.cash !== null && o.cash !== undefined && isFinite(+o.cash)){ cashRoom = +o.cash - (o.infl || 0) - feeBuf; if (cashRoom < size){ size = cashRoom; by = "nakit (ücret payı düşülünce)"; } }
  if (!(size >= 0.001)) return out(0, by + " → 0.001 SOL altı");
  return out(+size.toFixed(9), by);
}
const feeBufNow = () => 0.007; /* v7.7: same cash buffer in SIM and GERÇEK */
function riskSize(src, srcSol, walletSize){ return sizeWhy(src, srcSol, walletSize).size; }
function sizeWhy(src, srcSol, walletSize){
  const free = simFree();
  return sizeExplain({ cmpOn: !!(C.cmp && C.cmp.on), pct: C.cmp && C.cmp.pct, cmpMult: R.cmpMult || 1, equity: equity(),
    base: C.base, maxTrade: C.maxTrade, budget: C.budget, deployed: deployed(), infl: inflSum(), cash: cashNow(), feeBuf: feeBufNow(),
    riskMult: free ? 1 : (R.mult || 1), free, src, srcSol, sizeMode: C.cp.sizeMode, ratio: C.cp.ratio, walletSize: walletSize || 0 });
}
const INFL = new Map(); /* buys still in flight (mint → size): counted against max positions / budget / cash so parallel signals cannot overshoot the limits */
const inflSum = () => [...INFL.values()].reduce((a, x) => a + x, 0);
function riskCheck(size, mint){ const now = Date.now(), free = simFree();
  if (!(size >= 0.001)) return "yetersiz bakiye veya bütçe (ücret payı düşülünce giriş sığmıyor)";
  if (!free){
    if (R.pauseUntil > now) return `RİSK arası: ${Math.ceil((R.pauseUntil - now)/60000)} dk kaldı`;
    if (todayPnl() <= -C.dailyLoss) return `günlük max zarar (${C.dailyLoss} SOL) doldu`;
  }
  if (posGet(mint) || INFL.has(mint)) return "bu token zaten açık pozisyonda";
  if (!free && posList().length + INFL.size >= C.maxPos) return `max açık pozisyon (${C.maxPos}) dolu`;
  if (!free && deployed() + inflSum() + size > C.budget + 1e-9) return `bütçe dolu (${fmt(deployed() + inflSum(), 3)} / ${C.budget} SOL)`;
  const cash = cashNow(); if (cash !== null && cash - inflSum() < size + feeBufNow()) return `yetersiz bakiye (${fmt(cash, 4)} SOL)`;
  if (isReal() && !W().unlocked()) return "BOT CÜZDANI kilitli";
  return null; }
function riskOnClose(pnl){ if (pnl < 0){ R.losses++; R.consec++; if (!simFree() && C.rules.half && R.mult > 0.25){ R.mult = Math.max(0.25, (R.mult || 1)/2); tl("risk", `◆ RİSK: kayıp sonrası boyut yarıya → <b>${R.mult}x</b>`, "y"); mark("risk", "", 0); }
    if (C.cmp && C.cmp.on && (R.cmpMult || 1) > 1){ R.cmpMult = 1; tl("risk", "◆ BİLEŞİK: kayıp → çarpan <b>1x</b> (temele döndü)", "y"); }
    if (!simFree() && C.rules.pause2 && R.consec >= 2){ R.pauseAt = Date.now(); R.pauseUntil = R.pauseAt + C.rules.pauseMin*60000; R.consec = 0; tl("risk", `◆ RİSK: 2 kayıp üst üste → <b>${C.rules.pauseMin} dk ara</b> (${tm(R.pauseUntil)}'e kadar)`, "dn"); mark("risk", "", 0); NOTIFY.ping("bad", `RİSK: ${C.rules.pauseMin} dk ara`); } }
  else { R.wins++; R.consec = 0; const e = equity(); if (e !== null && (R.eqHigh === null || e > R.eqHigh + 1e-9)){ R.eqHigh = e; if (R.mult < 1){ R.mult = C.rules.upHigh ? Math.min(1, R.mult*2) : 1; tl("risk", `◆ RİSK: yeni hesap zirvesi ${fmt(e, 4)} SOL → boyut <b>${R.mult}x</b>`, "up"); } }
    else if (!C.rules.upHigh) R.mult = 1;
    if (C.cmp && C.cmp.on && C.cmp.winX > 1){ const prev = R.cmpMult || 1, next = Math.min(2, +(prev*C.cmp.winX).toFixed(4)); if (next !== prev){ R.cmpMult = next; tl("risk", `◆ BİLEŞİK: kazanınca ×${C.cmp.winX} → <b>${R.cmpMult}x</b>`, "up"); } } }
  rSave(); }
/* ------------------------- entry / exit ------------------------- */
const lab = a => { const w = COPY.list.find(x => x.addr === a); return w ? w.label : short(a); };
async function enter(o){ /* o: { mint, sym, src, wallet, srcSol, tEv, c0, curve, reason, manual, size } */
  const size = o.size || riskSize(o.src, o.srcSol), why = riskCheck(size, o.mint);
  if (why){ if (!o.quiet){ /* same reason (e.g. risk pause) logs at most once a minute, with how many were skipped */ const SK = ST.skipLog || (ST.skipLog = new Map()), k = why.replace(/[\d.,]+/g, "#"), e = SK.get(k), now = Date.now();
      if (!e || now - e.t > 60000){ tl("skip", `⏸ ${esc(o.sym)}: ${esc(why)}${e && e.n ? ` <small>(+${e.n} atlandı)</small>` : ""}`, "dim"); SK.set(k, { t: now, n: 0 }); } else e.n++; } if (/günlük max zarar/.test(why) && ST.on) stop(why); return null; }
  if (ST.busy.has(o.mint)) return null; ST.busy.add(o.mint); ST.buying++; INFL.set(o.mint, size); let watched = false;
  try { const key = await curveKey(o.mint, o.curve); const e = watchCurve(o.mint, key); watched = true;
    if (!o.manual && C.gk.gate && window.GROK && GROK.ready()){ const g = await GROK.gate(gateInfo(o), C.gk.timeout); ST.gk.n++; ST.gk.last = g;
      if (g.timeout || g.error){ ST.gk.to++; if (C.gk.fallback === "deny"){ tl("grok", `GROK cevap vermedi (${esc(g.error || "zaman aşımı")}) → ${esc(o.sym)} atlandı`, "dim"); return null; } tl("grok", `GROK cevap vermedi (${esc(g.error || "zaman aşımı")}) → kurallarla devam`, "dim"); }
      else if (!g.ok){ ST.gk.no++; tl("grok", `GROK HAYIR: ${esc(o.sym)} — ${esc(g.why || "")} <small>${ms(g.ms)}</small>`, "dn"); window.BUS && BUS.emit("grok"); return null; }
      else { ST.gk.yes++; tl("grok", `GROK EVET: ${esc(o.sym)} — ${esc(g.why || "")} <small>${ms(g.ms)}</small>`, "up"); window.BUS && BUS.emit("grok"); } }
    const c0 = o.c0 || e.c || await PUMP.curveNow(key).catch(() => null);
    const auto = !o.manual; let r;
    if (!isReal()){ r = await X().sim({ action: "buy", sol: size, slip: C.slip, prio: C.prio, sym: o.sym, mint: o.mint }, () => curveOf(o.mint), c0, o.tEv, { src: o.src, newAta: true, hc: o.hc || 0 });
      SIM.cash += r.sol; SIM.n++; const jid = JOURNAL.add({ venue: "pump.fun", mode: auto ? "OTO" : "MANUEL", wallet: "SIM", src: o.src, w: o.wallet || null, sym: o.sym, mint: o.mint, side: "AL→SAT", in: +(-r.sol).toFixed(9), unit: "SOL", reason: o.reason || "", note: `giriş mcap ${fmt(c0 && c0.mcap, 1)} SOL · olay→gön. ${ms(r.m.ev2sent)} · gön.→dolum ${ms(r.m.sent2conf)}` });
      posAdd({ mint: o.mint, sym: o.sym, venue: "pump.fun", solIn: -r.sol, tokens: r.tokens, t: Date.now(), auto, src: o.src, wallet: o.wallet || null, curve: key, jid, entryMcap: c0 && c0.mcap }); }
    else { r = await X().real({ action: "buy", mint: o.mint, amount: size, denominatedInSol: "true", slip: C.slip, prio: C.prio, pool: "pump", sym: o.sym }, o.tEv, { src: o.src, preKey: "buy:" + o.mint, ref: c0 && c0.mcap });
      const est = c0 ? X().buyOut(c0, size) : null, spent = size*(1 + X().PP_FEE) + C.prio + X().BASE_FEE + X().RENT;
      const jid = JOURNAL.add({ venue: "pump.fun", mode: auto ? "OTO" : "MANUEL", wallet: "BOT", src: o.src, w: o.wallet || null, sym: o.sym, mint: o.mint, side: "AL→SAT", in: +spent.toFixed(9), unit: "SOL", sigIn: r.sig, reason: o.reason || "", note: `giriş mcap ${fmt(c0 && c0.mcap, 1)} SOL · olay→gön. ${ms(r.m.ev2sent)} · gön.→onay ${ms(r.m.sent2conf)}` });
      posAdd({ mint: o.mint, sym: o.sym, venue: "pump.fun", solIn: spent, tokens: est, estTok: true, t: Date.now(), auto, src: o.src, wallet: o.wallet || null, curve: key, jid, entryMcap: c0 && c0.mcap, sigIn: r.sig });
      X().txDelta(r.sig, o.mint).then(d => { if (!d) return; const p = posGet(o.mint); if (!p) return; const patch = { estTok: false }; if (d.tokens > 0) patch.tokens = d.tokens; if (d.sol !== null) patch.solIn = -d.sol; posUpd(o.mint, patch); if (p.jid && d.sol !== null) JOURNAL.upd(p.jid, { in: +(-d.sol).toFixed(9) }); realBal(true); }); }
    ST.entered++; mark("buy", o.sym);
    const txt = o.src === "copy" ? `🔁 KOPYALANDI <b>${esc(o.sym)}</b> · ${esc(lab(o.wallet))} alımından <b>${ms(r.m.ev2sent + (r.m.sent2conf || 0))}</b> sonra` : o.src === "watcher" ? `▲ GİRİŞ <b>${esc(o.sym)}</b> · İZLEYİCİ` : o.src === "grok" ? `▲ AL <b>${esc(o.sym)}</b> · GROK önerisi` : `▲ ELLE AL <b>${esc(o.sym)}</b>`;
    tl("buy", `${txt} · ${fmt(size, 3)} SOL${isReal() ? "" : " · SIM"}`, "up", { sym: o.sym });
    tape({ side: "buy", sym: o.sym, sol: size, who: isReal() ? "BOT" : "SIM", us: true });
    NOTIFY.ping("good", `${isReal() ? "" : "SIM "}AL ${o.sym} ${fmt(size, 3)} SOL`, !isReal()); ST.orb = 1; fxBuy();
    monitor(o.mint); paint(); return r; }
  catch(e){ tl("err", `✖ ${esc(o.sym)} alım başarısız: ${esc(e.message)}`, "dn"); if (isReal()) NOTIFY.ping("bad", `alım başarısız: ${o.sym}`); return null; }
  finally { INFL.delete(o.mint); if (watched) unwatchCurve(o.mint); ST.busy.delete(o.mint); ST.buying--; } }
/* exit: frac < 1 = partial take-profit (sells that share of the tokens; the rest keeps running with its cost basis reduced in proportion).
   GERÇEK partial uses the same executor path as a full sell, with PumpPortal amount "NN%" (no pre-built tx; that one is for 100 %). */
async function exit(mint, why, tEv, frac){ const p = posGet(mint); if (!p || ST.busy.has("s:" + mint)) return null; ST.busy.add("s:" + mint);
  const part = frac > 0 && frac < 1, f = part ? frac : 1, pctTxt = Math.round(f*100);
  try { const e = ST.curves.get(mint) || watchCurve(mint, p.curve || await curveKey(mint)); const c0 = e.c || await PUMP.curveNow(e.key).catch(() => null); let out, r; const sellTok = p.tokens*f;
    if (!isReal()){ if (!p.tokens) throw new Error("adet bilinmiyor"); const fl = FLOW.flow(mint);
      r = await X().sim({ action: "sell", tokens: sellTok, slip: C.slip, prio: C.prio, sym: p.sym, mint }, () => curveOf(mint), c0, tEv, { src: p.src, hc: simHcNow(fl && fl.mcaps) });
      out = r.sol; SIM.cash += out; simSave(); }
    else { if (!W().unlocked()) throw new Error("BOT CÜZDANI kilitli"); r = await X().real({ action: "sell", mint, amount: part ? pctTxt + "%" : "100%", denominatedInSol: "false", slip: C.slip, prio: C.prio, pool: "auto", sym: p.sym }, tEv, { src: p.src, preKey: part ? null : "sell:" + mint, ref: c0 && c0.mcap });
      out = c0 && p.tokens ? X().sellOut(c0, sellTok)*(1 - X().PP_FEE) - C.prio : 0; const est = out, acc0 = p.outAcc || 0;
      X().txDelta(r.sig, mint).then(d => { if (!d){ realBal(true); return; }
        if (part){ const q = posGet(mint); if (q){ const patch = {}; if (d.tokens > 0) patch.tokens = d.tokens; if (d.sol !== null) patch.outAcc = (q.outAcc || 0) + (d.sol - est); posUpd(mint, patch); } }
        else if (d.sol !== null && p.jid){ const j = JOURNAL.list().find(x => x.id === p.jid); if (j){ const tot = acc0 + d.sol; JOURNAL.upd(p.jid, { out: +tot.toFixed(9), pnl: +(tot - (j.in || 0)).toFixed(9), pnlPct: j.in ? +((tot/j.in - 1)*100).toFixed(2) : null, note: (j.note || "") + " · çıkış tx'ten kesin" }); } }
        realBal(true); }); }
    if (part){ const cost = p.solIn*f, ppp = cost > 0 ? (out/cost - 1)*100 : 0;
      posUpd(mint, { tokens: p.tokens - sellTok, solIn: p.solIn - cost, part: true, outAcc: (p.outAcc || 0) + out, cost0: p.cost0 || p.solIn });
      if (p.jid){ const j = JOURNAL.list().find(x => x.id === p.jid); JOURNAL.upd(p.jid, { note: ((j && j.note) || "") + ` · kısmi %${pctTxt} → ${fmt(out, 4)} SOL (${pc(ppp)})` }); }
      tl("sell", `◐ KISMİ SATIŞ <b>${esc(p.sym)}</b> %${pctTxt} · ${pc(ppp)} · +${fmt(out, 4)} SOL · ${esc(why)} · kalan %${100 - pctTxt} iz süren stopla devam${isReal() ? "" : " · SIM"}`, ppp >= 0 ? "up" : "dn", { sym: p.sym });
      tape({ side: "sell", sym: p.sym, sol: out, who: isReal() ? "BOT" : "SIM", us: true, pnl: ppp });
      NOTIFY.ping("good", `${isReal() ? "" : "SIM "}KISMİ SAT ${p.sym} %${pctTxt} ${pc(ppp)}`, !isReal()); ST.orb = 1; mark("sell", p.sym, out - cost); paint(); return r; }
    const tot = (p.outAcc || 0) + out, cost = p.cost0 || p.solIn, pnl = tot - cost, pp = (tot/cost - 1)*100;
    if (p.jid) JOURNAL.upd(p.jid, { out: +tot.toFixed(9), closeT: Date.now(), sigOut: r.sig || "", reason: [JOURNAL.list().find(x => x.id === p.jid)?.reason, why].filter(Boolean).join(" → ") });
    posDel(mint); stopMon(mint); riskOnClose(pnl); mark("sell", p.sym, pnl);
    tl("sell", `▼ SATILDI <b>${esc(p.sym)}</b> ${pc(pp)} · ${sg(pnl, 4)} SOL · ${esc(why)}${p.part ? " · kısmi satış dahil" : ""}${isReal() ? "" : " · SIM"}`, pnl >= 0 ? "up" : "dn", { sym: p.sym, pnl });
    tape({ side: "sell", sym: p.sym, sol: out, who: isReal() ? "BOT" : "SIM", us: true, pnl: pp });
    NOTIFY.ping(pnl >= 0 ? "good" : "bad", `${isReal() ? "" : "SIM "}SAT ${p.sym} ${pc(pp)}`, !isReal()); ST.orb = 1;
    if (pnl >= 0) fxWin(pnl, p.sym); else fxLoss();
    if (!simFree() && todayPnl() <= -C.dailyLoss && ST.on) stop(`günlük max zarar (${C.dailyLoss} SOL) doldu`);
    paint(); return r; }
  catch(e){ tl("err", `✖ ${esc(p.sym)} ${part ? "kısmi " : ""}satış başarısız: ${esc(e.message)}`, "dn"); if (isReal()) NOTIFY.ping("bad", `${p.sym} SATILAMADI`); const mo = ST.mons.get(mint); if (mo) mo.retryAt = Date.now() + 6000; return null; }
  finally { ST.busy.delete("s:" + mint); } }
/* position monitor: live curve → value; TP / SL / trailing / time / graduation (exits run while OTO is armed) */
function monitor(mint){ if (ST.mons.has(mint)) return; const p = posGet(mint); if (!p) return; const mo = { val: null, pnl: null, hi: null, hiAt: p.t, t: null, retryAt: 0, preAt: 0, key: null, mh: [] }; ST.mons.set(mint, mo);
  const tk = PUMP.get(mint); FLOW.track(mint, p.curve, tk && tk.creator, tk && tk.at, tk && tk.mcap0); mo.flow = true;
  (async () => { mo.key = p.curve || await curveKey(mint); if (ST.mons.get(mint) === mo) watchCurve(mint, mo.key); else return; })();
  mo.t = setInterval(() => check(mint), 400); }
function stopMon(mint){ const mo = ST.mons.get(mint); if (!mo) return; clearInterval(mo.t); ST.mons.delete(mint); if (mo.key) unwatchCurve(mint); if (mo.flow) FLOW.untrack(mint); }
/* exit settings for SCORE.exitDecide: the classic fields (sl, tp, holdMin, trail) + the v7.5 dynamic ones (C.x) */
const xcfg = () => Object.assign({}, C.x, { sl: C.sl, tp: C.tp, holdMin: C.holdMin, trailLo: C.trail });
function exitFlow(mint, p, now){ const f = FLOW.flow(mint); if (!f) return {}; const tr = f.trades.filter(x => x.t >= p.t), w = SCORE.flowWin(tr, now, C.x.revSec, f.dev);
  return { sellDom: w.sellDom, devSell: f.src === "logs" ? SCORE.flowWin(tr, now, 1e7, f.dev).devSell : 0, topDump: f.src === "logs" ? SCORE.topDump(f.trades, now, 10, f.dev) : false, src: f.src }; }
function check(mint){ const mo = ST.mons.get(mint), p = posGet(mint); if (!mo) return; if (!p){ stopMon(mint); return; } const c = curveOf(mint); if (!c || !p.tokens) return; const now = Date.now();
  mo.val = Math.max(0, X().sellOut(c, p.tokens)*(1 - X().PP_FEE) - C.prio); mo.pnl = (mo.val/p.solIn - 1)*100; mo.mcap = c.mcap; mo.complete = c.complete;
  if (mo.hi === null || mo.pnl > mo.hi + 0.5) mo.hiAt = now; mo.hi = Math.max(mo.hi === null ? -1e9 : mo.hi, mo.pnl);
  if (isReal() && W().unlocked() && now - mo.preAt > 20000){ mo.preAt = now; X().prebuild("sell:" + mint, { action: "sell", mint, amount: "100%", denominatedInSol: "false", slip: C.slip, prio: C.prio, pool: "auto" }, c.mcap); }
  if (!ST.on || now < mo.retryAt || ST.busy.has("s:" + mint)) return;
  const held = (now - p.t)/60000;
  if (C.x && C.x.on){ const d = SCORE.exitDecide({ pnl: mo.pnl, hi: mo.hi, ageSec: (now - p.t)/1000, partDone: !!p.part, sinceHiSec: (now - (mo.hiAt || p.t))/1000, complete: c.complete, flow: exitFlow(mint, p, now) }, xcfg());
    if (d) d.act === "part" ? exit(mint, d.why, undefined, d.pct/100) : exit(mint, d.why); return; }
  const why = mo.pnl >= C.tp ? `KÂR AL ${pc(mo.pnl)}` : mo.pnl <= -C.sl ? `ZARAR KES ${pc(mo.pnl)}` : C.trail > 0 && mo.hi >= C.trail && mo.pnl <= mo.hi - C.trail ? `İZ SÜREN STOP (zirve ${pc(mo.hi)})` : held >= C.holdMin ? `SÜRE DOLDU (${C.holdMin} dk)` : c.complete ? "curve tamamlandı (mezun)" : null;
  if (why) exit(mint, why); }
/* ------------------------- WATCHER agent ------------------------- */
/* v7.5 flow: prefilter (old filters) → wait waitSec while the token's trades stream in → old checks → PUMP SKORU ≥ threshold + hard rejects → buy.
   Learning ("öğrenme", sc.learn): while OTO is off the same pipeline runs and a pass is logged as "ALIRDI" and followed for 5 min — nothing is bought. */
function onNew(t){ ST.seen++; if (!C.w.on) return; const learn = !ST.on && !!(C.sc && C.sc.learn); if (!ST.on && !learn) return; if (RMT()) return; const w = C.w;
  const why = t.pool !== "pump" ? "havuz pump değil" : t.devSol < w.minInit ? "dev alımı düşük" : t.mcap && t.mcap < w.minMcap ? "mcap düşük" : t.devPct > w.maxDev ? "dev payı yüksek" : t.serial > 1 ? "seri yaratıcı" : t.copy > 0 ? "kopya isim" : null;
  fnInc("seen"); if (why){ fnInc("pre", why); ST.wLast = `${t.symbol}: ${why}`; return; } if (ST.cands.size >= 6){ fnInc("pre", "aday kuyruğu dolu"); return; } if (!learn && !simFree() && posList().length >= C.maxPos){ fnInc("pre", "max pozisyon dolu"); return; }
  ST.passed++; const c = { t, at: Date.now(), first: null, hi: 0, last: null, odd: false, learn };
  const e = watchCurve(t.mint, t.curve); c.e = e; ST.cands.set(t.mint, c); PUMP.metaQ(t, true); FLOW.track(t.mint, t.curve, t.creator, t.at, t.mcap0); try { AGT() && AGT().onCand(t); } catch(e){}
  ST.wLast = `${t.symbol}: ${w.waitSec} sn akış izleniyor`; tl("watch", `👁 İZLEYİCİ: <b>${esc(t.symbol)}</b> ilk filtreyi geçti · mcap ${fmt(t.mcap, 1)} · dev %${fmt(t.devPct, 1)}`, "dim");
  c.iv = setInterval(() => { const cv = e.c; if (!cv) return; if (c.first === null){ c.first = cv.mcap; c.odd = Math.abs(cv.vSol - cv.rSol - 30) > 1.5; } c.last = cv.mcap; c.hi = Math.max(c.hi, cv.mcap); }, 250);
  if (isReal() && !learn) setTimeout(() => { const cv = e.c; if (ST.on && ST.cands.has(t.mint) && cv && cv.mcap >= (c.first || cv.mcap)) X().prebuild("buy:" + t.mint, { action: "buy", mint: t.mint, amount: riskSize("watcher"), denominatedInSol: "true", slip: C.slip, prio: C.prio, pool: "pump" }, cv.mcap); }, Math.max(1000, (w.waitSec - 4)*1000));
  setTimeout(() => decide(t.mint), w.waitSec*1000); }
const scShort = sc => `skor <b>${sc.score}</b>${sc.m.src === "curve" ? " <small>(yalnızca curve)</small>" : ""}: ${esc(sc.why.slice(0, 4).join(", "))}`;
async function decide(mint, again){ const c = ST.cands.get(mint); if (!c) return; const t = c.t, w = C.w;
  const done = (msg, cls, kind) => { clearInterval(c.iv); ST.cands.delete(mint); unwatchCurve(mint); FLOW.untrack(mint); if (msg) tl(kind || "watch", msg, cls || "dim"); };
  if (!ST.on && !c.learn) return done();
  if (w.needSoc && !t.meta && !t.metaErr && !again){ setTimeout(() => decide(mint, true), 4000); return; }
  PUMP.risk(t); const mom = c.first && c.last ? (c.last/c.first - 1)*100 : null, soc = t.meta && (t.meta.tw || t.meta.tg || t.meta.web);
  const no = c.first === null ? "canlı curve verisi yok" : c.odd ? "standart dışı curve" : w.needSoc && !soc ? "sosyal yok" : t.risk > w.maxRisk ? `risk ${t.risk} > ${w.maxRisk}` : mom < w.minMom ? `momentum ${pc(mom)} < %${w.minMom}` : c.last > w.maxMcap ? `mcap ${fmt(c.last, 1)} > ${w.maxMcap}` : c.e.c && c.e.c.complete ? "curve tamamlandı" : c.last < c.hi*0.8 ? "zirveden %20+ düştü" : null;
  if (no){ fnInc("dec", no); ST.wLast = `${t.symbol}: elendi (${no})`; return done(`✖ ${esc(t.symbol)} elendi: ${esc(no)}`); }
  /* v7.9: always backfill wallet-level trades before scoring — the logs stream only starts after the (paced) subscribe and often misses the first buys */
  let fl = FLOW.flow(mint); const nBuyers = f => f && f.src === "logs" ? new Set(f.trades.filter(x => x.isBuy && x.user).map(x => x.user)).size : 0;
  if (C.sc && C.sc.on && fl && (fl.src === "curve" || nBuyers(fl) < (C.sc.minBuyers || 0) + 3)){ fnInc("bf", fl.src); await FLOW.backfill(mint, 4500); if (!ST.cands.has(mint)) return; fl = FLOW.flow(mint); } let sc = null;
  /* v7.6 agents: smart-money bonus, rug risk hard reject, optional entry-trigger gate (they only veto or boost — they never buy) */
  const fl0 = fl || { trades: [], mcaps: [] }; let g = null; try { g = AGT() ? AGT().gate(t, c, fl0, SCORE.metrics(fl0, Date.now())) : null; } catch(e){ g = null; }
  if (!(C.sc && C.sc.on) && g && g.reject){ fnInc("dec", g.reject); ST.wLast = `${t.symbol}: ${g.reject}`; return done(`✖ ${esc(t.symbol)} elendi: <b>${esc(g.reject)}</b>`, "dim", "score"); }
  if (C.sc && C.sc.on){ sc = SCORE.pumpScore(fl0, Date.now(), Object.assign({}, C.sc, { bonus: g ? g.bonus : 0 })); if (g){ if (g.reject && !sc.hard){ sc.hard = g.reject; sc.pass = false; } sc.why.push(...g.notes); sc.rug = g.rug; sc.entry = g.entry; }
    try { AGT() && AGT().onScored(t, c, sc); } catch(e){} ST.scN++; ST.scores.push(sc.score); if (ST.scores.length > 500) ST.scores.shift();
    fnInc("src", fl0 && fl0.src ? fl0.src : "yok"); if (!sc.pass){ if (sc.hard) fnInc("hard", sc.hard); else fnInc("low", sc.score >= 55 ? "55–64" : sc.score >= 45 ? "45–54" : "<45"); ST.wLast = `${t.symbol}: skor ${sc.score}${sc.hard ? " · " + sc.hard : ""}`; return done(`✖ ${esc(t.symbol)} ${scShort(sc)} → ${sc.hard ? "<b>" + esc(sc.hard) + "</b>" : `eşik ${sc.min} altı`}${c.learn ? " · öğrenme" : ""}`, "dim", "score"); }
    ST.scPass++; fnInc("pass"); }
  if (c.learn || !ST.on){ const rec = wouldBuy(t, c, sc, mom); done(); return rec; }
  const tEv = performance.now(); clearInterval(c.iv); ST.cands.delete(mint);
  if (sc) tl("score", `✔ ${esc(t.symbol)} ${scShort(sc)} → AL`, "up");
  await enter({ mint, sym: t.symbol, src: "watcher", tEv, curve: t.curve, reason: `İZLEYİCİ: ${sc ? "skor " + sc.score + " (" + sc.why.slice(0, 3).join(", ") + "), " : ""}momentum ${pc(mom)}, risk ${t.risk}`, c0: c.e.c, hc: simHcNow(fl && fl.mcaps) });
  unwatchCurve(mint); FLOW.untrack(mint); }
/* ------------------------- learning: "would buy" log ------------------------- */
const WBK = "neon.meme.wb"; let WB = (() => { try { return JSON.parse(localStorage.getItem(WBK) || "[]"); } catch(e){ return []; } })();
const wbSave = () => { try { localStorage.setItem(WBK, JSON.stringify(WB.slice(0, 150))); } catch(e){} };
function wouldBuy(t, c, sc, mom){ ST.wb++; const m0 = c.last; const rec = { t: Date.now(), mint: t.mint, sym: t.symbol, s: sc ? sc.score : null, m0, hi: m0, lo: m0, last: m0, done: false, mode: C.mode };
  WB.unshift(rec); if (WB.length > 150) WB.length = 150; wbSave();
  tl("score", `🧪 ALIRDI <b>${esc(t.symbol)}</b> · ${sc ? scShort(sc) : "skor kapalı"} · mcap ${fmt(m0, 1)}${ST.on ? "" : " · OTO kapalı, alınmadı"} — 5 dk izleniyor`, "y");
  const key = (c.e && c.e.key) || t.curve; if (!key || ST.wbLive >= 10){ rec.done = true; rec.skip = true; wbSave(); return rec; } ST.wbLive++;
  const un = PUMP.curveSub(key, cv => { rec.last = cv.mcap; rec.hi = Math.max(rec.hi, cv.mcap); rec.lo = Math.min(rec.lo, cv.mcap); });
  setTimeout(() => { un(); ST.wbLive--; rec.done = true; rec.pHi = +((rec.hi/m0 - 1)*100).toFixed(1); rec.pLo = +((rec.lo/m0 - 1)*100).toFixed(1); rec.p5 = +((rec.last/m0 - 1)*100).toFixed(1); wbSave();
    tl("score", `🧪 ${esc(t.symbol)} 5 dk sonra: zirve ${pc(rec.pHi)} · dip ${pc(rec.pLo)} · son ${pc(rec.p5)} <small>(ücretler hariç)</small>`, rec.p5 >= 0 ? "up" : "dn"); paint(true); }, 300000);
  return rec; }
/* ------------------------- COPIER agent ------------------------- */
function onCopy(ev){ if (ev.kind !== "trade"){ paintAgentsQ(); paintWalletsQ(); return; } const t = ev.t;
  tape({ side: t.isBuy ? "buy" : "sell", sym: (PUMP.get(t.mint) || {}).symbol || short(t.mint), sol: t.sol, who: lab(t.wallet) });
  paintWalletsQ(); if (!ST.on || !C.cp.on) return; const w = COPY.list.find(x => x.addr === t.wallet); if (!w || w.on === false) return;
  if (t.isBuy){ const cp = C.cp; if (t.sol < cp.minSrc) return; if (t.mcap && t.mcap > cp.maxMcap){ ST.cpSkip = `mcap ${fmt(t.mcap, 0)} > ${cp.maxMcap}`; return; }
    if (posGet(t.mint)) return;
    const L = (ST.cpLog.get(t.wallet) || []).filter(x => Date.now() - x < 600000); if (L.length >= cp.max10){ ST.cpSkip = `${lab(t.wallet)}: 10 dk'da ${cp.max10} kopya sınırı`; return; }
    const lastMint = ST.cpLog.get("m:" + t.mint); if (lastMint && Date.now() - lastMint < cp.cool*1000) return;
    ST.cpLog.set(t.wallet, L.concat(Date.now())); ST.cpLog.set("m:" + t.mint, Date.now());
    const sym = (PUMP.get(t.mint) || {}).symbol || t.mint.slice(0, 5); ST.lastCopy = { w: t.wallet, sym, at: Date.now() };
    enter({ mint: t.mint, sym, src: "copy", wallet: t.wallet, srcSol: t.sol, size: riskSize("copy", t.sol, w.size), tEv: t.at - (t.lag || 0), c0: { vSol: t.vSol, vTok: t.vTok, mcap: t.mcap, complete: false }, reason: `KOPYA: ${lab(t.wallet)} ${fmt(t.sol, 3)} SOL aldı` }); }
  else if (C.cp.follow){ const p = posGet(t.mint); if (p && p.wallet === t.wallet) exit(t.mint, `KOPYA ÇIKIŞ: ${lab(t.wallet)} sattı (%${Math.round((t.frac || 1)*100)})`, t.at - (t.lag || 0)); } }
/* ------------------------- arm / disarm ------------------------- */
async function wake(on){ try { if (on && "wakeLock" in navigator && !ST.wake && !document.hidden){ ST.wake = await navigator.wakeLock.request("screen"); ST.wake.addEventListener("release", () => { ST.wake = null; }); } else if (!on && ST.wake){ await ST.wake.release(); ST.wake = null; } } catch(e){ ST.wake = null; } }
let hidAt = 0; document.addEventListener("visibilitychange", () => { if (document.hidden){ hidAt = Date.now(); return; } if (ST.on){ wake(true); if (hidAt && Date.now() - hidAt > 5000) tl("warn", `⚠ sayfa ${Math.round((Date.now() - hidAt)/1000)} sn arka plandaydı — bu sürede tarayıcı OTO'yu yavaşlatmış/durdurmuş olabilir`, "y"); } });
function sheetHTML(head, title, body, ok){ return `<div class="cf-mode real">${head}</div><div class="sheet-title">${title}</div>${body}<div class="sheet-btns"><button type="button" id="cf-no">İPTAL</button><button type="button" id="cf-ok" class="cf-ok real" ${ok ? "" : "disabled"}>${ok || "KABUL EDİYORUM"}</button></div>`; }
function riskSheet(){ return new Promise(res => { $("#cf-box").innerHTML = sheetHTML("⚠ GERÇEK PARA · TAM OTOMATİK<small>Bot, onay sormadan alıp satacak</small>", "GERÇEK MODDA OTO",
    `<div class="cf-warn">• pump.fun coinlerinin <b>büyük çoğunluğu kısa sürede sıfıra yakın değere düşer</b>; rug-pull, bot ve sandviç saldırıları yaygındır.<br>• Bot <b>BOT CÜZDANI</b>'ndaki gerçek SOL ile her işlemde onay sormadan alır ve satar (Phantom ana cüzdanın asla kullanılmaz).<br>• Ücretler (pump.fun ~%1.25, PumpPortal %0.5, öncelik ücreti, token hesabı kirası ~0.002 SOL) her işlemde kayıp yaratır. Kopyalanan cüzdan kâr etse bile sen ondan sonra girdiğin için zarar edebilirsin.<br>• SIM sonuçları geleceği göstermez; <b>kâr garantisi yoktur</b>. Yalnızca sayfa açık ve ön plandayken çalışır.</div><label class="chk"><input type="checkbox" id="rk-ok"> Okudum, anladım; kaybın tamamen bana ait.</label>`);
    const box = $("#confirm"); box.classList.remove("hidden"); const ok = $("#cf-ok"); $("#rk-ok").onchange = e => ok.disabled = !e.target.checked;
    const done = v => { box.classList.add("hidden"); $("#cf-box").innerHTML = ""; res(v); }; $("#cf-no").onclick = () => done(false); ok.onclick = () => done(true); }); }
function limitsErr(){ const e = []; if (!simFree()){ if (C.maxTrade < C.base) e.push("işlem başı max ≥ temel boyut olmalı"); if (C.budget < C.base) e.push("bütçe ≥ temel boyut"); if (C.dailyLoss > C.budget) e.push("günlük max zarar ≤ bütçe"); } if (!C.w.on && !C.cp.on) e.push("en az bir ajan (İzleyici ya da Kopyacı) açık olmalı"); return e; }
async function arm(silent){ if (ST.on) return true; if (RMT()){ if (!silent) NOTIFY.toast("SUNUCU eşli: OTO sunucuda çalışır — telefonda yerel OTO başlatılmaz", "bad"); return false; } const e = limitsErr(); if (e.length){ NOTIFY.toast("✖ " + e.join("; "), "bad"); return false; }
  if (isReal()){ if (!W().exists()){ NOTIFY.toast("✖ GERÇEK mod için önce BOT CÜZDANI oluştur (CÜZDAN sekmesi)", "bad"); return false; } if (!W().unlocked()){ NOTIFY.toast("✖ BOT CÜZDANI kilitli — CÜZDAN sekmesinde PIN ile aç", "bad"); return false; }
    if (!silent){ if (!C.acceptedReal){ if (!(await riskSheet())) return false; C.acceptedReal = true; save(); }
      if (!(await T().confirmSheet({ title: "GERÇEK OTO AL-SAT'I BAŞLAT", mode: "GERÇEK", rows: [["Cüzdan", "BOT " + short(W().pub())], ["Temel boyut", (C.cmp && C.cmp.on ? ("bileşik % " + C.cmp.pct + " × " + (R.cmpMult || 1) + "x → " + fmt(riskSize("watcher"), 3) + " SOL") : (C.base + " SOL × risk çarpanı " + R.mult + "x"))], ["İşlem başı max", C.maxTrade + " SOL"], ["Toplam bütçe", C.budget + " SOL"], ["Günlük max zarar", C.dailyLoss + " SOL", "dn"], ["Max açık pozisyon", String(C.maxPos)], ["Çıkış", C.x && C.x.on ? `dinamik: erken −%${C.x.early} · kısmi +%${C.x.ptp} · iz %${C.trail}/%${C.x.trailHi} · sert −%${C.sl} · ${C.holdMin} dk` : `+%${C.tp} / −%${C.sl} / iz %${C.trail} / ${C.holdMin} dk`], ["Alım kapısı", C.sc && C.sc.on ? `pump skoru ≥ ${C.sc.min}` : "kapalı (yalnızca filtreler)"], ["Ajanlar", `İzleyici ${C.w.on ? "açık" : "kapalı"} · Kopyacı ${C.cp.on ? COPY.list.filter(w => w.on !== false).length + " cüzdan" : "kapalı"}${C.gk.gate ? " · GROK onayı" : ""}`]], warn: "Bundan sonra bot bu limitler içinde <b>onay sormadan</b> alıp satar. ■ HEPSİNİ DURDUR her zaman ekranda.", okText: "ONAYLA · OTO BAŞLAT" }))) return false; } }
  ST.on = true; R = rLoad(C.mode); if (R.eqHigh === null){ R.eqHigh = equity(); rSave(); } X().keepWarm(true); if (!PUMP.live) PUMP.start(); if (COPY.list.length) COPY.open();
  for (const p of posList()) monitor(p.mint); wake(true); tl("arm", `▶ OTO BAŞLADI · <b>${C.mode}</b> · ${[C.w.on && "İzleyici", C.cp.on && "Kopyacı", C.gk.gate && "GROK onayı"].filter(Boolean).join(" + ")}`, "up");
  window.BUS && BUS.emit("state", { node: "bt", on: true }); afterToggle(); return true; }
function stop(reason){ if (!ST.on) return; ST.on = false; for (const [m, c] of ST.cands){ clearInterval(c.iv); unwatchCurve(m); FLOW.untrack(m); } ST.cands.clear(); if (!isReal()) X().keepWarm(false); wake(false);
  tl("stop", `■ OTO DURDU: ${esc(reason || "elle")}`, "dn"); if (reason && reason !== "elle kapatıldı") NOTIFY.ping("bad", "OTO durdu: " + reason); afterToggle(); }
function afterToggle(){ document.body.classList.toggle("meme-on", ST.on); fab(); paint(true); }
function fab(){ const f = $("#killfab"); if (f) f.classList.toggle("hidden", !(ST.on || (RMT() && REMOTE.on()) || (window.AUTO && (AUTO.bnOn() || AUTO.pumpOn())))); }
async function kill(){ if (RMT()) return REMOTE.kill(); const L = posList(); const r = await new Promise(res => { $("#cf-box").innerHTML = sheetHTML("■ HEPSİNİ DURDUR", "TÜM OTOMATİK İŞLEMLERİ DURDUR", `<div class="cf-warn">MEME OTO (izleyici + kopyacı) ve Binance OTO hemen kapanır.</div><label class="chk"><input type="checkbox" id="k-sell" ${L.length ? "" : "disabled"}> ${L.length} ${C.mode} pozisyonunu da piyasadan SAT</label>`, "DURDUR");
    const box = $("#confirm"); box.classList.remove("hidden"); const done = v => { const s = $("#k-sell"); const o = v && { s: s && s.checked }; box.classList.add("hidden"); $("#cf-box").innerHTML = ""; res(o); };
    $("#cf-no").onclick = () => done(null); $("#cf-ok").onclick = () => done(true); });
  if (!r) return; stop("HEPSİNİ DURDUR"); if (window.AUTO) AUTO.kill(false);
  if (r.s) for (const p of posList().slice()) await exit(p.mint, "HEPSİNİ DURDUR"); fab(); paint(true); }
async function setMode(m){ if (m === C.mode) return; if (ST.on){ NOTIFY.toast("Önce OTO'yu durdur", "bad"); return; }
  if (m === "GERÇEK"){ if (!W().exists()){ NOTIFY.toast("GERÇEK mod için önce CÜZDAN sekmesinden BOT CÜZDANI oluştur", "bad"); return; }
    if (!(await CONN.typedConfirm("GERÇEK MODA GEÇ", "Bundan sonra MEME motoru (oto ve elle) <b>BOT CÜZDANI'ndaki gerçek SOL</b> ile işlem yapar. SIM hesabın ve geçmişin saklanır.", "GERÇEK"))) return; }
  modeNow(m); }
function modeNow(m){ if (m === C.mode) return; if (ST.on) throw new Error("önce OTO'yu durdur"); if (m !== "SIM" && m !== "GERÇEK") throw new Error("mod SIM|GERÇEK"); if (m === "GERÇEK" && !W().exists()) throw new Error("sunucuda BOT CÜZDANI yok");
  for (const mint of [...ST.mons.keys()]) stopMon(mint); eqSave(); C.mode = m; save(); R = rLoad(m);
  try { EQ = JSON.parse(localStorage.getItem(EK(m)) || "[]"); MK = JSON.parse(localStorage.getItem(EK(m) + ".mk") || "[]"); } catch(e){ EQ = []; MK = []; }
  if (m === "GERÇEK"){ realBal(true).then(() => paint(true)); X().keepWarm(true); } else X().keepWarm(false); for (const p of posList()) monitor(p.mint);
  tl("mode", `MOD → <b>${m}</b>`, m === "GERÇEK" ? "dn" : "y"); render(); }
async function simReset(){ if (isReal()){ NOTIFY.toast("SIM sıfırlama yalnızca SIM modunda", "bad"); return; }
  if (ST.on){ NOTIFY.toast("Önce OTO'yu durdur", "bad"); return; }
  if (!(await CONN.typedConfirm("SIM HESABINI SIFIRLA", `SIM bakiyesi <b>${C.dep} SOL</b> sanal yatırıma döner; SIM pozisyonları, SIM eğrisi ve SIM risk durumu silinir (günlükteki SIM kayıtları kalır).`, "SIFIRLA"))) return;
  simResetNow(); }
/* v7.7: SIM start = the BOT CÜZDANI SOL balance, read from the public address (no unlock, nothing signed); fallback 0.212 SOL */
async function realWalletSol(){ if (!W() || !W().exists() || !W().pub()) return null; /* below 0.01 SOL (RANGE.dep min) the wallet cannot trade → use the fallback */
  for (let i = 0; i < 3; i++){ try { const b = await W().solBal(); if (isFinite(b)) return b >= 0.01 && b <= 10000 ? +b.toFixed(6) : null; } catch(e){} await new Promise(r => setTimeout(r, 700)); } return null; }
async function simToReal(){ if (isReal()){ NOTIFY.toast("yalnızca SIM modunda", "bad"); return; }
  if (ST.on){ NOTIFY.toast("Önce OTO'yu durdur", "bad"); return; }
  const b = await realWalletSol(), dep = b || SIM_FALLBACK;
  if (!(await CONN.typedConfirm("SIM = GERÇEK BAKİYE", `SIM sanal bakiyesi <b>${fmt(dep, 4)} SOL</b> olur (${b ? "BOT CÜZDANI'nın şu anki SOL bakiyesi" : "cüzdan okunamadı → son gerçek bakiye 0.212 SOL"}). SIM pozisyonları, SIM eğrisi ve SIM risk durumu silinir (günlükteki SIM kayıtları kalır). Ayarlar ve limitler GERÇEK ile aynıdır.`, "SIFIRLA"))) return;
  C.dep = dep; save(); simResetNow(); }
async function mig77Sync(){ if (localStorage.getItem("neon.meme.sim77") !== "1") return; const b = await realWalletSol(); localStorage.removeItem("neon.meme.sim77");
  if (b && !ST.on && !SIM.n && !SIM.pos.length && Math.abs(b - C.dep) > 1e-6){ C.dep = b; save(); SIM = simNew(b); simSave(); tl("mode", `v7.7: SIM bakiyesi BOT CÜZDANI ile eşlendi · ${fmt(b, 4)} SOL`, "y"); render(); } }
function simResetNow(){ if (ST.on && !isReal()) throw new Error("önce OTO'yu durdur");
  for (const p of SIM.pos) stopMon(p.mint); SIM = simNew(C.dep); simSave(); localStorage.removeItem(RK("SIM")); localStorage.removeItem(EK("SIM")); localStorage.removeItem(EK("SIM") + ".mk");
  if (!isReal()){ R = rLoad("SIM"); EQ = []; MK = []; } tl("mode", `SIM sıfırlandı · sanal yatırım ${fmt(C.dep, 4)} SOL · GERÇEK ayarları`, "y"); render(); }
/* manual trade through the engine (always ONAYLA) */
async function manual(mint, action, opt = {}){ const t = PUMP.get(mint), sym = (t && t.symbol) || opt.sym || short(mint);
  if (action === "buy"){ const size = +(opt.sol || C.base); if (!(size > 0) || (!simFree() && size > C.maxTrade)){ NOTIFY.toast(simFree() ? "Miktar 0'dan büyük olmalı" : `Miktar 0–${C.maxTrade} SOL (işlem başı max)`, "bad"); return; }
    const why = riskCheck(size, mint); if (why){ NOTIFY.toast("✖ " + why, "bad"); return; }
    if (!(await T().confirmSheet({ title: (isReal() ? "" : "SIM · ") + "AL · MEME MOTORU", mode: isReal() ? "GERÇEK" : "SIM", rows: [["Mod", C.mode, isReal() ? "dn" : ""], ["Token", sym + " · " + short(mint)], ["Miktar", size + " SOL"], ["Kayma / öncelik", `%${C.slip} / ${C.prio} SOL`], ["Rug riski", t ? t.risk + " / 100" : "—"], ["Kaynak", opt.src === "grok" ? "GROK önerisi" : "elle"]], warn: isReal() ? "BOT CÜZDANI imzalar ve hemen gönderir. Geri alınamaz." : "SIM: gerçek işlem gönderilmez; canlı fiyatla sanal dolum.", okText: "ONAYLA · AL" }))) return;
    return enter({ mint, sym, src: opt.src || "manual", manual: true, size, tEv: performance.now(), curve: t && t.curve, reason: opt.src === "grok" ? "GROK önerisi (onaylandı)" : "elle" }); }
  const p = posGet(mint); if (!p){ NOTIFY.toast("Bu tokenda açık pozisyon yok", "bad"); return; }
  if (!(await T().confirmSheet({ title: (isReal() ? "" : "SIM · ") + "SAT · MEME MOTORU", mode: isReal() ? "GERÇEK" : "SIM", rows: [["Token", p.sym], ["Miktar", "%100 · " + fmt(p.tokens, 0)], ["Maliyet", fmt(p.solIn, 4) + " SOL"], ["Tahmini değer", fmt(posVal(p), 4) + " SOL"]], okText: "ONAYLA · SAT" }))) return;
  return exit(mint, opt.src === "grok" ? "GROK önerisi (onaylandı)" : "elle satış"); }
/* ------------------------- context for GROK ------------------------- */
function gateInfo(o){ const t = PUMP.get(o.mint) || {}, m = t.meta || {}; const c = curveOf(o.mint) || o.c0 || {};
  return { sym: o.sym, name: t.name, mint: o.mint, src: o.src, copiedWallet: o.wallet ? lab(o.wallet) : null, walletBuySol: o.srcSol, mcapSol: c.mcap ? +c.mcap.toFixed(1) : null, ageSec: t.at ? Math.round((Date.now() - t.at)/1000) : null, devPct: t.devPct ? +t.devPct.toFixed(1) : null, devSol: t.devSol, rug: t.risk, rugFactors: (t.riskF || []).map(f => f[1]).slice(0, 5), socials: { x: !!m.tw, tg: !!m.tg, web: !!m.web }, desc: (m.desc || "").slice(0, 160) }; }
function context(){ if (RMT() && REMOTE.ctx()) return REMOTE.ctx(); const e = equity(), d = depBase(); const J = JOURNAL.list().filter(x => x.venue === "pump.fun" && x.wallet === walletTag()).slice(-12); const s = X().stats();
  const sel = PUMP._S.sel; return { time: new Date().toLocaleString("tr-TR", { timeZone: TZ }), mode: C.mode, autoOn: ST.on, equitySol: e && +e.toFixed(4), depositSol: d, sinceDepositPct: e && d ? +((e/d - 1)*100).toFixed(2) : null, todayPnlSol: +todayPnl().toFixed(4), solUsd: PUMP.solUsd,
    risk: { mult: R.mult, consecLoss: R.consec, pausedUntil: R.pauseUntil > Date.now() ? tm(R.pauseUntil) : null, equityHigh: R.eqHigh, wins: R.wins, losses: R.losses, cmpMult: R.cmpMult || 1 },
    settings: { base: C.base, maxTrade: C.maxTrade, budget: C.budget, dailyLoss: C.dailyLoss, maxPos: C.maxPos, tp: C.tp, sl: C.sl, trail: C.trail, holdMin: C.holdMin, slip: C.slip, prio: C.prio, w: C.w, sc: C.sc, x: C.x, cp: C.cp, rules: C.rules, gk: C.gk, cmp: C.cmp, fx: C.fx, goal: C.goal },
    positions: posList().map(p => { const mo = ST.mons.get(p.mint) || {}; return { sym: p.sym, mint: p.mint, src: p.src, costSol: +(+p.solIn).toFixed(4), valueSol: mo.val ? +mo.val.toFixed(4) : null, pnlPct: isFinite(mo.pnl) && mo.pnl !== null ? +mo.pnl.toFixed(1) : null, ageMin: Math.round((Date.now() - p.t)/60000) }; }),
    lastTrades: J.map(x => ({ sym: x.sym, src: x.src, in: x.in, out: x.out, pnlPct: x.pnlPct, reason: x.reason, at: tm(x.openT) })),
    trackedWallets: COPY.list.map(w => { const st = COPY.stat(w.addr); return { label: w.label, addr: w.addr, on: w.on !== false, sessionTrades: st.n, buys: st.buys, sells: st.sells, solIn: +st.solIn.toFixed(3), solOut: +st.solOut.toFixed(3) }; }),
    agents: { watcherSeen: ST.seen, watcherPassed: ST.passed, candidates: ST.cands.size, entered: ST.entered, avgEventToSentMs: s.ev2sent && Math.round(s.ev2sent), avgSentToConfMs: s.sent2conf && Math.round(s.sent2conf), execFails: s.fail },
    newTokensPerMin: PUMP._S.rate.length, selectedToken: sel ? gateInfo({ mint: sel.mint, sym: sel.symbol, src: "seçili" }) : null }; }
function applySuggestion(a){ if (RMT()) return REMOTE.apply(a); try {
  if (a.type === "set"){ const v = setP(a.key, a.value); tl("grok", `GROK önerisi uygulandı: <b>${esc(a.key)}</b> = ${esc(v)}`, "y"); render(); return `✔ ${a.key} = ${v}`; }
  if (a.type === "buy"){ if (!a.mint || !COPY.valid(a.mint)) throw new Error("geçersiz mint"); manual(a.mint, "buy", { sol: Math.min(+a.sol || C.base, C.maxTrade), src: "grok" }); return "ONAY ekranı açıldı"; }
  if (a.type === "sell"){ manual(a.mint, "sell", { src: "grok" }); return "ONAY ekranı açıldı"; }
  if (a.type === "track"){ COPY.add(a.wallet, a.label); paintWallets(); return "✔ takibe alındı"; }
  if (a.type === "untrack"){ COPY.del(a.wallet); paintWallets(); return "✔ takipten çıkarıldı"; }
  if (a.type === "pause"){ const m = Math.max(1, Math.min(1440, +a.min || 30)); R.pauseAt = Date.now(); R.pauseUntil = R.pauseAt + m*60000; rSave(); tl("risk", `GROK önerisi: ${m} dk ara`, "y"); return `✔ ${m} dk ara`; }
  if (a.type === "stop"){ stop("GROK önerisi (onaylandı)"); return "✔ OTO durdu"; }
  throw new Error("bilinmeyen öneri türü: " + a.type); } catch(e){ return "✖ " + e.message; } }
/* ------------------------- goal bar + effects ------------------------- */
function usdNow(){ const e = equity(), su = PUMP.solUsd; return e !== null && su ? e*su : null; }
function goalEnsure(){ if (!C.goal) C.goal = { targetUsd: 2000, startUsd: null, startAt: null };
  if (C.goal.startUsd == null || !C.goal.startAt){ const u = usdNow(); if (u !== null){ if (C.goal.startUsd == null) C.goal.startUsd = +u.toFixed(2); if (!C.goal.startAt) C.goal.startAt = Date.now(); save(); const inp = document.querySelector('[data-m="goal.startUsd"]'); if (inp && !inp.matches(":focus")) inp.value = C.goal.startUsd; } } }
function goalRestart(){ const u = usdNow(); C.goal = C.goal || { targetUsd: 2000 }; if (u !== null) C.goal.startUsd = +u.toFixed(2); C.goal.startAt = Date.now(); save(); const inp = document.querySelector('[data-m="goal.startUsd"]'); if (inp) inp.value = C.goal.startUsd ?? ""; paintGoal(); }
function durLab(ms){ ms = Math.max(0, ms|0); const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000); return h >= 1 ? (h + " sa " + m + " dk") : (m + " dk"); }
function paintGoal(){ const box = $("#mm-goal"); if (!box) return; goalEnsure(); const g = C.goal, u = usdNow(), tgt = +g.targetUsd || 2000, st = g.startUsd;
  const nowEl = $("#mm-goal-now"), pctEl = $("#mm-goal-pct"), tgtEl = $("#mm-goal-tgt"), fill = $("#mm-goal-fill"), mult = $("#mm-goal-mult"), tEl = $("#mm-goal-t");
  if (tgtEl) tgtEl.textContent = "$" + tgt.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
  if (u === null){ if (nowEl) nowEl.textContent = "—"; if (pctEl) pctEl.textContent = "SOL fiyatı bekleniyor"; if (mult) mult.textContent = ""; if (fill) fill.style.width = "0%"; if (tEl) tEl.textContent = g.startAt ? "24s pencere başladı" : "pencere, bakiye görününce başlar"; return; }
  if (nowEl) nowEl.textContent = "$" + u.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const span = Math.max(1e-9, tgt - (st == null ? u : +st)), done = u - (st == null ? u : +st);
  const pct = Math.max(0, Math.min(100, done/span*100));
  if (pctEl) pctEl.textContent = (u >= tgt ? "hedefe ulaşıldı" : pct.toFixed(1).replace(/\.0$/, "") + "%");
  if (fill){ fill.style.width = pct.toFixed(2) + "%"; fill.classList.toggle("hot", pct >= 80); }
  if (mult) mult.textContent = u >= tgt ? "hedefe ulaşıldı" : u > 0 ? "×" + (tgt/u).toFixed(1) + " gerekli" : "—";
  if (tEl){ if (!g.startAt) tEl.textContent = "24s pencere henüz başlamadı"; else { const end = g.startAt + 24*3600000, left = end - Date.now(), elap = Date.now() - g.startAt;
      tEl.textContent = left > 0 ? ("24s pencere: " + durLab(elap) + " geçti · " + durLab(left) + " kaldı") : (u >= tgt ? "24s doldu · hedefe ulaşıldı" : "24s doldu · hedefe ulaşılamadı (garanti değil)"); } } }
function fxMute(){ const n = document.getElementById("nt-snd"); if (n && !n.checked) return true; return !(C.fx && C.fx.sound !== false); }
function fxReduce(){ return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }
function fxLayer(){ return document.getElementById("mm-fx"); }
let fxAc = null;
function fxBoom(){ if (fxMute() || fxReduce()) return; try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; fxAc = fxAc || new AC(); if (fxAc.state === "suspended") fxAc.resume(); const t0 = fxAc.currentTime, o = fxAc.createOscillator(), g = fxAc.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.22); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.018); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3); o.connect(g); g.connect(fxAc.destination); o.start(t0); o.stop(t0 + 0.32); } catch(e){} }
function fxBurst(){ const layer = fxLayer(); if (!layer || fxReduce()) return; const cols = ["#39ff14", "#00f0ff", "#ffe600", "#ff2bd6", "#fff"]; const n = 28, cx = innerWidth/2, cy = innerHeight*0.38;
  for (let i = 0; i < n; i++){ const d = document.createElement("i"); d.className = "mm-dot"; const ang = (Math.PI*2*i)/n + Math.random()*0.4, dist = 70 + Math.random()*140;
    d.style.setProperty("--x", cx + "px"); d.style.setProperty("--y", cy + "px"); d.style.setProperty("--dx", Math.cos(ang)*dist + "px"); d.style.setProperty("--dy", Math.sin(ang)*dist + "px"); d.style.setProperty("--c", cols[i%cols.length]); layer.appendChild(d); setTimeout(() => d.remove(), 900); } }
function fxPop(txt){ const layer = fxLayer(); if (!layer) return; const el = document.createElement("div"); el.className = "mm-pop"; el.textContent = txt; layer.appendChild(el); setTimeout(() => el.remove(), fxReduce() ? 1400 : 1000); }
function fxWin(sol, sym){ if (!fxReduce()){ document.body.classList.add("mm-shake"); setTimeout(() => document.body.classList.remove("mm-shake"), 450); fxBurst(); } fxPop((sol >= 0 ? "+" : "") + fmt(sol, 4) + " SOL" + (sym ? " · " + sym : "")); fxBoom(); }
function fxBuy(){ if (fxReduce()) return; document.body.classList.add("mm-pulse"); setTimeout(() => document.body.classList.remove("mm-pulse"), 380); }
function fxLoss(){ document.body.classList.add("mm-flash-loss"); setTimeout(() => document.body.classList.remove("mm-flash-loss"), 420); }
/* ------------------------- UI ------------------------- */
const AG = (id, ic, name, col) => `<div class="ag" id="ag-${id}" style="--ac:${col}"><div class="ag-h"><span class="ag-ic">${ic}</span><b>${name}</b><span class="ag-st" id="ags-${id}">—</span></div><div class="ag-b" id="agb-${id}"></div></div>`;
const inp = (p, lab) => `<label>${lab}<input data-m="${p}" inputmode="decimal" value="${esc(getP(p))}"></label>`;
const chk = (p, lab) => `<label class="chk"><input type="checkbox" data-m="${p}" ${getP(p) ? "checked" : ""}> ${lab}</label>`;
function goalHTML(){ const g = C.goal || {};
  return `<div class="mm-goal" id="mm-goal">
    <div class="mm-goal-h"><span class="mm-goal-lab">hedef · garanti değil</span><b id="mm-goal-mult"></b><button type="button" class="mini" id="mm-goal-tog" aria-expanded="false">düzenle</button></div>
    <div class="mm-goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-labelledby="mm-goal-pct"><div class="mm-goal-fill" id="mm-goal-fill"></div></div>
    <div class="mm-goal-m"><span id="mm-goal-now">—</span><span id="mm-goal-pct">—</span><span id="mm-goal-tgt">$${(g.targetUsd || 2000).toLocaleString("tr-TR")}</span></div>
    <div class="mm-goal-t" id="mm-goal-t"></div>
    <form class="mm-goal-ed hidden" id="mm-goal-ed">
      <div class="f3"><label>Başlangıç $<input data-m="goal.startUsd" inputmode="decimal" value="${g.startUsd == null ? "" : esc(g.startUsd)}"></label><label>Hedef $<input data-m="goal.targetUsd" inputmode="decimal" value="${esc(g.targetUsd || 2000)}"></label><button type="button" class="mini wide" id="mm-goal-reset" style="align-self:end">24s penceriyi baştan al</button></div>
      <div class="plan-foot">Başlangıç, hedefi kurduğun andaki bakiyedir. 24 saatlik süre yalnızca göstergedir, botu durdurmaz. Bu bir kâr hedefidir, <b>garanti değildir</b>.</div>
    </form></div>`;
}
function html(){ const real = isReal(), ex = X().C;
  return `${goalHTML()}
    <div class="mm-bar"><div class="seg" role="group" aria-label="Mod"><button type="button" data-mode="SIM" class="${real ? "" : "on"}">SIM</button><button type="button" data-mode="GERÇEK" class="${real ? "on real" : ""}">GERÇEK</button></div>
      <button type="button" id="mm-arm" class="arm ${ST.on ? "on" : ""}">${ST.on ? "■ OTO DURDUR" : "▶ OTO BAŞLAT"}</button></div>
    ${real ? "" : `<div class="mm-simquick"><button type="button" id="mm-simreal" class="mini wide">SIM = GERÇEK BAKİYE</button><small class="mm-simnote">SIM, GERÇEK ile aynı ayar ve limitlerle çalışır · yalnızca para sanal</small></div>`}
    <div class="mm-hero"><canvas id="orb" aria-hidden="true"></canvas><div class="mm-bal"><div class="mm-badges"><span class="mode-badge ${real ? "real" : "sim"}">${real ? "⚠ GERÇEK" : "SIM · GERÇEK AYARLAR"}</span><span id="mm-auto" class="pill"></span><span id="mm-cmpb" class="pill mm-cmp-pill${C.cmp && C.cmp.on ? "" : " hidden"}">BİLEŞİK</span></div>
      <div class="mm-big"><span id="mm-eq">—</span><small>SOL</small></div><div class="mm-usd" id="mm-usd"></div><div class="mm-dep" id="mm-dep"></div></div></div>
    <div class="mm-kpis" id="mm-kpis"></div>
    <div class="sub-h">AÇIK POZİSYONLAR <small id="mm-posn"></small></div><div id="mm-pos" class="pos-list"></div>
    <div class="sub-h">SON İŞLEMLER</div><div id="mm-tape" class="mm-tape"></div>
    <div class="sub-h">AJANLAR <small>dokun → ayrıntı · emir yalnızca YÜRÜTÜCÜ'den, RİSK kontrolüyle</small></div>
    <div class="ags compact" id="mm-ags">${AG("w", "👁", "İZLEYİCİ", "#00f0ff")}${(window.AGENTS ? AGENTS.CARDS : []).map(c => AG(...c)).join("")}${AG("r", "⛨", "RİSK", "#39ff14")}${AG("x", "⚡", "YÜRÜTÜCÜ", "#ffe600")}${AG("c", "🔁", "KOPYACI", "#ff2bd6")}</div>
    <details class="mm-adv keys" id="mm-adv"><summary>Gelişmiş</summary>
    <div class="mm-eqc"><div class="sub-h">HESAP EĞRİSİ <small>▲ alış · ▼ satış · ◆ risk</small></div><canvas id="mm-eqcv"></canvas></div>
    <div class="sub-h">BU GECE <small>zaman çizelgesi</small></div><div id="mm-tl" class="mm-tl"></div>
    <div class="sub-h">ÖNCE HESABI KORU, SONRA BÜYÜT</div><div class="ladder" id="mm-lad"></div>
    <div class="rules">${chk("rules.half", "Kayıptan sonra boyutu yarıya indir")}${chk("rules.pause2", "2 kayıp üst üste → ara ver")}${chk("rules.upHigh", "Boyutu yalnızca yeni hesap zirvesinde büyüt")}${inp("rules.pauseMin", "Ara süresi (dk)")}</div>
    <div class="sub-h">BİLEŞİK GETİRİ</div>
    ${chk("cmp.on", "Bileşik açık (kazanınca girişi büyüt)")}
    <div class="f2">${inp("cmp.pct", "Bileşik giriş %")}${inp("cmp.winX", "Kazanınca ×")}</div>
    ${chk("fx.sound", "kazanınca bumbum sesi")}
    <div class="plan-foot">Açıkken işlem boyutu = güncel bakiye × giriş %. Her kazançta çarpan, “kazanınca ×” kadar artar (en fazla 2); kayıpta 1'e döner. Üstüne işlem başı max, bütçe, nakit (ücret payı düşülerek) ve risk merdiveni (kayıpta yarı, 2 kayıpta ara) uygulanır. Kâr garantisi yoktur; kayıplar da büyür.</div>
    <div class="sub-h">TAKİP EDİLEN CÜZDANLAR <small id="mm-cpst"></small></div>
    <div class="f2"><label>Cüzdan adresi<input id="cp-addr" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Solana adresi"></label><label>Etiket<input id="cp-lab" autocomplete="off" placeholder="ör. balina1"></label></div>
    <div class="f2"><button type="button" id="cp-add" class="mini wide">+ TAKİBE AL</button><button type="button" id="cp-disc" class="mini wide">🔎 EN AKTİF CÜZDANLAR (12 sn)</button></div>
    <div id="cp-disc-res"></div><div id="mm-wal" class="wals"></div>
    <div class="sub-h">GECİKME <small>olay → gönderim · gönderim → onay</small></div><div id="mm-lat" class="lat"></div>
    <button type="button" id="mm-probe" class="mini wide">⏱ GECİKME TESTİ (hiçbir şey gönderilmez)</button><div id="mm-probe-res" class="kv"></div>
    <details class="keys"><summary>⚙ BOYUT · LİMİTLER · ÇIKIŞ</summary>
      <div class="f3">${inp("base", "Temel boyut SOL")}${inp("maxTrade", "İşlem başı max SOL")}${inp("budget", "Toplam bütçe SOL")}</div>
      <div class="f3">${inp("dailyLoss", "Günlük max zarar SOL")}${inp("maxPos", "Max açık poz.")}${inp("holdMin", "Max tutma dk")}</div>
      <div class="f3">${inp("tp", "Tam kâr al +%")}${inp("sl", "Sert zarar kes −%")}${inp("trail", "İz süren stop % (0=kapalı)")}</div>
      <div class="plan-foot">Dinamik çıkış açıkken: “tam kâr al” kalan pozisyonun tavanıdır, iz süren stop zirve +%${esc(C.x.trailSw)} altındayken geçerlidir (üstünde %${esc(C.x.trailHi)}). Ayrıntılar aşağıda “📉 DİNAMİK ÇIKIŞ”ta.</div></details>
    <details class="keys" id="mm-x-d"><summary>📉 DİNAMİK ÇIKIŞ</summary>${chk("x.on", "Dinamik çıkış açık (kapalıysa yalnızca kâr al / zarar kes / iz / süre)")}
      <div class="f3">${inp("x.early", "Erken stop −%")}${inp("x.earlySec", "Erken stop: ilk sn")}${inp("x.momFail", "Momentum yok −%")}</div>
      <div class="f3">${inp("x.be", "Başa baş: zirve ≥ +%")}${inp("x.ptp", "Kısmi kâr +%")}${inp("x.ptpPct", "Kısmi satış %")}</div>
      <div class="f3">${inp("x.trailHi", "Sıkı iz %")}${inp("x.trailSw", "Sıkı iz: zirve ≥ +%")}${inp("x.flatMin", "Yatay çıkış dk (0=kapalı)")}</div>
      <div class="f3">${chk("x.rev", "Akış dönünce sat")}${inp("x.revSec", "Akış penceresi sn")}${chk("x.simHc", "SIM kayma payı")}</div>
      <div class="plan-foot">Sıra: sert zarar kes → erken stop (ilk ${esc(C.x.earlySec)} sn içinde −%${esc(C.x.early)}) → momentum yok (ilk dakikada +%${esc(C.x.momUp)} görmeden −%${esc(C.x.momFail)}) → dev sattı / en büyük alıcı boşaltıyor → akış döndü (son ${esc(C.x.revSec)} sn satıcılar baskın) → tam kâr al → kısmi kâr (+%${esc(C.x.ptp)}'te %${esc(C.x.ptpPct)} sat) → iz süren stop (zirveden %${esc(C.trail)}, zirve +%${esc(C.x.trailSw)} üstünde %${esc(C.x.trailHi)}) → başa baş (zirve +%${esc(C.x.be)} olduysa +%${esc(C.x.beLock)}'e düşünce sat) → yatay (${esc(C.x.flatMin)} dk yeni zirve yok ve +%${esc(C.x.flatBand)} altı) → max tutma → mezun. pump.fun'da fiyat çok hızlı düşebilir; satış stop seviyesinin altında dolabilir. SIM kayma payı: her dolumda %1 + son 3 sn'deki hareketin yarısı (en fazla %15) düşülür.</div></details>
    <details class="keys" id="mm-sc-d"><summary>🎯 PUMP SKORU · alım kararı</summary>${chk("sc.on", "Skor kapısı açık (skor ≥ eşik olmadan alma)")}${chk("sc.learn", "Öğrenme: OTO kapalıyken de puanla, “ALIRDI” kaydet (hiçbir şey alınmaz)")}
      <div class="f3">${inp("sc.min", "Skor eşiği 0–100")}${inp("sc.minBuyers", "Min alıcı (dev hariç)")}${inp("sc.maxTop", "Tek cüzdan ≤ % alım")}</div>
      <div class="plan-foot">Bekleme süresi boyunca tokenın tüm işlemleri okunur (Solana RPC logsSubscribe, anahtarsız). Ağırlıklar: alıcı sayısı ${SCORE.W.buyers} · alım/satım sayısı ${SCORE.W.ratio} · net SOL girişi ${SCORE.W.inflow} · dağılım (en büyük cüzdan payı) ${SCORE.W.conc} · hız (mcap eğimi) ${SCORE.W.vel} · zirveden düşüş ${SCORE.W.dd} · temizlik (paket/sniper, aynı boyut) ${SCORE.W.clean} = 100. Hemen elenir: dev sattı · alıcı < min · tek cüzdan > eşik · ilk 2 sn'de ≥4 cüzdan alımların yarısından fazlası (paket/sniper) · aynı SOL boyutunda tekrarlı alım · zirveden %25+ düşüş · net giriş yok · cüzdan verisi okunamadı (yalnızca curve). Eski filtreler ön filtre olarak kalır. Skor bir olasılık göstergesidir, kâr garantisi değildir.</div>
      <div id="mm-sc-st" class="mm-scst"></div></details>
    ${window.AGENTS ? AGENTS.settingsHTML() : ""}
    <details class="keys"><summary>👁 İZLEYİCİ filtreleri</summary>${chk("w.on", "İzleyici açık (yeni token girişleri)")}
      <div class="f3">${inp("w.minInit", "Min dev alımı SOL")}${inp("w.minMcap", "Min mcap SOL")}${inp("w.maxMcap", "Max mcap SOL")}</div>
      <div class="f3">${inp("w.maxDev", "Dev payı ≤ %")}${inp("w.maxRisk", "Rug riski ≤")}${inp("w.waitSec", "Bekle sn")}</div>
      <div class="f2">${inp("w.minMom", "Momentum ≥ %")}${chk("w.needSoc", "sosyal hesap şart")}</div>
      <div class="plan-foot">Yeni token ilk filtreleri geçerse bekleme süresi boyunca bonding curve ve tüm işlemleri canlı izlenir; sonunda momentum ≥ eşik, risk ≤ eşik, zirveden %20'den az düşmüş ve <b>PUMP SKORU</b> ≥ eşikse RİSK ajanının boyutuyla alınır.</div></details>
    <details class="keys"><summary>🔁 KOPYACI</summary>${chk("cp.on", "Kopyacı açık")}${chk("cp.follow", "Cüzdan satınca biz de satalım (aynı çıkış)")}
      <div class="f3">${inp("cp.minSrc", "Min kaynak alımı SOL")}${inp("cp.maxMcap", "Max mcap SOL")}${inp("cp.cool", "Aynı token bekleme sn")}</div>
      <div class="f3">${inp("cp.max10", "Cüzdan başı 10 dk max")}<label>Boyut<select data-m="cp.sizeMode"><option value="fixed" ${C.cp.sizeMode === "fixed" ? "selected" : ""}>sabit</option><option value="ratio" ${C.cp.sizeMode === "ratio" ? "selected" : ""}>oran×kaynak</option></select></label>${inp("cp.ratio", "Oran")}</div>
      <div class="plan-foot">Anahtarsız: Solana RPC WebSocket <b>logsSubscribe</b> ile cüzdanın pump.fun bonding-curve işlemleri ~anında görülür (TradeEvent çözülür, fiyat olaydan gelir). Genel RPC'de WS bazen sessiz kalıyor; o zaman cüzdan HTTP ile 2.5 sn'de bir yoklanır (~1–3 sn gecikme). Kendi WS'ini (Helius vb.) girersen en hızlısı. PumpPortal'ın hesap akışı (subscribeAccountTrade) 0.02 SOL yüklü anahtar istiyor — doğrulandı. PumpSwap/Raydium işlemleri kopyalanmaz. Çıkışta TP/SL/süre kuralları da geçerli.</div></details>
    <details class="keys"><summary>⚡ YÜRÜTÜCÜ · hız</summary>
      <div class="f2">${inp("slip", "Kayma %")}${inp("prio", "Öncelik ücreti SOL")}</div>
      <label>Özel RPC (HTTPS, ör. Helius — ilk sırada, paralel)<input data-x="rpc" value="${esc(ex.rpc)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://mainnet.helius-rpc.com/?api-key=…"></label>
      <label>Özel WebSocket (onay + kopya akışı)<input data-x="ws" value="${esc(ex.ws)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="wss://…"></label>
      <div class="f2"><label class="chk"><input type="checkbox" data-x="fan" ${ex.fan ? "checked" : ""}> tüm RPC'lere paralel gönder</label><label class="chk"><input type="checkbox" data-x="skipPre" ${ex.skipPre ? "checked" : ""}> skipPreflight</label></div>
      <div class="f2"><label class="chk"><input type="checkbox" data-x="jito" ${ex.jito ? "checked" : ""}> Jito paketi (işlem + bahşiş)</label><label>Jito bahşişi SOL<input data-x="tip" inputmode="decimal" value="${esc(ex.tip)}"></label></div>
      <div class="f2"><label>SIM gecikme modeli ms<input data-x="simDelay" inputmode="decimal" value="${esc(ex.simDelay)}"></label><label class="chk"><input type="checkbox" data-x="dryPipe" ${ex.dryPipe ? "checked" : ""}> SIM'de gerçek hattı ölç (hazırla + imzala, GÖNDERME)</label></div>
      <div class="plan-foot">Blockhash ~2 sn'de bir önbelleğe alınır; anahtar oturum boyunca bellekte açık kalır; adaylar ve açık pozisyonlar için işlem önceden hazırlanır (≤35 sn); imzalı işlem tüm RPC'lere (+ isteğe bağlı Jito) aynı anda gider; onay WebSocket ile beklenir.</div></details>
    <details class="keys"><summary>🤖 GROK onayı (oto alımdan önce)</summary>${chk("gk.gate", "Her oto alımdan önce GROK'a evet/hayır sor")}
      <div class="f2">${inp("gk.timeout", "Zaman aşımı ms")}<label>Cevap gelmezse<select data-m="gk.fallback"><option value="rules" ${C.gk.fallback === "rules" ? "selected" : ""}>kurallarla devam</option><option value="deny" ${C.gk.fallback === "deny" ? "selected" : ""}>alma</option></select></label></div>
      <div class="plan-foot">GROK sekmesinde xAI anahtarın kayıtlı olmalı. GROK işlem açamaz; yalnızca bu kapıda "hayır" diyebilir.</div></details>
    <details class="keys"><summary>◎ SIM hesabı · otomatik başlat</summary>
      <div class="f2">${inp("dep", "SIM sanal yatırım SOL")}<button type="button" id="mm-simreset" class="mini wide s" style="align-self:end">SIM'İ SIFIRLA</button></div>
      ${real ? "" : `<button type="button" id="mm-simreal-b" class="mini wide">SIM = GERÇEK BAKİYE</button>`}
      <label class="chk real-chk"><input type="checkbox" id="mm-autostart" ${C.autoStart ? "checked" : ""}> ⚠ otomatik başlat <small>(sayfa açılınca OTO kendiliğinden başlar; GERÇEK modda BOT CÜZDANI kilidini açtığın an)</small></label>
      <div class="plan-foot">SIM = GERÇEK BAKİYE: sanal bakiyeyi BOT CÜZDANI'nın SOL bakiyesine eşler (adres herkese açık RPC ile okunur, kilit açılmaz; okunamazsa 0.212 SOL). SIM; filtreler, pump skoru, çıkışlar, bileşik, işlem başı max, bütçe, günlük zarar, max pozisyon, kayıpta yarı boyut ve 2 kayıpta ara dahil GERÇEK ile <b>aynı</b> kuralları uygular. Fark yalnızca dolumların sanal olmasıdır (+ hızlı harekette dolum kesintisi).</div></details>
    <div class="plan-foot">SIM: gerçek canlı piyasa verisi (PumpPortal + Solana RPC), gerçekçi dolum (bonding curve, gecikme sonrası fiyat, pump.fun %1.25 + PumpPortal %0.5 + öncelik + ağ ücreti + token hesabı kirası), hiçbir işlem gönderilmez. GERÇEK: BOT CÜZDANI. Sayfa yenilenince OTO <b>kapalı</b> başlar (otomatik başlat açık değilse). Yatırım tavsiyesi değildir.</div></details>`; }

function bind(){ const box = $("#meme-box");
  box.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $("#mm-arm").onclick = async () => { if (ST.on) stop("elle kapatıldı"); else await arm(); };
  box.querySelectorAll("[data-m]").forEach(i => i.addEventListener("change", () => { try { setP(i.dataset.m, i.type === "checkbox" ? i.checked : i.value); if (i.dataset.m === "dep" && !isReal() && !SIM.n && !SIM.pos.length){ SIM = simNew(C.dep); simSave(); } if (i.dataset.m === "cmp.on"){ const b = $("#mm-cmpb"); if (b) b.classList.toggle("hidden", !C.cmp.on); } if (i.dataset.m && i.dataset.m.startsWith("goal.")) paintGoal(); paint(true); } catch(e){ NOTIFY.toast("✖ " + e.message, "bad"); if (i.type === "checkbox") i.checked = !!getP(i.dataset.m); else i.value = getP(i.dataset.m); } }));
  box.querySelectorAll("[data-x]").forEach(i => i.addEventListener("change", () => { const k = i.dataset.x; let v = i.type === "checkbox" ? i.checked : i.value.trim();
    if (k === "rpc" && v && !/^https:\/\//.test(v)){ NOTIFY.toast("RPC https:// ile başlamalı", "bad"); return; } if (k === "ws" && v && !/^wss:\/\//.test(v)){ NOTIFY.toast("WS wss:// ile başlamalı", "bad"); return; }
    if (k === "tip"){ v = +v.replace(",", "."); if (!(v >= 0.00001 && v <= 0.01)){ NOTIFY.toast("Jito bahşişi 0.00001–0.01 SOL", "bad"); return; } } if (k === "simDelay"){ v = +v; if (!(v >= 150 && v <= 10000)){ NOTIFY.toast("150–10000 ms", "bad"); return; } }
    X().set({ [k]: v }); NOTIFY.toast("Kaydedildi", "good"); }));
  $("#mm-autostart").onchange = async e => { if (e.target.checked){ const ok = await CONN.typedConfirm("OTOMATİK BAŞLAT", `Sayfayı her açtığında OTO <b>kendiliğinden</b> başlar (${C.mode} mod${isReal() ? ": BOT CÜZDANI kilidini açtığın an, onay sormadan gerçek SOL ile" : ""}). Kapatmak için bu kutuyu kaldır ya da ■ HEPSİNİ DURDUR.`, "BAŞLAT"); if (!ok){ e.target.checked = false; return; } }
    C.autoStart = e.target.checked; save(); };
  $("#mm-simreset").onclick = () => simReset();
  for (const id of ["#mm-simreal", "#mm-simreal-b"]){ const b = $(id); if (b) b.onclick = () => simToReal(); }
  $("#cp-add").onclick = () => { try { COPY.add($("#cp-addr").value, $("#cp-lab").value); $("#cp-addr").value = ""; $("#cp-lab").value = ""; NOTIFY.toast("Takibe alındı", "good"); paintWallets(); } catch(e){ NOTIFY.toast("✖ " + e.message, "bad"); } };
  $("#cp-disc").onclick = async () => { const b = $("#cp-disc"), el = $("#cp-disc-res"); b.disabled = true; el.innerHTML = `<div class="empty">pump.fun'daki tüm işlemler 12 sn dinleniyor…</div>`;
    try { const r = await COPY.discover(12); el.innerHTML = `<div class="plan-foot">${r.trades} işlem · ${r.wallets} cüzdan. İşlem sayısına göre ilk 10 (çoğu bot olabilir — takip etmeden önce Solscan'de bak):</div>` + r.top.map(u => `<div class="disc"><a href="https://solscan.io/account/${esc(u.addr)}" target="_blank" rel="noopener">${short(u.addr)} ↗</a><span>${u.n} işlem · ${u.buys}A/${u.sells}S · ${u.mints} token · hacim ${fmt(u.vol, 2)} · net <b class="${u.net >= 0 ? "up" : "dn"}">${sg(u.net, 2)}</b></span><button type="button" class="mini" data-trk="${esc(u.addr)}">TAKİP</button></div>`).join("");
      el.querySelectorAll("[data-trk]").forEach(x => x.onclick = () => { try { COPY.add(x.dataset.trk, ""); x.textContent = "✔"; x.disabled = true; paintWallets(); } catch(e){ NOTIFY.toast("✖ " + e.message, "bad"); } }); }
    catch(e){ el.innerHTML = `<div class="err-line">✖ ${esc(e.message)}</div>`; } b.disabled = false; };
  $("#mm-probe").onclick = async () => { const b = $("#mm-probe"), el = $("#mm-probe-res"); b.disabled = true; el.innerHTML = `<div class="empty">ölçülüyor…</div>`; const mint = (PUMP._S.feed[0] || {}).mint;
    const r = await X().probe(mint); el.innerHTML = r.map(([k, v, ok]) => `<div><span>${esc(k)}</span><b class="${ok ? "" : "dn"}">${ok ? ms(v) : "✖"}</b></div>`).join(""); b.disabled = false; };
  const tog = $("#mm-goal-tog"), ed = $("#mm-goal-ed");
  if (tog && ed) tog.onclick = () => { const on = ed.classList.toggle("hidden"); tog.setAttribute("aria-expanded", on ? "false" : "true"); tog.textContent = on ? "düzenle" : "gizle"; };
  const rst = $("#mm-goal-reset"); if (rst) rst.onclick = () => { goalRestart(); NOTIFY.toast("24s pencere baştan alındı", "good"); };
  if (window.AGENTS) AGENTS.bind();
  const adv = $("#mm-adv"); if (adv) adv.addEventListener("toggle", () => { if (adv.open) requestAnimationFrame(() => { drawEq(); paint(true); }); });
  paint(true); }
function render(){ const box = $("#meme-box"); if (!box) return; if (RMT()){ orbRaf && cancelAnimationFrame(orbRaf); orbRaf = 0; return REMOTE.render(); } box.innerHTML = html(); bind(); orbInit(); }
/* ---- dynamic painting ---- */
let lastFull = 0;
function paint(full){ if (document.hidden) return; if (!$("#mm-eq")) return; const e = equity(), d = depBase(), su = PUMP.solUsd;
  $("#mm-eq").textContent = e === null ? (isReal() ? "…" : "—") : fmt(e, 4);
  $("#mm-usd").textContent = e !== null && su ? "≈ $" + (e*su).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "";
  const dp = e !== null && d ? (e/d - 1)*100 : null; $("#mm-dep").innerHTML = dp === null ? "" : `<b class="${dp >= 0 ? "up" : "dn"}">${pc(dp)}</b> yatırımdan beri <small>(${fmt(d, 3)} SOL${isReal() ? "" : " sanal"})</small>`;
  const au = $("#mm-auto"); au.textContent = ST.on ? "● OTO AÇIK" : "○ OTO KAPALI"; au.className = "pill " + (ST.on ? "g" : "");
  const cmpb = $("#mm-cmpb"); if (cmpb){ cmpb.classList.toggle("hidden", !(C.cmp && C.cmp.on)); cmpb.textContent = C.cmp && C.cmp.on ? `BİLEŞİK %${C.cmp.pct}` : "BİLEŞİK"; }

  paintGoal();
  const arm = $("#mm-arm"); arm.textContent = ST.on ? "■ OTO DURDUR" : "▶ OTO BAŞLAT"; arm.classList.toggle("on", ST.on);
  const J = JOURNAL.list().filter(x => x.venue === "pump.fun" && x.wallet === walletTag() && typeof x.pnl === "number"), w = J.filter(x => x.pnl > 0).length, tp = todayPnl();
  $("#mm-kpis").innerHTML = `<div><small>BUGÜN</small><b class="${tp >= 0 ? "up" : "dn"}">${sg(tp, 4)}</b></div><div><small>İŞLEM</small><b>${J.length}</b></div><div><small>KAZANMA</small><b>${J.length ? Math.round(w/J.length*100) + "%" : "—"}</b></div><div><small>AÇIK</small><b>${posList().length}/${C.maxPos}</b></div>`;
  paintPos(); paintAgents(); if (window.AGENTS && (full || Date.now() - (ST.agAt || 0) > 1800)){ ST.agAt = Date.now(); try { AGENTS.paint(); } catch(e){ console.error(e); } } paintLadder(); paintLat(); drawEq(); if (full || Date.now() - lastFull > 5000){ lastFull = Date.now(); paintTL(); paintTape(); paintWallets(); paintScore(); } }
function scStats(){ const b = [0, 0, 0, 0, 0]; for (const x of ST.scores) b[Math.min(4, Math.floor(x/20))]++; const D = WB.filter(r => r.done && !r.skip && isFinite(r.p5)), avg = k => D.length ? D.reduce((a, r) => a + r[k], 0)/D.length : null;
  return { n: ST.scN, pass: ST.scPass, buckets: b, wb: WB.length, wbDone: D.length, avgHi: avg("pHi"), avg5: avg("p5"), hit40: D.filter(r => r.pHi >= 40).length, flow: FLOW.stat }; }
function paintScore(){ const el = $("#mm-sc-st"); if (!el) return; const s = scStats(), R_ = (k, v, c) => `<div><span>${k}</span><b class="${c || ""}">${v}</b></div>`;
  el.innerHTML = R_("skorlanan / geçen", `${s.n} / ${s.pass}`) + R_("skor 0·20·40·60·80+", s.buckets.join(" · ")) + R_("ALIRDI (5 dk izlenen)", `${s.wb} (${s.wbDone})`)
    + R_("ALIRDI ort. zirve / 5 dk", s.avgHi === null ? "—" : pc(s.avgHi) + " / " + pc(s.avg5)) + R_("ALIRDI +%40'a değen", s.wbDone ? s.hit40 + "/" + s.wbDone : "—")
    + R_("huni (bu oturum)", fnLine()) + R_("en çok eleyen", fnTop() || "—")
    + R_("akış", s.flow.open ? `● ${s.flow.subs}/${s.flow.want} abone · ${s.flow.trades} işlem · yedek ${s.flow.bf}` : "—", s.flow.open ? "up" : "dim"); }
const fnSum = o => o ? Object.values(o).reduce((a, x) => a + x, 0) : 0;
function fnLine(){ const seen = fnSum(FN.seen), pre = seen - fnSum(FN.pre), sc = fnSum(FN.src); return `${seen} görülen → ${pre} ilk filtre → ${sc} skor → ${fnSum(FN.pass)} geçen`; }
function fnTop(){ const all = []; for (const st of ["pre", "dec", "hard", "low"]) for (const [k, v] of Object.entries(FN[st] || {})) all.push([st === "low" ? "skor " + k : k, v]); return all.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${esc(k)} ${v}`).join(" · "); }
const srcLab = s => s === "copy" ? "KOPYA" : s === "watcher" ? "İZLEYİCİ" : s === "grok" ? "GROK" : "ELLE";
function paintPos(){ const el = $("#mm-pos"); if (!el) return; const L = posList(); $("#mm-posn").textContent = L.length ? `${L.length} · ${fmt(deployed(), 3)} SOL` : "";
  el.innerHTML = L.length ? L.map(p => { const mo = ST.mons.get(p.mint) || {}, pn = mo.pnl, has = isFinite(pn) && pn !== null; return `<div class="pos ${!has ? "" : pn >= 0 ? "l" : "s"}"><b>${esc(p.sym)} <span class="pill ${p.src === "copy" ? "m" : "y"}">${srcLab(p.src)}</span>${p.wallet ? ` <small>${esc(lab(p.wallet))}</small>` : ""}</b>
    <span>${fmt(p.tokens, 0)}${p.estTok ? "~" : ""} adet · maliyet ${fmt(p.solIn, 4)} SOL · ${Math.floor((Date.now() - p.t)/60000)} dk${mo.mcap ? " · mcap " + fmt(mo.mcap, 1) : ""}</span>
    <span class="${has && pn >= 0 ? "up" : "dn"}">${!has ? "canlı fiyat bekleniyor…" : `≈ ${fmt(mo.val, 4)} SOL (${pc(pn)})${mo.hi > 0 ? " · zirve " + pc(mo.hi) : ""}`}</span><button type="button" data-sell="${esc(p.mint)}">SAT</button></div>`; }).join("") : `<div class="empty">açık pozisyon yok${ST.on ? " — ajanlar fırsat arıyor" : ""}</div>`;
  el.querySelectorAll("[data-sell]").forEach(b => b.onclick = () => manual(b.dataset.sell, "sell")); }
function paintAgents(){ if (!$("#agb-w")) return; const s = X().stats(), cpOn = COPY.list.filter(w => w.on !== false).length;
  const st = (id, txt, on) => { const e = $("#ags-" + id); e.textContent = txt; e.className = "ag-st " + (on ? "on" : ""); $("#ag-" + id).classList.toggle("live", !!on); };
  st("w", ST.on && C.w.on ? "● İZLİYOR" : C.w.on ? "○ hazır" : "kapalı", ST.on && C.w.on);
  $("#agb-w").innerHTML = `<div><span>görülen</span><b>${ST.seen}</b></div><div><span>filtreyi geçen</span><b>${ST.passed}</b></div><div><span>aday</span><b>${ST.cands.size}</b></div><div><span>skor geçen</span><b>${ST.scPass}/${ST.scN}</b></div><div><span>yeni/dk</span><b>${PUMP._S.rate.length}</b></div><div class="ag-l">${esc(ST.wLast || "yeni token bekleniyor")}</div>`;
  st("c", ST.on && C.cp.on && cpOn ? "● KOPYALIYOR" : !cpOn ? "cüzdan yok" : C.cp.on ? "○ hazır" : "kapalı", ST.on && C.cp.on && cpOn);
  $("#agb-c").innerHTML = `<div><span>cüzdan</span><b>${cpOn}/${COPY.list.length}</b></div><div><span>WS abonelik</span><b class="${COPY.live ? "up" : "dim"}">${COPY.live ? COPY.subs + (COPY.poll.on ? " +HTTP" : "") : "—"}</b></div><div><span>görülen işlem</span><b>${COPY.list.reduce((a, w) => a + COPY.stat(w.addr).n, 0)}</b></div><div><span>kopya</span><b>${JOURNAL.list().filter(x => x.src === "copy" && x.wallet === walletTag() && x.openT >= today0()).length}</b></div><div class="ag-l">${ST.lastCopy ? `son: <b>${esc(ST.lastCopy.sym)}</b> ← ${esc(lab(ST.lastCopy.w))} · ${tm(ST.lastCopy.at)}` : ST.cpSkip ? esc(ST.cpSkip) : "henüz kopya yok"}</div>`;
  st("x", s.pend ? "● GÖNDERİYOR" : isReal() ? (W().unlocked() ? "● HAZIR" : "🔒 kilitli") : "SIM", s.pend || (isReal() && W().unlocked()));
  $("#agb-x").innerHTML = `<div><span>olay→gön.</span><b>${ms(s.ev2sent)}</b></div><div><span>gön.→onay</span><b>${ms(s.sent2conf)}</b></div><div><span>onay/hata</span><b>${s.conf}/${s.fail}</b></div><div><span>blockhash</span><b>${s.bhAge === null ? "—" : (s.bhAge/1000).toFixed(1) + " sn"}</b></div><div class="ag-l">${isReal() ? `RPC ${X().rpcs().length}${X().C.jito ? " + Jito" : ""}${s.bhVia ? " · en hızlı " + esc(s.bhVia) + " " + ms(s.bhRtt) : ""}` : `SIM: gönderim yok · dolum canlı curve'den${s.bhVia ? " · RPC " + esc(s.bhVia) + " " + ms(s.bhRtt) : ""}`}</div>`;
  const paused = R.pauseUntil > Date.now(), dl = todayPnl();
  st("r", paused ? "⏸ ARA" : dl <= -C.dailyLoss ? "■ GÜNLÜK STOP" : "● KORUYOR", !paused && dl > -C.dailyLoss);
  $("#agb-r").innerHTML = `<div><span>boyut çarpanı</span><b class="${R.mult < 1 ? "y" : ""}">${R.mult}x</b></div><div><span>ardışık kayıp</span><b>${R.consec}</b></div><div><span>bugün</span><b class="${dl >= 0 ? "up" : "dn"}">${sg(dl, 3)}</b></div><div><span>hesap zirvesi</span><b>${fmt(R.eqHigh, 3)}</b></div><div class="ag-l">${paused ? `ara: ${tm(R.pauseUntil)}'e kadar` : `sıradaki boyut ${fmt(riskSize("watcher"), 3)} SOL`}${C.gk.gate ? ` · GROK ${ST.gk.yes}✔ ${ST.gk.no}✖ ${ST.gk.to}⌛` : ""}</div>`; }
let agQ = false; const paintAgentsQ = () => { if (agQ) return; agQ = true; setTimeout(() => { agQ = false; paintAgents(); }, 400); };
function paintLadder(){ const el = $("#mm-lad"); if (!el) return; const lv = [1, 0.5, 0.25], dl = Math.max(0, -todayPnl()), used = Math.min(1, dl/C.dailyLoss), paused = R.pauseUntil > Date.now();
  el.innerHTML = `<div class="rungs">${lv.map(x => `<div class="rung ${R.mult === x ? "on" : ""}"><b>${x}x</b><span>${fmt(sizeCalc({ cmpOn: !!(C.cmp && C.cmp.on), pct: C.cmp && C.cmp.pct, cmpMult: R.cmpMult || 1, equity: equity(), base: C.base, maxTrade: C.maxTrade, budget: C.budget, deployed: deployed(), infl: inflSum(), cash: cashNow(), feeBuf: feeBufNow(), riskMult: x, src: "watcher", sizeMode: C.cp.sizeMode, ratio: C.cp.ratio, walletSize: 0 }), 3)} SOL</span><small>${x === 1 ? "tam · yalnızca yeni zirvede" : x === 0.5 ? "1 kayıp sonrası" : "art arda kayıp"}</small></div>`).join("")}</div>
    <div class="lad-r"><div><small>GÜNLÜK ZARAR LİMİTİ</small><div class="bar"><div style="width:${(used*100).toFixed(0)}%" class="${used > .7 ? "r" : used > .4 ? "y" : ""}"></div></div><span>${fmt(dl, 3)} / ${C.dailyLoss} SOL</span></div>
    <div><small>ARDIŞIK KAYIP</small><div class="dots">${[0, 1].map(i => `<i class="${R.consec > i ? "on" : ""}"></i>`).join("")}</div><span>${paused ? "⏸ " + Math.ceil((R.pauseUntil - Date.now())/60000) + " dk ara <button class=\"mini\" onclick=\"MEME.endPause()\">ARAYI BİTİR</button>" : "2 kayıp = " + C.rules.pauseMin + " dk ara"}</span></div>
    <div><small>BÜTÇE KULLANIMI</small><div class="bar"><div style="width:${Math.min(100, deployed()/C.budget*100).toFixed(0)}%"></div></div><span>${fmt(deployed(), 3)} / ${C.budget} SOL</span></div></div>`; }
function paintLat(){ const el = $("#mm-lat"); if (!el) return; const L = X().lat.slice(0, 8);
  el.innerHTML = L.length ? `<div class="lat-h"><span>saat</span><span>işlem</span><span>olay→gön.</span><span>gön.→onay</span><span>yol</span></div>` + L.map(m => `<div class="${m.ok ? "" : "dn"}"><span>${tm(m.t)}</span><span>${m.side === "buy" ? "▲" : "▼"} ${esc((m.sym || "").slice(0, 7))}${m.pre ? "*" : ""}</span><span>${ms(m.ev2sent)}</span><span>${m.ok ? ms(m.sent2conf) : "✖"}</span><span>${esc(m.ok ? (m.confVia ? m.via + "/" + m.confVia : m.via + (m.dry ? "·ölçüm" : "")) : (m.err || "").slice(0, 22))}</span></div>`).join("")
    + (L.some(m => m.sim) ? `<div class="plan-foot">SIM: olay→gönderim = gerçek hazırlama (PumpPortal trade-local) + imza süresi ölçülür, işlem gönderilmez; gönderim→onay = gecikme modeli (${X().C.simDelay} ms). * = önceden hazırlanmış işlem.</div>` : "") : `<div class="empty">henüz işlem yok</div>`; }
let tlQ = false; const paintTLQ = () => { if (tlQ) return; tlQ = true; setTimeout(() => { tlQ = false; paintTL(); }, 300); };
function paintTL(){ const el = $("#mm-tl"); if (!el) return; const d0 = today0() - 6*3600000; const L = TL.filter(x => x.t >= d0 && x.k !== "watch").slice(0, 40);
  el.innerHTML = L.length ? L.map(x => `<div class="tl ${x.c} k-${x.k}"><i></i><small>${tm(x.t)}</small><span>${x.h}</span></div>`).join("") : `<div class="empty">bu gece henüz olay yok</div>`; }
function paintTape(){ const el = $("#mm-tape"); if (!el) return; el.innerHTML = TAPE.length ? TAPE.slice(0, 30).map(x => `<div class="${x.side === "buy" ? "up" : "dn"} ${x.us ? "us" : ""}"><small>${tm(x.t)}</small><b>${x.side === "buy" ? "AL" : "SAT"}</b><span>${esc(String(x.sym).slice(0, 10))}</span><span>${fmt(x.sol, 3)}</span><span class="who">${esc(x.who)}${x.pnl !== undefined ? " " + pc(x.pnl) : ""}</span></div>`).join("") : `<div class="empty">işlem bekleniyor (cüzdan takip et ya da OTO başlat)</div>`; }
let tpQ = false; const paintTapeQ = () => { if (tpQ) return; tpQ = true; setTimeout(() => { tpQ = false; paintTape(); }, 300); };
function paintWallets(){ const el = $("#mm-wal"); if (!el) return; if (el.contains(document.activeElement)) return; const L = COPY.list; $("#mm-cpst").textContent = COPY.live ? `● WS canlı · ${COPY.subs} abonelik${COPY.poll.on ? ` · HTTP yedek${COPY.poll.lag !== null ? " ~" + (COPY.poll.lag/1000).toFixed(1) + " sn" : ""}` : ""}` : L.length ? "○ bağlanıyor" : "";
  const J = JOURNAL.list().filter(x => x.venue === "pump.fun" && x.src === "copy" && x.wallet === walletTag() && typeof x.pnl === "number");
  el.innerHTML = L.length ? L.map(w => { const s = COPY.stat(w.addr), mine = J.filter(x => x.w === w.addr), my = mine.reduce((a, x) => a + x.pnl, 0), net = s.solOut - s.solIn;
    return `<div class="wal ${w.on === false ? "off" : ""}"><div class="wal-h"><b>${esc(w.label)}</b><a href="https://solscan.io/account/${esc(w.addr)}" target="_blank" rel="noopener">${short(w.addr)} ↗</a><label class="sw" title="kopyala"><input type="checkbox" data-wt="${esc(w.addr)}" ${w.on !== false ? "checked" : ""}><span></span></label></div>
      <div class="wal-g"><div><small>oturum işlem</small><b>${s.n}</b><span>${s.buys}A / ${s.sells}S</span></div><div><small>onların net akışı</small><b class="${net >= 0 ? "up" : "dn"}">${sg(net, 3)}</b><span>SOL · açık poz. hariç</span></div><div><small>bizim kopya K/Z</small><b class="${my >= 0 ? "up" : "dn"}">${mine.length ? sg(my, 4) : "—"}</b><span>${mine.length} kapalı</span></div></div>
      <div class="wal-f"><span>${s.last ? `son: ${s.last.isBuy ? "AL" : "SAT"} ${fmt(s.last.sol, 3)} SOL · ${tm(s.lastAt)}` : "oturumda işlem görülmedi"}</span><label>boyut<input data-wsz="${esc(w.addr)}" inputmode="decimal" value="${w.size || ""}" placeholder="temel"></label><button type="button" class="mini s" data-wd="${esc(w.addr)}" aria-label="sil">✕</button></div></div>`; }).join("")
    : `<div class="empty">takip edilen cüzdan yok — adres ekle ya da "en aktif cüzdanlar"</div>`;
  el.querySelectorAll("[data-wt]").forEach(i => i.onchange = () => COPY.toggle(i.dataset.wt, i.checked));
  el.querySelectorAll("[data-wd]").forEach(b => b.onclick = () => { COPY.del(b.dataset.wd); paintWallets(); });
  el.querySelectorAll("[data-wsz]").forEach(i => i.onchange = () => { const v = +i.value.replace(",", "."); COPY.setSize(i.dataset.wsz, v > 0 ? Math.min(v, C.maxTrade) : null); }); }
let wQ = false; const paintWalletsQ = () => { if (wQ) return; wQ = true; setTimeout(() => { wQ = false; paintWallets(); }, 1500); };
/* ---- equity curve ---- */
function sampleEq(){ const e = equity(); if (e === null) return; const t = Date.now(), last = EQ[EQ.length - 1]; if (last && t - last[0] < 4000) return; EQ.push([t, +e.toFixed(6)]); }
function drawEq(){ const c = $("#mm-eqcv"); if (!c) return; const r = c.getBoundingClientRect(); if (!r.width) return; const dpr = Math.min(2, devicePixelRatio || 1); if (c.width !== Math.round(r.width*dpr) || c.height !== Math.round(r.height*dpr)){ c.width = Math.round(r.width*dpr); c.height = Math.round(r.height*dpr); }
  const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); const Wd = r.width, H = r.height; g.clearRect(0, 0, Wd, H);
  const d = depBase(); const P = EQ.slice(-720); if (P.length < 2){ g.fillStyle = "#4f7b8a"; g.font = "10px 'Share Tech Mono', monospace"; g.fillText("eğri birkaç saniye içinde oluşur…", 8, H/2); return; }
  const t0 = P[0][0], t1 = P[P.length - 1][0], vs = P.map(p => p[1]).concat(d ? [d] : []), lo = Math.min(...vs), hi = Math.max(...vs), sp = (hi - lo) || Math.max(1e-6, hi*0.002);
  const X_ = t => 4 + (t - t0)/((t1 - t0) || 1)*(Wd - 8), Y_ = v => H - 14 - (v - lo)/sp*(H - 28);
  g.strokeStyle = "rgba(0,240,255,.06)"; g.lineWidth = 1; g.beginPath(); for (let i = 1; i < 4; i++){ g.moveTo(0, H*i/4); g.lineTo(Wd, H*i/4); } g.stroke();
  if (d){ g.strokeStyle = "rgba(255,230,0,.4)"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, Y_(d)); g.lineTo(Wd, Y_(d)); g.stroke(); g.setLineDash([]); g.fillStyle = "#ffe600aa"; g.font = "9px 'Share Tech Mono', monospace"; g.fillText("yatırım " + fmt(d, 3), 6, Math.max(9, Y_(d) - 3)); }
  const up = P[P.length - 1][1] >= (d || P[0][1]), col = up ? "#39ff14" : "#ff3355";
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, up ? "rgba(57,255,20,.28)" : "rgba(255,51,85,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.beginPath(); P.forEach((p, i) => i ? g.lineTo(X_(p[0]), Y_(p[1])) : g.moveTo(X_(p[0]), Y_(p[1]))); g.lineTo(X_(t1), H); g.lineTo(X_(t0), H); g.closePath(); g.fillStyle = gr; g.fill();
  g.beginPath(); P.forEach((p, i) => i ? g.lineTo(X_(p[0]), Y_(p[1])) : g.moveTo(X_(p[0]), Y_(p[1]))); g.strokeStyle = col; g.lineWidth = 1.8; g.shadowColor = col; g.shadowBlur = 8; g.stroke(); g.shadowBlur = 0;
  for (const m of MK){ if (m.t < t0 || m.t > t1) continue; const x = X_(m.t); let i = P.findIndex(p => p[0] >= m.t); if (i < 0) i = P.length - 1; const y = Y_(P[i][1]);
    g.fillStyle = m.k === "buy" ? "#00f0ff" : m.k === "risk" ? "#ffe600" : m.p >= 0 ? "#39ff14" : "#ff3355"; g.beginPath();
    if (m.k === "buy"){ g.moveTo(x, y - 10); g.lineTo(x - 4, y - 3); g.lineTo(x + 4, y - 3); } else if (m.k === "risk"){ g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); } else { g.moveTo(x, y + 10); g.lineTo(x - 4, y + 3); g.lineTo(x + 4, y + 3); } g.fill(); }
  g.fillStyle = "#6fa5b5"; g.font = "9px 'Share Tech Mono', monospace"; g.textAlign = "right"; g.fillText(fmt(hi, 4), Wd - 4, 10); g.fillText(fmt(lo, 4), Wd - 4, H - 3); g.textAlign = "left"; g.fillText(tm(t0).slice(0, 5), 4, H - 3); }
/* ---- central orb (fibonacci sphere, additive glow, energy from real events) ---- */
let orbRaf = 0, orbPts = null, orbVis = true, orbIO = null;
const RMq = matchMedia("(prefers-reduced-motion: reduce)");
function orbInit(){ const c = $("#orb"); if (!c) return; if (!orbPts){ const N = 220; orbPts = []; for (let i = 0; i < N; i++){ const y = 1 - (i/(N - 1))*2, r = Math.sqrt(1 - y*y), th = i*2.39996; orbPts.push([Math.cos(th)*r, y, Math.sin(th)*r]); } }
  if (orbIO) orbIO.disconnect(); if ("IntersectionObserver" in window){ orbIO = new IntersectionObserver(es => { orbVis = es[0].isIntersecting; if (orbVis && !orbRaf) orbRaf = requestAnimationFrame(orbFrame); }); orbIO.observe(c); }
  if (!orbRaf) orbRaf = requestAnimationFrame(orbFrame); }
let orbE = 0, orbT0 = performance.now(), orbLast = 0;
function orbFrame(t){ orbRaf = 0; const c = $("#orb"); if (!c || !orbPts || document.hidden || !orbVis) return;
  if (t - orbLast < 1000/40){ orbRaf = requestAnimationFrame(orbFrame); return; } const dt = Math.min(100, t - (orbLast || t)); orbLast = t;
  const r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); if (!r.width){ orbRaf = requestAnimationFrame(orbFrame); return; } if (c.width !== Math.round(r.width*dpr)){ c.width = Math.round(r.width*dpr); c.height = Math.round(r.height*dpr); }
  const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); const Wd = r.width, H = r.height; g.clearRect(0, 0, Wd, H);
  orbE = Math.max(orbE*Math.pow(0.35, dt/1000), ST.orb); ST.orb = 0; const T = (t - orbT0)/1000, spin = RMq.matches ? 0.6 : T*(0.25 + orbE*1.2) + (ST.on ? T*0.2 : 0);
  const tp = todayPnl(), hue = tp > 0 ? "57,255,20" : tp < 0 ? "255,51,85" : "0,240,255", cx = Wd*0.5, cy = H*0.5, R0 = Math.min(Wd, H)*0.36*(1 + orbE*0.12 + (RMq.matches ? 0 : Math.sin(T*2)*0.015));
  const halo = g.createRadialGradient(cx, cy, R0*0.2, cx, cy, R0*1.8); halo.addColorStop(0, `rgba(${hue},${(0.16 + orbE*0.3).toFixed(3)})`); halo.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = halo; g.fillRect(0, 0, Wd, H);
  g.globalCompositeOperation = "lighter"; const cs = Math.cos(spin), sn = Math.sin(spin), ct = Math.cos(0.42), st = Math.sin(0.42);
  for (const p of orbPts){ const x = p[0]*cs - p[2]*sn, z = p[0]*sn + p[2]*cs, y = p[1]; const y2 = y*ct - z*st, z2 = y*st + z*ct, k = (z2 + 1.6)/2.6;
    const wob = 1 + orbE*0.22*Math.sin(T*7 + p[1]*6); g.fillStyle = `rgba(${hue},${(0.12 + k*0.75).toFixed(2)})`; g.beginPath(); g.arc(cx + x*R0*wob, cy + y2*R0*wob, 0.6 + k*1.5, 0, 6.283); g.fill(); }
  g.strokeStyle = `rgba(${hue},.35)`; g.lineWidth = 1; for (let i = 0; i < 2; i++){ g.beginPath(); g.ellipse(cx, cy, R0*(1.25 + i*0.18), R0*(0.3 + i*0.06), (RMq.matches ? 0 : T)*(i ? -0.3 : 0.2), 0, 6.283); g.stroke(); }
  g.globalCompositeOperation = "source-over"; if (!RMq.matches || orbE > 0.02) orbRaf = requestAnimationFrame(orbFrame); }
document.addEventListener("visibilitychange", () => { if (!document.hidden && !orbRaf && orbPts) orbRaf = requestAnimationFrame(orbFrame); });
/* ------------------------- v7 SUNUCU: snapshot + control (used by server/server.mjs through page.evaluate) ------------------------- */
const r4 = x => x === null || x === undefined || !isFinite(x) ? null : +(+x).toFixed(6);
function snap(){ const e = equity(), d = depBase(), s = X().stats(), J = JOURNAL.list().filter(x => x.venue === "pump.fun" && x.wallet === walletTag() && typeof x.pnl === "number");
  const P = EQ.slice(-720), step = Math.max(1, Math.ceil(P.length/240)), eq = P.filter((_, i) => i % step === 0 || i === P.length - 1);
  return { t: Date.now(), mode: C.mode, on: ST.on, autoStart: !!C.autoStart, equity: r4(e), cash: r4(cashNow()), dep: r4(d), solUsd: PUMP.solUsd || null, today: r4(todayPnl()), trades: J.length, wins: J.filter(x => x.pnl > 0).length,
    pos: posList().map(p => { const mo = ST.mons.get(p.mint) || {}; return { mint: p.mint, sym: p.sym, src: p.src, w: p.wallet ? lab(p.wallet) : null, solIn: r4(p.solIn), tokens: p.tokens, est: !!p.estTok, t: p.t, val: r4(mo.val), pnl: mo.pnl === null || mo.pnl === undefined ? null : +mo.pnl.toFixed(2), hi: mo.hi === null || mo.hi === undefined ? null : +mo.hi.toFixed(2), mcap: r4(mo.mcap) }; }),
    deployed: r4(deployed()), risk: { mult: R.mult, consec: R.consec, pauseUntil: R.pauseUntil > Date.now() ? R.pauseUntil : 0, eqHigh: r4(R.eqHigh), wins: R.wins, losses: R.losses, cmpMult: R.cmpMult || 1, next: r4(riskSize("watcher")) }, goal: C.goal, cmp: C.cmp, freeSim: false, simFree: false, simSameAsReal: true,
    C: JSON.parse(JSON.stringify(C)), agents: { seen: ST.seen, passed: ST.passed, cands: ST.cands.size, entered: ST.entered, wLast: ST.wLast, rate: PUMP._S.rate.length, pumpLive: !!PUMP.live,
      cp: { live: !!COPY.live, subs: COPY.subs, poll: !!(COPY.poll && COPY.poll.on), last: ST.lastCopy ? { sym: ST.lastCopy.sym, w: lab(ST.lastCopy.w), at: ST.lastCopy.at } : null, skip: ST.cpSkip || "", list: COPY.list.map(w => { const st = COPY.stat(w.addr); return { addr: w.addr, label: w.label, on: w.on !== false, n: st.n, buys: st.buys, sells: st.sells }; }) },
      x: { ev2sent: r4(s.ev2sent), sent2conf: r4(s.sent2conf), conf: s.conf, fail: s.fail, pend: s.pend, bhAge: s.bhAge } },
    lat: X().lat.slice(0, 8).map(m => ({ t: m.t, side: m.side, sym: m.sym, ev2sent: r4(m.ev2sent), sent2conf: r4(m.sent2conf), ok: m.ok, via: m.via, err: m.err })),
    sc: scStats(), tl: TL.filter(x => x.k !== "watch").slice(0, 60), tape: TAPE.slice(0, 30), errs: TL.filter(x => x.k === "err" || x.k === "warn").slice(0, 10), eq, mk: MK.filter(m => eq.length && m.t >= eq[0][0]).slice(-80),
    wallet: { exists: W().exists(), pub: W().pub(), unlocked: W().unlocked(), bal: r4(ST.real.bal) } }; }
async function ctl(cmd, a = {}){ switch (cmd){
  case "arm": { if (isReal() && !W().unlocked()) throw new Error("BOT CÜZDANI kilitli — önce PIN ile aç"); const e = limitsErr(); if (e.length) throw new Error(e.join("; ")); const ok = await arm(true); if (!ok) throw new Error("OTO başlatılamadı"); return "OTO açık"; }
  case "stop": stop(a.why || "elle kapatıldı (telefon)"); return "OTO durdu";
  case "kill": { stop("HEPSİNİ DURDUR (telefon)"); if (window.AUTO) AUTO.kill(false); let n = 0; if (a.sell) for (const p of posList().slice()){ await exit(p.mint, "HEPSİNİ DURDUR"); n++; } paint(true); return a.sell ? `durdu · ${n} pozisyon satıldı` : "durdu"; }
  case "endPause": endPause(); return "ara bitti";
  case "pause": { const m = Math.max(1, Math.min(1440, +a.min || 30)); R.pauseAt = Date.now(); R.pauseUntil = R.pauseAt + m*60000; rSave(); tl("risk", `◆ RİSK: telefondan ${m} dk ara`, "y"); return m + " dk ara"; }
  case "set": { const v = setP(a.key, a.value); if (a.key === "dep" && !isReal() && !SIM.n && !SIM.pos.length){ SIM = simNew(C.dep); simSave(); } tl("set", `⚙ telefon: <b>${esc(a.key)}</b> = ${esc(v)}`, "dim"); paint(true); return v; }
  case "autoStart": C.autoStart = !!a.on; save(); return C.autoStart;
  case "sell": { if (!posGet(a.mint)) throw new Error("bu tokenda açık pozisyon yok"); const r = await exit(a.mint, a.why || "elle satış (telefon)"); if (!r) throw new Error("satış başarısız (zaman çizelgesine bak)"); return "satıldı"; }
  case "mode": modeNow(a.mode); return C.mode;
  case "simReset": simResetNow(); return "SIM sıfırlandı";
  case "simReal": { if (isReal()) throw new Error("yalnızca SIM"); if (ST.on) throw new Error("önce OTO'yu durdur"); const b = await realWalletSol(); C.dep = b || SIM_FALLBACK; save(); simResetNow(); return `SIM = ${fmt(C.dep, 4)} SOL${b ? "" : " (yedek değer)"}`; }
  case "track": COPY.add(a.addr, a.label || ""); return "takibe alındı";
  case "untrack": COPY.del(a.addr); return "takipten çıkarıldı";
  case "wtoggle": COPY.toggle(a.addr, !!a.on); return a.on ? "açık" : "kapalı";
  case "walletUpload": return W().importBlob(a.blob, !!a.replace);
  case "walletUnlock": { const pub = await W().unlock(String(a.pin || "")); if (isReal()) realBal(true); return pub; }
  case "walletLock": if (isReal() && ST.on) throw new Error("GERÇEK OTO açıkken kilitlenemez"); if (!W().lock()) throw new Error("kilitlenemedi"); return "kilitli";
  case "walletRemove": W().removeWallet(); return "silindi";
  default: throw new Error("bilinmeyen komut: " + cmd); } }
/* ------------------------- boot ------------------------- */
PUMP.onNew(t => { onNew(t); ST.orb = Math.max(ST.orb, 0.25); });
COPY.on(onCopy);
let pQ = false; const paintQ = () => { if (pQ) return; pQ = true; setTimeout(() => { pQ = false; paint(); }, 250); };
JOURNAL.on(() => paintQ());
setInterval(() => { sampleEq(); if (!document.hidden && document.body.dataset.pg === "meme") paint(); if (isReal()) realBal(); }, 1000);
setInterval(eqSave, 20000); window.addEventListener("pagehide", eqSave);
render(); web3().catch(() => {});
for (const p of posList()) monitor(p.mint);
if (isReal()){ realBal(true); X().keepWarm(true); }
if (MIG77 || localStorage.getItem("neon.meme.sim77") === "1") setTimeout(() => mig77Sync().catch(() => {}), 1200);
if (C.autoStart){ if (!isReal()) setTimeout(() => arm(true).then(ok => ok && NOTIFY.toast("otomatik başlat: OTO açıldı (SIM)", "good")), 1500);
  else { const iv = setInterval(() => { if (ST.on || !C.autoStart || C.mode !== "GERÇEK"){ clearInterval(iv); return; } if (W().unlocked()){ clearInterval(iv); arm(true).then(ok => ok && NOTIFY.ping("bad", "otomatik başlat: GERÇEK OTO açıldı")); } }, 2000); } }
return { funnel: () => JSON.parse(JSON.stringify(FN)), realWalletSol, simToReal, sizeWhy, sizeExplain, FLOW, scStats, get WB(){ return WB; }, check, exit, xcfg, snap, ctl, get remote(){ return RMT(); }, get on(){ return ST.on; }, get mode(){ return C.mode; }, arm, stop, endPause, kill, manual, context, applySuggestion, gateInfo, render, paint, fab, get C(){ return C; }, setP, _ST: ST, get SIM(){ return SIM; }, get R(){ return R; }, equity, posList, sizeCalc, riskSize, riskCheck, riskOnClose, simFree, fxWin, fxBuy, fxLoss, goalRestart };
})();
window.MEME = MEME;
