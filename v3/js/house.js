// Breezy HEMS V3 — « Ta maison en direct » : le héros mobile de la page Énergie, et sa version compacte en haut
// de l'Aperçu (BZ.house({ compact: true }) : même dessin et mêmes flux, cadrés plus serré, cinq pastilles).
// Une maquette isométrique façon argile : panneaux sur le toit, batterie dans le jardin, e-Niro sous l'abri
// vitré avec sa borne, poteau et ligne du réseau, ballon d'eau chaude derrière la fenêtre, poêle qui fume.
// Comme le schéma « Flux en direct », tout passe par un nœud central : le coffret électrique (onduleurs et
// tableau) posé sur le mur, sous la gouttière. Le soleil y descend par la gouttière ; il repart vers la maison
// (fenêtre éclairée), la borne de l'e-Niro, et par la goulotte de la façade vers la batterie et le réseau.
// L'énergie circule en points lumineux le long de ces trajets, dans le sens réel : plus la puissance monte,
// plus ils sont nombreux, rapides et lumineux.
// Trois calques superposés :
//  1. le décor (SVG calculé une fois : un rendu de la page ne le touche pas) ;
//  2. les flux (SVG animé par l'API Web Animations : les animations vivent sur les nœuds, BZ.morph ne change
//     que des attributs, donc rien ne redémarre toutes les 5 s ; la vitesse change sans à-coup) ;
//  3. les pastilles (vrais boutons : clavier et lecteur d'écran).
(() => {
  const BZ = window.BZ;
  const { h, esc, fmt, icon, C, num } = BZ;

  /* ─── Projection isométrique 2:1 ────────────────────────────────────
     Monde : x vers la droite-bas, y vers la gauche-bas, z vers le haut (1 unité ≈ 1 m).
     Écran : unités du viewBox. Seules les faces +x, +y et +z sont visibles. */
  const VW = 360, VH = 300, K = 9.1, OX = 150.9, OY = 92;
  const P = (x, y, z = 0) => [OX + (x - y) * K, OY + ((x + y) * K) / 2 - z * K];
  const r1 = (v) => Math.round(v * 10) / 10;
  const xy = (p) => `${r1(p[0])},${r1(p[1])}`;
  const pts = (a) => a.map((p) => xy(P(...p))).join(" ");
  const pg = (cls, a) => `<polygon class="${cls}" points="${pts(a)}"/>`;
  const poly = (a) => "M" + a.map(xy).join("L");   // tracé écran d'une suite de points écran
  // Pavé : ses trois faces visibles (avant-gauche y = y1, avant-droite x = x1, dessus z = z1)
  const box = (cls, [x0, y0, z0], [x1, y1, z1]) =>
    pg(`${cls} fy`, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]) +
    pg(`${cls} fx`, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]) +
    pg(`${cls} fz`, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]);
  // Repères locaux : on dessine à plat sur une face, la matrice projette (rectangles, cercles, dégradés)
  const onY = (y) => `matrix(${K} ${K / 2} 0 ${-K} ${r1(OX - y * K)} ${r1(OY + (y * K) / 2)})`;   // (x, z) sur le plan y
  const onX = (x) => `matrix(${-K} ${K / 2} 0 ${-K} ${r1(OX + x * K)} ${r1(OY + (x * K) / 2)})`;  // (y, z) sur le plan x
  const onZ = (z) => `matrix(${K} ${K / 2} ${-K} ${K / 2} ${OX} ${r1(OY - z * K)})`;              // (x, y) sur le plan z
  const at = (x, y, z) => { const [X, Y] = P(x, y, z); return { x: r1(X), y: r1(Y) }; };

  // Toit à deux pans, faîtage selon y (le pignon regarde l'avant-gauche, les panneaux le soleil à droite)
  const R = { x0: 6, x1: 13, y0: 2, y1: 10.5, wall: 4.4, ridgeX: 9.5, ridgeZ: 7.7, o: 0.45 };
  const run = R.ridgeX - R.x0, rise = R.ridgeZ - R.wall, slope = Math.hypot(run, rise);
  const SC = run / slope, SS = rise / slope;                       // cosinus, sinus de la pente
  const eaveZ = R.wall - R.o * (rise / run), eaveX = R.x1 + R.o;   // bas du pan droit (débord compris)
  // Pan droit : u = distance le long de la pente depuis l'égout, v = y
  const f3 = (v) => +v.toFixed(3);
  const onRoof = (lift = 0) => `matrix(${f3(-SC * K)} ${f3(-(SC / 2 + SS) * K)} ${-K} ${K / 2} ${f3(OX + eaveX * K)} ${f3(OY + (eaveX * K) / 2 - (eaveZ + lift) * K)})`;
  const roofPt = (u, v, lift = 0.08) => [eaveX - u * SC, v, eaveZ + u * SS + lift];

  // Rectangle à coins arrondis (plan z) : [x, y, angle de la normale sortante en degrés], sens horaire depuis l'est
  function rrect(x0, y0, x1, y1, r, n = 6) {
    const out = [], arc = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const d = a0 + (90 * i) / n, a = (d * Math.PI) / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a), d]); } };
    arc(x1 - r, y0 + r, -90); arc(x1 - r, y1 - r, 0); arc(x0 + r, y1 - r, 90); arc(x0 + r, y0 + r, 180);
    return out;
  }

  // Enveloppe convexe de points écran (chaîne monotone) : silhouette de la voiture pour le masque de la verrière
  function hull(pts0) {
    const a = pts0.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]), cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    const lo = [], hi = [];
    for (const p of a) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of a.reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }

  /* ─── Implantation ─────────────────────────────────────────────────── */
  // e-Niro (4,4 × 1,8 m) garée sous l'abri. L'abri est assez bas (2,5 m) et assez large pour qu'aucune pièce
  // de sa structure ne passe devant la voiture à l'écran : poteaux et poutres restent à côté d'elle.
  const CAR = { x0: 15.0, x1: 16.8, y0: 3.7 };
  CAR.y1 = CAR.y0 + 4.45;
  const CP = { x0: 13.5, x1: 20.22, y0: 3.35, y1: 11.35, z: 2.5, px: 19.95 };   // abri : verrière, poteaux en px
  const POLE = [1.4, 12.9], INS = [1.4, 12.05, 7.84], INS2 = [1.4, 13.75, 7.84];   // poteau, isolateurs (traverse selon y)
  const BRK = [6.12, 10.6, 3.95];                   // potelet de la façade (arrivée de la ligne)
  const PORT = [15.9, CAR.y1 + 0.02, 0.66];         // prise de l'e-Niro (dans la calandre)
  const WB = { y0: 9.3, y1: 9.98, z0: 0.98, z1: 1.92 };   // borne murale (mur droit)
  const WBX = [13.27, 9.64, 1.05];                  // sortie du câble de la borne
  // Coffret (onduleurs + tableau) sur le mur droit, sous la gouttière, au-dessus de la borne : le nœud central
  const HUB = { x0: 13, x1: 13.3, y0: 9.12, y1: 10.16, z0: 2.44, z1: 3.32 };
  const HUBF = [13.15, HUB.y1 + 0.01, 2.86], HUBB = [13.15, HUB.y0 - 0.01, 2.62], HUBT = [13.15, 9.65, HUB.z1 + 0.01], HUBD = [13.15, 9.64, HUB.z0 - 0.01];
  const BUSZ = 3.6, RISER = 6.65;                   // goulotte de façade (au-dessus des fenêtres), descente vers la batterie
  const GUT = { x: 13.56, z: 3.95 };                // gouttière (collecte des panneaux)
  const FLUE = [11.0, 1.95, 7.7 - (11.0 - 9.5) * (3.3 / 3.5)];   // pied du conduit du poêle, sur le pan des panneaux
  const ATTIC = [R.ridgeX, R.y1, 5.7];               // œil-de-bœuf du pignon

  /* ─── Trajets de l'énergie (points écran) ─────────────────────────── */
  const bez = (a, c, b, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, s = 1 - t; return [s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]; });
  const line = (...w) => w.map((p) => P(...p));
  // Ligne aérienne : chaînette approchée (flèche au milieu)
  const sag = (a, b, d, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 4 * d * t * (1 - t)]; });
  // La ligne publique arrive de la gauche (direction monde (−1, +1)) et s'arrête juste au-delà du bord du décor :
  // tout le trajet animé est visible, rien ne tourne hors champ
  const edge = (p, d) => P(p[0] - d, p[1] + d, p[2] + 0.2);
  const reach = (p) => (P(...p)[0] + 3) / (2 * K);   // recul (selon x et y) qui amène le point 3 unités hors du cadre
  const wireIn = sag(edge(INS, reach(INS)), P(...INS), 2.4, 8);       // bord → isolateur
  const drop = sag(P(...INS), P(...BRK), 8);                            // isolateur → potelet (branchement)
  const cable = bez(P(...WBX), P(14.7, 9.55, -0.5), P(...PORT));
  // Nœud central → coin de la façade → goulotte, le long du haut du mur avant
  const busPts = [HUBF, [13.02, 10.53, 2.86], [13.02, 10.53, BUSZ]];
  const toBat = [[RISER, 10.53, BUSZ], [RISER, 10.53, 0.08], [RISER, 11.45, 0.06], [4.45, 11.45, 0.1]];
  const toBrk = [[6.3, 10.53, BUSZ], [6.16, 10.58, 3.78]];
  const lanes = [2.88, 6.2, 9.52].map((v) => line(roofPt(4.9, v), roofPt(-0.06, v)));
  const rev = (a) => a.slice().reverse();
  // Chaque trajet : points, puis le morceau qui porte la flèche fixe (mouvement réduit) : [de, à] en indices
  const mk = (a, from, to) => ({ pts: a, seg: [from, to] });
  const gridOutPts = [...line(...busPts, ...toBrk), ...drop.slice().reverse(), ...rev(wireIn).slice(1)];
  const gOut0 = busPts.length + toBrk.length, gOut1 = gOut0 + drop.length - 1;   // morceau potelet → isolateur
  const batInPts = line(...busPts, ...toBat);
  const nb = batInPts.length;
  const ROUTES = {
    sun0: mk(lanes[0], 0, 1), sun1: mk(lanes[1], 0, 1), sun2: mk(lanes[2], 0, 1),
    sun: mk(line([GUT.x, 2.7, GUT.z], [GUT.x, 9.56, GUT.z], [13.4, 9.62, 3.6], HUBT), 0, 1),
    gridOut: mk(gridOutPts, gOut0, gOut1), gridIn: mk(rev(gridOutPts), gridOutPts.length - 1 - gOut1, gridOutPts.length - 1 - gOut0),
    batIn: mk(batInPts, nb - 2, nb - 1), batOut: mk(rev(batInPts), 0, 1),
    car: mk([...line(HUBD, [13.13, 9.64, WB.z1], [13.27, 9.64, 1.6]), ...cable], 3, 3 + cable.length - 1),
    home: mk(line(HUBB, [13.02, 9.05, 2.2], [13.02, 5.1, 2.2]), 1, 2),
  };
  // Teintes : celles du schéma partagé (flow.js) ; la consommation de la maison prend la lumière intérieure (jaune
  // chaud), jamais le rouge de l'achat. Les voies des panneaux brillent par-dessus les cellules (fusion « screen »).
  const LINKS = {
    sun0: { cap: 3, tone: "solar", lane: 1, lag: 0, spd: 0.94 }, sun1: { cap: 3, tone: "solar", lane: 1, lag: 1 / 3, spd: 1.03 }, sun2: { cap: 3, tone: "solar", lane: 1, lag: 2 / 3, spd: 0.98 },
    sun: { cap: 4, tone: "solar" },
    gridIn: { cap: 4, tone: "bad" }, gridOut: { cap: 4, tone: "grid" },
    batIn: { cap: 4, tone: "battery" }, batOut: { cap: 4, tone: "battery" },
    car: { cap: 4, tone: "ev" },
    home: { cap: 3, tone: "light" },
  };
  // Longueur, images clés régulièrement espacées (vitesse constante, fondu aux extrémités), flèche fixe (mouvement réduit)
  for (const [k, L] of Object.entries(LINKS)) {
    const p = (L.pts = ROUTES[k].pts), cum = [0];
    for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    L.len = cum[cum.length - 1];
    const pos = (d) => { let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t]; };
    const n = Math.max(8, Math.round(L.len / 3)), fade = Math.min(0.18, 7 / L.len);
    L.frames = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, [X, Y] = pos(t * L.len);
      return { offset: t, transform: `translate(${X.toFixed(2)}px,${Y.toFixed(2)}px)`, opacity: Math.min(1, t / fade, (1 - t) / fade) };
    });
    const [s0, s1] = ROUTES[k].seg, am = (cum[s0] + cum[s1]) / 2, m = pos(am - 1), m2 = pos(am + 1);
    L.mid = { x: r1((m[0] + m2[0]) / 2), y: r1((m[1] + m2[1]) / 2), a: Math.round((Math.atan2(m2[1] - m[1], m2[0] - m[0]) * 180) / Math.PI) };
    L.d = poly(p);
  }

  /* ─── Décor ─────────────────────────────────────────────────────────
     Les éléments principaux se touchent aussi sur le dessin (hh-tap + data-act, même gestionnaire que le
     reste de l'application) ; au clavier et au lecteur d'écran, ce sont les pastilles qui portent ces actions. */
  let ART = null;
  function art() {
    if (ART) return ART;
    const o = [];
    /* Îlot : dessus en gazon, tranche arrondie (ombrée à gauche, éclairée à droite) */
    const I = { x0: 0, y0: 0, x1: 21, y1: 14.6, r: 1.6, t: 1.4 };
    const ring = rrect(I.x0, I.y0, I.x1, I.y1, I.r);
    // Tranche visible : normales tournées vers l'observateur (entre −45° et 135°)
    const fr = ring.filter(([, , d]) => d >= -45 && d <= 135);
    const top = ring.map(([x, y]) => [x, y, 0]);
    const band = [...fr.map(([x, y]) => [x, y, 0]), ...fr.slice().reverse().map(([x, y]) => [x, y, -I.t])];
    const sx = P(I.x1, I.y1)[0], sr = I.r * K;
    o.push(`<ellipse class="hh-isl-sh" filter="url(#hh-blur6)" cx="${r1(P(I.x1 / 2, I.y1 / 2, -I.t)[0])}" cy="${r1(P(I.x1, I.y1, -I.t)[1] - 6)}" rx="140" ry="15"/>`);
    o.push(`<defs><linearGradient id="hh-side" gradientUnits="userSpaceOnUse" x1="${r1(sx - sr * 1.2)}" x2="${r1(sx + sr * 1.2)}" y1="0" y2="0"><stop offset="0" class="hh-st-sy"/><stop offset="1" class="hh-st-sx"/></linearGradient>
      <linearGradient id="hh-depth" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${r1(P(0, I.y1, 0)[1])}" y2="${r1(P(I.x1, I.y1, -I.t)[1])}"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient></defs>`);
    o.push(pg("hh-isl-side", band), pg("hh-isl-depth", band));
    o.push(pg("hh-isl-lip", [...fr.map(([x, y]) => [x, y, 0]), ...fr.slice().reverse().map(([x, y]) => [x, y, -0.32])]));
    o.push(pg("hh-isl-top", top));
    // Bandes de tonte sur la pelouse (très discrètes)
    o.push(`<g class="hh-mow" transform="${onZ(0)}" clip-path="url(#hh-clip-top)">${[2, 6, 10, 14, 18].map((x) => `<rect x="${x}" y="0" width="2" height="${I.y1}"/>`).join("")}</g>`);
    o.push(`<clipPath id="hh-clip-top"><polygon points="${ring.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ")}"/></clipPath>`);
    // Allée pavée sous l'abri, pas japonais devant la porte, dalle de la batterie
    o.push(`<g transform="${onZ(0.01)}">
      <rect class="hh-drive" x="13.55" y="2.3" width="6.9" height="11.6" rx=".5"/>
      ${[4.1, 5.9, 7.7, 9.5, 11.3, 13.1].map((y) => `<rect class="hh-joint" x="13.55" y="${y}" width="6.9" height=".07"/>`).join("")}
      ${[[7.35, 11.15], [7.6, 12.4], [7.35, 13.65]].map(([x, y]) => `<rect class="hh-step" x="${x}" y="${y}" width="1.35" height=".85" rx=".3"/>`).join("")}
      <rect class="hh-bed" x="9.4" y="10.62" width="3.5" height=".95" rx=".45"/>
    </g>`);

    /* Ombres douces (une seule couche floue), puis ombres de contact de la voiture (posée sur l'allée) */
    o.push(`<g class="hh-shadow" filter="url(#hh-blur)" transform="${onZ(0)}">
      <polygon points="5.2,2.6 13.2,2.6 13.6,10.9 5.2,11.5"/>
      <rect x="${CAR.x0 - 0.4}" y="${CAR.y0 - 0.2}" width="2.6" height="5" rx=".7"/>
      <rect x="2.4" y="10.8" width="2.6" height="1.7" rx=".4"/>
      <circle cx="0.8" cy="4.8" r="1.7"/><circle cx="16.4" cy="1.2" r="1.3"/>
      <rect x="${CP.px - 0.05}" y="${CP.y0 + 0.05}" width=".9" height=".6"/><rect x="${CP.px - 0.05}" y="${CP.y1 - 0.4}" width=".9" height=".6"/>
    </g>`);
    {
      const wy = [CAR.y0 + 0.9, CAR.y0 + 3.7];
      o.push(`<g class="hh-ao" filter="url(#hh-blur1)" transform="${onZ(0.01)}">
        <rect x="${CAR.x0 + 0.08}" y="${CAR.y0 + 0.1}" width="${r1(CAR.x1 - CAR.x0 - 0.16)}" height="${r1(CAR.y1 - CAR.y0 - 0.2)}" rx=".35"/>
        ${wy.map((y) => `<ellipse cx="${CAR.x1 - 0.17}" cy="${y}" rx=".24" ry=".46"/><ellipse cx="${CAR.x0 + 0.17}" cy="${y}" rx=".24" ry=".46"/>`).join("")}
      </g>`);
    }

    /* Arbres du fond */
    const tree = (x, y, z, rr) => {
      const b = P(x, y, 0), c = P(x, y, z);
      return `<g class="hh-tree">
        <rect class="hh-trunk" x="${r1(b[0] - 1.6)}" y="${r1(c[1])}" width="3.2" height="${r1(b[1] - c[1])}" rx="1.4"/>
        <circle class="hh-leaf" cx="${r1(c[0] - rr * 0.42)}" cy="${r1(c[1] + rr * 0.18)}" r="${r1(rr * 0.72)}"/>
        <circle class="hh-leaf" cx="${r1(c[0] + rr * 0.38)}" cy="${r1(c[1] + rr * 0.1)}" r="${r1(rr * 0.78)}"/>
        <circle class="hh-leaf" cx="${r1(c[0])}" cy="${r1(c[1] - rr * 0.38)}" r="${r1(rr * 0.82)}"/>
        <circle class="hh-leaf-hi" cx="${r1(c[0] + rr * 0.3)}" cy="${r1(c[1] - rr * 0.62)}" r="${r1(rr * 0.42)}"/>
      </g>`;
    };
    o.push(tree(1.0, 4.4, 4.8, 15), tree(16.8, 0.9, 4.7, 14));

    /* Maison : mur droit (sous l'abri), puis pignon en façade */
    o.push(pg("hh-wall fx", [[R.x1, R.y0, 0], [R.x1, R.y1, 0], [R.x1, R.y1, R.wall], [R.x1, R.y0, R.wall]]));
    o.push(`<g transform="${onX(R.x1)}">
      <rect class="hh-plinth" x="${R.y0}" y="0" width="${R.y1 - R.y0}" height=".32"/>
      <rect class="hh-frame" x="3.7" y="1.45" width="2.4" height="1.95" rx=".06"/><rect class="hh-win" x="3.84" y="1.58" width="2.12" height="1.69"/>
      <rect class="hh-glow" x="3.84" y="1.58" width="2.12" height="1.69"/>
      <rect class="hh-mull" x="4.86" y="1.58" width=".08" height="1.69"/>
      <rect class="hh-eave-sh" x="${R.y0}" y="3.85" width="${R.y1 - R.y0}" height=".55"/>
    </g>`);
    o.push(pg("hh-wall fy", [[R.x0, R.y1, 0], [R.x1, R.y1, 0], [R.x1, R.y1, R.wall], [R.ridgeX, R.y1, R.ridgeZ], [R.x0, R.y1, R.wall]]));
    o.push(`<g transform="${onY(R.y1)}">
      <rect class="hh-plinth" x="${R.x0}" y="0" width="${R.x1 - R.x0}" height=".32"/>
      <polygon class="hh-eave-sh" points="${R.x0},${R.wall} ${R.ridgeX},${R.ridgeZ} ${R.x1},${R.wall} ${R.x1},${R.wall - 0.5} ${R.ridgeX},${R.ridgeZ - 0.55} ${R.x0},${R.wall - 0.5}"/>
      <rect class="hh-frame" x="7.22" y="0" width="1.56" height="2.78" rx=".05"/>
      <rect class="hh-door" x="7.36" y=".02" width="1.28" height="2.64"/>
      <rect class="hh-win" x="7.56" y="1.25" width=".2" height="1.15"/><rect class="hh-glow" x="7.56" y="1.25" width=".2" height="1.15"/>
      <rect class="hh-handle" x="8.36" y="1.18" width=".07" height=".52"/>
      <circle class="hh-lamp" cx="9.05" cy="2.3" r=".15"/>
      <g class="hh-tap" data-act="open-sheet" data-sheet="ballon">
      <rect class="hh-frame" x="10.18" y=".86" width="2.34" height="2.6" rx=".06"/>
      <rect class="hh-room" x="10.32" y="1" width="2.06" height="2.32"/><rect class="hh-glow" x="10.32" y="1" width="2.06" height="2.32"/>
      <g class="hh-tank">
        <rect class="hh-tank-b" x="10.8" y="1.02" width="1.08" height="2.05" rx=".5" ry=".22"/>
        <rect class="hh-tank-h" x="10.8" y="1.02" width="1.08" height="2.05" rx=".5" ry=".22"/>
        <rect class="hh-tank-l" x="10.95" y="1.5" width=".14" height="1.2" rx=".07"/>
        <path class="hh-pipe" d="M11.15 1.02V.98M11.55 1.02V.98"/>
      </g>
      <polygon class="hh-refl" points="10.32,2.2 11.2,3.32 11.75,3.32 10.32,1.5"/>
      <rect class="hh-sill" x="10.05" y=".72" width="2.6" height=".15"/>
      </g>
      <g class="hh-oculus">
        <circle class="hh-frame" cx="${R.ridgeX}" cy="${ATTIC[2]}" r=".62"/>
        <circle class="hh-room" cx="${R.ridgeX}" cy="${ATTIC[2]}" r=".5"/><circle class="hh-glow-a" cx="${R.ridgeX}" cy="${ATTIC[2]}" r=".5"/>
        <path class="hh-oc-m" d="M${R.ridgeX} ${ATTIC[2] - 0.5}V${ATTIC[2] + 0.5}M${R.ridgeX - 0.5} ${ATTIC[2]}H${R.ridgeX + 0.5}"/>
        <path class="hh-oc-r" d="M${R.ridgeX - 0.38} ${ATTIC[2] + 0.12}A.4 .4 0 0 1 ${R.ridgeX - 0.08} ${ATTIC[2] + 0.38}"/>
        <rect class="hh-sill" x="${R.ridgeX - 0.42}" y="${ATTIC[2] - 0.72}" width=".84" height=".1" rx=".03"/>
      </g>
    </g>`);
    // Auvent de la porte
    o.push(box("hh-canopy", [7.05, R.y1, 2.9], [8.95, R.y1 + 0.75, 3.05]));
    // Lumière des fenêtres sur la pelouse (soir, nuit)
    o.push(`<g class="hh-spill" filter="url(#hh-blur)" transform="${onZ(0.02)}"><ellipse cx="11.3" cy="11.75" rx="1.5" ry=".85"/><ellipse cx="8" cy="11.6" rx=".8" ry=".55"/></g>`);
    // Massif devant la fenêtre
    o.push([[9.9, 11.1, 0.42], [10.9, 11.15, 0.5], [11.9, 11.1, 0.44], [12.7, 11.15, 0.36]].map(([x, y, rr]) => { const c = P(x, y, rr * 0.9); return `<circle class="hh-bush" cx="${r1(c[0])}" cy="${r1(c[1])}" r="${r1(rr * K)}"/>`; }).join(""));

    /* Réseau électrique de la maison : coffret, goulotte de façade, descente vers la batterie, borne */
    // Goulotte : du coffret au coin, puis tout le haut de la façade jusqu'au potelet ; descente le long du mur
    o.push(`<path class="hh-conduit" d="${poly(line(...busPts, [6.3, 10.53, BUSZ], ...toBrk))}"/>`);
    o.push(`<path class="hh-conduit" d="${poly(line([RISER, 10.53, BUSZ], [RISER, 10.53, 0.08]))}"/>`);
    o.push(`<path class="hh-conduit" d="${poly(line(HUBB, [13.02, 9.05, 2.2], [13.02, 6.15, 2.2]))}"/>`);
    o.push(box("hh-metal", [6.02, R.y1, 3.6], [6.2, R.y1 + 0.18, 4.15]));
    // Borne murale (boîtier, anneau lumineux) et liaison au coffret
    o.push(`<path class="hh-conduit" d="${poly(line(HUBD, [13.13, 9.64, WB.z1]))}"/>`);
    o.push(box("hh-wb", [13, WB.y0, WB.z0], [13.26, WB.y1, WB.z1]));
    o.push(`<g transform="${onX(13.27)}"><circle class="hh-wb-ring" cx="${WBX[1]}" cy="1.5" r=".2"/><circle class="hh-wb-led" cx="${WBX[1]}" cy="1.5" r=".09"/></g>`);
    // Coffret : boîtier clair, petit écran et voyant (ambre quand les panneaux produisent)
    o.push(box("hh-hub", [HUB.x0, HUB.y0, HUB.z0], [HUB.x1, HUB.y1, HUB.z1]));
    o.push(`<g transform="${onX(HUB.x1 + 0.01)}"><rect class="hh-hub-d" x="9.28" y="2.84" width=".66" height=".3" rx=".04"/><circle class="hh-hub-led" cx="10.0" cy="2.64" r=".06"/>
      <rect class="hh-hub-v" x="9.28" y="2.56" width=".5" height=".045"/><rect class="hh-hub-v" x="9.28" y="2.66" width=".5" height=".045"/></g>`);
    // Câble rangé (voiture débranchée) : boucle accrochée sous la borne
    o.push(`<path class="hh-cable hh-cable-off" d="M${xy(P(...WBX))}C${xy(P(13.6, 10.3, 0.4))} ${xy(P(13.9, 9.5, 0.25))} ${xy(P(13.3, 9.47, 0.9))}"/>`);

    /* Toit : pan arrière (liseré), pan des panneaux avec le conduit du poêle, rives */
    o.push(pg("hh-roof-b", [[R.ridgeX, R.y0 - R.o, R.ridgeZ], [R.x0 - R.o, R.y0 - R.o, eaveZ], [R.x0 - R.o, R.y1 + R.o, eaveZ], [R.ridgeX, R.y1 + R.o, R.ridgeZ]]));
    o.push(pg("hh-roof", [[R.ridgeX, R.y0 - R.o, R.ridgeZ], [R.ridgeX, R.y1 + R.o, R.ridgeZ], [eaveX, R.y1 + R.o, eaveZ], [eaveX, R.y0 - R.o, eaveZ]]));
    // Conduit inox du poêle à granulés (cylindre : corps dégradé, chapeau conique)
    {
      const fb = P(...FLUE), ft = P(FLUE[0], FLUE[1], FLUE[2] + 1.35), w = 2 * Math.SQRT2 * 0.15 * K, e = w / 4;
      o.push(`<g class="hh-flue"><rect class="hh-flue-b" x="${r1(ft[0] - w / 2)}" y="${r1(ft[1])}" width="${r1(w)}" height="${r1(fb[1] - ft[1])}"/>
        <ellipse class="hh-flue-r" cx="${r1(ft[0])}" cy="${r1(ft[1] + 3)}" rx="${r1(w / 2 + 0.6)}" ry="${r1(e + 0.3)}"/>
        <path class="hh-flue-c" d="M${r1(ft[0] - w / 2 - 2.2)},${r1(ft[1] - 1.4)}L${r1(ft[0])},${r1(ft[1] - 4.6)}L${r1(ft[0] + w / 2 + 2.2)},${r1(ft[1] - 1.4)}Q${r1(ft[0])},${r1(ft[1])} ${r1(ft[0] - w / 2 - 2.2)},${r1(ft[1] - 1.4)}Z"/></g>`);
    }
    // Panneaux : 2 rangées × 5, cadre alu, cellules, reflet
    const cols = [2.08, 3.74, 5.4, 7.06, 8.72], rows = [[0.42, 2.12], [2.66, 2.12]];
    o.push(`<g class="hh-tap" data-act="spot" data-spot="en-sun" transform="${onRoof(0.07)}">
      <rect class="hh-pv-rail" x=".3" y="1.96" width="4.6" height="8.46" rx=".08"/>
      ${rows.map(([u, du]) => cols.map((v) => `<rect class="hh-pv" x="${u}" y="${v}" width="${du}" height="1.56" rx=".05"/>
        <path class="hh-pv-cell" d="M${u + du / 3} ${v}v1.56M${u + (2 * du) / 3} ${v}v1.56M${u} ${v + 0.78}h${du}"/>`).join("")).join("")}
      <rect class="hh-pv-sheen" x=".3" y="1.96" width="4.6" height="8.46"/>
    </g>`);
    o.push(`<path class="hh-ridge" d="M${xy(P(R.ridgeX, R.y0 - R.o, R.ridgeZ + 0.04))}L${xy(P(R.ridgeX, R.y1 + R.o, R.ridgeZ + 0.04))}"/>`);
    o.push(`<g transform="${onX(eaveX)}"><rect class="hh-fascia fx" x="${R.y0 - R.o}" y="${r1((eaveZ - 0.28) * 100) / 100}" width="${R.y1 - R.y0 + 2 * R.o}" height=".28"/></g>`);
    o.push(`<g transform="${onY(R.y1 + R.o)}"><polygon class="hh-fascia fy" points="${R.x0 - R.o},${eaveZ} ${R.ridgeX},${R.ridgeZ} ${eaveX},${eaveZ} ${eaveX},${eaveZ - 0.3} ${R.ridgeX},${R.ridgeZ - 0.32} ${R.x0 - R.o},${eaveZ - 0.3}"/></g>`);
    // Gouttière sous les panneaux : elle recueille les voies du soleil et descend dans le coffret
    o.push(box("hh-gutter", [eaveX, R.y0 - R.o + 0.05, 3.8], [eaveX + 0.2, R.y1 + R.o - 0.05, 3.95]));
    o.push(`<path class="hh-conduit hh-down" d="${poly(line([GUT.x, 9.6, 3.82], [13.4, 9.62, 3.6], HUBT))}"/>`);

    /* Abri vitré : poteaux, borne déjà posée, e-Niro, puis poutres et verrière */
    o.push(box("hh-post", [CP.px, CP.y0 + 0.1, 0], [CP.px + 0.25, CP.y0 + 0.35, CP.z - 0.2]));
    // e-Niro : caisse argile lavande, vitrages sombres, prise lumineuse dans la calandre
    // Silhouette de crossover : caisse haute, capot court, hayon presque vertical, bas de caisse et passages de roue noirs
    const cx0 = CAR.x0, cx1 = CAR.x1, cy0 = CAR.y0, cy1 = CAR.y1, ci0 = 15.13, ci1 = 16.67, Y = (d) => r1((cy0 + d) * 100) / 100;
    const ws = Y(3.42), wt = Y(2.7), rt = Y(0.36), rr = Y(0.16), zb = 0.34, zw = 1.06, zr = 1.68, zh = 0.98, zn = 0.86;
    o.push(`<g class="hh-car hh-tap" data-act="nav" data-to="vehicle">
      ${pg("hh-car-t", [[cx0, cy0, zw], [cx1, cy0, zw], [cx1, rr, zw], [cx0, rr, zw]])}
      ${pg("hh-car-t", [[cx0, rr, zw], [ci0, rr, zw], [ci0, ws, zw], [cx0, ws, zw]])}
      ${pg("hh-car-t", [[ci1, rr, zw], [cx1, rr, zw], [cx1, ws, zw], [ci1, ws, zw]])}
      ${pg("hh-car-x", [[ci1, rr, zw], [ci1, ws, zw], [ci1, wt, zr], [ci1, rt, zr]])}
      <g transform="${onX(ci1)}">
        <polygon class="hh-car-gl" points="${r1(rr + 0.16)},${zw + 0.04} ${r1(ws - 0.12)},${zw + 0.04} ${r1(wt + 0.04)},${zr - 0.07} ${r1(rt + 0.05)},${zr - 0.07}"/>
        <polygon class="hh-car-x" points="${Y(1.68)},${zw} ${Y(1.86)},${zw} ${Y(1.82)},${zr} ${Y(1.66)},${zr}"/>
        <polygon class="hh-car-hi" points="${r1(rt + 0.3)},${zr - 0.1} ${Y(1.4)},${zr - 0.1} ${Y(1.1)},${zw + 0.1} ${r1(rr + 0.45)},${zw + 0.1}"/>
      </g>
      ${pg("hh-car-t", [[ci0, rt, zr], [ci1, rt, zr], [ci1, wt, zr], [ci0, wt, zr]])}
      <path class="hh-car-rail" d="M${xy(P(ci0 + 0.16, rt + 0.1, zr + 0.03))}L${xy(P(ci0 + 0.16, wt - 0.15, zr + 0.03))}M${xy(P(ci1 - 0.16, rt + 0.1, zr + 0.03))}L${xy(P(ci1 - 0.16, wt - 0.15, zr + 0.03))}"/>
      ${pg("hh-car-gl hh-car-ws", [[ci0, ws, zw], [ci1, ws, zw], [ci1, wt, zr], [ci0, wt, zr]])}
      ${pg("hh-car-hi", [[ci0 + 0.25, ws - 0.05, zw + 0.05], [ci0 + 0.75, ws - 0.05, zw + 0.05], [ci0 + 1.05, wt + 0.05, zr - 0.04], [ci0 + 0.55, wt + 0.05, zr - 0.04]])}
      ${pg("hh-car-t", [[cx0, ws, zw], [cx1, ws, zw], [cx1, cy1 - 0.28, zh], [cx0, cy1 - 0.28, zh]])}
      ${pg("hh-car-t2", [[cx0, cy1 - 0.28, zh], [cx1, cy1 - 0.28, zh], [cx1, cy1, zn], [cx0, cy1, zn]])}
      <g transform="${onX(cx1)}">
        <polygon class="hh-car-x" points="${cy0},${zb} ${cy1},${zb} ${cy1},${zn} ${r1(cy1 - 0.28)},${zh} ${ws},${zw} ${cy0},${zw}"/>
        <polygon class="hh-car-clad" points="${cy0},${zb} ${cy1},${zb} ${cy1},${zb + 0.26} ${cy0},${zb + 0.26}"/>
        <path class="hh-car-line" d="M${Y(1.78)} ${zb + 0.22}V${zw - 0.03}M${r1(cy0 + 0.1)} .84H${ws}"/>
        ${[Y(0.9), Y(3.7)].map((y) => `<circle class="hh-arch" cx="${y}" cy=".36" r=".5"/><circle class="hh-tire" cx="${y}" cy=".36" r=".36"/><circle class="hh-rim" cx="${y}" cy=".36" r=".21"/>`).join("")}
        <rect class="hh-tail" x="${cy0}" y=".86" width=".1" height=".14"/>
        <rect class="hh-headx" x="${r1(cy1 - 0.22)}" y=".72" width=".2" height=".08"/>
      </g>
      <g transform="${onY(cy1)}">
        <polygon class="hh-car-y" points="${cx0 + 0.1},${zb} ${cx1 - 0.1},${zb} ${cx1},.48 ${cx1},${zn} ${cx0},${zn} ${cx0},.48"/>
        <rect class="hh-car-clad" x="${cx0 + 0.12}" y="${zb}" width="${r1(cx1 - cx0 - 0.24)}" height=".12" rx=".04"/>
        <rect class="hh-head" x="${cx0 + 0.04}" y=".72" width=".5" height=".07" rx=".035"/><rect class="hh-head" x="${r1(cx1 - 0.54)}" y=".72" width=".5" height=".07" rx=".035"/>
        <rect class="hh-grille" x="${cx0 + 0.45}" y=".4" width="${r1(cx1 - cx0 - 0.9)}" height=".14" rx=".05"/>
        <rect class="hh-port" x="${r1(PORT[0] - 0.16)}" y=".58" width=".32" height=".16" rx=".05"/>
      </g>
    </g>`);
    // Câble branché (recharge)
    o.push(`<path class="hh-cable hh-cable-on" d="${poly(cable)}"/>`);
    // Verrière : seul le verre passe devant la voiture ; il s'efface là où il la couvre (masque tiré de sa
    // silhouette), pour que l'e-Niro reste nette. Poutres et poteau avant restent à côté d'elle, pleins.
    {
      const body = [], cabin = [];
      for (const x of [cx0, cx1]) { for (const y of [cy0, cy1]) body.push(P(x, y, 0.06), P(x, y, zn)); body.push(P(x, cy0, zw), P(x, ws, zw), P(x, cy1 - 0.28, zh)); }
      for (const x of [ci0, ci1]) cabin.push(P(x, rr, zw), P(x, ws, zw), P(x, rt, zr), P(x, wt, zr));
      o.push(`<mask id="hh-carm" maskUnits="userSpaceOnUse" x="0" y="0" width="${VW}" height="${VH}"><rect width="${VW}" height="${VH}" fill="#fff"/>
        <g class="hh-carm" filter="url(#hh-blur1)">${[body, cabin].map((a) => `<polygon points="${hull(a).map(xy).join(" ")}"/>`).join("")}</g></mask>`);
    }
    o.push(box("hh-post", [CP.px, CP.y1 - 0.35, 0], [CP.px + 0.25, CP.y1 - 0.1, CP.z - 0.2]));
    o.push(box("hh-beam", [CP.x0, CP.y0, CP.z - 0.18], [CP.x1, CP.y0 + 0.09, CP.z]));
    o.push(box("hh-beam", [CP.px - 0.02, CP.y0, CP.z - 0.2], [CP.x1, CP.y1, CP.z]));
    o.push(`<g mask="url(#hh-carm)"><g transform="${onZ(CP.z + 0.01)}"><rect class="hh-glass" x="${CP.x0}" y="${CP.y0}" width="${r1(CP.x1 - CP.x0)}" height="${CP.y1 - CP.y0}"/>${[5.35, 7.35, 9.35].map((y) => `<rect class="hh-glass-m" x="${CP.x0}" y="${y}" width="${r1(CP.x1 - CP.x0)}" height=".07"/>`).join("")}
      <polygon class="hh-glass-hi" points="15.4,${CP.y0} 16.5,${CP.y0} 14.6,${CP.y1} ${CP.x0},${CP.y1} ${CP.x0},10.5"/></g></g>`);
    o.push(box("hh-beam", [CP.x0, CP.y1 - 0.09, CP.z - 0.18], [CP.x1, CP.y1, CP.z]));

    /* Batterie (3 modules + boîtier de tête) sur sa dalle, gaine vers la façade */
    o.push(`<path class="hh-duct" d="${poly(line(...toBat.slice(1)))}"/>`);
    o.push(`<g class="hh-tap" data-act="spot" data-spot="en-bat">`);
    o.push(box("hh-pad", [2.72, 10.72, 0], [4.7, 12.2, 0.12]));
    o.push(box("hh-bat-core", [3.1, 11.1, 0.12], [4.3, 11.82, 2.36]));
    [[0.14, 0.8], [0.86, 1.52], [1.58, 2.24]].forEach(([z0, z1]) => o.push(box("hh-bat", [3.0, 11.0, z0], [4.4, 11.9, z1])));
    o.push(box("hh-bat-hub", [2.96, 10.96, 2.3], [4.44, 11.94, 2.7]));
    o.push(`<g transform="${onY(11.94)}"><rect class="hh-bat-led" x="3.25" y="2.48" width=".98" height=".07" rx=".035"/></g>
      <g transform="${onY(11.9)}"><rect class="hh-bat-track" x="4.12" y=".3" width=".12" height="1.82" rx=".06"/></g></g>`);

    /* Réseau : poteau, traverse, isolateurs, coffret du compteur, lignes */
    const ph = P(POLE[0], POLE[1], 0), pt = P(POLE[0], POLE[1], 8.2);
    o.push(`<g class="hh-tap" data-act="spot" data-spot="en-grd"><rect class="hh-hit" x="${r1(ph[0] - 12)}" y="${r1(pt[1])}" width="34" height="${r1(ph[1] - pt[1] + 6)}"/>`);
    o.push(box("hh-meter", [2.1, 13.05, 0], [2.9, 13.55, 1.35]));
    o.push(`<g transform="${onY(13.55)}"><rect class="hh-meter-d" x="2.25" y=".78" width=".5" height=".3" rx=".05"/><circle class="hh-meter-led" cx="2.5" cy=".52" r=".07"/></g>`);
    o.push(`<path class="hh-wire" d="${poly(sag(edge(INS2, reach(INS2)), P(...INS2), 2, 8))}"/>`);
    o.push(box("hh-pole", [POLE[0] - 0.16, POLE[1] - 0.16, 0], [POLE[0] + 0.16, POLE[1] + 0.16, 7.6]));
    o.push(box("hh-pole", [POLE[0] - 0.12, 11.85, 7.38], [POLE[0] + 0.12, 13.95, 7.58]));
    o.push(box("hh-ins", [1.33, INS[1] - 0.07, 7.58], [1.47, INS[1] + 0.07, 7.84]), box("hh-ins", [1.33, INS2[1] - 0.07, 7.58], [1.47, INS2[1] + 0.07, 7.84]), "</g>");
    o.push(`<path class="hh-wire" d="${poly([...wireIn, ...drop.slice(1)])}"/>`);

    /* Buissons du premier plan (ceux du coin avant, hh-bush-f, cèdent la place à l'étiquette « En direct » de l'Aperçu) */
    o.push([[5.2, 13.4, 0.5], [5.85, 13.95, 0.36], [20.55, 12.6, 0.42], [20.3, 13.45, 0.3]].map(([x, y, rr]) => { const c = P(x, y, rr * 0.9); return `<circle class="hh-bush${x > 20 ? " hh-bush-f" : ""}" cx="${r1(c[0])}" cy="${r1(c[1])}" r="${r1(rr * K)}"/>`; }).join(""));

    ART = {
      // Contenu du SVG du décor : injecté une fois après le rendu (voir after()), jamais recomparé par BZ.morph
      inner: `<defs>
          <filter id="hh-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
          <filter id="hh-blur1" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.1"/></filter>
          <filter id="hh-blur6" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="7"/></filter>
          <linearGradient id="hh-pvg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="hh-st-pv1"/><stop offset="1" class="hh-st-pv2"/></linearGradient>
          <linearGradient id="hh-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".18" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".34"/><stop offset=".5" stop-color="#fff" stop-opacity=".1"/><stop offset=".62" stop-color="#fff" stop-opacity=".22"/><stop offset=".8" stop-color="#fff" stop-opacity="0"/></linearGradient>
          <linearGradient id="hh-tankg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="hh-st-t1"/><stop offset=".55" class="hh-st-t2"/><stop offset="1" class="hh-st-t3"/></linearGradient>
          <linearGradient id="hh-heat" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7a3d" stop-opacity=".95"/><stop offset=".6" stop-color="#ffb04a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd27a" stop-opacity=".15"/></linearGradient>
          <linearGradient id="hh-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="hh-st-s1"/><stop offset=".45" class="hh-st-s2"/><stop offset="1" class="hh-st-s3"/></linearGradient>
          <radialGradient id="hh-warm" cx=".42" cy=".4" r=".7"><stop offset="0" stop-color="#fff4d6"/><stop offset=".55" stop-color="#ffd27e"/><stop offset="1" stop-color="#f3a948"/></radialGradient>
          <radialGradient id="hh-leafg" cx=".68" cy=".28" r=".85"><stop offset="0" class="hh-st-l1"/><stop offset="1" class="hh-st-l2"/></radialGradient>
          <linearGradient id="hh-isl" gradientUnits="userSpaceOnUse" x1="${r1(P(I.x1, 0)[0])}" y1="${r1(P(I.x1, 0)[1])}" x2="${r1(P(0, I.y1)[0])}" y2="${r1(P(0, I.y1)[1])}"><stop offset="0" class="hh-st-g1"/><stop offset="1" class="hh-st-g2"/></linearGradient>
        </defs>
        ${o.join("")}`,
    };
    return ART;
  }

  /* ─── Données en direct ─────────────────────────────────────────── */
  const IDLE = BZ.FLOW_IDLE || 15;
  const has = Number.isFinite, pw = (w) => (has(w) ? fmt.powerText(w) : "—");   // capteur indisponible : « — »
  const speed = (w) => BZ.clamp(12 + 19 * Math.sqrt(w / 1000), 12, 58);          // unités du viewBox par seconde
  // Nombre de points visibles : il ne dépend que de la puissance (1 sous 200 W, 2 sous 600 W, 3 sous 1,5 kW, 4 au-delà),
  // jamais de la longueur du trajet : la source principale reste la plus dense, même sur un trajet court
  const TIERS = [200, 600, 1500];
  const tier = (w) => 1 + TIERS.filter((t) => w >= t).length;
  // Avec hystérésis (±20 % autour de chaque seuil) : les variations de quelques watts ne font pas apparaître
  // ni disparaître de points. Un changement d'un seul palier attend un deuxième relevé qui le confirme (au moins
  // 4 s plus tard) ; un grand écart (deux paliers ou plus) s'affiche tout de suite.
  const memo = {};
  function count(k, w, cap) {
    if (!(w >= IDLE)) { delete memo[k]; return 0; }
    const want = Math.min(cap, tier(w)), m = memo[k], now = Date.now();
    if (!m || Math.abs(want - m.n) > 1) { memo[k] = { n: want }; return want; }
    if (m.n >= Math.min(cap, tier(w * 0.8)) && m.n <= Math.min(cap, tier(w * 1.2))) { m.wait = 0; return m.n; }
    if (m.wait === want && now - m.since >= 4000) { m.n = want; m.wait = 0; }
    else if (m.wait !== want) { m.wait = want; m.since = now; }
    return m.n;
  }
  // Six places par trajet, en douzièmes du cycle : chaque palier garde un espacement régulier, et passer de 2 à 4
  // points n'en ajoute que deux (les autres ne bougent pas)
  const SLOTS = [0, 3, 4, 6, 8, 9];
  const VIS = { 1: [0], 2: [0, 6], 3: [0, 4, 8], 4: [0, 3, 6, 9] };
  // Trait et points suivent la puissance (même logique que la largeur des liaisons de flow.js)
  const sat = (w) => BZ.clamp(w / 2500, 0, 1);

  // Jour ou nuit : l'heure qu'il est (lever et coucher du soleil), pas la production. Une matinée grise ou un
  // onduleur en panne gardent un ciel de jour. Entité sun.sun de Home Assistant si elle existe, sinon calcul
  // approché pour la position de la maison (zone.home, sinon le centre de la France).
  function daylight(now = new Date()) {
    const s = BZ.st("sun.sun");
    if (s === "above_horizon" || s === "below_horizon") return s === "above_horizon";
    const z = BZ.ent("zone.home").attributes || {}, lat = +(C.latitude ?? z.latitude ?? 46.6), lon = +(C.longitude ?? z.longitude ?? 2.4), r = Math.PI / 180;
    const N = Math.round((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5);
    const decl = -23.44 * Math.cos((360 / 365) * (N + 10) * r);
    const cosH = (Math.sin(-0.833 * r) - Math.sin(lat * r) * Math.sin(decl * r)) / (Math.cos(lat * r) * Math.cos(decl * r));
    if (cosH <= -1 || cosH >= 1) return cosH <= -1;   // jour ou nuit polaires
    const B = (360 / 365) * (N - 81) * r, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    const noon = 720 - 4 * lon - eot, half = (4 * Math.acos(cosH)) / r;   // minutes UTC
    const d = ((now.getUTCHours() * 60 + now.getUTCMinutes() - noon + 2160) % 1440) - 720;
    return Math.abs(d) < half;
  }

  function state() {
    const L = BZ.live(), N = BZ.flowNodes(L);
    const soc = num(C.batterie_soc), carSoc = num(C.voiture_soc), heat = BZ.isOn(C.ballon_chauffe) || num(C.ballon_boost) === 1;
    const need = L.house + L.car, auto = !has(need) || !has(L.grid) ? NaN : need > 0 ? BZ.clamp(1 - Math.max(0, L.grid) / need, 0, 1) : 1;
    const sunOn = L.solar >= IDLE;
    const on = {
      sun0: L.solar, sun1: L.solar, sun2: L.solar, sun: L.solar,
      gridIn: L.grid > IDLE ? L.grid : 0, gridOut: L.grid < -IDLE ? -L.grid : 0,
      batIn: L.bat > IDLE ? L.bat : 0, batOut: L.bat < -IDLE ? -L.bat : 0,
      car: L.charging && L.car >= IDLE ? L.car : 0,
      home: L.house,
    };
    // D'où vient ce que consomment la maison et la voiture (répartition partagée : flow.js)
    const fed = { sun: 0, bat: 0, grid: 0 };
    for (const r of BZ.flowRoutes(L)) if (r.to === "house" || r.to === "car") fed[r.from] += r.w;
    // Lumière des fenêtres : suit la consommation de la maison
    const glow = has(L.house) ? BZ.clamp(0.25 + Math.max(0, L.house) / 1800, 0.25, 1) : 0.5;
    // Nuit : pas de production ET le soleil est couché. En journée sans production, le ciel reste de jour.
    const night = !sunOn && !daylight();
    return { L, N, T: BZ.today(), soc, carSoc, heat, auto, fed, glow, on, sunOn, carOn: on.car > 0, night, smoke: BZ.st(C.poele) !== "off", temp: num(C.ballon_temp) };
  }

  // Phrase en direct : d'où vient l'énergie consommée, puis l'autonomie (le détail du réseau est sur sa pastille)
  const FROM = { sun: "du soleil", bat: "de la batterie", grid: "du réseau" };
  function summary(S) {
    const { L, fed } = S, tot = fed.sun + fed.bat + fed.grid, known = has(L.solar) && has(L.grid) && has(L.bat);
    const main = ["sun", "bat", "grid"].reduce((a, k) => (fed[k] > fed[a] ? k : a), "sun");
    const rest = known && tot < IDLE;
    const who = !known ? "Mesures en attente" : rest ? "Consommation au repos" : `${fed[main] / tot > 0.95 ? "Tout vient" : "Surtout"} ${FROM[main]}`;
    const tone = !has(S.auto) ? "neutral" : S.auto > 0.95 ? "good" : S.auto > 0.5 ? "warn" : "bad";
    const grid = !has(L.grid) ? "réseau sans mesure" : L.grid < -IDLE ? `tu revends ${pw(-L.grid)}` : L.grid > IDLE ? `tu achètes ${pw(L.grid)}` : "réseau à l'équilibre";
    // wait : aucune mesure en direct (l'étiquette « En direct » de l'Aperçu se met alors en veille)
    return { who, tone, a: has(S.auto) && known && !rest ? `${fmt.n(S.auto * 100)} % autonome` : "", grid, wait: !known };
  }
  // Ce que dit chaque élément, en toutes lettres (description du dessin, détail des pastilles)
  function words(S) {
    const { L } = S, b = L.bat, g = L.grid;
    const soc = (v) => (has(v) ? `à ${fmt.n(v)} %` : "(charge inconnue)");
    // Part du soleil dans la recharge : seulement si les deux mesures (soleil, réseau) de la borne existent
    const evS = Math.max(0, num(C.ve_solaire_w)), evG = Math.max(0, num(C.ve_reseau_w)), share = evS + evG > 0 ? `, ${fmt.n((evS / (evS + evG)) * 100)} % au soleil` : "";
    return {
      sun: !has(L.solar) ? "production inconnue" : S.night ? "pas de production, il fait nuit" : S.sunOn ? `${pw(L.solar)} produits` : "pas de production pour l'instant",
      home: has(L.house) ? `${pw(L.house)} consommés, hors voiture` : "consommation inconnue",
      bat: `${soc(S.soc)}, ${!has(b) ? "puissance inconnue" : Math.abs(b) < IDLE ? "en veille" : `${b > 0 ? "en charge" : "en décharge"} à ${pw(Math.abs(b))}`}`,
      grid: !has(g) ? "échange inconnu" : Math.abs(g) < IDLE ? "à l'équilibre" : `${pw(Math.abs(g))} ${g < 0 ? "revendus" : "achetés"}`,
      car: `${soc(S.carSoc)}, ${S.carOn ? `en charge à ${pw(L.car)}${share}` : L.plugged ? "branchée" : "débranchée"}`,
      boil: `${has(S.temp) ? `à ${fmt.n(S.temp)} °C` : "(température inconnue)"}${S.heat ? ", en chauffe" : ""}`,
    };
  }

  /* ─── Pastilles ─────────────────────────────────────────────────── */
  // at : point d'attache sur le dessin ; pos : point de la pastille où aboutit le repère (unités du viewBox) ;
  // row / side : rangée (haut, bas) et place dans la rangée (l = à gauche, c = au milieu, r = à droite).
  // Libellé visible = début du nom accessible (WCAG 2.5.3), puis le détail et l'action.
  function chips(S, W) {
    // États et teintes : ceux du schéma partagé (flow.js), pour parler comme le reste de l'application
    const { L, N, carOn } = S, g = L.grid, b = L.bat, batIdle = !(Math.abs(b) >= IDLE), gridIdle = !(Math.abs(g) >= IDLE);
    const batV = !has(b) ? "—" : batIdle ? N.bat.state : `${b > 0 ? "+" : "−"}${pw(Math.abs(b))}`;
    const gridV = !has(g) ? "—" : gridIdle ? N.grid.state : `${g < 0 ? "−" : "+"}${pw(Math.abs(g))}`;
    const carV = carOn ? pw(L.car) : L.charging ? "Branchée" : N.car.note;   // en charge sans puissance : simplement branchée
    const sunV = !has(L.solar) ? "—" : S.night ? "Nuit" : pw(L.solar);
    const boilV = has(S.temp) ? `${fmt.n(S.temp)} °C` : S.heat ? "En chauffe" : "—";
    const pc = (v) => (has(v) ? `${fmt.n(v)} %` : "");
    return [
      { k: "grid", tone: N.grid.tone, ic: N.grid.ic, l: N.grid.label, v: gridV, sub: gridIdle || !has(g) ? "" : N.grid.state.toLowerCase(), idle: gridIdle, at: at(...INS), pos: [12, 12], side: "l",
        act: "spot", spot: "en-grd", say: !has(g) || !gridIdle ? W.grid : "", go: "Afficher la carte Réseau" },
      { k: "home", tone: "accent", ic: N.home.ic, l: N.home.label, v: pw(L.house), idle: !has(L.house), at: at(ATTIC[0], ATTIC[1], ATTIC[2] + 0.64), pos: [190, 12], side: "c",
        act: "nav", to: "insights", say: has(L.house) ? "consommés hors voiture" : "consommation inconnue", go: "Voir le bilan" },
      { k: "sun", tone: N.sun.tone, ic: N.sun.ic, l: N.sun.label, v: sunV, idle: !S.sunOn, at: at(...roofPt(2.7, 4.55)), pos: [348, 12], side: "r",
        act: "spot", spot: "en-sun", say: S.sunOn ? "produits par les panneaux" : W.sun, go: "Afficher la production solaire" },
      { k: "bat", tone: N.bat.tone, ic: N.bat.ic, l: N.bat.label, x: pc(S.soc), v: batV, idle: batIdle, at: at(3.7, 11.94, 2.7), pos: [12, 250], side: "l",
        act: "spot", spot: "en-bat", say: !has(S.soc) ? "charge inconnue" : !has(b) || batIdle ? "" : b > 0 ? "en charge" : "en décharge", go: "Afficher la carte Batterie" },
      { k: "boil", tone: "heat", ic: S.heat ? "flame" : "drop", l: "Ballon", v: boilV, sub: S.heat && has(S.temp) ? "chauffe" : "", idle: !S.heat, at: at(11.35, R.y1, 0.8), pos: [184, 250], side: "c",
        act: "open-sheet", sheet: "ballon", say: has(S.temp) ? "" : "température inconnue", go: "Ouvrir le ballon" },
      { k: "car", tone: N.car.tone, ic: N.car.ic, l: N.car.label, x: pc(S.carSoc), v: carV, idle: !carOn, at: at(16.5, CAR.y0 + 0.5, 1.7), pos: [348, 250], side: "r",
        act: "nav", to: "vehicle", say: carOn ? "en charge" : !has(S.carSoc) ? "charge inconnue" : "", go: "Ouvrir la page Voiture" },
    ];
  }

  /* ─── Cadrages ──────────────────────────────────────────────────────
     Énergie : le dessin entier, pastilles en deux rangées de trois (positions pos ci-dessus).
     Aperçu (compact) : le même dessin vu d'un peu plus loin (marges sur les côtés, ciel et pied de l'îlot
     rognés), une scène bien moins haute ; les pastilles se posent dans les coins, à quelques pixels du bord.
     Le ballon n'y figure pas (pas un flux électrique de la maison ; il garde sa pastille sur Énergie). */
  const FRAMES = { full: { x: 0, y: 0, w: VW, h: VH }, compact: { x: -28, y: 26, w: 416, h: 258 } };
  // Aperçu : chaque pastille mène à sa carte de la page Énergie (atteinte puis signalée), au bilan ou à la voiture
  const OVER = { grid: ["energy", "en-grd", "Voir le réseau sur la page Énergie"], sun: ["energy", "en-sun", "Voir la production sur la page Énergie"],
    bat: ["energy", "en-bat", "Voir la batterie sur la page Énergie"] };
  // Pastilles de l'Aperçu : ce qui circule en ce moment, sans la charge (%) de la batterie et de la voiture, que la
  // carte Réserves de la même page affiche déjà (pas de doublon) ; le nom du lien de la maison la dit toujours.
  function compactChips(S, W) {
    const b = S.L.bat;
    return chips(S, W).filter((c) => c.k !== "boil").map((c) => {
      const o = OVER[c.k] ? { ...c, act: "nav", to: OVER[c.k][0], spot: OVER[c.k][1], go: OVER[c.k][2] } : { ...c };
      if (c.k === "bat") Object.assign(o, { x: "", say: !has(b) ? "puissance inconnue" : c.idle ? "" : b > 0 ? "en charge" : "en décharge" });
      if (c.k === "car") Object.assign(o, { x: "", say: S.carOn ? "en charge" : "" });
      return o;
    });
  }
  // Arrivée du repère d'une pastille (unités du viewBox), cachée sous la pastille
  function leadEnd(c, top, F, cp) {
    if (!cp) return { x: c.pos[0] + (c.side === "l" ? 16 : c.side === "r" ? -16 : 0), y: c.pos[1] + 20 };
    const k = F.w / 358;   // unités par pixel sur une scène de 358 px (téléphone de 390 px) ; ailleurs l'écart reste sous la pastille
    return { x: c.side === "l" ? F.x + 30 * k : c.side === "r" ? F.x + F.w - 30 * k : F.x + F.w / 2, y: top ? F.y + 24 * k : F.y + F.h - 24 * k };
  }

  /* ─── Rendu ─────────────────────────────────────────────────────── */
  function house({ compact: cp = false } = {}) {
    const S = state(), sum = summary(S), W = words(S), F = FRAMES[cp ? "compact" : "full"], vb = `${F.x} ${F.y} ${F.w} ${F.h}`;
    const CH = cp ? compactChips(S, W) : chips(S, W);
    // Flux : pour chaque trajet, 6 points (data-key stable) ; les inactifs restent dans le DOM, masqués
    const links = Object.entries(LINKS).map(([k, Ln]) => {
      // Capteur indisponible : trajet tracé comme au repos (jamais de NaN dans les attributs)
      const w = has(S.on[k]) ? S.on[k] : 0, live = w >= IDLE, n = count(k, Ln.lane ? w / 3 : w, Ln.cap), vis = VIS[n] || [];
      const s = sat(Ln.lane ? w / 2 : w), rh = (4.6 + 2.2 * s).toFixed(1), rc = (1.6 + 0.6 * s).toFixed(2), rw = (0.7 + 0.25 * s).toFixed(2);
      const style = `--tw:${(Ln.lane ? 1.3 + 0.5 * s : 1.2 + 2.2 * s).toFixed(2)};--to:${(Ln.lane ? 0.3 + 0.12 * s : 0.12 + 0.3 * s).toFixed(2)}`;
      return h`<g class="hh-ln ${Ln.lane ? "is-lane" : ""}" data-l="${k}" data-tone="${Ln.tone}" data-on="${live ? 1 : 0}" data-n="${n}" data-rate="${live ? ((speed(w) / V0) * (Ln.spd || 1)).toFixed(2) : 0}" style="${style}">
        <radialGradient id="hh-hg-${k}"><stop offset="0" class="hh-hg0"/><stop offset=".42" class="hh-hg1"/><stop offset="1" class="hh-hg2"/></radialGradient>
        <path class="hh-trail" d="${Ln.d}"/>
        ${SLOTS.map((sl) => h`<g class="hh-dot" data-key="${k}-${sl}" data-s="${sl}" data-v="${vis.includes(sl) ? 1 : 0}"><g class="hh-dm"><circle class="hh-dh" r="${rh}" fill="url(#hh-hg-${k})"/><circle class="hh-dc" r="${rc}"/><circle class="hh-dw" r="${rw}"/></g></g>`)}
        <path class="hh-arrow" d="M-3.2,-3.4L1.2,0L-3.2,3.4" transform="translate(${Ln.mid.x} ${Ln.mid.y}) rotate(${Ln.mid.a})"/>
      </g>`;
    });
    // Calque animé : fumée du poêle, niveau de la batterie, flux, repères des pastilles
    const chim = at(FLUE[0], FLUE[1], FLUE[2] + 1.45);
    const fx = h`<svg class="hh-fx" viewBox="${vb}" aria-hidden="true" focusable="false">
      <defs><radialGradient id="hh-puff"><stop offset="0" class="hh-st-p1"/><stop offset=".55" class="hh-st-p2"/><stop offset="1" class="hh-st-p3"/></radialGradient></defs>
      <g class="hh-smoke">${[0, 1, 2].map((i) => h`<ellipse style="--i:${i}" cx="${chim.x}" cy="${chim.y}" rx="4.6" ry="2.6"/>`)}</g>
      <g transform="${onY(11.9)}"><rect class="hh-bat-soc" x="4.12" y=".3" width=".12" height="${((1.82 * BZ.clamp(has(S.soc) ? S.soc : 0, 0, 100)) / 100).toFixed(3)}" rx=".06"/></g>
      <g class="hh-links">${links}</g>
      <g class="hh-leads">${CH.map((c, i) => {
        const end = leadEnd(c, i < 3, F, cp), r = (v) => Math.round(v * 10) / 10;
        return h`<g data-tone="${c.tone}" class="${c.idle ? "is-idle" : ""}"><path d="M${c.at.x},${c.at.y}L${r(end.x)},${r(end.y)}"/><circle cx="${c.at.x}" cy="${c.at.y}" r="2.3"/></g>`;
      })}</g>
    </svg>`;
    const label = `Ta maison en direct : ${sum.who.toLowerCase()}${sum.a ? `, ${sum.a}` : ""}. Soleil : ${W.sun} ; maison : ${W.home} ; batterie ${W.bat} ; réseau : ${W.grid} ; e-Niro ${W.car} ; ballon ${W.boil}.`;
    const flags = `data-run="${running() ? 1 : 0}" style="--glow:${S.glow.toFixed(2)}" data-sky="${S.night ? "night" : "day"}" data-sun="${S.sunOn ? 1 : 0}" data-heat="${S.heat ? 1 : 0}" data-smoke="${S.smoke ? 1 : 0}" data-car="${S.carOn ? "charging" : S.L.plugged ? "plugged" : "off"}" data-bat="${!(Math.abs(S.L.bat) >= IDLE) ? "idle" : S.L.bat > 0 ? "in" : "out"}"`;
    const chip = (c) => {
      const attrs = c.act === "nav" ? `href="${BZ.href(c.to)}" ${c.spot ? `data-spot="${c.spot}"` : ""}` : `type="button" data-act="${c.act}" ${c.spot ? `data-spot="${c.spot}"` : ""} ${c.sheet ? `data-sheet="${c.sheet}"` : ""}`;
      const tag = c.act === "nav" ? "a" : "button";
      const seen = `${c.l}${c.x ? ` ${c.x}` : ""} ${c.v}${c.sub ? ` ${c.sub}` : ""}`;
      return h`<${tag} class="hh-chip hh-c-${c.k} is-${c.side} ${c.x ? "has-x" : ""} ${c.idle ? "is-idle" : ""}" data-tone="${c.tone}" ${attrs} aria-label="${esc(`${seen}${c.say ? `, ${c.say}` : ""}. ${c.go}`)}">
        <span class="hh-cl">${icon(c.ic)}<span class="hh-cn">${c.l}</span>${c.x ? h`<span class="hh-cx">${c.x}</span>` : ""}</span><b class="hh-cv">${c.v}${c.sub ? h`<small> ${c.sub}</small>` : ""}</b></${tag}>`;
    };
    const say = h`<span class="hh-say"><b class="hh-who">${sum.who}</b>${sum.a ? h` <span class="hh-auto">· ${sum.a}</span>` : ""}</span>`;
    // Aperçu : toute la carte mène à la page Énergie. Le lien, de la taille de la carte, passe sous le dessin et les
    // pastilles (jamais de lien dans un lien) ; sa description en toutes lettres devient son nom, la phrase visible la
    // répète, on la tait. Sans aucune mesure, l'étiquette « En direct » se met en veille (point gris immobile).
    return h`<section class="hh ${cp ? "is-compact" : ""}" ${flags} aria-labelledby="hh-t">
      <h2 class="sr" id="hh-t">Ta maison en direct</h2>
      ${cp ? h`<a class="hh-go" href="${BZ.href("energy")}" aria-label="${esc(`${label} Voir le détail sur la page Énergie.`)}"></a>` : ""}
      <div class="hh-stage">
        <div class="hh-sky" aria-hidden="true"><i class="hh-sun"></i><i class="hh-moon"></i><i class="hh-stars"></i></div>
        <div class="hh-scene">
          <div class="hh-img" ${cp ? 'aria-hidden="true"' : `role="img" aria-label="${esc(label)}"`}><svg class="hh-art" data-static="${cp ? "hh-art-c" : "hh-art"}" viewBox="${vb}" aria-hidden="true" focusable="false"></svg></div>
          ${fx}
        </div>
        <div class="hh-chips" role="group" aria-label="Détail par appareil">
          <div class="hh-row is-top">${CH.slice(0, 3).map(chip)}</div>
          <div class="hh-row is-bot">${cp ? [chip(CH[3]), h`<span class="hh-live ${sum.wait ? "is-idle" : ""}" aria-hidden="true"><i class="hh-ping"></i>En direct</span>`, chip(CH[4])] : CH.slice(3).map(chip)}</div>
        </div>
      </div>
      ${cp ? h`<div class="hh-sum" aria-hidden="true">
        <p class="hh-now" data-tone="${sum.tone}">${say}</p>
      </div>` : h`<div class="hh-sum">
        <p class="hh-now" data-tone="${sum.tone}"><i class="hh-ping"></i>${say}</p>
        ${has(S.T.prod) ? h`<p class="hh-day">Aujourd'hui · <b>${fmt.kwhText(S.T.prod)}</b> produits${has(S.T.savings) ? h`<span class="hh-day-e"> · <b>${fmt.eur(S.T.savings)}</b> économisés</span>` : ""}</p>` : ""}
      </div>`}
    </section>`;
  }

  /* ─── Après chaque rendu ──────────────────────────────────────────────
     1. Décor : injecté une seule fois dans son SVG vide (data-static : BZ.morph ne le compare plus).
     2. Points : crée l'animation des nouveaux, ajuste la vitesse des autres (updatePlaybackRate garde
        la position). Mouvement réduit : aucune animation, des flèches fixes. */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const V0 = 20;   // vitesse de référence (unités du viewBox par seconde) pour playbackRate = 1
  // Maison hors de l'écran (page défilée) ou onglet caché : toutes les animations en pause, reprises telles quelles.
  // L'état passe aussi dans le gabarit (data-run) pour que BZ.morph ne l'efface pas ; il fige la fumée en CSS.
  // Une seule maison par page (Aperçu ou Énergie) : en changeant de page, l'observateur passe à la nouvelle ;
  // une maison retirée du document (page sans maison) n'est plus observée ni retenue.
  let inView = true, watched = null;
  const running = () => inView && !document.hidden;
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
    for (const e of es) if (!e.target.isConnected) { io.unobserve(e.target); if (watched === e.target) watched = null; }
    const e = es.filter((x) => x.target === watched).pop();
    if (e) inView = e.isIntersecting;
    sync();
  }) : null;
  function sync() {
    const root = document.querySelector(".hh");
    if (!root) return;
    root.dataset.run = running() ? 1 : 0;
    animate(root);
  }
  document.addEventListener("visibilitychange", sync);
  function after() {
    const root = document.querySelector(".hh");
    if (!root) return;
    const svg = root.querySelector(".hh-art");
    if (svg && !svg.firstChild && root.offsetParent) svg.innerHTML = art().inner;   // tablette, bureau : jamais construit
    if (io && watched !== root) { if (watched) io.unobserve(watched); io.observe((watched = root)); }
    animate(root);
  }
  const pauseAll = (root) => root.querySelectorAll(".hh-dm").forEach((m) => { if (m._a && m._a.playState !== "paused") m._a.pause(); });
  function animate(root) {
    if (!root || reduce.matches || !Element.prototype.animate) return;
    // Maison masquée (tablette, bureau, téléphone à l'horizontale) : rien ne tourne pour rien
    if (!root.offsetParent) { pauseAll(root); return; }
    const go = running();
    root.querySelectorAll(".hh-ln").forEach((g) => {
      const Ln = LINKS[g.dataset.l], on = g.dataset.on === "1", rate = +g.dataset.rate || 1, dur = (Ln.len / V0) * 1000;
      const dots = [...g.querySelectorAll(".hh-dm")], slot = (m) => +m.parentNode.dataset.s / 12;
      dots.forEach((m) => {
        if (!m._a) {
          // Voies des panneaux décalées d'un tiers d'espacement l'une par rapport à l'autre (et vitesses
          // légèrement différentes) : les points scintillent au lieu de défiler en rangs
          const lag = (Ln.lag || 0) / Math.max(1, +g.dataset.n || 1);
          m._a = m.animate(Ln.frames, { duration: dur, iterations: Infinity, easing: "linear" });
          m._a.currentTime = ((slot(m) + lag) % 1) * dur;
          m._r = 1;
        }
        if (m._r !== rate) { m._r = rate; m._a.updatePlaybackRate ? m._a.updatePlaybackRate(rate) : (m._a.playbackRate = rate); }
      });
      // Points masqués : animation en pause (rien à calculer). À la reprise, chacun se recale sur le point de la
      // place 0 (toujours visible quand le trajet est actif), pour rester régulièrement espacés.
      const ref = dots[0]._a;
      dots.forEach((m, i) => {
        const show = go && on && m.parentNode.dataset.v === "1";
        if (!show && m._a.playState !== "paused") m._a.pause();
        else if (show && m._a.playState === "paused") {
          if (i && ref.playState !== "paused") m._a.currentTime = ref.currentTime + slot(m) * dur;   // au retour à l'écran, la place 0 repart en premier
          m._a.play();
        }
      });
    });
  }
  const schedule = () => Promise.resolve().then(after);
  reduce.addEventListener?.("change", () => { document.querySelectorAll(".hh-dm").forEach((m) => { if (m._a) { m._a.cancel(); m._a = null; } }); after(); });
  // Mêmes conditions que le CSS (house.css) : la maison n'existe à l'écran que sur un téléphone tenu droit
  matchMedia("(max-width: 767px) and (min-height: 501px), (max-width: 767px) and (orientation: portrait)").addEventListener?.("change", schedule);

  BZ.house = (...a) => { schedule(); return house(...a); };
})();
