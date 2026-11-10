"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
const TZL = TZ.split("/").pop().replace(/_/g, " ");
const params = new URLSearchParams(location.search);
const LANG = params.get("lang") === "en" ? "en" : "tr";
const STEP_NAMES = ["Tarayıcı","Haberler","Giriş","Çıkış Planı","Zaman Makinesi","Büyüklük","Risk","Emir Fişi","Alarmlar","Analist","Kongre"];

function num(x){ return (x === null || x === undefined || isNaN(+x)) ? null : +x; }
function fmtP(x){ x = num(x); if (x === null) return "—"; const a = Math.abs(x);
  if (a >= 1000) return "$" + x.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  if (a >= 1) return "$" + x.toFixed(4); if (a >= 0.01) return "$" + x.toFixed(5); return "$" + x.toPrecision(4); }
function fmtBig(x){ x = num(x); if (x === null) return "—"; for (const [d,s] of [[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]]) if (Math.abs(x) >= d) return "$" + (x/d).toFixed(2) + s; return "$" + x.toFixed(2); }
function fmtN(x, d=0){ x = num(x); return x === null ? "—" : x.toLocaleString("tr-TR",{maximumFractionDigits:d}); }
function pct(x, d=2){ x = num(x); return x === null ? "—" : (x >= 0 ? "+" : "") + x.toFixed(d) + "%"; }
function cls(x){ return num(x) === null ? "" : (x >= 0 ? "up" : "dn"); }
function tLocal(ts, withDate=true){ if (!ts) return "—"; const d = new Date(typeof ts === "number" ? ts*1000 : ts);
  return d.toLocaleString("tr-TR",{timeZone:TZ, day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit", ...(withDate?{}:{day:undefined,month:undefined})}); }
function tzOffset(ts){ const d = new Date(ts*1000); const l = new Date(d.toLocaleString("en-US",{timeZone:TZ})); const u = new Date(d.toLocaleString("en-US",{timeZone:"UTC"})); return (l-u)/1000; }
function countUp(el, to, fmt, ms=1200){ to = num(to); if (to === null){ el.textContent = "—"; return; } const t0 = performance.now();
  const f = t => { const k = Math.min(1,(t-t0)/ms), e = 1-Math.pow(1-k,3); el.textContent = fmt(to*e); if (k<1) requestAnimationFrame(f); else el.textContent = fmt(to); }; requestAnimationFrame(f); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- clock + tape ---------------- */
$("#tzl").textContent = TZL;
setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString("tr-TR",{timeZone:TZ}); }, 1000);
async function loadTape(){
  try { const d = await ENGINE.tape(["BTC","ETH","SOL","XRP","BNB","DOGE","ADA","AVAX","LINK","TON","TRX","DOT","LTC","SUI","INIT"]); if (!Array.isArray(d) || !d.length) return;
    const html = d.map(q => `<span><b>${esc(q.base)}</b>${fmtP(q.price)} <i class="${cls(q.chg)}">${q.chg>=0?"▲":"▼"} ${pct(q.chg)}</i></span>`).join("");
    $("#tape-track").innerHTML = html + html; $("#conn").textContent = "CANLI VERİ";
  } catch(e){ $("#conn").textContent = "BAĞLANTI YOK"; }
}
loadTape(); setInterval(loadTape, 30000);

/* ---------------- boot ---------------- */
const BOOT = [
 ["NEON//BIOS v11.0 mobil  (c) 2026", ""], ["11 beceri çekirdeği ..................", "ok"],
 ["Binance public API hattı .............", "ok"], ["CoinGecko analist modülü .............", "ok"],
 ["Zaman makinesi worker'ı ..............", "ok"], ["7/24 kripto seans adaptörü ...........", "ok"],
 ["Canlı akış (WebSocket) ................", "ok"], ["Emir motoru ........ YALNIZ ONAYLA İLE", "warn"], ["Cüzdan ......... YALNIZ SEN BAĞLARSAN", "warn"],
 ["Sistem hazır. Bir coin yaz ve Enter'a bas.", ""],
];
async function boot(){
  if (params.get("noboot")) { $("#boot").remove(); return; }
  const box = $("#boot-lines"), fill = $("#boot-fill"), p = $("#boot-pct");
  for (let i=0;i<BOOT.length;i++){
    const [txt, st] = BOOT[i]; const line = document.createElement("div"); box.appendChild(line);
    for (let j=0;j<=txt.length;j+=3){ line.textContent = txt.slice(0,j); await sleep(8); }
    line.innerHTML = esc(txt) + (st==="ok" ? ' <span class="ok">[ OK ]</span>' : st==="warn" ? ' <span class="warn">[ ! ]</span>' : "");
    const k = Math.round((i+1)/BOOT.length*100); fill.style.width = k+"%"; p.textContent = k+"%";
    await sleep(110);
  }
  await sleep(450); $("#boot").classList.add("fade"); await sleep(650); $("#boot").remove();
}

/* ---------------- command line ---------------- */
const inp = $("#cmd-input"), txt = $("#cmd-text"), ghost = $("#cmd-ghost");
const DEMOS = ["btc", "solana", "init", "INITUSDT", "eth", "doge"]; let demoI = 0, demoTimer = null;
function mirror(){ txt.textContent = inp.value; ghost.textContent = ""; }
inp.addEventListener("input", () => { stopDemo(); mirror(); });
async function demoLoop(){ while (demoTimer && !inp.value){ const w = DEMOS[demoI++ % DEMOS.length];
  for (let i=1;i<=w.length && demoTimer && !inp.value;i++){ ghost.textContent = w.slice(0,i); await sleep(140); }
  await sleep(1300); for (let i=w.length;i>=0 && demoTimer && !inp.value;i--){ ghost.textContent = w.slice(0,i); await sleep(50); } await sleep(300); } }
function startDemo(){ if (!demoTimer){ demoTimer = 1; demoLoop(); } }
function stopDemo(){ demoTimer = null; ghost.textContent = ""; }
document.addEventListener("click", e => { if (!e.target.closest("a,button,input,label,#sheet,.panel") && matchMedia("(pointer:fine)").matches) inp.focus(); });
$("#cmd").addEventListener("submit", e => { e.preventDefault(); const v = inp.value.trim(); if (v) run(v); });

/* ---------------- run ---------------- */
let CUR = null, chart = null, cseries = null, liveTimer = null, running = false;
function buildSteps(){
  $("#steps").innerHTML = STEP_NAMES.map((n,i) => `<div class="step ${i?'wait':''}" id="st${i+1}"><span class="sn">${String(i+1).padStart(2,"0")}</span><span class="st">${n}</span><span class="spin"></span></div>`).join("");
}
async function run(q){
  if (running) return; running = true; stopDemo();
  inp.value = ""; txt.textContent = q; history.replaceState(null, "", "?coin=" + encodeURIComponent(q) + (params.get("noboot")?"&noboot=1":""));
  $("#error").classList.add("hidden"); $("#dash").classList.add("hidden"); $("#progress").classList.remove("hidden");
  $("#prog-title").textContent = "TARANIYOR: " + q.toUpperCase(); $("#prog-fill").style.width = "0"; $("#prog-count").textContent = "0/11";
  buildSteps(); setLive(false); $("#plog").innerHTML = "";
  const steps = {}; let done = null, err = null, start = null;
  let tmN = 0;
  try {
    const queue = []; let wake = null;
    const p = ENGINE.run(q, ev => { queue.push(ev); if (wake) { wake(); wake = null; } }).then(() => { queue.push({ type: "_end" }); if (wake) { wake(); wake = null; } });
    let end = false;
    while (!end){
      if (!queue.length) await new Promise(r => wake = r);
      const ev = queue.shift(); if (!ev) continue;
      if (ev.type === "_end") end = true;
      else if (ev.type === "error") err = ev.error;
      else if (ev.type === "start"){ start = ev; $("#prog-title").textContent = "VERİ İNDİRİLİYOR: " + ev.symbol + "  " + fmtP(ev.price); }
      else if (ev.type === "load"){ $("#prog-title").textContent = `5DK MUMLAR ${ev.done}/${ev.total}: ${start ? start.symbol : ""}`; $("#prog-fill").style.width = (ev.done/ev.total*8) + "%"; }
      else if (ev.type === "tmprog"){ const el = $("#st5 .st"); if (el) el.textContent = "Zaman Makinesi " + Math.round(ev.k*100) + "%"; }
      else if (ev.type === "step"){ if (ev.n === 1 && start) $("#prog-title").textContent = "TARANIYOR: " + start.symbol + "  " + fmtP(start.price); steps[ev.n] = ev; await markStep(ev); }
      else if (ev.type === "done") done = ev;
    }
    await p;
  } catch(e){ err = "Veri hatası: " + (e && e.message || e); }
  if (err || !done){ showError(err || "Beklenmeyen yanıt"); running = false; return; }
  await sleep(350);
  render(done, steps);
  running = false; inp.blur();
}
async function markStep(ev){
  const el = $("#st"+ev.n); el.classList.remove("wait"); el.classList.add(ev.ok ? "done" : "fail");
  el.querySelector(".spin")?.remove(); el.insertAdjacentHTML("beforeend", `<span class="mark">${ev.ok?"✔":"✖"}</span><span class="ms">${ev.ms}ms</span>`);
  const nx = $("#st"+(ev.n+1)); if (nx) nx.classList.remove("wait");
  $("#prog-fill").style.width = (8 + ev.n/11*92) + "%"; $("#prog-count").textContent = ev.n + "/11";
  const lines = (ev.ok ? ev.log : "HATA: " + ev.error).split("\n").filter(l => l.trim()).slice(0, 4);
  const pl = $("#plog"); pl.insertAdjacentHTML("beforeend", `<div class="${ev.ok?"":"dn"}"><b>[${String(ev.n).padStart(2,"0")}] ${esc(ev.title)}</b>\n${esc(lines.join("\n"))}</div>`); pl.scrollTop = pl.scrollHeight;
  await sleep(params.get("slow") ? 900 : 140);
}
function showError(msg){
  $("#progress").classList.add("hidden"); $("#dash").classList.add("hidden");
  const e = $("#error"); e.classList.remove("hidden"); const b = e.querySelector(".err-box"); b.style.animation = "none"; b.offsetHeight; b.style.animation = "";
  $("#err-msg").textContent = "▶ " + msg;
}

/* ---------------- render ---------------- */
function panelFail(sel, step){ const p = document.querySelector(sel); p.classList.add("failed");
  return `<div class="err-line">✖ ${esc(step && step.error || "veri yok")}</div>`; }
function render(d, steps){
  CUR = d; const D = d.data;
  $("#progress").classList.add("hidden"); $("#dash").classList.remove("hidden");
  document.querySelectorAll(".grid .panel").forEach(p => { p.classList.remove("show","failed"); });
  // hero
  $("#h-sym").textContent = d.symbol; $("#h-name").textContent = (D.analyst && D.analyst.name) || d.base;
  $("#h-price").textContent = fmtP(d.price);
  const chg = d.chg24;
  const hc = $("#h-chg"); hc.textContent = pct(chg) + " 24s"; hc.className = "chg " + cls(chg);
  const b = []; if (D.entry) b.push(`<span class="badge" style="color:${D.entry.status==="triggered"?"#39ff14":D.entry.status==="waiting"?"#ffe600":"#ff2bd6"}">${esc(D.entry.label)}</span>`);
  if (D.risk) b.push(`<span class="badge" style="color:${D.risk.ok?"#39ff14":"#ff3355"}">RİSK: ${esc(D.risk.verdict)}</span>`);
  if (D.scan && D.scan.setup) b.push(`<span class="badge" style="color:#00f0ff">${esc(D.scan.setup)}</span>`);
  if (D.signal) b.push(`<span class="badge" style="color:${D.signal.dir==="LONG"?"#39ff14":D.signal.dir==="SHORT"?"#ff3355":"#ffe600"}">SİNYAL: ${D.signal.dir}</span>`);
  $("#h-badges").innerHTML = b.join("");
  try { renderSignal(D.signal, d); } catch(e){ console.error(e); $("#signal").innerHTML = `<div class="err-line">✖ sinyal çizilemedi: ${esc(e.message)}</div>`; }
  try { window.TRADE && TRADE.onAnalysis(d); } catch(e){ console.error(e); }
  const order = [[".p-chart",1],[".p-rsi",1],[".p-entry",3],[".p-plan",4],[".p-tm",5],[".p-budget",6],[".p-risk",7],[".p-ticket",8],[".p-alerts",9],[".p-analyst",10],[".p-congress",11],[".p-news",2]];
  order.forEach(([s], i) => setTimeout(() => document.querySelector(s).classList.add("show"), 80*i));
  const safe = (fn, sel, n) => { try { fn(); } catch(e){ console.error(e); document.querySelector(sel).querySelector("h3").insertAdjacentHTML("afterend", panelFail(sel,{error:"çizim hatası: "+e.message})); } };
  safe(() => renderChart(d, "5m"), ".p-chart");
  safe(() => D.scan ? renderRSI(D.scan) : ($("#scan-info").innerHTML = panelFail(".p-rsi", steps[1])), ".p-rsi");
  safe(() => $("#entry-box").innerHTML = D.entry ? entryHTML(D.entry) : panelFail(".p-entry", steps[3]), ".p-entry");
  safe(() => $("#plan-box").innerHTML = D.plan ? planHTML(D.plan, d.price) : panelFail(".p-plan", steps[4]), ".p-plan");
  safe(() => D.tm ? renderTM(D.tm) : ($("#tm-info").innerHTML = panelFail(".p-tm", steps[5])), ".p-tm");
  safe(() => D.budget ? renderBudget(D.budget) : ($("#budget-box").innerHTML = panelFail(".p-budget", steps[6])), ".p-budget");
  safe(() => D.risk ? renderRisk(D.risk) : ($("#risk-box").innerHTML = panelFail(".p-risk", steps[7])), ".p-risk");
  safe(() => D.ticket ? renderTicket(D.ticket, d) : ($("#ticket-box").innerHTML = panelFail(".p-ticket", steps[8])), ".p-ticket");
  safe(() => D.alerts ? renderAlerts(D.alerts.price, true) : ($("#alerts-box").innerHTML = panelFail(".p-alerts", steps[9])), ".p-alerts");
  setLive(true);
  safe(() => D.analyst ? renderAnalyst(D.analyst) : ($("#analyst-box").innerHTML = panelFail(".p-analyst", steps[10])), ".p-analyst");
  safe(() => $("#news-box").innerHTML = D.news ? newsHTML(D.news) : panelFail(".p-news", steps[2]), ".p-news");
  safe(() => $("#congress-box").innerHTML = D.pelosi ? congressHTML(D.pelosi) : panelFail(".p-congress", steps[11]), ".p-congress");
  // summary
  const errs = Object.values(steps).filter(s => !s.ok).map(s => s.n);
  $("#sum-grid").innerHTML = d.summary.map(([k,v]) => `<div><small>${esc(k)}</small><span>${esc(v)}</span></div>`).join("") +
    (errs.length ? `<div style="border-color:#ff3355"><small>HATA</small><span class="dn">adım ${errs.join(", ")}</span></div>` : "");
  $("#sum-disc").textContent = "⚠ " + d.disclaimer; const s = $("#summary"); s.classList.remove("show"); setTimeout(() => s.classList.add("show"), 1000);
}

/* signal */
function renderSignal(S, d){
  const el = $("#signal"); if (!S){ el.innerHTML = `<div class="err-line">✖ sinyal hesaplanamadı (açılış aralığı / mum verisi eksik)</div>`; return; }
  const c = S.dir === "LONG" ? "long" : S.dir === "SHORT" ? "short" : "wait", a = S.active, L = a.side === "long";
  const arrow = S.dir === "LONG" ? "▲" : S.dir === "SHORT" ? "▼" : "■";
  const row = (k, v, sub, cl) => `<div class="sg-row ${cl||""}"><span>${k}</span><b>${fmtP(v)}</b><small>${sub||""}</small></div>`;
  const dd = v => pct((v/a.entry - 1)*100);
  el.className = "signal " + c;
  el.innerHTML = `<div class="sg-head"><div class="sg-dir">${arrow} ${S.dir}</div><div class="sg-conf"><small>GÜVEN</small><b>%${S.conf}</b><div class="cbar"><div style="width:${S.conf}%"></div></div></div></div>
   <div class="sg-sub">${S.dir === "BEKLE" ? `Net yön yok · ${L ? "hafif LONG" : "hafif SHORT"} eğilim (skor ${S.score.toFixed(0)}) · seviyeler ${L ? "LONG" : "SHORT"} için` : `skor ${S.score > 0 ? "+" : ""}${S.score.toFixed(0)} / 100 · ${a.mode === "piyasa" ? "kırılım gerçekleşti, piyasa fiyatından" : "tetik bekleniyor: " + fmtP(a.trigger) + (L ? " üstü kapanış" : " altı kapanış")}`}</div>
   <div class="sg-levels">${row("GİRİŞ", a.entry, a.mode, "e")}${row("STOP", a.stop, dd(a.stop) + " · " + esc(a.stop_label), "s")}${row("HEDEF " + (a.reward_risk||2) + "R", a.target, dd(a.target), "t")}</div>
   <div id="sig-now" class="sg-now"></div>
   <details class="sg-why"><summary>Neden? (5 faktör)</summary>${S.factors.map(f => { const v = f.v*f.w; return `<div class="fx"><div class="lab"><span>${esc(f.name)}</span><span class="${cls(v)}">${v>0?"+":""}${v.toFixed(0)}</span></div><div class="track"><div class="cen"></div><div class="b ${v>=0?"up":"dn"}" style="${v>=0?`left:50%;width:${Math.abs(f.v)*50}%`:`left:${50-Math.abs(f.v)*50}%;width:${Math.abs(f.v)*50}%`}"></div></div><small>${esc(f.txt)}</small></div>`; }).join("")}
     <div class="plan-foot">LONG seviyeleri: giriş ${fmtP(S.levels.long.entry)} · stop ${fmtP(S.levels.long.stop)} · hedef ${fmtP(S.levels.long.target)}<br>SHORT seviyeleri: giriş ${fmtP(S.levels.short.entry)} · stop ${fmtP(S.levels.short.stop)} · hedef ${fmtP(S.levels.short.target)}</div></details>
   <div class="sg-foot"><span>⚠ sinyal, garanti değil · yatırım tavsiyesi değildir</span><button type="button" id="sig-trade">İŞLEM ↓</button></div>`;
  $("#sig-trade").addEventListener("click", () => { const t = $("#trade"); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); });
}

/* chart */
let chartTF = "5m";
document.querySelectorAll(".p-chart .tabs button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".p-chart .tabs button").forEach(x => x.classList.toggle("on", x === b)); if (CUR) renderChart(CUR, b.dataset.tf); }));
function chartPlan(D){ return D.signal && D.signal.dir === "SHORT" ? D.signal.active : D.plan; }
function renderChart(d, tf){
  chartTF = tf; const el = $("#chart"); const D = d.data;
  if (chart){ chart.remove(); chart = null; }
  const raw = tf === "1h" ? d.bars1h : d.bars5m; if (!raw || !raw.length) throw new Error("mum verisi yok");
  const off = tzOffset(raw[raw.length-1][0]);
  chart = LightweightCharts.createChart(el, { autoSize: true,
    layout: { background: { type: "solid", color: "transparent" }, textColor: "#6fa5b5", fontFamily: "Share Tech Mono, monospace" },
    grid: { vertLines: { color: "#0e2230" }, horzLines: { color: "#0e2230" } },
    crosshair: { mode: 0, vertLine: { color: "#ff2bd6", labelBackgroundColor: "#ff2bd6" }, horzLine: { color: "#00f0ff", labelBackgroundColor: "#00a8b5" } },
    rightPriceScale: { borderColor: "#12324a" }, timeScale: { borderColor: "#12324a", timeVisible: true, secondsVisible: false } });
  const prec = d.price >= 1000 ? 2 : d.price >= 1 ? 4 : d.price >= 0.01 ? 5 : 8;
  cseries = chart.addCandlestickSeries({ upColor: "#39ff14", downColor: "#ff3355", borderUpColor: "#39ff14", borderDownColor: "#ff3355",
    wickUpColor: "#39ff14aa", wickDownColor: "#ff3355aa", priceFormat: { type: "price", precision: prec, minMove: Math.pow(10,-prec) },
    autoscaleInfoProvider: orig => { const r = orig(); const P = chartPlan(D); if (r && P) { const pr = r.priceRange;
      pr.minValue = Math.min(pr.minValue, P.stop, P.target, P.entry); pr.maxValue = Math.max(pr.maxValue, P.stop, P.target, P.entry); } return r; } });
  cseries.setData(raw.map(b => ({ time: b[0] + off, open: b[1], high: b[2], low: b[3], close: b[4] })));
  const P = chartPlan(D); if (P){ const L = (p,c,t,s) => cseries.createPriceLine({ price: p, color: c, lineWidth: 2, lineStyle: s, axisLabelVisible: true, title: t });
    const pre = P.side === "short" ? "SHORT " : ""; L(P.target, "#39ff14", pre + "HEDEF", 2); L(P.entry, "#00f0ff", pre + "GİRİŞ", 0); L(P.stop, "#ff3355", pre + "STOP", 2); }
  if (D.entry && D.entry.trigger){ const step = tf === "1h" ? 3600 : 300; const t = Math.floor((D.entry.trigger.t - 300)/step)*step + off;
    if (raw.some(b => b[0] + off === t)) cseries.setMarkers([{ time: t, position: "belowBar", color: "#ffe600", shape: "arrowUp", text: "TETİK" }]); }
  if (tf === "1h") chart.timeScale().setVisibleLogicalRange({ from: raw.length - 120, to: raw.length + 4 });
  else chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, raw.length - 300), to: raw.length + 6 });
  const cv = $("#orbox"); el.appendChild(cv);
  const draw = () => { const r = el.getBoundingClientRect(); cv.width = r.width; cv.height = r.height; const g = cv.getContext("2d"); g.clearRect(0,0,cv.width,cv.height);
    if (!D.entry) return; const ts = chart.timeScale();
    let x1 = ts.timeToCoordinate(Math.floor(D.entry.or_start/(tf==="1h"?3600:300))*(tf==="1h"?3600:300) + off);
    let x2 = ts.timeToCoordinate(D.entry.or_end + off - (tf==="1h"?0:300));
    if (x1 === null && x2 === null) return; if (x1 === null) x1 = 0; if (x2 === null) x2 = cv.width - 60;
    if (tf === "1h" && x2 - x1 < 6) x2 = x1 + Math.max(6, ts.options().barSpacing || 6);
    const y1 = cseries.priceToCoordinate(D.entry.or_high), y2 = cseries.priceToCoordinate(D.entry.or_low); if (y1 === null || y2 === null) return;
    g.fillStyle = "rgba(255,230,0,0.10)"; g.strokeStyle = "rgba(255,230,0,0.85)"; g.lineWidth = 1; g.setLineDash([4,3]);
    g.fillRect(x1, y1, Math.max(2,x2-x1), y2-y1); g.strokeRect(x1, y1, Math.max(2,x2-x1), y2-y1);
    g.setLineDash([]); g.fillStyle = "#ffe600"; g.font = "11px Share Tech Mono"; g.fillText("AÇILIŞ ARALIĞI", x1 + 3, y1 - 4); };
  chart.timeScale().subscribeVisibleLogicalRangeChange(() => requestAnimationFrame(draw));
  new ResizeObserver(() => requestAnimationFrame(draw)).observe(el); setTimeout(draw, 60); setTimeout(draw, 400);
}

