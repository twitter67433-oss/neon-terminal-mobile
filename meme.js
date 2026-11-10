/* NEON//TERMINAL v6 — MEME platform: fully automatic pump.fun trading with four agents.
   WATCHER (new tokens + filters) · COPIER (mirror tracked wallets) · EXECUTOR (exec.js) · RISK (protect the account first, grow it second).
   Modes: SIM (default · paper money, real live market data, realistic fills/fees/latency, nothing sent) and GERÇEK (BOT CÜZDANI, real SOL).
   Auto is OFF after every page load unless "otomatik başlat" is on. Manual trades always need ONAYLA; Grok can only suggest. */
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
const DEF = { mode: "SIM", dep: 1, autoStart: false, base: 0.05, maxTrade: 0.1, budget: 0.5, dailyLoss: 0.25, maxPos: 3, tp: 50, sl: 25, trail: 15, holdMin: 15, slip: 20, prio: 0.0005,
  w: { on: true, minInit: 0.3, minMcap: 27, maxMcap: 70, needSoc: true, maxDev: 10, maxRisk: 45, waitSec: 20, minMom: 8 },
  cp: { on: true, minSrc: 0.3, maxMcap: 300, follow: true, cool: 120, max10: 3, sizeMode: "fixed", ratio: 0.1 },
  rules: { half: true, pause2: true, pauseMin: 60, upHigh: true },
  gk: { gate: false, timeout: 2500, fallback: "rules" } };
const deep = (a, b) => { const o = Object.assign({}, a); for (const k in b) o[k] = (a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) ? Object.assign({}, a[k], b[k] || {}) : b[k]; return o; };
let C = deep(DEF, (() => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch(e){ return {}; } })());
const save = () => localStorage.setItem(K, JSON.stringify(C));
const RANGE = { base: [0.001, 1], maxTrade: [0.001, 2], budget: [0.01, 20], dailyLoss: [0.005, 20], maxPos: [1, 10], tp: [5, 1000], sl: [3, 90], trail: [0, 80], holdMin: [1, 1440], slip: [1, 50], prio: [0, 0.005], dep: [0.01, 1000],
  "w.minInit": [0, 50], "w.minMcap": [0, 1000], "w.maxMcap": [1, 5000], "w.maxDev": [0, 100], "w.maxRisk": [0, 100], "w.waitSec": [3, 600], "w.minMom": [-50, 500],
  "cp.minSrc": [0, 100], "cp.maxMcap": [1, 10000], "cp.cool": [0, 3600], "cp.max10": [1, 50], "cp.ratio": [0.001, 10], "rules.pauseMin": [1, 1440], "gk.timeout": [500, 15000] };
const BOOL = new Set(["w.on", "w.needSoc", "cp.on", "cp.follow", "rules.half", "rules.pause2", "rules.upHigh", "gk.gate"]);
const getP = p => p.split(".").reduce((o, k) => o && o[k], C);
function setP(p, v){ if (BOOL.has(p)) v = v === true || v === "true" || v === 1; else if (p === "cp.sizeMode") { if (!["fixed", "ratio"].includes(v)) throw new Error("sizeMode fixed|ratio"); } else if (p === "gk.fallback") { if (!["rules", "deny"].includes(v)) throw new Error("fallback rules|deny"); }
  else { const r = RANGE[p]; if (!r) throw new Error("bilinmeyen ayar: " + p); v = +String(v).replace(",", "."); if (!(v >= r[0] && v <= r[1])) throw new Error(`${p} ${r[0]}–${r[1]} olmalı`); }
  const ks = p.split("."); let o = C; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = v; save(); return v; }
/* ------------------------- SIM account ------------------------- */
const SK = "neon.sim";
const simNew = dep => ({ dep, cash: dep, pos: [], start: Date.now(), n: 0 });
let SIM = (() => { try { const s = JSON.parse(localStorage.getItem(SK) || "null"); if (s && isFinite(s.cash)) return s; } catch(e){} return simNew(C.dep); })();
const simSave = () => localStorage.setItem(SK, JSON.stringify(SIM));
/* ------------------------- risk state (per mode) ------------------------- */
const RK = m => "neon.meme.risk." + (m === "GERÇEK" ? "real" : "sim");
const rLoad = m => Object.assign({ mult: 1, consec: 0, pauseUntil: 0, eqHigh: null, wins: 0, losses: 0 }, (() => { try { return JSON.parse(localStorage.getItem(RK(m)) || "{}"); } catch(e){ return {}; } })());
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
const ST = { on: false, wake: null, cands: new Map(), mons: new Map(), busy: new Set(), buying: 0, curves: new Map(), cpLog: new Map(), lastCopy: null, seen: 0, passed: 0, entered: 0, wLast: "", gk: { n: 0, yes: 0, no: 0, to: 0, last: null }, real: { bal: null, at: 0 }, orb: 0 };
const isReal = () => C.mode === "GERÇEK";
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
/* ------------------------- RISK agent ------------------------- */
function riskSize(src, srcSol){ let base = C.base; if (src === "copy" && C.cp.sizeMode === "ratio" && srcSol) base = srcSol*C.cp.ratio;
  return Math.max(0.001, Math.min(C.maxTrade, base*(R.mult || 1))); }
const INFL = new Map(); /* buys still in flight (mint → size): counted against max positions / budget / cash so parallel signals cannot overshoot the limits */
const inflSum = () => [...INFL.values()].reduce((a, x) => a + x, 0);
function riskCheck(size, mint){ const now = Date.now();
  if (R.pauseUntil > now) return `RİSK arası: ${Math.ceil((R.pauseUntil - now)/60000)} dk kaldı`;
  if (todayPnl() <= -C.dailyLoss) return `günlük max zarar (${C.dailyLoss} SOL) doldu`;
  if (posGet(mint) || INFL.has(mint)) return "bu token zaten açık pozisyonda";
  if (posList().length + INFL.size >= C.maxPos) return `max açık pozisyon (${C.maxPos}) dolu`;
  if (deployed() + inflSum() + size > C.budget + 1e-9) return `bütçe dolu (${fmt(deployed() + inflSum(), 3)} / ${C.budget} SOL)`;
  const cash = cashNow(); if (cash !== null && cash - inflSum() < size + 0.004 + (isReal() ? 0.003 : 0)) return `yetersiz bakiye (${fmt(cash, 4)} SOL)`;
  if (isReal() && !W().unlocked()) return "BOT CÜZDANI kilitli";
  return null; }
