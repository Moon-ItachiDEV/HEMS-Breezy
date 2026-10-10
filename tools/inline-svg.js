// usage: node tools/inline-svg.js <template.html> <out.html> [svg=assets/maison.svg]
// Replaces the marker <!--MAISON_SVG--> with the house SVG markup (inline, so its IDs can be animated).
// Build the home page from the repo root:
//   node tools/inline-svg.js src/index.template.html index.html
const fs = require('fs');
const path = require('path');
const [tpl, out, svgPath = path.join(__dirname, '..', 'assets', 'maison.svg')] = process.argv.slice(2);
if (!tpl || !out) { console.error('usage: node tools/inline-svg.js <template.html> <out.html> [svg]'); process.exit(1); }
let svg = fs.readFileSync(svgPath, 'utf8').replace(/<\?xml[^>]*>\s*/, '');
const html = fs.readFileSync(tpl, 'utf8');
if (!html.includes('<!--MAISON_SVG-->')) { console.error('marker <!--MAISON_SVG--> not found'); process.exit(1); }
fs.writeFileSync(out, html.replace('<!--MAISON_SVG-->', () => svg));
console.log('wrote', out, fs.statSync(out).size, 'bytes');
