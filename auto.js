/* NEON//TERMINAL v5 — OTO AL-SAT + BOT section UI (CÜZDAN · OTO AL-SAT · GÜNLÜK) + HEPSİNİ DURDUR.
   Rules: OFF by default and OFF again after every page load. pump.fun auto uses ONLY the BOT CÜZDANI (never Phantom).
   Binance auto: Testnet freely; GERÇEK only with the separate "Binance GERÇEK'te oto" box. Runs only while this page is open in the foreground. */
"use strict";
const AUTO = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (x, d = 4) => (x === null || x === undefined || !isFinite(+x)) ? "—" : (+x).toLocaleString("en-US", { maximumFractionDigits: d });
const short = a => a ? String(a).slice(0, 4) + "…" + String(a).slice(-4) : "—";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin", tm = ms => new Date(ms).toLocaleTimeString("tr-TR", { timeZone: TZ });
const K = "neon.auto";
const DEF = { accepted: false,
  pump: { perTrade: 0.05, budget: 0.5, dailyLoss: 0.25, maxPos: 3, tp: 50, sl: 25, holdMin: 15, minInit: 0.3, minMcap: 27, maxMcap: 70, needSoc: true, maxDev: 10, maxRisk: 45, waitSec: 20, minMom: 8, slip: 20, prio: 0.0005, blacklist: "" },
  bn: { real: false, conf: 65, rescanMin: 5, maxDay: 3, lev: 1 } };
function load(){ let s = {}; try { s = JSON.parse(localStorage.getItem(K) || "{}"); } catch(e){} return { accepted: !!s.accepted, pump: Object.assign({}, DEF.pump, s.pump || {}), bn: Object.assign({}, DEF.bn, s.bn || {}) }; }
let C = load(); const save = () => localStorage.setItem(K, JSON.stringify(C));
const ST = { pump: false, bn: false, cands: new Map(), mons: new Map(), selling: new Set(), buying: false, wake: null, rescanT: null, bnPollT: null, lastBn: 0, ev: [] };
const T = () => window.TRADE;
function alog(msg, cls){ ST.ev.unshift({ t: Date.now(), msg, cls }); if (ST.ev.length > 60) ST.ev.length = 60; const el = $("#au-log"); if (el) el.insertAdjacentHTML("afterbegin", `<div class="${cls || ""}"><small>${tm(Date.now())}</small> ${msg}</div>`); }
/* ---------------- wake lock (keep screen on while auto runs) ---------------- */
async function wake(on){ try { if (on && "wakeLock" in navigator && !ST.wake && !document.hidden){ ST.wake = await navigator.wakeLock.request("screen"); ST.wake.addEventListener("release", () => { ST.wake = null; status(); }); }
    else if (!on && ST.wake){ await ST.wake.release(); ST.wake = null; } } catch(e){ ST.wake = null; } status(); }
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => { if (document.hidden){ hiddenAt = Date.now(); return; } if (ST.pump || ST.bn){ wake(true); if (hiddenAt && Date.now() - hiddenAt > 5000) NOTIFY.toast(`Sayfa ${Math.round((Date.now() - hiddenAt)/1000)} sn arka plandaydı: bu sürede OTO AL-SAT tarayıcı tarafından durdurulmuş olabilir.`, "bad"); } });
/* ---------------- pump.fun auto ---------------- */
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return +d; };
const autoPos = () => WALLET.pos.list().filter(p => p.auto);
const deployed = () => autoPos().reduce((s, p) => s + (p.solIn || 0), 0);
const todayLoss = () => JOURNAL.todayPnl("SOL", e => e.mode === "OTO" && e.venue === "pump.fun");
function limitsOk(){ const p = C.pump, e = [];
  if (!(p.perTrade > 0 && p.perTrade <= 1)) e.push("işlem başı SOL 0–1 olmalı"); if (!(p.budget >= p.perTrade && p.budget <= 20)) e.push("toplam bütçe ≥ işlem başı ve ≤ 20 SOL");
  if (!(p.dailyLoss > 0 && p.dailyLoss <= p.budget)) e.push("günlük max zarar 0 ile bütçe arasında olmalı"); if (!(p.maxPos >= 1 && p.maxPos <= 10)) e.push("max açık pozisyon 1–10");
  if (!(p.tp >= 5 && p.tp <= 1000)) e.push("kâr al %5–1000"); if (!(p.sl >= 5 && p.sl <= 90)) e.push("zarar kes %5–90"); if (!(p.holdMin >= 1 && p.holdMin <= 1440)) e.push("max tutma 1–1440 dk");
  if (!(p.waitSec >= 5 && p.waitSec <= 600)) e.push("bekleme 5–600 sn"); if (!(p.slip >= 1 && p.slip <= 50)) e.push("kayma %1–50"); if (!(p.prio >= 0 && p.prio <= 0.005)) e.push("öncelik ücreti 0–0.005 SOL"); return e; }
