/* ════════════════════════════════════════════════════════════ CIEL — partagé par toutes les pages ═══
   Couleurs OKLab, ciel par hauteur du soleil (sun.sun) et météo (weather.*), encre du texte posé sur le ciel, astre,
   étoiles, nuages. Contrat : la page déclare MEMO (objet), CADRE / SCENE, et les éléments #hero, #ciel, #ciel-a, #ciel-b,
   #astre, #nuages, #pluie, #etoiles. Le cadre C (cadrer() de la page) fournit : mode, W, H, s, hx, gx, bB, yh (ligne
   d'horizon, px), silhouette(x) (haut de l'objet posé au sol, px ; Infinity hors de lui), lune ([x, y], grand écran),
   texte ([y0, y1]), obstacles, verre (la carte en verre dépoli) et bilanZone ([y0, y1] de cette carte sur la scène). */

/* ------------------------------------------------------------ Couleurs (OKLab) -- */
const RAD = Math.PI / 180;
const lireOklch = s => { const [L, C, h] = s.trim().split(/\s+/).map(Number); return [L, C * Math.cos(h * RAD), C * Math.sin(h * RAD)]; };
const versRgbLin = ([L, a, b]) => {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
};
const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const depuisHex = hex => {
  const n = parseInt(hex.slice(1), 16), r = lin((n >> 16 & 255) / 255), g = lin((n >> 8 & 255) / 255), b = lin((n & 255) / 255);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
};
const cssLab = ([L, a, b]) => `oklab(${L.toFixed(4)} ${a.toFixed(4)} ${b.toFixed(4)})`;
const melangeLab = (A, B, t) => A.map((x, k) => x + (B[k] - x) * t);
const lisser = (a, b, x) => { const t = borne((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const luminanceLab = lab => { const [r, g, b] = versRgbLin(lab).map(v => borne(v, 0, 1)); return .2126 * r + .7152 * g + .0722 * b; };
const contraste = (y1, y2) => (Math.max(y1, y2) + .05) / (Math.min(y1, y2) + .05);
const chroma = ([L, a, b], k, dL = 0) => [L + dL, a * k, b * k];
function interCles(cles, E, n) {
  if (E <= cles[0][0]) return cles[0][n];
  for (let k = 1; k < cles.length; k++) if (E <= cles[k][0]) return melangeLab(cles[k - 1][n], cles[k][n], lisser(cles[k - 1][0], cles[k][0], E));
  return cles[cles.length - 1][n];
}

/* Ciel : clés par élévation du soleil E (°) — haut, milieu, horizon, sol. Matin et soir ne diffèrent qu'autour de l'horizon. */
const K = s => lireOklch(s);
const CIEL = {
  nuit:  [-12, K('.165 .016 262'), K('.205 .02 262'), K('.235 .016 260'), K('.20 .012 262')],
  crep:  [-4,  K('.30 .05 275'), K('.42 .07 315'), K('.62 .10 45'), K('.26 .02 270')],
  clair: {
    soir:  [4,  K('.80 .05 265'), K('.89 .05 40'), K('.94 .06 70'), K('.88 .02 60')],
    matin: [4,  K('.82 .045 275'), K('.90 .045 10'), K('.95 .045 75'), K('.89 .015 60')],
    k14:   [14, K('.84 .05 248'), K('.92 .035 230'), K('.955 .02 80'), K('.92 .012 78')],
    jour:  [20, K('.86 .055 240'), K('.93 .035 220'), K('.96 .012 85'), K('.93 .01 80')]
  },
  sombre: {
    soir:  [4,  K('.26 .05 270'), K('.34 .06 330'), K('.50 .09 55'), K('.22 .015 270')],
    matin: [4,  K('.27 .045 275'), K('.36 .05 350'), K('.50 .07 60'), K('.22 .015 270')],
    jour:  [20, K('.30 .055 245'), K('.37 .05 232'), K('.45 .03 80'), K('.24 .012 250')]
  }
};
function clesCiel(sombre, matin) {
  const T = sombre ? CIEL.sombre : CIEL.clair, k4 = matin ? T.matin : T.soir;
  const k14 = sombre ? [14, ...[1, 2, 3, 4].map(n => melangeLab(k4[n], T.jour[n], .66))] : T.k14;
  return [CIEL.nuit, CIEL.crep, k4, k14, T.jour];
}
/* Voile posé sur l'objet de la scène, maison ou voiture (multiplication) : blanc = aucun effet */
const VOILE = {
  clair:  [[-12, depuisHex('#262b49')], [-4, depuisHex('#55557f')], [4, depuisHex('#d9d3d8')], [12, depuisHex('#ffffff')]],
  sombre: [[-12, depuisHex('#262b49')], [-4, depuisHex('#55557f')], [4, depuisHex('#a2a3b9')], [12, depuisHex('#c4c9d6')]]
};

/* ------------------------------------------------ Position du soleil ---
   Formules astronomiques simplifiées (≈ 0,5°), suffisantes pour peindre le ciel.
   Avec Home Assistant, l’attribut elevation de sun.sun est utilisé tel quel ; ceci ne sert qu’à défaut (et aux valeurs d’exemple). */
function positionSoleil(date, lat, lon) {
  const d = date.getTime() / 86400000 - 10957.5;
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(eps) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  const H = (gmst * 15 + lon) * RAD - ra, phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  return { elevation: alt / RAD };
}

/* météo de Home Assistant → ciel de la scène */
const METEO = { sunny: 'clair', 'clear-night': 'clair', partlycloudy: 'nuageux', windy: 'nuageux', 'windy-variant': 'nuageux', cloudy: 'couvert', exceptional: 'couvert', fog: 'voile',
  rainy: 'pluie', pouring: 'pluie', snowy: 'pluie', 'snowy-rainy': 'pluie', hail: 'pluie', lightning: 'orage', 'lightning-rainy': 'orage' };
/* halo derrière l'objet de la scène (contre-jour), par moment du jour : couleur, opacité */
const HALO = { doree: ['#ffaa60', .35], aube: ['#ffaa60', .35], crepuscule: ['#8a8fff', .34], nuit: ['#7d93ff', .36] };

/* Le ciel d'une scène (la partie « ciel » de rendreScene) : dégradé par élévation et météo, encre, astre, nuages, pluie.
   d : { E, matin, ciel } ; C : le cadre courant (null au premier rendu). Renvoie 'clair' ou 'sombre' (ciel derrière l'objet). */
function peindreCiel(d, C) {
  const sombre = themeSombre();
  const hero = $('hero');
  // --- ciel : interpolation OKLab par élévation (sun.sun), puis météo (weather.*)
  const cles = clesCiel(sombre, d.matin);
  let teintes = [1, 2, 3, 4].map(n => interCles(cles, d.E, n));
  const meteo = d.ciel;
  const mod = { clair: [1, 0], voile: [.8, 0], nuageux: [.75, 0], couvert: [.35, sombre ? -.02 : -.04], pluie: [.35, sombre ? -.04 : -.06], orage: [.35, sombre ? -.08 : -.10] }[meteo] || [1, 0];
  teintes = teintes.map(t => chroma(t, mod[0], mod[1]));
  const [haut, milieu] = teintes;
  // ciel sombre ou clair (ombres du dessin) ; l'encre du texte, elle, est choisie par encrerCiel() sur le ciel réellement derrière le texte
  const yH = luminanceLab(haut), yM = luminanceLab(milieu), yN = luminanceLab(ENCRE.sombre), yB = luminanceLab(ENCRE.claire);
  const ciel = Math.min(contraste(yN, yH), contraste(yN, yM)) >= Math.min(contraste(yB, yH), contraste(yB, yM)) ? 'clair' : 'sombre';
  if (!C) hero.dataset.ciel = ciel;
  MEMO.teintes = teintes; MEMO.fonduCiel = true;
  encrerCiel(C);
  // --- astre : soleil (E ≥ −1), lune (E < −4)
  const astre = $('astre');
  const soleilVu = d.E >= -1, luneVue = d.E < -4;
  const voile = { voile: .75, couvert: .3 }[meteo] ?? 1;
  const cache = meteo === 'pluie' || meteo === 'orage';
  astre.classList.toggle('lune', !soleilVu && luneVue);
  astre.style.opacity = (soleilVu || luneVue) && !cache ? String(soleilVu ? voile : 1) : '0';
  const cA = melangeLab(lireOklch('.80 .14 60'), lireOklch('.86 .15 85'), lisser(3, 18, d.E));
  astre.style.setProperty('--astre', cssLab(cA));
  // --- nuages et pluie
  const nb = { voile: 2, nuageux: 3, couvert: 5, pluie: 5, orage: 5 }[meteo] || 0;
  const nuages = $('nuages');
  nuages.dataset.n = nb; nuages.dataset.meteo = meteo;
  nuages.classList.toggle('derive', nb > 0 && !immobile());
  const nuit = d.E < -4;
  nuages.style.setProperty('--nuage', meteo === 'voile' ? 'oklch(1 0 0 / .35)' : meteo === 'orage' ? 'oklch(.36 .012 260 / .8)' : nuit ? 'oklch(.3 .01 260 / .6)' : meteo === 'nuageux' ? 'oklch(1 0 0 / .7)' : 'oklch(.93 .005 260 / .8)');
  $('pluie').hidden = !(meteo === 'pluie' || meteo === 'orage');
  $('pluie').classList.toggle('anim', !immobile());
  return ciel;
}

/* ------------------------------------------------ Encre du héros et voile de lecture ---
   Le texte du héros (marque, menu, chiffre, phrase) est posé sur le ciel. On échantillonne le dégradé réellement
   derrière lui (de la barre au bas de la phrase), on choisit l'encre, sombre ou claire, qui demande le moins d'aide,
   puis, si elle reste sous 4,5:1 (autour de l'aube et du crépuscule, ciel mauve), on pose en haut du ciel un voile
   de sa propre teinte, plus clair ou plus sombre, juste assez opaque pour l'atteindre. L'encre secondaire
   (intitulé, unité, menu) se rapproche de l'encre principale tant qu'elle n'atteint pas 4,5:1.
   La carte en verre (C.verre : le bilan, la charge), quand elle chevauche une scène sombre ou intermédiaire en thème clair,
   passe en surface pleine ou en verre sombre. */
const ENCRE = { sombre: lireOklch('.22 .012 260'), claire: lireOklch('.97 .004 260') };
const CIBLE = 4.6;
const versSrgb = lab => versRgbLin(lab).map(v => { v = borne(v, 0, 1); return v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - .055; });
const lumSrgb = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
function encrerCiel(C) {
  const T = MEMO.teintes;
  if (!T) return;
  const hero = $('hero'), sombreTheme = themeSombre();
  const [haut, milieu, horizon, sol] = T;
  const H = C?.H || hero.clientHeight || 600, yh = C ? C.yh : H * .6;
  const [y0, y1] = C?.texte || [0, yh * .45];
  // le dégradé CSS du ciel (interpolé en sRGB, comme le navigateur)
  const arrets = [[0, haut], [yh * .45, milieu], [yh, horizon], [yh + 24, sol], [H, chroma(sol, 1, -.015)]].map(([y, c]) => [y, versSrgb(c)]);
  const ciel = y => {
    if (y <= arrets[0][0]) return arrets[0][1];
    for (let k = 1; k < arrets.length; k++) if (y <= arrets[k][0]) { const [ya, a] = arrets[k - 1], [yb, b] = arrets[k], t = yb > ya ? (y - ya) / (yb - ya) : 1; return a.map((x, n) => x + (b[n] - x) * t); }
    return arrets[arrets.length - 1][1];
  };
  const ech = Array.from({ length: 13 }, (_, k) => ciel(y0 + (y1 - y0) * k / 12));
  const voiles = { clair: versSrgb([.97, haut[1] * .3, haut[2] * .3]), sombre: versSrgb([.24, haut[1] * .7, haut[2] * .7]) };
  const pire = (yEncre, voile, a) => Math.min(...ech.map(c => contraste(yEncre, lumSrgb(a ? c.map((x, n) => x + (voile[n] - x) * a) : c))));
  const alpha = (yEncre, voile) => {
    if (pire(yEncre, voile, 0) >= CIBLE) return 0;
    let lo = 0, hi = .8;
    if (pire(yEncre, voile, hi) < CIBLE) return hi;
    for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (pire(yEncre, voile, m) >= CIBLE) hi = m; else lo = m; }
    return hi;
  };
  const yS = luminanceLab(ENCRE.sombre), yC = luminanceLab(ENCRE.claire);
  const aS = alpha(yS, voiles.clair), aC = alpha(yC, voiles.sombre);
  const encre = aS <= aC ? 'clair' : 'sombre';                       // data-ciel : « clair » = ciel clair, encre sombre
  const a = Math.min(aS, aC), voile = encre === 'clair' ? voiles.clair : voiles.sombre;
  // encre secondaire : la plus discrète qui garde 4,5:1 sur le ciel voilé
  let L2 = encre === 'clair' ? .38 : .84;
  const L1 = encre === 'clair' ? .22 : .97, y2 = L => luminanceLab(lireOklch(`${L} .01 260`));
  if (pire(y2(L2), voile, a) < CIBLE) {
    let lo = L1, hi = L2;                                             // lo : passe toujours ; hi : trop discret
    for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (pire(y2(m), voile, a) >= CIBLE) lo = m; else hi = m; }
    L2 = lo;
  }
  hero.dataset.ciel = encre;
  if (L2 !== (encre === 'clair' ? .38 : .84)) hero.style.setProperty('--ciel-encre-2', `oklch(${L2.toFixed(3)} .01 260)`); else hero.style.removeProperty('--ciel-encre-2');
  // le ciel (fondu de 1,2 s quand il change avec les données)
  const rgb = c => `rgb(${c.map(x => Math.round(borne(x, 0, 1) * 255)).join(' ')}`;
  const vars = { '--c-haut': cssLab(haut), '--c-milieu': cssLab(milieu), '--c-horizon': cssLab(horizon), '--c-sol0': cssLab(sol), '--c-sol1': cssLab(chroma(sol, 1, -.015)),
    '--voile-c': a > 0 ? `${rgb(voile)} / ${a.toFixed(3)})` : 'transparent', '--voile-y': `${Math.round(y1)}px` };
  const cle = Object.values(vars).join('|');
  const ca = $('ciel-a'), cb = $('ciel-b');
  if (cle !== MEMO.cleCiel) {
    if (MEMO.cleCiel && MEMO.fonduCiel && !immobile()) {
      for (const k of Object.keys(vars)) cb.style.setProperty(k, ca.style.getPropertyValue(k));
      cb.style.transition = 'none'; cb.style.opacity = '1'; void cb.offsetWidth;
      cb.style.transition = 'opacity 1.2s ease'; cb.style.opacity = '0';
    }
    for (const [k, v] of Object.entries(vars)) ca.style.setProperty(k, v);
    MEMO.cleCiel = cle;
  }
  MEMO.fonduCiel = false;
  hero.style.setProperty('--ciel-haut-actuel', vars['--c-haut']);
  // la carte en verre sur la scène (thème clair seulement : en thème sombre, son verre sombre suffit partout)
  let fond = '';
  if (!sombreTheme && C?.bilanZone) {
    const [b0, b1] = C.bilanZone;
    const yMin = Math.min(...Array.from({ length: 7 }, (_, k) => lumSrgb(ciel(b0 + (b1 - b0) * k / 6))));
    if (C.mode === 'large' && encre === 'sombre') fond = 'sombre';
    else if (yMin < .52) fond = 'plein';
  }
  const verre = C?.verre;
  if (verre && (verre.dataset.fond || '') !== fond) { if (fond) verre.dataset.fond = fond; else delete verre.dataset.fond; }
}

/* ------------------------------------------------ Ciel : soleil ou lune, étoiles, nuages (jamais sous le texte) */
function placerCiel(C, d) {
  if (!C || !d) return;
  const { W, s, hx, gx, mode } = C;
  const astre = $('astre');
  const yh = C.yh;
  const touche = (x, y, m) => C.obstacles.some(o => x > o.l - m && x < o.r + m && y > o.t - m && y < o.b + m);
  const p = d.progres;
  const lune = d.E < -4;
  const r = lune ? 13 : mode === 'large' ? 28 : 20;
  let ax, ay;
  if (mode === 'portrait') {
    if (lune) { ax = W - gx - 40; ay = C.bB + 40; }
    else { ax = W - gx - 36 - (1 - p) * .18 * W; ay = C.bB + 26 + (1 - Math.sin(Math.PI * p)) * .10 * C.H; }
  } else if (mode === 'court') {
    ax = hx + 80 * s; ay = 24;
  } else {
    // grand écran : le ciel libre à droite de la colonne de texte ; matin à gauche, soir à droite, plus haut vers midi
    const xa = C.edge + C.colW + 16 + r, xb = W - C.edge - r;
    if (lune) [ax, ay] = C.lune;
    else { ax = xa + p * (xb - xa); ay = C.bB + r + 24 + (1 - Math.sin(Math.PI * p)) * Math.max(0, yh - r - 40 - (C.bB + r + 24)) * .7; }
  }
  // place libre la plus proche : le disque plus une marge (la partie vive du halo) ne touche ni texte, ni pastille, ni filet, ni toit
  const libre = (x, y, m) => {
    if (x - r < 4 || x + r > W - 4 || y - r < (mode === 'large' ? C.bB - 8 : 4) || y + r > yh - 8) return false;   // grand écran : pas dans la rangée du menu
    const R = r + m;
    if (C.obstacles.some(o => x + R > o.l && x - R < o.r && y + R > o.t && y - R < o.b)) return false;
    const Rt = R + (mode === 'large' ? 8 : 0);                      // le profil du toit est approché : un peu plus d'air au-dessus
    for (let a = 0; a <= 180; a += 30) { const t = a * RAD, px = x + Rt * Math.cos(t), py = y + Rt * Math.sin(t); if (py >= C.silhouette(px)) return false; }
    return true;
  };
  const marges = mode === 'large' ? [24, 16, 8] : [12, 8];
  let place = null;
  for (const m of marges) {
    if (libre(ax, ay, m)) { place = [ax, ay]; break; }
    let best = null, d2 = Infinity;
    for (let y = r + 4; y <= yh - r - 8; y += 6) for (let x = r + 4; x <= W - r - 4; x += 8) {
      const q = (x - ax) ** 2 + (y - ay) ** 2;
      if (q < d2 && libre(x, y, m)) { d2 = q; best = [x, y]; }
    }
    if (best) { place = best; break; }
  }
  if (place) [ax, ay] = place;
  astre.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
  astre.style.setProperty('--r', r + 'px');
  // étoiles : 24 points déterministes (suite du nombre d'or), dans les 70 % hauts du ciel, hors du texte
  let et = '';
  if (d.E < -6) {
    const phi = 0.6180339887, phi2 = 0.7548776662;
    let tw = 0;
    for (let k = 1; k <= 24; k++) {
      const x = ((k * phi) % 1) * W, y = ((k * phi2 + .13) % 1) * .7 * yh;
      if (touche(x, y, 10) || y > C.silhouette(x) - 8 || Math.hypot(x - ax, y - ay) < r + 16) continue;
      const rr = .6 + .6 * ((k * 0.38196) % 1), op = .25 + .25 * ((k * 0.7071) % 1);
      const twc = tw < 5 && k % 4 === 1;
      if (twc) tw++;
      et += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(2)}" opacity="${op.toFixed(2)}"${twc ? ` class="tw" style="--d:${(3.5 + (k % 5) * .55).toFixed(2)}s;--r:${(-(k % 7) * .7).toFixed(1)}s"` : ''}/>`;
    }
  }
  $('etoiles').innerHTML = et;
  // nuages : des formes douces dans la bande de ciel au-dessus de l'objet
  const n = +($('nuages').dataset.n || 0);
  const pos = [[.12, .30, .34], [.62, .18, .30], [.36, .48, .26], [.86, .42, .24], [.02, .58, .22]];
  const cirrus = $('nuages').dataset.meteo === 'voile';
  $('nuages').innerHTML = pos.slice(0, n).map(([fx, fy, fw]) => {
    const w = fw * W * (cirrus ? 1.6 : 1), h = cirrus ? 10 : w * .34;
    return `<i style="left:${(fx * W).toFixed(0)}px;top:${(C.bB + fy * (yh * .55)).toFixed(0)}px;width:${w.toFixed(0)}px;height:${h.toFixed(0)}px"></i>`;
  }).join('');
}
