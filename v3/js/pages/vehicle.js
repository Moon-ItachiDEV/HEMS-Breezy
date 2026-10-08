// Voiture (V3) : Kia e-Niro.
// Hero inspiré des applis constructeurs (Tesla, Rivian, Volvo, evcc) : la voiture « posée » sur une seule
// barre de batterie (violet foncé = au branchement, violet = ajouté), repère du niveau actuel et drapeau de
// limite, déroulé de la charge, quatre actions rondes. Puis les recharges de la période et les réglages.
// Chaque information n'apparaît qu'une fois sur la page.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val, card, kpi, pills, delta, btn, toggle, stepper, meter, C, num, st, isOn, esc, clamp } = BZ;

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

  /* ─── État de la recharge (une seule source de vérité pour le hero) ── */
  function chargeState() {
    const L = BZ.live(), soc = num(C.voiture_soc), lim = num(C.voiture_limite_pct), km = num(C.voiture_autonomie_km);
    const added = L.plugged ? clamp(num(C.session_soc), 0, soc) : 0, start = clamp(soc - added, 0, soc);
    const sol = num(C.session_sol_kwh), res = num(C.session_res_kwh), kwh = sol + res;
    const mins = num(C.voiture_minutes_restantes), fin = new Date(Date.now() + mins * 6e4);
    const full = L.plugged && soc >= lim, t = BZ.tariffNow(), offPeak = isOn(C.voiture_heures_creuses), scheduled = isOn(C.voiture_programmee);
    let state, tone, why;
    if (L.charging) { state = "En charge"; tone = "ev"; why = null; }
    else if (full) { state = "Charge terminée"; tone = "good"; why = `limite de ${fmt.n(lim)} % atteinte`; }
    else if (L.plugged && offPeak && t.key === "hp") { state = "En attente"; tone = "hc"; why = `heures creuses à ${fmt.time(t.changeAt)}`; }
    else if (L.plugged && scheduled) { state = "En attente"; tone = "hc"; why = "charge programmée dans la voiture"; }
    else if (L.plugged) { state = "Branchée"; tone = "neutral"; why = "prête à charger"; }
    else { state = "Débranchée"; tone = "neutral"; why = null; }
    // km par % : estimation de la voiture si la batterie n'est pas presque vide, sinon capacité / consommation
    const kmPerPct = soc >= 15 && km > 0 ? clamp(km / soc, 2.5, 7) : (C.voiture_capacite_kwh / (C.voiture_conso_kwh_100km || 16.5));
    return { L, soc, lim, km, added, start, sol, res, kwh, mins, fin, full, state, tone, why, kmPerPct };
  }
  const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`);

  /* ─── Barre de batterie : remplissage unique + repère + drapeau de limite ── */
  function battery(S) {
    const { soc, lim, start, L } = S, low = soc <= 20;
    return h`<div class="ve-bat ${L.charging ? "is-charging" : ""} ${low ? "is-low" : ""}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(soc)}"
        aria-label="Batterie ${fmt.n(soc)} %, ${fmt.n(S.km)} km d'autonomie, limite ${fmt.n(lim)} %${S.added ? `, ${fmt.n(S.added)} % ajoutés depuis le branchement` : ""}">
      <div class="ve-bat-t">
        <span class="ve-seg is-base" style="--a:0%;--b:${start}%"></span>
        ${S.added ? h`<span class="ve-seg is-add" style="--a:${start}%;--b:${soc}%"></span>` : ""}
        ${soc < lim ? h`<span class="ve-seg is-room" style="--a:${soc}%;--b:${lim}%"></span>` : ""}
      </div>
      <b class="ve-lim" style="--x:${lim}%"><span>${fmt.n(lim)} %</span></b>
      <span class="ve-knob" style="--x:${soc}%"><span>${fmt.n(soc)} % · ${fmt.n(S.km)} km</span></span>
    </div>`;
  }

  // Déroulé de la charge (sous la barre) ; débranchée : la dernière recharge
  function timeline(S) {
    if (!S.L.plugged) {
      const last = BZ.chargeDays(14).filter((d) => d.kwh).pop();
      if (!last) return "";
      const d = last.date.toDateString(), when = d === new Date().toDateString() ? "aujourd'hui" : d === new Date(Date.now() - 864e5).toDateString() ? "hier" : fmt.date(last.date, { weekday: "long", day: "numeric", month: "long" });
      return h`<p class="ve-last">${icon("clock")}Dernière recharge ${when} · <b>${fmt.kwhText(last.kwh)}</b>, ${fmt.n(last.sun * 100)} % solaire</p>`;
    }
    const startAt = new Date(st(C.session_debut)), share = S.kwh ? S.sol / S.kwh : 0;
    const endKm = S.kmPerPct * S.lim;
    return h`<ol class="ve-steps" aria-label="Déroulé de la recharge">
      <li class="is-done"><i></i><strong>Branchée à ${fmt.time(startAt)}</strong><small>${fmt.n(S.start)} %</small></li>
      <li class="is-now"><i></i><strong>+${fmt.n(S.added)} % · ${fmt.kwhText(S.kwh)}</strong><small><span data-tone="solar">${fmt.n(share * 100)} % soleil</span> · ${fmt.kwhText(S.res)} réseau</small></li>
      <li><i></i><strong>${S.L.charging ? `Fin vers ${fmt.time(S.fin)}` : S.full ? "Terminée" : "Objectif"}</strong><small>${fmt.n(S.lim)} % · ≈ ${fmt.n(endKm)} km</small></li>
    </ol>`;
  }

  function hero() {
    const S = chargeState(), { L } = S;
    const locked = st(C.voiture_verrou) === "locked", armed = BZ.ui.armed === "unlock", clim = isOn(C.voiture_clim);
    const meta = L.charging ? h`Encore <b>${dur(S.mins)}</b> à ${fmt.powerText(L.car)}` : S.why ? fmt.cap(S.why) : h`Dernier trajet <b>${fmt.ago(st(C.voiture_dernier_trajet))}</b>`;
    const action = ({ label, ic, act, tone, on, disabled, pending, aria, title }) => h`
      <button type="button" class="ve-act" data-tone="${tone}" data-act="${act}" ${on != null ? `aria-pressed="${String(!!on)}"` : ""} ${disabled ? "disabled" : ""} ${pending ? 'aria-busy="true"' : ""} aria-label="${esc(aria)}" title="${esc(title || aria)}">
        <span class="ve-act-i">${icon(ic)}</span><span class="ve-act-l">${label}</span></button>`;
    return h`<section class="card ve-hero ${L.charging ? "is-charging" : ""}" aria-label="État de la voiture">
      <div class="ve-hero-l">
        <div class="ve-status">${BZ.pill(S.state, S.tone, L.charging)}</div>
        <div class="ve-soc ${S.soc <= 20 ? "is-low" : ""}">${val([fmt.n(S.soc), "%"])}</div>
        <p class="ve-range"><b>${fmt.n(S.km)} km</b> d'autonomie</p>
        <p class="ve-meta">${meta}</p>
        <div class="ve-acts">
          ${action({ label: armed ? "Confirmer" : "Verrou", ic: locked ? "lock" : "unlock", act: "car-lock", tone: armed ? "bad" : locked ? "good" : "warn", on: locked, pending: BZ.isPending(C.voiture_verrou),
            aria: armed ? "Confirmer le déverrouillage" : "Verrou des portes", title: armed ? "Appuie encore pour déverrouiller" : locked ? "Verrouillée · appuie deux fois pour ouvrir" : "Déverrouillée · appuie pour verrouiller" })}
          ${action({ label: "Climat", ic: "snow", act: "car-clim", tone: "battery", on: clim, pending: BZ.isPending(C.voiture_clim), aria: "Climatisation", title: clim ? "Climatisation en marche" : "Lancer la climatisation" })}
          ${action({ label: "Recharge", ic: "bolt", act: "car-charge", tone: "ev", on: L.charging, disabled: !L.plugged || (S.full && !L.charging), pending: BZ.isPending(C.voiture_en_charge),
            aria: "Recharge", title: !L.plugged ? "Branche la voiture pour charger" : S.full ? "Limite atteinte" : L.charging ? "Arrêter la recharge" : "Démarrer la recharge" })}
          ${action({ label: "Actualiser", ic: "refresh", act: "car-refresh", tone: "neutral", pending: BZ.isPending(C.voiture_rafraichir), aria: "Demander un relevé à la voiture" })}
        </div>
      </div>
      <div class="ve-hero-r">
        ${car(L.charging, L.plugged)}
        ${battery(S)}
        ${timeline(S)}
        <ul class="ve-chips">
          <li><span>Batterie 12 V</span><b>${fmt.n(num(C.voiture_12v_pct))} %</b></li>
          ${L.plugged ? h`<li><span>Dernier trajet</span><b>${fmt.ago(st(C.voiture_dernier_trajet))}</b></li>` : ""}
        </ul>
      </div>
    </section>`;
  }

  /* ─── Recharges de la période ───────────────────────────────────────── */
  const gridMix = () => (isOn(C.voiture_heures_creuses) ? { hsc: 0.72, hc: 0.28, hp: 0 } : { hsc: 0.62, hc: 0.23, hp: 0.15 });   // même règle que core.chargeMix
  const costOf = (t) => { const g = Math.max(0, (t.ev || 0) - (t.evSun || 0)), m = gridMix(); return g * (m.hsc * num(C.tarif_hsc) + m.hc * num(C.tarif_hc) + m.hp * num(C.tarif_hp)); };

  function stats() {
    const kind = BZ.ui.carPeriod, P = BZ.period(kind), T = P.total, Q = P.prevTotal, real = P.buckets.filter((b) => !b.forecast);
    const conso = C.voiture_conso_kwh_100km || 16.5, ess = (C.essence_l_100km || 6.5) * (C.essence_prix_l || 1.85);
    const per100 = (t) => (t.ev ? (costOf(t) / t.ev) * conso : 0), saved = (t) => (ess - per100(t)) * ((t.ev || 0) / conso);
    const share = (t) => (t.ev ? t.evSun / t.ev : 0);
    const m = new Date().getMonth();
    const vs = { semaine: "vs 7 j avant", mois: `vs ${BZ.MONTHS[(m + 11) % 12]} à date`, annee: `vs ${new Date().getFullYear() - 1} à date` }[kind];
    // Cumuls (courbes lisibles : pas de dents de scie entre jours avec et sans recharge)
    let e = 0, s = 0, c = 0;
    const cum = real.map((b) => { e += b.ev || 0; s += b.evSun || 0; c += costOf(b); return { e, share: e ? s / e : null, per100: e ? (c / e) * conso : null }; });
    return { kind, P, T, Q, real, conso, ess, per100, saved, share, vs, cum };
  }

  function kpis(S) {
    const { T, Q, per100, saved, share, vs, ess, cum } = S;
    return h`<div class="kpis">
      ${kpi({ label: "Énergie rechargée", ic: "bolt", tone: "ev", value: val(fmt.kwh(T.ev)), delta: delta(T.ev, Q.ev), vs, spark: BZ.spark(cum.map((x) => x.e), "ev") })}
      ${kpi({ label: "Part solaire", ic: "sun", tone: "solar", value: val([fmt.n(share(T) * 100), "%"]), delta: delta(share(T), share(Q), { unit: "pts" }), vs, spark: BZ.spark(cum.map((x) => x.share), "solar") })}
      ${kpi({ label: "Coût aux 100 km", ic: "euro", tone: "accent", value: val([fmt.n(per100(T), 2), "€"]), delta: delta(per100(T), per100(Q), { invert: true }), vs, spark: BZ.spark(cum.map((x) => x.per100), "accent") })}
      ${kpi({ label: "Économisé vs essence", ic: "leaf", tone: "good", value: val([fmt.n(saved(T), 0), "€"]), delta: "", vs: `essence : ${fmt.n(ess, 2)} € / 100 km`, spark: BZ.spark(cum.map((x, i) => saved({ ev: x.e, evSun: S.real.slice(0, i + 1).reduce((a, b) => a + (b.evSun || 0), 0) })), "good") })}
    </div>`;
  }

  function mixCard(S) {
    const M = BZ.chargeMix(S.kind), offPeak = isOn(C.voiture_heures_creuses);
    const rows = [["sol", "Soleil", "solar", "panneaux"], ["hsc", "Super creuses", "hsc", BZ.rangeLabel("hsc")], ["hc", "Heures creuses", "hc", BZ.rangeLabel("hc")], ["hp", "Heures pleines", "hp", BZ.rangeLabel("hp")]];
    return card({ cls: "ve-mix", title: "Par source", ic: "leaf", tone: "accent", aside: h`<span class="ve-total">${fmt.eur(M.cost)} payés</span>`, body: h`
      ${BZ.split(rows.map(([k, l, tone]) => ({ label: l, v: M.mix[k], tone })), { label: rows.map(([k, l]) => `${l} ${fmt.kwhText(M.mix[k])}`).join(", ") })}
      <ul class="ve-src">${rows.map(([k, l, tone, when]) => h`<li data-tone="${tone}" class="${!M.mix[k] ? "is-zero" : ""}"><i></i>
        <span><strong>${l}</strong><small>${k === "sol" ? "gratuit" : `${when} · ${fmt.n(M.price[k], 4)} €`}${k === "hp" && offPeak ? " · exclues" : ""}</small></span>
        <b>${fmt.kwhText(M.mix[k])}</b><em>${k === "sol" ? "0 €" : fmt.eur(M.mix[k] * M.price[k])}</em></li>`)}</ul>` });
  }

  function calendarCard() {
    // 4 semaines complètes + la semaine en cours, du lundi au dimanche (5 rangées)
    const wd = (new Date().getDay() + 6) % 7, days = BZ.chargeDays(29 + wd), maxDay = Math.max(...days.map((d) => d.kwh), 1);
    const n = days.filter((d) => d.kwh).length, sel = BZ.ui.calSel != null && days[BZ.ui.calSel] ? BZ.ui.calSel : days.length - 1, d = days[sel];
    const lab = (x) => fmt.cap(fmt.date(x.date, { weekday: "long", day: "numeric", month: "long" }));
    return card({ cls: "ve-cal", title: "Jours de recharge", ic: "calendar", tone: "accent", aside: h`<span class="ve-total">${n} en 5 semaines</span>`, body: h`
      <div class="ve-cal-g">
        ${["L", "M", "M", "J", "V", "S", "D"].map((x) => h`<span class="ve-wd" aria-hidden="true">${x}</span>`)}
        ${days.map((x, i) => h`<button type="button" class="ve-day ${x.kwh ? "" : "is-none"} ${i === days.length - 1 ? "is-today" : ""} ${i === sel ? "is-sel" : ""}" data-act="set" data-k="calSel" data-value="${i}"
          style="--a:${(0.25 + 0.75 * (x.kwh / maxDay)).toFixed(2)};--s:${Math.round(x.sun * 100)}%" aria-pressed="${String(i === sel)}"
          aria-label="${esc(`${lab(x)} : ${x.kwh ? `${fmt.kwhText(x.kwh)}, ${fmt.n(x.sun * 100)} % solaire` : "pas de recharge"}`)}">${x.date.getDate()}</button>`)}
      </div>
      <p class="ve-cal-d" aria-live="polite"><b>${lab(d)}</b>${d.kwh ? h` · ${fmt.kwhText(d.kwh)} · <span data-tone="solar">${fmt.n(d.sun * 100)} % soleil</span>` : " · pas de recharge"}</p>` });
  }

  // Dernières recharges (motif « Recent projects ») : date, énergie, part solaire, coût
  function recentCard() {
    const S = chargeState(), list = BZ.chargeDays(21).filter((d) => d.kwh).reverse().slice(0, 4);
    const today = new Date().toDateString();
    if (S.L.plugged) list[0] && list[0].date.toDateString() === today ? (list[0] = { date: new Date(), kwh: S.kwh, sun: S.kwh ? S.sol / S.kwh : 0, live: S.L.charging }) : list.unshift({ date: new Date(), kwh: S.kwh, sun: S.kwh ? S.sol / S.kwh : 0, live: S.L.charging });
    const rows = list.slice(0, 4);
    const when = (d) => (d.toDateString() === today ? "Aujourd'hui" : d.toDateString() === new Date(Date.now() - 864e5).toDateString() ? "Hier" : fmt.cap(fmt.date(d, { weekday: "short", day: "numeric", month: "short" })));
    return card({ cls: "ve-recent", title: "Dernières recharges", ic: "clock", tone: "accent", body: h`
      <ul class="plist">${rows.map((r) => { const cost = costOf({ ev: r.kwh, evSun: r.kwh * r.sun }); return h`<li><div class="plist-r">
        <span class="dt-ic" data-tone="${r.sun >= 0.5 ? "solar" : "grid"}">${icon(r.sun >= 0.5 ? "sun" : "grid")}</span>
        <span><strong>${when(r.date)}${r.live ? h` <span class="pill is-live" data-tone="ev">en cours</span>` : ""}</strong><small>${fmt.kwhText(r.kwh)} · ${fmt.eur(cost)}</small></span>
        <span class="plist-p"><span>${fmt.n(r.sun * 100)} % soleil</span>${meter({ value: r.sun * 100, tone: "solar", size: "xs" })}</span>
      </div></li>`; })}</ul>
      ${(() => { const all = BZ.chargeDays(30).filter((d) => d.kwh), avg = all.reduce((a, d) => a + d.kwh, 0) / (all.length || 1), sun = all.reduce((a, d) => a + d.kwh * d.sun, 0) / (all.reduce((a, d) => a + d.kwh, 0) || 1);
        return h`<p class="ve-avg">30 jours : <b>${all.length} recharges</b> · <b>${fmt.kwhText(avg)}</b> en moyenne · <b>${fmt.n(sun * 100)} %</b> soleil</p>`; })()}` });
  }

  function settingsCard() {
    const lim = num(C.voiture_limite_pct), dc = num(C.voiture_limite_dc_pct);
    const odo = num(C.voiture_odometre), last = num(C.entretien_dernier_km), next = last + C.entretien_intervalle_km, left = next - odo, armed = BZ.ui.armed === "service";
    return card({ cls: "ve-set", title: "Réglages et entretien", ic: "gauge", tone: "accent", body: h`<div class="rows">
      <div class="row ve-lims"><div><strong>Limites de charge</strong><span>AC à domicile · DC sur borne rapide</span></div>
        <div class="ve-lim2" title="Recharge à domicile (AC)"><span>AC</span>${stepper({ value: fmt.n(lim), unit: " %", act: "car-lim", label: "Limite à domicile (AC)", cur: lim, min: 50, max: 100, pending: BZ.isPending(C.voiture_limite_pct) })}</div>
        <div class="ve-lim2" title="Recharge rapide sur borne (DC)"><span>DC</span>${stepper({ value: fmt.n(dc), unit: " %", act: "car-limdc", label: "Limite charge rapide (DC)", cur: dc, min: 50, max: 100, pending: BZ.isPending(C.voiture_limite_dc_pct) })}</div></div>
      <div class="row"><div><strong>Heures creuses seulement</strong><span>creuses et super creuses</span></div>${toggle({ on: isOn(C.voiture_heures_creuses), act: "toggle", args: { entity: C.voiture_heures_creuses }, label: "Heures creuses seulement", pending: BZ.isPending(C.voiture_heures_creuses) })}</div>
      <div class="row"><div><strong>Charge programmée</strong><span>horaire réglé dans la voiture</span></div>${toggle({ on: isOn(C.voiture_programmee), act: "toggle", args: { entity: C.voiture_programmee }, label: "Charge programmée", pending: BZ.isPending(C.voiture_programmee) })}</div>
      <div class="row ve-care"><div><strong>Révision</strong><span>${left >= 0 ? `dans ${fmt.n(left)} km (à ${fmt.n(next)} km)` : `${fmt.n(-left)} km de retard`}</span>${meter({ value: ((odo - last) / C.entretien_intervalle_km) * 100, tone: left < 1000 ? "warn" : "ev", size: "xs", label: "Avancement jusqu'à la révision" })}</div>
        ${btn({ label: armed ? "Confirmer" : "Révision faite", ic: "check", act: "car-service", size: "sm", kind: armed ? "danger" : "secondary" })}</div>
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
        <div class="col ve-r">${recentCard()}${settingsCard()}</div>
      </div>`;
  };
})();
