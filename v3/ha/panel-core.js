// Breezy HEMS — cœur du panneau Home Assistant, chargé par panel.js dans le cadre (iframe) que HA crée pour le panneau.
//  · le pont window.BZ_HASS : états, services, statistiques et événements de hass, thème, menu, navigation ;
//  · le document du cadre, vide au départ : langue, métas, styles et squelette de v3/index.html ;
//  · la V3 elle-même (mêmes scripts que la démo, sans mock.js ni la démo) ;
//  · le cycle de vie : départ du panneau (désabonnements), retour par l'historique du navigateur (nouvel élément).
// Fichiers sources : la liste des styles et scripts est lue dans v3/index.html. Version empaquetée : BUILD la contient.
const BUILD = /*@BZ_BUILD*/null/*@END*/;
// Version du contrat entre le chargeur (breezy-panel.js, adresse fixe gardée en cache par le navigateur) et ce cœur.
// Elle ne change que si panel.js change : il faut alors passer module_url à ?v=<cette valeur> (scripts/build-ha.py le vérifie)
const LOADER_API = 1;

const ENTITY = /^[a-z_]+\.[a-z0-9_]+$/;   // identifiant d'entité Home Assistant (domaine.objet)
let bridge = null, ROOT = null, booted = null;

/* ─── Le pont vers Home Assistant ──────────────────────────────────────
   Tout ce qui vient de hass appartient à la fenêtre principale (autre « realm ») : pas d'instanceof,
   les promesses sont reprises avec Promise.resolve, et hass n'est jamais modifié. */
// Refus de HA : objet {code, message}. Connexion perdue (code 3) : le nombre 3 seul veut dire que la connexion était
// déjà coupée et que rien n'est parti (sent: false) ; {error: {code: 3}} : coupée pendant l'envoi, issue inconnue
const normErr = (e) => (e === 3 ? { code: 3, sent: false, message: "Not connected" }
  : e && e.error && e.error.code === 3 ? { code: 3, message: e.error.message || "Connection lost" }
  : e && e.code === 3 ? { code: 3, sent: e.sent, message: String(e.message || "Connection lost") }
  : { code: (e && e.code) || "unknown_error", message: String((e && e.message) || e || "") });

