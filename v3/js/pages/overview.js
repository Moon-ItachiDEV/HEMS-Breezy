// Aperçu (V3) : la mise en page de la maquette, appliquée à la maison.
//  En-tête : salutation · titre · phrase d'état | sélecteur de jour + action principale
//  Téléphone tenu droit : la maison en direct (version compacte) entre la salutation et le sélecteur de jour ;
//  elle dit ce que disait la phrase d'état (masquée), et reste « en direct » quelle que soit la journée choisie
//  Ligne 1 : 4 indicateurs avec mini-courbe (journée choisie vs veille)
//  Gauche  : tableau des appareils (filtres en pastilles) puis Équipements + Raccourcis
//  Droite  : Programme du jour (tarifs et événements), Répartition (anneau), Rentabilité
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val, card, pill, kpi, pills, donut, delta, btn, meter, C, num, st, attr, isOn } = BZ;

  function header(V) {
    const L = BZ.live(), now = new Date();
    const hello = now.getHours() < 5 ? "Bonne nuit," : now.getHours() < 12 ? "Bonjour," : now.getHours() < 18 ? "Bon après-midi," : "Bonsoir,";
    const status = V.isToday
      ? [L.grid < -15 ? `Tu revends ${fmt.powerText(-L.grid)}` : L.grid > 15 ? `Tu achètes ${fmt.powerText(L.grid)}` : "Aucun échange avec le réseau",
         L.charging ? `l'e-Niro charge à ${fmt.n(L.evSolarShare * 100)} % au soleil` : null].filter(Boolean).join(" et ") + "."
      : V.loading ? "Chargement de l'historique…"   // Home Assistant : la journée arrive des statistiques
      : `Voici le bilan du ${fmt.date(V.date, { weekday: "long", day: "numeric", month: "long" })}.`;
    const dateLabel = V.isToday ? `Aujourd'hui, ${fmt.date(V.date, { day: "numeric", month: "short" })}` : fmt.cap(fmt.date(V.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }));
    return h`<header class="ph">
      <div><p class="ph-hi">${hello}</p><h1>${BZ.esc(BZ.user)}<span class="wave" aria-hidden="true">👋</span></h1><p class="ph-sub">${status}</p></div>
      ${BZ.house({ compact: true })}
      <div class="ph-a">
        <div class="datep" role="group" aria-label="Journée affichée">${icon("calendar")}<span aria-live="polite">${dateLabel}</span>
          <button type="button" data-act="day" data-d="-1" aria-label="Jour précédent" ${V.offset <= -29 || (BZ.hist && BZ.hist.has("energie") === false) ? "disabled" : ""}>${icon("left")}</button>
          <button type="button" data-act="day" data-d="1" aria-label="Jour suivant" ${V.isToday ? "disabled" : ""}>${icon("chevron")}</button></div>
        ${btn({ label: L.charging ? "Arrêter la charge" : "Charger l'e-Niro", ic: L.charging ? "pause" : "bolt", act: "car-charge", kind: "primary", disabled: !L.plugged, pending: BZ.isPending(C.voiture_en_charge) })}
      </div></header>`;
  }

  function kpis(V) {
    // Home Assistant : aujourd'hui jusqu'à maintenant contre hier à la même heure (le dire)
    const c = V.cur, p = V.prev, vs = V.isToday ? (V.sameHour ? `vs hier à ${fmt.time(new Date())}` : "vs hier") : "vs veille", wk = (f) => V.week.map(f);
    return h`<div class="kpis">
      ${kpi({ label: "Production solaire", ic: "sun", tone: "solar", value: val(fmt.kwh(c.prod)), delta: delta(c.prod, p.prod), vs, spark: BZ.spark(wk((d) => d.prod), "solar"), to: "energy" })}
      ${kpi({ label: "Consommation", ic: "home", tone: "battery", value: val(fmt.kwh(c.cons)), delta: delta(c.cons, p.cons, { invert: true }), vs, spark: BZ.spark(wk((d) => d.cons), "battery"), to: "insights" })}
      ${kpi({ label: "Autosuffisance", ic: "leaf", tone: "good", value: val([fmt.n(V.autonomy * 100), "%"]), delta: delta(V.autonomy, V.prevAutonomy, { unit: "pts" }), vs, spark: BZ.spark(V.autWeek, "good"), to: "insights" })}
      ${kpi({ label: "Économies", ic: "euro", tone: "accent", value: val([fmt.n(c.savings, 2), "€"]), delta: delta(c.savings, p.savings), vs, spark: BZ.spark(wk((d) => d.savings), "accent"), to: "insights" })}
    </div>`;
  }

  function devicesCard() {
    const f = BZ.ui.devFilter, all = BZ.deviceRows();
    const rows = all.filter((r) => f === "all" || r.cat === f);
    const go = (r) => (r.sheet ? `data-act="open-sheet" data-sheet="${r.sheet}"` : `data-act="nav" data-to="${r.to}"`);
    return card({ cls: "o-dev", title: "Mes appareils", ic: "plug", tone: "accent", link: { label: "Voir la maison", to: "home" },
      aside: pills({ name: "devFilter", label: "Filtrer les appareils", value: f, options: [["all", "Tous"], ["energy", "Énergie"], ["heat", "Chauffage"], ["home", "Maison"]] }),
      body: h`<div class="dt-wrap"><table class="dt">
        <thead><tr><th scope="col">Appareil</th><th scope="col">Type</th><th scope="col">Mesure</th><th scope="col">Statut</th><th scope="col"><span class="sr">Ouvrir</span></th></tr></thead>
        <tbody>${rows.map((r) => h`<tr data-key="${r.k}">
          <td><div class="dt-main"><span class="dt-ic" data-tone="${r.tone}">${icon(r.ic)}</span><div><strong>${r.name}</strong><small>${r.sub}</small></div></div></td>
          <td>${pill(r.type[0], r.type[1])}</td>
          <td class="dt-v">${r.value}</td>
          <td>${pill(r.status[0], r.status[1], r.status[2])}</td>
          <td><button type="button" class="icon-btn" ${go(r)} aria-label="Ouvrir ${BZ.esc(r.name)}">${icon("more")}</button></td>
        </tr>`)}</tbody></table></div>` });
  }

  // Programme du jour : changements de tarif + événements, le prochain mis en avant
  function scheduleCard() {
    const now = new Date(), H = now.getHours() + now.getMinutes() / 60, L = BZ.live(), hrs = BZ.hours();
    // Pic : jamais une case partielle ou inconnue (Home Assistant : l'heure en cours, ou un reste du jour sans heures écrites)
    const peak = hrs.filter((b) => !b.partial && !b.unknown && Number.isFinite(b.prod)).reduce((a, b) => (b.prod > a.prod ? b : a), { h: 0, prod: -Infinity });
    const T = BZ.TARIFS, ev = [];
    let prev = BZ.tariffAt(23);
    for (let x = 0; x < 24; x++) { const k = BZ.tariffAt(x); if (k !== prev) ev.push({ t: x, tone: k, title: T[k].label, sub: `${fmt.n(T[k].price(), 4)} €/kWh · ${BZ.rangeLabel(k)}`, ic: "clock" }); prev = k; }
    // Heure de branchement illisible (aide absente dans Home Assistant) : pas d'événement plutôt qu'une heure fausse
    const plugAt = BZ.dt(C.session_debut);
    if (L.plugged && Number.isFinite(+plugAt)) { const d = plugAt; ev.push({ t: d.getHours() + d.getMinutes() / 60, tone: "ev", title: "e-Niro branchée", sub: `${fmt.n(num(C.voiture_soc) - num(C.session_soc))} % au branchement`, ic: "car" }); }
    if (peak.prod > 0.05) ev.push({ t: peak.h + 0.5, tone: "solar", title: "Pic de production", sub: `${fmt.kwhText(peak.prod)} sur l'heure`, ic: "sun" });
    if (L.charging) { const fin = new Date(Date.now() + num(C.voiture_minutes_restantes) * 6e4); ev.push({ t: fin.getHours() + fin.getMinutes() / 60, tone: "ev", title: "Fin de recharge prévue", sub: `limite ${fmt.n(num(C.voiture_limite_pct))} %`, ic: "bolt" }); }
    ev.sort((a, b) => a.t - b.t);
    const next = ev.findIndex((e) => e.t > H);
    // On montre la fenêtre utile : un événement passé, puis les suivants
    const start = Math.max(0, (next < 0 ? ev.length : next) - 1), list = ev.slice(start, start + 5);
    const hm = (t) => `${String(Math.floor(t) % 24).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}`;
    return card({ cls: "o-sch", title: "Programme du jour", ic: "calendar", tone: "accent", link: { label: "Tarifs", to: "energy" }, body: h`
      <ol class="sched">${list.map((e) => h`<li data-tone="${e.tone}" class="${e.t <= H ? "is-past" : ""} ${ev.indexOf(e) === next ? "is-now" : ""}">
        <time>${hm(e.t)}</time><i></i><div><strong>${e.title}</strong><small>${e.sub}</small></div>${icon(e.ic)}</li>`)}</ol>` });
  }

  function mixCard(V) {
    const c = V.cur, parts = [
      { label: "Soleil direct", v: c.self, tone: "solar" }, { label: "Batterie", v: c.dch, tone: "battery" }, { label: "Réseau", v: c.imp, tone: "neutral" },
    ];
    return card({ cls: "o-mix", title: "D'où vient l'énergie", ic: "leaf", tone: "accent", link: { label: "Détails", to: "insights" }, body: h`
      <div class="mixr">${donut({ parts, size: 132, stroke: 16, center: `${fmt.n(V.autonomy * 100)} %`, sub: "autonome", label: `Autosuffisance ${Number.isFinite(V.autonomy) ? Math.round(V.autonomy * 100) : "—"} %` })}
        <ul class="keys">${parts.map((p) => h`<li data-tone="${p.tone}"><i></i><span>${p.label}</span><b>${fmt.kwhText(p.v)}</b></li>`)}
          <li class="keys-t"><span>Consommé</span><b>${fmt.kwhText(c.cons)}</b></li></ul></div>` });
  }

  function equipCard() {
    const L = BZ.live(), tre = num(C.tremie_kg), max = attr(C.tremie_kg, "max") || 30, ball = num(C.ballon_temp), cons = attr(C.ballon, "temperature") || 55;
    const items = [
      { ic: "car", tone: "ev", name: "Kia e-Niro", sub: `${fmt.n(num(C.voiture_autonomie_km))} km d'autonomie`, status: L.charging ? ["En charge", "ev"] : ["Prête", "good"], v: num(C.voiture_soc), to: "vehicle" },
      { ic: "battery", tone: "battery", name: "Batterie SolarFlow", sub: `${fmt.kwhText(num(C.batterie_dispo_kwh))} disponibles`, status: L.bat > 15 ? ["Charge", "battery"] : L.bat < -15 ? ["Décharge", "warn"] : ["Veille", "neutral"], v: num(C.batterie_soc), to: "energy" },
      { ic: "sack", tone: tre < 5 ? "bad" : "heat", name: "Trémie à granulés", sub: `${fmt.n(tre, 1)} kg sur ${fmt.n(max)} kg`, status: tre < 5 ? ["À remplir", "bad"] : ["OK", "good"], v: (tre / max) * 100, sheet: "poele" },
    ];
    return card({ cls: "o-eq", title: "Réserves", ic: "gauge", tone: "accent", body: h`
      <ul class="plist">${items.map((x) => h`<li>${x.to ? h`<a class="plist-r" href="${BZ.href(x.to)}">` : h`<button type="button" class="plist-r" data-act="open-sheet" data-sheet="${x.sheet}">`}
        <span class="dt-ic" data-tone="${x.tone}">${icon(x.ic)}</span><span><strong>${x.name}</strong><small>${x.sub}</small></span>
        ${pill(x.status[0], x.status[1])}
        <span class="plist-p"><span>${fmt.n(x.v)} %</span>${meter({ value: x.v, tone: x.tone, size: "xs" })}</span>${x.to ? h`</a>` : h`</button>`}</li>`)}</ul>` });
  }

  function linksCard() {
    const lights = C.lumieres.filter(isOn).length, open = C.volets.filter((id) => attr(id, "current_position") > 0).length, boost = num(C.ballon_boost) === 1;
    const q = [
      { label: lights ? `Éteindre ${lights} lumière${lights > 1 ? "s" : ""}` : "Lumières éteintes", ic: "bulb", tone: "light", act: "lights-off", disabled: !lights, pending: C.lumieres.some(BZ.isPending) },
      { label: open ? "Fermer les volets" : "Ouvrir les volets", ic: "blinds", tone: "battery", act: "covers-all", args: { pos: open ? 0 : 100 }, pending: C.volets.some(BZ.isPending) },
      { label: boost ? "Arrêter la chauffe" : "Chauffer le ballon", ic: "drop", tone: "heat", act: "boiler-boost", pending: BZ.isPending(C.ballon_boost) },
      { label: st(C.robot) === "cleaning" ? "Ramener l'aspirateur" : "Lancer l'aspirateur", ic: "robot", tone: "good", act: "robot", args: { cmd: st(C.robot) === "cleaning" ? "return_to_base" : "start" }, pending: BZ.isPending(C.robot) },
    ];
    return card({ cls: "o-ql", title: "Raccourcis", ic: "sparkle", tone: "accent", body: h`
      <div class="qlinks">${q.map((x) => h`<button type="button" class="qlink" data-act="${x.act}" ${BZ.dataArgs(x.args || {})} ${x.disabled ? "disabled" : ""} ${x.pending ? 'aria-busy="true"' : ""}>
        <span class="dt-ic" data-tone="${x.tone}">${icon(x.ic)}</span><span>${x.label}</span></button>`)}</div>` });
  }

  function roiCard() {
    const R = (BZ.roiFull || BZ.roi)();
    return h`<section class="card o-roi">
      <div class="o-roi-t">
        <h3>Ton installation est rentabilisée à ${fmt.n(R.progress * 100)} %</h3>
        <p>${fmt.eur(R.total, 0)} économisés sur ${fmt.eur(R.inv, 0)}. Remboursée vers ${fmt.date(R.payback, { month: "long", year: "numeric" })} au rythme actuel.</p>
        <a class="btn btn-primary btn-sm" href="${BZ.href("insights")}"><span>Voir le bilan</span>${icon("arrow")}</a>
      </div>
      <svg class="o-roi-art" viewBox="0 0 160 120" aria-hidden="true">
        <circle cx="122" cy="30" r="16" class="art-sun"/>
        <g class="art-rays"><path d="M122 6v5M122 49v5M98 30h5M141 30h5M105 13l3.5 3.5M135.5 43.5 139 47M105 47l3.5-3.5M135.5 16.5 139 13"/></g>
        <path d="M22 96 44 52h76l-22 44z" class="art-panel"/>
        <path d="M33 74h76M52 52 41 96M71 52 63 96M90 52 82 96M109 52 101 96" class="art-grid"/>
        <path d="M60 96v14M84 96v14M48 110h48" class="art-leg"/>
        <circle cx="128" cy="86" r="17" class="art-badge"/>
        <path d="m120.5 86 5 5 9.5-10" class="art-check"/>
        <rect x="128" y="74" width="0" height="0"/>
      </svg>
      <div class="o-roi-m">${meter({ value: R.progress * 100, tone: "accent", label: "Part remboursée" })}</div>
    </section>`;
  }

  BZ.pages.overview = () => {
    const V = BZ.dayView(BZ.ui.dayOffset);
    return h`${header(V)}${kpis(V)}
      <div class="layout o-grid">
        <div class="col o-l">${devicesCard()}<div class="o-pair">${equipCard()}${linksCard()}</div></div>
        <div class="col o-r">${scheduleCard()}${mixCard(V)}${roiCard()}</div>
      </div>`;
  };
})();
