/* NEON//TERMINAL v6 — GROK assistant (xAI API, https://api.x.ai/v1/chat/completions).
   CORS verified 2026-11-10 from the GitHub Pages origin: preflight 200 with access-control-allow-origin: * → works directly from the phone, no server.
   The user's own xAI API key is stored only in this device's localStorage and sent only to api.x.ai.
   Grok NEVER executes trades. It can answer, explain and propose structured suggestions (```neon {"actions":[…]}```) that the user applies with a tap;
   buys/sells from suggestions still open the ONAYLA sheet. Optional "GROK onayı" gate: yes/no before an auto buy, with timeout + fallback. */
"use strict";
const GROK = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const API = "https://api.x.ai/v1";
const MODELS = ["grok-4.7", "grok-4.6", "grok-4.3", "grok-4.20-0309-non-reasoning", "grok-4.20-0309-reasoning"];
const KK = "neon.xai.key", KM = "neon.xai.model", KG = "neon.xai.gmodel", KH = "neon.xai.hist";
let key = localStorage.getItem(KK) || "", model = localStorage.getItem(KM) || "grok-4.7", gmodel = localStorage.getItem(KG) || "grok-4.20-0309-non-reasoning";
let H = (() => { try { return JSON.parse(sessionStorage.getItem(KH) || "[]"); } catch(e){ return []; } })(); const hSave = () => sessionStorage.setItem(KH, JSON.stringify(H.slice(-30)));
let busy = false, ctrl = null, extra = [];
const ready = () => !!key;
const SYS = `Sen GROK'sun: NEON//TERMINAL 2100 adlı, telefonda çalışan bir pump.fun meme-coin işlem platformunun içindeki yardımcısın. Kullanıcı Onur, Türkçe konuş, kısa ve net ol.
Platform: SIM (sanal para, canlı veri) ve GERÇEK (BOT CÜZDANI) modları; ajanlar: İZLEYİCİ (yeni token filtreleri), KOPYACI (takip edilen cüzdanların pump.fun alımlarını kopyalar), YÜRÜTÜCÜ (PumpPortal trade-local + paralel RPC), RİSK (kayıp sonrası yarım boyut, 2 kayıp üst üste = ara, boyutu yalnızca yeni zirvede büyüt, günlük max zarar).
KURALLAR: Asla işlem yaptığını söyleme — işlem YAPAMAZSIN. Öneri sunmak istersen cevabının sonuna tek bir blok ekle:
\`\`\`neon
{"actions":[{"type":"set","key":"tp","value":60,"why":"..."}]}
\`\`\`
İzinli türler: set (key: base,maxTrade,budget,dailyLoss,maxPos,tp,sl,trail,holdMin,slip,prio,w.minInit,w.minMcap,w.maxMcap,w.maxDev,w.maxRisk,w.waitSec,w.minMom,w.needSoc,w.on,cp.on,cp.minSrc,cp.maxMcap,cp.cool,cp.max10,cp.follow,rules.half,rules.pause2,rules.pauseMin,rules.upHigh,gk.gate), buy {mint,sol,why}, sell {mint,why}, track {wallet,label,why}, untrack {wallet}, pause {min,why}, stop {why}. Kullanıcı her birini ayrıca onaylar; alım/satım için ayrıca ONAYLA ekranı açılır.
Riskleri dürüstçe söyle: pump.fun tokenlarının çoğu sıfıra gider; kâr garantisi yok; yatırım tavsiyesi verme, olasılık ve risk yönetimi açısından konuş. Verilen bağlam JSON'u gerçek zamanlı uygulama durumudur; onun dışında güncel piyasa bilgin yok.`;
async function call(body, signal){ const r = await fetch(API + "/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + key }, body: JSON.stringify(body), signal });
  if (!r.ok){ let m = ""; try { const j = await r.json(); m = j.error && (j.error.message || j.error) || j.code || ""; } catch(e){} throw new Error(r.status === 401 || r.status === 403 || /api key/i.test(String(m)) ? "xAI anahtarı geçersiz ya da yetkisiz (" + r.status + ") — console.x.ai → API Keys'ten yeni anahtar al" : r.status === 429 ? "xAI kullanım sınırı (429) — biraz bekle" : r.status === 404 ? "model bulunamadı (" + body.model + ")" : "xAI HTTP " + r.status + (m ? ": " + String(m).slice(0, 160) : "")); }
  return r; }
function ctxMsg(){ let c = {}; try { c = window.MEME ? MEME.context() : {}; } catch(e){ c = { err: e.message }; } return { role: "system", content: "UYGULAMA DURUMU (JSON):\n" + JSON.stringify(c) }; }
async function ask(text){ if (!key){ addMsg("sys", "Önce aşağıya xAI API anahtarını gir (console.x.ai → API Keys)."); return; } if (busy) return; busy = true; paintBusy();
  H.push({ role: "user", content: text }); hSave(); paintMsgs(); const a = { role: "assistant", content: "" }; H.push(a); window.BUS && BUS.emit("grok");
  const t0 = performance.now(); ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 90000);
  try { const r = await call({ model, stream: true, messages: [{ role: "system", content: SYS }, ctxMsg(), ...H.slice(-14, -1).map(m => ({ role: m.role, content: m.content }))] }, ctrl.signal);
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", first = null;
    for (;;){ const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf("\n")) >= 0){ const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line.startsWith("data:")) continue; const d = line.slice(5).trim(); if (d === "[DONE]") continue;
        try { const j = JSON.parse(d), c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (c){ if (first === null) first = performance.now() - t0; a.content += c; paintLast(); } } catch(e){} } }
    a.ms = Math.round(performance.now() - t0); a.first = first && Math.round(first); a.model = model; if (!a.content) a.content = "(boş cevap)"; }
  catch(e){ a.content = (a.content ? a.content + "\n\n" : "") + "✖ " + (e.name === "AbortError" ? "iptal / zaman aşımı" : e.message); a.err = true; }
  clearTimeout(to); busy = false; ctrl = null; hSave(); paintMsgs(); paintBusy(); }
