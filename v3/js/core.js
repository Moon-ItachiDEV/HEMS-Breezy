// Breezy HEMS V3 — cœur : accès aux états, commandes, modèle énergétique, historique, formatage.
// Aucune présentation ici : les pages lisent ce module et ne touchent jamais directement aux entités.
(() => {
  const BZ = (window.BZ = window.BZ || {});
  const C = window.VOLTIA_CONFIG;
  // Source des états : la démo (MOCK_STATES, modifiable sur place) ou Home Assistant. Dans le panneau HA,
  // v3/ha/panel-core.js pose window.BZ_HASS avant ce fichier ; hass.states y est un nouvel objet à chaque
  // mise à jour, on le relit donc à chaque accès et on n'y écrit jamais (il appartient à Home Assistant).
  const HA = window.BZ_HASS || null;
  const S = HA ? null : window.MOCK_STATES;
  const states = () => (HA ? HA.states : S);

  /* ─── États ─────────────────────────────────────────────────────── */
  const ent = (id) => states()[id] || { state: "unavailable", attributes: {} };
  const st = (id) => ent(id).state;
  const num = (id) => { const v = parseFloat(st(id)); return Number.isFinite(v) ? v : NaN; };
  const attr = (id, a) => ent(id).attributes[a];
  const isOn = (id) => ["on", "open", "playing", "heat", "unlocked", "cleaning"].includes(st(id));
  // Compteur d'énergie en kWh : Home Assistant donne parfois des Wh (index Linky) ou des MWh ; sans unité, celle de sa
  // statistique. Démo : la valeur telle quelle
  const UNIT = { wh: 1e-3, kwh: 1, mwh: 1e3 };
  const energy = (id) => {
    const v = num(id);
    if (!HA || !Number.isFinite(v)) return v;
    let u = String(attr(id, "unit_of_measurement") || "").trim().toLowerCase();
    if (!u && hist && hist.meta) { const m = hist.meta.find((x) => x.statistic_id === id); u = String((m && m.display_unit_of_measurement) || "").toLowerCase(); }
    return v * (UNIT[u] || 1);
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const listeners = new Set();
  let frame = 0;
  const notify = () => { if (frame) return; frame = requestAnimationFrame(() => { frame = 0; listeners.forEach((f) => f()); }); };
  const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };
  const patch = (id, state, attrs) => {
    if (HA) return;   // Home Assistant : l'état vient toujours de HA
    if (!S[id]) S[id] = { entity_id: id, state: "", attributes: {} };
    if (state != null) S[id].state = String(state);
    if (attrs) Object.assign(S[id].attributes, attrs);
  };

  // Attentes en cours (une commande attend son nouvel état) : vérifiées à chaque nouvel état de Home Assistant, sans
  // attendre qu'une image soit dessinée (onglet en arrière-plan : le navigateur ne dessine plus rien)
  const watchers = new Set();
  const checkWatchers = () => { watchers.forEach((w) => w()); };
  // Home Assistant envoie un nouvel hass à chaque changement (parfois plusieurs par seconde) : au plus un rendu
  // par seconde pour le direct ; une commande confirmée se redessine aussitôt (sa fin appelle notify)
  let liveAt = 0, liveTimer = 0;
  const liveNotify = () => {
    checkWatchers();
    const wait = liveAt + 1000 - Date.now();
    if (wait <= 0) { liveAt = Date.now(); notify(); return; }
    if (!liveTimer) liveTimer = setTimeout(() => { liveTimer = 0; liveAt = Date.now(); notify(); }, wait);
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
    // Démo : un relevé forcé rapporte des valeurs fraîches (en charge : +1 %)
    "button.press": (id) => {
      if (id !== C.voiture_rafraichir) return;
      patch(C.voiture_maj, new Date().toISOString());
      if (isOn(C.voiture_branchee) && isOn(C.voiture_en_charge) && num(C.voiture_soc) < num(C.voiture_limite_pct)) {
        patch(C.voiture_soc, num(C.voiture_soc) + 1); patch(C.session_soc, num(C.session_soc) + 1);
        patch(C.voiture_autonomie_km, num(C.voiture_autonomie_km) + 5); patch(C.voiture_minutes_restantes, Math.max(0, num(C.voiture_minutes_restantes) - 6));
      }
    },
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
  const demoTransport = (service, ids, data) => new Promise((resolve) => setTimeout(() => { ids.forEach((id) => SERVICES[service] && SERVICES[service](id, data)); resolve(); }, 280));
  // Home Assistant : « light.toggle » → domaine « light », service « toggle », cibles en entity_id
  const split = (service) => { const i = service.indexOf("."); return [service.slice(0, i), service.slice(i + 1)]; };
  const ENTITY_SVC = /^(light|switch|cover|climate|number|input_number|lock|vacuum|select|media_player)\./;
  const transport = HA
    ? (service, ids, data) => {
      if (!ids.length && ENTITY_SVC.test(service)) return Promise.resolve();   // ex. « tout éteindre » sans lumière allumée : rien à envoyer
      const [d, s] = split(service);
      return HA.callService(d, s, data, ids.length ? { entity_id: ids } : undefined);
    }
    : demoTransport;
  // HA rend la main quand le service a fini ; le nouvel état arrive juste après. On reste « en cours » jusqu'à ce que
  // chaque entité visée change (3 s au plus), sauf pour les services qui ne changent rien à l'entité elle-même.
  // Limites de charge Kia : la valeur ne revient qu'au relevé suivant de la voiture (jusqu'à 90 s).
  const NO_SETTLE = /^(media_player\.media_(next|previous)_track|vacuum\.locate|script\.turn_on|button\.press)$/;
  const settleCap = (ids) => (ids.some((id) => id === C.voiture_limite_pct || id === C.voiture_limite_dc_pct) ? 90000 : 3000);
  // Refus de Home Assistant (objet {code, message} déjà normalisé par le pont) → phrase pour le message
  function haErrorText(e) {
    const code = e && e.code, msg = String((e && e.message) || "").trim();
    if (code === 3 && e.sent === false) return "Pas de connexion à Home Assistant : la commande n'est pas partie.";
    if (code === 3) return "Connexion à Home Assistant perdue : la commande n'est peut-être pas partie.";
    if (code === "not_found") return "Cette action n'existe pas dans Home Assistant (vérifie config.js).";
    if (code === "invalid_format" || code === "service_validation_error") return `Home Assistant a refusé la valeur : ${msg}`;
    if (code === "home_assistant_error" && /unauthori[sz]ed/i.test(msg)) return "Ton compte Home Assistant n'a pas le droit de piloter cet appareil.";
    if (code === "home_assistant_error") return `Home Assistant : ${msg}`;
    return "La commande a échoué.";
  }
  // Démo : résout toujours. Home Assistant : true si la commande est passée, false après un refus (déjà annoncé)
  async function call(service, target, data = {}) {
    const ids = [].concat(target), before = ids.map((id) => states()[id]);
    ids.forEach((id) => pending.add(id));
    notify();
    try {
      await transport(service, ids, data);
      if (HA && ids.length && !NO_SETTLE.test(service)) await waitFor(() => ids.every((id, i) => states()[id] !== before[i]), settleCap(ids));
      return true;
    } catch (e) {
      if (!HA) throw e;
      HA.noteError(service, ids, e);
      BZ.toast(haErrorText(e), "bad");
      return false;
    } finally { ids.forEach((id) => pending.delete(id)); notify(); }
  }
  const isPending = (id) => pending.has(id);

  /* ─── Commandes lentes : la voiture passe par le cloud Kia Connect ─────
     Le service HA rend la main quand Kia a accepté la commande (souvent 5 à 30 s) ;
     la voiture l'applique ensuite et son état ne change qu'au relevé suivant
     (jusqu'à 1 à 2 min). Chaque commande est suivie en trois temps :
       send : envoi au cloud Kia → wait : la voiture applique → ok, ou fail (refus ou délai dépassé).
     Une seule commande voiture à la fois : l'API Kia les traite l'une après l'autre. */
  const slow = new Map();
  const demo = { fail: null, ack: 2400, apply: 5200, timeout: 120000 };   // démo : délais simulés ; fail = "send" | "wait" pour tester un échec
  const demoSlow = (service, ids, data) => new Promise((resolve, reject) => setTimeout(() => {
    const f = demo.fail; demo.fail = null;
    if (f === "send") return reject(new Error("refus"));
    resolve();
    if (f !== "wait") setTimeout(() => { ids.forEach((id) => SERVICES[service] && SERVICES[service](id, data)); notify(); }, demo.apply);
  }, demo.ack));
  // Home Assistant : le service rend la main quand Kia a accepté. Sans réponse en 90 s, ou connexion coupée pendant
  // l'envoi, la commande est peut-être partie : on attend alors la voiture comme si Kia l'avait acceptée.
  // Hors connexion au moment d'appuyer : la commande n'est jamais partie, échec immédiat.
  const ACK_MAX = 90000;
  const transportSlow = HA
    ? (service, ids, data) => {
      const [d, s] = split(service);
      let timer;
      const late = new Promise((resolve) => { timer = setTimeout(() => resolve("unknown"), ACK_MAX); });
      return Promise.race([HA.callService(d, s, data, { entity_id: ids }), late])
        .catch((e) => { if (e && e.code === 3 && e.sent !== false) return "unknown"; throw e; })
        .finally(() => clearTimeout(timer));
    }
    : demoSlow;
  // Vraie dès que ok() l'est : vérifiée à chaque rendu (démo) et à chaque nouvel état de HA ; au bout du délai, une
  // dernière vérification (l'état a pu arriver pendant que la page ne se dessinait plus)
  const waitFor = (ok, ms) => new Promise((resolve) => {
    if (ok()) return resolve(true);
    let done = false;
    const end = (v) => { if (done) return; done = true; clearTimeout(timer); off(); watchers.delete(check); resolve(v); };
    const check = () => { if (ok()) end(true); };
    const timer = setTimeout(() => end(!!ok()), ms);
    const off = subscribe(check);
    watchers.add(check);
  });
  const slowEnd = (t, phase, why) => {
    const end = t.tEnd = Date.now(); t.phase = phase; t.why = why || ""; notify();
    setTimeout(() => { if (slow.get(t.key) === t && t.tEnd === end) { slow.delete(t.key); notify(); } }, phase === "ok" ? 2600 : 12000);
    // Échec, mais la voiture finit par appliquer (confirmation arrivée après le délai) : la commande est faite,
    // on passe à « confirmé » (sinon « Réessayer » relancerait une commande déjà appliquée)
    if (phase === "fail" && t.expect) {
      const w = () => { if (slow.get(t.key) !== t || t.phase !== "fail") stop(); else if (t.expect()) { stop(); slowEnd(t, "ok"); } };
      const off = subscribe(w), stop = () => { off(); watchers.delete(w); };
      watchers.add(w);
    }
    return phase === "ok";
  };
  // key : nom de la commande (lock, clim, charge, refresh) ; to : état visé (pour les libellés) ; expect() : vrai quand la voiture a appliqué
  // Délai de confirmation : 2 min par défaut (Kia Connect), réglable dans config.js pour Home Assistant
  const slowTimeout = () => (HA ? (Number(C.voiture_delai_confirmation_s) || 120) * 1000 : demo.timeout);
  function slowCall(key, service, target, data, { to = null, expect, timeout = slowTimeout() } = {}) {
    const busy = slowBusy();
    if (busy) return busy.promise;
    const t = { key, to, expect, phase: "send", t0: Date.now(), tWait: 0, tEnd: 0, why: "" };
    slow.set(key, t); notify();
    // Raisons d'échec courtes : la page Voiture les affiche telles quelles dans la ligne étroite du pupitre
    t.promise = (async () => {
      try { await transportSlow(service, [].concat(target), data); }
      catch (e) { if (HA) HA.noteError(service, [].concat(target), e); return slowEnd(t, "fail", e && e.code === 3 ? "Hors ligne : commande non envoyée" : "Kia a refusé la commande"); }
      t.phase = "wait"; t.tWait = Date.now(); notify();
      // Option (config.js) : si la voiture tarde à confirmer, on lui demande un relevé, une seule fois
      const ask = HA && key !== "refresh" ? Number(C.voiture_releve_apres_commande_s) || 0 : 0;
      if (ask > 0 && C.voiture_rafraichir) setTimeout(() => { if (t.phase === "wait") HA.callService("button", "press", {}, { entity_id: [C.voiture_rafraichir] }).catch(() => {}); }, ask * 1000);
      return slowEnd(t, ...(await waitFor(expect || (() => true), timeout) ? ["ok"] : ["fail", "La voiture n'a pas confirmé"]));
    })();
    return t.promise;
  }
  const slowOf = (key) => slow.get(key) || null;
  const slowBusy = () => [...slow.values()].find((t) => t.phase === "send" || t.phase === "wait") || null;

  /* ─── Modèle énergétique en direct ─────────────────────────────────── */
  function live() {
    const solar = Math.max(0, num(C.solaire_w));
    const grid = num(C.reseau_w);                                   // + achat, − revente
    const bat = C.batterie_inverse ? -num(C.batterie_w) : num(C.batterie_w); // + charge, − décharge
    const plugged = isOn(C.voiture_branchee), charging = plugged && isOn(C.voiture_en_charge);
    // Home Assistant : la phase du compteur sert aussi à d'autres appareils, on ne la compte comme voiture qu'en charge
    const car = (HA ? charging : plugged) ? Math.max(0, num(C.voiture_charge_w)) : 0;
    const total = solar + grid - bat;
    const evSun = Math.max(0, num(C.ve_solaire_w)), evGrid = Math.max(0, num(C.ve_reseau_w));
    return { solar, grid, bat, car, house: Math.max(0, total - car), total, plugged, charging, evSolarShare: evSun + evGrid > 0 ? evSun / (evSun + evGrid) : 0 };
  }

  // Compteur du jour ; capteur indisponible dans Home Assistant : le cumul du jour lu dans l'historique
  const ctr = (key, field) => { const v = field === "savings" ? num(C[key]) : energy(C[key]); return Number.isFinite(v) || !hist ? v : hist.todaySoFar(field); };
  function today() {
    const prod = ctr("production_jour_kwh", "prod"), imp = ctr("import_jour_kwh", "imp"), exp = ctr("export_jour_kwh", "exp");
    const chg = ctr("batterie_charge_jour_kwh", "chg"), dch = ctr("batterie_decharge_jour_kwh", "dch");
    const cons = prod - exp + imp - chg + dch;
    const self = Math.max(0, prod - exp - chg);
    return { prod, imp, exp, chg, dch, cons, self, forecast: num(C.prevision_jour_kwh), autonomy: cons > 0 ? clamp(1 - imp / cons, 0, 1) : 0, savings: ctr("economies_jour_eur", "savings") };
  }

  /* ─── Tarifs ───────────────────────────────────────────────────────── */
  // Prix lu dans Home Assistant ; s'il est indisponible, le prix de secours de config.js
  const pick = (v, d) => (Number.isFinite(v) ? v : Number.isFinite(d) ? d : NaN);
  const TARIFS = {
    hp: { label: "Heures pleines", short: "HP", price: () => pick(num(C.tarif_hp), C.tarif_hp_defaut) },
    hc: { label: "Heures creuses", short: "HC", price: () => pick(num(C.tarif_hc), C.tarif_hc_defaut) },
    hsc: { label: "Super creuses", short: "HSC", price: () => pick(num(C.tarif_hsc), C.tarif_hsc_defaut) },
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

  /* ─── Historique ──────────────────────────────────────────────────────
     Démo : inventé mais cohérent sur toutes les périodes (ci-dessous). Home Assistant : un fournisseur
     (v3/ha/history.js) s'inscrit par BZ.useHistory et répond de façon synchrone depuis son cache ;
     tant qu'une valeur n'est pas arrivée, elle vaut NaN (affichée « — ») avec loading: true. */
  let hist = null;
  const useHistory = (p) => { hist = p; BZ.hist = p; notify(); };
  const day = (date) => (hist ? hist.day(date) : demoDay(date));
  const hours = () => (hist ? hist.hours() : demoHours());
  const forecastDay = (date) => (hist ? hist.forecastDay(date) : demoForecastDay(date));

  /* ─── Historique de démo, cohérent sur toutes les périodes ─────────────
     Une seule fonction « jour » produit les totaux d'une journée ; semaine,
     mois et année sont des sommes de jours. Aujourd'hui = valeurs des capteurs. */
  const rnd = (seed) => { let t = (seed + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const MONTH_PROD = [7.2, 10.5, 15.5, 20.6, 24.5, 27.3, 27.4, 25.2, 19.7, 13.5, 8.3, 6.1];   // kWh/jour moyens
  const MONTH_CONS = [15.2, 14.6, 12.5, 11.0, 9.8, 9.3, 9.2, 9.4, 10.2, 11.2, 13.8, 15.4];
  const dayKey = (d) => d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const isToday = (d) => startOfDay(d).getTime() === startOfDay(new Date()).getTime();

  function demoDay(date) {
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
  // Home Assistant : une valeur inconnue (NaN) le reste dans la somme, et les drapeaux des jours suivent
  // (jours sans historique non comptés, voir history.js ; gaps : jours sans données ; splitLoading : achat par tarif en route)
  const sumDays = (days) => (hist ? hist.sum(days) : FIELDS.reduce((o, f) => ((o[f] = days.reduce((a, d) => a + (d[f] || 0), 0)), o), {}));
  // Prévision pour une journée à venir : production attendue seulement
  const demoForecastDay = (date) => ({ date, prod: MONTH_PROD[date.getMonth()] * (0.75 + rnd(dayKey(date)) * 0.3), forecast: true });

  // Profil horaire d'aujourd'hui, calé sur les compteurs du jour
  function demoHours() {
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
  // Une période = une liste de « cases » (heures, jours ou mois) + la même période d'avant pour comparer.
  // Home Assistant : la période d'avant est arrêtée à la même heure et ne compte que ce qui est connu des deux côtés
  // (group : « energie » ou « voiture », les compteurs qui doivent exister) ; cmpTotal = la période en cours réduite d'autant
  function period(kind, group) {
    if (hist) return periodHA(kind, group);
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

  function periodHA(kind, group = "energie") {
    const now = new Date(), D = (y, m, d) => new Date(y, m, d, 12), K = hist.key, S = hist.shifts;
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const daysBetween = (a, n) => Array.from({ length: n }, (_, i) => D(a.getFullYear(), a.getMonth(), a.getDate() + i));
    const like = (a, b, pa, pb, shift) => hist.like({ a: K(a), b: K(b), pa: K(pa), pb: K(pb), live: true, group, shift });
    let buckets, title, compare, cmp;
    if (kind === "jour") {
      buckets = hours().map((x) => ({ ...x, key: x.label, value: x.prod }));
      cmp = like(now, now, D(y, m, d - 1), D(y, m, d - 1), S.days(1));
      return { kind, title: "Aujourd'hui", compare: "vs hier à la même heure", buckets, total: sumDays([day(now)]), prevTotal: cmp.prevTotal, cmpTotal: cmp.cmpTotal, cmp, unitLabel: "par heure" };
    }
    if (kind === "semaine") {
      buckets = daysBetween(D(y, m, d - 6), 7).map((x) => ({ key: x.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""), ...day(x), current: isToday(x) }));
      cmp = like(D(y, m, d - 6), now, D(y, m, d - 13), D(y, m, d - 7), S.days(7)); title = "7 derniers jours"; compare = "vs 7 jours d'avant";
    } else if (kind === "mois") {
      const n = new Date(y, m + 1, 0).getDate(), pn = new Date(y, m, 0).getDate();
      buckets = daysBetween(D(y, m, 1), n).map((x) => (x.getDate() <= d ? { key: String(x.getDate()), ...day(x), current: x.getDate() === d } : { key: String(x.getDate()), ...forecastDay(x) }));
      // Mois d'avant plus court que le jour d'aujourd'hui : tout le mois d'avant, sans heure d'arrêt
      cmp = d > pn ? hist.like({ a: K(D(y, m, 1)), b: K(now), pa: K(D(y, m - 1, 1)), pb: K(D(y, m - 1, pn)), live: false, group, shift: S.month(K(now).slice(0, 7)) })
        : like(D(y, m, 1), now, D(y, m - 1, 1), D(y, m - 1, d), S.month(K(now).slice(0, 7)));
      title = MONTHS_LONG[m][0].toUpperCase() + MONTHS_LONG[m].slice(1); compare = "vs même période le mois dernier";
    } else {
      buckets = MONTHS.map((lab, i) => (i > m ? { key: lab, ...hist.forecastMonth(y, i) } : { key: lab, ...hist.monthSum(y, i, i === m ? d : null), current: i === m }));
      cmp = like(D(y, 0, 1), now, D(y - 1, 0, 1), D(y - 1, m, Math.min(d, new Date(y - 1, m + 1, 0).getDate())), S.year(y));
      title = String(y); compare = `vs ${y - 1} à date`;
    }
    const real = buckets.filter((b) => !b.forecast);
    return { kind, title, compare, buckets, total: sumDays(real), prevTotal: cmp.prevTotal, cmpTotal: cmp.cmpTotal, cmp, forecastTotal: buckets.reduce((a, b) => a + (b.prod || 0), 0) };
  }

  /* ─── Voiture : recharges ─────────────────────────────────────────── */
  function chargeDays(n = 35) {
    return Array.from({ length: n }, (_, i) => {
      const date = new Date(); date.setDate(date.getDate() - (n - 1 - i));
      const x = day(date);
      // Home Assistant : jour d'avant les compteurs de la borne (pas d'historique) : pas de recharge connue
      const kwh = hist && x.nocov && !Number.isFinite(x.ev) && !x.loading ? 0 : x.ev;
      return { date, kwh, sun: kwh ? x.evSun / kwh : 0, ...(hist ? { evHp: x.evHp, evHc: x.evHc, evHsc: x.evHsc, loading: x.loading || x.evLoading, absent: x.absent, nocov: x.nocov && kwh === 0 && !Number.isFinite(x.ev) } : {}) };
    });
  }
  function chargeMix(kind) {
    if (hist) {
      // Home Assistant : kWh de la borne par tarif, heure par heure (historique) ; inconnus tant qu'ils ne sont pas arrivés
      const t = kind === "jour" ? sumDays([day(new Date())]) : period(kind, "voiture").total;
      const mix = { sol: t.evSun, hsc: t.evHsc, hc: t.evHc, hp: t.evHp }, price = { sol: 0, hsc: TARIFS.hsc.price(), hc: TARIFS.hc.price(), hp: TARIFS.hp.price() };
      const kwh = t.ev, cost = Object.keys(mix).reduce((a, k) => a + mix[k] * price[k], 0);
      return { kwh, cost, mix, price, sunShare: kwh > 0 ? t.evSun / kwh : kwh === 0 ? 0 : NaN, hpCost: kwh * price.hp, loading: t.loading };
    }
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
  // Valeur inconnue (capteur indisponible, historique en chargement, date illisible) : « — », jamais « NaN »
  const ok = Number.isFinite, okDate = (d) => d != null && Number.isFinite(+new Date(d));
  const fmt = {
    n: (v, d = 0) => (Number.isFinite(v) ? NF[d].format(v) : "—"),
    // Puissance : valeur + unité séparées, pour styliser l'unité
    power: (w) => (!ok(w) ? ["—", "W"] : Math.abs(w) >= 1000 ? [NF[2].format(w / 1000), "kW"] : [NF[0].format(w), "W"]),
    powerText: (w) => { const [v, u] = fmt.power(w); return `${v} ${u}`; },
    kwh: (v) => (ok(v) ? [NF[v >= 100 ? 0 : 1].format(v), "kWh"] : ["—", "kWh"]),
    kwhText: (v) => (ok(v) ? `${NF[v >= 100 ? 0 : 1].format(v)} kWh` : "— kWh"),
    eur: (v, d = v >= 100 ? 0 : 2) => (ok(v) ? `${NF[d].format(v)} €` : "— €"),
    pct: (v) => (ok(v) ? `${NF[0].format(v * 100)} %` : "— %"),
    time: (d) => (okDate(d) ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"),
    ago: (iso) => {
      const m = Math.round((Date.now() - new Date(iso)) / 60e3);
      if (!ok(m)) return "—";
      if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; if (m < 1440) return `il y a ${Math.round(m / 60)} h`;
      if (m < 2880 && new Date(iso).getDate() === new Date(Date.now() - 864e5).getDate()) return "hier";
      if (m < 60 * 1440) return `il y a ${Math.round(m / 1440)} j`; return `il y a ${Math.round(m / 43800)} mois`;
    },
    inDays: (date) => Math.round((date - Date.now()) / 864e5),
    date: (d, o = { day: "numeric", month: "long" }) => (okDate(d) ? d.toLocaleDateString("fr-FR", o) : "—"),
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
  if (!HA) setInterval(jitter, 5000);

  /* ─── Dates des entités ───────────────────────────────────────────────
     Démo : chaînes ISO. Home Assistant : un input_datetime vaut « AAAA-MM-JJ HH:MM:SS », « AAAA-MM-JJ » ou
     « HH:MM:SS » (illisible pour Safari via new Date) ; son attribut timestamp est sûr (heure seule : secondes depuis minuit).
     Un capteur horodaté (device_class timestamp) donne une date ISO avec fuseau. */
  const dtDemo = (id) => new Date(st(id));
  function dtHA(id) {
    const e = ent(id), a = e.attributes || {}, s = String(e.state);
    if (Number.isFinite(a.timestamp)) {
      if (a.has_date === false) { const d = new Date(); d.setHours(0, 0, 0, 0); return new Date(d.getTime() + a.timestamp * 1000); }
      return new Date(a.timestamp * 1000);
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
    if (m) return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return new Date(s);
  }
  const dt = HA ? dtHA : dtDemo;

  if (HA) HA.on("states", liveNotify);
  // Adresse d'une page : « #/energy » (démo) ; Home Assistant : celle du panneau (/breezy/energy), qui s'ouvre aussi
  // dans un nouvel onglet ou se copie
  const href = (id) => (HA ? HA.pathOf(id) : `#/${id}`);

  Object.assign(BZ, {
    C, ent, st, num, attr, isOn, clamp, call, isPending, subscribe, notify, slowCall, slowOf, slowBusy, demo,
    live, today, tariffNow, tariffHours, tariffAt, rangeLabel, TARIFS, hours, period, day, chargeDays, chargeMix, roi,
    fmt, MONTHS, MONTHS_LONG,
    // Home Assistant (null / false en démo)
    ha: HA, HA: !!HA, hist, states, liveNotify, useHistory, dt, haErrorText, energy, href,
  });
})();
