// Énergie (V3) : le temps réel en détail, sans répéter l'Aperçu ni le Bilan.
//  En-tête : phrase d'état en direct | surplus disponible + « Chauffer le ballon »
//  Ligne 1 : production, batterie (heure pleine / réserve), réseau (compteur L3), tarif en cours
//  Gauche  : flux en direct (soleil → maison → batterie, réseau, e-Niro), puis Production solaire (onduleurs) + Réseau
//  Droite  : Batterie SolarFlow (packs, rendement, réglages), Tarifs du jour (cadran 24 h + prix)
(() => {
  const BZ = window.BZ;
  const { h, esc, fmt, icon, val, card, pill, kpi, btn, meter, ring, stepper, C, num } = BZ;

  const PACK_KWH = 2.88;   // capacité d'un pack Zendure AB3000
  // Puissance maximale de chaque onduleur, lue dans son nom (« Izy 2 000 W »)
  const caps = () => C.onduleurs_noms.map((n, i) => parseInt(String(n).replace(/\D/g, ""), 10) || [2000, 2000, 1000][i] || 1000);
  const nowH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  // État coloré sans flèche de tendance (état, pas évolution)
  const tag = (text, tone, ic) => h`<span class="delta en-d" data-tone="${tone}">${ic ? icon(ic) : ""}${text}</span>`;
  // Libellé long sur grand écran, court quand la place manque
  const lbl = (long, short) => h`<span class="en-lo">${long}</span><span class="en-sh">${short}</span>`;
  const IMP = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7 7 17M15 17H7V9"/></svg>';
  const EXP = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  const dur = (x) => { const m = Math.round(x * 60); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`; };

  // Mini-courbe en escalier (prix de l'heure) avec un repère « maintenant »
  function stepSpark(vals, tone, at) {
    const w = 120, hh = 36, n = vals.length, max = Math.max(...vals), min = Math.min(...vals);
    const y = (v) => (hh - 3 - ((v - min) / (max - min || 1)) * (hh - 12)).toFixed(1), x = (i) => ((i / n) * w).toFixed(1);
    let d = `M0,${y(vals[0])}`;
    vals.forEach((v, i) => { if (i && v !== vals[i - 1]) d += ` L${x(i)},${y(v)}`; d += ` L${x(i + 1)},${y(v)}`; });
    return h`<svg class="spark" data-tone="${tone}" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" aria-hidden="true">
      <path class="spark-a" d="${d} L${w},${hh} L0,${hh} Z"/><path class="spark-l" d="${d}"/><line class="en-spark-now" x1="${((at / 24) * w).toFixed(1)}" x2="${((at / 24) * w).toFixed(1)}" y1="2" y2="${hh}"/></svg>`;
  }

  // Batterie : heure à laquelle elle sera pleine (charge) ou à sa réserve (décharge), au rythme actuel
  function batEta(L) {
    if (Math.abs(L.bat) < 15) return "";
    const soc = num(C.batterie_soc), up = L.bat > 0, pct = up ? num(C.batterie_max_pct) - soc : soc - num(C.batterie_min_pct);
    if (pct <= 0) return up ? "charge maximale atteinte" : "réserve atteinte";
    const hrs = ((pct / 100) * C.packs_soc.length * PACK_KWH) / (Math.abs(L.bat) / 1000);
    if (hrs > 20) return up ? "pleine dans plus de 20 h" : "réserve dans plus de 20 h";
    const at = new Date(Date.now() + hrs * 36e5); at.setMinutes(Math.round(at.getMinutes() / 5) * 5, 0, 0);
    const what = up ? "pleine" : "réserve", tom = at.getDate() !== new Date().getDate();
    return lbl(`${what} ${tom ? "demain" : "vers"} ${fmt.time(at)}`, `${what} à ${fmt.time(at)}`);
  }

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
        <span class="en-live" data-tone="${live.tone}"><i class="${live.on ? "is-on" : ""}"></i><span>${live.label}</span>${live.v ? h`<b>${live.v}</b>` : ""}</span>
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
    // Batterie : état en direct et heure où elle sera pleine (ou à sa réserve) ; courbe = énergie stockée chaque jour (7 j)
    const soc = num(C.batterie_soc), week = BZ.dayView(0).week;
    const batD = Math.abs(L.bat) < 15 ? tag("En veille", "neutral") : tag(h`<span class="en-bw">${fmt.powerText(Math.abs(L.bat))}</span>`, L.bat > 0 ? "battery" : "warn", L.bat > 0 ? "up" : "down");
    // Réseau : même convention que le compteur (− revente, + achat) ; courbe = solde revente − achat sur 7 jours
    const g = L.grid, exp = g < -15, imp = g > 15, [gv, gu] = fmt.power(Math.abs(g));
    // Tarif : profil de prix de la journée
    const t = BZ.tariffNow(), prices = BZ.tariffHours().map((k) => BZ.TARIFS[k].price());
    return h`<div class="kpis en-kpis">
      ${kpi({ label: "Production", ic: "sun", tone: "solar", value: val(fmt.power(L.solar)), delta: prodD, vs: prodD ? lbl("vs prévision", "vs prévu") : `${fmt.kwhText(T.prod)} aujourd'hui`, spark: BZ.spark(prodSpark, "solar"), to: "insights" })}
      ${kpi({ label: "Batterie SolarFlow", ic: "battery", tone: "battery", value: val([fmt.n(soc), "%"]), delta: batD, vs: batEta(L), spark: BZ.spark(week.map((d) => d.chg), "battery") })}
      ${kpi({ label: "Réseau", ic: "grid", tone: imp ? "bad" : "grid", value: h`<span class="en-gv ${exp ? "is-good" : imp ? "is-bad" : ""}">${val([`${exp ? "−" : imp ? "+" : ""}${gv}`, gu])}</span>`,
        delta: tag(exp ? "Revente" : imp ? "Achat" : "Équilibre", exp ? "good" : imp ? "bad" : "neutral"), vs: lbl("compteur L3", "L3"), spark: BZ.spark(week.map((d) => d.exp - d.imp), imp ? "bad" : "grid"), to: "insights" })}
      ${kpi({ label: "Prix du kWh", ic: "clock", tone: t.key, value: val([fmt.n(t.price, 4), "€"]), delta: tag(t.short, t.key), vs: lbl(`jusqu'à ${fmt.time(t.changeAt)}`, `→ ${fmt.time(t.changeAt)}`), spark: stepSpark(prices, t.key, nowH()) })}
    </div>`;
  }

  /* ─── Flux en direct (schéma partagé, voiture comprise) ───────────── */
  function flowCard(L) {
    // Part de ce qui est consommé maintenant sans passer par le réseau
    const need = L.house + L.car, auto = need > 0 ? BZ.clamp(1 - Math.max(0, L.grid) / need, 0, 1) : 1;
    return card({ cls: "en-flow", title: "Flux en direct", ic: "energy", tone: "accent",
      aside: pill(h`<span class="en-lo">Autonome à </span>${fmt.n(auto * 100)} %<span class="en-sh"> autonome</span>`, auto > 0.95 ? "good" : auto > 0.5 ? "warn" : "bad", true),
      link: { label: "Historique", to: "insights" },
      body: BZ.flow() });
  }

  /* ─── Production solaire : avancement de la journée + 3 onduleurs ─── */
  function solarCard() {
    const K = caps(), ws = C.onduleurs_w.map((id) => Math.max(0, num(id) || 0)), tot = ws.reduce((a, b) => a + b, 0), T = BZ.today();
    const done = T.forecast > 0 ? BZ.clamp(T.prod / T.forecast, 0, 1) : 0, rest = Math.max(0, T.forecast - T.prod);
    return card({ cls: "en-sun", title: "Production solaire", ic: "sun", tone: "accent",
      aside: h`<span class="en-fc" title="${rest > 0.05 ? `Encore ~${fmt.kwhText(rest)} attendus aujourd'hui` : "Prévision du jour atteinte"}">
        ${meter({ value: done * 100, tone: "solar", size: "xs", label: `Production du jour : ${fmt.n(done * 100)} % de la prévision` })}
        <span class="en-note"><b>${fmt.n(T.prod, 1)}</b> / ${fmt.kwhText(T.forecast)}<span class="en-lo"> prévus</span></span></span>`, body: h`
      <ul class="plist en-inv">${C.onduleurs_noms.map((name, i) => {
        const w = ws[i], load = BZ.clamp((w / K[i]) * 100, 0, 100);
        return h`<li><div class="plist-r">
          <span class="dt-ic" data-tone="solar">${icon("sun")}</span>
          <span><strong>${esc(name)}</strong><small>${fmt.powerText(w)}<span class="en-lo"> · ${fmt.n(tot ? (w / tot) * 100 : 0)} % du total</span></small></span>
          ${w > 30 ? pill("Produit", "good", true) : pill("En veille", "neutral")}
          <span class="plist-p"><span>${fmt.n(load)} %</span>${meter({ value: load, tone: "solar", size: "xs", label: `${name} à ${fmt.n(load)} % de sa puissance` })}</span>
        </div></li>`;
      })}</ul>` });
  }

  /* ─── Réseau : sens de l'échange en direct, compteurs du jour ─────── */
  function gridCard(L) {
    const T = BZ.today(), t = BZ.tariffNow(), g = L.grid, exp = g < -15, imp = g > 15;
    const span = Math.max(3000, Math.abs(g) * 1.1), v = exp || imp ? BZ.clamp((Math.abs(g) / span) * 50, 2, 50) : 0;
    const kept = L.solar > 30 ? BZ.clamp(1 - Math.max(0, -g) / L.solar, 0, 1) : null;
    const cost = imp ? (g / 1000) * t.price : 0;
    const tiles = [
      { raw: IMP, tone: "bad", label: "Achat du jour", v: val(fmt.kwh(T.imp)) },
      { raw: EXP, tone: "grid", label: "Revente du jour", v: val(fmt.kwh(T.exp)) },
      { ic: "sun", tone: "solar", label: "Soleil gardé", v: kept == null ? h`<span class="en-na">pas de soleil</span>` : val([fmt.n(kept * 100), "%"]), title: "Part de la production solaire utilisée sur place en ce moment" },
      { ic: "euro", tone: t.key, label: "Coût actuel", v: val([fmt.n(cost, 2), "€/h"]), title: `Achat réseau en ce moment au tarif ${t.short}` },
    ];
    const vt = exp ? `Revente de ${fmt.powerText(-g)}` : imp ? `Achat de ${fmt.powerText(g)}` : "Aucun échange";
    return card({ cls: "en-grd", title: "Réseau", ic: "grid", tone: "accent",
      aside: pill(exp ? "Revente" : imp ? "Achat" : "Équilibre", exp ? "good" : imp ? "bad" : "neutral", exp || imp), body: h`
      <div class="en-dv" data-tone="${exp ? "grid" : imp ? "bad" : "neutral"}" role="meter" aria-label="Échange avec le réseau" aria-valuemin="${Math.round(-span)}" aria-valuemax="${Math.round(span)}" aria-valuenow="${Math.round(-g)}" aria-valuetext="${vt}">
        <span class="en-dv-l ${imp ? "is-on" : ""}">Achat</span>
        <span class="en-dv-t">
          <i class="${exp ? "is-r" : "is-l"}" style="--v:${v.toFixed(2)}%"></i><b></b>
          <em style="--x:${BZ.clamp(50 + (exp ? v : -v), 14, 86).toFixed(2)}%">${exp ? "−" : imp ? "+" : ""}${fmt.powerText(Math.abs(g))}</em>
        </span>
        <span class="en-dv-r ${exp ? "is-on" : ""}">Revente</span>
      </div>
      <ul class="en-gt">${tiles.map((x) => h`<li ${x.title ? `title="${esc(x.title)}"` : ""}><span class="dt-ic" data-tone="${x.tone}">${x.raw || icon(x.ic)}</span>
        <span><small>${x.label}</small><b>${x.v}</b></span></li>`)}</ul>` });
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
          <b>Pack ${i + 1}</b>${meter({ value: num(id), tone: "battery", size: "xs", label: `Pack ${i + 1} à ${fmt.n(num(id))} %` })}<em>${fmt.n(num(id))} %</em>
          <small><span class="sr">Température </span>${fmt.n(num(C.packs_temp[i]))}°</small></li>`)}</ul>
      </div>
      <div class="en-kv">
        <div><span>${lbl("Stocké aujourd'hui", "Stocké")}</span><b>${val(fmt.kwh(num(C.batterie_charge_jour_kwh)))}</b></div>
        <div><span>${lbl("Rendu aujourd'hui", "Rendu")}</span><b>${val(fmt.kwh(num(C.batterie_decharge_jour_kwh)))}</b></div>
        <div><span>Rendement</span><b>${val([fmt.n(eff * 100, 1), "%"])}</b></div>
      </div>
      <div class="en-set">
        <div><span>Réserve minimale</span>${stepper({ value: fmt.n(min), unit: " %", act: "bat-min", label: "Réserve minimale", cur: min, min: 0, max: 50, pending: BZ.isPending(C.batterie_min_pct) })}</div>
        <div><span>Charge maximale</span>${stepper({ value: fmt.n(max), unit: " %", act: "bat-max", label: "Charge maximale", cur: max, min: 70, max: 100, pending: BZ.isPending(C.batterie_max_pct) })}</div>
      </div>
      <p class="foot en-bat-f"><span>Depuis l'installation · ${fmt.n(num(C.batterie_temp))} °C</span><span>${fmt.n(tin)} kWh stockés · ${fmt.n(tout)} kWh rendus</span></p>` });
  }

  /* ─── Tarifs du jour : cadran 24 h + prix ─────────────────────────── */
  // Cadran : une case par heure (0 h en haut, sens horaire), heures passées estompées, repère « maintenant »
  function dial(hours, H, t, aria) {
    const S = 120, M = 20, cx = S / 2, r = 48, sw = 13, c = 2 * Math.PI * r, seg = c / 24, gap = 1.3;
    const a = (H / 24) * 2 * Math.PI, px = cx + r * Math.sin(a), py = cx - r * Math.cos(a);
    const rl = r + sw / 2 + 11.5;
    const lab = [[0, "0h"], [6, "6h"], [12, "12h"], [18, "18h"]].map(([k, l]) => { const b = (k / 24) * 2 * Math.PI; return h`<text x="${(cx + rl * Math.sin(b)).toFixed(1)}" y="${(cx - rl * Math.cos(b)).toFixed(1)}">${l}</text>`; });
    return h`<div class="en-dial" data-tone="${t.key}" role="img" aria-label="${aria}">
      <svg viewBox="${-M} ${-M} ${S + 2 * M} ${S + 2 * M}" aria-hidden="true">
        <g transform="rotate(-90 ${cx} ${cx})">${hours.map((k, i) => h`<circle data-tariff="${k}" class="${i + 1 <= H ? "is-past" : ""}" cx="${cx}" cy="${cx}" r="${r}" stroke-width="${sw}" stroke-dasharray="${(seg - gap).toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${(-(seg * i + gap / 2)).toFixed(2)}"/>`)}</g>
        <g class="en-dial-ax">${lab}</g>
        <circle class="en-dial-now" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5.5"/>
      </svg>
      <div class="en-dial-c"><b>${t.short}</b><span>→ ${fmt.time(t.changeAt)}</span></div></div>`;
  }

  function tariffCard() {
    const t = BZ.tariffNow(), hours = BZ.tariffHours(), H = nowH(), T = BZ.TARIFS, hp = T.hp.price();
    // Début des prochaines super creuses
    let hscIn = null;
    for (let k = 1; k <= 24; k++) { const a = (Math.floor(H) + k) % 24; if (BZ.tariffAt(a) === "hsc" && BZ.tariffAt((a + 23) % 24) !== "hsc") { hscIn = Math.floor(H) + k - H; break; } }
    const runs = []; hours.forEach((k, i) => (runs.length && runs[runs.length - 1].k === k ? runs[runs.length - 1].n++ : runs.push({ k, s: i, n: 1 })));
    const aria = `Tarifs de la journée : ${runs.map((r) => `${T[r.k].label.toLowerCase()} de ${r.s} h à ${r.s + r.n} h`).join(", ")}. Il est ${fmt.time(new Date())}, ${t.label.toLowerCase()} jusqu'à ${fmt.time(t.changeAt)}.`;
    const aside = t.key === "hsc" ? pill("HSC en cours", "hsc", true) : hscIn != null ? pill(`HSC dans ${dur(hscIn)}`, "hsc") : "";
    return card({ cls: "en-tar", title: "Tarifs du jour", ic: "clock", tone: "accent", aside, body: h`
      <div class="en-tar-b">
        ${dial(hours, H, t, aria)}
        <ul class="en-tk">${["hp", "hc", "hsc"].map((k) => {
          const p = T[k].price(), cur = k === t.key;
          return h`<li data-tone="${k}" class="${cur ? "is-cur" : ""}"><i></i>
            <span><strong>${lbl(T[k].label, T[k].short)}</strong><small>${BZ.rangeLabel(k)}</small></span>
            <span class="en-tk-v"><b>${fmt.n(p, 4)} €</b><small>${k === "hp" ? "par kWh" : `−${fmt.n((1 - p / hp) * 100)} % vs HP`}</small></span></li>`;
        })}</ul>
      </div>` });
  }

  BZ.pages.energy = () => {
    const L = BZ.live();
    return h`${header(L)}${kpis(L)}
      <div class="layout en-grid">
        <div class="col en-l">${flowCard(L)}<div class="en-pair">${solarCard()}${gridCard(L)}</div></div>
        <div class="col en-r">${batCard(L)}${tariffCard()}</div>
      </div>`;
  };
})();