function onNew(t){ if (!ST.pump) return; const p = C.pump, bl = p.blacklist.split(/[\s,]+/).filter(Boolean);
  const why = t.pool !== "pump" ? "pump.fun havuzu değil" : t.devSol < p.minInit ? `ilk alım ${fmt(t.devSol, 2)} < ${p.minInit} SOL` : t.mcap && t.mcap < p.minMcap ? `mcap ${fmt(t.mcap, 1)} < ${p.minMcap}` : t.devPct > p.maxDev ? `dev payı %${fmt(t.devPct, 1)} > %${p.maxDev}` : bl.includes(t.creator) ? "yaratıcı kara listede" : t.serial > 1 ? "seri token yaratıcısı" : null;
  if (why) return; if (ST.cands.size >= 6) return;
  const c = { t, m0: t.mcap, at: Date.now(), hi: t.mcap, last: t.mcap, unsub: null };
  c.unsub = PUMP.curveSub(t.curve, cv => { if (c.first === undefined){ c.first = cv.mcap; c.odd = Math.abs(cv.vSol - cv.rSol - 30) > 1.5; } c.last = cv.mcap; c.hi = Math.max(c.hi || 0, cv.mcap); c.complete = cv.complete; });
  PUMP.curveNow(t.curve).then(cv => { if (cv && c.first === undefined){ c.first = cv.mcap; c.odd = Math.abs(cv.vSol - cv.rSol - 30) > 1.5; c.last = cv.mcap; c.hi = cv.mcap; } }).catch(() => {});
  ST.cands.set(t.mint, c); PUMP.metaQ(t, true); alog(`👁 izleniyor: <b>${esc(t.symbol)}</b> · mcap ${fmt(t.mcap, 1)} SOL · dev %${fmt(t.devPct, 1)} · ${p.waitSec} sn momentum bekleniyor`);
  setTimeout(() => decide(t.mint), p.waitSec*1000); status(); }
async function decide(mint){ const c = ST.cands.get(mint); if (!c) return; const done = (msg, cls) => { if (c.unsub) c.unsub(); ST.cands.delete(mint); if (msg) alog(msg, cls); status(); };
  if (!ST.pump) return done(); const p = C.pump, t = c.t;
  if (p.needSoc && !t.meta && !t.metaErr && !c.waited){ c.waited = true; setTimeout(() => decide(mint), 5000); return; }
  PUMP.risk(t); const base = c.first || c.m0, mom = base && c.last ? (c.last/base - 1)*100 : 0, soc = t.meta && (t.meta.tw || t.meta.tg || t.meta.web);
  const no = c.first === undefined ? "canlı curve verisi gelmedi" : c.odd ? "standart dışı bonding curve" : p.needSoc && !soc ? "sosyal yok" : t.risk > p.maxRisk ? `risk ${t.risk} > ${p.maxRisk}` : mom < p.minMom ? `momentum %${mom.toFixed(1)} < %${p.minMom}` : c.last > p.maxMcap ? `mcap ${fmt(c.last, 1)} > ${p.maxMcap}` : c.complete ? "curve tamamlandı" : c.last < c.hi*0.8 ? "zirveden %20+ düştü" : null;
  if (no) return done(`✖ ${esc(t.symbol)} elendi: ${no}`, "dim");
  const open = autoPos(); if (open.length >= p.maxPos) return done(`⏸ ${esc(t.symbol)}: max açık pozisyon (${p.maxPos}) dolu`);
  if (deployed() + p.perTrade > p.budget + 1e-9) return done(`⏸ ${esc(t.symbol)}: bütçe dolu (${fmt(deployed(), 3)} / ${p.budget} SOL)`);
  if (todayLoss() <= -p.dailyLoss){ done(); return stopPump(`günlük max zarar (${p.dailyLoss} SOL) aşıldı`); }
  if (!WALLET.unlocked()){ done(); return stopPump("BOT CÜZDANI kilitlendi"); }
  if (ST.buying) return done(`⏸ ${esc(t.symbol)}: başka bir alım sürüyor`); ST.buying = true;
  try { const bal = await WALLET.solBal(); if (bal < p.perTrade + 0.012){ done(); ST.buying = false; return stopPump(`bot cüzdanında yetersiz SOL (${bal.toFixed(4)})`); }
    alog(`▲ OTO AL: <b>${esc(t.symbol)}</b> ${p.perTrade} SOL · momentum +%${mom.toFixed(1)} · risk ${t.risk}`, "up");
    const r = await PUMP.botTrade({ action: "buy", mint, sym: t.symbol, amount: p.perTrade, denominatedInSol: "true", slip: p.slip, prio: p.prio, pool: "pump", auto: true, reason: `oto giriş: momentum +%${mom.toFixed(1)}, risk ${t.risk}`, mcap: c.last, curve: t.curve });
    alog(`✔ alındı ${esc(t.symbol)}: ${fmt(r.tokens, 0)} adet · <a href="https://solscan.io/tx/${esc(r.sig)}" target="_blank" rel="noopener">tx</a>`, "up"); NOTIFY.ping("good", `OTO AL: ${t.symbol} ${p.perTrade} SOL`); monitor(mint);
  } catch(e){ alog(`✖ ${esc(t.symbol)} alım başarısız: ${esc(e.message)}`, "dn"); NOTIFY.ping("bad", `OTO alım başarısız: ${t.symbol}`); }
  ST.buying = false; done(); }
