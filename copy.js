/* NEON//TERMINAL v6 — COPIER data layer: follow the pump.fun trades of wallets you choose, WITHOUT any API key.
   Verified 2026-11-10: PumpPortal subscribeAccountTrade / subscribeTokenTrade need an API key funded with ≥ 0.02 SOL,
   so we use Solana RPC WebSocket logsSubscribe({ mentions: [wallet] }) at "processed" commitment and decode the pump.fun
   program's Anchor TradeEvent ("Program data:" log, discriminator sha256("event:TradeEvent")[0..8] = bddb7fd34ee661ee):
   mint · solAmount · tokenAmount · isBuy · user · timestamp · virtualSol/TokenReserves → price is known instantly, no extra RPC.
   Only bonding-curve trades (program 6EF8…F6P) are decoded; trades on PumpSwap/Raydium are not mirrored. */
"use strict";
const COPY = (() => {
const PUMPPROG = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", DISC = [0xbd, 0xdb, 0x7f, 0xd3, 0x4e, 0xe6, 0x61, 0xee];
const K = "neon.copy.w";
const A58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(b){ let n = 0n; for (const x of b) n = n*256n + BigInt(x); let s = ""; while (n > 0n){ s = A58[Number(n % 58n)] + s; n /= 58n; } for (const x of b){ if (x === 0) s = "1" + s; else break; } return s; }
function decodeTrade(line){ if (!line.startsWith("Program data: ")) return null; let b; try { b = Uint8Array.from(atob(line.slice(14)), c => c.charCodeAt(0)); } catch(e){ return null; }
  if (b.length < 121) return null; for (let i = 0; i < 8; i++) if (b[i] !== DISC[i]) return null;
  const v = new DataView(b.buffer), u = o => Number(v.getBigUint64(o, true));
  const vSol = u(97)/1e9, vTok = u(105)/1e6;
  return { mint: b58(b.subarray(8, 40)), sol: u(40)/1e9, tok: u(48)/1e6, isBuy: b[56] === 1, user: b58(b.subarray(57, 89)), ts: Number(v.getBigInt64(89, true)), vSol, vTok, rSol: u(113)/1e9, mcap: vTok ? vSol/vTok*1e9 : null }; }
const rd = () => { try { return JSON.parse(localStorage.getItem(K) || "[]"); } catch(e){ return []; } };
let WL = rd(); const save = () => localStorage.setItem(K, JSON.stringify(WL.map(w => ({ addr: w.addr, label: w.label, on: w.on !== false, size: w.size || null, added: w.added }))));
/* two WebSocket endpoints in parallel (custom WS first if set); a trade is processed once (dedupe by signature) — whichever endpoint is faster wins.
   Checked 2026-11-10: publicnode delivers per-wallet logsSubscribe fine (3189 notes / 25 s for an active bot) but stays silent for the
   whole pump.fun program; api.mainnet-beta.solana.com refuses browser Origins (403), so it is not used from the page. */
const S = { conns: [], subs: new Set(), stat: new Map(), msgs: 0, lastMsg: 0, want: false, seenSig: new Map(), wsAt: new Map(), poll: { cur: new Map(), retry: new Map(), rr: 0, busy: false, n: 0, hits: 0, on: false, at: 0, lag: null } };
const stat = a => { let s = S.stat.get(a); if (!s){ s = { n: 0, buys: 0, sells: 0, solIn: 0, solOut: 0, mints: new Map(), last: null, lastAt: 0 }; S.stat.set(a, s); } return s; };
const wsUrls = () => { const c = window.EXEC && EXEC.C.ws; return (/^wss:\/\//.test(c || "") ? [c] : []).concat(["wss://solana-rpc.publicnode.com"]); };
const httpRpc = () => { const c = window.EXEC && EXEC.C.rpc; return /^https:\/\//.test(c || "") ? c : "https://solana-rpc.publicnode.com"; };
const rpc = (m, p) => fetch(httpRpc(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) }).then(r => r.ok ? r.json() : { error: r.status }).catch(e => ({ error: String(e) }));
function conn(url){ const X = { url, ws: null, open: false, id: 1, req: new Map(), sub: new Map(), bySub: new Map(), retry: 0, n: 0 };
  X.start = () => { if (X.ws) return; let ws; try { ws = new WebSocket(url); } catch(e){ return; } X.ws = ws;
    ws.onopen = () => { X.open = true; X.retry = 0; WL.filter(w => w.on !== false).forEach(w => X.subOne(w.addr)); fire({ kind: "status" }); };
    ws.onmessage = ev => { let j; try { j = JSON.parse(ev.data); } catch(e){ return; }
      if (j.id && X.req.has(j.id)){ const a = X.req.get(j.id); X.req.delete(j.id); X.reqAt.delete(j.id); if (typeof j.result === "number"){ X.sub.set(a, j.result); X.bySub.set(j.result, a); } fire({ kind: "status" }); return; }
      if (j.method !== "logsNotification") return; const a = X.bySub.get(j.params.subscription); if (!a) return; X.n++; S.wsAt.set(a, Date.now()); onLogs(a, j.params.result.value, url); };
    ws.onclose = () => { X.ws = null; X.open = false; X.sub.clear(); X.bySub.clear(); X.req.clear(); X.reqAt.clear(); X.q = []; clearTimeout(X.qT); X.qT = null; fire({ kind: "status" }); if (S.want && WL.some(w => w.on !== false)) setTimeout(X.start, Math.min(15000, 1000*2**X.retry++)); };
    ws.onerror = () => {}; };
  /* publicnode silently drops back-to-back subscribe requests on one socket (checked 2026-11-10) → send them ~650 ms apart */
  X.q = []; X.qT = null; X.reqAt = new Map();
  /* a subscribe with no reply after 8 s was dropped by the server → forget it so the 20 s sweep can retry */
  X.dropStale = () => { const cut = Date.now() - 8000; for (const [id, t] of X.reqAt) if (t < cut){ X.reqAt.delete(id); X.req.delete(id); } };
  X.pump = () => { if (X.qT) return; const step = () => { const a = X.q.shift(); if (a === undefined || !X.open || !X.ws || X.ws.readyState !== 1){ X.qT = null; return; }
      if (!X.sub.has(a) && WL.some(w => w.addr === a && w.on !== false)){ const id = X.id++; X.req.set(id, a); X.reqAt.set(id, Date.now()); X.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method: "logsSubscribe", params: [{ mentions: [a] }, { commitment: "processed" }] })); }
      X.qT = setTimeout(step, 650); }; step(); };
  X.subOne = a => { if (!X.open || X.sub.has(a) || X.q.includes(a) || [...X.req.values()].includes(a)) return; X.q.push(a); X.pump(); };
  X.unsubOne = a => { const id = X.sub.get(a); if (id === undefined) return; X.sub.delete(a); X.bySub.delete(id); if (X.open) try { X.ws.send(JSON.stringify({ jsonrpc: "2.0", id: X.id++, method: "logsUnsubscribe", params: [id] })); } catch(e){} };
  X.close = () => { try { X.ws && X.ws.close(); } catch(e){} };
  return X; }
function onLogs(a, v, url, blockTime){ if (v.err) return; const sig = v.signature; if (S.seenSig.has(sig)) return; S.seenSig.set(sig, Date.now()); if (S.seenSig.size > 3000){ const cut = Date.now() - 600000; for (const [k, t] of S.seenSig) if (t < cut) S.seenSig.delete(k); }
  S.msgs++; S.lastMsg = Date.now(); const at = performance.now();
  for (const l of v.logs || []){ const t = decodeTrade(l); if (!t || t.user !== a) continue; t.at = at; t.wall = Date.now(); t.sig = sig; t.wallet = a; t.via = url.split("/")[2]; if (blockTime) t.lag = Math.max(0, Date.now() - blockTime*1000);
    const s = stat(a); s.n++; s.lastAt = Date.now(); s.last = t; const mm = s.mints.get(t.mint) || { tok: 0, solIn: 0, solOut: 0 };
    if (t.isBuy){ s.buys++; s.solIn += t.sol; mm.tok += t.tok; mm.solIn += t.sol; } else { s.sells++; s.solOut += t.sol; t.frac = mm.tok > 0 ? Math.min(1, t.tok/mm.tok) : 1; mm.tok = Math.max(0, mm.tok - t.tok); mm.solOut += t.sol; }
    s.mints.set(t.mint, mm); window.BUS && BUS.emit("copy", { buy: t.isBuy }); fire({ kind: "trade", t }); } }
function open(){ S.want = true; if (!S.conns.length) S.conns = wsUrls().map(conn); S.conns.forEach(X => X.start()); }
const subOne = a => S.conns.forEach(X => X.subOne(a)), unsubOne = a => S.conns.forEach(X => X.unsubOne(a));
function fire(e){ S.subs.forEach(f => { try { f(e); } catch(err){ console.error(err); } }); }
const valid = a => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
function add(addr, label){ addr = (addr || "").trim(); if (!valid(addr)) throw new Error("geçersiz Solana adresi"); if (WL.some(w => w.addr === addr)) throw new Error("zaten takipte");
  if (WL.length >= 10) throw new Error("en fazla 10 cüzdan"); WL.push({ addr, label: (label || "").slice(0, 18) || addr.slice(0, 4) + "…" + addr.slice(-4), on: true, added: Date.now() }); save(); open(); subOne(addr); fire({ kind: "list" }); }
function del(addr){ unsubOne(addr); WL = WL.filter(w => w.addr !== addr); save(); fire({ kind: "list" }); }
function toggle(addr, on){ const w = WL.find(x => x.addr === addr); if (!w) return; w.on = on; save(); if (on){ open(); subOne(addr); } else unsubOne(addr); fire({ kind: "list" }); }
function setSize(addr, size){ const w = WL.find(x => x.addr === addr); if (!w) return; w.size = size > 0 ? size : null; save(); }
function stop(){ S.want = false; S.conns.forEach(X => X.close()); S.conns = []; }
/* discover: rank the most active pump.fun wallets right now (often bots — check before following).
   Public RPCs do not stream the whole program, so we sample: latest program signatures → getTransaction (4 at a time) → decode TradeEvents.
   With a custom WS (Helius etc.) the program-wide logsSubscribe is used in parallel. */
function discover(sec = 12){ return new Promise(res => { const U = new Map(); let n = 0, txs = 0; const seen = new Set(), socks = [], t0 = Date.now(), end0 = t0 + sec*1000;
  const eat = (logs, sig) => { if (seen.has(sig)) return; seen.add(sig); for (const l of logs || []){ const t = decodeTrade(l); if (!t) continue; n++; const u = U.get(t.user) || { addr: t.user, n: 0, buys: 0, sells: 0, inS: 0, outS: 0, mints: new Set() };
      u.n++; t.isBuy ? (u.buys++, u.inS += t.sol) : (u.sells++, u.outS += t.sol); u.mints.add(t.mint); U.set(t.user, u); } };
  const c = window.EXEC && EXEC.C.ws; if (/^wss:\/\//.test(c || "")) try { const ws = new WebSocket(c); ws.onopen = () => ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "logsSubscribe", params: [{ mentions: [PUMPPROG] }, { commitment: "processed" }] }));
    ws.onmessage = ev => { let j; try { j = JSON.parse(ev.data); } catch(e){ return; } if (j.method === "logsNotification" && !j.params.result.value.err) eat(j.params.result.value.logs, j.params.result.value.signature); }; ws.onerror = () => {}; socks.push(ws); } catch(e){}
  (async () => { while (Date.now() < end0){ const r = await rpc("getSignaturesForAddress", [PUMPPROG, { limit: 60 }]); const q = (r.result || []).filter(x => !x.err && !seen.has(x.signature)).map(x => x.signature);
      for (let i = 0; i < q.length && Date.now() < end0; i += 4) await Promise.all(q.slice(i, i + 4).map(async g => { const t = await rpc("getTransaction", [g, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }]); if (t.result){ txs++; eat(t.result.meta && t.result.meta.logMessages, g); } }));
      if (!q.length) await new Promise(r => setTimeout(r, 800)); } })().finally(() => {
    socks.forEach(ws => { try { ws.close(); } catch(e){} }); const L = [...U.values()].filter(u => u.inS + u.outS >= 0.05).map(u => Object.assign(u, { mints: u.mints.size, vol: u.inS + u.outS, net: u.outS - u.inS }))
      .sort((a, b) => (b.n - a.n) || (b.vol - a.vol)).slice(0, 10); res({ trades: n, txs, wallets: U.size, top: L, ms: Date.now() - t0 }); }); }); }
