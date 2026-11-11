/* NEON//TERMINAL v7.2 — SUNUCU (remote control). The MEME bot can run 24/7 on an always-on machine (server/server.mjs: the same engine in headless Chrome).
   Pair once (server URL + token, or a pairing link …/#pair=<url>|<token>); both are kept only in this device's localStorage.
   While paired, the local MEME engine never trades: the MEME screen mirrors the server bot and every button controls it.
   The bot wallet travels only as the PIN-encrypted record; the PIN goes only over the authenticated HTTPS tunnel and is kept in server memory only. */
"use strict";
const REMOTE = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (x, d = 4) => (x === null || x === undefined || !isFinite(+x)) ? "—" : (+x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: Math.min(d, 2) });
const sg = (x, d = 4) => x === null || x === undefined ? "—" : (x >= 0 ? "+" : "") + fmt(x, d);
const pc = x => x === null || x === undefined || !isFinite(x) ? "—" : (x >= 0 ? "+" : "") + (+x).toFixed(1) + "%";
const short = a => a ? String(a).slice(0, 4) + "…" + String(a).slice(-4) : "—";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin", tm = ms => new Date(ms).toLocaleTimeString("tr-TR", { timeZone: TZ });
const msf = x => x === null || x === undefined || !isFinite(x) ? "—" : x >= 1000 ? (x/1000).toFixed(2) + " sn" : Math.round(x) + " ms";
const toast = (m, k) => window.NOTIFY ? NOTIFY.toast(m, k) : alert(m);
const K = "neon.srv";
let P = (() => { try { return JSON.parse(localStorage.getItem(K) || "null"); } catch(e){ return null; } })();
const S = { snap: null, srv: null, at: 0, conn: "off", err: "", ctx: null, ctxAt: 0, ab: null, poll: null, retry: 0, mode: "", rendered: false, gen: 0 };
const normUrl = u => { u = String(u || "").trim().replace(/\/+$/, ""); if (u && !/^https?:\/\//.test(u)) u = "https://" + u; return u; };
function parsePair(s){ s = String(s || "").trim(); const i = s.indexOf("#pair="); if (i >= 0) s = s.slice(i + 6); s = decodeURIComponent(s); const j = s.lastIndexOf("|"); if (j < 0) return null;
  const url = normUrl(s.slice(0, j)), token = s.slice(j + 1).trim(); if (!/^https:\/\/[^\s/]+$/.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) return null; if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null; return { url, token }; }
function pair(p){ P = { url: normUrl(p.url), token: p.token.trim(), at: Date.now() }; localStorage.setItem(K, JSON.stringify(P)); if (window.MEME && MEME.on) MEME.stop("SUNUCU eşlendi — OTO artık sunucuda"); S.snap = null; S.at = 0; S.rendered = false; connect(); full(); }
function unpair(){ disconnect(); P = null; localStorage.removeItem(K); S.snap = null; S.srv = null; S.rendered = false; full(); }
/* pairing link in the address bar: store, then strip it so the token does not stay in the URL / history */
(() => { const h = location.hash; if (!h.startsWith("#pair=")) return; const p = parsePair(h); history.replaceState(null, "", location.pathname + location.search + "#meme"); if (p){ P = { url: p.url, token: p.token, at: Date.now() }; localStorage.setItem(K, JSON.stringify(P)); setTimeout(() => toast("✔ SUNUCU eşlendi", "good"), 800); } else setTimeout(() => toast("✖ eşleşme linki geçersiz", "bad"), 800); })();
/* ---------------- transport ---------------- */
/* CORS-"simple" requests only (POST text/plain, token inside the JSON body): no preflight, which some tunnels swallow */
const req = (path, body, signal) => fetch(P.url + path, { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, body: JSON.stringify(Object.assign({}, body || {}, { t: P.token })), cache: "no-store", signal });
async function api(path, body, to = 20000){ if (!P) throw new Error("eşli sunucu yok"); const ac = new AbortController(), tt = setTimeout(() => ac.abort(), to);
  try { const r = await req(path, body, ac.signal);
    const j = await r.json().catch(() => ({})); if (r.status === 401) throw new Error("token geçersiz (yeniden eşle)"); if (!r.ok || j.ok === false) throw new Error(j.error || ("HTTP " + r.status)); return j; }
  catch(e){ if (e.name === "AbortError") throw new Error("sunucu cevap vermedi"); if (e instanceof TypeError) throw new Error("sunucuya ulaşılamadı (adres değişmiş ya da kapalı olabilir)"); throw e; }
  finally { clearTimeout(tt); } }
/* the tunnel URL can change (renewal / restart): the server publishes it AES-GCM-encrypted (key from the token) on a secret ntfy.sh topic (name from the token) */
const u8 = s => new TextEncoder().encode(s), hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
let discAt = 0;
async function discover(force){ if (!P || !crypto.subtle) return false;
  /* when the poll is already failing, retry ntfy every 5 s; while connected, at most every 20 s so a newly published URL is picked up without a button press */
  const cool = (force || S.conn === "err" || S.conn === "conn") ? 5000 : 20000;
  if (!force && Date.now() - discAt < cool) return false; discAt = Date.now();
  try { const topic = "neon" + hex(await crypto.subtle.digest("SHA-256", u8("neon-topic:" + P.token))).slice(0, 40);
    const key = await crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", u8("neon-url:" + P.token)), "AES-GCM", false, ["decrypt"]);
    const txt = await (await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=24h`, { cache: "no-store" })).text();
    let best = null; for (const line of txt.split("\n")){ if (!line.trim()) continue; try { const m = JSON.parse(line); if (m.event !== "message" || !m.message) continue; const b = unb64u(m.message.trim());
        const o = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, key, b.slice(12)))); if (o.u && (!best || o.t > best.t)) best = o; } catch(e){} }
    if (best && /^https:\/\/[^\s/]+$/.test(best.u) && best.u !== P.url){ P.url = best.u; localStorage.setItem(K, JSON.stringify(P)); S.err = "yeni sunucu adresi bulundu → bağlanılıyor"; toast("⟁ sunucu adresi güncellendi", "good"); connect(); return true; } }
  catch(e){} return false; }
function onData(j){ if (j.snap) S.snap = j.snap; if (j.srv) S.srv = j.srv; S.at = Date.now(); S.err = ""; S.conn = "ok"; S.retry = 0; paint(); }
async function stream(gen){ /* fetch-streamed SSE (lets us send the token in a header); falls back to polling */
  const ac = new AbortController(); S.ab = ac; let got = false;
  const wd = setTimeout(() => { if (!got) ac.abort(); }, 8000);
  try { const r = await req("/api/events", {}, ac.signal);
    if (r.status === 401) throw Object.assign(new Error("token geçersiz (yeniden eşle)"), { fatal: true }); if (!r.ok || !r.body) throw new Error("HTTP " + r.status);
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", idle = null;
    const kick = () => { clearTimeout(idle); idle = setTimeout(() => ac.abort(), 12000); }; kick();
    for (;;){ const { value, done } = await rd.read(); if (done || gen !== S.gen) break; buf += dec.decode(value, { stream: true }); kick(); let k;
      while ((k = buf.indexOf("\n\n")) >= 0){ const ev = buf.slice(0, k); buf = buf.slice(k + 2); const d = ev.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5)).join("\n"); if (!d) continue; got = true; clearTimeout(wd); try { onData(JSON.parse(d)); S.mode = "canlı akış"; } catch(e){} } }
    clearTimeout(idle); }
  catch(e){ if (e.fatal) throw e; }
  finally { clearTimeout(wd); }
  return got; }
async function loop(gen){ while (P && gen === S.gen){
    let streamed = false; if (S.noStream !== P.url){ try { streamed = await stream(gen); } catch(e){ S.conn = "err"; S.err = e.message; paint(); if (await discover(true)) return; } if (!streamed && S.at) S.noStream = P.url; /* tunnel buffers streams → just poll */ }
    if (!streamed && (!S.at || Date.now() - S.at > 4000) && await discover()) return;
    if (gen !== S.gen) return;
    if (!streamed){ /* polling fallback for ~30 s, then try the stream again */ S.mode = "yoklama";
      for (let i = 0; i < (S.noStream === P.url ? 1e9 : 20) && P && gen === S.gen; i++){
        try { onData(await api("/api/status", undefined, 8000)); if (i && i % 10 === 0) await discover(); }
        catch(e){ S.conn = Date.now() - S.at > 6000 ? "err" : S.conn; S.err = e.message; paint();
          /* never stop the loop: a stale URL can look like a 401, and the new address is on ntfy */
          if (await discover(true)) return;
          await new Promise(r => setTimeout(r, Math.min(6000, 800 + S.retry++*800))); continue; }
        await new Promise(r => setTimeout(r, 1500)); } }
    else await new Promise(r => setTimeout(r, 500)); } }
function connect(){ disconnect(); if (!P) return; S.conn = "conn"; const gen = ++S.gen; loop(gen); clearInterval(S.ctxT); S.ctxT = setInterval(() => { if (S.conn === "ok" && document.body.dataset.pg === "grok") refreshCtx(); }, 15000); refreshCtx(); }
function disconnect(){ S.gen++; if (S.ab) try { S.ab.abort(); } catch(e){} S.ab = null; clearInterval(S.ctxT); S.conn = "off"; }
async function refreshCtx(){ try { const j = await api("/api/context", undefined, 10000); S.ctx = j.context; S.ctxAt = Date.now(); } catch(e){} }
async function cmd(path, body, okMsg){ try { const j = await api(path, body || {}); if (j.snap) onData(j); toast("✔ " + (okMsg || j.result || "tamam"), "good"); return j; } catch(e){ toast("✖ " + e.message, "bad"); return null; } }
/* ---------------- confirmations (phone side) ---------------- */
const tconf = (t, h, w) => window.CONN ? CONN.typedConfirm(t, h, w) : Promise.resolve(confirm(t));
const sheet = o => window.TRADE && TRADE.confirmSheet ? TRADE.confirmSheet(o) : Promise.resolve(confirm(o.title));
async function setMode(m){ const s = S.snap; if (!s || m === s.mode) return; if (s.on){ toast("Önce OTO'yu durdur", "bad"); return; }
  if (m === "GERÇEK"){ if (!s.wallet.exists){ toast("Sunucuda BOT CÜZDANI yok — SUNUCU bölümünden şifreli cüzdanını gönder", "bad"); return; }
    if (!(await tconf("SUNUCU · GERÇEK MODA GEÇ", "Sunucudaki MEME botu bundan sonra <b>BOT CÜZDANI'ndaki gerçek SOL</b> ile işlem yapar (" + esc(short(s.wallet.pub)) + "). Telefonun kapalıyken de çalışır.", "GERÇEK"))) return;
    return cmd("/api/mode", { mode: "GERÇEK", confirm: "GERÇEK" }, "mod GERÇEK"); }
  return cmd("/api/mode", { mode: "SIM" }, "mod SIM"); }
async function armToggle(){ const s = S.snap; if (!s) return; if (s.on) return cmd("/api/stop", {}, "OTO durdu");
  if (s.mode === "GERÇEK"){ if (!s.wallet.unlocked){ toast("Sunucuda BOT CÜZDANI kilitli — SUNUCU bölümünden PIN ile aç", "bad"); return; }
    if (!(await tconf("SUNUCU · GERÇEK OTO AL-SAT", `Sunucu, onay sormadan <b>gerçek SOL</b> ile alıp satacak — telefonun kapalıyken de. pump.fun coinlerinin çoğu kısa sürede sıfıra yakın düşer. Temel boyut ${s.C.base} SOL, işlem başı max ${s.C.maxTrade} SOL, bütçe ${s.C.budget} SOL, günlük max zarar ${s.C.dailyLoss} SOL. Durdurmak için ■ HEPSİNİ DURDUR.`, "GERÇEK"))) return;
    return cmd("/api/arm", { confirm: "GERÇEK" }, "GERÇEK OTO açık"); }
  return cmd("/api/arm", {}, "OTO açık (SIM)"); }
async function kill(){ const s = S.snap, n = s ? s.pos.length : 0; const r = await new Promise(res => { $("#cf-box").innerHTML = `<div class="cf-mode real">■ HEPSİNİ DURDUR<small>SUNUCU BOTU</small></div><div class="sheet-title">SUNUCUDAKİ TÜM OTOMATİK İŞLEMLERİ DURDUR</div><div class="cf-warn">Sunucudaki MEME OTO (izleyici + kopyacı) hemen kapanır.</div><label class="chk"><input type="checkbox" id="k-sell" ${n ? "" : "disabled"}> ${n} ${s ? esc(s.mode) : ""} pozisyonunu da piyasadan SAT</label><div class="sheet-btns"><button type="button" id="cf-no">İPTAL</button><button type="button" id="cf-ok" class="cf-ok real">DURDUR</button></div>`;
    const box = $("#confirm"); box.classList.remove("hidden"); const done = v => { const c = $("#k-sell"); const o = v && { sell: !!(c && c.checked) }; box.classList.add("hidden"); $("#cf-box").innerHTML = ""; res(o); };
    $("#cf-no").onclick = () => done(null); $("#cf-ok").onclick = () => done(true); });
  if (r) await cmd("/api/kill", r, "sunucu durdu"); }
async function sell(mint){ const s = S.snap, p = s && s.pos.find(x => x.mint === mint); if (!p) return;
  if (!(await sheet({ title: (s.mode === "GERÇEK" ? "" : "SIM · ") + "SAT · SUNUCU BOTU", mode: s.mode === "GERÇEK" ? "GERÇEK" : "SIM", rows: [["Token", p.sym], ["Maliyet", fmt(p.solIn, 4) + " SOL"], ["Tahmini değer", fmt(p.val, 4) + " SOL"]], okText: "ONAYLA · SAT" }))) return;
  return cmd("/api/sell", { mint }, p.sym + " satıldı"); }
/* GROK on the phone sees the server bot and its suggestions go to the server */
function apply(a){ try {
  if (a.type === "set"){ cmd("/api/set", { key: a.key, value: a.value }, `${a.key} = ${a.value} (sunucu)`); return `→ sunucuya gönderildi: ${a.key} = ${a.value}`; }
  if (a.type === "pause"){ cmd("/api/pause", { min: a.min }, "ara (sunucu)"); return "→ sunucuya gönderildi"; }
  if (a.type === "stop"){ cmd("/api/stop", {}, "OTO durdu (sunucu)"); return "→ sunucuya gönderildi"; }
  if (a.type === "sell"){ sell(a.mint); return "ONAY ekranı açıldı"; }
  if (a.type === "track"){ cmd("/api/track", { addr: a.wallet, label: a.label }, "takibe alındı (sunucu)"); return "→ sunucuya gönderildi"; }
  if (a.type === "untrack"){ cmd("/api/untrack", { addr: a.wallet }, "takipten çıkarıldı (sunucu)"); return "→ sunucuya gönderildi"; }
  if (a.type === "buy") return "✖ SUNUCU modunda GROK'tan elle alım yok (sunucu kurallarla alır)";
  throw new Error("bilinmeyen öneri türü: " + a.type); } catch(e){ return "✖ " + e.message; } }
/* ---------------- wallet → server ---------------- */
async function walletUpload(){ const W = window.WALLET, b = W && W.blob && W.blob(); if (!b){ toast("Bu telefonda BOT CÜZDANI yok (CÜZDAN sekmesi)", "bad"); return; } const s = S.snap;
  let replace = false; if (s && s.wallet.exists && s.wallet.pub !== b.pub){ if (!(await tconf("SUNUCUDAKİ CÜZDANI DEĞİŞTİR", `Sunucuda başka bir bot cüzdanı var (${esc(short(s.wallet.pub))}). Onun şifreli kaydı silinip yerine bu telefondakinin (${esc(short(b.pub))}) şifreli kaydı konacak.`, "DEĞİŞTİR"))) return; replace = true; }
  if (!(await sheet({ title: "ŞİFRELİ CÜZDANI SUNUCUYA GÖNDER", mode: "GERÇEK", rows: [["Adres", short(b.pub)], ["Giden", "yalnızca PIN ile şifreli kayıt"], ["Şifreleme", (b.kdf || "PBKDF2") + " " + b.iter + " + AES-GCM"]], warn: "Gizli anahtarın açık hali gönderilmez. Sunucuda kullanılması için ayrıca PIN'i girip KİLİDİ AÇ'man gerekir; PIN yalnızca sunucunun belleğinde tutulur, yeniden başlatınca kilit kendiliğinden kapanır.", okText: "GÖNDER" }))) return;
  return cmd("/api/wallet/upload", { blob: b, replace }, "şifreli cüzdan sunucuda"); }
async function walletUnlock(){ const i = $("#sv-pin"), pin = i ? i.value : ""; if (!pin){ toast("PIN gir", "bad"); return; } const b = $("#sv-unl"); if (b) b.disabled = true;
  try { await cmd("/api/wallet/unlock", { pin }, "sunucuda cüzdan kilidi açık"); } finally { if (i) i.value = ""; if (b) b.disabled = false; } }
async function walletRemove(){ const s = S.snap; if (!s || !s.wallet.exists) return; if (!(await tconf("SUNUCUDAKİ CÜZDANI SİL", `Sunucudaki şifreli kayıt silinir (${esc(short(s.wallet.pub))}). Telefondaki kayıt etkilenmez. Bakiyeyi önce çekmediysen anahtar telefonda durmalı!`, "SİL"))) return;
  return cmd("/api/wallet/remove", { confirm: "SİL" }, "sunucudaki cüzdan silindi"); }
/* ---------------- UI: SUNUCU panel ---------------- */
const ago = t => { if (!t) return "—"; const s = Math.round((Date.now() - t)/1000); return s < 60 ? s + " sn önce" : Math.round(s/60) + " dk önce"; };
const up = s => { if (!(s >= 0)) return "—"; const h = Math.floor(s/3600), m = Math.floor(s%3600/60); return h ? `${h} sa ${m} dk` : `${m} dk`; };
function srvHTML(){ if (!P) return `<div class="plan-foot">MEME botu telefonun kapalıyken de <b>7/24 sunucuda</b> çalışabilir. Sunucunun verdiği <b>eşleşme linkini</b> aç ya da aşağıya yapıştır. Adres ve token yalnızca bu telefonda saklanır.</div>
    <label>Eşleşme linki<input id="sv-link" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…/#pair=https://….trycloudflare.com|token"></label>
    <div class="f2"><label>Sunucu adresi<input id="sv-url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://….trycloudflare.com"></label><label>Token<input id="sv-tok" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"></label></div>
    <button type="button" id="sv-pair" class="mini wide">⟁ SUNUCUYA BAĞLAN</button>`;
  return `<div class="sv-st" id="sv-st"></div><div class="sv-kv" id="sv-kv"></div>
    <div class="f2"><button type="button" id="sv-re" class="mini wide">↻ YENİDEN BAĞLAN</button><button type="button" id="sv-un" class="mini wide s">EŞLEŞMEYİ KALDIR</button></div>
    <details class="keys" id="sv-wd"><summary>◈ BOT CÜZDANI · GERÇEK MOD</summary><div id="sv-w"></div>
      <div class="f2"><button type="button" id="sv-up" class="mini wide">⇪ ŞİFRELİ CÜZDANI GÖNDER</button><button type="button" id="sv-del" class="mini wide s">SUNUCUDAN SİL</button></div>
      <div class="f2"><label>PIN (yalnızca sunucu belleğinde)<input id="sv-pin" type="password" inputmode="numeric" autocomplete="off"></label><button type="button" id="sv-unl" class="mini wide" style="align-self:end">🔓 SUNUCUDA KİLİDİ AÇ</button></div>
      <button type="button" id="sv-lock" class="mini wide">🔒 SUNUCUDA KİLİTLE</button>
      <div class="plan-foot">1) CÜZDAN sekmesinde bot cüzdanın olsun · 2) ŞİFRELİ CÜZDANI GÖNDER (anahtarın açık hali gitmez) · 3) PIN → KİLİDİ AÇ · 4) üstte GERÇEK'e geç (GERÇEK yaz) · 5) ▶ OTO BAŞLAT (GERÇEK yaz). Sunucu yeniden başlarsa kilit kapanır ve GERÇEK işlem durur; tekrar PIN gir. SIM kendiliğinden devam eder.</div></details>`; }
function srvBind(){ const b = (id, f) => { const e = $(id); if (e) e.onclick = f; };
  b("#sv-pair", () => { const l = $("#sv-link").value; let p = l ? parsePair(l) : null; if (!p && !l){ const u = normUrl($("#sv-url").value), t = $("#sv-tok").value.trim(); if (u && t) p = parsePair(u + "|" + t); } if (!p){ toast("✖ link ya da adres/token geçersiz", "bad"); return; } pair(p); });
  b("#sv-re", async () => { S.retry = 0; if (!(await discover(true))) connect(); paint(); }); b("#sv-un", async () => { if (await tconf("EŞLEŞMEYİ KALDIR", "Telefon sunucu botunu kontrol etmeyi bırakır. <b>Sunucudaki bot çalışmaya devam eder</b> (durdurmak için önce ■ HEPSİNİ DURDUR).", "KALDIR")) unpair(); });
  b("#sv-up", walletUpload); b("#sv-unl", walletUnlock); b("#sv-del", walletRemove); b("#sv-lock", () => cmd("/api/wallet/lock", {}, "sunucuda kilitli")); }
function paintSrv(){ const st = $("#sv-st"); if (!st) return; const s = S.snap, v = S.srv || {}; const fresh = S.at && Date.now() - S.at < 10000;
  st.className = "sv-st " + (fresh ? "ok" : S.conn === "conn" && !S.at ? "wait" : "bad");
  const hunting = !fresh && (S.conn === "err" || S.conn === "conn" || /adresi/.test(S.err || ""));
  st.innerHTML = fresh ? `● BAĞLI · ${esc(S.mode)} · son güncelleme <b>${tm(S.at)}</b> <small>(${ago(S.at)})</small>` : S.conn === "conn" && !S.at ? "○ bağlanıyor…" : hunting ? `○ yeni adres aranıyor…${S.at ? ` · son veri ${tm(S.at)} (${ago(S.at)})` : ""}<small>${esc(S.err || "sunucu adresi yenilenmiş olabilir — otomatik bulunuyor")}</small>` : `✖ BAĞLANTI YOK${S.at ? ` · son veri ${tm(S.at)} (${ago(S.at)})` : ""}<small>${esc(S.err || "")}</small><small>Birkaç saniye içinde kendiliğinden bağlanır. Olmazsa ↻ YENİDEN BAĞLAN'a bas.</small>`;
  const kv = $("#sv-kv"); if (kv) kv.innerHTML = `<div><span>adres</span><b>${esc(P.url.replace(/^https:\/\//, ""))}</b></div><div><span>sunucu çalışma süresi</span><b>${up(v.uptime)}</b></div><div><span>bot sayfası</span><b>${v.page ? esc(v.page) : "—"}${v.reloads ? " · " + v.reloads + " yeniden yükleme" : ""}</b></div><div><span>yerel motor</span><b class="up">BOŞTA (işlem yapmaz)</b></div>`;
  const w = $("#sv-w"); if (w){ const loc = window.WALLET && WALLET.blob && WALLET.blob(); w.innerHTML = `<div class="sv-kv"><div><span>sunucudaki cüzdan</span><b>${s && s.wallet.exists ? esc(short(s.wallet.pub)) + (s.wallet.unlocked ? ' <span class="up">🔓 açık</span>' : ' <span class="y">🔒 kilitli</span>') : "yok"}</b></div><div><span>bakiye</span><b>${s && s.wallet.bal !== null ? fmt(s.wallet.bal, 4) + " SOL" : "—"}</b></div><div><span>bu telefondaki cüzdan</span><b>${loc ? esc(short(loc.pub)) + (s && s.wallet.pub === loc.pub ? ' <span class="up">= sunucu</span>' : "") : "yok"}</b></div></div>`; } }
/* ---------------- UI: mirrored MEME screen ---------------- */
const RI = (p, lab) => `<label>${lab}<input data-r="${p}" inputmode="decimal"></label>`, RC = (p, lab) => `<label class="chk"><input type="checkbox" data-r="${p}"> ${lab}</label>`;
const AG = (id, ic, name, col) => `<div class="ag" id="rg-${id}" style="--ac:${col}"><div class="ag-h"><span class="ag-ic">${ic}</span><b>${name}</b><span class="ag-st" id="rgs-${id}">—</span></div><div class="ag-b" id="rgb-${id}"></div></div>`;
function mirrorHTML(){ return `<div class="sv-banner" id="rm-ban">🖥 SUNUCU BOTU · 7/24</div>
  <div class="mm-bar"><div class="seg" role="group" aria-label="Mod"><button type="button" data-rmode="SIM">SIM</button><button type="button" data-rmode="GERÇEK">GERÇEK</button></div><button type="button" id="rm-arm" class="arm">▶ OTO BAŞLAT</button></div>
  <div class="mm-hero rm-hero"><div class="mm-bal"><div class="mm-badges"><span class="mode-badge" id="rm-badge"></span><span id="rm-auto" class="pill"></span></div><div class="mm-big"><span id="rm-eq">—</span><small>SOL</small></div><div class="mm-usd" id="rm-usd"></div><div class="mm-dep" id="rm-dep"></div></div></div>
  <div class="mm-kpis" id="rm-kpis"></div>
  <div class="mm-eqc"><div class="sub-h">HESAP EĞRİSİ <small>sunucu · ▲ alış · ▼ satış · ◆ risk</small></div><canvas id="rm-eqcv"></canvas></div>
  <div class="sub-h">AJANLAR</div><div class="ags">${AG("w", "👁", "İZLEYİCİ", "#00f0ff")}${AG("c", "🔁", "KOPYACI", "#ff2bd6")}${AG("x", "⚡", "YÜRÜTÜCÜ", "#ffe600")}${AG("r", "⛨", "RİSK", "#39ff14")}</div>
  <div class="sub-h">AÇIK POZİSYONLAR <small id="rm-posn"></small></div><div id="rm-pos" class="pos-list"></div>
  <div class="sub-h">SON HATALAR</div><div id="rm-err" class="mm-tl rm-err"></div>
  <div class="sub-h">BU GECE <small>zaman çizelgesi · sunucu</small></div><div id="rm-tl" class="mm-tl"></div>
  <div class="sub-h">İŞLEM ŞERİDİ</div><div id="rm-tape" class="mm-tape"></div>
  <div class="sub-h">ÖNCE HESABI KORU, SONRA BÜYÜT</div><div class="ladder" id="rm-lad"></div>
  <div class="rules">${RC("rules.half", "Kayıptan sonra boyutu yarıya indir")}${RC("rules.pause2", "2 kayıp üst üste → ara ver")}${RC("rules.upHigh", "Boyutu yalnızca yeni hesap zirvesinde büyüt")}${RI("rules.pauseMin", "Ara süresi (dk)")}</div>
  <div class="sub-h">TAKİP EDİLEN CÜZDANLAR <small id="rm-cpst"></small></div>
  <div class="f2"><label>Cüzdan adresi<input id="rm-addr" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Solana adresi"></label><label>Etiket<input id="rm-lab" autocomplete="off" placeholder="ör. balina1"></label></div>
  <button type="button" id="rm-add" class="mini wide">+ TAKİBE AL (sunucu)</button><div id="rm-wal" class="wals"></div>
  <div class="sub-h">GECİKME</div><div id="rm-lat" class="lat"></div>
  <details class="keys"><summary>⚙ BOYUT · LİMİTLER · ÇIKIŞ</summary><div class="f3">${RI("base", "Temel boyut SOL")}${RI("maxTrade", "İşlem başı max SOL")}${RI("budget", "Toplam bütçe SOL")}</div><div class="f3">${RI("dailyLoss", "Günlük max zarar SOL")}${RI("maxPos", "Max açık poz.")}${RI("holdMin", "Max tutma dk")}</div><div class="f3">${RI("tp", "Kâr al +%")}${RI("sl", "Zarar kes −%")}${RI("trail", "İz süren stop %")}</div><div class="f2">${RI("slip", "Kayma %")}${RI("prio", "Öncelik ücreti SOL")}</div></details>
  <details class="keys"><summary>👁 İZLEYİCİ filtreleri</summary>${RC("w.on", "İzleyici açık")}<div class="f3">${RI("w.minInit", "Min dev alımı SOL")}${RI("w.minMcap", "Min mcap SOL")}${RI("w.maxMcap", "Max mcap SOL")}</div><div class="f3">${RI("w.maxDev", "Dev payı ≤ %")}${RI("w.maxRisk", "Rug riski ≤")}${RI("w.waitSec", "Bekle sn")}</div><div class="f2">${RI("w.minMom", "Momentum ≥ %")}${RC("w.needSoc", "sosyal hesap şart")}</div></details>
  <details class="keys"><summary>🔁 KOPYACI</summary>${RC("cp.on", "Kopyacı açık")}${RC("cp.follow", "Cüzdan satınca biz de satalım")}<div class="f3">${RI("cp.minSrc", "Min kaynak alımı SOL")}${RI("cp.maxMcap", "Max mcap SOL")}${RI("cp.cool", "Aynı token bekleme sn")}</div><div class="f3">${RI("cp.max10", "Cüzdan başı 10 dk max")}<label>Boyut<select data-r="cp.sizeMode"><option value="fixed">sabit</option><option value="ratio">oran×kaynak</option></select></label>${RI("cp.ratio", "Oran")}</div></details>
  <details class="keys"><summary>◎ SIM hesabı · otomatik başlat</summary><div class="f2">${RI("dep", "SIM sanal yatırım SOL")}<button type="button" id="rm-simreset" class="mini wide s" style="align-self:end">SIM'İ SIFIRLA</button></div>
    <label class="chk real-chk"><input type="checkbox" id="rm-autostart"> ⚠ otomatik başlat <small>(sunucu yeniden başlayınca OTO kendiliğinden açılır; GERÇEK modda yalnızca PIN ile kilit açılınca)</small></label></details>
  <div class="plan-foot">Bu ekran <b>sunucudaki</b> botu gösterir ve yönetir; telefondaki yerel motor işlem yapmaz. Sayfayı kapatsan da sunucu çalışmaya devam eder. Yatırım tavsiyesi değildir.</div>`; }
function mirrorBind(){ const box = $("#meme-box");
  box.querySelectorAll("[data-rmode]").forEach(b => b.onclick = () => setMode(b.dataset.rmode)); $("#rm-arm").onclick = armToggle;
  box.querySelectorAll("[data-r]").forEach(i => i.addEventListener("change", async () => { const k = i.dataset.r, v = i.type === "checkbox" ? i.checked : i.value; i.dataset.busy = "1";
    const j = await cmd("/api/set", { key: k, value: v }, null); delete i.dataset.busy; if (!j) syncInputs(true); }));
  $("#rm-autostart").onchange = async e => { if (e.target.checked && !(await tconf("SUNUCU · OTOMATİK BAŞLAT", "Sunucu her yeniden başladığında OTO <b>kendiliğinden</b> açılır (GERÇEK modda yalnızca sen PIN ile kilidi açınca).", "BAŞLAT"))){ e.target.checked = false; return; } cmd("/api/autostart", { on: e.target.checked }, "otomatik başlat " + (e.target.checked ? "açık" : "kapalı")); };
  $("#rm-simreset").onclick = async () => { if (await tconf("SUNUCU · SIM HESABINI SIFIRLA", "Sunucudaki SIM bakiyesi, pozisyonları, eğrisi ve risk durumu sıfırlanır.", "SIFIRLA")) cmd("/api/simreset", { confirm: "SIFIRLA" }, "SIM sıfırlandı"); };
  $("#rm-add").onclick = () => { const a = $("#rm-addr").value.trim(); if (!a) return; cmd("/api/track", { addr: a, label: $("#rm-lab").value.trim() }, "takibe alındı").then(j => { if (j){ $("#rm-addr").value = ""; $("#rm-lab").value = ""; } }); };
  box.addEventListener("click", e => { const t = e.target.closest("[data-rsell],[data-rwd],[data-rend]"); if (!t) return; if (t.dataset.rsell) sell(t.dataset.rsell); else if (t.dataset.rwd) cmd("/api/untrack", { addr: t.dataset.rwd }, "takipten çıkarıldı"); else cmd("/api/endpause", {}, "ara bitti"); });
  box.addEventListener("change", e => { const t = e.target; if (t.dataset && t.dataset.rwt) cmd("/api/wtoggle", { addr: t.dataset.rwt, on: t.checked }, t.checked ? "kopya açık" : "kopya kapalı"); }); }
const getC = (C, p) => p.split(".").reduce((o, k) => o && o[k], C);
function syncInputs(force){ const s = S.snap; if (!s) return; document.querySelectorAll("#meme-box [data-r]").forEach(i => { if (!force && (i === document.activeElement || i.dataset.busy)) return; const v = getC(s.C, i.dataset.r); if (i.type === "checkbox") i.checked = !!v; else if (String(i.value) !== String(v ?? "")) i.value = v ?? ""; });
  const a = $("#rm-autostart"); if (a && a !== document.activeElement) a.checked = !!s.autoStart; }
const srcLab = s => s === "copy" ? "KOPYA" : s === "watcher" ? "İZLEYİCİ" : s === "grok" ? "GROK" : "ELLE";
let lastSlow = 0;
function paintMirror(){ const s = S.snap; if (!s || !$("#rm-eq")) return; const real = s.mode === "GERÇEK", fresh = Date.now() - S.at < 10000;
  $("#rm-ban").className = "sv-banner " + (fresh ? "ok" : "bad"); $("#rm-ban").innerHTML = fresh ? `🖥 SUNUCU BOTU · 7/24 · ● canlı <small>${tm(S.at)}</small>` : `🖥 SUNUCU BOTU · ✖ bağlantı yok <small>son veri ${S.at ? tm(S.at) : "—"} · aşağıdaki değerler eski olabilir</small>`;
  document.querySelectorAll("[data-rmode]").forEach(b => { const on = b.dataset.rmode === s.mode; b.className = on ? (real ? "on real" : "on") : ""; });
  const arm = $("#rm-arm"); arm.textContent = s.on ? "■ OTO DURDUR" : "▶ OTO BAŞLAT"; arm.classList.toggle("on", s.on);
  const bd = $("#rm-badge"); bd.className = "mode-badge " + (real ? "real" : "sim"); bd.textContent = real ? "⚠ GERÇEK" : "SIM · SANAL";
  const au = $("#rm-auto"); au.textContent = s.on ? "● OTO AÇIK" : "○ OTO KAPALI"; au.className = "pill " + (s.on ? "g" : "");
  $("#rm-eq").textContent = s.equity === null ? "…" : fmt(s.equity, 4); $("#rm-usd").textContent = s.equity !== null && s.solUsd ? "≈ $" + (s.equity*s.solUsd).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "";
  const dp = s.equity !== null && s.dep ? (s.equity/s.dep - 1)*100 : null; $("#rm-dep").innerHTML = dp === null ? "" : `<b class="${dp >= 0 ? "up" : "dn"}">${pc(dp)}</b> yatırımdan beri <small>(${fmt(s.dep, 3)} SOL${real ? "" : " sanal"})</small>`;
  $("#rm-kpis").innerHTML = `<div><small>BUGÜN</small><b class="${s.today >= 0 ? "up" : "dn"}">${sg(s.today, 4)}</b></div><div><small>İŞLEM</small><b>${s.trades}</b></div><div><small>KAZANMA</small><b>${s.trades ? Math.round(s.wins/s.trades*100) + "%" : "—"}</b></div><div><small>AÇIK</small><b>${s.pos.length}/${s.C.maxPos}</b></div>`;
  const A = s.agents, x = A.x, st = (id, txt, on) => { const e = $("#rgs-" + id); e.textContent = txt; e.className = "ag-st " + (on ? "on" : ""); $("#rg-" + id).classList.toggle("live", !!on); };
  st("w", s.on && s.C.w.on ? "● İZLİYOR" : s.C.w.on ? "○ hazır" : "kapalı", s.on && s.C.w.on);
  $("#rgb-w").innerHTML = `<div><span>görülen</span><b>${A.seen}</b></div><div><span>filtreyi geçen</span><b>${A.passed}</b></div><div><span>aday</span><b>${A.cands}</b></div><div><span>yeni/dk</span><b>${A.rate}</b></div><div class="ag-l">${esc(A.wLast || (A.pumpLive ? "yeni token bekleniyor" : "akış bağlanıyor"))}</div>`;
  const cpOn = A.cp.list.filter(w => w.on).length; st("c", s.on && s.C.cp.on && cpOn ? "● KOPYALIYOR" : !cpOn ? "cüzdan yok" : s.C.cp.on ? "○ hazır" : "kapalı", s.on && s.C.cp.on && cpOn);
  $("#rgb-c").innerHTML = `<div><span>cüzdan</span><b>${cpOn}/${A.cp.list.length}</b></div><div><span>WS abonelik</span><b>${A.cp.live ? A.cp.subs + (A.cp.poll ? " +HTTP" : "") : "—"}</b></div><div><span>görülen işlem</span><b>${A.cp.list.reduce((a, w) => a + w.n, 0)}</b></div><div><span>giriş</span><b>${A.entered}</b></div><div class="ag-l">${A.cp.last ? `son: <b>${esc(A.cp.last.sym)}</b> ← ${esc(A.cp.last.w)} · ${tm(A.cp.last.at)}` : esc(A.cp.skip || "kopya bekleniyor")}</div>`;
  st("x", x.pend ? "● GÖNDERİYOR" : real ? (s.wallet.unlocked ? "● HAZIR" : "🔒 kilitli") : "SIM", x.pend || (real && s.wallet.unlocked));
  $("#rgb-x").innerHTML = `<div><span>olay→gön.</span><b>${msf(x.ev2sent)}</b></div><div><span>gön.→onay</span><b>${msf(x.sent2conf)}</b></div><div><span>onay/hata</span><b>${x.conf}/${x.fail}</b></div><div><span>blockhash</span><b>${x.bhAge === null || x.bhAge === undefined ? "—" : (x.bhAge/1000).toFixed(1) + " sn"}</b></div><div class="ag-l">${real ? "GERÇEK: BOT CÜZDANI " + esc(short(s.wallet.pub)) : "SIM: gönderim yok · dolum canlı curve'den"}</div>`;
  const R = s.risk, paused = R.pauseUntil > Date.now(), dl = s.today; st("r", paused ? "⏸ ARA" : dl <= -s.C.dailyLoss ? "■ GÜNLÜK STOP" : "● KORUYOR", !paused && dl > -s.C.dailyLoss);
  $("#rgb-r").innerHTML = `<div><span>boyut çarpanı</span><b class="${R.mult < 1 ? "y" : ""}">${R.mult}x</b></div><div><span>ardışık kayıp</span><b>${R.consec}</b></div><div><span>bugün</span><b class="${dl >= 0 ? "up" : "dn"}">${sg(dl, 3)}</b></div><div><span>hesap zirvesi</span><b>${fmt(R.eqHigh, 3)}</b></div><div class="ag-l">${paused ? `ara: ${tm(R.pauseUntil)}'e kadar` : `sıradaki boyut ${fmt(R.next, 3)} SOL`}</div>`;
  $("#rm-posn").textContent = s.pos.length ? `${s.pos.length} · ${fmt(s.deployed, 3)} SOL` : "";
  $("#rm-pos").innerHTML = s.pos.length ? s.pos.map(p => { const has = p.pnl !== null; return `<div class="pos ${!has ? "" : p.pnl >= 0 ? "l" : "s"}"><b>${esc(p.sym)} <span class="pill ${p.src === "copy" ? "m" : "y"}">${srcLab(p.src)}</span>${p.w ? ` <small>${esc(p.w)}</small>` : ""}</b>
    <span>${fmt(p.tokens, 0)}${p.est ? "~" : ""} adet · maliyet ${fmt(p.solIn, 4)} SOL · ${Math.floor((Date.now() - p.t)/60000)} dk${p.mcap ? " · mcap " + fmt(p.mcap, 1) : ""}</span>
    <span class="${has && p.pnl >= 0 ? "up" : "dn"}">${!has ? "canlı fiyat bekleniyor…" : `≈ ${fmt(p.val, 4)} SOL (${pc(p.pnl)})${p.hi > 0 ? " · zirve " + pc(p.hi) : ""}`}</span><button type="button" data-rsell="${esc(p.mint)}">SAT</button></div>`; }).join("") : `<div class="empty">açık pozisyon yok${s.on ? " — ajanlar fırsat arıyor" : ""}</div>`;
  const lv = [1, 0.5, 0.25], used = Math.min(1, Math.max(0, -dl)/s.C.dailyLoss);
  $("#rm-lad").innerHTML = `<div class="rungs">${lv.map(v => `<div class="rung ${R.mult === v ? "on" : ""}"><b>${v}x</b><span>${fmt(Math.min(s.C.maxTrade, s.C.base*v), 3)} SOL</span><small>${v === 1 ? "tam · yalnızca yeni zirvede" : v === 0.5 ? "1 kayıp sonrası" : "art arda kayıp"}</small></div>`).join("")}</div>
    <div class="lad-r"><div><small>GÜNLÜK ZARAR LİMİTİ</small><div class="bar"><div style="width:${(used*100).toFixed(0)}%" class="${used > .7 ? "r" : used > .4 ? "y" : ""}"></div></div><span>${fmt(Math.max(0, -dl), 3)} / ${s.C.dailyLoss} SOL</span></div>
    <div><small>ARDIŞIK KAYIP</small><div class="dots">${[0, 1].map(i => `<i class="${R.consec > i ? "on" : ""}"></i>`).join("")}</div><span>${paused ? "⏸ " + Math.ceil((R.pauseUntil - Date.now())/60000) + ` dk ara <button type="button" class="mini" data-rend="1">ARAYI BİTİR</button>` : "2 kayıp = " + s.C.rules.pauseMin + " dk ara"}</span></div>
    <div><small>BÜTÇE KULLANIMI</small><div class="bar"><div style="width:${Math.min(100, s.deployed/s.C.budget*100).toFixed(0)}%"></div></div><span>${fmt(s.deployed, 3)} / ${s.C.budget} SOL</span></div></div>`;
  syncInputs(false); drawEq(s);
  if (Date.now() - lastSlow > 2500){ lastSlow = Date.now();
    const tlh = L => L.length ? L.map(x => `<div class="tl ${esc(x.c)} k-${esc(x.k)}"><i></i><small>${tm(x.t)}</small><span>${x.h}</span></div>`).join("") : `<div class="empty">olay yok</div>`; /* x.h is HTML the bot built with esc() for every outside value */
    $("#rm-tl").innerHTML = tlh(s.tl.slice(0, 40)); $("#rm-err").innerHTML = s.errs.length ? tlh(s.errs) : `<div class="empty">hata yok</div>`;
    $("#rm-tape").innerHTML = s.tape.length ? s.tape.map(x => `<div class="${x.side === "buy" ? "up" : "dn"} ${x.us ? "us" : ""}"><small>${tm(x.t)}</small><b>${x.side === "buy" ? "AL" : "SAT"}</b><span>${esc(String(x.sym).slice(0, 10))}</span><span>${fmt(x.sol, 3)}</span><span class="who">${esc(x.who)}${x.pnl !== undefined && x.pnl !== null ? " " + pc(x.pnl) : ""}</span></div>`).join("") : `<div class="empty">işlem bekleniyor</div>`;
    $("#rm-lat").innerHTML = s.lat.length ? `<div class="lat-h"><span>saat</span><span>işlem</span><span>olay→gön.</span><span>gön.→onay</span><span>yol</span></div>` + s.lat.map(m => `<div class="${m.ok ? "" : "dn"}"><span>${tm(m.t)}</span><span>${m.side === "buy" ? "▲" : "▼"} ${esc((m.sym || "").slice(0, 7))}</span><span>${msf(m.ev2sent)}</span><span>${m.ok ? msf(m.sent2conf) : "✖"}</span><span>${esc(m.ok ? m.via || "" : (m.err || "").slice(0, 22))}</span></div>`).join("") : `<div class="empty">henüz işlem yok</div>`;
    $("#rm-cpst").textContent = A.cp.live ? `● WS canlı · ${A.cp.subs} abonelik` : A.cp.list.length ? "○ bağlanıyor" : "";
    const wl = $("#rm-wal"); if (!wl.contains(document.activeElement)) wl.innerHTML = A.cp.list.length ? A.cp.list.map(w => `<div class="wal ${w.on ? "" : "off"}"><div class="wal-h"><b>${esc(w.label)}</b><a href="https://solscan.io/account/${esc(w.addr)}" target="_blank" rel="noopener">${short(w.addr)} ↗</a><label class="sw" title="kopyala"><input type="checkbox" data-rwt="${esc(w.addr)}" ${w.on ? "checked" : ""}><span></span></label></div><div class="wal-f"><span>oturum: ${w.n} işlem · ${w.buys}A / ${w.sells}S</span><button type="button" class="mini s" data-rwd="${esc(w.addr)}" aria-label="sil">✕</button></div></div>`).join("") : `<div class="empty">sunucuda takip edilen cüzdan yok</div>`; } }
function drawEq(s){ const c = $("#rm-eqcv"); if (!c) return; const r = c.getBoundingClientRect(); if (!r.width) return; const dpr = Math.min(2, devicePixelRatio || 1); if (c.width !== Math.round(r.width*dpr)){ c.width = Math.round(r.width*dpr); c.height = Math.round(r.height*dpr); }
  const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); const Wd = r.width, H = r.height; g.clearRect(0, 0, Wd, H); const P_ = s.eq || [], d = s.dep;
  if (P_.length < 2){ g.fillStyle = "#4f7b8a"; g.font = "10px 'Share Tech Mono', monospace"; g.fillText("eğri birkaç saniye içinde oluşur…", 8, H/2); return; }
  const t0 = P_[0][0], t1 = P_[P_.length - 1][0], vs = P_.map(p => p[1]).concat(d ? [d] : []), lo = Math.min(...vs), hi = Math.max(...vs), sp = (hi - lo) || Math.max(1e-6, hi*0.002);
  const X_ = t => 4 + (t - t0)/((t1 - t0) || 1)*(Wd - 8), Y_ = v => H - 14 - (v - lo)/sp*(H - 28);
  if (d){ g.strokeStyle = "rgba(255,230,0,.4)"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, Y_(d)); g.lineTo(Wd, Y_(d)); g.stroke(); g.setLineDash([]); }
  const upc = P_[P_.length - 1][1] >= (d || P_[0][1]), col = upc ? "#39ff14" : "#ff3355";
  g.beginPath(); P_.forEach((p, i) => i ? g.lineTo(X_(p[0]), Y_(p[1])) : g.moveTo(X_(p[0]), Y_(p[1]))); g.strokeStyle = col; g.lineWidth = 1.8; g.shadowColor = col; g.shadowBlur = 8; g.stroke(); g.shadowBlur = 0;
  for (const m of s.mk || []){ const x = X_(m.t); let i = P_.findIndex(p => p[0] >= m.t); if (i < 0) i = P_.length - 1; const y = Y_(P_[i][1]); g.fillStyle = m.k === "buy" ? "#00f0ff" : m.k === "risk" ? "#ffe600" : m.p >= 0 ? "#39ff14" : "#ff3355"; g.beginPath();
    if (m.k === "buy"){ g.moveTo(x, y - 10); g.lineTo(x - 4, y - 3); g.lineTo(x + 4, y - 3); } else if (m.k === "risk"){ g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); } else { g.moveTo(x, y + 10); g.lineTo(x - 4, y + 3); g.lineTo(x + 4, y + 3); } g.fill(); }
  g.fillStyle = "#6fa5b5"; g.font = "9px 'Share Tech Mono', monospace"; g.textAlign = "right"; g.fillText(fmt(hi, 4), Wd - 4, 10); g.fillText(fmt(lo, 4), Wd - 4, H - 3); g.textAlign = "left"; g.fillText(tm(t0).slice(0, 5), 4, H - 3); }
