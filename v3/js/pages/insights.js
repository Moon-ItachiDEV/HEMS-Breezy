// Bilan (V3) : l'historique et la rentabilité. Une seule période pilote toute la page.
//  En-tête : période (Jour / 7 jours / Mois / Année) + export CSV de la période
//  Ligne 1 : 4 indicateurs (période vs période précédente, mini-courbe sur la période)
//  Gauche  : graphique principal, puis Comparaison (ce que les indicateurs ne disent pas) + Meilleurs moments
//  Droite  : D'où vient ta consommation (anneau + réseau par tarif), Rentabilité solaire
(() => {
  const BZ = window.BZ;
  const { h, esc, fmt, icon, val, card, pill, kpi, pills, donut, delta, meter } = BZ;

  /* ─── Libellés et petits calculs ─────────────────────────────────── */
  const year = () => new Date().getFullYear();
  const LBL = {
    jour: () => ({ cur: "Aujourd'hui", prev: "Hier", vs: "vs hier", unit: "heure", per: "par heure" }),
    semaine: () => ({ cur: "7 jours", prev: "7 j avant", vs: "vs 7 j avant", unit: "jour", per: "par jour" }),
    mois: () => { const m = new Date().getMonth(); return { cur: fmt.cap(BZ.MONTHS_LONG[m]), prev: fmt.cap(BZ.MONTHS_LONG[(m + 11) % 12]), vs: "vs mois dernier", unit: "jour", per: "par jour" }; },
    annee: () => ({ cur: String(year()), prev: String(year() - 1), vs: `vs ${year() - 1}`, unit: "mois", per: "par mois" }),
  };
  const aut = (x) => (x && x.cons ? BZ.clamp(1 - x.imp / x.cons, 0, 1) : 0);          // part de la conso sans réseau
  const selfUse = (x) => (x && x.prod ? BZ.clamp(1 - x.exp / x.prod, 0, 1) : 0);      // part de la production gardée
  const bill = (x) => ["hp", "hc", "hsc"].reduce((a, k) => a + (x[k] || 0) * BZ.TARIFS[k].price(), 0);
  const nameOf = (kind, b, i) => kind === "jour" ? `${b.h}h – ${b.h + 1}h`
    : kind === "annee" ? fmt.cap(BZ.MONTHS_LONG[i])
    : fmt.cap(fmt.date(b.date, { weekday: "long", day: "numeric", month: kind === "mois" ? "long" : "short" }));
  const tipName = (kind, b, i) => (kind === "annee" ? `${fmt.cap(BZ.MONTHS_LONG[i])} ${year()}` : kind === "mois" && b.forecast ? fmt.cap(fmt.date(new Date(year(), new Date().getMonth(), +b.key), { weekday: "long", day: "numeric", month: "long" })) : nameOf(kind, b, i));
  const pc = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
  const UP = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  const DL = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11.5M7 10.5l5 5 5-5M4.5 20h15"/></svg>';

  // Courbe monotone : passe par chaque mesure sans « boucler » au-dessus ou en dessous (Fritsch–Carlson)
  function mono(pts) {
    const n = pts.length;
    if (n < 2) return "";
    const dx = [], m = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
    t[n - 1] = m[n - 2];
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < n - 1; i++) { const k = dx[i] / 3; d += ` C${pts[i][0] + k},${pts[i][1] + t[i] * k} ${pts[i + 1][0] - k},${pts[i + 1][1] - t[i + 1] * k} ${pts[i + 1][0]},${pts[i + 1][1]}`; }
    return d;
  }

  /* ─── Graphiques de la page (une infobulle partagée : #tip) ──────────
     « bars »  : production empilée (maison / batterie / revendue), prévision hachurée, courbe de consommation.
     « lines » : journée heure par heure, production + prévision + consommation, bande des tarifs. */
  const SER = [["self", "Utilisée à la maison", "solar"], ["chg", "Stockée en batterie", "battery"], ["exp", "Revendue", "grid"]];
  const REG = new Map();
  const W = 600, H = 300;
  let seq = 0;
  const gridLines = (max, y) => [0.25, 0.5, 0.75, 1].map((k) => h`<line class="gl" x1="0" x2="${W}" y1="${y(max * k)}" y2="${y(max * k)}"/>`);
  const yTicks = (max, y) => [0.5, 1].map((k) => h`<span class="bi-yl" style="--y:${pc(y(max * k), H)}">${fmt.n(max * k, max < 2 ? 1 : 0)}${k === 1 ? " kWh" : ""}</span>`);
  const shell = (id, label, svg, over, axis, band = "") => h`<figure class="bi-chart" data-bi="${id}" tabindex="0" aria-label="${esc(label)}. Flèches gauche et droite pour parcourir.">
      <div class="bi-plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${over}
        <span class="bi-dot bi-cur is-p"></span><span class="bi-dot bi-cur is-c"></span></div>
      ${band}<div class="bi-ax" aria-hidden="true">${axis}</div></figure>`;

  function combo({ kind, buckets, label, every = 1 }) {
    const id = `bi${++seq}`, n = buckets.length, slot = W / n;
    const bw = Math.max(4, Math.min(28, slot * (n > 20 ? 0.62 : 0.46)));
    const tot = buckets.map((b) => (b.forecast ? b.prod || 0 : SER.reduce((a, [k]) => a + (b[k] || 0), 0)));
    const cons = buckets.map((b) => (b.forecast || b.cons == null ? null : b.cons));
    const max = BZ.niceMax(Math.max(...tot, ...cons.filter((v) => v != null), 0.1) * 1.06);
    const y = (v) => 4 + (1 - v / max) * (H - 4), cx = (i) => slot * i + slot / 2;
    const cols = buckets.map((b, i) => {
      const x = cx(i) - bw / 2, r = Math.min(4, bw / 3);
      if (b.forecast) return h`<g class="bar is-fc"><rect x="${x}" y="${y(tot[i])}" width="${bw}" height="${Math.max(0, H - y(tot[i]))}" rx="${r}"/></g>`;
      let base = 0;
      const segs = SER.map(([k, , tone]) => {
        const v = b[k] || 0; if (v <= 0) return "";
        const y1 = y(base + v), y0 = y(base); base += v;
        return h`<rect data-tone="${tone}" x="${x}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1 - (base < tot[i] - 1e-6 ? 1.5 : 0))}" rx="${r}"/>`;
      });
      return h`<g class="bar ${b.current ? "is-cur" : ""}">${segs}</g>`;
    });
    const pts = cons.map((v, i) => (v == null ? null : [cx(i), y(v)])).filter(Boolean);
    const dots = n <= 12 ? cons.map((v, i) => (v == null ? "" : h`<span class="bi-dot" style="--x:${pc(cx(i), W)};--y:${pc(y(v), H)}"></span>`)) : "";
    const axis = buckets.map((b, i) => (i % every === 0 || b.current ? h`<span class="ax ${b.current ? "is-cur" : ""}" style="--x:${pc(cx(i), W)}">${esc(b.key)}</span>` : ""));
    REG.set(id, { type: "bars", kind, n, slot, buckets, tot, cons, y, cx, top: (i) => Math.max(tot[i], cons[i] || 0), marks: (i) => [null, cons[i]] });
    return shell(id, label,
      h`${gridLines(max, y)}<line class="bi-base" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}"/><rect class="bi-hl" x="0" y="0" width="${slot}" height="${H}"/>${cols}${pts.length > 1 ? h`<path class="bi-cl" d="${mono(pts)}"/>` : ""}`,
      h`${yTicks(max, y)}${dots}`, axis);
  }

  function dayLines({ buckets: B, label }) {
    const id = `bi${++seq}`, n = B.length, slot = W / n, cx = (i) => slot * i + slot / 2;
    const now = new Date(), t = now.getHours() + now.getMinutes() / 60;
    const idx = B.map((_, i) => i), past = idx.filter((i) => !B[i].future), fut = idx.filter((i) => B[i].future), last = past[past.length - 1];
    const prod = B.map((b) => b.prod || 0), cons = B.map((b) => b.cons);
    const max = BZ.niceMax(Math.max(...prod, ...cons.filter((v) => v != null), 0.1) * 1.1);
    const y = (v) => 4 + (1 - v / max) * (H - 4), P = (i, v) => [cx(i), y(v)];
    const pP = past.map((i) => P(i, prod[i])), fP = (last != null ? [last, ...fut] : fut).map((i) => P(i, prod[i]));
    const cP = past.filter((i) => cons[i] != null).map((i) => P(i, cons[i]));
    const area = pP.length > 1 ? h`<path class="bi-pa" d="${mono(pP)} L${pP[pP.length - 1][0]},${H} L${pP[0][0]},${H} Z"/><path class="bi-pl" d="${mono(pP)}"/>` : "";
    const segs = [];
    B.forEach((b) => { const s = segs[segs.length - 1]; if (s && s.k === b.tariff) s.n++; else segs.push({ k: b.tariff, n: 1 }); });
    const band = h`<div class="bi-band" aria-hidden="true">${segs.map((s) => h`<i data-tariff="${s.k}" style="--w:${pc(s.n, n)}"></i>`)}</div>`;
    const axis = B.map((b, i) => (i % 3 === 0 ? h`<span class="ax ${i === 0 ? "is-start" : ""}" style="--x:${pc(slot * i, W)}">${b.h}h</span>` : "")).concat(h`<span class="ax is-end" style="--x:100%">24h</span>`);
    REG.set(id, { type: "lines", kind: "jour", n, slot, buckets: B, tot: prod, cons, y, cx, top: (i) => Math.max(prod[i], cons[i] || 0), marks: (i) => [prod[i], cons[i]] });
    return shell(id, label,
      h`${gridLines(max, y)}<line class="bi-base" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}"/><rect class="bi-hl" x="0" y="0" width="${slot}" height="${H}"/>
        ${area}${fP.length > 1 ? h`<path class="bi-fl" d="${mono(fP)}"/>` : ""}${cP.length > 1 ? h`<path class="bi-cl" d="${mono(cP)}"/>` : ""}
        <line class="bi-now" x1="${slot * t}" x2="${slot * t}" y1="0" y2="${H}"/>`,
      h`${yTicks(max, y)}<span class="bi-now-l" style="--x:${pc(slot * t, W)}">${fmt.time(now)}</span>`, axis, band);
  }

  // Infobulle (souris, toucher, clavier) — écoutée une seule fois pour toute la vie de la page
  const tipEl = () => document.getElementById("tip");
  const row = (l, v, tone, cls = "", unit = " kWh", d = 1) => h`<div class="tip-r ${cls}">${tone ? h`<i data-tone="${tone}"></i>` : ""}<span>${l}</span><b>${fmt.n(v, d)}${unit}</b></div>`;
  let hover = null;
  function showTip(fig, i) {
    const c = REG.get(fig.dataset.bi); if (!c) return;
    i = BZ.clamp(i, 0, c.n - 1); fig.dataset.i = i; fig.classList.add("is-hover");
    fig.querySelectorAll(".bar").forEach((g, j) => g.classList.toggle("is-on", j === i));
    const hl = fig.querySelector(".bi-hl"); hl.setAttribute("x", c.slot * i); hl.classList.add("is-on");
    const b = c.buckets[i];
    c.marks(i).forEach((v, k) => {
      const dot = fig.querySelector(k ? ".bi-cur.is-c" : ".bi-cur.is-p");
      if (v == null) { dot.classList.remove("is-on"); return; }
      dot.style.setProperty("--x", pc(c.cx(i), W)); dot.style.setProperty("--y", pc(c.y(v), H)); dot.classList.add("is-on");
      dot.classList.toggle("is-fc", !!b.future);
    });
    let rows;
    if (c.type === "lines") {
      const T = BZ.TARIFS[b.tariff];
      rows = h`${row(b.future ? "Prévision" : "Production", c.tot[i], "solar", b.future ? "bi-tip-f" : "", " kWh", 2)}${c.cons[i] != null ? row("Consommation", c.cons[i], "neutral", "bi-tip-c", " kWh", 2) : ""}
        <div class="tip-r bi-tip-tar"><i data-tone="${b.tariff}"></i><span>${T.label}</span><b>${fmt.n(T.price(), 4)} €/kWh</b></div>`;
    } else rows = b.forecast ? row("Production prévue", c.tot[i], "solar", "bi-tip-f")
      : h`${SER.map(([k, l, tone]) => row(l, b[k] || 0, tone))}${row("Production", c.tot[i], null, "bi-tip-t")}${c.cons[i] != null ? row("Consommation", c.cons[i], "neutral", "bi-tip-c") : ""}`;
    const t = tipEl();
    t.innerHTML = h`<strong>${esc(tipName(c.kind, b, i))}${b.current ? " · en cours" : ""}</strong>${rows}`;
    t.classList.add("is-on");
    const r = fig.querySelector(".bi-plot").getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
    const xPx = r.left + (c.cx(i) / W) * r.width, yPx = r.top + (c.y(c.top(i)) / H) * r.height;
    const left = BZ.clamp(xPx - tw / 2, 8, innerWidth - tw - 8);
    let top = yPx - th - 14; if (top < 8) top = Math.min(innerHeight - th - 8, yPx + 18);
    t.style.transform = `translate(${left}px, ${top}px)`;
  }
  function hideTip(fig, keepTip) {
    if (!keepTip) tipEl().classList.remove("is-on");
    if (!fig) return;
    fig.classList.remove("is-hover");
    fig.querySelectorAll(".bar.is-on, .bi-hl.is-on, .bi-cur.is-on").forEach((e) => e.classList.remove("is-on"));
  }
  document.addEventListener("pointermove", (e) => {
    const fig = e.target.closest && e.target.closest(".bi-chart");
    if (hover && hover !== fig) { hideTip(hover, !!(e.target.closest && e.target.closest(".chart"))); hover = null; }
    if (!fig) return;
    const c = REG.get(fig.dataset.bi); if (!c) return;
    const r = fig.querySelector(".bi-plot").getBoundingClientRect();
    hover = fig; showTip(fig, Math.floor(((e.clientX - r.left) / r.width) * c.n));
  }, { passive: true });
  document.addEventListener("pointerleave", () => { if (hover) { hideTip(hover); hover = null; } });
  document.addEventListener("scroll", () => { if (hover) { hideTip(hover); hover = null; } }, { passive: true, capture: true });
  document.addEventListener("keydown", (e) => {
    const fig = document.activeElement && document.activeElement.closest && document.activeElement.closest(".bi-chart");
    if (!fig || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const c = REG.get(fig.dataset.bi); if (!c) return;
    e.preventDefault();
    const cur = fig.dataset.i != null ? +fig.dataset.i : c.n - 1;
    showTip(fig, e.key === "Home" ? 0 : e.key === "End" ? c.n - 1 : cur + (e.key === "ArrowLeft" ? -1 : 1));
  });
  document.addEventListener("focusout", (e) => { if (e.target.classList && e.target.classList.contains("bi-chart")) hideTip(e.target); });

  // Légende : pastille (barre), aire, trait (courbe), tirets (prévision), hachures
  const legendRow = (items) => h`<ul class="bi-lg">${items.map(([label, tone, kind, v]) => h`<li data-tone="${tone}"><i class="bi-sw is-${kind}"></i><span>${label}</span>${v ? h`<b>${v}</b>` : ""}</li>`)}</ul>`;

  /* ─── Export CSV de la période (séparateur « ; » et virgule décimale, comme Excel en français) ─── */
  function csvHref(P) {
    const n = (v) => (v == null || !Number.isFinite(v) ? "" : v.toFixed(2).replace(".", ","));
    let rows;
    if (P.kind === "jour") rows = [["Heure", "Production (kWh)", "Consommation (kWh)", "Tarif"], ...P.buckets.filter((b) => !b.future).map((b) => [`${b.h}h`, n(b.prod), n(b.cons), BZ.TARIFS[b.tariff].short])];
    else rows = [[P.kind === "annee" ? "Mois" : "Jour", "Production (kWh)", "Utilisée à la maison", "Stockée en batterie", "Revendue", "Consommation (kWh)", "Achat réseau", "dont HP", "dont HC", "dont HSC", "Économies (€)"],
      ...P.buckets.filter((b) => !b.forecast).map((b, i) => [P.kind === "annee" ? BZ.MONTHS_LONG[i] : b.date.toLocaleDateString("fr-FR"), n(b.prod), n(b.self), n(b.chg), n(b.exp), n(b.cons), n(b.imp), n(b.hp), n(b.hc), n(b.hsc), n(b.savings)])];
    return `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + rows.map((r) => r.join(";")).join("\r\n"))}`;
  }

  /* ─── Blocs de la page ────────────────────────────────────────────── */
  function header(P) {
    const stamp = new Date().toISOString().slice(0, 10);
    return h`<header class="ph">
      <div><p class="ph-hi">Historique</p><h1>Bilan</h1><p class="ph-sub">${P.title} · ${P.compare}</p></div>
      <div class="ph-a">
        <div class="bi-per">${icon("calendar")}${pills({ name: "period", label: "Période du bilan", value: P.kind, options: [["jour", "Jour"], ["semaine", "7 jours"], ["mois", "Mois"], ["annee", "Année"]] })}</div>
        <a class="btn btn-primary bi-exp" href="${csvHref(P)}" download="breezy-bilan-${P.kind}-${stamp}.csv" aria-label="Exporter le bilan de la période en CSV">${DL}<span>Exporter</span></a>
      </div></header>`;
  }

  // Mini-courbes : les cases de la période. Jour : heures écoulées (taux et euros : 7 derniers jours).
  // Année : moyenne par jour de chaque mois, pour que le mois en cours ne « s'effondre » pas.
  function sparks(P) {
    if (P.kind === "jour") {
      const past = P.buckets.filter((b) => !b.future), wk = BZ.dayView(0).week;
      return { prod: past.map((b) => b.prod), cons: past.map((b) => b.cons), aut: wk.map(aut), eco: wk.map((b) => b.savings) };
    }
    const real = P.buckets.filter((b) => !b.forecast);
    const days = (b, i) => (P.kind !== "annee" ? 1 : b.current ? new Date().getDate() : new Date(year(), i + 1, 0).getDate());
    return { prod: real.map((b, i) => b.prod / days(b, i)), cons: real.map((b, i) => b.cons / days(b, i)), aut: real.map(aut), eco: real.map((b, i) => b.savings / days(b, i)) };
  }

  function kpis(P, T, Q, L) {
    const S = sparks(P), sp = (vals, tone) => (vals.filter((v) => v != null).length > 1 ? BZ.spark(vals, tone) : null);
    return h`<div class="kpis">
      ${kpi({ label: "Produit", ic: "sun", tone: "solar", value: val(fmt.kwh(T.prod)), delta: delta(T.prod, Q.prod), vs: L.vs, spark: sp(S.prod, "solar") })}
      ${kpi({ label: "Consommé", ic: "home", tone: "battery", value: val(fmt.kwh(T.cons)), delta: delta(T.cons, Q.cons, { invert: true }), vs: L.vs, spark: sp(S.cons, "battery") })}
      ${kpi({ label: "Autosuffisance", ic: "leaf", tone: "good", value: val([fmt.n(aut(T) * 100), "%"]), delta: delta(aut(T), aut(Q), { unit: "pts" }), vs: L.vs, spark: sp(S.aut, "good") })}
      ${kpi({ label: "Économisé", ic: "euro", tone: "accent", value: val([fmt.n(T.savings, T.savings >= 100 ? 0 : 2), "€"]), delta: delta(T.savings, Q.savings), vs: L.vs, spark: sp(S.eco, "accent") })}
    </div>`;
  }

  function chartCard(P, T) {
    if (P.kind === "jour") {
      const fc = P.buckets.reduce((a, b) => a + (b.future ? b.prod : 0), 0);
      const key = h`<div class="tariff-key bi-tk">${["hp", "hc", "hsc"].map((k) => h`<span data-tariff="${k}"><i></i>${BZ.TARIFS[k].short} <em>${BZ.rangeLabel(k)}</em> <b>${fmt.n(BZ.TARIFS[k].price(), 4)} €</b></span>`)}</div>`;
      return card({ cls: "bi-main is-day", title: "Ta journée heure par heure", ic: "chart", tone: "accent",
        aside: legendRow([["Production", "solar", "area", fmt.kwhText(T.prod)], ...(fc > 0.05 ? [["Prévision", "solar", "dash", `+${fmt.kwhText(fc)}`]] : []), ["Consommation", "neutral", "line", fmt.kwhText(T.cons)]]),
        body: h`<div class="bi-chart-w">${dayLines({ buckets: P.buckets, label: "Production, prévision et consommation par heure, tarifs sous l'axe" })}</div>${key}` });
    }
    const fcTot = P.forecastTotal - T.prod, every = P.buckets.length > 14 ? 5 : 1;
    const buckets = P.buckets.map((b) => ({ ...b, key: P.kind === "semaine" ? fmt.cap(b.key) : b.key }));
    return card({ cls: "bi-main", title: P.kind === "annee" ? "Production et consommation" : "Où va ta production", ic: "chart", tone: "accent",
      aside: legendRow([
        ["Maison", "solar", "bar", fmt.kwhText(T.self)], ["Batterie", "battery", "bar", fmt.kwhText(T.chg)], ["Revendue", "grid", "bar", fmt.kwhText(T.exp)],
        ["Consommation", "neutral", "line", ""], ...(fcTot > 0.5 ? [["Prévision", "solar", "hatch", ""]] : []),
      ]),
      body: h`<div class="bi-chart-w">${combo({ kind: P.kind, buckets, every, label: `Destination de la production par ${LBL[P.kind]().unit} et consommation` })}</div>` });
  }

  // Comparaison : uniquement ce que les 4 indicateurs du haut ne montrent pas déjà
  function compareCard(T, Q, L) {
    const rows = [
      { ic: "grid", tone: "grid", name: "Achat réseau", cur: fmt.kwhText(T.imp), prev: fmt.kwhText(Q.imp), d: delta(T.imp, Q.imp, { invert: true }) },
      { ic: "euro", tone: "hp", name: "Facture réseau", cur: fmt.eur(bill(T)), prev: fmt.eur(bill(Q)), d: delta(bill(T), bill(Q), { invert: true }) },
      { raw: UP, tone: "grid", name: "Revente", cur: fmt.kwhText(T.exp), prev: fmt.kwhText(Q.exp), d: delta(T.exp, Q.exp) },
      { ic: "battery", tone: "battery", name: "Batterie restituée", cur: fmt.kwhText(T.dch), prev: fmt.kwhText(Q.dch), d: delta(T.dch, Q.dch) },
      { ic: "sun", tone: "solar", name: "Autoconsommation", cur: fmt.pct(selfUse(T)), prev: fmt.pct(selfUse(Q)), d: delta(selfUse(T), selfUse(Q), { unit: "pts" }) },
    ];
    return card({ cls: "bi-cmp", title: "Comparaison", ic: "refresh", tone: "accent", aside: h`<span class="bi-note">${L.vs}</span>`, body: h`
      <div class="dt-wrap"><table class="dt">
        <thead><tr><th scope="col">Indicateur</th><th scope="col">${L.cur}</th><th scope="col">${L.prev}</th><th scope="col">Écart</th></tr></thead>
        <tbody>${rows.map((r) => h`<tr>
          <td><div class="dt-main"><span class="dt-ic" data-tone="${r.tone}">${r.raw || icon(r.ic)}</span><strong>${r.name}</strong></div></td>
          <td class="dt-v">${r.cur}</td><td class="bi-prev">${r.prev}</td><td>${r.d || h`<span class="delta">—</span>`}</td></tr>`)}</tbody></table></div>` });
  }

  function bestCard(P, L) {
    const isDay = P.kind === "jour";
    const real = P.buckets.map((b, i) => ({ b, i })).filter(({ b }) => !b.forecast && !b.future && b.prod > 0.05);
    const avg = real.reduce((a, x) => a + x.b.prod, 0) / (real.length || 1);
    const best = [...real].sort((a, z) => z.b.prod - a.b.prod).slice(0, P.kind === "semaine" ? 3 : 5);
    const body = best.length ? h`<ol class="plist bi-best">${best.map(({ b, i }, r) => {
      const vs = (b.prod / avg - 1) * 100;
      const sub = isDay ? h`${BZ.TARIFS[b.tariff].label}${b.cons != null ? h`<span class="bi-sx"> · ${fmt.kwhText(b.cons)} consommés</span>` : ""}`
        : h`${fmt.n(aut(b) * 100)} % autonome<span class="bi-sx"> · ${fmt.kwhText(b.exp)} revendus</span>`;
      return h`<li><div class="plist-r">
        <span class="bi-rk ${r === 0 ? "is-1" : ""}"><span class="sr">Rang </span>${r + 1}</span>
        <span><strong>${nameOf(P.kind, b, i)}${b.current ? h` <em class="bi-now">en cours</em>` : ""}</strong><small>${sub}</small></span>
        ${pill(vs >= 0.5 ? `+${fmt.n(vs)} % vs moy.` : "dans la moyenne", vs >= 0.5 ? "good" : "neutral")}
        <span class="plist-p"><span>${fmt.kwhText(b.prod)}</span>${meter({ value: (b.prod / best[0].b.prod) * 100, tone: "solar", size: "xs" })}</span></div></li>`;
    })}</ol>`
      : BZ.empty({ ic: "sun", title: "Pas encore de production", text: "Le classement se remplit dès le lever du soleil." });
    return card({ cls: "bi-top", title: "Meilleurs moments", ic: "star", tone: "accent", aside: h`<span class="bi-note">${L.per}</span>`, body });
  }

  function originCard(T) {
    const parts = [{ label: "Soleil direct", v: T.self, tone: "solar" }, { label: "Batterie", v: T.dch, tone: "battery" }, { label: "Réseau", v: T.imp, tone: "grid" }];
    const cons = parts.reduce((a, p) => a + p.v, 0) || 1;
    const tar = ["hp", "hc", "hsc"].map((k) => ({ k, label: BZ.TARIFS[k].label, v: T[k] || 0, eur: (T[k] || 0) * BZ.TARIFS[k].price() }));
    return card({ cls: "bi-org", title: "D'où vient ta consommation", ic: "leaf", tone: "accent", link: { label: "Tarifs", to: "energy" }, body: h`
      <div class="bi-mixr">${donut({ parts, size: 128, stroke: 15, center: fmt.n(T.cons, T.cons < 100 ? 1 : 0), sub: "kWh", label: `${fmt.kwhText(T.cons)} consommés : ${parts.map((p) => `${p.label} ${Math.round((p.v / cons) * 100)} %`).join(", ")}` })}
        <ul class="bi-keys">${parts.map((p) => h`<li data-tone="${p.tone}"><i></i><span>${p.label}</span><em>${fmt.n((p.v / cons) * 100)} %</em><b>${fmt.kwhText(p.v)}</b></li>`)}</ul></div>
      <div class="bi-tar">
        <div class="bi-tar-h"><strong>Réseau par tarif</strong><span><b>${fmt.eur(bill(T))}</b> payés</span></div>
        ${BZ.split(tar.map((t) => ({ label: t.label, v: t.v, tone: t.k })), { label: `Achat réseau par tarif : ${tar.map((t) => `${t.label} ${fmt.kwhText(t.v)}`).join(", ")}` })}
        <ul class="bi-tl">${tar.map((t) => h`<li data-tone="${t.k}"><i></i><span>${t.label}<em>${BZ.rangeLabel(t.k)}</em></span><span class="bi-tl-k">${fmt.kwhText(t.v)}</span><b>${fmt.eur(t.eur, 2)}</b></li>`)}</ul>
      </div>` });
  }

  function roiCard(P) {
    const R = BZ.roi(), isYear = P.kind === "annee", ytd = BZ.period("annee").total.savings;
    // En vue « Année », l'économie de l'année est déjà dans les indicateurs : on montre la durée d'amortissement
    const first = isYear ? ["Amortie en", `${fmt.n(R.totalYears, 1)} ans`] : [`En ${year()}`, fmt.eur(ytd, 0)];
    return card({ cls: "bi-roi", title: "Rentabilité solaire", ic: "sun", tone: "accent", aside: pill(`${fmt.n(R.progress * 100)} % remboursé`, "accent"), body: h`
      <div class="bi-roi-v">${val([fmt.n(R.total), "€"], "bi-roi-big")}<span>économisés sur ${fmt.eur(R.inv, 0)} investis</span></div>
      <div class="bi-roi-m">${meter({ value: R.progress * 100, tone: "accent", size: "lg", label: "Part de l'installation remboursée" })}
        <div class="bi-roi-ax"><span>Depuis ${fmt.date(R.start, { month: "short", year: "numeric" })}</span><span>Amortie vers <b>${fmt.date(R.payback, { month: "long", year: "numeric" })}</b></span></div></div>
      <div class="bi-roi-kv">
        <div><span>${first[0]}</span><b>${first[1]}</b></div>
        <div><span>Par an</span><b>${fmt.eur(R.perYear, 0)}</b></div>
        <div><span>Reste</span><b>${fmt.eur(R.remaining, 0)}</b></div>
      </div>` });
  }

  BZ.pages.insights = () => {
    REG.clear();
    const P = BZ.period(LBL[BZ.ui.period] ? BZ.ui.period : "semaine"), T = P.total, Q = P.prevTotal, L = LBL[P.kind]();
    return h`${header(P)}${kpis(P, T, Q, L)}
      <div class="layout bi-grid">
        <div class="col bi-l">${chartCard(P, T)}<div class="bi-pair">${compareCard(T, Q, L)}${bestCard(P, L)}</div></div>
        <div class="col bi-r">${originCard(T)}${roiCard(P)}</div>
      </div>`;
  };
})();
