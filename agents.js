/* NEON//TERMINAL v7.6 — the crypto versions of the day-trader-skill agents, wired into the MEME pipeline.
   TARAYICI · GİRİŞ · ÇIKIŞ · BÜTÇE · ALARM · HABER · AKILLI PARA · RUG DEDEKTÖRÜ · ZAMAN MAKİNESİ (pure math in agentcore.js).
   None of these agents can place an order. Buys still go only through MEME.enter (risk checks + executor); sells through MEME.exit.
   Copier suggestions from AKILLI PARA are added only when the user taps TAKİP. Grok still cannot trade. */
"use strict";
const AGENTS = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (x, d = 2) => (x === null || x === undefined || !isFinite(+x)) ? "—" : (+x).toLocaleString("en-US", { maximumFractionDigits: d });
const pc = x => x === null || x === undefined || !isFinite(x) ? "—" : (x >= 0 ? "+" : "") + (+x).toFixed(1) + "%";
const short = a => a ? String(a).slice(0, 4) + "…" + String(a).slice(-4) : "—";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin", tm = ms => new Date(ms).toLocaleTimeString("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const M = () => window.MEME, A = () => window.ACORE;
const ld = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? d; } catch(e){ return d; } }, sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
const CK = "neon.ag";
const DEF = { rugMax: 70, entryGate: false, orSec: 8, brk: 3, smBoost: true, smMin: 0.3, news: true, perps: true, tmN: 80 };
let C = Object.assign({}, DEF, ld(CK, {})); const save = () => sv(CK, C);
const RANGE = { rugMax: [10, 100], orSec: [2, 120], brk: [0, 100], smMin: [0, 100], tmN: [10, 300] }, BOOL = new Set(["entryGate", "smBoost", "news", "perps"]);
function set(k, v){ if (BOOL.has(k)) v = v === true || v === "true"; else { const r = RANGE[k]; if (!r) throw new Error("bilinmeyen ayar: " + k); v = +String(v).replace(",", "."); if (!(v >= r[0] && v <= r[1])) throw new Error(`${k} ${r[0]}–${r[1]}`); } C[k] = v; save(); return v; }
const ENG = () => (typeof ENGINE !== "undefined" ? ENGINE : null);
const rpc = (m, p) => window.TRADE && TRADE.ph.rpc(m, p);
/* ===================== AKILLI PARA ===================== */
const SMK = "neon.ag.sm"; const SM = { book: new Map(), n: 0, seenTok: new Set(), lastSave: 0 };
(() => { const o = ld(SMK, null); if (o && Array.isArray(o.w)) for (const w of o.w) SM.book.set(w.a, { real: w.r, buys: w.b, sells: w.s, wins: w.wi, losses: w.lo, vol: w.v, mints: new Set(Array.from({ length: w.m || 0 }, (_, i) => "x" + i)), last: w.t }); SM.n = (o && o.n) || 0; })();
function smSave(){ const L = [...SM.book].filter(([a, w]) => a !== "_pos" && w.real !== undefined).sort((a, b) => Math.abs(b[1].real) - Math.abs(a[1].real)).slice(0, 400);
  sv(SMK, { n: SM.n, w: L.map(([a, w]) => ({ a, r: +w.real.toFixed(5), b: w.buys, s: w.sells, wi: w.wins, lo: w.losses, v: +w.vol.toFixed(4), m: w.mints.size, t: w.last })) }); SM.lastSave = Date.now(); }
function onTrade(mint, x){ if (!x.user || !(x.tok > 0)) return; SM.n++; SM.seenTok.add(mint); A().smPnl([{ user: x.user, mint, sol: x.sol, tok: x.tok, isBuy: x.isBuy, t: x.t }], SM.book); if (Date.now() - SM.lastSave > 30000) smSave(); }
const smTop = () => A().smTop(SM.book, { minReal: C.smMin, n: 15 });
function smBoost(fl){ if (!C.smBoost || !fl || !fl.trades) return { bonus: 0, hits: [] }; const top = new Set(smTop().map(w => w.addr)); const hits = [...new Set(fl.trades.filter(x => x.isBuy && top.has(x.user)).map(x => x.user))];
  return { bonus: Math.min(10, hits.length*5), hits }; }
