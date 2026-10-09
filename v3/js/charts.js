// Breezy HEMS V3 — graphiques SVG. Une seule infobulle partagée, navigable au clavier.
// Toutes les couleurs viennent des variables CSS de données (--solar, --battery…).
(() => {
  const BZ = window.BZ;
  const { h, esc, fmt, icon } = BZ;
  const REG = new Map();          // id -> description du graphique (pour l'infobulle)
  let uid = 0;
  const nid = (p) => `${p}${++uid}`;

  // Courbe lissée (Catmull-Rom -> Bézier), sans dépassement sous zéro
  function smooth(pts) {
    if (pts.length < 2) return "";
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d;
  }
  const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };

  /* ─── Mini-courbe ─────────────────────────────────────────────────── */
  const spark = (data, tone = "solar", { w = 120, h: hh = 36, area = true } = {}) => {
    // Valeurs inconnues (NaN : historique en chargement) traitées comme des trous ; moins de 2 points : pas de courbe
    if (data.some((x) => x != null && !Number.isFinite(x))) data = data.map((x) => (Number.isFinite(x) ? x : null));
    if (data.filter((x) => x != null).length < 2) return "";
    const v = data.filter((x) => x != null), max = Math.max(...v, 0.0001), min = Math.min(...v, 0);
    const pts = data.map((x, i) => (x == null ? null : [(i / (data.length - 1)) * w, hh - 2 - ((x - min) / (max - min || 1)) * (hh - 6)])).filter(Boolean);
    const d = smooth(pts);
    return h`<svg class="spark" data-tone="${tone}" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" aria-hidden="true">
      ${area ? h`<path class="spark-a" d="${d} L${pts[pts.length - 1][0]},${hh} L${pts[0][0]},${hh} Z"/>` : ""}<path class="spark-l" d="${d}"/></svg>`;
  };

  /* ─── Barres (empilables) ─────────────────────────────────────────────
     series: [{ key, label, tone, values[] }]  · buckets: [{ key, current, forecast }] */
  function bars({ buckets, series, unit = "kWh", dec = 1, height = 200, avg = true, label, labelEvery = 1, footer }) {
    const id = nid("c"), W = 600, H = height, PB = 22, PT = 14;
    const totals = buckets.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
    const max = niceMax(Math.max(...totals) * 1.05), n = buckets.length, slot = W / n, bw = Math.max(3, Math.min(34, slot * 0.62));
    const y = (v) => PT + (1 - v / max) * (H - PT - PB);
    const real = totals.filter((_, i) => !buckets[i].forecast), mean = real.reduce((a, b) => a + b, 0) / (real.length || 1);
    const grid = [0, 0.5, 1].map((k) => h`<line class="gl" x1="0" x2="${W}" y1="${y(max * k)}" y2="${y(max * k)}"/>`);
    const cols = buckets.map((b, i) => {
      let base = 0;
      const x = slot * i + (slot - bw) / 2;
      const segs = series.map((s) => { const v = s.values[i] || 0; if (v <= 0) return ""; const y1 = y(base + v), y0 = y(base); base += v; return h`<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1 - (base < totals[i] ? 1.5 : 0))}" rx="${Math.min(4, bw / 3)}" data-tone="${s.tone}"/>`; });
      return h`<g class="bar ${b.current ? "is-cur" : ""} ${b.forecast ? "is-fc" : ""}">${segs}</g>`;
    });
    const labels = buckets.map((b, i) => (i % labelEvery === 0 || b.current ? h`<span class="ax ${b.current ? "is-cur" : ""}" style="--x:${((slot * i + slot / 2) / W) * 100}%">${esc(b.key)}</span>` : ""));
    REG.set(id, { type: "bars", n, slot, W, buckets, series, unit, dec, totals });
    return h`<figure class="chart" data-chart="${id}" tabindex="0" aria-label="${esc(label)}. Flèches gauche et droite pour parcourir.">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${avg && real.length > 1 ? h`<line class="avg" x1="0" x2="${W}" y1="${y(mean)}" y2="${y(mean)}"/>` : ""}${cols}<rect class="hl" x="0" y="${PT}" width="${slot}" height="${H - PT - PB}"/></svg>
      <div class="axis" aria-hidden="true">${labels}</div>
      ${avg && real.length > 1 ? h`<span class="avg-l" style="--y:${(y(mean) / H) * 100}%">moy. ${fmt.n(mean, dec)}</span>` : ""}
      ${footer || ""}</figure>`;
  }

  /* ─── Aires / courbes superposées ─────────────────────────────────── */
  function lines({ labels, series, unit = "kWh", dec = 1, height = 200, label, labelEvery = 1, band, now }) {
    const id = nid("c"), W = 600, H = height, PB = band ? 30 : 22, PT = 12, n = labels.length;
    const all = series.flatMap((s) => s.values.filter((v) => v != null)), max = niceMax(Math.max(...all, 0.1) * 1.08);
    const x = (i) => (i / (n - 1)) * W, y = (v) => PT + (1 - v / max) * (H - PT - PB);
    const grid = [0, 0.5, 1].map((k) => h`<line class="gl" x1="0" x2="${W}" y1="${y(max * k)}" y2="${y(max * k)}"/>`);
    const paths = series.map((s) => {
      const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
      if (pts.length < 2) return "";
      const d = smooth(pts);
      return h`<g data-tone="${s.tone}" class="${s.dashed ? "is-dashed" : ""}">${s.area ? h`<path class="ln-a" d="${d} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z"/>` : ""}<path class="ln" d="${d}"/></g>`;
    });
    // Bande des tarifs sous l'axe (heures pleines / creuses / super creuses)
    const bandSvg = band ? band.map((k, i) => h`<rect class="band" data-tariff="${k}" x="${x(i) - (i === 0 ? 0 : W / (n - 1) / 2)}" y="${H - PB + 6}" width="${W / (n - 1)}" height="4"/>`) : "";
    const lab = labels.map((l, i) => (i % labelEvery === 0 ? h`<span class="ax ${i === 0 ? "is-start" : i === n - 1 ? "is-end" : ""}" style="--x:${(x(i) / W) * 100}%">${esc(l)}</span>` : ""));
    REG.set(id, { type: "lines", n, W, labels, series, unit, dec, x });
    return h`<figure class="chart" data-chart="${id}" tabindex="0" aria-label="${esc(label)}. Flèches gauche et droite pour parcourir.">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${paths}${now != null ? h`<line class="now" x1="${x(now)}" x2="${x(now)}" y1="${PT}" y2="${H - PB}"/>` : ""}${bandSvg}
        <line class="cross" y1="${PT}" y2="${H - PB}"/></svg>
      <div class="axis" aria-hidden="true">${lab}</div></figure>`;
  }

  /* ─── Infobulle partagée (souris, toucher et clavier) ─────────────── */
  const tip = () => document.getElementById("tip");
  function showTip(fig, i) {
    const c = REG.get(fig.dataset.chart);
    if (!c) return;
    i = BZ.clamp(i, 0, c.n - 1);
    fig.dataset.i = i;
    const svg = fig.querySelector("svg"), r = svg.getBoundingClientRect();
    let xPx, rows, title;
    if (c.type === "bars") {
      xPx = r.left + ((c.slot * i + c.slot / 2) / c.W) * r.width;
      const hl = svg.querySelector(".hl"); hl.setAttribute("x", c.slot * i); hl.classList.add("is-on");
      const b = c.buckets[i];
      title = b.tipTitle || b.key;
      rows = b.forecast ? [["Prévu", fmt.n(c.series.reduce((a, s) => a + (s.values[i] || 0), 0), c.dec), "neutral"]]
        : c.series.map((s) => [s.label, fmt.n(s.values[i] || 0, c.dec), s.tone]);
      if (!b.forecast && c.series.length > 1) rows.push(["Total", fmt.n(c.totals[i], c.dec), null]);
    } else {
      xPx = r.left + (c.x(i) / c.W) * r.width;
      const cr = svg.querySelector(".cross"); cr.setAttribute("x1", c.x(i)); cr.setAttribute("x2", c.x(i)); cr.classList.add("is-on");
      title = c.labels[i];
      rows = c.series.filter((s) => s.values[i] != null).map((s) => [s.label, fmt.n(s.values[i], c.dec), s.tone]);
      c.series.forEach((s) => s.detail && s.values[i] != null && s.detail(i).forEach(([l, v]) => rows.push([l, fmt.n(v, c.dec), "sub"])));
    }
    const t = tip();
    t.innerHTML = h`<strong>${esc(title)}</strong>${rows.map(([l, v, tone]) => h`<div class="tip-r ${tone === "sub" ? "is-sub" : ""}">${tone && tone !== "sub" ? h`<i data-tone="${tone}"></i>` : ""}<span>${l}</span><b>${v}${tone === "sub" ? "" : ` ${c.unit}`}</b></div>`)}`;
    t.classList.add("is-on");
    const tw = t.offsetWidth, th = t.offsetHeight;
    const left = BZ.clamp(xPx - tw / 2, 8, innerWidth - tw - 8), top = Math.max(8, r.top - th - 10);
    t.style.transform = `translate(${left}px, ${top < 8 ? r.bottom + 10 : top}px)`;
  }
  function hideTip(fig) {
    tip().classList.remove("is-on");
    if (fig) fig.querySelectorAll(".hl, .cross").forEach((e) => e.classList.remove("is-on"));
  }
  let active = null;
  document.addEventListener("pointermove", (e) => {
    const fig = e.target.closest && e.target.closest(".chart");
    if (active && active !== fig) { hideTip(active); active = null; }
    if (!fig) return;
    const c = REG.get(fig.dataset.chart); if (!c) return;
    const r = fig.querySelector("svg").getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * c.W;
    const i = c.type === "bars" ? Math.floor(px / c.slot) : Math.round((px / c.W) * (c.n - 1));
    active = fig; showTip(fig, i);
  }, { passive: true });
  document.addEventListener("pointerleave", () => active && hideTip(active));
  document.addEventListener("scroll", () => active && (hideTip(active), (active = null)), { passive: true, capture: true });
  document.addEventListener("keydown", (e) => {
    const fig = document.activeElement && document.activeElement.closest && document.activeElement.closest(".chart");
    if (!fig || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const c = REG.get(fig.dataset.chart), cur = fig.dataset.i != null ? +fig.dataset.i : c.n - 1;
    e.preventDefault();
    showTip(fig, e.key === "Home" ? 0 : e.key === "End" ? c.n - 1 : cur + (e.key === "ArrowLeft" ? -1 : 1));
  });
  document.addEventListener("focusout", (e) => e.target.classList && e.target.classList.contains("chart") && hideTip(e.target));

  /* ─── Barre empilée 100 % (répartition) ───────────────────────────── */
  const split = (parts, { label } = {}) => {
    const t = parts.reduce((a, p) => a + p.v, 0) || 1;
    return h`<div class="split" role="img" aria-label="${esc(label || parts.map((p) => `${p.label} ${Number.isFinite(p.v) ? Math.round((p.v / t) * 100) : "—"} %`).join(", "))}">
      ${parts.filter((p) => p.v > 0).map((p) => h`<span data-tone="${p.tone}" style="--w:${(p.v / t) * 100}%" title="${esc(p.label)}"></span>`)}</div>`;
  };

  Object.assign(BZ, { spark, bars, lines, split, smooth, niceMax, resetCharts: () => REG.clear() });
})();
