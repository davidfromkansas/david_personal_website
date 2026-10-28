// Render the home screen's beach stills with the live scene's own code, in headless Chromium.
// Start the dev server first: (cd beach && npm install && npx vite --port 5174)
// Then: node scripts/render_beach.mjs OUTDIR [scale]
// Writes OUTDIR/home.png (2400×1350), OUTDIR/home-phone.png (1350×2400) and OUTDIR/beach.json
// (the TV glass corners in each image, 0..1). Software WebGL is slow: a few minutes a still.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');

const out = process.argv[2] || '.';
const scale = +(process.argv[3] || 1);
const glass = JSON.parse(readFileSync(new URL('../art/beach/props.json', import.meta.url))).glass;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const meta = {};
for (const [shot, file, w, h] of [['home', 'home', 2400, 1350], ['phone', 'home-phone', 1350, 2400]]) {
  const [W, H] = [Math.round(w * scale), Math.round(h * scale)];
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.error(e.message));
  await page.goto(`http://localhost:5174/dev/index.html?shot=${shot}&w=${W}&h=${H}`);
  await page.waitForFunction(() => window.ready, null, { timeout: 600000 });
  const screen = await page.evaluate((glass) => {
    beach.warmUp(POSTER_TIME);
    beach.render(1 / 30);
    beach.render(1 / 30);
    return glass.map((p) => beach.project(p).map((v) => +v.toFixed(5)));
  }, glass);
  await page.screenshot({ path: `${out}/${file}.png`, timeout: 1800000 });
  meta[shot] = { width: W, height: H, screen };
  console.log(shot, JSON.stringify(screen));
  await page.close();
}
writeFileSync(`${out}/beach.json`, JSON.stringify(meta, null, 1));
await browser.close();
