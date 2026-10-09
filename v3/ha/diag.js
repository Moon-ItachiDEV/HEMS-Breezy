// Breezy HEMS — diagnostic du panneau Home Assistant (chargé après sheets.js, dans le panneau HA seulement).
// Vérifie config.js face aux entités que Home Assistant connaît vraiment, et le dit en clair : dans la cloche
// (« Configuration à vérifier »), dans le menu du profil (Diagnostic) et dans un panneau qu'on peut copier.
(() => {
  const BZ = window.BZ, HA = BZ.ha;
  if (!HA) return;
  const { h, esc, icon, btn, C } = BZ;
  const ENTITY = /^[a-z_]+\.[a-z0-9_]+$/;

  // Entités de config.js, chacune avec sa clé (« import_jour_kwh », « lumieres[2] ») pour savoir quoi corriger
  const entries = (() => {
    const out = [], seen = new Set();
    const walk = (v, key) => {
      if (typeof v === "string") { if (ENTITY.test(v) && !seen.has(v)) { seen.add(v); out.push({ id: v, key }); } }
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${key}[${i}]`));
      else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, `${key}.${k}`));
    };
    Object.entries(C).forEach(([k, v]) => walk(v, k));
    return out;
  })();
  // Un bouton n'a pas d'état tant qu'on ne l'a jamais pressé : « unknown » n'est pas un souci pour lui
  const down = (id, s) => s === "unavailable" || (s === "unknown" && !id.startsWith("button."));

  // Unités des compteurs et des puissances : Breezy convertit les compteurs (Wh, MWh → kWh), mais une unité qui n'est pas
  // une énergie, ou qui diffère de celle de sa statistique, mérite un coup d'œil ; les puissances sont attendues en W
  const ENERGY_U = { wh: "Wh", kwh: "kWh", mwh: "MWh" };
  function units(S) {
    const out = [], meta = (BZ.hist && BZ.hist.meta) || [];
    entries.forEach(({ id, key }) => {
      const e = S[id], u = e && e.attributes ? String(e.attributes.unit_of_measurement || "").trim() : "";
      if (!e || !u) return;
      const root = key.replace(/\[\d+\]$/, "");
      if (/_kwh$/.test(root) && !u.includes("/")) {   // pas un prix (€/kWh)
        if (!ENERGY_U[u.toLowerCase()]) out.push({ level: "warn", group: "info", id, key, text: `Unité ${u} : Breezy attend une énergie (kWh, Wh ou MWh).` });
        else if (u !== "kWh") out.push({ level: "info", group: "info", id, key, text: `Compteur en ${u} : converti en kWh par Breezy.` });
        const m = meta.find((x) => x.statistic_id === id), su = m && String(m.display_unit_of_measurement || "").trim();
        if (su && ENERGY_U[u.toLowerCase()] && su !== u) out.push({ level: "warn", group: "info", id, key, text: `Unité ${u} en direct, ${su} dans ses statistiques : vérifie ce capteur (l'historique est converti en kWh, le direct aussi).` });
      } else if (/_w$/.test(root) && /^(kw|mw)$/i.test(u)) out.push({ level: "warn", group: "info", id, key, text: `Unité ${u} : Breezy attend des W pour une puissance (les valeurs seraient 1 000 fois trop petites).` });
    });
    return out;
  }

  /* ─── Points relevés ─────────────────────────────────────────────────
     level : error (à corriger), warn (à vérifier), info (pour comprendre) */
  function issues() {
    const S = HA.states, out = [];
    entries.forEach(({ id, key }) => {
      const e = S[id];
      if (!e) out.push({ level: "error", group: "missing", id, key, text: "Entité introuvable : corrige son nom dans config.js, ou ton compte ne peut pas la voir." });
      else if (down(id, e.state)) out.push({ level: "info", group: "down", id, key, text: "Indisponible en ce moment." });
    });
    units(S).forEach((x) => out.push(x));
    (BZ.hist && BZ.hist.issues ? BZ.hist.issues() : []).forEach((x) => out.push(x));
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (HA.tz && browserTz && HA.tz !== browserTz) out.push({ level: "info", group: "info", text: `Home Assistant est sur ${HA.tz}, ton appareil sur ${browserTz} : les journées et les heures suivent Home Assistant.` });
    if (!(C.prevision_jours_kwh || []).length) out.push({ level: "info", group: "info", text: "Prévisions des jours suivants non configurées (clé prevision_jours_kwh) : pas de barres « prévu » au-delà d'aujourd'hui." });
    if (HA.staleBuild) out.push({ level: "warn", group: "info", text: "Mise à jour incomplète : recopie tout le contenu du dossier breezy, puis recharge la page (Ctrl+Maj+R)." });
    if (HA.staleLoader) out.push({ level: "warn", group: "info", text: `Chargeur breezy-panel.js d'une autre version (gardé en cache) : dans configuration.yaml, mets module_url: /local/breezy/breezy-panel.js?v=${HA.staleLoader.want}, puis redémarre Home Assistant.` });
    if (HA.errors.some((x) => x.code === "home_assistant_error" && /unauthori[sz]ed/i.test(x.message))) out.push({ level: "warn", group: "info", text: "Ton compte Home Assistant est en lecture seule : les commandes sont refusées." });
    else if (HA.hass && HA.hass.user && !HA.isAdmin) out.push({ level: "info", group: "info", text: "Ton compte n'est pas administrateur : c'est normal, Breezy n'en a pas besoin." });
    return out;
  }
  // À compter : ce qui demande une action (pas les infos, ni un refus passager de HA qui se réessaie tout seul)
  const serious = (list) => list.filter((x) => x.level !== "info" && !x.transient);
  BZ.diagCount = () => serious(issues()).length;

  // Cloche : un seul rappel qui mène au panneau ; config.js n'est nommé que si tout s'y corrige (entités introuvables)
  BZ.haAlerts = () => {
    const list = serious(issues()), n = list.length;
    if (!n) return [];
    const cfg = list.every((x) => x.group === "missing");
    return [{ id: "ha-diag", tone: "warn", ic: "alert", title: cfg ? "Configuration à vérifier" : "Points à vérifier", text: cfg ? `${n} entité${n > 1 ? "s" : ""} à corriger dans config.js.` : `${n} point${n > 1 ? "s" : ""} à vérifier : le diagnostic dit quoi faire.`, act: "open-sheet", args: { sheet: "diag" }, cta: "Voir le détail" }];
  };

  // Où en est l'historique (une phrase) : en chargement, en échec, ou d'où il vient
  const histLine = () => {
    const HB = BZ.hist; if (!HB) return "";
    const s = HB.status(), f = Object.keys(HB.fields || {}).length;
    return s.errors ? ` Historique : ${s.errors} échec${s.errors > 1 ? "s" : ""}, nouvel essai automatique.` : s.loading ? " Historique en cours de chargement…" : f ? ` Historique : ${f} compteurs lus dans les statistiques.` : "";
  };

  /* ─── Panneau « Diagnostic Home Assistant » ───────────────────────── */
  const GROUPS = [["missing", "Entités introuvables"], ["history", "Historique"], ["check", "Cohérence"], ["down", "Indisponibles en ce moment"], ["info", "Infos"]];
  const TONE = { error: "bad", warn: "warn", info: "neutral" };
  const row = (x) => h`<div class="row ha-diag-r" data-level="${x.level}"><div><strong>${x.id ? h`<code>${esc(x.id)}</code>` : esc(x.text)}</strong>
    ${x.id ? h`<span>${x.key ? h`clé <code>${esc(x.key)}</code> · ` : ""}${esc(x.text)}</span>` : ""}</div>${BZ.pill(x.level === "error" ? "À corriger" : x.level === "warn" ? "À vérifier" : "Info", TONE[x.level])}</div>`;
  BZ.sheets.diag = () => {
    const list = issues(), n = serious(list).length;
    if (BZ.hist) BZ.hist.sample();   // échantillon brut des statistiques demandé dès l'ouverture, prêt pour « Copier »
    const groups = GROUPS.map(([g, label]) => [label, list.filter((x) => x.group === g)]).filter(([, xs]) => xs.length);
    const copy = BZ.ui.diagCopy;
    return { ic: "alert", tone: n ? "warn" : "good", full: true, title: "Diagnostic Home Assistant",
      sub: `Breezy ${esc(HA.version)}${HA.haVersion ? ` · Home Assistant ${esc(HA.haVersion)}` : ""}`,
      // Groupes enveloppés (leur nombre change pendant que l'historique arrive) : les boutons restent les mêmes nœuds au
      // rendu suivant, et gardent le focus ; la zone de copie manuelle vient après eux
      body: h`<div class="ha-diag">
        <p class="ha-diag-sum">${icon(n ? "alert" : "check")}<span>${n ? `${n} point${n > 1 ? "s" : ""} à corriger ou vérifier.` : "Tout ce que Breezy utilise est bien trouvé dans Home Assistant."} ${entries.length} entités lues dans config.js.${histLine()}</span></p>
        <div class="ha-diag-list">${groups.map(([label, xs]) => h`<section class="ha-diag-g"><h3>${label} <em>${xs.length}</em></h3><div class="rows">${xs.map(row)}</div></section>`)}</div>
        <div class="btn-row">${btn({ label: "Copier le diagnostic", ic: "tasks", act: "diag-copy", kind: "primary" })}${btn({ label: "Recharger l'historique", ic: "refresh", act: "hist-reload" })}${btn({ label: "Recharger Breezy", ic: "refresh", act: "diag-reload", kind: "ghost" })}</div>
        ${copy ? h`<label class="ha-diag-copy"><span>La copie automatique est bloquée : sélectionne ce texte et copie-le.</span><textarea readonly rows="8">${esc(copy)}</textarea></label>` : ""}
      </div>` };
  };

  // Ce qu'on transmet pour vérifier sur les vraies données : jamais de jeton, de nom ni d'adresse
  function report() {
    const list = issues(), S = HA.states;
    return {
      breezy: HA.version, ha_version: HA.haVersion, tz: HA.tz, browser_tz: Intl.DateTimeFormat().resolvedOptions().timeZone, is_admin: HA.isAdmin,
      missing: list.filter((x) => x.group === "missing").map((x) => ({ id: x.id, key: x.key })),
      unavailable: list.filter((x) => x.group === "down").map((x) => ({ id: x.id, key: x.key })),
      issues: list.filter((x) => !x.id).map((x) => `${x.level}: ${x.text}`),
      live: Object.fromEntries(entries.map(({ id, key }) => [key, S[id] ? { state: S[id].state, unit: S[id].attributes && S[id].attributes.unit_of_measurement, state_class: S[id].attributes && S[id].attributes.state_class } : null])),
      // Historique : contrat de chaque compteur (métadonnées), champs retenus, échantillon brut (tous les types), contrôles
      history: BZ.hist ? (({ tz, start, meta, fields, problems, samples, negatives, suspects, checks, chunks }) => ({ tz, start, meta, fields, problems, samples, negatives, suspects, checks, chunks, status: BZ.hist.status() }))(BZ.hist.debug()) : null,
      errors: HA.errors,
    };
  }
  BZ.extraActions = Object.assign(BZ.extraActions || {}, {
    // Presse-papiers : navigator.clipboard n'existe qu'en HTTPS ; en HTTP (homeassistant.local:8123), la copie classique
    // (zone de texte sélectionnée + execCommand, dans le même clic) marche encore ; sinon le texte s'affiche à copier à la main
    "diag-copy": () => {
      const text = JSON.stringify(report(), null, 1);
      const ok = () => { BZ.ui.diagCopy = null; BZ.toast("Diagnostic copié", "good"); BZ.render(); };
      const fallback = () => { BZ.ui.diagCopy = text; BZ.render(); };
      const legacy = () => {
        const ta = document.createElement("textarea"), back = document.activeElement;
        // 16 px : iOS ne zoome pas en lui donnant le focus ; modifiable : sinon iOS ne la sélectionne pas
        ta.value = text; ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0";
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        let done = false;
        try { done = document.execCommand("copy"); } catch {}
        ta.remove();
        if (back && back.focus) back.focus({ preventScroll: true });   // le bouton du panneau garde le focus
        return done;
      };
      if (legacy()) { ok(); return; }
      try { navigator.clipboard.writeText(text).then(ok, fallback); } catch { fallback(); }
    },
    "diag-reload": () => HA.reloadAll(),
  });
  window.BZ_DIAG = Object.assign(window.BZ_DIAG || {}, { issues, report });   // pour la console du navigateur (history : voir history.js)
})();
