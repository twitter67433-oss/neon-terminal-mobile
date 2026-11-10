/* NEON//TERMINAL 2100 — "veri yolu": glowing light particles travel between nodes and pulse on real events.
   Canvas + requestAnimationFrame, additive blending, DPR ≤ 2, ≤ 180 particles, paused when hidden/offscreen,
   prefers-reduced-motion → static diagram with node flashes only. API: BUS.emit(kind, opts). */
"use strict";
const BUS = (() => {
const cv = document.getElementById("bus"); if (!cv) return { emit(){}, stat(){} };
const ctx = cv.getContext("2d");
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const C = { c: "#00f0ff", m: "#ff2bd6", g: "#39ff14", y: "#ffe600", r: "#ff3355", v: "#9d7bff", o: "#ff9f1c", w: "#e8fbff" };
// node layout in unit coords (mobile-first); label, color, sub-label key
const N = {
  bn: { x: .08, y: .26, l: "BINANCE", c: C.y, s: "PERP WS" },
  pf: { x: .08, y: .80, l: "PUMP.FUN", c: C.o, s: "yeni token" },
  mo: { x: .32, y: .54, l: "MOTOR", c: C.v, s: "tarayıcı" },
  sg: { x: .55, y: .16, l: "SİNYAL", c: C.g, s: "11 beceri" },
  rk: { x: .90, y: .22, l: "RİSK", c: C.c, s: "limitler" },
  em: { x: .58, y: .62, l: "EMİR", c: C.m, s: "ONAYLA" },
  ph: { x: .91, y: .58, l: "PHANTOM", c: "#ab9ff2", s: "Solana" },
  bt: { x: .78, y: .88, l: "BOT", c: C.g, s: "cüzdan" } };
const E = [["bn","mo"],["pf","mo"],["mo","sg"],["sg","rk"],["rk","em"],["em","bn"],["em","ph"],["em","bt"],["ph","bt"],["bt","pf"],["ph","pf"]];
const EI = {}; E.forEach((e, i) => EI[e[0] + ">" + e[1]] = i);
let W = 0, H = 0, dpr = 1, P = [], vis = true, raf = 0, last = 0, geo = [], t0 = performance.now();
const stats = { bn: 0, pf: 0, mo: 0, sg: 0, rk: 0, em: 0, ph: 0, bt: 0 }, rate = { bn: 0, pf: 0 }, cnt = { bn: 0, pf: 0 }, glow = {}, state = {};
for (const k in N) glow[k] = 0;
function resize(){ const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, r.width); H = Math.max(1, r.height);
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); build(); if (RM.matches || !raf) draw(performance.now()); }
const pos = k => ({ x: 26 + N[k].x*(W - 52), y: 32 + N[k].y*(H - 70) });
function build(){ geo = E.map(([a, b], i) => { const A = pos(a), B = pos(b); let cx = (A.x + B.x)/2, cy = (A.y + B.y)/2;
    // gentle curves; the return path (em→bn) and ph→pf sweep along the bottom
    if (a === "em" && b === "bn"){ cy = H*.05; cx = W*.22; } else if (a === "ph" && b === "pf"){ cy = H*1.18; cx = W*.45; } else if (a === "bt" && b === "pf"){ cy = H*1.04; cx = W*.42; } else { const dx = B.x - A.x, dy = B.y - A.y; cx -= dy*.18; cy += dx*.18; }
    const pts = []; for (let k = 0; k <= 40; k++){ const t = k/40, u = 1 - t; pts.push([u*u*A.x + 2*u*t*cx + t*t*B.x, u*u*A.y + 2*u*t*cy + t*t*B.y]); }
    return { a, b, pts }; }); }
function at(g, t){ const f = Math.max(0, Math.min(1, t))*40, i = Math.floor(f), k = f - i, p = g.pts[i], q = g.pts[Math.min(40, i + 1)]; return [p[0] + (q[0] - p[0])*k, p[1] + (q[1] - p[1])*k]; }
function spawn(a, b, col, o = {}){ const i = EI[a + ">" + b]; if (i === undefined) return; if (P.length > 180) P.shift();
  P.push({ g: i, t: 0, v: (o.v || 1)*(0.55 + Math.random()*.35), c: col || N[a].c, s: o.s || (1.6 + Math.random()*1.4), next: o.next || null, tail: [] });
  if (RM.matches){ glow[b] = 1; requestDraw(); } }