/* ---------------- render plumbing ---------------- */
function render(){ const box = $("#meme-box"); if (!box) return; if (!P){ S.rendered = false; return; } box.innerHTML = mirrorHTML(); mirrorBind(); S.rendered = true; lastSlow = 0; paint(); }
function full(){ const sb = $("#srv-box"); if (sb){ sb.innerHTML = srvHTML(); srvBind(); } const h = $("#srv-h"); if (h) h.textContent = P ? "eşli · telefondaki motor boşta" : "eşli değil";
  if (P) render(); else if (window.MEME) MEME.render(); paint(); }
function paint(){ paintSrv(); if (P && S.rendered) paintMirror(); const on = !!(P && S.snap && S.snap.on); document.body.classList.toggle("meme-on", on || !!(window.MEME && MEME.on)); if (window.MEME && MEME.fab) MEME.fab(); }
setInterval(() => { if (!document.hidden && P) paintSrv(); if (!document.hidden && P && S.rendered && Date.now() - S.at > 10000) paintMirror(); }, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && P && Date.now() - S.at > 5000){ S.retry = 0; discover(true).then(ok => { if (!ok && S.gen) connect(); }); } });
window.addEventListener("online", () => { if (P){ S.retry = 0; discover(true).then(ok => { if (!ok) connect(); }); } });
const init = () => { full(); if (P) connect(); };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { paired: () => !!P, on: () => !!(P && S.snap && S.snap.on), ctx: () => (P && S.ctx) || null, apply, kill, render, pair, unpair, parsePair, get S(){ return S; }, get P(){ return P ? { url: P.url } : null; } };
})();
window.REMOTE = REMOTE;
