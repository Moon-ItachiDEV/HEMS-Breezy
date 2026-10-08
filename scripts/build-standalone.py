#!/usr/bin/env python3
"""Assemble une version (v2/, v3/…) en un seul fichier HTML autonome (CSS et JS en ligne).
Usage : python3 scripts/build-standalone.py [version] [sortie.html]
        défaut : v3 → dist/breezy-hems-v3.html"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
version = sys.argv[1] if len(sys.argv) > 1 else "v3"
src = root / version
out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else root / "dist" / f"breezy-hems-{version}.html"
html = (src / "index.html").read_text(encoding="utf-8")

def css(m):
    return "<style>\n" + (src / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

def js(m):
    code = (src / m.group(1)).resolve().read_text(encoding="utf-8").replace("</script", "<\\/script")
    return "<script>\n" + code + "\n</script>"

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)
html = re.sub(r'<script src="([^"]+)"></script>', js, html)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"{out} · {len(html) // 1024} Ko")
