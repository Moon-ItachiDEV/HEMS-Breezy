// Voltia v1 — rendu du tableau de bord à partir des rôles (config.js) et des états (mock.js).
(function () {
  const C = window.VOLTIA_CONFIG;
  const H = window.MOCK_STATES;

  // ─── Lecture des états
  const ent = (id) => H[id] || { state: "unavailable", attributes: {} };
  const st = (id) => ent(id).state;
  const n = (id) => { const v = parseFloat(st(id)); return Number.isFinite(v) ? v : NaN; };
  const at = (id, a) => ent(id).attributes[a];
  const on = (id) => ["on", "open", "playing", "heat", "unlocked"].includes(st(id));

  // ─── Formatage
  const fr = (v, d = 0) => Number.isFinite(v) ? v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
  const W = (w) => Math.abs(w) >= 1000 ? `${fr(w / 1000, 2)}<small>kW</small>` : `${fr(w)}<small>W</small>`;
  const Wt = (w) => Math.abs(w) >= 1000 ? `${fr(w / 1000, 2)} kW` : `${fr(w)} W`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pct = (v) => `${clamp(v, 0, 100)}%`;
  const hhmm = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const ago = (iso) => {
    const m = Math.round((Date.now() - new Date(iso)) / 60e3);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m} min`;
    if (m < 1440) return `il y a ${Math.round(m / 60)} h`;
    if (m < 60 * 1440) return `il y a ${Math.round(m / 1440)} j`;
    return `il y a ${Math.round(m / 43800)} mois`;
  };
  const daysBetween = (a, b) => Math.round((b - a) / 864e5);
  const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };

  // ─── Calculs énergie
  function energy() {
    const solar = Math.max(0, n(C.solaire_w));
    const grid = n(C.reseau_w);                       // + import, − export
    const batRaw = n(C.batterie_w);
    const bat = C.batterie_inverse ? -batRaw : batRaw; // + charge, − décharge
    const plugged = on(C.voiture_branchee);
    const car = plugged ? Math.max(0, n(C.voiture_charge_w)) : 0;
    const total = solar + grid - bat;
    return { solar, grid, bat, car, house: Math.max(0, total - car), total };
  }

  function tarifActuel() {
    const p = n(C.prix_kwh);
    const t = [["HSC", n(C.tarif_hsc)], ["HC", n(C.tarif_hc)], ["HP", n(C.tarif_hp)]];
    const hit = t.find(([, v]) => Math.abs(v - p) < 1e-4);
    return { prix: p, nom: hit ? hit[0] : "" };
  }

  // ─── Commandes (simulées en démo : elles modifient les valeurs locales)
  const toastEl = document.getElementById("toast");
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }
  function call(service, entity_id, mutate, extra = "") {
    mutate && mutate();
    toast(`Démo · ${service}${extra} → ${entity_id}`);
    renderAll();
  }
  const set = (id, state, attrs) => { H[id].state = String(state); if (attrs) Object.assign(H[id].attributes, attrs); };
  const toggle = (id, a = "on", b = "off") => set(id, st(id) === a ? b : a);

  // Boutons à double appui (déverrouiller, verser un sac)
  const armed = {};
  function twoTap(key, label, fn) {
    if (armed[key]) { clearTimeout(armed[key]); delete armed[key]; fn(); return; }
    armed[key] = setTimeout(() => { delete armed[key]; renderAll(); }, 3000);
    toast(label);
    renderAll();
  }

  // ─── Composants
  const bar = (v, c, marks = []) =>
    `<div class="bar" style="--c:${c}"><i style="width:${pct(v)}"></i>${marks.map((m) => `<span class="mark" style="left:${pct(m)}"></span>`).join("")}</div>`;
  const sw = (isOn, act, i = "", c = "") =>
    `<button class="switch ${isOn ? "on" : ""}" data-act="${act}" data-i="${i}" style="${c ? `--c:${c}` : ""}" aria-pressed="${isOn}"></button>`;
  const stepper = (val, act, unit = "") =>
    `<div class="step"><button data-act="${act}" data-d="-1">−</button><b>${val}${unit}</b><button data-act="${act}" data-d="1">+</button></div>`;

  // ─── En-tête
  const METEO = { sunny: "☀️", "clear-night": "🌙", partlycloudy: "⛅", cloudy: "☁️", rainy: "🌧️", pouring: "🌧️", snowy: "❄️", fog: "🌫️", windy: "💨", lightning: "⛈️" };
  function renderTop() {
    const t = tarifActuel();
    document.getElementById("top-meta").innerHTML = `
      <span class="chip">${METEO[st(C.meteo)] || "🌡️"} ${fr(at(C.meteo, "temperature"))}°</span>
      <span class="chip">${t.nom ? `<b>${t.nom}</b> ` : ""}${fr(t.prix, 3)} €</span>
      <span class="chip good">+${fr(n(C.economies_jour_eur), 2)} €</span>`;
  }

  // ─── Flux d'énergie (construit une fois, puis mis à jour)
  const NODES = {
    sun: { x: 180, y: 46, c: "var(--sun)", ico: "☀️", lbl: "Solaire" },
    grid: { x: 52, y: 160, c: "var(--grid)", ico: "⚡", lbl: "Réseau" },
    home: { x: 180, y: 160, c: "var(--home)", ico: "🏠", lbl: "Maison" },
    bat: { x: 308, y: 160, c: "var(--bat)", ico: "🔋", lbl: "Batterie" },
    car: { x: 180, y: 274, c: "var(--car)", ico: "🚗", lbl: "e-Niro" },
  };
  const WIRES = [["sun", "home", "var(--sun)"], ["grid", "home", "var(--grid)"], ["home", "bat", "var(--bat)"], ["home", "car", "var(--car)"]];
  function buildFlow() {
    const r = 34;
    const line = (a, b) => {
      const A = NODES[a], B = NODES[b];
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
      const ux = dx / L, uy = dy / L;
      return `M${A.x + ux * r} ${A.y + uy * r} L${B.x - ux * r} ${B.y - uy * r}`;
    };
    const wires = WIRES.map(([a, b, c]) =>
      `<path class="wire" d="${line(a, b)}"/><path id="p-${a}-${b}" class="pulse off" stroke="${c}" d="${line(a, b)}"/>`).join("");
    const nodes = Object.entries(NODES).map(([k, v]) => `
      <g class="node" transform="translate(${v.x} ${v.y})">
        <circle class="ring" r="${r}" stroke="${v.c}"/>
        <text class="ico" y="-6">${v.ico}</text>
        <text class="val" id="v-${k}" y="${k === "car" ? 56 : k === "sun" ? -44 : 56}"></text>
        <text class="lbl" y="${k === "car" ? 72 : k === "sun" ? -60 : 72}">${v.lbl}</text>
        <text class="lbl" id="s-${k}" y="18"></text>
      </g>`).join("");
    document.getElementById("flow").innerHTML =
      `<svg class="flow" viewBox="0 -40 360 400" role="img" aria-label="Flux d'énergie">${wires}${nodes}</svg>`;
  }
  function updateFlow() {
    const e = energy();
    const pulse = (id, w, reverse) => {
      const p = document.getElementById(id);
      const active = Math.abs(w) > 15;
      p.classList.toggle("off", !active);
      p.classList.toggle("rev", !!reverse);
      p.style.setProperty("--dur", `${clamp(2.6 - Math.abs(w) / 1600, 0.45, 2.6)}s`);
    };
    pulse("p-sun-home", e.solar);
    pulse("p-grid-home", e.grid, e.grid < 0);
    pulse("p-home-bat", e.bat, e.bat < 0);
    pulse("p-home-car", e.car);
    const txt = (id, t) => (document.getElementById(id).textContent = t);
    txt("v-sun", Wt(e.solar));
    txt("v-grid", Wt(Math.abs(e.grid)));
    txt("s-grid", e.grid < -15 ? "export" : e.grid > 15 ? "import" : "");
    txt("v-home", Wt(e.house));
    txt("v-bat", Wt(Math.abs(e.bat)));
    txt("s-bat", `${fr(n(C.batterie_soc))} %`);
    txt("v-car", on(C.voiture_branchee) ? Wt(e.car) : "débranchée");
    txt("s-car", `${fr(n(C.voiture_soc))} %`);
  }

  // ─── Vue Énergie
  function renderEnergie() {
    const e = energy();
    const prod = n(C.production_jour_kwh), prev = n(C.prevision_jour_kwh);
    const reste = Math.max(0, prev - prod);
    const soc = n(C.batterie_soc), min = n(C.batterie_min_pct), max = n(C.batterie_max_pct);
    const rend = (n(C.batterie_total_decharge_kwh) / n(C.batterie_total_charge_kwh)) * 100;
    const autoconso = e.solar > 0 ? clamp((1 - Math.max(0, -e.grid) / e.solar) * 100, 0, 100) : 0;
    const batEtat = e.bat > 15 ? `Charge ${Wt(e.bat)}` : e.bat < -15 ? `Décharge ${Wt(-e.bat)}` : "En veille";
    const t = tarifActuel();
    const MAX_OND = [2000, 2000, 1000];

    document.getElementById("energie-cards").innerHTML = `
      <div class="grid small">
        <div class="card"><div class="muted">Production</div><div class="big">${fr(prod, 1)}<small>kWh</small></div><div class="muted" style="font-size:.8rem">sur ${fr(prev, 1)} prévus</div></div>
        <div class="card"><div class="muted">Économies</div><div class="big" style="color:var(--bat)">${fr(n(C.economies_jour_eur), 2)}<small>€</small></div><div class="muted" style="font-size:.8rem">aujourd'hui</div></div>
        <div class="card"><div class="muted">Autoconso.</div><div class="big">${fr(autoconso)}<small>%</small></div><div class="muted" style="font-size:.8rem">en ce moment</div></div>
        <div class="card"><div class="muted">Prix actuel</div><div class="big">${fr(t.prix * 100, 1)}<small>c€</small></div><div class="muted" style="font-size:.8rem">${t.nom || "—"}</div></div>
      </div>

      <h2>Aujourd'hui</h2>
      <div class="grid">
        <div class="card">
          <h3>☀️ Solaire <span class="right">${Wt(e.solar)}</span></h3>
          <div class="row"><span class="grow muted">Production / prévision</span><b>${fr(prod, 1)} / ${fr(prev, 1)} kWh</b></div>
          <div style="margin:8px 0 4px">${bar((prod / prev) * 100, "var(--sun)")}</div>
          <div class="muted" style="font-size:.82rem">Encore ~${fr(reste, 1)} kWh attendus aujourd'hui</div>
          <h2 style="margin-top:16px">Onduleurs</h2>
          ${C.onduleurs_w.map((id, i) => `
            <div class="row"><span class="grow">${C.onduleurs_noms[i]}</span><b>${Wt(n(id))}</b></div>
            <div style="margin:4px 0 8px">${bar((n(id) / MAX_OND[i]) * 100, "var(--sun)")}</div>`).join("")}
        </div>

        <div class="card">
          <h3>⚡ Réseau <span class="right">${e.grid < 0 ? "Export" : "Import"} ${Wt(Math.abs(e.grid))}</span></h3>
          <dl class="kv">
            <dt>Acheté aujourd'hui</dt><dd>${fr(n(C.import_jour_kwh), 1)} kWh</dd>
            <dt>Revendu aujourd'hui</dt><dd>${fr(n(C.export_jour_kwh), 1)} kWh</dd>
            <dt>Consommation maison</dt><dd>${Wt(e.house)}</dd>
            <dt>dont recharge voiture</dt><dd>${Wt(e.car)}</dd>
          </dl>
          <h2 style="margin-top:16px">Tarifs</h2>
          <dl class="kv">
            <dt>Heures pleines</dt><dd>${fr(n(C.tarif_hp), 4)} €</dd>
            <dt>Heures creuses</dt><dd>${fr(n(C.tarif_hc), 4)} €</dd>
            <dt>Super creuses <span class="muted">(dès ${st(C.tarif_hsc_debut).slice(0, 5)})</span></dt><dd>${fr(n(C.tarif_hsc), 4)} €</dd>
          </dl>
        </div>
      </div>

      <h2>Batterie SolarFlow</h2>
      <div class="grid">
        <div class="card" style="--c:var(--bat)">
          <h3>🔋 ${batEtat} <span class="right">${fr(n(C.batterie_temp))} °C</span></h3>
          <div class="row"><div class="big">${fr(soc)}<small>%</small></div><div class="grow muted" style="text-align:right">${fr(n(C.batterie_dispo_kwh), 1)} kWh disponibles</div></div>
          <div style="margin:10px 0 6px">${bar(soc, "var(--bat)", [min, max])}</div>
          <div class="row muted" style="font-size:.8rem"><span class="grow">Min ${fr(min)} %</span><span>Max ${fr(max)} %</span></div>
          <div class="row" style="margin-top:14px"><span class="grow">Limite de décharge</span>${stepper(fr(min), "bat-min", " %")}</div>
          <div class="row"><span class="grow">Limite de charge</span>${stepper(fr(max), "bat-max", " %")}</div>
        </div>
        <div class="card">
          <h3>Packs AB3000</h3>
          ${C.packs_soc.map((id, i) => `
            <div class="row"><span class="grow">Pack ${i + 1}</span><span class="muted">${fr(n(C.packs_temp[i]))} °C · ${Wt(n(C.packs_w[i]))}</span><b style="min-width:44px;text-align:right">${fr(n(id))} %</b></div>
            <div style="margin:4px 0 10px">${bar(n(id), "var(--bat)")}</div>`).join("")}
          <dl class="kv" style="margin-top:6px">
            <dt>Chargé / rendu aujourd'hui</dt><dd>${fr(n(C.batterie_charge_jour_kwh), 1)} / ${fr(n(C.batterie_decharge_jour_kwh), 1)} kWh</dd>
            <dt>Depuis l'installation</dt><dd>${fr(n(C.batterie_total_charge_kwh))} / ${fr(n(C.batterie_total_decharge_kwh))} kWh</dd>
            <dt>Rendement</dt><dd>${fr(rend, 1)} %</dd>
          </dl>
        </div>
      </div>`;
  }

  // ─── Vue Voiture
  function renderVoiture() {
    const soc = n(C.voiture_soc), lim = n(C.voiture_limite_pct);
    const plugged = on(C.voiture_branchee), charging = plugged && on(C.voiture_en_charge);
    const locked = st(C.voiture_verrou) === "locked";
    const mins = n(C.voiture_minutes_restantes);
    const fin = new Date(Date.now() + mins * 60e3);
    const R = 62, P = 2 * Math.PI * R;
    const sol = n(C.session_sol_kwh), res = n(C.session_res_kwh);
    const totS = n(C.ve_solaire_kwh), totR = n(C.ve_reseau_kwh);
    const odo = n(C.voiture_odometre), last = n(C.entretien_dernier_km), next = last + C.entretien_intervalle_km;
    const kwhManquants = Math.max(0, ((lim - soc) / 100) * C.voiture_capacite_kwh);

    document.getElementById("voiture").innerHTML = `
      <div class="split">
        <div class="card" style="--c:var(--car)">
          <h3>🚗 Kia e-Niro <span class="right">MAJ ${ago(st(C.voiture_maj))}
            <button class="btn" data-act="car-refresh" style="padding:4px 8px;margin-left:6px" title="Demander un relevé">⟳</button></span></h3>
          <div class="row" style="gap:18px;flex-wrap:wrap">
            <div class="gauge">
              <svg viewBox="0 0 150 150">
                <circle class="bg" cx="75" cy="75" r="${R}"/>
                <circle class="lim" cx="75" cy="75" r="${R}" stroke-dasharray="2 ${P}" stroke-dashoffset="${-P * lim / 100}"/>
                <circle class="fg" cx="75" cy="75" r="${R}" stroke-dasharray="${P}" stroke-dashoffset="${P * (1 - soc / 100)}"/>
              </svg>
              <div class="center"><div class="big">${fr(soc)}<small>%</small></div><div class="muted" style="font-size:.85rem">${fr(n(C.voiture_autonomie_km))} km</div></div>
            </div>
            <div class="grow" style="display:grid;gap:10px">
              <div>${charging ? `<span class="pill dot">En charge · ${Wt(n(C.voiture_charge_w))}</span>`
                : plugged ? `<span class="pill" style="--c:var(--muted)">Branchée</span>` : `<span class="muted">Débranchée</span>`}</div>
              ${charging ? `<div class="muted" style="font-size:.88rem">Fin vers <b style="color:var(--txt)">${hhmm(fin)}</b> · encore ${fr(kwhManquants, 1)} kWh jusqu'à ${fr(lim)} %</div>` : ""}
              <div class="btns">
                ${plugged ? `<button class="btn ${charging ? "" : "primary"}" data-act="car-charge">⚡ ${charging ? "Arrêter" : "Démarrer"}</button>` : ""}
                <button class="btn ${armed.unlock ? "armed" : ""}" data-act="car-lock">${locked ? (armed.unlock ? "🔓 Confirmer" : "🔒 Verrouillée") : "🔓 Verrouiller"}</button>
                <button class="btn ${on(C.voiture_clim) ? "primary" : ""}" data-act="car-clim">❄️ Clim ${on(C.voiture_clim) ? "on" : "off"}</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>⚡ Cette charge <span class="right">depuis ${hhmm(new Date(st(C.session_debut)))}</span></h3>
          <div class="row"><div class="big">+${fr(n(C.session_soc))}<small>%</small></div>
            <div class="grow muted" style="text-align:right">${fr(sol + res, 1)} kWh dont <b style="color:var(--sun)">${fr((sol / (sol + res)) * 100)} % solaire</b></div></div>
          <div class="bar" style="margin:12px 0 8px;display:flex">
            <i style="position:static;width:${(sol / (sol + res)) * 100}%;background:var(--sun);border-radius:0"></i>
            <i style="position:static;width:${(res / (sol + res)) * 100}%;background:var(--grid);border-radius:0"></i>
          </div>
          <div class="row muted" style="font-size:.82rem"><span class="grow">☀️ ${fr(sol, 1)} kWh · ${Wt(n(C.ve_solaire_w))}</span><span>⚡ ${fr(res, 1)} kWh · ${Wt(n(C.ve_reseau_w))}</span></div>
        </div>
      </div>

      <h2>Recharge</h2>
      <div class="grid">
        <div class="card">
          <h3>Options de recharge</h3>
          <div class="row"><span class="grow">Heures creuses seulement</span>${sw(on(C.voiture_heures_creuses), "car-hc", "", "var(--car)")}</div>
          <div class="row"><span class="grow">Charge programmée</span>${sw(on(C.voiture_programmee), "car-prog", "", "var(--car)")}</div>
        </div>
        <div class="card">
          <h3>Limites de charge</h3>
          <div class="row"><span class="grow">À la maison (AC)</span>${stepper(fr(lim), "car-lim", " %")}</div>
          <div class="row"><span class="grow">Recharge rapide (DC)</span>${stepper(fr(n(C.voiture_limite_dc_pct)), "car-limdc", " %")}</div>
          <h2 style="margin-top:16px">Depuis le début</h2>
          <div class="row"><span class="grow"><b style="color:var(--sun)">${fr(totS)} kWh</b> solaire</span><span><b style="color:var(--grid)">${fr(totR)} kWh</b> réseau</span></div>
          <div class="bar" style="margin-top:8px;display:flex">
            <i style="position:static;width:${(totS / (totS + totR)) * 100}%;background:var(--sun);border-radius:0"></i>
            <i style="position:static;width:${(totR / (totS + totR)) * 100}%;background:var(--grid);border-radius:0"></i>
          </div>
        </div>
        <div class="card">
          <h3>🔧 Entretien <span class="right">${fr(odo)} km</span></h3>
          <div class="row"><span class="grow">Prochain à ${fr(next)} km</span><b>${next - odo >= 0 ? `dans ${fr(next - odo)} km` : `dépassé de ${fr(odo - next)} km`}</b></div>
          <div style="margin:8px 0 12px">${bar(((odo - last) / C.entretien_intervalle_km) * 100, next - odo < 1000 ? "var(--warn)" : "var(--car)")}</div>
          <div class="btns"><button class="btn" data-act="car-service">✓ Entretien fait</button><button class="btn" data-act="car-service-km">Fait à un autre km…</button></div>
          <dl class="kv" style="margin-top:14px">
            <dt>Batterie 12 V</dt><dd>${fr(n(C.voiture_12v_pct))} %</dd>
            <dt>Dernier trajet</dt><dd>${ago(st(C.voiture_dernier_trajet))}</dd>
            <dt>Depuis ce trajet</dt><dd>${fr(soc - n(C.voiture_soc_reference))} %</dd>
          </dl>
        </div>
      </div>`;
  }

  // ─── Vue Maison
  function renderMaison() {
    const hp = C.homepod, playing = st(hp) === "playing";
    const robotEtat = { docked: "Sur sa base", cleaning: "Nettoyage en cours", returning: "Retour à la base", idle: "En pause" }[st(C.robot)] || st(C.robot);
    document.getElementById("maison").innerHTML = `
      <h2 style="display:flex">Lumières <span style="margin-left:auto"><button class="btn" data-act="lights-off" style="padding:4px 10px;font-size:.75rem">Tout éteindre</button></span></h2>
      <div class="grid small">
        ${C.lumieres.map((id, i) => `
          <button class="tile ${on(id) ? "on" : ""}" data-act="light" data-i="${i}" style="--c:var(--sun)">
            <span class="t-ico">💡</span><span class="t-name">${C.lumieres_noms[i]}</span><span class="t-state">${on(id) ? "Allumée" : "Éteinte"}</span>
          </button>`).join("")}
      </div>

      <h2 style="display:flex">Volets <span style="margin-left:auto" class="btns">
        <button class="btn" data-act="covers" data-i="100" style="padding:4px 10px;font-size:.75rem">Tout ouvrir</button>
        <button class="btn" data-act="covers" data-i="0" style="padding:4px 10px;font-size:.75rem">Tout fermer</button></span></h2>
      <div class="grid small">
        ${C.volets.map((id, i) => { const p = at(id, "current_position"); return `
          <div class="card" style="padding:12px">
            <div class="row" style="margin-bottom:8px"><b class="grow" style="font-size:.88rem">${C.volets_noms[i]}</b><span class="muted" style="font-size:.8rem">${p === 0 ? "Fermé" : p === 100 ? "Ouvert" : p + " %"}</span></div>
            <div class="shutter"><i style="height:${100 - p}%"></i></div>
            <div class="btns" style="margin-top:8px;flex-wrap:nowrap">
              <button class="btn" style="flex:1;padding:6px" data-act="cover" data-i="${i}" data-d="100">▲</button>
              <button class="btn" style="flex:1;padding:6px" data-act="cover" data-i="${i}" data-d="50">■</button>
              <button class="btn" style="flex:1;padding:6px" data-act="cover" data-i="${i}" data-d="0">▼</button>
            </div>
          </div>`; }).join("")}
      </div>

      <h2>Prises et appareils</h2>
      <div class="grid">
        <div class="card">
          <h3>🔌 Prise chambre <span class="right">${sw(on(C.prise_chambre), "plug")}</span></h3>
          <div class="row"><div class="big">${on(C.prise_chambre) ? W(n(C.prise_chambre_w)) : "0<small>W</small>"}</div>
            <span class="grow muted" style="text-align:right">${fr(n(C.prise_chambre_kwh), 2)} kWh</span></div>
          <h2 style="margin-top:16px">Multiprise</h2>
          ${C.multiprise.map((id, i) => `<div class="row"><span class="grow">${C.multiprise_noms[i]}</span>${sw(on(id), "strip", i)}</div>`).join("")}
        </div>
        <div class="card">
          <h3>🤖 Robot <span class="right">🔋 ${fr(n(C.robot_batterie))} %</span></h3>
          <div class="muted" style="margin-bottom:10px">${robotEtat}</div>
          <select data-act="robot-scene" style="width:100%;padding:10px;border-radius:12px;background:var(--card-2);color:var(--txt);border:1px solid var(--line);font:inherit">
            ${(at(C.robot_scene, "options") || []).map((o) => `<option ${o === st(C.robot_scene) ? "selected" : ""}>${o}</option>`).join("")}
          </select>
          <div class="btns" style="margin-top:12px">
            <button class="btn primary" data-act="robot-start" style="--c:var(--bat)">▶ Lancer</button>
            <button class="btn" data-act="robot-dock">⌂ Base</button>
          </div>
        </div>
        <div class="card">
          <h3>🔊 HomePod salon <span class="right">${playing ? "Lecture" : "En pause"}</span></h3>
          <div style="font-weight:600">${at(hp, "media_title") || "—"}</div>
          <div class="muted">${at(hp, "media_artist") || ""}</div>
          <div class="row" style="margin-top:12px">
            <button class="btn" data-act="media-play">${playing ? "⏸" : "▶"}</button>
            <input class="grow" type="range" min="0" max="100" value="${Math.round((at(hp, "volume_level") || 0) * 100)}" data-act="media-vol" aria-label="Volume">
          </div>
        </div>
      </div>`;
  }

  // ─── Vue Chauffage
  function renderChauffage() {
    const p = C.poele, pOn = st(p) !== "off";
    const tremie = n(C.tremie_kg), stock = n(C.stock_kg), conso = n(C.conso_jour_kg);
    const tremieMax = at(C.tremie_kg, "max") || 15;
    const jours = conso > 0 ? (tremie + stock) / conso : NaN;
    const entretien = new Date(st(C.poele_entretien));
    const due = addMonths(entretien, C.poele_entretien_mois);
    const dj = daysBetween(new Date(), due);
    const bt = n(C.ballon_temp), bc = at(C.ballon, "temperature");
    const boost = n(C.ballon_boost) === 1;
    const bEnt = new Date(st(C.ballon_entretien));

    document.getElementById("chauffage").innerHTML = `
      <div class="grid">
        <div class="card" style="--c:var(--heat)">
          <h3>🔥 Poêle <span class="right">${st(C.poele_statut)} ${sw(pOn, "stove", "", "var(--heat)")}</span></h3>
          <div class="row"><div class="big">${fr(at(p, "current_temperature"), 1)}<small>°C</small></div>
            <div class="grow" style="text-align:right">${stepper(fr(at(p, "temperature"), 1), "stove-temp", "°")}</div></div>
          <h2 style="margin-top:14px">Puissance</h2>
          <div class="seg">${[1, 2, 3, 4, 5].map((v) => `<button class="${n(C.poele_puissance) === v ? "on" : ""}" data-act="stove-pow" data-i="${v}">P${v}</button>`).join("")}</div>
          <dl class="kv" style="margin-top:14px">
            <dt>Fumées</dt><dd>${fr(n(C.poele_fumees))} °C</dd>
            <dt>Air</dt><dd>${fr(n(C.poele_air), 1)} °C</dd>
            <dt>Entretien</dt><dd style="color:${dj < 30 ? "var(--warn)" : "inherit"}">${dj >= 0 ? `dans ${dj} j` : `en retard de ${-dj} j`}</dd>
          </dl>
        </div>
        <div class="card">
          <h3>🪵 Granulés <span class="right">~${fr(jours)} jours</span></h3>
          <div class="row"><span class="grow">Trémie</span><b>${fr(tremie, 1)} / ${fr(tremieMax)} kg</b></div>
          <div style="margin:6px 0 12px">${bar((tremie / tremieMax) * 100, tremie < 4 ? "var(--bad)" : "var(--heat)")}</div>
          <dl class="kv">
            <dt>Stock maison</dt><dd>${fr(stock)} kg · ${fr(stock / 15)} sacs</dd>
            <dt>Consommation</dt><dd>${fr(conso, 1)} kg / jour</dd>
          </dl>
          <div class="btns" style="margin-top:14px">
            <button class="btn ${armed.fill ? "armed" : ""}" data-act="pellet-fill">${armed.fill ? "Confirmer : 1 sac versé" : "Trémie : verser un sac"}</button>
            <button class="btn" data-act="pellet-buy">Stock : + 1 sac</button>
          </div>
        </div>
      </div>

      <h2>Radiateurs</h2>
      <div class="grid small">
        ${C.radiateurs.map((id, i) => { const t = C.radiateurs_temp[i], h = C.radiateurs_hum[i], rOn = st(id) !== "off"; return `
          <div class="card" style="padding:14px;--c:var(--heat)">
            <div class="row"><b class="grow">${C.radiateurs_noms[i]}</b>${sw(rOn, "rad", i, "var(--heat)")}</div>
            <div class="big" style="font-size:1.6rem;margin:8px 0 2px">${t ? fr(n(t), 1) : fr(at(id, "current_temperature"), 1)}<small>°C</small></div>
            <div class="muted" style="font-size:.8rem;margin-bottom:10px">${h ? `💧 ${fr(n(h))} %` : "sans capteur d'humidité"}</div>
            ${rOn ? stepper(fr(at(id, "temperature"), 1), `rad-temp`, "°").replace(/data-act="rad-temp"/g, `data-act="rad-temp" data-i="${i}"`) : `<span class="muted">Éteint</span>`}
          </div>`; }).join("")}
      </div>

      <h2>Eau chaude</h2>
      <div class="grid">
        <div class="card" style="--c:var(--heat)">
          <h3>🚿 Ballon ${on(C.ballon_chauffe) ? `<span class="pill dot" style="--c:var(--heat)">Chauffe</span>` : ""} <span class="right">consigne ${fr(bc)} °C</span></h3>
          <div class="row"><div class="big">${fr(bt)}<small>°C</small></div><span class="grow muted" style="text-align:right">au milieu du ballon</span></div>
          <div style="margin:10px 0 14px">${bar((bt / bc) * 100, "var(--heat)")}</div>
          <div class="row"><span class="grow">Forcer la chauffe <span class="muted">(${boost ? "J1 · boost" : "J0 · normal"})</span></span>${sw(boost, "boiler-boost", "", "var(--heat)")}</div>
          <div class="row muted" style="font-size:.85rem"><span class="grow">Dernier entretien</span><span>${bEnt.toLocaleDateString("fr-FR")} · ${ago(bEnt.toISOString())}</span></div>
        </div>
      </div>`;
  }

  // ─── Actions
  const A = {
    "bat-min": (el) => { const v = clamp(n(C.batterie_min_pct) + 5 * +el.dataset.d, 0, 50); call("number.set_value", C.batterie_min_pct, () => set(C.batterie_min_pct, v), ` ${v}`); },
    "bat-max": (el) => { const v = clamp(n(C.batterie_max_pct) + 5 * +el.dataset.d, 70, 100); call("number.set_value", C.batterie_max_pct, () => set(C.batterie_max_pct, v), ` ${v}`); },
    "car-refresh": () => call("button.press", C.voiture_rafraichir, () => set(C.voiture_maj, new Date().toISOString())),
    "car-charge": () => { const o = on(C.voiture_en_charge); call(`switch.turn_${o ? "off" : "on"}`, C.voiture_en_charge, () => toggle(C.voiture_en_charge)); },
    "car-lock": () => {
      if (st(C.voiture_verrou) !== "locked") return call("lock.lock", C.voiture_verrou, () => set(C.voiture_verrou, "locked"));
      twoTap("unlock", "Appuie encore pour déverrouiller", () => call("lock.unlock", C.voiture_verrou, () => set(C.voiture_verrou, "unlocked")));
    },
    "car-clim": () => call("switch.toggle", C.voiture_clim, () => toggle(C.voiture_clim)),
    "car-hc": () => call("switch.toggle", C.voiture_heures_creuses, () => toggle(C.voiture_heures_creuses)),
    "car-prog": () => call("switch.toggle", C.voiture_programmee, () => toggle(C.voiture_programmee)),
    "car-lim": (el) => { const v = clamp(n(C.voiture_limite_pct) + 10 * +el.dataset.d, 50, 100); call("number.set_value", C.voiture_limite_pct, () => set(C.voiture_limite_pct, v), ` ${v}`); },
    "car-limdc": (el) => { const v = clamp(n(C.voiture_limite_dc_pct) + 10 * +el.dataset.d, 50, 100); call("number.set_value", C.voiture_limite_dc_pct, () => set(C.voiture_limite_dc_pct, v), ` ${v}`); },
    "car-service": () => call("input_number.set_value", C.entretien_dernier_km, () => set(C.entretien_dernier_km, n(C.voiture_odometre))),
    "car-service-km": () => {
      const v = parseInt(prompt("Kilométrage de l'entretien :", n(C.entretien_dernier_km)), 10);
      if (Number.isFinite(v)) call("input_number.set_value", C.entretien_dernier_km, () => set(C.entretien_dernier_km, v), ` ${v}`);
    },
    light: (el) => { const id = C.lumieres[el.dataset.i]; call("light.toggle", id, () => toggle(id)); },
    "lights-off": () => call("light.turn_off", "toutes les lumières", () => C.lumieres.forEach((id) => set(id, "off"))),
    cover: (el) => { const id = C.volets[el.dataset.i], p = +el.dataset.d; call("cover.set_cover_position", id, () => set(id, p ? "open" : "closed", { current_position: p }), ` ${p}`); },
    covers: (el) => { const p = +el.dataset.i; call("cover.set_cover_position", "tous les volets", () => C.volets.forEach((id) => set(id, p ? "open" : "closed", { current_position: p })), ` ${p}`); },
    plug: () => call("switch.toggle", C.prise_chambre, () => toggle(C.prise_chambre)),
    strip: (el) => { const id = C.multiprise[el.dataset.i]; call("switch.toggle", id, () => toggle(id)); },
    "robot-start": () => call("vacuum.start", C.robot, () => set(C.robot, "cleaning")),
    "robot-dock": () => call("vacuum.return_to_base", C.robot, () => set(C.robot, "returning")),
    "media-play": () => call("media_player.media_play_pause", C.homepod, () => toggle(C.homepod, "playing", "paused")),
    stove: () => call("climate.set_hvac_mode", C.poele, () => toggle(C.poele, "heat", "off")),
    "stove-temp": (el) => { const v = clamp(at(C.poele, "temperature") + 0.5 * +el.dataset.d, 15, 25); call("climate.set_temperature", C.poele, () => set(C.poele, st(C.poele), { temperature: v }), ` ${v}°`); },
    "stove-pow": (el) => call("number.set_value", C.poele_puissance, () => set(C.poele_puissance, el.dataset.i), ` ${el.dataset.i}`),
    "pellet-fill": () => twoTap("fill", "Appuie encore pour confirmer le sac versé", () =>
      call("script.turn_on", C.script_remplir, () => { set(C.tremie_kg, Math.min(n(C.tremie_kg) + 15, at(C.tremie_kg, "max") || 15)); set(C.stock_kg, Math.max(0, n(C.stock_kg) - 15)); })),
    "pellet-buy": () => call("script.turn_on", C.script_achat, () => set(C.stock_kg, n(C.stock_kg) + 15)),
    rad: (el) => { const id = C.radiateurs[el.dataset.i]; call("climate.set_hvac_mode", id, () => toggle(id, "heat", "off")); },
    "rad-temp": (el) => { const id = C.radiateurs[el.dataset.i]; const v = clamp(at(id, "temperature") + 0.5 * +el.dataset.d, 5, 28); call("climate.set_temperature", id, () => set(id, st(id), { temperature: v }), ` ${v}°`); },
    "boiler-boost": () => { const v = n(C.ballon_boost) === 1 ? 0 : 1; call("number.set_value", C.ballon_boost, () => { set(C.ballon_boost, v); set(C.ballon_chauffe, v ? "on" : "off"); }, ` ${v}`); },
  };

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el || el.tagName === "SELECT" || el.type === "range") return;
    const fn = A[el.dataset.act];
    if (fn) fn(el);
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset.act === "robot-scene") call("select.select_option", C.robot_scene, () => set(C.robot_scene, el.value), ` ${el.value}`);
    if (el.dataset.act === "media-vol") call("media_player.volume_set", C.homepod, () => set(C.homepod, st(C.homepod), { volume_level: el.value / 100 }), ` ${el.value} %`);
  });

  // ─── Navigation
  const tabs = document.querySelectorAll(".tabs button");
  function show(name) {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
    tabs.forEach((b) => b.classList.toggle("on", b.dataset.view === name));
    try { localStorage.setItem("voltia-tab", name); } catch (e) {}
    window.scrollTo({ top: 0 });
  }
  tabs.forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

  function renderAll() {
    renderTop();
    updateFlow();
    renderEnergie();
    renderVoiture();
    renderMaison();
    renderChauffage();
  }

  // Petite variation des puissances pour voir le flux « vivre » en démo
  function jitter() {
    const j = (id, pctVar, min = 0) => set(id, Math.max(min, Math.round(n(id) * (1 + (Math.random() - 0.5) * pctVar))));
    C.onduleurs_w.forEach((id) => j(id, 0.06));
    set(C.solaire_w, C.onduleurs_w.reduce((a, id) => a + n(id), 0));
    const e = energy();
    // le réseau équilibre : maison + voiture + batterie − solaire
    set(C.reseau_w, Math.round(1070 + e.car + e.bat - e.solar + (Math.random() - 0.5) * 120));
    renderTop();
    updateFlow();
    if (document.getElementById("view-energie").classList.contains("active")) renderEnergie();
  }

  buildFlow();
  renderAll();
  let start = "energie";
  try { start = localStorage.getItem("voltia-tab") || start; } catch (e) {}
  show(document.getElementById(`view-${start}`) ? start : "energie");
  setInterval(jitter, 4000);
})();