/* yes/no gate before an auto buy (fast non-reasoning model, strict timeout) */
async function gate(info, timeout = 2500){ if (!key) return { error: "anahtar yok" }; const t0 = performance.now(), ac = new AbortController(), to = setTimeout(() => ac.abort(), timeout);
  try { const r = await call({ model: gmodel, temperature: 0, max_tokens: 80, response_format: { type: "json_object" }, messages: [{ role: "system", content: "pump.fun yeni token risk kapısısın. Yalnızca JSON döndür: {\"ok\":true|false,\"why\":\"en fazla 8 kelime Türkçe\"}. Rug riski yüksek, sosyal hesabı olmayan, geliştirici payı yüksek ya da isim kopyası tokenlara hayır de." }, { role: "user", content: JSON.stringify(info) }] }, ac.signal);
    const j = await r.json(), txt = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ""; const m = /\{[\s\S]*\}/.exec(txt); const o = m ? JSON.parse(m[0]) : null;
    if (!o || typeof o.ok !== "boolean") return { error: "anlaşılmayan cevap", ms: performance.now() - t0 };
    return { ok: o.ok, why: String(o.why || "").slice(0, 80), ms: performance.now() - t0 }; }
  catch(e){ return e.name === "AbortError" ? { timeout: true, error: "zaman aşımı " + timeout + " ms", ms: performance.now() - t0 } : { error: e.message, ms: performance.now() - t0 }; }
  finally { clearTimeout(to); } }
/* ---------------- UI ---------------- */
function parseActs(txt){ const m = /```neon\s*([\s\S]*?)```/.exec(txt); if (!m) return null; try { const j = JSON.parse(m[1]); return Array.isArray(j.actions) ? j.actions.slice(0, 6) : null; } catch(e){ return null; } }
function md(t){ let s = esc(t.replace(/```neon[\s\S]*?(```|$)/, "").trim()); s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/^\s*[-•]\s+/gm, "• ").replace(/\n/g, "<br>"); return s; }
const actTxt = a => a.type === "set" ? `AYAR: ${a.key} → ${a.value}` : a.type === "buy" ? `AL: ${String(a.mint || "").slice(0, 6)}… ${a.sol || ""} SOL` : a.type === "sell" ? `SAT: ${String(a.mint || "").slice(0, 6)}…` : a.type === "track" ? `TAKİP: ${String(a.wallet || "").slice(0, 6)}… ${a.label || ""}` : a.type === "untrack" ? `TAKİPTEN ÇIK: ${String(a.wallet || "").slice(0, 6)}…` : a.type === "pause" ? `ARA: ${a.min} dk` : a.type === "stop" ? "OTO'YU DURDUR" : a.type;
function msgHTML(m, i){ if (m.role === "sys") return `<div class="gm sys">${esc(m.content)}</div>`; if (m.role === "user") return `<div class="gm u">${esc(m.content)}</div>`;
  const acts = parseActs(m.content);
  return `<div class="gm a ${m.err ? "err" : ""}"><div class="gm-h">GROK${m.model ? " · " + esc(m.model) : ""}${m.ms ? ` · ${(m.ms/1000).toFixed(1)} sn${m.first ? " (ilk token " + m.first + " ms)" : ""}` : ""}</div><div class="gm-t" data-i="${i}">${md(m.content) || '<span class="dots3"><i></i><i></i><i></i></span>'}</div>
    ${acts ? `<div class="gm-acts">${acts.map((a, k) => `<div class="gact"><div><b>${esc(actTxt(a))}</b>${a.why ? `<small>${esc(a.why)}</small>` : ""}</div><button type="button" class="mini" data-ap="${i}:${k}" ${a._done ? "disabled" : ""}>${a._done ? esc(a._done) : a.type === "buy" || a.type === "sell" ? "ONAYA GÖNDER" : "UYGULA"}</button></div>`).join("")}</div>` : ""}</div>`; }
