// The live beach behind the home screen. home.js imports the built copy of this file
// (art/beach/live.js) once the page has loaded and the still poster is showing, and only
// where it can run well: WebGL2 with float render targets, no reduced motion or data saver.
// The canvas fades in over the poster after its first frame, which matches the poster.
import { createBeach, POSTER_TIME } from './beach.js';

// Probe without keeping a context around.
export function supported() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ok = !!gl && !!gl.getExtension('EXT_color_buffer_float');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

// stage: the element the poster image fills (the canvas goes on top at the same size).
// shot(): 'home' or 'phone', whichever poster is showing. active(): whether it should draw.
// Resolves to a controller, or null if the scene couldn't start or was too slow.
export async function start({ stage, shot, active, propsUrl, small = false }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'home-live';
  canvas.setAttribute('aria-hidden', 'true');
  let beach;
  try {
    beach = createBeach(canvas, {
      msaa: small ? 2 : 4,
      reflectionScale: small ? 0.35 : 0.5,
      shadowSize: small ? 2048 : 4096,
    });
    await beach.loadProps(propsUrl);
  } catch (e) {
    console.warn('beach: not started', e);
    beach?.renderer.dispose();
    return null;
  }

  // Resolution: the stage's CSS size times `scale`, which drops if frames run long.
  const maxScale = Math.min(devicePixelRatio || 1, small ? 1 : 1.5);
  let scale = small ? Math.min(maxScale, 0.8) : Math.min(maxScale, 1);
  let currentShot = null;
  function fit() {
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    // keep the drawing buffer at most ~2.6 MP whatever the screen
    const s = Math.min(scale, Math.sqrt(2.6e6 / (w * h)));
    beach.setSize(w, h, s);
    const name = shot();
    beach.setShot(name, w / h);
    currentShot = name;
  }
  fit();
  stage.append(canvas);

  try { await beach.compile(); } catch {}
  beach.warmUp(POSTER_TIME);

  let raf = 0, last = 0, shown = false, stopped = false;
  const times = [];
  function frame(now) {
    raf = 0;
    if (stopped || !active()) return;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
    last = now;
    if (shot() !== currentShot) fit();
    beach.render(dt);
    if (!shown) {
      shown = true;
      requestAnimationFrame(() => canvas.classList.add('is-ready'));
    }
    // After a short settle, judge the frame rate over ~2 s; step the resolution down
    // while it's poor, and give up (back to the poster) if even the lowest is too slow.
    times.push(dt);
    if (times.length === 150) {
      const avg = times.slice(30).reduce((a, b) => a + b, 0) / 120;
      times.length = 0;
      if (avg > 1 / 30) {
        if (scale > 0.55) {
          scale = Math.max(0.5, scale * 0.75);
          beach.quality.reflections = scale > 0.6;
          fit();
        } else if (avg > 1 / 20) {
          return stop();
        }
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function resume() {
    if (stopped || raf || !active()) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    canvas.classList.remove('is-ready');
    setTimeout(() => { canvas.remove(); beach.renderer.dispose(); }, 600);
    return null;
  }

  new ResizeObserver(() => { if (!stopped) { fit(); resume(); } }).observe(stage);
  resume();
  return { resume, stop };
}
