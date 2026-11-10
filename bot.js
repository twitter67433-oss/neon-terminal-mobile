/* NEON//TERMINAL v5 — BOT CÜZDANI (a Solana wallet generated in this browser), JOURNAL (trade log + CSV) and NOTIFY (sound / vibration / toast).
   The bot wallet's secret key is encrypted with your PIN (PBKDF2-SHA256 300k → AES-256-GCM) and stored only in this device's localStorage.
   It is decrypted into memory only while unlocked. Nothing is sent to any server except signed transactions to the Solana RPC. */
"use strict";
/* ============================== NOTIFY ============================== */
const NOTIFY = (() => {
  const K = "neon.notify"; let S = Object.assign({ sound: true, vib: true }, (() => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch(e){ return {}; } })());
  let ac = null; const unlock = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch(e){} };
  document.addEventListener("pointerdown", unlock, { once: true, capture: true });
  function tone(kind, soft){ if (!S.sound || !ac || ac.state !== "running") return; const seq = kind === "bad" ? [440, 330, 220] : kind === "good" ? [660, 880, 1175] : [880, 1320];
    const t = ac.currentTime; seq.slice(0, soft ? 2 : 3).forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i*.11); g.gain.exponentialRampToValueAtTime(soft ? .06 : .14, t + i*.11 + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + i*.11 + .1);
      o.connect(g).connect(ac.destination); o.start(t + i*.11); o.stop(t + i*.11 + .12); }); }
  function toast(msg, kind){ let el = document.getElementById("toast"); if (!el){ el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
    const d = document.createElement("div"); d.className = "toast " + (kind || ""); d.textContent = msg; el.prepend(d); setTimeout(() => d.classList.add("out"), 4200); setTimeout(() => d.remove(), 4800);
    while (el.children.length > 4) el.lastChild.remove(); }
  let lastAt = 0;
  function ping(kind, msg, soft){ toast(msg, kind); if (Date.now() - lastAt < 800) return; lastAt = Date.now(); tone(kind, soft);
    if (S.vib && navigator.vibrate && !soft) try { navigator.vibrate(kind === "bad" ? [120, 60, 120, 60, 200] : [80, 40, 80]); } catch(e){} }
  return { ping, toast, get s(){ return S; }, set(o){ Object.assign(S, o); localStorage.setItem(K, JSON.stringify(S)); unlock(); } };
})();
window.NOTIFY = NOTIFY;

