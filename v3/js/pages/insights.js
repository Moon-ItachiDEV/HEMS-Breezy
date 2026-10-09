// Bilan (V3) : l'historique et la rentabilité. Une seule période pilote toute la page.
//  En-tête : période (Jour / 7 jours / Mois / Année), ‹ › pour remonter dans le temps, export CSV
//  Ligne 1 : 4 indicateurs (vs la même durée juste avant, arrêtée à la même heure), mini-courbe sur la période
//  Gauche  : graphique principal, puis Comparaison (ce que les indicateurs ne disent pas) + Meilleurs moments
//  Droite  : D'où vient ta consommation (anneau + réseau par tarif), Rentabilité solaire
(() => {
  const BZ = window.BZ;
  const { h, esc, fmt, icon, val, card, pill, kpi, pills, donut, meter, btn, C } = BZ;

  /* ─── Historique de la page ──────────────────────────────────────────
     Construit sur BZ.day() (core.js), avec quatre corrections à remonter un jour dans core.js :
     1. rien n'est produit avant la mise en service (C.solaire_mise_en_service) ;
     2. la batterie ne stocke que ce que la soirée et la nuit consommeront, et en rend 90 % ;
     3. les économies des jours passés sont recalées pour que leur somme = compteur cumulé (BZ.roi().total) ;
     4. la période d'avant s'arrête à la même heure tant que la période en cours n'est pas finie. */
  // Début de l'historique : la mise en service (Home Assistant : historique_debut de config.js s'il est rempli)
  const [Y0, M0, D0] = String((BZ.hist && C.historique_debut) || C.solaire_mise_en_service).split("-").map(Number);
  const START = new Date(Y0, M0 - 1, D0);
  const HRS = Array.from({ length: 24 }, (_, i) => i);
  const SUN = (x) => Math.max(0, Math.exp(-((x + 0.5 - 13.2) ** 2) / (2 * 2.7 ** 2)) - 0.02);      // mêmes profils que BZ.hours()
  const USE = (x) => 0.35 + (x >= 6 && x < 8 ? 0.9 : 0) + (x >= 9 && x < 12 ? 1.6 : 0) + (x >= 18 && x < 21 ? 1.2 : 0) + (x >= 2 && x < 5 ? 0.6 : 0);
  const DARK = (x) => USE(x) * BZ.clamp(1 - 4 * SUN(x), 0, 1);                                   // conso sans soleil : batterie puis réseau
  const SUN_T = HRS.reduce((a, x) => a + SUN(x), 0), USE_T = HRS.reduce((a, x) => a + USE(x), 0);
  // Part d'un profil horaire déjà écoulée à l'heure H (décimale), éventuellement sur certaines heures seulement
  const share = (f, H, keep = () => true) => { let a = 0, t = 0; HRS.forEach((x) => { if (!keep(x)) return; t += f(x); a += f(x) * BZ.clamp(H - x, 0, 1); }); return t ? a / t : 0; };
  const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const isToday = (d) => sod(d).getTime() === sod(new Date()).getTime();
  const D12 = (y, m, d) => new Date(y, m, d, 12);
  const span = (a, n) => Array.from({ length: n }, (_, i) => D12(a.getFullYear(), a.getMonth(), a.getDate() + i));
  const daysIn = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const nowH = () => { const n = new Date(); return n.getHours() + n.getMinutes() / 60; };
  const TAR = ["hp", "hc", "hsc"];
  const FIELDS = ["prod", "cons", "self", "chg", "dch", "imp", "exp", "hp", "hc", "hsc", "savings"];
  // Home Assistant (BZ.hist) : une valeur inconnue (NaN, en chargement) le reste, un jour sans historique n'est pas compté,
  // et les drapeaux des jours suivent (history.js)
  const sum = (days) => (BZ.hist ? BZ.hist.sum(days) : FIELDS.reduce((o, f) => ((o[f] = days.reduce((a, x) => a + (x[f] || 0), 0)), o), {}));
  const worth = (x) => (x.self + x.dch) * 0.2 + x.exp * 0.06;     // même barème que BZ.day()

  const memo = new Map();
  function pastDay(date) {                                           // journée terminée, corrigée (économies avant recalage)
    const k = sod(date).getTime();
    if (memo.has(k)) return memo.get(k);
    const x = BZ.day(date);
    let o;
    if (sod(date) < START) {
      const r = x.imp ? x.cons / x.imp : 0;
      o = { ...x, prod: 0, self: 0, chg: 0, dch: 0, exp: 0, imp: x.cons, hp: x.hp * r, hc: x.hc * r, hsc: x.hsc * r, evSun: 0, raw: 0, pre: true };
    } else {
      const need = Math.max(0, x.cons - x.self), extra = x.chg + x.exp;
      const chg = Math.min(x.chg, (need * 0.6) / 0.9), dch = chg * 0.9, imp = Math.max(0, need - dch), r = x.imp ? imp / x.imp : 0;
      o = { ...x, chg, dch, exp: extra - chg, imp, hp: x.hp * r, hc: x.hc * r, hsc: x.hsc * r };
      o.raw = worth(o);
    }
    memo.set(k, o);
    return o;
  }
  // Recalage : somme des jours passés depuis la mise en service + aujourd'hui (capteur) = compteur cumulé
  let rawSum = { day: -1, v: 0 }, F = 1;
  function rescale() {
    const t = sod(new Date()).getTime();
    if (rawSum.day !== t) {
      let v = 0;
      for (const d = D12(Y0, M0 - 1, D0); sod(d).getTime() < t; d.setDate(d.getDate() + 1)) v += pastDay(new Date(d)).raw;
      rawSum = { day: t, v };
    }
    return Math.max(0, BZ.roi().total - BZ.today().savings) / (rawSum.v || 1);
  }
  const dayDemo = (date) => (isToday(date) ? { ...BZ.day(date), today: true } : { ...pastDay(date), savings: pastDay(date).raw * F });
  // Home Assistant : les vraies journées (statistiques), sans aucune des corrections de la démo
  const dayX = (date) => (BZ.hist ? { ...BZ.day(date), today: isToday(date) || undefined } : dayDemo(date));
  // Heures d'une journée (aujourd'hui ou passée) : HA les lit dans l'historique, la démo les répartit sur ses profils
  const hoursOf = (HB, live, date, x) => (HB ? (live ? BZ.hours() : HB.hoursOf(date)).map((b) => ({ ...b, key: b.label })) : live ? todayHours() : dayHours(x));

  // Une journée arrêtée à l'heure H : production au rythme du soleil, batterie et réseau au rythme des heures sans soleil
  function cut(x, H) {
    const sP = share(SUN, H), o = { ...x };
    ["prod", "self", "chg", "exp"].forEach((f) => (o[f] = (x[f] || 0) * sP));
    o.dch = (x.dch || 0) * share(DARK, H);
    TAR.forEach((k) => (o[k] = (x[k] || 0) * share(DARK, H, (hh) => BZ.tariffAt(hh) === k)));
    o.imp = o.hp + o.hc + o.hsc;
    o.cons = o.self + o.dch + o.imp;
    o.savings = (x.savings || 0) * (worth(o) / (worth(x) || 1));
    return o;
  }

  // Aujourd'hui heure par heure. Heures à venir : le rythme de la journée, ajusté par la prévision (× 0,6 à × 1,3)
  function todayHours() {
    const H = nowH(), t = BZ.today(), done = (x) => x + 1 <= H;
    const sP = HRS.reduce((a, x) => a + (done(x) ? SUN(x) : 0), 0), uP = HRS.reduce((a, x) => a + (done(x) ? USE(x) : 0), 0);
    const kP = sP > 0 ? t.prod / sP : 0, kC = uP > 0 ? t.cons / uP : 0;
    const kF = sP >= 0.2 * SUN_T ? kP * BZ.clamp(t.forecast / (kP * SUN_T || 1), 0.6, 1.3) : Math.max(0, t.forecast - t.prod) / (SUN_T - sP || 1);
    return HRS.map((x) => ({ h: x, key: `${x}h`, tariff: BZ.tariffAt(x), future: !done(x), current: x === Math.floor(H), prod: SUN(x) * (done(x) ? kP : kF), cons: done(x) ? USE(x) * kC : null }));
  }
  const dayHours = (x) => HRS.map((hh) => ({ h: hh, key: `${hh}h`, tariff: BZ.tariffAt(hh), prod: (SUN(hh) / SUN_T) * x.prod, cons: (USE(hh) / USE_T) * x.cons }));

  // Répartit les totaux d'une journée sur ses heures (mini-courbes « Jour » : autosuffisance cumulée, économies par heure)
  function hourly(B, T) {
    const tot = (a) => a.reduce((s, v) => s + v, 0) || 1;
    const mn = B.map((b) => Math.min(b.prod, b.cons || 0)), ks = T.self / tot(mn), self = mn.map((v) => v * ks);
    const gap = B.map((b, i) => Math.max(0, (b.cons || 0) - self[i])), g = tot(gap);
    const over = B.map((b, i) => Math.max(0, b.prod - self[i])), ov = tot(over);
    const worthH = B.map((_, i) => (self[i] + (gap[i] / g) * T.dch) * 0.2 + (over[i] / ov) * T.exp * 0.06), w = tot(worthH);
    let ci = 0, cc = 0;
    return {
      aut: B.map((b, i) => { ci += (gap[i] / g) * T.imp; cc += b.cons || 0; return cc ? BZ.clamp(1 - ci / cc, 0, 1) : null; }),
      eco: worthH.map((v) => (v / w) * T.savings),
    };
  }

  /* ─── Périodes : la période affichée et celle d'avant ─────────────── */
  function minOff(kind) {
    const t = sod(new Date()), days = Math.round((t - START) / 864e5);
    if (kind === "jour") return -days;
    if (kind === "semaine") return -Math.floor(days / 7);
    if (kind === "mois") return START.getFullYear() * 12 + START.getMonth() - (t.getFullYear() * 12 + t.getMonth());
    return START.getFullYear() - t.getFullYear();
  }
  // Home Assistant : chaque période et celle d'avant viennent des statistiques ; l'écart ne compare que ce qui est connu des
  // deux côtés (panneaux posés, compteurs existants), sur la même durée, la période d'avant arrêtée à la même heure
  function buildHA(kind, off) {
    const HB = BZ.hist, K = HB.key, S = HB.shifts, now = new Date(), y = now.getFullYear(), m = now.getMonth(), d = now.getDate(), live = off === 0;
    const P = { kind, off, live, H: nowH(), min: minOff(kind) };
    const like = (a, b, pa, pb, shift, cut = live) => HB.like({ a: K(a), b: K(b), pa: K(pa), pb: K(pb), live: cut, shift });
    if (kind === "jour") {
      const date = D12(y, m, d + off), x = dayX(date), buckets = hoursOf(HB, live, date, x), total = sum([x]);
      // Les heures arrivent à part (statistiques horaires) ; tant qu'elles manquent, pas de graphique
      Object.assign(total, { loading: total.loading || buckets.some((b) => b.loading), error: total.error || buckets.some((b) => b.error), gapHours: buckets.filter((b) => b.gap && !b.dst).length });
      const pd = D12(y, m, d + off - 1);
      return { ...P, date, buckets, total, cmp: like(date, date, pd, pd, S.days(1)) };
    }
    if (kind === "semaine") {
      const dates = span(D12(y, m, d - 6 + 7 * off), 7), pd = span(D12(y, m, d - 13 + 7 * off), 7);
      const buckets = dates.map((x) => ({ key: fmt.cap(x.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")), ...dayX(x), date: x, current: live && isToday(x) }));
      return { ...P, from: dates[0], to: dates[6], pFrom: pd[0], pTo: pd[6], buckets, total: sum(buckets), cmp: like(dates[0], dates[6], pd[0], pd[6], S.days(7)) };
    }
    if (kind === "mois") {
      const first = D12(y, m + off, 1), n = daysIn(first), fc = live ? BZ.period("mois").buckets : [];
      const buckets = span(first, n).map((x, i) => (live && x.getDate() > d ? { ...fc[i], key: String(x.getDate()), date: x }
        : { key: String(x.getDate()), ...dayX(x), date: x, current: live && x.getDate() === d }));
      const pFirst = D12(first.getFullYear(), first.getMonth() - 1, 1), pn = daysIn(pFirst), whole = !live || d > pn;
      const last = live ? D12(y, m, d) : D12(first.getFullYear(), first.getMonth(), n);
      return { ...P, first, pFirst, whole, upTo: d, buckets, total: sum(buckets.filter((b) => !b.forecast)),
        cmp: like(first, last, pFirst, D12(pFirst.getFullYear(), pFirst.getMonth(), whole ? pn : d), S.month(K(first).slice(0, 7)), live && !whole) };
    }
    const Y = y + off, fc = live ? BZ.period("annee").buckets : [];
    const buckets = BZ.MONTHS.map((lab, i) => {
      if (live && i > m) return { ...fc[i], key: lab, i };
      const n = live && i === m ? d : daysIn(D12(Y, i, 1));
      // Un mois = la somme de ses journées (le mois en cours : jusqu'à aujourd'hui)
      return { key: lab, i, ...HB.monthSum(Y, i, live && i === m ? d : null), days: live && i === m ? d - 1 + share(USE, P.H) : n, current: live && i === m, pre: D12(Y, i, n) < START };
    });
    const pb = live ? D12(Y - 1, m, Math.min(d, daysIn(D12(Y - 1, m, 1)))) : D12(Y - 1, 11, 31);
    return { ...P, year: Y, buckets, total: sum(buckets.filter((b) => !b.forecast)), cmp: like(D12(Y, 0, 1), live ? D12(y, m, d) : D12(Y, 11, 31), D12(Y - 1, 0, 1), pb, S.year(Y)) };
  }
  function build(kind, off) {
    if (BZ.hist) { const P = buildHA(kind, off); P.prevTotal = P.cmp.prevTotal; P.cmpTotal = P.cmp.cmpTotal || P.total; return P; }
    const now = new Date(), H = nowH(), y = now.getFullYear(), m = now.getMonth(), d = now.getDate(), live = off === 0;
    // Dernier jour de la période d'avant arrêté à la même heure, découpé sur les profils de la démo
    const before = (dates) => dates.map((x, i) => (live && i === dates.length - 1 ? cut(dayX(x), H) : dayX(x)));
    const P = { kind, off, live, H, min: minOff(kind) };
    if (kind === "jour") {
      const date = D12(y, m, d + off), x = dayX(date), buckets = hoursOf(null, live, date, x), total = sum([x]);
      return { ...P, date, buckets, total, prevTotal: sum(before([D12(y, m, d + off - 1)])) };
    }
    if (kind === "semaine") {
      const dates = span(D12(y, m, d - 6 + 7 * off), 7), pd = span(D12(y, m, d - 13 + 7 * off), 7);
      const buckets = dates.map((x) => ({ key: fmt.cap(x.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")), ...dayX(x), date: x, current: live && isToday(x) }));
      return { ...P, from: dates[0], to: dates[6], pFrom: pd[0], pTo: pd[6], buckets, total: sum(buckets), prevTotal: sum(before(pd)) };
    }
    if (kind === "mois") {
      const first = D12(y, m + off, 1), n = daysIn(first), fc = live ? BZ.period("mois").buckets : [];
      const buckets = span(first, n).map((x, i) => (live && x.getDate() > d ? { ...fc[i], key: String(x.getDate()), date: x }
        : { key: String(x.getDate()), ...dayX(x), date: x, current: live && x.getDate() === d }));
      const pFirst = D12(first.getFullYear(), first.getMonth() - 1, 1), pn = daysIn(pFirst), whole = !live || d > pn;
      const pd = span(pFirst, whole ? pn : d);
      return { ...P, first, pFirst, whole, upTo: d, buckets, total: sum(buckets.filter((b) => !b.forecast)), prevTotal: sum(whole ? pd.map(dayX) : before(pd)) };
    }
    const Y = y + off, fc = live ? BZ.period("annee").buckets : [];
    const buckets = BZ.MONTHS.map((lab, i) => {
      if (live && i > m) return { ...fc[i], key: lab, i };
      const n = live && i === m ? d : daysIn(D12(Y, i, 1));
      return { key: lab, i, ...sum(span(D12(Y, i, 1), n).map(dayX)), days: live && i === m ? d - 1 + share(USE, H) : n, current: live && i === m, pre: D12(Y, i, n) < START };
    });
    const pd = [];
    for (let i = 0; i <= (live ? m : 11); i++) pd.push(...span(D12(Y - 1, i, 1), live && i === m ? d : daysIn(D12(Y - 1, i, 1))));
    return { ...P, year: Y, buckets, total: sum(buckets.filter((b) => !b.forecast)), prevTotal: sum(before(pd)) };
  }

  /* ─── Libellés ────────────────────────────────────────────────────── */
  const dn = (d) => (d.getDate() === 1 ? "1er" : String(d.getDate()));
  const sh = (d) => `${dn(d)} ${BZ.MONTHS[d.getMonth()]}`;                                           // « 8 oct. », « 1er sept. »
  const range = (a, b) => (a.getMonth() !== b.getMonth() ? `${sh(a)} – ${sh(b)}` : a.getDate() === b.getDate() ? sh(b) : `${dn(a)}–${sh(b)}`);
  const monthOf = (d) => BZ.MONTHS_LONG[d.getMonth()];
  function labels(P) {
    const t = fmt.time(new Date());
    let none = !P.cmp && P.prevTotal.prod <= 0.01 && P.total.prod > 0.01;
    const L = { jour: { unit: "heure", per: "par heure" }, semaine: { unit: "jour", per: "par jour" }, mois: { unit: "jour", per: "par jour" }, annee: { unit: "mois", per: "par mois" } }[P.kind];
    if (P.kind === "jour") {
      const pd = new Date(P.date); pd.setDate(pd.getDate() - 1);
      Object.assign(L, P.live
        ? { title: `Aujourd'hui à ${t}`, compare: "vs hier à la même heure", cur: "Aujourd'hui", prev: `Hier à ${t}`, vs: `vs hier à ${t}` }
        : { title: P.off === -1 ? `Hier, ${fmt.date(P.date, { weekday: "long", day: "numeric", month: "long" })}` : fmt.cap(fmt.date(P.date, { weekday: "long", day: "numeric", month: "long" })), compare: "vs la veille", cur: sh(P.date), prev: sh(pd), vs: "vs la veille" });
    } else if (P.kind === "semaine") {
      Object.assign(L, P.live
        ? { title: "7 derniers jours", compare: "vs les 7 jours d'avant", cur: "7 jours", prev: "7 j avant", vs: "vs 7 j avant" }
        : { title: `Du ${P.from.getMonth() === P.to.getMonth() ? dn(P.from) : sh(P.from)} au ${sh(P.to)}`, compare: "vs les 7 jours d'avant", cur: range(P.from, P.to), prev: range(P.pFrom, P.pTo), vs: `vs ${range(P.pFrom, P.pTo)}` });
    } else if (P.kind === "mois") {
      const prev = P.whole ? fmt.cap(monthOf(P.pFirst)) : range(P.pFirst, D12(P.pFirst.getFullYear(), P.pFirst.getMonth(), P.upTo));
      Object.assign(L, P.live
        ? { title: fmt.cap(monthOf(P.first)), compare: P.whole ? `vs ${monthOf(P.pFirst)} entier` : `vs ${prev}, à la même heure`, cur: range(P.first, D12(P.first.getFullYear(), P.first.getMonth(), P.upTo)), prev, vs: `vs ${P.whole ? monthOf(P.pFirst) : prev}` }
        : { title: `${fmt.cap(monthOf(P.first))} ${P.first.getFullYear()}`, compare: `vs ${monthOf(P.pFirst)}`, cur: fmt.cap(monthOf(P.first)), prev, vs: `vs ${monthOf(P.pFirst)}` });
    } else {
      const Y = P.year;
      Object.assign(L, P.live
        ? { title: String(Y), compare: `vs ${Y - 1} à la même date`, cur: String(Y), prev: `${Y - 1} à date`, vs: `vs ${Y - 1} à date` }
        : { title: String(Y), compare: `vs ${Y - 1}`, cur: String(Y), prev: String(Y - 1), vs: `vs ${Y - 1}` });
    }
    if (P.cmp) {
      // Home Assistant : rien de comparable (panneaux pas encore posés, ou compteurs pas encore là) ; ou comparaison
      // réduite aux jours connus des deux côtés
      const c = P.cmp, from = c.from ? new Date(`${c.from}T12:00:00`) : null;
      none = !!c.none;
      const pn = { jour: "de la veille", semaine: "des 7 jours d'avant", mois: P.pFirst ? `de ${monthOf(P.pFirst)}` : "d'avant", annee: String(P.year - 1) }[P.kind];
      if (c.none) { L.compare = c.before ? `panneaux posés en ${monthOf(START)} ${START.getFullYear()}` : `pas de comparaison : historique ${pn} incomplet`; L.vs = c.before ? "rien à comparer" : "historique incomplet"; }
      else if (c.partial) { L.compare += `, dès le ${sh(from)}`; L.vs += `, dès le ${sh(from)}`; L.cur = `${L.cur} dès le ${sh(from)}`; L.prev = `${L.prev} dès le ${sh(new Date(`${c.pfrom}T12:00:00`))}`; }
    } else if (none) L.compare = `panneaux posés en ${monthOf(START)} ${START.getFullYear()}`;
    L.none = none;
    // Home Assistant : heures ou jours sans aucune statistique (HA arrêté) — ils comptent pour 0 dans les totaux
    const gaps = P.kind === "jour" ? P.total.gapHours : P.total.gaps;
    if (BZ.hist && gaps > 0) L.gaps = P.kind === "jour" ? ` · ${gaps} heure${gaps > 1 ? "s" : ""} sans données` : P.kind === "annee" ? " · données incomplètes" : ` · ${gaps} jour${gaps > 1 ? "s" : ""} sans données`;
    // Jours d'avant le premier relevé d'un compteur : comptés à part (« — »), dit dans le sous-titre
    const cs = BZ.hist && P.total.nocov ? BZ.hist.coverStart() : null;
    if (cs && cs > "0000-01-01" && cs < "9999") L.gaps = `${L.gaps || ""} · historique dès le ${fmt.date(new Date(`${cs}T12:00:00`), { day: "numeric", month: "long", year: "numeric" })}`;
    return L;
  }

  /* ─── Petits calculs et utilitaires ───────────────────────────────── */
  const aut = (x) => (x && x.cons ? BZ.clamp(1 - x.imp / x.cons, 0, 1) : 0);          // part de la conso sans réseau
  const selfUse = (x) => (x && x.prod ? BZ.clamp(1 - x.exp / x.prod, 0, 1) : 0);      // part de la production gardée
  const bill = (x) => TAR.reduce((a, k) => a + (BZ.hist ? x[k] : x[k] || 0) * BZ.TARIFS[k].price(), 0);   // HA : inconnue tant que la répartition manque
  // Variation : « 1 pt » au singulier
  const dl = (cur, prev, o = {}) => { const s = BZ.delta(cur, prev, o); return o.unit === "pts" && Math.round(Math.abs(cur - prev) * 100) === 1 ? s.replace(" pts</span>", " pt</span>") : s; };
  const monthName = (P, i) => fmt.cap(BZ.MONTHS_LONG[i]);
  const nameOf = (P, b, i) => P.kind === "jour" ? `${b.h}h – ${b.h + 1}h` : P.kind === "annee" ? monthName(P, i)
    : fmt.cap(fmt.date(b.date, { weekday: "long", day: "numeric", month: "short" }));
  const shortOf = (P, b, i) => (P.kind === "jour" ? `${b.h}h` : P.kind === "annee" ? BZ.MONTHS[i] : fmt.date(b.date, { weekday: "short", day: "numeric" }));   // carte très étroite
  const tipName = (c, b, i) => (c.kind === "annee" ? `${monthName(c, i)} ${c.year}` : c.kind === "jour" ? `${b.h}h – ${b.h + 1}h`
    : fmt.cap(fmt.date(b.date, { weekday: "long", day: "numeric", month: "long" })));
  const pc = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
  // Haut d'échelle « rond » mais serré (évite 1 000 pour un maximum de 760)
  const niceTop = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)), n = v / p; return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => n <= s) || 10) * p; };
  const UP = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  const CMP = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/></svg>';
  const DL = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11.5M7 10.5l5 5 5-5M4.5 20h15"/></svg>';
  const pad2 = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  // Courbe monotone : passe par chaque mesure sans « boucler » au-dessus ou en dessous (Fritsch–Carlson)
  function mono(pts) {
    const n = pts.length;
    if (n < 2) return "";
    const dx = [], m = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
    t[n - 1] = m[n - 2];
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < n - 1; i++) { const k = dx[i] / 3; d += ` C${pts[i][0] + k},${pts[i][1] + t[i] * k} ${pts[i + 1][0] - k},${pts[i + 1][1] - t[i + 1] * k} ${pts[i + 1][0]},${pts[i + 1][1]}`; }
    return d;
  }

  /* ─── Graphiques de la page (une infobulle partagée : #tip) ──────────
     « bars »  : production empilée (maison / batterie / revendu), prévision hachurée, courbe de consommation
                 (la case en cours est projetée à sa fin, en pointillé ; la valeur partielle reste dans l'infobulle).
     « lines » : une journée heure par heure, production (+ prévision aujourd'hui) et consommation, bande des tarifs. */
  const SER = [["self", "Utilisé à la maison", "solar"], ["chg", "Stocké en batterie", "battery"], ["exp", "Revendu au réseau", "grid"]];
  const REG = new Map();
  const W = 600, H = 300;
  let seq = 0;
  const gridLines = (max, y) => [0.25, 0.5, 0.75, 1].map((k) => h`<line class="gl" x1="0" x2="${W}" y1="${y(max * k)}" y2="${y(max * k)}"/>`);
  const yTicks = (max, y) => [0.5, 1].map((k) => h`<span class="bi-yl" style="--y:${pc(y(max * k), H)}">${fmt.n(max * k, Number.isInteger(max * k) ? 0 : 1)}${k === 1 ? " kWh" : ""}</span>`);
  const shell = (id, label, svg, over, axis, band = "") => h`<figure class="bi-chart" data-bi="${id}" tabindex="0" aria-label="${esc(label)}. Flèches gauche et droite pour parcourir.">
      <div class="bi-plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${over}
        <span class="bi-dot bi-cur is-p"></span><span class="bi-dot bi-cur is-c"></span></div>
      ${band}<div class="bi-ax" aria-hidden="true">${axis}</div></figure>`;

  function combo({ P, buckets, label, every = 1 }) {
    const id = `bi${++seq}`, n = buckets.length, slot = W / n;
    const bw = Math.max(4, Math.min(28, slot * (n > 20 ? 0.62 : 0.46)));
    const tot = buckets.map((b) => (b.forecast ? b.prod || 0 : SER.reduce((a, [k]) => a + (b[k] || 0), 0)));
    const rest = buckets.map((b) => (b.current && b.fcRest > 0.05 ? b.fcRest : 0));   // case en cours : ce qui reste prévu
    const cons = buckets.map((b) => (b.forecast || b.cons == null || !Number.isFinite(b.cons) ? null : b.cons));
    const end = buckets.map((b, i) => (b.current && cons[i] != null && b.consEnd > cons[i] ? b.consEnd : null));   // projection de la case en cours
    const shown = cons.map((v, i) => (end[i] != null ? end[i] : v));
    const max = niceTop(Math.max(...tot.map((v, i) => v + rest[i]), ...shown.filter((v) => v != null), 0.1) * 1.06);
    const y = (v) => 4 + (1 - v / max) * (H - 4), cx = (i) => slot * i + slot / 2;
    const cols = buckets.map((b, i) => {
      const x = cx(i) - bw / 2, r = Math.min(4, bw / 3);
      if (b.forecast) return h`<g class="bar is-fc"><rect x="${x}" y="${y(tot[i])}" width="${bw}" height="${Math.max(0, H - y(tot[i]))}" rx="${r}"/></g>`;
      let base = 0;
      const segs = SER.map(([k, , tone]) => {
        const v = b[k] || 0; if (v <= 0) return "";
        const y1 = y(base + v), y0 = y(base); base += v;
        return h`<rect data-tone="${tone}" x="${x}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1 - (base < tot[i] - 1e-6 ? 1.5 : 0))}" rx="${r}"/>`;
      });
      const cap = rest[i] ? h`<rect class="bi-rest" x="${x}" y="${y(tot[i] + rest[i])}" width="${bw}" height="${Math.max(0, y(tot[i]) - y(tot[i] + rest[i]) - 1.5)}" rx="${r}"/>` : "";
      return h`<g class="bar ${b.current ? "is-cur" : ""}">${cap}${segs}</g>`;
    });
    // Consommation : trait plein sur les cases terminées, pointillé vers la fin projetée de la case en cours
    const pts = shown.map((v, i) => (v == null ? null : [cx(i), y(v), i])).filter(Boolean);
    const lastIsProj = pts.length > 1 && end[pts[pts.length - 1][2]] != null;
    const xy = (p) => `${p[0]},${p[1]}`;
    const line = pts.length < 2 ? "" : lastIsProj
      ? h`${pts.length > 2 ? h`<path class="bi-cl" d="${mono(pts.slice(0, -1))}"/>` : ""}<path class="bi-cl is-part" d="M${xy(pts[pts.length - 2])} L${xy(pts[pts.length - 1])}"/>`
      : h`<path class="bi-cl" d="${mono(pts)}"/>`;
    const dots = pts.map(([px, py, i]) => (n <= 12 || end[i] != null ? h`<span class="bi-dot ${end[i] != null ? "is-proj" : ""}" style="--x:${pc(px, W)};--y:${pc(py, H)}"></span>` : ""));
    const curIdx = buckets.findIndex((b) => b.current);   // libellé du jour en cours en gras ; son voisin trop proche s'efface
    const axis = buckets.map((b, i) => ((i % every === 0 && (every === 1 || curIdx < 0 || Math.abs(i - curIdx) >= 3)) || b.current
      ? h`<span class="ax ${b.current ? "is-cur" : ""}" style="--x:${pc(cx(i), W)}">${esc(b.key)}</span>` : ""));
    REG.set(id, { type: "bars", kind: P.kind, year: P.year, n, slot, buckets, tot, rest, cons, end, y, cx, top: (i) => Math.max(tot[i] + rest[i], shown[i] || 0), marks: (i) => [null, shown[i]] });
    return shell(id, label,
      h`${gridLines(max, y)}<line class="bi-base" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}"/><rect class="bi-hl" x="0" y="0" width="${slot}" height="${H}"/>${cols}${line}`,
      h`${yTicks(max, y)}${dots}`, axis);
  }

  function dayLines({ P, buckets: B, label }) {
    const id = `bi${++seq}`, n = B.length, slot = W / n, cx = (i) => slot * i + slot / 2;
    const idx = B.map((_, i) => i), past = idx.filter((i) => !B[i].future), fut = idx.filter((i) => B[i].future), last = past[past.length - 1];
    const prod = B.map((b) => b.prod || 0), cons = B.map((b) => (Number.isFinite(b.cons) ? b.cons : null));
    const max = niceTop(Math.max(...prod, ...cons.filter((v) => v != null), 0.1) * 1.1);
    const y = (v) => 4 + (1 - v / max) * (H - 4), pt = (i, v) => [cx(i), y(v)];
    const pP = past.map((i) => pt(i, prod[i])), fP = (last != null ? [last, ...fut] : fut).map((i) => pt(i, prod[i]));
    const cP = past.filter((i) => cons[i] != null).map((i) => pt(i, cons[i]));
    const area = pP.length > 1 ? h`<path class="bi-pa" d="${mono(pP)} L${pP[pP.length - 1][0]},${H} L${pP[0][0]},${H} Z"/><path class="bi-pl" d="${mono(pP)}"/>` : "";
    const segs = [];
    B.forEach((b) => { const s = segs[segs.length - 1]; if (s && s.k === b.tariff) s.n++; else segs.push({ k: b.tariff, n: 1 }); });
    const band = h`<div class="bi-band" aria-hidden="true">${segs.map((s) => h`<i data-tariff="${s.k}" style="--w:${pc(s.n, n)}"></i>`)}</div>`;
    const axis = B.map((b, i) => (i % 3 === 0 ? h`<span class="ax ${i === 0 ? "is-start" : ""}" style="--x:${pc(slot * i, W)}">${b.h}h</span>` : "")).concat(h`<span class="ax is-end" style="--x:100%">24h</span>`);
    const now = new Date(), t = now.getHours() + now.getMinutes() / 60;
    REG.set(id, { type: "lines", kind: "jour", n, slot, buckets: B, tot: prod, cons, y, cx, top: (i) => Math.max(prod[i], cons[i] || 0), marks: (i) => [prod[i], cons[i]] });
    return shell(id, label,
      h`${gridLines(max, y)}<line class="bi-base" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}"/><rect class="bi-hl" x="0" y="0" width="${slot}" height="${H}"/>
        ${area}${fP.length > 1 && fut.length ? h`<path class="bi-fl" d="${mono(fP)}"/>` : ""}${cP.length > 1 ? h`<path class="bi-cl" d="${mono(cP)}"/>` : ""}
        ${P.live ? h`<line class="bi-now" x1="${slot * t}" x2="${slot * t}" y1="0" y2="${H}"/>` : ""}`,
      h`${yTicks(max, y)}${P.live ? h`<span class="bi-now-l" style="--x:${pc(slot * t, W)}">${fmt.time(now)}</span>` : ""}`, axis, band);
  }

  // Infobulle (souris, toucher, clavier) — écoutée une seule fois pour toute la vie de la page
  const tipEl = () => document.getElementById("tip");
  const row = (l, v, tone, cls = "", unit = " kWh", d = 1) => h`<div class="tip-r ${cls}">${tone ? h`<i data-tone="${tone}"></i>` : ""}<span>${l}</span><b>${fmt.n(v, d)}${unit}</b></div>`;
  let hover = null;
  function showTip(fig, i) {
    const c = REG.get(fig.dataset.bi); if (!c) return;
    i = BZ.clamp(i, 0, c.n - 1); fig.dataset.i = i; fig.classList.add("is-hover");
    fig.querySelectorAll(".bar").forEach((g, j) => g.classList.toggle("is-on", j === i));
    const hl = fig.querySelector(".bi-hl"); hl.setAttribute("x", c.slot * i); hl.classList.add("is-on");
    const b = c.buckets[i];
    c.marks(i).forEach((v, k) => {
      const dot = fig.querySelector(k ? ".bi-cur.is-c" : ".bi-cur.is-p");
      if (v == null) { dot.classList.remove("is-on"); return; }
      dot.style.setProperty("--x", pc(c.cx(i), W)); dot.style.setProperty("--y", pc(c.y(v), H)); dot.classList.add("is-on");
      dot.classList.toggle("is-fc", !!b.future);
    });
    let rows;
    if (c.type === "lines") {
      const T = BZ.TARIFS[b.tariff];
      rows = h`${row(b.future ? (b.fcEst ? "Prévision (selon tes 7 derniers jours)" : "Prévision") : "Production", c.tot[i], "solar", b.future ? "bi-tip-f" : "", " kWh", 2)}${c.cons[i] != null ? row("Consommation", c.cons[i], "neutral", "bi-tip-c", " kWh", 2) : ""}
        <div class="tip-r bi-tip-tar"><i data-tone="${b.tariff}"></i><span>${T.label}</span><b>${fmt.n(T.price(), 4)} €/kWh</b></div>`;
    } else if (b.forecast) rows = c.tot[i] > 0 ? row("Production prévue", c.tot[i], "solar", "bi-tip-f") : h`<div class="tip-r bi-tip-n"><span>Pas de prévision</span></div>`;   // HA : rien d'inventé
    else if (b.pre) rows = h`<div class="tip-r bi-tip-n"><span>Panneaux pas encore posés</span></div>${row("Consommation", BZ.hist ? c.cons[i] ?? NaN : c.cons[i] || 0, "neutral", "bi-tip-c")}`;
    else rows = h`${SER.map(([k, l, tone]) => row(l, b[k] || 0, tone))}${row("Production", c.tot[i], null, "bi-tip-t")}${c.rest[i] ? row("Encore prévu", c.rest[i], "solar", "bi-tip-f") : ""}
      ${c.cons[i] != null ? row(b.current ? b.consLbl : "Consommation", c.cons[i], "neutral", "bi-tip-c") : ""}${c.end[i] != null ? row(b.projLbl, c.end[i], null, "bi-tip-p") : ""}`;
    const t = tipEl();
    t.innerHTML = h`<strong>${esc(tipName(c, b, i))}${b.current ? " · en cours" : ""}</strong>${rows}`;
    t.classList.add("is-on");
    const r = fig.querySelector(".bi-plot").getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
    const xPx = r.left + (c.cx(i) / W) * r.width, yPx = r.top + (c.y(c.top(i)) / H) * r.height;
    const left = BZ.clamp(xPx - tw / 2, 8, innerWidth - tw - 8);
    let top = yPx - th - 14; if (top < 8) top = Math.min(innerHeight - th - 8, yPx + 18);
    t.style.transform = `translate(${left}px, ${top}px)`;
  }
  function hideTip(fig, keepTip) {
    if (!keepTip) tipEl().classList.remove("is-on");
    if (!fig) return;
    fig.classList.remove("is-hover");
    fig.querySelectorAll(".bar.is-on, .bi-hl.is-on, .bi-cur.is-on").forEach((e) => e.classList.remove("is-on"));
  }
  document.addEventListener("pointermove", (e) => {
    const fig = e.target.closest && e.target.closest(".bi-chart");
    if (hover && hover !== fig) { hideTip(hover, !!(e.target.closest && e.target.closest(".chart"))); hover = null; }
    if (!fig) return;
    const c = REG.get(fig.dataset.bi); if (!c) return;
    const r = fig.querySelector(".bi-plot").getBoundingClientRect();
    hover = fig; showTip(fig, Math.floor(((e.clientX - r.left) / r.width) * c.n));
  }, { passive: true });
  document.addEventListener("pointerleave", () => { if (hover) { hideTip(hover); hover = null; } });
  document.addEventListener("scroll", () => { if (hover) { hideTip(hover); hover = null; } }, { passive: true, capture: true });
  document.addEventListener("keydown", (e) => {
    const fig = document.activeElement && document.activeElement.closest && document.activeElement.closest(".bi-chart");
    if (!fig || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const c = REG.get(fig.dataset.bi); if (!c) return;
    e.preventDefault();
    const cur = fig.dataset.i != null ? +fig.dataset.i : c.n - 1;
    showTip(fig, e.key === "Home" ? 0 : e.key === "End" ? c.n - 1 : cur + (e.key === "ArrowLeft" ? -1 : 1));
  });
  document.addEventListener("focusout", (e) => { if (e.target.classList && e.target.classList.contains("bi-chart")) hideTip(e.target); });

  // Légende : pastille (barre), aire, trait (courbe), tirets (prévision), hachures
  const legendRow = (items) => h`<ul class="bi-lg">${items.map(([label, tone, kind, v]) => h`<li data-tone="${tone}"><i class="bi-sw is-${kind}"></i><span>${label}</span>${v ? h`<b>${v}</b>` : ""}</li>`)}</ul>`;

  /* ─── Export CSV de la période (séparateur « ; » et virgule décimale, comme Excel en français) ─── */
  const SAVE_AS = ["down", "load"].join("");   // attribut du lien d'export (absent de la version hébergée)
  function csvHref(P) {
    const n = (v) => (v == null || !Number.isFinite(v) ? "" : v.toFixed(2).replace(".", ","));
    let rows;
    if (P.kind === "jour") rows = [["Heure", "Production (kWh)", "Consommation (kWh)", "Tarif"], ...P.buckets.filter((b) => !b.future).map((b) => [`${b.h}h`, n(b.prod), n(b.cons), BZ.TARIFS[b.tariff].short])];
    else rows = [[P.kind === "annee" ? "Mois" : "Jour", "Production (kWh)", "Utilisé à la maison", "Stocké en batterie", "Revendu", "Consommation (kWh)", "Achat réseau", "dont HP", "dont HC", "dont HSC", "Économies (€)"],
      ...P.buckets.filter((b) => !b.forecast).map((b, i) => [P.kind === "annee" ? `${BZ.MONTHS_LONG[i]} ${P.year}` : b.date.toLocaleDateString("fr-FR"), n(b.prod), n(b.self), n(b.chg), n(b.exp), n(b.cons), n(b.imp), n(b.hp), n(b.hc), n(b.hsc), n(b.savings)])];
    return `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + rows.map((r) => r.join(";")).join("\r\n"))}`;
  }

  // Même gabarit que BZ.card, pour une icône qui n'est pas dans le jeu commun
  const cardSvg = ({ cls, title, svg, tone = "accent", aside, body }) => h`<section class="card ${cls}">
      <header class="card-h"><span class="card-i" data-tone="${tone}">${svg}</span><div class="card-t"><h3>${title}</h3></div>${aside ? h`<div class="card-a">${aside}</div>` : ""}</header>
      ${body}</section>`;

  /* ─── Blocs de la page ────────────────────────────────────────────── */
  function header(P, L, wait = false) {
    const id = P.kind === "annee" ? String(P.year) : P.kind === "mois" ? iso(P.first).slice(0, 7) : iso(P.kind === "jour" ? P.date : P.to);
    const nav = (dir) => {
      const to = P.off + dir, ok = dir < 0 ? to >= P.min : to <= 0;
      return h`<button type="button" class="bi-nav" data-act="set" data-k="biOff" data-value="${P.kind}:${to}" aria-label="${dir < 0 ? "Période précédente" : "Période suivante"}" ${ok ? "" : "disabled"}>${icon(dir < 0 ? "left" : "chevron")}</button>`;
    };
    return h`<header class="ph">
      <div><p class="ph-hi">Historique</p><h1>Bilan</h1><p class="ph-sub" aria-live="polite">${L.title} · ${L.compare}${L.gaps || ""}</p></div>
      <div class="ph-a">
        <div class="bi-per" role="group" aria-label="Période du bilan">${icon("calendar")}${pills({ name: "period", label: "Durée", value: P.kind, options: [["jour", "Jour"], ["semaine", "7 jours"], ["mois", "Mois"], ["annee", "Année"]] })}
          <span class="bi-sep" aria-hidden="true"></span>${nav(-1)}${nav(1)}</div>
        ${wait || document.documentElement.dataset.hosted ? "" : h`<a class="btn btn-primary bi-exp" href="${csvHref(P)}" ${SAVE_AS}="breezy-bilan-${P.kind}-${id}.csv" aria-label="Exporter le bilan de la période en CSV">${DL}<span>Exporter</span></a>`}
      </div></header>`;
  }

  // Mini-courbes : les cases de la période. Jour : heures écoulées (autosuffisance cumulée depuis 0 h, économies par heure).
  // Année : moyenne par jour de chaque mois, pour que le mois en cours ne « s'effondre » pas.
  // Home Assistant : autosuffisance cumulée et économies de chaque heure, lues dans l'historique (rien de réparti)
  const realHourly = (B) => {
    let si = 0, sc = 0;
    return {
      aut: B.map((b) => { if (Number.isFinite(b.imp) && Number.isFinite(b.cons)) { si += b.imp; sc += b.cons; } return sc > 0 ? BZ.clamp(1 - si / sc, 0, 1) : null; }),
      eco: B.map((b) => (Number.isFinite(b.savings) ? b.savings : null)),
    };
  };
  function sparks(P, T) {
    if (P.kind === "jour") {
      const B = P.buckets.filter((b) => !b.future), A = BZ.hist ? realHourly(B) : hourly(B, T);
      return { prod: B.map((b) => b.prod), cons: B.map((b) => b.cons), aut: A.aut, eco: A.eco };
    }
    const real = P.buckets.filter((b) => !b.forecast && !b.pre), per = (b) => (P.kind === "annee" ? b.days || 1 : 1);
    return { prod: real.map((b) => b.prod / per(b)), cons: real.map((b) => b.cons / per(b)), aut: real.map(aut), eco: real.map((b) => b.savings / per(b)) };
  }

  function kpis(P, T, Q, L) {
    const S = sparks(P, T), sp = (vals, tone) => (vals.filter((v) => v != null).length > 1 ? BZ.spark(vals, tone) : null);
    const Tc = P.cmpTotal || T;   // Home Assistant : la part de la période comparable (démo : la période entière)
    const vs = (d) => (d || !L.none ? L.vs : "rien à comparer");
    const k = [
      { label: "Produit", ic: "sun", tone: "solar", value: val(fmt.kwh(T.prod)), delta: dl(Tc.prod, Q.prod), spark: sp(S.prod, "solar") },
      { label: "Consommé", ic: "home", tone: "battery", value: val(fmt.kwh(T.cons)), delta: dl(Tc.cons, Q.cons, { invert: true }), spark: sp(S.cons, "battery") },
      { label: "Autosuffisance", ic: "leaf", tone: "good", value: val([fmt.n(aut(T) * 100), "%"]), delta: L.none ? "" : dl(aut(Tc), aut(Q), { unit: "pts" }), spark: sp(S.aut, "good") },
      { label: "Économisé", ic: "euro", tone: "accent", value: val([fmt.n(T.savings, T.savings >= 100 ? 0 : 2), "€"]), delta: dl(Tc.savings, Q.savings), spark: sp(S.eco, "accent"), est: T.est, estHp: T.estHp },
    ];
    // Home Assistant sans statistique d'économies : calculées avec les tarifs, et dit comme tel
    return h`<div class="kpis bi-kpis">${k.map((x) => kpi({ ...x, vs: x.est ? (x.estHp ? "estimé au prix des heures pleines" : "estimé avec tes tarifs") : vs(x.delta) }))}</div>`;
  }

  function chartCard(P, T) {
    if (P.kind === "jour") {
      const fc = P.buckets.reduce((a, b) => a + (b.future ? b.prod : 0), 0);
      const key = h`<div class="tariff-key bi-tk">${TAR.map((k) => h`<span data-tariff="${k}"><i></i>${BZ.TARIFS[k].short} <em>${BZ.rangeLabel(k)}</em> <b>${fmt.n(BZ.TARIFS[k].price(), 4)} €</b></span>`)}</div>`;
      return card({ cls: "bi-main is-day", title: P.live ? "Ta journée heure par heure" : "La journée heure par heure", ic: "chart", tone: "accent",
        aside: legendRow([["Production", "solar", "area", fmt.kwhText(T.prod)], ...(fc > 0.05 ? [["Prévision", "solar", "dash", `+${fmt.kwhText(fc)}`]] : []), ["Consommation", "neutral", "line", fmt.kwhText(T.cons)]]),
        body: h`<div class="bi-chart-w">${dayLines({ P, buckets: P.buckets, label: "Production, prévision et consommation par heure, tarifs sous l'axe" })}</div>${key}` });
    }
    const every = P.buckets.length > 14 ? 5 : 1;
    // Case en cours : la production encore attendue (et, en vue Année, les jours restants du mois) ;
    // la consommation est projetée à la fin de la case, au rythme habituel des heures et des jours qui restent
    let restToday = 0, restMonth = 0;
    if (P.live) {
      restToday = (BZ.hist ? BZ.hours() : todayHours()).reduce((a, b) => a + (b.future ? b.prod || 0 : 0), 0);
      if (P.kind === "annee") restMonth = BZ.period("mois").buckets.reduce((a, b) => a + (b.forecast ? b.prod : 0), 0);
    }
    const uShare = Math.max(0.05, share(USE, P.H)), t = fmt.time(new Date());
    const buckets = P.buckets.map((b) => {
      if (!b.current) return b;
      const yr = P.kind === "annee";
      return { ...b, fcRest: restToday + restMonth, consEnd: yr ? (b.cons / (b.days || 1)) * daysIn(D12(P.year, b.i, 1)) : b.cons / uShare,
        consLbl: yr ? `Consommé au ${sh(new Date())}` : `Consommé à ${t}`, projLbl: yr ? "Projection fin de mois" : "Projection fin de journée" };
    });
    const hasFc = buckets.some((b) => (b.forecast && b.prod > 0) || b.fcRest > 0.05);
    return card({ cls: "bi-main", title: P.kind === "annee" ? "Production et consommation" : "Où va ta production", ic: "chart", tone: "accent",
      aside: legendRow([
        ["Utilisé", "solar", "bar", fmt.kwhText(T.self)], ["Stocké", "battery", "bar", fmt.kwhText(T.chg)], ["Revendu", "grid", "bar", fmt.kwhText(T.exp)],
        ["Consommation", "neutral", "line", ""], ...(hasFc ? [["Prévision", "solar", "hatch", ""]] : []),
      ]),
      body: h`<div class="bi-chart-w">${combo({ P, buckets, every, label: `Destination de la production par ${labels(P).unit} et consommation` })}</div>` });
  }

  // Comparaison : uniquement ce que les 4 indicateurs du haut ne montrent pas déjà
  function compareCard(T, Q, L) {
    const rows = [
      { ic: "grid", tone: "neutral", name: "Achat réseau", cur: fmt.kwhText(T.imp), prev: fmt.kwhText(Q.imp), d: dl(T.imp, Q.imp, { invert: true }) },
      { ic: "euro", tone: "hp", name: "Facture réseau", cur: fmt.eur(bill(T)), prev: fmt.eur(bill(Q)), d: dl(bill(T), bill(Q), { invert: true }) },
      { raw: UP, tone: "grid", name: "Revendu", cur: fmt.kwhText(T.exp), prev: fmt.kwhText(Q.exp), d: dl(T.exp, Q.exp) },
      { ic: "battery", tone: "battery", name: "Batterie restituée", cur: fmt.kwhText(T.dch), prev: fmt.kwhText(Q.dch), d: dl(T.dch, Q.dch) },
      { ic: "sun", tone: "solar", name: "Autoconsommation", cur: fmt.pct(selfUse(T)), prev: L.none ? "—" : fmt.pct(selfUse(Q)), d: L.none ? "" : dl(selfUse(T), selfUse(Q), { unit: "pts" }) },
    ];
    return cardSvg({ cls: "bi-cmp", title: "Comparaison", svg: CMP, aside: h`<span class="bi-note">${L.vs}</span>`, body: h`
      <div class="dt-wrap"><table class="dt">
        <thead><tr><th scope="col">Indicateur</th><th scope="col">${L.cur}</th><th scope="col">${L.prev}</th><th scope="col">Écart</th></tr></thead>
        <tbody>${rows.map((r) => h`<tr>
          <td><div class="dt-main"><span class="dt-ic" data-tone="${r.tone}">${r.raw || icon(r.ic)}</span><strong>${r.name}</strong></div></td>
          <td class="dt-v">${r.cur}</td><td class="bi-prev">${r.prev}</td><td>${r.d || h`<span class="delta">—</span>`}</td></tr>`)}</tbody></table></div>` });
  }

  function bestCard(P, L) {
    const isDay = P.kind === "jour";
    const real = P.buckets.map((b, i) => ({ b, i })).filter(({ b }) => !b.forecast && !b.future && b.prod > 0.05);
    const avg = real.reduce((a, x) => a + x.b.prod, 0) / (real.length || 1);
    const best = [...real].sort((a, z) => z.b.prod - a.b.prod).slice(0, 5);
    const body = best.length ? h`<ol class="plist bi-best">${best.map(({ b, i }, r) => {
      const vs = (b.prod / avg - 1) * 100, a = fmt.n(aut(b) * 100);
      const sub = isDay ? h`<span class="bi-ln">${BZ.TARIFS[b.tariff].label}</span><span class="bi-sn">${BZ.TARIFS[b.tariff].short}</span>${b.cons != null ? h`<span class="bi-sx"> · ${fmt.kwhText(b.cons)} conso.</span>` : ""}`
        : h`<span class="bi-al">${a} % autonome</span><span class="bi-as">${a} % auto.</span><span class="bi-sx"> · ${fmt.kwhText(b.exp)} revendus</span>`;
      return h`<li><div class="plist-r">
        <span class="bi-rk ${r === 0 ? "is-1" : ""}"><span class="sr">Rang </span>${r + 1}</span>
        <span><strong><span class="bi-ln">${nameOf(P, b, i)}</span><span class="bi-sn" aria-hidden="true">${shortOf(P, b, i)}</span>${b.current ? h` <em class="bi-now">en cours</em>` : ""}</strong><small>${sub}</small></span>
        ${pill(vs >= 0.5 ? `+${fmt.n(vs)} %` : "moyenne", vs >= 0.5 ? "good" : "neutral")}
        <span class="plist-p"><span>${fmt.kwhText(b.prod)}</span>${meter({ value: (b.prod / best[0].b.prod) * 100, tone: "solar", size: "xs" })}</span></div></li>`;
    })}</ol>`
      : BZ.empty({ ic: "sun", title: P.kind === "jour" && P.live ? "Pas encore de production" : "Pas de production", text: P.live ? "Le classement se remplit dès le lever du soleil." : "Les panneaux n'étaient pas encore posés." });
    return card({ cls: "bi-top", title: "Meilleurs moments", ic: "star", tone: "accent", aside: h`<span class="bi-note">${L.per}${best.length ? h`<span class="bi-nx"> · moy. ${fmt.kwhText(avg)}</span>` : ""}</span>`, body });
  }

  function originCard(T) {
    // Réseau en gris : le vert reste réservé à ce qui est revendu
    const parts = [{ label: "Soleil direct", v: T.self, tone: "solar" }, { label: "Batterie", v: T.dch, tone: "battery" }, { label: "Réseau", v: T.imp, tone: "neutral" }];
    const cons = parts.reduce((a, p) => a + p.v, 0) || 1;
    const tar = TAR.map((k) => ({ k, label: BZ.TARIFS[k].label, v: T[k] || 0, eur: (T[k] || 0) * BZ.TARIFS[k].price() }));
    const wait = BZ.hist && !Number.isFinite(T.hp);   // Home Assistant : achat par tarif pas encore lu (heures du mois)
    return card({ cls: "bi-org", title: "D'où vient ta consommation", ic: "leaf", tone: "accent", link: { label: "Tarifs", to: "energy" }, body: h`
      <div class="bi-mixr">${donut({ parts, size: 128, stroke: 15, center: fmt.n(T.cons, T.cons < 100 ? 1 : 0), sub: "kWh", label: `${fmt.kwhText(T.cons)} consommés : ${parts.map((p) => `${p.label} ${Number.isFinite(p.v) ? Math.round((p.v / cons) * 100) : "—"} %`).join(", ")}` })}
        <ul class="bi-keys">${parts.map((p) => h`<li data-tone="${p.tone}"><i></i><span>${p.label}</span><em>${fmt.n((p.v / cons) * 100)} %</em><b>${fmt.kwhText(p.v)}</b></li>`)}</ul></div>
      <div class="bi-tar">
        <div class="bi-tar-h"><strong>Réseau par tarif</strong><span><b>${fmt.eur(bill(T))}</b> payés</span></div>
        ${wait ? h`<p class="ha-hint">${T.splitLoading ? "Répartition par tarif en cours de chargement…" : "Répartition par tarif indisponible pour le moment."}</p>` : BZ.split(tar.map((t) => ({ label: t.label, v: t.v, tone: t.k })), { label: `Achat réseau par tarif : ${tar.map((t) => `${t.label} ${fmt.kwhText(t.v)}`).join(", ")}` })}
        ${wait ? "" : h`<ul class="bi-tl">${tar.map((t) => h`<li data-tone="${t.k}"><i></i><span>${t.label}<em>${BZ.rangeLabel(t.k)}</em></span><span class="bi-tl-k">${fmt.kwhText(t.v)}</span><b>${fmt.eur(t.eur, 2)}</b></li>`)}</ul>`}
      </div>` });
  }

  // Rentabilité : compteur cumulé (BZ.roi), rythme des 12 derniers mois, date d'amortissement à ce rythme
  function roiData() {
    const R = BZ.roi(), now = new Date(), y = now.getFullYear(), HB = BZ.hist;
    if (HB) {
      // Home Assistant : économies des 365 derniers jours et depuis le 1er janvier (statistiques) ;
      // tant qu'elles manquent, le rythme moyen depuis la mise en service (compteur cumulé)
      // Économies des 365 derniers jours, sur les seuls jours connus (pics écartés) ; moins d'un an connu : ramenées à l'année ;
      // presque rien de connu : le rythme moyen depuis la mise en service (compteur cumulé)
      const W = HB.savingsWindow("365d"), Y = HB.savingsWindow("ytd"), ok = Number.isFinite(W.v) && W.days >= 28;
      const perYear = !ok ? R.perYear : W.days >= 365 ? W.v : (W.v * 365) / W.days;
      const payback = new Date(now.getTime() + (R.remaining / (perYear || 1)) * 365.25 * 864e5);
      const mo = ok && W.days < 365 ? Math.max(1, Math.round(W.days / 30.44)) : 0;
      return { ...R, perYear, ytd: Y.v, ytdFrom: Y.full === false && Y.from ? new Date(`${Y.from}T12:00:00`) : null, payback, totalYears: (payback - R.start) / (365.25 * 864e5),
        avg: !ok, perLabel: !ok ? "Par an (moy.)" : mo ? `Par an (sur ${mo} mois)` : "Sur 12 mois" };
    }
    const year = sum(span(D12(y - 1, now.getMonth(), now.getDate() + 1), 365).map(dayX)).savings;
    const months = (now - START) / (30.44 * 864e5);
    const perYear = months < 12 ? (year * 12) / Math.max(1, months) : year;     // moins d'un an de recul : ramené à l'année
    const ytd = sum(span(D12(y, 0, 1), Math.round((sod(now) - new Date(y, 0, 1)) / 864e5) + 1).map(dayX)).savings;
    const payback = new Date(now.getTime() + (R.remaining / (perYear || 1)) * 365.25 * 864e5);
    return { ...R, perYear, ytd, payback, totalYears: (payback - START) / (365.25 * 864e5) };
  }
  BZ.roiFull = roiData;   // partagé avec l'Aperçu : même date d'amortissement partout
  function roiCard(P) {
    const R = roiData(), y = new Date().getFullYear();
    // En vue « Année » en cours, l'économie de l'année est déjà dans les indicateurs : on montre la durée d'amortissement
    const first = P.kind === "annee" && P.live ? ["Amortie en", `${fmt.n(R.totalYears, 1)} ans`] : [R.ytdFrom ? `Dès le ${sh(R.ytdFrom)}` : `En ${y}`, fmt.eur(R.ytd, 0)];
    return card({ cls: "bi-roi", title: "Rentabilité solaire", ic: "sun", tone: "accent", aside: pill(h`${fmt.n(R.progress * 100)} %<span class="bi-rx"> remboursé</span>`, "accent"), body: h`
      <div class="bi-roi-v">${val([fmt.n(R.total), "€"], "bi-roi-big")}<span>économisés sur ${fmt.eur(R.inv, 0)} investis</span></div>
      <div class="bi-roi-m">${meter({ value: R.progress * 100, tone: "accent", size: "lg", label: "Part de l'installation remboursée" })}
        <div class="bi-roi-ax"><span class="bi-roi-from">Depuis ${fmt.date(R.start, { month: "short", year: "numeric" })}</span><span>Amortie vers <b>${fmt.date(R.payback, { month: "long", year: "numeric" })}</b></span></div></div>
      <div class="bi-roi-kv">
        <div><span>${first[0]}</span><b>${first[1]}</b></div>
        <div><span>${R.perLabel || (R.avg ? "Par an (moy.)" : "Sur 12 mois")}</span><b>${fmt.eur(R.perYear, 0)}</b></div>
        <div><span>Reste</span><b>${fmt.eur(R.remaining, 0)}</b></div>
      </div>` });
  }

  // Home Assistant : historique absent, en échec ou en chargement → on le dit à la place des graphiques (jamais de NaN dessiné)
  function waitState(T, Q) {
    const HB = BZ.hist; if (!HB) return null;
    if (HB.has("energie") === false) return { title: "Historique indisponible", text: "Un compteur d'énergie n'a pas de statistiques dans Home Assistant. Ouvre le diagnostic pour savoir lequel.",
      action: btn({ label: "Diagnostic", ic: "alert", act: "open-sheet", args: { sheet: "diag" }, size: "sm" }) };
    if (T.error || Q.error) return { title: "Home Assistant n'a pas répondu", text: "Réessaie dans un instant.", action: btn({ label: "Réessayer", ic: "refresh", act: "hist-retry", size: "sm" }) };
    if (T.loading || Q.loading) return { title: "Chargement de l'historique", text: "Les statistiques de Home Assistant arrivent…" };
    return null;
  }
  function waitCards(P, w) {
    return h`<div class="layout bi-grid bi-wait">
      <div class="col bi-l">${card({ cls: "bi-main", title: "Où va ta production", ic: "chart", tone: "accent", body: BZ.empty({ ic: "chart", ...w }) })}</div>
      <div class="col bi-r">${card({ cls: "bi-org", title: "D'où vient ta consommation", ic: "leaf", tone: "accent", body: BZ.empty({ ic: "leaf", title: w.title, text: "La répartition s'affichera avec l'historique." }) })}${roiCard(P)}</div>
    </div>`;
  }

  BZ.pages.insights = () => {
    REG.clear();
    F = BZ.hist ? 1 : rescale();   // recalage des économies : démo seulement
    const kind = ["jour", "semaine", "mois", "annee"].includes(BZ.ui.period) ? BZ.ui.period : "semaine";
    const [k, n] = String(BZ.ui.biOff || "").split(":");
    const off = k === kind ? BZ.clamp(Math.round(+n) || 0, minOff(kind), 0) : 0;
    const P = build(kind, off), T = P.total, Q = P.prevTotal, L = labels(P);
    const w = waitState(T, Q);
    if (w) return h`${header(P, L, true)}${waitCards(P, w)}`;
    return h`${header(P, L)}${kpis(P, T, Q, L)}
      <div class="layout bi-grid">
        <div class="col bi-l">${chartCard(P, T)}<div class="bi-pair">${compareCard(P.cmpTotal || T, Q, L)}${bestCard(P, L)}</div></div>
        <div class="col bi-r">${originCard(T)}${roiCard(P)}</div>
      </div>`;
  };
})();
