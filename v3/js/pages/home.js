// Maison (V3) : la page domotique validée en V1/V2 (façon Apple Maison, rangée par type d'objet,
// poêle et ballon côte à côte, lecteur sans carte avec pochette), dans la mise en page de la V3 :
// en-tête · 4 indicateurs (qui servent aussi de filtres) · grille ⅔ + ⅓.
// Toutes les tuiles ont la même hauteur et les emplacements libres reçoivent des actions groupées,
// pour que les rangées restent alignées d'une section à l'autre sans trou.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val, card, C, num, st, attr, isOn, esc } = BZ;

  /* ─── Tuile : l'icône agit tout de suite, le texte ouvre le détail ─── */
  const tile = (a, extra = "") => {
    const iconAct = a.toggle
      ? h`data-act="${a.quick}" ${a.quick === "toggle" ? `data-entity="${a.id}"` : BZ.dataArgs(a.args || { i: (a.sheet || "").split(":")[1] || "" })} aria-label="${esc(`${a.verb} : ${a.name}`)}" aria-pressed="${String(a.on)}"`
      : h`data-act="open-sheet" data-sheet="${a.sheet}" aria-label="${esc(`Ouvrir ${a.name}`)}"`;
    return h`<div class="ma-tile ${a.on ? "is-on" : ""} ${a.anim || ""}" data-tone="${a.tone}" data-key="${a.id}${a.name}">
      <button type="button" class="ma-tile-i ${a.armed ? "is-armed" : ""}" ${iconAct} ${BZ.isPending(a.id) ? 'aria-busy="true"' : ""}>${icon(a.ic)}</button>
      <button type="button" class="ma-tile-t" ${a.sheet ? `data-act="open-sheet" data-sheet="${a.sheet}"` : a.toggle ? h`data-act="${a.quick}" ${a.quick === "toggle" ? `data-entity="${a.id}"` : BZ.dataArgs(a.args || {})} aria-pressed="${String(a.on)}"` : `data-act="nav" data-to="${a.to}"`}><strong>${a.name}</strong><span>${a.state}</span></button>
      ${extra}
    </div>`;
  };
  // Volets : un trait fin sous le texte indique l'ouverture
  const coverTile = (a) => tile(a, h`<i class="ma-pos" style="--v:${a.pos}%" aria-hidden="true"></i>`);
  // Action groupée : remplit les emplacements libres d'une grille
  const actionTile = ({ label, sub, ic, act, args = {}, disabled, pending, tone = "accent" }) => h`
    <button type="button" class="ma-tile ma-act" data-tone="${tone}" data-act="${act}" ${BZ.dataArgs(args)} ${disabled ? "disabled" : ""} ${pending ? 'aria-busy="true"' : ""}>
      <span class="ma-tile-i" aria-hidden="true">${icon(ic)}</span><span class="ma-tile-t"><strong>${label}</strong><span>${sub}</span></span></button>`;

  /* ─── Lecteur « À l'écoute » : sans carte, avec la pochette ────────── */
  function nowPlaying() {
    const M = BZ.media();
    if (!M.active) return "";
    return h`<div class="ma-np ${M.playing ? "is-playing" : ""}">
      <button type="button" class="ma-np-art" data-act="open-sheet" data-sheet="media" aria-label="Ouvrir le lecteur">${BZ.mediaArt(M)}</button>
      <button type="button" class="ma-np-t" data-act="open-sheet" data-sheet="media">
        <span class="ma-np-src">${M.playing ? h`<span class="ma-eq" aria-hidden="true"><i></i><i></i><i></i></span>` : ""}HomePod salon${M.playing ? "" : " · en pause"}</span>
        <strong>${esc(M.title || "—")}${M.artist ? h`<span> · ${esc(M.artist)}</span>` : ""}</strong>
      </button>
      <div class="ma-np-c">
        <button type="button" data-act="media" data-cmd="previous" aria-label="Morceau précédent">${icon("prev")}</button>
        <button type="button" class="ma-np-play" data-act="media" data-cmd="play_pause" aria-label="${M.playing ? "Pause" : "Lecture"}" ${BZ.isPending(C.homepod) ? 'aria-busy="true"' : ""}>${icon(M.playing ? "pause" : "play")}</button>
        <button type="button" data-act="media" data-cmd="next" aria-label="Morceau suivant">${icon("next")}</button>
      </div>
      <div class="ma-np-p">${BZ.mediaProgress(M)}</div>
    </div>`;
  }

  /* ─── Indicateur : résumé d'une famille, et filtre de la page ───────── */
  const fkpi = ({ k, label, ic, tone, value, valueText, note, viz }) => {
    const sel = BZ.ui.homeFilter === k;
    return h`<button type="button" class="kpi ma-kpi ${sel ? "is-sel" : ""}" data-act="set" data-k="homeFilter" data-value="${sel ? "all" : k}" aria-pressed="${String(sel)}"
      aria-label="${esc(`${label} : ${valueText}. ${sel ? "Afficher toute la maison" : "Ne montrer que cette famille"}`)}">
      <span class="kpi-i" data-tone="${tone}">${icon(ic)}</span>
      <span class="kpi-l">${label}</span>
      <span class="kpi-v">${value}</span>
      <span class="kpi-d"><span class="kpi-vs">${note}</span></span>
      <span class="kpi-s ma-viz" data-tone="${tone}" aria-hidden="true">${viz}</span>
    </button>`;
  };

  BZ.pages.home = () => {
    const f = BZ.ui.homeFilter;
    const lights = C.lumieres.map((_, i) => BZ.acc("light", i)), covers = C.volets.map((_, i) => BZ.acc("cover", i));
    const heat = [BZ.acc("stove"), BZ.acc("boiler"), ...C.radiateurs.map((_, i) => BZ.acc("rad", i))];
    const devices = [BZ.acc("plug"), BZ.acc("strip"), BZ.acc("robot")];
    const lit = lights.filter((a) => a.on), openN = covers.filter((a) => a.on).length, closed = covers.length - openN;
    const temps = [attr(C.poele, "current_temperature"), ...C.radiateurs.map((id, i) => (C.radiateurs_temp[i] ? num(C.radiateurs_temp[i]) : attr(id, "current_temperature")))];
    const tMin = Math.min(...temps), tMax = Math.max(...temps), heatOn = heat.filter((a) => a.on).length;
    const activeDev = devices.filter((a) => a.on), watts = isOn(C.prise_chambre) ? num(C.prise_chambre_w) : 0;
    const locked = st(C.voiture_verrou) === "locked", armed = BZ.ui.armed === "unlock";
    // États météo de Home Assistant (tous), en clair
    const meteo = { sunny: "ensoleillé", cloudy: "nuageux", rainy: "pluie", partlycloudy: "éclaircies", clear: "dégagé", "clear-night": "nuit claire", fog: "brouillard", hail: "grêle",
      lightning: "orage", "lightning-rainy": "orage et pluie", pouring: "averses", snowy: "neige", "snowy-rainy": "pluie et neige", windy: "venteux", "windy-variant": "venteux",
      exceptional: "exceptionnel", unavailable: "météo indisponible", unknown: "météo inconnue" }[st(C.meteo)] || st(C.meteo);
    const tremieH = (num(C.tremie_kg) / num(C.conso_jour_kg)) * 24;
    const coversBusy = C.volets.some(BZ.isPending);

    const sections = {
      lights: card({ cls: "ma-sec ma-lights", title: "Lumières", ic: "bulb", tone: "light", body: h`<div class="ma-tiles">
        ${lights.map((a) => tile(a))}
        ${actionTile({ label: "Tout éteindre", sub: lit.length ? `${lit.length} allumée${lit.length > 1 ? "s" : ""}` : "déjà éteintes", ic: "power", act: "lights-off", disabled: !lit.length, pending: C.lumieres.some(BZ.isPending) })}</div>` }),
      covers: card({ cls: "ma-sec ma-covers", title: "Volets", ic: "blinds", tone: "battery", body: h`<div class="ma-tiles">
        ${covers.map((a) => coverTile(a))}
        ${actionTile({ label: "Tout ouvrir", sub: closed ? `${closed} fermé${closed > 1 ? "s" : ""}` : "déjà ouverts", ic: "up", act: "covers-all", args: { pos: 100 }, disabled: !closed, pending: coversBusy, tone: "battery" })}
        ${actionTile({ label: "Mi-hauteur", sub: "tous à 50 %", ic: "minus", act: "covers-all", args: { pos: 50 }, pending: coversBusy, tone: "battery" })}
        ${actionTile({ label: "Tout fermer", sub: openN ? `${openN} ouvert${openN > 1 ? "s" : ""}` : "déjà fermés", ic: "down", act: "covers-all", args: { pos: 0 }, disabled: !openN, pending: coversBusy, tone: "battery" })}</div>` }),
      heat: card({ cls: "ma-sec ma-heat", title: "Chauffage", ic: "thermo", tone: "heat",
        aside: BZ.pill(`Granulés ≈ ${fmt.n(tremieH)} h`, tremieH < 48 ? "warn" : "neutral"),
        body: h`<div class="ma-tiles">${heat.map((a) => tile(a))}</div>` }),
      devices: card({ cls: "ma-sec ma-dev", title: "Appareils", ic: "plug", tone: "good", body: h`<div class="ma-tiles">
        ${devices.map((a) => tile(a))}
        <div class="ma-tile ${locked ? "is-on" : ""}" data-tone="${locked ? "good" : "warn"}">
          <button type="button" class="ma-tile-i ${armed ? "is-armed" : ""}" data-act="car-lock" aria-label="${armed ? "Confirmer le déverrouillage de l'e-Niro" : locked ? "Déverrouiller l'e-Niro" : "Verrouiller l'e-Niro"}" ${BZ.isPending(C.voiture_verrou) ? 'aria-busy="true"' : ""}>${icon(locked ? "lock" : "unlock")}</button>
          <button type="button" class="ma-tile-t" data-act="nav" data-to="vehicle"><strong>e-Niro</strong><span>${armed ? "Touche encore pour ouvrir" : locked ? "Verrouillée" : "Ouverte"}</span></button>
        </div></div>` }),
    };
    const order = ["lights", "devices", "covers", "heat"];
    const famLabel = { lights: "Lumières", covers: "Volets", heat: "Chauffage", devices: "Appareils" };

    return h`
      <header class="ph ma-ph">
        <div><p class="ph-hi">${fmt.n(attr(C.meteo, "temperature"))}° dehors · ${meteo}</p><h1>Maison</h1>
          <p class="ph-sub">Humidité ${fmt.n(attr(C.meteo, "humidity"))} % · vent ${fmt.n(attr(C.meteo, "wind_speed"))} ${esc(attr(C.meteo, "wind_speed_unit") || "km/h")}</p></div>
        <div class="ph-a">${nowPlaying()}</div>
      </header>

      <div class="kpis ma-kpis">
        ${fkpi({ k: "lights", label: "Lumières allumées", ic: "bulb", tone: "light", value: val([String(lit.length), `/ ${lights.length}`]), valueText: `${lit.length} sur ${lights.length}`,
          note: lit.length ? `${lit[0].name}${lit.length > 1 ? ` +${lit.length - 1}` : ""}` : "aucune",
          viz: h`<span class="ma-dots">${lights.map((a) => h`<i class="${a.on ? "is-on" : ""}"></i>`)}</span>` })}
        ${fkpi({ k: "covers", label: "Volets ouverts", ic: "blinds", tone: "battery", value: val([String(openN), `/ ${covers.length}`]), valueText: `${openN} sur ${covers.length}`,
          note: closed ? `${closed} fermé${closed > 1 ? "s" : ""}` : "tous ouverts",
          viz: h`<span class="ma-bars">${covers.map((a) => h`<i style="--v:${Math.max(6, a.pos)}%"></i>`)}</span>` })}
        ${fkpi({ k: "heat", label: "Chauffage en marche", ic: "thermo", tone: "heat", value: val([String(heatOn), `/ ${heat.length}`]), valueText: `${heatOn} sur ${heat.length}`,
          note: `pièces de ${fmt.n(tMin, 1)} à ${fmt.n(tMax, 1)}°`,
          viz: h`<span class="ma-bars is-temp">${temps.map((t) => h`<i style="--v:${Math.round(((t - 14) / 10) * 100)}%"></i>`)}</span>` })}
        ${fkpi({ k: "devices", label: "Appareils en marche", ic: "plug", tone: "good", value: val([String(activeDev.length), `/ ${devices.length}`]), valueText: `${activeDev.length} sur ${devices.length}`,
          note: watts ? `consomment ${fmt.powerText(watts)}` : "rien ne consomme",
          viz: h`<span class="ma-dots">${devices.map((a) => h`<i class="${a.on ? "is-on" : ""}"></i>`)}</span>` })}
      </div>

      ${f !== "all" ? h`<div class="ma-filter"><span>Filtre : <b>${famLabel[f]}</b></span><button type="button" class="more" data-act="set" data-k="homeFilter" data-value="all">Tout afficher${icon("x")}</button></div>` : ""}

      <div class="layout ma-grid ${f !== "all" ? "is-filtered" : ""}">${order.map((k) => (f === "all" || f === k ? sections[k] : sections[k].replace('class="card ma-sec', 'class="card ma-sec is-dim')))}</div>`;
  };
})();