function monitor(mint){ if (ST.mons.has(mint)) return; const p0 = WALLET.pos.get(mint); if (!p0) return; const m = { unsub: null, c: null, pnl: null };
  ST.mons.set(mint, m); const key = p0.curve || (PUMP.get(mint) || {}).curve;
  const check = async cv => { m.c = cv; const p = WALLET.pos.get(mint); if (!p){ stopMon(mint); return; }
    if (!p.tokens){ try { p.tokens = await WALLET.tokenBal(mint); const a = WALLET.pos.list(); const x = a.find(y => y.mint === mint); if (x){ x.tokens = p.tokens; WALLET.pos.save(a); } } catch(e){} }
    const v = p.tokens ? PUMP.sellQuote(cv, p.tokens) : null; m.pnl = v !== null ? (v/p.solIn - 1)*100 : null; m.val = v; paintPos();
    if (!ST.pump || ST.selling.has(mint)) return; const held = (Date.now() - p.t)/60000;
    const why = m.pnl !== null && m.pnl >= C.pump.tp ? `KÂR AL +%${m.pnl.toFixed(1)}` : m.pnl !== null && m.pnl <= -C.pump.sl ? `ZARAR KES %${m.pnl.toFixed(1)}` : held >= C.pump.holdMin ? `SÜRE DOLDU (${C.pump.holdMin} dk)` : cv.complete ? "curve tamamlandı (mezun)" : null;
    if (why) sell(mint, why); };
  if (key){ m.unsub = PUMP.curveSub(key, check); PUMP.curveNow(key).then(cv => cv && check(cv)).catch(() => {}); }
  m.timer = setInterval(() => { if (m.c) check(m.c); else if (key) PUMP.curveNow(key).then(cv => cv && check(cv)).catch(() => {}); }, 15000); }
function stopMon(mint){ const m = ST.mons.get(mint); if (!m) return; if (m.unsub) m.unsub(); clearInterval(m.timer); ST.mons.delete(mint); paintPos(); }
async function sell(mint, why, tries = 0){ if (ST.selling.has(mint) && !tries) return; ST.selling.add(mint); const p = WALLET.pos.get(mint); if (!p){ ST.selling.delete(mint); return; }
  alog(`▼ OTO SAT: <b>${esc(p.sym)}</b> · ${esc(why)}`, why.startsWith("KÂR") ? "up" : "dn");
  try { const r = await PUMP.botTrade({ action: "sell", mint, sym: p.sym, amount: "100%", denominatedInSol: "false", slip: C.pump.slip, prio: C.pump.prio, pool: "auto", auto: true, reason: why });
    alog(`✔ satıldı ${esc(p.sym)}: SOL ${r.solDelta >= 0 ? "+" : ""}${r.solDelta.toFixed(5)} · <a href="https://solscan.io/tx/${esc(r.sig)}" target="_blank" rel="noopener">tx</a>`, "up"); stopMon(mint); ST.selling.delete(mint);
    if (todayLoss() <= -C.pump.dailyLoss) stopPump(`günlük max zarar (${C.pump.dailyLoss} SOL) aşıldı`);
  } catch(e){ alog(`✖ ${esc(p.sym)} satış başarısız (${tries + 1}/3): ${esc(e.message)}`, "dn");
    if (tries < 2) setTimeout(() => sell(mint, why, tries + 1), 8000); else { ST.selling.delete(mint); NOTIFY.ping("bad", `${p.sym} SATILAMADI — elle kontrol et!`); } } }
function stopPump(reason){ if (!ST.pump) return; ST.pump = false; for (const c of ST.cands.values()) c.unsub && c.unsub(); ST.cands.clear();
  alog(`■ pump.fun OTO durdu: ${esc(reason)}`, "dn"); NOTIFY.ping("bad", "OTO AL-SAT durdu: " + reason); afterToggle(); }
/* ---------------- Binance auto ---------------- */
async function onAnalysis(d){ if (!ST.bn) return; const S = d.data.signal, b = C.bn; if (!S) return;
  if (S.dir === "BEKLE"){ alog(`Binance: ${esc(d.symbol)} sinyal BEKLE (skor ${S.score.toFixed(0)}) — işlem yok`, "dim"); return; }
  if (S.conf < b.conf){ alog(`Binance: ${esc(d.symbol)} ${S.dir} güven %${S.conf} < eşik %${b.conf} — işlem yok`, "dim"); return; }
  if (S.active.mode !== "piyasa"){ alog(`Binance: ${esc(d.symbol)} ${S.dir} — kırılım henüz yok (tetik ${S.active.trigger}), bekleniyor`, "dim"); return; }
  if (d.src !== "fut"){ alog("Binance: SPOT verisiyle oto işlem yapılmaz", "dn"); return; }
  const c = T().keys.bget(); if (!c.testnet && !b.real){ return stopBn("GERÇEK API aktif ama 'Binance GERÇEK'te oto' kapalı"); }
  const n = JOURNAL.list().filter(e => e.venue === "binance" && e.mode === "OTO" && e.openT >= today0()).length; if (n >= b.maxDay){ alog(`Binance: günlük oto işlem sınırı (${b.maxDay}) doldu`, "dim"); return; }
  if (Date.now() - ST.lastBn < 60000) return; ST.lastBn = Date.now();
  try { const r = await T().auto.order(d, { lev: b.lev }); if (r.skipped){ alog(`Binance: ${esc(d.symbol)} atlandı — ${esc(r.skipped)}`, "dim"); return; }
    JOURNAL.add({ venue: "binance", mode: "OTO", wallet: r.testnet ? "TESTNET" : "GERÇEK", sym: r.symbol, side: r.side, in: +r.margin.toFixed(4), unit: "USDT", reason: `sinyal ${r.side} %${S.conf}`, note: `qty ${r.qty} @ ${r.px} · stop ${r.stop} · hedef ${r.target} · ${r.prot.join(", ")}`, sigIn: String(r.orderId), open: true });
    alog(`✔ Binance ${r.testnet ? "TESTNET" : "⚠ GERÇEK"} OTO ${r.side} ${esc(r.symbol)} · ${r.qty} @ ${r.px} · ${esc(r.prot.join(" · "))}`, "up"); NOTIFY.ping("good", `Binance OTO ${r.side} ${r.symbol}`);
  } catch(e){ alog(`✖ Binance oto emir: ${esc(T().trErr(e))}`, "dn"); NOTIFY.ping("bad", "Binance oto emir başarısız"); } }
