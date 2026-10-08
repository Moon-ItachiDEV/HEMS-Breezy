// Maison : façon Apple Maison (conservé de la V1, que tu as validé), avec des tuiles accessibles,
// des filtres comptés, le lecteur dans l'en-tête et un panneau de détail par accessoire.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, card, badge, btn, toggle, stepper, segmented, meter, C, num, st, attr, isOn, esc } = BZ;

  // Décrit un accessoire : catégorie, icône, état lisible, action au toucher de l'icône
  function acc(kind, i) {
    if (kind === "light") { const id = C.lumieres[i]; return { id, cat: "lights", ic: "bulb", tone: "light", name: C.lumieres_noms[i], on: isOn(id), state: isOn(id) ? "Allumée" : "Éteinte", quick: "toggle" }; }
    if (kind === "cover") { const id = C.volets[i], p = attr(id, "current_position"); return { id, cat: "covers", ic: "blinds", tone: "battery", name: C.volets_noms[i], on: p > 0, state: p === 0 ? "Fermé" : p === 100 ? "Ouvert" : `Ouvert à ${p} %`, quick: "cover-flip", sheet: `cover:${i}` }; }
    if (kind === "rad") { const id = C.radiateurs[i], on = st(id) !== "off", t = C.radiateurs_temp[i]; return { id, cat: "heat", ic: "thermo", tone: "heat", name: C.radiateurs_noms[i], on, state: `${fmt.n(t ? num(t) : attr(id, "current_temperature"), 1)}°${on ? ` → ${fmt.n(attr(id, "temperature"), 1)}°` : " · éteint"}`, quick: "rad-power", sheet: `rad:${i}` }; }
    if (kind === "stove") { const on = st(C.poele) !== "off"; return { id: C.poele, cat: "heat", ic: "flame", tone: "bad", name: "Poêle", on, state: on ? `${fmt.n(attr(C.poele, "current_temperature"), 1)}° · P${st(C.poele_puissance)} · ${fmt.n(num(C.tremie_kg))} kg` : "Éteint", quick: "stove-power", sheet: "poele" }; }
    if (kind === "boiler") { const on = isOn(C.ballon_chauffe) || num(C.ballon_boost) === 1; return { id: C.ballon_boost, cat: "heat", ic: "drop", tone: "battery", name: "Ballon", on, state: `${fmt.n(num(C.ballon_temp))}° → ${fmt.n(attr(C.ballon, "temperature"))}°${on ? " · chauffe" : ""}`, quick: "boiler-boost", sheet: "ballon" }; }
    if (kind === "plug") return { id: C.prise_chambre, cat: "devices", ic: "plug", tone: "good", name: "Prise chambre", on: isOn(C.prise_chambre), state: isOn(C.prise_chambre) ? fmt.powerText(num(C.prise_chambre_w)) : "Éteinte", quick: "toggle" };
    if (kind === "strip") { const k = C.multiprise.filter(isOn).length; return { id: C.multiprise[0], cat: "devices", ic: "plug", tone: "good", name: "Multiprise", on: k > 0, state: `${k} sur ${C.multiprise.length} allumées`, sheet: "strip" }; }
    if (kind === "robot") { const s = st(C.robot); return { id: C.robot, cat: "devices", ic: "robot", tone: "battery", name: "Aspirateur", on: s === "cleaning", state: `${{ docked: "Sur sa base", cleaning: "Nettoie", returning: "Retour", idle: "En pause" }[s] || s} · ${fmt.n(num(C.robot_batterie))} %`, sheet: "robot" }; }
  }
  const tile = (a) => h`
    <div class="tile ${a.on ? "is-on" : ""}" data-tone="${a.tone}" data-key="${a.id}${a.name}">
      <button type="button" class="tile-i" data-act="${a.quick || "open-sheet"}" ${a.quick === "toggle" ? `data-entity="${a.id}"` : ""} ${a.sheet ? `data-sheet="${a.sheet}"` : ""} ${a.quick && a.quick !== "toggle" ? BZ.dataArgs({ i: (a.sheet || "").split(":")[1] || "" }) : ""} aria-label="${esc(`${a.name} : ${a.on ? "éteindre" : "allumer"}`)}" aria-pressed="${String(a.on)}" ${BZ.isPending(a.id) ? 'aria-busy="true"' : ""}>${icon(a.ic)}</button>
      <button type="button" class="tile-t" ${a.sheet ? `data-act="open-sheet" data-sheet="${a.sheet}"` : `data-act="${a.quick}" data-entity="${a.id}"`}><strong>${a.name}</strong><span>${a.state}</span></button>
    </div>`;

  function nowPlaying() {
    const hp = C.homepod, s = st(hp);
    if (!["playing", "paused"].includes(s)) return "";
    const playing = s === "playing", dur = attr(hp, "media_duration") || 0, pos = attr(hp, "media_position") || 0, pic = attr(hp, "entity_picture");
    return h`<div class="np ${playing ? "is-playing" : ""}">
      <button type="button" class="np-art" data-act="open-sheet" data-sheet="media" aria-label="Ouvrir le lecteur">${pic ? h`<img src="${esc(pic)}" alt="">` : h`<span class="np-gen"><i></i><i></i><i></i></span>`}</button>
      <button type="button" class="np-t" data-act="open-sheet" data-sheet="media"><span class="np-src">${playing ? h`<span class="eq"><i></i><i></i><i></i></span>` : ""}HomePod salon</span><strong>${esc(attr(hp, "media_title") || "—")}</strong><span>${esc(attr(hp, "media_artist") || "")}</span></button>
      <div class="np-c">
        <button type="button" data-act="media" data-cmd="previous" aria-label="Morceau précédent">${icon("prev")}</button>
        <button type="button" class="np-play" data-act="media" data-cmd="play_pause" aria-label="${playing ? "Pause" : "Lecture"}">${icon(playing ? "pause" : "play")}</button>
        <button type="button" data-act="media" data-cmd="next" aria-label="Morceau suivant">${icon("next")}</button>
      </div>
      ${dur ? h`<div class="np-p"><i style="--v:${(pos / dur) * 100}%"></i></div>` : ""}
    </div>`;
  }

  BZ.pages.home = () => {
    const f = BZ.ui.homeFilter;
    const lights = C.lumieres.map((_, i) => acc("light", i)), covers = C.volets.map((_, i) => acc("cover", i));
    const heat = [acc("stove"), acc("boiler"), ...C.radiateurs.map((_, i) => acc("rad", i))], devices = [acc("plug"), acc("strip"), acc("robot")];
    const temps = C.radiateurs_temp.filter(Boolean).map(num).concat(attr(C.poele, "current_temperature"));
    const sections = [
      { k: "lights", title: "Lumières", items: lights, meta: `${lights.filter((a) => a.on).length} allumées`, action: btn({ label: "Tout éteindre", act: "lights-off", kind: "ghost", size: "sm", disabled: !lights.some((a) => a.on) }) },
      { k: "covers", title: "Volets", items: covers, meta: `${covers.filter((a) => a.on).length} ouverts`, action: h`<div class="btn-row">${btn({ label: "Ouvrir", ic: "up", act: "covers-all", args: { pos: 100 }, kind: "ghost", size: "sm" })}${btn({ label: "Fermer", ic: "down", act: "covers-all", args: { pos: 0 }, kind: "ghost", size: "sm" })}</div>` },
      { k: "heat", title: "Chauffage", items: heat, meta: `${fmt.n(Math.min(...temps))}–${fmt.n(Math.max(...temps))}° dans la maison` },
      { k: "devices", title: "Appareils", items: devices, meta: "" },
    ];
    const filters = [["all", "Tout", ""], ...sections.map((s) => [s.k, s.title, s.items.filter((a) => a.on).length])];
    const locked = st(C.voiture_verrou) === "locked";
    return h`
      <header class="page-h"><div><p class="eyebrow">${fmt.n(attr(C.meteo, "temperature"))}° dehors · ${{ sunny: "ensoleillé", cloudy: "nuageux", rainy: "pluie", partlycloudy: "éclaircies" }[st(C.meteo)] || ""}</p><h1>Maison</h1></div>
        <div class="page-a">${nowPlaying()}</div></header>
      <div class="filters" role="tablist" aria-label="Filtrer">
        ${filters.map(([k, l, n]) => h`<button type="button" role="tab" aria-selected="${String(f === k)}" data-act="set" data-k="homeFilter" data-value="${k}">${l}${n !== "" ? h`<span>${n}</span>` : ""}</button>`)}
        <span class="filters-sep"></span>
        <span class="filters-info">${icon(locked ? "lock" : "unlock")}e-Niro ${locked ? "verrouillée" : "ouverte"}</span>
      </div>
      <div class="layout layout-home">
        ${sections.filter((s) => f === "all" || f === s.k).map((s) => h`
          <section class="room" data-key="${s.k}">
            <header class="room-h"><h2>${s.title}</h2>${s.meta ? h`<span>${s.meta}</span>` : ""}${s.action ? h`<div class="room-a">${s.action}</div>` : ""}</header>
            <div class="tiles">${s.items.map(tile)}</div>
          </section>`)}
      </div>`;
  };

  /* ─── Panneaux de détail ─────────────────────────────────────────── */
  // Curseur vertical : glisser ou flèches du clavier ; la commande part au relâchement
  const vslider = ({ kind, i = 0, value, min, max, step, tone, label, fmtv }) => h`
    <div class="vs" data-tone="${tone}" role="slider" tabindex="0" aria-label="${esc(label)}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}" aria-valuetext="${esc(fmtv(value))}"
      data-vs="${kind}" data-i="${i}" data-min="${min}" data-max="${max}" data-step="${step}" data-value="${value}" style="--v:${((value - min) / (max - min)) * 100}%">
      <span class="vs-f"></span><output>${fmtv(value)}</output></div>`;

  BZ.sheets = {
    cover: (i) => { const id = C.volets[i], p = attr(id, "current_position"); return { ic: "blinds", tone: "battery", title: C.volets_noms[i], sub: p === 0 ? "Fermé" : p === 100 ? "Ouvert" : `Ouvert à ${p} %`,
      body: h`${vslider({ kind: "cover", i, value: p, min: 0, max: 100, step: 5, tone: "battery", label: "Position du volet", fmtv: (v) => `${v} %` })}
        <div class="btn-row">${btn({ label: "Fermer", ic: "down", act: "cover-set", args: { i, pos: 0 } })}${btn({ label: "Ouvrir", ic: "up", act: "cover-set", args: { i, pos: 100 }, kind: "primary" })}</div>` }; },
    rad: (i) => { const id = C.radiateurs[i], on = st(id) !== "off", t = C.radiateurs_temp[i], hu = C.radiateurs_hum[i]; return { ic: "thermo", tone: "heat", title: `Radiateur · ${C.radiateurs_noms[i]}`, sub: `${fmt.n(t ? num(t) : attr(id, "current_temperature"), 1)}° dans la pièce${hu ? ` · ${fmt.n(num(hu))} % d'humidité` : ""}`,
      body: h`${on ? vslider({ kind: "rad", i, value: attr(id, "temperature"), min: 5, max: 28, step: 0.5, tone: "heat", label: "Consigne", fmtv: (v) => `${fmt.n(v, 1)}°` }) : BZ.empty({ ic: "thermo", title: "Radiateur éteint", text: "Allume-le pour régler la consigne." })}
        <div class="rows"><div class="row"><div><strong>Chauffage</strong><span>${on ? "en marche" : "à l'arrêt"}</span></div>${toggle({ on, act: "rad-power", args: { i }, label: "Chauffage", pending: BZ.isPending(id) })}</div></div>` }; },
    poele: () => { const on = st(C.poele) !== "off", tre = num(C.tremie_kg), max = attr(C.tremie_kg, "max") || 30, stock = num(C.stock_kg), conso = num(C.conso_jour_kg);
      const due = new Date(st(C.poele_entretien)); due.setMonth(due.getMonth() + C.poele_entretien_mois);
      return { ic: "flame", tone: "bad", title: "Poêle à granulés", sub: `${st(C.poele_statut)} · ${fmt.n(attr(C.poele, "current_temperature"), 1)}° · fumées ${fmt.n(num(C.poele_fumees))}°`,
        body: h`${on ? vslider({ kind: "stove", value: attr(C.poele, "temperature"), min: 15, max: 25, step: 0.5, tone: "bad", label: "Consigne", fmtv: (v) => `${fmt.n(v, 1)}°` }) : BZ.empty({ ic: "flame", title: "Poêle éteint", text: "Allume-le pour régler la consigne." })}
          <div class="field"><span>Puissance</span>${segmented({ name: "stovePower", label: "Puissance", value: st(C.poele_puissance), options: [1, 2, 3, 4, 5].map((v) => [String(v), `P${v}`]) })}</div>
          <div class="rows">
            <div class="row"><div><strong>Allumé</strong><span>${on ? "en chauffe" : "à l'arrêt"}</span></div>${toggle({ on, act: "stove-power", label: "Poêle allumé", pending: BZ.isPending(C.poele) })}</div>
            <div class="row"><div><strong>Trémie</strong><span>${fmt.n(tre, 1)} / ${fmt.n(max)} kg · ~${fmt.n(tre / conso, 1)} jour</span></div>${meter({ value: (tre / max) * 100, tone: tre < 5 ? "bad" : "heat", size: "sm", label: "Trémie" })}</div>
            <div class="row"><div><strong>Stock</strong><span>${fmt.n(stock)} kg · ~${fmt.n((tre + stock) / conso)} jours au total</span></div><span class="muted">entretien dans ${fmt.inDays(due)} j</span></div>
          </div>
          <div class="btn-row">${btn({ label: BZ.ui.armed === "fill" ? "Confirmer : sac versé" : "Sac versé dans la trémie", act: "pellet-fill", kind: BZ.ui.armed === "fill" ? "danger" : "secondary", pending: BZ.isPending(C.script_remplir) })}${btn({ label: "+1 sac au stock", ic: "plus", act: "pellet-buy", kind: "primary", pending: BZ.isPending(C.script_achat) })}</div>` }; },
    ballon: () => { const boost = num(C.ballon_boost) === 1, t = num(C.ballon_temp), c = attr(C.ballon, "temperature");
      return { ic: "drop", tone: "battery", title: "Ballon d'eau chaude", sub: isOn(C.ballon_chauffe) ? "Chauffe en cours" : "Au repos",
        body: h`<div class="big-v center">${BZ.val([fmt.n(t), "°C"])}<span class="big-s">consigne ${fmt.n(c)} °C</span></div>${meter({ value: (t / c) * 100, tone: "battery", label: "Température du ballon" })}
          <div class="rows"><div class="row"><div><strong>Forcer la chauffe</strong><span>${boost ? "J1 · boost" : "J0 · normal"}</span></div>${toggle({ on: boost, act: "boiler-boost", label: "Forcer la chauffe", pending: BZ.isPending(C.ballon_boost) })}</div>
          <div class="row"><div><strong>Dernier entretien</strong><span>${fmt.date(new Date(st(C.ballon_entretien)), { day: "numeric", month: "long", year: "numeric" })}</span></div><span class="muted">${fmt.ago(st(C.ballon_entretien))}</span></div></div>` }; },
    strip: () => ({ ic: "plug", tone: "good", title: "Multiprise", sub: `${C.multiprise.filter(isOn).length} sur ${C.multiprise.length} allumées`,
      body: h`<div class="rows">${C.multiprise.map((id, k) => h`<div class="row"><div><strong>${C.multiprise_noms[k]}</strong><span>${isOn(id) ? "allumée" : "éteinte"}</span></div>${toggle({ on: isOn(id), act: "toggle", args: { entity: id }, label: C.multiprise_noms[k], pending: BZ.isPending(id) })}</div>`)}</div>` }),
    robot: () => ({ ic: "robot", tone: "battery", title: "Aspirateur", sub: `${fmt.n(num(C.robot_batterie))} % de batterie`,
      body: h`<div class="field"><span>Zone</span><select class="select" data-act="robot-scene" aria-label="Zone à nettoyer">${(attr(C.robot_scene, "options") || []).map((o) => h`<option ${o === st(C.robot_scene) ? "selected" : ""}>${esc(o)}</option>`)}</select></div>
        <div class="btn-row">${btn({ label: "Retour à la base", ic: "dock", act: "robot", args: { cmd: "return_to_base" }, pending: BZ.isPending(C.robot) })}${btn({ label: "Lancer", ic: "play", act: "robot", args: { cmd: "start" }, kind: "primary", pending: BZ.isPending(C.robot) })}</div>` }),
    media: () => { const hp = C.homepod, playing = st(hp) === "playing", vol = Math.round((attr(hp, "volume_level") || 0) * 100);
      return { ic: "speaker", tone: "ev", title: attr(hp, "media_title") || "HomePod", sub: `${attr(hp, "media_artist") || ""} · ${attr(hp, "media_album_name") || ""}`,
        body: h`${vslider({ kind: "volume", value: vol, min: 0, max: 100, step: 1, tone: "ev", label: "Volume", fmtv: (v) => `${v}` })}
          <div class="np-big">${btn({ ic: "prev", act: "media", args: { cmd: "previous" }, kind: "ghost", aria: "Précédent" })}${btn({ ic: playing ? "pause" : "play", act: "media", args: { cmd: "play_pause" }, kind: "primary", size: "lg", aria: playing ? "Pause" : "Lecture" })}${btn({ ic: "next", act: "media", args: { cmd: "next" }, kind: "ghost", aria: "Suivant" })}</div>` }; },
  };
})();
