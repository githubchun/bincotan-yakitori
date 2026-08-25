#!/usr/bin/env python3
"""Inline CSS, JS and every image into one self-contained HTML file for publishing."""
import base64, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT  = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'bincotan.html')
read = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()

def data_uri(path):
    with open(os.path.join(ROOT, path), 'rb') as f:
        return 'data:image/webp;base64,' + base64.b64encode(f.read()).decode()

# Map every asset once, then rewrite the single place that builds image paths.
imgs = {f[:-5]: data_uri(f'assets/img/{f}')
        for f in sorted(os.listdir(os.path.join(ROOT, 'assets/img'))) if f.endswith('.webp')}

js = '\n'.join(read(f) for f in
      ('assets/js/menu-data.js', 'assets/js/pricing.js', 'assets/js/ledger.js',
       'assets/js/store.js', 'assets/js/chef.js', 'assets/js/app.js'))
js = js.replace("const asset = id => `assets/img/${id}.webp`;",
                "const asset = id => IMG[id] || '';")
assert "const asset = id => IMG[id]" in js, 'asset() hook not found — build would ship broken images'
js = 'const IMG = ' + __import__('json').dumps(imgs) + ';\n' + js

html = read('index.html')
FRAGMENT = '--fragment' in sys.argv
assert 'assets/img/' not in js, 'an image path escaped asset() — it would 404 in the bundle'

html = html.replace('<link rel="stylesheet" href="assets/css/app.css">',
                    '<style>\n' + read('assets/css/app.css') + '\n</style>')
html = re.sub(r'\s*<script src="assets/js/[^"]+"></script>', '', html)
html = html.replace('</body>', '<script>\n' + js + '\n</script>\n</body>')

if FRAGMENT:
    # Artifact hosting supplies its own <!doctype>/<html>/<head>/<body> wrapper.
    head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
    body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)
    head = re.sub(r'<meta charset[^>]*>|<meta name="viewport"[^>]*>', '', head)
    # The gallery wants a name, not the site's SEO title.
    head = re.sub(r'<title>.*?</title>', '<title>Bincotan Yakitori</title>', head, flags=re.S)
    html = head.strip() + '\n' + body.strip() + '\n'

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(html)
print(f'{OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB  ({len(imgs)} images inlined)')
