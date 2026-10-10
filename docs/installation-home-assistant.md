# Installer Breezy HEMS dans Home Assistant

Ce guide installe Breezy **dans** ton Home Assistant, avec tes vraies données. Breezy devient une entrée de la barre latérale de Home Assistant, comme « Énergie » ou « Carte ».

- Les valeurs en direct viennent de tes entités.
- Les boutons pilotent tes vrais appareils.
- L'historique (Bilan, courbes, recharges de la voiture) vient des statistiques de Home Assistant.

> **Attention : ce n'est plus une démo.** Chaque bouton agit vraiment : lumières, volets, prises, poêle, ballon, aspirateur, voiture (charge, verrou, clim).

Compte environ 20 minutes, redémarrage compris.

---

## 1. Ce qu'il te faut

- **Home Assistant 2025.7 ou plus récent.** Pour voir ta version : **Paramètres → À propos**.
  Breezy a été écrit d'après le code de Home Assistant 2025.7 à 2026.10 et vérifié sur un Home Assistant simulé, **pas encore sur une vraie installation**. Le diagnostic de l'étape 6 sert justement à le vérifier chez toi.
- **Un compte administrateur**, seulement pour l'installation.
- **Où sont les « Outils de développement »** cités plus bas : selon ta version, dans la barre latérale (versions plus anciennes), dans **Paramètres → Outils de développement**, ou dans **Paramètres → Outils** (2026.10 et plus récent).
- **Un moyen de copier des fichiers** dans le dossier `/config` de Home Assistant. Un de ces modules complémentaires suffit (**Paramètres → Modules complémentaires**, appelés **Applications** dans les versions récentes) :
  - **Samba share** : le dossier `/config` apparaît sur ton ordinateur, comme un disque réseau ;
  - **Studio Code Server** : un éditeur dans le navigateur, avec glisser-déposer ;
  - **File editor** : le plus simple à installer, mais il envoie les fichiers un par un.