/* ============================== JOURNAL ============================== */
const JOURNAL = (() => {
  const K = "neon.journal", rd = () => { try { return JSON.parse(localStorage.getItem(K) || "[]"); } catch(e){ return []; } }, wr = a => localStorage.setItem(K, JSON.stringify(a.slice(-600)));
  const subs = new Set(), fire = () => subs.forEach(f => { try { f(); } catch(e){} });
  function add(e){ const a = rd(); e.id = e.id || ("j" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)); e.openT = e.openT || Date.now(); a.push(e); wr(a); fire(); return e.id; }
  function upd(id, p){ const a = rd(), e = a.find(x => x.id === id); if (!e) return null; Object.assign(e, p);
    if (e.closeT && e.in !== undefined && e.out !== undefined && e.in !== null && e.out !== null && e.pnl === undefined){ e.pnl = +(e.out - e.in).toFixed(9); e.pnlPct = e.in ? +((e.out/e.in - 1)*100).toFixed(2) : null; }
    wr(a); fire(); return e; }
  const list = () => rd();
  function totals(){ const a = rd().filter(e => typeof e.pnl === "number"), by = {};
    for (const e of a){ const u = e.unit || "SOL", t = by[u] = by[u] || { n: 0, w: 0, pnl: 0 }; t.n++; if (e.pnl > 0) t.w++; t.pnl += e.pnl; } return by; }
  function todayPnl(unit, filter){ const d0 = new Date(); d0.setHours(0, 0, 0, 0); return rd().filter(e => (e.unit || "SOL") === unit && typeof e.pnl === "number" && e.closeT >= +d0 && (!filter || filter(e))).reduce((s, e) => s + e.pnl, 0); }
  function csv(){ const cols = ["id","venue","mode","wallet","sym","mint","side","openT","closeT","in","out","unit","pnl","pnlPct","reason","sigIn","sigOut","note"];
    const q = v => { v = v === undefined || v === null ? "" : (/T$/.test(v) ? v : v); const s = String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = rd().map(e => cols.map(c => q(c === "openT" || c === "closeT" ? (e[c] ? new Date(e[c]).toISOString() : "") : e[c])).join(","));
    return cols.join(",") + "\n" + rows.join("\n"); }
  function download(){ const b = new Blob([csv()], { type: "text/csv;charset=utf-8" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "neon-terminal-gunluk-" + new Date().toISOString().slice(0, 10) + ".csv"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function clear(){ localStorage.removeItem(K); fire(); }
  return { add, upd, list, totals, todayPnl, csv, download, clear, on: f => subs.add(f) };
})();
window.JOURNAL = JOURNAL;

/* ============================== BOT CÜZDANI ============================== */
const WALLET = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (x, d = 4) => (x === null || x === undefined || !isFinite(+x)) ? "—" : (+x).toLocaleString("en-US", { maximumFractionDigits: d });
const short = a => a ? String(a).slice(0, 4) + "…" + String(a).slice(-4) : "—";
const K = "neon.botw", PK = "neon.botpos", ITER = 300000;
const T = () => window.TRADE;
/* base58 (bitcoin alphabet) — Phantom / Solflare import format for a 64-byte secret key */
const A58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58enc(b){ let n = 0n; for (const x of b) n = n*256n + BigInt(x); let s = ""; while (n > 0n){ s = A58[Number(n % 58n)] + s; n /= 58n; } for (const x of b){ if (x === 0) s = "1" + s; else break; } return s; }
function b58dec(s){ let n = 0n; for (const c of s){ const i = A58.indexOf(c); if (i < 0) throw new Error("geçersiz base58"); n = n*58n + BigInt(i); } const out = []; while (n > 0n){ out.unshift(Number(n % 256n)); n /= 256n; } for (const c of s){ if (c === "1") out.unshift(0); else break; } return Uint8Array.from(out); }
const u8 = s => new TextEncoder().encode(s), b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function kdf(pin, salt, iter){ const base = await crypto.subtle.importKey("raw", u8(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); }
async function encrypt(secret, pin){ const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), k = await kdf(pin, salt, ITER);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, secret); return { v: 1, kdf: "PBKDF2-SHA256", iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }; }
async function decrypt(o, pin){ const k = await kdf(pin, unb64(o.salt), o.iter || ITER);
  try { return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, k, unb64(o.ct))); } catch(e){ throw new Error("PIN yanlış"); } }
const rec = () => { try { return JSON.parse(localStorage.getItem(K) || "null"); } catch(e){ return null; } };
let kp = null, bal = null, solUsd = null, busy = false, tokList = [], lockT = null;
const W3 = () => T().ph.web3(), rpc = (m, p) => T().ph.rpc(m, p);
async function create(pin){ if (rec()) throw new Error("zaten bir bot cüzdanı var"); const W = await W3(), k = W.Keypair.generate();
  const o = await encrypt(k.secretKey, pin); o.pub = k.publicKey.toBase58(); o.created = Date.now(); localStorage.setItem(K, JSON.stringify(o)); kp = k; return o.pub; }
async function restore(secretB58, pin){ const W = await W3(); let sk; try { sk = b58dec(secretB58.trim()); } catch(e){ throw new Error("Gizli anahtar base58 değil"); }
  if (sk.length !== 64) throw new Error("Gizli anahtar 64 bayt olmalı (" + sk.length + ")"); const k = W.Keypair.fromSecretKey(sk);
  const o = await encrypt(k.secretKey, pin); o.pub = k.publicKey.toBase58(); o.created = Date.now(); o.restored = true; localStorage.setItem(K, JSON.stringify(o)); kp = k; return o.pub; }
async function unlock(pin){ const o = rec(); if (!o) throw new Error("bot cüzdanı yok"); const sk = await decrypt(o, pin); const W = await W3(), k = W.Keypair.fromSecretKey(sk);
  if (k.publicKey.toBase58() !== o.pub) throw new Error("anahtar adresle eşleşmiyor"); kp = k; return o.pub; }