async function bnPoll(){ const open = JOURNAL.list().filter(e => e.venue === "binance" && e.mode === "OTO" && e.open); if (!open.length) return;
  let pos; try { pos = await T().auto.positions(); } catch(e){ return; }
  for (const e of open){ if (pos.some(p => p.symbol === e.sym)) continue;
    try { const pnl = await T().auto.realized(e.sym, e.openT); JOURNAL.upd(e.id, { open: false, out: +(e.in + pnl).toFixed(4), closeT: Date.now(), reason: (e.reason || "") + " · stop/hedef/elle kapandı" });
      alog(`Binance ${esc(e.sym)} pozisyonu kapandı: K/Z ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT`, pnl >= 0 ? "up" : "dn"); NOTIFY.ping(pnl >= 0 ? "good" : "bad", `${e.sym} kapandı ${pnl.toFixed(2)} USDT`); } catch(err){} } }
function stopBn(reason){ if (!ST.bn) return; ST.bn = false; clearInterval(ST.rescanT); clearInterval(ST.bnPollT); alog(`■ Binance OTO durdu: ${esc(reason)}`, "dn"); afterToggle(); }
/* ---------------- toggles ---------------- */
function riskSheet(){ return new Promise(res => { $("#cf-box").innerHTML = `<div class="cf-mode real">⚠ GERÇEK PARA · OTO<small>Bot, onay sormadan işlem açıp kapatacak</small></div><div class="sheet-title">OTO AL-SAT RİSK UYARISI</div>
    <div class="cf-warn"><b>Bunu bir kez okuyup onaylaman gerekiyor:</b><br>• pump.fun'da çıkan coinlerin <b>büyük çoğunluğu kısa sürede sıfıra yakın değere düşer</b>; rug-pull, bot ve sandviç saldırıları yaygındır.<br>• OTO AL-SAT <b>gerçek parayla</b>, her işlemde onay sormadan alır ve satar. Kayma, ücretler (PumpPortal ~%0.5, pump.fun ~%1.25, ağ ücreti, token hesabı kirası ~0.002 SOL) her işlemde kayıp yaratır.<br>• Kurallar basit sezgilerdir; <b>kâr garantisi yoktur</b>, geçmiş/benzetim sonucu geleceği göstermez.<br>• Yalnızca <b>BOT CÜZDANI</b> kullanılır (Phantom ana cüzdanın asla); kaybetmeyi göze aldığın kadarını yükle.<br>• Yalnızca bu sayfa <b>açık ve ön plandayken</b> çalışır; telefon kilitlenir ya da sekme arka plana geçerse durabilir — açık pozisyonlar o sırada izlenmez.<br>• Bu bir yatırım tavsiyesi değildir.</div>
    <label class="chk"><input type="checkbox" id="rk-ok"> Okudum, anladım; kaybın tamamen bana ait.</label>
    <div class="sheet-btns"><button type="button" id="cf-no">İPTAL</button><button type="button" id="cf-ok" class="cf-ok real" disabled>KABUL EDİYORUM</button></div>`;
    const box = $("#confirm"); box.classList.remove("hidden"); const ok = $("#cf-ok"); $("#rk-ok").onchange = e => ok.disabled = !e.target.checked;
    const done = v => { box.classList.add("hidden"); $("#cf-box").innerHTML = ""; res(v); }; $("#cf-no").onclick = () => done(false); ok.onclick = () => done(true); }); }
function readForm(){ const box = $("#bot-box"); if (!box) return; box.querySelectorAll("[data-ap]").forEach(i => { const k = i.dataset.ap; C.pump[k] = i.type === "checkbox" ? i.checked : k === "blacklist" ? i.value : +String(i.value).replace(",", "."); });
  box.querySelectorAll("[data-ab]").forEach(i => { const k = i.dataset.ab; C.bn[k] = i.type === "checkbox" ? i.checked : +String(i.value).replace(",", "."); }); C.bn.lev = Math.max(1, Math.min(3, Math.round(C.bn.lev || 1))); save(); }
