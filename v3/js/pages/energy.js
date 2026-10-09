// Énergie (V3) : le temps réel en détail, sans répéter l'Aperçu ni le Bilan.
//  En-tête : phrase d'état en direct | ballon + surplus disponible, « Chauffer le ballon »
//  Ligne 1 : production, batterie, réseau (compteur L3), prix du kWh — courbes d'aujourd'hui
//  Gauche  : flux en direct (soleil → maison → batterie, réseau, e-Niro), puis Production solaire (onduleurs) + Réseau
//  Droite  : Batterie SolarFlow (packs, rendement, réglages), Tarifs (cadran des 24 h à venir + prix)
(() => {
  const BZ = window.BZ;
  const { h, esc, fmt, icon, val, card, pill, kpi, btn, meter, ring, stepper, C, num } = BZ;

  const PACK_KWH = 2.88;   // capacité nominale d'un pack Zendure AB3000
  // Puissance maximale de chaque onduleur, lue dans son nom (« Izy 2 000 W »)
  const caps = () => C.onduleurs_noms.map((n, i) => parseInt(String(n).replace(/\D/g, ""), 10) || [2000, 2000, 1000][i] || 1000);
  const nowH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  // Milliers toujours séparés (« 1 821 »), même à 4 chiffres
  const NG = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0, useGrouping: "always" });
  const big = (v) => (Number.isFinite(v) ? NG.format(v).replace(/\u202f/g, "\u00a0") : "—");   // espace insécable visible
  // Capacité utile : celle qui donne les kWh affichés dans l'anneau (sinon la capacité nominale)
  const capKwh = () => { const soc = num(C.batterie_soc), d = num(C.batterie_dispo_kwh); return soc > 5 && d > 0 ? d / (soc / 100) : C.packs_soc.length * PACK_KWH; };
  // État coloré sans flèche de tendance (état, pas évolution)
  const tag = (text, tone, ic) => h`<span class="delta en-d" data-tone="${tone}">${ic ? icon(ic) : ""}${text}</span>`;
  // Libellé long sur grand écran, court quand la place manque
  const lbl = (long, short) => h`<span class="en-lo">${long}</span><span class="en-sh">${short}</span>`;
  const IMP = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7 7 17M15 17H7V9"/></svg>';
  const EXP = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  /* ─── Mini-courbes ────────────────────────────────────────────────── */
  const SW = 120, SH = 36;
  // Courbe lissée (Catmull-Rom → Bézier), comme les autres mini-courbes
  function smooth(p) {
    if (p.length < 2) return p.length ? `M${p[0][0]},${p[0][1]}` : "";
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)},${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)},${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
    }
    return d;
  }
  // Aujourd'hui, de 0 h à maintenant : pts = [[x 0…1, valeur]], point en direct au bout (pastille HTML, jamais déformée)
  // zero : échelle symétrique autour de 0 (au-dessus = revente, en dessous = achat)
  function daySpark(pts, tone, { lo, hi, zero = false, live } = {}) {
    // Capteur indisponible : on ne trace que les valeurs connues (jamais « NaN » dans un tracé SVG)
    pts = pts.filter((p) => Number.isFinite(p[1]));
    if (live && !Number.isFinite(live[1])) live = null;
    const vs = pts.map((p) => p[1]).concat(live ? [live[1]] : []);
    let a = lo != null ? lo : Math.min(0, ...vs), b = hi != null ? hi : Math.max(...vs, 0.001);
    if (zero) { const m = Math.max(Math.abs(a), Math.abs(b), 0.001); a = -m; b = m; }
    const y = (v) => SH - 3 - ((v - a) / (b - a || 1)) * (SH - 6);
    const P = pts.map(([x, v]) => [x * SW, y(v)]), d = smooth(P), y0 = y(zero ? 0 : a);
    const area = P.length > 1 ? `${d} L${P[P.length - 1][0].toFixed(1)},${y0.toFixed(1)} L${P[0][0].toFixed(1)},${y0.toFixed(1)} Z` : "";
    const dot = live ? h`<i class="en-sp-dot" data-tone="${live[2] || tone}" style="left:${(live[0] * 100).toFixed(1)}%;top:${((y(live[1]) / SH) * 100).toFixed(1)}%"></i>` : "";
    const svg = zero
      ? h`<svg class="spark" viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none" aria-hidden="true">
          <defs><clipPath id="en-sp-up"><rect x="0" y="-4" width="${SW}" height="${(y0 + 4).toFixed(1)}"/></clipPath><clipPath id="en-sp-dn"><rect x="0" y="${y0.toFixed(1)}" width="${SW}" height="${(SH - y0 + 4).toFixed(1)}"/></clipPath></defs>
          <line class="en-sp-0" x1="0" x2="${SW}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}"/>
          <g data-tone="grid" clip-path="url(#en-sp-up)"><path class="spark-a" d="${area}"/><path class="spark-l" d="${d}"/></g>
          <g data-tone="bad" clip-path="url(#en-sp-dn)"><path class="spark-a" d="${area}"/><path class="spark-l" d="${d}"/></g></svg>`
      : h`<svg class="spark" data-tone="${tone}" viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none" aria-hidden="true"><path class="spark-a" d="${area}"/><path class="spark-l" d="${d}"/></svg>`;
    return h`<span class="en-sp">${svg}${dot}</span>`;
  }

  // Mini-courbe en escalier (prix de chaque heure du jour) avec un repère « maintenant »
  function stepSpark(vals, tone, at) {
    const n = vals.length, max = Math.max(...vals), min = Math.min(...vals);
    const y = (v) => (SH - 3 - ((v - min) / (max - min || 1)) * (SH - 12)).toFixed(1), x = (i) => ((i / n) * SW).toFixed(1);
    let d = `M0,${y(vals[0])}`;
    vals.forEach((v, i) => { if (i && v !== vals[i - 1]) d += ` L${x(i)},${y(v)}`; d += ` L${x(i + 1)},${y(v)}`; });
    return h`<svg class="spark" data-tone="${tone}" viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none" aria-hidden="true">
      <path class="spark-a" d="${d} L${SW},${SH} L0,${SH} Z"/><path class="spark-l" d="${d}"/><line class="en-spark-now" x1="${((at / 24) * SW).toFixed(1)}" x2="${((at / 24) * SW).toFixed(1)}" y1="2" y2="${SH}"/></svg>`;
  }

  /* ─── Journée heure par heure (jusqu'à maintenant) ────────────────────
     Production : profil horaire partagé (BZ.hours). Batterie et réseau : les compteurs du jour
     sont répartis sur les heures écoulées au prorata du surplus (charge, revente) ou du manque
     (décharge, achat) de chaque heure, puis le niveau de batterie est retracé à rebours depuis
     la valeur actuelle. Branché sur Home Assistant, ces séries viendront de l'historique des capteurs. */
  function dayModel(L) {
    const H = nowH(), cur = Math.floor(H), T = BZ.today(), cap = capKwh(), frac = H - cur;
    const past = BZ.hours().filter((x) => x.h < cur);
    const sur = past.map((x) => Math.max(0, x.prod - (x.cons || 0))), lack = past.map((x) => Math.max(0, (x.cons || 0) - x.prod));
    const share = (arr, total) => { const s = sum(arr); return arr.map((v) => (s > 0 ? (v / s) * Math.max(0, total) : 0)); };
    const bNow = (L.bat / 1000) * frac, gNow = (-L.grid / 1000) * frac;   // heure entamée : au rythme actuel
    const chg = share(sur, T.chg - Math.max(0, bNow)), dch = share(lack, T.dch - Math.max(0, -bNow));
    const exp = share(sur, T.exp - Math.max(0, gNow)), imp = share(lack, T.imp - Math.max(0, -gNow));
    const soc = [num(C.batterie_soc) - (bNow / cap) * 100];                 // niveau au début de l'heure entamée
    for (let i = past.length - 1; i >= 0; i--) soc.unshift(soc[0] - ((chg[i] - dch[i]) / cap) * 100);
    const X = (t) => (H > 0 ? BZ.clamp(t / H, 0, 1) : 0);
    return {
      prod: past.map((x) => [X(x.h + 0.5), x.prod]),
      soc: soc.map((v, i) => [X(i), BZ.clamp(v, 0, 100)]).concat([[1, num(C.batterie_soc)]]),
      net: past.map((x, i) => [X(x.h + 0.5), exp[i] - imp[i]]),
    };
  }

  // Batterie : heure à laquelle elle sera pleine (charge) ou à sa réserve (décharge), au rythme actuel
  function batEta(L) {
    if (Math.abs(L.bat) < 15) return null;
    const soc = num(C.batterie_soc), up = L.bat > 0, pct = up ? num(C.batterie_max_pct) - soc : soc - num(C.batterie_min_pct);
    if (pct <= 0) return up ? { long: "charge maximale atteinte", short: "Au maximum" } : { long: "réserve atteinte", short: "À la réserve" };
    const hrs = ((pct / 100) * capKwh()) / (Math.abs(L.bat) / 1000);
    if (hrs > 20) return up ? { long: "pleine dans plus de 20 h", short: "Pleine > 20 h" } : { long: "réserve dans plus de 20 h", short: "Réserve > 20 h" };
    const at = new Date(Date.now() + hrs * 36e5); at.setMinutes(Math.round(at.getMinutes() / 5) * 5, 0, 0);
    const what = up ? "pleine" : "réserve", tom = at.getDate() !== new Date().getDate();
    return { long: `${what} ${tom ? "demain" : "vers"} ${fmt.time(at)}`, short: `${fmt.cap(what)} à ${fmt.time(at)}` };
  }

  /* ─── En-tête ─────────────────────────────────────────────────────── */
  function header(L) {
    const sun = L.solar > 30 ? `Les panneaux produisent ${fmt.powerText(L.solar)}` : "Les panneaux ne produisent pas";
    const bat = Math.abs(L.bat) < 15 ? "la batterie est en veille" : L.bat > 0 ? `la batterie charge à ${fmt.powerText(L.bat)}` : `la batterie rend ${fmt.powerText(-L.bat)}`;
    const grid = L.grid < -15 ? `tu revends ${fmt.powerText(-L.grid)}` : L.grid > 15 ? `tu achètes ${fmt.powerText(L.grid)}` : "rien ne passe par le réseau";
    // Pastille au service du bouton : température du ballon et surplus qui peut le chauffer
    const boost = num(C.ballon_boost) === 1, surplus = -L.grid, temp = `${fmt.n(num(C.ballon_temp))} °C`;
    // Libellés longs, et courts quand l'écran est étroit (en-bl / en-bs) : la pastille et le bouton tiennent côte à côte
    const ls = (long, short) => h`<span class="en-bl">${long}</span><span class="en-bs">${short}</span>`;
    const live = boost ? { tone: "heat", main: ls("Ballon en chauffe", "En chauffe"), sub: temp, on: true }
      : surplus > 15 ? { tone: "grid", main: `Surplus ${fmt.powerText(surplus)}`, sub: `ballon ${temp}`, on: true }
      : { tone: "neutral", main: "Pas de surplus", sub: `ballon ${temp}`, on: false };
    return h`<header class="ph">
      <div><p class="ph-hi">Temps réel</p><h1>Énergie</h1><p class="ph-sub">${sun}, ${bat} et ${grid}.</p></div>
      <div class="ph-a">
        <span class="en-live" data-tone="${live.tone}"><i class="${live.on ? "is-on" : ""}"></i><b>${live.main}</b><span>· ${live.sub}</span></span>
        ${btn({ label: boost ? ls("Arrêter la chauffe", "Arrêter") : ls("Chauffer le ballon", "Chauffer"), aria: boost ? "Arrêter la chauffe du ballon" : "Chauffer le ballon", ic: boost ? "x" : "drop", act: "boiler-boost", kind: "primary", pending: BZ.isPending(C.ballon_boost) })}
      </div></header>`;
  }

  /* ─── Indicateurs : tous sur aujourd'hui (0 h → maintenant), le prix sur la journée ─── */
  function kpis(L) {
    const T = BZ.today(), hrs = BZ.hours(), cur = Math.floor(nowH()), M = dayModel(L);
    // Production : heures écoulées + valeur en direct au bout ; écart avec la prévision de l'heure en cours
    const expected = hrs[cur] ? hrs[cur].prod : 0;
    const prodD = expected > 0.1 && L.solar > 30 ? BZ.delta(L.solar / 1000, expected) : "";
    const prodS = daySpark(M.prod, "solar", { live: [1, L.solar / 1000] });
    // Batterie : niveau heure par heure ; puissance + heure pleine (ou réserve), seulement l'heure quand la place manque
    const soc = num(C.batterie_soc), up = L.bat > 0, eta = batEta(L);
    const batD = Math.abs(L.bat) < 15 ? tag("En veille", "neutral")
      : h`<span class="delta en-d" data-tone="${up ? "battery" : "warn"}"><span class="en-dw">${icon(up ? "up" : "down")}${fmt.powerText(Math.abs(L.bat))}</span><span class="en-ds">${eta ? eta.short : up ? "En charge" : "Décharge"}</span></span>`;
    // Réseau : seule valeur signée de la page, comme le compteur (− revente, + achat)
    const g = L.grid, exp = g < -15, imp = g > 15, [gv, gu] = fmt.power(Math.abs(g));
    const gridS = daySpark(M.net, "grid", { zero: true, live: [1, -g / 1000, exp ? "grid" : imp ? "bad" : "neutral"] });
    const t = BZ.tariffNow(), prices = BZ.tariffHours().map((k) => BZ.TARIFS[k].price());
    return h`<div class="kpis en-kpis">
      ${kpi({ label: "Production", ic: "sun", tone: "solar", value: val(fmt.power(L.solar)), delta: prodD, vs: prodD ? lbl(`vs prévu à ${cur} h`, "vs prévu") : `${fmt.kwhText(T.prod)} aujourd'hui`, spark: prodS, to: "insights" })}
      ${kpi({ label: "Batterie SolarFlow", ic: "battery", tone: "battery", value: val([fmt.n(soc), "%"]), delta: batD, vs: eta ? h`<span class="en-eta">${eta.long}</span>` : "", spark: daySpark(M.soc, "battery", { lo: 0, hi: 100, live: [1, soc] }) })}
      ${kpi({ label: "Réseau", ic: "grid", tone: imp ? "bad" : "grid", value: h`<span class="en-gv ${exp ? "is-good" : imp ? "is-bad" : ""}">${val([`${exp ? "−" : imp ? "+" : ""}${gv}`, gu])}</span>`,
        delta: tag(exp ? "Revente" : imp ? "Achat" : "Équilibre", exp ? "good" : imp ? "bad" : "neutral"), vs: h`<span class="en-lo">compteur L3</span>`, spark: gridS, to: "insights" })}
      ${kpi({ label: "Prix du kWh", ic: "clock", tone: t.key, value: val([fmt.n(t.price, 4), "€"]), delta: tag(t.short, t.key), vs: lbl(`jusqu'à ${fmt.time(t.changeAt)}`, `→ ${fmt.time(t.changeAt)}`), spark: stepSpark(prices, t.key, nowH()) })}
    </div>`;
  }

  /* ─── Flux en direct ──────────────────────────────────────────────────
     Deux dispositions : en ligne (carte large) et en croix autour de la maison (carte étroite).
     Les liaisons vont de centre à centre, sous les pastilles opaques : elles touchent toujours les nœuds. */
  const speed = (w) => `${BZ.clamp(2.6 - w / 1400, 0.55, 2.6).toFixed(2)}s`;
  const width = (w) => BZ.clamp(1.5 + w / 1100, 1.5, 5).toFixed(2);
  const link = (d, tone, w, reverse) => h`<path class="fl-bg" d="${d}"/>${w >= 15 ? h`<path class="fl-go ${reverse ? "is-rev" : ""}" data-tone="${tone}" d="${d}" style="--sp:${speed(w)};--sw:${width(w)}"/>` : ""}`;
  const flowNodes = (L) => BZ.flowNodes(L);   // mêmes états que le schéma partagé (flow.js) et la maison
  const fnode = (k, n, [x, y]) => h`
    <div class="fn fn-${k} ${n.w < 15 && k !== "home" ? "is-idle" : ""}" data-tone="${n.tone}" style="--x:${x}%;--y:${y}%">
      <span class="fn-i">${icon(n.ic)}${n.soc != null ? h`<svg class="fn-soc" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.5" pathLength="100" style="--p:${n.soc}"/></svg>` : ""}</span>
      <span class="fn-t"><span class="fn-l">${n.label}</span>${val(fmt.power(n.w), "fn-v")}<span class="fn-n">${n.note}</span></span>
    </div>`;
  function flow(L) {
    const N = flowNodes(L), batRev = L.bat < 0, gTone = L.grid > 15 ? "bad" : "grid", gRev = L.grid > 15;
    const lines = (path) => [link(path("sun", "home"), "solar", L.solar), link(path("home", "bat"), "battery", Math.abs(L.bat), batRev),
      link(path("home", "grid"), gTone, Math.abs(L.grid), gRev), link(path("home", "car"), "ev", L.car)];
    // En ligne : soleil → maison → destinations réparties sur la hauteur
    const P = { sun: [13, 50], home: [40, 50], bat: [77, 18], grid: [77, 50], car: [77, 82] };
    const curve = (a, b) => { const [x1, y1] = P[a], [x2, y2] = P[b], mx = (x1 + x2) / 2; return `M${x1 * 10},${y1 * 3.4} C${mx * 10},${y1 * 3.4} ${mx * 10},${y2 * 3.4} ${x2 * 10},${y2 * 3.4}`; };
    // En croix : la maison au centre
    const Q = { sun: [50, 14], bat: [15, 50], home: [50, 50], grid: [85, 50], car: [50, 86] };
    const seg = (a, b) => { const [x1, y1] = Q[a], [x2, y2] = Q[b]; return `M${x1},${y1} L${x2},${y2}`; };
    const summary = `Soleil ${fmt.powerText(L.solar)}, maison ${fmt.powerText(L.house)}, batterie ${Math.abs(L.bat) < 15 ? "en veille" : `${fmt.powerText(Math.abs(L.bat))} ${L.bat > 0 ? "en charge" : "en décharge"}`}, réseau ${Math.abs(L.grid) < 15 ? "à l'équilibre" : `${fmt.powerText(Math.abs(L.grid))} ${L.grid < 0 ? "revendus" : "achetés"}`}, voiture ${fmt.powerText(L.car)}.`;
    return h`<div class="flow" role="img" aria-label="${summary}">
      <div class="flow-wide"><svg viewBox="0 0 1000 340" preserveAspectRatio="none" aria-hidden="true">${lines(curve)}</svg>${Object.entries(N).map(([k, n]) => fnode(k, n, P[k]))}</div>
      <div class="flow-cross"><svg viewBox="0 0 100 100" aria-hidden="true">${lines(seg)}</svg>${Object.entries(N).map(([k, n]) => fnode(k, n, Q[k]))}</div>
    </div>`;
  }
  function flowCard(L) {
    // Autosuffisance en ce moment : part de la consommation couverte sans le réseau (même terme que l'Aperçu, pour la journée)
    const need = L.house + L.car, auto = need > 0 ? BZ.clamp(1 - Math.max(0, L.grid) / need, 0, 1) : 1;
    return card({ cls: "en-flow", title: "Flux en direct", ic: "energy", tone: "accent",
      aside: pill(h`<span><span class="en-a1">Autosuffisance </span>${fmt.n(auto * 100)} %<span class="en-a2"> en ce moment</span><span class="en-a3"> autonome</span></span>`, auto > 0.95 ? "good" : auto > 0.5 ? "warn" : "bad", true),
      link: { label: "Historique", to: "insights" }, body: flow(L) });
  }

  /* ─── Production solaire : avancement de la journée + 3 onduleurs ─── */
  function solarCard() {
    const K = caps(), ws = C.onduleurs_w.map((id) => Math.max(0, num(id) || 0)), tot = ws.reduce((a, b) => a + b, 0), T = BZ.today();
    const done = T.forecast > 0 ? BZ.clamp(T.prod / T.forecast, 0, 1) : 0, rest = Math.max(0, T.forecast - T.prod);
    return card({ cls: "en-sun", target: true, title: "Production solaire", ic: "sun", tone: "accent",
      aside: h`<span class="en-note"><b>${fmt.n(T.prod, 1)}</b> kWh<span class="en-lo"> aujourd'hui</span></span>`, body: h`
      <div class="en-fc">
        ${meter({ value: done * 100, tone: "solar", size: "xs", label: `Production du jour : ${fmt.n(done * 100)} % de la prévision` })}
        <p><span><b>${fmt.n(done * 100)} %</b> <span class="en-fl">des ${fmt.kwhText(T.forecast)} prévus</span><span class="en-fs">du prévu</span></span><span>${rest > 0.05 ? `encore ~${fmt.kwhText(rest)}` : "prévision atteinte"}</span></p>
      </div>
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
    // Autoconsommation : part de la production solaire utilisée sur place (maison, batterie, voiture)
    const self = L.solar > 30 ? BZ.clamp(1 - Math.max(0, -g) / L.solar, 0, 1) : null;
    // Argent en jeu maintenant : ce que le soleil et la batterie évitent d'acheter, ou ce que coûte l'achat
    const covered = Math.max(0, L.house + L.car - Math.max(0, g)), saving = covered > 15 || !imp;
    const money = saving
      ? { ic: "euro", tone: "good", label: lbl("Économie en cours", "Économie"), v: val([fmt.n((covered / 1000) * t.price, 2), "€/h"]), title: `${fmt.powerText(covered)} consommés sans le réseau, au tarif ${t.short} (${fmt.n(t.price, 4)} €/kWh)` }
      : { ic: "euro", tone: "bad", label: lbl("Achat en cours", "Achat"), v: val([fmt.n((g / 1000) * t.price, 2), "€/h"]), title: `${fmt.powerText(g)} achetés au tarif ${t.short} (${fmt.n(t.price, 4)} €/kWh)` };
    const tiles = [
      { raw: IMP, tone: "bad", label: "Achat du jour", v: val(fmt.kwh(T.imp)) },
      { raw: EXP, tone: "grid", label: "Revente du jour", v: val(fmt.kwh(T.exp)) },
      { ic: "sun", tone: "solar", label: lbl("Autoconsommation", "Autoconso."), v: self == null ? h`<span class="en-na">pas de soleil</span>` : val([fmt.n(self * 100), "%"]), title: "Part de la production solaire utilisée sur place en ce moment (maison, batterie, voiture)" },
      money,
    ];
    const net = T.exp - T.imp, vt = exp ? `Revente de ${fmt.powerText(-g)}` : imp ? `Achat de ${fmt.powerText(g)}` : "Aucun échange";
    return card({ cls: "en-grd", target: true, title: "Réseau", ic: "grid", tone: "accent",
      aside: h`<span title="Solde du jour : revente moins achat">${pill(`Solde ${net >= 0 ? "+" : "−"}${fmt.n(Math.abs(net), 1)} kWh`, net >= 0 ? "good" : "bad")}</span>`, body: h`
      <div class="en-dv" data-tone="${exp ? "grid" : imp ? "bad" : "neutral"}" role="meter" aria-label="Échange avec le réseau" aria-valuemin="${Math.round(-span)}" aria-valuemax="${Math.round(span)}" aria-valuenow="${Math.round(-g)}" aria-valuetext="${vt}">
        <span class="en-dv-l ${imp ? "is-on" : ""}">Achat</span>
        <span class="en-dv-t">
          <i class="${exp ? "is-r" : "is-l"}" style="--v:${v.toFixed(2)}%"></i><b></b>
          <em style="--x:${BZ.clamp(50 + (exp ? v : -v), 14, 86).toFixed(2)}%">${fmt.powerText(Math.abs(g))}</em>
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
    const life = `Depuis l'installation : ${big(tin)} kWh stockés, ${big(tout)} kWh rendus`;
    return card({ cls: "en-bat", target: true, title: "Batterie SolarFlow", ic: "battery", tone: "accent", aside: state, body: h`
      <div class="en-bat-top">
        ${ring({ value: soc, tone: "battery", size: 112, stroke: 10, mark: min, label: `Batterie à ${fmt.n(soc)} %, ${fmt.kwhText(num(C.batterie_dispo_kwh))} disponibles, réserve à ${fmt.n(min)} %`,
          inner: h`<b>${fmt.n(soc)}<small>%</small></b><span>${fmt.kwhText(num(C.batterie_dispo_kwh))}</span>` })}
        <ul class="en-packs">${C.packs_soc.map((id, i) => h`<li>
          <b>Pack ${i + 1}</b>${meter({ value: num(id), tone: "battery", size: "xs", label: `Pack ${i + 1} à ${fmt.n(num(id))} %` })}<em>${fmt.n(num(id))} %</em>
          <small><span class="sr">Température </span>${fmt.n(num(C.packs_temp[i]))}°</small></li>`)}</ul>
      </div>
      <div class="en-kv">
        <div><span>${lbl("Stocké aujourd'hui", "Stocké")}</span><b>${val(fmt.kwh(num(C.batterie_charge_jour_kwh)))}</b></div>
        <div><span>${lbl("Rendu aujourd'hui", "Rendu")}</span><b>${val(fmt.kwh(num(C.batterie_decharge_jour_kwh)))}</b></div>
        <div title="${life}"><span>${lbl("Rendement global", "Rendement")}</span><b>${val([fmt.n(eff * 100, 1), "%"])}</b></div>
      </div>
      <div class="en-set">
        <div><span>Réserve minimale</span>${stepper({ value: fmt.n(min), unit: " %", act: "bat-min", label: "Réserve minimale", cur: min, min: 0, max: 50, pending: BZ.isPending(C.batterie_min_pct) })}</div>
        <div><span>Charge maximale</span>${stepper({ value: fmt.n(max), unit: " %", act: "bat-max", label: "Charge maximale", cur: max, min: 70, max: 100, pending: BZ.isPending(C.batterie_max_pct) })}</div>
      </div>
      <p class="foot en-bat-f"><span>Température ${fmt.n(num(C.batterie_temp))} °C</span><span>Depuis l'installation : <span class="en-nw">${big(tin)} kWh stockés</span> · <span class="en-nw">${big(tout)} rendus</span></span></p>` });
  }

  /* ─── Tarifs : cadran des 24 h à venir + prix ─────────────────────── */
  // Cadran : une case par heure (0 h en haut, sens horaire). Il montre les 24 prochaines heures :
  // rien n'est estompé, le repère « maintenant » marque le départ. Heures du cadran en HTML (11 px à toute taille).
  const DS = 120, DM = 16, DB = DS + 2 * DM, DR = 48, DW = 13;
  function dial(hours, H, t, aria) {
    const cx = DS / 2, c = 2 * Math.PI * DR, seg = c / 24, gap = 1.3;
    const a = (H / 24) * 2 * Math.PI, px = cx + DR * Math.sin(a), py = cx - DR * Math.cos(a);
    const out = ((DR + DW / 2) / DB) * 100;    // rayon extérieur de l'anneau, en % du cadran
    const lab = [[0, "0h", 0, -10], [6, "6h", 14, 0], [12, "12h", 0, 10], [18, "18h", -14, 0]].map(([k, l, dx, dy]) => {
      const b = (k / 24) * 2 * Math.PI, sx = Math.sin(b), sy = -Math.cos(b);
      return h`<span style="left:calc(${(50 + out * sx).toFixed(2)}% + ${dx}px);top:calc(${(50 + out * sy).toFixed(2)}% + ${dy}px)">${l}</span>`;
    });
    return h`<div class="en-dial" data-tone="${t.key}" role="img" aria-label="${aria}">
      <svg viewBox="${-DM} ${-DM} ${DB} ${DB}" aria-hidden="true">
        <g transform="rotate(-90 ${cx} ${cx})">${hours.map((k, i) => h`<circle data-tariff="${k}" cx="${cx}" cy="${cx}" r="${DR}" stroke-width="${DW}" stroke-dasharray="${(seg - gap).toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${(-(seg * i + gap / 2)).toFixed(2)}"/>`)}</g>
        <circle class="en-dial-now" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5.5"/>
      </svg>
      <div class="en-dial-ax" aria-hidden="true">${lab}</div>
      <div class="en-dial-c"><b>${t.short}</b><span>→ ${fmt.time(t.changeAt)}</span></div></div>`;
  }

  function tariffCard() {
    const t = BZ.tariffNow(), hours = BZ.tariffHours(), H = nowH(), T = BZ.TARIFS, hp = T.hp.price(), cur = Math.floor(H);
    // Prochain début des super creuses
    let hscAt = null;
    for (let k = 1; k <= 24; k++) { const a = (cur + k) % 24; if (BZ.tariffAt(a) === "hsc" && BZ.tariffAt((a + 23) % 24) !== "hsc") { hscAt = a; break; } }
    // Les 24 prochaines heures, plage par plage, à partir de maintenant
    const runs = [];
    for (let k = 0; k < 24; k++) { const hh = (cur + k) % 24, key = hours[hh]; if (runs.length && runs[runs.length - 1].k === key) runs[runs.length - 1].n++; else runs.push({ k: key, s: hh, n: 1 }); }
    const aria = `Tarifs des 24 prochaines heures : ${runs.map((r, i) => `${T[r.k].label.toLowerCase()} ${i ? `de ${r.s} h` : "maintenant"} jusqu'à ${(r.s + r.n) % 24} h`).join(", ")}.`;
    const aside = t.key === "hsc" ? pill("Super creuses en cours", "hsc", true) : hscAt != null ? pill(`Super creuses à ${String(hscAt).padStart(2, "0")}:00`, "hsc") : "";
    return card({ cls: "en-tar", title: h`Tarifs<span class="en-tt"> du jour</span>`, ic: "clock", tone: "accent", aside, body: h`
      <div class="en-tar-b">
        ${dial(hours, H, t, aria)}
        <ul class="en-tk">
          <li class="en-tk-h" aria-hidden="true"><span>Plage</span><span>€/kWh</span></li>
          ${["hp", "hc", "hsc"].map((k) => {
            const p = T[k].price();
            return h`<li data-tone="${k}" class="${k === t.key ? "is-cur" : ""}"><i></i>
              <span><strong>${lbl(T[k].label, T[k].short)}</strong><small>${BZ.rangeLabel(k)}</small></span>
              <span class="en-tk-v"><b><span class="sr">Prix : </span>${fmt.n(p, 4)}<span class="sr"> € par kWh</span></b><small>${k === "hp" ? "référence" : `−${fmt.n((1 - p / hp) * 100)} % vs HP`}</small></span></li>`;
          })}</ul>
      </div>` });
  }

  BZ.pages.energy = () => {
    const L = BZ.live();
    // Mobile : la maison en direct remplace le schéma « Flux en direct » (masqué sous 768 px)
    return h`${header(L)}${BZ.house()}${kpis(L)}
      <div class="layout en-grid">
        <div class="col en-l">${flowCard(L)}<div class="en-pair">${solarCard()}${gridCard(L)}</div></div>
        <div class="col en-r">${batCard(L)}${tariffCard()}</div>
      </div>`;
  };
})();
