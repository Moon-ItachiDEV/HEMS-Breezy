// Breezy HEMS V3 — cœur : accès aux états, commandes, modèle énergétique, historique, formatage.
// Aucune présentation ici : les pages lisent ce module et ne touchent jamais directement aux entités.
(() => {
  const BZ = (window.BZ = window.BZ || {});
  const C = window.VOLTIA_CONFIG;
  const S = window.MOCK_STATES;

  /* ─── États ─────────────────────────────────────────────────────── */
  const ent = (id) => S[id] || { state: "unavailable", attributes: {} };
  const st = (id) => ent(id).state;
  const num = (id) => { const v = parseFloat(st(id)); return Number.isFinite(v) ? v : NaN; };
  const attr = (id, a) => ent(id).attributes[a];
  const isOn = (id) => ["on", "open", "playing", "heat", "unlocked", "cleaning"].includes(st(id));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const listeners = new Set();
  let frame = 0;
  const notify = () => { if (frame) return; frame = requestAnimationFrame(() => { frame = 0; listeners.forEach((f) => f()); }); };
  const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };
  const patch = (id, state, attrs) => {
    if (!S[id]) S[id] = { entity_id: id, state: "", attributes: {} };
    if (state != null) S[id].state = String(state);
    if (attrs) Object.assign(S[id].attributes, attrs);
  };

  /* ─── Commandes : mêmes services que Home Assistant ──────────────────
     En démo, chaque service modifie l'état local après un court délai, pour
     montrer l'état « en cours ». Branché sur HA, seul `transport` change. */
  const pending = new Set();
  const SERVICES = {
    "light.toggle": (id) => patch(id, isOn(id) ? "off" : "on"),
    "light.turn_off": (id) => patch(id, "off"),
    "switch.toggle": (id) => patch(id, isOn(id) ? "off" : "on"),
    "switch.turn_on": (id) => patch(id, "on"),
    "switch.turn_off": (id) => patch(id, "off"),
    "cover.set_cover_position": (id, d) => patch(id, d.position > 0 ? "open" : "closed", { current_position: d.position }),
    "climate.set_temperature": (id, d) => patch(id, null, { temperature: d.temperature }),
    "climate.set_hvac_mode": (id, d) => patch(id, d.hvac_mode),
    "number.set_value": (id, d) => patch(id, d.value),
    "input_number.set_value": (id, d) => patch(id, d.value),
    "lock.lock": (id) => patch(id, "locked"),
    "lock.unlock": (id) => patch(id, "unlocked"),
    "button.press": (id) => { if (id === C.voiture_rafraichir) patch(C.voiture_maj, new Date().toISOString()); },
    "vacuum.start": (id) => patch(id, "cleaning", { started_at: new Date().toISOString() }),
    "vacuum.pause": (id) => patch(id, "paused"),
    // Démo : le retour à la base prend quelques secondes, puis l'aspirateur se recharge
    "vacuum.return_to_base": (id) => { patch(id, "returning"); setTimeout(() => { if (st(id) === "returning") { patch(id, "docked"); notify(); } }, 8000); },
    "vacuum.locate": () => {},
    "vacuum.set_fan_speed": (id, d) => patch(id, null, { fan_speed: d.fan_speed }),
    "select.select_option": (id, d) => patch(id, d.option),
    "media_player.media_play_pause": (id) => patch(id, st(id) === "playing" ? "paused" : "playing"),
    "media_player.media_next_track": () => {},
    "media_player.media_previous_track": () => {},
    "media_player.volume_set": (id, d) => patch(id, null, { volume_level: d.volume_level }),
    "script.turn_on": (id) => {
      if (id === C.script_remplir) { patch(C.tremie_kg, Math.min(num(C.tremie_kg) + 15, attr(C.tremie_kg, "max") || 30)); patch(C.stock_kg, Math.max(0, num(C.stock_kg) - 15)); }
      if (id === C.script_achat) patch(C.stock_kg, num(C.stock_kg) + 15);
    },
  };
  const transport = (service, ids, data) => new Promise((resolve) => setTimeout(() => { ids.forEach((id) => SERVICES[service] && SERVICES[service](id, data)); resolve(); }, 280));
  async function call(service, target, data = {}) {
    const ids = [].concat(target);
    ids.forEach((id) => pending.add(id));
    notify();
    try { await transport(service, ids, data); }
    finally { ids.forEach((id) => pending.delete(id)); notify(); }
  }
  const isPending = (id) => pending.has(id);

  /* ─── Modèle énergétique en direct ─────────────────────────────────── */
  function live() {
    const solar = Math.max(0, num(C.solaire_w));
    const grid = num(C.reseau_w);                                   // + achat, − revente
    const bat = C.batterie_inverse ? -num(C.batterie_w) : num(C.batterie_w); // + charge, − décharge
    const plugged = isOn(C.voiture_branchee), charging = plugged && isOn(C.voiture_en_charge);
    const car = plugged ? Math.max(0, num(C.voiture_charge_w)) : 0;
    const total = solar + grid - bat;
    const evSun = Math.max(0, num(C.ve_solaire_w)), evGrid = Math.max(0, num(C.ve_reseau_w));
    return { solar, grid, bat, car, house: Math.max(0, total - car), total, plugged, charging, evSolarShare: evSun + evGrid > 0 ? evSun / (evSun + evGrid) : 0 };
  }

  function today() {
    const prod = num(C.production_jour_kwh), imp = num(C.import_jour_kwh), exp = num(C.export_jour_kwh);
    const chg = num(C.batterie_charge_jour_kwh), dch = num(C.batterie_decharge_jour_kwh);
    const cons = prod - exp + imp - chg + dch;
    const self = Math.max(0, prod - exp - chg);
    return { prod, imp, exp, chg, dch, cons, self, forecast: num(C.prevision_jour_kwh), autonomy: cons > 0 ? clamp(1 - imp / cons, 0, 1) : 0, savings: num(C.economies_jour_eur) };
  }

  /* ─── Tarifs ───────────────────────────────────────────────────────── */
  const TARIFS = {
    hp: { label: "Heures pleines", short: "HP", price: () => num(C.tarif_hp) },
    hc: { label: "Heures creuses", short: "HC", price: () => num(C.tarif_hc) },
    hsc: { label: "Super creuses", short: "HSC", price: () => num(C.tarif_hsc) },
  };
  const ranges = (k) => ((C.plages_tarifaires || {})[k] || []).map((r) => r.split("-").map((t) => parseInt(t, 10)));
  const inRange = (h, [a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b);
  const tariffAt = (h) => (ranges("hsc").some((r) => inRange(h, r)) ? "hsc" : ranges("hc").some((r) => inRange(h, r)) ? "hc" : "hp");
  function tariffNow(date = new Date()) {
    const h = date.getHours(), key = tariffAt(h);
    let next = 1; while (next < 24 && tariffAt((h + next) % 24) === key) next++;
    const changeAt = new Date(date); changeAt.setHours(h + next, 0, 0, 0);
    return { key, ...TARIFS[key], price: TARIFS[key].price(), nextKey: tariffAt((h + next) % 24), changeAt };
  }
  const tariffHours = () => Array.from({ length: 24 }, (_, h) => tariffAt(h));
  const rangeLabel = (k) => k === "hp" ? "7h–23h" : ranges(k).map(([a, b]) => `${a}h–${b}h`).join(", ");

  /* ─── Historique de démo, cohérent sur toutes les périodes ─────────────
     Une seule fonction « jour » produit les totaux d'une journée ; semaine,
     mois et année sont des sommes de jours. Aujourd'hui = valeurs des capteurs. */
  const rnd = (seed) => { let t = (seed + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const MONTH_PROD = [7.2, 10.5, 15.5, 20.6, 24.5, 27.3, 27.4, 25.2, 19.7, 13.5, 8.3, 6.1];   // kWh/jour moyens
  const MONTH_CONS = [15.2, 14.6, 12.5, 11.0, 9.8, 9.3, 9.2, 9.4, 10.2, 11.2, 13.8, 15.4];
  const dayKey = (d) => d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const isToday = (d) => startOfDay(d).getTime() === startOfDay(new Date()).getTime();

  function day(date) {
    if (isToday(date)) {
      const t = today();
      return { date, prod: t.prod, cons: t.cons, self: t.self, chg: t.chg, dch: t.dch, imp: t.imp, exp: t.exp, ...splitImport(t.imp, dayKey(date)), ev: 8.9, evSun: 6.8, savings: t.savings, partial: true };
    }
    const k = dayKey(date), m = date.getMonth();
    const weather = 0.5 + 0.7 * rnd(k);                        // nuageux … ensoleillé
    const prod = MONTH_PROD[m] * weather;
    const doy = Math.floor((date - new Date(date.getFullYear(), 0, 1)) / 864e5);
    const evDay = doy % 3 === 0;                                // une recharge tous les 3 jours environ
    const ev = evDay ? 6 + rnd(k * 11) * 7 : 0;
    const cons = MONTH_CONS[m] * (0.9 + rnd(k * 3) * 0.2) + ev * 0.6;
    // Le soleil ne couvre que la journée : au mieux ~55 % de la consommation en direct
    const self = Math.min(prod * 0.8, cons * 0.55) * (0.85 + rnd(k * 5) * 0.1);
    const surplus = Math.max(0, prod - self);
    const chg = Math.min(surplus * 0.55, 7.5), exp = surplus - chg;
    const dch = Math.min(chg * 0.92, Math.max(0, cons - self) * 0.6);
    const imp = Math.max(cons * 0.15, cons - self - dch);
    const evSun = ev ? Math.min(ev, ev * (weather > 0.8 ? 0.85 : 0.25)) : 0;
    const savings = (self + dch) * 0.2 + exp * 0.06;
    return { date, prod, cons, self, chg, dch, imp, exp, ...splitImport(imp, k), ev, evSun, savings };
  }
  function splitImport(imp, k) {
    const hsc = imp * (0.45 + rnd(k * 13) * 0.15), hc = imp * (0.15 + rnd(k * 17) * 0.1);
    return { hsc, hc, hp: Math.max(0, imp - hsc - hc) };
  }
  const FIELDS = ["prod", "cons", "self", "chg", "dch", "imp", "exp", "hp", "hc", "hsc", "ev", "evSun", "savings"];
  const sumDays = (days) => FIELDS.reduce((o, f) => ((o[f] = days.reduce((a, d) => a + (d[f] || 0), 0)), o), {});
  // Prévision pour une journée à venir : production attendue seulement
  const forecastDay = (date) => ({ date, prod: MONTH_PROD[date.getMonth()] * (0.75 + rnd(dayKey(date)) * 0.3), forecast: true });

  // Profil horaire d'aujourd'hui, calé sur les compteurs du jour
  function hours() {
    const now = new Date(), H = now.getHours() + now.getMinutes() / 60, t = today();
    const sunShape = (h) => Math.max(0, Math.exp(-((h + 0.5 - 13.2) ** 2) / (2 * 2.7 ** 2)) - 0.02);
    const consShape = (h) => 0.35 + (h >= 6 && h < 8 ? 0.9 : 0) + (h >= 9 && h < 12 ? 1.6 : 0) + (h >= 18 && h < 21 ? 1.2 : 0) + (h >= 2 && h < 5 ? 0.6 : 0);
    const past = (h) => h + 1 <= H;
    const sh = Array.from({ length: 24 }, (_, h) => sunShape(h)), ch = Array.from({ length: 24 }, (_, h) => consShape(h));
    const sumPast = (a) => a.reduce((s, v, h) => s + (past(h) ? v : 0), 0);
    const kP = t.prod / (sumPast(sh) || 1), kC = t.cons / (sumPast(ch) || 1);
    const kF = Math.max(0, t.forecast - t.prod) / (sh.reduce((s, v, h) => s + (past(h) ? 0 : v), 0) || 1);
    return Array.from({ length: 24 }, (_, h) => ({
      h, label: `${h}h`, tariff: tariffAt(h), future: !past(h), current: h === Math.floor(H),
      prod: sh[h] * (past(h) ? kP : kF), cons: past(h) ? ch[h] * kC : null,
    }));
  }

  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  // Une période = une liste de « cases » (heures, jours ou mois) + la même période d'avant pour comparer
  function period(kind) {
    const now = new Date(), D = (y, m, d) => new Date(y, m, d, 12);
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const daysBetween = (a, n) => Array.from({ length: n }, (_, i) => D(a.getFullYear(), a.getMonth(), a.getDate() + i));
    let buckets, prev, title, compare;
    if (kind === "jour") {
      buckets = hours().map((x) => ({ ...x, key: x.label, value: x.prod }));
      const tot = { ...sumDays([day(now)]) };
      return { kind, title: "Aujourd'hui", compare: "vs hier", buckets, total: tot, prevTotal: sumDays([day(D(y, m, d - 1))]), unitLabel: "par heure" };
    }
    if (kind === "semaine") {
      const days = daysBetween(D(y, m, d - 6), 7);
      buckets = days.map((x) => ({ key: x.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""), ...day(x), current: isToday(x) }));
      prev = daysBetween(D(y, m, d - 13), 7).map(day); title = "7 derniers jours"; compare = "vs 7 jours d'avant";
    } else if (kind === "mois") {
      const n = new Date(y, m + 1, 0).getDate();
      buckets = daysBetween(D(y, m, 1), n).map((x) => (x.getDate() <= d ? { key: String(x.getDate()), ...day(x), current: x.getDate() === d } : { key: String(x.getDate()), ...forecastDay(x) }));
      prev = daysBetween(D(y, m - 1, 1), Math.min(d, new Date(y, m, 0).getDate())).map(day); title = MONTHS_LONG[m][0].toUpperCase() + MONTHS_LONG[m].slice(1); compare = "vs même période le mois dernier";
    } else {
      buckets = MONTHS.map((lab, i) => {
        if (i > m) return { key: lab, prod: MONTH_PROD[i] * new Date(y, i + 1, 0).getDate(), forecast: true };
        const n = i === m ? d : new Date(y, i + 1, 0).getDate();
        return { key: lab, ...sumDays(daysBetween(D(y, i, 1), n).map(day)), current: i === m };
      });
      prev = []; for (let i = 0; i <= m; i++) prev.push(...daysBetween(D(y - 1, i, 1), i === m ? d : new Date(y - 1, i + 1, 0).getDate()).map(day));
      title = String(y); compare = `vs ${y - 1} à date`;
    }
    const real = buckets.filter((b) => !b.forecast);
    return { kind, title, compare, buckets, total: sumDays(real), prevTotal: sumDays(prev), forecastTotal: buckets.reduce((a, b) => a + (b.prod || 0), 0) };
  }

  /* ─── Voiture : recharges ─────────────────────────────────────────── */
  function chargeDays(n = 35) {
    return Array.from({ length: n }, (_, i) => {
      const date = new Date(); date.setDate(date.getDate() - (n - 1 - i));
      const x = day(date);
      return { date, kwh: x.ev, sun: x.ev ? x.evSun / x.ev : 0 };
    });
  }
  function chargeMix(kind) {
    const p = period(kind === "jour" ? "semaine" : kind), t = kind === "jour" ? sumDays([day(new Date())]) : p.total;
    const grid = Math.max(0, t.ev - t.evSun);
    // Démo : répartition du réseau par plage ; « heures creuses seulement » exclut les heures pleines.
    // Avec Home Assistant, ces kWh viendront des compteurs de la borne par tarif.
    const offPeak = isOn(C.voiture_heures_creuses);
    const mix = offPeak ? { sol: t.evSun, hsc: grid * 0.72, hc: grid * 0.28, hp: 0 } : { sol: t.evSun, hsc: grid * 0.62, hc: grid * 0.23, hp: grid * 0.15 };
    const price = { sol: 0, hsc: num(C.tarif_hsc), hc: num(C.tarif_hc), hp: num(C.tarif_hp) };
    const kwh = t.ev, cost = Object.keys(mix).reduce((a, k) => a + mix[k] * price[k], 0);
    return { kwh, cost, mix, price, sunShare: kwh ? t.evSun / kwh : 0, hpCost: kwh * price.hp };
  }

  /* ─── Retour sur investissement ───────────────────────────────────── */
  function roi() {
    const inv = C.solaire_investissement_eur, total = num(C.economies_total_eur), start = new Date(C.solaire_mise_en_service);
    const years = Math.max(0.1, (Date.now() - start) / (365.25 * 864e5)), perYear = total / years;
    const remaining = Math.max(0, inv - total);
    return { inv, total, start, perYear, remaining, progress: clamp(total / inv, 0, 1), payback: new Date(Date.now() + (remaining / perYear) * 365.25 * 864e5), totalYears: inv / perYear };
  }

  /* ─── Formatage ───────────────────────────────────────────────────── */
  const nf = (d) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const NF = [0, 1, 2, 3, 4].map(nf);
  const fmt = {
    n: (v, d = 0) => (Number.isFinite(v) ? NF[d].format(v) : "—"),
    // Puissance : valeur + unité séparées, pour styliser l'unité
    power: (w) => (Math.abs(w) >= 1000 ? [NF[2].format(w / 1000), "kW"] : [NF[0].format(w), "W"]),
    powerText: (w) => { const [v, u] = fmt.power(w); return `${v} ${u}`; },
    kwh: (v) => [NF[v >= 100 ? 0 : 1].format(v), "kWh"],
    kwhText: (v) => `${NF[v >= 100 ? 0 : 1].format(v)} kWh`,
    eur: (v, d = v >= 100 ? 0 : 2) => `${NF[d].format(v)} €`,
    pct: (v) => `${NF[0].format(v * 100)} %`,
    time: (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    ago: (iso) => {
      const m = Math.round((Date.now() - new Date(iso)) / 60e3);
      if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; if (m < 1440) return `il y a ${Math.round(m / 60)} h`;
      if (m < 2880 && new Date(iso).getDate() === new Date(Date.now() - 864e5).getDate()) return "hier";
      if (m < 60 * 1440) return `il y a ${Math.round(m / 1440)} j`; return `il y a ${Math.round(m / 43800)} mois`;
    },
    inDays: (date) => Math.round((date - Date.now()) / 864e5),
    date: (d, o = { day: "numeric", month: "long" }) => d.toLocaleDateString("fr-FR", o),
    cap: (s) => s.charAt(0).toUpperCase() + s.slice(1),
  };

  /* ─── Démo : petites variations pour que le direct « vive » ─────────── */
  function jitter() {
    C.onduleurs_w.forEach((id, i) => { const base = [1920, 1880, 1050][i]; patch(id, Math.round(base * (0.93 + Math.random() * 0.1))); });
    patch(C.solaire_w, C.onduleurs_w.reduce((a, id) => a + num(id), 0));
    const l = live();
    patch(C.reseau_w, Math.round(1070 + l.car + l.bat - l.solar + (Math.random() - 0.5) * 140));
    notify();
  }
  setInterval(jitter, 5000);

  Object.assign(BZ, {
    C, ent, st, num, attr, isOn, clamp, call, isPending, subscribe, notify,
    live, today, tariffNow, tariffHours, tariffAt, rangeLabel, TARIFS, hours, period, day, chargeDays, chargeMix, roi,
    fmt, MONTHS, MONTHS_LONG,
  });
})();