function riskOnClose(pnl){ if (pnl < 0){ R.losses++; R.consec++; if (C.rules.half && R.mult > 0.25){ R.mult = Math.max(0.25, (R.mult || 1)/2); tl("risk", `◆ RİSK: kayıp sonrası boyut yarıya → <b>${R.mult}x</b>`, "y"); mark("risk", "", 0); }
    if (C.rules.pause2 && R.consec >= 2){ R.pauseUntil = Date.now() + C.rules.pauseMin*60000; R.consec = 0; tl("risk", `◆ RİSK: 2 kayıp üst üste → <b>${C.rules.pauseMin} dk ara</b> (${tm(R.pauseUntil)}'e kadar)`, "dn"); mark("risk", "", 0); NOTIFY.ping("bad", `RİSK: ${C.rules.pauseMin} dk ara`); } }
  else { R.wins++; R.consec = 0; const e = equity(); if (e !== null && (R.eqHigh === null || e > R.eqHigh + 1e-9)){ R.eqHigh = e; if (R.mult < 1){ R.mult = C.rules.upHigh ? Math.min(1, R.mult*2) : 1; tl("risk", `◆ RİSK: yeni hesap zirvesi ${fmt(e, 4)} SOL → boyut <b>${R.mult}x</b>`, "up"); } }
    else if (!C.rules.upHigh) R.mult = 1; }
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
    if (!isReal()){ r = await X().sim({ action: "buy", sol: size, slip: C.slip, prio: C.prio, sym: o.sym, mint: o.mint }, () => curveOf(o.mint), c0, o.tEv, { src: o.src, newAta: true });
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
    NOTIFY.ping("good", `${isReal() ? "" : "SIM "}AL ${o.sym} ${fmt(size, 3)} SOL`, !isReal()); ST.orb = 1;
    monitor(o.mint); paint(); return r; }
  catch(e){ tl("err", `✖ ${esc(o.sym)} alım başarısız: ${esc(e.message)}`, "dn"); if (isReal()) NOTIFY.ping("bad", `alım başarısız: ${o.sym}`); return null; }
  finally { INFL.delete(o.mint); if (watched) unwatchCurve(o.mint); ST.busy.delete(o.mint); ST.buying--; } }
async function exit(mint, why, tEv){ const p = posGet(mint); if (!p || ST.busy.has("s:" + mint)) return null; ST.busy.add("s:" + mint);
  try { const e = ST.curves.get(mint) || watchCurve(mint, p.curve || await curveKey(mint)); const c0 = e.c || await PUMP.curveNow(e.key).catch(() => null); let out, r;
    if (!isReal()){ if (!p.tokens) throw new Error("adet bilinmiyor"); r = await X().sim({ action: "sell", tokens: p.tokens, slip: C.slip, prio: C.prio, sym: p.sym, mint }, () => curveOf(mint), c0, tEv, { src: p.src });
      out = r.sol; SIM.cash += out; simSave(); }
    else { if (!W().unlocked()) throw new Error("BOT CÜZDANI kilitli"); r = await X().real({ action: "sell", mint, amount: "100%", denominatedInSol: "false", slip: C.slip, prio: C.prio, pool: "auto", sym: p.sym }, tEv, { src: p.src, preKey: "sell:" + mint, ref: c0 && c0.mcap });
      out = c0 && p.tokens ? X().sellOut(c0, p.tokens)*(1 - X().PP_FEE) - C.prio : 0;
      X().txDelta(r.sig, mint).then(d => { if (d && d.sol !== null && p.jid){ const j = JOURNAL.list().find(x => x.id === p.jid); if (j) JOURNAL.upd(p.jid, { out: +d.sol.toFixed(9), pnl: +(d.sol - (j.in || 0)).toFixed(9), pnlPct: j.in ? +((d.sol/j.in - 1)*100).toFixed(2) : null, note: (j.note || "") + " · çıkış tx'ten kesin" }); } realBal(true); }); }
    const pnl = out - p.solIn, pp = (out/p.solIn - 1)*100;
    if (p.jid) JOURNAL.upd(p.jid, { out: +out.toFixed(9), closeT: Date.now(), sigOut: r.sig || "", reason: [JOURNAL.list().find(x => x.id === p.jid)?.reason, why].filter(Boolean).join(" → ") });
    posDel(mint); stopMon(mint); riskOnClose(pnl); mark("sell", p.sym, pnl);
    tl("sell", `▼ SATILDI <b>${esc(p.sym)}</b> ${pc(pp)} · ${sg(pnl, 4)} SOL · ${esc(why)}${isReal() ? "" : " · SIM"}`, pnl >= 0 ? "up" : "dn", { sym: p.sym, pnl });
    tape({ side: "sell", sym: p.sym, sol: out, who: isReal() ? "BOT" : "SIM", us: true, pnl: pp });
    NOTIFY.ping(pnl >= 0 ? "good" : "bad", `${isReal() ? "" : "SIM "}SAT ${p.sym} ${pc(pp)}`, !isReal()); ST.orb = 1;
    if (todayPnl() <= -C.dailyLoss && ST.on) stop(`günlük max zarar (${C.dailyLoss} SOL) doldu`);
    paint(); return r; }
  catch(e){ tl("err", `✖ ${esc(p.sym)} satış başarısız: ${esc(e.message)}`, "dn"); if (isReal()) NOTIFY.ping("bad", `${p.sym} SATILAMADI`); const mo = ST.mons.get(mint); if (mo) mo.retryAt = Date.now() + 6000; return null; }
  finally { ST.busy.delete("s:" + mint); } }
/* position monitor: live curve → value; TP / SL / trailing / time / graduation (exits run while OTO is armed) */
function monitor(mint){ if (ST.mons.has(mint)) return; const p = posGet(mint); if (!p) return; const mo = { val: null, pnl: null, hi: null, t: null, retryAt: 0, preAt: 0, key: null }; ST.mons.set(mint, mo);
  (async () => { mo.key = p.curve || await curveKey(mint); if (ST.mons.get(mint) === mo) watchCurve(mint, mo.key); else return; })();
  mo.t = setInterval(() => check(mint), 400); }
function stopMon(mint){ const mo = ST.mons.get(mint); if (!mo) return; clearInterval(mo.t); ST.mons.delete(mint); if (mo.key) unwatchCurve(mint); }
function check(mint){ const mo = ST.mons.get(mint), p = posGet(mint); if (!mo) return; if (!p){ stopMon(mint); return; } const c = curveOf(mint); if (!c || !p.tokens) return;
  mo.val = Math.max(0, X().sellOut(c, p.tokens)*(1 - X().PP_FEE) - C.prio); mo.pnl = (mo.val/p.solIn - 1)*100; mo.mcap = c.mcap; mo.complete = c.complete; mo.hi = Math.max(mo.hi === null ? -1e9 : mo.hi, mo.pnl);
  if (isReal() && W().unlocked() && Date.now() - mo.preAt > 20000){ mo.preAt = Date.now(); X().prebuild("sell:" + mint, { action: "sell", mint, amount: "100%", denominatedInSol: "false", slip: C.slip, prio: C.prio, pool: "auto" }, c.mcap); }
  if (!ST.on || Date.now() < mo.retryAt || ST.busy.has("s:" + mint)) return;
  const held = (Date.now() - p.t)/60000;
  const why = mo.pnl >= C.tp ? `KÂR AL ${pc(mo.pnl)}` : mo.pnl <= -C.sl ? `ZARAR KES ${pc(mo.pnl)}` : C.trail > 0 && mo.hi >= C.trail && mo.pnl <= mo.hi - C.trail ? `İZ SÜREN STOP (zirve ${pc(mo.hi)})` : held >= C.holdMin ? `SÜRE DOLDU (${C.holdMin} dk)` : c.complete ? "curve tamamlandı (mezun)" : null;
  if (why) exit(mint, why); }
