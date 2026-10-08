// Bilan : l'historique. Une seule période pilote toute la page ; chaque carte répond à une question.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val, card, badge, segmented, meter, legend, delta, C } = BZ;

  BZ.pages.insights = () => {
    const P = BZ.period(BZ.ui.period), T = P.total, Q = P.prevTotal, R = BZ.roi();
    const real = P.buckets.filter((b) => !b.forecast && b.prod != null);
    const autonomy = T.cons ? 1 - T.imp / T.cons : 0, prevAut = Q.cons ? 1 - Q.imp / Q.cons : 0;
    const dense = P.buckets.length > 14, every = P.kind === "jour" ? 3 : dense ? 5 : 1;

    // 1. Où va la production (barres empilées : maison / batterie / revente ; prévision hachurée)
    const isDay = P.kind === "jour";
    const prodChart = isDay
      ? BZ.lines({ label: "Production et consommation par heure", labels: P.buckets.map((b) => b.key), labelEvery: 3, height: 220, band: P.buckets.map((b) => b.tariff),
          series: [{ label: "Production", tone: "solar", area: true, values: P.buckets.map((b) => (b.future ? null : b.prod)) }, { label: "Consommation", tone: "battery", values: P.buckets.map((b) => b.cons) }] })
      : BZ.bars({ label: "Destination de la production", height: 220, labelEvery: every, unit: "kWh",
          buckets: P.buckets.map((b) => ({ ...b, tipTitle: P.kind === "mois" ? `${b.key} ${BZ.MONTHS_LONG[new Date().getMonth()]}` : b.key })),
          series: [
            { label: "Utilisé à la maison", tone: "solar", values: P.buckets.map((b) => (b.forecast ? b.prod : b.self)) },
            { label: "Stocké en batterie", tone: "battery", values: P.buckets.map((b) => (b.forecast ? 0 : b.chg)) },
            { label: "Revendu", tone: "grid", values: P.buckets.map((b) => (b.forecast ? 0 : b.exp)) },
          ] });

    // 2. D'où vient la consommation
    const origin = [{ label: "Soleil direct", v: T.self, tone: "solar" }, { label: "Batterie", v: T.dch, tone: "battery" }, { label: "Réseau", v: T.imp, tone: "grid" }];
    const tariffs = [{ label: "Heures pleines", v: T.hp, tone: "hp", k: "hp" }, { label: "Heures creuses", v: T.hc, tone: "hc", k: "hc" }, { label: "Super creuses", v: T.hsc, tone: "hsc", k: "hsc" }];
    const cost = tariffs.reduce((a, t) => a + t.v * BZ.TARIFS[t.k].price(), 0);

    // 3. Comparaison avec la période précédente
    const cmp = [
      ["Production", fmt.kwhText(T.prod), delta(T.prod, Q.prod)],
      ["Consommation", fmt.kwhText(T.cons), delta(T.cons, Q.cons, { invert: true })],
      ["Achat réseau", fmt.kwhText(T.imp), delta(T.imp, Q.imp, { invert: true })],
      ["Revente", fmt.kwhText(T.exp), delta(T.exp, Q.exp)],
      ["Autosuffisance", fmt.pct(autonomy), delta(autonomy, prevAut, { unit: "pts" })],
      ["Économies", fmt.eur(T.savings), delta(T.savings, Q.savings)],
    ];
    const best = real.filter((b) => b.prod > 0).sort((a, b) => b.prod - a.prod).slice(0, 3);
    const kpi = (label, value, d, tone) => h`<div class="kpi" data-tone="${tone}"><span>${label}</span><b>${value}</b>${d}</div>`;

    return h`
      <header class="page-h"><div><p class="eyebrow">Historique</p><h1>Bilan</h1><p class="lede">${P.title} · ${P.compare}</p></div>
        <div class="page-a">${segmented({ name: "period", label: "Période", value: P.kind, options: [["jour", "Jour"], ["semaine", "7 jours"], ["mois", "Mois"], ["annee", "Année"]] })}</div></header>

      <div class="kpis">
        ${kpi("Produit", val(fmt.kwh(T.prod)), delta(T.prod, Q.prod), "solar")}
        ${kpi("Consommé", val(fmt.kwh(T.cons)), delta(T.cons, Q.cons, { invert: true }), "battery")}
        ${kpi("Autosuffisance", val([fmt.n(autonomy * 100), "%"]), delta(autonomy, prevAut, { unit: "pts" }), "good")}
        ${kpi("Économisé", val([fmt.n(T.savings, T.savings >= 100 ? 0 : 2), "€"]), delta(T.savings, Q.savings), "good")}
      </div>

      <div class="layout layout-insights">
        ${card({ cls: "i-prod", title: isDay ? "Production et consommation" : "Où va ta production", sub: isDay ? "kWh par heure, tarifs sous l'axe" : P.forecastTotal > T.prod ? `Prévision ${fmt.kwhText(P.forecastTotal)} sur la période (hachuré)` : "kWh par jour", ic: "sun", tone: "solar",
          body: h`${isDay ? legend([["Production", "solar"], ["Consommation", "battery"]]) : legend([["Utilisé à la maison", "solar"], ["Stocké en batterie", "battery"], ["Revendu", "grid"], ...(P.forecastTotal > T.prod ? [["Prévision", "neutral"]] : [])])}${prodChart}` })}

        ${card({ cls: "i-orig", title: "D'où vient ta consommation", sub: `${fmt.kwhText(T.cons)} consommés`, ic: "leaf", tone: "good", body: h`
          ${BZ.split(origin)}
          <ul class="mix">${origin.map((o) => h`<li data-tone="${o.tone}"><i></i><span>${o.label}</span><em>${fmt.pct(o.v / (T.cons || 1))}</em><b>${fmt.kwhText(o.v)}</b></li>`)}</ul>
          <div class="sub-h"><strong>Réseau par tarif</strong><span>${fmt.eur(cost)} payés</span></div>
          ${BZ.split(tariffs)}
          ${legend(tariffs.map((t) => [BZ.TARIFS[t.k].short, t.tone, fmt.kwhText(t.v)]))}` })}

        ${card({ cls: "i-cmp", title: "Comparaison", sub: P.compare, ic: "refresh", tone: "neutral", body: h`
          <table class="table"><tbody>${cmp.map(([l, v, d]) => h`<tr><th scope="row">${l}</th><td>${v}</td><td>${d}</td></tr>`)}</tbody></table>` })}

        ${card({ cls: "i-best", title: "Meilleurs moments", sub: isDay ? "heures les plus productives" : "jours les plus productifs", ic: "sparkle", tone: "solar", body: best.length ? h`
          <ol class="rank">${best.map((b, i) => h`<li><span class="rank-n">${i + 1}</span><strong>${isDay ? b.key : P.kind === "annee" ? fmt.cap(b.key) : P.kind === "mois" ? `${b.key} ${BZ.MONTHS_LONG[new Date().getMonth()]}` : fmt.cap(b.key)}</strong>${meter({ value: (b.prod / best[0].prod) * 100, tone: "solar", size: "xs" })}<b>${fmt.kwhText(b.prod)}</b></li>`)}</ol>`
          : BZ.empty({ ic: "sun", title: "Pas encore de production", text: "Reviens après le lever du soleil." }) })}

        ${card({ cls: "i-roi", title: "Retour sur investissement", sub: "Depuis la mise en service · toutes périodes", ic: "euro", tone: "good", body: h`
          <div class="roi">
            <div class="big-v">${val([fmt.n(R.total), "€"])}<span class="big-s">sur ${fmt.eur(R.inv, 0)} investis</span></div>
            <div class="roi-track">${meter({ value: R.progress * 100, tone: "good", size: "lg", label: "Part remboursée" })}
              <div class="roi-ax"><span>${fmt.date(R.start, { month: "short", year: "numeric" })}</span><span>${fmt.n(R.progress * 100)} %</span><span>${fmt.date(R.payback, { month: "short", year: "numeric" })}</span></div></div>
            <div class="kv-3"><div><span>Par an</span><b>${fmt.eur(R.perYear, 0)}</b></div><div><span>Reste</span><b>${fmt.eur(R.remaining, 0)}</b></div><div><span>Amorti en</span><b>${fmt.n(R.totalYears, 1)} ans</b></div></div>
          </div>` })}
      </div>`;
  };
})();
