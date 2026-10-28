# Beach (home screen background)

The home screen is a desk, an Aeron and the TV on a beach, with a live ocean from
[Ultra Water](https://github.com/Humpalumps/Ultra-Water) (vendored in `src/ultra-water/`, MIT).

How it loads, so the page stays fast:

1. A still of the scene (`art/home.webp`, `art/home-phone.webp`) shows straight away, with the
   TV screensaver mapped onto the glass by `home.js`.
2. After the page has loaded, `home.js` imports `art/beach/live.js` (about 240 KB gzipped) and
   `art/beach/props.glb` (the desk, chair and TV, about 900 KB), but only with WebGL2 and float
   render targets, and not with reduced motion, data saver or a 2G/3G connection.
3. The live canvas fades in over the still after its first frame, which matches the still. It
   only draws while Home is selected and on screen, lowers its resolution if frames run long,
   and gives up (leaving the still) if the device can't keep up.

## Editing

- `src/beach.js`: the scene. `WORLD` (beach, sun, clouds, exposure) and `SHOTS` (the desktop
  and phone cameras, in the desk's own frame) are the knobs.
- `src/live.js`: loading, sizing, the frame-rate check and pausing.
- `dev/`: a preview page. `npm install`, then `npx vite --port 5174` and open
  `http://localhost:5174/dev/index.html?shot=home&live`.

After a change:

```bash
cd beach && npm install && npm run build              # rebuild art/beach/live.js
npx vite --port 5174 &                                 # for the stills
node ../scripts/render_beach.mjs /tmp/beach            # home.png, home-phone.png, beach.json
python3 ../scripts/install_beach.py /tmp/beach         # webp stills, tile, TV corners in home.js
```

The props come from Blender: `python3 scripts/export_props.py OUT` (needs `scripts/models/aeron.obj`,
see `scripts/chair_model.py`), then `python3 scripts/quantize_glb.py OUT/props.glb art/beach/props.glb`
and copy `OUT/props.json` to `art/beach/`.