function lock(){ if ((window.AUTO && AUTO.pumpOn()) || (window.MEME && MEME.on && MEME.mode === "GERÇEK")){ NOTIFY.toast("OTO AL-SAT açıkken cüzdan kilitlenemez — önce durdur.", "bad"); return false; } kp = null; return true; }
async function exportSecret(pin){ const o = rec(); const sk = await decrypt(o, pin); return b58enc(sk); }
const pub = () => (rec() || {}).pub || null;
/* --- solana send helpers --- */
async function confirm(sig, ms = 45000){ const t0 = Date.now();
  while (Date.now() - t0 < ms){ await new Promise(r => setTimeout(r, 1200));
    try { const r = await rpc("getSignatureStatuses", [[sig], { searchTransactionHistory: false }]); const s = r && r.value && r.value[0];
      if (s){ if (s.err) throw Object.assign(new Error("işlem zincirde başarısız: " + JSON.stringify(s.err)), { chain: true }); if (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") return s; } }
    catch(e){ if (e.chain) throw e; } }
  throw new Error("onay zaman aşımı (işlem yine de gerçekleşmiş olabilir: Solscan'de kontrol et)"); }
async function sendRaw(bytes){ const sig = await rpc("sendTransaction", [b64(bytes), { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5 }]); return sig; }
/* sign a server-built (unsigned) VersionedTransaction with the bot key and send it */
async function signSendVersioned(bytes){ if (!kp) throw new Error("bot cüzdanı kilitli (PIN ile aç)"); const W = await W3(); const tx = W.VersionedTransaction.deserialize(bytes);
  const payer = tx.message.staticAccountKeys[0].toBase58(); if (payer !== kp.publicKey.toBase58()) throw new Error("işlem bot cüzdanı için hazırlanmamış (" + short(payer) + ")");
  tx.sign([kp]); const sig = await sendRaw(tx.serialize()); await confirm(sig); return sig; }
async function solBal(a){ const r = await rpc("getBalance", [a || pub(), { commitment: "confirmed" }]); return r.value/1e9; }
async function tokenBal(mint, owner){ const r = await rpc("getTokenAccountsByOwner", [owner || pub(), { mint }, { encoding: "jsonParsed", commitment: "confirmed" }]);
  return (r.value || []).reduce((a, x) => a + (+x.account.data.parsed.info.tokenAmount.uiAmount || 0), 0); }
async function allTokens(){ const out = []; for (const prog of ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]){
    try { const r = await rpc("getTokenAccountsByOwner", [pub(), { programId: prog }, { encoding: "jsonParsed", commitment: "confirmed" }]);
      for (const x of r.value || []){ const i = x.account.data.parsed.info; if (+i.tokenAmount.uiAmount > 0) out.push({ mint: i.mint, amt: +i.tokenAmount.uiAmount }); } } catch(e){} } return out; }
/* positions held by the bot wallet (opened by manual bot buys or OTO AL-SAT) */
const pos = { list(){ try { return JSON.parse(localStorage.getItem(PK) || "[]"); } catch(e){ return []; } }, save(a){ localStorage.setItem(PK, JSON.stringify(a)); },
  add(p){ const a = pos.list(); a.push(p); pos.save(a); }, del(mint){ pos.save(pos.list().filter(p => p.mint !== mint)); }, get(mint){ return pos.list().find(p => p.mint === mint); } };
/* --- Phantom → bot (fund) and bot → Phantom / address (withdraw) --- */
async function fund(amount){ const P = T().ph, p = P.prov(); if (!p) throw new Error("Phantom yok: siteyi Phantom uygulamasının tarayıcısında aç"); if (!P.pk){ const r = await p.connect(); P.pk = (r.publicKey || p.publicKey).toString(); }
  const W = await W3(), bh = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const tx = new W.Transaction({ feePayer: new W.PublicKey(P.pk), recentBlockhash: bh.value.blockhash }).add(W.SystemProgram.transfer({ fromPubkey: new W.PublicKey(P.pk), toPubkey: new W.PublicKey(pub()), lamports: Math.round(amount*1e9) }));
  const r = await p.signAndSendTransaction(tx); const sig = r.signature || r; await confirm(sig).catch(() => {}); return sig; }
async function withdraw(to, amount){ if (!kp) throw new Error("bot cüzdanı kilitli"); const W = await W3(), dest = new W.PublicKey(to);
  const lam = (await rpc("getBalance", [pub(), { commitment: "confirmed" }])).value, fee = 5000, send = amount === "all" ? lam - fee : Math.round(amount*1e9);
  if (send <= 0 || send + fee > lam) throw new Error("yetersiz SOL (bakiye " + (lam/1e9).toFixed(6) + ")");
  const bh = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const tx = new W.Transaction({ feePayer: kp.publicKey, recentBlockhash: bh.value.blockhash }).add(W.SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: dest, lamports: send }));
  tx.sign(kp); const sig = await sendRaw(tx.serialize()); await confirm(sig); return { sig, sol: send/1e9 }; }