/* ===================== RUG DEDEKTÖRÜ ===================== */
const RUG = { info: new Map(), n: 0, rej: 0, last: null };
async function rugProbe(t){ if (RUG.info.has(t.mint)) return; const I = { at: Date.now() }; RUG.info.set(t.mint, I); if (RUG.info.size > 300){ const k = RUG.info.keys().next().value; RUG.info.delete(k); }
  try { const mi = await rpc("getAccountInfo", [t.mint, { encoding: "jsonParsed" }]); const inf = mi && mi.value && mi.value.data && mi.value.data.parsed && mi.value.data.parsed.info; if (inf){ I.mintAuth = !!inf.mintAuthority; I.freezeAuth = !!inf.freezeAuthority; } } catch(e){ I.err = 1; }
  try { if (t.creator){ const L = await rpc("getSignaturesForAddress", [t.creator, { limit: 300 }]); if (Array.isArray(L)) I.devTx = L.length; } } catch(e){}
  try { const r = await rpc("getTokenLargestAccounts", [t.mint, { commitment: "confirmed" }]); const a = (r && r.value || []).map(x => +x.uiAmount || 0); if (a.length) I.top10 = a.slice(1, 11).reduce((s, x) => s + x, 0)/1e9*100; } catch(e){} }
function rugFor(t, c, m){ const I = RUG.info.get(t.mint) || {}; const soc = t.meta && (t.meta.tw || t.meta.tg || t.meta.web);
  const r = A().rugScore({ mintAuth: I.mintAuth, freezeAuth: I.freezeAuth, serial: t.serial, devTx: I.devTx, devPct: t.devPct, top10: I.top10, bundle: m ? m.earlyShare : 0, sameFrac: m ? m.sameFrac : 0, earlyJump: m ? m.earlyJump : 0, oddCurve: c && c.odd, devSold: m && m.devSold, noSoc: t.meta ? !soc : false });
  RUG.n++; RUG.last = { sym: t.symbol, risk: r.risk, f: r.F.slice(0, 3).map(f => f[1]), at: Date.now() }; return r; }
/* ===================== ZAMAN MAKİNESİ ===================== */
const TMK = "neon.ag.tm"; let TMP = ld(TMK, []); const TM = { live: 0, last: null, lastAt: 0 };
function tmRecord(t, key, m0, score){ if (!key || !(m0 > 0) || TM.live >= 12) return; TM.live++; const rec = { t: Date.now(), sym: t.symbol, s: score, p: [1] }; let cur = m0;
  const un = PUMP.curveSub(key, c => { cur = c.mcap; }); const iv = setInterval(() => { rec.p.push(+(cur/m0).toFixed(4)); if (rec.p.length >= 300) fin(); }, 1000);
  const fin = () => { clearInterval(iv); un(); TM.live--; if (rec.p.length >= 30){ TMP.unshift(rec); TMP = TMP.slice(0, C.tmN); sv(TMK, TMP); } };
  setTimeout(() => { if (TM.live && rec.p.length < 300) fin(); }, 310000); }
function tmRun(score){ const x = M().xcfg(), sim = TMP.filter(r => score == null || r.s == null || Math.abs(r.s - score) <= 15), use = sim.length >= 8 ? sim : TMP;
  const res = A().tmReplay(use, x, { exitDecide: SCORE.exitDecide }); res.similar = use === sim && score != null; res.score = score; TM.last = res; TM.lastAt = Date.now(); return res; }
/* ===================== GİRİŞ ===================== */
const EN = { st: new Map(), trig: 0, exp: 0, n: 0 };
/* final = called at the buy decision: the watch window is over, so "no break yet" counts as expired */
function entryFor(mint, final){ const fl = M().FLOW.flow(mint), c = M()._ST.cands.get(mint); if (!fl || !c) return null; const path = fl.mcaps.filter(p => p[0] >= c.at);
  const s = A().entryState(path, { orSec: C.orSec, brk: C.brk, expSec: final ? 0 : M().C.w.waitSec + 4, now: Date.now() }); EN.st.set(mint, Object.assign({ sym: c.t.symbol }, s)); return s; }