async function setPump(on){ if (!on){ stopPump("elle kapatıldı"); return; } readForm(); const e = limitsOk();
  if (e.length){ alog("✖ Limitler geçersiz: " + esc(e.join("; ")), "dn"); return render(); }
  if (!WALLET.exists()){ alog("✖ Önce BOT CÜZDANI oluştur (CÜZDAN sekmesi).", "dn"); return render(); } if (!WALLET.unlocked()){ alog("✖ BOT CÜZDANI kilitli — CÜZDAN sekmesinden PIN ile aç.", "dn"); return render(); }
  if (!C.accepted){ if (!(await riskSheet())){ alog("OTO açılmadı (uyarı kabul edilmedi)."); return render(); } C.accepted = true; save(); }
  const p = C.pump; if (!(await T().confirmSheet({ title: "PUMP.FUN OTO AL-SAT'I AÇ", mode: "GERÇEK", rows: [["Cüzdan", "BOT " + short(WALLET.pub())], ["İşlem başı", p.perTrade + " SOL"], ["Toplam bütçe", p.budget + " SOL"], ["Günlük max zarar", p.dailyLoss + " SOL", "dn"], ["Max açık pozisyon", String(p.maxPos)], ["Kâr al / zarar kes", `+%${p.tp} / −%${p.sl}`], ["Max tutma", p.holdMin + " dk"], ["Giriş", `${p.waitSec} sn sonra momentum ≥ %${p.minMom}, risk ≤ ${p.maxRisk}`]], warn: "Bundan sonra bot bu limitler içinde <b>onay sormadan</b> alıp satar. HEPSİNİ DURDUR her zaman ekranda.", okText: "ONAYLA · OTO BAŞLAT" }))) return render();
  ST.pump = true; alog("▶ pump.fun OTO başladı (BOT CÜZDANI)", "up"); if (!PUMP.live) PUMP.start(); for (const x of autoPos()) monitor(x.mint); afterToggle(); }
async function setBn(on){ if (!on){ stopBn("elle kapatıldı"); return; } readForm(); const c = T().keys.bget();
  if (!c.key || !c.secret){ alog("✖ Binance anahtarı yok (BAĞLANTILAR → BINANCE).", "dn"); return render(); }
  if (!c.testnet){ if (!C.bn.real){ alog("✖ GERÇEK API aktif: Binance oto için ayrıca 'Binance GERÇEK'te oto' kutusunu işaretle.", "dn"); return render(); }
    if (!(await CONN.typedConfirm("BINANCE GERÇEK HESAPTA OTO", `Bot, sinyal güveni %${C.bn.conf}+ olduğunda <b>gerçek Binance vadeli hesabında onay sormadan</b> emir açacak (${C.bn.lev}x, stop + hedef ile, günde en fazla ${C.bn.maxDay}). Kaldıraçlı işlemde kaybın teminatı aşabilir.`, "GERÇEK"))) return render(); }
  else if (!C.accepted){ if (!(await riskSheet())) return render(); C.accepted = true; save(); }
  ST.bn = true; ST.lastBn = 0; alog(`▶ Binance OTO başladı (${c.testnet ? "TESTNET" : "⚠ GERÇEK"}) · eşik %${C.bn.conf} · ${C.bn.rescanMin} dk'da bir yeniden analiz`, "up");
  clearInterval(ST.rescanT); ST.rescanT = setInterval(() => { if (ST.bn && window.NEON && NEON.cur && !NEON.running && !document.hidden && $("#confirm").classList.contains("hidden")) NEON.runQuiet(NEON.cur.base); }, Math.max(1, C.bn.rescanMin)*60000);
  clearInterval(ST.bnPollT); ST.bnPollT = setInterval(bnPoll, 30000);
  if (window.NEON && NEON.cur) onAnalysis(NEON.cur); else alog("Önce yukarıda bir coin analiz et (ör. btc) — sinyal oradan gelir.", "dim"); afterToggle(); }
async function kill(ask = true){
  let sellAll = false, closeBn = false;
  if (ask){ const bp = WALLET.pos.list(), bo = JOURNAL.list().filter(e => e.venue === "binance" && e.mode === "OTO" && e.open);
    const r = await new Promise(res => { $("#cf-box").innerHTML = `<div class="cf-mode real">■ HEPSİNİ DURDUR</div><div class="sheet-title">TÜM OTOMATİK İŞLEMLERİ DURDUR</div>
      <div class="cf-warn">OTO AL-SAT (pump.fun + Binance) hemen kapanır, izlenen adaylar bırakılır.</div>
      <label class="chk"><input type="checkbox" id="k-sell" ${bp.length ? "" : "disabled"}> BOT CÜZDANI'ndaki ${bp.length} pump.fun pozisyonunu da piyasadan SAT</label>
      <label class="chk"><input type="checkbox" id="k-bn" ${bo.length ? "" : "disabled"}> Binance'te oto açılan ${bo.length} pozisyonu da piyasadan KAPAT</label>
      <div class="sheet-btns"><button type="button" id="cf-no">İPTAL</button><button type="button" id="cf-ok" class="cf-ok real">DURDUR</button></div>`;
      const box = $("#confirm"); box.classList.remove("hidden"); const done = v => { const s = $("#k-sell"), b = $("#k-bn"); const o = v && { s: s && s.checked, b: b && b.checked }; box.classList.add("hidden"); $("#cf-box").innerHTML = ""; res(o); };
      $("#cf-no").onclick = () => done(null); $("#cf-ok").onclick = () => done(true); });
    if (!r) return; sellAll = r.s; closeBn = r.b; }
  const was = ST.pump || ST.bn; stopPump("HEPSİNİ DURDUR"); stopBn("HEPSİNİ DURDUR"); if (!was) alog("■ OTO zaten kapalıydı", "dim");
  if (sellAll){ if (!WALLET.unlocked()) alog("✖ Satış için BOT CÜZDANI kilidini aç", "dn"); else for (const p of WALLET.pos.list()){ ST.selling.delete(p.mint); await sell(p.mint, "HEPSİNİ DURDUR"); } }
  if (closeBn) for (const e of JOURNAL.list().filter(e => e.venue === "binance" && e.mode === "OTO" && e.open)){ try { const n = await T().auto.close(e.sym); alog(`■ Binance ${esc(e.sym)} kapatıldı (${n})`, "up"); } catch(err){ alog(`✖ Binance ${esc(e.sym)} kapatılamadı: ${esc(T().trErr(err))}`, "dn"); } }
  if (closeBn) setTimeout(bnPoll, 4000); render(); }