/* ------------------------- WATCHER agent ------------------------- */
function onNew(t){ ST.seen++; if (!ST.on || !C.w.on) return; const w = C.w;
  const why = t.pool !== "pump" ? "havuz pump değil" : t.devSol < w.minInit ? "dev alımı düşük" : t.mcap && t.mcap < w.minMcap ? "mcap düşük" : t.devPct > w.maxDev ? "dev payı yüksek" : t.serial > 1 ? "seri yaratıcı" : t.copy > 0 ? "kopya isim" : null;
  if (why){ ST.wLast = `${t.symbol}: ${why}`; return; } if (ST.cands.size >= 6 || posList().length >= C.maxPos) return;
  ST.passed++; const c = { t, at: Date.now(), first: null, hi: 0, last: null, odd: false };
  const e = watchCurve(t.mint, t.curve); c.e = e; ST.cands.set(t.mint, c); PUMP.metaQ(t, true);
  ST.wLast = `${t.symbol}: ${w.waitSec} sn momentum izleniyor`; tl("watch", `👁 İZLEYİCİ: <b>${esc(t.symbol)}</b> ilk filtreyi geçti · mcap ${fmt(t.mcap, 1)} · dev %${fmt(t.devPct, 1)}`, "dim");
  c.iv = setInterval(() => { const cv = e.c; if (!cv) return; if (c.first === null){ c.first = cv.mcap; c.odd = Math.abs(cv.vSol - cv.rSol - 30) > 1.5; } c.last = cv.mcap; c.hi = Math.max(c.hi, cv.mcap); }, 250);
  if (isReal()) setTimeout(() => { const cv = e.c; if (ST.cands.has(t.mint) && cv && cv.mcap >= (c.first || cv.mcap)) X().prebuild("buy:" + t.mint, { action: "buy", mint: t.mint, amount: riskSize("watcher"), denominatedInSol: "true", slip: C.slip, prio: C.prio, pool: "pump" }, cv.mcap); }, Math.max(1000, (w.waitSec - 4)*1000));
  setTimeout(() => decide(t.mint), w.waitSec*1000); }
async function decide(mint, again){ const c = ST.cands.get(mint); if (!c) return; const t = c.t, w = C.w;
  const done = (msg, cls) => { clearInterval(c.iv); ST.cands.delete(mint); unwatchCurve(mint); if (msg) tl("watch", msg, cls || "dim"); };
  if (!ST.on) return done();
  if (w.needSoc && !t.meta && !t.metaErr && !again){ setTimeout(() => decide(mint, true), 4000); return; }
  PUMP.risk(t); const mom = c.first && c.last ? (c.last/c.first - 1)*100 : null, soc = t.meta && (t.meta.tw || t.meta.tg || t.meta.web);
  const no = c.first === null ? "canlı curve verisi yok" : c.odd ? "standart dışı curve" : w.needSoc && !soc ? "sosyal yok" : t.risk > w.maxRisk ? `risk ${t.risk} > ${w.maxRisk}` : mom < w.minMom ? `momentum ${pc(mom)} < %${w.minMom}` : c.last > w.maxMcap ? `mcap ${fmt(c.last, 1)} > ${w.maxMcap}` : c.e.c && c.e.c.complete ? "curve tamamlandı" : c.last < c.hi*0.8 ? "zirveden %20+ düştü" : null;
  if (no){ ST.wLast = `${t.symbol}: elendi (${no})`; return done(`✖ ${esc(t.symbol)} elendi: ${esc(no)}`); }
  const tEv = performance.now(); clearInterval(c.iv); ST.cands.delete(mint);
  await enter({ mint, sym: t.symbol, src: "watcher", tEv, curve: t.curve, reason: `İZLEYİCİ: momentum ${pc(mom)}, risk ${t.risk}`, c0: c.e.c });
  unwatchCurve(mint); }
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
    enter({ mint: t.mint, sym, src: "copy", wallet: t.wallet, srcSol: t.sol, size: w.size ? Math.min(C.maxTrade, w.size*(R.mult || 1)) : null, tEv: t.at - (t.lag || 0), c0: { vSol: t.vSol, vTok: t.vTok, mcap: t.mcap, complete: false }, reason: `KOPYA: ${lab(t.wallet)} ${fmt(t.sol, 3)} SOL aldı` }); }
  else if (C.cp.follow){ const p = posGet(t.mint); if (p && p.wallet === t.wallet) exit(t.mint, `KOPYA ÇIKIŞ: ${lab(t.wallet)} sattı (%${Math.round((t.frac || 1)*100)})`, t.at - (t.lag || 0)); } }
/* ------------------------- arm / disarm ------------------------- */
async function wake(on){ try { if (on && "wakeLock" in navigator && !ST.wake && !document.hidden){ ST.wake = await navigator.wakeLock.request("screen"); ST.wake.addEventListener("release", () => { ST.wake = null; }); } else if (!on && ST.wake){ await ST.wake.release(); ST.wake = null; } } catch(e){ ST.wake = null; } }
let hidAt = 0; document.addEventListener("visibilitychange", () => { if (document.hidden){ hidAt = Date.now(); return; } if (ST.on){ wake(true); if (hidAt && Date.now() - hidAt > 5000) tl("warn", `⚠ sayfa ${Math.round((Date.now() - hidAt)/1000)} sn arka plandaydı — bu sürede tarayıcı OTO'yu yavaşlatmış/durdurmuş olabilir`, "y"); } });
function sheetHTML(head, title, body, ok){ return `<div class="cf-mode real">${head}</div><div class="sheet-title">${title}</div>${body}<div class="sheet-btns"><button type="button" id="cf-no">İPTAL</button><button type="button" id="cf-ok" class="cf-ok real" ${ok ? "" : "disabled"}>${ok || "KABUL EDİYORUM"}</button></div>`; }
function riskSheet(){ return new Promise(res => { $("#cf-box").innerHTML = sheetHTML("⚠ GERÇEK PARA · TAM OTOMATİK<small>Bot, onay sormadan alıp satacak</small>", "GERÇEK MODDA OTO",
    `<div class="cf-warn">• pump.fun coinlerinin <b>büyük çoğunluğu kısa sürede sıfıra yakın değere düşer</b>; rug-pull, bot ve sandviç saldırıları yaygındır.<br>• Bot <b>BOT CÜZDANI</b>'ndaki gerçek SOL ile her işlemde onay sormadan alır ve satar (Phantom ana cüzdanın asla kullanılmaz).<br>• Ücretler (pump.fun ~%1.25, PumpPortal %0.5, öncelik ücreti, token hesabı kirası ~0.002 SOL) her işlemde kayıp yaratır. Kopyalanan cüzdan kâr etse bile sen ondan sonra girdiğin için zarar edebilirsin.<br>• SIM sonuçları geleceği göstermez; <b>kâr garantisi yoktur</b>. Yalnızca sayfa açık ve ön plandayken çalışır.</div><label class="chk"><input type="checkbox" id="rk-ok"> Okudum, anladım; kaybın tamamen bana ait.</label>`);
    const box = $("#confirm"); box.classList.remove("hidden"); const ok = $("#cf-ok"); $("#rk-ok").onchange = e => ok.disabled = !e.target.checked;
    const done = v => { box.classList.add("hidden"); $("#cf-box").innerHTML = ""; res(v); }; $("#cf-no").onclick = () => done(false); ok.onclick = () => done(true); }); }
