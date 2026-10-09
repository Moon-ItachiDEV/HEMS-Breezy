// Breezy HEMS — historique Home Assistant (statistiques long terme), chargé juste après core.js, dans le panneau HA seulement.
// Règles de calcul (vérifiées sur les sources de HA, à confirmer sur un échantillon réel : « Copier le diagnostic ») :
//  · compteurs (kWh, €) : la variation `change` du cumul `sum` que HA calcule par heure ou par jour (c'est aussi ce que
//    fait son tableau Énergie) ; jamais `state` ni `max` d'une case : une remise à zéro vers minuit les fausse ;
//    un mois = la somme de ses journées (la même valeur dans la vue Mois et dans la vue Année) ;
//  · niveau de la batterie (%) : la moyenne `mean` de chaque heure ;
//  · aujourd'hui : les compteurs du jour en direct (convertis en kWh) ; l'heure en cours = compteur du jour − heures
//    déjà écrites par HA (seulement à l'intérieur d'aujourd'hui, jamais d'un jour sur l'autre) ;
//  · journées, mois et heures dans le fuseau de Home Assistant (hass.config.time_zone), comme ses statistiques.
// Garde-fous :
//  · lignes triées ; une variation négative est ramenée à 0 et reprise sur les heures suivantes du même jour ;
//    un jour terminé garde toujours la variation de son cumul (Σ des heures = chiffre du jour) ;
//  · une heure invraisemblable (pic de remise à zéro d'un compteur) est écartée, et la même quantité est retirée de
//    la journée, du mois et des fenêtres qui la contiennent ; une journée invraisemblable fait lire ses heures ;
//  · chaque compteur a une date de début (sa première statistique) : avant, la valeur est inconnue (« — »), jamais 0 ;
//    avant la mise en service des panneaux, production, revente, batterie et économies valent 0 (l'achat reste lu) ;
//  · les comparaisons ne portent que sur ce qui est connu des deux côtés (même durée, même heure) ;
//  · aucune valeur inventée : inconnu = NaN, affiché « — ».
// Les getters sont synchrones et ne lèvent jamais : ils lisent un cache par morceaux et demandent ce qui manque.
(() => {
  const BZ = window.BZ, HA = BZ.ha;
  if (!HA) return;
  const C = BZ.C;
  const HOUR = 36e5, DAY = 864e5;
  const ENTITY = /^[a-z_]+\.[a-z0-9_]+$/;
  const pad = (n) => String(n).padStart(2, "0");
  const H24 = Array.from({ length: 24 }, (_, h) => h);

  /* ─── Fuseau de Home Assistant ──────────────────────────────────────── */
  function makeTz(tz) {
    const o = { hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" };
    let f;
    try { f = new Intl.DateTimeFormat("en-US", { ...o, timeZone: tz }); } catch { f = new Intl.DateTimeFormat("en-US", o); }   // fuseau inconnu : celui de l'appareil
    const parts = (ms) => { const r = {}; for (const p of f.formatToParts(ms)) r[p.type] = p.value; return { y: +r.year, m: +r.month - 1, d: +r.day, h: +r.hour % 24, mi: +r.minute, s: +r.second }; };
    const offset = (ms) => { const p = parts(ms); return Date.UTC(p.y, p.m, p.d, p.h, p.mi, p.s) - (ms - (ms % 1000)); };
    const at = (y, m, d, h = 0) => { const g = Date.UTC(y, m, d, h); return g - offset(g - offset(g)); };   // heure murale → instant (2 passes : sûr aux changements d'heure)
    const key = (ms) => { const p = parts(ms); return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`; };
    return { parts, at, key };
  }
  let TZ = makeTz(HA.tz), tzName = HA.tz;
  // Les pages construisent des Date locales (navigateur) : leur jour AAAA-MM-JJ est lu comme un jour de Home Assistant
  const pageKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ymd = (k) => k.split("-").map(Number);
  const dayNum = (k) => { const [y, m, d] = ymd(k); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
  const addDays = (k, n) => { const [y, m, d] = ymd(k), x = new Date(Date.UTC(y, m - 1, d + n)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; };
  const dayStart = (k) => { const [y, m, d] = ymd(k); return TZ.at(y, m - 1, d); };
  const monthOf = (k) => k.slice(0, 7);
  const monthStart = (mk) => { const [y, m] = ymd(mk); return TZ.at(y, m - 1, 1); };
  const nextMonth = (mk) => { const [y, m] = ymd(mk); return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`; };
  const prevMonth = (mk) => { const [y, m] = ymd(mk); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
  const daysIn = (mk) => { const [y, m] = ymd(mk); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  const todayKey = () => TZ.key(Date.now());
  const iso = (ms) => new Date(ms).toISOString();
  const dayDate = (k) => { const [y, m, d] = ymd(k); return new Date(y, m - 1, d, 12); };
  const maxKey = (a, b) => (a > b ? a : b);
  // Heure de HA (décimale) maintenant : la période d'avant est arrêtée à la même heure
  const nowH = () => { const p = TZ.parts(Date.now()); return p.h + p.mi / 60 + p.s / 3600; };
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const dayOf = (v) => (DAY_RE.test(String(v || "").slice(0, 10)) ? String(v).slice(0, 10) : "");
  // Mise en service des panneaux : avant, production, revente, batterie et économies valent 0 (l'achat, lui, est lu)
  const SOLAR0 = dayOf(C.solaire_mise_en_service) || "2000-01-01";
  // Début du Bilan (navigation) : historique_debut de config.js, sinon la mise en service
  const HSTART = dayOf(C.historique_debut) || SOLAR0;
  // Couverture demandée depuis décembre de l'année d'avant celle qui précède le début : une statistique qui a une
  // ligne ce mois-là couvre tout ce que Breezy peut afficher ou comparer
  const COV_Y = +(HSTART < SOLAR0 ? HSTART : SOLAR0).slice(0, 4) - 1;
  const COV_REQ = `${COV_Y - 1}-12`;
  const SOLAR_F = new Set(["prod", "exp", "chg", "dch", "evSun", "savings"]);

  /* ─── Registre des champs : quel compteur de Home Assistant pour quoi ─────
     Pour chaque champ, parmi les candidats (clés de config.js, dans l'ordre) qui ont de vraies statistiques,
     celui dont l'historique commence le plus tôt (à égalité : le premier). */
  const REG = [
    { f: "prod", keys: ["stat_production", "production_jour_kwh"], kind: "energy", group: "energie", label: "la production solaire" },
    { f: "imp", keys: ["stat_import", "import_jour_kwh"], kind: "energy", group: "energie", label: "l'achat au réseau" },
    { f: "exp", keys: ["stat_export", "export_jour_kwh"], kind: "energy", group: "energie", label: "la revente au réseau" },
    { f: "chg", keys: ["stat_batterie_charge", "batterie_total_charge_kwh", "batterie_charge_jour_kwh"], kind: "energy", group: "energie", label: "la charge de la batterie" },
    { f: "dch", keys: ["stat_batterie_decharge", "batterie_total_decharge_kwh", "batterie_decharge_jour_kwh"], kind: "energy", group: "energie", label: "la décharge de la batterie" },
    { f: "evSun", keys: ["stat_ve_solaire", "ve_solaire_kwh"], kind: "energy", group: "voiture", label: "la recharge solaire de la voiture" },
    { f: "evGrid", keys: ["stat_ve_reseau", "ve_reseau_kwh"], kind: "energy", group: "voiture", label: "la recharge de la voiture sur le réseau" },
    { f: "savings", keys: ["stat_economies", "economies_total_eur", "economies_jour_eur"], kind: "money", group: "economies", label: "les économies" },
    { f: "impHp", keys: ["stat_import_hp"], kind: "energy", group: "tarifs", label: "l'achat en heures pleines" },
    { f: "impHc", keys: ["stat_import_hc"], kind: "energy", group: "tarifs", label: "l'achat en heures creuses" },
    { f: "impHsc", keys: ["stat_import_hsc"], kind: "energy", group: "tarifs", label: "l'achat en heures super creuses" },
    { f: "soc", keys: ["batterie_soc"], kind: "mean", group: "soc", label: "le niveau de la batterie" },
  ];
  const GROUPS = { energie: ["prod", "imp", "exp", "chg", "dch"], voiture: ["evSun", "evGrid"], economies: ["savings"], tarifs: ["impHp", "impHc", "impHsc"], soc: ["soc"] };
  const SUMS = ["prod", "imp", "exp", "chg", "dch", "evSun", "evGrid", "savings", "impHp", "impHc", "impHsc"];
  const DAYF = ["prod", "imp", "exp", "chg", "dch", "evSun", "evGrid", "savings"];
  const ENERGY_UNITS = ["Wh", "kWh", "MWh"];
  // Live du jour (compteurs remis à 0 chaque nuit) : la clé de config.js de chaque champ, pour l'heure en cours et le contrôle C1
  const LIVE_KEY = { prod: "production_jour_kwh", imp: "import_jour_kwh", exp: "export_jour_kwh", chg: "batterie_charge_jour_kwh", dch: "batterie_decharge_jour_kwh", savings: "economies_jour_eur" };
  const candidates = (r) => r.keys.map((key) => ({ key, id: C[key] })).filter((c) => typeof c.id === "string" && ENTITY.test(c.id));

  let META = { status: "idle", list: null, by: null };   // métadonnées brutes (recorder/get_statistics_metadata)
  let FIELDS = {};                                        // champ → { id, key, alt }
  let PROBLEMS = [];                                      // candidats refusés (pour le diagnostic)
  let OKC = new Map();                                    // champ → candidats valables (avant le choix par couverture)
  let FIRST = new Map();                                  // statistique → mois de sa première ligne (AAAA-MM), "none" sans aucune
  let COVROWS = new Map();                                // statistique → Map(mois → variation brute) (contrôles C2, C3)
  // Contrat d'un candidat : un compteur a une somme (has_sum) et une unité d'énergie ou d'euros ; le SOC a une moyenne
  function verdict(m, kind) {
    if (!m) return { why: "missing" };
    const meanType = m.mean_type != null ? m.mean_type : m.has_mean ? 1 : 0, u = String(m.statistics_unit_of_measurement || m.display_unit_of_measurement || "").trim();
    if (kind === "mean") return meanType ? { ok: true } : { why: "nomean" };
    if (!m.has_sum) return { why: meanType ? "measure" : "nosum" };
    if (kind === "energy") return m.unit_class === "energy" || ENERGY_UNITS.includes(u) ? { ok: true } : { why: "unit", unit: u };
    const cur = (HA.hass && HA.hass.config && HA.hass.config.currency) || "EUR";
    return /^(€|eur|euros?)$/i.test(u) || u === cur ? { ok: true } : { why: "unit", unit: u };
  }
  // Étape 1 (métadonnées) : candidats valables de chaque champ ; étape 2 (couverture) : le choix
  function screen(list) {
    const by = new Map((list || []).map((m) => [m.statistic_id, m]));
    OKC = new Map(); PROBLEMS = [];
    for (const r of REG) {
      const ok = [];
      candidates(r).forEach((c, i) => { const v = verdict(by.get(c.id), r.kind); if (v.ok) ok.push({ ...c, i }); else PROBLEMS.push({ f: r.f, ...c, ...v }); });
      OKC.set(r.f, ok);
    }
    META = { status: "loading", list, by };
  }
  const firstOf = (id) => { const v = FIRST.get(id); return v == null || v === "none" ? "9999-99" : v; };
  function resolve() {
    FIELDS = {};
    for (const r of REG) {
      const ok = OKC.get(r.f) || [];
      if (!ok.length) continue;
      // Le compteur préféré peut avoir été créé tard (state_class ajouté après coup, base du recorder repartie de zéro) :
      // celui dont l'historique commence le plus tôt gagne, à égalité le premier de config.js
      let best = ok[0];
      if (r.kind !== "mean") for (const c of ok) if (firstOf(c.id) < firstOf(best.id)) best = c;
      FIELDS[r.f] = { id: best.id, key: best.key, alt: best.i > 0, late: best !== ok[0] ? { id: ok[0].id, key: ok[0].key, from: firstOf(ok[0].id) } : null };
    }
    META.status = "ok";
    seq++;
  }
  const fid = (f) => (FIELDS[f] ? FIELDS[f].id : null);
  // Les getters relancent les métadonnées (ou la couverture) après un échec (pause croissante, comme les morceaux)
  const metaOk = () => {
    if (META.status === "error") {
      const m = chunks.get("meta:all"), v = chunks.get("cov:all"), c = m && m.data ? v : m;
      if (!c || (!c.busy && !c.queued && Date.now() >= c.next)) { if (m && m.data) enqueue(chunk("cov", "all"), -1); else loadMeta(); }
    }
    return META.status === "ok";
  };
  const sumIds = () => [...new Set(SUMS.map(fid).filter(Boolean))];
  // Groupes : null tant que les métadonnées manquent ; économies sans statistique mais énergie complète : « est » (estimées)
  function has(g) {
    if (META.status !== "ok") return null;
    const all = GROUPS[g].every((f) => FIELDS[f]);
    if (g === "economies" && !all) return has("energie") ? "est" : false;
    return all;
  }

  /* ─── Couverture : depuis quand chaque compteur a des statistiques ────── */
  // Premier jour connu d'un champ : "0000-01-01" (depuis toujours), le jour de sa première ligne, "9999-12-31" (jamais),
  // null tant que la journée exacte n'est pas lue (le mois de sa première ligne, par jour)
  function knownFrom(f) {
    const id = fid(f);
    if (!id) return "9999-12-31";
    const fm = FIRST.get(id);
    if (fm == null) return null;
    if (fm === "none") return "9999-12-31";
    if (fm <= COV_REQ) return "0000-01-01";
    const D = need("d", fm, 1);
    if (!D.data) return null;
    const keys = D.data[f + "Raw"] ? [...D.data[f + "Raw"].keys()].sort() : [];
    return keys[0] || `${nextMonth(fm)}-01`;
  }
  // Pour ce qui est « solaire », une statistique née avant la mise en service couvre tout (0 avant les panneaux)
  const knownFromEff = (f) => { const k = knownFrom(f); return k != null && SOLAR_F.has(f) && k <= SOLAR0 ? "0000-01-01" : k; };
  // À partir de quand une page peut comparer « à l'identique » : énergie (et économies) dès la mise en service et dès que
  // chaque compteur existe ; voiture : dès que les deux compteurs de la borne existent
  function compareFrom(group) {
    if (META.status !== "ok") return null;
    let k = group === "voiture" ? "0000-01-01" : SOLAR0;
    const fs = group === "voiture" ? GROUPS.voiture : [...GROUPS.energie, ...(has("economies") === true ? ["savings"] : [])];
    for (const f of fs) {
      if (!FIELDS[f]) continue;
      const kf = group === "voiture" ? knownFromEff(f) : knownFrom(f);
      if (kf == null) return null;
      k = maxKey(k, kf);
    }
    return k;
  }
  // Premier jour où tous les compteurs d'énergie ont un historique (sous-titre « historique dès le … »)
  const coverStart = () => { let k = "0000-01-01"; for (const f of GROUPS.energie) { if (!FIELDS[f]) continue; const kf = knownFromEff(f); if (kf == null) return null; k = maxKey(k, kf); } return k; };
  // État d'un champ un jour donné : absent (pas de compteur), yes (statistiques), pre (pas de statistiques avant la mise en
  // service : 0, les panneaux n'étaient pas posés), no (pas encore de statistiques : inconnu) ; le jour précis du début se
  // lit dans le mois de la première ligne. Des statistiques qui existent avant la mise en service font foi
  function coverOf(f, k, D) {
    if (!FIELDS[f]) return "absent";
    const fm = FIRST.get(fid(f)), mk = monthOf(k);
    let c;
    if (fm == null) c = "yes";
    else if (fm === "none" || mk < fm) c = "no";
    else if (fm <= COV_REQ || mk > fm) c = "yes";
    else { const kf = D && D[f + "Raw"] ? [...D[f + "Raw"].keys()].sort()[0] : null; c = kf && k >= kf ? "yes" : "no"; }
    return c === "no" && SOLAR_F.has(f) && k < SOLAR0 ? "pre" : c;
  }

  /* ─── Cache par morceaux, file d'attente, rafraîchissement ─────────────
     Un morceau = un appel : meta (métadonnées), cov (première ligne de chaque compteur, par mois), h (un jour, par heure),
     t (un mois par heure : tarifs, économies estimées, pics), d (un mois par jour), s (aujourd'hui jusqu'à maintenant,
     un nombre), x (échantillon brut pour le diagnostic). Deux appels au plus en même temps. */
  const chunks = new Map(), queue = [];
  let seq = 0, order = 0, inflight = 0, paused = false, gen = 0, lastFetch = 0;
  const BACKOFF = [30e3, 120e3, 600e3];
  // Panneau quitté (page détachée) : on n'en redemande pas le rendu ; resume() et le retour du panneau le refont
  const notify = () => { if (paused) return; BZ.liveNotify(); loadingMark(); };
  const loadingMark = () => document.documentElement.toggleAttribute("data-hist-loading", inflight > 0 || queue.length > 0 || META.status === "loading");
  function chunk(fam, key) {
    const id = `${fam}:${key}`;
    let c = chunks.get(id);
    if (!c) { c = { id, fam, key, status: "idle", data: null, tries: 0, next: 0, at: 0, complete: false, queued: false, busy: false, prio: 9 }; chunks.set(id, c); }
    return c;
  }
  // Demandé par un getter (rendu en cours) : jamais bloquant ; un échec est retenté après une pause croissante
  function need(fam, key, prio = 0) {
    const c = chunk(fam, key);
    if (c.status === "idle" || (c.status === "error" && Date.now() >= c.next)) enqueue(c, prio);
    else if (c.queued && prio < c.prio) c.prio = prio;
    return c;
  }
  function enqueue(c, prio) {
    if (c.busy) { c.again = true; return; }
    if (c.queued) { c.prio = Math.min(c.prio, prio); return; }
    c.queued = true; c.prio = prio; c.order = order++;
    if (!c.data) c.status = "loading";
    queue.push(c);
    Promise.resolve().then(pump);
  }
  const withTimeout = (p, ms) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject({ code: "timeout", message: "Home Assistant n'a pas répondu" }), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
  function pump() {
    if (paused) return;
    queue.sort((a, b) => a.prio - b.prio || a.order - b.order);
    while (inflight < 2) {
      // Tout attend les métadonnées et la couverture (elles disent quels capteurs lire, et depuis quand)
      const i = queue.findIndex((c) => c.fam === "meta" || (c.fam === "cov" && META.list) || META.status === "ok");
      if (i < 0) break;
      const c = queue.splice(i, 1)[0], g = gen, t0 = Date.now();
      c.queued = false; c.busy = true; inflight++;
      withTimeout(load(c), 30000).then((data) => {
        if (g !== gen) return;
        c.data = data; c.status = "ok"; c.tries = 0; c.at = t0; c.err = null; lastFetch = Date.now();
        c.complete = c.end != null && c.end + 15 * 6e4 <= t0;   // fini d'écrire par HA quand on l'a lu : on ne le relira plus
        seq++;
        if (c.fam === "meta") afterMeta();
        if (c.fam === "cov") afterCov();
      }, (e) => {
        if (g !== gen) return;
        c.tries++; c.err = e; c.next = Date.now() + BACKOFF[Math.min(c.tries, BACKOFF.length) - 1];
        if (!c.data) c.status = "error";
        if (c.fam === "meta" || (c.fam === "cov" && META.status !== "ok")) META.status = "error";
        HA.noteError(`historique ${c.id}`, [], e);
        setTimeout(() => { if (c.status === "error" && !c.queued && !c.busy) { seq++; notify(); } }, c.next - Date.now() + 50);   // nouvel essai au prochain rendu
      }).finally(() => {
        c.busy = false; inflight--;   // appels réellement en cours chez HA, remise à zéro ou pas
        if (g !== gen) { pump(); return; }   // appel d'avant une remise à zéro : résultat oublié, place libérée
        if (c.again) { c.again = false; enqueue(c, c.prio); }
        pump(); notify();
      });
    }
    loadingMark();
  }

  /* ─── Les appels ──────────────────────────────────────────────────── */
  const ws = (msg) => HA.callWS(msg);
  const during = (ids, period, s, e, types) => (ids.length
    ? ws({ type: "recorder/statistics_during_period", start_time: iso(s), end_time: iso(e), statistic_ids: ids, period, types, units: { energy: "kWh" } })
    : Promise.resolve({}));
  const single = (id, extra) => ws({ type: "recorder/statistic_during_period", statistic_id: id, types: ["change"], units: { energy: "kWh" }, ...extra });
  // Champs lus heure par heure sur un mois : achat et recharge réseau (tarifs), production (forme de la journée) ;
  // économies estimées : aussi revente et batterie (prix de chaque heure)
  const tFields = () => (has("economies") === "est" ? ["prod", "imp", "exp", "chg", "dch", "evGrid"] : ["prod", "imp", "evGrid"]);
  function load(c) {
    const k = c.key;
    if (c.fam === "meta") {
      const ids = [...new Set(REG.flatMap((r) => candidates(r).map((x) => x.id)))];
      return ws({ type: "recorder/get_statistics_metadata", statistic_ids: ids });
    }
    if (c.fam === "cov") {
      // Tous les candidats valables (pas seulement les choisis) : le choix dépend de leur couverture
      const ids = [...new Set(REG.filter((r) => r.kind !== "mean").flatMap((r) => (OKC.get(r.f) || []).map((x) => x.id)))];
      const [y, m] = ymd(COV_REQ); c.end = 0;   // lue une fois (une nouvelle statistique se voit au rechargement)
      return during(ids, "month", TZ.at(y, m - 1, 1), Date.now(), ["change"]).then((r) => parseCov(r, ids));
    }
    if (c.fam === "h") { const s = dayStart(k), e = dayStart(addDays(k, 1)); c.end = e; return during([...sumIds(), fid("soc")].filter(Boolean), "hour", s, e, ["change", "mean"]).then((r) => parseHours(r, k, e + 15 * 6e4 <= Date.now())); }
    if (c.fam === "t") { const s = monthStart(k), e = monthStart(nextMonth(k)); c.end = e; return during([...new Set(tFields().map(fid).filter(Boolean))], "hour", s, e, ["change"]).then(parseMonthHours); }
    // Fin de requête juste avant minuit : HA arrondit à la case suivante (le dernier jour est compris ; le suivant non)
    if (c.fam === "d") { const s = monthStart(k), e = monthStart(nextMonth(k)); c.end = e; return during(sumIds(), "day", s, e - 1, ["change"]).then((r) => parseBuckets(r, (ms) => TZ.key(ms))); }
    if (c.fam === "s") { const [, f] = k.split("|"); return single(fid(f), { calendar: { period: "day" } }).then((r) => (r && Number.isFinite(r.change) ? Math.max(0, r.change) : null)); }
    // Échantillon brut du diagnostic : tous les types, pour voir la forme réelle des données (state, sum, change, mean)
    const ids = [...sumIds(), fid("soc")].filter(Boolean), tk = todayKey(), all = ["change", "sum", "state", "mean"];
    // Deux appels l'un après l'autre : le morceau n'occupe qu'une des deux places
    return during(ids, "hour", dayStart(tk), Date.now(), all)
      .then((hr) => during(ids, "day", dayStart(addDays(tk, -3)), dayStart(tk) - 1, all).then((dy) => ({ hourly_today: trim(hr, 4), daily_last3: trim(dy, 3) })));
  }
  const trim = (r, n) => Object.fromEntries(Object.entries(r || {}).map(([id, rows]) => [id, rows.slice(-n)]));

  /* ─── Lecture des réponses ────────────────────────────────────────── */
  const NEG = new Map(), SPIKES = new Map(), SUSPECT = new Map();
  // Plafonds : par heure (au-delà : pic écarté) et par jour (au-delà : on lit les heures du jour pour trouver le pic).
  // kWc lus dans les noms des onduleurs (« Izy 2 000 W ») ; illisibles : un plafond large
  const kwc = () => { const v = (C.onduleurs_noms || []).reduce((a, n) => a + (parseInt(String(n).replace(/\D/g, ""), 10) || 0), 0) / 1000; return v > 0 ? v : 12; };
  const CAPS = () => { const p = Math.max(40, 12 * kwc()); return { prod: p, exp: p, imp: 200, chg: 40, dch: 40, evSun: 120, evGrid: 120, ev: 120, savings: 50 }; };
  const CAPH = () => { const p = Math.max(3, 1.3 * kwc()); return { prod: p, exp: p, imp: 36, chg: 12, dch: 12, evSun: 22, evGrid: 22, savings: 10, impHp: 36, impHc: 36, impHsc: 36 }; };
  // Une journée d'un compteur, heure par heure : pic écarté (au-delà du plafond, rapporté aux heures écoulées depuis la
  // ligne d'avant : un rattrapage après une coupure de HA reste permis), variation négative ramenée à 0 et reprise sur les
  // heures suivantes ; journée terminée : ce qui n'a pas été repris est retiré des dernières heures (Σ = chiffre du jour)
  function cleanDay(rows, f, id, final, from) {
    const cap = CAPH()[f] || Infinity;
    let debt = 0, prev = from - HOUR;
    const out = rows.map((r) => {
      const raw = Number.isFinite(r.change) ? r.change : 0;
      let v = raw;
      if (v < 0) { NEG.set(`${id}@${r.start}`, { id, f, at: r.start, raw }); debt -= v; v = 0; }
      else {
        if (debt > 0) { const t = Math.min(v, debt); v -= t; debt -= t; }
        const allow = cap * Math.max(1, Math.round((r.start - prev) / HOUR));
        if (v > allow) { SPIKES.set(`${f}|${r.start}`, { f, id, at: r.start, k: TZ.key(r.start), raw, cut: v, cap: allow }); v = 0; }
      }
      prev = r.start;
      return { start: r.start, v, raw, mean: r.mean };
    });
    if (final) for (let i = out.length - 1; i >= 0 && debt > 1e-12; i--) { const t = Math.min(out[i].v, debt); out[i].v -= t; debt -= t; }
    return out;
  }
  // Quantité écartée (pics) d'un champ sur une journée
  const spikeSum = (f, k) => { let s = 0; SPIKES.forEach((x) => { if (x.f === f && x.k === k) s += x.cut; }); return s; };
  const sortRows = (res, id) => (res && res[id] ? res[id].filter((r) => Number.isFinite(r.start)).sort((a, b) => a.start - b.start) : null);
  // Un jour par heure : 24 cases en heure locale de HA (la 2 h doublée en octobre est additionnée, absente en mars)
  function parseHours(res, k, final) {
    const slots = {}, rows = {};
    for (const f of [...SUMS, "soc"]) {
      if (f === "soc") {
        const id = fid("soc"), list = id && res[id] ? res[id].filter((r) => Number.isFinite(r.mean)) : [];
        const acc = H24.map(() => []); list.forEach((r) => acc[TZ.parts(r.start).h].push(r.mean));
        slots.soc = acc.map((a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN));
        continue;
      }
      const id = fid(f), list = sortRows(res, id); if (!list) continue;
      const s = cleanDay(list, f, id, final, dayStart(k));
      rows[f] = s;
      const a = new Float64Array(24), raw = new Float64Array(24);
      s.forEach((r) => { const h = TZ.parts(r.start).h; a[h] += r.v; raw[h] += r.raw; });
      slots[f] = a; slots[f + "Raw"] = raw;
    }
    // Heure écrite = au moins une ligne d'un compteur d'énergie (production d'abord)
    const ref = rows.prod || rows.imp || Object.values(rows)[0] || [];
    const cnt = new Int8Array(24); ref.forEach((r) => { cnt[TZ.parts(r.start).h]++; });
    return { key: k, slots, n: cnt, rows };
  }
  // Un mois par heure : par jour, 24 cases par champ (répartition par tarif, économies estimées, forme de la production)
  function parseMonthHours(res) {
    const days = new Map(), rows = {}, now = Date.now();
    for (const f of tFields()) {
      const id = fid(f), list = sortRows(res, id); if (!list) continue;
      const byDay = new Map();
      list.forEach((r) => { const k = TZ.key(r.start); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(r); });
      rows[f] = [];
      byDay.forEach((dr, k) => {
        const s = cleanDay(dr, f, id, dayStart(addDays(k, 1)) + 15 * 6e4 <= now, dayStart(k));
        rows[f].push(...s);
        if (!days.has(k)) days.set(k, {});
        const d = days.get(k), a = (d[f] = d[f] || new Float64Array(24));
        s.forEach((r) => { a[TZ.parts(r.start).h] += r.v; });
      });
    }
    return { days, rows };
  }
  // Jours : champ → Map(clé → valeur), et la valeur brute (contrôle C2) ; une journée négative (compteur corrigé) est
  // ramenée à 0 et reprise sur les suivantes du mois
  function parseBuckets(res, keyOf) {
    const out = {};
    for (const f of SUMS) {
      const id = fid(f), list = sortRows(res, id); if (!list) continue;
      const m = new Map(), raw = new Map();
      let debt = 0;
      list.forEach((r) => {
        const k = keyOf(r.start), rv = Number.isFinite(r.change) ? r.change : 0;
        let v = rv;
        if (v < 0) { NEG.set(`${id}@${r.start}`, { id, f, at: r.start, raw: rv, day: true }); debt -= v; v = 0; }
        else if (debt > 0) { const t = Math.min(v, debt); v -= t; debt -= t; }
        m.set(k, (m.get(k) || 0) + v); raw.set(k, (raw.get(k) || 0) + rv);
      });
      out[f] = m; out[f + "Raw"] = raw;
    }
    return out;
  }
  // Couverture : mois de la première ligne de chaque statistique, et les lignes mensuelles brutes
  function parseCov(res, ids) {
    const first = new Map(), rows = new Map();
    for (const id of ids) {
      const list = sortRows(res, id);
      if (!list || !list.length) { first.set(id, "none"); continue; }
      first.set(id, TZ.key(list[0].start).slice(0, 7));
      rows.set(id, new Map(list.map((r) => [TZ.key(r.start).slice(0, 7), Number.isFinite(r.change) ? r.change : 0])));
    }
    return { first, rows };
  }

  /* ─── Construction des journées ───────────────────────────────────── */
  const NUM = ["prod", "cons", "self", "chg", "dch", "imp", "exp", "hp", "hc", "hsc", "ev", "evSun", "evGrid", "evHp", "evHc", "evHsc", "savings"];
  const blank = (extra) => NUM.reduce((o, f) => ((o[f] = NaN), o), { ...extra });
  const tariffAt = (h) => BZ.tariffAt(h);
  const derive = (o) => {
    o.cons = Math.max(0, o.prod - o.exp + o.imp - o.chg + o.dch);
    o.self = Math.max(0, o.prod - o.exp - o.chg);
    return o;
  };
  // Économies sans statistique : estimées heure par heure (soleil direct et batterie au prix du tarif de cette heure,
  // surplus au prix de revente) ; sans les heures, au prix des heures pleines (dit comme tel)
  const resale = () => Number(C.prix_revente_kwh) || 0;
  const estHour = (x, h) => (Math.max(0, x.prod - x.exp - x.chg) + x.dch) * BZ.TARIFS[tariffAt(h)].price() + x.exp * resale();
  const estimate = (o) => (o.self + o.dch) * BZ.TARIFS.hp.price() + o.exp * resale();
  const estSlots = (S, w = () => 1) => {
    if (!S || !S.prod || !S.exp || !S.chg || !S.dch) return NaN;
    return H24.reduce((a, h) => a + (w(h) ? estHour({ prod: S.prod[h] * w(h), exp: S.exp[h] * w(h), chg: S.chg[h] * w(h), dch: S.dch[h] * w(h) }, h) : 0), 0);
  };
  const absentList = () => ["energie", "voiture"].filter((g) => has(g) === false);
  const hData = (k) => { const c = chunks.get(`h:${k}`); return c && c.data ? c.data : null; };
  // Achat (et recharge réseau) par tarif d'un jour passé : compteurs à tarifs s'ils collent à l'achat du jour, sinon heure par heure
  function splitOf(k, imp, D, ev) {
    const o = { hp: NaN, hc: NaN, hsc: NaN, evHp: NaN, evHc: NaN, evHsc: NaN, splitLoading: false };
    const hd = hData(k);
    let hrs = hd ? hd.slots : null;
    const tarif = has("tarifs") && D && D.impHp && D.impHp.has(k) && D.impHc.has(k) && D.impHsc.has(k) ? [D.impHp.get(k), D.impHc.get(k), D.impHsc.get(k)] : null;
    const tarifOk = tarif && Math.abs(tarif[0] + tarif[1] + tarif[2] - imp) <= Math.max(0.05, 0.02 * imp);
    const needEv = ev && has("voiture") === true, needImp = Number.isFinite(imp) && !tarifOk;
    if (!hrs && (needImp || needEv)) {
      const T = need("t", monthOf(k), 1);
      if (T.data) hrs = T.data.days.get(k) || {}; else { o.splitLoading = !T.err; o.splitError = !!T.err; }
    }
    if (tarifOk) [o.hp, o.hc, o.hsc] = tarif;
    else if (hrs && Number.isFinite(imp)) { o.hp = o.hc = o.hsc = 0; if (hrs.imp) H24.forEach((h) => { o[tariffAt(h)] += hrs.imp[h]; }); }
    if (!needEv) return o;
    if (hrs) { o.evHp = o.evHc = o.evHsc = 0; if (hrs.evGrid) H24.forEach((h) => { o["ev" + cap(tariffAt(h))] += hrs.evGrid[h]; }); }
    return o;
  }
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const memo = new Map();
  function dayRow(date) {
    const k = typeof date === "string" ? date : pageKey(date), tk = todayKey(), d = typeof date === "string" ? dayDate(date) : date;
    if (k === tk) return todayRow(d);
    if (k > tk) return blank({ date: d });
    const m = memo.get(k);
    if (m && m.seq === seq) { touch(k, m.row); return { ...m.row, date: d }; }
    const row = buildDay(k);
    memo.set(k, { seq, row });
    return { ...row, date: d };
  }
  // Les morceaux que lit une journée mémorisée sont redemandés (relance après un échec, rafraîchissement)
  const touch = (k, row) => { if (!row.nocovAll) need("d", monthOf(k), 0); };
  // Les compteurs d'une journée passée, tels que lus (par jour), sans répartition par tarif : couverture de chaque champ,
  // pics écartés, journée invraisemblable (au-delà du plafond du jour : ses heures sont lues pour trouver l'heure du pic ;
  // si la journée reste invraisemblable sans elle, elle est écartée). null tant qu'un morceau manque (wait)
  const bases = new Map();
  function dayBase(k) {
    const m = bases.get(k);
    if (m && m.seq === seq) return m.b;
    const b = dayBase0(k);
    bases.set(k, { seq, b });
    return b;
  }
  function dayBase0(k) {
    const mk = monthOf(k);
    // Rien de lisible ce jour-là (avant tous les compteurs) : pas d'appel
    const any = DAYF.some((f) => FIELDS[f] && mk >= firstOf(fid(f)));
    let D = null;
    if (any) {
      const Dc = need("d", mk, 0);
      D = Dc.data;
      if (!D) return { wait: Dc.err ? { error: true } : { loading: true } };
    }
    const o = {}, st = {};
    let gap = false, nocov = false, wait = false;
    for (const f of DAYF) {
      st[f] = coverOf(f, k, D);
      if (st[f] === "absent") { o[f] = NaN; continue; }
      if (st[f] === "pre") { o[f] = 0; continue; }
      if (st[f] === "no") { o[f] = NaN; nocov = true; continue; }
      const v = D[f] ? D[f].get(k) : undefined;
      if (v == null) { o[f] = 0; if (GROUPS.energie.includes(f)) gap = true; continue; }   // aucune ligne ce jour-là (HA arrêté)
      o[f] = v - spikeSum(f, k);
      const capD = CAPS()[f];
      if (o[f] > capD) {
        const hc = need("h", k, 0);
        if (!hc.data && !hc.err) wait = true;
        else { SUSPECT.set(`${k}:${f}`, { key: k, f, raw: o[f], cap: capD }); o[f] = 0; o.suspect = true; }   // même sans le pic, trop : écartée
      }
    }
    if (wait) return { wait: { loading: true } };
    if (o.evSun + o.evGrid > CAPS().ev) { SUSPECT.set(`${k}:ev`, { key: k, f: "ev", raw: o.evSun + o.evGrid, cap: CAPS().ev }); o.evSun = o.evGrid = 0; o.suspect = true; }
    return { o, st, D, any, gap, nocov };
  }
  function buildDay(k) {
    if (!metaOk()) return blank(META.status === "error" ? { error: true } : { loading: true });
    const absent = absentList();
    if (has("energie") === false) return blank({ absent });
    const B = dayBase(k);
    if (B.wait) return blank(B.wait);
    const { st, D, any, gap, nocov } = B, o = { ...B.o };
    if (has("voiture") !== true) o.evSun = o.evGrid = NaN;
    Object.assign(o, splitOf(k, o.imp, D, st.evGrid === "yes"));
    if (st.evGrid === "pre" || st.evGrid === "no") o.evHp = o.evHc = o.evHsc = st.evGrid === "no" ? NaN : 0;
    if (o.suspect && o.evSun === 0 && o.evGrid === 0) o.evHp = o.evHc = o.evHsc = 0;
    derive(o);
    o.ev = o.evSun + o.evGrid;
    const eco = has("economies");
    if (eco === "est") Object.assign(o, estDay(k, o, st.prod === "pre"));
    else if (eco !== true) o.savings = NaN;
    if (gap) o.gap = true;
    if (nocov) { o.nocov = true; if (!any) o.nocovAll = true; }
    if (st.prod === "pre") o.pre = true;
    if (absent.length) o.absent = absent;
    return o;
  }
  // Économies estimées d'un jour passé : ses heures (lues pour le jour, ou celles du mois) au prix de chaque heure
  function estDay(k, o, pre) {
    if (pre) return { savings: 0, est: true };
    if (!Number.isFinite(o.prod + o.exp + o.chg + o.dch)) return { savings: NaN, est: true };
    const hd = hData(k);
    let S = hd ? hd.slots : null;
    if (!S) { const T = need("t", monthOf(k), 1); if (T.data) S = T.data.days.get(k) || null; else if (!T.err) return { savings: NaN, est: true, splitLoading: true }; }
    const v = estSlots(S);
    return Number.isFinite(v) ? { savings: v, est: true } : { savings: estimate(o), est: true, estHp: true };
  }

  /* ─── Aujourd'hui ─────────────────────────────────────────────────── */
  // Heures déjà écrites par HA + reste du compteur du jour en direct (heure en cours, ou l'heure d'avant si HA ne l'a pas
  // encore écrite : sa ligne arrive vers HH:00:10). Le reste est inconnu (pas d'heure inventée) quand le compteur n'a pas
  // de statistiques, quand elles ne commencent qu'aujourd'hui, ou quand HA n'écrit plus les heures depuis un moment
  function todayParts() {
    const now = Date.now(), p = TZ.parts(now), cur = p.h, k = todayKey();
    const c = need("h", k, 0), T = BZ.today();
    const live = { prod: T.prod, imp: T.imp, exp: T.exp, chg: T.chg, dch: T.dch, savings: T.savings,
      evSun: has("voiture") === true ? todaySoFar("evSun") : NaN, evGrid: has("voiture") === true ? todaySoFar("evGrid") : NaN };
    if (!c.data) return { k, cur, p, T, live, ok: false, err: !!c.err };
    const n = c.data.n, S = c.data.slots;
    const lag = cur > 0 && !n[cur - 1] && p.mi < 12;
    const remSlot = lag ? cur - 1 : cur;
    const stale = remSlot > 0 && !n[remSlot - 1] && !dstSkipped(k, remSlot - 1);
    const done = {}, rem = {};
    for (const f of Object.keys(live)) {
      const s = S[f]; done[f] = s ? H24.reduce((a, h) => a + (h < cur ? s[h] : 0), 0) : 0;
      // Capteur du jour arrondi (ou en retard de quelques minutes) un peu sous les heures écrites : les heures font foi,
      // la somme des cases reste le chiffre du jour. Écart plus grand : le capteur est gardé et le contrôle C1 le signale
      if (Number.isFinite(live[f]) && live[f] < done[f] && done[f] - live[f] <= tolC1(f, live[f])) live[f] = done[f];
      const startsToday = FIELDS[f] && FIRST.get(fid(f)) === monthOf(k) && knownFrom(f) === k;
      rem[f] = Number.isFinite(live[f]) && s && !startsToday && !stale ? Math.max(0, live[f] - done[f]) : NaN;
    }
    if (lag && !c.lagTimer) {   // l'heure d'avant n'est pas encore écrite : on la relit dans une et dans six minutes
      c.lagTimer = true;
      [6e4, 36e4].forEach((ms) => setTimeout(() => { c.lagTimer = false; enqueue(c, 1); }, ms));
    }
    return { k, cur, p, T, live, ok: true, n, S, lag, remSlot, done, rem };
  }
  function todayRow(date) {
    const P = todayParts(), L = P.live;
    const o = { date, prod: L.prod, imp: L.imp, exp: L.exp, chg: L.chg, dch: L.dch, savings: L.savings, partial: true };
    o.cons = o.prod - o.exp + o.imp - o.chg + o.dch; o.self = Math.max(0, o.prod - o.exp - o.chg);   // même calcul que BZ.today()
    const eco = has("economies");
    if (!Number.isFinite(o.savings) && eco === "est") {
      o.est = true;
      // Heures écrites au prix de leur heure, plus le reste de l'heure en cours au prix de cette heure
      if (P.ok && P.S.prod && P.S.exp && P.S.chg && P.S.dch) {
        const r = P.rem, done = estSlots(P.S, (h) => (h < P.cur ? 1 : 0)), more = estHour({ prod: r.prod, exp: r.exp, chg: r.chg, dch: r.dch }, P.remSlot);
        o.savings = done + (Number.isFinite(more) ? more : 0);
        if (!Number.isFinite(o.savings)) { o.savings = estimate(o); o.estHp = true; }
      } else if (P.ok || P.err) { o.savings = estimate(o); o.estHp = true; } else o.savings = NaN;
    }
    o.evSun = P.live.evSun; o.evGrid = P.live.evGrid; o.ev = o.evSun + o.evGrid;
    if (has("voiture") === false) o.absent = ["voiture"];
    Object.assign(o, { hp: NaN, hc: NaN, hsc: NaN, evHp: NaN, evHc: NaN, evHsc: NaN });
    if (P.ok) {
      const sp = { hp: 0, hc: 0, hsc: 0, evHp: 0, evHc: 0, evHsc: 0 }, kRem = tariffAt(P.remSlot);
      H24.forEach((h) => { if (h >= P.cur) return; const k = tariffAt(h); if (P.S.imp) sp[k] += P.S.imp[h]; if (P.S.evGrid) sp["ev" + cap(k)] += P.S.evGrid[h]; });
      sp[kRem] += P.rem.imp; sp["ev" + cap(kRem)] += P.rem.evGrid;
      Object.assign(o, sp);
      if (has("voiture") !== true) o.evHp = o.evHc = o.evHsc = NaN;
    } else o.splitLoading = !P.err;
    // En attente : l'achat par tarif (heures du jour, splitLoading) ; la voiture (nombre « jusqu'à maintenant », evLoading)
    if (has("voiture") === true && !Number.isFinite(o.ev)) o.evLoading = true;
    if (META.status !== "ok" && META.status !== "error") o.loading = true;
    return o;
  }
  // Prévision de l'heure : Solcast heure par heure si l'attribut existe, sinon le reste prévu du jour réparti
  // comme la production des 7 derniers jours (étiquetée estimation), sinon rien
  function hourlyForecast(P) {
    const fc = new Float64Array(24), id = C.prevision_jour_kwh, a = id ? BZ.attr(id, "detailedHourly") || BZ.attr(id, "detailedForecast") : null;
    if (Array.isArray(a) && a.length) {
      const ts = a.map((x) => Date.parse(x.period_start)).filter(Number.isFinite), step = ts.length > 1 ? Math.max(0.25, Math.min(1, (ts[1] - ts[0]) / HOUR)) : 1;
      a.forEach((x) => { const t = Date.parse(x.period_start), v = Number(x.pv_estimate); if (Number.isFinite(t) && Number.isFinite(v) && TZ.key(t) === P.k) fc[TZ.parts(t).h] += v * step; });
      return { fc, est: false };
    }
    const left = Math.max(0, (Number.isFinite(P.T.forecast) ? P.T.forecast : 0) - (P.ok ? P.done.prod : 0));
    if (!(left > 0)) return { fc, est: false };
    const shape = new Float64Array(24);
    for (let i = 1; i <= 7; i++) {
      const k = addDays(P.k, -i), hd = hData(k);
      const day = hd ? hd.slots : (() => { const t = need("t", monthOf(k), 2); return t.data ? t.data.days.get(k) : null; })();
      if (day && day.prod) H24.forEach((h) => { shape[h] += day.prod[h]; });
    }
    const w = H24.reduce((s, h) => s + (h >= P.cur ? shape[h] : 0), 0);
    if (w > 0) H24.forEach((h) => { if (h >= P.cur) fc[h] = (left * shape[h]) / w; });
    return { fc, est: w > 0 };
  }
  const slotOf = (h, extra) => ({ h, label: `${h}h`, tariff: tariffAt(h), ...extra });
  // Une heure écrite par HA : compteurs de l'heure, conso et soleil direct déduits, niveau moyen de la batterie
  // (st : couverture du jour ; avant les panneaux, production et batterie à 0 ; avant un compteur, inconnu)
  function filled(S, h, n, extra, st) {
    const o = slotOf(h, extra);
    for (const f of DAYF) o[f] = st && st[f] === "pre" ? 0 : st && (st[f] === "no" || st[f] === "absent") ? NaN : S[f] ? S[f][h] : NaN;
    const eco = has("economies");
    if (eco !== true) o.savings = eco === "est" ? (st && st.prod === "pre" ? 0 : estHour(o, h)) : NaN;
    derive(o);
    if (!Number.isFinite(o.cons)) o.cons = null;
    o.soc = S.soc ? S.soc[h] : NaN;
    if (n > 1) o.dst = "double";
    return o;
  }
  function hours() {
    const P = todayParts(), { fc, est } = hourlyForecast(P);
    if (!P.ok) return H24.map((h) => slotOf(h, { future: h > P.cur, current: h === P.cur, prod: h > P.cur ? fc[h] : NaN, cons: null, fc: fc[h], fcEst: est || undefined, loading: !P.err, error: P.err || undefined }));
    return H24.map((h) => {
      const base = { future: h > P.cur, current: h === P.cur };
      if (h > P.cur) return slotOf(h, { ...base, prod: fc[h], cons: null, fc: fc[h], fcEst: est || undefined });
      if (h === P.remSlot) {
        const o = slotOf(h, { ...base, partial: true, fc: h === P.cur ? fc[h] : undefined });
        for (const f of DAYF) o[f] = P.rem[f];
        if (has("economies") === "est" && !Number.isFinite(o.savings)) o.savings = estHour(o, h);
        derive(o);
        if (!Number.isFinite(o.prod)) { o.prod = 0; o.cons = null; o.unknown = true; }
        else if (!Number.isFinite(o.cons)) o.cons = null;
        o.soc = NaN;
        return o;
      }
      if (h === P.cur) return slotOf(h, { ...base, partial: true, prod: 0, cons: 0, imp: 0, exp: 0, chg: 0, dch: 0, savings: 0, fc: fc[h] });   // l'heure d'avant est encore en cours d'écriture
      if (!P.n[h]) return slotOf(h, { ...base, prod: 0, cons: null, gap: true, dst: dstSkipped(P.k, h) ? "skipped" : undefined });
      return filled(P.S, h, P.n[h], base);
    });
  }
  // Heure locale qui n'existe pas (passage à l'heure d'été)
  const dstSkipped = (k, h) => { const [y, m, d] = ymd(k), t = TZ.at(y, m - 1, d, h); return TZ.parts(t).h !== h; };
  // Couverture de chaque champ un jour passé (le mois de la première ligne d'un compteur se lit par jour)
  function coverDay(k) {
    const mk = monthOf(k), late = DAYF.some((f) => FIELDS[f] && FIRST.get(fid(f)) === mk);
    const D = late ? need("d", mk, 0) : null;
    if (late && !D.data) return null;
    const st = {}; DAYF.forEach((f) => { st[f] = coverOf(f, k, D && D.data); });
    return st;
  }
  const covered = (st) => DAYF.some((f) => st[f] === "yes");
  function hoursOf(date) {
    const k = pageKey(date);
    if (k === todayKey()) return hours();
    const wait = (err) => H24.map((h) => slotOf(h, { prod: NaN, cons: null, loading: !err, error: err || undefined }));
    if (!metaOk()) return wait(META.status === "error");
    const st = coverDay(k);
    if (!st) return wait(false);
    if (!covered(st)) return H24.map((h) => slotOf(h, { prod: 0, cons: null, pre: st.prod === "pre" || undefined, nocov: true }));
    const c = need("h", k, 0);
    if (!c.data) return wait(!!c.err);
    return H24.map((h) => (c.data.n[h] ? filled(c.data.slots, h, c.data.n[h], {}, st) : slotOf(h, { prod: 0, cons: null, gap: true, dst: dstSkipped(k, h) ? "skipped" : undefined })));
  }
  // Une journée passée arrêtée à l'heure H (décimale, heure de HA) : heures entières avant H, plus la part de l'heure entamée
  function cut(date, H) {
    const k = typeof date === "string" ? date : pageKey(date), d = typeof date === "string" ? dayDate(date) : date;
    if (!metaOk()) return blank({ date: d, loading: META.status !== "error", error: META.status === "error" || undefined });
    if (has("energie") === false) return blank({ date: d, absent: absentList() });
    const st = coverDay(k);
    if (!st) return blank({ date: d, loading: true });
    const pre = st.prod === "pre";
    if (!covered(st)) return Object.assign(blank({ date: d, nocov: true, nocovAll: true }), pre ? { prod: 0, exp: 0, chg: 0, dch: 0, self: 0, savings: 0, evSun: 0, pre: true } : {});
    const c = need("h", k, 0);
    if (!c.data) return blank({ date: d, loading: !c.err, error: !!c.err || undefined });
    const S = c.data.slots, hh = Math.floor(H), fr = H - hh, w = (h) => (h < hh ? 1 : h === hh ? fr : 0);
    const o = { date: d, hp: 0, hc: 0, hsc: 0, evHp: 0, evHc: 0, evHsc: 0 };
    let nocov = false;
    for (const f of DAYF) {
      if (st[f] === "pre") o[f] = 0;
      else if (st[f] === "no" || st[f] === "absent") { o[f] = NaN; if (st[f] === "no") nocov = true; }
      else o[f] = S[f] ? H24.reduce((a, h) => a + S[f][h] * w(h), 0) : 0;
    }
    H24.forEach((h) => { const t = tariffAt(h); if (S.imp) o[t] += S.imp[h] * w(h); if (S.evGrid) o["ev" + cap(t)] += S.evGrid[h] * w(h); });
    if (!Number.isFinite(o.imp)) o.hp = o.hc = o.hsc = NaN;
    derive(o);
    if (has("voiture") !== true || st.evGrid === "no") o.evSun = o.evGrid = o.evHp = o.evHc = o.evHsc = NaN;
    o.ev = o.evSun + o.evGrid;
    const eco = has("economies");
    if (eco === "est") { o.savings = pre ? 0 : estSlots(S, w); o.est = true; } else if (eco !== true) o.savings = NaN;
    if (nocov) o.nocov = true;
    if (pre) o.pre = true;
    return o;
  }

  /* ─── Mois, années, périodes ──────────────────────────────────────── */
  // Somme de journées. Inconnu (en chargement) = inconnu ; un jour sans historique (avant un compteur) n'est pas compté
  // (et le compte des jours manquants suit) ; un champ inconnu tous les jours reste inconnu
  function sumRows(rows) {
    const o = {};
    for (const f of NUM) {
      let s = 0, seen = false, unknown = false;
      for (const x of rows) {
        const v = x[f];
        if (v == null) { seen = true; continue; }
        if (Number.isFinite(v)) { s += v; seen = true; } else if (!x.nocov) unknown = true;
      }
      o[f] = unknown ? NaN : seen ? s : rows.length ? NaN : 0;
    }
    o.loading = rows.some((x) => x.loading); o.error = rows.some((x) => x.error); o.est = rows.some((x) => x.est); o.estHp = rows.some((x) => x.estHp);
    o.gaps = rows.reduce((a, x) => a + (x.gap ? 1 : x.gaps || 0), 0);
    o.nocov = rows.reduce((a, x) => a + (x.nocovDays != null ? x.nocovDays : x.nocov ? 1 : 0), 0);
    o.splitLoading = rows.some((x) => x.splitLoading);
    o.suspect = rows.some((x) => x.suspect);
    if (rows.length && rows.every((x) => x.pre)) o.pre = true;
    const ab = [...new Set(rows.flatMap((x) => x.absent || []))]; if (ab.length) o.absent = ab;
    return o;
  }
  const finish = (o) => { if (o.nocov) { o.nocovDays = o.nocov; o.nocov = true; } else delete o.nocov; return o; };
  // Mois m (0-11) de l'année y : la somme de ses journées (jusqu'à lastDay, ou aujourd'hui pour le mois en cours)
  function monthSum(y, m, lastDay) {
    const mk = `${y}-${pad(m + 1)}`, tk = todayKey(), cm = monthOf(tk);
    if (mk > cm) return blank({});
    const last = lastDay != null ? Math.min(lastDay, daysIn(mk)) : mk === cm ? +tk.slice(8) : daysIn(mk);
    return finish(sumRows(Array.from({ length: last }, (_, i) => dayRow(`${mk}-${pad(i + 1)}`))));
  }
  // Journées de a à b (clés comprises) ; H : la dernière journée arrêtée à cette heure (aujourd'hui l'est déjà)
  function span(a, b, H) {
    const rows = [];
    for (let k = a; k <= b; k = addDays(k, 1)) rows.push(H != null && k === b && k !== todayKey() ? cut(k, H) : dayRow(k));
    return finish(sumRows(rows));
  }
  // Une période et celle d'avant, à l'identique : seulement ce qui est connu des deux côtés (panneaux posés, compteurs
  // existants), même durée, la période d'avant arrêtée à la même heure quand la période en cours finit maintenant.
  //  shift(clé d'avant) → clé de la période en cours au même rang
  function like({ a, b, pa, pb, live, group = "energie", shift }) {
    const cf = compareFrom(group);
    if (cf == null) return { loading: true, prevTotal: blank({ loading: true }), cmpTotal: null };
    if (pb < cf) return { none: true, from: cf, before: pb < SOLAR0 && group !== "voiture", prevTotal: blank({}), cmpTotal: null };
    const pa2 = pa < cf ? cf : pa, a2 = pa2 === pa ? a : shift(pa2);
    const prevTotal = span(pa2, pb, live ? nowH() : null);
    return { prevTotal, cmpTotal: a2 === a ? null : span(a2, b), partial: pa2 !== pa, from: a2, pfrom: pa2 };
  }
  // Décalages usuels d'une période à la précédente (jours ; même jour du mois ; même jour de l'année)
  const shifts = {
    days: (n) => (k) => addDays(k, n),
    month: (mk) => (k) => `${mk}-${pad(Math.min(+k.slice(8), daysIn(mk)))}`,
    year: (y) => (k) => { const mm = k.slice(5, 7); return `${y}-${mm}-${pad(Math.min(+k.slice(8), daysIn(`${y}-${mm}`)))}`; },
  };

  /* ─── Voiture, économies, prévisions ──────────────────────────────── */
  // Recharge réseau par tarif entre deux instants (séance en cours) : heures écrites + reste du jour à l'heure en cours
  function evSplitBetween(from, to) {
    const o = { evHp: NaN, evHc: NaN, evHsc: NaN };
    if (!Number.isFinite(from) || !Number.isFinite(to) || has("voiture") !== true || to - from > 7 * DAY) return o;
    const sp = { evHp: 0, evHc: 0, evHsc: 0 }, from0 = from - (from % HOUR + HOUR) % HOUR, tk = todayKey();
    for (let k = TZ.key(from); k <= TZ.key(to); k = addDays(k, 1)) {
      const c = need("h", k, 1);
      if (!c.data) return o;
      (c.data.rows.evGrid || []).forEach((r) => { if (r.start >= from0 && r.start < to) sp["ev" + cap(tariffAt(TZ.parts(r.start).h))] += r.v; });
    }
    if (TZ.key(to) === tk) {
      const P = todayParts();
      if (!P.ok || !Number.isFinite(P.rem.evGrid)) return o;
      sp["ev" + cap(tariffAt(P.remSlot))] += P.rem.evGrid;
    }
    return sp;
  }
  // Aujourd'hui jusqu'à maintenant (statistique « un seul nombre », précise à 5 min) : voiture, ou compteur du jour indisponible
  function todaySoFar(f) {
    if (!metaOk() || !fid(f)) return NaN;
    const c = need("s", `${todayKey()}|${f}`, 0);
    return c.data != null ? c.data : NaN;
  }
  // Économies sur 365 jours / depuis le 1er janvier, sur les journées connues seulement (pics écartés) :
  // { v, from (premier jour compté), days (jours comptés depuis la mise en service), full (fenêtre entière connue) }
  function savingsWindow(w) {
    const eco = has("economies");
    if (eco !== true && eco !== "est") return { v: NaN };
    const tk = todayKey(), from0 = w === "ytd" ? `${tk.slice(0, 4)}-01-01` : addDays(tk, -364);
    let kf = "0000-01-01";
    for (const f of eco === true ? ["savings"] : ["prod", "exp", "chg", "dch"]) { const k = knownFromEff(f); if (k == null) return { v: NaN, loading: true }; kf = maxKey(kf, k); }
    if (kf > tk) return { v: NaN };
    const from = maxKey(from0, kf);
    // Statistique d'économies : ses journées seulement (pas besoin de la répartition par tarif) ; estimées : les journées entières
    let r;
    if (eco === true) {
      if (!metaOk()) return { v: NaN, loading: true };
      let v = 0, loading = false, error = false;
      for (let k = from; k <= tk; k = addDays(k, 1)) {
        const x = k === tk ? todayRow(dayDate(k)) : dayBase(k), o = x.o || x;
        if (x.wait) { loading = loading || !!x.wait.loading; error = error || !!x.wait.error; continue; }
        if (Number.isFinite(o.savings)) v += o.savings; else if (!(x.st && x.st.savings === "no")) loading = true;
      }
      r = { savings: v, loading, error };
    } else r = span(from, tk);
    if (r.loading || r.error) return { v: NaN, loading: !!r.loading };
    const live = maxKey(from, SOLAR0);   // avant la mise en service : 0 connu, mais pas des jours « de rendement »
    return { v: r.savings, from, full: from === from0, days: live > tk ? 0 : dayNum(tk) - dayNum(live) + 1 };
  }
  // Jours suivants : capteurs de prévision de config.js (demain, jour 3…) ; au-delà, rien d'inventé
  function forecastDay(date) {
    const ids = Array.isArray(C.prevision_jours_kwh) ? C.prevision_jours_kwh : [], n = dayNum(pageKey(date)) - dayNum(todayKey());
    const v = n >= 1 && n <= ids.length ? BZ.num(ids[n - 1]) : NaN;
    return { date, prod: Number.isFinite(v) ? Math.max(0, v) : 0, forecast: true };
  }
  // Énergie : la journée heure par heure (heures écrites), niveau de batterie moyen de chaque heure + direct au bout
  function dayModel() {
    const P = todayParts(), soc = BZ.num(C.batterie_soc), H = P.cur + P.p.mi / 60 + P.p.s / 3600;
    const X = (t) => (H > 0 ? BZ.clamp(t / H, 0, 1) : 0), out = { prod: [], net: [], soc: [] };
    if (P.ok) H24.forEach((h) => {
      if (h >= P.cur || !P.n[h]) return;
      const S = P.S, x = X(h + 0.5);
      if (S.prod) out.prod.push([x, S.prod[h]]);
      if (S.exp && S.imp) out.net.push([x, S.exp[h] - S.imp[h]]);
      if (S.soc && Number.isFinite(S.soc[h])) out.soc.push([x, S.soc[h]]);
    });
    if (Number.isFinite(soc)) out.soc.push([1, soc]);
    return out;
  }

  /* ─── Contrôles de cohérence (C1 à C4) ─────────────────────────────── */
  const kw = (f) => (f === "savings" ? "€" : "kWh");
  function tolC1(f, live) { return f === "savings" ? 0.1 : Math.max(0.2, 0.03 * live); }
  const LBL = { prod: "Production", imp: "Achat réseau", exp: "Revente", chg: "Charge batterie", dch: "Décharge batterie", evSun: "Recharge solaire", evGrid: "Recharge réseau", savings: "Économies", impHp: "Achat HP", impHc: "Achat HC", impHsc: "Achat HSC", ev: "Recharge" };
  const fmt2 = (v, f) => `${BZ.fmt.n(v, 2)} ${kw(f)}`;
  // Compteur du jour en direct, en kWh (un compteur en Wh est converti) ; économies en €
  const liveOf = (f) => (f === "savings" ? BZ.num(C[LIVE_KEY[f]]) : BZ.energy(C[LIVE_KEY[f]]));
  function checks() {
    const out = [], tk = todayKey();
    // C1 : aujourd'hui, les heures écrites ne dépassent pas le compteur du jour en direct
    const h = chunks.get(`h:${tk}`), cur = TZ.parts(Date.now()).h;
    if (h && h.data) for (const f of Object.keys(LIVE_KEY)) {
      const live = liveOf(f), s = h.data.slots[f];
      if (!Number.isFinite(live) || !s) continue;
      const done = H24.reduce((a, x) => a + (x < cur ? s[x] : 0), 0), tol = tolC1(f, live);
      out.push({ id: "C1", f, ok: done <= live + tol, text: `${LBL[f]} : l'historique d'aujourd'hui (${fmt2(done, f)}) dépasse le compteur du jour (${fmt2(live, f)}).` });
    }
    // C2 : mois complets, somme des jours = ligne du mois (valeurs brutes de HA : ses deux réductions s'accordent)
    for (const c of chunks.values()) {
      if (c.fam !== "d" || !c.data || c.key >= monthOf(tk)) continue;
      for (const f of SUMS) {
        const M = COVROWS.get(fid(f));
        if (!c.data[f + "Raw"] || !M || !M.has(c.key)) continue;
        const sd = [...c.data[f + "Raw"].values()].reduce((a, v) => a + v, 0), mv = M.get(c.key);
        out.push({ id: "C2", f, ok: Math.abs(sd - mv) <= 0.01, text: `${LBL[f]}, ${c.key} : somme des jours ${fmt2(sd, f)} ≠ mois ${fmt2(mv, f)} (contrôle interne).` });
      }
    }
    // C3 : économies depuis la mise en service vs compteur cumulé (s'il a démarré ailleurs, simple info)
    const total = BZ.num(C.economies_total_eur), M = COVROWS.get(fid("savings"));
    if (has("economies") === true && Number.isFinite(total) && M && total > 0) {
      let s = 0; M.forEach((v, mk) => { if (mk >= monthOf(SOLAR0)) s += v; });
      SPIKES.forEach((x) => { if (x.f === "savings" && x.k >= SOLAR0) s -= x.cut; });
      out.push({ id: "C3", f: "savings", ok: Math.abs(s - total) <= 0.05 * total, level: "info", text: `Économies : ${BZ.fmt.n(s, 0)} € dans l'historique depuis ${SOLAR0}, ${BZ.fmt.n(total, 0)} € au compteur cumulé ; il a peut-être démarré à une autre date.` });
    }
    // C4 : hier, somme des heures affichées = chiffre du jour affiché
    const yk = addDays(tk, -1), Hy = chunks.get(`h:${yk}`), Dy = chunks.get(`d:${monthOf(yk)}`);
    if (Hy && Hy.data && Dy && Dy.data) {
      const row = dayRow(yk);
      for (const f of ["prod", "imp", "exp", "chg", "dch", ...(has("economies") === true ? ["savings"] : [])]) {
        const sl = Hy.data.slots[f], dv = row[f];
        if (!sl || !Number.isFinite(dv)) continue;
        const sh = sl.reduce((a, v) => a + v, 0);
        out.push({ id: "C4", f, ok: Math.abs(sh - dv) <= 0.01, text: `${LBL[f]}, hier : somme des heures ${fmt2(sh, f)} ≠ jour ${fmt2(dv, f)} (contrôle interne).` });
      }
    }
    return out;
  }

  /* ─── Diagnostic ──────────────────────────────────────────────────── */
  const WHY = {
    missing: (p, r) => `Pas d'historique pour ${r.label} : ajoute state_class: total_increasing à ce capteur (ou attends une heure, le temps que Home Assistant crée ses statistiques).`,
    nosum: (p, r) => `Pas d'historique pour ${r.label} : ce capteur n'a pas de cumul (state_class total_increasing ou total).`,
    measure: (p) => `${p.id} est une mesure (moyenne), pas un compteur : il lui faut state_class: total_increasing.`,
    nomean: (p, r) => `Pas d'historique pour ${r.label} : ce capteur n'a pas de moyenne (state_class: measurement).`,
    unit: (p, r) => `Unité ${p.unit || "absente"} au lieu de ${r.kind === "money" ? "€" : "kWh"} pour ${r.label}.`,
  };
  const de = (label) => label.replace(/^les /, "des ").replace(/^le /, "du ").replace(/^(la |l')/, "de $1");
  const fmtDay = (k) => { const [y, m, d] = ymd(k); return BZ.fmt.date(new Date(y, m - 1, d), { day: "numeric", month: "long", year: "numeric" }); };
  const fmtMonth = (mk) => { const [y, m] = ymd(mk); return `${BZ.MONTHS_LONG[m - 1]} ${y}`; };
  function issues() {
    const out = [];
    if (META.status === "error") out.push({ level: "warn", group: "history", transient: true, text: "Home Assistant n'a pas donné la liste de ses statistiques : l'historique réessaiera tout seul." });
    if (META.status === "ok") {
      for (const r of REG) {
        const cands = candidates(r), probs = PROBLEMS.filter((p) => p.f === r.f), got = FIELDS[r.f];
        if (!cands.length) continue;
        if (!got) {
          const p = probs[0] || { ...cands[0], why: "missing" };
          const level = r.group === "energie" ? "error" : r.group === "soc" ? "info" : r.group === "economies" && has("economies") === "est" ? "info" : "warn";
          out.push({ level, group: "history", id: p.id, key: p.key, text: WHY[p.why](p, r) + (r.group === "economies" && has("economies") === "est" ? " Les économies sont estimées avec tes tarifs." : "") });
          continue;
        }
        if (got.late) out.push({ level: "info", group: "history", id: got.id, key: got.key, text: `Historique ${de(r.label)} lu sur ce capteur : ${got.late.id} n'a de statistiques que depuis ${got.late.from === "9999-99" ? "jamais" : fmtMonth(got.late.from)}.` });
        else if (probs.length) out.push({ level: "info", group: "history", id: got.id, key: got.key, text: `Historique ${de(r.label)} lu sur ce capteur (${probs.map((p) => p.id).join(", ")} n'a pas de statistiques utilisables).` });
        // Compteur dont l'historique commence après la mise en service : avant, « — » (rien n'est inventé)
        if (r.kind !== "mean" && r.group !== "tarifs") {
          const kf = knownFrom(r.f), from = r.group === "voiture" ? "0000-01-01" : SOLAR0;
          if (kf && kf !== "0000-01-01" && kf > from && kf <= todayKey()) out.push({ level: "info", group: "history", id: got.id, key: got.key, text: `Historique ${de(r.label)} seulement depuis le ${fmtDay(kf)} : avant, Breezy affiche « — » et ne compare pas.` });
        }
      }
    }
    NEG.forEach((n) => out.push({ level: "info", group: "check", id: n.id, text: n.day ? `Correction négative ignorée le ${TZ.key(n.at)} (${BZ.fmt.n(n.raw, 2)} ${kw(n.f)}) : reprise sur les jours suivants.` : `Correction négative ignorée le ${TZ.key(n.at)} à ${TZ.parts(n.at).h} h (${BZ.fmt.n(n.raw, 2)} ${kw(n.f)}) : reprise sur les valeurs suivantes.` }));
    SPIKES.forEach((s) => out.push({ level: "warn", group: "check", id: s.id, text: `Valeur écartée le ${s.k} à ${TZ.parts(s.at).h} h : ${LBL[s.f] || s.f} = ${fmt2(s.raw, s.f)} en une heure, au-delà du plausible (${fmt2(s.cap, s.f)}). Souvent un compteur retombé à 0 puis revenu : retirée de la journée, du mois et des totaux.` }));
    SUSPECT.forEach((s) => out.push({ level: "warn", group: "check", text: `Valeur écartée le ${s.key} : ${LBL[s.f] || "Recharge"} = ${fmt2(s.raw, s.f)}, au-delà du plausible pour une journée (${fmt2(s.cap, s.f)}).` }));
    checks().filter((c) => !c.ok).forEach((c) => out.push({ level: c.level || "warn", group: "check", text: `${c.id} · ${c.text}` }));
    const failed = [...chunks.values()].filter((c) => c.status === "error");
    if (failed.length) out.push({ level: "info", group: "history", transient: true, text: `Home Assistant n'a pas répondu pour ${failed.length} morceau${failed.length > 1 ? "x" : ""} d'historique : nouvel essai automatique.` });
    return out;
  }
  // Échantillon brut (tous les types) pour « Copier le diagnostic » : demandé à l'ouverture du diagnostic
  function sample() {
    if (META.status !== "ok") return null;
    const c = need("x", todayKey(), 1);
    return c.data || null;
  }
  const debug = () => ({
    tz: tzName, start: SOLAR0, history_start: HSTART, meta: META.list, fields: FIELDS, problems: PROBLEMS,
    coverage: Object.fromEntries([...FIRST.entries()]), known_from: Object.fromEntries(DAYF.filter((f) => FIELDS[f]).map((f) => [f, knownFrom(f)])),
    chunks: [...chunks.values()].map((c) => [c.id, c.status, c.complete ? "fini" : "en cours", c.err ? c.err.code || String(c.err) : undefined]),
    samples: (chunks.get(`x:${todayKey()}`) || {}).data || null, negatives: [...NEG.values()], spikes: [...SPIKES.values()], suspects: [...SUSPECT.values()], checks: checks(), lastErrors: HA.errors,
  });

  /* ─── Démarrage, rafraîchissement, pause ───────────────────────────── */
  // Morceaux « vivants » (lus avant que HA ait fini de les écrire) : relus sur l'événement horaire, le minuteur, la reconnexion
  function refreshLive() {
    const tk = todayKey();
    for (const c of chunks.values()) {
      if (!c.data || c.complete || c.fam === "meta" || c.fam === "cov" || c.fam === "x") continue;
      if (c.fam === "s" && !c.key.startsWith(tk)) continue;   // nombres d'un jour passé : périmés
      enqueue(c, 1);
    }
  }
  function afterMeta() {
    screen(chunk("meta", "all").data);
    enqueue(chunk("cov", "all"), -1);
  }
  function afterCov() {
    const cv = chunk("cov", "all").data;
    FIRST = cv.first; COVROWS = cv.rows;
    resolve();
    // Préchargement : aujourd'hui, les 37 derniers jours, hier, les tarifs du mois, le début des compteurs créés tard
    const tk = todayKey(), cm = monthOf(tk);
    need("h", tk, 2);
    [...new Set([monthOf(addDays(tk, -36)), prevMonth(cm), cm])].forEach((mk) => { if (DAYF.some((f) => FIELDS[f] && firstOf(fid(f)) <= mk)) need("d", mk, 2); });
    if (has("voiture") === true) { todaySoFar("evSun"); todaySoFar("evGrid"); }
    need("h", addDays(tk, -1), 2);
    if (has("tarifs") !== true || has("voiture") === true || has("economies") === "est") { need("t", cm, 3); need("t", prevMonth(cm), 3); }
    DAYF.forEach((f) => { if (FIELDS[f]) knownFrom(f); });
  }
  let timers = [], unsub = null, dayNow = "", hourlyT = 0;
  function loadMeta() { META.status = "loading"; const c = chunk("meta", "all"); enqueue(c, -1); }
  function subscribe() {
    if (unsub) return;
    unsub = HA.subscribeEvents(() => { clearTimeout(hourlyT); hourlyT = setTimeout(refreshLive, 3000); }, "recorder_hourly_statistics_generated");
  }
  function startTimers() {
    stopTimers();
    const every = Math.max(1, Number(C.historique_rafraichir_min) || 10) * 6e4;
    timers.push(setInterval(refreshLive, every));
    timers.push(setInterval(() => { for (const c of chunks.values()) if (c.fam === "s" && c.data != null && c.key.startsWith(todayKey())) enqueue(c, 1); }, 5 * 6e4));
    // Changement de jour (dans le fuseau de HA) : hier est relu une fois fini d'écrire, le nouveau jour demandé au rendu
    timers.push(setInterval(() => { const k = todayKey(); if (k !== dayNow) { dayNow = k; seq++; refreshLive(); notify(); } }, 6e4));
  }
  const stopTimers = () => { timers.forEach(clearInterval); timers = []; };
  let started = false;
  function start() {
    if (started) return;
    started = true; dayNow = todayKey();
    loadMeta(); subscribe(); startTimers();
  }
  // Remise à zéro complète (fuseau changé, « Recharger l'historique ») : on oublie tout, métadonnées comprises
  function clear() {
    gen++; chunks.clear(); queue.length = 0; memo.clear(); bases.clear(); NEG.clear(); SPIKES.clear(); SUSPECT.clear();
    META = { status: "idle", list: null, by: null }; FIELDS = {}; PROBLEMS = []; OKC = new Map(); FIRST = new Map(); COVROWS = new Map(); seq++;
    loadingMark();
  }
  HA.on("ready", start);
  HA.on("meta", () => { if (HA.tz !== tzName) { tzName = HA.tz; TZ = makeTz(tzName); clear(); if (started) { loadMeta(); notify(); } } });
  HA.on("connection", (up) => { if (up && started && !paused) { if (META.status !== "ok") { if (META.list) enqueue(chunk("cov", "all"), -1); else loadMeta(); } refreshLive(); } });

  const provider = {
    day: dayRow, hours, hoursOf, forecastDay, forecastMonth: () => ({ prod: 0, forecast: true }), monthSum, todaySoFar, cut, dayModel,
    evSplitBetween, savingsWindow, has, span, like, shifts, sum: (rows) => finish(sumRows(rows)), nowH, key: pageKey, compareFrom, coverStart, knownFrom,
    get solarStart() { return SOLAR0; },
    status: () => ({ loading: META.status === "loading" || queue.length > 0 || inflight > 0, errors: [...chunks.values()].filter((c) => c.status === "error").length, inflight, lastFetch }),
    retry() { if (META.status === "error") { if (META.list) enqueue(chunk("cov", "all"), -1); else loadMeta(); } for (const c of chunks.values()) if (c.status === "error") { c.next = 0; enqueue(c, 0); } notify(); },
    refresh() { if (META.status !== "ok") { if (!META.list) loadMeta(); } else afterCov(); refreshLive(); notify(); },
    clear,
    pause() { paused = true; stopTimers(); clearTimeout(hourlyT); unsub = null; },   // le pont a déjà rendu l'abonnement à HA
    resume() { if (!paused) return; paused = false; if (!started) { start(); return; } subscribe(); startTimers(); refreshLive(); pump(); notify(); },
    get meta() { return META.list; }, get fields() { return FIELDS; },
    issues, sample, checks, debug,
  };
  BZ.useHistory(provider);
  if (HA.hass) start();
  BZ.extraActions = Object.assign(BZ.extraActions || {}, {
    "hist-retry": () => BZ.hist.retry(),
    "hist-reload": () => { BZ.hist.clear(); BZ.hist.refresh(); BZ.toast("Historique rechargé", "good"); },
  });
  // Console du navigateur : la forme réelle des données (métadonnées, échantillons, contrôles), sans jeton
  Object.defineProperty((window.BZ_DIAG = window.BZ_DIAG || {}), "history", { get: debug, configurable: true });
})();
