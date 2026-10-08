// Voltia v3 — version mobile (thème clair, en-tête orange, arbre de flux, analyse).
// Lit les mêmes rôles (../js/config.js) et les mêmes états (../js/mock.js) que la v1 et la v2.
(function () {
  const C = window.VOLTIA_CONFIG;
  const H = window.MOCK_STATES;

  // ─── Lecture des états
  const ent = (id) => H[id] || { state: "unavailable", attributes: {} };
  const st = (id) => ent(id).state;
  const n = (id) => { const v = parseFloat(st(id)); return Number.isFinite(v) ? v : NaN; };
  const at = (id, a) => ent(id).attributes[a];
  const on = (id) => ["on", "open", "playing", "heat", "unlocked"].includes(st(id));

  // ─── Formatage
  const fr = (v, d = 0) => Number.isFinite(v) ? v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
  const kw = (w) => fr(w / 1000, 2);
  const Wt = (w) => Math.abs(w) >= 1000 ? `${fr(w / 1000, 2)} kW` : `${fr(w)} W`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pct = (v) => `${clamp(v, 0, 100)}%`;
  const hhmm = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const ago = (iso) => {
    const m = Math.round((Date.now() - new Date(iso)) / 60e3);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m} min`;
    if (m < 1440) return `il y a ${Math.round(m / 60)} h`;
    if (m < 60 * 1440) return `il y a ${Math.round(m / 1440)} j`;
    return `il y a ${Math.round(m / 43800)} mois`;
  };
  const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };

  function energy() {
    const solar = Math.max(0, n(C.solaire_w));
    const grid = n(C.reseau_w);
    const bat = C.batterie_inverse ? -n(C.batterie_w) : n(C.batterie_w); // + charge, − décharge
    const car = on(C.voiture_branchee) ? Math.max(0, n(C.voiture_charge_w)) : 0;
    const total = solar + grid - bat;
    return { solar, grid, bat, car, house: Math.max(0, total - car), total };
  }
  function bilanJour() {
    const prod = n(C.production_jour_kwh), imp = n(C.import_jour_kwh), exp = n(C.export_jour_kwh);
    const chg = n(C.batterie_charge_jour_kwh), dch = n(C.batterie_decharge_jour_kwh);
    const conso = prod - exp + imp - chg + dch;
    return { prod, imp, exp, chg, dch, conso, autoUse: Math.max(0, prod - exp - chg), solDirect: Math.max(0, conso - imp - dch) };
  }

  // ─── Historiques de démo (remplacés plus tard par l'historique Home Assistant)
  const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
  const PROD_H = HOURS.map((h) => +(5.2 * Math.exp(-((h - 13) ** 2) / (2 * 2.6 ** 2))).toFixed(2));
  const dayName = (k) => new Date(Date.now() - k * 864e5).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
  const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const PERIODES = {
    jour: () => ({ titre: "kWh aujourd'hui", total: n(C.production_jour_kwh), evol: null,
      labels: HOURS.filter((h) => h % 2 === 0).map((h) => `${h}h`),
      data: HOURS.filter((h) => h % 2 === 0).map((h) => +(PROD_H[h - 6] + PROD_H[h - 5]).toFixed(1)), hi: -1 }),
    semaine: () => { const d = [24.8, 30.2, 26.4, 34.8, 18.6, 31.0, n(C.production_jour_kwh)];
      return { titre: "kWh cette semaine", total: d.reduce((a, b) => a + b, 0), evol: 14, labels: d.map((_, i) => (i === 6 ? "Auj." : dayName(6 - i))), data: d, hi: 6 }; },
    mois: () => { const d = [168.2, 182.5, 175.9, 179.3]; return { titre: "kWh ce mois-ci", total: d.reduce((a, b) => a + b, 0), evol: 6, labels: ["S1", "S2", "S3", "S4"], data: d, hi: 3 }; },
    annee: () => { const d = [210, 290, 480, 620, 760, 820, 850, 780, 590, 420, 250, 190];
      return { titre: "kWh cette année", total: d.slice(0, new Date().getMonth() + 1).reduce((a, b) => a + b, 0), evol: 9, labels: MOIS.map((m) => m[0]), data: d, hi: new Date().getMonth() }; },
  };
  const ANNEE = PERIODES.annee().data;

  // ─── Commandes simulées
  const toastEl = document.getElementById("toast");
  let toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("show"), 2200); }
  function call(service, entity_id, mutate, extra = "") { mutate && mutate(); toast(`Démo · ${service}${extra} → ${entity_id}`); render(); }
  const set = (id, state, attrs) => { H[id].state = String(state); if (attrs) Object.assign(H[id].attributes, attrs); };
  const toggle = (id, a = "on", b = "off") => set(id, st(id) === a ? b : a);
  const armed = {};
  function twoTap(key, label, fn) {
    if (armed[key]) { clearTimeout(armed[key]); delete armed[key]; fn(); return; }
    armed[key] = setTimeout(() => { delete armed[key]; render(); }, 3000);
    toast(label); render();
  }

  // ─── Petits composants
  const sw = (isOn, act, i = "") => `<button class="sw ${isOn ? "on" : ""}" data-act="${act}" data-i="${i}" aria-pressed="${isOn}"></button>`;
  const stepper = (val, act, i = "") => `<div class="step"><button data-act="${act}" data-i="${i}" data-d="-1">−</button><b>${val}</b><button data-act="${act}" data-i="${i}" data-d="1">+</button></div>`;
  const prog = (v, c = "var(--orange)", mk) => `<div class="prog" style="--c:${c}"><i style="width:${pct(v)}"></i>${mk != null ? `<span class="mk" style="left:${pct(mk)}"></span>` : ""}</div>`;
  const ring = (v, label, c = "var(--green)", cls = "", lim) => {
    const R = 42, P = 2 * Math.PI * R;
    return `<div class="ring ${cls}" style="--c:${c}"><svg viewBox="0 0 100 100"><circle class="b" cx="50" cy="50" r="${R}"/>
      ${lim != null ? `<circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--txt)" stroke-opacity=".35" stroke-width="${cls ? 12 : 8}" stroke-dasharray="1.5 ${P}" stroke-dashoffset="${-P * lim / 100}"/>` : ""}
      <circle class="f" cx="50" cy="50" r="${R}" stroke-dasharray="${P}" stroke-dashoffset="${P * (1 - clamp(v, 0, 100) / 100)}"/></svg><div class="c">${label}</div></div>`;
  };
  const splitW = (w) => (Math.abs(w) >= 1000 ? [fr(w / 1000, 2), "kW"] : [fr(w), "W"]);
  const SV = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    car: SV('<path d="M19 17h2a1 1 0 0 0 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4a1 1 0 0 0 1 1h2"/><path d="M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'),
    bat: SV('<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 11v2M6 10.5v3M9.5 10.5v3M13 10.5v3"/>'),
    home: SV('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    plug: SV('<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>'),
    flame: SV('<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z"/>'),
  };
  const splitbar = (parts) => { const t = parts.reduce((a, p) => a + p.v, 0) || 1; return `<div class="splitbar">${parts.map((p) => `<i style="flex:${p.v / t};background:${p.c}"></i>`).join("")}</div>`; };

  // Courbe lisse (Catmull-Rom → Bézier)
  function smooth(pts) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
    }
    return d;
  }

  // ─── Graphique courbe avec survol
  const CHARTS = {};
  function curve(id, { labels, data, unit, color = "var(--orange)", hi = -1 }) {
    const W = 320, Hh = 110, PT = 16, PB = 18;
    const max = Math.max(...data) * 1.15;
    const xs = (i) => 8 + (i * (W - 16)) / (data.length - 1);
    const ys = (v) => PT + (1 - v / max) * (Hh - PT - PB);
    const pts = data.map((v, i) => [xs(i), ys(v)]);
    CHARTS[id] = { labels, data, unit, xs, ys, W };
    return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Courbe ${unit}">
      <defs><linearGradient id="g-${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${smooth(pts)} L${xs(data.length - 1)} ${Hh - PB} L${xs(0)} ${Hh - PB} Z" fill="url(#g-${id})"/>
      <path d="${smooth(pts)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      ${hi >= 0 ? `<circle cx="${xs(hi)}" cy="${ys(data[hi])}" r="9" fill="${color}" opacity=".15"/><circle cx="${xs(hi)}" cy="${ys(data[hi])}" r="4.5" fill="#fff" stroke="${color}" stroke-width="2"/>` : ""}
      ${labels.map((l, i) => `<text class="ax" x="${xs(i)}" y="${Hh - 3}" text-anchor="middle">${l}</text>`).join("")}
      <line class="cross" y1="${PT}" y2="${Hh - PB}" stroke="var(--faint)" stroke-dasharray="2 3" style="display:none"/>
      <circle class="dotc" r="4.5" fill="${color}" stroke="#fff" stroke-width="2" style="display:none"/>
      </svg><div class="tip"></div></div>`;
  }
  document.addEventListener("pointermove", (ev) => {
    const box = ev.target.closest && ev.target.closest(".chart");
    document.querySelectorAll(".chart .tip.on").forEach((t) => { if (!box || !box.contains(t)) { t.classList.remove("on"); t.parentNode.querySelector(".cross").style.display = "none"; t.parentNode.querySelector(".dotc").style.display = "none"; } });
    if (!box) return;
    const c = CHARTS[box.dataset.chart], svg = box.querySelector("svg"), r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * c.W;
    let i = 0, best = Infinity;
    c.data.forEach((_, k) => { const d = Math.abs(c.xs(k) - x); if (d < best) { best = d; i = k; } });
    const cross = svg.querySelector(".cross"), dot = svg.querySelector(".dotc");
    cross.setAttribute("x1", c.xs(i)); cross.setAttribute("x2", c.xs(i)); cross.style.display = "";
    dot.setAttribute("cx", c.xs(i)); dot.setAttribute("cy", c.ys(c.data[i])); dot.style.display = "";
    const tip = box.querySelector(".tip");
    tip.textContent = `${c.labels[i]} · ${fr(c.data[i], 1)} ${c.unit}`;
    tip.style.left = `${(c.xs(i) / c.W) * 100}%`;
    tip.style.top = `${(c.ys(c.data[i]) / 110) * 100}%`;
    tip.classList.add("on");
  });

  // ─── Accueil
  function pageAccueil() {
    const e = energy(), j = bilanJour();
    const now = new Date();
    const hi = clamp(now.getHours() - 6, 0, HOURS.length - 1);
    const peakI = PROD_H.indexOf(Math.max(...PROD_H));
    const W = 360, Hs = 86;
    const pts = PROD_H.map((v, i) => [(i * W) / (PROD_H.length - 1), 8 + (1 - v / 5.6) * (Hs - 16)]);
    const date = now.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    const flux = Math.max(1, e.solar + Math.max(0, e.grid) + Math.max(0, -e.bat));
    const share = (w) => (w / flux) * 100;
    const carOn = on(C.voiture_en_charge);
    const devices = [
      on(C.voiture_branchee) && { ic: "car", c: "#8a5cf6", t: "Kia e-Niro", go: "voiture",
        tag: carOn ? "En charge" : "Branchée", live: carOn, s: `${fr(n(C.voiture_soc))} % → ${fr(n(C.voiture_limite_pct))} %`,
        w: e.car, bar: n(C.voiture_soc), mk: n(C.voiture_limite_pct), foot: `${fr(n(C.voiture_autonomie_km))} km d'autonomie` },
      { ic: "bat", c: "#3a7bec", t: "Batterie SolarFlow", go: "flux", tag: e.bat > 15 ? "Charge" : e.bat < -15 ? "Décharge" : "Veille", live: Math.abs(e.bat) > 15,
        s: `${fr(n(C.batterie_dispo_kwh), 1)} kWh dispo`, w: Math.abs(e.bat), bar: n(C.batterie_soc), foot: `${fr(n(C.batterie_soc))} % chargée` },
      { ic: "home", c: "#e8711a", t: "Maison", go: "maison", tag: "Conso", s: "hors voiture", w: e.house, bar: share(e.house), foot: `${fr(share(e.house))} % du flux` },
      on(C.prise_chambre) && { ic: "plug", c: "#1f9d55", t: "Prise chambre", go: "maison", sub: "appareils", tag: "Allumée", s: `${fr(n(C.prise_chambre_kwh), 2)} kWh au total`,
        w: n(C.prise_chambre_w), bar: share(n(C.prise_chambre_w)), foot: `${fr(share(n(C.prise_chambre_w)), 1)} % du flux` },
      st(C.poele) !== "off" && { ic: "flame", c: "#e5484d", t: "Poêle à granulés", go: "maison", sub: "chauffage", tag: st(C.poele_statut), live: true,
        s: `P${st(C.poele_puissance)} · consigne ${fr(at(C.poele, "temperature"), 1)} °C`, val: fr(at(C.poele, "current_temperature"), 1), unit: "°C",
        bar: ((at(C.poele, "current_temperature") - 15) / 10) * 100, mk: ((at(C.poele, "temperature") - 15) / 10) * 100, foot: `trémie ${fr(n(C.tremie_kg), 1)} kg` },
    ].filter(Boolean);
    return `
      <div class="hero">
        <div class="row1"><div><div class="date">${date[0].toUpperCase() + date.slice(1)}</div><div class="hello">Bonjour 👋</div></div>
          <div class="btns"><button class="round" data-go="analyse" aria-label="Analyse">${SV('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>')}</button><button class="round" data-go="maison" aria-label="Maison">${SV('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>')}</button></div></div>
        <div class="status"><i></i><span>Système en ligne · ${e.solar > 3000 ? "Forte production" : e.solar > 200 ? "Production" : "Nuit"}</span><span>MAJ ${hhmm(now)}</span></div>
        <div class="big"><b>${kw(e.solar)}<small>kW</small></b>
          <div class="side">Production en cours<br>Pic ${fr(PROD_H[peakI], 2)} kW à ${HOURS[peakI]}h</div></div>
        <svg class="spark" viewBox="0 0 ${W} ${Hs}" preserveAspectRatio="none" aria-hidden="true">
          <defs><radialGradient id="glow"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
          <path d="${smooth(pts)}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".95"/>
        </svg>
        <div style="position:relative;height:0"><span style="position:absolute;left:${(hi / (PROD_H.length - 1)) * 100}%;top:${-Hs + pts[hi][1] - 9}px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:#fff;box-shadow:0 0 0 6px rgba(255,255,255,.35),0 0 18px #fff"></span></div>
      </div>
      <div class="wrap" style="margin-top:-6px">
        <div class="card glass stats">
          <div><b>${fr(j.prod, 1)}<small>kWh</small></b><div class="l">Produit</div></div>
          <div><b>${fr(j.conso, 1)}<small>kWh</small></b><div class="l">Consommé</div></div>
          <div><b>${fr(n(C.economies_jour_eur), 2)}<small>€</small></b><div class="l">Économisé</div></div>
        </div>
        <h2>Répartition du jour</h2>
        <div class="card">
          ${splitbar([{ v: j.autoUse, c: "var(--orange)" }, { v: j.chg, c: "var(--blue)" }, { v: j.exp, c: "var(--green)" }])}
          <div class="legend3">
            <div><span style="--c:var(--orange)">Autoconso</span><b>${fr(j.autoUse, 1)} kWh</b><em>${fr((j.autoUse / j.prod) * 100)} %</em></div>
            <div><span style="--c:var(--blue)">Batterie</span><b>${fr(j.chg, 1)} kWh</b><em>${fr((j.chg / j.prod) * 100)} %</em></div>
            <div><span style="--c:var(--green)">Revendu</span><b>${fr(j.exp, 1)} kWh</b><em>${fr((j.exp / j.prod) * 100)} %</em></div>
          </div>
        </div>
        <div class="sec-h"><h2>Appareils actifs</h2><span>${devices.length} en marche</span></div>
        <div class="devs">${devices.map((d) => { const vu = d.val != null ? [d.val, d.unit] : splitW(d.w); return `
          <button class="devx" data-go="${d.go}" ${d.sub ? `data-gosub="${d.sub}"` : ""} style="--c:${d.c}">
            <span class="dico">${ICONS[d.ic]}</span>
            <span class="dmain">
              <span class="dtop"><b>${d.t}</b><span class="dval">${vu[0]}<small>${vu[1]}</small></span></span>
              <span class="dsub"><span class="dtag ${d.live ? "live" : ""}">${d.tag}</span><span>${d.s}</span></span>
              <span class="dbar"><i style="width:${pct(d.bar)}"></i>${d.mk != null ? `<em style="left:${pct(d.mk)}"></em>` : ""}</span>
              <span class="dfoot">${d.foot}</span>
            </span>
            <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
          </button>`; }).join("")}</div>
      </div>`;
  }

  // ─── Flux
  function pageFlux() {
    const e = energy(), j = bilanJour();
    const autosuff = clamp((1 - j.imp / j.conso) * 100, 0, 100);
    const share = (w) => e.solar > 0 ? fr((Math.abs(w) / e.solar) * 100) : "0";
    const N = [
      { k: "Maison", e: "🏠", c: "var(--orange)", w: e.house, p: `${share(e.house)} %` },
      { k: "Batterie", e: "🔋", c: "var(--blue)", w: Math.abs(e.bat), p: e.bat >= 0 ? `${share(e.bat)} %` : "décharge", rev: e.bat < 0 },
      { k: "Réseau", e: "⚡", c: "var(--green)", w: Math.abs(e.grid), p: e.grid < 0 ? `${share(e.grid)} %` : "achat", rev: e.grid > 0 },
      { k: "e-Niro", e: "🚗", c: "#8a5cf6", w: e.car, p: `${share(e.car)} %` },
    ];
    const xs = [45, 135, 225, 315];
    const sess = new Date(st(C.session_debut));
    const events = [
      { h: "06:12", c: "var(--orange)", t: "Début de la production", s: "Premiers rayons · 0,12 kW" },
      { h: "08:45", c: "var(--blue)", t: "La batterie commence à charger", s: "Surplus solaire · batterie à 42 %" },
      on(C.voiture_branchee) && { h: hhmm(sess), c: "#8a5cf6", t: "e-Niro branchée", s: `Mode ${st(C.voiture_mode_recharge)}` },
      { h: "10:20", c: "var(--green)", t: "Début de la revente", s: "Maison et batterie servies · surplus revendu" },
      { h: "12:48", c: "var(--orange)", t: "Pic de production", s: "5,20 kW · meilleure heure 12h – 13h" },
      { h: hhmm(new Date()), c: "var(--txt)", t: "Maintenant", s: `${Wt(e.solar)} produits · batterie ${fr(n(C.batterie_soc))} % · ${e.grid < 0 ? `revente ${Wt(-e.grid)}` : `achat ${Wt(e.grid)}`}` },
    ].filter(Boolean);
    return `
      <div class="bar-top"><h1>Flux d'énergie</h1><span class="end live">En direct</span></div>
      <div class="wrap">
        <div class="sun">☀️ <b>${kw(e.solar)}<small>kW</small></b><div class="muted small">Production solaire · 3 onduleurs</div></div>
        <svg class="tree" viewBox="0 0 360 70" preserveAspectRatio="none" aria-hidden="true">
          ${N.map((d, i) => `<path class="bg" d="M180 0 C180 40 ${xs[i]} 30 ${xs[i]} 70"/>
            <path class="go ${d.rev ? "rev" : ""}" stroke="${d.c}" d="M180 0 C180 40 ${xs[i]} 30 ${xs[i]} 70" style="${d.w < 15 ? "display:none" : `animation-duration:${clamp(2.2 - d.w / 1500, 0.5, 2.2)}s`}"/>`).join("")}
        </svg>
        <div class="nodes">${N.map((d) => `<div class="node" style="--c:${d.c}"><div class="e">${d.e}</div><div class="n">${d.k}</div><b>${kw(d.w)}<small>kW</small></b><div class="p">${d.p}</div></div>`).join("")}</div>

        <div class="card" style="margin-top:14px">
          <div class="flexrow">${ring(autosuff, `${fr(autosuff)} %`)}
            <div><b>Autosuffisance</b><div class="muted small">${fr(autosuff)} % de ta consommation du jour vient du soleil ou de la batterie. Seulement ${fr(j.imp, 1)} kWh achetés.</div></div></div>
        </div>

        <div class="card">
          <h3>Ce qui s'est passé aujourd'hui</h3>
          <div class="timeline">${events.map((ev) => `<div class="tl" style="--c:${ev.c}"><div class="h">${ev.h}</div><i></i><div><b>${ev.t}</b><span>${ev.s}</span></div></div>`).join("")}</div>
        </div>

        <div class="card">
          <h3>Onduleurs</h3>
          ${C.onduleurs_w.map((id, i) => { const max = [2000, 2000, 1000][i]; return `<div class="row"><div class="grow"><b>${C.onduleurs_noms[i]}</b><span>${fr((n(id) / max) * 100)} % de sa capacité</span></div><b>${Wt(n(id))}</b></div>
            <div style="margin:-2px 0 8px">${prog((n(id) / max) * 100)}</div>`; }).join("")}
        </div>
      </div>`;
  }

  // ─── Voiture
  function pageVoiture() {
    const soc = n(C.voiture_soc), lim = n(C.voiture_limite_pct);
    const plugged = on(C.voiture_branchee), charging = plugged && on(C.voiture_en_charge);
    const locked = st(C.voiture_verrou) === "locked";
    const sol = n(C.session_sol_kwh), res = n(C.session_res_kwh);
    const odo = n(C.voiture_odometre), last = n(C.entretien_dernier_km), next = last + C.entretien_intervalle_km;
    const modes = at(C.voiture_mode_recharge, "options") || [];
    const fin = new Date(Date.now() + n(C.voiture_minutes_restantes) * 60e3);
    return `
      <div class="bar-top"><div><h1>Kia e-Niro</h1><div class="sub">MAJ ${ago(st(C.voiture_maj))}</div></div>
        ${charging ? `<span class="end live" style="background:#efe9fe;color:#8a5cf6">En charge · ${Wt(n(C.voiture_charge_w))}</span>` : `<span class="end muted small">${plugged ? "Branchée" : "Débranchée"}</span>`}</div>
      <div class="wrap">
        <div class="card" style="text-align:center">
          <div style="display:flex;justify-content:center">${ring(soc, `<div>${fr(soc)}<span style="font-size:1rem;font-weight:500"> %</span></div><small>${fr(n(C.voiture_autonomie_km))} km</small>`, "#8a5cf6", "lg", lim)}</div>
          <div class="muted small" style="margin:10px 0 18px">${charging ? `Fin vers <b style="color:var(--txt)">${hhmm(fin)}</b> · limite ${fr(lim)} %` : `Limite de charge ${fr(lim)} %`}</div>
          <div class="actions4">
            <div><button class="${charging ? "on" : ""}" data-act="car-charge" ${plugged ? "" : "disabled style='opacity:.4'"}>⚡</button>${charging ? "Arrêter" : "Charger"}</div>
            <div><button class="${armed.unlock ? "danger" : locked ? "" : "on"}" data-act="car-lock">${locked ? "🔒" : "🔓"}</button>${armed.unlock ? "Confirmer" : locked ? "Verrouillée" : "Ouverte"}</div>
            <div><button class="${on(C.voiture_clim) ? "on" : ""}" data-act="car-clim">❄️</button>Clim</div>
            <div><button data-act="car-refresh">⟳</button>Actualiser</div>
          </div>
        </div>

        <div class="card">
          <h3>Cette charge <span class="end">depuis ${hhmm(new Date(st(C.session_debut)))}</span></h3>
          <div class="kpi" style="margin-bottom:12px"><b style="color:#8a5cf6">+${fr(n(C.session_soc))} %</b><span class="u">${fr(sol + res, 1)} kWh</span><span class="tag">${fr((sol / (sol + res)) * 100)} % solaire</span></div>
          ${splitbar([{ v: sol, c: "var(--orange)" }, { v: res, c: "var(--green)" }])}
          <div class="legend3" style="grid-template-columns:1fr 1fr">
            <div><span style="--c:var(--orange)">Solaire · ${Wt(n(C.ve_solaire_w))}</span><b>${fr(sol, 1)} kWh</b></div>
            <div style="text-align:right"><span style="--c:var(--green)">Réseau · ${Wt(n(C.ve_reseau_w))}</span><b>${fr(res, 1)} kWh</b></div>
          </div>
        </div>

        <h2>Mode de recharge</h2>
        <div class="seg" style="margin-bottom:14px">${modes.map((m) => `<button class="${st(C.voiture_mode_recharge) === m ? "on" : ""}" data-act="car-mode" data-i="${m}">${m.replace("Soleil + super creuses", "Soleil + HSC")}</button>`).join("")}</div>

        <div class="card">
          <div class="row"><div class="grow"><b>Limite à la maison</b><span>recharge AC</span></div>${stepper(`${fr(lim)} %`, "car-lim")}</div>
          <div class="row"><div class="grow"><b>Limite recharge rapide</b><span>recharge DC</span></div>${stepper(`${fr(n(C.voiture_limite_dc_pct))} %`, "car-limdc")}</div>
          <div class="row"><div class="grow"><b>Heures creuses seulement</b><span>ne charge qu'en HC</span></div>${sw(on(C.voiture_heures_creuses), "car-hc")}</div>
          <div class="row"><div class="grow"><b>Charge programmée</b><span>selon l'horaire de la voiture</span></div>${sw(on(C.voiture_programmee), "car-prog")}</div>
        </div>

        <div class="card">
          <h3>Entretien <span class="end">${fr(odo)} km</span></h3>
          <div class="kpi"><b style="font-size:1.6rem;color:var(--txt)">${fr(Math.abs(next - odo))} km</b><span class="u">${next - odo >= 0 ? "avant le prochain" : "de retard"}</span></div>
          <div style="margin:10px 0 14px">${prog(((odo - last) / C.entretien_intervalle_km) * 100, "#8a5cf6")}</div>
          <div class="grid2"><button class="btn" data-act="car-service">✓ Entretien fait</button><button class="btn" data-act="car-service-km">Autre km…</button></div>
          <div class="row" style="margin-top:8px"><div class="grow"><b>Batterie 12 V</b></div><b>${fr(n(C.voiture_12v_pct))} %</b></div>
          <div class="row"><div class="grow"><b>Dernier trajet</b><span>${fr(soc - n(C.voiture_soc_reference))} % depuis</span></div><b>${ago(st(C.voiture_dernier_trajet))}</b></div>
        </div>
      </div>`;
  }

  // ─── Maison (sous-onglets)
  let sousMaison = "lumieres";
  function pageMaison() {
    const tabs = [["lumieres", "Lumières"], ["volets", "Volets"], ["chauffage", "Chauffage"], ["appareils", "Appareils"]];
    const body = { lumieres: maisonLumieres, volets: maisonVolets, chauffage: maisonChauffage, appareils: maisonAppareils }[sousMaison]();
    return `
      <div class="bar-top"><h1>Ma maison</h1><span class="end muted small">${METEO[st(C.meteo)] || ""} ${fr(at(C.meteo, "temperature"))} °C dehors</span></div>
      <div class="pills">${tabs.map(([k, l]) => `<button class="${sousMaison === k ? "on" : ""}" data-sub="${k}">${l}</button>`).join("")}</div>
      <div class="wrap">${body}</div>`;
  }
  const METEO = { sunny: "☀️", "clear-night": "🌙", partlycloudy: "⛅", cloudy: "☁️", rainy: "🌧️", pouring: "🌧️", snowy: "❄️", fog: "🌫️", windy: "💨", lightning: "⛈️" };
  function maisonLumieres() {
    const nb = C.lumieres.filter(on).length;
    return `<div class="dev" style="margin-bottom:14px"><span class="ic" style="background:var(--orange-soft)">💡</span><div class="t"><b>${nb} allumée${nb > 1 ? "s" : ""}</b><span>sur ${C.lumieres.length} lumières</span></div><button class="btn k" data-act="lights-off" style="padding:10px 14px">Tout éteindre</button></div>
      <div class="grid2">${C.lumieres.map((id, i) => `<button class="tile ${on(id) ? "on" : ""}" data-act="light" data-i="${i}"><span class="ti">💡</span><div><b>${C.lumieres_noms[i]}</b><br><span>${on(id) ? "Allumée" : "Éteinte"}</span></div></button>`).join("")}</div>`;
  }
  function maisonVolets() {
    return `<div class="grid2" style="margin-bottom:14px"><button class="btn o" data-act="covers" data-i="100">▲ Tout ouvrir</button><button class="btn k" data-act="covers" data-i="0">▼ Tout fermer</button></div>
      ${C.volets.map((id, i) => { const p = at(id, "current_position"); return `<div class="dev"><span class="shut"><i style="height:${100 - p}%"></i></span><div class="t"><b>${C.volets_noms[i]}</b><span>${p === 0 ? "Fermé" : p === 100 ? "Ouvert" : `Ouvert à ${p} %`}</span></div>
        <div class="step"><button data-act="cover" data-i="${i}" data-d="100" aria-label="Ouvrir">▲</button><button data-act="cover" data-i="${i}" data-d="0" aria-label="Fermer">▼</button></div></div>`; }).join("")}`;
  }
  function maisonChauffage() {
    const p = C.poele, pOn = st(p) !== "off";
    const tremie = n(C.tremie_kg), stock = n(C.stock_kg), conso = n(C.conso_jour_kg), tMax = at(C.tremie_kg, "max") || 15;
    const dj = Math.round((addMonths(new Date(st(C.poele_entretien)), C.poele_entretien_mois) - Date.now()) / 864e5);
    const bt = n(C.ballon_temp), bc = at(C.ballon, "temperature"), boost = n(C.ballon_boost) === 1;
    return `
      <div class="card">
        <h3>🔥 Poêle à granulés <span class="end">${sw(pOn, "stove")}</span></h3>
        <div class="flexrow">${ring(((at(p, "current_temperature") - 15) / 10) * 100, `${fr(at(p, "current_temperature"), 1)}°`, "var(--orange)")}
          <div class="grow" style="flex:1"><b>${st(C.poele_statut)}</b><div class="muted small">Fumées ${fr(n(C.poele_fumees))} °C · entretien ${dj >= 0 ? `dans ${dj} j` : `en retard de ${-dj} j`}</div>
          <div style="margin-top:8px">${stepper(`${fr(at(p, "temperature"), 1)}°`, "stove-temp")}</div></div></div>
        <div class="seg dark" style="margin-top:14px;box-shadow:none;background:var(--soft)">${[1, 2, 3, 4, 5].map((v) => `<button class="${n(C.poele_puissance) === v ? "on" : ""}" data-act="stove-pow" data-i="${v}">P${v}</button>`).join("")}</div>
      </div>
      <div class="card">
        <h3>🪵 Granulés <span class="end">~${fr((tremie + stock) / conso)} jours</span></h3>
        <div class="row" style="padding-top:0"><div class="grow"><b>Trémie</b><span>${fr(tremie, 1)} kg sur ${fr(tMax)} kg</span></div><b>${fr((tremie / tMax) * 100)} %</b></div>
        ${prog((tremie / tMax) * 100, tremie < 4 ? "var(--red)" : "var(--orange)")}
        <div class="row"><div class="grow"><b>Stock maison</b><span>${fr(conso, 1)} kg par jour</span></div><b>${fr(stock)} kg · ${fr(stock / 15)} sacs</b></div>
        <div class="grid2" style="margin-top:6px"><button class="btn ${armed.fill ? "danger" : ""}" data-act="pellet-fill">${armed.fill ? "Confirmer" : "Verser un sac"}</button><button class="btn o" data-act="pellet-buy">+ 1 sac</button></div>
      </div>
      <h2>Radiateurs</h2>
      ${C.radiateurs.map((id, i) => { const t = C.radiateurs_temp[i], h = C.radiateurs_hum[i], rOn = st(id) !== "off"; return `
        <div class="dev"><span class="ic" style="background:${rOn ? "#fde8e0" : "var(--soft)"}">🌡️</span>
          <div class="t"><b>${C.radiateurs_noms[i]}</b><span>${t ? fr(n(t), 1) : fr(at(id, "current_temperature"), 1)} °C${h ? ` · 💧&nbsp;${fr(n(h))}&nbsp;%` : ""}</span></div>
          ${rOn ? stepper(`${fr(at(id, "temperature"), 1)}°`, "rad-temp", i) : ""}${sw(rOn, "rad", i)}</div>`; }).join("")}
      <h2>Eau chaude</h2>
      <div class="card">
        <div class="flexrow">${ring((bt / bc) * 100, `${fr(bt)}°`, "var(--orange)")}
          <div style="flex:1"><b>Ballon ${on(C.ballon_chauffe) ? "· chauffe" : ""}</b><div class="muted small">Consigne ${fr(bc)} °C · entretien ${ago(new Date(st(C.ballon_entretien)).toISOString())}</div></div></div>
        <div class="row" style="margin-top:8px"><div class="grow"><b>Forcer la chauffe</b><span>${boost ? "J1 · boost" : "J0 · normal"}</span></div>${sw(boost, "boiler-boost")}</div>
      </div>`;
  }
  function maisonAppareils() {
    const hp = C.homepod, playing = st(hp) === "playing";
    const robotEtat = { docked: "Sur sa base", cleaning: "Nettoyage en cours", returning: "Retour à la base", idle: "En pause" }[st(C.robot)] || st(C.robot);
    return `
      <div class="card">
        <h3>🔌 Prise chambre <span class="end">${sw(on(C.prise_chambre), "plug")}</span></h3>
        <div class="kpi"><b style="color:var(--txt)">${on(C.prise_chambre) ? fr(n(C.prise_chambre_w)) : 0} W</b><span class="u">${fr(n(C.prise_chambre_kwh), 2)} kWh au total</span></div>
      </div>
      <div class="card"><h3>Multiprise</h3>
        ${C.multiprise.map((id, i) => `<div class="row"><div class="grow"><b>${C.multiprise_noms[i]}</b></div>${sw(on(id), "strip", i)}</div>`).join("")}</div>
      <div class="card">
        <h3>🤖 Robot aspirateur <span class="end">🔋 ${fr(n(C.robot_batterie))} %</span></h3>
        <div class="muted small" style="margin-bottom:10px">${robotEtat}</div>
        <select data-act="robot-scene" style="width:100%;padding:12px;border-radius:14px;border:0;background:var(--soft)">${(at(C.robot_scene, "options") || []).map((o) => `<option ${o === st(C.robot_scene) ? "selected" : ""}>${o}</option>`).join("")}</select>
        <div class="grid2" style="margin-top:12px"><button class="btn" data-act="robot-dock">⌂ Base</button><button class="btn o" data-act="robot-start">▶ Lancer</button></div>
      </div>
      <div class="card">
        <h3>🔊 HomePod salon <span class="end">${playing ? "Lecture" : "En pause"}</span></h3>
        <div class="flexrow"><button class="round" data-act="media-play" style="background:var(--orange);color:#fff">${playing ? "⏸" : "▶"}</button>
          <div><b>${at(hp, "media_title") || "—"}</b><div class="muted small">${at(hp, "media_artist") || ""}</div></div></div>
        <input type="range" min="0" max="100" value="${Math.round((at(hp, "volume_level") || 0) * 100)}" data-act="media-vol" aria-label="Volume" style="width:100%;margin-top:14px;accent-color:var(--orange)">
      </div>`;
  }

  // ─── Analyse
  let periode = "semaine";
  function pageAnalyse() {
    const P = PERIODES[periode]();
    const max = Math.max(...P.data);
    const j = bilanJour();
    const many = P.data.length > 8;
    const parts = [
      { k: "Solaire direct", ic: "☀️", v: j.solDirect, c: "#e8711a" },
      { k: "Batterie", ic: "🔋", v: j.dch, c: "#3a7bec" },
      { k: "Réseau", ic: "⚡", v: j.imp, c: "#1f9d55" },
    ];
    const tot = parts.reduce((a, p) => a + p.v, 0);
    // Anneau (donut) avec 2px d'écart entre les parts
    let a0 = -Math.PI / 2;
    const R = 62, r = 34, cx = 75, cy = 75;
    const arcs = parts.map((p) => {
      const a1 = a0 + (p.v / tot) * 2 * Math.PI, gap = 0.03;
      const s = a0 + gap / 2, e = a1 - gap / 2, large = e - s > Math.PI ? 1 : 0;
      const pt = (rad, ang) => `${cx + rad * Math.cos(ang)} ${cy + rad * Math.sin(ang)}`;
      const mid = (s + e) / 2;
      const out = `<path d="M${pt(R, s)} A${R} ${R} 0 ${large} 1 ${pt(R, e)} L${pt(r, e)} A${r} ${r} 0 ${large} 0 ${pt(r, s)} Z" fill="${p.c}"/>
        ${p.v / tot > 0.08 ? `<text x="${cx + 48 * Math.cos(mid)}" y="${cy + 48 * Math.sin(mid)}">${fr((p.v / tot) * 100)} %</text>` : ""}`;
      a0 = a1;
      return out;
    }).join("");
    return `
      <div class="bar-top"><div><h1>Analyse</h1><div class="sub">Production, économies et origine de l'énergie</div></div></div>
      <div class="wrap">
        <div class="seg" style="margin-bottom:14px">${[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"]].map(([k, l]) => `<button class="${periode === k ? "on" : ""}" data-per="${k}">${l}</button>`).join("")}</div>
        <div class="card">
          <div class="kpi"><b>${fr(P.total, 1)}</b><span class="u">${P.titre}</span>${P.evol != null ? `<span class="tag">+${P.evol} % vs avant</span>` : ""}</div>
          <div class="bars" style="grid-template-columns:repeat(${P.data.length},1fr)">
            ${P.data.map((v, i) => `<div class="b ${i === P.hi ? "hi" : ""}" title="${P.labels[i]} : ${fr(v, 1)} kWh">${!many || i === P.hi ? `<span class="v">${fr(v, v < 100 ? 1 : 0)}</span>` : ""}<i style="height:${(v / max) * 100}%"></i><span class="d">${P.labels[i]}</span></div>`).join("")}
          </div>
        </div>
        <div class="grid3" style="margin-bottom:14px">
          <div class="mini"><b>16,80 €</b><span>Semaine</span><em>+16 %</em></div>
          <div class="mini"><b>62,40 €</b><span>Mois</span><em>+12 %</em></div>
          <div class="mini"><b>518 €</b><span>Année</span><em>+28 %</em></div>
        </div>
        <div class="card" style="overflow:hidden">
          <h3>D'où vient ton énergie <span class="end">aujourd'hui</span></h3>
          <div class="kpi" style="margin-bottom:10px"><b style="color:var(--txt);font-size:1.9rem">${fr(tot, 1)}</b><span class="u">kWh consommés</span></div>
          <div class="donut-wrap">
            <div class="lst">${parts.map((p) => `<div class="it"><span class="ic">${p.ic}</span><div><span>${p.k} (${fr((p.v / tot) * 100)} %)</span><b>${fr(p.v, 1)} kWh</b></div></div>`).join("")}</div>
            <svg class="donut" viewBox="0 0 150 150" role="img" aria-label="Origine de l'énergie consommée">${arcs}</svg>
          </div>
        </div>
        <div class="card">
          <h3>Production sur 12 mois <span class="end">${new Date().getFullYear()}</span></h3>
          ${curve("annee", { labels: MOIS, data: ANNEE, unit: "kWh", hi: new Date().getMonth() })}
        </div>
        <p class="demo-note">Les historiques de cette page sont des exemples en attendant Home Assistant.</p>
      </div>`;
  }

  // ─── Actions
  const stepNum = (id, d, step, lo, hi) => clamp(n(id) + step * d, lo, hi);
  const A = {
    "car-refresh": () => call("button.press", C.voiture_rafraichir, () => set(C.voiture_maj, new Date().toISOString())),
    "car-charge": () => call(`switch.turn_${on(C.voiture_en_charge) ? "off" : "on"}`, C.voiture_en_charge, () => toggle(C.voiture_en_charge)),
    "car-lock": () => {
      if (st(C.voiture_verrou) !== "locked") return call("lock.lock", C.voiture_verrou, () => set(C.voiture_verrou, "locked"));
      twoTap("unlock", "Appuie encore pour déverrouiller", () => call("lock.unlock", C.voiture_verrou, () => set(C.voiture_verrou, "unlocked")));
    },
    "car-clim": () => call("switch.toggle", C.voiture_clim, () => toggle(C.voiture_clim)),
    "car-mode": (el) => call("input_select.select_option", C.voiture_mode_recharge, () => set(C.voiture_mode_recharge, el.dataset.i), ` ${el.dataset.i}`),
    "car-hc": () => call("switch.toggle", C.voiture_heures_creuses, () => toggle(C.voiture_heures_creuses)),
    "car-prog": () => call("switch.toggle", C.voiture_programmee, () => toggle(C.voiture_programmee)),
    "car-lim": (el) => { const v = stepNum(C.voiture_limite_pct, +el.dataset.d, 10, 50, 100); call("number.set_value", C.voiture_limite_pct, () => set(C.voiture_limite_pct, v), ` ${v}`); },
    "car-limdc": (el) => { const v = stepNum(C.voiture_limite_dc_pct, +el.dataset.d, 10, 50, 100); call("number.set_value", C.voiture_limite_dc_pct, () => set(C.voiture_limite_dc_pct, v), ` ${v}`); },
    "car-service": () => call("input_number.set_value", C.entretien_dernier_km, () => set(C.entretien_dernier_km, n(C.voiture_odometre))),
    "car-service-km": () => {
      const v = parseInt(prompt("Kilométrage de l'entretien :", n(C.entretien_dernier_km)), 10);
      if (Number.isFinite(v)) call("input_number.set_value", C.entretien_dernier_km, () => set(C.entretien_dernier_km, v), ` ${v}`);
    },
    light: (el) => { const id = C.lumieres[el.dataset.i]; call("light.toggle", id, () => toggle(id)); },
    "lights-off": () => call("light.turn_off", "toutes les lumières", () => C.lumieres.forEach((id) => set(id, "off"))),
    cover: (el) => { const id = C.volets[el.dataset.i], p = +el.dataset.d; call("cover.set_cover_position", id, () => set(id, p ? "open" : "closed", { current_position: p }), ` ${p}`); },
    covers: (el) => { const p = +el.dataset.i; call("cover.set_cover_position", "tous les volets", () => C.volets.forEach((id) => set(id, p ? "open" : "closed", { current_position: p })), ` ${p}`); },
    plug: () => call("switch.toggle", C.prise_chambre, () => toggle(C.prise_chambre)),
    strip: (el) => { const id = C.multiprise[el.dataset.i]; call("switch.toggle", id, () => toggle(id)); },
    "robot-start": () => call("vacuum.start", C.robot, () => set(C.robot, "cleaning")),
    "robot-dock": () => call("vacuum.return_to_base", C.robot, () => set(C.robot, "returning")),
    "media-play": () => call("media_player.media_play_pause", C.homepod, () => toggle(C.homepod, "playing", "paused")),
    stove: () => call("climate.set_hvac_mode", C.poele, () => toggle(C.poele, "heat", "off")),
    "stove-temp": (el) => { const v = clamp(at(C.poele, "temperature") + 0.5 * +el.dataset.d, 15, 25); call("climate.set_temperature", C.poele, () => set(C.poele, st(C.poele), { temperature: v }), ` ${v}°`); },
    "stove-pow": (el) => call("number.set_value", C.poele_puissance, () => set(C.poele_puissance, el.dataset.i), ` ${el.dataset.i}`),
    "pellet-fill": () => twoTap("fill", "Appuie encore pour confirmer le sac versé", () =>
      call("script.turn_on", C.script_remplir, () => { set(C.tremie_kg, Math.min(n(C.tremie_kg) + 15, at(C.tremie_kg, "max") || 15)); set(C.stock_kg, Math.max(0, n(C.stock_kg) - 15)); })),
    "pellet-buy": () => call("script.turn_on", C.script_achat, () => set(C.stock_kg, n(C.stock_kg) + 15)),
    rad: (el) => { const id = C.radiateurs[el.dataset.i]; call("climate.set_hvac_mode", id, () => toggle(id, "heat", "off")); },
    "rad-temp": (el) => { const id = C.radiateurs[el.dataset.i]; const v = clamp(at(id, "temperature") + 0.5 * +el.dataset.d, 5, 28); call("climate.set_temperature", id, () => set(id, st(id), { temperature: v }), ` ${v}°`); },
    "boiler-boost": () => { const v = n(C.ballon_boost) === 1 ? 0 : 1; call("number.set_value", C.ballon_boost, () => { set(C.ballon_boost, v); set(C.ballon_chauffe, v ? "on" : "off"); }, ` ${v}`); },
  };
  document.addEventListener("click", (ev) => {
    const go = ev.target.closest("[data-go]");
    if (go) { if (go.dataset.gosub) sousMaison = go.dataset.gosub; return show(go.dataset.go); }
    const sub = ev.target.closest("[data-sub]");
    if (sub) { sousMaison = sub.dataset.sub; return render(); }
    const per = ev.target.closest("[data-per]");
    if (per) { periode = per.dataset.per; return render(); }
    const el = ev.target.closest("[data-act]");
    if (!el || el.tagName === "SELECT" || el.type === "range") return;
    A[el.dataset.act] && A[el.dataset.act](el);
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset.act === "robot-scene") call("select.select_option", C.robot_scene, () => set(C.robot_scene, el.value), ` ${el.value}`);
    if (el.dataset.act === "media-vol") call("media_player.volume_set", C.homepod, () => set(C.homepod, st(C.homepod), { volume_level: el.value / 100 }), ` ${el.value} %`);
  });

  // ─── Navigation et rendu
  const PAGES = { accueil: pageAccueil, flux: pageFlux, voiture: pageVoiture, maison: pageMaison, analyse: pageAnalyse };
  let current = "accueil";
  try { const s = localStorage.getItem("voltia-v3-page"); if (PAGES[s]) current = s; } catch (e) {}
  function show(name) {
    current = name;
    try { localStorage.setItem("voltia-v3-page", name); } catch (e) {}
    document.querySelectorAll(".tabbar [data-go]").forEach((b) => b.classList.toggle("on", b.dataset.go === name));
    followIndicator();
    render();
    window.scrollTo({ top: 0 });
  }
  // L'indicateur orange suit l'onglet actif pendant que la barre se réorganise
  const tabbar = document.querySelector(".tabbar"), ind = tabbar.querySelector(".ind");
  let followUntil = 0, firstPlace = true;
  function placeIndicator() {
    const b = tabbar.querySelector("button.on");
    if (!b) return;
    ind.style.width = `${b.offsetWidth}px`;
    ind.style.transform = `translateX(${b.offsetLeft}px)`;
  }
  function followIndicator() {
    if (firstPlace) { firstPlace = false; ind.style.transition = "none"; placeIndicator(); return; }
    ind.style.transition = "";
    followUntil = performance.now() + 600;
    const loop = (t) => { placeIndicator(); if (t < followUntil) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  window.addEventListener("resize", placeIndicator);
  if (document.fonts) document.fonts.ready.then(placeIndicator);
  tabbar.addEventListener("click", (ev) => { if (ev.target.closest("button") && navigator.vibrate) navigator.vibrate(8); });
  // La barre se cache quand on descend dans la page et revient dès qu'on remonte
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY, bottom = y + innerHeight >= document.documentElement.scrollHeight - 40;
    if (y > lastY + 6 && y > 80 && !bottom) tabbar.classList.add("hide");
    else if (y < lastY - 6 || y < 80 || bottom) tabbar.classList.remove("hide");
    lastY = y;
  }, { passive: true });

  function render() {
    const el = document.getElementById("page");
    el.innerHTML = PAGES[current]();
    el.className = "page on";
  }
  show(current);
})();
