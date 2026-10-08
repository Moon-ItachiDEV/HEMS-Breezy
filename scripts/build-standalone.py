#!/usr/bin/env python3
"""Assemble v2/ en un seul fichier HTML autonome (CSS et JS en ligne).
Usage : python3 scripts/build-standalone.py [sortie.html]   (défaut : dist/breezy-hems-v2.html)"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
v2 = root / "v2"
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "dist" / "breezy-hems-v2.html"
html = (v2 / "index.html").read_text(encoding="utf-8")

def css(m):
    return "<style>\n" + (v2 / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

def js(m):
    code = (v2 / m.group(1)).resolve().read_text(encoding="utf-8").replace("</script", "<\\/script")
    return "<script>\n" + code + "\n</script>"

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)
html = re.sub(r'<script src="([^"]+)"></script>', js, html)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"{out} · {len(html) // 1024} Ko")
