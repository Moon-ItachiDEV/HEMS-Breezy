#!/usr/bin/env python3
"""Génère le thème « Océan » de la V2 à partir de la V1.

- v2/style.css      : css/style.css avec les couleurs transformées
- v2/colormap.js    : la même transformation pour les couleurs écrites dans js/app.js
- v2/index.html     : index.html pointé sur ces fichiers, avec data-variant="v2"

Règles : orange (marque, soleil) -> sarcelle, vert (réseau, économies) -> ambre,
violet (voiture) -> magenta, bleu (batterie) -> indigo, neutres chauds -> gris bleutés.
Relancer après chaque modification de la V1 : python3 scripts/build-v2.py
"""
import colorsys, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

def shift(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    deg = h * 360
    if s < 0.22 or l > 0.965 or l < 0.08:          # neutres : teinte bleutée, saturation faible
        if s > 0.02:
            h, s = 212 / 360, min(s, 0.12)
    elif deg < 9 or deg > 345:                       # rouges : inchangés
        pass
    elif deg < 39:                                   # oranges -> sarcelle
        h = 174 / 360; s = min(1, s * 0.82); l = l * 0.92 if l > 0.4 else l
    elif deg < 58:                                   # jaunes (lumières) : inchangés
        pass
    elif 95 <= deg < 170:                            # verts -> ambre
        h = 36 / 360; s = min(1, s * 1.25); l = min(0.6, l * 1.1)
    elif 200 <= deg < 228:                           # bleus -> indigo
        h = 230 / 360
    elif 245 <= deg < 290:                           # violets -> magenta
        h = 330 / 360
    elif 320 <= deg <= 345:                          # rose HP -> rouge profond
        h = 352 / 360
    r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
    return round(r2 * 255), round(g2 * 255), round(b2 * 255)

def hexmap(m):
    v = m.group(0)[1:]
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    r, g, b = (int(v[i:i + 2], 16) for i in (0, 2, 4))
    return "#%02x%02x%02x" % shift(r, g, b)

def rgbamap(m):
    r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
    r2, g2, b2 = shift(r, g, b)
    return f"rgba({r2}, {g2}, {b2}"

HEX = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])")
RGBA = re.compile(r"rgba\((\d+),\s*(\d+),\s*(\d+)")

css = (ROOT / "css/style.css").read_text()
css = RGBA.sub(rgbamap, HEX.sub(hexmap, css))
(ROOT / "v2/style.css").write_text("/* Généré par scripts/build-v2.py à partir de css/style.css : ne pas modifier à la main */\n" + css)

js = (ROOT / "js/app.js").read_text()
cmap = {c.lower(): hexmap(re.match(HEX, c)) for c in sorted(set(re.findall(r"#[0-9a-fA-F]{6}\b", js)))}
(ROOT / "v2/colormap.js").write_text("// Généré par scripts/build-v2.py\nwindow.BREEZY_COLORMAP = " +
    "{" + ", ".join(f'"{k}": "{v}"' for k, v in cmap.items()) + "};\n")

html = (ROOT / "index.html").read_text()
html = html.replace('<html lang="fr">', '<html lang="fr" data-variant="v2">')
html = html.replace('<title>Breezy HEMS</title>', '<title>Breezy HEMS · V2</title>')
html = html.replace('content="#e8711a"', 'content="%s"' % hexmap(re.match(HEX, "#e8711a")))
html = html.replace('href="css/style.css"', 'href="style.css"')
html = html.replace('<script src="js/config.js"></script>', '<script src="../js/config.js"></script>')
html = html.replace('<script src="js/mock.js"></script>', '<script src="../js/mock.js"></script>\n  <script src="colormap.js"></script>')
html = html.replace('<script src="js/app.js"></script>', '<script src="../js/app.js"></script>')
html = html.replace("v1 · démo", "v2 · démo")
(ROOT / "v2/index.html").write_text(html)
print("v2 générée :", len(cmap), "couleurs JS,", len(css), "octets de CSS")