/* ===================== TARAYICI ===================== */
const SCN = { rank: [], perps: [], perpAt: 0, perpErr: null, perpN: 0, busy: false };
function scanTokens(){ const ST = M()._ST, out = []; for (const [mint, c] of ST.cands){ const fl = M().FLOW.flow(mint); if (!fl) continue; const sc = SCORE.pumpScore(fl, Date.now(), M().C.sc);
    out.push({ mint, sym: c.t.symbol, score: sc.score, hard: sc.hard, src: fl.src, age: Math.round((Date.now() - c.at)/1000), learn: c.learn }); entryFor(mint); }
  SCN.rank = out.sort((a, b) => b.score - a.score); }
async function scanPerps(){ if (!C.perps || SCN.busy || !ENG() || Date.now() - SCN.perpAt < 300000) return; SCN.busy = true;
  try { const T = await ENG().fx("/fapi/v1/ticker/24hr"); const L = T.filter(x => /USDT$/.test(x.symbol)).sort((a, b) => +b.quoteVolume - +a.quoteVolume).slice(0, 30); const hits = [];
    for (let i = 0; i < L.length; i += 5) await Promise.all(L.slice(i, i + 5).map(async x => { try { const k = await ENG().fx(`/fapi/v1/klines?symbol=${x.symbol}&interval=1h&limit=60`); const c = k.map(b => +b[4]); const s = A().perpSetups(c);
      if (s.tags.length) hits.push({ sym: x.symbol, tags: s.tags, rsi: s.rsi, px: c[c.length-1], chg: +x.priceChangePercent }); } catch(e){} }));
    SCN.perps = hits; SCN.perpN = L.length; SCN.perpAt = Date.now(); SCN.perpErr = null; }
  catch(e){ SCN.perpErr = e.message || String(e); SCN.perpAt = Date.now() - 240000; } finally { SCN.busy = false; } }
/* ===================== ALARM ===================== */
const ALK = "neon.ag.alarms"; let AL = ld(ALK, []); const ALS = { px: new Map(), pxAt: 0, fired: 0, last: null, tok: new Map() };
function alAdd(o){ const kind = o.kind === "perp" ? "perp" : o.kind === "pnl" ? "pnl" : "token"; const ref = String(o.ref || "").trim(); if (!ref) throw new Error("token / sembol gerekli");
  if (kind === "perp" && !/^[A-Z0-9]{2,20}USDT$/.test(ref.toUpperCase())) throw new Error("perp sembolü örn. BTCUSDT"); if (kind !== "perp" && !(window.COPY && COPY.valid(ref))) throw new Error("geçersiz mint");
  const lvl = +String(o.lvl).replace(",", "."); if (!isFinite(lvl)) throw new Error("seviye sayı olmalı"); const op = o.op === "<=" ? "<=" : ">=";
  const a = { id: "a" + Date.now().toString(36), kind, ref: kind === "perp" ? ref.toUpperCase() : ref, op, lvl, sym: o.sym || (kind === "perp" ? ref.toUpperCase() : short(ref)), at: Date.now(), fired: false }; AL.unshift(a); AL = AL.slice(0, 30); sv(ALK, AL);
  try { if (window.Notification && Notification.permission === "default") Notification.requestPermission(); } catch(e){} return a; }
function alDel(id){ AL = AL.filter(a => a.id !== id); sv(ALK, AL); }
async function alTick(){ const live = AL.filter(a => !a.fired); if (!live.length) return;
  if (live.some(a => a.kind === "perp") && Date.now() - ALS.pxAt > 5000 && ENG()){ ALS.pxAt = Date.now(); try { const L = await ENG().fx("/fapi/v1/ticker/price"); for (const x of L) ALS.px.set(x.symbol, +x.price); } catch(e){} }
  for (const a of live){ let v = null;
    if (a.kind === "perp") v = ALS.px.get(a.ref);
    else if (a.kind === "pnl"){ const mo = M()._ST.mons.get(a.ref); v = mo && isFinite(mo.pnl) ? mo.pnl : null; }
    else { const mo = M()._ST.mons.get(a.ref); if (mo && mo.mcap) v = mo.mcap; else { const e = ALS.tok.get(a.ref); if (!e || Date.now() - e.at > 5000){ ALS.tok.set(a.ref, { at: Date.now(), v: e && e.v }); const t = PUMP.get(a.ref);
          (async () => { try { const k = t && t.curve; const cv = k ? await PUMP.curveNow(k) : null; if (cv) ALS.tok.set(a.ref, { at: Date.now(), v: cv.mcap }); } catch(err){} })(); } v = e && e.v; } }
    a.v = v; if (A().alertHit(a, v)) ring(a, v); } }
