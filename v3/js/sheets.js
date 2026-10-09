// Breezy HEMS V3 — accessoires et panneaux de détail, partagés par toutes les pages
// (Maison, recherche, favoris, tableau des appareils de l'Aperçu).
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, btn, toggle, segmented, meter, C, num, st, attr, isOn, esc } = BZ;

  // Décrit un accessoire : famille, icône, état lisible, action rapide (icône) et panneau (texte).
  // toggle = l'icône bascule un état (aria-pressed) ; sinon l'icône ouvre le panneau.
  const ROBOT_STATE = { docked: "Sur sa base", cleaning: "Nettoie", returning: "Retour à la base", paused: "En pause", idle: "À l'arrêt", error: "Bloqué" };
  BZ.ROBOT_STATE = ROBOT_STATE;
  function acc(kind, i) {
    if (kind === "light") { const id = C.lumieres[i]; return { id, cat: "lights", ic: "bulb", tone: "light", name: C.lumieres_noms[i], on: isOn(id), state: isOn(id) ? "Allumée" : "Éteinte", quick: "toggle", toggle: true, verb: "Allumer ou éteindre", sheet: `light:${i}` }; }
    if (kind === "cover") { const id = C.volets[i], p = attr(id, "current_position"); return { id, cat: "covers", ic: "blinds", tone: "battery", name: C.volets_noms[i], on: p > 0, pos: p, state: p === 0 ? "Fermé" : p === 100 ? "Ouvert" : `Ouvert à ${p} %`, quick: "cover-flip", toggle: true, verb: "Ouvrir ou fermer", sheet: `cover:${i}` }; }
    if (kind === "rad") { const id = C.radiateurs[i], on = st(id) !== "off", t = C.radiateurs_temp[i]; return { id, cat: "heat", ic: "thermo", tone: "heat", name: C.radiateurs_noms[i], on, state: `${fmt.n(t ? num(t) : attr(id, "current_temperature"), 1)}°${on ? ` → ${fmt.n(attr(id, "temperature"), 1)}°` : " · éteint"}`, quick: "rad-power", toggle: true, verb: "Allumer ou éteindre le radiateur", args: { i } }; }
    if (kind === "stove") { const on = st(C.poele) !== "off", armed = BZ.ui && BZ.ui.armed === "stove"; return { id: C.poele, cat: "heat", ic: "flame", tone: "heat", name: "Poêle", on, armed, state: armed ? (on ? "Touche encore pour éteindre" : "Touche encore pour allumer") : on ? `${fmt.n(attr(C.poele, "current_temperature"), 1)}° · P${st(C.poele_puissance)}` : "Éteint", quick: "stove-power", toggle: true, verb: on ? "Éteindre le poêle (confirmation)" : "Allumer le poêle (confirmation)", sheet: "poele" }; }
    if (kind === "boiler") { const boost = num(C.ballon_boost) === 1, heating = isOn(C.ballon_chauffe) || boost; return { id: C.ballon_boost, cat: "heat", ic: "drop", tone: "heat", name: "Ballon", on: heating, state: heating ? `${fmt.n(num(C.ballon_temp))}° · chauffe → ${fmt.n(attr(C.ballon, "temperature"))}°` : `${fmt.n(num(C.ballon_temp))}° · au repos`, quick: "boiler-boost", toggle: true, verb: "Forcer la chauffe", sheet: "ballon" }; }
    if (kind === "plug") return { id: C.prise_chambre, cat: "devices", ic: "plug", tone: "good", name: "Prise chambre", on: isOn(C.prise_chambre), state: isOn(C.prise_chambre) ? fmt.powerText(num(C.prise_chambre_w)) : "Éteinte", quick: "toggle", toggle: true, verb: "Allumer ou éteindre", sheet: "plug" };
    if (kind === "strip") { const k = C.multiprise.filter(isOn).length; return { id: C.multiprise[0], cat: "devices", ic: "plug", tone: "good", name: "Multiprise", on: k > 0, state: `${k} sur ${C.multiprise.length} allumées`, sheet: "strip" }; }
    if (kind === "robot") { const s = st(C.robot); return { id: C.robot, cat: "devices", ic: "robot", tone: "battery", name: "Aspirateur", on: s === "cleaning" || s === "returning", anim: s === "cleaning" ? "is-cleaning" : "", state: `${ROBOT_STATE[s] || s} · ${fmt.n(num(C.robot_batterie))} %`, sheet: "robot" }; }
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


  /* ─── Aspirateur robot : plan animé du rez-de-chaussée ────────────────
     Les zones de nettoyage (select de l'aspirateur) correspondent à des pièces du plan.
     En nettoyage, le robot suit un parcours en aller-retour dans la zone et laisse la
     surface nettoyée derrière lui ; au retour il rejoint sa base ; sur la base il charge. */
  const PLAN = {
    rooms: [
      { k: "Salon", x: 20, y: 20, w: 210, h: 130 },
      { k: "Cuisine", x: 230, y: 20, w: 150, h: 100 },
      { k: "Entrée", x: 230, y: 120, w: 150, h: 30 },
      { k: "Chambre 1", x: 20, y: 150, w: 180, h: 90, zone: "Chambres" },
      { k: "Chambre 2", x: 200, y: 150, w: 180, h: 90, zone: "Chambres" },
    ],
    doors: [[230, 70, 0, 26], [300, 120, 26, 0], [90, 150, 26, 0], [262, 150, 26, 0], [230, 128, 0, 18]],
    dock: { x: 362, y: 135 },
  };
  const zoneRooms = (z) => (/rez|tout/i.test(z || "") ? PLAN.rooms.filter((r) => r.k !== "Entrée") : PLAN.rooms.filter((r) => r.k === z || r.zone === z));
  // Parcours en aller-retour (boustrophédon) dans chaque pièce de la zone
  function sweep(rooms) {
    const pts = [];
    rooms.forEach((r) => {
      const x0 = r.x + 14, x1 = r.x + r.w - 14, rows = Math.max(2, Math.floor((r.h - 24) / 15));
      for (let k = 0; k <= rows; k++) { const y = r.y + 12 + (k * (r.h - 24)) / rows; pts.push(k % 2 ? [x1, y] : [x0, y], k % 2 ? [x0, y] : [x1, y]); }
    });
    return pts;
  }
  const pathOf = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const lenOf = (pts) => pts.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Robot vu de dessus, l'avant vers +x (animateMotion l'oriente le long du trajet)
  const robotBody = (anim) => h`
    <g class="rb-bot">
      ${anim ? h`<circle class="rb-ping" r="12"><animate attributeName="r" values="12;38" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0" dur="1.8s" repeatCount="indefinite"/></circle>` : ""}
      <circle class="rb-shell" r="12"/>
      <path class="rb-bumper" d="M3.4 -10.5 A12 12 0 0 1 3.4 10.5"/>
      <circle class="rb-lidar" cx="-1.8" r="4.2"/>
      <circle class="rb-lidar-dot" cx="-1.8" r="1.4"/>
      <g class="rb-brush" transform="translate(8.6 -8.6)">${anim ? h`<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur=".6s" repeatCount="indefinite" additive="sum"/>` : ""}<path d="M0 0 L4 -1.2 M0 0 L-1.2 4 M0 0 L-3 -3"/></g>
    </g>`;

  function robotScene(state, zone) {
    const rooms = zoneRooms(zone), pts = sweep(rooms), d = pathOf(pts), L = lenOf(pts), anim = !reduced();
    const D = PLAN.dock, sel = new Set(rooms.map((r) => r.k));
    const dur = Math.max(18, L / 26).toFixed(1);
    const last = pts[pts.length - 1] || [D.x, D.y], back = `M${last[0]} ${last[1]} L${last[0]} ${D.y} L${D.x} ${D.y}`;
    let bot;
    if (state === "cleaning") bot = anim
      ? h`<g><animateMotion dur="${dur}s" repeatCount="indefinite" rotate="auto" path="${d}"/>${robotBody(true)}</g>`
      : h`<g transform="translate(${pts[0][0]} ${pts[0][1]})">${robotBody(false)}</g>`;
    else if (state === "returning") bot = anim
      ? h`<g><animateMotion dur="6s" fill="freeze" rotate="auto" path="${back}"/>${robotBody(true)}</g>`
      : h`<g transform="translate(${D.x} ${D.y})">${robotBody(false)}</g>`;
    else if (state === "paused") bot = h`<g transform="translate(${pts[Math.floor(pts.length / 3)][0]} ${pts[Math.floor(pts.length / 3)][1]})">${robotBody(false)}<g class="rb-pause" transform="translate(0 -20)"><rect x="-9" y="-7" width="18" height="14" rx="7"/><path d="M-2.5 -3v6M2.5 -3v6"/></g></g>`;
    else bot = h`<g transform="translate(${D.x - 18} ${D.y}) rotate(180)">${robotBody(false)}</g>`;
    return h`<svg class="rb-plan rb-${state}" viewBox="0 0 400 260" role="img" aria-label="${esc(`Plan du rez-de-chaussée, zone ${zone || "—"}, aspirateur ${BZ.ROBOT_STATE[state] || state}`)}">
      ${PLAN.rooms.map((r) => h`<rect class="rb-room ${sel.has(r.k) ? "is-sel" : ""}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3"/>`)}
      ${state === "cleaning" ? h`<path class="rb-done" d="${d}" pathLength="1">${anim ? h`<animate attributeName="stroke-dashoffset" from="1" to="0" dur="${dur}s" repeatCount="indefinite"/>` : ""}</path>` : ""}
      ${PLAN.doors.map(([x, y, w, hh]) => h`<rect class="rb-door" x="${x - (hh ? 2 : 0)}" y="${y - (w ? 2 : 0)}" width="${w || 4}" height="${hh || 4}"/>`)}
      ${PLAN.rooms.map((r) => h`<text class="rb-lab ${sel.has(r.k) ? "is-sel" : ""}" x="${r.x + 10}" y="${r.y + r.h - 9}">${r.k}</text>`)}
      <g class="rb-dock" transform="translate(${D.x} ${D.y})"><rect x="-4" y="-11" width="10" height="22" rx="3"/>${state === "docked" ? h`<circle class="rb-charge" cx="1" cy="0" r="2.2">${anim ? h`<animate attributeName="opacity" values="1;.25;1" dur="2s" repeatCount="indefinite"/>` : ""}</circle>` : ""}</g>
      ${bot}
    </svg>`;
  }

  BZ.robotSheet = () => {
    const id = C.robot, s = st(id), batt = num(C.robot_batterie), zone = st(C.robot_scene), zones = attr(C.robot_scene, "options") || [];
    const fans = attr(id, "fan_speed_list") || [], fan = attr(id, "fan_speed"), area = attr(id, "cleaned_area"), time = attr(id, "cleaning_time"), lastClean = attr(id, "last_clean");
    const cleaning = s === "cleaning", busy = BZ.isPending(id) || BZ.isPending(C.robot_scene);
    const headline = { cleaning: h`Nettoie : ${esc((zone || "").toLowerCase())}`, returning: "Retourne à sa base", paused: "En pause", error: "Bloqué, à vérifier", docked: batt >= 100 ? "Prêt, sur sa base" : "En charge sur sa base" }[s] || (BZ.ROBOT_STATE[s] || s);
    const stats = cleaning || s === "paused" ? [["Surface", area != null ? `${fmt.n(area)} m²` : "—"], ["Durée", time != null ? `${fmt.n(time)} min` : "—"], ["Aspiration", fan || "—"]]
      : [["Dernier passage", lastClean ? fmt.ago(lastClean) : "—"], ["Surface", area != null ? `${fmt.n(area)} m²` : "—"], ["Durée", time != null ? `${fmt.n(time)} min` : "—"]];
    return { full: true, ic: "robot", tone: "battery", title: C.robot_nom || "Aspirateur robot", sub: `${BZ.ROBOT_STATE[s] || s} · batterie ${fmt.n(batt)} %`,
      body: h`<div class="rb">
        <div class="rb-stage">
          <div class="rb-stage-h"><strong>Rez-de-chaussée</strong><span>${cleaning ? h`<i class="pulse" data-tone="battery"></i>Nettoyage en cours · ${esc((zone || "").toLowerCase())}` : s === "returning" ? "Retour vers la base" : s === "paused" ? "Arrêté en cours de route" : `Zone prête : ${esc((zone || "").toLowerCase())}`}</span></div>
          ${robotScene(s, zone)}
          <div class="rb-legend"><span><i class="is-sel"></i>Zone choisie</span>${cleaning ? h`<span><i class="is-done"></i>Déjà nettoyé</span>` : ""}<span><i class="is-dock"></i>Base</span></div>
        </div>
        <div class="rb-side">
          <div class="rb-head">
            ${BZ.ring({ value: batt, tone: batt < 20 ? "bad" : "battery", size: 84, stroke: 7, label: `Batterie ${fmt.n(batt)} %`, inner: h`<b>${fmt.n(batt)}<small>%</small></b>` })}
            <div><p class="rb-state">${BZ.pill(BZ.ROBOT_STATE[s] || s, cleaning ? "battery" : s === "error" ? "bad" : s === "returning" ? "ev" : "neutral", cleaning || s === "returning")}</p><h3>${headline}</h3></div>
          </div>
          <dl class="rb-stats">${stats.map(([k, v]) => h`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
          <div class="field"><span>Zone à nettoyer</span>
            <div class="rb-zones" role="radiogroup" aria-label="Zone à nettoyer">${zones.map((z) => h`<button type="button" role="radio" aria-checked="${String(z === zone)}" data-act="robot-zone" data-value="${esc(z)}" ${cleaning ? "disabled" : ""}>${esc(z)}</button>`)}</div></div>
          ${fans.length ? h`<div class="field"><span>Puissance d'aspiration</span>${BZ.segmented({ name: "robotFan", label: "Puissance d'aspiration", value: fan, options: fans.map((f) => [f, f]) }).replace(/data-act="set" data-k="robotFan"/g, 'data-act="robot-fan"')}</div>` : ""}
          <div class="rb-acts">
            ${cleaning ? btn({ label: "Mettre en pause", ic: "pause", act: "robot", args: { cmd: "pause" }, kind: "primary", pending: busy })
              : btn({ label: s === "paused" ? "Reprendre" : "Lancer le nettoyage", ic: "play", act: "robot", args: { cmd: "start" }, kind: "primary", pending: busy, disabled: batt < 15 })}
            ${btn({ label: "Retour à la base", ic: "dock", act: "robot", args: { cmd: "return_to_base" }, kind: "secondary", disabled: s === "docked" || s === "returning", pending: busy })}
            ${btn({ label: "Localiser", ic: "bell", act: "robot", args: { cmd: "locate" }, kind: "ghost" })}
          </div>
        </div>
      </div>` };
  };

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
    poele: () => { const on = st(C.poele) !== "off", tre = num(C.tremie_kg), max = attr(C.tremie_kg, "max") || 30, stock = num(C.stock_kg), conso = num(C.conso_jour_kg);
      const due = new Date(st(C.poele_entretien)); due.setMonth(due.getMonth() + C.poele_entretien_mois);
      return { ic: "flame", tone: "heat", title: "Poêle à granulés", sub: `${st(C.poele_statut)} · ${fmt.n(attr(C.poele, "current_temperature"), 1)}° · fumées ${fmt.n(num(C.poele_fumees))}°`,
        body: h`${on ? vslider({ kind: "stove", value: attr(C.poele, "temperature"), min: 15, max: 25, step: 0.5, tone: "heat", label: "Consigne", fmtv: (v) => `${fmt.n(v, 1)}°` }) : BZ.empty({ ic: "flame", title: "Poêle éteint", text: "Allume-le pour régler la consigne." })}
          <div class="field"><span>Puissance</span>${segmented({ name: "stovePower", label: "Puissance", value: st(C.poele_puissance), options: [1, 2, 3, 4, 5].map((v) => [String(v), `P${v}`]) })}</div>
          <div class="rows">
            <div class="row ${BZ.ui.armed === "stove" ? "is-armed" : ""}"><div><strong>Allumé</strong><span>${BZ.ui.armed === "stove" ? (on ? "touche encore pour éteindre" : "touche encore pour allumer") : on ? "en chauffe" : "à l'arrêt"}</span></div>${toggle({ on, act: "stove-power", label: "Poêle allumé", pending: BZ.isPending(C.poele) })}</div>
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
    robot: () => BZ.robotSheet(),
    media: () => { const M = BZ.media(), vol = Math.round((attr(C.homepod, "volume_level") || 0) * 100);
      return { ic: "speaker", tone: "accent", title: M.title || "HomePod salon", sub: [M.artist, M.album].filter(Boolean).join(" · ") || "HomePod salon",
        body: h`<div class="sh-art">${BZ.mediaArt(M, "lg")}</div>
          ${BZ.mediaProgress(M)}
          <div class="np-big">${btn({ ic: "prev", act: "media", args: { cmd: "previous" }, kind: "ghost", aria: "Morceau précédent" })}${btn({ ic: M.playing ? "pause" : "play", act: "media", args: { cmd: "play_pause" }, kind: "primary", size: "lg", aria: M.playing ? "Pause" : "Lecture" })}${btn({ ic: "next", act: "media", args: { cmd: "next" }, kind: "ghost", aria: "Morceau suivant" })}</div>
          <div class="sh-vol">${icon("speaker")}${hslider({ kind: "volume", value: vol, min: 0, max: 100, step: 1, tone: "accent", label: "Volume", fmtv: (v) => `${v} %` })}</div>` }; },
  };
})();
