/* NEON//TERMINAL 2100 — BAĞLANTILAR: Binance (TEST API + GERÇEK API) and Phantom.
   Nothing here trades on its own: every order / swap opens a confirmation sheet and needs ONAYLA. */
"use strict";
const CONN = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (x, d = 2) => (x === null || x === undefined || !isFinite(+x)) ? "—" : (+x).toLocaleString("en-US", { maximumFractionDigits: d });
const usd = x => { x = +x; if (!isFinite(x)) return "—"; const a = Math.abs(x); return "$" + (a >= 1e6 ? (x/1e6).toFixed(2) + "M" : a >= 1e3 ? (x/1e3).toFixed(1) + "K" : a >= 1 ? x.toFixed(2) : x.toPrecision(3)); };
const tm = ms => new Date(ms).toLocaleTimeString("tr-TR", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin" });
const short = a => a ? String(a).slice(0, 4) + "…" + String(a).slice(-4) : "—";
let TAB = "bn";
const T = () => window.TRADE;
function log(id, msg, cls){ const el = $(id); if (!el) return; el.insertAdjacentHTML("afterbegin", `<div class="${cls || ""}"><small>${tm(Date.now())}</small> ${msg}</div>`); while (el.children.length > 40) el.lastChild.remove(); }

/* typed confirmation (used to activate GERÇEK keys / GERÇEK engine mode) */
function typedConfirm(title, html, word){
  return new Promise(res => {
    $("#cf-box").innerHTML = `<div class="cf-mode real">⚠ GERÇEK PARA<small>Gerçek hesabın kullanılacak</small></div><div class="sheet-title">${esc(title)}</div>
      <div class="cf-warn">${html}</div><label>Onaylamak için <b>${esc(word)}</b> yaz<input id="tc-in" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <div class="sheet-btns"><button type="button" id="cf-no">İPTAL</button><button type="button" id="cf-ok" class="cf-ok real" disabled>ONAYLA</button></div>`;
    const box = $("#confirm"); box.classList.remove("hidden"); const ok = $("#cf-ok"), inp = $("#tc-in");
    inp.oninput = () => { ok.disabled = inp.value.trim().toLocaleUpperCase("tr-TR") !== word; };
    const done = v => { box.classList.add("hidden"); $("#cf-box").innerHTML = ""; res(v); };
    $("#cf-no").onclick = () => done(false); ok.onclick = () => done(true); setTimeout(() => inp.focus(), 50);
  });
}

/* =================================== BINANCE =================================== */
function bnHTML(){
  const K = T().keys, b = K.bget(), act = b.which;
  const sec = (w) => { const p = K.prof(w), real = w === "real", on = act === w;
    return `<div class="kcard ${real ? "real" : "test"} ${on ? "on" : ""}">
      <div class="kc-h"><b>${real ? "⚠ GERÇEK API" : "TEST API (Testnet)"}</b>${on ? `<span class="kc-act">● AKTİF</span>` : `<button type="button" class="mini" data-act="${w}">AKTİF YAP</button>`}</div>
      <div class="kc-sub">${real ? `binance.com → API Yönetimi · <b>gerçek para</b> · emirler <b>fapi.binance.com</b>` : `<a href="https://testnet.binancefuture.com" target="_blank" rel="noopener">testnet.binancefuture.com</a> → API Key · test parası`}</div>
      <label>API Key<input data-k="${w}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(p.key)}" placeholder="${real ? "gerçek API key" : "testnet API key"}"></label>
      <label>API Secret<input data-s="${w}" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${p.secret ? "•••••• kayıtlı (değiştirmek için yaz)" : "secret"}"></label>
      <div class="sheet-btns"><button type="button" data-del="${w}">SİL</button><button type="button" data-test="${w}">BAĞLANTIYI TEST ET</button><button type="button" class="save" data-save="${w}">KAYDET</button></div>
      <div class="kc-res" id="kres-${w}">${p.key ? `kayıtlı: ${esc(short(p.key))}` : "anahtar yok"}</div></div>`; };
  return `<div class="mode-row"><span class="mode-badge ${act === "real" ? "real" : "test"}">${act === "real" ? "⚠ GERÇEK API AKTİF" : "TEST API AKTİF"}</span><span class="dim">İŞLEM sekmesindeki emirler aktif bölümün anahtarıyla gider</span></div>
    <div class="kgrid">${sec("test")}${sec("real")}</div>
    <ol class="howto"><li>İzin: yalnızca <b>"Enable Futures"</b> + okuma. <b style="color:var(--r)">Para çekme (Withdrawals) izni ASLA açma.</b></li>
    <li>İki bölüm ayrı saklanır (bu cihazın localStorage'ı). Anahtar GitHub'a ya da başka bir sunucuya gitmez; Secret cihazdan çıkmaz, imzayı burada atar.</li>
    <li>GERÇEK bölümü aktif yapmak için ayrıca <b>GERÇEK</b> yazıp onaylaman gerekir. Her emirde yine ONAYLA penceresi çıkar.</li></ol>
    <div class="sub-h">KAYIT</div><div id="bn-log" class="tlog"></div>`;
}
function bnBind(){
  const K = T().keys, box = $("#links-box");
  box.querySelectorAll("[data-save]").forEach(b => b.onclick = () => { const w = b.dataset.save, k = box.querySelector(`[data-k="${w}"]`).value.trim(), s = box.querySelector(`[data-s="${w}"]`).value.trim(), p = K.prof(w);
    if (!k || (!s && !p.secret)){ log("#bn-log", "✖ API Key ve Secret gerekli.", "dn"); return; }
    K.pset(w, { key: k, secret: s || p.secret }); if (K.bget().which === w) T().reset(); render(); log("#bn-log", `${w === "real" ? "GERÇEK" : "TEST"} anahtarları bu cihaza kaydedildi.`, "up"); });
  box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { const w = b.dataset.del; K.pdel(w); if (w === "real" && K.bget().which === "real") K.bset({ active: "test" }); T().reset(); render(); log("#bn-log", `${w === "real" ? "GERÇEK" : "TEST"} anahtarları silindi.`, "up"); });
  box.querySelectorAll("[data-act]").forEach(b => b.onclick = async () => { const w = b.dataset.act;
    if (w === "real"){ if (!K.prof("real").key){ log("#bn-log", "✖ Önce GERÇEK bölüme anahtar kaydet.", "dn"); return; }
      if (!(await typedConfirm("GERÇEK API'Yİ AKTİF YAP", "Bundan sonra İŞLEM sekmesindeki emirler <b>gerçek Binance vadeli hesabına</b> gider. Kaldıraçlı işlemde kaybın teminatı aşabilir. Anahtarda para çekme izni KAPALI olmalı.", "GERÇEK"))){ log("#bn-log", "GERÇEK aktif edilmedi."); return; } }
    K.bset({ active: w }); T().reset(); render(); log("#bn-log", `Aktif: ${w === "real" ? "⚠ GERÇEK API" : "TEST API"}`, w === "real" ? "dn" : "up"); status(); });
  box.querySelectorAll("[data-test]").forEach(b => b.onclick = async () => { const w = b.dataset.test, out = $("#kres-" + w); out.innerHTML = "bağlanıyor…"; b.disabled = true;
    try { const r = await T().testProfile(w); const u = r.usdt || {};
      out.innerHTML = `<span class="up">✔ bağlantı tamam</span> · USDT bakiye <b>${fmt(u.balance, 2)}</b> · kullanılabilir <b>${fmt(u.availableBalance, 2)}</b>${r.pos ? ` · ${r.pos} açık pozisyon` : ""} <small>(${r.via === "ws" ? "WebSocket API" : "REST"})</small>`;
      log("#bn-log", `✔ ${w === "real" ? "GERÇEK" : "TEST"} bağlantı testi başarılı`, "up"); window.BUS && BUS.emit("tick", { up: true }); }
    catch(e){ out.innerHTML = `<span class="dn">✖ ${esc(T().trErr(e))}</span>`; log("#bn-log", "✖ " + esc(T().trErr(e)), "dn"); }
    b.disabled = false; });
}

