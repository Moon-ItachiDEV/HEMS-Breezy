// Maison (V3) : la page domotique validée en V1/V2 (façon Apple Maison, rangée par type d'objet,
// poêle et ballon côte à côte, lecteur sans carte avec pochette), dans la mise en page de la V3 :
// en-tête · 4 indicateurs · filtres · grille ⅔ + ⅓ où toutes les tuiles ont la même largeur,
// pour que les rangées restent alignées d'une section à l'autre.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val, card, btn, C, num, st, attr, isOn, esc } = BZ;

  /* ─── Tuile : l'icône agit tout de suite, le texte ouvre le détail ─── */
  const tile = (a, extra = "") => h`
    <div class="ma-tile ${a.on ? "is-on" : ""}" data-tone="${a.tone}" data-key="${a.id}${a.name}">
      <button type="button" class="ma-tile-i" data-act="${a.quick || "open-sheet"}" ${a.quick === "toggle" ? `data-entity="${a.id}"` : ""} ${a.sheet ? `data-sheet="${a.sheet}"` : ""} ${a.quick && a.quick !== "toggle" ? BZ.dataArgs({ i: (a.sheet || "").split(":")[1] || "" }) : ""}
        aria-label="${esc(`${a.name} : ${a.quick ? (a.on ? "éteindre" : "allumer") : "ouvrir"}`)}" aria-pressed="${String(a.on)}" ${BZ.isPending(a.id) ? 'aria-busy="true"' : ""}>${icon(a.ic)}</button>
      <button type="button" class="ma-tile-t" ${a.sheet ? `data-act="open-sheet" data-sheet="${a.sheet}"` : `data-act="${a.quick}" data-entity="${a.id}"`}><strong>${a.name}</strong><span>${a.state}</span></button>
      ${extra}
    </div>`;
  // Volets : un trait fin indique l'ouverture
  const coverTile = (a, i) => tile(a, h`<i class="ma-pos" style="--v:${attr(C.volets[i], "current_position")}%" aria-hidden="true"></i>`);

  /* ─── Lecteur « À l'écoute » : sans carte, avec la pochette ────────── */
  function nowPlaying() {
    const hp = C.homepod, s = st(hp);
    if (!["playing", "paused"].includes(s)) return "";
    const playing = s === "playing", dur = attr(hp, "media_duration") || 0, pos = attr(hp, "media_position") || 0, pic = attr(hp, "entity_picture");
    return h`<div class="ma-np ${playing ? "is-playing" : ""}">
      <button type="button" class="ma-np-art" data-act="open-sheet" data-sheet="media" aria-label="Ouvrir le lecteur">${pic ? h`<img src="${esc(pic)}" alt="">` : h`<span class="ma-np-gen" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`}</button>
      <button type="button" class="ma-np-t" data-act="open-sheet" data-sheet="media">
        <span class="ma-np-src">${playing ? h`<span class="ma-eq" aria-hidden="true"><i></i><i></i><i></i></span>` : ""}HomePod salon${playing ? "" : " · en pause"}</span>
        <strong>${esc(attr(hp, "media_title") || "—")}</strong><span>${esc(attr(hp, "media_artist") || "")}</span>
      </button>
      <div class="ma-np-c">
        <button type="button" data-act="media" data-cmd="previous" aria-label="Morceau précédent" ${BZ.isPending(hp) ? 'aria-busy="true"' : ""}>${icon("prev")}</button>
        <button type="button" class="ma-np-play" data-act="media" data-cmd="play_pause" aria-label="${playing ? "Pause" : "Lecture"}">${icon(playing ? "pause" : "play")}</button>
        <button type="button" data-act="media" data-cmd="next" aria-label="Morceau suivant">${icon("next")}</button>
      </div>
      ${dur ? h`<div class="ma-np-p" role="progressbar" aria-label="Avancement du morceau" aria-valuemin="0" aria-valuemax="${dur}" aria-valuenow="${pos}"><span>${fmt.n(Math.floor(pos / 60))}:${String(Math.floor(pos % 60)).padStart(2, "0")}</span><i><b style="--v:${(pos / dur) * 100}%"></b></i><span>−${fmt.n(Math.floor((dur - pos) / 60))}:${String(Math.floor((dur - pos) % 60)).padStart(2, "0")}</span></div>` : ""}
    </div>`;
  }

  /* ─── Indicateur cliquable : filtre la page sur une famille ─────────── */
  const fkpi = ({ k, label, ic, tone, value, note, viz }) => h`
    <button type="button" class="kpi ma-kpi ${BZ.ui.homeFilter === k ? "is-sel" : ""}" data-act="set" data-k="homeFilter" data-value="${BZ.ui.homeFilter === k ? "all" : k}" aria-pressed="${String(BZ.ui.homeFilter === k)}" aria-label="${esc(`${label} : afficher seulement cette famille`)}">
      <span class="kpi-i" data-tone="${tone}">${icon(ic)}</span>
      <span class="kpi-l">${label}</span>
      <span class="kpi-v">${value}</span>
      <span class="kpi-d"><span class="kpi-vs">${note}</span></span>
      <span class="kpi-s ma-viz" data-tone="${tone}" aria-hidden="true">${viz}</span>
    </button>`;

  BZ.pages.home = () => {
    const f = BZ.ui.homeFilter;
    const lights = C.lumieres.map((_, i) => BZ.acc("light", i)), covers = C.volets.map((_, i) => BZ.acc("cover", i));
    const heat = [BZ.acc("stove"), BZ.acc("boiler"), ...C.radiateurs.map((_, i) => BZ.acc("rad", i))];
    const devices = [BZ.acc("plug"), BZ.acc("strip"), BZ.acc("robot")];
    const litNames = lights.filter((a) => a.on).map((a) => a.name), openN = covers.filter((a) => a.on).length;
    const rooms = C.radiateurs.map((id, i) => ({ name: C.radiateurs_noms[i], t: C.radiateurs_temp[i] ? num(C.radiateurs_temp[i]) : attr(id, "current_temperature") }));
    const salon = attr(C.poele, "current_temperature"), temps = [salon, ...rooms.map((r) => r.t)];
    const tMin = Math.min(...temps), tMax = Math.max(...temps), activeDev = devices.filter((a) => a.on);
    const locked = st(C.voiture_verrou) === "locked", meteo = { sunny: "ensoleillé", cloudy: "nuageux", rainy: "pluie", partlycloudy: "éclaircies", clear: "dégagé" }[st(C.meteo)] || st(C.meteo);
    const allOff = !lights.some((a) => a.on), tremieDays = num(C.tremie_kg) / num(C.conso_jour_kg);

    const sections = {
      lights: card({ cls: "ma-sec ma-lights", title: "Lumières", sub: litNames.length ? `${litNames.length} allumée${litNames.length > 1 ? "s" : ""} sur ${lights.length}` : "Toutes éteintes", ic: "bulb", tone: "light",
        aside: btn({ label: "Tout éteindre", ic: "power", act: "lights-off", kind: "soft", size: "sm", disabled: allOff, pending: C.lumieres.some(BZ.isPending) }),
        body: h`<div class="ma-tiles">${lights.map((a) => tile(a))}</div>` }),
      covers: card({ cls: "ma-sec ma-covers", title: "Volets", sub: `${openN} ouvert${openN > 1 ? "s" : ""} sur ${covers.length}`, ic: "blinds", tone: "battery",
        aside: h`${btn({ label: "Ouvrir", ic: "up", act: "covers-all", args: { pos: 100 }, kind: "ghost", size: "sm", disabled: openN === covers.length })}${btn({ label: "Fermer", ic: "down", act: "covers-all", args: { pos: 0 }, kind: "ghost", size: "sm", disabled: openN === 0 })}`,
        body: h`<div class="ma-tiles">${covers.map((a, i) => coverTile(a, i))}</div>` }),
      heat: card({ cls: "ma-sec ma-heat", title: "Chauffage", sub: `${fmt.n(tMin, 1)}–${fmt.n(tMax, 1)}° dans la maison`, ic: "thermo", tone: "heat",
        aside: tremieDays < 2 ? BZ.pill(`Trémie ${fmt.n(num(C.tremie_kg))} kg · ~${fmt.n(tremieDays * 24)} h`, "warn") : BZ.pill(`Trémie ${fmt.n(num(C.tremie_kg))} kg`, "neutral"),
        body: h`<div class="ma-tiles">${heat.map((a) => tile(a))}</div>` }),
      devices: card({ cls: "ma-sec ma-dev", title: "Appareils", sub: activeDev.length ? `${activeDev.length} en marche` : "Tout est éteint", ic: "plug", tone: "good",
        body: h`<div class="ma-tiles">${devices.map((a) => tile(a))}</div>` }),
    };
    const order = f === "all" ? ["lights", "devices", "covers", "heat"] : [f];
    const counts = { lights: litNames.length, covers: openN, heat: heat.filter((a) => a.on).length, devices: activeDev.length };

    return h`
      <header class="ph ma-ph">
        <div><p class="ph-hi">${fmt.n(attr(C.meteo, "temperature"))}° dehors · ${meteo}</p><h1>Maison</h1>
          <p class="ph-sub">${litNames.length ? `${litNames.length} lumière${litNames.length > 1 ? "s" : ""} allumée${litNames.length > 1 ? "s" : ""}` : "Lumières éteintes"} · ${openN} volet${openN > 1 ? "s" : ""} ouvert${openN > 1 ? "s" : ""} · ${fmt.n(salon, 1)}° au salon</p></div>
        <div class="ph-a">${nowPlaying()}</div>
      </header>

      <div class="kpis ma-kpis">
        ${fkpi({ k: "lights", label: "Lumières allumées", ic: "bulb", tone: "light", value: val([String(litNames.length), `/ ${lights.length}`]), note: litNames.join(", ") || "aucune",
          viz: h`<span class="ma-dots">${lights.map((a) => h`<i class="${a.on ? "is-on" : ""}"></i>`)}</span>` })}
        ${fkpi({ k: "covers", label: "Volets ouverts", ic: "blinds", tone: "battery", value: val([String(openN), `/ ${covers.length}`]), note: covers.filter((a) => !a.on).map((a) => a.name).join(", ") ? `fermés : ${covers.filter((a) => !a.on).map((a) => a.name).join(", ")}` : "tous ouverts",
          viz: h`<span class="ma-bars">${C.volets.map((id) => h`<i style="--v:${Math.max(6, attr(id, "current_position"))}%"></i>`)}</span>` })}
        ${fkpi({ k: "heat", label: "Température au salon", ic: "thermo", tone: "heat", value: val([fmt.n(salon, 1), "°C"]), note: `pièces de ${fmt.n(tMin, 1)} à ${fmt.n(tMax, 1)}°`,
          viz: h`<span class="ma-bars is-temp">${temps.map((t) => h`<i style="--v:${Math.round(((t - 14) / 10) * 100)}%"></i>`)}</span>` })}
        ${fkpi({ k: "devices", label: "Appareils en marche", ic: "plug", tone: "good", value: val([String(activeDev.length), `/ ${devices.length}`]), note: isOn(C.prise_chambre) ? `prise chambre ${fmt.powerText(num(C.prise_chambre_w))}` : activeDev.map((a) => a.name).join(", ") || "aucun",
          viz: h`<span class="ma-dots">${devices.map((a) => h`<i class="${a.on ? "is-on" : ""}"></i>`)}</span>` })}
      </div>

      <div class="ma-bar">
        ${BZ.pills({ name: "homeFilter", label: "Filtrer par famille", value: f, options: [["all", "Tout"], ["lights", "Lumières", counts.lights], ["covers", "Volets", counts.covers], ["heat", "Chauffage", counts.heat], ["devices", "Appareils", counts.devices]] })}
        <a class="ma-lock ${locked ? "" : "is-open"}" href="#/vehicle">${icon(locked ? "lock" : "unlock")}<span>e-Niro ${locked ? "verrouillée" : "ouverte"}</span></a>
      </div>

      <div class="layout ma-grid ${f === "all" ? "is-all" : "is-one"}">${order.map((k) => sections[k])}</div>`;
  };
})();
