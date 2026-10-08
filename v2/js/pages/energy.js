// Énergie : le détail technique du temps réel (réseau, batterie, solaire, tarifs, journée).
// L'Aperçu montre le flux ; cette page explique chaque source, sans le répéter.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val, card, badge, ring, meter, stat, stepper, legend, C, num, attr } = BZ;

  function gridCard() {
    const L = BZ.live(), T = BZ.today(), t = BZ.tariffNow(), g = L.grid, max = 4000;
    const exp = g < -15, imp = g > 15;
    const hours = BZ.tariffHours(), nowH = new Date().getHours() + new Date().getMinutes() / 60;
    return card({ cls: "e-grid", title: "Réseau", sub: "Compteur L3 · en direct", ic: "grid", tone: imp ? "bad" : "grid", aside: badge(exp ? "Revente" : imp ? "Achat" : "Équilibre", exp ? "good" : imp ? "bad" : "neutral", true), body: h`
      <div class="big-v ${exp ? "is-good" : imp ? "is-bad" : ""}">${val([`${exp ? "−" : imp ? "+" : ""}${fmt.power(Math.abs(g))[0]}`, fmt.power(Math.abs(g))[1]])}</div>
      <div class="diverge" role="meter" aria-label="Échange avec le réseau" aria-valuenow="${Math.round(g)}">
        <span class="diverge-l">Achat</span><div class="diverge-t"><i class="${exp ? "is-r" : "is-l"}" style="--v:${BZ.clamp((Math.abs(g) / max) * 50, 0.5, 50)}%"></i><b></b></div><span class="diverge-r">Revente</span>
      </div>
      <div class="kv-2">
        ${stat({ label: "Acheté aujourd'hui", value: val(fmt.kwh(T.imp)) })}
        ${stat({ label: "Revendu aujourd'hui", value: val(fmt.kwh(T.exp)) })}
      </div>
      <div class="tariff-day">
        <div class="tariff-day-h"><span>Tarif en cours</span><b>${t.label} · ${fmt.n(t.price, 4)} €/kWh</b><em>jusqu'à ${fmt.time(t.changeAt)}</em></div>
        <div class="ribbon" role="img" aria-label="Tarifs de la journée">${hours.map((k, i) => h`<i data-tariff="${k}" title="${i}h : ${BZ.TARIFS[k].label}"></i>`)}<b style="--x:${(nowH / 24) * 100}%"></b></div>
        <div class="ribbon-ax"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
        <div class="tariff-key">${["hp", "hc", "hsc"].map((k) => h`<span data-tariff="${k}"><i></i>${BZ.TARIFS[k].short} <b>${fmt.n(BZ.TARIFS[k].price(), 4)} €</b></span>`)}</div>
      </div>` });
  }

  function batteryCard() {
    const L = BZ.live(), soc = num(C.batterie_soc), min = num(C.batterie_min_pct), max = num(C.batterie_max_pct);
    const eff = num(C.batterie_total_decharge_kwh) / num(C.batterie_total_charge_kwh);
    const state = Math.abs(L.bat) < 15 ? "En veille" : L.bat > 0 ? `Charge · ${fmt.powerText(L.bat)}` : `Décharge · ${fmt.powerText(-L.bat)}`;
    return card({ cls: "e-bat", title: "Batterie SolarFlow", sub: `${fmt.kwhText(num(C.batterie_dispo_kwh))} disponibles · ${fmt.n(num(C.batterie_temp))} °C`, ic: "battery", tone: "battery", aside: badge(state, "battery", Math.abs(L.bat) >= 15), body: h`
      <div class="bat">
        ${ring({ value: soc, tone: "battery", size: 128, stroke: 10, mark: max, label: `Batterie ${soc} %`, inner: h`<b>${fmt.n(soc)}<small>%</small></b><span>charge</span>` })}
        <ul class="packs">${C.packs_soc.map((id, i) => h`<li><span>Pack ${i + 1}</span>${meter({ value: num(id), tone: "battery", size: "xs" })}<b>${fmt.n(num(id))} %</b><em>${fmt.n(num(C.packs_temp[i]))}°</em></li>`)}</ul>
      </div>
      <div class="kv-3">
        <div><span>Chargé aujourd'hui</span><b>${fmt.kwhText(num(C.batterie_charge_jour_kwh))}</b></div>
        <div><span>Rendu aujourd'hui</span><b>${fmt.kwhText(num(C.batterie_decharge_jour_kwh))}</b></div>
        <div><span>Rendement</span><b>${fmt.n(eff * 100, 1)} %</b></div>
      </div>
      <div class="rows">
        <div class="row"><div><strong>Réserve minimale</strong><span>la batterie s'arrête à</span></div>${stepper({ value: fmt.n(min), unit: " %", act: "bat-min", label: "Réserve minimale", cur: min, min: 0, max: 50, pending: BZ.isPending(C.batterie_min_pct) })}</div>
        <div class="row"><div><strong>Charge maximale</strong><span>se remplit jusqu'à</span></div>${stepper({ value: fmt.n(max), unit: " %", act: "bat-max", label: "Charge maximale", cur: max, min: 70, max: 100, pending: BZ.isPending(C.batterie_max_pct) })}</div>
      </div>
      <div class="foot"><span>Depuis l'installation</span><span>${fmt.n(num(C.batterie_total_charge_kwh))} kWh stockés · ${fmt.n(num(C.batterie_total_decharge_kwh))} kWh rendus</span></div>` });
  }

  function solarCard() {
    const L = BZ.live(), T = BZ.today(), caps = [2000, 2000, 1000];
    const remaining = Math.max(0, T.forecast - T.prod);
    return card({ cls: "e-sun", title: "Production solaire", sub: `${fmt.kwhText(T.prod)} sur ${fmt.kwhText(T.forecast)} prévus`, ic: "sun", tone: "solar", body: h`
      <div class="big-v">${val(fmt.power(L.solar))}<span class="big-s">encore ~${fmt.kwhText(remaining)} attendus</span></div>
      ${meter({ value: (T.prod / T.forecast) * 100, tone: "solar", label: "Production du jour" })}
      <ul class="inv">${C.onduleurs_w.map((id, i) => h`<li><div><strong>${C.onduleurs_noms[i]}</strong><span>${fmt.n((num(id) / caps[i]) * 100)} % de sa puissance</span></div>${val(fmt.power(num(id)), "inv-v")}${meter({ value: (num(id) / caps[i]) * 100, tone: "solar", size: "xs" })}</li>`)}</ul>` });
  }

  function dayCard() {
    const hrs = BZ.hours(), now = new Date();
    const firstSun = hrs.find((x) => x.prod > 0.05), peak = hrs.reduce((a, b) => (b.prod > a.prod ? b : a));
    const events = [
      firstSun && { t: `${String(firstSun.h).padStart(2, "0")}:00`, tone: "solar", title: "Début de la production", text: "Premiers rayons sur les panneaux" },
      { t: "08:45", tone: "battery", title: "La batterie commence à charger", text: "Surplus solaire disponible" },
      BZ.live().plugged && { t: fmt.time(new Date(BZ.st(C.session_debut))), tone: "ev", title: "e-Niro branchée", text: `Recharge solaire · ${fmt.n(num(C.voiture_soc) - num(C.session_soc))} % au branchement` },
      { t: "10:20", tone: "grid", title: "Début de la revente", text: "Maison et batterie servies" },
      { t: `${String(peak.h).padStart(2, "0")}:00`, tone: "solar", title: "Pic prévu", text: `${fmt.kwhText(peak.prod)} sur l'heure`, future: peak.future },
      { t: fmt.time(now), tone: "neutral", title: "Maintenant", text: `${fmt.powerText(BZ.live().solar)} produits`, now: true },
    ].filter(Boolean).sort((a, b) => a.t.localeCompare(b.t));
    return card({ cls: "e-day", title: "Journal du jour", ic: "clock", tone: "neutral", body: h`
      <ol class="tl">${events.map((e) => h`<li data-tone="${e.tone}" class="${e.now ? "is-now" : ""} ${e.future ? "is-future" : ""}"><time>${e.t}</time><i></i><div><strong>${e.title}</strong><span>${e.text}</span></div></li>`)}</ol>` });
  }

  BZ.pages.energy = () => {
    const t = BZ.tariffNow();
    return h`
      <header class="page-h"><div><p class="eyebrow">Temps réel</p><h1>Énergie</h1><p class="lede">Réseau, batterie et production en détail.</p></div>
        <div class="page-a">${badge(`${t.short} · ${fmt.n(t.price, 4)} €/kWh`, "neutral")}</div></header>
      <div class="layout layout-energy">${gridCard()}${batteryCard()}${solarCard()}${dayCard()}</div>`;
  };
})();
