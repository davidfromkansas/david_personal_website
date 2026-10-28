// Opening scene: the TV sits on a desk (a Blender render, tv/scene-*.webp). Clicking it
// warms the picture tube up, pushes the camera into the screen, and hands over to the
// full-width TV site underneath.
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('intro-on')) return;

  // Measured from the renders by scripts/build_scene.py (0..1 of the image).
  const SCENES = /* SCENES */ {"desk":{"src":"tv/scene-desk.webp","mask":"tv/scene-desk-mask.png","width":1920,"height":1080,"screen":[[0.3349,0.32484],[0.48053,0.3069],[0.48096,0.52861],[0.3389,0.57032]],"tv":[0.23209,0.2726,0.50192,0.68577]},"phone":{"src":"tv/scene-phone.webp","mask":"tv/scene-phone-mask.png","width":1080,"height":1920,"screen":[[0.26076,0.36082],[0.52133,0.34996],[0.5205,0.46912],[0.27118,0.49343]],"tv":[0.10736,0.32899,0.55876,0.55496]}};

  const intro = document.getElementById('intro');
  const stage = document.getElementById('intro-stage');
  const img = document.getElementById('intro-img');
  const glass = document.getElementById('intro-glass');
  const pic = document.getElementById('intro-pic');
  const hit = document.getElementById('intro-hit');
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
  let scene = null, box = null, started = false;

  // CSS matrix3d that maps a w×h box onto the quad q = [tl, tr, br, bl].
  function quadTransform(w, h, q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / den;
    const k = (dx1 * dy3 - dx3 * dy1) / den;
    const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3;
    const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
    return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1].join(',')})`;
  }

  function layout() {
    const vw = root.clientWidth, vh = window.innerHeight;
    const next = SCENES[vw / vh < 0.9 ? 'phone' : 'desk'];
    if (next !== scene) {
      scene = next;
      img.src = scene.src;
      glass.style.setProperty('--mask', `url(${scene.mask})`);
    }
    // Cover the window with the render, centred.
    const s = Math.max(vw / scene.width, vh / scene.height);
    const w = scene.width * s, h = scene.height * s;
    box = { w, h, left: (vw - w) / 2, top: (vh - h) / 2 };
    Object.assign(stage.style, { width: `${w}px`, height: `${h}px`, left: `${box.left}px`, top: `${box.top}px` });
    const q = scene.screen.map(([x, y]) => [x * w, y * h]);
    pic.style.transform = quadTransform(pic.offsetWidth, pic.offsetHeight, q);
    const [x0, y0, x1, y1] = scene.tv;
    Object.assign(hit.style, { left: `${x0 * w}px`, top: `${y0 * h}px`, width: `${(x1 - x0) * w}px`, height: `${(y1 - y0) * h}px` });
  }

  function finish() {
    try { sessionStorage.setItem('tv-on', '1'); } catch {}
    root.classList.remove('intro-on');
    intro.remove();
    document.querySelector('#site-shell .site-title')?.focus({ preventScroll: true });
  }

  function turnOn() {
    if (started) return;
    started = true;
    intro.classList.add('is-on');
    if (!motion.matches) { setTimeout(finish, 350); return; }
    // Push in until the screen is about as wide as the full-width TV's screen.
    const q = scene.screen.map(([x, y]) => [x * box.w, y * box.h]);
    const cx = q.reduce((t, p) => t + p[0], 0) / 4, cy = q.reduce((t, p) => t + p[1], 0) / 4;
    const quadW = (q[1][0] - q[0][0] + q[2][0] - q[3][0]) / 2;
    const zoom = (root.clientWidth * 0.75) / quadW;
    const dx = root.clientWidth / 2 - (box.left + cx), dy = window.innerHeight / 2 - (box.top + cy);
    stage.style.transformOrigin = `${cx}px ${cy}px`;
    setTimeout(() => {
      intro.classList.add('is-zooming');
      stage.style.transform = `translate(${dx}px, ${dy}px) scale(${zoom})`;
    }, 900);
    setTimeout(() => intro.classList.add('is-leaving'), 1650);
    setTimeout(finish, 2300);
  }

  hit.addEventListener('click', turnOn);
  window.addEventListener('resize', () => { if (!started) layout(); });
  pic.decode?.().catch(() => {}).finally(layout);
  layout();
})();