function makeBridge(version) {
  const subs = new Map();        // type d'événement interne → fonctions abonnées
  const unsubs = new Set();      // abonnements pris sur la connexion de HA (à rendre au départ du panneau)
  const watch = new Set(["sun.sun", "zone.home"]);
  return {
    mode: "ha", version, hass: null, narrow: false, route: { prefix: "/breezy", path: "" }, panel: null, el: null, errors: [], watch,
    get states() { return this.hass ? this.hass.states : {}; },
    get darkMode() { return !!(this.hass && this.hass.themes && this.hass.themes.darkMode); },
    get tz() { return (this.hass && this.hass.config && this.hass.config.time_zone) || Intl.DateTimeFormat().resolvedOptions().timeZone; },
    get connected() { return !!this.hass && this.hass.connected !== false; },
    get userName() { return (this.hass && this.hass.user && this.hass.user.name) || ""; },
    get isAdmin() { return !!(this.hass && this.hass.user && this.hass.user.is_admin); },
    get external() { return !!(this.hass && this.hass.auth && this.hass.auth.external); },
    get haVersion() { return (this.hass && this.hass.config && this.hass.config.version) || ""; },
    // Bouton menu : mêmes règles que celui de Home Assistant (ha-menu-button)
    get showMenu() {
      const h = this.hass, ext = h && h.auth && h.auth.external;
      return !!h && !h.kioskMode && !(ext && ext.config && ext.config.hasSidebar === true) && (this.narrow || h.dockedSidebar === "always_hidden");
    },
    // Entités suivies : les identifiants de config.js (un changement ailleurs dans HA ne redessine rien)
    watchConfig(C) {
      const walk = (v) => (typeof v === "string" ? ENTITY.test(v) && watch.add(v) : Array.isArray(v) ? v.forEach(walk) : v && typeof v === "object" && Object.values(v).forEach(walk));
      walk(C);
    },
    // notifyOnError = false : Breezy affiche son propre message, HA n'en ajoute pas un second
    callService(domain, service, data, target) {
      if (!this.hass) return Promise.reject({ code: 3, sent: false, message: "Not connected" });
      const h = this.hass;
      return Promise.resolve().then(() => h.callService(domain, service, data || {}, target, false)).catch((e) => { throw normErr(e); });
    },
    // Objet neuf à chaque appel : la connexion de HA y écrit son numéro de message
    callWS(msg) {
      if (!this.hass) return Promise.reject({ code: 3, sent: false, message: "Not connected" });
      const h = this.hass;
      return Promise.resolve().then(() => h.callWS({ ...msg })).catch((e) => { throw normErr(e); });
    },
    // Événement HA (ex. recorder_hourly_statistics_generated) ; rendu automatiquement au départ du panneau
    subscribeEvents(cb, type) {
      let off = null, dead = false;
      // Appel immédiat : au départ du panneau, le cadre disparaît et ses tâches différées ne s'exécuteraient plus
      const unsub = () => { dead = true; unsubs.delete(unsub); if (off) { const o = off; off = null; try { Promise.resolve(o()).catch(() => {}); } catch {} } };
      unsubs.add(unsub);
      Promise.resolve().then(() => this.hass.connection.subscribeEvents(cb, type))
        .then((u) => { if (dead) { try { Promise.resolve(u()).catch(() => {}); } catch {} } else off = u; })
        .catch((e) => { unsubs.delete(unsub); this.noteError(`subscribe ${type}`, [], e); });
      return unsub;
    },
    // Adresse d'une page dans la page principale : /breezy pour l'Aperçu, /breezy/energy…
    pathOf(id) {
      const base = (this.route && this.route.prefix) || `/${(this.panel && this.panel.url_path) || "breezy"}`;
      return id === "overview" ? base : `${base}/${id}`;
    },
    // Page de l'adresse du panneau (null si elle n'est pas du panneau)
    idOf(path) {
      const base = this.pathOf("overview"), p = String(path || "").replace(/\/+$/, "");
      return p === base ? "overview" : p.startsWith(`${base}/`) ? p.slice(base.length + 1).split("/")[0] : null;
    },
    // La page principale suit (un seul « Retour » par page)
    navigate(id, { replace = false } = {}) {
      try { if (parent.customPanel) parent.customPanel.navigate(this.pathOf(id), { replace }); } catch {}
    },
    toggleMenu() { if (this.el) this.el.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true })); },
    // Recharger : toute la page de Home Assistant (dans le cadre, location.reload() rechargerait HA dans HA)
    reloadAll() { try { parent.location.reload(); } catch {} },
    // Derniers refus de HA (pour le diagnostic) ; jamais de jeton ni d'adresse
    noteError(service, ids, e) {
      const err = normErr(e);
      this.errors.unshift({ at: new Date().toISOString(), service, ids: [].concat(ids || []), code: err.code, message: err.message });
      this.errors.length = Math.min(this.errors.length, 10);
      console.warn("[Breezy]", service, ids, err);
      this.emit("error", err);
    },
    on(type, fn) { if (!subs.has(type)) subs.set(type, new Set()); subs.get(type).add(fn); return () => subs.get(type).delete(fn); },
    emit(type, arg) { (subs.get(type) || []).forEach((fn) => { try { fn(arg); } catch (e) { console.error("[Breezy]", type, e); } }); },
    // Nouvel hass (plusieurs par seconde parfois) : on ne prévient que si ce que Breezy montre a changé.
    // HA garde le même objet pour une entité qui n'a pas changé : comparer les objets suffit
    setHass(h) {
      const prev = this.hass;
      if (!h || h === prev) return;
      this.hass = h;
      if (!prev) { this.emit("ready"); return; }
      if (h.states !== prev.states) for (const id of watch) if (h.states[id] !== prev.states[id]) { this.emit("states"); break; }
      if (!!(h.themes && h.themes.darkMode) !== !!(prev.themes && prev.themes.darkMode)) this.emit("theme");
      if (h.connected !== prev.connected) this.emit("connection", h.connected !== false);
      if (h.user !== prev.user || h.config !== prev.config || h.dockedSidebar !== prev.dockedSidebar || h.kioskMode !== prev.kioskMode) this.emit("meta");
    },
    setNarrow(v) { v = !!v; if (v !== this.narrow) { this.narrow = v; this.emit("narrow", v); } },
    setRoute(r) { if (!r) return; const was = this.route; this.route = r; if (!was || was.path !== r.path || was.prefix !== r.prefix) this.emit("route", r); },
    dispose() { [...unsubs].forEach((u) => u()); },
    get subscriptions() { return unsubs.size; },
  };
}