/* --- Jupiter swap signed by the bot key --- */
const SOLM = "So11111111111111111111111111111111111111112", JUP = "https://lite-api.jup.ag";
async function jupSwap({ inMint, outMint, rawAmount, slipBps }){ const q = await (await fetch(`${JUP}/swap/v1/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${rawAmount}&slippageBps=${slipBps}&restrictIntermediateTokens=true`, { cache: "no-store" })).json();
  if (q.error || !q.outAmount) throw new Error("Jupiter teklif: " + (q.error || "rota yok"));
  const r = await fetch(JUP + "/swap/v1/swap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteResponse: q, userPublicKey: pub(), wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 1000000, priorityLevel: "medium" } } }) });
  const j = await r.json(); if (!j.swapTransaction) throw new Error("Jupiter swap: " + (j.error || r.status)); const sig = await signSendVersioned(unb64(j.swapTransaction)); return { sig, q }; }
async function tokInfo(mint){ const a = await (await fetch(JUP + "/tokens/v2/search?query=" + mint, { cache: "no-store" })).json(); return (a || []).find(x => x.id === mint) || null; }
async function solPrice(){ try { const j = await (await fetch(JUP + "/price/v3?ids=" + SOLM, { cache: "no-store" })).json(); solUsd = +(j[SOLM] || {}).usdPrice || solUsd; } catch(e){} return solUsd; }
let qrp = null; const qrLib = () => window.qrcode ? Promise.resolve() : (qrp = qrp || new Promise((ok, no) => { const s = document.createElement("script"); s.src = "vendor/qrcode.js?v=6"; s.onload = ok; s.onerror = () => { qrp = null; no(); }; document.head.appendChild(s); }));
async function qr(el, text){ try { await qrLib(); const q = qrcode(0, "M"); q.addData("solana:" + text); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 3, scalable: true }); } catch(e){ el.textContent = "QR yüklenemedi"; } }

