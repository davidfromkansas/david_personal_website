// A product model that turns slowly on a card (the Favorites page). home.js imports the
// built copy (art/beach/spin.js) when a card with [data-model] first comes into view.
// Drag to turn it by hand; it carries on spinning when let go.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function supported() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

// host: the element to fill. url: the .glb. Resolves to { dispose } once the first frame is up.
export async function spin(host, url, { speed = 0.45, tilt = 0.18, reduced = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'model-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(0x9fe3ff, 1.6);
  rim.position.set(-3, 1, -3);
  scene.add(key, rim);

  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  // Centre it and scale it to a unit tall box, so any product fits the same frame.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(box.getCenter(new THREE.Vector3()));
  const pivot = new THREE.Group();
  pivot.add(model);
  pivot.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
  const turntable = new THREE.Group();
  turntable.rotation.x = tilt;
  turntable.add(pivot);
  scene.add(turntable);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
  camera.position.set(0, 0.05, 2.35);
  camera.lookAt(0, 0, 0);

  function fit() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole model in frame on tall or wide cards
    camera.fov = w < h ? 30 * (h / w) ** 0.8 : 30;
    camera.updateProjectionMatrix();
  }
  fit();
  host.append(canvas);

  let angle = -0.6, drag = null, velocity = 0, raf = 0, last = 0, visible = true, stopped = false;
  function frame(now) {
    raf = 0;
    if (stopped || !visible) return;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    if (!drag) {
      velocity += ((reduced ? 0 : speed) - velocity) * Math.min(1, dt * 2);
      angle += velocity * dt;
    }
    pivot.rotation.y = angle;
    renderer.render(scene, camera);
    canvas.classList.add('is-ready');
    // with reduced motion, draw only while being dragged or settling
    if (!reduced || drag || Math.abs(velocity) > 1e-3) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && !stopped && visible) { last = 0; raf = requestAnimationFrame(frame); }
  }

  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, t: performance.now() };
    canvas.setPointerCapture(e.pointerId);
    kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, now = performance.now();
    const turn = (dx / Math.max(120, host.clientWidth)) * Math.PI * 1.5;
    angle += turn;
    velocity = turn / Math.max(0.016, (now - drag.t) / 1000);
    drag = { x: e.clientX, t: now };
    kick();
  });
  const release = () => { drag = null; kick(); };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && !document.hidden;
    kick();
  });
  io.observe(host);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; kick(); });
  const ro = new ResizeObserver(() => { fit(); kick(); });
  ro.observe(host);

  kick();
  return {
    dispose() {
      stopped = true;
      io.disconnect();
      ro.disconnect();
      canvas.remove();
      renderer.dispose();
    },
  };
}
