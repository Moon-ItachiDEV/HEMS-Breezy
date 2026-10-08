// Breezy HEMS V2 — composants d'interface. Chaque fonction renvoie du HTML,
// sans style en ligne (sauf variables CSS de données : couleur, pourcentage).
(() => {
  const BZ = window.BZ;
  const { h, esc, fmt } = BZ;

  /* ─── Icônes : un seul jeu, trait 1,75, grille 24 ─────────────────── */
  const P = {
    overview: '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5" rx="2"/><rect x="13.5" y="11" width="7.5" height="10" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>',
    energy: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z"/>',
    car: '<path d="M5 17H3.5a1 1 0 0 1-1-1v-3.3c0-.5.1-.9.4-1.3L5 8.2A2 2 0 0 1 6.7 7h8.6a2 2 0 0 1 1.5.7L19.5 11l1.4.4c.6.2 1.1.8 1.1 1.4V16a1 1 0 0 1-1 1H19"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>',
    home: '<path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6.5H9V21H4a1 1 0 0 1-1-1z"/>',
    insights: '<path d="M4 20V11M10 20V5M16 20v-6M22 20H2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 11v2"/><path d="M6 10.5v3M9.5 10.5v3"/>',
    grid: '<path d="M7 21 11 3h2l4 18"/><path d="M5.5 8h13M4 14h16"/><path d="m9 14 3-6 3 6"/>',
    bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z"/>',
    plug: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
    flame: '<path d="M12 22c4 0 7-2.8 7-7 0-4.5-4-6.8-4.6-11.5C11.5 5.6 10 8.3 10 10.4c-1-.7-1.8-1.9-2-3.3C6 9.1 5 11.9 5 15c0 4.2 3 7 7 7z"/>',
    drop: '<path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11z"/>',
    thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
    bulb: '<path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4.2 11.4c.7.7 1.2 1.6 1.2 2.6h6c0-1 .5-1.9 1.2-2.6A6.5 6.5 0 0 0 12 2.5z"/>',
    blinds: '<path d="M3 3.5h18M5 3.5V18M19 3.5V18M5 7.5h14M5 11.5h14M5 15.5h14"/><path d="M12 18v3"/>',
    robot: '<rect x="3.5" y="8" width="17" height="12" rx="4"/><path d="M12 4v4M9 14h.01M15 14h.01"/>',
    speaker: '<rect x="5" y="2.5" width="14" height="19" rx="3"/><circle cx="12" cy="14.5" r="3.5"/><path d="M12 7h.01"/>',
    lock: '<rect x="4.5" y="11" width="15" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    unlock: '<rect x="4.5" y="11" width="15" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 7.7-1.5"/>',
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4.2l3 1.8 3-1.8M9 19.8l3-1.8 3 1.8"/>',
    refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6l2.5 2.4"/><path d="M20.5 3.5v5h-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    leaf: '<path d="M5 20.5c0-9.3 5.4-15 15-16-.9 9.9-6.6 15.2-15 16z"/><path d="m5 20.5 8.5-8.5"/>',
    euro: '<path d="M17.5 6.5a7 7 0 1 0 0 11M4 10h9.5M4 14h9.5"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.3 17a9 9 0 1 1 17.4 0"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor"/>',
    prev: '<path d="M18 5.5v13L8.5 12z" fill="currentColor"/><path d="M6 5.5v13"/>',
    next: '<path d="M6 5.5v13L15.5 12z" fill="currentColor"/><path d="M18 5.5v13"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sack: '<path d="M8.5 4h7l-2 4c3 1.6 5.5 4.6 5.5 8.5a4.5 4.5 0 0 1-4.5 4.5h-5A4.5 4.5 0 0 1 5 16.5C5 12.6 7.5 9.6 10.5 8z"/>',
    dock: '<path d="M3 20h18M7 20v-4a5 5 0 0 1 10 0v4"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    power: '<path d="M12 3v8"/><path d="M6.3 7a8 8 0 1 0 11.4 0"/>',
  };
  const icon = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ""}</svg>`;

  /* ─── Valeur + unité (l'unité est toujours plus discrète) ──────────── */
  const val = ([v, u], cls = "") => h`<span class="val ${cls}"><span class="val-n">${v}</span>${u ? h`<span class="val-u">${u}</span>` : ""}</span>`;

  /* ─── Carte ────────────────────────────────────────────────────────
     Un seul modèle : en-tête (icône teintée, titre, sous-titre, action), corps. */
  const card = ({ title, sub, ic, tone, aside, body, cls = "", tag = "section", attrs = "" }) => h`
    <${tag} class="card ${cls}" ${attrs}>
      ${title ? h`<header class="card-h">
        ${ic ? h`<span class="chip" data-tone="${tone || "neutral"}">${icon(ic)}</span>` : ""}
        <div class="card-t"><h3>${title}</h3>${sub ? h`<p>${sub}</p>` : ""}</div>
        ${aside ? h`<div class="card-a">${aside}</div>` : ""}
      </header>` : ""}
      ${body}
    </${tag}>`;

  const badge = (text, tone = "neutral", live = false) => h`<span class="badge ${live ? "is-live" : ""}" data-tone="${tone}">${text}</span>`;
  const delta = (cur, prev, { invert = false, unit = "%" } = {}) => {
    if (!prev) return "";
    const d = unit === "pts" ? (cur - prev) * 100 : ((cur - prev) / prev) * 100;
    if (!Number.isFinite(d) || Math.abs(d) < 0.5) return h`<span class="delta">=</span>`;
    const good = invert ? d < 0 : d > 0;
    return h`<span class="delta ${good ? "is-good" : "is-bad"}">${icon(d > 0 ? "up" : "down")}${fmt.n(Math.abs(d))} ${unit}</span>`;
  };

  /* ─── Contrôles ────────────────────────────────────────────────────
     Tous les contrôles sont de vrais boutons, accessibles au clavier, avec
     un état « en cours » pendant l'appel au service. */
  const btn = ({ label, ic, act, args = {}, kind = "secondary", size = "", pending = false, disabled = false, cls = "", aria }) => h`
    <button class="btn btn-${kind} ${size ? `btn-${size}` : ""} ${cls}" type="button" data-act="${act}" ${dataArgs(args)} ${pending ? 'aria-busy="true"' : ""} ${disabled ? "disabled" : ""} ${aria ? `aria-label="${esc(aria)}"` : ""}>
      ${ic ? icon(ic) : ""}${label ? h`<span>${label}</span>` : ""}
    </button>`;
  const dataArgs = (args) => Object.entries(args).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ");

  const toggle = ({ on, act, args = {}, label, pending = false }) => h`
    <button class="toggle" type="button" role="switch" aria-checked="${String(on)}" aria-label="${esc(label)}" data-act="${act}" ${dataArgs(args)} ${pending ? 'aria-busy="true"' : ""}><span class="toggle-k"></span></button>`;

  const stepper = ({ value, act, args = {}, label, unit = "", pending = false, min, max, cur }) => h`
    <div class="stepper" role="group" aria-label="${esc(label)}">
      <button type="button" data-act="${act}" ${dataArgs({ ...args, d: -1 })} aria-label="Diminuer" ${cur <= min ? "disabled" : ""}>${icon("minus")}</button>
      <output ${pending ? 'aria-busy="true"' : ""}>${value}<small>${unit}</small></output>
      <button type="button" data-act="${act}" ${dataArgs({ ...args, d: 1 })} aria-label="Augmenter" ${cur >= max ? "disabled" : ""}>${icon("plus")}</button>
    </div>`;

  const segmented = ({ name, options, value, label }) => h`
    <div class="seg" role="tablist" aria-label="${esc(label)}" style="--n:${options.length};--i:${Math.max(0, options.findIndex(([k]) => k === value))}">
      <span class="seg-ind" aria-hidden="true"></span>
      ${options.map(([k, l]) => h`<button type="button" role="tab" aria-selected="${String(k === value)}" data-act="set" data-k="${name}" data-value="${k}">${l}</button>`)}
    </div>`;

  // Jauge linéaire : valeur, repère optionnel (limite), couleur de données
  const meter = ({ value, mark, tone = "neutral", label, size = "" }) => h`
    <div class="meter ${size ? `meter-${size}` : ""}" data-tone="${tone}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value)}" ${label ? `aria-label="${esc(label)}"` : ""}>
      <span class="meter-f" style="--v:${BZ.clamp(value, 0, 100)}%"></span>${mark != null ? h`<span class="meter-m" style="--v:${mark}%"></span>` : ""}
    </div>`;

  // Anneau : progression circulaire avec contenu au centre
  const ring = ({ value, tone = "neutral", size = 96, stroke = 8, mark, inner = "", label }) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = BZ.clamp(value, 0, 100);
    return h`<div class="ring" data-tone="${tone}" style="--s:${size}px" role="img" aria-label="${esc(label || `${Math.round(v)} %`)}">
      <svg viewBox="0 0 ${size} ${size}"><circle class="ring-b" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
        <circle class="ring-f" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}"/>
        ${mark != null ? h`<circle class="ring-m" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke + 4}" stroke-dasharray="2 ${c}" stroke-dashoffset="${-c * mark / 100}"/>` : ""}</svg>
      <div class="ring-c">${inner}</div></div>`;
  };

  // Statistique : libellé, grande valeur, contexte
  const stat = ({ label, value, sub, tone, extra = "" }) => h`
    <div class="stat" ${tone ? `data-tone="${tone}"` : ""}><span class="stat-l">${label}</span><span class="stat-v">${value}</span>${sub ? h`<span class="stat-s">${sub}</span>` : ""}${extra}</div>`;

  // État vide : explique pourquoi c'est vide et ce qu'on peut faire
  const empty = ({ ic, title, text, action = "" }) => h`<div class="empty">${icon(ic)}<strong>${title}</strong><p>${text}</p>${action}</div>`;

  // Légende de série (toujours un libellé à côté de la couleur)
  const legend = (items) => h`<ul class="legend">${items.map(([label, tone, v]) => h`<li data-tone="${tone}"><i></i>${label}${v != null ? h`<b>${v}</b>` : ""}</li>`)}</ul>`;

  /* ─── Notifications ───────────────────────────────────────────────── */
  let toastTimer;
  function toast(text, tone = "neutral") {
    const el = document.getElementById("toast");
    el.innerHTML = h`<span class="toast-i" data-tone="${tone}">${icon(tone === "bad" ? "alert" : "check")}</span><span>${esc(text)}</span>`;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2600);
  }

  Object.assign(BZ, { icon, val, card, badge, delta, btn, toggle, stepper, segmented, meter, ring, stat, empty, legend, toast, dataArgs });
})();