function limitsErr(){ const e = []; if (C.maxTrade < C.base) e.push("işlem başı max ≥ temel boyut olmalı"); if (C.budget < C.base) e.push("bütçe ≥ temel boyut"); if (C.dailyLoss > C.budget) e.push("günlük max zarar ≤ bütçe"); if (!C.w.on && !C.cp.on) e.push("en az bir ajan (İzleyici ya da Kopyacı) açık olmalı"); return e; }
async function arm(silent){ if (ST.on) return true; const e = limitsErr(); if (e.length){ NOTIFY.toast("✖ " + e.join("; "), "bad"); return false; }
  if (isReal()){ if (!W().exists()){ NOTIFY.toast("✖ GERÇEK mod için önce BOT CÜZDANI oluştur (CÜZDAN sekmesi)", "bad"); return false; } if (!W().unlocked()){ NOTIFY.toast("✖ BOT CÜZDANI kilitli — CÜZDAN sekmesinde PIN ile aç", "bad"); return false; }
    if (!silent){ if (!C.acceptedReal){ if (!(await riskSheet())) return false; C.acceptedReal = true; save(); }
      if (!(await T().confirmSheet({ title: "GERÇEK OTO AL-SAT'I BAŞLAT", mode: "GERÇEK", rows: [["Cüzdan", "BOT " + short(W().pub())], ["Temel boyut", C.base + " SOL × risk çarpanı " + R.mult + "x"], ["İşlem başı max", C.maxTrade + " SOL"], ["Toplam bütçe", C.budget + " SOL"], ["Günlük max zarar", C.dailyLoss + " SOL", "dn"], ["Max açık pozisyon", String(C.maxPos)], ["Çıkış", `+%${C.tp} / −%${C.sl} / iz %${C.trail} / ${C.holdMin} dk`], ["Ajanlar", `İzleyici ${C.w.on ? "açık" : "kapalı"} · Kopyacı ${C.cp.on ? COPY.list.filter(w => w.on !== false).length + " cüzdan" : "kapalı"}${C.gk.gate ? " · GROK onayı" : ""}`]], warn: "Bundan sonra bot bu limitler içinde <b>onay sormadan</b> alıp satar. ■ HEPSİNİ DURDUR her zaman ekranda.", okText: "ONAYLA · OTO BAŞLAT" }))) return false; } }
  ST.on = true; R = rLoad(C.mode); if (R.eqHigh === null){ R.eqHigh = equity(); rSave(); } X().keepWarm(true); if (!PUMP.live) PUMP.start(); if (COPY.list.length) COPY.open();
  for (const p of posList()) monitor(p.mint); wake(true); tl("arm", `▶ OTO BAŞLADI · <b>${C.mode}</b> · ${[C.w.on && "İzleyici", C.cp.on && "Kopyacı", C.gk.gate && "GROK onayı"].filter(Boolean).join(" + ")}`, "up");
  window.BUS && BUS.emit("state", { node: "bt", on: true }); afterToggle(); return true; }
function stop(reason){ if (!ST.on) return; ST.on = false; for (const [m, c] of ST.cands){ clearInterval(c.iv); unwatchCurve(m); } ST.cands.clear(); if (!isReal()) X().keepWarm(false); wake(false);
  tl("stop", `■ OTO DURDU: ${esc(reason || "elle")}`, "dn"); if (reason && reason !== "elle kapatıldı") NOTIFY.ping("bad", "OTO durdu: " + reason); afterToggle(); }
function afterToggle(){ document.body.classList.toggle("meme-on", ST.on); fab(); paint(true); }
function fab(){ const f = $("#killfab"); if (f) f.classList.toggle("hidden", !(ST.on || (window.AUTO && (AUTO.bnOn() || AUTO.pumpOn())))); }
async function kill(){ const L = posList(); const r = await new Promise(res => { $("#cf-box").innerHTML = sheetHTML("■ HEPSİNİ DURDUR", "TÜM OTOMATİK İŞLEMLERİ DURDUR", `<div class="cf-warn">MEME OTO (izleyici + kopyacı) ve Binance OTO hemen kapanır.</div><label class="chk"><input type="checkbox" id="k-sell" ${L.length ? "" : "disabled"}> ${L.length} ${C.mode} pozisyonunu da piyasadan SAT</label>`, "DURDUR");
    const box = $("#confirm"); box.classList.remove("hidden"); const done = v => { const s = $("#k-sell"); const o = v && { s: s && s.checked }; box.classList.add("hidden"); $("#cf-box").innerHTML = ""; res(o); };
    $("#cf-no").onclick = () => done(null); $("#cf-ok").onclick = () => done(true); });
  if (!r) return; stop("HEPSİNİ DURDUR"); if (window.AUTO) AUTO.kill(false);
  if (r.s) for (const p of posList().slice()) await exit(p.mint, "HEPSİNİ DURDUR"); fab(); paint(true); }
async function setMode(m){ if (m === C.mode) return; if (ST.on){ NOTIFY.toast("Önce OTO'yu durdur", "bad"); return; }
  if (m === "GERÇEK"){ if (!W().exists()){ NOTIFY.toast("GERÇEK mod için önce CÜZDAN sekmesinden BOT CÜZDANI oluştur", "bad"); return; }
    if (!(await CONN.typedConfirm("GERÇEK MODA GEÇ", "Bundan sonra MEME motoru (oto ve elle) <b>BOT CÜZDANI'ndaki gerçek SOL</b> ile işlem yapar. SIM hesabın ve geçmişin saklanır.", "GERÇEK"))) return; }
  for (const mint of [...ST.mons.keys()]) stopMon(mint); eqSave(); C.mode = m; save(); R = rLoad(m);
  try { EQ = JSON.parse(localStorage.getItem(EK(m)) || "[]"); MK = JSON.parse(localStorage.getItem(EK(m) + ".mk") || "[]"); } catch(e){ EQ = []; MK = []; }
  if (m === "GERÇEK"){ realBal(true).then(() => paint(true)); X().keepWarm(true); } else X().keepWarm(false); for (const p of posList()) monitor(p.mint);
  tl("mode", `MOD → <b>${m}</b>`, m === "GERÇEK" ? "dn" : "y"); render(); }
async function simReset(){ if (ST.on && !isReal()){ NOTIFY.toast("Önce OTO'yu durdur", "bad"); return; }
  if (!(await CONN.typedConfirm("SIM HESABINI SIFIRLA", `SIM bakiyesi <b>${C.dep} SOL</b> sanal yatırıma döner; SIM pozisyonları, SIM eğrisi ve SIM risk durumu silinir (günlükteki SIM kayıtları kalır).`, "SIFIRLA"))) return;
  for (const p of SIM.pos) stopMon(p.mint); SIM = simNew(C.dep); simSave(); localStorage.removeItem(RK("SIM")); localStorage.removeItem(EK("SIM")); localStorage.removeItem(EK("SIM") + ".mk");
  if (!isReal()){ R = rLoad("SIM"); EQ = []; MK = []; } tl("mode", `SIM sıfırlandı · sanal yatırım ${C.dep} SOL`, "y"); render(); }
