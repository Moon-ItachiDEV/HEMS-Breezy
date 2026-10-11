/* ------------------------------------------------------------ Formats FR, outils, heure de la maison -- partagé
   Contrat : la page déclare CONFIG (CONFIG.fuseau) AVANT ce fichier. */
const NBSP = ' ', NNBSP = ' ';
const nf = {};
const nombre = (v, d = 1, dMin = d) => (nf[d + '/' + dMin] ||= new Intl.NumberFormat('fr-FR', { minimumFractionDigits: dMin, maximumFractionDigits: d })).format(v);
const fini = v => typeof v === 'number' && Number.isFinite(v);
const borne = (v, a, b) => Math.max(a, Math.min(b, v));
/* Puissance (W) : < 1 000 W en watts arrondis à 10 W ; au-delà en kW (1,46 kW, 7,2 kW) ; un 0 mesuré reste « 0 W » */
const kWtxt = w => nombre(w / 1000, 2, 1);
function puissance(w) {
  if (!fini(w)) return { n: '—', u: '', w: null };
  const a = Math.abs(w), r = Math.round(a / 10) * 10;
  if (a === 0) return { n: '0', u: 'W', w: 0 };
  if (r < 1000) return { n: r === 0 ? `<${NNBSP}10` : nombre(r, 0), u: 'W', w: r };
  return { n: kWtxt(a), u: 'kW', w: a };
}
const pTxt = w => { const p = puissance(w); return p.u ? `${p.n}${NBSP}${p.u}` : p.n; };
/* lecture d'écran : « 1,46 kilowatt », « 520 watts » (accord sur le nombre tel qu'il est affiché) */
const pLong = w => {
  const p = puissance(w);
  if (!p.u) return 'non mesuré';
  const n = p.u === 'W' ? p.w || 10 : Math.round(Math.abs(w) / 10) / 100;
  return `${p.n.replace(NNBSP, ' ')} ${accord(n, p.u === 'W' ? 'watt' : 'kilowatt')}`;
};
const accord = (n, sing, plur = sing + 's') => Math.abs(n) >= 2 ? plur : sing;
const kWh = v => fini(v) ? nombre(v, 1) : '—';
const euros = v => fini(v) ? nombre(v, 2) : '—';
const pct = v => fini(v) ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) : '—';
const unite = (n, u, cls = 'u') => `${n}<span class="${cls}">${NBSP}${u}</span>`;
const heureTxt = h => {
  if (!fini(h)) return '—';
  h = ((h % 24) + 24) % 24;
  let H = Math.floor(h), M = Math.round((h - H) * 60);
  if (M === 60) { H = (H + 1) % 24; M = 0; }
  return M ? `${H}${NBSP}h${NBSP}${String(M).padStart(2, '0')}` : `${H}${NBSP}h`;
};
const hDe = (s, defaut = null) => { if (typeof s !== 'string') return defaut; const [H, M] = s.split(':').map(Number); return fini(H) ? H + (M || 0) / 60 : defaut; };
/* heures annoncées à 5 min près : « pleine vers » au plus proche, « jusqu'à » tronquée (jamais de promesse en trop) */
const arrondi5 = h => Math.round(h * 12) / 12;
const tronque5 = h => Math.floor(h * 12 + 1e-9) / 12;
const $ = id => document.getElementById(id);
const SVGNS = 'http://www.w3.org/2000/svg';
const reduitMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const sombreMQ = window.matchMedia('(prefers-color-scheme: dark)');
let PAUSE = false;                                   // interrupteur « Animations des flux » du pied de page
const immobile = () => reduitMQ.matches || PAUSE;
const themeSombre = () => { const t = document.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && sombreMQ.matches); };

/* Heure de la maison (CONFIG.fuseau), quel que soit le fuseau du navigateur : { date, h (heures décimales), jour (aaaa-mm-jj) } */
const FMT_HEURE = new Intl.DateTimeFormat('fr-FR', { timeZone: CONFIG.fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
function heureLocale(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const parts = FMT_HEURE.formatToParts(d), v = t => Number(parts.find(p => p.type === t)?.value ?? 0);
  return { date: d, h: v('hour') + v('minute') / 60 + v('second') / 3600, jour: `${v('year')}-${v('month')}-${v('day')}` };
}
/* minuit de la maison, le jour de l'instant t (ms), à la milliseconde ; corrigé une fois les jours de changement d'heure */
const minuitDe = t => {
  const d = new Date(t), m = t - Math.round(heureLocale(d).h * 3600) * 1000 - d.getMilliseconds(), e = heureLocale(new Date(m)).h;
  return e ? m - Math.round((e > 12 ? e - 24 : e) * 3600) * 1000 : m;
};
const dateCourte = date => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: CONFIG.fuseau }).format(date);