/* ------------------------------ UI ------------------------------ */
function log(msg, cls){ const el = $("#bw-log"); if (!el) return; el.insertAdjacentHTML("afterbegin", `<div class="${cls || ""}"><small>${new Date().toLocaleTimeString("tr-TR")}</small> ${msg}</div>`); while (el.children.length > 40) el.lastChild.remove(); }
const pinOk = p => typeof p === "string" && p.length >= 6;
function html(){ const o = rec();
  if (!o) return `<div class="bw-intro"><b>BOT CÜZDANI</b> — bu tarayıcıda oluşturulan ayrı bir Solana cüzdanı. İçine yüklediğin SOL ile bot, her işlemde Phantom açılmadan pump.fun / Jupiter alım-satımı yapabilir (OTO AL-SAT yalnızca bu cüzdanı kullanır).</div>
    <ul class="howto"><li>Gizli anahtar <b>PIN'inle şifrelenir</b> (PBKDF2 300 bin tur + AES-256-GCM) ve yalnızca bu cihazda saklanır. PIN'i unutursan ve yedek almadıysan içindeki para <b>kurtarılamaz</b>.</li>
    <li>Tarayıcı verisini silmek cüzdanı da siler: oluşturduktan sonra "GİZLİ ANAHTARI YEDEKLE" ile yedek al.</li><li>İçinde yalnızca <b>kaybetmeyi göze alabileceğin kadar</b> SOL tut.</li></ul>
    <div class="f2"><label>PIN (en az 6)<input id="bw-pin1" type="password" inputmode="numeric" autocomplete="new-password"></label><label>PIN tekrar<input id="bw-pin2" type="password" inputmode="numeric" autocomplete="new-password"></label></div>
    <button type="button" id="bw-create" class="go">BOT CÜZDANI OLUŞTUR</button>
    <details class="keys"><summary>Yedekten geri yükle</summary><label>Gizli anahtar (base58)<input id="bw-rs" type="password" autocomplete="off" spellcheck="false"></label><div class="f2"><label>Yeni PIN<input id="bw-rp1" type="password" inputmode="numeric"></label><label>PIN tekrar<input id="bw-rp2" type="password" inputmode="numeric"></label></div><button type="button" id="bw-restore" class="mini wide">GERİ YÜKLE</button></details>
    <div class="sub-h">KAYIT</div><div id="bw-log" class="tlog"></div>`;
  const P = T().ph;
  return `<div class="bw-top"><div class="bw-qr" id="bw-qr"></div><div class="bw-id"><span class="mode-badge ${kp ? "test" : ""}">${kp ? "● AÇIK" : "🔒 KİLİTLİ"}</span><small>Bot adresi (SOL yatırmak için):</small><code class="bw-addr" id="bw-addr">${esc(o.pub)}</code>
      <div class="bw-btns"><button type="button" class="mini" id="bw-copy">KOPYALA</button><a class="mini" href="https://solscan.io/account/${esc(o.pub)}" target="_blank" rel="noopener">SOLSCAN ↗</a></div></div></div>
    <div class="bw-bal" id="bw-bal"><div class="empty">bakiye okunuyor…</div></div>
    ${kp ? `<div class="sub-h">YÜKLE / ÇEK</div>
      <div class="f2"><label>Phantom'dan yüklenecek SOL<input id="bw-famt" inputmode="decimal" value="0.1"></label><button type="button" id="bw-fund" class="mini wide" style="align-self:end">PHANTOM'DAN YÜKLE → ONAY</button></div>
      <div class="f2"><label>Çekilecek adres (boş = bağlı Phantom)<input id="bw-to" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${P.pk ? esc(short(P.pk)) + " (Phantom)" : "Phantom bağlı değil — adres yaz"}"></label><button type="button" id="bw-wd" class="mini wide" style="align-self:end">TÜMÜNÜ GERİ ÇEK → ONAY</button></div>
      <div class="sub-h">JUPITER SWAP (bot imzalar)</div>
      <div class="f2"><label>Token mint<input id="bw-jm" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ör. JUPyiwrY…"></label><label>Miktar (AL: SOL · SAT: %)<input id="bw-ja" inputmode="decimal" value="0.02"></label></div>
      <div class="f2"><label>Kayma %<input id="bw-js" inputmode="decimal" value="1"></label><div class="side-btns" style="align-self:end;margin:0"><button type="button" id="bw-jb" class="l on">▲ AL</button><button type="button" id="bw-jx" class="s on">▼ SAT</button></div></div>
      <div class="f3"><button type="button" id="bw-lock" class="mini wide">🔒 KİLİTLE</button><button type="button" id="bw-exp" class="mini wide">GİZLİ ANAHTARI YEDEKLE</button><button type="button" id="bw-del" class="mini wide s">CÜZDANI SİL</button></div>
      <div id="bw-secret"></div>`
    : `<div class="f2"><label>PIN<input id="bw-pin" type="password" inputmode="numeric" autocomplete="current-password"></label><button type="button" id="bw-unlock" class="go" style="align-self:end;margin:0">KİLİDİ AÇ</button></div>
      <div class="plan-foot">Bakiye kilitliyken de görünür. İşlem, çekim ve OTO AL-SAT için kilidi aç. Sayfa kapanınca cüzdan otomatik kilitlenir.</div>`}
    <div class="sub-h">KAYIT</div><div id="bw-log" class="tlog"></div>`;
}
async function paintBal(){ const el = $("#bw-bal"); if (!el || !pub()) return;
  try { const [s, px, toks] = await Promise.all([solBal(), solPrice().catch(() => null), allTokens().catch(() => null)]); bal = s; if (toks) tokList = toks; const P = pos.list();
    el.innerHTML = `<div class="bw-sol"><small>SOL</small><b>${fmt(s, 6)}</b><span>${px ? "≈ $" + (s*px).toFixed(2) : ""}</span></div>
      <div class="bw-toks">${!toks ? `<div class="empty">token listesi okunamadı (RPC sınırı) — sonra yenilenir</div>` : toks.length ? toks.map(t => { const p = P.find(x => x.mint === t.mint); return `<div><span>${esc(p ? p.sym : short(t.mint))}${p && p.auto ? ` <span class="pill y">OTO</span>` : ""}</span><b>${fmt(t.amt, 2)}</b><a href="https://pump.fun/coin/${esc(t.mint)}" target="_blank" rel="noopener">↗</a></div>`; }).join("") : `<div class="empty">token yok</div>`}</div>`; }
  catch(e){ el.innerHTML = `<div class="err-line">✖ bakiye: ${esc(e.message)} <button class="mini" onclick="WALLET.render()">↻</button></div>`; } }