/* HTTP fallback (checked 2026-11-10): publicnode's WS logsSubscribe({mentions:[wallet]}) is inconsistent — the same active bot
   (≈11 tx/s) got 772 notes / 30 s once and 0 notes on 5 later sockets. So every wallet whose WS stayed silent for 12 s is also polled:
   getSignaturesForAddress (confirmed) → getTransaction for the newest unseen signatures (≤ 3 per wallet per tick) → same decoder.
   Slower than WS (~1–3 s behind the block) but it does not miss an active wallet. Deduped by signature with the WS path. */
async function pollTick(){ const P = S.poll; if (P.busy || !S.want || document.hidden) return; const act = WL.filter(w => w.on !== false);
  const due = act.filter(w => Date.now() - (S.wsAt.get(w.addr) || 0) > 12000); P.on = due.length > 0; if (!due.length) return;
  P.busy = true; try { const pick = []; for (let i = 0; i < Math.min(3, due.length); i++) pick.push(due[(P.rr + i) % due.length]); P.rr = (P.rr + pick.length) % Math.max(1, due.length);
    await Promise.all(pick.map(async w => { const a = w.addr; const r = await rpc("getSignaturesForAddress", [a, { limit: 15, commitment: "confirmed" }]); if (!Array.isArray(r.result)) return; P.n++; P.at = Date.now();
      const L = r.result, cur = P.cur.get(a); if (L.length) P.cur.set(a, L[0].signature); if (cur === undefined) return; /* first poll only sets the cursor (no replay) */
      const fresh = []; for (const x of L){ if (x.signature === cur) break; if (!x.err && !S.seenSig.has(x.signature)) fresh.push(x); }
      const rt = (P.retry.get(a) || []).filter(x => !S.seenSig.has(x.signature)); const todo = fresh.slice(0, 3).concat(rt).slice(0, 4); P.retry.set(a, []);
      await Promise.all(todo.map(async x => { const t = await rpc("getTransaction", [x.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
        if (!t.result){ if (!x.tried){ x.tried = 1; P.retry.get(a).push(x); } return; }
        if (t.result.meta && t.result.meta.err) return; P.hits++; const bt = t.result.blockTime || x.blockTime; if (bt) P.lag = Math.max(0, Date.now() - bt*1000);
        onLogs(a, { signature: x.signature, err: null, logs: t.result.meta && t.result.meta.logMessages }, "poll://solana-rpc.publicnode.com/", bt); })); })); }
  catch(e){} finally { P.busy = false; fire({ kind: "status" }); } }
setInterval(pollTick, 2500);
setInterval(() => { if (S.want && WL.some(w => w.on !== false)) S.conns.forEach(X => { X.start(); X.dropStale(); WL.filter(w => w.on !== false).forEach(w => X.subOne(w.addr)); }); }, 20000);
if (WL.some(w => w.on !== false)) open();
return { get list(){ return WL; }, add, del, toggle, setSize, on: f => S.subs.add(f), stat, get live(){ return S.conns.some(X => X.open) || (S.poll.on && Date.now() - S.poll.at < 15000); }, get poll(){ const P = S.poll; return { on: P.on, n: P.n, hits: P.hits, lag: P.lag, at: P.at }; }, get subs(){ return S.conns.reduce((a, X) => a + X.sub.size, 0); }, get msgs(){ return S.msgs; }, get lastMsg(){ return S.lastMsg; }, get conns(){ return S.conns.map(X => ({ url: X.url, open: X.open, subs: X.sub.size, n: X.n })); }, discover, decodeTrade, open, stop, PUMPPROG, valid };
})();
window.COPY = COPY;