function ring(a, v){ a.fired = true; a.firedAt = Date.now(); a.fv = v; sv(ALK, AL); ALS.fired++; ALS.last = a;
  const msg = `ALARM ${a.sym}: ${a.kind === "pnl" ? "K/Z " + pc(v) : a.kind === "perp" ? "$" + fmt(v, 6) : "mcap " + fmt(v, 1) + " SOL"} ${a.op} ${a.lvl}`;
  NOTIFY.ping("bad", msg); try { navigator.vibrate && navigator.vibrate([200, 80, 200, 80, 400]); } catch(e){}
  try { if (window.Notification && Notification.permission === "granted") new Notification("NEON ALARM", { body: msg, tag: a.id }); } catch(e){} }
/* ===================== HABER ===================== */
const NWK = "neon.ag.news"; const NW = { items: ld(NWK + ".i", []), seen: new Set(ld(NWK + ".s", [])), at: 0, err: {}, newN: 0, busy: false };
async function getJ(u){ const r = await fetch(u, { signal: AbortSignal.timeout(8000), cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
async function newsTick(){ if (!C.news || NW.busy || Date.now() - NW.at < 120000) return; NW.busy = true; NW.at = Date.now(); const fresh = [];
  const track = new Set([...M()._ST.cands.keys(), ...M().posList().map(p => p.mint)]);
  const push = (key, it) => { if (NW.seen.has(key)) return; NW.seen.add(key); if (track.has(it.addr)) it.tags.unshift("ADAY/POZ"); fresh.push(Object.assign({ k: key, t: Date.now() }, it)); };
  const ds = async (u, tag) => { try { const L = await getJ(u); for (const x of (Array.isArray(L) ? L : []).slice(0, 30)){ const tags = [tag]; if (x.chainId) tags.push(x.chainId.toUpperCase()); if (/pump$/.test(x.tokenAddress || "")) tags.push("pump.fun");
      if ((x.links || []).some(l => /twitter|x\.com/.test(l.url || "") || l.type === "twitter")) tags.push("X"); if ((x.links || []).some(l => l.type === "telegram")) tags.push("TG");
      push(tag + ":" + x.chainId + ":" + x.tokenAddress + (x.totalAmount ? ":" + x.totalAmount : ""), { addr: x.tokenAddress, chain: x.chainId, txt: (x.description || "").slice(0, 90), url: x.url, tags, amt: x.totalAmount || null }); } NW.err[tag] = null; } catch(e){ NW.err[tag] = e.message; } };
  await ds("https://api.dexscreener.com/token-boosts/latest/v1", "BOOST"); await ds("https://api.dexscreener.com/token-profiles/latest/v1", "PROFİL");
  try { const j = await getJ("https://api.coingecko.com/api/v3/search/trending"); for (const c of (j.coins || []).slice(0, 15)){ const it = c.item || {}; push("CG:" + it.id + ":" + new Date().toISOString().slice(0, 13), { addr: it.id, chain: "cg", txt: `${it.name} (${it.symbol}) · sıra #${it.market_cap_rank ?? "—"}`, url: "https://www.coingecko.com/en/coins/" + it.id, tags: ["CG-TREND", "#" + (it.score + 1)] }); } NW.err.CG = null; } catch(e){ NW.err.CG = e.message; }
  NW.newN = fresh.length; NW.items = fresh.concat(NW.items).slice(0, 80); sv(NWK + ".i", NW.items); sv(NWK + ".s", [...NW.seen].slice(-1500)); NW.busy = false; }
/* ===================== hooks from MEME ===================== */
function onCand(t){ rugProbe(t).catch(() => {}); }
/* called by MEME.decide just before the score gate; returns { bonus, reject, notes } */
function gate(t, c, fl, m){ const out = { bonus: 0, reject: null, notes: [] };
  const sb = smBoost(fl); if (sb.bonus){ out.bonus = sb.bonus; out.notes.push(`akıllı para ${sb.hits.length} cüzdan +${sb.bonus}`); }
  const r = rugFor(t, c, m); out.rug = r.risk; if (r.risk >= C.rugMax){ out.reject = `RUG riski ${r.risk} ≥ ${C.rugMax} (${r.F.slice(0, 2).map(f => f[1]).join(", ")})`; RUG.rej++; } else out.notes.push(`rug ${r.risk}`);
  const e = entryFor(t.mint, true) || { st: "süresi doldu" }; out.entry = e.st; if (e.st === "tetiklendi") EN.trig++; else if (e.st === "süresi doldu") EN.exp++; EN.n++;
  if (!out.reject && C.entryGate && e.st !== "tetiklendi") out.reject = `GİRİŞ tetiği yok (${e.st})`;
  return out; }
function onScored(t, c, sc){ const key = (c.e && c.e.key) || t.curve; tmRecord(t, key, c.last, sc && sc.score); }
/* ===================== UI ===================== */
const CARDS = [["s", "🛰", "TARAYICI", "#00f0ff"], ["e", "⏱", "GİRİŞ", "#7df9ff"], ["o", "🎯", "ÇIKIŞ", "#ff9f1c"], ["b", "⚖", "BÜTÇE", "#a0ff6a"], ["a", "🔔", "ALARM", "#ffe600"], ["n", "📰", "HABER", "#ff2bd6"], ["m", "🐋", "AKILLI PARA", "#39ff14"], ["g", "☠", "RUG DEDEKTÖRÜ", "#ff3355"], ["t", "⌛", "ZAMAN MAKİNESİ", "#b58cff"]];
const row = (k, v, c) => `<div><span>${k}</span><b class="${c || ""}">${v}</b></div>`;
function st(id, txt, on){ const e = document.getElementById("ags-" + id); if (!e) return; e.textContent = txt; e.className = "ag-st " + (on ? "on" : ""); const g = document.getElementById("ag-" + id); g && g.classList.toggle("live", !!on); }
function body(id, html){ const e = document.getElementById("agb-" + id); if (e && !e.contains(document.activeElement)) e.innerHTML = html; }
function paint(){ if (!window.MEME || !document.getElementById("agb-s")) return; const on = M().on, ST = M()._ST;
  // TARAYICI
  st("s", on || M().C.sc.learn ? "● TARIYOR" : "○ hazır", on || M().C.sc.learn);
  body("s", SCN.rank.slice(0, 5).map(r => row(`${esc(r.sym)} <small>${r.age} sn${r.learn ? " · öğrenme" : ""}</small>`, `${r.score}${r.hard ? " ✖" : ""}`, r.score >= M().C.sc.min && !r.hard ? "up" : "")).join("")
    + SCN.perps.slice(0, 5).map(p => row(`${esc(p.sym.replace("USDT", ""))} <small>${esc(p.tags.join(", "))}</small>`, `${pc(p.chg)}`, p.chg >= 0 ? "up" : "dn")).join("")
    + `<div class="ag-l">${SCN.rank.length ? SCN.rank.length + " aday canlı puanlanıyor · en iyi " + esc(SCN.rank[0].sym) + " " + SCN.rank[0].score : "aday yok"} · perp ${SCN.perpAt ? SCN.perps.length + "/" + SCN.perpN + " kurulum (" + tm(SCN.perpAt) + ")" : SCN.perpErr ? "hata: " + esc(SCN.perpErr.slice(0, 30)) : C.perps ? "taranıyor…" : "kapalı"}</div>`);
  // GİRİŞ
  const est = [...EN.st].filter(([m]) => ST.cands.has(m)).map(([, s]) => s); st("e", est.some(s => s.st === "tetiklendi") ? "● TETİK" : est.length ? "○ bekliyor" : "—", est.some(s => s.st === "tetiklendi"));
  body("e", est.slice(0, 4).map(s => row(esc(s.sym), esc(s.st), s.st === "tetiklendi" ? "up" : s.st === "süresi doldu" ? "dn" : "y")).join("") + `<div class="ag-l">${est[0] ? esc(est[0].sym + ": " + est[0].why) : "aday bekleniyor"} · oturum: ${EN.trig} tetik / ${EN.exp} süre doldu / ${EN.n} karar${C.entryGate ? " · KAPI AÇIK" : " · yalnızca kayıt"}</div>`);
  // ÇIKIŞ
  const P = M().posList(), x = M().xcfg(); st("o", P.length ? `● ${P.length} PLAN` : "○ pozisyon yok", P.length > 0);
  body("o", P.slice(0, 4).map(p => { const mo = ST.mons.get(p.mint) || {}; if (!isFinite(mo.pnl) || mo.pnl === null) return row(esc(p.sym), "fiyat bekleniyor"); const pl = A().exitPlan({ pnl: mo.pnl, hi: mo.hi, ageSec: (Date.now() - p.t)/1000, partDone: !!p.part, sinceHiSec: (Date.now() - (mo.hiAt || p.t))/1000 }, x);
    return row(`${esc(p.sym)} <small>${pc(mo.pnl)}</small>`, `stop ${pc(pl.stop.lvl)} · hedef ${pc(pl.target.lvl)}`, mo.pnl >= 0 ? "up" : "dn"); }).join("")
    + `<div class="ag-l">${P.length ? (() => { const p = P[0], mo = ST.mons.get(p.mint) || {}; if (!isFinite(mo.pnl) || mo.pnl === null) return "plan fiyat gelince"; const pl = A().exitPlan({ pnl: mo.pnl, hi: mo.hi, ageSec: (Date.now() - p.t)/1000, partDone: !!p.part, sinceHiSec: (Date.now() - (mo.hiAt || p.t))/1000 }, x); return esc(`${p.sym}: ${pl.stop.lab} · ${pl.target.lab} · ${pl.timeLeftMin.toFixed(0)} dk kaldı`); })() : x.on ? `plan: erken −%${x.early} · kısmi +%${x.ptp} · iz %${x.trailLo}/%${x.trailHi} · sert −%${x.sl}` : "dinamik çıkış kapalı"}</div>`);
  // BÜTÇE
  const sz = M().sizeWhy("watcher"); st("b", sz.size > 0 ? "● " + fmt(sz.size, 4) + " SOL" : "■ giriş yok", sz.size > 0);
  body("b", row("ham giriş", fmt(sz.raw, 4) + " SOL") + row("risk çarpanı", sz.riskMult + "x") + row("işlem başı max", sz.free ? "serbest" : fmt(M().C.maxTrade, 3)) + row("bütçe kalan", sz.free ? "serbest" : fmt(sz.room, 4)) + row("nakit − ücret", fmt(sz.cashRoom, 4)) + `<div class="ag-l">sıradaki giriş ${fmt(sz.size, 4)} SOL · belirleyen: <b>${esc(sz.by)}</b>${M().C.cmp.on ? " · bileşik açık" : ""}</div>`);
  // ALARM
  const la = AL.filter(a => !a.fired); st("a", la.length ? `● ${la.length} kurulu` : "○ alarm yok", la.length > 0);
  body("a", AL.slice(0, 6).map(a => `<div class="${a.fired ? "dim" : ""}"><span>${esc(a.sym)} ${a.kind === "pnl" ? "K/Z%" : a.kind === "perp" ? "$" : "mcap"} ${a.op} ${a.lvl}${a.fired ? " · ÇALDI " + tm(a.firedAt) : ""}</span><b>${a.v == null ? "—" : fmt(a.v, a.kind === "perp" ? 6 : 2)} <button type="button" class="mini s" data-al-del="${a.id}">✕</button></b></div>`).join("")
    + `<div class="ag-l">${ALS.last ? "son: " + esc(ALS.last.sym) + " " + tm(ALS.last.firedAt) : "her alarm bir kez çalar (ses + titreşim + bildirim)"} · çalan ${ALS.fired}</div>`);
  // HABER
  st("n", C.news ? (NW.at ? "● " + NW.newN + " yeni" : "○ bekliyor") : "kapalı", C.news && NW.newN > 0);
  body("n", NW.items.slice(0, 6).map(i => `<div><span>${i.tags.map(g => `<i class="ag-tag">${esc(g)}</i>`).join("")} <a href="${esc(i.url || "#")}" target="_blank" rel="noopener">${esc(i.txt || short(i.addr))}</a></span><b>${tm(i.t)}</b></div>`).join("")
    + `<div class="ag-l">${NW.at ? "son kontrol " + tm(NW.at) + " · " + NW.newN + " yeni" : "ilk kontrol bekleniyor"} · DexScreener boost/profil + CoinGecko trend${Object.entries(NW.err).filter(([, v]) => v).map(([k, v]) => " · " + k + " ✖").join("")}</div>`);
  // AKILLI PARA
  const top = smTop(); st("m", SM.n ? `● ${top.length} kârlı` : "○ öğreniyor", top.length > 0);
  body("m", top.slice(0, 5).map(w => `<div><span><a href="https://solscan.io/account/${esc(w.addr)}" target="_blank" rel="noopener">${short(w.addr)}</a> <small>${w.wins}K/${w.losses}Z · ${w.mints} token</small></span><b class="up">+${fmt(w.real, 3)} <button type="button" class="mini" data-sm-trk="${esc(w.addr)}" ${COPY.list.some(c => c.addr === w.addr) ? "disabled" : ""}>${COPY.list.some(c => c.addr === w.addr) ? "✔" : "TAKİP"}</button></b></div>`).join("")
    + `<div class="ag-l">${SM.n} işlem · ${[...SM.book.keys()].length - (SM.book.has("_pos") ? 1 : 0)} cüzdan izlendi · kârlı: gerçekleşen ≥ ${C.smMin} SOL, ≥2 kazanç, ≥%60${C.smBoost ? " · alırlarsa skor +5/cüzdan (≤10)" : ""} · kopyacıya yalnızca TAKİP ile</div>`);
  // RUG
  st("g", RUG.n ? `● ${RUG.n} kontrol` : "○ hazır", RUG.n > 0);
  body("g", (RUG.last ? row(esc(RUG.last.sym), RUG.last.risk + "/100", RUG.last.risk >= C.rugMax ? "dn" : RUG.last.risk >= 40 ? "y" : "up") + RUG.last.f.map(f => `<div><span>• ${esc(f)}</span></div>`).join("") : "")
    + `<div class="ag-l">${RUG.n} kontrol · ${RUG.rej} elendi (≥ ${C.rugMax}) · mint/dondurma yetkisi, dev geçmişi, ilk 10 sahip, paket, curve</div>`);
  // ZAMAN MAKİNESİ
  if (Date.now() - TM.lastAt > 30000 && TMP.length){ const p0 = P[0], mo = p0 && ST.mons.get(p0.mint); tmRun(SCN.rank[0] ? SCN.rank[0].score : null); }
  const r = TM.last; st("t", TMP.length ? `● ${TMP.length} yol` : "○ kayıt yok", TMP.length > 0);
  body("t", (r && r.n ? row("önce hedef (TP)", Math.round(r.pTp*100) + "%", "up") + row("önce stop (SL)", Math.round(r.pSl*100) + "%", "dn") + row("ikisi de değil", Math.round(r.pNe*100) + "%") + row("ortalama R", r.avgR) : "")
    + `<div class="ag-l">${TMP.length} kayıtlı aday yolu (5 dk, 1/sn) · ${TM.live} kaydediliyor${r && r.n ? ` · ${r.n} yolda tekrar oynatıldı${r.similar ? " (skoru ±15 benzer)" : ""}` : ""} · <b>tahmindir</b>, ücret %3 düşülür, akış çıkışları yok</div>`);
  const box = document.getElementById("mm-ags");
  if (box && !box._b){ box._b = true; box.addEventListener("click", e => { const d = e.target.closest("[data-al-del]"), t = e.target.closest("[data-sm-trk]");
    if (d){ alDel(d.dataset.alDel); paint(); return; } if (t){ try { COPY.add(t.dataset.smTrk, "akıllı " + t.dataset.smTrk.slice(0, 4)); NOTIFY.toast("Kopyacıya eklendi (sen ekledin)", "good"); } catch(err){ NOTIFY.toast("✖ " + err.message, "bad"); } paint(); return; }
    if (e.target.closest("a,button,input,select")) return; const g = e.target.closest(".ag"); if (g) g.classList.toggle("open"); }); } }
function settingsHTML(){ const I = (k, l) => `<label>${l}<input data-ag="${k}" inputmode="decimal" value="${esc(C[k])}"></label>`, K = (k, l) => `<label class="chk"><input type="checkbox" data-ag="${k}" ${C[k] ? "checked" : ""}> ${l}</label>`;
  return `<details class="keys" id="mm-ag-d"><summary>🧠 AJAN AYARLARI · ALARM</summary>
    <div class="f3">${I("rugMax", "Rug riski ≥ → ele")}${I("orSec", "Giriş aralığı sn")}${I("brk", "Kırılım +%")}</div>
    <div class="f2">${K("entryGate", "Giriş tetiği şart (alım kapısı)")}${K("smBoost", "Akıllı para alırsa skor +")}</div>
    <div class="f3">${I("smMin", "Akıllı para min SOL")}${K("news", "Haber taraması")}${K("perps", "Perp taraması")}</div>
    <div class="sub-h">YENİ ALARM</div>
    <div class="f3"><label>Tür<select id="al-kind"><option value="token">token mcap (SOL)</option><option value="pnl">pozisyon K/Z %</option><option value="perp">perp fiyat $</option></select></label><label>Mint / sembol<input id="al-ref" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="mint ya da BTCUSDT"></label><label>Koşul<select id="al-op"><option value=">=">≥</option><option value="<=">≤</option></select></label></div>
    <div class="f2"><label>Seviye<input id="al-lvl" inputmode="decimal"></label><button type="button" id="al-add" class="mini wide" style="align-self:end">+ ALARM KUR</button></div>
    <div class="plan-foot">Pozisyon K/Z için mint alanına açık pozisyonun mintini yaz (boşsa ilk pozisyon). Her alarm bir kez çalar. Ajanlar emir veremez; alım/satım yalnızca MEME motorunun risk kontrollü yolundan.</div></details>`; }
function bind(){ document.querySelectorAll("[data-ag]").forEach(i => i.addEventListener("change", () => { try { set(i.dataset.ag, i.type === "checkbox" ? i.checked : i.value); NOTIFY.toast("Kaydedildi", "good"); paint(); } catch(e){ NOTIFY.toast("✖ " + e.message, "bad"); i.type === "checkbox" ? i.checked = !!C[i.dataset.ag] : i.value = C[i.dataset.ag]; } }));
  const b = document.getElementById("al-add"); if (b) b.onclick = () => { try { const kind = $("#al-kind").value; let ref = $("#al-ref").value.trim(); if (kind === "pnl" && !ref){ const p = M().posList()[0]; if (!p) throw new Error("açık pozisyon yok"); ref = p.mint; }
      const p = M().posList().find(q => q.mint === ref), t = PUMP.get(ref); alAdd({ kind, ref, op: $("#al-op").value, lvl: $("#al-lvl").value, sym: p ? p.sym : t ? t.symbol : null }); NOTIFY.toast("Alarm kuruldu", "good"); paint(); } catch(e){ NOTIFY.toast("✖ " + e.message, "bad"); } }; }
/* loops */
setInterval(() => { if (!window.MEME) return; try { scanTokens(); } catch(e){} alTick().catch(() => {}); }, 2000);
setInterval(() => { if (!window.MEME) return; scanPerps().catch(() => {}); newsTick().catch(() => {}); }, 15000);
setTimeout(() => { scanPerps().catch(() => {}); newsTick().catch(() => {}); }, 4000);
window.addEventListener("pagehide", smSave);
return { CARDS, paint, settingsHTML, bind, onCand, gate, onScored, onTrade, entryFor, rugFor, tmRun, smTop, smBoost, alAdd, alDel, set, get C(){ return C; }, _: { SM, RUG, TM, EN, SCN, ALS, NW, get AL(){ return AL; }, get TMP(){ return TMP; } } };
})();
window.AGENTS = AGENTS;