/* rsi gauge */
function renderRSI(s){
  const g = $("#gauge"); const r = num(s.rsi); const arc = (a0,a1,c,w=14) => { const p = a => [100+80*Math.cos(Math.PI*(1-a)), 105-80*Math.sin(Math.PI*(1-a))];
    const [x0,y0] = p(a0), [x1,y1] = p(a1); return `<path d="M${x0} ${y0} A80 80 0 0 1 ${x1} ${y1}" stroke="${c}" stroke-width="${w}" fill="none"/>`; };
  g.innerHTML = `<defs><filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
   <g filter="url(#glow)" opacity=".9">${arc(0,.3,"#39ff14")}${arc(.3,.7,"#0f4a5c")}${arc(.7,1,"#ff3355")}</g>
   <text x="22" y="118" fill="#39ff14" font-size="9" font-family="Share Tech Mono">AŞIRI SATIM</text><text x="140" y="118" fill="#ff3355" font-size="9" font-family="Share Tech Mono">AŞIRI ALIM</text>
   <line id="needle" x1="100" y1="105" x2="100" y2="35" stroke="#ffe600" stroke-width="3" filter="url(#glow)" style="transform-origin:100px 105px;transform:rotate(-90deg);transition:transform 1.6s cubic-bezier(.2,1.4,.4,1)"/>
   <circle cx="100" cy="105" r="6" fill="#ffe600"/><text id="rsival" x="100" y="88" fill="#fff" font-size="22" text-anchor="middle" font-family="Share Tech Mono">—</text>
   <text x="100" y="62" fill="#4f7b8a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">RSI 14</text>`;
  if (r !== null){ setTimeout(() => g.querySelector("#needle").style.transform = `rotate(${-90 + r*1.8}deg)`, 200); countUp(g.querySelector("#rsival"), r, v => v.toFixed(1)); }
  $("#scan-info").innerHTML = [["SMA20", fmtP(s.sma20)], ["20g zirve", fmtP(s.hi20)], ["1 gün", `<span class="${cls(s.chg1)}">${pct(s.chg1)}</span>`],
    ["7 gün", `<span class="${cls(s.chg7)}">${pct(s.chg7)}</span>`], ["30 gün", `<span class="${cls(s.chg30)}">${pct(s.chg30)}</span>`], ["Kurulum", esc(s.setup || "—")]]
    .map(([k,v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join("");
  const c = $("#spark"); const W = c.clientWidth || 300; c.width = W; const ctx = c.getContext("2d"); const pts = (s.closes||[]).map(x => x[1]);
  if (pts.length > 1){ const mn = Math.min(...pts), mx = Math.max(...pts); const y = v => 55 - (v-mn)/(mx-mn||1)*50;
    const grd = ctx.createLinearGradient(0,0,0,60); grd.addColorStop(0,"#00f0ff55"); grd.addColorStop(1,"#00f0ff00");
    ctx.beginPath(); pts.forEach((v,i) => ctx[i?"lineTo":"moveTo"](i/(pts.length-1)*W, y(v))); ctx.strokeStyle = "#00f0ff"; ctx.lineWidth = 1.5; ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 6; ctx.stroke();
    ctx.lineTo(W,60); ctx.lineTo(0,60); ctx.fillStyle = grd; ctx.shadowBlur = 0; ctx.fill();
    ctx.fillStyle = "#4f7b8a"; ctx.font = "10px Share Tech Mono"; ctx.fillText("90 gün kapanış", 4, 10); }
}

/* entry */
function entryHTML(e){
  const lo = Math.min(e.lo24, e.or_low, e.price), hi = Math.max(e.hi24, e.or_high, e.price, e.entry); const P = v => ((v-lo)/(hi-lo||1)*100).toFixed(2);
  return `<div class="big-badge ${e.status}">${esc(e.label)}</div>
  <div class="kv"><span class="k">Açılış aralığı (UTC ilk ${e.or_minutes}dk)</span><span class="v">${fmtP(e.or_low)} – ${fmtP(e.or_high)}</span>
  <span class="k">Aralık başlangıcı</span><span class="v">${tLocal(e.or_start)} ${TZL}</span>
  <span class="k">Tetik</span><span class="v">${e.trigger ? fmtP(e.trigger.price) + " · " + tLocal(e.trigger.t) : "henüz yok"}</span>
  <span class="k">Plan girişi</span><span class="v">${fmtP(e.entry)}</span></div>
  <div class="rangebar"><span class="lo">${fmtP(lo)}</span><span class="hi">${fmtP(hi)}</span>
   <div class="fill" style="left:${P(e.or_low)}%;width:${(P(e.or_high)-P(e.or_low)).toFixed(2)}%"></div>
   <div class="mk or" style="left:${P(e.or_high)}%"><span>OR↑</span></div><div class="mk" style="left:${P(e.price)}%"><span>şimdi</span></div></div>`;
}
function planHTML(p, price){
  const r = p.entry - p.stop;
  return `<div class="ladder"><div class="rung t"><span>HEDEF <small>${(p.reward_risk||2).toFixed(1)}R</small></span><span>${fmtP(p.target)} <small>${pct((p.target/p.entry-1)*100)}</small></span></div>
  <div class="rung e"><span>GİRİŞ</span><span>${fmtP(p.entry)}</span></div>
  <div class="rung s"><span>STOP <small>${esc(p.stop_label||"")}</small></span><span>${fmtP(p.stop)} <small>${pct((p.stop/p.entry-1)*100)}</small></span></div></div>
  <div class="plan-foot">Birim risk ${fmtP(r)} · Pozisyonu kapat: <b style="color:#ff2bd6">${tLocal(p.flat_by_ts)} ${TZL}</b><br>exit.py'nin 15:55 ET kuralı yerine 7/24 tutma süresi.</div>`;
}

/* time machine */
function renderTM(t){
  $("#tm-n").textContent = fmtN(t.n) + " simülasyon · " + t.hold_hours + "s ufuk";
  const c = $("#hist"); const W = c.clientWidth || 600, H = 190; c.width = W; c.height = H; const g = c.getContext("2d");
  const bins = t.bins || [], mx = Math.max(1, ...bins), bw = W / Math.max(1,bins.length), rmin = t.r_min, rmax = t.r_max;
  const colorOf = i => { const rv = rmin + (i+.5)*(rmax-rmin)/bins.length; return rv <= -0.95 ? "#ff3355" : rv >= (rmax - (rmax-rmin)/bins.length) ? "#39ff14" : "#00f0ff"; };
  const t0 = performance.now();
  const frame = now => { const k = Math.min(1,(now-t0)/1100), e = 1-Math.pow(1-k,3); g.clearRect(0,0,W,H);
    g.strokeStyle = "#0e2230"; for (let y=20;y<H-20;y+=34){ g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); }
    bins.forEach((v,i) => { const h = (v ? Math.max(2, Math.sqrt(v/mx)*(H-40)) : 0)*e; const col = colorOf(i); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8; g.fillRect(i*bw+1, H-20-h, bw-2, h); });
    g.shadowBlur = 0; g.fillStyle = "#4f7b8a"; g.font = "10px Share Tech Mono"; g.fillText(rmin.toFixed(2)+"R", 2, H-6); g.textAlign = "right"; g.fillText(rmax.toFixed(2)+"R", W-2, H-6);
    g.textAlign = "center"; if (rmax > 0 && rmin < 0){ const x0 = (0-rmin)/(rmax-rmin)*W; g.strokeStyle = "#ffe60088"; g.setLineDash([3,3]); g.beginPath(); g.moveTo(x0,10); g.lineTo(x0,H-20); g.stroke(); g.setLineDash([]); g.fillStyle = "#ffe600"; g.fillText("0R", x0, H-6); }
    g.textAlign = "left"; g.fillStyle = "#6fa5b5"; g.fillText("Sonuç dağılımı (R) · √ ölçek", 4, 12);
    if (k < 1) requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  // donut
  const parts = [["Önce hedef", t.target, "#39ff14"], ["Önce stop", t.stop, "#ff3355"], ["Hiçbiri", t.neither, "#00f0ff"]];
  const C = 2*Math.PI*46; let acc = 0;
  $("#donut").innerHTML = `<circle cx="60" cy="60" r="46" stroke="#0d1f2b" stroke-width="14" fill="none"/>` + parts.map(([n,v,c]) => { const len = (num(v)||0)/100*C;
    const s = `<circle cx="60" cy="60" r="46" stroke="${c}" stroke-width="14" fill="none" stroke-dasharray="0 ${C}" data-len="${len}" stroke-dashoffset="${-acc}" transform="rotate(-90 60 60)" style="transition:stroke-dasharray 1.3s ease;filter:drop-shadow(0 0 4px ${c})"/>`; acc += len; return s; }).join("") +
    `<text x="60" y="58" text-anchor="middle" fill="#fff" font-size="16" font-family="Share Tech Mono" id="dn-val">0%</text><text x="60" y="74" text-anchor="middle" fill="#4f7b8a" font-size="8" font-family="Share Tech Mono">HEDEF ÖNCE</text>`;
  setTimeout(() => $("#donut").querySelectorAll("circle[data-len]").forEach(ci => ci.setAttribute("stroke-dasharray", `${ci.dataset.len} ${C}`)), 100);
  countUp($("#dn-val"), t.target, v => v.toFixed(1) + "%");
  $("#donut-legend").innerHTML = parts.map(([n,v,c]) => `<div><span style="color:${c}">■ ${n}</span><b class="cu" data-v="${v}">0%</b></div>`).join("");
  $("#donut-legend").querySelectorAll(".cu").forEach(b => countUp(b, +b.dataset.v, v => v.toFixed(1) + "%"));
  const h = t.history || {};
  $("#tm-info").innerHTML = [["Ort. sonuç", `<span class="${cls(t.avg_r)}">${(t.avg_r>=0?"+":"") + (num(t.avg_r)??0).toFixed(2)}R</span>`], ["p10 / p50 / p90", `${fmtP(t.p10)} · ${fmtP(t.p50)} · ${fmtP(t.p90)}`],
    ["Geçmiş tetik", `${h.target??0 + 0}✔ ${h.stop??0}✖ ${h.neither??0}○ / ${h.days??0} gün`], ["Geçmiş ort.", h.avg_r === null || h.avg_r === undefined ? "—" : `<span class="${cls(h.avg_r)}">${(h.avg_r>=0?"+":"")+h.avg_r.toFixed(2)}R</span>`]]
    .map(([k,v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join("");
}

/* budget */
function renderBudget(b){
  const mx = Math.max(...b.limits.map(l => l.usd), 1);
  $("#budget-box").innerHTML = `<div class="qty-big"><span id="qty">0</span> <small>${esc(b.base)}</small></div>
  <div class="kv"><span class="k">Tutar</span><span class="v" id="notional">$0</span><span class="k">Stopta zarar</span><span class="v dn">$${(b.loss||0).toFixed(2)}</span>
  <span class="k">Hesap / max zarar</span><span class="v">$${fmtN(b.account)} / $${b.max_loss}</span><span class="k">Birim risk</span><span class="v">${fmtP(b.rpu)}</span></div>
  <div class="limits">${b.limits.map(l => `<div class="lim ${l.name===b.which?"win":""}"><div class="lab"><span>${l.name===b.which?"▶ ":""}${esc(l.name)}</span><span>$${fmtN(l.usd,2)}</span></div><div class="bar"><div data-w="${(l.usd/mx*100).toFixed(1)}"></div></div></div>`).join("")}</div>`;
  const dec = b.qty >= 100 ? 2 : 6; countUp($("#qty"), b.qty, v => v.toFixed(dec)); countUp($("#notional"), b.notional, v => "$" + v.toFixed(2));
  setTimeout(() => document.querySelectorAll(".lim .bar div").forEach(x => x.style.width = x.dataset.w + "%"), 150);
}
/* risk */
function renderRisk(r){
  const ok = `<svg class="cm" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="none" stroke="#39ff1466"/><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="#39ff14" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  const no = `<svg class="cm" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="none" stroke="#ff335566"/><path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="#ff3355" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  $("#risk-box").innerHTML = `<ul class="checks">${r.checks.map(c => `<li>${c.ok?ok:no}<span style="color:${c.ok?"#c9ffd0":"#ffb3c0"}">${esc(c.name)}</span></li>`).join("")}</ul>
   <div class="verdict ${r.ok?"ok":"no"}">${r.ok?"✔":"✖"} ${esc(r.verdict)}</div>`;
  document.querySelectorAll(".checks li").forEach((li,i) => setTimeout(() => li.classList.add("in"), 300 + i*160));
}
/* ticket */
function renderTicket(t, d){
  const o = t.order || {};
  $("#ticket-box").innerHTML = `<div class="receipt"><div class="rh">NEON//TERMINAL · EMİR FİŞİ</div>
   <div class="rl"><span>TARİH</span><span>${tLocal(Date.now()/1000)} ${TZL}</span></div>
   <div class="rl"><span>SEMBOL</span><span>${esc(o.symbol)}</span></div>
   <div class="rl"><span>İŞLEM</span><span>ALIŞ · ${esc(o.type)}</span></div>
   <div class="rl"><span>MİKTAR</span><span>${esc(o.qty)}</span></div>
   <div class="rd"></div>
   <div class="rl"><span>GİRİŞ</span><span>${fmtP(t.entry)}</span></div>
   <div class="rl"><span>STOP</span><span>${fmtP(t.stop)}</span></div>
   <div class="rl"><span>HEDEF</span><span>${fmtP(t.target)}</span></div>
   <div class="rl"><span>KAPAT</span><span>${tLocal(t.flat_by_ts)}</span></div>
   <div class="rl"><span>RİSK</span><span>${esc(t.risk)}</span></div>
   <div class="rd"></div><pre>${esc(JSON.stringify(o))}</pre>
   <div class="rd"></div><div style="text-align:center;font-size:10px">*** BROKER'A GÖNDERİLMEDİ · CÜZDAN KULLANILMADI ***</div>
   <div class="stamp">KAĞIT / GÖNDERİLMEDİ<small>PAPER · NOT PLACED</small></div></div>`;
  setTimeout(() => $("#ticket-box .stamp").classList.add("hit"), 700);
}
/* alerts */
let lastPrice = null;
function renderAlerts(price, first){
  const a = CUR.data.alerts, L = a.levels;
  const rows = [["Hedef","t",L.target],["Giriş tetik","e",L.entry],["Stop","s",L.stop]];
  const maxd = Math.max(...rows.map(r => Math.abs(r[2]/price-1)*100), 0.5);
  const flash = lastPrice !== null && price !== lastPrice ? (price > lastPrice ? "flash-up" : "flash-dn") : "";
  $("#alerts-box").innerHTML = `<div class="live-price ${first ? "" : flash}">${fmtP(price)} <small id="live-at">${first ? "24s " + fmtP(a.low) + " – " + fmtP(a.high) : "güncellendi " + new Date().toLocaleTimeString("tr-TR",{timeZone:TZ})}</small></div>
   <div class="alv">${rows.map(([n,c,v]) => { const dd = (v/price-1)*100; const w = Math.min(50, Math.abs(dd)/maxd*50);
     return `<div class="al ${c}"><div class="lab"><span>${n} ${fmtP(v)}</span><span class="${cls(dd)}">${pct(dd)} uzakta</span></div><div class="track"><div class="cen"></div><div class="b" style="${dd>=0?`left:50%;width:${w}%`:`left:${50-w}%;width:${w}%`}"></div></div></div>`; }).join("")}</div>
   <div class="plan-foot">Kapat saati: ${tLocal(a.flat_by_ts)} ${TZL} · Fiyat Binance WebSocket ile her işlemde (saniyede birkaç kez) güncellenir.</div>`;
  lastPrice = price;
}
/* ---------------- realtime: Binance WebSocket (trade + kline_1m + ticker), REST 2s fallback ---------------- */
const WS_HOSTS = ["wss://stream.binance.com:9443", "wss://data-stream.binance.vision"];
const LIVE = { on: false, sym: null, ws: null, hostI: +(sessionStorage.getItem("neon.wsh") || 0), retry: 0, timer: null, poll: null, pending: false, lastPaint: 0, paintT: null,
  price: null, prev: null, chg: null, hi: null, lo: null, tt: 0, k1: null, mode: "off", ticks: 0 };
window.LIVE = LIVE;
function setInd(mode){ LIVE.mode = mode; const el = $("#live-ind"); if (!el) return;
  el.className = "live-ind " + mode; el.textContent = mode === "ws" ? "● CANLI" : mode === "rest" ? "● CANLI (REST 2sn)" : mode === "conn" ? "○ BAĞLANIYOR" : "○ KAPALI"; }
function setLive(on){ $("#live").checked = on; if (on && CUR) liveStart(CUR.symbol); else liveStop(); }
$("#live").addEventListener("change", e => setLive(e.target.checked));
function liveStop(){ LIVE.on = false; LIVE.sym = null; clearTimeout(LIVE.timer); stopPoll(); const w = LIVE.ws; LIVE.ws = null; if (w) try { w.close(); } catch(e){} setInd("off"); }
function liveStart(sym){ liveStop(); LIVE.on = true; LIVE.sym = sym; LIVE.retry = 0; LIVE.prev = null; LIVE.price = null; liveConnect(); }
function liveConnect(){
  if (!LIVE.on) return; const sym = LIVE.sym, s = sym.toLowerCase(), url = WS_HOSTS[LIVE.hostI % WS_HOSTS.length] + `/stream?streams=${s}@trade/${s}@kline_1m/${s}@ticker`;
  setInd(LIVE.mode === "rest" ? "rest" : "conn");
  let ws; try { ws = new WebSocket(url); } catch(e){ return wsDown(null, false); }
  LIVE.ws = ws; let opened = false; const ot = setTimeout(() => { if (!opened) try { ws.close(); } catch(e){} }, 7000);
  ws.onopen = () => { opened = true; clearTimeout(ot); };
  ws.onmessage = ev => { if (LIVE.ws !== ws || LIVE.sym !== sym) return; let m; try { m = JSON.parse(ev.data); } catch(e){ return; } const d = m.data || m;
    if (!opened || LIVE.mode !== "ws"){ LIVE.retry = 0; stopPoll(); setInd("ws"); try { sessionStorage.setItem("neon.wsh", LIVE.hostI % WS_HOSTS.length); } catch(e){} }
    if (d.e === "trade"){ tick(+d.p, d.T); }
    else if (d.e === "24hrTicker"){ LIVE.chg = +d.P; LIVE.hi = +d.h; LIVE.lo = +d.l; if (LIVE.price === null) tick(+d.c, d.E); else schedule(); }
    else if (d.e === "kline"){ LIVE.k1 = d.k; } };
  ws.onerror = () => {};
  ws.onclose = () => { clearTimeout(ot); if (LIVE.ws !== ws) return; wsDown(ws, opened); };
}
function wsDown(ws, opened){ LIVE.ws = null; if (!LIVE.on) return; if (!opened) LIVE.hostI++; LIVE.retry++;
  startPoll(); const delay = Math.min(30000, 1000*Math.pow(2, Math.min(LIVE.retry, 5)));
  clearTimeout(LIVE.timer); LIVE.timer = setTimeout(liveConnect, delay); }
function startPoll(){ if (LIVE.poll) return; setInd("rest"); const f = async () => { if (!LIVE.on || !LIVE.sym) return; const sym = LIVE.sym;
    try { const t = await ENGINE.ticker(sym); if (LIVE.sym !== sym || LIVE.mode === "ws") return; LIVE.chg = t.chg; LIVE.hi = t.high; LIVE.lo = t.low; tick(t.price, Date.now()); } catch(e){ setInd("rest"); } };
  f(); LIVE.poll = setInterval(f, 2000); }
function stopPoll(){ clearInterval(LIVE.poll); LIVE.poll = null; }
function tick(p, T){ if (!isFinite(p) || p <= 0) return; LIVE.price = p; LIVE.tt = T || Date.now(); LIVE.ticks++; applyBar(p, LIVE.tt); schedule(); }
function applyBar(p, T){ if (!CUR) return; for (const [key, step] of [["bars5m", 300], ["bars1h", 3600]]){ const raw = CUR[key]; if (!raw || !raw.length) continue;
    const bt = Math.floor(T/1000/step)*step, b = raw[raw.length-1];
    if (bt > b[0]) raw.push([bt, b[4], Math.max(b[4], p), Math.min(b[4], p), p]); else { b[2] = Math.max(b[2], p); b[3] = Math.min(b[3], p); b[4] = p; } } }
function schedule(){ if (LIVE.pending) return; LIVE.pending = true; const wait = Math.max(0, 125 - (performance.now() - LIVE.lastPaint));
  LIVE.paintT = setTimeout(() => requestAnimationFrame(paint), wait); }
function flash(el, up){ if (!el) return; el.classList.remove("flash-up", "flash-dn"); void el.offsetWidth; el.classList.add(up ? "flash-up" : "flash-dn"); }
function paint(){ LIVE.pending = false; LIVE.lastPaint = performance.now(); if (!CUR || LIVE.price === null) return;
  const p = LIVE.price, prev = LIVE.prev; LIVE.prev = p;
  const hp = $("#h-price"); hp.textContent = fmtP(p); if (prev !== null && p !== prev) flash(hp, p > prev);
  if (LIVE.chg !== null){ const hc = $("#h-chg"); hc.textContent = pct(LIVE.chg) + " 24s"; hc.className = "chg " + cls(LIVE.chg); }
  const hu = $("#h-upd"); if (hu) hu.textContent = "son güncelleme " + new Date(LIVE.tt).toLocaleTimeString("tr-TR",{timeZone:TZ}) + " " + TZL;
  if (cseries){ const raw = chartTF === "1h" ? CUR.bars1h : CUR.bars5m; const b = raw[raw.length-1]; const off = tzOffset(b[0]);
    try { cseries.update({ time: b[0]+off, open: b[1], high: b[2], low: b[3], close: b[4] }); } catch(e){} }
  if (CUR.data.alerts) try { renderAlerts(p, false); } catch(e){}
  const sn = $("#sig-now"); if (sn && CUR.data.signal){ const a = CUR.data.signal.active; sn.innerHTML = `şimdi <b>${fmtP(p)}</b> · girişe ${pct((a.entry/p-1)*100)}`; }
  window.TRADE && TRADE.onTick && TRADE.onTick(p);
}
async function pollPrice(){ if (CUR && !LIVE.on) setLive(true); }
/* analyst */
function renderAnalyst(a){
  const circ = num(a.circulating_supply), mx = num(a.max_supply) || num(a.total_supply); const sp = circ && mx ? Math.min(100, circ/mx*100) : null;
  const athPos = num(a.ath_change_percentage) === null ? 0 : Math.max(0, Math.min(100, 100 + a.ath_change_percentage));
  const ch = k => a["price_change_percentage_" + k + "_in_currency"];
  $("#analyst-box").innerHTML = `<div class="an-top">${a.image ? `<img src="${esc(a.image)}" alt="" onerror="this.remove()">` : ""}<div><b style="font-size:16px;color:#fff">${esc(a.name)}</b><br><small>${esc((a.symbol||"").toUpperCase())} · coingecko/${esc(a.id)}</small></div><span class="rank">#${a.market_cap_rank ?? "—"}</span></div>
  <div class="kv"><span class="k">Piyasa değeri</span><span class="v" id="an-mc">—</span><span class="k">FDV</span><span class="v">${fmtBig(a.fully_diluted_valuation)}</span>
  <span class="k">24s hacim</span><span class="v">${fmtBig(a.total_volume)} <small>(${a.market_cap ? (a.total_volume/a.market_cap*100).toFixed(1) : "—"}%)</small></span></div>
  <div class="supply"><div class="lab kv"><span class="k">Arz ${sp===null?"":"(%"+sp.toFixed(1)+")"}</span><span class="v">${fmtN(circ)} / ${mx ? fmtN(mx) : "∞"}</span></div><div class="bar"><div data-w="${sp ?? 0}"></div></div></div>
  <div class="kv"><span class="k">ATH ${a.ath_date ? "(" + a.ath_date.slice(0,10) + ")" : ""}</span><span class="v">${fmtP(a.ath)} <span class="${cls(a.ath_change_percentage)}">${pct(a.ath_change_percentage,1)}</span></span></div>
  <div class="athbar"><div class="mk" data-l="${athPos}"></div><span style="left:0">ATL ${fmtP(a.atl)}</span><span style="right:0">ATH</span></div>
  <div class="chgs">${[["24s","24h"],["7g","7d"],["30g","30d"],["1y","1y"]].map(([l,k]) => `<div><small>${l}</small><span class="${cls(ch(k))}">${pct(ch(k),1)}</span></div>`).join("")}</div>`;
  countUp($("#an-mc"), a.market_cap, fmtBig);
  setTimeout(() => { const s = document.querySelector(".supply .bar div"); if (s) s.style.width = s.dataset.w + "%"; const m = document.querySelector(".athbar .mk"); if (m) m.style.left = `calc(${m.dataset.l}% - 2px)`; }, 200);
}
/* news */
function newsHTML(n){
  if (!n.items || !n.items.length) return `<div class="empty">Haber kaynağı yok: bu coin için son 30 günde başlık bulunamadı. (Tarayıcıdan anahtarsız erişilebilen tek kaynak Hacker News; Yahoo/CoinDesk CORS veya API anahtarı istiyor.)</div>`;
  return `<ul class="news">${n.items.map(i => `<li><span class="tm">${i.time ? tLocal(i.time) : "—"}</span><a href="${esc((i.link||"").split("?.tsrc")[0])}" target="_blank" rel="noopener">${esc(i.title)}</a>${(i.tags||[]).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</li>`).join("")}</ul>`;
}
/* congress */
function congressHTML(p){
  return `<div class="big-badge expired" style="font-size:15px;animation:none">YALNIZCA MASAÜSTÜ</div>
  <div class="empty" style="font-style:normal;color:#b9f7ff">ABD Kongre üyelerinin hisse işlemleri (STOCK Act, House Clerk PTR raporları) tarayıcıdan doğrudan okunamıyor: kaynak CORS izni vermiyor ve bu sürümün sunucusu yok.</div>
  <div class="chips">${["COIN","MSTR","IBIT","FBTC","GBTC","ETHA","MARA","RIOT","CLSK","HOOD"].map(t => `<span>${t}</span>`).join("")}</div>
  <div class="plan-foot">Masaüstü sürüm bu kripto ilişkili hisse/ETF'leri son 30 günün raporlarında tarar. STOCK Act coinlerin kendisini kapsamaz.</div>`;
}

/* settings */
function openSheet(){ const c = ENGINE.config(), f = $("#sheet-form"); for (const k of ["account_size","max_loss_per_trade","hold_hours"]) f.elements[k].value = c[k]; $("#sheet").classList.remove("hidden"); }
$("#gear").addEventListener("click", openSheet);
$("#sheet-cancel").addEventListener("click", () => $("#sheet").classList.add("hidden"));
$("#sheet-reset").addEventListener("click", () => { localStorage.removeItem("neon.cfg"); openSheet(); });
$("#sheet-form").addEventListener("submit", e => { e.preventDefault(); const f = e.target, c = ENGINE.config();
  for (const k of ["account_size","max_loss_per_trade","hold_hours"]){ const v = parseFloat(f.elements[k].value); if (isFinite(v) && v > 0) c[k] = v; }
  const s = {}; for (const k of ["account_size","max_loss_per_trade","hold_hours"]) s[k] = c[k]; ENGINE.saveConfig(s);
  $("#sheet").classList.add("hidden"); if (CUR) run(CUR.base); });

/* go */
(async () => { await boot(); mirror(); if (matchMedia("(pointer:fine)").matches) inp.focus(); const q = params.get("coin"); if (q) run(q); else startDemo(); })();

document.addEventListener("visibilitychange", () => { if (!document.hidden && $("#live").checked && CUR && !LIVE.ws){ clearTimeout(LIVE.timer); LIVE.retry = 0; liveConnect(); } });
