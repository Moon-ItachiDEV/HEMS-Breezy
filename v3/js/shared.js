// Breezy HEMS V3 — données dérivées partagées : suggestions (cloche), journée choisie,
// liste des appareils, index de recherche. Aucune mise en forme HTML ici.
(() => {
  const BZ = window.BZ;
  const { fmt, C, num, st, attr, isOn } = BZ;

  /* ─── Suggestions : déduites de l'état, triées par utilité ──────────── */
  BZ.alerts = () => {
    const L = BZ.live(), t = BZ.tariffNow(), out = [];
    const boost = num(C.ballon_boost) === 1;
    if (L.grid < -300 && !boost) out.push({ id: "surplus", tone: "grid", ic: "drop", title: `${fmt.powerText(-L.grid)} partent sur le réseau`, text: "Chauffer le ballon maintenant utilise ce surplus gratuit.", act: "boiler-boost", cta: "Chauffer le ballon" });
    const tremie = num(C.tremie_kg), days = tremie / num(C.conso_jour_kg);
    if (days < 2) out.push({ id: "pellets", tone: "warn", ic: "sack", title: `Trémie : ${fmt.n(tremie, 1)} kg`, text: `Environ ${fmt.n(days * 24)} h d'autonomie au rythme actuel.`, act: "open-sheet", args: { sheet: "poele" }, cta: "Ouvrir le poêle" });
    if (L.plugged && !L.charging && num(C.voiture_soc) < num(C.voiture_limite_pct)) out.push({ id: "car", tone: "ev", ic: "car", title: "e-Niro branchée, pas en charge", text: `${fmt.n(num(C.voiture_soc))} % · limite ${fmt.n(num(C.voiture_limite_pct))} %.`, act: "car-charge", cta: "Charger" });
    if (t.nextKey === "hsc" || t.key === "hsc") { const hrs = Math.max(0, Math.round((t.changeAt - Date.now()) / 36e5)); out.push({ id: "hsc", tone: "hsc", ic: "moon", title: t.key === "hsc" ? "Super creuses en cours" : `Super creuses dans ${hrs} h`, text: `${fmt.n(num(C.tarif_hsc), 4)} €/kWh de ${BZ.rangeLabel("hsc")}.` }); }
    const due = new Date(st(C.poele_entretien)); due.setMonth(due.getMonth() + C.poele_entretien_mois);
    const dj = fmt.inDays(due);
    if (dj < 45) out.push({ id: "stove-care", tone: "warn", ic: "wrench", title: `Entretien du poêle dans ${dj} j`, text: "Pense à prendre rendez-vous avant les grands froids." });
    return out;
  };

  /* ─── Journée choisie (flèches du sélecteur de date) ─────────────────
     offset 0 = aujourd'hui (capteurs), -1 = hier… Renvoie la journée, la veille
     et les 7 jours qui finissent ce jour-là (pour les mini-courbes). */
  BZ.dayView = (offset = 0) => {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset);
    const at = (k) => { const x = new Date(d); x.setDate(x.getDate() + k); return BZ.day(x); };
    const cur = at(0), prev = at(-1), week = Array.from({ length: 7 }, (_, i) => at(i - 6));
    const aut = (x) => (x.cons ? 1 - x.imp / x.cons : 0);
    return { date: d, offset, isToday: offset === 0, cur, prev, week, autonomy: aut(cur), prevAutonomy: aut(prev), autWeek: week.map(aut) };
  };

  /* ─── Appareils qui comptent maintenant (tableau de l'Aperçu) ─────────
     type : énergie / chauffage / maison ; statut : pastille teintée ; go : page ou panneau */
  BZ.deviceRows = () => {
    const L = BZ.live(), rows = [];
    const fin = new Date(Date.now() + num(C.voiture_minutes_restantes) * 6e4);
    rows.push({ k: "car", cat: "energy", ic: "car", tone: "ev", name: "Kia e-Niro", sub: L.charging ? `Recharge ${fmt.n(L.evSolarShare * 100)} % solaire · fin ${fmt.time(fin)}` : L.plugged ? "Branchée" : "Débranchée",
      type: ["Véhicule", "ev"], value: L.charging ? fmt.powerText(L.car) : `${fmt.n(num(C.voiture_soc))} %`, status: L.charging ? ["En charge", "ev", true] : L.plugged ? ["Branchée", "neutral"] : ["Débranchée", "neutral"], to: "vehicle" });
    rows.push({ k: "bat", cat: "energy", ic: "battery", tone: "battery", name: "Batterie SolarFlow", sub: `${fmt.n(num(C.batterie_soc))} % · ${fmt.kwhText(num(C.batterie_dispo_kwh))} disponibles`,
      type: ["Stockage", "battery"], value: fmt.powerText(Math.abs(L.bat)), status: Math.abs(L.bat) < 15 ? ["En veille", "neutral"] : L.bat > 0 ? ["Charge", "battery", true] : ["Décharge", "warn", true], to: "energy" });
    rows.push({ k: "sun", cat: "energy", ic: "sun", tone: "solar", name: "Panneaux solaires", sub: `3 onduleurs · ${fmt.kwhText(BZ.today().prod)} aujourd'hui`,
      type: ["Production", "solar"], value: fmt.powerText(L.solar), status: L.solar > 30 ? ["Produit", "good", true] : ["Nuit", "neutral"], to: "energy" });
    const stoveOn = st(C.poele) !== "off";
    rows.push({ k: "stove", cat: "heat", ic: "flame", tone: "heat", name: "Poêle à granulés", sub: stoveOn ? `${st(C.poele_statut)} · P${st(C.poele_puissance)} · trémie ${fmt.n(num(C.tremie_kg))} kg` : "Éteint",
      type: ["Chauffage", "heat"], value: `${fmt.n(attr(C.poele, "current_temperature"), 1)} °C`, status: stoveOn ? ["Allumé", "heat", true] : ["Éteint", "neutral"], sheet: "poele" });
    const boil = isOn(C.ballon_chauffe) || num(C.ballon_boost) === 1;
    rows.push({ k: "boiler", cat: "heat", ic: "drop", tone: "battery", name: "Ballon d'eau chaude", sub: `Consigne ${fmt.n(attr(C.ballon, "temperature"))} °C${num(C.ballon_boost) === 1 ? " · chauffe forcée" : ""}`,
      type: ["Chauffage", "heat"], value: `${fmt.n(num(C.ballon_temp))} °C`, status: boil ? ["Chauffe", "warn", true] : ["Au repos", "neutral"], sheet: "ballon" });
    const lights = C.lumieres.filter(isOn);
    rows.push({ k: "lights", cat: "home", ic: "bulb", tone: "light", name: "Lumières", sub: lights.length ? lights.map((id) => C.lumieres_noms[C.lumieres.indexOf(id)]).join(", ") : "Toutes éteintes",
      type: ["Maison", "light"], value: `${lights.length} / ${C.lumieres.length}`, status: lights.length ? ["Allumées", "light"] : ["Éteintes", "neutral"], to: "home" });
    if (isOn(C.prise_chambre)) rows.push({ k: "plug", cat: "home", ic: "plug", tone: "good", name: "Prise chambre", sub: `${fmt.kwhText(num(C.prise_chambre_kwh))} au total`,
      type: ["Maison", "good"], value: fmt.powerText(num(C.prise_chambre_w)), status: ["Allumée", "good"], to: "home" });
    const rs = st(C.robot);
    rows.push({ k: "robot", cat: "home", ic: "robot", tone: "battery", name: "Aspirateur", sub: `${fmt.n(num(C.robot_batterie))} % de batterie`,
      type: ["Maison", "battery"], value: { docked: "Base", cleaning: "Nettoie", returning: "Retour", idle: "Pause" }[rs] || rs, status: rs === "cleaning" ? ["Nettoie", "battery", true] : ["Sur sa base", "neutral"], sheet: "robot" });
    return rows;
  };

  /* ─── Index de recherche : pages + accessoires ────────────────────── */
  BZ.searchIndex = () => {
    const out = [
      { label: "Aperçu", sub: "Page", ic: "overview", tone: "accent", to: "overview" },
      { label: "Énergie", sub: "Page · réseau, batterie, solaire", ic: "energy", tone: "accent", to: "energy" },
      { label: "Bilan", sub: "Page · historique et rentabilité", ic: "insights", tone: "accent", to: "insights" },
      { label: "Voiture", sub: "Page · Kia e-Niro", ic: "car", tone: "accent", to: "vehicle" },
      { label: "Maison", sub: "Page · lumières, volets, chauffage", ic: "home", tone: "accent", to: "home" },
      { label: "Poêle à granulés", sub: "Chauffage", ic: "flame", tone: "heat", sheet: "poele" },
      { label: "Ballon d'eau chaude", sub: "Chauffage", ic: "drop", tone: "battery", sheet: "ballon" },
      { label: "Aspirateur", sub: "Appareil", ic: "robot", tone: "battery", sheet: "robot" },
      { label: "Multiprise", sub: "Appareil", ic: "plug", tone: "good", sheet: "strip" },
      { label: "HomePod salon", sub: "Musique", ic: "speaker", tone: "ev", sheet: "media" },
      ...C.volets_noms.map((n, i) => ({ label: `Volet ${n}`, sub: "Volet", ic: "blinds", tone: "battery", sheet: `cover:${i}` })),
      ...C.radiateurs_noms.map((n, i) => ({ label: `Radiateur ${n}`, sub: "Chauffage", ic: "thermo", tone: "heat", sheet: `rad:${i}` })),
      ...C.lumieres_noms.map((n, i) => ({ label: `Lumière ${n}`, sub: isOn(C.lumieres[i]) ? "Allumée · Entrée pour éteindre" : "Éteinte · Entrée pour allumer", ic: "bulb", tone: "light", act: "toggle", args: { entity: C.lumieres[i] } })),
    ];
    return out;
  };
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  BZ.search = (q) => { const n = norm(q.trim()); if (!n) return []; return BZ.searchIndex().filter((x) => norm(`${x.label} ${x.sub}`).includes(n)).slice(0, 8); };
})();