/* ─── Ce qu'il faut charger : styles, scripts, squelette ─────────────── */
// Fichiers sources : lus dans v3/index.html (même ordre que la démo), sans config.js (chargé à part, toujours frais)
// ni mock.js ; history.js juste après core.js, diag.js juste après sheets.js, ha.css après les styles
async function sourceBuild() {
  const index = new URL("../index.html", import.meta.url);
  const r = await fetch(index, { cache: "no-store" });
  if (!r.ok) throw new Error("v3/index.html");
  const doc = new DOMParser().parseFromString(await r.text(), "text/html");
  const abs = (u) => new URL(u, index).href;
  const css = [], fonts = [], js = [];
  doc.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]').forEach((l) => {
    const href = l.getAttribute("href");
    if (/fonts\.(googleapis|gstatic)\.com/.test(href)) fonts.push({ rel: l.getAttribute("rel"), href, cors: l.hasAttribute("crossorigin") });
    else if (l.getAttribute("rel") === "stylesheet") css.push(abs(href));
  });
  css.push(new URL("ha.css", import.meta.url).href);
  doc.querySelectorAll("body script").forEach((s) => {
    const src = s.getAttribute("src");
    if (!src) { js.push({ code: s.textContent }); return; }
    if (/(^|\/)js\/(config|mock)\.js$/.test(src) && src.startsWith("../")) return;
    js.push({ src: abs(src) });
    if (src === "js/core.js") js.push({ src: new URL("history.js", import.meta.url).href });
    if (src === "js/sheets.js") js.push({ src: new URL("diag.js", import.meta.url).href });
  });
  doc.querySelectorAll("body script").forEach((s) => s.remove());
  return { css, fonts, js, config: abs("../js/config.js"), shell: doc.body.innerHTML };
}
// Version empaquetée (scripts/build-ha.py) : chemins relatifs à ce fichier
const builtBuild = () => {
  const rel = (u) => new URL(u, import.meta.url).href;
  return { css: BUILD.css.map(rel), fonts: BUILD.fonts || [], js: BUILD.js.map((s) => (typeof s === "string" ? { src: rel(s) } : s)), config: rel(BUILD.config), shell: BUILD.shell };
};

