#!/usr/bin/env python3
"""Empaquette la V3 en panneau Home Assistant (panel_custom avec embed_iframe: true).
Usage : python3 scripts/build-ha.py [--out dist]
  dist/breezy/                    dossier à copier dans /config/www/ (il devient /config/www/breezy/)
    breezy-panel.js               chargeur = module_url du YAML ; même contenu à chaque version, son adresse ne change jamais
    version.json                  numéro de version, relu à chaque ouverture : c'est lui qui fait charger les nouveaux fichiers
    config.js                     tes entités (copie de js/config.js), à modifier sur place
    LISEZMOI.txt
    app/panel-core.js             cœur du panneau, avec la liste de ses fichiers (BUILD)
    app/breezy.css, app/breezy.js tous les styles et scripts de la V3 + ceux du panneau (v3/ha/), dans l'ordre de v3/index.html
  dist/breezy-installation.zip    le dossier breezy/ complet
  dist/breezy-mise-a-jour.zip     le même sans config.js : une mise à jour garde le tien
Chaque adresse porte la version (?v=…) : HA garde /local/ 31 jours en cache, une mise à jour se voit pourtant
au simple rechargement de la page. La démo n'est pas touchée (v3/index.html et build-standalone.py ignorent v3/ha/)."""
import datetime, hashlib, html.parser, json, pathlib, re, shutil, subprocess, sys, tempfile, zipfile

root = pathlib.Path(__file__).resolve().parent.parent
v3 = root / "v3"
args = sys.argv[1:]
out = pathlib.Path(args[args.index("--out") + 1]).resolve() if "--out" in args else root / "dist"
dest = out / "breezy"
PLACEHOLDER = "/*@BZ_BUILD*/null/*@END*/"
# Le chargeur (v3/ha/panel.js → breezy-panel.js) garde la même adresse, que le navigateur et le service worker de HA gardent
# 31 jours en cache : s'il change, l'utilisateur doit changer ?v= dans module_url (et redémarrer HA). LOADER_V est ce ?v=,
# LOADER_SHA l'empreinte de panel.js pour chaque valeur : un panel.js modifié sans nouvelle valeur est refusé.
LOADER_V = "1"
LOADER_SHA = {"1": "af02b28888682a6f"}
YAML = f"""panel_custom:
  - name: breezy-hems-panel
    url_path: breezy
    sidebar_title: Breezy
    sidebar_icon: mdi:solar-power-variant
    module_url: /local/breezy/breezy-panel.js?v={LOADER_V}
    embed_iframe: true
    require_admin: false
"""

def fail(msg):
    print(f"✗ {msg}", file=sys.stderr)
    sys.exit(1)

def read(p):
    return p.read_text(encoding="utf-8")

# ─── v3/index.html : styles, polices, scripts et squelette, comme panel-core.js le fait en mode sources ───
index = read(v3 / "index.html")

