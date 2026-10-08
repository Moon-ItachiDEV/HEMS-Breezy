// Énergie (V3) : le temps réel en détail, sans répéter l'Aperçu.
//  En-tête : phrase d'état en direct | surplus disponible + « Chauffer le ballon »
//  Ligne 1 : production, batterie, réseau (compteur L3), tarif en cours
//  Gauche  : schéma des flux (soleil → maison → batterie, réseau, e-Niro), puis Onduleurs + Production du jour
//  Droite  : Batterie SolarFlow (packs, rendement, réglages), Tarifs du jour (ruban 24 h)
(() => {
  const BZ = window.BZ;
  const { h, esc, fmt, icon, val, card, pill, kpi, btn, meter, ring, stepper, C, num } = BZ;

  // Puissance maximale de chaque onduleur, lue dans son nom (« Izy 2 000 W »)
  const caps = () => C.onduleurs_noms.map((n, i) => parseInt(String(n).replace(/\D/g, ""), 10) || [2000, 2000, 1000][i] || 1000);
  const nowH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  const hm = (t) => `${String(Math.floor(t) % 24).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}`;
  // Variation colorée sans flèche de tendance (état, pas évolution)
  const tag = (text, tone, ic) => h`<span class="delta en-d" data-tone="${tone}">${ic ? icon(ic) : ""}${text}</span>`;

  /* ─── En-tête ─────────────────────────────────────────────────────── */
  function header(L) {
    const sun = L.solar > 30 ? `Les panneaux produisent ${fmt.powerText(L.solar)}` : "Les panneaux ne produisent pas";
    const bat = Math.abs(L.bat) < 15 ? "la batterie est en veille" : L.bat > 0 ? `la batterie charge à ${fmt.powerText(L.bat)}` : `la batterie rend ${fmt.powerText(-L.bat)}`;
    const grid = L.grid < -15 ? `tu revends ${fmt.powerText(-L.grid)}` : L.grid > 15 ? `tu achètes ${fmt.powerText(L.grid)}` : "rien ne passe par le réseau";
    const boost = num(C.ballon_boost) === 1, surplus = -L.grid;
    const live = boost ? { tone: "heat", label: "Ballon en chauffe", v: `${fmt.n(num(C.ballon_temp))} °C`, on: true }
      : surplus > 15 ? { tone: "grid", label: "Surplus", v: fmt.powerText(surplus), on: true }
      : { tone: "neutral", label: "Pas de surplus", v: "", on: false };
    return h`<header class="ph">
      <div><p class="ph-hi">Temps réel</p><h1>Énergie</h1><p class="ph-sub">${sun}, ${bat} et ${grid}.</p></div>
      <div class="ph-a">
        <span class="en-live" data-tone="${live.tone}" role="status"><i class="${live.on ? "is-on" : ""}"></i><span>${live.label}</span>${live.v ? h`<b>${live.v}</b>` : ""}</span>
        ${btn({ label: boost ? "Arrêter la chauffe" : "Chauffer le ballon", ic: boost ? "x" : "drop", act: "boiler-boost", kind: "primary", pending: BZ.isPending(C.ballon_boost) })}
      </div></header>`;
  }

  /* ─── Indicateurs ─────────────────────────────────────────────────── */
  function kpis(L) {
    const T = BZ.today(), hrs = BZ.hours(), cur = Math.floor(nowH());
    // Production : courbe heure par heure jusqu'à maintenant (valeur en direct au bout)
    const prodSpark = cur >= 1 ? hrs.map((x) => (x.h < cur ? x.prod : x.h === cur ? L.solar / 1000 : null)) : hrs.map((x) => x.prod);
    const expected = hrs[cur] ? hrs[cur].prod : 0;
    const prodD = expected > 0.1 && L.solar > 30 ? BZ.delta(L.solar / 1000, expected) : "";
    // Batterie : état en direct ; courbe = énergie stockée chaque jour (7 j)
    const soc = num(C.batterie_soc), week = BZ.dayView(0).week;
    const batD = Math.abs(L.bat) < 15 ? tag("En veille", "neutral") : L.bat > 0 ? tag(fmt.powerText(L.bat), "battery", "up") : tag(fmt.powerText(-L.bat), "warn", "down");
    // Réseau : même convention que le compteur (− revente, + achat)
    const g = L.grid, exp = g < -15, imp = g > 15, [gv, gu] = fmt.power(Math.abs(g));
    // Tarif : profil de prix de la journée
    const t = BZ.tariffNow(), prices = BZ.tariffHours().flatMap((k) => { const p = BZ.TARIFS[k].price(); return [p, p]; });
    return h`<div class="kpis">
      ${kpi({ label: "Production", ic: "sun", tone: "solar", value: val(fmt.power(L.solar)), delta: prodD, vs: prodD ? "vs prévu à cette heure" : `${fmt.kwhText(T.prod)} aujourd'hui`, spark: BZ.spark(prodSpark, "solar"), to: "insights" })}
      ${kpi({ label: "Batterie SolarFlow", ic: "battery", tone: "battery", value: val([fmt.n(soc), "%"]), delta: batD, vs: Math.abs(L.bat) < 15 ? "" : L.bat > 0 ? "en charge" : "en décharge", spark: BZ.spark(week.map((d) => d.chg), "battery") })}
      ${kpi({ label: "Réseau · compteur L3", ic: "grid", tone: imp ? "bad" : "grid", value: h`<span class="en-gv ${exp ? "is-good" : imp ? "is-bad" : ""}">${val([`${exp ? "−" : imp ? "+" : ""}${gv}`, gu])}</span>`,
        delta: tag(fmt.kwhText(exp || !imp ? T.exp : T.imp), exp || !imp ? "good" : "bad"), vs: exp || !imp ? "revendus aujourd'hui" : "achetés aujourd'hui", spark: BZ.spark(week.map((d) => d.exp), imp ? "bad" : "grid"), to: "insights" })}
      ${kpi({ label: "Tarif en cours", ic: "clock", tone: t.key, value: val([fmt.n(t.price, 4), "€/kWh"]), delta: tag(t.short, t.key), vs: `jusqu'à ${fmt.time(t.changeAt)}`, spark: BZ.spark(prices, t.key) })}
    </div>`;
  }

  /* ─── Flux en direct (schéma partagé, voiture comprise) ───────────── */
  function flowCard(L) {
    // Part de ce qui est consommé maintenant sans passer par le réseau
    const need = L.house + L.car, auto = need > 0 ? BZ.clamp(1 - Math.max(0, L.grid) / need, 0, 1) : 1;
    return card({ cls: "en-flow", title: "Flux en direct", ic: "energy", tone: "accent",
      aside: pill(`Autonome à ${fmt.n(auto * 100)} %`, auto > 0.95 ? "good" : auto > 0.5 ? "warn" : "bad", true),
      link: { label: "Historique", to: "insights" },
      body: BZ.flow() });
  }

  /* ─── Onduleurs ───────────────────────────────────────────────────── */
  function invCard() {
    const K = caps(), ws = C.onduleurs_w.map((id) => Math.max(0, num(id) || 0)), tot = ws.reduce((a, b) => a + b, 0);
    return card({ cls: "en-inv", title: "Onduleurs", ic: "sun", tone: "accent", aside: h`<span class="en-note">${fmt.n(K.reduce((a, b) => a + b, 0) / 1000, 0)} kW installés</span>`, body: h`
      <ul class="plist en-inv-l">${C.onduleurs_noms.map((name, i) => {
        const w = ws[i], load = BZ.clamp((w / K[i]) * 100, 0, 100);
        return h`<li><div class="plist-r">
          <span class="dt-ic" data-tone="solar">${icon("sun")}</span>
          <span><strong>${esc(name)}</strong><small>${fmt.powerText(w)} · ${fmt.n(tot ? (w / tot) * 100 : 0)} % du total</small></span>
          ${w > 30 ? pill("Produit", "good", true) : pill("En veille", "neutral")}
          <span class="plist-p"><span>${fmt.n(load)} %</span>${meter({ value: load, tone: "solar", size: "xs", label: `${name} à ${fmt.n(load)} % de sa puissance` })}</span>
        </div></li>`;
      })}</ul>` });
  }

  /* ─── Production du jour : heure par heure, prévision, tarifs ─────── */
  function dayCard() {
    const hrs = BZ.hours(), T = BZ.today(), H = nowH(), cur = Math.floor(H);
    const chart = BZ.lines({
      labels: hrs.map((x) => x.label),
      series: [
        { label: "Production", tone: "solar", area: true, values: hrs.map((x) => (x.h <= cur ? x.prod : null)) },
        { label: "Prévision", tone: "solar", dashed: true, values: hrs.map((x) => (x.h >= cur ? x.prod : null)) },
        { label: "Consommation", tone: "neutral", values: hrs.map((x) => x.cons) },
      ],
      unit: "kWh", dec: 2, height: 170, labelEvery: 6, band: BZ.tariffHours(), now: H,
      label: "Production et consommation heure par heure aujourd'hui, avec la prévision et les tarifs",
    });
    return card({ cls: "en-day", title: "Production du jour", ic: "chart", tone: "accent",
      aside: h`<span class="en-note"><b>${fmt.n(T.prod, 1)}</b> / ${fmt.kwhText(T.forecast)} prévus</span>`, body: h`
      <div class="en-chart">${chart}</div>
      <ul class="en-lg" aria-hidden="true"><li data-tone="solar"><i></i>Production</li><li data-tone="solar" class="is-fc"><i></i>Prévision</li><li data-tone="neutral"><i></i>Consommation</li><li class="en-lg-t"><i></i>Tarif</li></ul>` });
  }

  /* ─── Batterie SolarFlow ──────────────────────────────────────────── */
  function batCard(L) {
    const soc = num(C.batterie_soc), min = num(C.batterie_min_pct), max = num(C.batterie_max_pct);
    const tin = num(C.batterie_total_charge_kwh), tout = num(C.batterie_total_decharge_kwh), eff = tin ? tout / tin : 0;
    const state = Math.abs(L.bat) < 15 ? pill("En veille", "neutral") : L.bat > 0 ? pill("Charge", "battery", true) : pill("Décharge", "warn", true);
    return card({ cls: "en-bat", title: "Batterie SolarFlow", ic: "battery", tone: "accent", aside: state, body: h`
      <div class="en-bat-top">
        ${ring({ value: soc, tone: "battery", size: 112, stroke: 10, mark: min, label: `Batterie à ${fmt.n(soc)} %, réserve à ${fmt.n(min)} %`,
          inner: h`<b>${fmt.n(soc)}<small>%</small></b><span>${fmt.kwhText(num(C.batterie_dispo_kwh))}</span>` })}
        <ul class="en-packs">${C.packs_soc.map((id, i) => h`<li>
          <span><b>Pack ${i + 1}</b><small>${fmt.n(num(C.packs_temp[i]))} °C · ${fmt.powerText(Math.abs(num(C.packs_w[i])))}</small></span>
          ${meter({ value: num(id), tone: "battery", size: "xs", label: `Pack ${i + 1} à ${fmt.n(num(id))} %` })}<em>${fmt.n(num(id))} %</em></li>`)}</ul>
      </div>
      <div class="en-kv">
        <div><span>Stocké auj.</span><b>${val(fmt.kwh(num(C.batterie_charge_jour_kwh)))}</b></div>
        <div><span>Rendu auj.</span><b>${val(fmt.kwh(num(C.batterie_decharge_jour_kwh)))}</b></div>
        <div><span>Rendement</span><b>${val([fmt.n(eff * 100, 1), "%"])}</b></div>
      </div>
      <div class="en-set">
        <div><span>Réserve minimale</span>${stepper({ value: fmt.n(min), unit: " %", act: "bat-min", label: "Réserve minimale", cur: min, min: 0, max: 50, pending: BZ.isPending(C.batterie_min_pct) })}</div>
        <div><span>Charge maximale</span>${stepper({ value: fmt.n(max), unit: " %", act: "bat-max", label: "Charge maximale", cur: max, min: 70, max: 100, pending: BZ.isPending(C.batterie_max_pct) })}</div>
      </div>
      <p class="foot en-bat-f"><span>Depuis l'installation</span><span>${fmt.n(tin)} kWh stockés · ${fmt.n(tout)} kWh rendus</span></p>` });
  }

  /* ─── Tarifs du jour : ruban 24 h + prix ──────────────────────────── */
  function tariffCard() {
    const t = BZ.tariffNow(), hours = BZ.tariffHours(), H = nowH(), T = BZ.TARIFS, hp = T.hp.price();
    // Prochaine plage super creuse (ou fin de celle en cours)
    let hscIn = null; for (let k = 1; k <= 24; k++) if (BZ.tariffAt((Math.floor(H) + k) % 24) === "hsc" && BZ.tariffAt((Math.floor(H) + k - 1) % 24) !== "hsc") { hscIn = Math.floor(H) + k - H; break; }
    const dur = (x) => { const m = Math.round(x * 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
    const runs = []; hours.forEach((k, i) => (runs.length && runs[runs.length - 1].k === k ? runs[runs.length - 1].n++ : runs.push({ k, s: i, n: 1 })));
    const aria = `Tarifs de la journée : ${runs.map((r) => `${T[r.k].short} de ${r.s} h à ${r.s + r.n} h`).join(", ")}.`;
    return card({ cls: "en-tar", title: "Tarifs du jour", ic: "clock", tone: "accent", aside: h`<span class="en-note">€ / kWh</span>`, body: h`
      <div class="en-rib-w">
        <div class="en-rib" role="img" aria-label="${aria}">${hours.map((k, i) => h`<i data-tariff="${k}" class="${i + 1 <= H ? "is-past" : ""}"></i>`)}<b style="--x:${((H / 24) * 100).toFixed(2)}%"></b></div>
        <div class="en-rib-ax" aria-hidden="true"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
      </div>
      <ul class="en-tl">${["hp", "hc", "hsc"].map((k) => {
        const p = T[k].price(), cur = k === t.key, next = k === t.nextKey;
        return h`<li data-tone="${k}" class="${cur ? "is-cur" : ""}"><i></i>
          <span><strong>${T[k].label}</strong><small>${BZ.rangeLabel(k)}${cur ? h` · <em>jusqu'à ${fmt.time(t.changeAt)}</em>` : next ? ` · dès ${fmt.time(t.changeAt)}` : ""}</small></span>
          <span class="en-tl-v"><b>${fmt.n(p, 4)} €</b><small>${k === "hp" ? "référence" : `−${fmt.n((1 - p / hp) * 100)} % vs HP`}</small></span></li>`;
      })}</ul>
      <p class="foot en-tar-f">${t.key === "hsc" ? h`<span>Super creuses en cours</span><span>jusqu'à ${fmt.time(t.changeAt)}</span>`
        : hscIn != null ? h`<span>Prochaines super creuses</span><span>à ${hm(H + hscIn)} · dans ${dur(hscIn)}</span>` : ""}</p>` });
  }

  BZ.pages.energy = () => {
    const L = BZ.live();
    return h`${header(L)}${kpis(L)}
      <div class="layout en-grid">
        <div class="col en-l">${flowCard(L)}<div class="en-pair">${invCard()}${dayCard()}</div></div>
        <div class="col en-r">${batCard(L)}${tariffCard()}</div>
      </div>`;
  };
})();
