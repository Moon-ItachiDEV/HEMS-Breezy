// Breezy HEMS V2 — rendu : met à jour le DOM existant au lieu de le remplacer.
// Garde le focus, la position de défilement, les transitions CSS et les animations
// en cours (la V1 reconstruisait toute la page à chaque action).
(() => {
  const BZ = window.BZ;

  function patchNode(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName || (a.nodeType === 1 && a.getAttribute("data-key") !== b.getAttribute("data-key"))) {
      a.replaceWith(b);
      return;
    }
    if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    if (a.nodeType !== 1) return;
    for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
    for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
    if ((a.tagName === "INPUT" || a.tagName === "SELECT") && a !== document.activeElement && a.value !== b.value) a.value = b.value;
    patchChildren(a, b);
  }
  function patchChildren(a, b) {
    const an = [...a.childNodes], bn = [...b.childNodes];
    bn.forEach((n, i) => (i < an.length ? patchNode(an[i], n) : a.appendChild(n)));
    for (let i = bn.length; i < an.length; i++) an[i].remove();
  }
  const tpl = document.createElement("template");
  // Remplace le contenu de `el` par `html` en touchant le moins de nœuds possible
  function morph(el, html) {
    tpl.innerHTML = html;
    const next = document.createElement(el.tagName);
    next.appendChild(tpl.content);
    patchChildren(el, next);
  }

  // Petit utilitaire de gabarit : ignore false / null / undefined et aplatit les tableaux
  const h = (strings, ...vals) => strings.reduce((out, s, i) => out + s + (i < vals.length ? flat(vals[i]) : ""), "");
  const flat = (v) => (v == null || v === false ? "" : Array.isArray(v) ? v.map(flat).join("") : String(v));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  Object.assign(BZ, { morph, h, esc });
})();
