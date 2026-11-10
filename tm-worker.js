/* Time Machine worker: 10,000 bootstrap replays from the coin's own 5m bars (same UTC time-of-day ± window),
   plus the same UTC-day opening-range rule replayed on every past day. Fixed seed (42). */
"use strict";
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
onmessage = ev => {
  try {
    const { t, h, l, c, plan, entry_time, cfg } = ev.data, n = t.length;
    const e = plan.entry, s = plan.stop, tg = plan.target, R = e - s, H = Math.round(cfg.hold_hours*12), w = cfg.replay_window_bars;
    // per-bar log moves relative to the previous close, bucketed by UTC 5-min slot
    const buckets = Array.from({ length: 288 }, () => []);
    for (let i = 1; i < n; i++){ if (t[i] - t[i-1] !== 300 || c[i-1] <= 0) continue;
      buckets[Math.floor((t[i] % 86400)/300)].push([Math.log(c[i]/c[i-1]), Math.log(h[i]/c[i-1]), Math.log(l[i]/c[i-1])]); }
    const slot0 = Math.floor((Math.floor(entry_time) % 86400)/300), pools = [];
    for (let k = 0; k < H; k++){ const sl = (slot0 + 1 + k) % 288; let pool = [];
      for (let d = -w; d <= w; d++) pool = pool.concat(buckets[((sl + d) % 288 + 288) % 288]);
      if (!pool.length) throw new Error("bu saat dilimi için mum yok"); pools.push(pool); }
    const rnd = mulberry32(42), N = cfg.replays, cnt = { target: 0, stop: 0, neither: 0 }, rs = new Float64Array(N), closes = new Float64Array(N);
    for (let i = 0; i < N; i++){
      let px = e, res = null;
      for (let k = 0; k < H; k++){ const p = pools[k], m = p[Math.floor(rnd()*p.length)];
        if (px*Math.exp(m[2]) <= s){ res = "stop"; break; } if (px*Math.exp(m[1]) >= tg){ res = "target"; break; } px *= Math.exp(m[0]); }
      if (!res){ res = "neither"; rs[i] = (px - e)/R; closes[i] = px; } else { rs[i] = res === "target" ? (tg - e)/R : -1; closes[i] = res === "target" ? tg : s; }
      cnt[res]++; if (i % 1000 === 999) postMessage({ type: "progress", k: (i + 1)/N });
    }
    const sorted = Float64Array.from(closes).sort(), q = f => sorted[Math.floor(f*(N - 1))];
    let rmin = Infinity, rmax = -Infinity, sum = 0; for (const v of rs){ rmin = Math.min(rmin, v); rmax = Math.max(rmax, v); sum += v; }
    const nb = 40, wr = (rmax - rmin)/nb || 1, bins = new Array(nb).fill(0); for (const v of rs) bins[Math.min(nb - 1, Math.floor((v - rmin)/wr))]++;
    // history: same rule on every past UTC day
    const hist = { target: 0, stop: 0, neither: 0 }, hr = [], rmult = (tg - e)/R, days = new Set();
    for (let i = 0; i < n; i++) days.add(Math.floor(t[i]/86400)*86400);
    const dayList = [...days].sort((a, b) => a - b).slice(0, -1), nbar = Math.max(1, Math.floor(cfg.or_minutes/5));
    let i0 = 0;
    for (const d0 of dayList){
      while (i0 < n && t[i0] < d0) i0++;
      let j = i0, hi = -Infinity, lo = Infinity, cntb = 0;
      while (j < n && t[j] < d0 + cfg.or_minutes*60){ hi = Math.max(hi, h[j]); lo = Math.min(lo, l[j]); cntb++; j++; }
      if (cntb < nbar) continue;
      let k = j; while (k < n && t[k] < d0 + 86400 && !(c[k] > hi)) k++;
      if (k >= n || t[k] >= d0 + 86400) continue;
      const en = c[k], mid = (hi + lo)/2, dist = (en - mid)/en*100;
      const st = (cfg.stop_rule === "or-mid" && dist >= cfg.min_stop_pct && dist <= cfg.max_stop_pct) ? mid : en*(1 - cfg.fallback_stop_pct/100);
      const tt = en + rmult*(en - st); let res = null, last = null;
      for (let m = k + 1; m < Math.min(n, k + 1 + H); m++){ if (l[m] <= st){ res = "stop"; break; } if (h[m] >= tt){ res = "target"; break; } last = c[m]; }
      if (!res){ if (last === null) continue; res = "neither"; }
      hist[res]++; hr.push(res === "target" ? rmult : res === "stop" ? -1 : (last - en)/(en - st));
    }
    const hn = hr.length;
    postMessage({ type: "done", result: { n: N, target: cnt.target*100/N, stop: cnt.stop*100/N, neither: cnt.neither*100/N, avg_r: sum/N,
      p10: q(.1), p50: q(.5), p90: q(.9), bins, r_min: rmin, r_max: rmax, hold_hours: cfg.hold_hours,
      history: Object.assign(hist, { days: dayList.length, avg_r: hn ? hr.reduce((a, b) => a + b, 0)/hn : null }) } });
  } catch(err){ postMessage({ type: "error", error: err.message }); }
};
