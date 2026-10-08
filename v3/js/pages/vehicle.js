// Voiture (V3) : Kia e-Niro.
// Hero inspiré des applis constructeurs (Tesla, Rivian, Volvo, evcc) : la voiture dessinée en SVG
// « posée » sur une seule barre de batterie (charge au branchement · ajouté pendant la session ·
// marge jusqu'à la limite), le pourcentage en très grand, quatre actions rondes.
// Puis les recharges de la période (indicateurs, origine par source, calendrier) et les réglages.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val, card, kpi, pills, delta, btn, toggle, stepper, meter, C, num, st, isOn, esc } = BZ;

  /* ─── Voiture en vue de profil (SVG en ligne, aucune image externe) ──
     Crossover compact tourné vers la droite ; la prise de la e-Niro est dans la calandre,
     le câble part donc du nez vers la borne. */
  const car = (charging, plugged) => h`
    <svg class="ve-car ${charging ? "is-charging" : ""}" viewBox="0 0 560 168" role="img" aria-label="Kia e-Niro${plugged ? ", branchée à la borne" : ""}">
      <defs>
        <linearGradient id="ve-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ve-b1"/><stop offset="1" class="ve-b2"/></linearGradient>
        <linearGradient id="ve-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="ve-g1"/><stop offset="1" class="ve-g2"/></linearGradient>
        <filter id="ve-blur" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      <ellipse class="ve-shadow" cx="246" cy="150" rx="214" ry="9" filter="url(#ve-blur)"/>
      ${plugged ? h`
        <g class="ve-box"><rect x="508" y="54" width="34" height="62" rx="9"/><rect class="ve-box-led" x="519" y="66" width="12" height="4" rx="2"/><path class="ve-box-foot" d="M525 116v30"/></g>
        <path class="ve-cable" d="M458 104 C 486 150, 506 150, 520 116"/>
        ${charging ? h`<path class="ve-flow" d="M458 104 C 486 150, 506 150, 520 116"/>` : ""}` : ""}
      <path class="ve-body" d="M34 120 C 29 101 33 84 43 71 L 60 46 C 72 36 92 34 122 33 L 288 32 C 311 32 326 38 341 48 L 372 66 C 401 70 430 74 446 82 C 457 88 462 99 460 111 L 457 122 L 418 123 A 34 34 0 0 0 350 123 L 120 123 A 34 34 0 0 0 52 123 Z"/>
      <path class="ve-clad" d="M120 123 L 350 123 L 350 115 L 120 115 Z"/>
      <path class="ve-rail" d="M100 30 L 286 28"/>
      <path class="ve-glass" d="M70 50 C 80 42 97 40 122 39 L 196 38 L 196 66 L 76 66 Z"/>
      <path class="ve-glass" d="M203 38 L 286 38 C 305 38 318 43 331 51 L 352 66 L 203 66 Z"/>
      <path class="ve-line" d="M199 70 L 199 116 M 300 70 L 302 116 M 168 80 h 14 M 270 80 h 14"/>
      <path class="ve-head" d="M436 84 L 455 92"/>
      <path class="ve-tail" d="M41 78 L 46 94"/>
      ${[86, 384].map((cx) => h`<g class="ve-wheel"><circle cx="${cx}" cy="124" r="27" class="ve-tyre"/><circle cx="${cx}" cy="124" r="17" class="ve-rim"/>
        <path class="ve-spoke" d="${[0, 72, 144, 216, 288].map((a) => { const r = (a * Math.PI) / 180; return `M${cx} 124 L${(cx + 15 * Math.cos(r)).toFixed(1)} ${(124 + 15 * Math.sin(r)).toFixed(1)}`; }).join(" ")}"/>
        <circle cx="${cx}" cy="124" r="4" class="ve-hub"/></g>`)}
    </svg>`;

  /* ─── Barre de batterie : une seule représentation de la charge ──── */
  function battery({ soc, lim, start, charging, kmFull }) {
    const low = soc <= 20, ticks = Array.from({ length: 9 }, (_, i) => (i + 1) * 10);
    return h`<div class="ve-bat ${charging ? "is-charging" : ""} ${low ? "is-low" : ""}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(soc)}"
        aria-label="Batterie ${fmt.n(soc)} %, limite de charge ${fmt.n(lim)} %${start < soc ? `, ${fmt.n(soc - start)} % ajoutés depuis le branchement` : ""}">
      <div class="ve-bat-t">
        <span class="ve-seg is-base" style="--a:0%;--b:${Math.min(start, soc)}%"></span>
        ${start < soc ? h`<span class="ve-seg is-add" style="--a:${start}%;--b:${soc}%"></span>` : ""}
        ${soc < lim ? h`<span class="ve-seg is-room" style="--a:${soc}%;--b:${lim}%"></span>` : ""}
        ${ticks.map((t) => h`<i class="ve-tick" style="--x:${t}%"></i>`)}
      </div>
      <b class="ve-lim" style="--x:${lim}%"><span>Limite ${fmt.n(lim)} %</span></b>
      <div class="ve-bat-ax"><span class="ve-ax-0">0 km</span><span class="ve-ax-lim" style="--x:${lim}%">${fmt.n(kmFull * lim / 100)} km à ${fmt.n(lim)} %</span><span class="ve-ax-max">${fmt.n(kmFull)} km</span></div>
    </div>`;
  }

  function hero() {
    const L = BZ.live(), soc = num(C.voiture_soc), lim = num(C.voiture_limite_pct), km = num(C.voiture_autonomie_km);
    const kmFull = soc > 0 ? km / (soc / 100) : 0, added = L.plugged ? num(C.session_soc) : 0, start = soc - added;
    const sol = num(C.session_sol_kwh), res = num(C.session_res_kwh), share = sol + res ? sol / (sol + res) : 0;
    const mins = num(C.voiture_minutes_restantes), fin = new Date(Date.now() + mins * 6e4);
    const locked = st(C.voiture_verrou) === "locked", armed = BZ.ui.armed === "unlock", clim = isOn(C.voiture_clim);
    const status = L.charging ? ["En charge", "ev", true] : L.plugged ? ["Branchée", "neutral"] : ["Débranchée", "neutral"];
    const meta = L.charging ? h`Fin vers <b>${fmt.time(fin)}</b> · encore ${mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")}` : `${mins} min`}`
      : L.plugged ? h`Branchée, en attente · limite ${fmt.n(lim)} %` : h`Débranchée · dernier trajet ${fmt.ago(st(C.voiture_dernier_trajet))}`;
    const action = ({ label, ic, act, on, disabled, pending, danger, aria }) => h`
      <button type="button" class="ve-act ${on ? "is-on" : ""} ${danger ? "is-danger" : ""}" data-act="${act}" ${disabled ? "disabled" : ""} ${pending ? 'aria-busy="true"' : ""} aria-label="${esc(aria || label)}" ${on != null ? `aria-pressed="${String(!!on)}"` : ""}>
        <span class="ve-act-i">${icon(ic)}</span><span class="ve-act-l">${label}</span></button>`;
    return h`<section class="card ve-hero ${L.charging ? "is-charging" : ""}" aria-label="État de la voiture">
      <div class="ve-hero-l">
        <div class="ve-status">${BZ.pill(L.charging ? `${status[0]} · ${fmt.powerText(L.car)}` : status[0], status[1], status[2])}
          ${L.plugged && sol + res > 0 ? BZ.pill(h`${icon("sun")}${fmt.n(share * 100)} % solaire`, "solar") : ""}</div>
        <div class="ve-soc">${val([fmt.n(soc), "%"])}</div>
        <p class="ve-range"><b>${fmt.n(km)} km</b> d'autonomie</p>
        <p class="ve-meta">${meta}</p>
        <div class="ve-acts">
          ${action({ label: armed ? "Confirmer" : locked ? "Verrouillée" : "Ouverte", ic: locked ? "lock" : "unlock", act: "car-lock", on: locked, danger: armed, pending: BZ.isPending(C.voiture_verrou), aria: armed ? "Confirmer le déverrouillage" : locked ? "Déverrouiller la voiture" : "Verrouiller la voiture" })}
          ${action({ label: "Climat", ic: "snow", act: "car-clim", on: clim, pending: BZ.isPending(C.voiture_clim), aria: clim ? "Arrêter la climatisation" : "Lancer la climatisation" })}
          ${action({ label: L.charging ? "Arrêter" : "Charger", ic: "bolt", act: "car-charge", on: L.charging, disabled: !L.plugged, pending: BZ.isPending(C.voiture_en_charge), aria: L.charging ? "Arrêter la recharge" : "Démarrer la recharge" })}
          ${action({ label: "Relevé", ic: "refresh", act: "car-refresh", pending: BZ.isPending(C.voiture_rafraichir), aria: "Demander un relevé à la voiture" })}
        </div>
      </div>
      <div class="ve-hero-r">
        ${car(L.charging, L.plugged)}
        ${battery({ soc, lim, start, charging: L.charging, kmFull })}
        <ul class="ve-chips">
          <li><span>Batterie 12 V</span><b>${fmt.n(num(C.voiture_12v_pct))} %</b></li>
          <li><span>Dernier trajet</span><b>${fmt.ago(st(C.voiture_dernier_trajet))}</b></li>
        </ul>
      </div>
    </section>`;
  }

  /* ─── Recharges de la période : chiffres, origine, calendrier ─────── */
  const GRID_MIX = { hsc: 0.62, hc: 0.23, hp: 0.15 };       // même répartition que core.chargeMix
  const costOf = (t) => { const g = Math.max(0, t.ev - t.evSun); return g * (GRID_MIX.hsc * num(C.tarif_hsc) + GRID_MIX.hc * num(C.tarif_hc) + GRID_MIX.hp * num(C.tarif_hp)); };

  function stats() {
    const kind = BZ.ui.carPeriod, P = BZ.period(kind), T = P.total, Q = P.prevTotal, real = P.buckets.filter((b) => !b.forecast);
    const conso = C.voiture_conso_kwh_100km || 16.5, ess = (C.essence_l_100km || 6.5) * (C.essence_prix_l || 1.85);
    const per100 = (t) => (t.ev ? (costOf(t) / t.ev) * conso : 0), saved = (t) => (ess - per100(t)) * (t.ev / conso);
    const share = (t) => (t.ev ? t.evSun / t.ev : 0);
    const vs = { semaine: "vs semaine d'avant", mois: "vs mois dernier", annee: `vs ${new Date().getFullYear() - 1}` }[kind];
    return { kind, P, T, Q, real, conso, ess, per100, saved, share, vs };
  }

  function kpis(S) {
    const { T, Q, real, per100, saved, share, vs, ess } = S;
    return h`<div class="kpis">
      ${kpi({ label: "Énergie rechargée", ic: "bolt", tone: "ev", value: val(fmt.kwh(T.ev)), delta: delta(T.ev, Q.ev), vs, spark: BZ.spark(real.map((b) => b.ev || 0), "ev") })}
      ${kpi({ label: "Part solaire", ic: "sun", tone: "solar", value: val([fmt.n(share(T) * 100), "%"]), delta: delta(share(T), share(Q), { unit: "pts" }), vs, spark: BZ.spark(real.map((b) => (b.ev ? b.evSun / b.ev : null)), "solar") })}
      ${kpi({ label: "Coût aux 100 km", ic: "euro", tone: "accent", value: val([fmt.n(per100(T), 2), "€"]), delta: delta(per100(T), per100(Q), { invert: true }), vs: `essence ${fmt.n(ess, 2)} €`, spark: BZ.spark(real.map((b) => (b.ev ? (costOf(b) / b.ev) * S.conso : null)), "accent") })}
      ${kpi({ label: "Économisé vs essence", ic: "leaf", tone: "good", value: val([fmt.n(saved(T), 0), "€"]), delta: delta(saved(T), saved(Q)), vs, spark: BZ.spark(real.map((b) => saved(b)), "good") })}
    </div>`;
  }

  function mixCard(S) {
    const M = BZ.chargeMix(S.kind), tot = M.kwh || 1;
    const rows = [["sol", "Soleil", "solar", "gratuit"], ["hsc", "Super creuses", "hsc", BZ.rangeLabel("hsc")], ["hc", "Heures creuses", "hc", BZ.rangeLabel("hc")], ["hp", "Heures pleines", "hp", BZ.rangeLabel("hp")]];
    return card({ cls: "ve-mix", title: "Origine des recharges", ic: "leaf", tone: "accent", aside: h`<span class="ve-total">${fmt.kwhText(M.kwh)} · ${fmt.eur(M.cost)}</span>`, body: h`
      ${BZ.split(rows.map(([k, l, tone]) => ({ label: l, v: M.mix[k], tone })), { label: rows.map(([k, l]) => `${l} ${Math.round((M.mix[k] / tot) * 100)} %`).join(", ") })}
      <ul class="ve-src">${rows.map(([k, l, tone, when]) => h`<li data-tone="${tone}"><i></i><span><strong>${l}</strong><small>${k === "sol" ? "panneaux" : `${when} · ${fmt.n(M.price[k], 4)} €/kWh`}</small></span>
        <em>${fmt.n((M.mix[k] / tot) * 100)} %</em><b>${fmt.kwhText(M.mix[k])}</b></li>`)}</ul>` });
  }

  function calendarCard() {
    // 4 semaines complètes + la semaine en cours, alignées du lundi au dimanche (5 rangées)
    const wd = (new Date().getDay() + 6) % 7, days = BZ.chargeDays(29 + wd), maxDay = Math.max(...days.map((d) => d.kwh), 1), pad = 0;
    const n = days.filter((d) => d.kwh).length;
    return card({ cls: "ve-cal", title: "Calendrier", sub: `${n} recharges depuis le ${fmt.date(days[0].date, { day: "numeric", month: "short" })}`, ic: "calendar", tone: "accent",
      aside: h`<div class="ve-cal-k" aria-label="Couleur : du réseau au soleil"><span>Réseau</span><span class="ve-grad" aria-hidden="true"></span><span>Soleil</span></div>`, body: h`
      <div class="ve-cal-g" role="grid" aria-label="Recharges des 5 dernières semaines">
        ${["L", "M", "M", "J", "V", "S", "D"].map((d) => h`<span class="ve-wd" aria-hidden="true">${d}</span>`)}
        ${Array.from({ length: pad }, () => h`<span class="ve-pad" aria-hidden="true"></span>`)}
        ${days.map((d, i) => h`<span class="ve-day ${d.kwh ? "" : "is-none"} ${i === days.length - 1 ? "is-today" : ""}" role="gridcell" style="--a:${(0.35 + 0.65 * (d.kwh / maxDay)).toFixed(2)};--s:${Math.round(d.sun * 100)}%"
          title="${fmt.cap(fmt.date(d.date, { weekday: "long", day: "numeric", month: "long" }))} : ${d.kwh ? `${fmt.kwhText(d.kwh)}, ${fmt.n(d.sun * 100)} % solaire` : "pas de recharge"}">${d.date.getDate()}</span>`)}
      </div>` });
  }

  // Cette charge : chronologie (branchement → maintenant → fin prévue) et origine soleil / réseau
  function sessionCard() {
    const L = BZ.live();
    if (!L.plugged) return card({ cls: "ve-sess", title: "Cette charge", ic: "bolt", tone: "ev", body: BZ.empty({ ic: "plug", title: "Voiture débranchée", text: "La prochaine recharge s'affichera ici dès le branchement." }) });
    const sol = num(C.session_sol_kwh), res = num(C.session_res_kwh), t = sol + res, soc = num(C.voiture_soc), added = num(C.session_soc);
    const startAt = new Date(st(C.session_debut)), fin = new Date(Date.now() + num(C.voiture_minutes_restantes) * 6e4), lim = num(C.voiture_limite_pct);
    return card({ cls: "ve-sess", title: "Cette charge", ic: "bolt", tone: "ev", aside: BZ.pill(`${fmt.n(t ? (sol / t) * 100 : 0)} % solaire`, "solar"), body: h`
      <div class="ve-sess-v">${val([`+${fmt.n(added)}`, "%"])}<span>${fmt.kwhText(t)} ajoutés<span class="ve-colon"> : </span><b data-tone="solar">${fmt.kwhText(sol)} soleil</b><span class="ve-colon"> · </span><b data-tone="grid">${fmt.kwhText(res)} réseau</b></span></div>
      ${BZ.split([{ label: "Soleil", v: sol, tone: "solar" }, { label: "Réseau", v: res, tone: "grid" }])}
      <ol class="ve-steps" aria-label="Déroulé de la recharge">
        <li class="is-done"><i></i><strong>Branchée</strong><small>${fmt.time(startAt)} · ${fmt.n(soc - added)} %</small></li>
        <li class="is-now"><i></i><strong>${L.charging ? "En charge" : "En attente"}</strong><small>maintenant · ${fmt.n(soc)} %</small></li>
        <li><i></i><strong>${L.charging ? "Fin prévue" : "Objectif"}</strong><small>${L.charging ? `${fmt.time(fin)} · ` : ""}${fmt.n(lim)} %</small></li>
      </ol>` });
  }

  function settingsCard() {
    const lim = num(C.voiture_limite_pct), dc = num(C.voiture_limite_dc_pct);
    const odo = num(C.voiture_odometre), last = num(C.entretien_dernier_km), next = last + C.entretien_intervalle_km, left = next - odo;
    return card({ cls: "ve-set", title: "Réglages et entretien", ic: "gauge", tone: "accent", body: h`<div class="rows">
      <div class="row"><div><strong>Limite à la maison</strong><span>recharge AC</span></div>${stepper({ value: fmt.n(lim), unit: " %", act: "car-lim", label: "Limite AC", cur: lim, min: 50, max: 100, pending: BZ.isPending(C.voiture_limite_pct) })}</div>
      <div class="row"><div><strong>Recharge rapide</strong><span>limite DC</span></div>${stepper({ value: fmt.n(dc), unit: " %", act: "car-limdc", label: "Limite DC", cur: dc, min: 50, max: 100, pending: BZ.isPending(C.voiture_limite_dc_pct) })}</div>
      <div class="row"><div><strong>Heures creuses seulement</strong><span>ne charge qu'en HC et HSC</span></div>${toggle({ on: isOn(C.voiture_heures_creuses), act: "toggle", args: { entity: C.voiture_heures_creuses }, label: "Heures creuses seulement", pending: BZ.isPending(C.voiture_heures_creuses) })}</div>
      <div class="row"><div><strong>Charge programmée</strong><span>horaire réglé dans la voiture</span></div>${toggle({ on: isOn(C.voiture_programmee), act: "toggle", args: { entity: C.voiture_programmee }, label: "Charge programmée", pending: BZ.isPending(C.voiture_programmee) })}</div>
      <div class="row ve-care"><div><strong>Révision</strong><span>${left >= 0 ? `dans ${fmt.n(left)} km · à ${fmt.n(next)} km` : `${fmt.n(-left)} km de retard`}</span>${meter({ value: ((odo - last) / C.entretien_intervalle_km) * 100, tone: left < 1000 ? "warn" : "ev", size: "xs", label: "Avancement jusqu'à la révision" })}</div>
        ${btn({ label: "Révision faite", ic: "check", act: "car-service", size: "sm", kind: "secondary" })}</div>
    </div>` });
  }

  BZ.pages.vehicle = () => {
    const S = stats();
    return h`
      <header class="ph">
        <div><p class="ph-hi">Relevé ${fmt.ago(st(C.voiture_maj))}</p><h1>Kia e-Niro</h1><p class="ph-sub">${fmt.n(num(C.voiture_odometre))} km au compteur · batterie de ${fmt.n(C.voiture_capacite_kwh)} kWh</p></div>
        <div class="ph-a">${pills({ name: "carPeriod", label: "Période des recharges", value: S.kind, options: [["semaine", "7 jours"], ["mois", "Mois"], ["annee", "Année"]] })}</div>
      </header>
      ${kpis(S)}
      <div class="layout ve-grid">
        <div class="col ve-l">${hero()}<div class="ve-pair">${mixCard(S)}${calendarCard()}</div></div>
        <div class="col ve-r">${sessionCard()}${settingsCard()}</div>
      </div>`;
  };
})();
