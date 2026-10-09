// Voiture (V3) : Kia e-Niro.
// Hero inspiré des applis constructeurs (Tesla, Rivian, Volvo, evcc) : la voiture « posée » sur une seule
// barre de batterie (violet foncé = au branchement, violet = ajouté), repère du niveau actuel et drapeau de
// limite, déroulé de la charge, quatre actions rondes. Puis les recharges de la période et les réglages.
// Chaque information n'apparaît qu'une fois sur la page.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val, card, kpi, pills, delta, btn, toggle, stepper, meter, C, num, st, isOn, esc, clamp } = BZ;

  /* ─── Voiture en vue de profil : Kia Niro EV (SG2) Snow White Pearl, montant C « aero » Aurora Black ──
     Illustration vectorielle en ligne (aucune image externe, identifiants préfixés en-), tournée vers la
     droite et lisible sur fond clair comme sombre. La prise de la Niro est au centre du nez : le câble part
     donc du nez vers la borne murale. .ve-plug (borne, câble, trappe ouverte, fiche) n'existe que branchée,
     .ve-flow (le flux animé, de la borne vers la voiture) seulement en charge. */
  const CAR_ART = `
    <defs>
    <linearGradient id="en-paint" gradientUnits="userSpaceOnUse" x1="0" y1="15" x2="0" y2="178">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".37" stop-color="#f1f4f7"/><stop offset=".42" stop-color="#ffffff"/>
    <stop offset=".48" stop-color="#fbfcfd"/><stop offset=".5" stop-color="#e4e8ed"/><stop offset=".62" stop-color="#f7f9fa"/>
    <stop offset=".64" stop-color="#d8dde4"/><stop offset=".76" stop-color="#eef1f4"/><stop offset=".9" stop-color="#d3d8df"/>
    <stop offset="1" stop-color="#b3bac5"/></linearGradient>
    <linearGradient id="en-chan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e7ec"/><stop offset="1" stop-color="#9aa3ae"/></linearGradient>
    <linearGradient id="en-wrap" gradientUnits="userSpaceOnUse" x1="22" y1="0" x2="543" y2="0">
    <stop offset="0" stop-color="#1f2a3a" stop-opacity=".24"/><stop offset=".05" stop-color="#1f2a3a" stop-opacity="0"/>
    <stop offset=".925" stop-color="#1f2a3a" stop-opacity="0"/><stop offset="1" stop-color="#1f2a3a" stop-opacity=".22"/></linearGradient>
    <linearGradient id="en-glass" gradientUnits="userSpaceOnUse" x1="0" y1="26" x2="0" y2="80">
    <stop offset="0" stop-color="#5b6f87"/><stop offset=".3" stop-color="#2d3a4a"/><stop offset="1" stop-color="#10161d"/></linearGradient>
    <radialGradient id="en-sheen" gradientUnits="userSpaceOnUse" cx="128" cy="24" r="96"><stop offset="0" stop-color="#ffffff" stop-opacity=".2"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="en-refl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
    <linearGradient id="en-blade" gradientUnits="userSpaceOnUse" x1="150" y1="20" x2="36" y2="100">
    <stop offset="0" stop-color="#3f4650"/><stop offset=".42" stop-color="#1b1e23"/><stop offset="1" stop-color="#0a0b0d"/></linearGradient>
    <linearGradient id="en-mir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a636e"/><stop offset=".32" stop-color="#1e2126"/><stop offset="1" stop-color="#08090b"/></linearGradient>
    <linearGradient id="en-clad" gradientUnits="userSpaceOnUse" x1="0" y1="105" x2="0" y2="177">
    <stop offset="0" stop-color="#363a41"/><stop offset=".6" stop-color="#212429"/><stop offset="1" stop-color="#121417"/></linearGradient>
    <radialGradient id="en-arch" cx=".5" cy=".12" r=".95"><stop offset="0" stop-color="#020203"/><stop offset="1" stop-color="#1d2025"/></radialGradient>
    <radialGradient id="en-tyre"><stop offset=".64" stop-color="#1e2024"/><stop offset=".97" stop-color="#191b1e"/><stop offset="1" stop-color="#0c0d0f"/></radialGradient>
    <linearGradient id="en-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3e45"/><stop offset=".5" stop-color="#25282d"/><stop offset="1" stop-color="#2c3036"/></linearGradient>
    <linearGradient id="en-tyrerim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#737a85"/><stop offset=".42" stop-color="#3a3e45" stop-opacity="0"/></linearGradient>
    <linearGradient id="en-lip" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#f3f5f8"/><stop offset=".5" stop-color="#b6bcc5"/><stop offset="1" stop-color="#6a717b"/></linearGradient>
    <radialGradient id="en-disc"><stop offset=".56" stop-color="#555b63"/><stop offset=".8" stop-color="#8a919a"/><stop offset=".93" stop-color="#9aa1a9"/><stop offset="1" stop-color="#4a4f57"/></radialGradient>
    <linearGradient id="en-ins" gradientUnits="userSpaceOnUse" x1="-20" y1="-20" x2="20" y2="20"><stop offset="0" stop-color="#4a5058"/><stop offset="1" stop-color="#2e3238"/></linearGradient>
    <linearGradient id="en-spoke" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#d3d8de"/><stop offset="1" stop-color="#8d949e"/></linearGradient>
    <linearGradient id="en-lamp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34404d"/><stop offset="1" stop-color="#0d1115"/></linearGradient>
    <radialGradient id="en-lens" cx=".4" cy=".35" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#bcd9f2"/><stop offset="1" stop-color="#2d3f52"/></radialGradient>
    <linearGradient id="en-wshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".28" stop-color="#000" stop-opacity="0"/></linearGradient>
    <linearGradient id="en-box" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cdd2d9"/></linearGradient>
    <linearGradient id="en-boxglass" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#3a424d"/><stop offset=".5" stop-color="#1b2027"/><stop offset="1" stop-color="#101318"/></linearGradient>
    <linearGradient id="en-plug" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a616b"/><stop offset=".45" stop-color="#30343b"/><stop offset="1" stop-color="#16181c"/></linearGradient>
    <linearGradient id="en-conduit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8bfc8" stop-opacity="0"/><stop offset="1" stop-color="#b8bfc8" stop-opacity=".9"/></linearGradient>
    <linearGradient id="en-ground" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="640" y2="0"><stop offset="0" stop-color="#8a93a0" stop-opacity="0"/><stop offset=".3" stop-color="#8a93a0" stop-opacity=".3"/><stop offset=".8" stop-color="#8a93a0" stop-opacity=".3"/><stop offset="1" stop-color="#8a93a0" stop-opacity="0"/></linearGradient>
    <clipPath id="en-bodyclip"><path d="M57.6,26.2 C86,22.6 165,18.8 250,16.6 C290,16.3 318,17.4 336,21.2 C362,37.5 392,60.5 409,73.2 C413,74.8 418,75.5 424,76.1 C460,79.8 498,85.4 520,89 C529,90.4 535,92.8 538,96.2 C540.4,99.6 541.2,105 541.6,112 C542.2,124 542.6,132 542.2,141 C541.8,151 539.4,160 534.4,166.6 C531.4,170.4 527.4,172 520,172.6 L486,176.4 C486,141 465,112 437,112 C409,112 388,141 388,176.4 L168,176.4 C168,141 147,112 119,112 C91,112 70,141 70,176.4 L46,172.4 C36,171 30.8,168 28,163.5 C24.6,158 22.8,148 22.6,134 C22.5,124 23.6,112 26.2,100.6 C31.6,81.4 39.4,58.6 46.4,39.4 C46.3,37.2 45.4,35.4 44,34 L43.9,33.2 C46.6,29.6 51,27 57.6,26.2Z"/></clipPath>
    <filter id="en-soft" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="en-blur1" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="1.1"/></filter>
    <filter id="en-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.3"/></filter>
    <filter id="en-blur2" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="en-boxsh" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#0b1220" flood-opacity=".28"/></filter>
    <clipPath id="en-bladeclip"><path d="M151,20 C108.4,21.9 74.3,24.1 57.6,26.2 C51,27 46.6,29.6 43.9,33.2 L44,34 C45.4,35.4 46.3,37.2 46.4,39.4 C39.4,58.6 31.6,81.4 26.2,100.6 C60,96.2 100,88 132.6,81 C137,62 143,42 151,20Z"/></clipPath>
    <g id="en-tyreg">
    <circle r="39" fill="url(#en-tyre)"/>
    <circle r="34.6" fill="none" stroke="url(#en-side)" stroke-width="6"/>
    <circle r="33.4" fill="none" stroke="#4a4f57" stroke-width=".6" stroke-dasharray="9 3 2.5 3 14 4 3 3" opacity=".45"/>
    <circle r="38.5" fill="none" stroke="#3a3f47" stroke-width=".9"/>
    <circle r="38.3" fill="none" stroke="url(#en-tyrerim)" stroke-width="1.3"/>
    <circle r="27.5" fill="#060708"/>
    <circle r="26.5" fill="url(#en-lip)"/>
    <circle r="25.9" fill="none" stroke="#e6e9ee" stroke-width=".6"/>
    <circle r="25.1" fill="#0b0c0f"/>
    <circle r="19.6" fill="url(#en-disc)"/>
    <circle r="17" fill="none" stroke="#2c3036" stroke-width=".5" stroke-dasharray="1 2.2" opacity=".9"/>
    <circle r="11" fill="#2a2e34"/>
    <path d="M-20.8,-6A21.6,21.6 0 0 1 -9.5,-19.4L-6,-12.2A13.6,13.6 0 0 0 -13.1,-3.7Z" fill="#24282e" stroke="#59606a" stroke-width=".4"/>
    </g>
    <g id="en-face">
    <path d="M5.7,-23.7A24.4,24.4 0 0 1 20.8,-12.8L12.9,-8A15.2,15.2 0 0 0 3.6,-14.8ZM24.3,-1.9A24.4,24.4 0 0 1 18.6,15.8L11.6,9.9A15.2,15.2 0 0 0 15.2,-1.2ZM9.3,22.6A24.4,24.4 0 0 1 -9.3,22.6L-5.8,14.1A15.2,15.2 0 0 0 5.8,14.1ZM-18.6,15.8A24.4,24.4 0 0 1 -24.3,-1.9L-15.2,-1.2A15.2,15.2 0 0 0 -11.6,9.9ZM-20.8,-12.8A24.4,24.4 0 0 1 -5.7,-23.7L-3.6,-14.8A15.2,15.2 0 0 0 -12.9,-8Z" fill="url(#en-ins)"/>
    <path d="M5.7,-23.7A24.4,24.4 0 0 1 20.8,-12.8L12.9,-8A15.2,15.2 0 0 0 3.6,-14.8ZM24.3,-1.9A24.4,24.4 0 0 1 18.6,15.8L11.6,9.9A15.2,15.2 0 0 0 15.2,-1.2ZM9.3,22.6A24.4,24.4 0 0 1 -9.3,22.6L-5.8,14.1A15.2,15.2 0 0 0 5.8,14.1ZM-18.6,15.8A24.4,24.4 0 0 1 -24.3,-1.9L-15.2,-1.2A15.2,15.2 0 0 0 -11.6,9.9ZM-20.8,-12.8A24.4,24.4 0 0 1 -5.7,-23.7L-3.6,-14.8A15.2,15.2 0 0 0 -12.9,-8Z" fill="none" stroke="#5f6670" stroke-width=".35"/>
    <path d="M-1.9,-7.4L-5.1,-24.7L-1.7,-25.1L0.7,-7.6ZM-0.7,-7.6L1.7,-25.1L5.1,-24.7L1.9,-7.4ZM6.4,-4L21.9,-12.5L23.4,-9.4L7.4,-1.7ZM7,-3L24.4,-6.1L25,-2.8L7.6,-0.5ZM5.8,4.9L18.6,17L16.2,19.3L3.9,6.5ZM5,5.7L13.4,21.4L10.4,23L2.8,7.1ZM-2.8,7.1L-10.4,23L-13.4,21.4L-5,5.7ZM-3.9,6.5L-16.2,19.3L-18.6,17L-5.8,4.9ZM-7.6,-0.5L-25,-2.8L-24.4,-6.1L-7,-3ZM-7.4,-1.7L-23.4,-9.4L-21.9,-12.5L-6.4,-4Z" fill="#000" opacity=".55" transform="translate(.5 .7)"/>
    <path d="M-1.9,-7.4L-5.1,-24.7L-1.7,-25.1L0.7,-7.6ZM-0.7,-7.6L1.7,-25.1L5.1,-24.7L1.9,-7.4ZM6.4,-4L21.9,-12.5L23.4,-9.4L7.4,-1.7ZM7,-3L24.4,-6.1L25,-2.8L7.6,-0.5ZM5.8,4.9L18.6,17L16.2,19.3L3.9,6.5ZM5,5.7L13.4,21.4L10.4,23L2.8,7.1ZM-2.8,7.1L-10.4,23L-13.4,21.4L-5,5.7ZM-3.9,6.5L-16.2,19.3L-18.6,17L-5.8,4.9ZM-7.6,-0.5L-25,-2.8L-24.4,-6.1L-7,-3ZM-7.4,-1.7L-23.4,-9.4L-21.9,-12.5L-6.4,-4Z" fill="url(#en-spoke)"/>
    <path d="M-1.9,-7.4L-5.1,-24.7L-3.8,-24.9L-0.8,-7.6ZM0.8,-7.6L3.8,-24.9L5.1,-24.7L1.9,-7.4ZM6.4,-4L21.9,-12.5L22.5,-11.3L6.9,-3.1ZM7.4,-1.5L24.9,-4.1L25,-2.8L7.6,-0.5ZM5.8,4.9L18.6,17L17.7,18L5.1,5.6ZM3.8,6.6L11.6,22.4L10.4,23L2.8,7.1ZM-2.8,7.1L-10.4,23L-11.6,22.4L-3.8,6.6ZM-5.1,5.6L-17.7,18L-18.6,17L-5.8,4.9ZM-7.6,-0.5L-25,-2.8L-24.9,-4.1L-7.4,-1.5ZM-6.9,-3.1L-22.5,-11.3L-21.9,-12.5L-6.4,-4Z" fill="#6f7680" opacity=".55"/>
    <circle r="8.8" fill="#2a2e35" stroke="#b4bbc4" stroke-width=".6"/>
    <circle cx="3.5" cy="-4.9" r=".9" fill="#c9cfd6"/>
    <circle cx="5.7" cy="1.9" r=".9" fill="#c9cfd6"/>
    <circle cx="0" cy="6" r=".9" fill="#c9cfd6"/>
    <circle cx="-5.7" cy="1.9" r=".9" fill="#c9cfd6"/>
    <circle cx="-3.5" cy="-4.9" r=".9" fill="#c9cfd6"/>
    <circle r="3.9" fill="#16181c" stroke="#8b929c" stroke-width=".4"/>
    <path d="M-2.3,-.3h4.6" stroke="#d3d8de" stroke-width=".6" stroke-linecap="round"/>
    </g>
    </defs>
    <path d="M8,196.4H632" stroke="url(#en-ground)" stroke-width=".7"/>
    <ellipse cx="282" cy="195.4" rx="268" ry="6.5" fill="#0d1526" opacity=".2" filter="url(#en-soft)"/>
    <ellipse cx="282" cy="194.8" rx="210" ry="2.4" fill="#0d1526" opacity=".25" filter="url(#en-blur1)"/>
    <ellipse cx="119" cy="195.4" rx="31" ry="2.6" fill="#05080f" opacity=".5" filter="url(#en-blur1)"/>
    <ellipse cx="119" cy="195.7" rx="16" ry="1.1" fill="#000" opacity=".6"/>
    <ellipse cx="437" cy="195.4" rx="31" ry="2.6" fill="#05080f" opacity=".5" filter="url(#en-blur1)"/>
    <ellipse cx="437" cy="195.7" rx="16" ry="1.1" fill="#000" opacity=".6"/>
    <path d="M168,176.6 C168,141 147,112 119,112 C91,112 70,141 70,176.6 Z" fill="url(#en-arch)"/>
    <path d="M486,176.6 C486,141 465,112 437,112 C409,112 388,141 388,176.6 Z" fill="url(#en-arch)"/>
    <use href="#en-tyreg" x="119" y="157"/>
    <use href="#en-face" transform="translate(119 157) rotate(8)"/>
    <circle cx="119" cy="157" r="39" fill="url(#en-wshade)"/>
    <use href="#en-tyreg" x="437" y="157"/>
    <use href="#en-face" transform="translate(437 157) rotate(31)"/>
    <circle cx="437" cy="157" r="39" fill="url(#en-wshade)"/>
    <path d="M57.6,26.2 C86,22.6 165,18.8 250,16.6 C290,16.3 318,17.4 336,21.2 C362,37.5 392,60.5 409,73.2 C413,74.8 418,75.5 424,76.1 C460,79.8 498,85.4 520,89 C529,90.4 535,92.8 538,96.2 C540.4,99.6 541.2,105 541.6,112 C542.2,124 542.6,132 542.2,141 C541.8,151 539.4,160 534.4,166.6 C531.4,170.4 527.4,172 520,172.6 L486,176.4 C486,141 465,112 437,112 C409,112 388,141 388,176.4 L168,176.4 C168,141 147,112 119,112 C91,112 70,141 70,176.4 L46,172.4 C36,171 30.8,168 28,163.5 C24.6,158 22.8,148 22.6,134 C22.5,124 23.6,112 26.2,100.6 C31.6,81.4 39.4,58.6 46.4,39.4 C46.3,37.2 45.4,35.4 44,34 L43.9,33.2 C46.6,29.6 51,27 57.6,26.2Z" fill="url(#en-paint)"/>
    <g clip-path="url(#en-bodyclip)">
    <rect x="20" y="10" width="525" height="170" fill="url(#en-wrap)"/>
    <path d="M506,118.8 C420,118.7 300,118.6 30,118.6" fill="none" stroke="#ffffff" stroke-width=".9"/>
    <path d="M383.6,141 C330,139 250,135 172.6,129.4" fill="none" stroke="#5d6b7d" stroke-width="8" opacity=".22" transform="translate(0 5)" filter="url(#en-blur2)"/>
    <path d="M383.6,141 C330,139 250,135 172.6,129.4" fill="none" stroke="#ffffff" stroke-width="5" opacity=".9" transform="translate(0 -2.4)" filter="url(#en-glow)"/>
    </g>
    <path d="M383.6,141 C330,139 250,135 172.6,129.4" fill="none" stroke="#bcc4ce" stroke-width=".5"/>
    <path d="M506,96.6 C420,95.4 300,94 140,92.6" fill="none" stroke="#a9b2be" stroke-width="2.2" opacity=".55" filter="url(#en-glow)"/>
    <path d="M507,94.6 C420,93.4 300,92 140,90.6" fill="none" stroke="#ffffff" stroke-width="1"/>
    <path d="M507,95.4 C420,94.2 300,92.8 140,91.4" fill="none" stroke="#c3cad3" stroke-width=".45"/>
    <path d="M395.6,82 C393.4,96 390.6,108 388,120 C386.4,127 384.6,137 383.6,146 M262,80.6 C261.4,108 260.6,135 259.8,161.6 M134.4,81.2 C135.6,92 141,100 150.6,105.6 C158,110 164,114.4 168.6,121.6 C171.4,127 172.8,133 173.6,140 L175.6,161.2 M514,90.4 C512,101 503,113.4 486.6,126 M25.6,108 C40,108.4 53,110.8 60.6,116 C64.6,119 67.4,122.6 70,126.6" fill="none" stroke="#ffffff" stroke-width=".6" stroke-linecap="round" transform="translate(.7 .2)"/>
    <path d="M395.6,82 C393.4,96 390.6,108 388,120 C386.4,127 384.6,137 383.6,146 M262,80.6 C261.4,108 260.6,135 259.8,161.6 M134.4,81.2 C135.6,92 141,100 150.6,105.6 C158,110 164,114.4 168.6,121.6 C171.4,127 172.8,133 173.6,140 L175.6,161.2 M514,90.4 C512,101 503,113.4 486.6,126 M25.6,108 C40,108.4 53,110.8 60.6,116 C64.6,119 67.4,122.6 70,126.6" fill="none" stroke="#949ca8" stroke-width=".7" stroke-linecap="round"/>
    <ellipse cx="317" cy="102.4" rx="10.5" ry="2.6" fill="#bfc6cf" opacity=".7"/>
    <rect x="307.5" y="98.8" width="17" height="3.6" rx="1.8" fill="#fbfcfd" stroke="#8f97a2" stroke-width=".6"/>
    <path d="M309.5,99.7 L322.5,99.7" stroke="#ffffff" stroke-width=".7" stroke-linecap="round"/>
    <ellipse cx="197" cy="102.4" rx="10.5" ry="2.6" fill="#bfc6cf" opacity=".7"/>
    <rect x="187.5" y="98.8" width="17" height="3.6" rx="1.8" fill="#fbfcfd" stroke="#8f97a2" stroke-width=".6"/>
    <path d="M189.5,99.7 L202.5,99.7" stroke="#ffffff" stroke-width=".7" stroke-linecap="round"/>
    <path d="M396.5,80.6 C380,64 352,37 329.5,28.2 C327,27 324,26.4 320,26.4 L153.6,27.2 C152,27.2 151,27.9 150.6,29.2 C146,45.6 140,62 135.6,79.4 C230,79.7 320,80.1 396.5,80.6 Z" fill="#111316"/>
    <path d="M391.2,78.6 C376,63.5 352,40.5 331,30.6 C328.6,29.6 326.4,29.2 323.4,29.2 L268.6,29.5 L266.2,78.4 C310,78.6 352,78.6 391.2,78.6 Z" fill="url(#en-glass)"/>
    <path d="M258.4,29.7 L155.6,30.3 C154.4,30.3 153.6,30.9 153.2,31.9 C149,47 143.6,62 139.4,77.4 C186,77.6 224,77.9 256.2,78.1 Z" fill="url(#en-glass)"/>
    <path d="M296,49 C296,43.5 299.5,41 304,41 C308.5,41 311,43.5 311,48 L310.6,55 C307,56.2 300,56.2 296.6,55 Z" fill="#3c4755" opacity=".55"/>
    <path d="M194,50 C194,44.5 197.5,42 202,42 C206.5,42 209,44.5 209,49 L208.6,56 C205,57.2 198,57.2 194.6,56 Z" fill="#3c4755" opacity=".5"/>
    <path d="M352,69 C350,60 354,53 362,51" fill="none" stroke="#3c4755" stroke-width="2" opacity=".5" stroke-linecap="round"/>
    <path d="M226,29.8 L250,29.8 L232,78 L206,78 Z M258,29.8 L262,29.8 L244,78 L238,78 Z" fill="#ffffff" opacity=".07"/>
    <path d="M322,29.2 L346,29.2 L370,52 L360,78 L330,78 Z" fill="#ffffff" opacity=".055"/>
    <path d="M156,31.2 L258,30.6 L258,36.6 C220,35.8 190,36.4 154.2,38.8 Z" fill="#a3b6cc" opacity=".14"/>
    <path d="M268.8,30.2 L324,30 C334,32 346,38 356,46 C330,38.5 300,36 268.6,36.8 Z" fill="#a3b6cc" opacity=".13"/>
    <path d="M258.4,28.8 L268.8,28.7 L266.4,79 L256.2,79 Z" fill="#0c0d0f"/>
    <path d="M268.4,29.6 L266.2,78.6" stroke="#4a515b" stroke-width=".5"/>
    <path d="M133.6,80.2 C230,80.5 320,81 396.4,81.6" fill="none" stroke="#e8ecf0" stroke-width="1.15" stroke-linecap="round"/>
    <path d="M133.8,81.4 C230,81.7 320,82.2 396,82.8" fill="none" stroke="#8a929d" stroke-width=".5"/>
    <path d="M339.6,22.6 C363,39 392,61.4 408,73.2" fill="none" stroke="#28303a" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M341,23 C364,39.2 392.6,61 408.4,72.6" fill="none" stroke="#8fa0b4" stroke-width=".5" opacity=".8"/>
    <path d="M151,20 L154.2,19.9 C153.6,22.9 153,26.3 152.4,29.1 C147,45.6 141,62 136.4,80.8 L132.6,81 C137,62 143,42 151,20Z" fill="url(#en-chan)"/>
    <path d="M151,20 C108.4,21.9 74.3,24.1 57.6,26.2 C51,27 46.6,29.6 43.9,33.2 L44,34 C45.4,35.4 46.3,37.2 46.4,39.4 C39.4,58.6 31.6,81.4 26.2,100.6 C60,96.2 100,88 132.6,81 C137,62 143,42 151,20Z" fill="url(#en-blade)"/>
    <g clip-path="url(#en-bladeclip)">
    <path d="M151,20 C108.4,21.9 74.3,24.1 57.6,26.2 C51,27 46.6,29.6 43.9,33.2 L44,34 C45.4,35.4 46.3,37.2 46.4,39.4 C39.4,58.6 31.6,81.4 26.2,100.6 C60,96.2 100,88 132.6,81 C137,62 143,42 151,20Z" fill="url(#en-sheen)"/>
    <path d="M104,14 L124,14 L100,104 L80,104 Z" fill="url(#en-refl)" opacity=".18"/>
    <path d="M129,14 L134.5,14 L110.5,104 L105,104 Z" fill="#ffffff" opacity=".1"/>
    <path d="M44,35.4 C50,30.6 60,28 74,26.2" fill="none" stroke="#000" stroke-width="2.4" opacity=".55" filter="url(#en-blur1)"/>
    </g>
    <path d="M43.9,33.2 C46.6,29.6 51,27 57.6,26.2 C61.9,25.7 67.5,25.1 74,24.5 L74.2,26.2 C63,27.6 52,29.9 45.4,34.6 C44.8,34.6 44.2,34.4 44,34 Z" fill="#23272d"/>
    <path d="M26.2,100.6 C60,96.2 100,88 132.6,81" fill="none" stroke="#6b7480" stroke-width=".55"/>
    <path d="M57.6,26.2 C74.3,24.1 108.4,21.9 151,20 C143,42 137,62 132.6,81" fill="none" stroke="#aab3be" stroke-width=".6" opacity=".9"/>
    <path d="M43.9,33.2 C46.6,29.6 51,27 57.6,26.2" fill="none" stroke="#aab3be" stroke-width=".6" opacity=".9"/>
    <path d="M46.4,39.6 C46.6,41 46.3,42.4 45.8,44 C40.6,61.4 35,80 31.8,97.6 L46.4,95.6 C48.4,95.4 48.8,98.6 46.8,99.2 L29.4,103.4 C27,103.9 25.6,102.2 26,99.6 C30.4,80 37,59 43.8,41.4 C44.4,40.4 45.4,39.6 46.4,39.6 Z" fill="#3c0a11"/>
    <path d="M45,42.4 C38.6,61 33.2,81 29.4,100.4 L45.8,97.6" fill="none" stroke="#ff4a63" stroke-width="3" opacity=".55" stroke-linejoin="round" filter="url(#en-glow)"/>
    <path class="ve-tail" d="M45,42.4 C38.6,61 33.2,81 29.4,100.4 L45.8,97.6" fill="none" stroke="#ff2d4a" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M82.6,24.1 L86,19.7 L96,19.1 L106,18.4 L116,17.8 L126,17.3 L136,16.8 L146,16.3 L156,15.9 L166,15.5 L176,15.1 L186,14.7 L196,14.3 L206,14 L216,13.7 L226,13.4 L236,13.1 L246,12.8 L256,12.7 L266,12.7 L276,12.7 L286,12.9 L296,13.2 L296,13.2 L299.6,17.5 L296,16.2 L296,16.2 L286,15.9 L276,15.7 L266,15.7 L256,15.7 L246,15.8 L236,16.1 L226,16.4 L216,16.7 L206,17 L196,17.3 L186,17.7 L176,18.1 L166,18.5 L156,18.9 L146,19.3 L136,19.8 L126,20.3 L116,20.8 L106,21.4 L96,22.1 L86,22.7 Z" fill="#1c1f24"/>
    <path d="M86,19.6 L96,19 L106,18.3 L116,17.7 L126,17.2 L136,16.7 L146,16.2 L156,15.8 L166,15.4 L176,15 L186,14.6 L196,14.2 L206,13.9 L216,13.6 L226,13.3 L236,13 L246,12.7 L256,12.6 L266,12.6 L276,12.6 L286,12.8 L296,13.1 L296,13.1" fill="none" stroke="#8d95a0" stroke-width=".6" stroke-linecap="round"/>
    <path d="M156,19.6 L156.8,18.2 L286,15.2 L286.8,16.6 Z" fill="#ffffff" opacity=".85"/>
    <path d="M62,26.1 C65.6,20.1 70.4,17.3 76.4,17.3 L78,24.5 Z" fill="#16181c"/>
    <path d="M64,24.9 C67,19.9 71,18 75.8,17.9" fill="none" stroke="#7c8591" stroke-width=".5"/>
    <path d="M509,88.2 C520,89.2 530,90.8 535.6,93.6 C538.8,95.4 540.6,99.2 541,103.4 C541.2,105.6 540.2,106.6 538.2,106.8 L533.6,107.4" fill="none" stroke="#14171b" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M532.4,106.6 C536.6,105.6 540,106.4 541.9,108.4 L542.5,134.2 C539.2,135.8 535.2,136 532,134.8 C530.8,125 531,115.4 532.4,106.6 Z" fill="url(#en-lamp)" stroke="#07080a" stroke-width=".5"/>
    <path d="M533.4,108 C536.8,107.2 539.4,107.8 541,109.2 L541.4,133.2 C538.8,134.4 535.6,134.6 533,133.8" fill="none" stroke="#a7b3c1" stroke-width=".45" opacity=".8"/>
    <path d="M509,88.2 C520,89.2 530,90.8 535.6,93.6 C538.8,95.4 540.6,99.2 541,103.4 C541.2,105.6 540.2,106.6 538.2,106.8 L533.6,107.4" fill="none" stroke="#bfe6ff" stroke-width="3" stroke-linecap="round" opacity=".6" filter="url(#en-glow)"/>
    <path class="ve-drl" d="M509,88.2 C520,89.2 530,90.8 535.6,93.6 C538.8,95.4 540.6,99.2 541,103.4 C541.2,105.6 540.2,106.6 538.2,106.8 L533.6,107.4" fill="none" stroke="#f2fbff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <g id="en-cube"><rect x="533.9" y="110.3" width="6" height="5.2" rx="1.3" fill="#040506"/><rect x="534.4" y="110.8" width="5" height="4.2" rx=".9" fill="#141a21" stroke="#56626f" stroke-width=".3"/><circle cx="536.9" cy="112.9" r="1.45" fill="url(#en-lens)"/></g>
    <use href="#en-cube" y="5.8"/>
    <use href="#en-cube" y="11.6"/>
    <use href="#en-cube" y="17.4"/>
    <path d="M533,108.4 L537,107.4 L533.6,124 Z" fill="#ffffff" opacity=".1"/>
    <path d="M541.2,104.6 C541.8,108 542,111 542.1,114" fill="none" stroke="#9aa2ad" stroke-width=".5"/>
    <path d="M391.6,83.6 C392.8,85.6 393.2,87.6 393.2,89.8 L400.8,89.6 C399.6,87.6 399,85.6 399,83.4 Z" fill="#101215"/>
    <path d="M378.6,74.6 C379.4,71.6 384,70.2 390,69.2 C395.6,68.3 401.2,68.4 404.2,70.4 C407,72.4 407.6,76.6 406.4,80 C405.4,82.8 402.6,84.4 398.6,84.6 L385,84.8 C381,84.8 378.6,83 378.2,80.2 C378,78.2 378.1,76.4 378.6,74.6 Z" fill="url(#en-mir)" stroke="#060708" stroke-width=".3"/>
    <path d="M380.4,73.4 C383,71.4 388,70.4 393,69.8 C397.6,69.3 401.6,69.5 403.8,70.9" fill="none" stroke="#c3cad3" stroke-width=".7" stroke-linecap="round" opacity=".75"/>
    <path d="M383,72.2 C388,70.8 396,70 401.8,70.6 C396,71.4 389,72.4 383.6,73.6 Z" fill="#ffffff" opacity=".22"/>
    <path d="M404.6,71.4 C406.6,73.6 407,77 406,80" fill="none" stroke="#8d96a1" stroke-width=".55" stroke-linecap="round" opacity=".8"/>
    <path d="M384.6,83.8 L401,83.4" stroke="#ffb35c" stroke-width=".8" stroke-linecap="round" opacity=".9"/>
    <path d="M63.5,150 L70.5,127 C79,113.6 95,106.6 119,106.2 C143,106.6 159,113.6 167.5,127 L174.5,150" fill="none" stroke="#8592a3" stroke-width="3" opacity=".35" filter="url(#en-glow)"/>
    <path d="M381.5,150 L388.5,127 C397,113.6 413,106.6 437,106.2 C461,106.6 477,113.6 485.5,127 L492.5,150" fill="none" stroke="#8592a3" stroke-width="3" opacity=".35" filter="url(#en-glow)"/>
    <g clip-path="url(#en-bodyclip)">
    <path d="M18,159.6 C30,160 48,161 62.8,161.8 L63.5,150 L70.5,127 C79,113.6 95,106.6 119,106.2 C143,106.6 159,113.6 167.5,127 L174.5,150 L175.2,161.2 L380.8,161.4 L381.5,150 L388.5,127 C397,113.6 413,106.6 437,106.2 C461,106.6 477,113.6 485.5,127 L492.5,150 L493.3,163.6 C512,163.2 528,161.4 546,157.4 L546,182 L16,182 Z" fill="url(#en-clad)"/>
    <path d="M18,159.6 C30,160 48,161 62.8,161.8 L63.5,150 L70.5,127 C79,113.6 95,106.6 119,106.2 C143,106.6 159,113.6 167.5,127 L174.5,150 L175.2,161.2 L380.8,161.4 L381.5,150 L388.5,127 C397,113.6 413,106.6 437,106.2 C461,106.6 477,113.6 485.5,127 L492.5,150 L493.3,163.6 C512,163.2 528,161.4 546,157.4" fill="none" stroke="#69717c" stroke-width=".6"/>
    <path d="M167.6,150 C165,128 147,112.4 119,112.4 C91,112.4 73,128 70.4,150" fill="none" stroke="#4a5059" stroke-width=".7"/>
    <path d="M485.6,150 C483,128 465,112.4 437,112.4 C409,112.4 391,128 388.4,150" fill="none" stroke="#4a5059" stroke-width=".7"/>
    <path d="M177,168 L379.6,168.2" stroke="#4d535c" stroke-width=".7"/>
    <path d="M177,168.8 L379.6,169" stroke="#08090b" stroke-width=".5"/>
    <path d="M510,170 L535,166.4" stroke="#a3abb5" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M534.6,140.6 C537.4,140.2 540.2,140.4 542.6,141.2 L542.4,152.8 C539.8,153.8 537,154 534.4,153.6 C533.8,149.4 533.9,144.8 534.6,140.6 Z" fill="#14171b"/>
    <path d="M535.4,144 L541.6,144 M535.2,147.2 L541.6,147.2 M535.2,150.4 L541.6,150.4" stroke="#3e444d" stroke-width=".6"/>
    <path d="M28,167.4 L52,168.6" stroke="#a3abb5" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M24.6,148.4 L36,149" stroke="#7a1420" stroke-width="2" stroke-linecap="round"/>
    </g>
    <path d="M57.6,26.2 C86,22.6 165,18.8 250,16.6 C290,16.3 318,17.4 336,21.2 C362,37.5 392,60.5 409,73.2 C413,74.8 418,75.5 424,76.1 C460,79.8 498,85.4 520,89 C529,90.4 535,92.8 538,96.2 C540.4,99.6 541.2,105 541.6,112 C542.2,124 542.6,132 542.2,141 C541.8,151 539.4,160 534.4,166.6 C531.4,170.4 527.4,172 520,172.6 L486,176.4 C486,141 465,112 437,112 C409,112 388,141 388,176.4 L168,176.4 C168,141 147,112 119,112 C91,112 70,141 70,176.4 L46,172.4 C36,171 30.8,168 28,163.5 C24.6,158 22.8,148 22.6,134 C22.5,124 23.6,112 26.2,100.6 C31.6,81.4 39.4,58.6 46.4,39.4 C46.3,37.2 45.4,35.4 44,34 L43.9,33.2 C46.6,29.6 51,27 57.6,26.2Z" fill="none" stroke="#7d8692" stroke-width=".75" stroke-linejoin="round"/>`;
  const CAR_PLUG = [`
    <ellipse cx="575" cy="195.4" rx="11" ry="1.3" fill="#0d1526" opacity=".16" filter="url(#en-blur1)"/>
    <rect x="591.8" y="34" width="3.4" height="40" rx="1.2" fill="url(#en-conduit)"/>
    <rect x="572.5" y="72" width="42" height="64" rx="9.5" fill="url(#en-box)" stroke="#8d95a0" stroke-width=".8" filter="url(#en-boxsh)"/>
    <rect x="576" y="75.5" width="35" height="57" rx="7" fill="url(#en-boxglass)"/>
    <path d="M577.6,82 C580,77.5 584,77 590,77 L603,77 L583,130 C579.6,130 577.6,128 577.6,125 Z" fill="#ffffff" opacity=".07"/>
    <circle cx="593.5" cy="98" r="8.2" fill="none" stroke="#56606d" stroke-width="1.1"/>
    <circle cx="593.5" cy="98" r="8.2" fill="none" stroke="#c9d1db" stroke-width="1.1" stroke-dasharray="9 43" stroke-linecap="round" transform="rotate(-140 593.5 98)"/>
    <path d="M594.6,92.5 L590.8,98.6 L593.6,98.6 L592.4,103.5 L596.2,97.3 L593.4,97.3 Z" fill="#8e98a6"/>
    <rect class="ve-box-led" x="585" y="119" width="17" height="2.6" rx="1.3" fill="#a855c7"/>
    <rect x="589" y="136" width="9" height="4.5" rx="1.5" fill="#2a2e34"/>
    <rect x="617.5" y="90" width="7.5" height="18" rx="2.6" fill="url(#en-box)" stroke="#8d95a0" stroke-width=".7"/>
    <rect x="619.6" y="93.5" width="3.3" height="9" rx="1.4" fill="#1d2127"/>
    <path class="ve-cable" d="M593.5,138 C593.5,162 590,186.5 575,187.6 C561,188.6 562,140 554,127.4" fill="none" stroke="#24282e" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M593.5,138 C593.5,162 590,186.5 575,187.6 C561,188.6 562,140 554,127.4" fill="none" stroke="#8a919c" stroke-width=".7" stroke-linecap="round" opacity=".8" transform="translate(-.6 -.8)"/>`, `
    <path d="M538.6,106.4 L545.2,99.2 L547.8,101.2 L541.6,108.6 Z" fill="#c3cad3"/>
    <path d="M538.6,106.4 L545.2,99.2 L546.4,100.1 L539.6,107.2 Z" fill="#fbfcfd" stroke="#8f97a2" stroke-width=".5" stroke-linejoin="round"/>
    <path d="M538.2,107.8 L541.4,107.8 L541.8,121.6 L538.6,121.6 Z" fill="#0d0f12"/>
    <path d="M540.2,109.4 L546.4,109 C549.4,108.8 551.6,110.2 552.8,112.6 L557.4,122.4 C558.4,124.8 557.2,127.6 554.4,127.8 L549.6,128 C547.4,128.1 546,127 545.2,125 L543.8,121.8 L540.6,121.8 Z" fill="url(#en-plug)" stroke="#0c0d10" stroke-width=".5" stroke-linejoin="round"/>
    <path d="M542,110.4 L546.4,110.1 C548.6,110 550.2,111 551.2,112.8 L555.2,121.4" fill="none" stroke="#9aa2ad" stroke-width=".6" stroke-linecap="round"/>
    <path d="M544.6,113.6 L548.2,113.4" stroke="#a855c7" stroke-width="1.2" stroke-linecap="round"/>`];
  const CAR_FLOW = `<path class="ve-flow" d="M593.5,138 C593.5,162 590,186.5 575,187.6 C561,188.6 562,140 554,127.4" fill="none" stroke="#a855c7" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2 9"/>`;

  /* ─── Voiture en vue de profil : roadster sport électrique (illustration originale) ──
     Rouge corail métallisé, carbone, étriers violets (couleur VE de l'app). Même principe que la Niro :
     .ve-plug (borne, câble, trappe ouverte, fiche) seulement branchée, .ve-flow seulement en charge. */
  const RD_ART = `
<defs>
<path id="rd-body" d="M49,165.6 C43.4,160.2 39.6,152.4 37.4,143.4 C35.2,134.4 34,122.4 33.8,112.4 C33.7,106.4 33.9,101 34.4,97.8 L31.4,95.6 L30.8,92 C34,92.2 38.2,95 43,97.6 C45.6,98.9 48.4,99.4 52,99.4 C56.6,99.4 59.6,98.6 64,97.8 C74,96.4 86,95.6 98,95.2 C108,94.6 122,92.4 136,89.6 C148,87.2 160,82.6 170,77.8 C179,74.1 187,71.2 193.2,72 C197.4,72.8 199.6,76.4 199.9,81.6 L200.6,97.6 L338.6,98.9 C372,99.3 410,100.3 441,101.4 C474,102.6 504,107.4 524,113.8 C534,117.4 541.4,123.4 545.2,131.4 C548,137.6 549.8,143 550,148.6 C550.2,154.6 548.6,161.4 547,167 C546,170.8 544.8,173.8 543,175.6 L541,179.5 L478.1,179.5 A44.4,44.4 0 1 0 404,179.5 L176,179.5 A44.4,44.4 0 1 0 101.9,179.5 L86,179.5 C70,179.1 56,172.4 49,165.6 Z"/><clipPath id="rd-clip"><use href="#rd-body"/></clipPath>
<linearGradient id="rd-paint" gradientUnits="userSpaceOnUse" x1="0" y1="92" x2="0" y2="182"><stop offset="0" stop-color="#f6687c"/><stop offset=".08" stop-color="#e03652"/><stop offset=".25" stop-color="#cb2541"/><stop offset=".48" stop-color="#ab1c36"/><stop offset=".6" stop-color="#bd2741"/><stop offset=".636" stop-color="#e65b71"/><stop offset=".652" stop-color="#6e0d21"/><stop offset=".8" stop-color="#560a1a"/><stop offset="1" stop-color="#36050f"/></linearGradient>
<linearGradient id="rd-upper" gradientUnits="userSpaceOnUse" x1="0" y1="98" x2="0" y2="136"><stop offset="0" stop-color="#ffb3be" stop-opacity=".35"/><stop offset=".25" stop-color="#ff8193" stop-opacity=".06"/><stop offset=".75" stop-color="#ff8496" stop-opacity=".05"/><stop offset="1" stop-color="#ffc2cb" stop-opacity=".38"/></linearGradient>
<linearGradient id="rd-under" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a0410" stop-opacity=".6"/><stop offset=".5" stop-color="#3a0410" stop-opacity=".15"/><stop offset="1" stop-color="#3a0410" stop-opacity="0"/></linearGradient>
<linearGradient id="rd-hump" gradientUnits="userSpaceOnUse" x1="0" y1="71" x2="0" y2="98"><stop offset="0" stop-color="#ffc0ca" stop-opacity=".7"/><stop offset=".35" stop-color="#ff7a8e" stop-opacity=".25"/><stop offset="1" stop-color="#7a0e22" stop-opacity=".25"/></linearGradient>
<radialGradient id="rd-haunch" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffc4cd" stop-opacity=".55"/><stop offset=".5" stop-color="#ff8a9c" stop-opacity=".18"/><stop offset="1" stop-color="#ff8a9c" stop-opacity="0"/></radialGradient>
<linearGradient id="rd-endR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a030a" stop-opacity=".6"/><stop offset="1" stop-color="#2a030a" stop-opacity="0"/></linearGradient>
<linearGradient id="rd-endF" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a030a" stop-opacity="0"/><stop offset="1" stop-color="#2a030a" stop-opacity=".55"/></linearGradient>
<linearGradient id="rd-spec" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="rd-soft" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".13"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="rd-sbox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#ffe3e8" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="rd-tsh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="rd-dk" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2a030a" stop-opacity=".3"/><stop offset="1" stop-color="#2a030a" stop-opacity="0"/></radialGradient>
<linearGradient id="rd-carbon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5059"/><stop offset=".3" stop-color="#1c1f24"/><stop offset="1" stop-color="#08090b"/></linearGradient>
<pattern id="rd-cf" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.2" height="1.2" fill="#3a3e45"/><rect x="1.2" y="1.2" width="1.2" height="1.2" fill="#3a3e45"/></pattern>
<linearGradient id="rd-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3edf6" stop-opacity=".5"/><stop offset=".4" stop-color="#9fb2c4" stop-opacity=".32"/><stop offset="1" stop-color="#2a3644" stop-opacity=".42"/></linearGradient>
<linearGradient id="rd-seat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a707a"/><stop offset=".3" stop-color="#33373e"/><stop offset="1" stop-color="#16181b"/></linearGradient>
<linearGradient id="rd-seat2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa0a9"/><stop offset=".35" stop-color="#5a5f68"/><stop offset="1" stop-color="#2c2f35"/></linearGradient>
<linearGradient id="rd-intake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020203"/><stop offset=".75" stop-color="#121418"/><stop offset="1" stop-color="#30353c"/></linearGradient>
<linearGradient id="rd-scoop" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#3a0410" stop-opacity="0"/><stop offset=".6" stop-color="#3a0410" stop-opacity=".55"/><stop offset="1" stop-color="#1a0207" stop-opacity=".9"/></linearGradient>
<linearGradient id="rd-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2465f"/><stop offset=".5" stop-color="#b41f3a"/><stop offset="1" stop-color="#6e0d21"/></linearGradient>
<radialGradient id="rd-tyre" cx=".5" cy=".5" r=".5"><stop offset=".72" stop-color="#2c2f35"/><stop offset=".86" stop-color="#1c1e22"/><stop offset=".97" stop-color="#121316"/><stop offset="1" stop-color="#0b0c0e"/></radialGradient>
<linearGradient id="rd-lip" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#b9c0c9"/><stop offset="1" stop-color="#5d646d"/></linearGradient>
<radialGradient id="rd-barrel" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2a2e34"/><stop offset=".75" stop-color="#15171a"/><stop offset="1" stop-color="#050506"/></radialGradient>
<radialGradient id="rd-disc" cx=".4" cy=".35" r=".65"><stop offset="0" stop-color="#aab0b8"/><stop offset=".6" stop-color="#6f757d"/><stop offset="1" stop-color="#3f444a"/></radialGradient>
<linearGradient id="rd-cal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c27ad8"/><stop offset="1" stop-color="#7b3596"/></linearGradient>
<linearGradient id="rd-spk1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3f5f8"/><stop offset=".55" stop-color="#b6bdc6"/><stop offset="1" stop-color="#7d858f"/></linearGradient>
<linearGradient id="rd-spk2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a8b0ba"/><stop offset=".55" stop-color="#6c747e"/><stop offset="1" stop-color="#454b53"/></linearGradient>
<linearGradient id="rd-hub" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1f4"/><stop offset="1" stop-color="#4d545d"/></linearGradient>
<linearGradient id="rd-flap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ea5068"/><stop offset=".5" stop-color="#b41f3a"/><stop offset="1" stop-color="#6e0d21"/></linearGradient>
<linearGradient id="rd-box" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cdd2d9"/></linearGradient>
<linearGradient id="rd-boxglass" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#3a424d"/><stop offset=".5" stop-color="#1b2027"/><stop offset="1" stop-color="#101318"/></linearGradient>
<linearGradient id="rd-conduit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8bfc8" stop-opacity="0"/><stop offset="1" stop-color="#b8bfc8" stop-opacity=".9"/></linearGradient>
<linearGradient id="rd-plug" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="1" stop-color="#9aa2ad"/></linearGradient>
<filter id="rd-boxsh" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#0b1220" flood-opacity=".28"/></filter>
<filter id="rd-b1" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="1.2"/></filter>
<filter id="rd-b3" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="rd-glow" x="-30%" y="-300%" width="160%" height="700%"><feGaussianBlur stdDeviation=".9"/></filter>
<g id="rd-wb"><circle r="41" fill="url(#rd-tyre)"/><circle r="40.6" stroke="#5f6670" stroke-width=".5" opacity=".55"/><path d="M0,-40A40,40 0 1 0 0,40A40,40 0 1 0 0,-40ZM0,-31.4A31.4,31.4 0 1 1 0,31.4A31.4,31.4 0 1 1 0,-31.4Z" fill="url(#rd-tsh)"/><circle r="32.4" stroke="#34383e" stroke-width=".5"/><circle r="30.9" fill="url(#rd-lip)"/><circle r="29.4" fill="url(#rd-barrel)"/><circle r="22.6" fill="url(#rd-disc)"/><circle r="19.8" stroke="#2a2e33" stroke-width="1" stroke-dasharray=".01 2.6" stroke-linecap="round"/><circle r="16.8" stroke="#2a2e33" stroke-width="1" stroke-dasharray=".01 2.6" stroke-dashoffset="1.3" stroke-linecap="round"/><circle r="22.2" stroke="#9ba1a9" stroke-width=".4"/><circle r="12" fill="#2f3339" stroke="#1d2024" stroke-width=".8"/></g>
<g id="rd-ws"><path d="M-.9,-5.9 -1.3,-14.9 -7.5,-26.8 -3.2,-27.8 1.1,-19.2 5.4,-27.8 9.7,-26.8 3.5,-14.9 3.1,-5.9ZM7.5,-2.7 15.9,-5.9 25.3,-15.5 27.5,-11.7 20.7,-5 30.2,-3.5 30.6,.9 17.4,-1.4 8.7,1ZM7,6.2 12.6,13.2 24.7,19.2 21.7,22.5 13.2,18.1 14.8,27.5 10.7,29.3 8.8,16 3.8,8.5ZM-1.6,8.5 -6.6,16 -8.5,29.3 -12.6,27.5 -11,18.1 -19.5,22.5 -22.5,19.2 -10.4,13.2 -4.8,6.2ZM-6.5,1 -15.2,-1.4 -28.4,.9 -28,-3.5 -18.5,-5 -25.3,-11.7 -23.1,-15.5 -13.7,-5.9 -5.3,-2.7Z" fill="#0b0c0e"/><path d="M0,-7.6 0,-18.4 -6.5,-28.8 -4.3,-29.2 0,-20.6ZM0,-18.4 6.5,-28.8 8.6,-28.2 2.4,-16.3 2,-7.3 0,-7.6ZM7.2,-2.3 17.5,-5.7 25.4,-15.1 26.4,-13.1 19.6,-6.4ZM17.5,-5.7 29.4,-2.7 29.5,-.5 16.3,-2.8 7.6,-.4 7.2,-2.3ZM4.5,6.1 10.8,14.9 22.2,19.5 20.6,21.1 12.1,16.7ZM10.8,14.9 11.7,27.1 9.6,27.9 7.7,14.6 2.7,7.1 4.5,6.1ZM-4.5,6.1 -10.8,14.9 -11.7,27.1 -13.7,26.1 -12.1,16.7ZM-10.8,14.9 -22.2,19.5 -23.6,17.8 -11.5,11.8 -5.9,4.8 -4.5,6.1ZM-7.2,-2.3 -17.5,-5.7 -29.4,-2.7 -29.1,-4.9 -19.6,-6.4ZM-17.5,-5.7 -25.4,-15.1 -24.2,-16.9 -14.8,-7.3 -6.4,-4.1 -7.2,-2.3Z" fill="url(#rd-spk2)"/><path d="M-2,-7.3 -2.4,-16.3 -8.6,-28.2 -6.5,-28.8 0,-18.4 0,-7.6ZM0,-18.4 0,-20.6 4.3,-29.2 6.5,-28.8ZM6.4,-4.1 14.8,-7.3 24.2,-16.9 25.4,-15.1 17.5,-5.7 7.2,-2.3ZM17.5,-5.7 19.6,-6.4 29.1,-4.9 29.4,-2.7ZM5.9,4.8 11.5,11.8 23.6,17.8 22.2,19.5 10.8,14.9 4.5,6.1ZM10.8,14.9 12.1,16.7 13.7,26.1 11.7,27.1ZM-2.7,7.1 -7.7,14.6 -9.6,27.9 -11.7,27.1 -10.8,14.9 -4.5,6.1ZM-10.8,14.9 -12.1,16.7 -20.6,21.1 -22.2,19.5ZM-7.6,-.4 -16.3,-2.8 -29.5,-.5 -29.4,-2.7 -17.5,-5.7 -7.2,-2.3ZM-17.5,-5.7 -19.6,-6.4 -26.4,-13.1 -25.4,-15.1Z" fill="url(#rd-spk1)"/><path d="M0,-7.6 0,-18.4 -6.5,-28.8M0,-18.4 6.5,-28.8M7.2,-2.3 17.5,-5.7 25.4,-15.1M17.5,-5.7 29.4,-2.7M4.5,6.1 10.8,14.9 22.2,19.5M10.8,14.9 11.7,27.1M-4.5,6.1 -10.8,14.9 -11.7,27.1M-10.8,14.9 -22.2,19.5M-7.2,-2.3 -17.5,-5.7 -29.4,-2.7M-17.5,-5.7 -25.4,-15.1" stroke="#fff" stroke-width=".35" opacity=".7"/><path d="M-2,-7.3 -2.4,-16.3 -8.6,-28.2M6.4,-4.1 14.8,-7.3 24.2,-16.9M5.9,4.8 11.5,11.8 23.6,17.8M-2.7,7.1 -7.7,14.6 -9.6,27.9M-7.6,-.4 -16.3,-2.8 -29.5,-.5" stroke="#fff" stroke-width=".45" opacity=".85"/><path d="M8.6,-28.2 2.4,-16.3 2,-7.3M29.5,-.5 16.3,-2.8 7.6,-.4M9.6,27.9 7.7,14.6 2.7,7.1M-23.6,17.8 -11.5,11.8 -5.9,4.8M-24.2,-16.9 -14.8,-7.3 -6.4,-4.1" stroke="#0b0c0e" stroke-width=".6" opacity=".7"/><circle r="29.7" stroke="#060708" stroke-width=".7"/><circle r="30.2" stroke="#f4f6f8" stroke-width=".45" opacity=".85"/><circle r="8" fill="url(#rd-spk2)" stroke="#1a1c20" stroke-width=".5"/><circle r="6.2" stroke="#15171a" stroke-width="2" stroke-dasharray=".01 7.79" stroke-linecap="round"/><circle r="6.2" stroke="#e6e9ed" stroke-width="1.3" stroke-dasharray=".01 7.79" stroke-linecap="round"/><path d="M3.6,2.1 0,4.2 -3.6,2.1 -3.6,-2.1 -0,-4.2 3.6,-2.1Z" fill="url(#rd-hub)" stroke="#23272c" stroke-width=".4"/><circle r="2" fill="#141619" stroke="#e23a56" stroke-width=".7"/><path d="M-28.6,-9.3 A30.1,30.1 0 0 1 -6.3,-29.4" stroke="#fff" stroke-width="1" stroke-linecap="round"/></g>
<path id="rd-inl" d="M186.6,73.4 C191.6,72.2 196.8,73.6 198.8,77.4 C199.6,79 199.8,80.8 199.9,82.4 L200.5,97.6 L196.6,97.6 L196,82.6 C195.8,79.4 193.6,77 190.2,76.4 C176,74.6 150,88 112,94.6 C146,86.6 172,76 186.6,73.4 Z"/>
</defs>
<ellipse cx="290" cy="194.4" rx="262" ry="3.8" fill="#0b0f1a" opacity=".2" filter="url(#rd-b3)"/>
<path d="M70,182 L530,182 L536,194.8 L64,194.8 Z" fill="#0b0f1a" opacity=".3" filter="url(#rd-b3)"/>
<path d="M150,187.6 L410,187.6" stroke="#aab4c0" stroke-width="1.8" opacity=".22" filter="url(#rd-glow)"/>
<ellipse cx="138.9" cy="195.5" rx="30" ry="2.2" fill="#05070c" opacity=".6" filter="url(#rd-b1)"/>
<ellipse cx="138.9" cy="195.9" rx="21" ry="1.2" fill="#000" opacity=".6" filter="url(#rd-glow)"/>
<ellipse cx="441" cy="195.5" rx="30" ry="2.2" fill="#05070c" opacity=".6" filter="url(#rd-b1)"/>
<ellipse cx="441" cy="195.9" rx="21" ry="1.2" fill="#000" opacity=".6" filter="url(#rd-glow)"/>
<path d="M204.8,99 C202.6,92 200.9,85.4 201,79.6 C201.1,76.2 203.4,74.4 206.8,74.5 C210.6,74.7 212.8,76.6 213,79.8 C213.2,82.6 212.6,85.4 213.5,88.2 C215.2,91.6 217.2,95 218.4,99 ZM204.2,80.4 C204.2,79.8 204.6,79.4 205.2,79.4 L209,79.4 C209.6,79.4 210,79.8 210,80.4 L210,81.4 C210,82 209.6,82.4 209,82.4 L205.2,82.4 C204.6,82.4 204.2,82 204.2,81.4 Z" fill="url(#rd-seat2)" fill-rule="evenodd" stroke="#c4cad2" stroke-width=".4" transform="translate(8.2 1.8)"/>
<path d="M204.8,99 C202.6,92 200.9,85.4 201,79.6 C201.1,76.2 203.4,74.4 206.8,74.5 C210.6,74.7 212.8,76.6 213,79.8 C213.2,82.6 212.6,85.4 213.5,88.2 C215.2,91.6 217.2,95 218.4,99 ZM204.2,80.4 C204.2,79.8 204.6,79.4 205.2,79.4 L209,79.4 C209.6,79.4 210,79.8 210,80.4 L210,81.4 C210,82 209.6,82.4 209,82.4 L205.2,82.4 C204.6,82.4 204.2,82 204.2,81.4 Z" fill="#0e1013" fill-rule="evenodd" stroke="#4a5059" stroke-width=".4" transform="translate(3.4 .8)"/>
<path d="M204.8,99 C202.6,92 200.9,85.4 201,79.6 C201.1,76.2 203.4,74.4 206.8,74.5 C210.6,74.7 212.8,76.6 213,79.8 C213.2,82.6 212.6,85.4 213.5,88.2 C215.2,91.6 217.2,95 218.4,99 ZM204.2,80.4 C204.2,79.8 204.6,79.4 205.2,79.4 L209,79.4 C209.6,79.4 210,79.8 210,80.4 L210,81.4 C210,82 209.6,82.4 209,82.4 L205.2,82.4 C204.6,82.4 204.2,82 204.2,81.4 Z" fill="url(#rd-seat)" fill-rule="evenodd" stroke="#a3aab4" stroke-width=".5"/>
<path d="M203.2,93 C202.2,88 201.9,83.4 202.1,79.8 C202.3,77.2 204.2,75.7 206.8,75.7 M207.6,89.6 C208.8,92.6 210,95.6 211,98.6" stroke="#f0436b" stroke-width=".5" stroke-dasharray="1 .7"/>
<path d="M206.2,87.8 C208.6,87.3 211,87.3 213.2,87.9" stroke="#0b0c0e" stroke-width=".8"/>
<path d="M214,99 C236,97.2 266,96.8 304,97.8 L304,99.6 L214,99.6 Z" fill="#1c1f24"/><path d="M214.6,98.8 C236,97 266,96.6 303,97.6" stroke="#6b727c" stroke-width=".4"/>
<path d="M304,99.6 C305.4,96 310,94.6 317,95 C324,95.4 330,97.2 335,99.6 Z" fill="#141619" stroke="#4a5059" stroke-width=".4"/>
<path d="M299.2,96.6 L306.6,99.2" stroke="#25282d" stroke-width="1.5" stroke-linecap="round"/>
<g transform="rotate(-18 298.4 95.6)"><ellipse cx="298.4" cy="95.6" rx="2.8" ry="4.2" stroke="#1b1d22" stroke-width="1.3"/><path d="M296.4,92.6 A2.8,4.2 0 0 1 300.4,92.6" stroke="#8a929c" stroke-width=".45"/><path d="M297.7,91.5 A2.8,4.2 0 0 1 299.1,91.5" stroke="#f0436b" stroke-width="1.3"/></g>
<path d="M176,179.5 A44.4,44.4 0 1 0 101.9,179.5 Z" fill="#0a0b0d"/>
<path d="M478.1,179.5 A44.4,44.4 0 1 0 404,179.5 Z" fill="#0a0b0d"/>
<use href="#rd-wb" x="138.9" y="155"/>
<path d="M149.6,131 A26.2,26.2 0 0 1 164.5,149.5 L151.5,150.9 A13.2,13.2 0 0 0 145.5,143.5 Z" fill="url(#rd-cal)" stroke="#3d1550" stroke-width=".5" stroke-linejoin="round"/><path d="M150.7,132.8 A25.1,25.1 0 0 1 163,148" stroke="#e3b8f0" stroke-width=".5"/>
<use href="#rd-ws" transform="translate(138.9 155) rotate(9)"/>
<use href="#rd-wb" x="441" y="155"/>
<path d="M415.4,149.5 A26.2,26.2 0 0 1 430.4,131 L434.4,143.5 A13.2,13.2 0 0 0 428.5,150.9 Z" fill="url(#rd-cal)" stroke="#3d1550" stroke-width=".5" stroke-linejoin="round"/><path d="M416.9,148 A25.1,25.1 0 0 1 429.2,132.8" stroke="#e3b8f0" stroke-width=".5"/>
<use href="#rd-ws" transform="translate(441 155) rotate(-21)"/>
<use href="#rd-body" fill="url(#rd-paint)"/>
<g clip-path="url(#rd-clip)">
<path d="M393.4,134.8 C360,133.4 310,130.6 262,127.4 C246,126.3 232,124.8 220,122.2 C204,118.8 192,114 182,107.8 L176,60 L560,60 L560,136 Z" fill="url(#rd-upper)"/>
<path d="M393.4,135 C360,133.6 310,130.8 262,127.6 C246,126.5 232,125 220,122.4 C204,119 192,114.2 182,108 L176,128 C210,138 250,141 300,143 C340,144.4 370,144.4 396,144 Z" fill="url(#rd-under)"/>
<path d="M10,100.6 C60,101.4 140,104 260,108.4 L352,109.4 C410,110 470,111.6 530,118 L530,123 C470,116.6 410,115.2 352,114.6 C260,113.6 140,109.6 60,107 C40,106.4 20,106.2 10,106 Z" fill="url(#rd-sbox)" opacity=".9"/>
<ellipse cx="42" cy="132" rx="40" ry="34" fill="url(#rd-dk)"/>
<path d="M100.9,183 L100.9,176.4 C84,173.8 54,164 28,143 L28,183 Z" fill="url(#rd-carbon)"/>
<path d="M100.9,176.4 C84,173.8 54,164 28,143" stroke="#a3aab4" stroke-width=".5"/>
<path d="M98,95.2 C108,94.6 122,92.4 136,89.6 C148,87.2 160,82.6 170,77.8 C179,74.1 187,71.2 193.2,72 C197.4,72.8 199.6,76.4 199.9,81.6 L200.6,97.6 L200.6,98.4 C184,96.6 160,94.6 138,94.4 C122,94.3 108,94.8 98,95.2 Z" fill="url(#rd-hump)"/>
<ellipse cx="134.9" cy="100" rx="70" ry="9" fill="url(#rd-haunch)"/>
<path d="M196,104.6 C170,101.8 140,100.6 110,101.4 C84,102 60,104.4 38,108" stroke="#5a0816" stroke-width="3" opacity=".16" filter="url(#rd-glow)"/>
<path d="M88.7,136.7 A53.4,53.4 0 0 1 185.2,128.2" stroke="#ffb6c1" stroke-width="5" opacity=".16" filter="url(#rd-glow)"/>
<path d="M236,111.6 C200,105.6 170,101.6 138,101 C100,100.4 60,102.6 26,108" stroke="#ffd2d9" stroke-width="4" opacity=".22" filter="url(#rd-glow)"/>
<path d="M226,109.4 C196,104.4 168,101.2 138,100.8 C104,100.4 70,102 40,105.6" stroke="url(#rd-spec)" stroke-width=".8" opacity=".75"/>
<ellipse cx="447" cy="107" rx="64" ry="8" fill="url(#rd-haunch)" opacity=".8"/>
<rect x="29" y="88" width="26" height="96" fill="url(#rd-endR)"/>
<rect x="522" y="100" width="30" height="84" fill="url(#rd-endF)"/>
<circle cx="138.9" cy="155" r="47.4" stroke="#2a030a" stroke-width="6" opacity=".38" filter="url(#rd-glow)"/>
<circle cx="441" cy="155" r="47.4" stroke="#2a030a" stroke-width="6" opacity=".38" filter="url(#rd-glow)"/>
<path d="M288,98 L304,98 L292,150 L276,150 Z" fill="url(#rd-soft)" opacity=".7"/>
<ellipse cx="300" cy="119" rx="96" ry="20" fill="url(#rd-haunch)" opacity=".32"/>
</g>
<use href="#rd-body" stroke="#3e0510" stroke-width=".5" stroke-linejoin="round" opacity=".55"/>
<path d="M176,179.5 A44.4,44.4 0 1 0 101.9,179.5" stroke="#2e030b" stroke-width="1.2"/>
<path d="M97.5,136.5 A45.3,45.3 0 0 1 172.6,124.6" stroke="#ffa3b1" stroke-width=".7" opacity=".75" stroke-linecap="round"/>
<path d="M478.1,179.5 A44.4,44.4 0 1 0 404,179.5" stroke="#2e030b" stroke-width="1.2"/>
<path d="M399.6,136.5 A45.3,45.3 0 0 1 474.7,124.6" stroke="#ffa3b1" stroke-width=".7" opacity=".75" stroke-linecap="round"/>
<path d="M541,124.6 C534,117.6 527,115.2 524,113.8 C504,107.4 474,102.6 441,101.4 C410,100.3 372,99.3 338.6,98.9" stroke="#ffe0e5" stroke-width=".9" stroke-linecap="round" transform="translate(0 .7)"/>
<path d="M193.2,72 C187,71.2 179,74.1 170,77.8 C160,82.6 148,87.2 136,89.6 C122,92.4 108,94.6 98,95.2 C86,95.6 74,96.4 64,97.8 C59.6,98.6 56.6,99.4 52,99.4" stroke="#ffe0e5" stroke-width=".9" stroke-linecap="round" transform="translate(0 .7)"/>
<path d="M360,100.4 C400,101 440,102 476,103.8" stroke="url(#rd-spec)" stroke-width="1.5" stroke-linecap="round"/>
<path d="M120,93.4 C140,90.6 156,85 170,79" stroke="url(#rd-spec)" stroke-width="1.3" stroke-linecap="round"/>
<path d="M200.6,98.4 C184,96.6 160,94.6 138,94.4 C122,94.3 108,94.8 98,95.2" stroke="#ffd0d7" stroke-width=".6" opacity=".9"/>
<path d="M200.6,98.4 C184,96.6 160,94.6 138,94.4 C122,94.3 108,94.8 98,95.2" stroke="#5a0816" stroke-width=".6" opacity=".6" transform="translate(0 .9)"/>
<path d="M190,99.4 C170,97.4 150,96.2 132,96.2 C112,96.2 92,97.2 74,99 C66,99.8 60,100.6 54,101.6" stroke="url(#rd-spec)" stroke-width=".7"/>
<use href="#rd-inl" fill="url(#rd-carbon)"/><use href="#rd-inl" fill="url(#rd-cf)" opacity=".5"/>
<path d="M186.8,73.2 C191.6,72 196.6,73.5 198.7,77.2" stroke="#b6bdc6" stroke-width=".5" stroke-linecap="round"/>
<path d="M393.4,134.8 C360,133.4 310,130.6 262,127.4 C246,126.3 232,124.8 220,122.2 C204,118.8 192,114 182,107.8" stroke="#ffd6dc" stroke-width=".8" stroke-linecap="round"/>
<path d="M393.4,134.8 C360,133.4 310,130.6 262,127.4 C246,126.3 232,124.8 220,122.2 C204,118.8 192,114 182,107.8" stroke="#3a0410" stroke-width=".7" stroke-linecap="round" opacity=".7" transform="translate(0 1)"/>
<path d="M200.6,98 L338.6,99.2" stroke="#0e1013" stroke-width="1"/>
<path d="M201,98.8 L338,100" stroke="#ffa3b2" stroke-width=".5" opacity=".9"/>
<path d="M262,127.8 C240,126 220,122.6 206,118.4 C198,116 192,112.6 187.4,109 L186,150.6 C206,151 230,150.6 250,148.8 C258,142 262,135 262,127.8 Z" fill="url(#rd-scoop)"/>
<path d="M240.6,126.6 C222,124.6 204,120.4 191.4,115 C188,122.6 187.4,133.4 189,146.4 C202,148.2 218,148.2 230.6,146.2 C236.6,140.4 240,133.6 240.6,126.6 Z" fill="url(#rd-intake)" stroke="#1a0207" stroke-width=".6"/>
<path d="M190.4,127.6 C206,129.6 222,130.4 239.4,130 M189,142.4 C204,144 218,144.2 233.4,143" stroke="#2a2e34" stroke-width=".9"/>
<path d="M190.4,127.6 C206,129.6 222,130.4 239.4,130 M189,142.4 C204,144 218,144.2 233.4,143" stroke="#c3cad3" stroke-width=".4" opacity=".35" transform="translate(0 -.6)"/>
<path d="M189.6,134.6 C206,136.6 222,137 237.6,135.8 L236.8,138.6 C222,139.8 206,139.6 189.4,137.8 Z" fill="url(#rd-blade)"/>
<path d="M189.6,134.6 C206,136.6 222,137 237.6,135.8" stroke="#ffa5b4" stroke-width=".5"/>
<path d="M189.4,138.6 C206,140.4 222,140.6 236.4,139.4" stroke="#000" stroke-width=".7" opacity=".5"/>
<path d="M188.8,147.2 C202,149.2 218,149.2 231.4,147.2" stroke="#ff9aaa" stroke-width=".7" opacity=".8"/>
<path d="M389.6,142.1 A53,53 0 0 1 404.2,116.8 L406,118.7 A50.4,50.4 0 0 0 392.1,142.8Z" fill="#08090b" stroke="#08090b" stroke-width=".8" stroke-linejoin="round"/>
<path d="M391.6,140.8 A51.4,51.4 0 0 1 404,119.2" stroke="#3a3f47" stroke-width=".6"/>
<path d="M388.6,141.9 A54,54 0 0 1 403.5,116.1" stroke="#ffaab7" stroke-width=".5" opacity=".8"/>
<path d="M86,151.3 A53,53 0 0 1 94.9,125.3 L97.1,126.8 A50.4,50.4 0 0 0 88.6,151.4Z" fill="#08090b" stroke="#08090b" stroke-width=".8" stroke-linejoin="round"/>
<path d="M87.8,149.6 A51.4,51.4 0 0 1 95.3,127.7" stroke="#3a3f47" stroke-width=".6"/>
<path d="M85,151.2 A54,54 0 0 1 94.1,124.7" stroke="#ffaab7" stroke-width=".5" opacity=".8"/>
<path d="M352.4,99.4 C352.6,120 351.4,150 349.6,178.8" stroke="#3a0410" stroke-width=".7"/>
<path d="M353.2,99.6 C353.4,120 352.2,150 350.4,178.8" stroke="#ff9fae" stroke-width=".35" opacity=".55"/>
<path d="M217,98.4 C219,106 221,114 223.2,123.4 M226.4,147.4 C228,158 229.4,168 230.6,178.8" stroke="#3a0410" stroke-width=".7"/>
<path d="M238,109.2 L256,109.6" stroke="#2a030a" stroke-width="1.5" stroke-linecap="round"/>
<path d="M238.4,110.4 L255.6,110.8" stroke="#ffb7c2" stroke-width=".45" stroke-linecap="round"/>
<path d="M405,176.4 L190,176.4 C186.2,176.4 184,178.2 184.2,180.8 L184.6,184.3 L400,184.7 C405,184.7 404.4,182 405,178.4 Z" fill="url(#rd-carbon)"/>
<path d="M404,176.6 L190,176.6" stroke="#9aa1ab" stroke-width=".5"/>
<path d="M186,184.7 L400,185.1" stroke="#9aa3ad" stroke-width=".5" opacity=".35"/>
<path d="M49,165.6 C56,172.4 70,179.1 86,179.5 L101.5,179.5 L100.7,183 L58,182.8 C51,182.4 46.4,180.6 44,177.6 C42.4,175.6 42,172.6 42.6,169.4 C45,168.6 47.2,167.4 49,165.6 Z" fill="url(#rd-carbon)"/>
<path d="M43.4,172 C50,177.8 66,180.4 99.9,180.6" stroke="#8a919b" stroke-width=".45"/>
<path d="M56,182 L58.6,184.6 L95.9,184.8 L97.9,182.6 Z" fill="#101215" stroke="#5f6670" stroke-width=".4"/>
<path d="M44.4,178.4 C47,181 52,182.8 58,183.2 M58.6,185 L95.9,185.2" stroke="#9aa3ad" stroke-width=".5" opacity=".35"/>
<path d="M50.6,162.8 L57.6,166" stroke="#8a0d22" stroke-width="1.5" stroke-linecap="round"/>
<path d="M50.8,162.3 L57.8,165.5" stroke="#ff6b80" stroke-width=".4" stroke-linecap="round"/>
<path d="M479.6,179.6 L541.2,179.5 C545,179.5 548.6,180 551.2,180.6 L551,182.6 L484.1,183.8 Z" fill="url(#rd-carbon)"/>
<path d="M482.1,179.8 L550.6,180.6" stroke="#a3aab4" stroke-width=".45"/>
<path d="M484.1,184.2 L551,183" stroke="#9aa3ad" stroke-width=".5" opacity=".35"/>
<path d="M524.6,159.6 C532,158.2 540,158 547.1,158.6 C547.3,162.4 546.9,166 545.8,169.4 C538,170 530,170 525,168.8 C523.2,166 523.2,162.4 524.6,159.6 Z" fill="url(#rd-intake)"/>
<path d="M524,164.2 C532,163.8 540,163.8 547.2,164.2" stroke="#2a2e34" stroke-width="1.2"/>
<path d="M524,163.6 C532,163.2 540,163.2 547.2,163.6" stroke="#8a919b" stroke-width=".35"/>
<path d="M524.4,159.2 C532,157.8 540,157.6 547,158.2" stroke="#ffb0bc" stroke-width=".5" opacity=".8"/>
<path d="M512.4,117.8 C523,120.6 535,125.2 545.2,131.6 L546,135 C535.4,129.6 523,125.2 512,121.4 Z" fill="#101215"/>
<path d="M512.4,117.8 C523,120.6 535,125.2 545.2,131.6" stroke="#ffd0d7" stroke-width=".4" opacity=".8"/>
<path d="M514,119.8 C524,122.8 535.4,127 545,132.6" stroke="#cfe6ff" stroke-width="2.6" stroke-linecap="round" opacity=".5" filter="url(#rd-glow)"/>
<path class="ve-drl" d="M514,119.8 C524,122.8 535.4,127 545,132.6" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round"/>
<path d="M30.9,92.4 L31.4,95.6 L34.2,97.6" stroke="#2a030a" stroke-width=".8" opacity=".7"/>
<path d="M34.2,98.6 C40,100.6 48,101.8 60,102.4" stroke="#2a030a" stroke-width="1.2" opacity=".45" filter="url(#rd-glow)"/>
<path d="M34.4,98 C41,100 49,101.2 62,101.8 C49,102.8 41,103 34.2,102.4 Z" fill="#170306" stroke="#ff8a9c" stroke-width=".3" stroke-opacity=".6"/>
<path d="M35,99.8 C41,101 47,101.6 56,101.9" stroke="#ff3550" stroke-width="3" stroke-linecap="round" opacity=".45" filter="url(#rd-glow)"/>
<path class="ve-tail" d="M35,99.8 C41,101 47,101.6 56,101.9" stroke="#ff2a45" stroke-width="1.3" stroke-linecap="round"/>
<path d="M30.8,92 C34,92.2 38.2,95 43,97.6 C38.6,96.8 34.4,94.8 31,93.6 Z" fill="#ffb0bd" opacity=".45"/>
<path d="M53,99.6 C48.4,99.5 45.6,98.9 43,97.6 C38.2,95 34,92.2 30.8,92" stroke="#fff4f6" stroke-width=".8" stroke-linecap="round"/>
<path d="M281.6,65.2 L290.6,65.4 L355.4,99.3 L318.6,99.2 C309,90 296,76.6 283.4,66.6 Z" fill="url(#rd-glass)"/>
<path d="M291,68.6 L318,94.4 M298.6,70.4 L331.6,96.6" stroke="#fff" stroke-width=".9" opacity=".4" stroke-linecap="round"/>
<path d="M283.4,66.6 C296,76.6 309,90 318.6,99.2" stroke="#0d0f12" stroke-width=".6" opacity=".6"/>
<path d="M354.6,99.2 L289.6,65.4" stroke="#0d0f12" stroke-width="1.4" stroke-linecap="round"/>
<path d="M279.6,64.6 L290.2,64.9 L291,66.4 L281.4,67.2 Z" fill="#0d0f12"/>
<path d="M353.2,97.6 L289.6,64.2 L280.6,64.2" stroke="#b9c1ca" stroke-width=".45" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M330.4,99 L328.4,93.6 L331,93.4 L333.4,99 Z" fill="#111316"/>
<path d="M315.4,90 C315.6,88.2 317.2,87.2 319.6,87.1 L328.4,87.3 C332.2,87.5 334.6,89.4 334.6,91.6 C334.6,93.8 332.2,95.3 328.4,95.3 L319.2,95.1 C316.8,95 315.4,93.8 315.3,92.4 Z" fill="url(#rd-carbon)" stroke="#69707a" stroke-width=".4"/>
<path d="M318,88.4 C322,88 328,88.1 331.6,88.8" stroke="#d2d8df" stroke-width=".55" stroke-linecap="round"/>
__PLUG__
`;
  const RD_PLUG = `
<ellipse cx="594" cy="195.4" rx="14" ry="1.4" fill="#0d1526" opacity=".16" filter="url(#rd-b1)"/>
<rect x="591.8" y="34" width="3.4" height="40" rx="1.2" fill="url(#rd-conduit)"/>
<rect x="572.5" y="72" width="42" height="64" rx="9.5" fill="url(#rd-box)" stroke="#8d95a0" stroke-width=".8" filter="url(#rd-boxsh)"/>
<rect x="576" y="75.5" width="35" height="57" rx="7" fill="url(#rd-boxglass)"/>
<path d="M577.6,82 C580,77.5 584,77 590,77 L603,77 L583,130 C579.6,130 577.6,128 577.6,125 Z" fill="#fff" opacity=".07"/>
<circle cx="593.5" cy="98" r="8.2" stroke="#56606d" stroke-width="1.1"/>
<circle cx="593.5" cy="98" r="8.2" stroke="#c9d1db" stroke-width="1.1" stroke-dasharray="9 43" stroke-linecap="round" transform="rotate(-140 593.5 98)"/>
<path d="M594.6,92.5 L590.8,98.6 L593.6,98.6 L592.4,103.5 L596.2,97.3 L593.4,97.3 Z" fill="#8e98a6"/>
<rect class="ve-box-led" x="585" y="119" width="17" height="2.6" rx="1.3" fill="#a855c7"/>
<rect x="589" y="136" width="9" height="4.5" rx="1.5" fill="#2a2e34"/>
<rect x="617.5" y="90" width="7.5" height="18" rx="2.6" fill="url(#rd-box)" stroke="#8d95a0" stroke-width=".7"/>
<rect x="619.6" y="93.5" width="3.3" height="9" rx="1.4" fill="#1d2127"/>
<path class="ve-cable" d="M593.5,138 C593.5,162 591,187 577,188 C563,189 563,160 557,151.4" stroke="#24282e" stroke-width="3.4" stroke-linecap="round"/>
<path d="M593.5,138 C593.5,162 591,187 577,188 C563,189 563,160 557,151.4" stroke="#8a919c" stroke-width=".7" stroke-linecap="round" opacity=".8" transform="translate(-.6 -.8)"/>
__FLOW__
<rect x="528.4" y="137.4" width="12.4" height="10" rx="2.4" fill="#08090b" stroke="#3a0410" stroke-width=".5"/>
<rect x="529.4" y="138.4" width="10.4" height="8" rx="1.8" stroke="#a855c7" stroke-width=".5" opacity=".9"/>
<path d="M541,137.6 L547.4,133.6 C548.2,133.2 548.8,133.6 548.8,134.4 L549.2,143.2 C549.2,144 548.8,144.6 548.2,144.8 L541,147.2 Z" fill="url(#rd-flap)" stroke="#4e0613" stroke-width=".5" stroke-linejoin="round"/>
<path d="M548.3,134.4 L548.7,143.4 M541.6,137.2 L547.4,133.6" stroke="#ffc2cb" stroke-width=".5" stroke-linecap="round"/>
<path d="M540.9,137.8 L540.9,147" stroke="#1a0207" stroke-width="1.1"/>
<path d="M530.6,139.2 L536.8,139 C540.2,139 542.8,140.2 545,142.4 L557,149.2 C558.8,150.4 558.8,152.8 557.4,154.2 L555.8,155.6 C554.4,156.6 552.8,156.6 551.4,155.6 L542,149 C540,147.6 538,146.4 535.8,146.2 L530.6,146 Z" fill="url(#rd-plug)" stroke="#2a2e34" stroke-width=".5" stroke-linejoin="round"/>
<path d="M532,140.4 L536.8,140.2 C539.6,140.2 541.8,141.2 543.8,143 L555.4,149.6" stroke="#fff" stroke-width=".6" stroke-linecap="round"/>
<path d="M545,144.8 L549.4,147.6" stroke="#a855c7" stroke-width="1.3" stroke-linecap="round"/>
`;
  const RD_FLOW = `<path class="ve-flow" d="M593.5,138 C593.5,162 591,187 577,188 C563,189 563,160 557,151.4" stroke="#a855c7" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2 9"/>`;
  const RD_CLOSED = `<rect x="528.4" y="137.4" width="12.4" height="10" rx="2.4" stroke="#3a0410" stroke-width=".6" opacity=".8"/>
<path d="M529.6,147.8 L539.6,147.8 C540.6,147.8 541.2,147.2 541.2,146.4" stroke="#ff9fae" stroke-width=".35" opacity=".6"/>`;

  // Illustration au choix (Réglages) : roadster sport (par défaut) ou la Kia e-Niro
  const car = (charging, plugged) => (BZ.ui.carArt === "eniro"
    ? h`<svg class="ve-car ${charging ? "is-charging" : ""}" viewBox="0 0 640 220" role="img" aria-label="Kia e-Niro${plugged ? ", branchée à la borne" : ""}">
      ${CAR_ART}
      ${plugged ? h`<g class="ve-plug">${CAR_PLUG[0]}${charging ? CAR_FLOW : ""}${CAR_PLUG[1]}</g>` : ""}
    </svg>`
    : h`<svg class="ve-car is-roadster ${charging ? "is-charging" : ""}" viewBox="0 0 640 220" fill="none" role="img" aria-label="Roadster électrique${plugged ? ", branché à la borne" : ""}">
      ${RD_ART.replace("__PLUG__", plugged ? `<g class="ve-plug">${RD_PLUG.replace("__FLOW__", charging ? RD_FLOW : "")}</g>` : RD_CLOSED)}
    </svg>`);

  /* ─── État de la recharge (une seule source de vérité pour le hero) ── */
  function chargeState() {
    const L = BZ.live(), soc = num(C.voiture_soc), lim = num(C.voiture_limite_pct), km = num(C.voiture_autonomie_km);
    const added = L.plugged ? clamp(num(C.session_soc), 0, soc) : 0, start = clamp(soc - added, 0, soc);
    const sol = num(C.session_sol_kwh), res = num(C.session_res_kwh), kwh = sol + res;
    const mins = num(C.voiture_minutes_restantes), fin = new Date(Date.now() + mins * 6e4);
    const full = L.plugged && soc >= lim, t = BZ.tariffNow(), offPeak = isOn(C.voiture_heures_creuses), scheduled = isOn(C.voiture_programmee);
    let state, tone, why;
    if (L.charging) { state = "En charge"; tone = "ev"; why = null; }
    else if (full) { state = "Charge terminée"; tone = "good"; why = `limite de ${fmt.n(lim)} % atteinte`; }
    else if (L.plugged && offPeak && t.key === "hp") { state = "En attente"; tone = "hc"; why = `heures creuses à ${fmt.time(t.changeAt)}`; }
    else if (L.plugged && scheduled) { state = "En attente"; tone = "hc"; why = "charge programmée dans la voiture"; }
    else if (L.plugged) { state = "Branchée"; tone = "neutral"; why = "prête à charger"; }
    else { state = "Débranchée"; tone = "neutral"; why = null; }
    // km par % : estimation de la voiture si la batterie n'est pas presque vide, sinon capacité / consommation
    const kmPerPct = soc >= 15 && km > 0 ? clamp(km / soc, 2.5, 7) : (C.voiture_capacite_kwh / (C.voiture_conso_kwh_100km || 16.5));
    return { L, soc, lim, km, added, start, sol, res, kwh, mins, fin, full, state, tone, why, kmPerPct };
  }
  const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`);

  /* ─── Barre de batterie : remplissage unique + repère + drapeau de limite ── */
  function battery(S) {
    const { soc, lim, start, L } = S, low = soc <= 20;
    return h`<div class="ve-bat ${L.charging ? "is-charging" : ""} ${low ? "is-low" : ""}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(soc)}"
        aria-label="Batterie ${fmt.n(soc)} %, ${fmt.n(S.km)} km d'autonomie, limite ${fmt.n(lim)} %${S.added ? `, ${fmt.n(S.added)} % ajoutés depuis le branchement` : ""}">
      <div class="ve-bat-t">
        <span class="ve-seg is-base" style="--a:0%;--b:${start}%"></span>
        ${S.added ? h`<span class="ve-seg is-add" style="--a:${start}%;--b:${soc}%"></span>` : ""}
        ${soc < lim ? h`<span class="ve-seg is-room" style="--a:${soc}%;--b:${lim}%"></span>` : ""}
      </div>
      <b class="ve-lim" style="--x:${lim}%"><span>${fmt.n(lim)} %</span></b>
      <span class="ve-knob" style="--x:${soc}%"><span>${fmt.n(soc)} % · ${fmt.n(S.km)} km</span></span>
    </div>`;
  }

  // Déroulé de la charge (sous la barre) ; débranchée : la dernière recharge
  function timeline(S) {
    if (!S.L.plugged) {
      const last = BZ.chargeDays(14).filter((d) => d.kwh).pop();
      if (!last) return "";
      const d = last.date.toDateString(), when = d === new Date().toDateString() ? "aujourd'hui" : d === new Date(Date.now() - 864e5).toDateString() ? "hier" : fmt.date(last.date, { weekday: "long", day: "numeric", month: "long" });
      return h`<p class="ve-last">${icon("clock")}Dernière recharge ${when} · <b>${fmt.kwhText(last.kwh)}</b>, ${fmt.n(last.sun * 100)} % solaire</p>`;
    }
    const startAt = new Date(st(C.session_debut)), share = S.kwh ? S.sol / S.kwh : 0;
    const endKm = S.kmPerPct * S.lim;
    return h`<ol class="ve-steps" aria-label="Déroulé de la recharge">
      <li class="is-done"><i></i><strong>Branchée à ${fmt.time(startAt)}</strong><small>${fmt.n(S.start)} %</small></li>
      <li class="is-now"><i></i><strong>+${fmt.n(S.added)} % · ${fmt.kwhText(S.kwh)}</strong><small><span data-tone="solar">${fmt.n(share * 100)} % soleil</span><span class="ve-res"> · ${fmt.kwhText(S.res)} réseau</span></small></li>
      <li><i></i><strong>${S.L.charging ? `Fin vers ${fmt.time(S.fin)}` : S.full ? "Terminée" : "Objectif"}</strong><small>${fmt.n(S.lim)} % · ≈ ${fmt.n(endKm)} km</small></li>
    </ol>`;
  }

  function hero() {
    const S = chargeState(), { L } = S;
    const locked = st(C.voiture_verrou) === "locked", armed = BZ.ui.armed === "unlock", clim = isOn(C.voiture_clim);
    const run = (k) => { const t = BZ.slowOf(k); return !!t && (t.phase === "send" || t.phase === "wait"); };
    const meta = L.charging ? h`Encore <b>${dur(S.mins)}</b> à ${fmt.powerText(L.car)}` : S.why ? fmt.cap(S.why) : h`Dernier trajet <b>${fmt.ago(st(C.voiture_dernier_trajet))}</b>`;
    const action = ({ label, ic, act, tone, on, disabled, pending, aria, title }) => h`
      <button type="button" class="ve-act" data-tone="${tone}" data-act="${act}" ${on != null ? `aria-pressed="${String(!!on)}"` : ""} ${disabled ? "disabled" : ""} ${pending ? 'aria-busy="true"' : ""} aria-label="${esc(aria)}" title="${esc(title || aria)}">
        <span class="ve-act-i">${icon(ic)}</span><span class="ve-act-l">${label}</span></button>`;
    return h`<section class="card ve-hero ${L.charging ? "is-charging" : ""}" aria-label="État de la voiture">
      <div class="ve-hero-l">
        <div class="ve-status">${BZ.pill(S.state, S.tone, L.charging)}</div>
        <div class="ve-soc ${S.soc <= 20 ? "is-low" : ""}">${val([fmt.n(S.soc), "%"])}</div>
        <p class="ve-range"><b>${fmt.n(S.km)} km</b> d'autonomie</p>
        <p class="ve-meta">${meta}</p>
        <div class="ve-acts">
          ${action({ label: armed ? "Confirmer" : "Verrou", ic: locked ? "lock" : "unlock", act: "car-lock", tone: armed ? "bad" : locked ? "good" : "warn", on: locked, pending: run("lock"),
            aria: armed ? "Confirmer le déverrouillage" : "Verrou des portes", title: armed ? "Appuie encore pour déverrouiller" : locked ? "Verrouillée · appuie deux fois pour ouvrir" : "Déverrouillée · appuie pour verrouiller" })}
          ${action({ label: "Climat", ic: "snow", act: "car-clim", tone: "battery", on: clim, pending: run("clim"), aria: "Climatisation", title: clim ? "Climatisation en marche" : "Lancer la climatisation" })}
          ${action({ label: "Recharge", ic: "bolt", act: "car-charge", tone: "ev", on: L.charging, disabled: !L.plugged || (S.full && !L.charging), pending: run("charge"),
            aria: "Recharge", title: !L.plugged ? "Branche la voiture pour charger" : S.full ? "Limite atteinte" : L.charging ? "Arrêter la recharge" : "Démarrer la recharge" })}
          ${action({ label: "Actualiser", ic: "refresh", act: "car-refresh", tone: "neutral", pending: run("refresh"), aria: "Demander un relevé à la voiture" })}
        </div>
      </div>
      <div class="ve-hero-r">
        <div class="ve-art">${BZ.segmented({ name: "carArt", label: "Illustration de la voiture", value: BZ.ui.carArt === "eniro" ? "eniro" : "roadster", options: [["roadster", "Roadster"], ["eniro", "e-Niro"]] })}</div>
        ${car(L.charging, L.plugged)}
        ${battery(S)}
        ${timeline(S)}
        <ul class="ve-chips">
          <li><span>Batterie 12 V</span><b>${fmt.n(num(C.voiture_12v_pct))} %</b></li>
          ${L.plugged ? h`<li><span>Dernier trajet</span><b>${fmt.ago(st(C.voiture_dernier_trajet))}</b></li>` : ""}
        </ul>
      </div>
    </section>`;
  }

  /* ─── Recharges de la période ───────────────────────────────────────── */
  const gridMix = () => (isOn(C.voiture_heures_creuses) ? { hsc: 0.72, hc: 0.28, hp: 0 } : { hsc: 0.62, hc: 0.23, hp: 0.15 });   // même règle que core.chargeMix
  const costOf = (t) => { const g = Math.max(0, (t.ev || 0) - (t.evSun || 0)), m = gridMix(); return g * (m.hsc * num(C.tarif_hsc) + m.hc * num(C.tarif_hc) + m.hp * num(C.tarif_hp)); };

  function stats() {
    const kind = BZ.ui.carPeriod, P = BZ.period(kind), T = P.total, Q = P.prevTotal, real = P.buckets.filter((b) => !b.forecast);
    const conso = C.voiture_conso_kwh_100km || 16.5, ess = (C.essence_l_100km || 6.5) * (C.essence_prix_l || 1.85);
    const per100 = (t) => (t.ev ? (costOf(t) / t.ev) * conso : 0), saved = (t) => (ess - per100(t)) * ((t.ev || 0) / conso);
    const share = (t) => (t.ev ? t.evSun / t.ev : 0);
    const m = new Date().getMonth();
    const vs = { semaine: "vs 7 j avant", mois: `vs ${BZ.MONTHS[(m + 11) % 12]} à date`, annee: `vs ${new Date().getFullYear() - 1} à date` }[kind];
    // Cumuls (courbes lisibles : pas de dents de scie entre jours avec et sans recharge)
    let e = 0, s = 0, c = 0;
    const cum = real.map((b) => { e += b.ev || 0; s += b.evSun || 0; c += costOf(b); return { e, share: e ? s / e : null, per100: e ? (c / e) * conso : null }; });
    return { kind, P, T, Q, real, conso, ess, per100, saved, share, vs, cum };
  }

  function kpis(S) {
    const { T, Q, per100, saved, share, vs, ess, cum } = S;
    return h`<div class="kpis">
      ${kpi({ label: "Énergie rechargée", ic: "bolt", tone: "ev", value: val(fmt.kwh(T.ev)), delta: delta(T.ev, Q.ev), vs, spark: BZ.spark(cum.map((x) => x.e), "ev") })}
      ${kpi({ label: "Part solaire", ic: "sun", tone: "solar", value: val([fmt.n(share(T) * 100), "%"]), delta: delta(share(T), share(Q), { unit: "pts" }), vs, spark: BZ.spark(cum.map((x) => x.share), "solar") })}
      ${kpi({ label: "Coût aux 100 km", ic: "euro", tone: "accent", value: val([fmt.n(per100(T), 2), "€"]), delta: delta(per100(T), per100(Q), { invert: true }), vs, spark: BZ.spark(cum.map((x) => x.per100), "accent") })}
      ${kpi({ label: "Économisé vs essence", ic: "leaf", tone: "good", value: val([fmt.n(saved(T), 0), "€"]), delta: "", vs: `essence : ${fmt.n(ess, 2)} € / 100 km`, spark: BZ.spark(cum.map((x, i) => saved({ ev: x.e, evSun: S.real.slice(0, i + 1).reduce((a, b) => a + (b.evSun || 0), 0) })), "good") })}
    </div>`;
  }

  function mixCard(S) {
    const M = BZ.chargeMix(S.kind), offPeak = isOn(C.voiture_heures_creuses);
    const rows = [["sol", "Soleil", "solar", "panneaux"], ["hsc", "Super creuses", "hsc", BZ.rangeLabel("hsc")], ["hc", "Heures creuses", "hc", BZ.rangeLabel("hc")], ["hp", "Heures pleines", "hp", BZ.rangeLabel("hp")]];
    return card({ cls: "ve-mix", title: "Par source", ic: "leaf", tone: "accent", aside: h`<span class="ve-total">${fmt.eur(M.cost)} payés</span>`, body: h`
      ${BZ.split(rows.map(([k, l, tone]) => ({ label: l, v: M.mix[k], tone })), { label: rows.map(([k, l]) => `${l} ${fmt.kwhText(M.mix[k])}`).join(", ") })}
      <ul class="ve-src">${rows.map(([k, l, tone, when]) => h`<li data-tone="${tone}" class="${!M.mix[k] ? "is-zero" : ""}"><i></i>
        <span><strong>${l}</strong><small>${k === "sol" ? "gratuit" : `${when} · ${fmt.n(M.price[k], 4)} €`}${k === "hp" && offPeak ? " · exclues" : ""}</small></span>
        <b>${fmt.kwhText(M.mix[k])}</b><em>${k === "sol" ? "0 €" : fmt.eur(M.mix[k] * M.price[k])}</em></li>`)}</ul>` });
  }

  function calendarCard() {
    // 4 semaines complètes + la semaine en cours, du lundi au dimanche (5 rangées)
    const wd = (new Date().getDay() + 6) % 7, days = BZ.chargeDays(29 + wd), maxDay = Math.max(...days.map((d) => d.kwh), 1);
    const n = days.filter((d) => d.kwh).length, sel = BZ.ui.calSel != null && days[BZ.ui.calSel] ? BZ.ui.calSel : days.length - 1, d = days[sel];
    const lab = (x) => fmt.cap(fmt.date(x.date, { weekday: "long", day: "numeric", month: "long" }));
    return card({ cls: "ve-cal", title: "Jours de recharge", ic: "calendar", tone: "accent", aside: h`<span class="ve-total">${n} en 5 semaines</span>`, body: h`
      <div class="ve-cal-g">
        ${["L", "M", "M", "J", "V", "S", "D"].map((x) => h`<span class="ve-wd" aria-hidden="true">${x}</span>`)}
        ${days.map((x, i) => h`<button type="button" class="ve-day ${x.kwh ? "" : "is-none"} ${i === days.length - 1 ? "is-today" : ""} ${i === sel ? "is-sel" : ""}" data-act="set" data-k="calSel" data-value="${i}"
          style="--a:${(0.25 + 0.75 * (x.kwh / maxDay)).toFixed(2)};--s:${Math.round(x.sun * 100)}%" aria-pressed="${String(i === sel)}"
          aria-label="${esc(`${lab(x)} : ${x.kwh ? `${fmt.kwhText(x.kwh)}, ${fmt.n(x.sun * 100)} % solaire` : "pas de recharge"}`)}">${x.date.getDate()}</button>`)}
      </div>
      <p class="ve-cal-d" aria-live="polite"><b>${lab(d)}</b>${d.kwh ? h` · ${fmt.kwhText(d.kwh)} · <span data-tone="solar">${fmt.n(d.sun * 100)} % soleil</span>` : " · pas de recharge"}</p>` });
  }

  // Dernières recharges (motif « Recent projects ») : date, énergie, part solaire, coût
  function recentCard() {
    const S = chargeState(), list = BZ.chargeDays(21).filter((d) => d.kwh).reverse().slice(0, 4);
    const today = new Date().toDateString();
    if (S.L.plugged) list[0] && list[0].date.toDateString() === today ? (list[0] = { date: new Date(), kwh: S.kwh, sun: S.kwh ? S.sol / S.kwh : 0, live: S.L.charging }) : list.unshift({ date: new Date(), kwh: S.kwh, sun: S.kwh ? S.sol / S.kwh : 0, live: S.L.charging });
    const rows = list.slice(0, 4);
    const when = (d) => (d.toDateString() === today ? "Aujourd'hui" : d.toDateString() === new Date(Date.now() - 864e5).toDateString() ? "Hier" : fmt.cap(fmt.date(d, { weekday: "short", day: "numeric", month: "short" })));
    return card({ cls: "ve-recent", title: "Dernières recharges", ic: "clock", tone: "accent", body: h`
      <ul class="plist">${rows.map((r) => { const cost = costOf({ ev: r.kwh, evSun: r.kwh * r.sun }); return h`<li><div class="plist-r">
        <span class="dt-ic" data-tone="${r.sun >= 0.5 ? "solar" : "grid"}">${icon(r.sun >= 0.5 ? "sun" : "grid")}</span>
        <span><strong>${when(r.date)}${r.live ? h` <span class="pill is-live" data-tone="ev">en cours</span>` : ""}</strong><small>${fmt.kwhText(r.kwh)} · ${fmt.eur(cost)}</small></span>
        <span class="plist-p"><span>${fmt.n(r.sun * 100)} % soleil</span>${meter({ value: r.sun * 100, tone: "solar", size: "xs" })}</span>
      </div></li>`; })}</ul>
      ${(() => { const all = BZ.chargeDays(30).filter((d) => d.kwh), avg = all.reduce((a, d) => a + d.kwh, 0) / (all.length || 1), sun = all.reduce((a, d) => a + d.kwh * d.sun, 0) / (all.reduce((a, d) => a + d.kwh, 0) || 1);
        return h`<p class="ve-avg">30 jours : <b>${all.length} recharges</b> · <b>${fmt.kwhText(avg)}</b> en moyenne · <b>${fmt.n(sun * 100)} %</b> soleil</p>`; })()}` });
  }

  function settingsCard() {
    const lim = num(C.voiture_limite_pct), dc = num(C.voiture_limite_dc_pct);
    const odo = num(C.voiture_odometre), last = num(C.entretien_dernier_km), next = last + C.entretien_intervalle_km, left = next - odo, armed = BZ.ui.armed === "service";
    return card({ cls: "ve-set", title: "Réglages et entretien", ic: "gauge", tone: "accent", body: h`<div class="rows">
      <div class="row ve-lims"><div><strong>Limites de charge</strong><span>AC à domicile · DC sur borne rapide</span></div>
        <div class="ve-lim2" title="Recharge à domicile (AC)"><span>AC</span>${stepper({ value: fmt.n(lim), unit: " %", act: "car-lim", label: "Limite à domicile (AC)", cur: lim, min: 50, max: 100, pending: BZ.isPending(C.voiture_limite_pct) })}</div>
        <div class="ve-lim2" title="Recharge rapide sur borne (DC)"><span>DC</span>${stepper({ value: fmt.n(dc), unit: " %", act: "car-limdc", label: "Limite charge rapide (DC)", cur: dc, min: 50, max: 100, pending: BZ.isPending(C.voiture_limite_dc_pct) })}</div></div>
      <div class="row"><div><strong>Heures creuses seulement</strong><span>creuses et super creuses</span></div>${toggle({ on: isOn(C.voiture_heures_creuses), act: "toggle", args: { entity: C.voiture_heures_creuses }, label: "Heures creuses seulement", pending: BZ.isPending(C.voiture_heures_creuses) })}</div>
      <div class="row"><div><strong>Charge programmée</strong><span>horaire réglé dans la voiture</span></div>${toggle({ on: isOn(C.voiture_programmee), act: "toggle", args: { entity: C.voiture_programmee }, label: "Charge programmée", pending: BZ.isPending(C.voiture_programmee) })}</div>
      <div class="row ve-care"><div><strong>Révision</strong><span>${left >= 0 ? `dans ${fmt.n(left)} km (à ${fmt.n(next)} km)` : `${fmt.n(-left)} km de retard`}</span>${meter({ value: ((odo - last) / C.entretien_intervalle_km) * 100, tone: left < 1000 ? "warn" : "ev", size: "xs", label: "Avancement jusqu'à la révision" })}</div>
        ${btn({ label: armed ? "Confirmer" : "Révision faite", ic: "check", act: "car-service", size: "sm", kind: armed ? "danger" : "secondary" })}</div>
    </div>` });
  }

  BZ.pages.vehicle = () => {
    const S = stats();
    return h`
      <header class="ph">
        <div><p class="ph-hi">Relevé ${fmt.ago(st(C.voiture_maj))}</p><h1>Kia e-Niro</h1><p class="ph-sub">${fmt.n(num(C.voiture_odometre))} km au compteur · batterie de ${fmt.n(C.voiture_capacite_kwh)} kWh</p></div>
        <div class="ph-a">${pills({ name: "carPeriod", label: "Période des recharges", value: S.kind, options: [["semaine", "7 jours"], ["mois", "Mois"], ["annee", "Année"]] })}</div>
      </header>
      ${kpis(S)}
      <div class="layout ve-grid">
        <div class="col ve-l">${hero()}<div class="ve-pair">${mixCard(S)}${calendarCard()}</div></div>
        <div class="col ve-r">${recentCard()}${settingsCard()}</div>
      </div>`;
  };
})();