class Links(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == "link": self.links.append(dict(attrs))

parser = Links(); parser.feed(index)
css, fonts = [], []
for l in parser.links:
    href = l.get("href") or ""
    if re.search(r"fonts\.(googleapis|gstatic)\.com", href):
        if l.get("rel") in ("stylesheet", "preconnect"): fonts.append({"rel": l["rel"], "href": href, "cors": "crossorigin" in l})
    elif l.get("rel") == "stylesheet":
        css.append((v3 / href).resolve())
css.append(v3 / "ha" / "ha.css")

body = re.search(r"<body[^>]*>(.*)</body>", index, re.S).group(1)
js = []   # (nom affiché, code)
for m in re.finditer(r"<script(?:\s+src=\"([^\"]+)\")?\s*>(.*?)</script>", body, re.S):
    src, code = m.group(1), m.group(2)
    if not src:
        js.append(("v3/index.html (script en ligne)", code.strip() + "\n")); continue
    path = (v3 / src).resolve()
    if path in (root / "js" / "config.js", root / "js" / "mock.js"):   # config.js : à part, toujours relu ; mock.js : jamais dans HA
        continue
    js.append((path.relative_to(root).as_posix(), read(path)))
    if src == "js/core.js": js.append(("v3/ha/history.js", read(v3 / "ha" / "history.js")))
    if src == "js/sheets.js": js.append(("v3/ha/diag.js", read(v3 / "ha" / "diag.js")))
names = [n for n, _ in js]
for need in ("v3/js/core.js", "v3/ha/history.js", "v3/js/sheets.js", "v3/ha/diag.js", "v3/js/app.js"):
    if need not in names: fail(f"{need} absent de la liste des scripts (v3/index.html a changé ?)")
shell = re.sub(r"\s*<script\b[^>]*>.*?</script>", "", body, flags=re.S)
shell = re.sub(r"\s*<!--.*?-->", "", shell, flags=re.S).strip() + "\n"

# ─── Contenus, puis version = date + empreinte de tout ce que le navigateur charge ───
css_text = '@charset "UTF-8";\n' + "".join(f"/* ═══ {p.relative_to(root).as_posix()} */\n{read(p).rstrip()}\n\n" for p in css)
js_body = ";\n".join(f"// ═══ {n}\n{code.rstrip()}\n" for n, code in js)
core_src = read(v3 / "ha" / "panel-core.js")
loader = read(v3 / "ha" / "panel.js")
if core_src.count(PLACEHOLDER) != 1: fail(f"{PLACEHOLDER} doit apparaître une fois dans v3/ha/panel-core.js")
# Chargeur : même contrat des deux côtés, empreinte connue pour ce ?v=, guide et README à jour
loader_sha = hashlib.sha256(loader.replace("\r\n", "\n").encode()).hexdigest()[:16]
api = {n: re.search(r"const LOADER_API = (\d+);", t) for n, t in (("v3/ha/panel.js", loader), ("v3/ha/panel-core.js", core_src))}
for n, m in api.items():
    if not m or m.group(1) != LOADER_V: fail(f"{n} : LOADER_API doit valoir {LOADER_V} (LOADER_V de scripts/build-ha.py)")
if LOADER_SHA.get(LOADER_V) != loader_sha:
    fail(f"v3/ha/panel.js a changé (empreinte {loader_sha}) : les navigateurs garderaient l'ancien 31 jours. Passe LOADER_V à "
         f"{int(LOADER_V) + 1} ici, LOADER_API à {int(LOADER_V) + 1} dans panel.js et panel-core.js, ajoute l'empreinte dans LOADER_SHA, "
         f"et mets ?v={int(LOADER_V) + 1} dans docs/installation-home-assistant.md et README.md (avec une note : changer module_url puis redémarrer)")
for doc in ("docs/installation-home-assistant.md", "README.md"):
    t = read(root / doc)
    if f"breezy-panel.js?v={LOADER_V}" not in t or re.search(r"breezy-panel\.js\?v=(?!" + LOADER_V + r"\b)\d+", t): fail(f"{doc} doit donner module_url …breezy-panel.js?v={LOADER_V}")
build = {"css": ["breezy.css"], "js": ["breezy.js"], "config": "../config.js", "fonts": fonts, "shell": shell}
digest = hashlib.sha1("\0".join([css_text, js_body, core_src, json.dumps(build, sort_keys=True), loader]).encode()).hexdigest()[:8]
now = datetime.datetime.now().astimezone()
V = f"{now:%Y.%m.%d}-{digest}"

files = {
    "breezy-panel.js": loader,
    "version.json": json.dumps({"version": V, "core": "app/panel-core.js", "built": now.isoformat(timespec="seconds")}, indent=1) + "\n",
    "config.js": read(root / "js" / "config.js"),
    "app/breezy.css": css_text,
    # BOM : le navigateur lit ce script en UTF-8 quel que soit l'en-tête envoyé par le serveur
    "app/breezy.js": "\ufeff" + f"/* Breezy HEMS {V} : panneau Home Assistant, généré par scripts/build-ha.py (ne pas modifier) */\nwindow.BZ_BUILD = {json.dumps(V)};\n" + js_body,
    "app/panel-core.js": core_src.replace(PLACEHOLDER, json.dumps({"version": V, **build}, ensure_ascii=True)),
    "LISEZMOI.txt": f"""Breezy HEMS {V} : panneau pour Home Assistant

1. Copie ce dossier « breezy » dans /config/www/ pour obtenir /config/www/breezy/breezy-panel.js
   (si le dossier www n'existait pas, redémarre Home Assistant une fois).
2. Ajoute ce bloc dans configuration.yaml, vérifie la configuration, puis redémarre Home Assistant :

{YAML}
3. Ouvre « Breezy » dans la barre latérale. Cloche ou menu du profil → Diagnostic : ce qu'il reste à corriger.
4. Tes entités sont dans config.js (à modifier ici même, puis recharger la page ; pas de redémarrage).

Mise à jour :
  1. Fais d'abord une copie de ton config.js (sur ton ordinateur).
  2. Dézippe breezy-mise-a-jour.zip, ouvre son dossier « breezy » et copie ce qu'il CONTIENT (les fichiers et le dossier
     app) dans /config/www/breezy/, en remplaçant les fichiers. Ne remplace pas le dossier breezy entier : sur Mac, le
     Finder supprimerait ton config.js (le zip de mise à jour n'en a pas, exprès). Sur Mac, glisser avec la touche Option
     et choisir « Fusionner » marche aussi.
  3. Recharge la page. Le YAML ne change pas et aucun redémarrage n'est nécessaire, sauf si le diagnostic demande de
     changer ?v= dans module_url.
Guide complet, pas à pas : docs/installation-home-assistant.md dans le dépôt Breezy HEMS.
""",
}

# ─── Vérifications (échec = rien n'est livré) ───
if re.search(r"MOCK_STATES\s*=(?!=)", files["app/breezy.js"]): fail("breezy.js contient les états de démo (MOCK_STATES)")
for need in ('id="view"', 'id="sheet"', 'id="hatch"', 'id="top"'):
    if need not in shell: fail(f"squelette incomplet : {need} absent")
# Mots interdits (marques tierces, noms de modèles) : comparés par empreinte, pour ne jamais les écrire ici
BANNED = {"71cf66c113e1f2cc", "8a1ecd6fb1c43467", "f9888e7eee7eec7c", "c857d09db23e6822", "c70eca6b0f88f44d", "7d3194f79e645c42",
          "60965168ce762e94", "053ea4804ef1bb33", "5d72436256ada538", "fc5a1047f5919892", "3ea125d0bff386e6", "c9ad8f2cc1294afa",
          "e12ce8285efc67c6", "5a5110ebe1544b31"}
for name, text in files.items():
    words = {w.lower() for w in re.findall(r"[A-Za-z0-9]+", text)} | {w.lower() for w in re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])", text)}
    if any(hashlib.sha256(w.encode()).hexdigest()[:16] in BANNED for w in words): fail(f"{name} contient un mot interdit")
    # /config/www est lisible sans connexion : jamais de jeton d'accès (les jetons longue durée de HA commencent par eyJ)
    if re.search(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}", text): fail(f"{name} contient un jeton d'accès : à retirer, /config/www est public")

