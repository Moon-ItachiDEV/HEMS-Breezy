# HEMS-Breezy

## Installer dans Home Assistant

Breezy HEMS s'installe comme un panneau de Home Assistant, avec tes vraies données (la démo reste disponible à part).

1. Dézippe `breezy-installation.zip` (envoyé en pièce jointe avec le guide ; sinon fabriqué dans `dist/` par `python3 scripts/build-ha.py`, le dossier `dist/` n'étant pas dans le dépôt) : tu obtiens un dossier `breezy`.
2. Copie-le dans `/config/www/` pour obtenir `/config/www/breezy/breezy-panel.js`.
3. Ajoute ce bloc dans `configuration.yaml` :
   ```yaml
   panel_custom:
     - name: breezy-hems-panel
       url_path: breezy
       sidebar_title: Breezy
       sidebar_icon: mdi:solar-power-variant
       module_url: /local/breezy/breezy-panel.js?v=1
       embed_iframe: true
       require_admin: false
   ```
4. Redémarre Home Assistant.
5. Ouvre « Breezy » dans la barre latérale, puis le Diagnostic (cloche ou menu du profil) pour corriger `config.js` si besoin.

Le guide pas à pas (copie des fichiers, historique, mises à jour, dépannage) : [docs/installation-home-assistant.md](docs/installation-home-assistant.md).

Pour les développeurs : `python3 scripts/build-ha.py` fabrique `dist/breezy/` et les deux zips (installation, mise à jour). La démo (`v3/index.html`, `scripts/build-standalone.py`) n'utilise jamais `v3/ha/`.