const sheet = (o) => T().confirmSheet(o);
function bind(){ const box = $("#bot-box"); if (!box) return;
  const on = (id, f) => { const e = $(id); if (e) e.onclick = async () => { if (busy) return; busy = true; e.disabled = true; try { await f(); } catch(err){ log("✖ " + esc(err.message || err), "dn"); } busy = false; e.disabled = false; }; };
  on("#bw-create", async () => { const a = $("#bw-pin1").value, b = $("#bw-pin2").value; if (!pinOk(a)) throw new Error("PIN en az 6 karakter olmalı"); if (a !== b) throw new Error("PIN'ler eşleşmiyor");
    const p = await create(a); render(); log(`✔ Bot cüzdanı oluşturuldu: ${esc(short(p))} — şimdi YEDEK al.`, "up"); window.BUS && BUS.emit("bot"); });
  on("#bw-restore", async () => { const a = $("#bw-rp1").value, b = $("#bw-rp2").value; if (!pinOk(a) || a !== b) throw new Error("PIN en az 6 karakter ve eşleşmeli"); const p = await restore($("#bw-rs").value, a); render(); log("✔ Geri yüklendi: " + esc(short(p)), "up"); });
  on("#bw-unlock", async () => { await unlock($("#bw-pin").value); render(); log("✔ Kilit açıldı", "up"); window.BUS && BUS.emit("bot"); });
  on("#bw-lock", async () => { if (lock()){ render(); log("🔒 Kilitlendi"); } });
  on("#bw-copy", async () => { try { await navigator.clipboard.writeText(pub()); log("Adres kopyalandı", "up"); } catch(e){ const r = document.createRange(); r.selectNodeContents($("#bw-addr")); getSelection().removeAllRanges(); getSelection().addRange(r); log("Adresi seçtim, kopyala."); } });
  on("#bw-fund", async () => { const a = +($("#bw-famt").value || "").replace(",", "."); if (!(a > 0 && a <= 50)) throw new Error("0–50 SOL arası gir");
    if (!(await sheet({ title: "BOT CÜZDANINA YÜKLE", mode: "GERÇEK", rows: [["Ağ", "Solana MAINNET", "dn"], ["Kimden", "Phantom " + short(T().ph.pk || "")], ["Kime", "BOT " + short(pub())], ["Miktar", a + " SOL" + (solUsd ? " ≈ $" + (a*solUsd).toFixed(2) : "")]], warn: "Phantom kendi onay penceresini açacak. Bot cüzdanındaki SOL'ü OTO AL-SAT harcayabilir (limitler dahilinde).", okText: "ONAYLA · PHANTOM'DA İMZALA" }))) return;
    log("Phantom imzası bekleniyor…"); const sig = await fund(a); window.BUS && BUS.emit("fund"); log(`✔ Yüklendi: <a href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener">${esc(String(sig).slice(0, 10))}…</a>`, "up"); JOURNAL.add({ venue: "transfer", mode: "MANUEL", wallet: "PHANTOM→BOT", side: "YÜKLE", in: a, unit: "SOL", sigIn: sig, closeT: Date.now(), note: "bot cüzdanına yükleme" }); setTimeout(paintBal, 2500); });
  on("#bw-wd", async () => { const to = ($("#bw-to").value || "").trim() || T().ph.pk; if (!to) throw new Error("Phantom bağlı değil: adres yaz ya da Phantom'u bağla");
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(to)) throw new Error("geçersiz Solana adresi"); if (to === pub()) throw new Error("bot kendi adresine gönderemez");
    const b = await solBal(); if (!(await sheet({ title: "BOT CÜZDANINDAN GERİ ÇEK", mode: "GERÇEK", rows: [["Kime", to === T().ph.pk ? "Phantom " + short(to) : short(to), to === T().ph.pk ? "" : "dn"], ["Tam adres", to], ["Miktar", "tüm SOL ≈ " + (b - 0.000005).toFixed(6)], ["Not", "token hesaplarındaki kira (rent) bot cüzdanında kalır"]], warn: to === T().ph.pk ? "" : "⚠ Adres elle girildi: bir karakter bile yanlışsa para kaybolur. Adresi tekrar kontrol et.", okText: "ONAYLA · GÖNDER" }))) return;
    const r = await withdraw(to, "all"); log(`✔ ${r.sol.toFixed(6)} SOL gönderildi: <a href="https://solscan.io/tx/${esc(r.sig)}" target="_blank" rel="noopener">${esc(r.sig.slice(0, 10))}…</a>`, "up"); window.BUS && BUS.emit("order", { to: "ph" }); JOURNAL.add({ venue: "transfer", mode: "MANUEL", wallet: "BOT→" + (to === T().ph.pk ? "PHANTOM" : "ADRES"), side: "ÇEK", out: r.sol, unit: "SOL", sigOut: r.sig, closeT: Date.now(), note: to }); setTimeout(paintBal, 2000); });
  const jup = side => async () => { const m = ($("#bw-jm").value || "").trim(), raw = ($("#bw-ja").value || "").trim().replace(",", "."), sl = +($("#bw-js").value || "1").replace(",", ".");
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m)) throw new Error("geçersiz mint"); if (!(sl >= 0.1 && sl <= 30)) throw new Error("kayma %0.1–30");
    const ti = await tokInfo(m); const sym = ti ? ti.symbol : short(m), dec = ti ? ti.decimals : 6;
    let rawAmt, desc; if (side === "buy"){ const a = +raw; if (!(a > 0 && a <= 5)) throw new Error("AL: 0–5 SOL"); rawAmt = Math.round(a*1e9); desc = a + " SOL → " + sym; }
    else { const pc = +raw.replace("%", ""); if (!(pc > 0 && pc <= 100)) throw new Error("SAT: 1–100 (%)"); const hb = await tokenBal(m); if (!(hb > 0)) throw new Error("bu token bot cüzdanında yok"); rawAmt = Math.floor(hb*pc/100*10**dec); desc = fmt(hb*pc/100, 4) + " " + sym + " (%" + pc + ") → SOL"; }
    if (!(await sheet({ title: "BOT · JUPITER SWAP", mode: "GERÇEK", rows: [["Cüzdan", "BOT " + short(pub())], ["İşlem", side === "buy" ? "AL" : "SAT", side === "buy" ? "up" : "dn"], ["Swap", desc], ["Token", (ti && ti.isVerified ? "✔ " : "⚠ doğrulanmamış · ") + sym], ["Kayma", "%" + sl]], warn: "Bot cüzdanı bu cihazda imzalar ve hemen gönderir; Phantom penceresi açılmaz. Zincire gidince geri alınamaz.", okText: "ONAYLA · GÖNDER" }))) return;
    const pre = await solBal(); log("Jupiter swap hazırlanıyor…"); const r = await jupSwap(side === "buy" ? { inMint: SOLM, outMint: m, rawAmount: rawAmt, slipBps: Math.round(sl*100) } : { inMint: m, outMint: SOLM, rawAmount: rawAmt, slipBps: Math.round(sl*100) });
    const post = await solBal(); window.BUS && BUS.emit("order", { to: "bt" });
    log(`✔ Swap: <a href="https://solscan.io/tx/${esc(r.sig)}" target="_blank" rel="noopener">${esc(r.sig.slice(0, 10))}…</a> · SOL değişimi ${(post - pre).toFixed(6)}`, "up");
    recordTrade({ venue: "jupiter", mint: m, sym, side, solDelta: post - pre, sig: r.sig, auto: false }); paintBal(); };
  on("#bw-jb", jup("buy")); on("#bw-jx", jup("sell"));
  on("#bw-exp", async () => { const el = $("#bw-secret");
    el.innerHTML = `<div class="cf-warn">Yedeği göstermek için PIN'ini tekrar gir.</div><div class="f2"><label>PIN<input id="bw-xp" type="password" inputmode="numeric" autocomplete="current-password"></label><button type="button" id="bw-xg" class="mini wide" style="align-self:end">GÖSTER</button></div>`;
    $("#bw-xg").onclick = async () => { let s; try { s = await exportSecret($("#bw-xp").value); } catch(e){ log("✖ " + esc(e.message), "dn"); return; }
    el.innerHTML = `<div class="cf-warn">⚠ <b>GİZLİ ANAHTAR</b> — bunu gören herkes bot cüzdanındaki tüm parayı alabilir. Ekran görüntüsü alma, kimseye gönderme, sohbete yazma. Kağıda yaz ya da bir şifre yöneticisine kaydet. Phantom → Cüzdan ekle → Özel anahtarı içe aktar ile açılır.</div>
      <code class="bw-sec">${esc(s)}</code><div class="f2"><button type="button" class="mini wide" id="bw-sc">KOPYALA</button><button type="button" class="mini wide" id="bw-sh">GİZLE</button></div>`;
    $("#bw-sc").onclick = () => navigator.clipboard && navigator.clipboard.writeText(s).then(() => log("Gizli anahtar kopyalandı — panoyu temizlemeyi unutma.", "dn"));
    $("#bw-sh").onclick = () => { el.innerHTML = ""; }; setTimeout(() => { if (el) el.innerHTML = ""; }, 60000); log("Gizli anahtar 60 sn gösteriliyor", "dn"); }; });
  on("#bw-del", async () => { const b = await solBal().catch(() => null); const ok = await (window.CONN ? CONN.typedConfirm("BOT CÜZDANINI SİL", `Bu cihazdaki şifreli anahtar silinir. Bakiye: <b>${b === null ? "?" : b.toFixed(6)} SOL</b>${tokList.length ? " + " + tokList.length + " token" : ""}. Yedeğin yoksa içindeki her şey <b>kalıcı olarak</b> kaybolur. Önce TÜMÜNÜ GERİ ÇEK yap.`, "SİL") : false);
    if (!ok) return; if (window.AUTO) AUTO.kill(false); localStorage.removeItem(K); kp = null; render(); log("Bot cüzdanı bu cihazdan silindi.", "dn"); });
  const qe = $("#bw-qr"); if (qe) qr(qe, pub()); if (pub()) paintBal();
}
/* record a bot-wallet trade in the journal and keep positions in sync (used by manual bot trades and OTO AL-SAT) */
function recordTrade({ venue, mint, sym, side, solDelta, sig, auto, reason, tokens, mcapSol, curve }){
  if (side === "buy"){ const ex = pos.get(mint); const spent = -solDelta;
    if (ex){ const a = pos.list(); const p = a.find(x => x.mint === mint); p.solIn += spent; if (tokens) p.tokens = tokens; pos.save(a); if (p.jid) JOURNAL.upd(p.jid, { in: +p.solIn.toFixed(9) }); }
    else { const jid = JOURNAL.add({ venue, mode: auto ? "OTO" : "MANUEL", wallet: "BOT", sym, mint, side: "AL→SAT", in: +spent.toFixed(9), unit: "SOL", sigIn: sig, reason: reason || "", note: mcapSol ? "giriş mcap " + mcapSol.toFixed(1) + " SOL" : "" });
      pos.add({ mint, sym, venue, solIn: spent, tokens: tokens || null, t: Date.now(), auto: !!auto, jid, entryMcap: mcapSol || null, curve: curve || null }); } }
  else { const p = pos.get(mint); if (p && p.jid){ const e = JOURNAL.upd(p.jid, { out: +solDelta.toFixed(9), closeT: Date.now(), sigOut: sig, reason: reason || "satış" });
      if (e && typeof e.pnl === "number") NOTIFY.ping(e.pnl >= 0 ? "good" : "bad", `${sym} kapandı: ${e.pnl >= 0 ? "+" : ""}${e.pnl.toFixed(4)} SOL (${e.pnlPct >= 0 ? "+" : ""}${e.pnlPct}%)`); }
    else JOURNAL.add({ venue, mode: auto ? "OTO" : "MANUEL", wallet: "BOT", sym, mint, side: "SAT", out: +solDelta.toFixed(9), unit: "SOL", sigOut: sig, closeT: Date.now(), reason: reason || "", note: "eşleşen alış kaydı yok" });
    pos.del(mint); } }