/* manual trade through the engine (always ONAYLA) */
async function manual(mint, action, opt = {}){ const t = PUMP.get(mint), sym = (t && t.symbol) || opt.sym || short(mint);
  if (action === "buy"){ const size = +(opt.sol || C.base); if (!(size > 0 && size <= C.maxTrade)){ NOTIFY.toast(`Miktar 0–${C.maxTrade} SOL (işlem başı max)`, "bad"); return; }
    const why = riskCheck(size, mint); if (why){ NOTIFY.toast("✖ " + why, "bad"); return; }
    if (!(await T().confirmSheet({ title: (isReal() ? "" : "SIM · ") + "AL · MEME MOTORU", mode: isReal() ? "GERÇEK" : "SIM", rows: [["Mod", C.mode, isReal() ? "dn" : ""], ["Token", sym + " · " + short(mint)], ["Miktar", size + " SOL"], ["Kayma / öncelik", `%${C.slip} / ${C.prio} SOL`], ["Rug riski", t ? t.risk + " / 100" : "—"], ["Kaynak", opt.src === "grok" ? "GROK önerisi" : "elle"]], warn: isReal() ? "BOT CÜZDANI imzalar ve hemen gönderir. Geri alınamaz." : "SIM: gerçek işlem gönderilmez; canlı fiyatla sanal dolum.", okText: "ONAYLA · AL" }))) return;
    return enter({ mint, sym, src: opt.src || "manual", manual: true, size, tEv: performance.now(), curve: t && t.curve, reason: opt.src === "grok" ? "GROK önerisi (onaylandı)" : "elle" }); }
  const p = posGet(mint); if (!p){ NOTIFY.toast("Bu tokenda açık pozisyon yok", "bad"); return; }
  if (!(await T().confirmSheet({ title: (isReal() ? "" : "SIM · ") + "SAT · MEME MOTORU", mode: isReal() ? "GERÇEK" : "SIM", rows: [["Token", p.sym], ["Miktar", "%100 · " + fmt(p.tokens, 0)], ["Maliyet", fmt(p.solIn, 4) + " SOL"], ["Tahmini değer", fmt(posVal(p), 4) + " SOL"]], okText: "ONAYLA · SAT" }))) return;
  return exit(mint, opt.src === "grok" ? "GROK önerisi (onaylandı)" : "elle satış"); }
/* ------------------------- context for GROK ------------------------- */
function gateInfo(o){ const t = PUMP.get(o.mint) || {}, m = t.meta || {}; const c = curveOf(o.mint) || o.c0 || {};
  return { sym: o.sym, name: t.name, mint: o.mint, src: o.src, copiedWallet: o.wallet ? lab(o.wallet) : null, walletBuySol: o.srcSol, mcapSol: c.mcap ? +c.mcap.toFixed(1) : null, ageSec: t.at ? Math.round((Date.now() - t.at)/1000) : null, devPct: t.devPct ? +t.devPct.toFixed(1) : null, devSol: t.devSol, rug: t.risk, rugFactors: (t.riskF || []).map(f => f[1]).slice(0, 5), socials: { x: !!m.tw, tg: !!m.tg, web: !!m.web }, desc: (m.desc || "").slice(0, 160) }; }
function context(){ const e = equity(), d = depBase(); const J = JOURNAL.list().filter(x => x.venue === "pump.fun" && x.wallet === walletTag()).slice(-12); const s = X().stats();
  const sel = PUMP._S.sel; return { time: new Date().toLocaleString("tr-TR", { timeZone: TZ }), mode: C.mode, autoOn: ST.on, equitySol: e && +e.toFixed(4), depositSol: d, sinceDepositPct: e && d ? +((e/d - 1)*100).toFixed(2) : null, todayPnlSol: +todayPnl().toFixed(4), solUsd: PUMP.solUsd,
    risk: { mult: R.mult, consecLoss: R.consec, pausedUntil: R.pauseUntil > Date.now() ? tm(R.pauseUntil) : null, equityHigh: R.eqHigh, wins: R.wins, losses: R.losses },
    settings: { base: C.base, maxTrade: C.maxTrade, budget: C.budget, dailyLoss: C.dailyLoss, maxPos: C.maxPos, tp: C.tp, sl: C.sl, trail: C.trail, holdMin: C.holdMin, slip: C.slip, prio: C.prio, w: C.w, cp: C.cp, rules: C.rules, gk: C.gk },
    positions: posList().map(p => { const mo = ST.mons.get(p.mint) || {}; return { sym: p.sym, mint: p.mint, src: p.src, costSol: +(+p.solIn).toFixed(4), valueSol: mo.val ? +mo.val.toFixed(4) : null, pnlPct: isFinite(mo.pnl) && mo.pnl !== null ? +mo.pnl.toFixed(1) : null, ageMin: Math.round((Date.now() - p.t)/60000) }; }),
    lastTrades: J.map(x => ({ sym: x.sym, src: x.src, in: x.in, out: x.out, pnlPct: x.pnlPct, reason: x.reason, at: tm(x.openT) })),
    trackedWallets: COPY.list.map(w => { const st = COPY.stat(w.addr); return { label: w.label, addr: w.addr, on: w.on !== false, sessionTrades: st.n, buys: st.buys, sells: st.sells, solIn: +st.solIn.toFixed(3), solOut: +st.solOut.toFixed(3) }; }),
    agents: { watcherSeen: ST.seen, watcherPassed: ST.passed, candidates: ST.cands.size, entered: ST.entered, avgEventToSentMs: s.ev2sent && Math.round(s.ev2sent), avgSentToConfMs: s.sent2conf && Math.round(s.sent2conf), execFails: s.fail },
    newTokensPerMin: PUMP._S.rate.length, selectedToken: sel ? gateInfo({ mint: sel.mint, sym: sel.symbol, src: "seçili" }) : null }; }
function applySuggestion(a){ try {
  if (a.type === "set"){ const v = setP(a.key, a.value); tl("grok", `GROK önerisi uygulandı: <b>${esc(a.key)}</b> = ${esc(v)}`, "y"); render(); return `✔ ${a.key} = ${v}`; }
  if (a.type === "buy"){ if (!a.mint || !COPY.valid(a.mint)) throw new Error("geçersiz mint"); manual(a.mint, "buy", { sol: Math.min(+a.sol || C.base, C.maxTrade), src: "grok" }); return "ONAY ekranı açıldı"; }
  if (a.type === "sell"){ manual(a.mint, "sell", { src: "grok" }); return "ONAY ekranı açıldı"; }
  if (a.type === "track"){ COPY.add(a.wallet, a.label); paintWallets(); return "✔ takibe alındı"; }
  if (a.type === "untrack"){ COPY.del(a.wallet); paintWallets(); return "✔ takipten çıkarıldı"; }
  if (a.type === "pause"){ const m = Math.max(1, Math.min(1440, +a.min || 30)); R.pauseUntil = Date.now() + m*60000; rSave(); tl("risk", `GROK önerisi: ${m} dk ara`, "y"); return `✔ ${m} dk ara`; }
  if (a.type === "stop"){ stop("GROK önerisi (onaylandı)"); return "✔ OTO durdu"; }
  throw new Error("bilinmeyen öneri türü: " + a.type); } catch(e){ return "✖ " + e.message; } }
