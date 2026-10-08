// Breezy HEMS V3 — accessoires et panneaux de détail, partagés par toutes les pages
// (Maison, recherche, favoris, tableau des appareils de l'Aperçu).
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, btn, toggle, segmented, meter, C, num, st, attr, isOn, esc } = BZ;

  // Décrit un accessoire : famille, icône, état lisible, action rapide (icône) et panneau (texte).
  // toggle = l'icône bascule un état (aria-pressed) ; sinon l'icône ouvre le panneau.
  function acc(kind, i) {
    if (kind === "light") { const id = C.lumieres[i]; return { id, cat: "lights", ic: "bulb", tone: "light", name: C.lumieres_noms[i], on: isOn(id), state: isOn(id) ? "Allumée" : "Éteinte", quick: "toggle", toggle: true, verb: "Allumer ou éteindre", sheet: `light:${i}` }; }
    if (kind === "cover") { const id = C.volets[i], p = attr(id, "current_position"); return { id, cat: "covers", ic: "blinds", tone: "battery", name: C.volets_noms[i], on: p > 0, pos: p, state: p === 0 ? "Fermé" : p === 100 ? "Ouvert" : `Ouvert à ${p} %`, quick: "cover-flip", toggle: true, verb: "Ouvrir ou fermer", sheet: `cover:${i}` }; }
    if (kind === "rad") { const id = C.radiateurs[i], on = st(id) !== "off", t = C.radiateurs_temp[i]; return { id, cat: "heat", ic: "thermo", tone: "heat", name: C.radiateurs_noms[i], on, state: `${fmt.n(t ? num(t) : attr(id, "current_temperature"), 1)}°${on ? ` → ${fmt.n(attr(id, "temperature"), 1)}°` : " · éteint"}`, quick: "rad-power", toggle: true, verb: "Allumer ou éteindre le radiateur", sheet: `rad:${i}` }; }
    if (kind === "stove") { const on = st(C.poele) !== "off"; return { id: C.poele, cat: "heat", ic: "flame", tone: "heat", name: "Poêle", on, state: on ? `${fmt.n(attr(C.poele, "current_temperature"), 1)}° · P${st(C.poele_puissance)}` : "Éteint", quick: "stove-power", toggle: true, verb: "Allumer ou éteindre le poêle", sheet: "poele" }; }
    if (kind === "boiler") { const boost = num(C.ballon_boost) === 1, heating = isOn(C.ballon_chauffe) || boost; return { id: C.ballon_boost, cat: "heat", ic: "drop", tone: "heat", name: "Ballon", on: heating, state: heating ? `${fmt.n(num(C.ballon_temp))}° · chauffe → ${fmt.n(attr(C.ballon, "temperature"))}°` : `${fmt.n(num(C.ballon_temp))}° · au repos`, quick: "boiler-boost", toggle: true, verb: "Forcer la chauffe", sheet: "ballon" }; }
    if (kind === "plug") return { id: C.prise_chambre, cat: "devices", ic: "plug", tone: "good", name: "Prise chambre", on: isOn(C.prise_chambre), state: isOn(C.prise_chambre) ? fmt.powerText(num(C.prise_chambre_w)) : "Éteinte", quick: "toggle", toggle: true, verb: "Allumer ou éteindre", sheet: "plug" };
    if (kind === "strip") { const k = C.multiprise.filter(isOn).length; return { id: C.multiprise[0], cat: "devices", ic: "plug", tone: "good", name: "Multiprise", on: k > 0, state: `${k} sur ${C.multiprise.length} allumées`, sheet: "strip" }; }
    if (kind === "robot") { const s = st(C.robot); return { id: C.robot, cat: "devices", ic: "robot", tone: "battery", name: "Aspirateur", on: s === "cleaning", state: `${{ docked: "Base", cleaning: "Nettoie", returning: "Retour", idle: "En pause" }[s] || s} · ${fmt.n(num(C.robot_batterie))} %`, sheet: "robot" }; }
  }
  BZ.acc = acc;

  /* ─── Panneaux de détail ─────────────────────────────────────────── */
  // Curseur vertical : glisser ou flèches du clavier ; la commande part au relâchement
  const vslider = ({ kind, i = 0, value, min, max, step, tone, label, fmtv }) => h`
    <div class="vs" data-tone="${tone}" role="slider" tabindex="0" aria-label="${esc(label)}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}" aria-valuetext="${esc(fmtv(value))}"
      data-vs="${kind}" data-i="${i}" data-min="${min}" data-max="${max}" data-step="${step}" data-value="${value}" style="--v:${((value - min) / (max - min)) * 100}%">
      <span class="vs-f"></span><output>${fmtv(value)}</output></div>`;

  // Curseur horizontal (volume) : même logique que le vertical, sur l'axe X
  const hslider = ({ kind, i = 0, value, min, max, step, tone, label, fmtv }) => h`
    <div class="vs is-h" data-tone="${tone}" data-orient="h" role="slider" tabindex="0" aria-label="${esc(label)}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}" aria-valuetext="${esc(fmtv(value))}"
      data-vs="${kind}" data-i="${i}" data-min="${min}" data-max="${max}" data-step="${step}" data-value="${value}" style="--v:${((value - min) / (max - min)) * 100}%">
      <span class="vs-f"></span><output>${fmtv(value)}</output></div>`;

  /* ─── Lecteur : modèle, pochette, avancement ─────────────────────── */
  const loadedAt = Date.now();
  BZ.media = () => {
    const hp = C.homepod, s = st(hp), playing = s === "playing", dur = attr(hp, "media_duration") || 0;
    // Position réelle : position au dernier relevé + temps écoulé depuis (si lecture en cours)
    const upd = attr(hp, "media_position_updated_at"), since = playing ? (Date.now() - (upd ? Date.parse(upd) : loadedAt)) / 1000 : 0;
    const pos = Math.min(dur, (attr(hp, "media_position") || 0) + Math.max(0, since));
    let art = attr(hp, "entity_picture") || "";
    if (art && art.startsWith("/")) art = (C.ha_url || "").replace(/\/$/, "") + art;   // chemin relatif de Home Assistant
    return { active: ["playing", "paused"].includes(s), playing, dur, pos, art, title: attr(hp, "media_title"), artist: attr(hp, "media_artist"), album: attr(hp, "media_album_name") };
  };
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  BZ.mediaArt = (M, size = "") => h`<span class="np-art ${size}">${M.art ? h`<img src="${esc(M.art)}" alt="" onerror="this.remove()">` : ""}<span class="np-gen ${M.playing ? "is-playing" : ""}" aria-hidden="true"><i></i><i></i><i></i><i></i></span></span>`;
  BZ.mediaProgress = (M) => M.dur ? h`<div class="np-prog" data-media-pos role="progressbar" aria-label="Avancement du morceau" aria-valuemin="0" aria-valuemax="${Math.round(M.dur)}" aria-valuenow="${Math.round(M.pos)}">
      <span class="np-cur">${mmss(M.pos)}</span><i><b style="--v:${(M.pos / M.dur) * 100}%"></b></i><span class="np-left">−${mmss(M.dur - M.pos)}</span></div>` : "";
  // L'avancement bouge chaque seconde sans redessiner toute la page
  setInterval(() => {
    const els = document.querySelectorAll("[data-media-pos]"); if (!els.length) return;
    const M = BZ.media(); if (!M.playing || !M.dur) return;
    els.forEach((el) => { el.querySelector(".np-cur").textContent = mmss(M.pos); el.querySelector(".np-left").textContent = `−${mmss(M.dur - M.pos)}`; el.querySelector("b").style.setProperty("--v", `${(M.pos / M.dur) * 100}%`); el.setAttribute("aria-valuenow", Math.round(M.pos)); });
  }, 1000);

  BZ.sheets = {
    cover: (i) => { const id = C.volets[i], p = attr(id, "current_position"); return { ic: "blinds", tone: "battery", title: C.volets_noms[i], sub: p === 0 ? "Fermé" : p === 100 ? "Ouvert" : `Ouvert à ${p} %`,
      body: h`${vslider({ kind: "cover", i, value: p, min: 0, max: 100, step: 5, tone: "battery", label: "Position du volet", fmtv: (v) => `${v} %` })}
        <div class="btn-row">${btn({ label: "Fermer le volet", ic: "down", act: "cover-set", args: { i, pos: 0 }, disabled: p === 0, kind: p === 100 ? "primary" : "secondary" })}${btn({ label: "Ouvrir le volet", ic: "up", act: "cover-set", args: { i, pos: 100 }, disabled: p === 100, kind: p === 100 ? "secondary" : "primary" })}</div>` }; },
    light: (i) => { const id = C.lumieres[i], on = isOn(id); return { ic: "bulb", tone: "light", title: `Lumière ${C.lumieres_noms[i]}`, sub: on ? "Allumée" : "Éteinte",
      body: h`<button type="button" class="sh-power ${on ? "is-on" : ""}" data-tone="light" data-act="toggle" data-entity="${id}" aria-pressed="${String(on)}" ${BZ.isPending(id) ? 'aria-busy="true"' : ""}>${icon("power")}<span>${on ? "Éteindre" : "Allumer"}</span></button>
        <div class="rows"><div class="row"><div><strong>Allumée</strong><span>marche / arrêt (pas de variateur)</span></div>${toggle({ on, act: "toggle", args: { entity: id }, label: `Lumière ${C.lumieres_noms[i]}`, pending: BZ.isPending(id) })}</div></div>` }; },
    plug: () => { const id = C.prise_chambre, on = isOn(id); return { ic: "plug", tone: "good", title: "Prise chambre", sub: on ? `Allumée · ${fmt.powerText(num(C.prise_chambre_w))}` : "Éteinte",
      body: h`<div class="big-v center">${BZ.val(fmt.power(on ? num(C.prise_chambre_w) : 0))}<span class="big-s">${fmt.kwhText(num(C.prise_chambre_kwh))} consommés au total</span></div>
        <div class="rows"><div class="row"><div><strong>Alimentation</strong><span>${on ? "allumée" : "éteinte"}</span></div>${toggle({ on, act: "toggle", args: { entity: id }, label: "Prise chambre", pending: BZ.isPending(id) })}</div></div>` }; },
    rad: (i) => { const id = C.radiateurs[i], on = st(id) !== "off", t = C.radiateurs_temp[i], hu = C.radiateurs_hum[i]; return { ic: "thermo", tone: "heat", title: `Radiateur · ${C.radiateurs_noms[i]}`, sub: `${fmt.n(t ? num(t) : attr(id, "current_temperature"), 1)}° dans la pièce${hu ? ` · ${fmt.n(num(hu))} % d'humidité` : ""}`,
      body: h`${on ? vslider({ kind: "rad", i, value: attr(id, "temperature"), min: 5, max: 28, step: 0.5, tone: "heat", label: "Consigne", fmtv: (v) => `${fmt.n(v, 1)}°` }) : BZ.empty({ ic: "thermo", title: "Radiateur éteint", text: "Allume-le pour régler la consigne." })}
        <div class="rows"><div class="row"><div><strong>Chauffage</strong><span>${on ? "en marche" : "à l'arrêt"}</span></div>${toggle({ on, act: "rad-power", args: { i }, label: "Chauffage", pending: BZ.isPending(id) })}</div></div>` }; },
    poele: () => { const on = st(C.poele) !== "off", tre = num(C.tremie_kg), max = attr(C.tremie_kg, "max") || 30, stock = num(C.stock_kg), conso = num(C.conso_jour_kg);
      const due = new Date(st(C.poele_entretien)); due.setMonth(due.getMonth() + C.poele_entretien_mois);
      return { ic: "flame", tone: "heat", title: "Poêle à granulés", sub: `${st(C.poele_statut)} · ${fmt.n(attr(C.poele, "current_temperature"), 1)}° · fumées ${fmt.n(num(C.poele_fumees))}°`,
        body: h`${on ? vslider({ kind: "stove", value: attr(C.poele, "temperature"), min: 15, max: 25, step: 0.5, tone: "heat", label: "Consigne", fmtv: (v) => `${fmt.n(v, 1)}°` }) : BZ.empty({ ic: "flame", title: "Poêle éteint", text: "Allume-le pour régler la consigne." })}
          <div class="field"><span>Puissance</span>${segmented({ name: "stovePower", label: "Puissance", value: st(C.poele_puissance), options: [1, 2, 3, 4, 5].map((v) => [String(v), `P${v}`]) })}</div>
          <div class="rows">
            <div class="row"><div><strong>Allumé</strong><span>${on ? "en chauffe" : "à l'arrêt"}</span></div>${toggle({ on, act: "stove-power", label: "Poêle allumé", pending: BZ.isPending(C.poele) })}</div>
            <div class="row"><div><strong>Trémie</strong><span>${fmt.n(tre, 1)} / ${fmt.n(max)} kg · ≈ ${fmt.n((tre / conso) * 24)} h d'autonomie</span></div>${meter({ value: (tre / max) * 100, tone: tre < 5 ? "bad" : "heat", label: "Trémie" })}</div>
            <div class="row"><div><strong>Stock</strong><span>${fmt.n(stock)} kg · ≈ ${fmt.n((tre + stock) / conso)} jours au total</span></div></div>
            <div class="row"><div><strong>Entretien</strong><span>${fmt.date(due, { day: "numeric", month: "long", year: "numeric" })}</span></div><span class="muted">dans ${fmt.inDays(due)} j</span></div>
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
    media: () => { const M = BZ.media(), vol = Math.round((attr(C.homepod, "volume_level") || 0) * 100);
      return { ic: "speaker", tone: "accent", title: M.title || "HomePod salon", sub: [M.artist, M.album].filter(Boolean).join(" · ") || "HomePod salon",
        body: h`<div class="sh-art">${BZ.mediaArt(M, "lg")}</div>
          ${BZ.mediaProgress(M)}
          <div class="np-big">${btn({ ic: "prev", act: "media", args: { cmd: "previous" }, kind: "ghost", aria: "Morceau précédent" })}${btn({ ic: M.playing ? "pause" : "play", act: "media", args: { cmd: "play_pause" }, kind: "primary", size: "lg", aria: M.playing ? "Pause" : "Lecture" })}${btn({ ic: "next", act: "media", args: { cmd: "next" }, kind: "ghost", aria: "Morceau suivant" })}</div>
          <div class="sh-vol">${icon("speaker")}${hslider({ kind: "volume", value: vol, min: 0, max: 100, step: 1, tone: "accent", label: "Volume", fmtv: (v) => `${v} %` })}</div>` }; },
  };
})();