const withV = (url, v) => `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}`;
const fileOf = (url) => { try { return new URL(url).pathname.replace(/^.*\/(local|repo)\//, ""); } catch { return String(url); } };
function loadScript(s, v) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    if (s.code != null) { el.textContent = s.code; document.head.appendChild(el); resolve(); return; }
    el.async = false;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(fileOf(s.src)));
    el.src = v ? withV(s.src, v) : s.src;
    document.head.appendChild(el);
  });
}
const loadCss = (href) => new Promise((resolve) => {
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.onload = l.onerror = () => resolve(); l.href = href;
  document.head.appendChild(l);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ─── Le document du cadre ─────────────────────────────────────────── */
function meta(name, content) {
  let m = document.querySelector(`meta[name="${name}"]`);
  if (!m) { m = document.createElement("meta"); m.name = name; document.head.appendChild(m); }
  m.content = content;
}
function prepareDocument() {
  const root = document.documentElement;
  root.lang = "fr";
  meta("theme-color", "#e9ebef");
  meta("color-scheme", "light dark");
  if (!document.title) document.title = "Breezy HEMS";
  document.body.classList.add("is-loading", "fit");
  // Application mobile de HA : pas d'export CSV (téléchargement non vérifié dans ses vues web)
  if (bridge.external) root.dataset.hosted = "1";
  let theme = null;
  try { theme = JSON.parse(localStorage.getItem("bz3") || "{}").theme; } catch {}
  root.dataset.theme = theme === "dark" || (theme !== "light" && bridge.darkMode) ? "dark" : "light";
}
// Échec du démarrage : un message clair, le détail d'une faute dans config.js (ligne), et le bouton du menu de Home
// Assistant (sur téléphone, HA ne dessine aucune barre au-dessus du panneau : c'est la seule façon d'en sortir)
function bootError(el, what, detail) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const box = document.createElement("div");
  box.setAttribute("role", "alert");
  box.style.cssText = "font:15px/1.5 system-ui,sans-serif;margin:24px;padding:20px 22px;border-radius:14px;background:#fdecec;color:#7a1d21;max-width:560px;overflow-wrap:anywhere";
  box.innerHTML = `<strong style="display:block;font-size:17px;margin-bottom:6px">Breezy n'a pas pu se charger</strong>
    Fichier en cause : <code>${esc(what)}</code>.${detail ? `<br><span data-bz-detail>${esc(detail)}</span>` : ""}
    <br>Vérifie le dossier <code>/config/www/breezy/</code> (avec File editor par exemple) puis recharge la page.
    <br><button type="button" data-bz-menu style="margin-top:14px;font:600 15px system-ui,sans-serif;padding:10px 16px;border-radius:10px;border:0;background:#7a1d21;color:#fff;cursor:pointer">Menu Home Assistant</button>`;
  box.querySelector("[data-bz-menu]").addEventListener("click", () => el.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true })));
  if (ROOT) ROOT.style.display = "none";
  el.appendChild(box);
}

/* ─── Zones sûres (encoche, barre d'accueil) ─────────────────────────────
   Home Assistant 2026.9 et plus rembourre lui-même le cadre ; avant (2025.7 à 2026.8), le cadre touche le haut et le bas
   de l'écran et env() vaut 0 dedans. On mesure donc dans la page principale (même origine) ce que les zones sûres
   recouvrent encore du cadre, et on le donne à ha.css (--bz-host-sat / --bz-host-sab). Rien en double : avec un cadre
   déjà rembourré, il ne reste rien à ajouter. */
function syncSafeArea() {
  let top = 0, bottom = 0;
  try {
    const fe = window.frameElement, pw = parent, pd = pw.document;
    if (fe && pd && pd.body) {
      const probe = pd.createElement("div");
      probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;"
        + "padding:var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) 0 var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) 0";
      pd.body.appendChild(probe);
      const cs = pw.getComputedStyle(probe), sat = parseFloat(cs.paddingTop) || 0, sab = parseFloat(cs.paddingBottom) || 0;
      probe.remove();
      if (sat || sab) {
        const r = fe.getBoundingClientRect(), fs = pw.getComputedStyle(fe), px = (v) => parseFloat(v) || 0;
        const innerTop = r.top + px(fs.paddingTop) + px(fs.borderTopWidth), innerBottom = pw.innerHeight - (r.bottom - px(fs.paddingBottom) - px(fs.borderBottomWidth));
        top = Math.max(0, sat - Math.max(0, innerTop)); bottom = Math.max(0, sab - Math.max(0, innerBottom));
      }
    }
  } catch {}
  const st = document.documentElement.style;
  st.setProperty("--bz-host-sat", `${Math.round(top)}px`); st.setProperty("--bz-host-sab", `${Math.round(bottom)}px`);
}

