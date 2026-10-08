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
    mois: () => {
      // Une barre par jour du mois : les jours passés (démo), puis la prévision jusqu'à la fin du mois
      const now = new Date(), y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
      const nb = new Date(y, m + 1, 0).getDate();
      const base = [210, 290, 480, 620, 760, 820, 850, 780, 590, 420, 250, 190][m] / nb;
      const data = Array.from({ length: nb }, (_, k) => {
        if (k + 1 === today) return n(C.production_jour_kwh);
        const meteo = 0.55 + 0.45 * Math.abs(Math.sin((k + 1) * 1.7 + m)) + (k % 7 === 3 ? -0.35 : 0);
        return +(base * clamp(meteo, 0.25, 1.25) * (k + 1 > today ? 0.92 : 1)).toFixed(1);
      });
      const past = data.slice(0, today);
      const total = past.reduce((a, b) => a + b, 0);
      const best = past.indexOf(Math.max(...past));
      return { titre: `kWh en ${MOIS_LONG[m]}`, total, evol: 6, evolTxt: "vs mois dernier à date", labels: data.map((_, k) => `${k + 1}`), data, hi: today - 1, fut: today,
        avg: total / today, best, proj: total + data.slice(today).reduce((a, b) => a + b, 0), nb, mName: MOIS_LONG[m] };
    },
    annee: () => { const d = [210, 290, 480, 620, 760, 820, 850, 780, 590, 420, 250, 190];
      return { titre: "kWh cette année", total: d.slice(0, new Date().getMonth() + 1).reduce((a, b) => a + b, 0), evol: 9, labels: MOIS.map((m) => m[0]), data: d, hi: new Date().getMonth() }; },
  };
  const ANNEE = PERIODES.annee().data;
  const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const INJ_ANNEE = [20, 45, 110, 180, 250, 280, 300, 260, 160, 80, 25, 10]; // injection réseau par mois (démo)
  const CONSO_ANNEE = [610, 540, 500, 420, 380, 350, 360, 370, 400, 470, 560, 640]; // conso réelle maison + voiture (démo)
  // Achats réseau par plage tarifaire (démo) : le reste de la conso vient du soleil et de la batterie
  const RESEAU_ANNEE = CONSO_ANNEE.map((c, i) => Math.max(20, c - Math.min(ANNEE[i] - INJ_ANNEE[i], c)));
  const PLAGES_ANNEE = RESEAU_ANNEE.map((g) => ({ hsc: Math.round(g * 0.55), hc: Math.round(g * 0.2), hp: g - Math.round(g * 0.55) - Math.round(g * 0.2) }));

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
  let ringId = 0;
  const ring = (v, label, c = "var(--green)", cls = "", lim, grad) => {
    const R = 42, P = 2 * Math.PI * R, gid = `rg${++ringId}`;
    return `<div class="ring ${cls}" style="--c:${grad ? `url(#${gid})` : c}"><svg viewBox="0 0 100 100">${grad ? `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${grad[0]}"/><stop offset="1" stop-color="${grad[1]}"/></linearGradient></defs>` : ""}<circle class="b" cx="50" cy="50" r="${R}"/>
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
    sun: SV('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    grid: SV('<path d="M8 22 12 2l4 20M6.5 9h11M5 15h14M9.5 15 12 9l2.5 6"/>'),
    bolt: SV('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    bulb: SV('<path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/><path d="M9 18h6M10 21h4"/>'),
    blinds: SV('<path d="M4 3h16M5 3v18M19 3v18M5 7h14M5 11h14M5 15h14"/><circle cx="12" cy="19" r="1"/>'),
    robot: SV('<rect x="4" y="8" width="16" height="12" rx="4"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5"/>'),
    speaker: SV('<rect x="5" y="2" width="14" height="20" rx="3"/><circle cx="12" cy="14" r="4"/><path d="M12 6h.01"/>'),
    therm: SV('<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 11v6"/>'),
    drop: SV('<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>'),
    lock: SV('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    unlock: SV('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/>'),
    snow: SV('<path d="M12 2v20M4.9 7l14.2 10M4.9 17 19.1 7M9 4l3 2 3-2M9 20l3-2 3 2"/>'),
    refresh: SV('<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>'),
    wrench: SV('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
    clock: SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    leaf: SV('<path d="M5 21c0-9 5-15 15-16-1 10-7 15-15 16z"/><path d="M5 21 13 13"/>'),
    sack: SV('<path d="M8 4h8l-2 4c3 2 5 5 5 9a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4c0-4 2-7 5-9z"/>'),
    up: SV('<path d="m6 15 6-6 6 6"/>'),
    down: SV('<path d="m6 9 6 6 6-6"/>'),
    check: SV('<path d="m5 12 5 5 9-10"/>'),
    play: SV('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
    pause: SV('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>'),
    dock: SV('<path d="M3 20h18M7 20v-4a5 5 0 0 1 10 0v4"/>'),
    gauge: SV('<path d="M12 14l4-4"/><path d="M3.3 17a9 9 0 1 1 17.4 0"/>'),
    euro: SV('<path d="M17 6a7 7 0 1 0 0 12M4 10h9M4 14h9"/>'),
    chart: SV('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  };
  // Pastille d'icône teintée, en-tête de page, en-tête de carte, titre de section
  const chip = (icon, c, cls = "") => `<span class="chip-ic ${cls}" style="--c:${c}">${ICONS[icon]}</span>`;
  const head = (eyebrow, title, right = "") => `<header class="ph"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>${right ? `<div class="ph-r">${right}</div>` : ""}</header>`;
  const ch = (icon, c, title, sub = "", meta = "") => `<div class="ch">${chip(icon, c)}<div class="ch-t"><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div>${meta ? `<div class="ch-m">${meta}</div>` : ""}</div>`;
  const sec = (title, meta = "") => `<div class="sec-h"><h2>${title}</h2>${meta ? `<span>${meta}</span>` : ""}</div>`;
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
  function curve(id, { labels, series, unit, hi = -1 }) {
    const W = 320, Hh = 120, PT = 14, PB = 18;
    const max = Math.max(...series.flatMap((se) => se.data)) * 1.12;
    const len = labels.length;
    const xs = (i) => 8 + (i * (W - 16)) / (len - 1);
    const ys = (v) => PT + (1 - v / max) * (Hh - PT - PB);
    CHARTS[id] = { labels, series, unit, xs, ys, W, H: Hh, len };
    const body = series.map((se, k) => {
      const d = smooth(se.data.map((v, i) => [xs(i), ys(v)]));
      return `<defs><linearGradient id="g-${id}-${k}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${se.color}" stop-opacity="${se.fill ?? 0.16}"/><stop offset="1" stop-color="${se.color}" stop-opacity="0"/></linearGradient></defs>
        <path d="${d} L${xs(len - 1)} ${Hh - PB} L${xs(0)} ${Hh - PB} Z" fill="url(#g-${id}-${k})"/>
        <path d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linecap="round" ${se.dash ? `stroke-dasharray="${se.dash}"` : ""}/>
        ${hi >= 0 ? `<circle cx="${xs(hi)}" cy="${ys(se.data[hi])}" r="4.5" fill="#fff" stroke="${se.color}" stroke-width="2"/>` : ""}`;
    }).join("");
    return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${series.map((se) => se.name).join(" et ")} en ${unit}">
      ${body}
      ${labels.map((l, i) => `<text class="ax" x="${xs(i)}" y="${Hh - 3}" text-anchor="middle">${l}</text>`).join("")}
      <line class="cross" y1="${PT}" y2="${Hh - PB}" stroke="var(--faint)" stroke-dasharray="2 3" style="display:none"/>
      ${series.map((se) => `<circle class="dotc" r="4.5" fill="${se.color}" stroke="#fff" stroke-width="2" style="display:none"/>`).join("")}
      </svg><div class="tip"></div></div>`;
  }
  document.addEventListener("pointermove", (ev) => {
    const box = ev.target.closest && ev.target.closest(".chart");
    document.querySelectorAll(".chart .tip.on").forEach((t) => {
      if (box && box.contains(t)) return;
      t.classList.remove("on");
      t.parentNode.querySelector(".cross").style.display = "none";
      t.parentNode.querySelectorAll(".dotc").forEach((d) => (d.style.display = "none"));
    });
    if (!box) return;
    const c = CHARTS[box.dataset.chart], svg = box.querySelector("svg"), r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * c.W;
    let i = 0, best = Infinity;
    for (let k = 0; k < c.len; k++) { const d = Math.abs(c.xs(k) - x); if (d < best) { best = d; i = k; } }
    const cross = svg.querySelector(".cross");
    cross.setAttribute("x1", c.xs(i)); cross.setAttribute("x2", c.xs(i)); cross.style.display = "";
    svg.querySelectorAll(".dotc").forEach((d, k) => { d.setAttribute("cx", c.xs(i)); d.setAttribute("cy", c.ys(c.series[k].data[i])); d.style.display = ""; });
    const tip = box.querySelector(".tip");
    const top = Math.min(...c.series.map((se) => c.ys(se.data[i])));
    tip.innerHTML = `<b>${c.labels[i]}</b>${c.series.map((se) => `<div class="trow"><span class="tdot" style="--c:${se.color}"></span>${se.name}<b>${fr(se.data[i])} ${c.unit}</b></div>${se.detail ? se.detail(i).map(([l, v]) => `<div class="tsub"><span>${l}</span><b>${fr(v)}</b></div>`).join("") : ""}`).join("")}`;
    const left = i < c.len / 2;
    tip.style.left = `${(c.xs(i) / c.W) * 100}%`;
    tip.style.transform = `translate(${left ? "10px" : "calc(-100% - 10px)"}, -50%)`;
    tip.style.top = `${(top / c.H) * 100}%`;
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
</div>
        <div class="status"><i></i><span>Système en ligne · ${e.solar > 3000 ? "Forte production" : e.solar > 200 ? "Production" : "Nuit"}</span><span>MAJ ${hhmm(now)}</span></div>
        <div class="big"><b><span data-count="${e.solar / 1000}" data-dec="2">${kw(e.solar)}</span><small>kW</small></b>
          <div class="side">Production en cours<br>Pic ${fr(PROD_H[peakI], 2)} kW à ${HOURS[peakI]}h</div></div>
        <div class="spark-wrap">
          <svg class="spark" viewBox="0 0 ${W} ${Hs}" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
              <clipPath id="past"><rect x="0" y="-10" width="${pts[hi][0]}" height="${Hs + 20}"/></clipPath>
              <clipPath id="future"><rect x="${pts[hi][0]}" y="-10" width="${W}" height="${Hs + 20}"/></clipPath>
            </defs>
            <path d="${smooth(pts)} L${W} ${Hs} L0 ${Hs} Z" fill="url(#sparkFill)" clip-path="url(#past)"/>
            <path d="${smooth(pts)}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" clip-path="url(#past)" vector-effect="non-scaling-stroke"/>
            <path d="${smooth(pts)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round" clip-path="url(#future)" vector-effect="non-scaling-stroke"/>
          </svg>
          <span class="now-dot" style="left:${(hi / (PROD_H.length - 1)) * 100}%;top:${pts[hi][1]}px"></span>
          <span class="now-lbl" style="left:clamp(44px, ${(hi / (PROD_H.length - 1)) * 100}%, calc(100% - 44px));top:${pts[hi][1]}px">maintenant</span>
        </div>
      </div>
      <div class="wrap lift">
        <div class="card glass stats">
          <div><b><span data-count="${j.prod}" data-dec="1">${fr(j.prod, 1)}</span><small>kWh</small></b><div class="l">Produit</div></div>
          <div><b><span data-count="${j.conso}" data-dec="1">${fr(j.conso, 1)}</span><small>kWh</small></b><div class="l">Consommé</div></div>
          <div><b><span data-count="${n(C.economies_jour_eur)}" data-dec="2">${fr(n(C.economies_jour_eur), 2)}</span><small>€</small></b><div class="l">Économisé</div></div>
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
      { k: "Maison", ic: "home", c: "#e8711a", w: e.house, p: `${share(e.house)} %` },
      { k: "Batterie", ic: "bat", c: "#3a7bec", w: Math.abs(e.bat), p: e.bat >= 0 ? `${share(e.bat)} %` : "décharge", rev: e.bat < 0 },
      { k: "Réseau", ic: "grid", c: "#1f9d55", w: Math.abs(e.grid), p: e.grid < 0 ? `${share(e.grid)} %` : "achat", rev: e.grid > 0 },
      { k: "e-Niro", ic: "car", c: "#8a5cf6", w: e.car, p: `${share(e.car)} %` },
    ];
    const xs = [45, 135, 225, 315];
    const sess = new Date(st(C.session_debut));
    const events = [
      { h: "06:12", c: "#e8711a", t: "Début de la production", s: "Premiers rayons · 0,12 kW" },
      { h: "08:45", c: "#3a7bec", t: "La batterie commence à charger", s: "Surplus solaire · batterie à 42 %" },
      on(C.voiture_branchee) && { h: hhmm(sess), c: "#8a5cf6", t: "e-Niro branchée", s: `Batterie à ${fr(n(C.voiture_soc) - n(C.session_soc))} %` },
      { h: "10:20", c: "#1f9d55", t: "Début de la revente", s: "Maison et batterie servies · surplus revendu" },
      { h: "12:48", c: "#e8711a", t: "Pic de production", s: "5,20 kW · meilleure heure 12h – 13h" },
      { h: hhmm(new Date()), c: "var(--txt)", now: true, t: "Maintenant", s: `${Wt(e.solar)} produits · batterie ${fr(n(C.batterie_soc))} % · ${e.grid < 0 ? `revente ${Wt(-e.grid)}` : `achat ${Wt(e.grid)}`}` },
    ].filter(Boolean);
    return `
      ${head("Temps réel", "Flux d'énergie", `<span class="live">En direct</span>`)}
      <div class="wrap">
        <div class="sun"><div class="orb">${ICONS.sun}</div>
          <b><span data-count="${e.solar / 1000}" data-dec="2">${kw(e.solar)}</span><small>kW</small></b><div class="eyebrow" style="margin-top:2px">Production · 3 onduleurs</div></div>
        <svg class="tree" viewBox="0 0 360 70" preserveAspectRatio="none" aria-hidden="true">
          ${N.map((d, i) => `<path class="bg" d="M180 0 C180 40 ${xs[i]} 30 ${xs[i]} 70"/>
            <path class="go ${d.rev ? "rev" : ""}" stroke="${d.c}" d="M180 0 C180 40 ${xs[i]} 30 ${xs[i]} 70" style="${d.w < 15 ? "display:none" : `animation-duration:${clamp(2.2 - d.w / 1500, 0.5, 2.2)}s`}"/>`).join("")}
        </svg>
        <div class="nodes">${N.map((d) => `<div class="node" style="--c:${d.c}">${chip(d.ic, d.c, "sm")}<div class="n">${d.k}</div><b>${kw(d.w)}<small>kW</small></b><div class="p">${d.p}</div></div>`).join("")}</div>

        <div class="card" style="margin-top:14px">
          <div class="flexrow">${ring(autosuff, `<span>${fr(autosuff)}<small style="font-size:.7rem;font-weight:500"> %</small></span>`, "", "", null, ["#7fd3a4", "#1f9d55"])}
            <div><div class="eyebrow">Aujourd'hui</div><b style="font-size:1.05rem;letter-spacing:-.02em">Autosuffisance</b><div class="muted small" style="margin-top:2px">Seulement <b style="color:var(--txt)">${fr(j.imp, 1)} kWh</b> achetés au réseau, le reste vient du soleil et de la batterie.</div></div></div>
        </div>

        <div class="card">
          ${ch("clock", "#e8711a", "Journée", "Ce qui s'est passé aujourd'hui")}
          <div class="timeline">${events.map((ev) => `<div class="tl ${ev.now ? "now" : ""}" style="--c:${ev.c}"><div class="h">${ev.h}</div><i></i><div><b>${ev.t}</b><span>${ev.s}</span></div></div>`).join("")}</div>
        </div>

        <div class="card">
          ${ch("sun", "#e8711a", "Onduleurs", "Production par appareil", `${Wt(e.solar)}`)}
          ${C.onduleurs_w.map((id, i) => { const max = [2000, 2000, 1000][i]; return `<div class="inv"><div class="inv-t"><b>${C.onduleurs_noms[i]}</b><span>${fr((n(id) / max) * 100)} % de sa capacité</span></div><b class="num">${Wt(n(id))}</b></div>
            ${prog((n(id) / max) * 100)}`; }).join("")}
        </div>
      </div>`;
  }

  // ─── Statistiques de recharge par source (démo ; plus tard : historique HA × plages tarifaires)
  const SOURCES = [
    { k: "sol", nom: "Soleil", ic: "☀️", c: "#e8711a", tarif: () => 0 },
    { k: "hsc", nom: "Super creuses", ic: "🌙", c: "#1f9d55", tarif: () => n(C.tarif_hsc) },
    { k: "hc", nom: "Heures creuses", ic: "🌗", c: "#3a7bec", tarif: () => n(C.tarif_hc) },
    { k: "hp", nom: "Heures pleines", ic: "⚡", c: "#b8336a", tarif: () => n(C.tarif_hp) },
  ];
  const CHARGES = {
    jour: () => ({ titre: "aujourd'hui", labels: Array.from({ length: 12 }, (_, i) => `${i * 2}h`),
      sol: [0, 0, 0, 0, 0, 1.6, 2.6, 2.0, 0.6, 0, 0, 0], hsc: Array(12).fill(0), hc: Array(12).fill(0), hp: [0, 0, 0, 0, 1.4, 0, 0, 0, 0, 0.7, 0, 0] }),
    semaine: () => ({ titre: "cette semaine", labels: Array.from({ length: 7 }, (_, i) => (i === 6 ? "Auj." : dayName(6 - i))),
      sol: [8.2, 0, 12.5, 6.1, 0, 9.8, 6.8], hsc: [0, 5.2, 0, 0, 4.1, 0, 0], hc: [1.4, 1.6, 0, 0.8, 1.5, 0, 0], hp: [0.7, 0.6, 0, 0.4, 0, 0, 2.1] }),
    mois: () => ({ titre: "ce mois-ci", labels: ["S1", "S2", "S3", "S4"],
      sol: [31.2, 38.6, 27.4, 43.4], hsc: [9.3, 4.1, 12.8, 9.3], hc: [3.2, 5.0, 2.1, 5.3], hp: [1.9, 0.8, 3.4, 3.8] }),
    annee: () => ({ titre: "cette année", labels: MOIS.map((m) => m[0]),
      sol: [40, 62, 98, 130, 158, 170, 176, 160, 120, 84, 48, 34], hsc: [62, 55, 38, 22, 12, 8, 6, 10, 24, 40, 58, 66],
      hc: [18, 15, 10, 6, 3, 2, 2, 3, 7, 12, 16, 20], hp: [9, 7, 5, 3, 2, 1, 1, 2, 4, 6, 8, 10] }),
  };
  let chargePer = "semaine";
  function chargeStats() {
    const D = CHARGES[chargePer]();
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    const tot = SOURCES.map((s) => ({ ...s, kwh: sum(D[s.k]) }));
    const total = sum(tot.map((t) => t.kwh)) || 1;
    const cout = sum(tot.map((t) => t.kwh * t.tarif()));
    const toutHP = total * n(C.tarif_hp);
    const colTot = D.labels.map((_, i) => sum(SOURCES.map((s) => D[s.k][i])));
    const max = Math.max(...colTot) || 1;
    const many = D.labels.length > 8;
    return `
        ${sec("Recharges", "par source d'énergie")}
        <div class="seg" style="margin-bottom:12px">${[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"]].map(([k, l]) => `<button class="${chargePer === k ? "on" : ""}" data-cper="${k}">${l}</button>`).join("")}</div>
        <div class="card">
          <div class="kpi"><b style="color:var(--txt)">${fr(total, total >= 100 ? 0 : 1)}</b><span class="u">kWh ${D.titre}</span><span class="tag">${fr((tot[0].kwh / total) * 100)} % soleil</span></div>
          <div class="sbars" style="grid-template-columns:repeat(${D.labels.length},1fr)" role="img" aria-label="Recharges par source ${D.titre}">
            ${D.labels.map((l, i) => `<div class="sb ${many ? "thin" : ""}" title="${l} : ${SOURCES.map((s) => `${s.nom} ${fr(D[s.k][i], 1)} kWh`).join(" · ")}">
              <div class="stack" style="height:${(colTot[i] / max) * 100}%">${SOURCES.map((s) => D[s.k][i] > 0 ? `<i style="flex:${D[s.k][i]};background:${s.c}"></i>` : "").join("")}</div>
              <span>${l}</span></div>`).join("")}
          </div>
          <div class="srcs">${tot.map((t) => `
            <div class="src" style="--c:${t.c}"><span class="sic">${t.ic}</span>
              <div class="sn"><b>${t.nom}</b><span>${t.k === "sol" ? "gratuit" : `${fr(t.tarif(), 4)} €/kWh`}</span></div>
              <div class="sv"><b>${fr(t.kwh, t.kwh >= 100 ? 0 : 1)} kWh</b><span>${fr((t.kwh / total) * 100)} %${t.k === "sol" ? "" : ` · ${fr(t.kwh * t.tarif(), 2)} €`}</span></div>
              <i class="sp" style="width:${(t.kwh / total) * 100}%"></i></div>`).join("")}</div>
          <div class="sfoot">
            <div><span>Coût des recharges</span><b>${fr(cout, 2)} €</b></div>
            <div><span>Économisé vs tout en HP</span><b style="color:var(--green)">${fr(toutHP - cout, 2)} €</b></div>
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
    const fin = new Date(Date.now() + n(C.voiture_minutes_restantes) * 60e3);
    const act = (icon, label, a, cls = "", dis = false) => `<div class="act"><button class="${cls}" data-act="${a}" ${dis ? "disabled" : ""} aria-label="${label}">${ICONS[icon]}</button><span>${label}</span></div>`;
    return `
      ${head(`Mis à jour ${ago(st(C.voiture_maj))}`, "Kia e-Niro", charging ? `<span class="live" style="--lc:#8a5cf6">En charge</span>` : `<span class="pill-n">${plugged ? "Branchée" : "Débranchée"}</span>`)}
      <div class="wrap">
        <div class="card car-hero">
          <div class="car-ring">${ring(soc, `<div><span data-count="${soc}">${fr(soc)}</span><span style="font-size:1rem;font-weight:500"> %</span></div><small>${fr(n(C.voiture_autonomie_km))} km</small>`, "", "lg", lim, ["#b9a2ff", "#7c4dff"])}</div>
          <div class="car-meta">
            <div><span class="eyebrow">${charging ? "Fin estimée" : "Limite"}</span><b>${charging ? hhmm(fin) : `${fr(lim)} %`}</b></div>
            <div><span class="eyebrow">Puissance</span><b>${charging ? Wt(n(C.voiture_charge_w)) : "—"}</b></div>
            <div><span class="eyebrow">Batterie 12 V</span><b>${fr(n(C.voiture_12v_pct))} %</b></div>
          </div>
          <div class="acts">
            ${act("bolt", charging ? "Arrêter" : "Charger", "car-charge", charging ? "on" : "", !plugged)}
            ${act(locked ? "lock" : "unlock", armed.unlock ? "Confirmer" : locked ? "Verrouillée" : "Ouverte", "car-lock", armed.unlock ? "danger" : locked ? "" : "on")}
            ${act("snow", "Clim", "car-clim", on(C.voiture_clim) ? "on" : "")}
            ${act("refresh", "Actualiser", "car-refresh")}
          </div>
        </div>

        <div class="card">
          ${ch("bolt", "#8a5cf6", "Cette charge", `depuis ${hhmm(new Date(st(C.session_debut)))}`, `<span class="tag-g">${fr((sol / (sol + res)) * 100)} % soleil</span>`)}
          <div class="kpi" style="margin:4px 0 14px"><b style="color:#7c4dff">+${fr(n(C.session_soc))} %</b><span class="u">${fr(sol + res, 1)} kWh ajoutés</span></div>
          ${splitbar([{ v: sol, c: "var(--orange)" }, { v: res, c: "var(--green)" }])}
          <div class="legend3" style="grid-template-columns:1fr 1fr">
            <div><span style="--c:var(--orange)">Soleil · ${Wt(n(C.ve_solaire_w))}</span><b>${fr(sol, 1)} kWh</b></div>
            <div style="text-align:right"><span style="--c:var(--green)">Réseau · ${Wt(n(C.ve_reseau_w))}</span><b>${fr(res, 1)} kWh</b></div>
          </div>
        </div>

${chargeStats()}

        ${sec("Réglages", "recharge")}
        <div class="card list">
          <div class="li">${chip("home", "#e8711a")}<div class="li-t"><b>Limite à la maison</b><span>recharge AC</span></div>${stepper(`${fr(lim)} %`, "car-lim")}</div>
          <div class="li">${chip("bolt", "#8a5cf6")}<div class="li-t"><b>Recharge rapide</b><span>limite DC</span></div>${stepper(`${fr(n(C.voiture_limite_dc_pct))} %`, "car-limdc")}</div>
          <div class="li">${chip("clock", "#3a7bec")}<div class="li-t"><b>Heures creuses seulement</b><span>ne charge qu'en HC</span></div>${sw(on(C.voiture_heures_creuses), "car-hc")}</div>
          <div class="li">${chip("gauge", "#1f9d55")}<div class="li-t"><b>Charge programmée</b><span>horaire de la voiture</span></div>${sw(on(C.voiture_programmee), "car-prog")}</div>
        </div>

        <div class="card">
          ${ch("wrench", "#8a5cf6", "Entretien", `tous les ${fr(C.entretien_intervalle_km)} km`, `${fr(odo)} km`)}
          <div class="kpi" style="margin:4px 0 12px"><b style="color:var(--txt)">${fr(Math.abs(next - odo))}</b><span class="u">km ${next - odo >= 0 ? "avant le prochain" : "de retard"}</span></div>
          ${prog(((odo - last) / C.entretien_intervalle_km) * 100, "linear-gradient(90deg,#b9a2ff,#7c4dff)")}
          <div class="grid2" style="margin-top:16px"><button class="btn" data-act="car-service">${ICONS.check} Entretien fait</button><button class="btn ghost" data-act="car-service-km">Autre km…</button></div>
          <div class="foot-row"><span>Dernier trajet ${ago(st(C.voiture_dernier_trajet))}</span><span>${fr(soc - n(C.voiture_soc_reference))} % depuis</span></div>
        </div>
      </div>`;
  }

  // ─── Maison, façon Apple Maison : pièces, tuiles, panneau du bas avec curseur vertical
  let hkFilter = null;      // null = par pièce, sinon une catégorie
  let sheet = null;         // { kind, i } du panneau ouvert
  const METEO_TXT = { sunny: "Ensoleillé", "clear-night": "Nuit claire", partlycloudy: "Éclaircies", cloudy: "Nuageux", rainy: "Pluie", pouring: "Averses", snowy: "Neige", fog: "Brouillard", windy: "Venteux", lightning: "Orage" };
  const ref = (key) => { const [r, i] = key.split(":"); return i == null ? C[r] : C[r][+i]; };
  const robotTxt = () => ({ docked: "Sur sa base", cleaning: "Nettoie", returning: "Retour à la base", idle: "En pause" }[st(C.robot)] || st(C.robot));

  // Décrit chaque accessoire : catégorie, icône, couleur quand il est actif, état lisible, action au toucher
  function acc(key) {
    const [r, ix] = key.split(":"), i = ix == null ? null : +ix;
    if (r === "lumieres") { const id = C.lumieres[i]; return { key, cat: "lumieres", ic: "bulb", c: "#f5b400", nom: C.lumieres_noms[i], on: on(id), etat: on(id) ? "Allumée" : "Éteinte", act: "light", i }; }
    if (r === "volets") { const id = C.volets[i], p = at(id, "current_position"); return { key, cat: "volets", ic: "blinds", c: "#3a7bec", nom: C.volets_noms[i], on: p > 0, etat: p === 0 ? "Fermé" : p === 100 ? "Ouvert" : `${p} % ouvert`, sheet: "volet", i }; }
    if (r === "radiateurs") { const id = C.radiateurs[i], rOn = st(id) !== "off", t = C.radiateurs_temp[i]; return { key, cat: "climat", ic: "therm", c: "#e8711a", nom: "Radiateur", on: rOn, etat: `${t ? fr(n(t), 1) : fr(at(id, "current_temperature"), 1)}° · ${rOn ? `vise ${fr(at(id, "temperature"), 1)}°` : "éteint"}`, sheet: "radiateur", i }; }
    if (r === "poele") { const pOn = st(C.poele) !== "off"; return { key, cat: "climat", ic: "flame", c: "#e5484d", nom: "Poêle à granulés", on: pOn, etat: pOn ? `${st(C.poele_statut)} · P${st(C.poele_puissance)} · ${fr(n(C.tremie_kg))} kg` : "Éteint", big: `${fr(at(C.poele, "current_temperature"), 1)}°`, sheet: "poele", wide: true }; }
    if (r === "ballon") { const ch = on(C.ballon_chauffe); return { key, cat: "climat", ic: "drop", c: "#3a7bec", nom: "Ballon d'eau chaude", on: ch || n(C.ballon_boost) === 1, etat: ch ? "Chauffe" : `${fr(n(C.ballon_temp))}° · consigne ${fr(at(C.ballon, "temperature"))}°`, sheet: "ballon" }; }
    if (r === "prise_chambre") return { key, cat: "appareils", ic: "plug", c: "#1f9d55", nom: "Prise chambre", on: on(C.prise_chambre), etat: on(C.prise_chambre) ? `${fr(n(C.prise_chambre_w))} W` : "Éteinte", act: "plug" };
    if (r === "multiprise") { const k = C.multiprise.filter(on).length; return { key, cat: "appareils", ic: "plug", c: "#1f9d55", nom: "Multiprise", on: k > 0, etat: `${k} sur ${C.multiprise.length} allumées`, sheet: "multiprise" }; }
    if (r === "robot") return { key, cat: "appareils", ic: "robot", c: "#3a7bec", nom: "Aspirateur", on: st(C.robot) === "cleaning", etat: `${robotTxt()} · ${fr(n(C.robot_batterie))} %`, sheet: "robot" };
    if (r === "homepod") { const pl = st(C.homepod) === "playing"; return { key, cat: "appareils", ic: "speaker", c: "#8a5cf6", nom: "HomePod", on: pl, etat: pl ? (at(C.homepod, "media_title") || "Lecture") : "En pause", sheet: "homepod" }; }
    return null;
  }
  function tile(a) {
    if (!a) return "";
    const iconBtn = a.act ? `data-act="${a.act}" ${a.i != null ? `data-i="${a.i}"` : ""}` : a.sheet === "volet" ? `data-act="cover-toggle" data-i="${a.i}"` : `data-sheet="${a.sheet}:${a.i ?? ""}"`;
    const body = a.sheet ? `data-sheet="${a.sheet}:${a.i ?? ""}"` : iconBtn;
    return `<div class="hk-tile ${a.on ? "on" : ""} ${a.wide ? "wide" : ""}" style="--c:${a.c}">
      <button class="hk-ic" ${iconBtn} aria-label="${a.nom}">${ICONS[a.ic]}</button>
      <button class="hk-tx" ${body}><b>${a.nom}</b><span>${a.etat}</span></button>
      ${a.big ? `<span class="hk-big">${a.big}</span>` : ""}
    </div>`;
  }
  function pageMaison() {
    const temps = C.radiateurs_temp.filter(Boolean).map((id) => n(id)).concat([at(C.poele, "current_temperature")]);
    const nbL = C.lumieres.filter(on).length, nbV = C.volets.filter((id) => at(id, "current_position") > 0).length;
    const locked = st(C.voiture_verrou) === "locked";
    const chips = [
      ["climat", "therm", "#e8711a", "Climat", `${fr(Math.min(...temps), 0)}–${fr(Math.max(...temps), 0)}°`],
      ["lumieres", "bulb", "#f5b400", "Lumières", nbL ? `${nbL} allumée${nbL > 1 ? "s" : ""}` : "Éteintes"],
      ["volets", "blinds", "#3a7bec", "Volets", `${nbV} ouvert${nbV > 1 ? "s" : ""}`],
      ["appareils", "plug", "#1f9d55", "Appareils", `${C.multiprise.filter(on).length + (on(C.prise_chambre) ? 1 : 0)} actifs`],
      ["securite", locked ? "lock" : "unlock", locked ? "#1f9d55" : "#e5484d", "Sécurité", locked ? "e-Niro fermée" : "e-Niro ouverte"],
    ];
    const allKeys = C.pieces.flatMap((p) => p.items);
    let body;
    if (hkFilter === "securite") {
      body = `<div class="hk-room"><div class="hk-rh"><h2>Sécurité</h2></div><div class="hk-grid">
        <div class="hk-tile ${locked ? "on" : ""} wide" style="--c:#1f9d55"><button class="hk-ic" data-act="car-lock">${ICONS[locked ? "lock" : "unlock"]}</button>
        <button class="hk-tx" data-act="car-lock"><b>Kia e-Niro</b><span>${armed.unlock ? "Appuie encore pour ouvrir" : locked ? "Verrouillée" : "Déverrouillée"}</span></button></div></div></div>`;
    } else if (hkFilter) {
      const list = allKeys.map(acc).filter((a) => a && a.cat === hkFilter);
      const titre = { climat: "Climat", lumieres: "Lumières", volets: "Volets", appareils: "Appareils" }[hkFilter];
      const extra = hkFilter === "lumieres" ? `<button class="hk-link" data-act="lights-off">Tout éteindre</button>`
        : hkFilter === "volets" ? `<span class="hk-links"><button class="hk-link" data-act="covers" data-i="100">Tout ouvrir</button><button class="hk-link" data-act="covers" data-i="0">Tout fermer</button></span>` : "";
      body = `<div class="hk-room"><div class="hk-rh"><h2>${titre}</h2>${extra}</div><div class="hk-grid">${list.map(tile).join("")}</div></div>`;
    } else {
      body = C.pieces.map((p) => {
        const t = p.temp ? n(ref(p.temp)) : NaN, h = p.hum ? n(ref(p.hum)) : NaN;
        return `<div class="hk-room"><div class="hk-rh"><h2>${p.nom}</h2>${Number.isFinite(t) ? `<span>${fr(t, 1)}°${Number.isFinite(h) ? ` · ${fr(h)} % HR` : ""}</span>` : ""}</div>
          <div class="hk-grid">${p.items.map((k) => tile(acc(k))).join("")}</div></div>`;
      }).join("");
    }
    return `<div class="hk-wall" aria-hidden="true"></div>
      <header class="hk-head"><div><div class="eyebrow">${METEO_TXT[st(C.meteo)] || "Dehors"} · ${fr(at(C.meteo, "temperature"))}° dehors</div><h1>Ma maison</h1></div></header>
      <div class="hk-chips">${chips.map(([k, ic, c, l, v]) => `<button class="hk-chip ${hkFilter === k ? "on" : ""}" data-hk="${k}" style="--c:${c}">${chip(ic, c, "sm")}<span><b>${l}</b><em>${v}</em></span></button>`).join("")}</div>
      ${hkFilter ? `<button class="hk-back" data-hk="">${ICONS.up} Toutes les pièces</button>` : ""}
      <div class="wrap hk">${body}</div>`;
  }

  // Panneau du bas (comme la vue détaillée d'un accessoire Apple Maison)
  function vslider(kind, i, val, min, max, step, label, color, fmt) {
    const p = ((val - min) / (max - min)) * 100;
    return `<div class="vs" data-vs="${kind}" data-i="${i}" data-min="${min}" data-max="${max}" data-step="${step}" data-val="${val}" style="--c:${color}" role="slider" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${val}" tabindex="0">
      <i style="height:${p}%"></i><b>${fmt(val)}</b></div>`;
  }
  function sheetBody() {
    if (!sheet) return "";
    const { kind } = sheet, i = sheet.i === "" ? null : +sheet.i;
    const top = (ic, c, title, sub) => `<div class="sh-top">${chip(ic, c)}<div><b>${title}</b><span>${sub}</span></div><button class="sh-x" data-close aria-label="Fermer">✕</button></div>`;
    if (kind === "volet") {
      const id = C.volets[i], p = at(id, "current_position");
      return top("blinds", "#3a7bec", C.volets_noms[i], p === 0 ? "Fermé" : p === 100 ? "Ouvert" : `Ouvert à ${p} %`)
        + `<div class="sh-mid">${vslider("volet", i, p, 0, 100, 5, "Position", "#3a7bec", (v) => `${v} %`)}</div>
        <div class="grid2"><button class="btn" data-act="cover" data-i="${i}" data-d="0">${ICONS.down} Fermer</button><button class="btn o" data-act="cover" data-i="${i}" data-d="100">${ICONS.up} Ouvrir</button></div>`;
    }
    if (kind === "radiateur") {
      const id = C.radiateurs[i], rOn = st(id) !== "off", t = C.radiateurs_temp[i], h = C.radiateurs_hum[i];
      return top("therm", "#e8711a", `Radiateur ${C.radiateurs_noms[i].toLowerCase()}`, `${t ? fr(n(t), 1) : fr(at(id, "current_temperature"), 1)}° dans la pièce${h ? ` · ${fr(n(h))} % HR` : ""}`)
        + `<div class="sh-mid">${rOn ? vslider("radiateur", i, at(id, "temperature"), 5, 28, 0.5, "Consigne", "#e8711a", (v) => `${fr(v, 1)}°`) : `<div class="vs off"><b>Éteint</b></div>`}</div>
        <div class="sh-row"><span>Chauffage</span>${sw(rOn, "rad", i)}</div>`;
    }
    if (kind === "poele") {
      const pOn = st(C.poele) !== "off", tremie = n(C.tremie_kg), stock = n(C.stock_kg), conso = n(C.conso_jour_kg), tMax = at(C.tremie_kg, "max") || 15;
      const dj = Math.round((addMonths(new Date(st(C.poele_entretien)), C.poele_entretien_mois) - Date.now()) / 864e5);
      return top("flame", "#e5484d", "Poêle à granulés", `${st(C.poele_statut)} · ${fr(at(C.poele, "current_temperature"), 1)}° · fumées ${fr(n(C.poele_fumees))}°`)
        + `<div class="sh-mid">${pOn ? vslider("poele", 0, at(C.poele, "temperature"), 15, 25, 0.5, "Consigne", "#e5484d", (v) => `${fr(v, 1)}°`) : `<div class="vs off"><b>Éteint</b></div>`}</div>
        <div class="eyebrow" style="margin:0 0 8px">Puissance</div>
        <div class="seg">${[1, 2, 3, 4, 5].map((v) => `<button class="${n(C.poele_puissance) === v ? "on" : ""}" data-act="stove-pow" data-i="${v}">P${v}</button>`).join("")}</div>
        <div class="sh-row"><span>Allumé</span>${sw(pOn, "stove")}</div>
        <div class="sh-row"><span>Trémie <em>${fr(tremie, 1)} / ${fr(tMax)} kg</em></span><div style="width:45%">${prog((tremie / tMax) * 100, tremie < 4 ? "var(--red)" : "linear-gradient(90deg,#f4c27a,#b7791f)")}</div></div>
        <div class="sh-row"><span>Stock <em>${fr(stock)} kg · ~${fr((tremie + stock) / conso)} jours</em></span><span class="muted small">entretien ${dj >= 0 ? `dans ${dj} j` : `en retard`}</span></div>
        <div class="grid2" style="margin-top:12px"><button class="btn ${armed.fill ? "danger" : ""}" data-act="pellet-fill">${armed.fill ? "Confirmer" : "Verser un sac"}</button><button class="btn o" data-act="pellet-buy">+ 1 sac</button></div>`;
    }
    if (kind === "ballon") {
      const boost = n(C.ballon_boost) === 1, bt = n(C.ballon_temp), bc = at(C.ballon, "temperature");
      return top("drop", "#3a7bec", "Ballon d'eau chaude", on(C.ballon_chauffe) ? "Chauffe en cours" : "Au repos")
        + `<div class="sh-mid"><div class="vs ro" style="--c:#3a7bec"><i style="height:${clamp((bt / bc) * 100, 0, 100)}%"></i><b>${fr(bt)}°</b></div></div>
        <div class="sh-row"><span>Consigne</span><b>${fr(bc)}°</b></div>
        <div class="sh-row"><span>Forcer la chauffe <em>${boost ? "J1 · boost" : "J0 · normal"}</em></span>${sw(boost, "boiler-boost")}</div>
        <div class="sh-row"><span>Dernier entretien</span><span class="muted small">${ago(new Date(st(C.ballon_entretien)).toISOString())}</span></div>`;
    }
    if (kind === "multiprise") {
      return top("plug", "#1f9d55", "Multiprise", `${C.multiprise.filter(on).length} sur ${C.multiprise.length} allumées`)
        + `<div class="hk-grid" style="margin-top:6px">${C.multiprise.map((id, k) => `<div class="hk-tile ${on(id) ? "on" : ""}" style="--c:#1f9d55"><button class="hk-ic" data-act="strip" data-i="${k}">${ICONS.plug}</button><button class="hk-tx" data-act="strip" data-i="${k}"><b>${C.multiprise_noms[k]}</b><span>${on(id) ? "Allumée" : "Éteinte"}</span></button></div>`).join("")}</div>`;
    }
    if (kind === "robot") {
      return top("robot", "#3a7bec", "Robot aspirateur", `${robotTxt()} · batterie ${fr(n(C.robot_batterie))} %`)
        + `<div class="eyebrow" style="margin:10px 0 8px">Zone</div>
        <div class="sel-wrap"><select data-act="robot-scene" aria-label="Zone à nettoyer">${(at(C.robot_scene, "options") || []).map((o) => `<option ${o === st(C.robot_scene) ? "selected" : ""}>${o}</option>`).join("")}</select>${ICONS.down}</div>
        <div class="grid2" style="margin-top:14px"><button class="btn" data-act="robot-dock">${ICONS.dock} Base</button><button class="btn o" data-act="robot-start">${ICONS.play} Lancer</button></div>`;
    }
    if (kind === "homepod") {
      const hp = C.homepod, playing = st(hp) === "playing", vol = Math.round((at(hp, "volume_level") || 0) * 100);
      return top("speaker", "#8a5cf6", "HomePod salon", playing ? "Lecture en cours" : "En pause")
        + `<div class="player"><div class="art ${playing ? "playing" : ""}"><i></i><i></i><i></i></div>
          <div class="pl-t"><b>${at(hp, "media_title") || "—"}</b><span>${at(hp, "media_artist") || ""}</span></div>
          <button class="pl-btn" data-act="media-play" aria-label="${playing ? "Pause" : "Lecture"}">${playing ? ICONS.pause : ICONS.play}</button></div>
        <div class="sh-mid">${vslider("volume", 0, vol, 0, 100, 1, "Volume", "#8a5cf6", (v) => `${v}`)}</div>`;
    }
    return "";
  }
  function renderSheet() {
    let el = document.getElementById("sheet");
    if (!el) {
      el = document.createElement("div");
      el.id = "sheet";
      el.innerHTML = `<div class="sh-bg" data-close></div><div class="sh-panel" role="dialog" aria-modal="true"><div class="sh-grab"></div><div class="sh-body"></div></div>`;
      document.body.appendChild(el);
    }
    el.classList.toggle("open", !!sheet);
    if (sheet) el.querySelector(".sh-body").innerHTML = sheetBody();
  }
  // Curseur vertical : glisser pour régler, la commande part au relâchement
  const VS_ACT = {
    volet: (i, v) => { const id = C.volets[i]; call("cover.set_cover_position", id, () => set(id, v ? "open" : "closed", { current_position: v }), ` ${v}`); },
    radiateur: (i, v) => { const id = C.radiateurs[i]; call("climate.set_temperature", id, () => set(id, st(id), { temperature: v }), ` ${v}°`); },
    poele: (i, v) => call("climate.set_temperature", C.poele, () => set(C.poele, st(C.poele), { temperature: v }), ` ${v}°`),
    volume: (i, v) => call("media_player.volume_set", C.homepod, () => set(C.homepod, st(C.homepod), { volume_level: v / 100 }), ` ${v} %`),
  };
  let drag = null;
  document.addEventListener("pointerdown", (ev) => {
    const el = ev.target.closest("[data-vs]");
    if (!el) return;
    ev.preventDefault();
    el.setPointerCapture(ev.pointerId);
    drag = { el, min: +el.dataset.min, max: +el.dataset.max, step: +el.dataset.step, val: +el.dataset.val };
    moveVs(ev);
  });
  function moveVs(ev) {
    if (!drag) return;
    const r = drag.el.getBoundingClientRect();
    const k = clamp(1 - (ev.clientY - r.top) / r.height, 0, 1);
    const v = Math.round((drag.min + k * (drag.max - drag.min)) / drag.step) * drag.step;
    drag.val = +v.toFixed(2);
    drag.el.querySelector("i").style.height = `${((drag.val - drag.min) / (drag.max - drag.min)) * 100}%`;
    const kind = drag.el.dataset.vs;
    drag.el.querySelector("b").textContent = kind === "volet" ? `${drag.val} %` : kind === "volume" ? `${drag.val}` : `${fr(drag.val, 1)}°`;
  }
  document.addEventListener("pointermove", moveVs);
  document.addEventListener("pointerup", () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.val !== +d.el.dataset.val) VS_ACT[d.el.dataset.vs](+d.el.dataset.i, d.val);
  });

  // Plages tarifaires lisibles, ex. « 23h–2h, 6h–7h » ; HP = le reste de la journée
  const hh = (t) => `${parseInt(t, 10)}h`;
  function plagesTxt(k) {
    const P = C.plages_tarifaires || {};
    if (k === "hp") return "7h–23h";
    return (P[k] || []).map((r) => r.split("-").map(hh).join("–")).join(", ");
  }

  // ─── Économies de l'année (démo : plus tard, statistiques mensuelles du capteur d'économies)
  const ECO_MOIS = [28, 36, 52, 61, 72, 78, 80, 74, 58, 44, 30, 24];
  const ECO_MOIS_AVANT = [22, 30, 44, 55, 63, 70, 71, 66, 50, 38, 26, 20];
  function economiesAnnee() {
    const m = new Date().getMonth();
    const cumul = ECO_MOIS.slice(0, m + 1).reduce((a, b) => a + b, 0);
    const avant = ECO_MOIS_AVANT.slice(0, m + 1).reduce((a, b) => a + b, 0);
    const evol = ((cumul - avant) / avant) * 100;
    const max = Math.max(...ECO_MOIS);
    return `<div class="card">
      ${ch("euro", "#1f9d55", `Économies ${new Date().getFullYear()}`, "depuis le 1er janvier")}
      <div class="kpi"><b style="color:var(--green)">${fr(cumul)} €</b><span class="u">économisés</span><span class="tag">${evol >= 0 ? "+" : ""}${fr(evol)} % vs ${new Date().getFullYear() - 1}</span></div>
      <div class="ebars" role="img" aria-label="Économies par mois">${ECO_MOIS.map((v, i) => `
        <div class="eb ${i === m ? "hi" : i > m ? "fut" : ""}" title="${MOIS_LONG[i]} : ${i > m ? "prévu" : ""} ${fr(v)} €"><i style="height:${(v / max) * 100}%"></i><span>${MOIS[i][0]}</span></div>`).join("")}</div>
      <div class="sfoot">
        <div><span>Ce mois-ci</span><b>${fr(ECO_MOIS[m])} €</b></div>
        <div><span>Aujourd'hui</span><b>${fr(n(C.economies_jour_eur), 2)} €</b></div>
      </div>
    </div>`;
  }

  // ─── Retour sur investissement solaire
  function roiCard() {
    const inv = C.solaire_investissement_eur, total = n(C.economies_total_eur);
    const debut = new Date(C.solaire_mise_en_service), now = new Date();
    const ans = Math.max(0.1, (now - debut) / (365.25 * 864e5));
    const parAn = total / ans;
    const reste = Math.max(0, inv - total);
    const fin = new Date(now.getTime() + (reste / parAn) * 365.25 * 864e5);
    const dureeTot = inv / parAn;
    const p = clamp((total / inv) * 100, 0, 100);
    const mo = (d) => d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
    return `<div class="card roi">
      ${ch("sun", "#1f9d55", "Retour sur investissement", "installation solaire")}
      <div class="roi-top">
        <div>${ring(p, `<span>${fr(p)}<small style="font-size:.75rem;font-weight:500"> %</small></span>`, "var(--green)")}</div>
        <div class="roi-main">
          <div class="roi-amt"><b>${fr(total)} €</b><span>sur ${fr(inv)} €</span></div>
          <div class="muted small">${reste > 0 ? `Il reste <b style="color:var(--txt)">${fr(reste)} €</b> à amortir` : "Installation rentabilisée 🎉"}</div>
        </div>
      </div>
      <div class="roi-line">
        <div class="roi-track"><i style="width:${p}%"></i><em style="left:${p}%"></em></div>
        <div class="roi-dates"><span>${mo(debut)}<br><small>mise en service</small></span><span style="text-align:right">${reste > 0 ? mo(fin) : mo(now)}<br><small>${reste > 0 ? "rentabilisé (estim.)" : "rentabilisé"}</small></span></div>
      </div>
      <div class="sfoot" style="grid-template-columns:repeat(3,1fr)">
        <div><span>Par an</span><b>${fr(parAn)} €</b></div>
        <div><span>Par jour</span><b>${fr(parAn / 365.25, 2)} €</b></div>
        <div><span>Amorti en</span><b>${fr(dureeTot, 1)}<small class="muted" style="font-family:Inter;font-weight:500"> ans</small></b></div>
      </div>
      <p class="muted small" style="margin:12px 2px 0">Estimation au rythme moyen depuis la mise en service. Ensuite, chaque année rapporte environ <b style="color:var(--txt)">${fr(parAn)} €</b> net.</p>
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
      { k: "Solaire direct", ic: "sun", v: j.solDirect, c: "#e8711a" },
      { k: "Batterie", ic: "bat", v: j.dch, c: "#3a7bec" },
      { k: "Réseau", ic: "grid", v: j.imp, c: "#1f9d55" },
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
      ${head("Production · économies · origine", "Analyse")}
      <div class="wrap">
        <div class="seg" style="margin-bottom:14px">${[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"]].map(([k, l]) => `<button class="${periode === k ? "on" : ""}" data-per="${k}">${l}</button>`).join("")}</div>
        <div class="card">
          ${ch("sun", "#e8711a", "Production", P.titre.replace("kWh ", ""))}
          <div class="kpi"><b>${fr(P.total, 1)}</b><span class="u">kWh</span>${P.evol != null ? `<span class="tag">+${P.evol} % ${P.evolTxt || "vs avant"}</span>` : ""}</div>
          <div class="bars ${periode === "mois" ? "dense" : ""}" style="grid-template-columns:repeat(${P.data.length},1fr)">
            ${P.avg ? `<div class="avg" style="bottom:${20 + (P.avg / max) * 150}px"><span>moy. ${fr(P.avg, 1)}</span></div>` : ""}
            ${P.data.map((v, i) => { const fut = P.fut != null && i >= P.fut; const lab = periode !== "mois" || i === 0 || (i + 1) % 5 === 0 || i === P.hi;
              return `<div class="b ${i === P.hi ? "hi" : ""} ${fut ? "fut" : ""} ${i === P.best ? "best" : ""}" title="${P.labels[i]}${periode === "mois" ? ` ${P.mName}` : ""} : ${fr(v, 1)} kWh${fut ? " (prévu)" : ""}">${!many || i === P.hi ? `<span class="v">${fr(v, v < 100 ? 1 : 0)}</span>` : ""}<i style="height:${(v / max) * 100}%"></i><span class="d">${lab ? P.labels[i] : "&nbsp;"}</span></div>`; }).join("")}
          </div>
          ${periode === "mois" ? `
          <div class="legend-m"><span class="lm-past">Produit</span><span class="lm-fut">Prévu</span><span class="lm-best">Meilleur jour</span></div>
          <div class="sfoot" style="grid-template-columns:repeat(3,1fr)">
            <div><span>Record</span><b>${fr(P.data[P.best], 1)}</b><small class="muted"> le ${P.best + 1}</small></div>
            <div><span>Moyenne</span><b>${fr(P.avg, 1)}</b><small class="muted"> /jour</small></div>
            <div><span>Fin de mois</span><b>~${fr(P.proj)}</b><small class="muted"> kWh</small></div>
          </div>` : ""}
        </div>
${economiesAnnee()}
${roiCard()}
        <div class="card" style="overflow:hidden">
          ${ch("leaf", "#1f9d55", "D'où vient ton énergie", "aujourd'hui")}
          <div class="kpi" style="margin-bottom:10px"><b style="color:var(--txt);font-size:1.9rem">${fr(tot, 1)}</b><span class="u">kWh consommés</span></div>
          <div class="donut-wrap">
            <div class="lst">${parts.map((p) => `<div class="it">${chip(p.ic, p.c)}<div><span>${p.k} (${fr((p.v / tot) * 100)} %)</span><b>${fr(p.v, 1)} kWh</b></div></div>`).join("")}</div>
            <svg class="donut" viewBox="0 0 150 150" role="img" aria-label="Origine de l'énergie consommée">${arcs}</svg>
          </div>
        </div>
        ${(() => {
          const m = new Date().getMonth();
          const sp = ANNEE.reduce((a, b) => a + b, 0), sc = CONSO_ANNEE.reduce((a, b) => a + b, 0), si = INJ_ANNEE.reduce((a, b) => a + b, 0);
          const couv = (ANNEE.reduce((a, v, i) => a + Math.min(v, CONSO_ANNEE[i]), 0) / sc) * 100;
          return `<div class="card">
          ${ch("chart", "#e8711a", "Production et consommation", `année ${new Date().getFullYear()}`)}
          <div class="ylegend">
            <div style="--c:var(--orange)"><span>Production</span><b>${fr(sp)} <small>kWh</small></b></div>
            <div style="--c:var(--blue)"><span>Consommation</span><b>${fr(sc)} <small>kWh</small></b></div>
            <div style="--c:var(--green)"><span>Injection</span><b>${fr(si)} <small>kWh</small></b></div>
            <div><span>Couverture</span><b>${fr(couv)} <small>%</small></b></div>
          </div>
          ${curve("annee", { labels: MOIS, series: [
            { name: "Production", data: ANNEE, color: "#e8711a", fill: 0.2 },
            { name: "Consommation", data: CONSO_ANNEE, color: "#3a7bec", fill: 0.06, detail: (i) => [
              ["Soleil + batterie", CONSO_ANNEE[i] - RESEAU_ANNEE[i]],
              [`Réseau HP <i>${plagesTxt("hp")}</i>`, PLAGES_ANNEE[i].hp],
              [`Réseau HC <i>${plagesTxt("hc")}</i>`, PLAGES_ANNEE[i].hc],
              [`Réseau super creuses <i>${plagesTxt("hsc")}</i>`, PLAGES_ANNEE[i].hsc],
            ] },
            { name: "Injection", data: INJ_ANNEE, color: "#1f9d55", fill: 0, dash: "4 4" },
          ], unit: "kWh", hi: m })}
          <div class="muted small" style="margin-top:8px">${ANNEE[m] >= CONSO_ANNEE[m]
            ? `En ${MOIS_LONG[m]}, tu produis <b style="color:var(--txt)">${fr(ANNEE[m] - CONSO_ANNEE[m])} kWh de plus</b> que tu ne consommes.`
            : `En ${MOIS_LONG[m]}, il manque <b style="color:var(--txt)">${fr(CONSO_ANNEE[m] - ANNEE[m])} kWh</b> de soleil pour couvrir ta consommation.`}</div>
        </div>`;
        })()}
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
    "cover-toggle": (el) => { const id = C.volets[el.dataset.i], p = at(id, "current_position") > 0 ? 0 : 100; call("cover.set_cover_position", id, () => set(id, p ? "open" : "closed", { current_position: p }), ` ${p}`); },
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
    if (go) { if (go.dataset.gosub) hkFilter = go.dataset.gosub === "chauffage" ? "climat" : go.dataset.gosub; sheet = null; renderSheet(); return show(go.dataset.go); }
    const hk = ev.target.closest("[data-hk]");
    if (hk) { const k = hk.dataset.hk; hkFilter = !k || hkFilter === k ? null : k; return render(); }
    const shb = ev.target.closest("[data-sheet]");
    if (shb) { const [kind, i] = shb.dataset.sheet.split(":"); sheet = { kind, i }; return renderSheet(); }
    if (ev.target.closest("[data-close]")) { sheet = null; return renderSheet(); }
    const cper = ev.target.closest("[data-cper]");
    if (cper) { chargePer = cper.dataset.cper; return render(); }
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
    if (sheet) { sheet = null; renderSheet(); }
    try { localStorage.setItem("voltia-v3-page", name); } catch (e) {}
    document.querySelectorAll(".dock [data-go]").forEach((b) => b.classList.toggle("on", b.dataset.go === name));
    entering = true;
    render();
    window.scrollTo({ top: 0 });
  }
  document.querySelector(".dock").addEventListener("click", (ev) => { if (ev.target.closest("button") && navigator.vibrate) navigator.vibrate(8); });

  let entering = false;
  function render() {
    const el = document.getElementById("page");
    el.innerHTML = PAGES[current]();
    el.className = `page on${entering ? " enter" : ""}`;
    if (sheet) renderSheet();
    if (entering) countUp(el);
    entering = false;
  }
  // Les chiffres clés montent de 0 à leur valeur à l'ouverture d'une page
  function countUp(root) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.querySelectorAll("[data-count]").forEach((node) => {
      const to = parseFloat(node.dataset.count), dec = +node.dataset.dec || 0, t0 = performance.now(), dur = 900;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), ease = 1 - Math.pow(1 - k, 4);
        node.textContent = fr(to * ease, dec);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  show(current);
})();
