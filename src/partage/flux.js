/* ======================================================= FLUX : le relais de S&A-HOME — partagé ===
   Une comète = 6 tirets empilés (46/38/30/22/14/7, opacité .10 → 1) + une lueur floutée, têtes alignées.
   Cycle fixe de 5,6 s : les comètes entrantes arrivent au moyeu à 28,2 %, les sortantes partent à 25,7 %.
   Vitesse croissante avec la puissance : les fenêtres de la référence sont le cas le plus lent (u → 0) ;
   u = √(|kW| / 3) les raccourcit, sans jamais passer sous 0,9 s de trajet.
   Contrat : la page déclare l'élément #hero (pause de ses animations CSS). */
const T_CYCLE = 5600, EASE = 'cubic-bezier(.45,0,.55,1)';
const COUCHES = [[46, .10], [38, .16], [30, .26], [22, .40], [14, .62], [7, 1]];
let T0 = null;
const ANIMS = new Set();
function enregistrer(a) { ANIMS.add(a); a.startTime = T0; return a; }
function annuler(liste) { liste.forEach(a => { a.cancel(); ANIMS.delete(a); }); liste.length = 0; }

const points = d => (d.match(/-?[\d.]+,-?[\d.]+/g) || []).map(q => q.split(',').map(Number));
const cheminDe = pts => 'M' + pts.map(p => p.join(',')).join(' L');
const longueur = pts => pts.slice(1).reduce((a, p, k) => a + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);
/* fenêtre [début, fin] (fraction du cycle) : arrivée au moyeu à 28,2 % (entrantes, 1,58 s → 0,90 s),
   départ à 25,7 % (sortantes, 1,66 s → 0,90 s), puis le câble de la borne de 53,6 à 64,3 % (phase « cab ») ;
   le reste du cycle est le repos de la référence */
function fenetre(phase, u) {
  u = borne(u || 0, 0, 1);
  return phase === 'cab' ? [0.536, 0.643] : phase === 'sor' ? [0.257, 0.554 - 0.137 * u] : [0.122 * u, 0.282];
}
/* images clés du tiret N ; « decal » décale le motif pour un tronçon qui commence plus loin sur le trajet */
function images(N, PL, phase, [a, b], decal = 0) {
  const inv = phase === 'ent inv';
  const o0 = (inv ? -PL - 1 : N + 1) + decal;                    // ±1 : le tiret attend entièrement hors du tracé
  const o1 = (inv ? 47 : N - (PL + 47)) + decal;
  const k = [{ offset: 0, strokeDashoffset: o0 }];
  if (a > 0) k.push({ offset: a, strokeDashoffset: o0 });
  k[k.length - 1].easing = EASE;
  k.push({ offset: b, strokeDashoffset: o1 }, { offset: 1, strokeDashoffset: o1 });
  return k;
}

/* Une comète sur un trajet fait de tronçons ({ d, len }) : la lueur puis les 6 tirets de chaque tronçon, dans g.
   PL : longueur du motif (pathLength du trajet entier) ; gradId : le dégradé du trait. Renvoie les tracés créés
   (_N : longueur du tiret, _decal : début du tronçon sur le trajet, _lueur). */
function construireComete(g, pieces, PL, gradId) {
  const L = pieces.reduce((a, p) => a + p.len, 0), paths = [];
  let decal = 0;
  for (const piece of pieces) {
    const plp = PL * piece.len / L;
    const couches = [['fl-lueur', 14, null], ...COUCHES.map(([N, o]) => ['fl-trait l' + N, N, o])];
    for (const [cls, N, op] of couches) {
      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', piece.d);
      p.setAttribute('pathLength', plp.toFixed(3));
      p.setAttribute('class', cls);
      p.setAttribute('stroke', `url(#${gradId})`);
      p.setAttribute('stroke-dasharray', `${N} ${PL + 300}`);
      p.setAttribute('stroke-dashoffset', String(N + 1 + decal));
      if (op != null) p.style.opacity = op;
      p._N = N; p._decal = decal; p._lueur = op == null;
      g.appendChild(p);
      paths.push(p);
    }
    decal += plp;
  }
  return paths;
}

/* Hors écran, ou onglet caché : tout se met en pause ; au retour, même origine T0 (les flux restent en phase) */
let VISIBLE = true, ECRAN = true;
function synchroPause() {
  const actif = VISIBLE && ECRAN;
  $('hero').classList.toggle('fige', !actif);                    // animations CSS du ciel (étoiles, nuages) : en pause aussi
  for (const a of ANIMS) {
    if (!actif) { if (a.playState === 'running') a.pause(); }
    else if (a.playState === 'paused') a.startTime = T0;
  }
}
