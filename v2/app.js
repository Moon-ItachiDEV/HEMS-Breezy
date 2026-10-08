// Voltia v2 — mise en page « tableau de bord » (barre latérale, cartes, graphiques).
// Lit les mêmes rôles (../js/config.js) et les mêmes états (../js/mock.js) que la v1.
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
  const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };

  // ─── Calculs énergie
  function energy() {
    const solar = Math.max(0, n(C.solaire_w));
    const grid = n(C.reseau_w);
    const bat = C.batterie_inverse ? -n(C.batterie_w) : n(C.batterie_w); // + charge, − décharge
    const car = on(C.voiture_branchee) ? Math.max(0, n(C.voiture_charge_w)) : 0;
    const total = solar + grid - bat;
    return { solar, grid, bat, car, house: Math.max(0, total - car), total };
  }
  function tarifActuel() {
    const p = n(C.prix_kwh);
    const hit = [["HSC", n(C.tarif_hsc)], ["HC", n(C.tarif_hc)], ["HP", n(C.tarif_hp)]].find(([, v]) => Math.abs(v - p) < 1e-4);
    return { prix: p, nom: hit ? hit[0] : "" };
  }

  // ─── Historiques de démo (remplacés plus tard par l'historique Home Assistant)
  const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
  const HIST = {
    prod: HOURS.map((h) => +(5.2 * Math.exp(-((h - 13) ** 2) / (2 * 2.6 ** 2))).toFixed(2)),
    conso: HOURS.map((h) => +(0.7 + (h === 7 ? 1 : 0) + (h >= 9 && h <= 12 ? 2.3 : 0) + (h === 19 ? 1.5 : 0) + (h === 20 ? 0.8 : 0)).toFixed(2)),
  };
  HIST.achat = HOURS.map((h, i) => +Math.max(0, (HIST.conso[i] - HIST.prod[i]) * 0.45).toFixed(2));
  const JOURS = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 864e5).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""));
  const VE7 = { sol: [8.2, 0, 12.5, 6.1, 0, 9.8, 6.8], res: [2.1, 7.4, 0, 1.2, 5.6, 0, 2.1] };
  const AIR_H = Array.from({ length: 12 }, (_, i) => `${String(new Date(Date.now() - (11 - i) * 2 * 3600e3).getHours()).padStart(2, "0")}h`);
  const AIR = [19.2, 18.8, 18.4, 18.1, 18.0, 19.5, 20.6, 21.0, 20.8, 20.5, 20.3, 20.4];

  // ─── Graphiques (SVG, survol avec curseur + infobulle)
  const CHARTS = {};
  const VH = 130, PL = 30, PR = 6, PT = 8, PB = 18;
  const niceMax = (v) => { const p = 10 ** Math.floor(Math.log10(v || 1)); return Math.ceil(v / p / (v / p > 5 ? 2 : 1)) * p * (v / p > 5 ? 2 : 1); };
  const xAt = (i, len, vw) => PL + (i * (vw - PL - PR)) / Math.max(1, len - 1);
  const yAt = (v, max, min = 0) => PT + (1 - (v - min) / (max - min)) * (VH - PT - PB);
  function axes(labels, max, min, dec, xs, VW) {
    const ticks = [min, (min + max) / 2, max];
    const step = Math.ceil(labels.length / 6);
    return ticks.map((t) => `<line class="gl" x1="${PL}" x2="${VW - PR}" y1="${yAt(t, max, min)}" y2="${yAt(t, max, min)}"/>
      <text class="ax" x="${PL - 5}" y="${yAt(t, max, min) + 3}" text-anchor="end">${fr(t, dec)}</text>`).join("")
      + labels.map((l, i) => (i % step === 0 || i === labels.length - 1) ? `<text class="ax" x="${xs(i)}" y="${VH - 4}" text-anchor="middle">${l}</text>` : "").join("");
  }
  function lineChart(id, { labels, series, bars, unit, dec = 1, min = 0, max, w: VW = 320 }) {
    const all = series.flatMap((s) => s.data).concat(bars ? bars.data : []);
    const top = max ?? niceMax(Math.max(...all));
    const xs = (i) => xAt(i, labels.length, VW);
    const bw = Math.max(3, (VW - PL - PR) / labels.length - 4);
    const barsSvg = bars ? bars.data.map((v, i) => `<rect class="hb" x="${xs(i) - bw / 2}" y="${yAt(v, top, min)}" width="${bw}" height="${Math.max(0, VH - PB - yAt(v, top, min))}" rx="2"/>`).join("") : "";
    const lines = series.map((s) => `<path class="ln" stroke="${s.color}" d="${s.data.map((v, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${yAt(v, top, min).toFixed(1)}`).join(" ")}"/>`).join("");
    CHARTS[id] = { labels, series: bars ? [...series, bars] : series, unit, dec, top, min, xs, len: labels.length, VW };
    const legend = series.length + (bars ? 1 : 0) > 1
      ? `<div class="legend">${series.map((s) => `<span style="--c:${s.color}">${s.name}</span>`).join("")}${bars ? `<span style="--c:var(--faint)">${bars.name}</span>` : ""}</div>` : "";
    return `${legend}<div class="chart" data-chart="${id}">
      <svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${series.map((s) => s.name).join(", ")}">
        ${axes(labels, top, min, top < 5 ? 1 : 0, xs, VW)}${barsSvg}${lines}
        <line class="cross" y1="${PT}" y2="${VH - PB}" style="display:none"/>
        ${series.map((s) => `<circle class="dotc" r="4" fill="${s.color}" stroke="var(--card)" stroke-width="2" style="display:none"/>`).join("")}
      </svg><div class="tip"></div></div>`;
  }
  function stackChart(id, { labels, series, unit, dec = 1, w: VW = 320 }) {
    const totals = labels.map((_, i) => series.reduce((a, s) => a + s.data[i], 0));
    const top = niceMax(Math.max(...totals));
    const slot = (VW - PL - PR) / labels.length;
    const bw = Math.min(22, slot - 8);
    const xs = (i) => PL + slot * i + slot / 2;
    const rects = labels.map((_, i) => {
      let base = 0;
      return series.map((s) => {
        const v = s.data[i];
        if (v <= 0) return "";
        const y1 = yAt(base + v, top), y0 = yAt(base, top);
        base += v;
        return `<rect x="${xs(i) - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1 - 2)}" rx="2" fill="${s.color}"/>`;
      }).join("");
    }).join("");
    CHARTS[id] = { labels, series, unit, dec, top, min: 0, xs, len: labels.length, VW };
    return `<div class="legend">${series.map((s) => `<span style="--c:${s.color}">${s.name}</span>`).join("")}</div>
      <div class="chart" data-chart="${id}"><svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${series.map((s) => s.name).join(", ")}">
        ${axes(labels, top, 0, 0, xs, VW)}${rects}<line class="cross" y1="${PT}" y2="${VH - PB}" style="display:none"/></svg><div class="tip"></div></div>`;
  }
  document.addEventListener("pointermove", (ev) => {
    const box = ev.target.closest && ev.target.closest(".chart");
    document.querySelectorAll(".chart .tip.on").forEach((t) => { if (!box || !box.contains(t)) hideTip(t.parentNode); });
    if (!box) return;
    const c = CHARTS[box.dataset.chart];
    const svg = box.querySelector("svg");
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * c.VW;
    let i = 0, best = Infinity;
    for (let k = 0; k < c.len; k++) { const d = Math.abs(c.xs(k) - x); if (d < best) { best = d; i = k; } }
    const cross = svg.querySelector(".cross");
    cross.setAttribute("x1", c.xs(i)); cross.setAttribute("x2", c.xs(i)); cross.style.display = "";
    svg.querySelectorAll(".dotc").forEach((d, k) => {
      d.setAttribute("cx", c.xs(i)); d.setAttribute("cy", yAt(c.series[k].data[i], c.top, c.min)); d.style.display = "";
    });
    const tip = box.querySelector(".tip");
    tip.innerHTML = `<b>${c.labels[i]}</b><br>${c.series.map((s) => `${s.name} : ${fr(s.data[i], c.dec)} ${c.unit}`).join("<br>")}`;
    tip.style.left = `${(c.xs(i) / c.VW) * 100}%`;
    tip.style.top = "0";
    tip.classList.add("on");
  });
  function hideTip(box) {
    box.querySelector(".tip").classList.remove("on");
    box.querySelector(".cross").style.display = "none";
    box.querySelectorAll(".dotc").forEach((d) => (d.style.display = "none"));
  }

  // ─── Commandes simulées
  const toastEl = document.getElementById("toast");
  let toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("show"), 2200); }
  function call(service, entity_id, mutate, extra = "") { mutate && mutate(); toast(`Démo · ${service}${extra} → ${entity_id}`); render(); }
  const set = (id, state, attrs) => { H[id].state = String(state); if (attrs) Object.assign(H[id].attributes, attrs); };
  const toggle = (id, a = "on", b = "off") => set(id, st(id) === a ? b : a);
  const armed = {};
  function twoTap(key, label, fn) {
    if (armed[key]) { clearTimeout(armed[key]); delete armed[key]; fn(); return; }
    armed[key] = setTimeout(() => { delete armed[key]; render(); }, 3000);
    toast(label); render();
  }

  // ─── Petits composants
  const bar = (v, c = "var(--yellow)", mk) => `<div class="bar" style="--c:${c}"><i style="width:${pct(v)}"></i>${mk != null ? `<span class="mk" style="left:${pct(mk)}"></span>` : ""}</div>`;
  const sw = (isOn, act, i = "") => `<button class="sw ${isOn ? "on" : ""}" data-act="${act}" data-i="${i}" aria-pressed="${isOn}"></button>`;
  const stepper = (val, act, i = "") => `<div class="step"><button data-act="${act}" data-i="${i}" data-d="-1">−</button><b>${val}</b><button data-act="${act}" data-i="${i}" data-d="1">+</button></div>`;
  const split = (a, b, ca = "var(--yellow)", cb = "var(--purple)") => {
    const t = a + b || 1;
    return `<div class="split-bar"><i style="width:${(a / t) * 100}%;background:${ca}"></i><i style="width:${(b / t) * 100}%;background:${cb}"></i></div>`;
  };
  const kvIt = (lbl, val, extra = "") => `<div class="it"><div class="lbl">${lbl}${extra}</div><div class="val">${val}</div></div>`;

  // ─── En-tête
  const METEO = { sunny: "☀️", "clear-night": "🌙", partlycloudy: "⛅", cloudy: "☁️", rainy: "🌧️", pouring: "🌧️", snowy: "❄️", fog: "🌫️", windy: "💨", lightning: "⛈️" };
  function renderTop() {
    const t = tarifActuel();
    document.getElementById("chips").innerHTML = `
      <span class="chip hide-m">${METEO[st(C.meteo)] || "🌡️"} ${fr(at(C.meteo, "temperature"))} °C</span>
      <span class="chip"><span class="dot">€</span>${t.nom ? `${t.nom} · ` : ""}${fr(t.prix, 4)} €</span>
      <span class="chip">+${fr(n(C.economies_jour_eur), 2)} € <span class="tag">aujourd'hui</span></span>`;
  }

  // ─── Page Énergie
  function pageEnergie() {
    const e = energy(), t = tarifActuel();
    const prod = n(C.production_jour_kwh), prev = n(C.prevision_jour_kwh);
    const soc = n(C.batterie_soc), min = n(C.batterie_min_pct), max = n(C.batterie_max_pct);
    const autoconso = e.solar > 0 ? clamp((1 - Math.max(0, -e.grid) / e.solar) * 100, 0, 100) : 0;
    const imp = n(C.import_jour_kwh), exp = n(C.export_jour_kwh);
    const rend = (n(C.batterie_total_decharge_kwh) / n(C.batterie_total_charge_kwh)) * 100;
    return `
      <div class="page-head"><h1>Mon énergie</h1>
        <div class="actions">
          <button class="btn o" data-act="lights-off">💡 <span class="txt">Tout éteindre</span></button>
          <button class="btn w" data-act="car-charge">⚡ <span class="txt">${on(C.voiture_en_charge) ? "Arrêter la recharge" : "Recharger la voiture"}</span></button>
        </div></div>
      <div class="grid">
        <div class="card">
          <h3>Production solaire</h3>
          <div class="hero"><b>${fr(e.solar / 1000, 2)}<small>kW</small></b><span class="pill y">Prévu ${fr(prev, 1)} kWh</span></div>
          <div class="prog">${bar((prod / prev) * 100)}<span class="lbl">${fr(prod, 1)} / ${fr(prev, 1)} kWh</span></div>
          ${lineChart("prod", { labels: HOURS.map((h) => `${h}h`), series: [{ name: "Production", color: "var(--yellow)", data: HIST.prod }], unit: "kW", dec: 2 })}
          <div class="foot btns">
            ${C.onduleurs_w.map((id, i) => `<div><div class="lbl">${C.onduleurs_noms[i].replace(" W", "")}</div><div class="val">${Wt(n(id))}</div></div>`).join("")}
          </div>
        </div>

        <div class="card">
          <h3>Bilan en direct</h3>
          <div class="kv">
            ${kvIt("Consommation maison", Wt(e.house), `<span class="lbl">hors voiture</span>`)}
            ${kvIt(e.grid < 0 ? "Revendu au réseau" : "Acheté au réseau", Wt(Math.abs(e.grid)), `<span class="pill ${e.grid < 0 ? "g" : ""}">${e.grid < 0 ? "export" : "import"}</span>`)}
            ${kvIt(e.bat >= 0 ? "Batterie en charge" : "Batterie en décharge", Wt(Math.abs(e.bat)), `<span class="lbl">${fr(soc)} %</span>`)}
            ${kvIt("Recharge voiture", on(C.voiture_branchee) ? Wt(e.car) : "débranchée", `<span class="lbl">${fr(n(C.voiture_soc))} %</span>`)}
          </div>
          <div class="total"><span class="lbl">Autoconsommation</span><span class="val">${fr(autoconso)} %</span></div>
          <div class="foot"><button class="btn y full" data-page="voiture">Voir la recharge</button></div>
        </div>

        <div class="card">
          <h3><div>Batterie SolarFlow<small>${fr(soc)} % · ${fr(n(C.batterie_dispo_kwh), 1)} kWh disponibles · ${fr(n(C.batterie_temp))} °C</small></div></h3>
          <div class="prog">${bar(soc, "var(--green)", max)}<span class="lbl">min ${fr(min)} % · max ${fr(max)} %</span></div>
          <div class="list">
            ${C.packs_soc.map((id, i) => `
              <div class="li"><span class="ico g">${i + 1}</span>
                <div class="t"><b>Pack AB3000 n°${i + 1}</b><span>${fr(n(C.packs_temp[i]))} °C · ${Wt(n(C.packs_w[i]))}</span></div>
                <div class="x">${fr(n(id))} %</div></div>`).join("")}
            <div class="li"><span class="ico">↓</span><div class="t"><b>Limite de décharge</b><span>la batterie s'arrête à</span></div>${stepper(`${fr(min)} %`, "bat-min")}</div>
            <div class="li"><span class="ico">↑</span><div class="t"><b>Limite de charge</b><span>la batterie se remplit jusqu'à</span></div>${stepper(`${fr(max)} %`, "bat-max")}</div>
          </div>
          <div class="total"><span class="lbl">Rendement depuis l'installation</span><span class="val">${fr(rend, 1)} %</span></div>
        </div>
      </div>

      <h2 class="sec">Réseau et tarifs</h2>
      <div class="grid wide">
        <div class="card">
          <h3>Aujourd'hui</h3>
          <div class="lbl">Échangé avec le réseau</div>
          <div class="val" style="font-size:1.1rem;margin-bottom:18px">${fr(imp + exp, 1)} kWh</div>
          <div class="kv" style="gap:8px;margin-bottom:12px">
            <div class="row" style="display:flex;justify-content:space-between"><span class="legend" style="margin:0"><span style="--c:var(--purple)">Acheté</span></span><b>${fr(imp, 1)} kWh</b></div>
            <div class="row" style="display:flex;justify-content:space-between"><span class="legend" style="margin:0"><span style="--c:var(--yellow)">Revendu</span></span><b>${fr(exp, 1)} kWh</b></div>
          </div>
          <div class="foot">${split(imp, exp, "var(--purple)", "var(--yellow)")}</div>
        </div>
        <div class="card">
          <h3>Tarifs <span class="r">${t.nom ? `en ce moment : ${t.nom}` : ""}</span></h3>
          <div class="grid g2" style="gap:16px 12px">
            <div><div class="lbl">Heures pleines</div><div class="val">${fr(n(C.tarif_hp), 4)} €</div></div>
            <div><div class="lbl">Heures creuses</div><div class="val">${fr(n(C.tarif_hc), 4)} €</div></div>
            <div><div class="lbl">Super creuses</div><div class="val">${fr(n(C.tarif_hsc), 4)} €</div></div>
            <div><div class="lbl">Super creuses dès</div><div class="val">${st(C.tarif_hsc_debut).slice(0, 5)}</div></div>
          </div>
          <div class="foot total" style="margin-top:auto"><span class="lbl">Économisé aujourd'hui</span><span class="val" style="color:var(--green)">${fr(n(C.economies_jour_eur), 2)} €</span></div>
        </div>
        <div class="card">
          <h3>Production et consommation <span class="r">aujourd'hui, en kW</span></h3>
          ${lineChart("pc", { labels: HOURS.map((h) => `${h}h`), series: [{ name: "Production", color: "var(--yellow)", data: HIST.prod }, { name: "Consommation", color: "var(--purple)", data: HIST.conso }], bars: { name: "Achat réseau", data: HIST.achat }, unit: "kW", dec: 2, w: window.innerWidth > 1180 ? 440 : window.innerWidth > 720 ? 640 : 320 })}
        </div>
      </div>`;
  }

  // ─── Page Voiture
  function pageVoiture() {
    const soc = n(C.voiture_soc), lim = n(C.voiture_limite_pct);
    const plugged = on(C.voiture_branchee), charging = plugged && on(C.voiture_en_charge);
    const locked = st(C.voiture_verrou) === "locked";
    const fin = new Date(Date.now() + n(C.voiture_minutes_restantes) * 60e3);
    const sol = n(C.session_sol_kwh), res = n(C.session_res_kwh);
    const totS = n(C.ve_solaire_kwh), totR = n(C.ve_reseau_kwh);
    const odo = n(C.voiture_odometre), last = n(C.entretien_dernier_km), next = last + C.entretien_intervalle_km;
    return `
      <div class="page-head"><h1>Kia e-Niro</h1>
        <div class="actions">
          <button class="btn o" data-act="car-refresh">⟳ <span class="txt">MAJ ${ago(st(C.voiture_maj))}</span></button>
          <button class="btn ${armed.unlock ? "danger" : "w"}" data-act="car-lock">${locked ? (armed.unlock ? "🔓 Confirmer" : "🔒 <span class='txt'>Verrouillée</span>") : "🔓 <span class='txt'>Verrouiller</span>"}</button>
        </div></div>
      <div class="grid">
        <div class="card">
          <h3>Batterie</h3>
          <div class="hero"><b>${fr(soc)}<small>%</small></b><span class="pill">${fr(n(C.voiture_autonomie_km))} km</span></div>
          <div class="prog">${bar(soc, "var(--yellow)", lim)}<span class="lbl">Limite ${fr(lim)} %</span></div>
          ${stackChart("ve7", { labels: JOURS, series: [{ name: "Solaire", color: "var(--yellow)", data: VE7.sol }, { name: "Réseau", color: "var(--purple)", data: VE7.res }], unit: "kWh" })}
          <div class="foot">${plugged
            ? `<button class="btn full ${charging ? "" : "y"}" data-act="car-charge">⚡ ${charging ? "Arrêter la recharge" : "Démarrer la recharge"}</button>`
            : `<button class="btn full" disabled style="opacity:.5">Voiture débranchée</button>`}</div>
        </div>

        <div class="card">
          <h3>Cette charge ${charging ? `<span class="pill y live" style="margin-left:auto">${Wt(n(C.voiture_charge_w))}</span>` : ""}</h3>
          <div class="kv">
            ${kvIt("Branchée depuis", hhmm(new Date(st(C.session_debut))))}
            ${kvIt("Batterie gagnée", `+${fr(n(C.session_soc))} %`)}
            ${kvIt("Solaire", `${fr(sol, 1)} kWh`, `<span class="lbl">${Wt(n(C.ve_solaire_w))}</span>`)}
            ${kvIt("Réseau", `${fr(res, 1)} kWh`, `<span class="lbl">${Wt(n(C.ve_reseau_w))}</span>`)}
            ${charging ? kvIt("Fin estimée", hhmm(fin)) : ""}
          </div>
          <div class="total"><span class="lbl">Part solaire</span><span class="val">${fr((sol / (sol + res)) * 100)} %</span></div>

        </div>

        <div class="card">
          <h3>Réglages</h3>
          <div class="list">
            <div class="li"><span class="ico">🌙</span><div class="t"><b>Heures creuses seulement</b><span>ne charge qu'en HC</span></div>${sw(on(C.voiture_heures_creuses), "car-hc")}</div>
            <div class="li"><span class="ico">🕑</span><div class="t"><b>Charge programmée</b><span>selon l'horaire de la voiture</span></div>${sw(on(C.voiture_programmee), "car-prog")}</div>
            <div class="li"><span class="ico">❄️</span><div class="t"><b>Climatisation</b><span>préconditionnement</span></div>${sw(on(C.voiture_clim), "car-clim")}</div>
            <div class="li"><span class="ico">🏠</span><div class="t"><b>Limite à la maison</b><span>AC</span></div>${stepper(`${fr(lim)} %`, "car-lim")}</div>
            <div class="li"><span class="ico">⚡</span><div class="t"><b>Limite recharge rapide</b><span>DC</span></div>${stepper(`${fr(n(C.voiture_limite_dc_pct))} %`, "car-limdc")}</div>
          </div>
        </div>
      </div>

      <h2 class="sec">Suivi</h2>
      <div class="grid">
        <div class="card">
          <h3>Entretien <span class="r">${fr(odo)} km</span></h3>
          <div class="hero"><b>${fr(Math.abs(next - odo))}<small>km</small></b><span class="pill ${next - odo < 1000 ? "y" : ""}">${next - odo >= 0 ? "avant l'entretien" : "de retard"}</span></div>
          <div class="prog">${bar(((odo - last) / C.entretien_intervalle_km) * 100)}<span class="lbl">prochain à ${fr(next)} km</span></div>
          <div class="foot btns"><button class="btn" data-act="car-service">✓ Entretien fait</button><button class="btn o" data-act="car-service-km">Autre km…</button></div>
        </div>
        <div class="card">
          <h3>Depuis le début</h3>
          <div class="lbl">Énergie mise dans la voiture</div>
          <div class="val" style="font-size:1.1rem;margin-bottom:18px">${fr(totS + totR)} kWh</div>
          <div class="kv" style="gap:8px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between"><span class="legend" style="margin:0"><span style="--c:var(--yellow)">Solaire</span></span><b>${fr(totS)} kWh</b></div>
            <div style="display:flex;justify-content:space-between"><span class="legend" style="margin:0"><span style="--c:var(--purple)">Réseau</span></span><b>${fr(totR)} kWh</b></div>
          </div>
          <div class="foot">${split(totS, totR)}</div>
        </div>
        <div class="card">
          <h3>État</h3>
          <div class="kv">
            ${kvIt("Batterie 12 V", `${fr(n(C.voiture_12v_pct))} %`)}
            ${kvIt("Dernier trajet", ago(st(C.voiture_dernier_trajet)))}
            ${kvIt("Depuis ce trajet", `${fr(soc - n(C.voiture_soc_reference))} %`)}
            ${kvIt("Capacité utile", `${C.voiture_capacite_kwh} kWh`)}
          </div>
        </div>
      </div>`;
  }

  // ─── Page Maison
  function pageMaison() {
    const hp = C.homepod, playing = st(hp) === "playing";
    const nbOn = C.lumieres.filter(on).length;
    const robotEtat = { docked: "Sur sa base", cleaning: "Nettoyage en cours", returning: "Retour à la base", idle: "En pause" }[st(C.robot)] || st(C.robot);
    return `
      <div class="page-head"><h1>Ma maison</h1>
        <div class="actions">
          <button class="btn o" data-act="covers" data-i="0">▼ <span class="txt">Fermer les volets</span></button>
          <button class="btn w" data-act="covers" data-i="100">▲ <span class="txt">Ouvrir les volets</span></button>
        </div></div>
      <div class="grid">
        <div class="card">
          <h3><div>Lumières<small>${nbOn} allumée${nbOn > 1 ? "s" : ""} sur ${C.lumieres.length}</small></div><span class="r"><button class="btn sm" data-act="lights-off">Tout éteindre</button></span></h3>
          <div class="list">${C.lumieres.map((id, i) => `
            <div class="li"><span class="ico ${on(id) ? "y" : ""}">💡</span><div class="t"><b>${C.lumieres_noms[i]}</b><span>${on(id) ? "Allumée" : "Éteinte"}</span></div>${sw(on(id), "light", i)}</div>`).join("")}</div>
        </div>
        <div class="card">
          <h3>Volets</h3>
          <div class="list">${C.volets.map((id, i) => { const p = at(id, "current_position"); return `
            <div class="li"><span class="shut"><i style="height:${100 - p}%"></i></span><div class="t"><b>${C.volets_noms[i]}</b><span>${p === 0 ? "Fermé" : p === 100 ? "Ouvert" : `Ouvert à ${p} %`}</span></div>
              <button class="btn sm" data-act="cover" data-i="${i}" data-d="100" aria-label="Ouvrir">▲</button><button class="btn sm" data-act="cover" data-i="${i}" data-d="0" aria-label="Fermer">▼</button></div>`; }).join("")}</div>
        </div>
        <div class="card">
          <h3>Prises</h3>
          <div class="hero"><b>${on(C.prise_chambre) ? fr(n(C.prise_chambre_w)) : 0}<small>W</small></b><span class="pill">${fr(n(C.prise_chambre_kwh), 2)} kWh</span></div>
          <div class="list">
            <div class="li"><span class="ico ${on(C.prise_chambre) ? "y" : ""}">🔌</span><div class="t"><b>Prise chambre</b><span>Eve Energy</span></div>${sw(on(C.prise_chambre), "plug")}</div>
            ${C.multiprise.map((id, i) => `<div class="li"><span class="ico ${on(id) ? "p" : ""}">${i < 4 ? i + 1 : "⎓"}</span><div class="t"><b>${C.multiprise_noms[i]}</b><span>Multiprise</span></div>${sw(on(id), "strip", i)}</div>`).join("")}
          </div>
        </div>
      </div>
      <h2 class="sec">Appareils</h2>
      <div class="grid g2">
        <div class="card">
          <h3>Robot aspirateur <span class="r">🔋 ${fr(n(C.robot_batterie))} %</span></h3>
          <div class="hero"><b style="font-size:1.2rem">${robotEtat}</b></div>
          <div class="lbl" style="margin-bottom:6px">Zone à nettoyer</div>
          <select class="sel" data-act="robot-scene">${(at(C.robot_scene, "options") || []).map((o) => `<option ${o === st(C.robot_scene) ? "selected" : ""}>${o}</option>`).join("")}</select>
          <div class="foot btns"><button class="btn" data-act="robot-dock">⌂ Retour base</button><button class="btn y" data-act="robot-start">▶ Lancer</button></div>
        </div>
        <div class="card">
          <h3>HomePod salon <span class="r">${playing ? "Lecture" : "En pause"}</span></h3>
          <div class="hero"><div><b style="font-size:1.2rem;display:block">${at(hp, "media_title") || "—"}</b><span class="lbl">${at(hp, "media_artist") || ""}</span></div></div>
          <div class="lbl" style="margin-bottom:6px">Volume</div>
          <input type="range" min="0" max="100" value="${Math.round((at(hp, "volume_level") || 0) * 100)}" data-act="media-vol" aria-label="Volume">
          <div class="foot"><button class="btn full ${playing ? "" : "y"}" data-act="media-play">${playing ? "⏸ Pause" : "▶ Lecture"}</button></div>
        </div>
      </div>`;
  }

  // ─── Page Chauffage
  function pageChauffage() {
    const p = C.poele, pOn = st(p) !== "off";
    const tremie = n(C.tremie_kg), stock = n(C.stock_kg), conso = n(C.conso_jour_kg);
    const tremieMax = at(C.tremie_kg, "max") || 15;
    const jours = conso > 0 ? (tremie + stock) / conso : NaN;
    const due = addMonths(new Date(st(C.poele_entretien)), C.poele_entretien_mois);
    const dj = Math.round((due - Date.now()) / 864e5);
    const bt = n(C.ballon_temp), bc = at(C.ballon, "temperature");
    const boost = n(C.ballon_boost) === 1;
    return `
      <div class="page-head"><h1>Chauffage</h1>
        <div class="actions">
          <button class="btn ${armed.fill ? "danger" : "o"}" data-act="pellet-fill">🪵 <span class="txt">${armed.fill ? "Confirmer le sac" : "Verser un sac"}</span></button>
          <button class="btn w" data-act="boiler-boost">🚿 <span class="txt">${boost ? "Arrêter la chauffe forcée" : "Forcer le ballon"}</span></button>
        </div></div>
      <div class="grid">
        <div class="card">
          <h3>Poêle à granulés <span class="r">${sw(pOn, "stove")}</span></h3>
          <div class="hero"><b>${fr(at(p, "current_temperature"), 1)}<small>°C</small></b><span class="pill ${pOn ? "y" : ""}">${st(C.poele_statut)}</span></div>
          <div class="prog">${bar(((at(p, "current_temperature") - 15) / 10) * 100, "var(--orange)", ((at(p, "temperature") - 15) / 10) * 100)}<span class="lbl">consigne ${fr(at(p, "temperature"), 1)} °C</span></div>
          ${lineChart("air", { labels: AIR_H, series: [{ name: "Air", color: "var(--orange)", data: AIR }], unit: "°C", dec: 1, min: 16, max: 22 })}
          <div class="foot"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="lbl">Consigne</span>${stepper(`${fr(at(p, "temperature"), 1)}°`, "stove-temp")}</div>
            <div class="seg">${[1, 2, 3, 4, 5].map((v) => `<button class="${n(C.poele_puissance) === v ? "on" : ""}" data-act="stove-pow" data-i="${v}">P${v}</button>`).join("")}</div></div>
        </div>

        <div class="card">
          <h3>Granulés</h3>
          <div class="kv">
            ${kvIt("Trémie", `${fr(tremie, 1)} kg`, `<span class="lbl">sur ${fr(tremieMax)} kg</span>`)}
            ${kvIt("Stock maison", `${fr(stock)} kg`, `<span class="lbl">${fr(stock / 15)} sacs</span>`)}
            ${kvIt("Consommation", `${fr(conso, 1)} kg / jour`)}
            ${kvIt("Fumées / air", `${fr(n(C.poele_fumees))} °C · ${fr(n(C.poele_air), 1)} °C`)}
          </div>
          <div class="total"><span class="lbl">Autonomie totale</span><span class="val">~${fr(jours)} jours</span></div>
          <div class="foot"><button class="btn y full" data-act="pellet-buy">+ 1 sac au stock</button></div>
        </div>

        <div class="card">
          <h3>Radiateurs</h3>
          <div class="list">${C.radiateurs.map((id, i) => { const t = C.radiateurs_temp[i], h = C.radiateurs_hum[i], rOn = st(id) !== "off"; return `
            <div class="li" style="flex-wrap:wrap"><span class="ico ${rOn ? "o" : ""}">🌡️</span>
              <div class="t"><b>${C.radiateurs_noms[i]}</b><span>${t ? fr(n(t), 1) : fr(at(id, "current_temperature"), 1)} °C${h ? ` · 💧&nbsp;${fr(n(h))}&nbsp;%` : ""}</span></div>
              ${rOn ? stepper(`${fr(at(id, "temperature"), 1)}°`, "rad-temp", i) : `<span class="lbl">éteint</span>`}${sw(rOn, "rad", i)}</div>`; }).join("")}</div>
        </div>
      </div>

      <h2 class="sec">Eau chaude et entretiens</h2>
      <div class="grid g2">
        <div class="card">
          <h3>Ballon d'eau chaude ${on(C.ballon_chauffe) ? `<span class="pill y live" style="margin-left:auto">Chauffe</span>` : ""}</h3>
          <div class="hero"><b>${fr(bt)}<small>°C</small></b><span class="pill">consigne ${fr(bc)} °C</span></div>
          <div class="prog">${bar((bt / bc) * 100, "var(--orange)")}<span class="lbl">au milieu du ballon</span></div>
          <div class="list"><div class="li"><span class="ico ${boost ? "y" : ""}">⚡</span><div class="t"><b>Forcer la chauffe</b><span>${boost ? "J1 · boost" : "J0 · normal"}</span></div>${sw(boost, "boiler-boost")}</div></div>
        </div>
        <div class="card">
          <h3>Entretiens</h3>
          <div class="list">
            <div class="li"><span class="ico ${dj < 30 ? "y" : ""}">🔥</span><div class="t"><b>Poêle</b><span>fait le ${new Date(st(C.poele_entretien)).toLocaleDateString("fr-FR")}</span></div><div class="x">${dj >= 0 ? `dans ${dj} j` : `en retard de ${-dj} j`}</div></div>
            <div class="li"><span class="ico">🚿</span><div class="t"><b>Ballon</b><span>fait le ${new Date(st(C.ballon_entretien)).toLocaleDateString("fr-FR")}</span></div><div class="x">${ago(new Date(st(C.ballon_entretien)).toISOString())}</div></div>
            <div class="li"><span class="ico">🚗</span><div class="t"><b>e-Niro</b><span>tous les ${fr(C.entretien_intervalle_km)} km</span></div><div class="x">dans ${fr(n(C.entretien_dernier_km) + C.entretien_intervalle_km - n(C.voiture_odometre))} km</div></div>
          </div>
        </div>
      </div>`;
  }

  // ─── Actions
  const stepNum = (id, d, step, lo, hi) => clamp(n(id) + step * d, lo, hi);
  const A = {
    "bat-min": (el) => { const v = stepNum(C.batterie_min_pct, +el.dataset.d, 5, 0, 50); call("number.set_value", C.batterie_min_pct, () => set(C.batterie_min_pct, v), ` ${v}`); },
    "bat-max": (el) => { const v = stepNum(C.batterie_max_pct, +el.dataset.d, 5, 70, 100); call("number.set_value", C.batterie_max_pct, () => set(C.batterie_max_pct, v), ` ${v}`); },
    "car-refresh": () => call("button.press", C.voiture_rafraichir, () => set(C.voiture_maj, new Date().toISOString())),
    "car-charge": () => call(`switch.turn_${on(C.voiture_en_charge) ? "off" : "on"}`, C.voiture_en_charge, () => toggle(C.voiture_en_charge)),
    "car-lock": () => {
      if (st(C.voiture_verrou) !== "locked") return call("lock.lock", C.voiture_verrou, () => set(C.voiture_verrou, "locked"));
      twoTap("unlock", "Appuie encore pour déverrouiller", () => call("lock.unlock", C.voiture_verrou, () => set(C.voiture_verrou, "unlocked")));
    },
    "car-clim": () => call("switch.toggle", C.voiture_clim, () => toggle(C.voiture_clim)),
    "car-hc": () => call("switch.toggle", C.voiture_heures_creuses, () => toggle(C.voiture_heures_creuses)),
    "car-prog": () => call("switch.toggle", C.voiture_programmee, () => toggle(C.voiture_programmee)),
    "car-lim": (el) => { const v = stepNum(C.voiture_limite_pct, +el.dataset.d, 10, 50, 100); call("number.set_value", C.voiture_limite_pct, () => set(C.voiture_limite_pct, v), ` ${v}`); },
    "car-limdc": (el) => { const v = stepNum(C.voiture_limite_dc_pct, +el.dataset.d, 10, 50, 100); call("number.set_value", C.voiture_limite_dc_pct, () => set(C.voiture_limite_dc_pct, v), ` ${v}`); },
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
    const nav = ev.target.closest("[data-page]");
    if (nav) return show(nav.dataset.page);
    const el = ev.target.closest("[data-act]");
    if (!el || el.tagName === "SELECT" || el.type === "range") return;
    A[el.dataset.act] && A[el.dataset.act](el);
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset.act === "robot-scene") call("select.select_option", C.robot_scene, () => set(C.robot_scene, el.value), ` ${el.value}`);
    if (el.dataset.act === "media-vol") call("media_player.volume_set", C.homepod, () => set(C.homepod, st(C.homepod), { volume_level: el.value / 100 }), ` ${el.value} %`);
  });

  // ─── Navigation et rendu
  const PAGES = { energie: pageEnergie, voiture: pageVoiture, maison: pageMaison, chauffage: pageChauffage };
  let current = "energie";
  try { const s = localStorage.getItem("voltia-v2-page"); if (PAGES[s]) current = s; } catch (e) {}
  function show(name) {
    current = name;
    try { localStorage.setItem("voltia-v2-page", name); } catch (e) {}
    document.querySelectorAll("[data-page]").forEach((b) => b.classList.toggle("on", b.dataset.page === name));
    render();
    window.scrollTo({ top: 0 });
  }
  function render() {
    renderTop();
    const el = document.getElementById("page");
    el.innerHTML = PAGES[current]();
    el.className = "page on";
  }
  const bp = () => (window.innerWidth > 1180 ? 2 : window.innerWidth > 720 ? 1 : 0);
  let lastBp = bp();
  window.addEventListener("resize", () => { if (bp() !== lastBp) { lastBp = bp(); render(); } });
  show(current);
})();