function afterToggle(){ const any = ST.pump || ST.bn; wake(any); document.body.classList.toggle("auto-on", any); const f = $("#killfab"); if (f) f.classList.toggle("hidden", !any);
  window.BUS && BUS.emit("state", { node: "bt", on: any || WALLET.unlocked() }); render(); }
/* ---------------- UI ---------------- */
function status(){ const el = $("#au-st"); if (!el) return; const p = C.pump, op = autoPos();
  el.innerHTML = `<div><small>pump.fun OTO</small><b class="${ST.pump ? "up" : "dim"}">${ST.pump ? "● AÇIK" : "○ KAPALI"}</b></div><div><small>Binance OTO</small><b class="${ST.bn ? "up" : "dim"}">${ST.bn ? "● AÇIK" : "○ KAPALI"}</b></div>
    <div><small>Ekran kilidi</small><b class="${ST.wake ? "up" : "dim"}">${ST.wake ? "açık tutuluyor" : "—"}</b></div><div><small>İzlenen aday</small><b>${ST.cands.size}</b></div>
    <div><small>Açık oto poz.</small><b>${op.length} / ${p.maxPos}</b></div><div><small>Kullanılan bütçe</small><b>${fmt(deployed(), 3)} / ${p.budget} SOL</b></div>
    <div><small>Bugün oto K/Z</small><b class="${todayLoss() >= 0 ? "up" : "dn"}">${todayLoss() >= 0 ? "+" : ""}${fmt(todayLoss(), 4)} SOL</b></div><div><small>Bot cüzdanı</small><b class="${WALLET.unlocked() ? "up" : "dn"}">${!WALLET.exists() ? "yok" : WALLET.unlocked() ? "açık" : "kilitli"}</b></div>`; }
function paintPos(){ const el = $("#au-pos"); if (!el) return; const L = WALLET.pos.list();
  el.innerHTML = L.length ? L.map(p => { const m = ST.mons.get(p.mint) || {}; const pn = m.pnl; return `<div class="pos ${pn === null || pn === undefined ? "" : pn >= 0 ? "l" : "s"}"><b>${esc(p.sym)} ${p.auto ? '<span class="pill y">OTO</span>' : '<span class="pill">elle</span>'}</b>
    <span>${fmt(p.tokens, 0)} adet · maliyet ${fmt(p.solIn, 4)} SOL · ${Math.floor((Date.now() - p.t)/60000)} dk</span><span class="${pn >= 0 ? "up" : "dn"}">${pn === null || pn === undefined ? (ST.mons.has(p.mint) ? "fiyat bekleniyor" : "izlenmiyor") : `≈ ${fmt(m.val, 4)} SOL (${pn >= 0 ? "+" : ""}${pn.toFixed(1)}%)`}</span>
    <button type="button" data-sellp="${esc(p.mint)}">SAT</button></div>`; }).join("") : `<div class="empty">açık bot pozisyonu yok</div>`;
  el.querySelectorAll("[data-sellp]").forEach(b => b.onclick = async () => { const p = WALLET.pos.get(b.dataset.sellp); if (!p) return; if (!WALLET.unlocked()){ alog("✖ BOT CÜZDANI kilitli", "dn"); return; }
    if (!(await T().confirmSheet({ title: "BOT POZİSYONUNU SAT", mode: "GERÇEK", rows: [["Token", p.sym + " · " + short(p.mint)], ["Miktar", "%100 · " + fmt(p.tokens, 0)], ["Maliyet", fmt(p.solIn, 4) + " SOL"]], okText: "ONAYLA · SAT" }))) return;
    ST.selling.delete(p.mint); sell(p.mint, "elle satış"); }); }
