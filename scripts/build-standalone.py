#!/usr/bin/env python3
"""Assemble une version (v2/, v3/…) en un seul fichier HTML autonome (CSS et JS en ligne).
Usage : python3 scripts/build-standalone.py [version] [sortie.html] [--artifact]
        défaut : v3 → dist/breezy-hems-v3.html
        --artifact : sans <html>/<head>/<body> (pour une page hébergée qui fournit déjà ce squelette)"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
artifact = "--artifact" in sys.argv
version = args[0] if args else "v3"
src = root / version
out = pathlib.Path(args[1]) if len(args) > 1 else root / "dist" / f"breezy-hems-{version}.html"
html = (src / "index.html").read_text(encoding="utf-8")

def css(m):
    return "<style>\n" + (src / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

def js(m):
    code = (src / m.group(1)).resolve().read_text(encoding="utf-8").replace("</script", "<\\/script")
    return "<script>\n" + code + "\n</script>"

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)
html = re.sub(r'<script src="([^"]+)"></script>', js, html)
if artifact:
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    head = re.sub(r'<meta (charset|name="viewport")[^>]*>\s*', "", head)
    m = re.search(r'<body class="([^"]*)">(.*?)</body>', html, re.S)
    boot = f"<script>document.body.className = {m.group(1)!r}; document.documentElement.dataset.hosted = '1';</script>"
    html = head.strip() + "\n" + boot + "\n" + m.group(2).strip() + "\n"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"{out} · {len(html) // 1024} Ko")
