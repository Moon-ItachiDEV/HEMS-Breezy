// Aperçu : répond en un coup d'œil à « que se passe-t-il chez moi maintenant ? »
// Hiérarchie : 1) le flux en direct  2) le bilan du jour  3) ce qui mérite une action.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val, card, badge, btn, ring, stat, meter, legend, C, num, st, attr, isOn } = BZ;

  // Suggestions : déduites de l'état, triées par utilité, 3 au maximum
  function insights() {
    const L = BZ.live(), t = BZ.tariffNow(), out = [];
    const boost = num(C.ballon_boost) === 1;
    if (L.grid < -300 && !boost) out.push({ tone: "grid", ic: "drop", title: `${fmt.powerText(-L.grid)} partent sur le réseau`, text: `Revendus ${fmt.n(0.06, 2)} €/kWh. Chauffer le ballon maintenant utilise ce surplus.`, action: btn({ label: "Chauffer le ballon", act: "boiler-boost", kind: "primary", size: "sm", pending: BZ.isPending(C.ballon_boost) }) });
    const tremie = num(C.tremie_kg), conso = num(C.conso_jour_kg), days = tremie / conso;
    if (days < 2) out.push({ tone: "warn", ic: "sack", title: `Trémie : ${fmt.n(tremie, 1)} kg`, text: `Environ ${fmt.n(days * 24)} h d'autonomie au rythme actuel.`, action: btn({ label: "Sac versé", act: "open-sheet", args: { sheet: "poele" }, size: "sm" }) });
    if (L.plugged && !L.charging && num(C.voiture_soc) < num(C.voiture_limite_pct)) out.push({ tone: "ev", ic: "car", title: "e-Niro branchée, pas en charge", text: `${fmt.n(num(C.voiture_soc))} % · limite ${fmt.n(num(C.voiture_limite_pct))} %.`, action: btn({ label: "Charger", act: "car-charge", kind: "primary", size: "sm" }) });
    if (t.nextKey === "hsc" || t.key === "hsc") { const hrs = Math.max(0, Math.round((t.changeAt - Date.now()) / 36e5)); out.push({ tone: "neutral", ic: "moon", title: t.key === "hsc" ? "Super creuses en cours" : `Super creuses dans ${hrs} h`, text: `${fmt.n(num(C.tarif_hsc), 4)} €/kWh de ${BZ.rangeLabel("hsc")}. Idéal pour la voiture si le soleil ne suffit pas.` }); }
    const dj = fmt.inDays(new Date(new Date(st(C.poele_entretien)).setMonth(new Date(st(C.poele_entretien)).getMonth() + C.poele_entretien_mois)));
    if (dj < 45) out.push({ tone: "warn", ic: "wrench", title: `Entretien du poêle dans ${dj} j`, text: "Pense à prendre rendez-vous avant les grands froids." });
    return out.slice(0, 3);
  }

  function devices() {
    const L = BZ.live(), lights = C.lumieres.filter(isOn);
    const list = [];
    if (L.plugged) list.push({ ic: "car", tone: "ev", name: "e-Niro", state: L.charging ? `En charge · fin ${fmt.time(new Date(Date.now() + num(C.voiture_minutes_restantes) * 6e4))}` : "Branchée", value: fmt.power(L.car), progress: num(C.voiture_soc), go: "vehicle", live: L.charging });
    if (st(C.poele) !== "off") list.push({ ic: "flame", tone: "heat", name: "Poêle", state: `${st(C.poele_statut)} · P${st(C.poele_puissance)}`, value: [fmt.n(attr(C.poele, "current_temperature"), 1), "°C"], go: "home", live: true });
    if (lights.length) list.push({ ic: "bulb", tone: "light", name: "Lumières", state: lights.map((id) => C.lumieres_noms[C.lumieres.indexOf(id)]).join(", "), value: [String(lights.length), `/ ${C.lumieres.length}`], go: "home" });
    if (isOn(C.prise_chambre)) list.push({ ic: "plug", tone: "neutral", name: "Prise chambre", state: "Allumée", value: fmt.power(num(C.prise_chambre_w)), go: "home" });
    if (isOn(C.ballon_chauffe) || num(C.ballon_boost) === 1) list.push({ ic: "drop", tone: "battery", name: "Ballon", state: "Chauffe", value: [fmt.n(num(C.ballon_temp)), "°C"], go: "home", live: true });
    if (st(C.homepod) === "playing") list.push({ ic: "speaker", tone: "neutral", name: "HomePod", state: attr(C.homepod, "media_title"), value: ["", ""], go: "home" });
    return list;
  }

  BZ.pages.overview = () => {
    const L = BZ.live(), T = BZ.today(), tariff = BZ.tariffNow(), now = new Date(), R = BZ.roi();
    const hours = BZ.hours(), ins = insights(), dev = devices();
    const status = [
      L.grid < -15 ? `revente de ${fmt.powerText(-L.grid)}` : L.grid > 15 ? `achat de ${fmt.powerText(L.grid)}` : "aucun échange avec le réseau",
      L.charging ? `e-Niro en charge à ${fmt.n(L.evSolarShare * 100)} % au soleil` : null,
    ].filter(Boolean).join(" · ");
    const hello = now.getHours() < 5 ? "Bonne nuit" : now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";

    return h`
      <header class="page-h">
        <div><p class="eyebrow">${fmt.cap(fmt.date(now, { weekday: "long", day: "numeric", month: "long" }))}</p><h1>${hello}</h1><p class="lede">${fmt.cap(status)}.</p></div>
      </header>

      <div class="layout layout-overview">
        ${card({ cls: "a-flow card-hero", title: "En direct", sub: "Où va l'énergie en ce moment", ic: "energy", tone: "solar", aside: badge("En direct", "good", true), body: BZ.flow() })}

        ${card({ cls: "a-today", title: "Aujourd'hui", sub: `${fmt.kwhText(T.forecast)} prévus par Solcast`, ic: "sun", tone: "solar", body: h`
          <div class="today">
            ${ring({ value: T.autonomy * 100, tone: "good", size: 112, stroke: 9, label: `Autosuffisance ${Math.round(T.autonomy * 100)} %`, inner: h`<b>${fmt.n(T.autonomy * 100)}<small>%</small></b><span>autonomie</span>` })}
            <div class="today-s">
              ${stat({ label: "Produit", value: val(fmt.kwh(T.prod)), sub: meter({ value: (T.prod / T.forecast) * 100, tone: "solar", size: "xs", label: "Production par rapport à la prévision" }) })}
              ${stat({ label: "Consommé", value: val(fmt.kwh(T.cons)), sub: h`<span>${fmt.kwhText(T.imp)} achetés</span>` })}
            </div>
          </div>
          <div class="today-f">
            <div><span>Économisé</span><b>${fmt.eur(T.savings)}</b></div>
            <div><span>Revendu</span><b>${fmt.kwhText(T.exp)}</b></div>
            <div><span>Tarif</span><b>${tariff.short} · ${fmt.n(tariff.price, 4)} €</b></div>
          </div>` })}

        ${card({ cls: "a-ins", title: "À retenir", ic: "sparkle", tone: "neutral", aside: ins.length ? badge(String(ins.length), "neutral") : "", body: ins.length
          ? h`<ul class="ins">${ins.map((x) => h`<li data-tone="${x.tone}"><span class="ins-i">${icon(x.ic)}</span><div><strong>${x.title}</strong><p>${x.text}</p></div>${x.action ? h`<div class="ins-a">${x.action}</div>` : ""}</li>`)}</ul>`
          : BZ.empty({ ic: "check", title: "Rien à signaler", text: "Tout tourne comme prévu." }) })}

        ${card({ cls: "a-chart", title: "La journée", sub: "Production et consommation, kWh par heure", ic: "insights", tone: "neutral", body: h`
          ${legend([["Production", "solar"], ["Prévision", "solar"], ["Consommation", "battery"]])}
          ${BZ.lines({ label: "Production et consommation d'aujourd'hui", labels: hours.map((x) => x.label), labelEvery: 3, height: 210, band: hours.map((x) => x.tariff), now: now.getHours() + now.getMinutes() / 60,
            series: [{ label: "Production", tone: "solar", area: true, values: hours.map((x) => (x.future ? null : x.prod)) }, { label: "Prévision", tone: "solar", dashed: true, values: hours.map((x, i) => (x.future || hours[i + 1]?.future ? x.prod : null)) }, { label: "Consommation", tone: "battery", values: hours.map((x) => x.cons) }] })}
          <div class="tariff-key">${["hp", "hc", "hsc"].map((k) => h`<span data-tariff="${k}"><i></i>${BZ.TARIFS[k].short} <em>${BZ.rangeLabel(k)}</em></span>`)}</div>` })}

        ${card({ cls: "a-dev", title: "Appareils actifs", ic: "plug", tone: "neutral", aside: badge(String(dev.length), "neutral"), body: dev.length
          ? h`<ul class="dev">${dev.map((d) => h`<li><button type="button" class="dev-b" data-act="nav" data-to="${d.go}">
              <span class="chip" data-tone="${d.tone}">${icon(d.ic)}</span>
              <span class="dev-t"><strong>${d.name}</strong><span>${d.live ? h`<i class="pulse" data-tone="${d.tone}"></i>` : ""}${d.state}</span></span>
              ${d.value[0] ? val(d.value, "dev-v") : ""}${icon("chevron", "dev-c")}</button></li>`)}</ul>`
          : BZ.empty({ ic: "power", title: "Tout est éteint", text: "Aucun appareil ne consomme en ce moment." }) })}

        ${card({ cls: "a-roi", title: "Rentabilité", sub: "Installation solaire", ic: "euro", tone: "good", attrs: 'data-act="nav" data-to="insights" role="link" tabindex="0"', body: h`
          <div class="roi-mini"><b>${fmt.eur(R.total, 0)}</b><span>sur ${fmt.eur(R.inv, 0)}</span></div>
          ${meter({ value: R.progress * 100, tone: "good", label: "Investissement remboursé" })}
          <p class="muted">Remboursé vers ${fmt.date(R.payback, { month: "long", year: "numeric" })} au rythme actuel.</p>` })}
      </div>`;
  };
})();
