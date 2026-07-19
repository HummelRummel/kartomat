import hashlib
import json
import os

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)

def content_version():
    # Version = hash of the user-facing sources (page + manifest), so the
    # update banner fires when the app actually changes — not on every repo
    # commit. Files are hashed in a fixed order with a separator so the digest
    # is deterministic and unaffected by concatenation ambiguity.
    h = hashlib.sha256()
    for name in ('kartomat.template.html', 'manifest.json'):
        h.update(open(os.path.join(root, name), 'rb').read())
        h.update(b'\x00')
    return h.hexdigest()[:12]

version = content_version()

# kartomat.html
tmpl = open(os.path.join(root, 'kartomat.template.html')).read()
html = tmpl.replace('{version}', version)
open(os.path.join(root, 'kartomat.html'), 'w').write(html)
print(f'kartomat.html built (version={version})')

# sw.js
sw_tmpl = open(os.path.join(here, 'sw.template.js')).read()
sw = sw_tmpl.replace('{version}', version)
open(os.path.join(root, 'sw.js'), 'w').write(sw)
print(f'sw.js built (version={version})')

# manifest.json — emit alongside kartomat.html; source is the committed manifest.json
manifest_src = os.path.join(root, 'manifest.json')
if os.path.exists(manifest_src):
    print('manifest.json already present')
else:
    manifest = {
        "name": "Kartomat",
        "short_name": "Kartomat",
        "theme_color": "#0d0d0d",
        "background_color": "#0d0d0d",
        "display": "standalone",
        "start_url": "./kartomat.html",
        "icons": [
            {"src": "./dist/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "./dist/icons/icon-512.png", "sizes": "512x512", "type": "image/png"}
        ]
    }
    open(manifest_src, 'w').write(json.dumps(manifest, indent=2) + '\n')
    print('manifest.json written')
