// Breezy HEMS V3 — coquille : barre latérale, barre du haut (recherche, notifications, thème, profil),
// routes, actions, panneaux, thème.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, avatar, C, num, st, attr, isOn, call, esc } = BZ;
  const HA = BZ.ha;   // pont Home Assistant (v3/ha/panel-core.js) ; null en démo

  /* ─── État d'interface (pas d'état métier ici) ─────────────────────── */
  const saved = (() => { try { return JSON.parse(localStorage.getItem("bz3") || "{}"); } catch { return {}; } })();
  BZ.ui = { period: "semaine", carPeriod: "mois", homeFilter: "all", devFilter: "all", carArt: "roadster", dayOffset: 0, armed: null, sheet: null, pop: null, theme: saved.theme || (HA ? "auto" : "light"), ...saved.ui };
  BZ.ui.dayOffset = 0; BZ.ui.pop = null; BZ.ui.homeFilter = "all";
  const persist = () => { try { localStorage.setItem("bz3", JSON.stringify({ theme: BZ.ui.theme, ui: { period: BZ.ui.period, carPeriod: BZ.ui.carPeriod, devFilter: BZ.ui.devFilter, carArt: BZ.ui.carArt } })); } catch {} };
  // Home Assistant : le nom de la personne connectée, sauf si config.js en impose un
  const userName = () => C.utilisateur_nom || (HA && HA.userName) || "Breezy";
  BZ.user = userName();

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
  // Home Assistant : la page vient de l'adresse du panneau (/breezy/energy) ; un ancien lien /breezy#/energy marche aussi
  // (le cadre ne voit pas le # de la page principale : on le lit chez elle, même origine)
  const routeOf = (r) => { const id = ((r && r.path) || "").replace(/^\//, "").split("/")[0]; return ROUTES.some((x) => x.id === id) ? id : null; };
  const parentHash = () => { try { const r = parent.location.hash.replace("#/", ""); return ROUTES.some((x) => x.id === r) ? r : null; } catch { return null; } };
  // Un # valide l'emporte : un lien ouvert dans un nouvel onglet depuis le cadre garde l'adresse du panneau au moment de
  // son ouverture (/breezy/insights#/vehicle) ; on y montre la page du #, puis l'adresse est corrigée
  const haStart = HA ? routeOf(HA.route) : null, haLegacy = HA ? parentHash() : null;
  let current = (HA ? haLegacy || haStart : fromHash()) || "overview";
  const route = () => current;
  BZ.routes = ROUTES;
  function go(id, push = true) {
    if (!ROUTES.some((x) => x.id === id)) return;
    const prev = current;
    current = id; BZ.ui.sheet = null; BZ.ui.pop = null;
    // Home Assistant : l'adresse de la page principale suit (/breezy/energy), un seul « Retour » pour revenir ;
    // la page déjà affichée n'ajoute rien à l'historique du navigateur
    if (push) { if (HA) { if (id !== prev) HA.navigate(id); } else try { if (location.hash !== `#/${id}`) history.pushState(null, "", `#/${id}`); } catch {} }
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
      <a class="brand" href="${BZ.href("overview")}" aria-label="Breezy HEMS, aperçu"><span class="brand-m">${icon("energy")}</span><span class="brand-t">Breezy <em>HEMS</em></span></a>
      <ul class="nav-l">${ROUTES.map((r) => h`<li><a href="${BZ.href(r.id)}" class="nav-i" ${r.id === cur ? 'aria-current="page"' : ""} title="${r.label}">${icon(r.ic)}<span>${r.label}</span>${badge[r.id] || ""}</a></li>`)}</ul>
      <p class="nav-g favs-h">Favoris</p>
      <ul class="favs">${favs.map((f) => h`<li>${f.to
        ? h`<a class="fav" href="${BZ.href(f.to)}"><span class="dt-ic" data-tone="${f.tone}">${icon(f.ic)}</span><span>${f.label}</span><span class="fav-v">${f.v}</span></a>`
        : h`<button type="button" class="fav" data-act="open-sheet" data-sheet="${f.sheet}"><span class="dt-ic" data-tone="${f.tone}">${icon(f.ic)}</span><span>${f.label}</span><span class="fav-v">${f.v}</span></button>`}</li>`)}</ul>
      <div class="promo-s">
        <span class="card-i" data-tone="${exp ? "good" : imp ? "bad" : "neutral"}">${icon("grid")}</span>
        <strong>Réseau en direct</strong>
        <div class="promo-v"><b class="${exp ? "is-good" : imp ? "is-bad" : ""}">${exp ? "−" : imp ? "+" : ""}${fmt.powerText(Math.abs(g))}</b><span>${exp ? "revente" : imp ? "achat" : "équilibre"}</span></div>
        <p>Compteur L3 · ${t.label.toLowerCase()} à ${fmt.n(t.price, 4)} €/kWh jusqu'à ${fmt.time(t.changeAt)}.</p>
        ${cur === "energy" ? h`<a class="btn btn-primary btn-sm" href="${BZ.href("insights")}"><span>Voir le bilan</span>${icon("arrow")}</a>` : h`<a class="btn btn-primary btn-sm" href="${BZ.href("energy")}"><span>Voir l'énergie</span>${icon("arrow")}</a>`}
      </div>
      <button type="button" class="side-me" data-act="pop" data-pop="me-side" aria-haspopup="menu" aria-expanded="${String(BZ.ui.pop === "me-side")}">
        ${avatar(BZ.user, "lg")}<span><b>${esc(BZ.user)}</b><small>${HA ? (HA.connected ? "Home Assistant" : "Hors ligne") : "Mode démo"}</small></span>${icon("down")}
      </button>
      <div class="pop pop-up ${BZ.ui.pop === "me-side" ? "is-open" : ""}" role="menu">${profileMenu()}</div>`;
  }

  /* ─── Barre du haut : construite une fois (le champ de recherche garde son état) ─ */
  function topInit() {
    // Home Assistant sur téléphone : pas de barre HA au-dessus du panneau, ce bouton ouvre son menu (barre latérale)
    document.getElementById("top").innerHTML = h`
      ${HA ? h`<button type="button" class="icon-btn ha-menu" data-act="ha-menu" aria-label="Ouvrir le menu Home Assistant">${icon("menu")}</button>` : ""}<a class="top-brand" href="${BZ.href("overview")}" aria-label="Breezy HEMS, aperçu"><span class="brand-m">${icon("energy")}</span><span class="brand-t">Breezy <em>HEMS</em></span></a>
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
      ${[["light", "Clair", "sun"], ["dark", "Sombre", "moon"], ["auto", HA ? "Comme Home Assistant" : "Automatique", "contrast"]].map(([k, l, ic]) => h`<button type="button" class="pop-i" role="menuitemradio" aria-checked="${String(t === k)}" data-act="theme-set" data-value="${k}">${icon(ic)}<span>${l}</span></button>`)}
      <p class="pop-h">Connexion</p>
      ${HA ? haConnection() : h`<div class="pop-i">${icon("plug")}<span><strong>Données de démonstration</strong><small>Les valeurs sont des exemples tant que Home Assistant n'est pas branché.</small></span></div>`}`;
  }
  // Home Assistant : état de la connexion, version, et le diagnostic (entités introuvables…) à portée de main
  function haConnection() {
    const n = BZ.diagCount ? BZ.diagCount() : 0;
    return h`<div class="pop-i">${icon("plug")}<span><strong>${HA.connected ? "Connecté à Home Assistant" : "Connexion perdue, reconnexion…"}</strong><small>Breezy ${esc(HA.version)}</small></span></div>
      <button type="button" class="pop-i" role="menuitem" data-act="open-sheet" data-sheet="diag">${icon("alert")}<span><strong>Diagnostic${n ? ` (${n})` : ""}</strong><small>${n ? `${n} point${n > 1 ? "s" : ""} à vérifier` : "Rien à corriger"}</small></span></button>`;
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
      <a href="${BZ.href(r.id)}" ${r.id === cur ? 'aria-current="page"' : ""} aria-label="${r.label}${r.id === "home" && lights ? `, ${lights} lumière${lights > 1 ? "s" : ""} allumée${lights > 1 ? "s" : ""}` : ""}${r.id === "vehicle" && L.charging ? ", en charge" : ""}">
        <span class="tab-ic">${icon(r.ic)}${mark[r.id] || ""}</span><span class="tab-l">${r.label}</span></a>`)}`;
  }

  /* ─── Rendu ────────────────────────────────────────────────────────── */
  const view = document.getElementById("view");
  let lastRoute = null;
  function render() {
    // Panneau Home Assistant quitté : la page est détachée du document, son retour la redessine (rien à faire ici)
    if (!view.isConnected) return;
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
      // Un bouton qui disparaît au rendu (« Réessayer » une fois relancé ou expiré) rend le focus à l'élément
      // qu'il désigne (data-refocus) : au clavier, on ne repart pas du début de la page
      const ae = document.activeElement, back = ae && ae.dataset && ae.dataset.refocus;
      BZ.morph(view, html);
      if (back && (!ae.isConnected || ae.dataset.refocus !== back)) view.querySelector(back)?.focus();
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
    if (!s) { if (sheetEl.classList.contains("is-open")) { sheetEl.classList.remove("is-open"); sheetEl.setAttribute("aria-hidden", "true"); bg.forEach((el) => el && (el.inert = false)); lastFocus && lastFocus.focus({ preventScroll: true }); } return; }
    bg.forEach((el) => el && (el.inert = true));   // le focus reste dans le panneau
    const [kind, i] = s.split(":"), d = BZ.sheets[kind](i != null ? +i : undefined);
    sheetEl.classList.toggle("is-full", !!d.full);
    const html = h`<div class="sheet-p ${d.full ? "is-full" : ""}" role="dialog" aria-modal="true" aria-labelledby="sheet-t" tabindex="-1">
      <header class="sheet-h"><span class="chip" data-tone="${d.tone}">${icon(d.ic)}</span><div><h2 id="sheet-t">${d.title}</h2><p>${d.sub}</p></div>
        <button type="button" class="icon-btn" data-act="close-sheet" aria-label="Fermer le panneau">${icon("x")}</button></header>
      <div class="sheet-b">${d.body}</div></div><div class="sheet-bg" data-act="close-sheet"></div>`;
    if (!sheetEl.classList.contains("is-open")) {
      sheetEl.innerHTML = html; sheetEl.classList.add("is-open"); sheetEl.removeAttribute("aria-hidden");
      lastFocus = document.activeElement;
      // Au doigt, le focus va au panneau lui-même (pas d'anneau sur le bouton Fermer) ; au clavier, sur la première commande
      requestAnimationFrame(() => (matchMedia("(pointer: coarse)").matches ? sheetEl.querySelector(".sheet-p") : sheetEl.querySelector(".vs, .sheet-b button, .icon-btn") || sheetEl).focus());
    } else BZ.morph(sheetEl, html);
  }
  const openSheet = (k) => { BZ.ui.sheet = k; BZ.ui.pop = null; render(); };
  const closeSheet = () => { BZ.ui.sheet = null; BZ.ui.armed = null; renderSheet(); };

  /* ─── Actions ──────────────────────────────────────────────────────── */
  const step = (id, d, by, lo, hi) => BZ.clamp(num(id) + by * d, lo, hi);
  let armTimer;
  const confirm2 = (key, run, msg) => {
    if (BZ.ui.armed === key) { BZ.ui.armed = null; clearTimeout(armTimer); run(); return; }
    BZ.ui.armed = key; BZ.ui.armedAt = Date.now(); if (msg) BZ.toast(msg); clearTimeout(armTimer);
    armTimer = setTimeout(() => { BZ.ui.armed = null; render(); }, 4000); render();
  };
  // Message affiché une fois la commande appliquée (msg peut être une fonction : lue après coup)
  // Home Assistant : une commande refusée renvoie false (le message d'erreur est déjà affiché)
  const done = (msg) => (ok) => { if (ok === false) return; BZ.toast(typeof msg === "function" ? msg() : msg, "good"); };
  // Commande voiture : une à la fois ; le message part quand la voiture a confirmé (ou l'échec).
  // Pupitre de la page Voiture à l'écran : sa ligne le dit déjà (et sur mobile le toast couvrirait les tuiles) ;
  // page défilée plus bas ou autre page : toast
  const carBusy = () => !!BZ.slowBusy() && (BZ.toast("Attends la fin de la commande en cours", "warn"), true);
  const seen = (el) => { const r = el && el.getBoundingClientRect(); return !!r && r.bottom > 60 && r.top < innerHeight - 90; };
  const car = (key, service, id, data, to, expect, ok) => {
    if (carBusy()) return;
    if (BZ.ui.armed === "unlock") { BZ.ui.armed = null; clearTimeout(armTimer); }   // une autre commande part : le déverrouillage n'est plus à confirmer
    return BZ.slowCall(key, service, id, data, { to, expect })
      .then((good) => (route() !== "vehicle" || !seen(document.querySelector(".ve-acts"))) && BZ.toast(good ? ok : BZ.slowOf(key)?.why || "La voiture n'a pas répondu", good ? "good" : "bad"));
  };
  // Cible explicite (d.to) : « Réessayer » relance la commande échouée telle quelle, sans basculer l'état actuel
  const aim = (d, now) => (d.to != null ? d.to === "true" : !now);
  // Volet : position en % ; Home Assistant, volet sans réglage de position (ouvert / fermé seulement) : ouvrir ou fermer
  const coverTo = (ids, pos) => {
    const all = [].concat(ids), plain = HA ? all.filter((id) => !(attr(id, "supported_features") & 4)) : [];
    if (!plain.length) return call("cover.set_cover_position", ids, { position: pos });
    const rest = all.filter((id) => !plain.includes(id));
    return Promise.all([call(`cover.${pos > 0 ? "open" : "close"}_cover`, plain), rest.length ? call("cover.set_cover_position", rest, { position: pos }) : true]).then((r) => (r.includes(false) ? false : true));
  };
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
    // Fait défiler jusqu'à une carte de la page et la signale brièvement (maison en direct → carte détaillée)
    spot: (d) => {
      const el = document.querySelector(`.${d.spot}`); if (!el) return;
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
      if (!still && el.animate) el.animate([{ boxShadow: "0 0 0 0 color-mix(in srgb, var(--accent) 0%, transparent)" }, { boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 55%, transparent)", offset: 0.25 }, { boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 0%, transparent)" }], { duration: 1600, delay: 350, easing: "ease-out" });
      // Le titre de la carte porte tabindex="-1" dans son gabarit (card({ target: true })) : le focus survit aux rendus
      (el.querySelector("h3[tabindex]") || el).focus({ preventScroll: true });
    },
    // Service du domaine de l'entité (light.toggle, switch.toggle…) : switch.toggle n'agit pas sur une lumière
    toggle: (d) => call(`${d.entity.split(".")[0]}.toggle`, d.entity).then(done(() => `${nameOf(d.entity) || "Appareil"} ${isOn(d.entity) ? "allumé" : "éteint"}`.replace(/^(Lumière .*) (allumé|éteint)$/, "$1 $2e"))),
    // Maison
    "lights-off": () => call("light.turn_off", C.lumieres.filter(isOn)).then(done("Toutes les lumières sont éteintes")),
    "covers-all": (d) => coverTo(C.volets, +d.pos).then(done(+d.pos ? "Volets ouverts" : "Volets fermés")),
    "cover-flip": (d) => { const id = C.volets[d.i], p = BZ.coverPos(id) > 0 ? 0 : 100; return coverTo(id, p).then(done(`${C.volets_noms[d.i]} ${p ? "ouvert" : "fermé"}`)); },
    "cover-set": (d) => coverTo(C.volets[d.i], +d.pos),
    "rad-power": (d) => { const id = C.radiateurs[d.i]; return call("climate.set_hvac_mode", id, { hvac_mode: st(id) === "off" ? "heat" : "off" }).then(done(() => `Radiateur ${C.radiateurs_noms[d.i]} ${st(id) === "off" ? "éteint" : "allumé"}`)); },
    // Poêle : une seconde touche dans les 4 s confirme (évite d'allumer ou d'éteindre par erreur)
    "stove-power": () => { const on = st(C.poele) !== "off";
      return confirm2("stove", () => call("climate.set_hvac_mode", C.poele, { hvac_mode: on ? "off" : "heat" }).then(done(on ? "Poêle éteint" : "Poêle allumé")), on ? "Appuie encore pour éteindre le poêle" : "Appuie encore pour allumer le poêle"); },
    // Démo : la chauffe suit le forçage ; Home Assistant : c'est le ballon qui le dit (son état n'est jamais modifié ici)
    "boiler-boost": () => call("number.set_value", C.ballon_boost, { value: num(C.ballon_boost) === 1 ? 0 : 1 }).then((ok) => { if (ok === false) return; if (!HA) BZ.ent(C.ballon_chauffe).state = num(C.ballon_boost) === 1 ? "on" : "off"; BZ.toast(num(C.ballon_boost) === 1 ? "Chauffe du ballon forcée" : "Ballon en mode normal", "good"); }),
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
    // Voiture : commandes lentes (cloud Kia Connect), suivies jusqu'à ce que la voiture confirme
    "car-charge": (d) => { const on = aim(d, isOn(C.voiture_en_charge));
      return car("charge", `switch.turn_${on ? "on" : "off"}`, C.voiture_en_charge, {}, on, () => isOn(C.voiture_en_charge) === on, on ? "Recharge démarrée" : "Recharge arrêtée"); },
    // Déverrouiller demande une seconde touche : la tuile devient « Déverrouiller ? » avec son compte à rebours (pas de message)
    "car-lock": (d) => (carBusy() ? null : (d.to || (st(C.voiture_verrou) === "locked" ? "unlocked" : "locked")) === "unlocked"
      ? confirm2("unlock", () => car("lock", "lock.unlock", C.voiture_verrou, {}, "unlocked", () => st(C.voiture_verrou) === "unlocked", "Voiture déverrouillée"), null)
      : car("lock", "lock.lock", C.voiture_verrou, {}, "locked", () => st(C.voiture_verrou) === "locked", "Voiture verrouillée")),
    "car-clim": (d) => { const on = aim(d, isOn(C.voiture_clim));
      return car("clim", `switch.turn_${on ? "on" : "off"}`, C.voiture_clim, {}, on, () => isOn(C.voiture_clim) === on, on ? "Climatisation lancée" : "Climatisation arrêtée"); },
    "car-refresh": () => { const was = st(C.voiture_maj);
      return car("refresh", "button.press", C.voiture_rafraichir, {}, null, () => st(C.voiture_maj) !== was, "Relevé à jour"); },
    "car-lim": (d) => call("number.set_value", C.voiture_limite_pct, { value: step(C.voiture_limite_pct, +d.d, 10, 50, 100) }),
    "car-limdc": (d) => call("number.set_value", C.voiture_limite_dc_pct, { value: step(C.voiture_limite_dc_pct, +d.d, 10, 50, 100) }),
    "car-service": () => confirm2("service", () => call("input_number.set_value", C.entretien_dernier_km, { value: num(C.voiture_odometre) }).then(done("Révision enregistrée au compteur actuel")), "Appuie encore pour remettre le compteur de révision à zéro"),
    "car-service-km": () => { const v = parseInt(prompt("Kilométrage de la révision :", num(C.entretien_dernier_km)), 10); if (Number.isFinite(v)) call("input_number.set_value", C.entretien_dernier_km, { value: v }).then(done("Révision enregistrée")); },
    "ha-menu": () => HA && HA.toggleMenu(),
  };
  // Actions des fichiers propres à Home Assistant (diagnostic, historique), chargés avant celui-ci
  Object.assign(A, BZ.extraActions || {});
  BZ.actions = A;
  // Page visée par un lien interne : « #/energy » (démo) ; Home Assistant : l'adresse du panneau (/breezy/energy)
  const linkTo = (a) => {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("#/")) return href.slice(2);
    if (!HA || !href.startsWith("/")) return null;
    const id = HA.idOf(href);
    return ROUTES.some((x) => x.id === id) ? id : null;
  };
  // Home Assistant écoute les clics sur les liens du cadre (sur body) et les envoie à la page principale : on garde pour
  // nous les clics simples sur nos liens dès la phase de capture (le gestionnaire ci-dessous fait la navigation). Ctrl,
  // Cmd, Maj, clic du milieu : le navigateur ouvre la vraie adresse de la page (/breezy/energy) dans un nouvel onglet
  if (HA) document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const href = a.getAttribute("href");
    if (href.startsWith("#") && !href.startsWith("#/")) { e.preventDefault(); const t = document.getElementById(href.slice(1)); if (t) t.focus(); return; }   // lien d'évitement « #view »
    if (linkTo(a)) e.preventDefault();
  }, true);
  document.addEventListener("click", (e) => {
    // Liens internes vers une page : navigation gérée ici
    const a = e.target.closest("a[href]"), to = a && linkTo(a);
    // data-spot : une fois sur la page, on va jusqu'à la carte visée (pastilles de la maison de l'Aperçu)
    if (to && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); go(to); if (a.dataset.spot) A.spot({ spot: a.dataset.spot }); return; }
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
    cover: (i, v) => coverTo(C.volets[i], v),
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

  /* ─── Thème : clair par défaut (comme la maquette), sombre, ou automatique ─
     Home Assistant : automatique par défaut, et « automatique » suit le thème choisi dans HA (pas celui du système) */
  function applyTheme() {
    const t = BZ.ui.theme, auto = HA ? HA.darkMode : matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = t === "dark" || (t === "auto" && auto);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#0e0f12" : "#e9ebef";
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (BZ.ui.theme === "auto") { applyTheme(); render(); } });

  /* ─── Mode « une page » : seulement quand l'écran peut tout tenir, sinon la page défile ─ */
  const fitQ = matchMedia("(min-width: 1366px) and (min-height: 820px), (min-width: 1200px) and (min-height: 900px)");
  const applyFit = () => document.body.classList.toggle("fit", fitQ.matches);
  fitQ.addEventListener("change", applyFit);

  /* ─── Home Assistant : menu, connexion, page affichée ─────────────────── */
  // Bouton menu : mêmes règles que celui de HA (écran étroit ou barre latérale masquée, hors mode kiosque)
  const haChrome = () => {
    const root = document.documentElement;
    root.toggleAttribute("data-ha-menu", HA.showMenu);
    root.toggleAttribute("data-ha-offline", !HA.connected);
  };
  if (HA) {
    HA.on("theme", () => { if (BZ.ui.theme === "auto") { applyTheme(); render(); } });
    // « Retour » du navigateur ou lien vers /breezy/vehicle : HA nous donne la nouvelle adresse
    HA.on("route", (r) => { const id = routeOf(r) || "overview"; if (id !== current) go(id, false); });
    ["narrow", "meta", "connection"].forEach((type) => HA.on(type, () => { BZ.user = userName(); haChrome(); render(); }));
  }

  /* ─── Démarrage ────────────────────────────────────────────────────── */
  applyFit();
  applyTheme();
  topInit();
  if (HA) { haChrome(); if (haLegacy) HA.navigate(current, { replace: true }); }   // ancien lien « #/page » : l'adresse devient /breezy/page
  const sync = () => { const r = fromHash(); if (r && r !== current) go(r, false); };
  if (!HA) { window.addEventListener("hashchange", sync); window.addEventListener("popstate", sync); }
  BZ.subscribe(render);
  setTimeout(() => { document.body.classList.remove("is-loading"); render(); }, 400);
})();
