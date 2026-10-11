# HEMS-Breezy

Breezy, l'énergie de la maison dans Home Assistant (dans la coque de S&A-HOME). Deux pages autonomes, à déployer côte à côte
(les liens entre elles sont relatifs) :

- `index.html` : l'Accueil (la maison, ses flux d'énergie, le bilan du jour) ;
- `kia.html` : la Kia e-Niro (batterie, recharge au soleil, commandes).

Elles sont produites depuis `src/*.template.html` ; le code commun (jetons, scène, ciel, comètes, pont vers Home Assistant) est
dans `src/partage/` et inséré à la construction. Les images sont dans `assets/`.

```
node tools/build.js                                   # tous les src/*.template.html → <nom>.html à la racine
node tools/build.js src/kia.template.html kia.html    # une seule page
node tools/inline-svg.js src/index.template.html index.html   # toujours valable (passe par build.js)
```

Hors de Home Assistant, chaque page montre des valeurs d'exemple : `index.html?apercu=midi | soir | nuit | borne`,
`kia.html?apercu=debranchee | branchee | charge | limite | perime`.
