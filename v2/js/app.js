// Breezy HEMS V2 — coquille de l'application : navigation, actions, panneaux, thème.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, C, num, st, attr, isOn, call } = BZ;

  /* ─── État d'interface (pas d'état métier ici) ─────────────────────── */
  const saved = (() => { try { return JSON.parse(localStorage.getItem("bz2") || "{}"); } catch { return {}; } })();
  BZ.ui = { period: "semaine", carPeriod: "mois", homeFilter: "all", armed: null, sheet: null, theme: saved.theme || "auto", ...saved.ui };
  const persist = () => { try { localStorage.setItem("bz2", JSON.stringify({ theme: BZ.ui.theme, ui: { period: BZ.ui.period, carPeriod: BZ.ui.carPeriod, homeFilter: BZ.ui.homeFilter } })); } catch {} };

  const ROUTES = [
    { id: "overview", label: "Aperçu", ic: "overview", group: "Tableau de bord" },
    { id: "energy", label: "Énergie", ic: "energy", group: "Tableau de bord" },
    { id: "insights", label: "Bilan", ic: "insights", group: "Tableau de bord" },
    { id: "vehicle", label: "Voiture", ic: "car", group: "Équipements" },
    { id: "home", label: "Maison", ic: "home", group: "Équipements" },
  ];
  const route = () => { const r = location.hash.replace("#/", ""); return ROUTES.some((x) => x.id === r) ? r : "overview"; };

  /* ─── Coquille ─────────────────────────────────────────────────────── */
  function nav() {
    const L = BZ.live(), cur = route(), t = BZ.tariffNow();
    const badgeFor = (id) => id === "vehicle" && L.plugged ? h`<em class="${L.charging ? "is-live" : ""}">${fmt.n(num(C.voiture_soc))} %</em>`
      : id === "home" ? (C.lumieres.filter(isOn).length ? h`<em>${C.lumieres.filter(isOn).length}</em>` : "") : "";
    const groups = [...new Set(ROUTES.map((r) => r.group))];
    const g = L.grid, exp = g < -15, imp = g > 15;
    return h`
      <a class="brand" href="#/overview" aria-label="Breezy HEMS, aperçu"><span class="brand-m">${icon("energy")}</span><span class="brand-t"><b>Breezy</b> HEMS</span></a>
      <div class="pulse-card" title="Échange avec le réseau en direct">
        <span class="pulse-l"><i class="pulse" data-tone="${exp ? "good" : imp ? "bad" : "neutral"}"></i>Réseau</span>
        <span class="pulse-v ${exp ? "is-good" : imp ? "is-bad" : ""}">${exp ? "−" : imp ? "+" : ""}${fmt.powerText(Math.abs(g))}</span>
        <span class="pulse-s">${exp ? "revente" : imp ? "achat" : "équilibre"} · ${t.short}</span>
      </div>
      ${groups.map((gr) => h`<p class="nav-g">${gr}</p><ul class="nav-l">${ROUTES.filter((r) => r.group === gr).map((r) => h`
        <li><a href="#/${r.id}" class="nav-i" ${r.id === cur ? 'aria-current="page"' : ""}>${icon(r.ic)}<span>${r.label}</span>${badgeFor(r.id)}</a></li>`)}</ul>`)}
      <div class="nav-f">
        <button type="button" class="nav-i" data-act="theme" aria-label="Changer de thème">${icon(BZ.ui.theme === "light" ? "sun" : BZ.ui.theme === "dark" ? "moon" : "contrast")}<span>Thème : ${{ auto: "auto", light: "clair", dark: "sombre" }[BZ.ui.theme]}</span></button>
        <p class="demo">Démo · valeurs d'exemple</p>
      </div>`;
  }
  function tabbar() {
    const cur = route();
    return ROUTES.map((r) => h`<a href="#/${r.id}" ${r.id === cur ? 'aria-current="page"' : ""}>${icon(r.ic)}<span>${r.label}</span></a>`).join("");
  }

  /* ─── Rendu ────────────────────────────────────────────────────────── */
  const view = document.getElementById("view");
  let lastRoute = null;
  function render() {
    const cur = route();
    BZ.resetCharts();
    const html = BZ.pages[cur]();
    if (cur !== lastRoute) {
      // Changement de page : contenu neuf + entrée animée, retour en haut
      view.innerHTML = html;
      view.classList.remove("is-enter"); void view.offsetWidth; view.classList.add("is-enter");
      document.title = `${ROUTES.find((r) => r.id === cur).label} · Breezy HEMS`;
      if (lastRoute) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
      lastRoute = cur;
    } else {
      BZ.morph(view, html);                         // mise à jour en place
    }
    BZ.morph(document.getElementById("nav"), nav());
    BZ.morph(document.getElementById("tabs"), tabbar());
    renderSheet();
  }

  /* ─── Panneau de détail (modale) ───────────────────────────────────── */
  const sheetEl = document.getElementById("sheet");
  let lastFocus = null;
  function renderSheet() {
    const s = BZ.ui.sheet;
    if (!s) { if (sheetEl.classList.contains("is-open")) { sheetEl.classList.remove("is-open"); sheetEl.setAttribute("aria-hidden", "true"); lastFocus && lastFocus.focus(); } return; }
    const [kind, i] = s.split(":"), d = BZ.sheets[kind](i != null ? +i : undefined);
    const html = h`<div class="sheet-p" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
      <header class="sheet-h"><span class="chip" data-tone="${d.tone}">${icon(d.ic)}</span><div><h2 id="sheet-t">${d.title}</h2><p>${d.sub}</p></div>
        <button type="button" class="icon-btn" data-act="close-sheet" aria-label="Fermer">${icon("x")}</button></header>
      <div class="sheet-b">${d.body}</div></div><div class="sheet-bg" data-act="close-sheet"></div>`;
    if (!sheetEl.classList.contains("is-open")) {
      sheetEl.innerHTML = html; sheetEl.classList.add("is-open"); sheetEl.removeAttribute("aria-hidden");
      lastFocus = document.activeElement;
      requestAnimationFrame(() => (sheetEl.querySelector(".vs, .sheet-b button, .icon-btn") || sheetEl).focus());
    } else BZ.morph(sheetEl, html);
  }
  const openSheet = (k) => { BZ.ui.sheet = k; renderSheet(); };
  const closeSheet = () => { BZ.ui.sheet = null; BZ.ui.armed = null; renderSheet(); };

  /* ─── Actions ──────────────────────────────────────────────────────── */
  const step = (id, d, by, lo, hi) => BZ.clamp(num(id) + by * d, lo, hi);
  // Double confirmation pour les actions sensibles (déverrouiller, verser un sac)
  let armTimer;
  const confirm2 = (key, run, msg) => {
    if (BZ.ui.armed === key) { BZ.ui.armed = null; clearTimeout(armTimer); run(); return; }
    BZ.ui.armed = key; BZ.toast(msg); clearTimeout(armTimer);
    armTimer = setTimeout(() => { BZ.ui.armed = null; render(); }, 4000); render();
  };
  const done = (msg) => () => BZ.toast(msg, "good");
  const A = {
    nav: (d) => (location.hash = `#/${d.to}`),
    set: (d) => { BZ.ui[d.k] = d.value; persist(); if (d.k === "stovePower") return call("number.set_value", C.poele_puissance, { value: d.value }).then(done(`Poêle réglé sur P${d.value}`)); render(); },
    theme: () => { BZ.ui.theme = { auto: "light", light: "dark", dark: "auto" }[BZ.ui.theme]; applyTheme(); persist(); render(); },
    "open-sheet": (d) => openSheet(d.i != null && d.i !== "" ? `${d.sheet}:${d.i}` : d.sheet),
    "close-sheet": closeSheet,
    toggle: (d) => call("switch.toggle", d.entity).then(done(isOn(d.entity) ? "Allumé" : "Éteint")),
    // Maison
    "lights-off": () => call("light.turn_off", C.lumieres.filter(isOn)).then(done("Toutes les lumières sont éteintes")),
    "covers-all": (d) => call("cover.set_cover_position", C.volets, { position: +d.pos }).then(done(+d.pos ? "Volets ouverts" : "Volets fermés")),
    "cover-flip": (d) => { const id = C.volets[d.i], p = attr(id, "current_position") > 0 ? 0 : 100; return call("cover.set_cover_position", id, { position: p }).then(done(`${C.volets_noms[d.i]} ${p ? "ouvert" : "fermé"}`)); },
    "cover-set": (d) => call("cover.set_cover_position", C.volets[d.i], { position: +d.pos }),
    "rad-power": (d) => { const id = C.radiateurs[d.i]; return call("climate.set_hvac_mode", id, { hvac_mode: st(id) === "off" ? "heat" : "off" }); },
    "stove-power": () => call("climate.set_hvac_mode", C.poele, { hvac_mode: st(C.poele) === "off" ? "heat" : "off" }),
    "boiler-boost": () => call("number.set_value", C.ballon_boost, { value: num(C.ballon_boost) === 1 ? 0 : 1 }).then(() => { BZ.ent(C.ballon_chauffe).state = num(C.ballon_boost) === 1 ? "on" : "off"; BZ.toast(num(C.ballon_boost) === 1 ? "Chauffe du ballon forcée" : "Ballon en mode normal", "good"); }),
    "pellet-fill": () => confirm2("fill", () => call("script.turn_on", C.script_remplir).then(done("Sac versé : trémie mise à jour")), "Appuie encore pour confirmer le sac versé"),
    "pellet-buy": () => call("script.turn_on", C.script_achat).then(done("Un sac ajouté au stock")),
    robot: (d) => call(`vacuum.${d.cmd}`, C.robot).then(done(d.cmd === "start" ? "Nettoyage lancé" : "Retour à la base")),
    media: (d) => call(`media_player.media_${d.cmd}${d.cmd === "play_pause" ? "" : "_track"}`, C.homepod),
    // Énergie
    "bat-min": (d) => call("number.set_value", C.batterie_min_pct, { value: step(C.batterie_min_pct, +d.d, 5, 0, 50) }),
    "bat-max": (d) => call("number.set_value", C.batterie_max_pct, { value: step(C.batterie_max_pct, +d.d, 5, 70, 100) }),
    // Voiture
    "car-charge": () => call(`switch.turn_${isOn(C.voiture_en_charge) ? "off" : "on"}`, C.voiture_en_charge).then(done(isOn(C.voiture_en_charge) ? "Recharge démarrée" : "Recharge arrêtée")),
    "car-lock": () => (st(C.voiture_verrou) === "locked"
      ? confirm2("unlock", () => call("lock.unlock", C.voiture_verrou).then(done("Voiture déverrouillée")), "Appuie encore pour déverrouiller la voiture")
      : call("lock.lock", C.voiture_verrou).then(done("Voiture verrouillée"))),
    "car-clim": () => call("switch.toggle", C.voiture_clim).then(done(isOn(C.voiture_clim) ? "Climatisation lancée" : "Climatisation arrêtée")),
    "car-refresh": () => call("button.press", C.voiture_rafraichir).then(done("Relevé demandé à la voiture")),
    "car-lim": (d) => call("number.set_value", C.voiture_limite_pct, { value: step(C.voiture_limite_pct, +d.d, 10, 50, 100) }),
    "car-limdc": (d) => call("number.set_value", C.voiture_limite_dc_pct, { value: step(C.voiture_limite_dc_pct, +d.d, 10, 50, 100) }),
    "car-service": () => call("input_number.set_value", C.entretien_dernier_km, { value: num(C.voiture_odometre) }).then(done("Révision enregistrée")),
    "car-service-km": () => { const v = parseInt(prompt("Kilométrage de la révision :", num(C.entretien_dernier_km)), 10); if (Number.isFinite(v)) call("input_number.set_value", C.entretien_dernier_km, { value: v }).then(done("Révision enregistrée")); },
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled || el.getAttribute("aria-busy") === "true" || el.tagName === "SELECT") return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn({ ...el.dataset }); }
  });
  document.addEventListener("keydown", (e) => {
    const el = e.target.closest && e.target.closest('[data-act][role="link"]');
    if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); A[el.dataset.act]({ ...el.dataset }); }
    if (e.key === "Escape" && BZ.ui.sheet) closeSheet();
    if (!e.target.closest("input, select, textarea, [role=slider]") && !e.metaKey && !e.ctrlKey && /^[1-5]$/.test(e.key)) location.hash = `#/${ROUTES[+e.key - 1].id}`;
  });
  document.addEventListener("change", (e) => {
    if (e.target.dataset.act === "robot-scene") call("select.select_option", C.robot_scene, { option: e.target.value });
  });

  /* ─── Curseur vertical (panneaux) : pointeur et clavier ───────────── */
  const VS = {
    cover: (i, v) => call("cover.set_cover_position", C.volets[i], { position: v }),
    rad: (i, v) => call("climate.set_temperature", C.radiateurs[i], { temperature: v }),
    stove: (i, v) => call("climate.set_temperature", C.poele, { temperature: v }),
    volume: (i, v) => call("media_player.volume_set", C.homepod, { volume_level: v / 100 }),
  };
  const vsSet = (el, v) => {
    const min = +el.dataset.min, max = +el.dataset.max, s = +el.dataset.step;
    v = BZ.clamp(Math.round(v / s) * s, min, max); v = +v.toFixed(2);
    el.style.setProperty("--v", `${((v - min) / (max - min)) * 100}%`);
    el.dataset.value = v; el.setAttribute("aria-valuenow", v);
    const k = el.dataset.vs, txt = k === "cover" ? `${v} %` : k === "volume" ? `${v}` : `${fmt.n(v, 1)}°`;
    el.querySelector("output").textContent = txt; el.setAttribute("aria-valuetext", txt);
    return v;
  };
  let drag = null;
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".vs"); if (!el) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add("is-drag");
    drag = { el, start: +el.dataset.value }; move(e);
  });
  const move = (e) => { if (!drag) return; const r = drag.el.getBoundingClientRect(), k = 1 - (e.clientY - r.top) / r.height; vsSet(drag.el, +drag.el.dataset.min + BZ.clamp(k, 0, 1) * (drag.el.dataset.max - drag.el.dataset.min)); };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", () => { if (!drag) return; const { el, start } = drag; drag = null; el.classList.remove("is-drag"); if (+el.dataset.value !== start) VS[el.dataset.vs](+el.dataset.i, +el.dataset.value); });
  document.addEventListener("keydown", (e) => {
    const el = e.target.closest && e.target.closest(".vs"); if (!el) return;
    const s = +el.dataset.step, map = { ArrowUp: s, ArrowRight: s, ArrowDown: -s, ArrowLeft: -s, PageUp: s * 5, PageDown: -s * 5 };
    if (!(e.key in map)) return; e.preventDefault();
    const v = vsSet(el, +el.dataset.value + map[e.key]);
    clearTimeout(el._t); el._t = setTimeout(() => VS[el.dataset.vs](+el.dataset.i, v), 450);
  });

  /* ─── Thème ────────────────────────────────────────────────────────── */
  function applyTheme() {
    const t = BZ.ui.theme;
    if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = t;
    const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]').content = dark ? "#0d0e10" : "#f5f5f3";
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyTheme(); render(); });

  /* ─── Démarrage ────────────────────────────────────────────────────── */
  applyTheme();
  window.addEventListener("hashchange", () => { BZ.ui.sheet = null; render(); });
  BZ.subscribe(render);
  // Squelette bref au premier affichage : la vraie connexion à HA prendra un instant
  setTimeout(() => { document.body.classList.remove("is-loading"); render(); }, 450);
})();