/* =================================== PHANTOM =================================== */
function phHTML(){
  const P = T().ph, p = P.prov(), url = location.href.split("#")[0], deep = `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(location.origin + location.pathname)}`;
  return `<div class="mode-row"><span class="mode-badge real">SOLANA MAINNET</span><span class="dim">Phantom · Jupiter swap + pump.fun · özel anahtar Phantom'da kalır</span></div>
    ${p ? (P.pk ? `<div class="addr">● bağlı: <b>${esc(short(P.pk))}</b> <button type="button" id="cph-disc" class="mini">AYIR</button></div><div id="cph-bal" class="kv"></div>`
      : `<button type="button" id="cph-conn" class="go">PHANTOM'U BAĞLA</button>`)
    : `<div class="empty" style="font-style:normal">Bu tarayıcıda Phantom yok. Telefonda siteyi Phantom uygulamasının tarayıcısında aç:</div><a class="go" href="${esc(deep)}">PHANTOM'DA AÇ ↗</a>`}
    <div class="plan-foot">Swap: İŞLEM → PHANTOM sekmesi (Jupiter). pump.fun alım/satım: PUMP.FUN bölümü. Her ikisinde de önce ONAYLA penceresi, sonra Phantom'un kendi onayı çıkar. BOT CÜZDANI'na SOL yüklemek için de Phantom bağlı olmalı.</div>
    <div class="sub-h">KAYIT</div><div id="cph-log" class="tlog"></div>`;
}
async function phBal(){ const P = T().ph, el = $("#cph-bal"); if (!el || !P.pk) return; el.innerHTML = `<span class="k">SOL</span><span class="v">okunuyor…</span>`;
  try { const r = await P.rpc("getBalance", [P.pk]); el.innerHTML = `<span class="k">SOL bakiye</span><span class="v">${fmt(r.value/1e9, 6)}</span><span class="k">Adres</span><span class="v"><a href="https://solscan.io/account/${esc(P.pk)}" target="_blank" rel="noopener">${esc(short(P.pk))} ↗</a></span>`; }
  catch(e){ el.innerHTML = `<span class="k">SOL</span><span class="v dn">${esc(e.message)}</span>`; } }
async function phConnect(){ const P = T().ph, p = P.prov(); if (!p) throw new Error("Phantom bulunamadı"); const r = await p.connect(); P.pk = (r.publicKey || p.publicKey).toString(); P.refresh(); status(); return P.pk; }
function phBind(){ const P = T().ph, p = P.prov();
  if ($("#cph-conn")) $("#cph-conn").onclick = async () => { try { await phConnect(); render(); log("#cph-log", "✔ Phantom bağlandı", "up"); window.BUS && BUS.emit("phantom"); } catch(e){ log("#cph-log", "✖ " + esc(e.message || e), "dn"); } };
  if ($("#cph-disc")) $("#cph-disc").onclick = async () => { try { await p.disconnect(); } catch(e){} P.pk = null; P.refresh(); render(); status(); };
  phBal(); }

/* =================================== shell =================================== */
function status(){ const el = $("#links-st"); if (!el) return; const K = T() && T().keys, b = K ? K.bget() : {}, P = T() && T().ph;
  const chip = (on, txt, cls) => `<span class="lchip ${on ? "on" : ""} ${cls || ""}">${on ? "●" : "○"} ${txt}</span>`;
  el.innerHTML = chip(!!b.key, "BINANCE " + (b.which === "real" ? "GERÇEK" : "TEST"), b.which === "real" ? "real" : "") + chip(!!(P && P.pk), "PHANTOM") + chip(!!(window.PUMP && PUMP.live), "PUMP.FUN") +
    chip(!!(window.WALLET && WALLET.unlocked()), "BOT CÜZDANI") + chip(!!(window.AUTO && (AUTO.pumpOn() || AUTO.bnOn())), "OTO", "real");
}
setInterval(() => { if (!document.hidden) status(); }, 4000);
function render(){ const box = $("#links-box"); if (!box || !T()) return;
  document.querySelectorAll(".ctabs button").forEach(b => b.classList.toggle("on", b.dataset.ct === TAB));
  try { if (TAB === "ph"){ box.innerHTML = phHTML(); phBind(); } else { TAB = "bn"; box.innerHTML = bnHTML(); bnBind(); } }
  catch(e){ console.error(e); box.innerHTML = `<div class="err-line">✖ Bağlantı paneli hatası: ${esc(e.message)}</div>`; }
  status(); }
document.querySelectorAll(".ctabs button").forEach(b => b.addEventListener("click", () => { TAB = b.dataset.ct; render(); }));
function open(tab){ TAB = tab || TAB; render(); const s = $("#links"); if (s) s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
const q = new URLSearchParams(location.search).get("tab"); if (q && ["bn","ph"].includes(q)) TAB = q;
render();
return { open, render, status, typedConfirm };
})();
window.CONN = CONN;
