// Breezy HEMS V3 — coquille : barre latérale, barre du haut (recherche, notifications, thème, profil),
// routes, actions, panneaux, thème.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, avatar, C, num, st, attr, isOn, call, esc } = BZ;

  /* ─── État d'interface (pas d'état métier ici) ─────────────────────── */
  const saved = (() => { try { return JSON.parse(localStorage.getItem("bz3") || "{}"); } catch { return {}; } })();
  BZ.ui = { period: "semaine", carPeriod: "mois", homeFilter: "all", devFilter: "all", dayOffset: 0, armed: null, sheet: null, pop: null, theme: saved.theme || "light", ...saved.ui };
  BZ.ui.dayOffset = 0; BZ.ui.pop = null; BZ.ui.homeFilter = "all";
  const persist = () => { try { localStorage.setItem("bz3", JSON.stringify({ theme: BZ.ui.theme, ui: { period: BZ.ui.period, carPeriod: BZ.ui.carPeriod, devFilter: BZ.ui.devFilter } })); } catch {} };
  BZ.user = C.utilisateur_nom || "Breezy";

  const ROUTES = [
    { id: "overview", label: "Aperçu", ic: "overview" },
    { id: "energy", label: "Énergie", ic: "energy" },
    { id: "insights", label: "Bilan", ic: "insights" },
    { id: "vehicle", label: "Voiture", ic: "car" },
    { id: "home", label: "Maison", ic: "home" },
  ];
  // Route courante : gardée en mémoire (l'adresse n'est qu'un reflet), pour fonctionner aussi
  // dans un cadre isolé où les liens d'ancre ne naviguent pas.
  const fromHash = () => { const r = location.hash.replace("#/", ""); return ROUTES.some((x) => x.id === r) ? r : null; };
  let current = fromHash() || "overview";
  const route = () => current;
  BZ.routes = ROUTES;
  function go(id, push = true) {
    if (!ROUTES.some((x) => x.id === id)) return;
    current = id; BZ.ui.sheet = null; BZ.ui.pop = null;
    if (push) try { if (location.hash !== `#/${id}`) history.pushState(null, "", `#/${id}`); } catch {}
    render();
  }
  BZ.go = go;

  /* ─── Barre latérale ───────────────────────────────────────────────── */
  function side() {
    const L = BZ.live(), cur = route(), t = BZ.tariffNow(), lights = C.lumieres.filter(isOn).length;
    const badge = { vehicle: L.charging ? h`<em class="is-soft">${fmt.n(num(C.voiture_soc))} %</em>` : "", home: lights ? h`<em>${lights}</em>` : "" };
    const g = L.grid, exp = g < -15, imp = g > 15;
    const favs = [
      { label: "Eau chaude", ic: "drop", tone: "battery", v: `${fmt.n(num(C.ballon_temp))}°`, sheet: "ballon" },
      { label: "Poêle", ic: "flame", tone: "heat", v: st(C.poele) !== "off" ? `${fmt.n(attr(C.poele, "current_temperature"), 1)}°` : "éteint", sheet: "poele" },
      { label: "Kia e-Niro", ic: "car", tone: "ev", v: `${fmt.n(num(C.voiture_soc))} %`, to: "vehicle" },
    ];
    return h`
      <a class="brand" href="#/overview" aria-label="Breezy HEMS, aperçu"><span class="brand-m">${icon("energy")}</span><span class="brand-t">Breezy <em>HEMS</em></span></a>
      <ul class="nav-l">${ROUTES.map((r) => h`<li><a href="#/${r.id}" class="nav-i" ${r.id === cur ? 'aria-current="page"' : ""} title="${r.label}">${icon(r.ic)}<span>${r.label}</span>${badge[r.id] || ""}</a></li>`)}</ul>
      <p class="nav-g favs-h">Favoris</p>
      <ul class="favs">${favs.map((f) => h`<li>${f.to
        ? h`<a class="fav" href="#/${f.to}"><span class="dt-ic" data-tone="${f.tone}">${icon(f.ic)}</span><span>${f.label}</span><span class="fav-v">${f.v}</span></a>`
        : h`<button type="button" class="fav" data-act="open-sheet" data-sheet="${f.sheet}"><span class="dt-ic" data-tone="${f.tone}">${icon(f.ic)}</span><span>${f.label}</span><span class="fav-v">${f.v}</span></button>`}</li>`)}</ul>
      <div class="promo-s">
        <span class="card-i" data-tone="${exp ? "good" : imp ? "bad" : "neutral"}">${icon("grid")}</span>
        <strong>Réseau en direct</strong>
        <div class="promo-v"><b class="${exp ? "is-good" : imp ? "is-bad" : ""}">${exp ? "−" : imp ? "+" : ""}${fmt.powerText(Math.abs(g))}</b><span>${exp ? "revente" : imp ? "achat" : "équilibre"}</span></div>
        <p>Compteur L3 · ${t.label.toLowerCase()} à ${fmt.n(t.price, 4)} €/kWh jusqu'à ${fmt.time(t.changeAt)}.</p>
        ${cur === "energy" ? h`<a class="btn btn-primary btn-sm" href="#/insights"><span>Voir le bilan</span>${icon("arrow")}</a>` : h`<a class="btn btn-primary btn-sm" href="#/energy"><span>Voir l'énergie</span>${icon("arrow")}</a>`}
      </div>
      <button type="button" class="side-me" data-act="pop" data-pop="me-side" aria-haspopup="menu" aria-expanded="${String(BZ.ui.pop === "me-side")}">
        ${avatar(BZ.user, "lg")}<span><b>${esc(BZ.user)}</b><small>Mode démo</small></span>${icon("down")}
      </button>
      <div class="pop pop-up ${BZ.ui.pop === "me-side" ? "is-open" : ""}" role="menu">${profileMenu()}</div>`;
  }

  /* ─── Barre du haut : construite une fois (le champ de recherche garde son état) ─ */
  function topInit() {
    document.getElementById("top").innerHTML = h`
      <a class="top-brand" href="#/overview" aria-label="Breezy HEMS, aperçu"><span class="brand-m">${icon("energy")}</span><span class="brand-t">Breezy <em>HEMS</em></span></a>
      <div class="search" role="search">
        <label class="search-f">${icon("search")}<span class="sr">Rechercher</span>
          <input id="q" type="search" placeholder="Rechercher un appareil, une page…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="q-pop" aria-autocomplete="list"><kbd>/</kbd></label>
        <div class="pop" id="q-pop" role="listbox" aria-label="Résultats"></div>
      </div>
      <div class="top-a" id="top-a"></div>`;
    const q = document.getElementById("q"), pop = document.getElementById("q-pop");
    let sel = 0, res = [];
    const draw = () => {
      res = BZ.search(q.value);
      const open = q.value.trim() !== "";
      pop.classList.toggle("is-open", open); q.setAttribute("aria-expanded", String(open));
      pop.innerHTML = !open ? "" : res.length ? h`<p class="pop-h">${res.length} résultat${res.length > 1 ? "s" : ""}</p>${res.map((r, i) => h`
        <button type="button" class="pop-i ${i === sel ? "is-active" : ""}" role="option" aria-selected="${String(i === sel)}" data-pick="${i}"><span class="dt-ic" data-tone="${r.tone}">${icon(r.ic)}</span><span><strong>${r.label}</strong><small>${r.sub}</small></span></button>`)}`
        : h`<p class="pop-e">Aucun résultat pour « ${esc(q.value)} »</p>`;
    };
    const pick = (r) => {
      if (!r) return;
      q.value = ""; draw(); q.blur();
      if (r.to) go(r.to); else if (r.sheet) openSheet(r.sheet); else if (r.act) A[r.act]({ ...r.args });
    };
    q.addEventListener("input", () => { sel = 0; draw(); });
    q.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = BZ.clamp(sel + (e.key === "ArrowDown" ? 1 : -1), 0, Math.max(0, res.length - 1)); draw(); }
      if (e.key === "Enter") { e.preventDefault(); pick(res[sel]); }
      if (e.key === "Escape") { q.value = ""; draw(); q.blur(); }
    });
    pop.addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (b) pick(res[+b.dataset.pick]); });
    q.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== q) { pop.classList.remove("is-open"); q.setAttribute("aria-expanded", "false"); } }, 150));
    q.addEventListener("focus", () => q.value && draw());
  }
  function profileMenu() {
    const t = BZ.ui.theme;
    return h`<p class="pop-h">Apparence</p>
      ${[["light", "Clair", "sun"], ["dark", "Sombre", "moon"], ["auto", "Automatique", "contrast"]].map(([k, l, ic]) => h`<button type="button" class="pop-i" role="menuitemradio" aria-checked="${String(t === k)}" data-act="theme-set" data-value="${k}">${icon(ic)}<span>${l}</span></button>`)}
      <p class="pop-h">Connexion</p>
      <div class="pop-i">${icon("plug")}<span><strong>Données de démonstration</strong><small>Les valeurs sont des exemples tant que Home Assistant n'est pas branché.</small></span></div>`;
  }
  function topActions() {
    const al = BZ.alerts(), dark = document.documentElement.dataset.theme === "dark";
    return h`
      <div class="rel">
        <button type="button" class="icon-btn" data-act="pop" data-pop="bell" aria-haspopup="dialog" aria-expanded="${String(BZ.ui.pop === "bell")}" aria-label="Suggestions${al.length ? ` (${al.length})` : ""}">${icon("bell")}${al.length ? h`<span class="dot"></span>` : ""}</button>
        <div class="pop pop-bell ${BZ.ui.pop === "bell" ? "is-open" : ""}" role="dialog" aria-label="Suggestions">
          <p class="pop-h">${al.length ? `${al.length} suggestion${al.length > 1 ? "s" : ""}` : "Suggestions"}</p>
          ${al.length ? al.map((a) => h`<div class="pop-i al" data-tone="${a.tone}"><span class="dt-ic">${icon(a.ic)}</span><span><strong>${a.title}</strong><small>${a.text}</small>
            ${a.act ? h`<button type="button" class="more" data-act="${a.act}" ${BZ.dataArgs(a.args || {})}>${a.cta}${icon("arrow")}</button>` : ""}</span></div>`)
            : h`<p class="pop-e">Rien à signaler : tout tourne comme prévu.</p>`}
        </div>
      </div>
      <button type="button" class="icon-btn theme-b" data-act="theme" aria-label="${dark ? "Passer en thème clair" : "Passer en thème sombre"}">${icon(dark ? "moon" : "sun")}</button>
      <div class="rel">
        <button type="button" class="me" data-act="pop" data-pop="me" aria-haspopup="menu" aria-expanded="${String(BZ.ui.pop === "me")}">${avatar(BZ.user)}<b class="me-n">${esc(BZ.user)}</b>${icon("down")}</button>
        <div class="pop ${BZ.ui.pop === "me" ? "is-open" : ""}" role="menu">${profileMenu()}</div>
      </div>`;
  }
  // Dock mobile : l'onglet actif s'élargit en pastille corail (icône + libellé), les autres restent des icônes.
  // Une pastille glisse d'un onglet à l'autre ; les états en direct (recharge, lumières) se lisent sur l'icône.
  function tabbar() {
    const cur = route(), L = BZ.live(), lights = C.lumieres.filter(isOn).length, idx = ROUTES.findIndex((r) => r.id === cur);
    const mark = { vehicle: L.charging ? h`<i class="tab-live" data-tone="ev" aria-hidden="true"></i>` : "", home: lights ? h`<em class="tab-n" aria-hidden="true">${lights}</em>` : "" };
    return h`<span class="tabs-ind" style="--i:${idx}" aria-hidden="true"></span>${ROUTES.map((r) => h`
      <a href="#/${r.id}" ${r.id === cur ? 'aria-current="page"' : ""} aria-label="${r.label}${r.id === "home" && lights ? `, ${lights} lumière${lights > 1 ? "s" : ""} allumée${lights > 1 ? "s" : ""}` : ""}${r.id === "vehicle" && L.charging ? ", en charge" : ""}">
        <span class="tab-ic">${icon(r.ic)}${mark[r.id] || ""}</span><span class="tab-l">${r.label}</span></a>`)}`;
  }

  /* ─── Rendu ────────────────────────────────────────────────────────── */
  const view = document.getElementById("view");
  let lastRoute = null;
  function render() {
    const cur = route();
    BZ.resetCharts();
    const html = BZ.pages[cur]();
    if (cur !== lastRoute) {
      view.innerHTML = html;
      view.classList.remove("is-enter"); void view.offsetWidth; view.classList.add("is-enter");
      document.title = `${ROUTES.find((r) => r.id === cur).label} · Breezy HEMS`;
      if (lastRoute) { view.scrollTo(0, 0); window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
      lastRoute = cur;
    } else {
      BZ.morph(view, html);
    }
    BZ.morph(document.getElementById("side"), side());
    BZ.morph(document.getElementById("top-a"), topActions());
    BZ.morph(document.getElementById("tabs"), tabbar());
    renderSheet();
  }
  BZ.render = render;

  /* ─── Panneau de détail (modale) ───────────────────────────────────── */
  const sheetEl = document.getElementById("sheet");
  let lastFocus = null;
  function renderSheet() {
    const s = BZ.ui.sheet;
    const bg = [document.querySelector(".frame"), document.getElementById("tabs"), document.querySelector(".skip")];
    if (!s) { if (sheetEl.classList.contains("is-open")) { sheetEl.classList.remove("is-open"); sheetEl.setAttribute("aria-hidden", "true"); bg.forEach((el) => el && (el.inert = false)); lastFocus && lastFocus.focus(); } return; }
    bg.forEach((el) => el && (el.inert = true));   // le focus reste dans le panneau
    const [kind, i] = s.split(":"), d = BZ.sheets[kind](i != null ? +i : undefined);
    sheetEl.classList.toggle("is-full", !!d.full);
    const html = h`<div class="sheet-p ${d.full ? "is-full" : ""}" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
      <header class="sheet-h"><span class="chip" data-tone="${d.tone}">${icon(d.ic)}</span><div><h2 id="sheet-t">${d.title}</h2><p>${d.sub}</p></div>
        <button type="button" class="icon-btn" data-act="close-sheet" aria-label="Fermer le panneau">${icon("x")}</button></header>
      <div class="sheet-b">${d.body}</div></div><div class="sheet-bg" data-act="close-sheet"></div>`;
    if (!sheetEl.classList.contains("is-open")) {
      sheetEl.innerHTML = html; sheetEl.classList.add("is-open"); sheetEl.removeAttribute("aria-hidden");
      lastFocus = document.activeElement;
      requestAnimationFrame(() => (sheetEl.querySelector(".vs, .sheet-b button, .icon-btn") || sheetEl).focus());
    } else BZ.morph(sheetEl, html);
  }
  const openSheet = (k) => { BZ.ui.sheet = k; BZ.ui.pop = null; render(); };
  const closeSheet = () => { BZ.ui.sheet = null; BZ.ui.armed = null; renderSheet(); };

  /* ─── Actions ──────────────────────────────────────────────────────── */
  const step = (id, d, by, lo, hi) => BZ.clamp(num(id) + by * d, lo, hi);
  let armTimer;
  const confirm2 = (key, run, msg) => {
    if (BZ.ui.armed === key) { BZ.ui.armed = null; clearTimeout(armTimer); run(); return; }
    BZ.ui.armed = key; BZ.toast(msg); clearTimeout(armTimer);
    armTimer = setTimeout(() => { BZ.ui.armed = null; render(); }, 4000); render();
  };
  // Message affiché une fois la commande appliquée (msg peut être une fonction : lue après coup)
  const done = (msg) => () => BZ.toast(typeof msg === "function" ? msg() : msg, "good");
  const nameOf = (id) => { const i = C.lumieres.indexOf(id); if (i >= 0) return `Lumière ${C.lumieres_noms[i]}`; const k = C.multiprise.indexOf(id); if (k >= 0) return C.multiprise_noms[k]; return id === C.prise_chambre ? "Prise chambre" : ""; };
  const A = {
    nav: (d) => go(d.to),
    set: (d) => { BZ.ui[d.k] = d.value; persist(); if (d.k === "stovePower") return call("number.set_value", C.poele_puissance, { value: d.value }).then(done(`Poêle réglé sur P${d.value}`)); render(); },
    day: (d) => { BZ.ui.dayOffset = BZ.clamp(BZ.ui.dayOffset + +d.d, -29, 0); render(); },
    pop: (d) => { BZ.ui.pop = BZ.ui.pop === d.pop ? null : d.pop; render(); },
    theme: () => { const dark = document.documentElement.dataset.theme === "dark"; BZ.ui.theme = dark ? "light" : "dark"; applyTheme(); persist(); render(); },
    "theme-set": (d) => { BZ.ui.theme = d.value; applyTheme(); persist(); render(); },
    "open-sheet": (d) => openSheet(d.i != null && d.i !== "" ? `${d.sheet}:${d.i}` : d.sheet),
    "close-sheet": closeSheet,
    toggle: (d) => call("switch.toggle", d.entity).then(done(() => `${nameOf(d.entity) || "Appareil"} ${isOn(d.entity) ? "allumé" : "éteint"}`.replace(/^(Lumière .*) (allumé|éteint)$/, "$1 $2e"))),
    // Maison
    "lights-off": () => call("light.turn_off", C.lumieres.filter(isOn)).then(done("Toutes les lumières sont éteintes")),
    "covers-all": (d) => call("cover.set_cover_position", C.volets, { position: +d.pos }).then(done(+d.pos ? "Volets ouverts" : "Volets fermés")),
    "cover-flip": (d) => { const id = C.volets[d.i], p = attr(id, "current_position") > 0 ? 0 : 100; return call("cover.set_cover_position", id, { position: p }).then(done(`${C.volets_noms[d.i]} ${p ? "ouvert" : "fermé"}`)); },
    "cover-set": (d) => call("cover.set_cover_position", C.volets[d.i], { position: +d.pos }),
    "rad-power": (d) => { const id = C.radiateurs[d.i]; return call("climate.set_hvac_mode", id, { hvac_mode: st(id) === "off" ? "heat" : "off" }).then(done(() => `Radiateur ${C.radiateurs_noms[d.i]} ${st(id) === "off" ? "éteint" : "allumé"}`)); },
    // Poêle : une seconde touche dans les 4 s confirme (évite d'allumer ou d'éteindre par erreur)
    "stove-power": () => { const on = st(C.poele) !== "off";
      return confirm2("stove", () => call("climate.set_hvac_mode", C.poele, { hvac_mode: on ? "off" : "heat" }).then(done(on ? "Poêle éteint" : "Poêle allumé")), on ? "Appuie encore pour éteindre le poêle" : "Appuie encore pour allumer le poêle"); },
    "boiler-boost": () => call("number.set_value", C.ballon_boost, { value: num(C.ballon_boost) === 1 ? 0 : 1 }).then(() => { BZ.ent(C.ballon_chauffe).state = num(C.ballon_boost) === 1 ? "on" : "off"; BZ.toast(num(C.ballon_boost) === 1 ? "Chauffe du ballon forcée" : "Ballon en mode normal", "good"); }),
    "pellet-fill": () => confirm2("fill", () => call("script.turn_on", C.script_remplir).then(done("Sac versé : trémie mise à jour")), "Appuie encore pour confirmer le sac versé"),
    "pellet-buy": () => call("script.turn_on", C.script_achat).then(done("Un sac ajouté au stock")),
    robot: (d) => call(`vacuum.${d.cmd}`, C.robot).then(done({ start: `Nettoyage lancé : ${(st(C.robot_scene) || "").toLowerCase()}`, pause: "Nettoyage en pause", return_to_base: "L'aspirateur retourne à sa base", locate: "L'aspirateur émet un bip pour se signaler" }[d.cmd] || "Commande envoyée")),
    "robot-zone": (d) => call("select.select_option", C.robot_scene, { option: d.value }),
    "robot-fan": (d) => call("vacuum.set_fan_speed", C.robot, { fan_speed: d.value }).then(done(`Aspiration : ${d.value}`)),
    media: (d) => call(`media_player.media_${d.cmd}${d.cmd === "play_pause" ? "" : "_track"}`, C.homepod),
    // Énergie
    "bat-min": (d) => call("number.set_value", C.batterie_min_pct, { value: step(C.batterie_min_pct, +d.d, 5, 0, 50) }),
    "bat-max": (d) => call("number.set_value", C.batterie_max_pct, { value: step(C.batterie_max_pct, +d.d, 5, 70, 100) }),
    // Voiture
    "car-charge": () => call(`switch.turn_${isOn(C.voiture_en_charge) ? "off" : "on"}`, C.voiture_en_charge).then(done(() => (isOn(C.voiture_en_charge) ? "Recharge démarrée" : "Recharge arrêtée"))),
    "car-lock": () => (st(C.voiture_verrou) === "locked"
      ? confirm2("unlock", () => call("lock.unlock", C.voiture_verrou).then(done("Voiture déverrouillée")), "Appuie encore pour déverrouiller la voiture")
      : call("lock.lock", C.voiture_verrou).then(done("Voiture verrouillée"))),
    "car-clim": () => call("switch.toggle", C.voiture_clim).then(done(() => (isOn(C.voiture_clim) ? "Climatisation lancée" : "Climatisation arrêtée"))),
    "car-refresh": () => call("button.press", C.voiture_rafraichir).then(done("Relevé demandé à la voiture")),
    "car-lim": (d) => call("number.set_value", C.voiture_limite_pct, { value: step(C.voiture_limite_pct, +d.d, 10, 50, 100) }),
    "car-limdc": (d) => call("number.set_value", C.voiture_limite_dc_pct, { value: step(C.voiture_limite_dc_pct, +d.d, 10, 50, 100) }),
    "car-service": () => confirm2("service", () => call("input_number.set_value", C.entretien_dernier_km, { value: num(C.voiture_odometre) }).then(done("Révision enregistrée au compteur actuel")), "Appuie encore pour remettre le compteur de révision à zéro"),
    "car-service-km": () => { const v = parseInt(prompt("Kilométrage de la révision :", num(C.entretien_dernier_km)), 10); if (Number.isFinite(v)) call("input_number.set_value", C.entretien_dernier_km, { value: v }).then(done("Révision enregistrée")); },
  };
  BZ.actions = A;
  document.addEventListener("click", (e) => {
    // Liens internes « #/page » : navigation gérée ici
    const a = e.target.closest('a[href^="#/"]');
    if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); go(a.getAttribute("href").slice(2)); return; }
    const el = e.target.closest("[data-act]");
    // Clic hors d'un menu ouvert : on le ferme
    if (BZ.ui.pop && !e.target.closest(".pop, [data-act=pop]")) { BZ.ui.pop = null; render(); }
    if (!el || el.disabled || el.getAttribute("aria-busy") === "true" || el.tagName === "SELECT") return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); if (el.dataset.act !== "pop" && el.closest(".pop")) BZ.ui.pop = null; fn({ ...el.dataset }); }
  });
  document.addEventListener("keydown", (e) => {
    const el = e.target.closest && e.target.closest('[data-act][role="link"]');
    if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); A[el.dataset.act]({ ...el.dataset }); }
    if (e.key === "Escape") { if (BZ.ui.sheet) closeSheet(); else if (BZ.ui.pop) { BZ.ui.pop = null; render(); } }
    const typing = e.target.closest("input, select, textarea, [role=slider]");
    if (!typing && e.key === "/" && !e.metaKey && !e.ctrlKey) { const q = document.getElementById("q"); if (q && q.offsetParent) { e.preventDefault(); q.focus(); } }
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && /^[1-5]$/.test(e.key)) go(ROUTES[+e.key - 1].id);
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
    const k = el.dataset.vs, txt = k === "cover" || k === "volume" ? `${v} %` : `${fmt.n(v, 1)}°`;
    el.querySelector("output").textContent = txt; el.setAttribute("aria-valuetext", txt);
    return v;
  };
  let drag = null;
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".vs"); if (!el) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add("is-drag");
    drag = { el, start: +el.dataset.value }; move(e);
  });
  const move = (e) => { if (!drag) return; const el = drag.el, r = el.getBoundingClientRect(), k = el.dataset.orient === "h" ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height; vsSet(el, +el.dataset.min + BZ.clamp(k, 0, 1) * (el.dataset.max - el.dataset.min)); };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", () => { if (!drag) return; const { el, start } = drag; drag = null; el.classList.remove("is-drag"); if (+el.dataset.value !== start) VS[el.dataset.vs](+el.dataset.i, +el.dataset.value); });
  document.addEventListener("keydown", (e) => {
    const el = e.target.closest && e.target.closest(".vs"); if (!el) return;
    const s = +el.dataset.step, map = { ArrowUp: s, ArrowRight: s, ArrowDown: -s, ArrowLeft: -s, PageUp: s * 5, PageDown: -s * 5 };
    if (!(e.key in map)) return; e.preventDefault();
    const v = vsSet(el, +el.dataset.value + map[e.key]);
    clearTimeout(el._t); el._t = setTimeout(() => VS[el.dataset.vs](+el.dataset.i, v), 450);
  });

  /* ─── Thème : clair par défaut (comme la maquette), sombre, ou automatique ─ */
  function applyTheme() {
    const t = BZ.ui.theme, dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#0e0f12" : "#e9ebef";
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (BZ.ui.theme === "auto") { applyTheme(); render(); } });

  /* ─── Démarrage ────────────────────────────────────────────────────── */
  applyTheme();
  topInit();
  const sync = () => { const r = fromHash(); if (r && r !== current) go(r, false); };
  window.addEventListener("hashchange", sync);
  window.addEventListener("popstate", sync);
  BZ.subscribe(render);
  setTimeout(() => { document.body.classList.remove("is-loading"); render(); }, 400);
})();
