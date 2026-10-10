// Breezy HEMS V3 — héros de l'Aperçu : ta maison (dessin de la photo, v3/art/maison.svg), en direct.
// Trois calques superposés, dans le même repère (pixels de la photo, bandes des pastilles au-dessus et au-dessous) :
//  1. le décor (BZ.HERO_ART, hero-art.js) : injecté une seule fois, BZ.morph ne le compare plus (data-static) ;
//  2. l'énergie : chaque liaison suit une gaine du dessin. Gaine sous tension (lueur), impulsions lumineuses à
//     traîne dans le sens réel, éclat à l'arrivée ; panneaux balayés de lumière, LED de la batterie au niveau
//     de charge, fenêtres qui s'allument avec la consommation, lueur de la borne dans le garage, tranchée du réseau.
//     Plus la puissance monte, plus les impulsions sont nombreuses, rapides et lumineuses (paliers : un rendu
//     toutes les 5 s ne relance rien, seules des variables CSS changent) ;
//  3. les pastilles (vrais liens) reliées à leur élément par un repère en pointillé, comme sur la photo.
(() => {
  const BZ = window.BZ;
  const { h, esc, fmt, icon, num } = BZ;
  const IDLE = BZ.FLOW_IDLE || 15, has = Number.isFinite, pw = (w) => (has(w) ? fmt.powerText(w) : "—");
  const W = 1179, H = 779, TOP = 112, BOT = 108, VB = `0 ${-TOP} ${W} ${H + TOP + BOT}`;
  const rowY = { top: -TOP / 2 + 4, bot: H + BOT / 2 - 6 };
  const r1 = (v) => Math.round(v * 10) / 10;

  /* ─── Trajets : ils suivent les gaines du dessin, dans le sens « aller » ─── */
  const ROUTES = {
    sun: [[815, 104], [886, 206], [896.5, 231], [893.5, 515], [787, 533]],                  // panneaux → coffret
    home: [[760.5, 496], [760.5, 398], [737, 389]],                                         // coffret → lucarne (maison)
    bat: [[731, 542], [674, 550.5], [660.8, 558], [660.8, 683], [612, 689.5]],              // coffret → batterie
    grid: [[755, 580], [755, 667], [775, 679.5], [918, 752]],                               // coffret → tranchée (réseau)
    car: [[787, 552], [897, 537]],                                                          // coffret → borne du garage
  };
  const lenOf = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const dOf = (pts) => "M" + pts.map((p) => `${p[0]},${p[1]}`).join("L");
  // Milieu du trajet et direction (flèche fixe en mouvement réduit)
  function mid(pts) {
    let left = lenOf(pts) / 2;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay);
      if (left <= l) { const t = left / l; return { x: r1(ax + (bx - ax) * t), y: r1(ay + (by - ay) * t), a: r1((Math.atan2(by - ay, bx - ax) * 180) / Math.PI) }; }
      left -= l;
    }
    return { x: pts[0][0], y: pts[0][1], a: 0 };
  }

  /* ─── Paliers : vitesse, nombre d'impulsions, éclat ─────────────────
     Une puissance qui varie un peu (relevés toutes les 5 s) garde son palier : rien ne saute à l'écran. */
  const SPEEDS = [[0, 120], [250, 170], [700, 230], [1400, 300], [2600, 380], [4200, 460]];   // W → unités/s
  const COUNTS = [[0, 1], [450, 2], [1300, 3], [2600, 4]];
  const pick = (tab, w) => tab.reduce((a, [t, v]) => (w >= t ? v : a), tab[0][1]);
  const memo = {};
  // Palier gardé tant que la puissance reste à ±15 % du seuil franchi (pas de va-et-vient à la frontière)
  function steady(k, w) {
    const m = memo[k];
    if (m && w > m.w * 0.85 && w < m.w * 1.15) return m;
    return (memo[k] = { w, v: pick(SPEEDS, w), n: pick(COUNTS, w), i: Math.round(BZ.clamp(0.45 + w / 5000, 0.45, 1) * 10) / 10 });
  }

  function links(S) {
    const { L } = S, g = L.grid, b = L.bat;
    const live = (w) => has(w) && w >= IDLE;
    return [
      { k: "sun", tone: "solar", w: L.solar, on: live(L.solar), rev: false },
      { k: "home", tone: "home", w: L.house, on: live(L.house), rev: false },
      { k: "bat", tone: "battery", w: Math.abs(b), on: live(Math.abs(b)), rev: b < 0 },          // décharge : batterie → coffret
      { k: "grid", tone: g > 0 ? "bad" : "good", w: Math.abs(g), on: live(Math.abs(g)), rev: g > 0 },   // achat : réseau → coffret
      { k: "car", tone: "ev", w: L.car, on: S.carOn, rev: false },
    ];
  }

  function flow(x) {
    const pts = x.rev ? ROUTES[x.k].slice().reverse() : ROUTES[x.k], d = dOf(pts), len = lenOf(pts);
    const s = x.on ? steady(x.k, x.w) : null;
    // Impulsions : au plus une tous les 120 unités de trajet (une gaine courte n'en porte qu'une)
    const n = s ? Math.max(1, Math.min(s.n, Math.round(len / 120))) : 1, per = 100 / n;
    const dur = s ? Math.max(0.9, Math.round((len / s.v) * 20) / 20) : 2;
    const tail = r1(per * 0.5), head = 3.4, end = pts[pts.length - 1], m = mid(pts);
    const style = `--d:${dur}s;--n:${n};--i:${s ? s.i : 0};--tl:${tail};--hd:${head};--per:${r1(per)}`;
    return h`<g class="mh-ln mh-l-${x.k}" data-tone="${x.tone}" data-on="${x.on ? 1 : 0}" style="${style}">
      <path class="mh-tube" d="${d}" filter="url(#mh-fx-blur)"/>
      <path class="mh-core" d="${d}"/>
      <path class="mh-glow" d="${d}" pathLength="100" stroke-dasharray="${tail} ${r1(per - tail)}"/>
      <path class="mh-tail" d="${d}" pathLength="100" stroke-dasharray="${tail} ${r1(per - tail)}"/>
      <path class="mh-head" d="${d}" pathLength="100" stroke-dasharray="${head} ${r1(per - head)}" style="--s0:${r1(-(tail - head))}"/>
      <g class="mh-hit" transform="translate(${end[0]} ${end[1]})"><circle class="mh-ring" r="16"/><circle class="mh-spark" r="5.5"/></g>
      <path class="mh-arrow" d="M-8,-8L3,0L-8,8" transform="translate(${m.x} ${m.y}) rotate(${m.a})"/>
    </g>`;
  }

  /* ─── Effets aux sources et aux arrivées ─────────────────────────── */
  // Éclats de soleil sur les panneaux (scintillent en décalé, d'autant plus que la production est forte)
  const GLINTS = [[262, 150], [395, 128], [520, 112], [640, 92], [760, 80], [300, 214], [430, 196], [560, 178], [335, 262], [470, 246], [600, 226], [860, 120], [930, 175]];
  const LED = "M500.6,656 L515.2,660.5 L515.2,715.8 Q515.2,718.4 512.8,717.8 L502.8,713.4 Q500.8,712.4 500.8,709.5 Z";
  function scene(S) {
    const { L } = S, sunW = L.solar, soc = BZ.clamp(has(S.soc) ? S.soc : 0, 0, 100), b = L.bat;
    const sunI = has(sunW) && sunW >= IDLE ? BZ.clamp(0.35 + sunW / 6000, 0.35, 1) : 0;
    const home = has(L.house) ? BZ.clamp(0.3 + L.house / 2500, 0.3, 1) : 0.4;
    const levelY = r1(716 - (60 * soc) / 100);   // la LED se remplit du bas (0 %) vers le haut (100 %)
    const batSt = !has(b) || Math.abs(b) < IDLE ? "idle" : b > 0 ? "in" : "out";
    return h`<g class="mh-fx-scene" style="--sun:${sunI.toFixed(2)};--home:${home.toFixed(2)}" data-sun="${sunI > 0 ? 1 : 0}" data-bat="${batSt}" data-car="${S.carOn ? 1 : 0}" data-grid="${!has(L.grid) || Math.abs(L.grid) < IDLE ? "idle" : L.grid > 0 ? "in" : "out"}">
      <g class="mh-pv" mask="url(#mh-fx-pm)"><rect class="mh-pv-tint" x="170" y="20" width="850" height="290"/><rect class="mh-sweep" x="-260" y="0" width="230" height="330" fill="url(#mh-fx-sweep)"/>${GLINTS.map(([x, y], i) => h`<circle class="mh-glint" cx="${x}" cy="${y}" r="3.2" style="--k:${i}"/>`)}</g>
      <g class="mh-win">
        <ellipse cx="165" cy="330" rx="95" ry="150" fill="url(#mh-fx-warm)"/>
        <ellipse cx="770" cy="290" rx="60" ry="95" fill="url(#mh-fx-warm)"/>
        <ellipse cx="190" cy="600" rx="135" ry="60" fill="url(#mh-fx-warm)"/>
      </g>
      <g class="mh-garage"><ellipse cx="1085" cy="650" rx="120" ry="40" fill="url(#mh-fx-ev)"/><ellipse cx="925" cy="540" rx="26" ry="20" fill="url(#mh-fx-ev)"/></g>
      <g class="mh-led" clip-path="url(#mh-fx-led)">
        <rect class="mh-led-off" x="495" y="650" width="25" height="${r1(Math.max(0, levelY - 650))}"/>
        <rect class="mh-led-scan" x="495" y="${levelY}" width="25" height="${r1(Math.max(0, 720 - levelY))}" fill="url(#mh-fx-scan)"/>
      </g>
      <ellipse class="mh-led-halo" cx="508" cy="${r1(levelY + (716 - levelY) / 2)}" rx="24" ry="${r1(Math.max(10, (716 - levelY) / 2 + 10))}" fill="url(#mh-fx-green)"/>
    </g>`;
  }

  /* ─── Pastilles et repères ───────────────────────────────────────── */
  // x : centre de la pastille (unités du dessin) ; row : bande du haut ou du bas ; at : élément visé
  function chips(S, W) {
    const { L, N } = S, g = L.grid, b = L.bat, batIdle = !(Math.abs(b) >= IDLE), gridIdle = !(Math.abs(g) >= IDLE);
    return [
      { k: "sun", tone: "solar", ic: "sun", l: "Soleil", v: !has(L.solar) ? "—" : S.night ? "Nuit" : pw(L.solar), idle: !S.sunOn, x: 262, row: "top", at: [262, 118],
        to: "energy", spot: "en-sun", say: W.sun, go: "Voir la production sur la page Énergie" },
      { k: "home", tone: "home", ic: "home", l: "Maison", v: pw(L.house), idle: !has(L.house), x: 735, row: "top", at: [753, 190],
        to: "insights", say: W.home, go: "Voir le bilan" },
      { k: "car", tone: "ev", ic: "car", l: N.car.label, v: S.carOn ? pw(L.car) : L.plugged ? "Branchée" : "Débranchée", idle: !S.carOn, x: 1016, row: "top", at: [1088, 540],
        to: "vehicle", say: W.car, go: "Ouvrir la page Voiture" },
      { k: "bat", tone: "battery", ic: "battery", l: "Batterie", x2: has(S.soc) ? `${fmt.n(S.soc)} %` : "", v: !has(b) ? "—" : batIdle ? N.bat.state : `${b > 0 ? "+" : "−"}${pw(Math.abs(b))}`, idle: batIdle, x: 440, row: "bot", at: [557, 714],
        to: "energy", spot: "en-bat", say: W.bat, go: "Voir la batterie sur la page Énergie" },
      { k: "grid", tone: g > 0 ? "bad" : "good", ic: "grid", l: "Réseau", v: !has(g) ? "—" : gridIdle ? N.grid.state : `${g < 0 ? "−" : "+"}${pw(Math.abs(g))}`, sub: gridIdle || !has(g) ? "" : g < 0 ? "revente" : "achat", idle: gridIdle, x: 905, row: "bot", at: [884, 734],
        to: "energy", spot: "en-grd", say: W.grid, go: "Voir le réseau sur la page Énergie" },
    ];
  }
  const pct = (v, total) => `${((v / total) * 100).toFixed(2)}%`;

  /* ─── Rendu ─────────────────────────────────────────────────────── */
  let inView = true;
  const running = () => inView && !document.hidden;
  function hero() {
    const { S, sum, W: Wd } = BZ.houseLive(), CH = chips(S, Wd), LK = links(S);
    const label = `Ta maison en direct : ${sum.who.toLowerCase()}${sum.a ? `, ${sum.a}` : ""}. Soleil : ${Wd.sun} ; maison : ${Wd.home} ; batterie ${Wd.bat} ; réseau : ${Wd.grid} ; e-Niro ${Wd.car}.`;
    const chip = (c) => h`<a class="mh-chip ${c.idle ? "is-idle" : ""}" data-tone="${c.tone}" href="${BZ.href(c.to)}" ${c.spot ? `data-spot="${c.spot}"` : ""}
        style="left:${pct(c.x, W)};top:${pct(rowY[c.row] + TOP, H + TOP + BOT)}" aria-label="${esc(`${c.l}${c.x2 ? ` ${c.x2}` : ""} ${c.v}${c.sub ? ` ${c.sub}` : ""}, ${c.say}. ${c.go}`)}">
        <span class="mh-cl">${icon(c.ic)}${c.l}${c.x2 ? h`<em>${c.x2}</em>` : ""}</span><b class="mh-cv">${c.v}${c.sub ? h`<small> ${c.sub}</small>` : ""}</b></a>`;
    return h`<section class="mh" data-run="${running() ? 1 : 0}" aria-labelledby="mh-t">
      <h2 class="sr" id="mh-t">Ta maison en direct</h2>
      <a class="mh-go" href="${BZ.href("energy")}" aria-label="${esc(`${label} Voir le détail sur la page Énergie.`)}"></a>
      <div class="mh-stage" aria-hidden="true">
        <svg class="mh-art" data-static="mh-art" viewBox="${VB}" preserveAspectRatio="xMidYMid slice" focusable="false"></svg>
        <svg class="mh-fx" viewBox="${VB}" preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs>
            <mask id="mh-fx-pm"><g fill="#fff">${(BZ.HERO_PANELS || []).map((p) => h`<polygon points="${p}"/>`)}</g></mask>
            <filter id="mh-fx-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
            <clipPath id="mh-fx-led"><path d="${LED}"/></clipPath>
            <linearGradient id="mh-fx-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
            <radialGradient id="mh-fx-warm"><stop offset="0" stop-color="#ffd9a3" stop-opacity=".9"/><stop offset="1" stop-color="#ffd9a3" stop-opacity="0"/></radialGradient>
            <radialGradient id="mh-fx-ev"><stop offset="0" stop-color="#b66cff" stop-opacity=".8"/><stop offset="1" stop-color="#b66cff" stop-opacity="0"/></radialGradient>
            <radialGradient id="mh-fx-green"><stop offset="0" stop-color="#6dff5c" stop-opacity=".75"/><stop offset="1" stop-color="#6dff5c" stop-opacity="0"/></radialGradient>
            <linearGradient id="mh-fx-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaffd9" stop-opacity=".9"/><stop offset=".25" stop-color="#eaffd9" stop-opacity="0"/><stop offset="1" stop-color="#eaffd9" stop-opacity="0"/></linearGradient>
          </defs>
          ${scene(S)}
          <g class="mh-links">${LK.map(flow)}</g>
          <g class="mh-leads">${CH.map((c) => h`<g data-tone="${c.tone}" class="${c.idle ? "is-idle" : ""}"><path d="M${c.x},${rowY[c.row]}L${c.at[0]},${c.at[1]}"/><circle cx="${c.at[0]}" cy="${c.at[1]}" r="7"/></g>`)}</g>
        </svg>
        <div class="mh-chips">${CH.map(chip)}</div>
      </div>
      <p class="mh-now" aria-hidden="true" data-tone="${sum.tone}"><span class="mh-live ${sum.wait ? "is-idle" : ""}"><i></i>En direct</span><span class="mh-say"><b>${sum.who}</b>${sum.a ? h` · ${sum.a}` : ""}</span></p>
    </section>`;
  }

  /* ─── Après chaque rendu : décor injecté une fois ; pause hors de l'écran et onglet caché ─── */
  let watched = null;
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
    for (const e of es) if (!e.target.isConnected) { io.unobserve(e.target); if (watched === e.target) watched = null; }
    const e = es.filter((x) => x.target === watched).pop();
    if (e) { inView = e.isIntersecting; sync(); }
  }) : null;
  function sync() { const root = document.querySelector(".mh"); if (root) root.dataset.run = running() ? 1 : 0; }
  document.addEventListener("visibilitychange", sync);
  function after() {
    const root = document.querySelector(".mh");
    if (!root) return;
    const svg = root.querySelector(".mh-art");
    if (svg && !svg.firstChild && root.offsetParent && BZ.HERO_ART) svg.innerHTML = BZ.HERO_ART;   // bureau : jamais construit
    if (io && watched !== root) { if (watched) io.unobserve(watched); io.observe((watched = root)); }
    sync();
  }
  const schedule = () => Promise.resolve().then(after);
  // Mêmes conditions que le CSS (hero.css) : la maison existe à l'écran sous 1200 px, sauf téléphone à l'horizontale
  matchMedia("(max-width: 1199px)").addEventListener?.("change", schedule);

  BZ.hero = () => { schedule(); return hero(); };
})();