# Syntaxe des trois scripts (si node est installé) ; panel.js et panel-core.js sont des modules
node = shutil.which("node")
if node:
    with tempfile.TemporaryDirectory() as tmp:
        for name, kind in (("app/breezy.js", ".js"), ("app/panel-core.js", ".mjs"), ("breezy-panel.js", ".mjs")):
            t = pathlib.Path(tmp) / ("check" + kind)
            t.write_text(files[name], encoding="utf-8")
            r = subprocess.run([node, "--check", str(t)], capture_output=True, text=True)
            if r.returncode: fail(f"{name} : erreur de syntaxe\n{r.stderr.strip()}")
else:
    print("(node absent : vérification de syntaxe sautée)")

# ─── Écriture : dist/breezy/ refait à neuf ───
if dest.exists():
    if not (dest / "breezy-panel.js").exists(): fail(f"{dest} existe et ne vient pas de ce script : je n'y touche pas")
    shutil.rmtree(dest)
for name, text in files.items():
    p = dest / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

def zip_to(path, skip=()):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(dest.rglob("*")):
            rel = p.relative_to(dest).as_posix()
            if p.is_file() and rel not in skip: z.write(p, f"breezy/{rel}")
zip_to(out / "breezy-installation.zip")
zip_to(out / "breezy-mise-a-jour.zip", skip=("config.js",))

print(f"Breezy {V}")
for name in sorted(files):
    print(f"  breezy/{name:<20} {len((dest / name).read_bytes()) / 1024:7.1f} Ko")
for z in ("breezy-installation.zip", "breezy-mise-a-jour.zip"):
    print(f"  {z:<27} {(out / z).stat().st_size / 1024:7.1f} Ko")
print(f"\nÀ copier dans /config/www/ : {dest}\nBloc à ajouter dans configuration.yaml (une seule fois) :\n\n{YAML}")