/* ------------------------- UI ------------------------- */
const AG = (id, ic, name, col) => `<div class="ag" id="ag-${id}" style="--ac:${col}"><div class="ag-h"><span class="ag-ic">${ic}</span><b>${name}</b><span class="ag-st" id="ags-${id}">—</span></div><div class="ag-b" id="agb-${id}"></div></div>`;
const inp = (p, lab) => `<label>${lab}<input data-m="${p}" inputmode="decimal" value="${esc(getP(p))}"></label>`;
const chk = (p, lab) => `<label class="chk"><input type="checkbox" data-m="${p}" ${getP(p) ? "checked" : ""}> ${lab}</label>`;
function html(){ const real = isReal(), ex = X().C;
  return `<div class="mm-bar"><div class="seg" role="group" aria-label="Mod"><button type="button" data-mode="SIM" class="${real ? "" : "on"}">SIM</button><button type="button" data-mode="GERÇEK" class="${real ? "on real" : ""}">GERÇEK</button></div>
      <button type="button" id="mm-arm" class="arm ${ST.on ? "on" : ""}">${ST.on ? "■ OTO DURDUR" : "▶ OTO BAŞLAT"}</button></div>
    <div class="mm-hero"><canvas id="orb" aria-hidden="true"></canvas><div class="mm-bal"><div class="mm-badges"><span class="mode-badge ${real ? "real" : "sim"}">${real ? "⚠ GERÇEK" : "SIM · SANAL"}</span><span id="mm-auto" class="pill"></span></div>
      <div class="mm-big"><span id="mm-eq">—</span><small>SOL</small></div><div class="mm-usd" id="mm-usd"></div><div class="mm-dep" id="mm-dep"></div></div></div>
    <div class="mm-kpis" id="mm-kpis"></div>
    <div class="mm-eqc"><div class="sub-h">HESAP EĞRİSİ <small>▲ alış · ▼ satış · ◆ risk</small></div><canvas id="mm-eqcv"></canvas></div>
    <div class="sub-h">AJANLAR</div><div class="ags">${AG("w", "👁", "İZLEYİCİ", "#00f0ff")}${AG("c", "🔁", "KOPYACI", "#ff2bd6")}${AG("x", "⚡", "YÜRÜTÜCÜ", "#ffe600")}${AG("r", "⛨", "RİSK", "#39ff14")}</div>
    <div class="sub-h">AÇIK POZİSYONLAR <small id="mm-posn"></small></div><div id="mm-pos" class="pos-list"></div>
    <div class="sub-h">BU GECE <small>zaman çizelgesi</small></div><div id="mm-tl" class="mm-tl"></div>
    <div class="sub-h">İŞLEM ŞERİDİ <small>biz + takip edilen cüzdanlar</small></div><div id="mm-tape" class="mm-tape"></div>
    <div class="sub-h">ÖNCE HESABI KORU, SONRA BÜYÜT</div><div class="ladder" id="mm-lad"></div>
    <div class="rules">${chk("rules.half", "Kayıptan sonra boyutu yarıya indir")}${chk("rules.pause2", "2 kayıp üst üste → ara ver")}${chk("rules.upHigh", "Boyutu yalnızca yeni hesap zirvesinde büyüt")}${inp("rules.pauseMin", "Ara süresi (dk)")}</div>
    <div class="sub-h">TAKİP EDİLEN CÜZDANLAR <small id="mm-cpst"></small></div>
    <div class="f2"><label>Cüzdan adresi<input id="cp-addr" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Solana adresi"></label><label>Etiket<input id="cp-lab" autocomplete="off" placeholder="ör. balina1"></label></div>
    <div class="f2"><button type="button" id="cp-add" class="mini wide">+ TAKİBE AL</button><button type="button" id="cp-disc" class="mini wide">🔎 EN AKTİF CÜZDANLAR (12 sn)</button></div>
    <div id="cp-disc-res"></div><div id="mm-wal" class="wals"></div>
    <div class="sub-h">GECİKME <small>olay → gönderim · gönderim → onay</small></div><div id="mm-lat" class="lat"></div>
    <button type="button" id="mm-probe" class="mini wide">⏱ GECİKME TESTİ (hiçbir şey gönderilmez)</button><div id="mm-probe-res" class="kv"></div>
    <details class="keys"><summary>⚙ BOYUT · LİMİTLER · ÇIKIŞ</summary>
      <div class="f3">${inp("base", "Temel boyut SOL")}${inp("maxTrade", "İşlem başı max SOL")}${inp("budget", "Toplam bütçe SOL")}</div>
      <div class="f3">${inp("dailyLoss", "Günlük max zarar SOL")}${inp("maxPos", "Max açık poz.")}${inp("holdMin", "Max tutma dk")}</div>
      <div class="f3">${inp("tp", "Kâr al +%")}${inp("sl", "Zarar kes −%")}${inp("trail", "İz süren stop % (0=kapalı)")}</div></details>
    <details class="keys"><summary>👁 İZLEYİCİ filtreleri</summary>${chk("w.on", "İzleyici açık (yeni token girişleri)")}
      <div class="f3">${inp("w.minInit", "Min dev alımı SOL")}${inp("w.minMcap", "Min mcap SOL")}${inp("w.maxMcap", "Max mcap SOL")}</div>
      <div class="f3">${inp("w.maxDev", "Dev payı ≤ %")}${inp("w.maxRisk", "Rug riski ≤")}${inp("w.waitSec", "Bekle sn")}</div>
      <div class="f2">${inp("w.minMom", "Momentum ≥ %")}${chk("w.needSoc", "sosyal hesap şart")}</div>
      <div class="plan-foot">Yeni token ilk filtreleri geçerse bekleme süresi boyunca bonding curve canlı izlenir; sonunda momentum ≥ eşik, risk ≤ eşik ve zirveden %20'den az düşmüşse RİSK ajanının boyutuyla alınır.</div></details>
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
      <label class="chk real-chk"><input type="checkbox" id="mm-autostart" ${C.autoStart ? "checked" : ""}> ⚠ otomatik başlat <small>(sayfa açılınca OTO kendiliğinden başlar; GERÇEK modda BOT CÜZDANI kilidini açtığın an)</small></label></details>
    <div class="plan-foot">SIM: gerçek canlı piyasa verisi (PumpPortal + Solana RPC), gerçekçi dolum (bonding curve, gecikme sonrası fiyat, pump.fun %1.25 + PumpPortal %0.5 + öncelik + ağ ücreti + token hesabı kirası), hiçbir işlem gönderilmez. GERÇEK: BOT CÜZDANI. Sayfa yenilenince OTO <b>kapalı</b> başlar (otomatik başlat açık değilse). Yatırım tavsiyesi değildir.</div>`; }
