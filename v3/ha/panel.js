// Breezy HEMS — chargeur du panneau Home Assistant (module_url de panel_custom, avec embed_iframe: true).
// Ce fichier garde toujours la même adresse : il lit version.json (adresse unique à chaque fois, jamais servie
// d'un cache) puis charge panel-core.js de cette version. Mettre Breezy à jour = copier les fichiers et recharger
// la page, sans toucher au YAML ni redémarrer Home Assistant.
// Règle de Home Assistant : l'élément doit être défini dès l'évaluation du module (aucun await avant define),
// et il reçoit hass, narrow, route et panel avant d'être inséré dans la page.
const BASE = new URL("./", import.meta.url);
// Contrat avec panel-core.js. Ce fichier reste en cache sous la même adresse : s'il change un jour, LOADER_API augmente
// et module_url passe à ?v=<LOADER_API> (scripts/build-ha.py refuse de livrer sinon) ; panel-core le vérifie
const LOADER_API = 1;
let core = null;   // promesse du module panel-core (une seule par cadre)

function loadCore() {
  return (core ||= (async () => {
    let info = { version: "dev", core: "panel-core.js" };
    try {
      const r = await fetch(new URL(`version.json?t=${Date.now()}`, BASE), { cache: "no-store" });
      if (r.ok) info = { ...info, ...(await r.json()) };
    } catch {}
    // « dev » (fichiers sources) : une adresse neuve à chaque chargement, jamais de cache
    info.stamp = info.version === "dev" ? `dev-${Date.now()}` : info.version;
    info.loader = LOADER_API;
    const mod = await import(new URL(`${info.core}?v=${encodeURIComponent(info.stamp)}`, BASE).href);
    return { mod, info };
  })());
}

// Avant les styles : le fond de la bonne couleur (thème choisi dans Breezy, sinon celui de Home Assistant), sans flash
function prepaint(hass) {
  let theme = null;
  try { theme = JSON.parse(localStorage.getItem("bz3") || "{}").theme; } catch {}
  const dark = theme === "dark" || (theme !== "light" && !!(hass && hass.themes && hass.themes.darkMode));
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.style.background = dark ? "#0e0f12" : "#e9ebef";
}

// Échec du chargement : un message clair dans le panneau (jamais location.reload() : dans le cadre, il chargerait
// une seconde fois tout Home Assistant), et le bouton du menu de Home Assistant : sur téléphone, HA ne dessine aucune
// barre au-dessus du panneau, c'est la seule façon d'en sortir pour aller corriger les fichiers
function bootError(el, e) {
  const what = String((e && e.message) || e || "fichier inconnu").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  el.innerHTML = `<div role="alert" style="font:15px/1.5 system-ui,sans-serif;margin:24px;padding:20px 22px;border-radius:14px;background:#fdecec;color:#7a1d21;max-width:560px;overflow-wrap:anywhere">
    <strong style="display:block;font-size:17px;margin-bottom:6px">Breezy n'a pas pu se charger</strong>
    Fichier en cause : <code>${what}</code>.<br>Vérifie le dossier <code>/config/www/breezy/</code> (avec File editor par exemple) puis recharge la page.
    <br><button type="button" data-bz-menu style="margin-top:14px;font:600 15px system-ui,sans-serif;padding:10px 16px;border-radius:10px;border:0;background:#7a1d21;color:#fff;cursor:pointer">Menu Home Assistant</button></div>`;
  el.querySelector("[data-bz-menu]").addEventListener("click", () => el.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true })));
  console.error("[Breezy] chargement impossible :", e);
}

class BreezyHemsPanel extends HTMLElement {
  constructor() { super(); this._p = {}; this._impl = null; this._painted = false; }
  // Home Assistant appelle setProperties avec les seules propriétés qui ont changé
  setProperties(p) {
    Object.assign(this._p, p);
    if (this._impl) this._impl.setProperties(p);
    // Premier élément du cadre seulement : au retour d'un cadre déjà démarré (core existe), la page et ses styles sont là
    else if (!this._painted && this._p.hass && !core) { this._painted = true; prepaint(this._p.hass); }
  }
  set hass(v) { this.setProperties({ hass: v }); }
  set narrow(v) { this.setProperties({ narrow: v }); }
  set route(v) { this.setProperties({ route: v }); }
  set panel(v) { this.setProperties({ panel: v }); }
  connectedCallback() {
    this.style.display = "contents";
    if (this._impl) { this._impl.connected(this); return; }
    loadCore()
      .then(({ mod, info }) => { if (this.isConnected && !this._impl) this._impl = mod.mount(this, this._p, info); })
      .catch((e) => bootError(this, e));
  }
  disconnectedCallback() { if (this._impl) this._impl.disconnected(this); }
}
if (!customElements.get("breezy-hems-panel")) customElements.define("breezy-hems-panel", BreezyHemsPanel);
