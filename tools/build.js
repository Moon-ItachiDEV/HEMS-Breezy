#!/usr/bin/env node
// Breezy · générateur de pages : un gabarit src/<nom>.template.html → une page autonome <nom>.html à la racine.
//
//   node tools/build.js                                   # tous les src/*.template.html → <nom>.html à la racine
//   node tools/build.js src/kia.template.html kia.html    # une seule page
//
// Marqueurs (remplacés par leur contenu, tel quel) :
//   <!--INCLURE partage/ha.js-->      le texte du fichier (chemin relatif au dossier du gabarit, src/) ; un seul niveau
//   <!--MAISON_SVG-->                 assets/maison.svg sans sa ligne <?xml?>
//   {{DATA assets/roadster.webp}}     data:<type>;base64,… (chemin relatif à la racine du dépôt ; peut être dans un attribut)
// Sortie en erreur (code 1) : fichier absent, marqueur inconnu, ou marqueur resté dans la page produite.
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
const CONNUS = ['INCLURE', 'MAISON_SVG'];

class ErreurBuild extends Error {}
const echec = msg => { throw new ErreurBuild(msg); };
const lire = (f, quoi) => { if (!fs.existsSync(f) || !fs.statSync(f).isFile()) echec(`${quoi} introuvable : ${path.relative(process.cwd(), f)}`); return fs.readFileSync(f); };
const milliers = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* les marqueurs d'un texte qui ne sont pas connus : <!--NOM …--> (sans espace après <!--) et {{NOM …}} */
function inconnus(texte) {
  const out = [];
  for (const m of texte.matchAll(/<!--([A-Z][A-Z0-9_]*)(?:\s[^>]*?)?-->/g)) if (!CONNUS.includes(m[1])) out.push(m[0]);
  for (const m of texte.matchAll(/\{\{([A-Z][A-Z0-9_]*)(?:\s[^}]*)?\}\}/g)) if (m[1] !== 'DATA') out.push(m[0]);
  return out;
}

function construire(gabarit, sortie, opts = {}) {
  const dossier = path.dirname(path.resolve(gabarit));
  let html = lire(path.resolve(gabarit), 'gabarit').toString('utf8');
  const mauvais = inconnus(html);
  if (mauvais.length) echec(`marqueur inconnu dans ${gabarit} : ${mauvais.join(', ')}`);

  // 1. inclusions (un seul niveau : un INCLURE dans un fichier inclus reste, et fait échouer la vérification finale)
  html = html.replace(/<!--INCLURE\s+([^\s>]+)\s*-->/g, (_, rel) => {
    const texte = lire(path.join(dossier, rel), 'fichier inclus').toString('utf8');
    const m = inconnus(texte);
    if (m.length) echec(`marqueur inconnu dans ${rel} : ${m.join(', ')}`);
    return texte;
  });
  // 2. la maison, en ligne (ses éléments sont animés à l'exécution)
  if (html.includes('<!--MAISON_SVG-->')) {
    const svg = lire(path.resolve(opts.svg || path.join(RACINE, 'assets', 'maison.svg')), 'dessin').toString('utf8').replace(/<\?xml[^>]*>\s*/, '');
    html = html.replace('<!--MAISON_SVG-->', () => svg);
  }
  // 3. images en data URI (le fichier est embarqué tel quel, jamais réencodé)
  html = html.replace(/\{\{DATA\s+([^\s}]+)\s*\}\}/g, (_, rel) => {
    const ext = path.extname(rel).slice(1).toLowerCase();
    if (!MIME[ext]) echec(`type de fichier non pris en charge pour DATA : ${rel}`);
    return `data:${MIME[ext]};base64,${lire(path.join(RACINE, rel), 'fichier DATA').toString('base64')}`;
  });
  // 4. plus aucun marqueur dans la page produite
  for (const reste of ['<!--INCLURE', '{{DATA', '<!--MAISON_SVG-->']) if (html.includes(reste)) echec(`marqueur non remplacé dans ${sortie} : ${reste}`);

  fs.writeFileSync(sortie, html);
  const rel = path.relative(process.cwd(), path.resolve(sortie));
  console.log(`wrote ${rel && !rel.startsWith('..') ? rel : sortie} ${milliers(fs.statSync(sortie).size)} bytes`);
}

function principal(args) {
  try {
    if (args.length >= 2) construire(args[0], args[1], { svg: args[2] });
    else if (args.length === 0) {
      const src = path.join(RACINE, 'src');
      const pages = fs.readdirSync(src).filter(f => f.endsWith('.template.html')).sort();
      if (!pages.length) echec('aucun gabarit src/*.template.html');
      for (const f of pages) construire(path.join(src, f), path.join(RACINE, f.replace(/\.template\.html$/, '.html')));
    } else echec('usage : node tools/build.js [<gabarit.html> <sortie.html>]');
  } catch (e) {
    if (!(e instanceof ErreurBuild)) throw e;
    console.error('build : ' + e.message);
    process.exit(1);
  }
}

module.exports = { construire, principal };
if (require.main === module) principal(process.argv.slice(2));