function bind(){ const box = $("#meme-box");
  box.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $("#mm-arm").onclick = async () => { if (ST.on) stop("elle kapatıldı"); else await arm(); };
  box.querySelectorAll("[data-m]").forEach(i => i.addEventListener("change", () => { try { setP(i.dataset.m, i.type === "checkbox" ? i.checked : i.value); if (i.dataset.m === "dep" && !isReal() && !SIM.n && !SIM.pos.length){ SIM = simNew(C.dep); simSave(); } paint(true); } catch(e){ NOTIFY.toast("✖ " + e.message, "bad"); if (i.type === "checkbox") i.checked = !!getP(i.dataset.m); else i.value = getP(i.dataset.m); } }));
  box.querySelectorAll("[data-x]").forEach(i => i.addEventListener("change", () => { const k = i.dataset.x; let v = i.type === "checkbox" ? i.checked : i.value.trim();
    if (k === "rpc" && v && !/^https:\/\//.test(v)){ NOTIFY.toast("RPC https:// ile başlamalı", "bad"); return; } if (k === "ws" && v && !/^wss:\/\//.test(v)){ NOTIFY.toast("WS wss:// ile başlamalı", "bad"); return; }
    if (k === "tip"){ v = +v.replace(",", "."); if (!(v >= 0.00001 && v <= 0.01)){ NOTIFY.toast("Jito bahşişi 0.00001–0.01 SOL", "bad"); return; } } if (k === "simDelay"){ v = +v; if (!(v >= 150 && v <= 10000)){ NOTIFY.toast("150–10000 ms", "bad"); return; } }
    X().set({ [k]: v }); NOTIFY.toast("Kaydedildi", "good"); }));
  $("#mm-autostart").onchange = async e => { if (e.target.checked){ const ok = await CONN.typedConfirm("OTOMATİK BAŞLAT", `Sayfayı her açtığında OTO <b>kendiliğinden</b> başlar (${C.mode} mod${isReal() ? ": BOT CÜZDANI kilidini açtığın an, onay sormadan gerçek SOL ile" : ""}). Kapatmak için bu kutuyu kaldır ya da ■ HEPSİNİ DURDUR.`, "BAŞLAT"); if (!ok){ e.target.checked = false; return; } }
    C.autoStart = e.target.checked; save(); };
  $("#mm-simreset").onclick = () => simReset();
  $("#cp-add").onclick = () => { try { COPY.add($("#cp-addr").value, $("#cp-lab").value); $("#cp-addr").value = ""; $("#cp-lab").value = ""; NOTIFY.toast("Takibe alındı", "good"); paintWallets(); } catch(e){ NOTIFY.toast("✖ " + e.message, "bad"); } };
  $("#cp-disc").onclick = async () => { const b = $("#cp-disc"), el = $("#cp-disc-res"); b.disabled = true; el.innerHTML = `<div class="empty">pump.fun'daki tüm işlemler 12 sn dinleniyor…</div>`;
    try { const r = await COPY.discover(12); el.innerHTML = `<div class="plan-foot">${r.trades} işlem · ${r.wallets} cüzdan. İşlem sayısına göre ilk 10 (çoğu bot olabilir — takip etmeden önce Solscan'de bak):</div>` + r.top.map(u => `<div class="disc"><a href="https://solscan.io/account/${esc(u.addr)}" target="_blank" rel="noopener">${short(u.addr)} ↗</a><span>${u.n} işlem · ${u.buys}A/${u.sells}S · ${u.mints} token · hacim ${fmt(u.vol, 2)} · net <b class="${u.net >= 0 ? "up" : "dn"}">${sg(u.net, 2)}</b></span><button type="button" class="mini" data-trk="${esc(u.addr)}">TAKİP</button></div>`).join("");
      el.querySelectorAll("[data-trk]").forEach(x => x.onclick = () => { try { COPY.add(x.dataset.trk, ""); x.textContent = "✔"; x.disabled = true; paintWallets(); } catch(e){ NOTIFY.toast("✖ " + e.message, "bad"); } }); }
    catch(e){ el.innerHTML = `<div class="err-line">✖ ${esc(e.message)}</div>`; } b.disabled = false; };
  $("#mm-probe").onclick = async () => { const b = $("#mm-probe"), el = $("#mm-probe-res"); b.disabled = true; el.innerHTML = `<div class="empty">ölçülüyor…</div>`; const mint = (PUMP._S.feed[0] || {}).mint;
    const r = await X().probe(mint); el.innerHTML = r.map(([k, v, ok]) => `<div><span>${esc(k)}</span><b class="${ok ? "" : "dn"}">${ok ? ms(v) : "✖"}</b></div>`).join(""); b.disabled = false; };
  paint(true); }
function render(){ const box = $("#meme-box"); if (!box) return; box.innerHTML = html(); bind(); orbInit(); }
/* ---- dynamic painting ---- */
let lastFull = 0;
function paint(full){ if (document.hidden) return; if (!$("#mm-eq")) return; const e = equity(), d = depBase(), su = PUMP.solUsd;
  $("#mm-eq").textContent = e === null ? (isReal() ? "…" : "—") : fmt(e, 4);
  $("#mm-usd").textContent = e !== null && su ? "≈ $" + (e*su).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "";
  const dp = e !== null && d ? (e/d - 1)*100 : null; $("#mm-dep").innerHTML = dp === null ? "" : `<b class="${dp >= 0 ? "up" : "dn"}">${pc(dp)}</b> yatırımdan beri <small>(${fmt(d, 3)} SOL${isReal() ? "" : " sanal"})</small>`;
  const au = $("#mm-auto"); au.textContent = ST.on ? "● OTO AÇIK" : "○ OTO KAPALI"; au.className = "pill " + (ST.on ? "g" : "");
  const arm = $("#mm-arm"); arm.textContent = ST.on ? "■ OTO DURDUR" : "▶ OTO BAŞLAT"; arm.classList.toggle("on", ST.on);
  const J = JOURNAL.list().filter(x => x.venue === "pump.fun" && x.wallet === walletTag() && typeof x.pnl === "number"), w = J.filter(x => x.pnl > 0).length, tp = todayPnl();
  $("#mm-kpis").innerHTML = `<div><small>BUGÜN</small><b class="${tp >= 0 ? "up" : "dn"}">${sg(tp, 4)}</b></div><div><small>İŞLEM</small><b>${J.length}</b></div><div><small>KAZANMA</small><b>${J.length ? Math.round(w/J.length*100) + "%" : "—"}</b></div><div><small>AÇIK</small><b>${posList().length}/${C.maxPos}</b></div>`;
  paintPos(); paintAgents(); paintLadder(); paintLat(); drawEq(); if (full || Date.now() - lastFull > 5000){ lastFull = Date.now(); paintTL(); paintTape(); paintWallets(); } }
const srcLab = s => s === "copy" ? "KOPYA" : s === "watcher" ? "İZLEYİCİ" : s === "grok" ? "GROK" : "ELLE";
function paintPos(){ const el = $("#mm-pos"); if (!el) return; const L = posList(); $("#mm-posn").textContent = L.length ? `${L.length} · ${fmt(deployed(), 3)} SOL` : "";
  el.innerHTML = L.length ? L.map(p => { const mo = ST.mons.get(p.mint) || {}, pn = mo.pnl, has = isFinite(pn) && pn !== null; return `<div class="pos ${!has ? "" : pn >= 0 ? "l" : "s"}"><b>${esc(p.sym)} <span class="pill ${p.src === "copy" ? "m" : "y"}">${srcLab(p.src)}</span>${p.wallet ? ` <small>${esc(lab(p.wallet))}</small>` : ""}</b>
    <span>${fmt(p.tokens, 0)}${p.estTok ? "~" : ""} adet · maliyet ${fmt(p.solIn, 4)} SOL · ${Math.floor((Date.now() - p.t)/60000)} dk${mo.mcap ? " · mcap " + fmt(mo.mcap, 1) : ""}</span>
    <span class="${has && pn >= 0 ? "up" : "dn"}">${!has ? "canlı fiyat bekleniyor…" : `≈ ${fmt(mo.val, 4)} SOL (${pc(pn)})${mo.hi > 0 ? " · zirve " + pc(mo.hi) : ""}`}</span><button type="button" data-sell="${esc(p.mint)}">SAT</button></div>`; }).join("") : `<div class="empty">açık pozisyon yok${ST.on ? " — ajanlar fırsat arıyor" : ""}</div>`;
  el.querySelectorAll("[data-sell]").forEach(b => b.onclick = () => manual(b.dataset.sell, "sell")); }
function paintAgents(){ if (!$("#agb-w")) return; const s = X().stats(), cpOn = COPY.list.filter(w => w.on !== false).length;
  const st = (id, txt, on) => { const e = $("#ags-" + id); e.textContent = txt; e.className = "ag-st " + (on ? "on" : ""); $("#ag-" + id).classList.toggle("live", !!on); };
  st("w", ST.on && C.w.on ? "● İZLİYOR" : C.w.on ? "○ hazır" : "kapalı", ST.on && C.w.on);
  $("#agb-w").innerHTML = `<div><span>görülen</span><b>${ST.seen}</b></div><div><span>filtreyi geçen</span><b>${ST.passed}</b></div><div><span>aday</span><b>${ST.cands.size}</b></div><div><span>yeni/dk</span><b>${PUMP._S.rate.length}</b></div><div class="ag-l">${esc(ST.wLast || "yeni token bekleniyor")}</div>`;
  st("c", ST.on && C.cp.on && cpOn ? "● KOPYALIYOR" : !cpOn ? "cüzdan yok" : C.cp.on ? "○ hazır" : "kapalı", ST.on && C.cp.on && cpOn);
  $("#agb-c").innerHTML = `<div><span>cüzdan</span><b>${cpOn}/${COPY.list.length}</b></div><div><span>WS abonelik</span><b class="${COPY.live ? "up" : "dim"}">${COPY.live ? COPY.subs + (COPY.poll.on ? " +HTTP" : "") : "—"}</b></div><div><span>görülen işlem</span><b>${COPY.list.reduce((a, w) => a + COPY.stat(w.addr).n, 0)}</b></div><div><span>kopya</span><b>${JOURNAL.list().filter(x => x.src === "copy" && x.wallet === walletTag() && x.openT >= today0()).length}</b></div><div class="ag-l">${ST.lastCopy ? `son: <b>${esc(ST.lastCopy.sym)}</b> ← ${esc(lab(ST.lastCopy.w))} · ${tm(ST.lastCopy.at)}` : ST.cpSkip ? esc(ST.cpSkip) : "henüz kopya yok"}</div>`;
  st("x", s.pend ? "● GÖNDERİYOR" : isReal() ? (W().unlocked() ? "● HAZIR" : "🔒 kilitli") : "SIM", s.pend || (isReal() && W().unlocked()));
  $("#agb-x").innerHTML = `<div><span>olay→gön.</span><b>${ms(s.ev2sent)}</b></div><div><span>gön.→onay</span><b>${ms(s.sent2conf)}</b></div><div><span>onay/hata</span><b>${s.conf}/${s.fail}</b></div><div><span>blockhash</span><b>${s.bhAge === null ? "—" : (s.bhAge/1000).toFixed(1) + " sn"}</b></div><div class="ag-l">${isReal() ? `RPC ${X().rpcs().length}${X().C.jito ? " + Jito" : ""}${s.bhVia ? " · en hızlı " + esc(s.bhVia) + " " + ms(s.bhRtt) : ""}` : `SIM: gönderim yok · dolum canlı curve'den${s.bhVia ? " · RPC " + esc(s.bhVia) + " " + ms(s.bhRtt) : ""}`}</div>`;
  const paused = R.pauseUntil > Date.now(), dl = todayPnl();
  st("r", paused ? "⏸ ARA" : dl <= -C.dailyLoss ? "■ GÜNLÜK STOP" : "● KORUYOR", !paused && dl > -C.dailyLoss);
  $("#agb-r").innerHTML = `<div><span>boyut çarpanı</span><b class="${R.mult < 1 ? "y" : ""}">${R.mult}x</b></div><div><span>ardışık kayıp</span><b>${R.consec}</b></div><div><span>bugün</span><b class="${dl >= 0 ? "up" : "dn"}">${sg(dl, 3)}</b></div><div><span>hesap zirvesi</span><b>${fmt(R.eqHigh, 3)}</b></div><div class="ag-l">${paused ? `ara: ${tm(R.pauseUntil)}'e kadar` : `sıradaki boyut ${fmt(riskSize("watcher"), 3)} SOL`}${C.gk.gate ? ` · GROK ${ST.gk.yes}✔ ${ST.gk.no}✖ ${ST.gk.to}⌛` : ""}</div>`; }
let agQ = false; const paintAgentsQ = () => { if (agQ) return; agQ = true; setTimeout(() => { agQ = false; paintAgents(); }, 400); };
function paintLadder(){ const el = $("#mm-lad"); if (!el) return; const lv = [1, 0.5, 0.25], dl = Math.max(0, -todayPnl()), used = Math.min(1, dl/C.dailyLoss), paused = R.pauseUntil > Date.now();
  el.innerHTML = `<div class="rungs">${lv.map(x => `<div class="rung ${R.mult === x ? "on" : ""}"><b>${x}x</b><span>${fmt(Math.min(C.maxTrade, C.base*x), 3)} SOL</span><small>${x === 1 ? "tam · yalnızca yeni zirvede" : x === 0.5 ? "1 kayıp sonrası" : "art arda kayıp"}</small></div>`).join("")}</div>
    <div class="lad-r"><div><small>GÜNLÜK ZARAR LİMİTİ</small><div class="bar"><div style="width:${(used*100).toFixed(0)}%" class="${used > .7 ? "r" : used > .4 ? "y" : ""}"></div></div><span>${fmt(dl, 3)} / ${C.dailyLoss} SOL</span></div>
    <div><small>ARDIŞIK KAYIP</small><div class="dots">${[0, 1].map(i => `<i class="${R.consec > i ? "on" : ""}"></i>`).join("")}</div><span>${paused ? "⏸ " + Math.ceil((R.pauseUntil - Date.now())/60000) + " dk ara" : "2 kayıp = " + C.rules.pauseMin + " dk ara"}</span></div>
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
if (C.autoStart){ if (!isReal()) setTimeout(() => arm(true).then(ok => ok && NOTIFY.toast("otomatik başlat: OTO açıldı (SIM)", "good")), 1500);
  else { const iv = setInterval(() => { if (ST.on || !C.autoStart || C.mode !== "GERÇEK"){ clearInterval(iv); return; } if (W().unlocked()){ clearInterval(iv); arm(true).then(ok => ok && NOTIFY.ping("bad", "otomatik başlat: GERÇEK OTO açıldı")); } }, 2000); } }
return { get on(){ return ST.on; }, get mode(){ return C.mode; }, arm, stop, kill, manual, context, applySuggestion, gateInfo, render, paint, fab, get C(){ return C; }, setP, _ST: ST, get SIM(){ return SIM; }, get R(){ return R; }, equity, posList };
})();
window.MEME = MEME;