function render(){ const box = $("#bot-box"); if (!box || window.BOTUI && BOTUI.tab !== "w") return; box.innerHTML = html(); bind(); }
window.addEventListener("pagehide", () => { kp = null; });
/* v6: sign-only (no send) for the low-latency executor (exec.js): it fans the signed bytes out to several RPCs / Jito itself */
function sign(tx){ if (!kp) throw new Error("bot cüzdanı kilitli (PIN ile aç)");
  if (tx.version !== undefined){ const payer = tx.message.staticAccountKeys[0].toBase58(); if (payer !== kp.publicKey.toBase58()) throw new Error("işlem bot cüzdanı için hazırlanmamış (" + short(payer) + ")"); tx.sign([kp]); }
  else tx.sign(kp); return tx; }
return { render, html, bind, exists: () => !!rec(), unlocked: () => !!kp, pub, sign, b58: b58enc, get kpPub(){ return kp ? kp.publicKey : null; }, solBal, tokenBal, signSendVersioned, recordTrade, pos, paintBal, solPrice, get solUsd(){ return solUsd; },
  _t: { encrypt, decrypt, b58enc, b58dec, create, unlock, lock, exportSecret, restore,
    /* test hook: sign a server-built tx with the bot key WITHOUT sending it */
    async signOnly(bytes){ if (!kp) throw new Error("kilitli"); const W = await W3(); const tx = W.VersionedTransaction.deserialize(bytes); const payer = tx.message.staticAccountKeys[0].toBase58(); tx.sign([kp]); return { payer, sigs: tx.signatures.length, signed: !tx.signatures[0].every(x => x === 0), len: tx.serialize().length }; } } };
})();
window.WALLET = WALLET;
