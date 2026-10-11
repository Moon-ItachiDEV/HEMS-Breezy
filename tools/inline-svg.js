// usage: node tools/inline-svg.js <template.html> <out.html> [svg=assets/maison.svg]
// Kept for the existing command; it now delegates to the generic builder (tools/build.js), which also
// resolves the <!--INCLURE …--> and {{DATA …}} markers. Build the home page from the repo root:
//   node tools/inline-svg.js src/index.template.html index.html
const { principal } = require('./build');
const args = process.argv.slice(2);
if (args.length < 2) { console.error('usage: node tools/inline-svg.js <template.html> <out.html> [svg]'); process.exit(1); }
principal(args);
