// Voiture : 1) état de la batterie et actions  2) la charge en cours  3) coût et origine des recharges.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val, card, badge, btn, toggle, stepper, segmented, meter, legend, C, num, st, isOn } = BZ;

  function hero() {
    const L = BZ.live(), soc = num(C.voiture_soc), lim = num(C.voiture_limite_pct), km = num(C.voiture_autonomie_km);
    const locked = st(C.voiture_verrou) === "locked", fin = new Date(Date.now() + num(C.voiture_minutes_restantes) * 6e4);
    const kmFull = soc > 0 ? km / (soc / 100) : 0;
    const cells = Array.from({ length: 20 }, (_, i) => { const lo = i * 5; return h`<i class="${lo < soc ? "is-on" : ""} ${lo < soc && lo + 5 >= soc && L.charging ? "is-edge" : ""} ${lo >= soc && lo < lim ? "is-goal" : ""}"></i>`; });
    const unlockArmed = BZ.ui.armed === "unlock";
    return card({ cls: "v-hero card-hero", body: h`
      <div class="v-top">
        <div>
          <p class="eyebrow">Kia e-Niro · relevé ${fmt.ago(st(C.voiture_maj))}</p>
          <div class="v-soc">${val([fmt.n(soc), "%"], "v-soc-v")}<span class="v-km">${fmt.n(km)} km</span></div>
        </div>
        ${L.charging ? h`<div class="v-live"><span class="pulse" data-tone="ev"></span><div>${val(fmt.power(L.car))}<span>fin vers ${fmt.time(fin)}</span></div></div>`
          : badge(L.plugged ? "Branchée" : "Débranchée", "neutral")}
      </div>
      <div class="cells" role="meter" aria-label="Batterie ${soc} %, limite ${lim} %" aria-valuenow="${soc}" aria-valuemin="0" aria-valuemax="100">${cells}<b style="--x:${lim}%"><span>${fmt.n(lim)} %</span></b></div>
      <div class="cells-ax"><span>0 km</span><span>${fmt.n(kmFull * lim / 100)} km à ${fmt.n(lim)} %</span><span>${fmt.n(kmFull)} km</span></div>
      <dl class="facts">
        <div><dt>Batterie 12 V</dt><dd>${fmt.n(num(C.voiture_12v_pct))} %</dd></div>
        <div><dt>Dernier trajet</dt><dd>${fmt.ago(st(C.voiture_dernier_trajet))}</dd></div>
        <div><dt>Depuis</dt><dd>${fmt.n(soc - num(C.voiture_soc_reference))} %</dd></div>
      </dl>
      <div class="v-acts">
        ${btn({ label: L.charging ? "Arrêter la charge" : "Démarrer la charge", ic: "bolt", act: "car-charge", kind: L.charging ? "secondary" : "primary", disabled: !L.plugged, pending: BZ.isPending(C.voiture_en_charge) })}
        ${btn({ label: unlockArmed ? "Confirmer l'ouverture" : locked ? "Verrouillée" : "Ouverte", ic: locked ? "lock" : "unlock", act: "car-lock", kind: unlockArmed ? "danger" : "secondary", pending: BZ.isPending(C.voiture_verrou) })}
        ${btn({ label: "Climatisation", ic: "snow", act: "car-clim", kind: isOn(C.voiture_clim) ? "accent" : "secondary", pending: BZ.isPending(C.voiture_clim) })}
        ${btn({ ic: "refresh", act: "car-refresh", aria: "Demander un relevé à la voiture", kind: "ghost", pending: BZ.isPending(C.voiture_rafraichir) })}
      </div>` });
  }

  function session() {
    const L = BZ.live(), sol = num(C.session_sol_kwh), res = num(C.session_res_kwh), t = sol + res;
    if (!L.plugged) return card({ cls: "v-sess", title: "Cette charge", ic: "bolt", tone: "ev", body: BZ.empty({ ic: "plug", title: "Voiture débranchée", text: "La session suivante s'affichera dès le branchement." }) });
    return card({ cls: "v-sess", title: "Cette charge", sub: `depuis ${fmt.time(new Date(st(C.session_debut)))}`, ic: "bolt", tone: "ev", aside: badge(`${fmt.n((sol / t) * 100)} % soleil`, "solar"), body: h`
      <div class="sess">
        <div class="sess-big">${val([`+${fmt.n(num(C.session_soc))}`, "%"])}<span>${fmt.kwhText(t)} ajoutés</span></div>
        ${BZ.split([{ label: "Soleil", v: sol, tone: "solar" }, { label: "Réseau", v: res, tone: "grid" }])}
        ${legend([["Soleil", "solar", fmt.kwhText(sol)], ["Réseau", "grid", fmt.kwhText(res)]])}
      </div>` });
  }

  function charges() {
    const kind = BZ.ui.carPeriod, M = BZ.chargeMix(kind), conso = C.voiture_conso_kwh_100km || 16.5;
    const per100 = M.kwh ? (M.cost / M.kwh) * conso : 0, ess = (C.essence_l_100km || 6.5) * (C.essence_prix_l || 1.85), km = (M.kwh / conso) * 100;
    const days = BZ.chargeDays(35), maxDay = Math.max(...days.map((d) => d.kwh), 1), pad = (days[0].date.getDay() + 6) % 7;
    const rows = [["sol", "Soleil", "solar"], ["hsc", "Super creuses", "hsc"], ["hc", "Heures creuses", "hc"], ["hp", "Heures pleines", "hp"]];
    return card({ cls: "v-charges", title: "Recharges", sub: "Origine, coût et calendrier", ic: "insights", tone: "ev",
      aside: segmented({ name: "carPeriod", label: "Période", value: kind, options: [["semaine", "7 j"], ["mois", "Mois"], ["annee", "Année"]] }), body: h`
      <div class="ch-grid">
        <div class="ch-mix">
          <div class="big-v">${val(fmt.kwh(M.kwh))}<span class="big-s">${fmt.n(M.sunShare * 100)} % au soleil · ${fmt.eur(M.cost)}</span></div>
          ${BZ.split(rows.map(([k, l, tone]) => ({ label: l, v: M.mix[k], tone })))}
          <ul class="mix">${rows.map(([k, l, tone]) => h`<li data-tone="${tone}"><i></i><span>${l}</span><em>${k === "sol" ? "gratuit" : `${fmt.n(M.price[k], 4)} €`}</em><b>${fmt.kwhText(M.mix[k])}</b></li>`)}</ul>
          <div class="cmp100">
            <div class="is-me"><span>e-Niro</span><b>${fmt.eur(per100, 2)}</b><em>/100 km</em></div>
            <div><span>Tout en HP</span><b>${fmt.eur(conso * M.price.hp, 2)}</b><em>/100 km</em></div>
            <div><span>Essence</span><b>${fmt.eur(ess, 2)}</b><em>/100 km</em></div>
          </div>
          <p class="muted">≈ <b class="good">${fmt.eur((ess - per100) * km / 100, 0)}</b> économisés sur ${fmt.n(km)} km par rapport à l'essence.</p>
        </div>
        <div class="ch-cal">
          <div class="cal-h"><strong>5 dernières semaines</strong>${legend([["Soleil", "solar"], ["Réseau", "grid"]])}</div>
          <div class="cal" role="grid" aria-label="Recharges des 5 dernières semaines">
            ${["L", "M", "M", "J", "V", "S", "D"].map((d) => h`<span class="cal-wd" aria-hidden="true">${d}</span>`)}
            ${Array.from({ length: pad }, () => h`<span class="cal-pad"></span>`)}
            ${days.map((d) => h`<span class="cal-d ${d.kwh ? "" : "is-none"}" role="gridcell" style="--a:${(d.kwh / maxDay).toFixed(2)};--s:${Math.round(d.sun * 100)}%" title="${fmt.date(d.date, { weekday: "long", day: "numeric", month: "long" })} — ${d.kwh ? `${fmt.kwhText(d.kwh)}, ${fmt.n(d.sun * 100)} % soleil` : "pas de recharge"}">${d.date.getDate()}</span>`)}
          </div>
        </div>
      </div>` });
  }

  function settings() {
    const lim = num(C.voiture_limite_pct), dc = num(C.voiture_limite_dc_pct);
    return card({ cls: "v-set", title: "Réglages de recharge", ic: "gauge", tone: "neutral", body: h`<div class="rows">
      <div class="row"><div><strong>Limite à la maison</strong><span>recharge AC</span></div>${stepper({ value: fmt.n(lim), unit: " %", act: "car-lim", label: "Limite AC", cur: lim, min: 50, max: 100, pending: BZ.isPending(C.voiture_limite_pct) })}</div>
      <div class="row"><div><strong>Recharge rapide</strong><span>limite DC</span></div>${stepper({ value: fmt.n(dc), unit: " %", act: "car-limdc", label: "Limite DC", cur: dc, min: 50, max: 100, pending: BZ.isPending(C.voiture_limite_dc_pct) })}</div>
      <div class="row"><div><strong>Heures creuses seulement</strong><span>ne charge qu'en HC</span></div>${toggle({ on: isOn(C.voiture_heures_creuses), act: "toggle", args: { entity: C.voiture_heures_creuses }, label: "Heures creuses seulement", pending: BZ.isPending(C.voiture_heures_creuses) })}</div>
      <div class="row"><div><strong>Charge programmée</strong><span>horaire réglé dans la voiture</span></div>${toggle({ on: isOn(C.voiture_programmee), act: "toggle", args: { entity: C.voiture_programmee }, label: "Charge programmée", pending: BZ.isPending(C.voiture_programmee) })}</div>
    </div>` });
  }

  function care() {
    const odo = num(C.voiture_odometre), last = num(C.entretien_dernier_km), next = last + C.entretien_intervalle_km, left = next - odo;
    return card({ cls: "v-care", title: "Entretien", sub: `${fmt.n(odo)} km au compteur`, ic: "wrench", tone: left < 1000 ? "warn" : "neutral", body: h`
      <div class="big-v">${val([fmt.n(Math.abs(left)), "km"])}<span class="big-s">${left >= 0 ? `avant la révision des ${fmt.n(next)} km` : "de retard sur la révision"}</span></div>
      ${meter({ value: ((odo - last) / C.entretien_intervalle_km) * 100, tone: left < 1000 ? "warn" : "ev", label: "Avancement jusqu'à la révision" })}
      <div class="btn-row">${btn({ label: "Révision faite", ic: "check", act: "car-service" })}${btn({ label: "Autre kilométrage…", act: "car-service-km", kind: "ghost" })}</div>
` });
  }

  BZ.pages.vehicle = () => h`
    <header class="page-h"><div><p class="eyebrow">Équipement</p><h1>Kia e-Niro</h1></div></header>
    <div class="layout layout-vehicle">${hero()}${session()}${charges()}${settings()}${care()}</div>`;
})();
