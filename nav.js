/* NEON//TERMINAL v6 — page tabs: ⚡ MEME (home) · 🤖 GROK · 📈 VADELİ (Binance futures analysis + İŞLEM) · ◈ CÜZDAN (bot wallet, Binance OTO, journal). */
"use strict";
const NAV = (() => {
const PG = { meme: "meme", grok: "grok", fut: "vadeli", wal: "cuzdan" }, BY = Object.fromEntries(Object.entries(PG).map(([k, v]) => [v, k]));
function go(p, push = true){ if (!PG[p]) p = "meme"; document.body.dataset.pg = p; document.querySelectorAll("#nav button").forEach(b => { b.classList.toggle("on", b.dataset.go === p); b.setAttribute("aria-selected", b.dataset.go === p); });
  if (push) history.replaceState(null, "", location.pathname + location.search + "#" + PG[p]);
  requestAnimationFrame(() => { window.dispatchEvent(new Event("resize")); if (p === "meme" && window.MEME) MEME.paint(true); if (p === "grok"){ const m = document.getElementById("gk-msgs"); if (m) m.scrollTop = m.scrollHeight; } });
  window.scrollTo({ top: 0 }); }
document.querySelectorAll("#nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
const h = location.hash.slice(1), qs = new URLSearchParams(location.search);
go(BY[h] || (h === "pump" ? "meme" : null) || (qs.get("coin") ? "fut" : "meme"), false);
window.addEventListener("hashchange", () => { const k = BY[location.hash.slice(1)]; if (k) go(k, false); });
return { go };
})();
window.NAV = NAV;