const inp = (grp, k, lab, v, step) => `<label>${lab}<input data-${grp}="${k}" inputmode="decimal" value="${esc(v)}" ${step ? `step="${step}"` : ""}></label>`;
function autoHTML(){ const p = C.pump, b = C.bn, c = T().keys.bget();
  return `<div class="cf-warn fg-note">⏻ OTO yalnızca bu sayfa <b>açık ve ön plandayken</b> çalışır (tarayıcı sınırı). Ekran açık tutulur (Wake Lock); telefonu kilitlersen ya da başka uygulamaya geçersen durabilir. Sayfa yenilenince OTO <b>kapalı</b> başlar.</div>
    <div id="au-st" class="au-st"></div>
    <button type="button" id="au-kill" class="kill">■ HEPSİNİ DURDUR</button>
    <div class="sub-h">PUMP.FUN · BOT CÜZDANI</div>
    <label class="chk big"><input type="checkbox" id="au-pump" ${ST.pump ? "checked" : ""}> <b>OTO AL-SAT</b> <small>(yalnızca BOT CÜZDANI · Phantom asla)</small></label>
    <div class="f3">${inp("ap", "perTrade", "İşlem başı SOL", p.perTrade)}${inp("ap", "budget", "Toplam bütçe SOL", p.budget)}${inp("ap", "dailyLoss", "Günlük max zarar SOL", p.dailyLoss)}</div>
    <div class="f3">${inp("ap", "maxPos", "Max açık pozisyon", p.maxPos)}${inp("ap", "tp", "Kâr al +%", p.tp)}${inp("ap", "sl", "Zarar kes −%", p.sl)}</div>
    <div class="f3">${inp("ap", "holdMin", "Max tutma (dk)", p.holdMin)}${inp("ap", "slip", "Kayma %", p.slip)}${inp("ap", "prio", "Öncelik ücreti SOL", p.prio)}</div>
    <details class="keys" open><summary>Giriş filtreleri (yeni token)</summary>
      <div class="f3">${inp("ap", "minInit", "Min ilk alım SOL", p.minInit)}${inp("ap", "minMcap", "Min mcap SOL", p.minMcap)}${inp("ap", "maxMcap", "Max mcap SOL", p.maxMcap)}</div>
      <div class="f3">${inp("ap", "maxDev", "Dev payı ≤ %", p.maxDev)}${inp("ap", "maxRisk", "Rug riski ≤", p.maxRisk)}${inp("ap", "waitSec", "Bekle (sn)", p.waitSec)}</div>
      <div class="f2">${inp("ap", "minMom", "Momentum ≥ % (bekleme sonunda)", p.minMom)}<label class="chk" style="align-self:end"><input type="checkbox" data-ap="needSoc" ${p.needSoc ? "checked" : ""}> sosyal hesap şart</label></div>
      <label>Kara liste (yaratıcı adresleri, virgülle)<input data-ap="blacklist" value="${esc(p.blacklist)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <div class="plan-foot">Kural: yeni token filtreleri geçerse ${p.waitSec} sn izlenir; sonunda mcap çıkıştan ≥ %${p.minMom} yukarıdaysa, zirveden %20'den fazla düşmediyse ve sınırlar uygunsa BOT ${p.perTrade} SOL ile alır. Çıkış: +%${p.tp} kâr, −%${p.sl} zarar, ${p.holdMin} dk süre ya da curve tamamlanınca %100 satış. Değer, bonding curve'den hesaplanan satış teklifidir (ücretler dahil tahmini).</div></details>
    <div class="sub-h">AÇIK BOT POZİSYONLARI</div><div id="au-pos" class="pos-list"></div>
    <div class="sub-h">BINANCE VADELİ · SİNYAL</div>
    <label class="chk big"><input type="checkbox" id="au-bn" ${ST.bn ? "checked" : ""}> <b>Binance oto</b> <small>aktif: <b class="${c.testnet ? "" : "dn"}">${c.testnet ? "TEST API (Testnet) — serbest" : "⚠ GERÇEK API"}</b></small></label>
    <label class="chk real-chk"><input type="checkbox" data-ab="real" ${b.real ? "checked" : ""}> ⚠ Binance GERÇEK'te oto <small>(kapalıyken gerçek hesapta asla oto emir açılmaz)</small></label>
    <div class="f2">${inp("ab", "conf", "Min sinyal güveni %", b.conf)}${inp("ab", "rescanMin", "Yeniden analiz (dk)", b.rescanMin)}</div>
    <div class="f2">${inp("ab", "maxDay", "Günde max oto işlem", b.maxDay)}${inp("ab", "lev", "Kaldıraç (1–3x)", b.lev)}</div>
    <div class="plan-foot">Kural: analiz edilen coinde LONG/SHORT sinyali, güven ≥ eşik ve kırılım gerçekleşmişse (piyasa girişi) — sembolde açık pozisyon yoksa — ayarlardaki max zarar ($${ENGINE.config().max_loss_per_trade}) ve pozisyon tavanıyla MARKET emir + STOP_MARKET + TAKE_PROFIT_MARKET kurulur. Analiz ${b.rescanMin} dk'da bir yenilenir.</div>
    <div class="sub-h">OTO KAYIT</div><div id="au-log" class="tlog">${ST.ev.map(e => `<div class="${e.cls || ""}"><small>${tm(e.t)}</small> ${e.msg}</div>`).join("")}</div>`; }
function autoBind(){ const box = $("#bot-box");
  $("#au-pump").onchange = e => setPump(e.target.checked); $("#au-bn").onchange = e => setBn(e.target.checked); $("#au-kill").onclick = () => kill(true);
  box.querySelectorAll("[data-ap],[data-ab]").forEach(i => i.addEventListener("change", () => { readForm(); const e = limitsOk(); if (e.length) alog("⚠ " + esc(e.join("; ")), "dn"); status(); }));
  status(); paintPos(); }