const chain = (path, col, o) => { const [a, b, ...rest] = path; spawn(a, b, col, Object.assign({}, o, { next: rest.length ? [b, ...rest] : null })); };
let lastTick = 0;
function emit(kind, o = {}){
  const now = performance.now();
  switch (kind){
    case "tick": cnt.bn++; if (now - lastTick < 70) return; lastTick = now; glow.bn = Math.min(1, glow.bn + .35); spawn("bn", "mo", o.up === false ? C.r : o.up ? C.g : C.y, { v: 1.4, s: 1.4 }); break;
    case "ntick": glow.mo = Math.min(1, glow.mo + .25); if (now - lastTick < 90) return; lastTick = now; spawn("bn", "mo", C.v, { v: 1.3, s: 1.3 }); break;
    case "signal": { const col = o.dir === "LONG" ? C.g : o.dir === "SHORT" ? C.r : C.y; stats.sg++; glow.mo = 1; for (let k = 0; k < 5; k++) setTimeout(() => chain(["mo","sg","rk"], col, { v: 1.1, s: 2.4 }), k*90); break; }
    case "proposal": stats.rk++; for (let k = 0; k < 4; k++) setTimeout(() => chain(["sg","rk","em"], C.c, { s: 2.6 }), k*110); break;
    case "order": { stats.em++; glow.em = 1; const path = o.to === "pf" ? (o.from === "bt" ? ["em","bt","pf"] : ["em","ph","pf"]) : o.to === "ph" ? ["em","ph"] : o.to === "bt" ? ["em","bt"] : ["em","bn"];
      for (let k = 0; k < 8; k++) setTimeout(() => chain(path, C.m, { v: 1.2, s: 2.8 }), k*70); break; }
    case "bot": glow.bt = 1; spawn("em", "bt", C.g, { s: 2.2 }); break;
    case "fund": glow.ph = 1; for (let k = 0; k < 6; k++) setTimeout(() => spawn("ph", "bt", "#ab9ff2", { s: 2.6 }), k*90); break;
    case "liq": glow.bn = 1; for (let k = 0; k < 3; k++) setTimeout(() => spawn("bn", "mo", o.side === "SELL" ? C.r : C.g, { s: 3.2, v: 1.6 }), k*60); break;
    case "depth": glow.bn = Math.min(1, glow.bn + .2); break;
    case "pump": cnt.pf++; glow.pf = Math.min(1, glow.pf + .6); spawn("pf", "mo", C.o, { s: 2 }); break;
    case "phantom": glow.ph = 1; spawn("em", "ph", "#ab9ff2", { s: 2.4 }); break;
    case "state": state[o.node] = o.on; requestDraw(); return;
  }
  if (!raf && !RM.matches) loop();
}
setInterval(() => { rate.bn = cnt.bn; rate.pf = cnt.pf; cnt.bn = 0; cnt.pf = 0; if (RM.matches) requestDraw(); }, 1000);
let drawQ = false; function requestDraw(){ if (drawQ) return; drawQ = true; requestAnimationFrame(t => { drawQ = false; draw(t); }); }
function loop(){ raf = requestAnimationFrame(frame); }
function frame(t){ raf = 0; if (!vis || document.hidden) return; const dt = Math.min(50, t - (last || t)); last = t;
  for (const p of P){ p.tail.push(at(geo[p.g], p.t)); if (p.tail.length > 9) p.tail.shift(); p.t += dt/1000*p.v*0.9; }
  const arrived = P.filter(p => p.t >= 1); P = P.filter(p => p.t < 1);
  for (const p of arrived){ const b = geo[p.g].b; glow[b] = Math.min(1, (glow[b] || 0) + .5); if (p.next){ chain(p.next, p.c, { s: p.s, v: p.v/0.75 }); } }
  for (const k in glow) glow[k] *= Math.pow(0.12, dt/1000);
  draw(t);
  // keep animating: particles alive, or ambient idle shimmer (cheap) while visible
  loop();
}
function draw(t){
  if (!W) return; const T = (t - t0)/1000; ctx.clearRect(0, 0, W, H);
  // grid floor
  ctx.globalCompositeOperation = "source-over"; ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,240,255,.06)";
  const gs = 22, off = RM.matches ? 0 : (T*8) % gs; ctx.beginPath();
  for (let x = -off; x < W; x += gs){ ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = off; y < H; y += gs){ ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke();
  // paths
  for (const g of geo){ ctx.beginPath(); g.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = "rgba(120,200,255,.16)"; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.setLineDash([3, 9]); ctx.lineDashOffset = RM.matches ? 0 : -T*24; ctx.strokeStyle = "rgba(0,240,255,.28)"; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
  // particles (additive)
  ctx.globalCompositeOperation = "lighter";
  for (const p of P){ const [x, y] = at(geo[p.g], p.t);
    if (p.tail.length > 1){ ctx.beginPath(); p.tail.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.lineTo(x, y); ctx.strokeStyle = p.c; ctx.globalAlpha = .45; ctx.lineWidth = p.s; ctx.stroke(); ctx.globalAlpha = 1; }
    const r = p.s*3.2, gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "#ffffff"); gr.addColorStop(.25, p.c); gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
  // nodes
  for (const k in N){ const n = N[k], { x, y } = pos(k), gl = glow[k] || 0, on = k === "bt" ? !!(window.WALLET && WALLET.unlocked()) : state[k] !== false, R = 13 + gl*3;
    const halo = ctx.createRadialGradient(x, y, 2, x, y, R*2.6); halo.addColorStop(0, hexA(n.c, .35 + gl*.5)); halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, R*2.6, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(4,10,18,.92)"; hex(x, y, R); ctx.fill();
    ctx.strokeStyle = on ? n.c : "rgba(140,160,170,.5)"; ctx.lineWidth = 1.6 + gl*1.4; hex(x, y, R); ctx.stroke();
    if (!RM.matches){ ctx.save(); ctx.translate(x, y); ctx.rotate(T*(k === "mo" ? 1.1 : .5)); ctx.strokeStyle = hexA(n.c, .55); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, R + 5, 0, 1.4); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, R + 5, 3.14, 4.4); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = on ? "#e8fbff" : "#6b8794"; ctx.font = "600 9px Orbitron, 'Share Tech Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(n.l, x, y + R + 13);
    const sub = k === "bn" ? (rate.bn ? rate.bn + " tick/sn" : n.s) : k === "pf" ? (rate.pf ? rate.pf + " token/sn" : n.s) : k === "bt" ? (window.WALLET && WALLET.exists() ? (WALLET.unlocked() ? (window.AUTO && AUTO.pumpOn() ? "OTO ●" : "açık") : "kilitli") : "yok") : n.s;
    ctx.fillStyle = hexA(n.c, .8); ctx.font = "9px 'Share Tech Mono', monospace"; ctx.fillText(sub, x, y + R + 24);
    ctx.fillStyle = n.c; ctx.beginPath(); ctx.arc(x, y, 3 + gl*2.5, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = "lighter"; }
  ctx.globalCompositeOperation = "source-over";
}
function hex(x, y, r){ ctx.beginPath(); for (let i = 0; i < 6; i++){ const a = Math.PI/6 + i*Math.PI/3; const px = x + r*Math.cos(a), py = y + r*Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); }
function hexA(h, a){ const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a.toFixed(3)})`; }
new ResizeObserver(resize).observe(cv);
if ("IntersectionObserver" in window) new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && !raf && !RM.matches) loop(); }).observe(cv);
document.addEventListener("visibilitychange", () => { if (!document.hidden && !raf && !RM.matches) { last = 0; loop(); } });
RM.addEventListener && RM.addEventListener("change", () => { P = []; resize(); if (!RM.matches) loop(); });
resize(); if (!RM.matches) loop();
// ambient: a slow heartbeat so the bus is alive before any data arrives
setInterval(() => { if (!document.hidden && vis && !RM.matches && P.length < 3) chain(["mo","sg","rk","em"], "rgba(0,240,255,.8)", { s: 1.2, v: .7 }); }, 2600);
return { emit, get fps(){ return 0; }, _P: () => P.length };
})();
window.BUS = BUS;