- **Le fichier `breezy-installation.zip`.**
  - Il est dans le dossier `installation-ha/` du dépôt GitHub, avec `breezy-mise-a-jour.zip` (pour les mises à jour, étape 8). Téléchargement direct : [breezy-installation.zip](https://github.com/Moon-ItachiDEV/HEMS-Breezy/raw/claude/eager-lamport-roaazd/installation-ha/breezy-installation.zip) et [breezy-mise-a-jour.zip](https://github.com/Moon-ItachiDEV/HEMS-Breezy/raw/claude/eager-lamport-roaazd/installation-ha/breezy-mise-a-jour.zip) (connecte-toi à GitHub si le lien demande une connexion).
  - Tu peux aussi le fabriquer depuis le dépôt, sur un ordinateur avec Python 3 : `python3 scripts/build-ha.py`. Les deux zips apparaissent dans le dossier `dist/`.

Le zip contient un dossier `breezy` :

```
breezy/
  breezy-panel.js      le chargeur : c'est lui que Home Assistant appelle (son adresse ne change jamais)
  version.json         le numéro de version
  config.js            tes entités : c'est le seul fichier que tu modifies
  LISEZMOI.txt
  app/
    panel-core.js
    breezy.css
    breezy.js
```

`config.js` est déjà rempli avec les entités de ta maison (celles de la démo). L'étape 5 sert à vérifier qu'elles existent toutes.

---

## 2. Copier les fichiers

Le but : obtenir **`/config/www/breezy/breezy-panel.js`**, avec le reste du dossier à côté.

1. Dézippe `breezy-installation.zip` sur ton ordinateur. Tu obtiens un dossier `breezy`.
2. Mets ce dossier dans le dossier `www` de Home Assistant. Si `www` n'existe pas encore, crée-le (en minuscules), à côté de `configuration.yaml`.

**Avec Samba share**
1. Ouvre le partage `config` :
   - Windows : tape `\\homeassistant.local\config` dans l'Explorateur ;
   - Mac : Finder → Aller → Se connecter au serveur → `smb://homeassistant.local/config`.

   L'identifiant et le mot de passe sont ceux que tu as mis dans la configuration du module Samba.
2. Entre dans `www`, puis glisse-y le dossier `breezy`.

**Avec Studio Code Server**
1. Ouvre Studio Code Server depuis la barre latérale.
2. Dans l'explorateur de fichiers à gauche, ouvre `www`.
3. Glisse le dossier `breezy` depuis ton ordinateur jusque dans `www`.

**Avec File editor** (fichier par fichier)
1. Ouvre File editor, puis clique sur l'icône de dossier en haut à gauche pour parcourir les fichiers.
2. Crée le dossier `www` s'il n'existe pas, puis `www/breezy`, puis `www/breezy/app` (icône « nouveau dossier »).
3. Dans `www/breezy`, envoie `breezy-panel.js`, `version.json`, `config.js` et `LISEZMOI.txt` (icône d'envoi de fichier).
4. Dans `www/breezy/app`, envoie `panel-core.js`, `breezy.css` et `breezy.js`.

> **Si le dossier `www` n'existait pas avant, le redémarrage de l'étape 3 est obligatoire.** Home Assistant ne publie le dossier `www` (à l'adresse `/local/`) que s'il existe au démarrage.

---

## 3. Déclarer le panneau

1. Ouvre `configuration.yaml`, avec File editor ou Studio Code Server.
2. Ajoute ce bloc à la fin, tel quel :

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

- Si ton fichier contient **déjà** une ligne `panel_custom:`, n'en ajoute pas une seconde. Ajoute seulement le bloc qui commence par `- name: breezy-hems-panel` sous la ligne existante, avec le même retrait que les autres panneaux.
- Ne change pas `module_url` pour une mise à jour : le `?v=1` reste le même. Seule exception : si un jour le diagnostic affiche « Chargeur breezy-panel.js d'une autre version », il donne le nouveau `?v=` à mettre (puis redémarrer).
- N'ajoute pas `handle_safe_area` : Breezy n'en a pas besoin, et cette clé fait refuser toute la configuration avant Home Assistant 2026.9.

3. Vérifie la configuration : **Outils de développement → YAML → Vérifier la configuration**. Le message doit dire que la configuration n'empêchera pas Home Assistant de démarrer.
   Si le bouton n'apparaît pas (versions anciennes), active le **mode avancé** dans ton profil (en bas de la barre latérale).
4. Redémarre Home Assistant : **Paramètres → Système → bouton marche/arrêt en haut à droite → Redémarrer Home Assistant**.
   Un « rechargement rapide » ne suffit pas : `panel_custom` n'est lu qu'au démarrage.

---

## 4. Ouvrir Breezy

1. Après le redémarrage, recharge la page de Home Assistant. **« Breezy »** apparaît dans la barre latérale.
2. Ouvre-le. L'Aperçu s'affiche avec tes valeurs en direct. L'historique arrive juste après (un trait animé sous la barre du haut).

À savoir :
- **Sur téléphone**, le bouton ☰ en haut à gauche de Breezy ouvre le menu de Home Assistant. C'est lui qui te permet d'en ressortir.
- **Sur ordinateur**, tu vois deux barres latérales, celle de Home Assistant et celle de Breezy. Tu peux replier celle de Home Assistant avec le bouton ☰ tout en haut de sa barre.
- **Thème** : par défaut, Breezy suit le thème clair ou sombre de Home Assistant. Le menu du profil (en haut à droite) propose Clair, Sombre ou « Comme Home Assistant ».
- **Adresse** : chaque page a la sienne (`/breezy/energy`, `/breezy/vehicle`…). Le bouton Retour du navigateur fonctionne normalement.
- **Application mobile Home Assistant** : Breezy y fonctionne aussi. L'export CSV du Bilan y est masqué.

---

## 5. Vérifier et corriger les entités

Breezy compare `config.js` aux entités que Home Assistant connaît vraiment.

1. Ouvre le diagnostic, au choix :
   - la cloche → **« Configuration à vérifier »** (entités à corriger dans `config.js`) ou **« Points à vérifier »** (le reste) → Voir le détail ;
   - le menu du profil (ton nom, en haut à droite) → **Diagnostic (n)**.
2. Le diagnostic range ce qu'il trouve par groupes :

| Groupe | Ce que ça veut dire | Quoi faire |
|---|---|---|
| **Entités introuvables** (À corriger) | L'entité de `config.js` n'existe pas dans ton Home Assistant, ou ton compte ne la voit pas. Le diagnostic donne l'entité et sa clé (ex. `import_jour_kwh`). | Corrige le nom dans `config.js`. |
| **Historique** | Un compteur n'a pas de statistiques (voir l'étape 6). | Voir l'étape 6. |
| **Cohérence** | Contrôles des chiffres de l'historique. | Rien, sauf si tu vois des chiffres étranges : envoie le diagnostic (étape 6). |
| **Indisponibles en ce moment** (Info) | L'entité existe mais elle est `unavailable` (appareil éteint, intégration en panne). | Rien si c'est passager. |
| **Infos** | Fuseau horaire, compte non administrateur, prévisions des jours suivants… | Pour comprendre, rien d'obligatoire. |

3. Pour trouver le nom exact d'une entité, utilise au choix :
   - **Paramètres → Appareils et services → Entités**, puis la recherche ;
   - **Outils de développement → États**, puis le filtre.

   Le nom à copier est l'« ID d'entité », par exemple `sensor.linky_import_today`.
4. Ouvre `/config/www/breezy/config.js` avec File editor ou Studio Code Server et corrige la ligne, par exemple :

```js
  import_jour_kwh: "sensor.linky_import_today",
```

   Garde les guillemets et la virgule de fin. Une seule faute de frappe (guillemet ou virgule oubliés) empêche Breezy de démarrer. Il affiche alors « Breezy n'a pas pu se charger » avec `config.js` comme fichier en cause.
5. Enregistre, puis **recharge la page**. Pas de redémarrage : `config.js` est relu à chaque ouverture de Breezy.

**À vérifier une fois dans `config.js`**, même si le diagnostic ne dit rien :
- `solaire_mise_en_service` : la vraie date de mise en service des panneaux (`AAAA-MM-JJ`). C'est là que commence l'historique, et elle sert au calcul de rentabilité.
- `economies_total_eur` : le capteur qui affiche le cumul de tes économies.
- `plages_tarifaires` : tes heures super creuses et creuses (tout le reste compte en heures pleines).
- `voiture_charge_w` : la puissance de la borne. Dans Home Assistant, Breezy la compte comme puissance de la voiture seulement pendant une charge.
- `prevision_jours_kwh` : les prévisions des jours suivants (par exemple les capteurs Solcast « demain », « jour 3 »…), dans l'ordre. Sans elles, le Bilan n'affiche pas de barres « prévu » après aujourd'hui.

**Clés facultatives**, en fin de `config.js`. Vide ou absente, une clé garde sa valeur par défaut.

| Clé | À quoi elle sert |
|---|---|
| `stat_production`, `stat_import`, `stat_export` | Lire l'historique sur un autre compteur que celui du direct. |
| `stat_batterie_charge`, `stat_batterie_decharge` | Idem pour la batterie. Par défaut, les compteurs cumulés de la batterie, sinon ceux du jour. |
| `stat_ve_solaire`, `stat_ve_reseau` | Idem pour les recharges de la voiture. |
| `stat_economies` | Idem pour les économies. Par défaut, le cumul, sinon celui du jour. |
| `stat_import_hp`, `stat_import_hc`, `stat_import_hsc` | Tes compteurs d'achat par tarif (`utility_meter`), si tu en as. Sinon Breezy fait le calcul heure par heure avec `plages_tarifaires`. |
| `prevision_jours_kwh` | Les prévisions des jours suivants : `["sensor.…_demain", "sensor.…_jour_3"]`. |
| `tarif_hp_defaut`, `tarif_hc_defaut`, `tarif_hsc_defaut` | Les prix (€/kWh) utilisés si les `input_number` des tarifs sont indisponibles. |
| `prix_revente_kwh` | Le prix de revente du surplus, seulement pour les économies estimées (voir l'étape 6). |
| `historique_debut` | Jusqu'où le Bilan permet de remonter (`AAAA-MM-JJ`) ; par défaut, `solaire_mise_en_service`. Le début réel de chaque compteur est trouvé tout seul. |
| `historique_rafraichir_min` | Toutes les combien de minutes l'historique du jour est relu (10 par défaut). |
| `voiture_delai_confirmation_s` | Combien de secondes attendre que la voiture confirme une commande (120 par défaut). |
| `voiture_releve_apres_commande_s` | Si la voiture n'a pas confirmé après ce nombre de secondes, Breezy demande un relevé (0 = jamais). |
| `police_externe` | `false` : Breezy n'appelle jamais Google Fonts et garde la police du système. |
| `utilisateur_nom` | Le nom affiché ; par défaut, ton nom dans Home Assistant. |

---

## 6. L'historique

Breezy lit les **statistiques long terme** de Home Assistant, comme le tableau de bord Énergie. Elles sont gardées des années, contrairement à l'historique des états, effacé après 10 jours par défaut.

**Ce qu'il faut à chaque compteur.** Un capteur n'a de statistiques que s'il a un `state_class` :
- les compteurs d'énergie et d'économies ont besoin de `state_class: total_increasing` (ou `total`) et d'une unité d'énergie (Wh, kWh, MWh) ou en € ;
- le niveau de la batterie a besoin de `state_class: measurement`.

| Clé de `config.js` | Ce qu'elle compte | `state_class` attendu |
|---|---|---|
| `production_jour_kwh` | Production solaire | `total_increasing` |
| `import_jour_kwh` | Achat au réseau | `total_increasing` |
| `export_jour_kwh` | Revente au réseau | `total_increasing` |
| `batterie_total_charge_kwh` (sinon `batterie_charge_jour_kwh`) | Charge de la batterie | `total_increasing` |
| `batterie_total_decharge_kwh` (sinon `batterie_decharge_jour_kwh`) | Décharge de la batterie | `total_increasing` |
| `ve_solaire_kwh`, `ve_reseau_kwh` | Recharge de la voiture (solaire, réseau) | `total_increasing` |
| `economies_total_eur` (sinon `economies_jour_eur`) | Économies | `total_increasing` ou `total` |
| `batterie_soc` | Niveau de la batterie | `measurement` |

Un compteur remis à zéro chaque nuit convient très bien : Home Assistant gère la remise à zéro.

**Pour vérifier :**
1. Va dans **Outils de développement → Statistiques**.
2. Cherche chaque capteur du tableau. Il doit être dans la liste, sans problème signalé à côté.
3. Pour voir son `state_class`, regarde ses attributs dans **Outils de développement → États**.

**S'il manque un `state_class`**, ajoute-le dans la définition du capteur, par exemple pour un capteur `template` :

```yaml
template:
  - sensor:
      - name: "VE énergie solaire"
        unique_id: ve_energie_solaire_kwh
        unit_of_measurement: kWh
        device_class: energy
        state_class: total_increasing
        availability: "{{ has_value('sensor.ma_source_kwh') }}"
        state: "{{ states('sensor.ma_source_kwh') | float }}"
```

> **Jamais de valeur par défaut à 0 sur un compteur** (`| float(0)`). Si la source devient indisponible (redémarrage de Home Assistant, panne du cloud Kia…), le compteur tomberait à 0 : Home Assistant y verrait une remise à zéro, et au retour de la source il compterait **tout le compteur** (par exemple 1 234 kWh) comme consommé dans l'heure. Ce pic resterait pour toujours dans ses statistiques et dans le tableau Énergie. Avec `availability`, le capteur est simplement « indisponible » pendant la panne, et rien n'est faussé. (Breezy écarte une heure invraisemblable et le signale dans le diagnostic, mais l'erreur reste dans Home Assistant.)

L'identifiant du nouveau capteur vient de son `name` : ici `sensor.ve_energie_solaire` (et pas `sensor.ma_source_kwh`). Vérifie-le dans **Outils de développement → États**, puis mets-le dans `config.js`, sur la clé qui correspond (ici `ve_solaire_kwh`, ou `stat_ve_solaire` si tu veux garder l'ancien capteur pour le direct).

Si le capteur vient d'une intégration que tu ne peux pas modifier, tu peux le lui ajouter avec `customize` dans `configuration.yaml`, puis redémarrer :

```yaml
homeassistant:
  customize:
    sensor.ve_energie_solaire_kwh:
      state_class: total_increasing
      device_class: energy
```

> **Seulement pour un vrai compteur**, c'est-à-dire un total qui ne fait que monter, avec éventuellement une remise à zéro. Jamais pour une puissance en W, ni pour une valeur qui monte et descend.

**Combien de temps attendre.**
- Les nouvelles statistiques apparaissent au bout d'une heure environ.
- Il n'y a pas d'historique **avant** le jour où le capteur a reçu son `state_class`. Breezy trouve tout seul ce jour pour chaque compteur : avant, il affiche « — » (jamais 0), le sous-titre du Bilan dit « historique dès le … », et les comparaisons (« vs 2025 à date ») ne portent que sur la période connue des deux côtés (« dès le … »). Le diagnostic dit quel compteur commence tard. Si un autre compteur de `config.js` (par exemple celui du jour plutôt que le cumul) a un historique plus long, Breezy le prend.
- Avant `solaire_mise_en_service`, la production, la batterie et les économies valent 0 (s'il n'y a pas de statistiques) ; l'achat au réseau, lui, est lu.
- `historique_debut` ne fait que fixer jusqu'où le Bilan permet de remonter.

**Ce que tu peux voir en attendant :**
- « Chargement de l'historique… » ou « — » : les statistiques arrivent, c'est normal pendant quelques secondes.
- « Historique indisponible » : un compteur d'énergie n'a pas de statistiques. Le diagnostic dit lequel.
- « Pas d'historique de recharge » (Voiture) : les compteurs de la borne n'ont pas de statistiques.
- « estimé avec tes tarifs » (Bilan, économies) : le compteur d'économies n'a pas d'historique. Breezy l'estime heure par heure : (solaire consommé directement + batterie) × prix du tarif de cette heure (HP, HC ou HSC) + revente × `prix_revente_kwh`. « estimé au prix des heures pleines » : les heures n'ont pas pu être lues, l'estimation prend le prix HP.
- « Valeur écartée » (diagnostic) : une heure invraisemblable dans un compteur (souvent un compteur retombé à 0 puis revenu). Breezy l'écarte du jour, du mois, de l'année et de la rentabilité ; l'énergie réelle de cette heure-là est perdue. Corrige la cause (voir l'encadré sur `availability` plus haut).

**Envoie le diagnostic une fois l'installation finie. C'est important.**
Les calculs d'historique de Breezy ont été vérifiés sur des données générées, pas encore sur les tiennes.
1. Ouvre le diagnostic (étape 5).
2. Appuie sur **« Copier le diagnostic »** (« Diagnostic copié » s'affiche). Si le navigateur bloque quand même la copie, le texte s'affiche dans une zone : sélectionne-le et copie-le à la main.
3. Colle-le dans la conversation.

Il contient tes noms d'entités, leurs valeurs, la description de leurs statistiques et un petit échantillon brut des dernières heures et des 3 derniers jours. Il ne contient **ni mot de passe, ni jeton, ni ton nom, ni l'adresse** de ton Home Assistant. Avec lui, on vérifie que les chiffres du Bilan correspondent exactement à tes compteurs.

---

## 7. Un utilisateur dédié (facultatif)

Par exemple pour une tablette murale ou un autre membre de la famille.
1. **Paramètres → Personnes → Ajouter une personne.**
2. Active « Autoriser la connexion », **sans** « Administrateur ».

À savoir :
- `require_admin: false` permet à ce compte de voir Breezy et de piloter les appareils. Breezy n'a pas besoin d'un compte administrateur.
- Un compte qui n'a que le droit de lecture voit tout, mais ses commandes sont refusées avec un message clair : « Ton compte Home Assistant n'a pas le droit de piloter cet appareil. »
- On ne peut pas cacher le panneau à une seule personne. `require_admin: true` le réserve aux administrateurs. Chacun peut aussi masquer « Breezy » de sa propre barre latérale : profil → modifier l'ordre et masquer des éléments de la barre latérale, ou appui long sur le titre de la barre latérale.

---

## 8. Mettre à jour

1. **Fais d'abord une copie de ton `config.js`** (`/config/www/breezy/config.js`) sur ton ordinateur. C'est le seul fichier que tu as modifié.
2. Dézippe `breezy-mise-a-jour.zip`. Tu obtiens un dossier `breezy`, **sans** `config.js` (exprès : le tien doit rester).
3. **Ouvre** ce dossier `breezy` et copie **ce qu'il contient** (les fichiers et le dossier `app`) dans `/config/www/breezy/`, en acceptant de remplacer les fichiers.
   - **Ne glisse pas le dossier `breezy` entier sur l'ancien.** Sur Mac, le Finder propose alors « Remplacer », qui remplace le dossier entier et **supprime ton `config.js`** (« Fusionner » n'apparaît qu'en glissant avec la touche Option). Breezy afficherait ensuite « Breezy n'a pas pu se charger · config.js ».
   - Avec File editor, envoie les fichiers un par un, comme à l'étape 2, sauf `config.js`.
   - Si `config.js` a disparu quand même : remets ta copie dans `/config/www/breezy/`.
4. Recharge la page :
   - ordinateur : Ctrl+Maj+R (Cmd+Maj+R sur Mac) ;
   - application mobile : Paramètres → Application compagnon → Dépannage → Réinitialiser le cache du frontend, ou ferme et rouvre l'application.

Pas de modification du YAML et pas de redémarrage. Le numéro de version (par exemple `Breezy 2026.10.09-1a2b3c4d`) est visible dans le diagnostic et dans le menu du profil.

Si le diagnostic affiche « Mise à jour incomplète », un fichier n'a pas été copié : recopie le contenu du dossier, puis recharge la page.
Si le diagnostic affiche « Chargeur breezy-panel.js d'une autre version » : dans `configuration.yaml`, mets à `module_url` le `?v=` qu'il indique, puis redémarre Home Assistant (étape 3). C'est rare : seulement quand le chargeur lui-même change.

---

## 9. Dépannage

| Ce que tu vois | Quoi faire |
|---|---|
| Pas d'entrée « Breezy » dans la barre latérale | Vérifie le bloc YAML (étape 3), puis redémarre. Va voir **Paramètres → Système → Journaux** : cherche « panel_custom » ou « Unable to register panel ». Si l'adresse `breezy` est déjà prise, change `url_path`. |
| Page blanche, ou « Unable to load the panel source » / « Impossible de charger la source du panneau » | Le fichier `/config/www/breezy/breezy-panel.js` n'est pas trouvé. Vérifie le chemin et les minuscules. Si `www` a été créé après le démarrage, redémarre. Test : ouvre `http://<ton-ha>:8123/local/breezy/version.json` dans le navigateur ; tu dois voir le numéro de version. |
| Cadre « Breezy n'a pas pu se charger » | Il nomme le fichier en cause. `config.js` : une faute de frappe (guillemet, virgule) ; le cadre donne la ligne. Corrige-la puis recharge. Un autre fichier : il manque, recopie le contenu du dossier. Sur téléphone, le bouton « Menu Home Assistant » du cadre rouvre le menu (pour aller dans File editor). |
| L'ancienne version s'affiche | Vide le cache comme à l'étape 8. |
| « Entité introuvable » | Corrige `config.js` (étape 5). |
| Valeurs « — » ou « Historique indisponible » | Un `state_class` manque, ou les statistiques ne sont pas encore créées : attends une heure (étape 6). |
| Chiffres étranges dans le Bilan | Envoie le diagnostic (étape 6). |
| « Ton compte Home Assistant n'a pas le droit de piloter cet appareil » | Le compte connecté n'a que le droit de lecture (étape 7). |
| « Cette action n'existe pas dans Home Assistant » | L'intégration de cet appareil n'est pas installée dans ton Home Assistant (par exemple pas d'aspirateur ou pas de lecteur multimédia). Vérifie les entités dans le diagnostic. |
| Voiture lente, « en cours » longtemps | C'est normal : Kia Connect passe par le cloud et peut mettre jusqu'à 2 minutes. Tu peux changer d'onglet ou d'application pendant ce temps. « La voiture n'a pas confirmé » veut dire qu'elle n'a pas répondu dans le délai (`voiture_delai_confirmation_s`). « Hors ligne : commande non envoyée » : la connexion à Home Assistant était coupée, rien n'est parti ; réessaie une fois reconnecté. |
| Erreur YAML après avoir ajouté `handle_safe_area` | Cette clé n'existe qu'à partir de Home Assistant 2026.9. Retire-la. |
| Deux barres latérales sur ordinateur | Replie celle de Home Assistant (étape 4). |
| Pastille « Hors ligne » (un point orange sur petit téléphone) | La connexion à Home Assistant est coupée. Les dernières valeurs restent affichées et Breezy se reconnecte tout seul. |
| « Valeur écartée » dans le diagnostic | Une heure invraisemblable d'un compteur a été écartée (étape 6). Corrige la cause dans Home Assistant (souvent `float(0)` dans un capteur `template`). |

---

## 10. Confidentialité

- **Les fichiers de `/config/www` sont lisibles sans connexion** par quiconque peut joindre ton Home Assistant. `config.js` ne contient que des noms d'entités et des réglages, jamais de mot de passe ni de jeton. N'y mets jamais de jeton d'accès. Le script de fabrication du paquet refuse d'ailleurs d'en livrer un.
- Breezy utilise la session de la personne connectée à Home Assistant. Il ne demande aucun mot de passe et n'envoie tes données nulle part.
- Seule exception : la police Inter vient de Google Fonts. Mets `police_externe: false` dans `config.js` pour ne jamais l'appeler.

---

## 11. Désinstaller

1. Retire le bloc `panel_custom` de Breezy de `configuration.yaml`.
2. Redémarre Home Assistant.
3. Supprime le dossier `/config/www/breezy/`.
