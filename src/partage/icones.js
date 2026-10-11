/* ------------------------------------------------------------ Icônes (traits, 24 × 24) -- partagé */
const TRACE = {
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  maison: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.8 9.4V20h12.4V9.4"/><path d="M10 20v-5.2h4V20"/>',
  batterie: '<rect x="2.5" y="7" width="16.5" height="10" rx="2.2"/><path d="M21.5 10.5v3"/><path d="M6 10v4M9.5 10v4"/>',
  reseau: '<path d="M8 21 11.2 3h1.6L16 21"/><path d="M6.5 8h11M5 13h14"/><path d="M9.2 17.2 14 13M14.8 17.2 10 13"/>',
  borne: '<rect x="4.5" y="3" width="9" height="18" rx="2"/><path d="M4.5 9.5h9"/><path d="M13.5 13h2a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 3 0V9l-2.5-2.5"/><path d="M9.6 12 8 14.6h2.2L8.6 17.2"/>',
  chevron: '<path d="M9 5.5 15.5 12 9 18.5"/>',
  graphique: '<path d="M3.5 20.5h17"/><path d="M6.5 17V11M11 17V6.5M15.5 17v-8M20 17v-4"/>',
  feuille: '<path d="M5 19.5C5 11 10.5 5 20 4.5c0 9.5-6 15-14 15z"/><path d="M5 19.5 13.5 11"/>',
  // la voiture et ses commandes (page Kia, ligne Kia de l'Accueil)
  voiture: '<path d="M5.2 11 6.9 6.9A2.2 2.2 0 0 1 8.9 5.5h6.2a2.2 2.2 0 0 1 2 1.4l1.7 4.1"/><rect x="3.5" y="11" width="17" height="6.5" rx="2.2"/><path d="M6.2 17.5v2M17.8 17.5v2M7 14.2h1.6M15.4 14.2H17"/>',
  verrou: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/><path d="M12 14.4v2.2"/>',
  verrouOuvert: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.3-1.5"/><path d="M12 14.4v2.2"/>',
  ventilateur: '<circle cx="12" cy="12" r="1.7"/><path d="M12 10.3C10.5 7.6 10.9 3.9 13.5 3.6c2.5-.3 3.4 2.6 1.5 4.4-1 .9-2 1.6-3 2.3z"/><path d="M12 10.3C10.5 7.6 10.9 3.9 13.5 3.6c2.5-.3 3.4 2.6 1.5 4.4-1 .9-2 1.6-3 2.3z" transform="rotate(120 12 12)"/><path d="M12 10.3C10.5 7.6 10.9 3.9 13.5 3.6c2.5-.3 3.4 2.6 1.5 4.4-1 .9-2 1.6-3 2.3z" transform="rotate(240 12 12)"/>',
  actualiser: '<path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4"/><path d="M19.6 4.4v3.9h-3.9"/>',
  eclair: '<path d="M13.2 3 5.8 13.2h5.9L10.8 21l7.4-10.2h-5.9z"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.2"/>',
  moins: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  soleilLune: '<circle cx="9.5" cy="13.5" r="3.4"/><path d="M9.5 6.8v1.6M9.5 18.6v1.6M2.8 13.5h1.6M14.6 13.5h1.6M4.8 8.8l1.1 1.1M13.1 17.1l1.1 1.1M4.8 18.2l1.1-1.1"/><path d="M21 7.4a3.3 3.3 0 1 1-3.6-4.3 2.6 2.6 0 0 0 3.6 4.3z"/>',
  b12v: '<rect x="3" y="7.5" width="18" height="11.5" rx="2.2"/><path d="M6.5 7.5V5.5h3v2M14.5 7.5V5.5h3v2"/><path d="M6.6 13.2h3M15 11.7v3M13.5 13.2h3"/>',
  compteur: '<path d="M4.3 17.6a8.6 8.6 0 1 1 15.4 0"/><path d="M12 14.4 15.6 9.2"/><circle cx="12" cy="14.6" r="1.3"/>',
  cle: '<path d="M14.8 6.2a4 4 0 0 0-5.3 5.2l-5.7 5.7a1.6 1.6 0 0 0 2.3 2.3l5.7-5.7a4 4 0 0 0 5.2-5.3l-2.5 2.5-2.1-.5-.5-2.1z"/>',
  retour: '<path d="M15 5.5 8.5 12 15 18.5"/>',
  coche: '<path d="M5 12.6 9.8 17.4 19 7.4"/>'
};
const icone = (nom, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${TRACE[nom] || ''}</svg>`;
/* flèches de sens : ↗ export, ↙ import, ↑ charge, ↓ décharge (la couleur n'est jamais seule) */
const FL_TRACE = {
  export: '<path d="M7 17 17 7M8.5 7H17v8.5"/>',
  import: '<path d="M17 7 7 17M7 8.5V17h8.5"/>',
  haut: '<path d="M12 19.5V5M6.5 10.5 12 5l5.5 5.5"/>',
  bas: '<path d="M12 4.5V19M6.5 13.5 12 19l5.5-5.5"/>'
};
const fleche = nom => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${FL_TRACE[nom]}</svg>`;
