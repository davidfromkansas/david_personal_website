"""Install the beach stills from scripts/render_beach.mjs into the site.

Writes art/home.webp, art/home-phone.webp and art/tile-home.webp (a square around the desk),
and the TV glass corners into the HOME data in home.js.

Run: python3 install_beach.py RENDER_DIR
"""
import json
import os
import re
import sys

from PIL import Image

src = sys.argv[1]
repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
art = os.path.join(repo, "art")
meta = json.load(open(os.path.join(src, "beach.json")))

home = {}
for key, name in (("home", "home"), ("phone", "home-phone")):
    im = Image.open(os.path.join(src, f"{name}.png")).convert("RGB")
    m = meta[key]
    assert im.size == (m["width"], m["height"]), (name, im.size)
    im.save(os.path.join(art, f"{name}.webp"), quality=80, method=6)
    home[key] = dict(src=f"art/{name}.webp", width=m["width"], height=m["height"], screen=m["screen"])
    if key == "home":
        # The tile: a square on the TV and desk, a little below the screen's centre.
        xs = [p[0] * im.width for p in m["screen"]]
        ys = [p[1] * im.height for p in m["screen"]]
        cx, cy = sum(xs) / 4 + 0.6 * (max(xs) - min(xs)), sum(ys) / 4 + 0.55 * (max(ys) - min(ys))
        side = 4.2 * (max(xs) - min(xs))
        box = [round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2)]
        im.crop(box).resize((320, 320), Image.LANCZOS).save(os.path.join(art, "tile-home.webp"), quality=84, method=6)

path = os.path.join(repo, "home.js")
js = open(path).read()
js, n = re.subn(r"/\* SCENES \*/ .*?;\n", "/* SCENES */ " + json.dumps(home, separators=(",", ":")) + ";\n", js, count=1, flags=re.S)
assert n == 1, "HOME data not found in home.js"
open(path, "w").write(js)
print("installed", json.dumps(home))
