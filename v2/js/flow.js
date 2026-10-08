// Breezy HEMS V2 — schéma des flux en direct. Deux dispositions dans le même composant :
// en ligne (cartes larges) et en croix autour de la maison (cartes étroites, mobile).
// Le conteneur choisit via @container : aucune logique de taille d'écran en JS.
(() => {
  const BZ = window.BZ;
  const { h, fmt, icon, val } = BZ;

  const speed = (w) => `${BZ.clamp(2.6 - w / 1400, 0.55, 2.6).toFixed(2)}s`;
  const width = (w) => BZ.clamp(1.5 + w / 1100, 1.5, 5).toFixed(2);

  function nodes(L) {
    const batState = Math.abs(L.bat) < 15 ? "Veille" : L.bat > 0 ? "Charge" : "Décharge";
    const gridState = Math.abs(L.grid) < 15 ? "Équilibre" : L.grid < 0 ? "Revente" : "Achat";
    return {
      sun: { ic: "sun", tone: "solar", label: "Soleil", w: L.solar, note: "3 onduleurs" },
      home: { ic: "home", tone: "home", label: "Maison", w: L.house, note: "hors voiture" },
      bat: { ic: "battery", tone: "battery", label: "Batterie", w: Math.abs(L.bat), note: `${fmt.n(BZ.num(BZ.C.batterie_soc))} % · ${batState}`, soc: BZ.num(BZ.C.batterie_soc), dir: L.bat < -15 ? "in" : "out" },
      grid: { ic: "grid", tone: L.grid > 15 ? "bad" : "grid", label: "Réseau", w: Math.abs(L.grid), note: gridState, dir: L.grid > 15 ? "in" : "out" },
      car: { ic: "car", tone: "ev", label: "e-Niro", w: L.car, note: L.charging ? `${fmt.n(BZ.num(BZ.C.voiture_soc))} % · ${fmt.n(L.evSolarShare * 100)} % soleil` : L.plugged ? "Branchée" : "Débranchée", soc: BZ.num(BZ.C.voiture_soc) },
    };
  }

  // Une liaison : trait de fond + trait animé dans le sens réel de l'énergie
  const link = (d, tone, w, reverse) => h`<path class="fl-bg" d="${d}"/>${w >= 15 ? h`<path class="fl-go ${reverse ? "is-rev" : ""}" data-tone="${tone}" d="${d}" style="--sp:${speed(w)};--sw:${width(w)}"/>` : ""}`;

  const node = (k, n, pos) => h`
    <div class="fn fn-${k} ${n.w < 15 && k !== "home" ? "is-idle" : ""}" data-tone="${n.tone}" style="--x:${pos[0]}%;--y:${pos[1]}%">
      <span class="fn-i">${icon(n.ic)}${n.soc != null ? h`<svg class="fn-soc" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.5" pathLength="100" style="--p:${n.soc}"/></svg>` : ""}</span>
      <span class="fn-t"><span class="fn-l">${n.label}</span>${val(fmt.power(n.w), "fn-v")}<span class="fn-n">${n.note}</span></span>
    </div>`;

  function flow({ compact = false } = {}) {
    const L = BZ.live(), N = nodes(L);
    // Disposition en ligne : soleil → maison → (batterie, réseau, voiture)
    const P = { sun: [12, 50], home: [43, 50], bat: [84, 16], grid: [84, 50], car: [84, 84] };
    const X = (p) => p * 10, Y = (p) => p * 3.4;
    const curve = (a, b) => { const x1 = X(P[a][0]) + 70, y1 = Y(P[a][1]), x2 = X(P[b][0]) - 78, y2 = Y(P[b][1]), mx = (x1 + x2) / 2; return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; };
    const pill = (a, b, w, tone) => { if (w < 15) return ""; const mx = (X(P[a][0]) + 70 + X(P[b][0]) - 78) / 2, my = (Y(P[a][1]) + Y(P[b][1])) / 2; return h`<span class="fl-pill" data-tone="${tone}" style="--x:${mx / 10}%;--y:${(my / 340) * 100}%">${fmt.powerText(w)}</span>`; };
    const wide = h`<div class="flow-wide">
      <svg viewBox="0 0 1000 340" preserveAspectRatio="none" aria-hidden="true">
        ${link(curve("sun", "home"), "solar", L.solar)}
        ${link(curve("home", "bat"), "battery", Math.abs(L.bat), L.bat < 0)}
        ${link(curve("home", "grid"), L.grid > 0 ? "bad" : "grid", Math.abs(L.grid), L.grid > 0)}
        ${link(curve("home", "car"), "ev", L.car)}
      </svg>
      ${pill("sun", "home", L.solar, "solar")}${pill("home", "bat", Math.abs(L.bat), "battery")}${pill("home", "grid", Math.abs(L.grid), L.grid > 0 ? "bad" : "grid")}${pill("home", "car", L.car, "ev")}
      ${Object.entries(N).map(([k, n]) => node(k, n, P[k]))}
    </div>`;
    // Disposition en croix : la maison au centre
    const Q = { sun: [50, 14], bat: [15, 50], home: [50, 50], grid: [85, 50], car: [50, 86] };
    const seg = (a, b) => { const [x1, y1] = Q[a], [x2, y2] = Q[b], dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), r1 = a === "home" ? 14 : 10, r2 = b === "home" ? 14 : 10; return `M${x1 + (dx / l) * r1},${y1 + (dy / l) * r1} L${x2 - (dx / l) * r2},${y2 - (dy / l) * r2}`; };
    const cross = h`<div class="flow-cross">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        ${link(seg("sun", "home"), "solar", L.solar)}
        ${link(seg("home", "bat"), "battery", Math.abs(L.bat), L.bat < 0)}
        ${link(seg("home", "grid"), L.grid > 0 ? "bad" : "grid", Math.abs(L.grid), L.grid > 0)}
        ${link(seg("home", "car"), "ev", L.car)}
      </svg>
      ${Object.entries(N).map(([k, n]) => node(k, n, Q[k]))}
    </div>`;
    const summary = `Soleil ${fmt.powerText(L.solar)}, maison ${fmt.powerText(L.house)}, batterie ${fmt.powerText(Math.abs(L.bat))} ${L.bat >= 0 ? "en charge" : "en décharge"}, réseau ${fmt.powerText(Math.abs(L.grid))} ${L.grid < 0 ? "revendus" : "achetés"}, voiture ${fmt.powerText(L.car)}.`;
    return h`<div class="flow ${compact ? "is-compact" : ""}" role="img" aria-label="${summary}">${wide}${cross}</div>`;
  }

  BZ.flow = flow;
})();