async function boot(el, info) {
  const B = BUILD ? builtBuild() : await sourceBuild();
  prepareDocument();
  // Squelette de la page (barre latérale, barre du haut, vue, panneaux, motif hachuré) avant app.js, qui le cherche
  ROOT = document.createElement("div");
  ROOT.id = "bz-root"; ROOT.style.display = "contents"; ROOT.innerHTML = B.shell;
  el.appendChild(ROOT);
  // config.js : modifié à la main par l'utilisateur, toujours relu (adresse unique). Une faute de frappe n'empêche pas le
  // fichier de « charger » : le navigateur signale l'erreur à part, on la garde pour dire laquelle et à quelle ligne
  let cfgErr = null;
  const onErr = (ev) => { if (/config\.js/.test(String(ev.filename || ""))) cfgErr = ev.lineno ? `Ligne ${ev.lineno} : ${ev.message}` : String(ev.message || ""); };
  window.addEventListener("error", onErr);
  try {
    await loadScript({ src: `${B.config}${B.config.includes("?") ? "&" : "?"}t=${Date.now()}` }).catch(() => { throw Object.assign(new Error("config.js"), { detail: "Fichier introuvable." }); });
  } finally { window.removeEventListener("error", onErr); }
  if (!window.VOLTIA_CONFIG) throw Object.assign(new Error("config.js"), { detail: cfgErr || "Le fichier ne définit pas window.VOLTIA_CONFIG." });
  bridge.watchConfig(window.VOLTIA_CONFIG);
  window.BZ_HASS = bridge;
  // Styles dans l'ordre de la démo ; on n'attend pas plus de 3 s un fichier lent
  if (window.VOLTIA_CONFIG.police_externe !== false) B.fonts.forEach((f) => {
    const l = document.createElement("link"); l.rel = f.rel; l.href = f.href; if (f.cors) l.crossOrigin = ""; document.head.appendChild(l);
  });
  await Promise.race([Promise.all(B.css.map((u) => loadCss(withV(u, info.stamp)))), sleep(3000)]);
  document.documentElement.style.removeProperty("background");   // fond provisoire de panel.js : les styles prennent le relais
  // Scripts un par un, dans l'ordre (chacun lit ce que les précédents ont posé sur window.BZ)
  for (const s of B.js) await loadScript(s, info.stamp);
  // Copie incomplète d'une mise à jour : version.json, panel-core.js et breezy.js doivent venir du même paquet
  if (BUILD && (window.BZ_BUILD !== BUILD.version || info.version !== BUILD.version)) bridge.staleBuild = true;
  // Chargeur d'une autre génération (gardé en cache sous la même adresse) : il faut changer ?v= dans module_url
  if (info.loader !== LOADER_API) bridge.staleLoader = { want: LOADER_API, got: info.loader == null ? null : info.loader };
  syncSafeArea();
  window.addEventListener("resize", syncSafeArea);
  bridge.on("narrow", () => requestAnimationFrame(syncSafeArea));
}

/* ─── Cycle de vie ─────────────────────────────────────────────────── */
function applyProps(p) {
  if (!bridge || !p) return;
  if ("panel" in p) bridge.panel = p.panel;
  if ("narrow" in p) bridge.setNarrow(p.narrow);
  if ("route" in p) bridge.setRoute(p.route);
  if ("hass" in p) bridge.setHass(p.hass);
}
// Nouvel élément dans le même cadre (retour arrière du navigateur depuis son cache) : on y remet la même page,
// sans relancer les scripts ni les écouteurs ; l'historique reprend ses abonnements
function attach(el) {
  bridge.el = el;
  if (ROOT && ROOT.parentNode !== el) el.appendChild(ROOT);
  syncSafeArea();
  const BZ = window.BZ;
  if (BZ && BZ.hist && BZ.hist.resume) BZ.hist.resume();
  if (BZ && BZ.notify) BZ.notify();
}
const impl = {
  setProperties: applyProps,
  connected: (el) => attach(el),
  // Départ du panneau (ou cadre retiré) : rendre à HA tous les abonnements pris sur sa connexion
  disconnected: () => {
    bridge.dispose();
    const BZ = window.BZ;
    if (BZ && BZ.hist && BZ.hist.pause) BZ.hist.pause();
  },
};
export function mount(el, props, info) {
  if (booted) { applyProps(props); attach(el); return impl; }
  bridge = makeBridge(info.version);
  bridge.el = el;
  applyProps(props);
  // L'instantané de hass donné au chargement peut dater de quelques secondes : la page principale a le plus récent
  try { const live = parent.customPanel && parent.customPanel.hass; if (live) bridge.setHass(live); } catch {}
  booted = boot(el, info).catch((e) => { console.error("[Breezy] démarrage impossible :", e); bootError(el, (e && e.message) || e, e && e.detail); });
  return impl;
}
