// Preview and poster rendering: ?shot=home|phone&w=…&h=…  Exposes window.beach.
import { createBeach, POSTER_TIME } from '../src/beach.js';

const q = new URLSearchParams(location.search);
const shot = q.get('shot') || 'home';
const w = +q.get('w') || innerWidth, h = +q.get('h') || innerHeight;
const canvas = document.getElementById('c');
canvas.style.width = `${w}px`;
canvas.style.height = `${h}px`;
const beach = createBeach(canvas, { msaa: 4 });
beach.setSize(w, h, 1);
beach.setShot(shot, w / h);
await beach.loadProps(new URL('../../art/beach/props.glb', import.meta.url).href);
window.beach = beach;
window.POSTER_TIME = POSTER_TIME;
window.ready = true;
if (q.has('live')) {
  beach.warmUp(POSTER_TIME);
  let last = performance.now();
  const loop = (now) => { beach.render(Math.min((now - last) / 1000, 0.1)); last = now; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