function paintMsgs(){ const el = $("#gk-msgs"); if (!el) return; el.innerHTML = H.length ? H.map(msgHTML).join("") : `<div class="gm sys">GROK hazır. Durumu, pozisyonları, ajanları ve son işlemleri görür; ayar ve işlem <b>önerir</b>, ama işlemi sen onaylarsın.</div>`;
  el.querySelectorAll("[data-ap]").forEach(b => b.onclick = () => { const [i, k] = b.dataset.ap.split(":").map(Number), acts = parseActs(H[i].content); if (!acts) return; const a = acts[k];
    const res = window.MEME ? MEME.applySuggestion(a) : "✖ motor yok"; NOTIFY.toast(res, /^✖/.test(res) ? "bad" : "good"); b.textContent = res.slice(0, 26); b.disabled = true; });
  el.scrollTop = el.scrollHeight; }
let plQ = false; function paintLast(){ if (plQ) return; plQ = true; requestAnimationFrame(() => { plQ = false; const el = $("#gk-msgs"); if (!el) return; const i = H.length - 1, n = el.querySelector(`[data-i="${i}"]`); if (n){ n.innerHTML = md(H[i].content); el.scrollTop = el.scrollHeight; } else paintMsgs(); }); }
function paintBusy(){ const b = $("#gk-send"); if (b){ b.textContent = busy ? "■" : "GÖNDER"; b.classList.toggle("busy", busy); } }
function addMsg(role, content){ H.push({ role, content }); hSave(); paintMsgs(); }
function html(){ return `<div class="gk-top"><span class="mode-badge ${key ? "sim" : ""}">${key ? "● ANAHTAR KAYITLI" : "○ ANAHTAR YOK"}</span><label class="gk-model">model<select id="gk-model">${[...new Set(MODELS.concat(extra, [model]))].map(m => `<option ${m === model ? "selected" : ""}>${esc(m)}</option>`).join("")}</select></label></div>
  <div id="gk-msgs" class="gk-msgs" aria-live="polite"></div>
  <div class="gk-chips">${["Durumu özetle", "Neden kaybediyorum?", "Filtreleri iyileştir", "Seçili tokenı yorumla", "Takip ettiğim cüzdanlar nasıl?", "Risk ayarlarım mantıklı mı?"].map(c => `<button type="button" class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join("")}</div>
  <form id="gk-form" class="gk-form" autocomplete="off"><textarea id="gk-in" rows="2" placeholder="GROK'a sor… (ör. bugünkü işlemlerimi değerlendir)" enterkeyhint="send"></textarea><button type="submit" id="gk-send" class="go">GÖNDER</button></form>
  <div class="f2"><button type="button" id="gk-clr" class="mini wide">SOHBETİ TEMİZLE</button><button type="button" id="gk-ctx" class="mini wide">GROK'UN GÖRDÜĞÜ BAĞLAM</button></div><pre id="gk-ctxv" class="gk-ctxv hidden"></pre>
  <details class="keys" ${key ? "" : "open"}><summary>⚙ xAI API anahtarı</summary><div class="plan-foot">console.x.ai → API Keys'ten kendi anahtarını oluştur. Anahtar <b>yalnızca bu cihazda</b> saklanır ve yalnızca api.x.ai'ye gönderilir; GitHub'daki kodda yoktur. Kullanım ücreti xAI hesabına yansır.</div>
    <label>xAI API key<input id="gk-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${key ? "•••••• kayıtlı (değiştirmek için yaz)" : "xai-…"}"></label>
    <label>GROK onayı modeli (hızlı)<select id="gk-gmodel">${[...new Set(MODELS.concat(extra, [gmodel]))].map(m => `<option ${m === gmodel ? "selected" : ""}>${esc(m)}</option>`).join("")}</select></label>
    <div class="sheet-btns"><button type="button" id="gk-del">SİL</button><button type="button" id="gk-test">TEST + MODELLER</button><button type="button" class="save" id="gk-save">KAYDET</button></div><div id="gk-res" class="kc-res"></div></details>
  <div class="plan-foot">GROK işlem yapamaz: önerileri sen <b>UYGULA</b>'ya basarak uygularsın; alım/satım önerileri ayrıca ONAYLA ekranı açar. "GROK onayı" (MEME → ayarlar) açıksa her oto alımdan önce hızlı model evet/hayır der; ${"zaman aşımında"} kurala göre devam edilir.</div>`; }
