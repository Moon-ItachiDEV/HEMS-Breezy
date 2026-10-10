#!/usr/bin/env python3
"""Usage : python3 scripts/build-hero-art.py
Fabrique v3/js/hero-art.js (le décor du héros de l'Aperçu) à partir de v3/art/maison.svg :
- garde l'intérieur du SVG, sans titre, description ni repères ;
- préfixe tous les identifiants par « mh- » (aucune collision avec les autres SVG de la page) ;
- retire le fond et le sol gris de la photo : la maison se pose sur le fond de la page ;
- ajoute la gaine du coffret vers le garage (recharge de la voiture).
Les chemins des flux restent dans hero.js : ils suivent les gaines du dessin."""
import json, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "v3/art/maison.svg").read_text(encoding="utf-8")
body = src[src.index(">", src.index("<svg")) + 1:src.rindex("</svg>")]
body = re.sub(r"<title>.*?</title>|<desc>.*?</desc>", "", body, flags=re.S)
body = re.sub(r'<g id="reperes".*?</g>', "", body, flags=re.S)
body = re.sub(r'<path id="gaine-[a-z-]+-flux"[^>]*/>', "", body)          # chemins de flux : dans hero.js
body = re.sub(r'\bid="([^"]+)"', r'id="mh-\1"', body)
body = re.sub(r"url\(#([^)]+)\)", r"url(#mh-\1)", body)
body = re.sub(r'href="#([^"]+)"', r'href="#mh-\1"', body)
# Ni fond ni sol gris : la maison se pose sur le fond de la page (seules ses ombres douces restent)
for gone in ('<rect x="0" y="0" width="1179" height="779" fill="url(#mh-gFond)"/>', '<polygon points="0,560 1179,560 1179,779 0,779" fill="url(#mh-gSol)"/>'):
    assert gone in body, gone
    body = body.replace(gone, "", 1)
# Gaines coffret → garage et tranchée → réseau, dans le même style que les autres gaines
# (au repos, chaque trajet d'énergie se lit comme une gaine grise)
garage = ('<g id="mh-gaine-garage"><path d="M787,552 L897,537" stroke="#7d7e84" stroke-width="4" opacity="0.4" filter="url(#mh-fFlouG)" transform="translate(1.5 2)"/>'
          '<path d="M787,552 L897,537" stroke="#78797e" stroke-width="6"/><path d="M787,550 L897,535" stroke="#9a9ba0" stroke-width="1" opacity="0.6"/></g>')
assert '<g id="mh-gaine-sol">' in body
tranchee = ('<g id="mh-gaine-tranchee"><path d="M775,679.5 L918,752" stroke="#7d7e84" stroke-width="4" opacity="0.4" filter="url(#mh-fFlouG)" transform="translate(1 2.5)"/>'
            '<path d="M775,679.5 L918,752" stroke="#78797e" stroke-width="5.6"/><path d="M776,677.6 L919,750.1" stroke="#9a9ba0" stroke-width="1" opacity="0.6"/></g>')
body = body.replace('<g id="mh-gaine-sol">', garage + tranchee + '<g id="mh-gaine-sol">', 1)
assert body.count('url(#mh-') > 50 and 'url(#g' not in body and 'url(#f' not in body
# Contours des panneaux (masque du reflet qui balaie le toit quand le soleil produit)
pan = body[body.index('<g id="mh-panneaux">'):]
pan = pan[:pan.index("</g>")]
panels = re.findall(r'<polygon points="([^"]+)"', pan)
assert len(panels) >= 10
out = root / "v3/js/hero-art.js"
out.write_text("// Fichier fabriqué par scripts/build-hero-art.py à partir de v3/art/maison.svg : ne pas modifier à la main.\n"
               "(window.BZ = window.BZ || {}).HERO_ART = " + json.dumps(" ".join(body.split()), ensure_ascii=False) + ";\n"
               "BZ.HERO_PANELS = " + json.dumps(panels) + ";\n", encoding="utf-8")
print(out.relative_to(root), f"{out.stat().st_size / 1024:.0f} Ko")
