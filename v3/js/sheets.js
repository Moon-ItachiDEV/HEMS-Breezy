// Breezy HEMS V3 — accessoires et panneaux de détail, partagés par toutes les pages
// (Maison, recherche, favoris, tableau des appareils de l'Aperçu).
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, btn, toggle, segmented, meter, C, num, st, attr, isOn, esc } = BZ;

  // Décrit un accessoire : catégorie, icône, état lisible, action au toucher de l'icône
  function acc(kind, i) {
    if (kind === "light") { const id = C.lumieres[i]; return { id, cat: "lights", ic: "bulb", tone: "light", name: C.lumieres_noms[i], on: isOn(id), state: isOn(id) ? "Allumée" : "Éteinte", quick: "toggle" }; }
    if (kind === "cover") { const id = C.volets[i], p = attr(id, "current_position"); return { id, cat: "covers", ic: "blinds", tone: "battery", name: C.volets_noms[i], on: p > 0, state: p === 0 ? "Fermé" : p === 100 ? "Ouvert" : `Ouvert à ${p} %`, quick: "cover-flip", sheet: `cover:${i}` }; }
    if (kind === "rad") { const id = C.radiateurs[i], on = st(id) !== "off", t = C.radiateurs_temp[i]; return { id, cat: "heat", ic: "thermo", tone: "heat", name: C.radiateurs_noms[i], on, state: `${fmt.n(t ? num(t) : attr(id, "current_temperature"), 1)}°${on ? ` → ${fmt.n(attr(id, "temperature"), 1)}°` : " · éteint"}`, quick: "rad-power", sheet: `rad:${i}` }; }
    if (kind === "stove") { const on = st(C.poele) !== "off"; return { id: C.poele, cat: "heat", ic: "flame", tone: "heat", name: "Poêle", on, state: on ? `${fmt.n(attr(C.poele, "current_temperature"), 1)}° · P${st(C.poele_puissance)} · ${fmt.n(num(C.tremie_kg))} kg` : "Éteint", quick: "stove-power", sheet: "poele" }; }
    if (kind === "boiler") { const on = isOn(C.ballon_chauffe) || num(C.ballon_boost) === 1; return { id: C.ballon_boost, cat: "heat", ic: "drop", tone: "battery", name: "Ballon", on, state: `${fmt.n(num(C.ballon_temp))}° → ${fmt.n(attr(C.ballon, "temperature"))}°${on ? " · chauffe" : ""}`, quick: "boiler-boost", sheet: "ballon" }; }
    if (kind === "plug") return { id: C.prise_chambre, cat: "devices", ic: "plug", tone: "good", name: "Prise chambre", on: isOn(C.prise_chambre), state: isOn(C.prise_chambre) ? fmt.powerText(num(C.prise_chambre_w)) : "Éteinte", quick: "toggle" };
    if (kind === "strip") { const k = C.multiprise.filter(isOn).length; return { id: C.multiprise[0], cat: "devices", ic: "plug", tone: "good", name: "Multiprise", on: k > 0, state: `${k} sur ${C.multiprise.length} allumées`, sheet: "strip" }; }
    if (kind === "robot") { const s = st(C.robot); return { id: C.robot, cat: "devices", ic: "robot", tone: "battery", name: "Aspirateur", on: s === "cleaning", state: `${{ docked: "Sur sa base", cleaning: "Nettoie", returning: "Retour", idle: "En pause" }[s] || s} · ${fmt.n(num(C.robot_batterie))} %`, sheet: "robot" }; }
  }
  BZ.acc = acc;

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
      return { ic: "flame", tone: "heat", title: "Poêle à granulés", sub: `${st(C.poele_statut)} · ${fmt.n(attr(C.poele, "current_temperature"), 1)}° · fumées ${fmt.n(num(C.poele_fumees))}°`,
        body: h`${on ? vslider({ kind: "stove", value: attr(C.poele, "temperature"), min: 15, max: 25, step: 0.5, tone: "heat", label: "Consigne", fmtv: (v) => `${fmt.n(v, 1)}°` }) : BZ.empty({ ic: "flame", title: "Poêle éteint", text: "Allume-le pour régler la consigne." })}
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