function journalHTML(){ const L = JOURNAL.list().slice().reverse(), tot = JOURNAL.totals();
  const sums = Object.entries(tot).map(([u, t]) => `<div><small>${u} · ${t.n} işlem · %${t.n ? (t.w/t.n*100).toFixed(0) : 0} kazanç</small><b class="${t.pnl >= 0 ? "up" : "dn"}">${t.pnl >= 0 ? "+" : ""}${fmt(t.pnl, u === "SOL" ? 4 : 2)} ${u}</b></div>`).join("") || `<div><small>K/Z</small><b>—</b></div>`;
  return `<div class="bt-sum">${sums}</div>
    <div class="f2"><button type="button" id="jr-csv" class="mini wide">CSV İNDİR</button><button type="button" id="jr-clr" class="mini wide s">GÜNLÜĞÜ SİL</button></div>
    <div class="jr">${L.length ? L.slice(0, 120).map(e => `<div class="jr-r"><div><b>${esc(e.sym || e.side || "")}</b> <span class="pill">${esc(e.venue)}</span><span class="pill ${e.mode === "OTO" ? "y" : ""}">${esc(e.mode)}</span><span class="pill">${esc(e.wallet || "")}</span></div>
      <div class="dim">${new Date(e.openT).toLocaleString("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · ${esc(e.side || "")}${e.in !== undefined && e.in !== null ? " · giriş " + fmt(e.in, 4) : ""}${e.out !== undefined && e.out !== null ? " · çıkış " + fmt(e.out, 4) : ""} ${esc(e.unit || "")}${e.open ? " · <b>AÇIK</b>" : ""}</div>
      ${typeof e.pnl === "number" ? `<div class="${e.pnl >= 0 ? "up" : "dn"}">K/Z ${e.pnl >= 0 ? "+" : ""}${fmt(e.pnl, 5)} ${esc(e.unit)} ${e.pnlPct !== null && e.pnlPct !== undefined ? "(" + (e.pnlPct >= 0 ? "+" : "") + e.pnlPct + "%)" : ""}</div>` : ""}
      ${e.reason || e.note ? `<div class="dim">${esc([e.reason, e.note].filter(Boolean).join(" · "))}</div>` : ""}</div>`).join("") : `<div class="empty">henüz işlem yok</div>`}</div>
    <div class="plan-foot">Günlük bu cihazda saklanır. BOT CÜZDANI işlemlerinde K/Z, işlem öncesi/sonrası gerçek SOL bakiyesi farkıdır (ağ ücreti, token hesabı kirası ve PumpPortal/pump.fun ücretleri dahil). Phantom işlemleri yalnızca kayıt olarak tutulur.</div>`; }
function journalBind(){ $("#jr-csv").onclick = () => JOURNAL.download(); $("#jr-clr").onclick = async () => { if (await CONN.typedConfirm("GÜNLÜĞÜ SİL", "Bu cihazdaki tüm işlem kayıtları silinir (açık pozisyonlar etkilenmez).", "SİL")){ JOURNAL.clear(); render(); } }; }
/* BOT section shell: tabs CÜZDAN / OTO AL-SAT / GÜNLÜK */
const UI = { tab: "w" };
function render(){ const box = $("#bot-box"); if (!box) return; document.querySelectorAll(".btabs button").forEach(b => b.classList.toggle("on", b.dataset.bt === UI.tab));
  try { if (UI.tab === "w"){ box.innerHTML = WALLET.html(); WALLET.bind(); } else if (UI.tab === "a"){ box.innerHTML = autoHTML(); autoBind(); } else { box.innerHTML = journalHTML(); journalBind(); } }
  catch(e){ console.error(e); box.innerHTML = `<div class="err-line">✖ BOT paneli hatası: ${esc(e.message)}</div>`; }
  const ns = $("#nt-snd"); if (ns) ns.checked = NOTIFY.s.sound; }
document.querySelectorAll(".btabs button").forEach(b => b.addEventListener("click", () => { UI.tab = b.dataset.bt; render(); }));
window.BOTUI = { get tab(){ return UI.tab; }, open(t){ UI.tab = t; render(); const s = $("#bot"); s && s.scrollIntoView({ behavior: "smooth", block: "start" }); } };
JOURNAL.on(() => { if (UI.tab === "j") render(); else status(); });
PUMP.onNew(onNew);
const kf = $("#killfab"); if (kf) kf.onclick = () => kill(true);
const sn = $("#nt-snd"); if (sn){ sn.checked = NOTIFY.s.sound; sn.onchange = e => { NOTIFY.set({ sound: e.target.checked, vib: e.target.checked }); if (e.target.checked) setTimeout(() => NOTIFY.ping("good", "Uyarılar açık 🔔"), 50); }; }
setInterval(() => { if (UI.tab === "a" && !document.hidden){ status(); paintPos(); } }, 3000);
render();
return { onAnalysis, kill: (ask) => kill(ask !== false), pumpOn: () => ST.pump, bnOn: () => ST.bn, watching: m => ST.cands.has(m) || ST.mons.has(m), render, _ST: ST, _C: () => C };
})();
window.AUTO = AUTO;