function bind(){ $("#gk-form").onsubmit = e => { e.preventDefault(); if (busy){ ctrl && ctrl.abort(); return; } const v = $("#gk-in").value.trim(); if (!v) return; $("#gk-in").value = ""; ask(v); };
  $("#gk-in").onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && matchMedia("(pointer:fine)").matches){ e.preventDefault(); $("#gk-form").requestSubmit(); } };
  document.querySelectorAll("#grok-box .chip").forEach(b => b.onclick = () => ask(b.dataset.q));
  $("#gk-model").onchange = e => { model = e.target.value; localStorage.setItem(KM, model); };
  $("#gk-gmodel").onchange = e => { gmodel = e.target.value; localStorage.setItem(KG, gmodel); };
  $("#gk-clr").onclick = () => { H = []; hSave(); paintMsgs(); };
  $("#gk-ctx").onclick = () => { const p = $("#gk-ctxv"); p.classList.toggle("hidden"); if (!p.classList.contains("hidden")) p.textContent = JSON.stringify(window.MEME ? MEME.context() : {}, null, 1); };
  $("#gk-save").onclick = () => { const v = $("#gk-key").value.trim(); if (v){ key = v; localStorage.setItem(KK, key); } render(); NOTIFY.toast(key ? "xAI anahtarı kaydedildi" : "anahtar yok", key ? "good" : "bad"); };
  $("#gk-del").onclick = () => { key = ""; localStorage.removeItem(KK); render(); NOTIFY.toast("xAI anahtarı silindi"); };
  $("#gk-test").onclick = async () => { const v = $("#gk-key").value.trim() || key, el = $("#gk-res"); if (!v){ el.textContent = "anahtar yok"; return; } el.textContent = "test ediliyor…"; const t0 = performance.now();
    try { const r = await fetch(API + "/models", { headers: { authorization: "Bearer " + v } }); if (!r.ok){ let m = ""; try { const j = await r.json(); m = String(j.error && (j.error.message || j.error) || ""); } catch(e){} throw new Error(r.status === 401 || r.status === 403 || /api key/i.test(m) ? "anahtar geçersiz (" + r.status + ")" : "HTTP " + r.status + (m ? ": " + m.slice(0, 120) : "")); }
      const j = await r.json(); extra = (j.data || []).map(m => m.id).filter(id => /^grok/.test(id) && !/imagine|image|video|voice|tts|stt/.test(id)); el.innerHTML = `✔ bağlantı tamam · ${Math.round(performance.now() - t0)} ms · ${extra.length} sohbet modeli: ${esc(extra.join(", ").slice(0, 300))}`;
      if (v !== key){ key = v; localStorage.setItem(KK, key); } setTimeout(render, 2500); } catch(e){ el.textContent = "✖ " + e.message; } };
  paintMsgs(); paintBusy(); }
function render(){ const box = $("#grok-box"); if (!box) return; key = localStorage.getItem(KK) || ""; const keep = $("#gk-in") ? $("#gk-in").value : ""; box.innerHTML = html(); bind(); if (keep) $("#gk-in").value = keep; }
render();
return { ready, ask, gate, render, get model(){ return model; }, get gmodel(){ return gmodel; }, _H: () => H, parseActs };
})();
window.GROK = GROK;
