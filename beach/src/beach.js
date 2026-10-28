// Home-screen beach: Ultra Water's ocean, sky and island, with the desk, chair and TV
// standing on the sand. A fixed camera and no GUI; the same code renders the still posters
// (scripts/render_beach.mjs) and the live scene (live.js), so the two line up exactly.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OceanSim, defaultOceanParams } from './ultra-water/water/OceanSim.js';
import { OceanSurface } from './ultra-water/water/OceanSurface.js';
import { bakeShoreMap } from './ultra-water/water/shoreMap.js';
import { bakeWaterTextures } from './ultra-water/water/bakeTextures.js';
import { SkySystem } from './ultra-water/scene/sky.js';
import { createTerrain } from './ultra-water/scene/terrain.js';
import { islandHeight } from './ultra-water/scene/islandHeight.js';
import { PlanarReflection } from './ultra-water/engine/PlanarReflection.js';
import { PostFX } from './ultra-water/engine/PostFX.js';
import { Spray } from './ultra-water/water/Spray.js';
import { FloaterShadow } from './ultra-water/scene/floaterShadow.js';
import { WaveCaustics } from './ultra-water/water/Caustics.js';

const REFLECT_LAYER = 1;

// Where the desk stands: on the beach that faces this bearing (degrees), `back` metres up
// the sand from the waterline. A partly cloudy afternoon, the sun behind the camera's left.
// exposure is fixed (metered once from this view) so the stills and the live scene match and
// the live one doesn't drift as auto exposure settles.
export const WORLD = { bearing: 0, back: 7, sun: { elevation: 38, azimuth: 222, cloudCoverage: 0.5 }, spray: 0.15, exposure: 0.123 };

// Cameras in the desk's own frame (metres, +Y up, the desk front facing +Z), as in
// scripts/build_scene.py. fov is vertical; filmOffset (mm on a 35 mm gauge) slides the
// frame so the desk sits right of centre on wide screens.
export const SHOTS = {
  home: { aspect: 16 / 9, cam: [-1.25, 1.3, 4.5], target: [0, 1.0, 0], fov: 33, filmOffset: -7 },
  phone: { aspect: 9 / 16, cam: [-0.6, 1.3, 2.35], target: [-0.14, 0.95, 0], fov: 56, filmOffset: 0 },
};

// The scene clock the posters are drawn at. The live scene starts here, so its first frame
// matches the still it fades in over.
export const POSTER_TIME = 12;

export function createBeach(canvas, { msaa = 4, reflections = true, reflectionScale = 0.5, shadowSize = 4096, powerPreference = 'high-performance' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, depth: false, stencil: false, alpha: false, powerPreference });
  renderer.autoClear = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 80000);

  const sky = new SkySystem(renderer);
  const shore = bakeShoreMap(islandHeight, 1800, 512);
  const tex = bakeWaterTextures(renderer);
  const ocean = new OceanSim(renderer, defaultOceanParams());
  const caustics = new WaveCaustics(renderer, ocean);
  const propShadow = new FloaterShadow(2048);
  const surface = new OceanSurface(ocean, shore, sky, propShadow.uniforms);
  surface.uniforms.uFoamTex.value = tex.foam;
  const su = surface.uniforms;

  const scene = new THREE.Scene();
  scene.environment = sky.cube;
  scene.add(sky.background);
  const terrain = createTerrain({
    sky, caustics: caustics.uniforms, floatShadow: propShadow.uniforms, water: su,
    absorption: su.uAbsorption.value, reflectionLayer: REFLECT_LAYER,
  });
  scene.add(terrain.group);

  const sunLight = new THREE.DirectionalLight(0xffffff, Math.PI);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sunLight.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 5000 });
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.6;
  scene.add(sunLight, sunLight.target);
  su.uShadowMatrix.value = terrain.uniforms.uSunShadowMatrix.value = sunLight.shadow.matrix;
  su.uShadowBias.value = 0.05 / (sunLight.shadow.camera.far - sunLight.shadow.camera.near);

  // The props cast only into the sharp prop shadow map (Ultra Water's floater shadow): in
  // the island's coarse sun map (0.44 m texels, 0.6 m normal bias) a desk's shadow lands
  // as an offset block. A copy of them sits in their own scene for that map.
  const desk = new THREE.Group();
  scene.add(desk);
  const shadowRoot = new THREE.Scene();
  const shadowBodies = [];
  let propShadowDirty = true;

  const reflection = new PlanarReflection(REFLECT_LAYER);
  su.uReflMatrix.value = reflection.textureMatrix;
  const emptyReflection = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  emptyReflection.needsUpdate = true;

  const waterScene = new THREE.Scene();
  const spray = new Spray(surface, shore);
  spray.params.amount = WORLD.spray;
  waterScene.add(surface.mesh, spray.mesh, spray.splash);

  const post = new PostFX(renderer);
  post.params.bloomStrength = 0.05;
  post.params.bloomThreshold = 1.5;
  post.params.autoExposure = false;
  post.params.exposure = WORLD.exposure;

  const quality = { msaa, reflections, reflectionScale };
  let hdrRT = null;
  function setSize(width, height, pixelRatio) {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    hdrRT?.dispose();
    hdrRT = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType, samples: quality.msaa, generateMipmaps: false,
      depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.FloatType),
    });
    su.uSceneColor.value = hdrRT.texture;
    su.uSceneDepth.value = hdrRT.depthTexture;
    su.uResolution.value.copy(size);
    reflection.scale = quality.reflectionScale;
    reflection.setSize(size.x, size.y);
    post.setSize(size.x, size.y);
  }

  function applySun() {
    Object.assign(sky.params, WORLD.sun);
    sky.update();
    sunLight.position.copy(sky.sunDir).multiplyScalar(2000);
    sunLight.color.setRGB(sky.sunColor.x, sky.sunColor.y, sky.sunColor.z).multiplyScalar(1 / Math.max(sky.sunColor.x, 1e-4));
    sunLight.intensity = Math.PI * Math.max(sky.sunColor.x, 1e-4);
    renderer.shadowMap.needsUpdate = true;
    propShadowDirty = true;
  }

  // The sand as rendered: the terrain is a 6.25 m grid, so it can sit a little off islandHeight.
  const ray = new THREE.Raycaster();
  function groundAt(x, z) {
    ray.set(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(terrain.group.children[0], false)[0];
    return hit ? hit.point.y : islandHeight(x, z);
  }

  // Stand the desk on the beach facing WORLD.bearing, turned so the home camera looks out to sea.
  const a = THREE.MathUtils.degToRad(WORLD.bearing);
  const seaward = new THREE.Vector2(Math.cos(a), Math.sin(a));
  let r = 100;
  while (r < 900 && islandHeight(seaward.x * r, seaward.y * r) > 1.6) r += 0.5;
  const base = { x: seaward.x * (r - WORLD.back), z: seaward.y * (r - WORLD.back) };
  const h = SHOTS.home;
  const look = Math.atan2(h.target[2] - h.cam[2], h.target[0] - h.cam[0]);
  desk.rotation.y = look - Math.atan2(seaward.y, seaward.x);
  desk.position.set(base.x, groundAt(base.x, base.z), base.z);
  desk.updateMatrixWorld(true);

  async function loadProps(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const props = gltf.scene;
    props.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = true;
      o.layers.enable(REFLECT_LAYER);
      for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial) terrain.patchProp(m);
    });
    desk.add(props);
    desk.updateMatrixWorld(true);
    const ghost = props.clone();
    ghost.matrixAutoUpdate = false;
    ghost.matrix.copy(props.matrixWorld);
    shadowRoot.add(ghost);
    shadowBodies.push({ pos: new THREE.Box3().setFromObject(props).getCenter(new THREE.Vector3()), radius: 1.6 });
    propShadowDirty = true;
  }

  // Point the camera for a shot ('home' or 'phone') at the given aspect ratio. Narrower than
  // the shot's own aspect keeps the vertical field; the poster is cropped the same way.
  function setShot(name, aspect) {
    const s = SHOTS[name];
    camera.position.copy(desk.localToWorld(new THREE.Vector3(...s.cam)));
    camera.fov = s.fov;
    camera.filmGauge = 35;
    camera.filmOffset = s.filmOffset;
    camera.aspect = aspect ?? s.aspect;
    camera.updateProjectionMatrix();
    camera.lookAt(desk.localToWorld(new THREE.Vector3(...s.target)));
    camera.updateMatrixWorld(true);
  }

  // Where a point in the desk's frame lands in the image (0..1 from the top left).
  function project(local) {
    const p = desk.localToWorld(new THREE.Vector3(...local)).project(camera);
    return [(p.x + 1) / 2, (1 - p.y) / 2];
  }

  let elapsed = 0;
  // Step the wave simulation without drawing, so the foam has its history at `time`.
  function warmUp(time, steps = 40) {
    const dt = 1 / 30;
    elapsed = time - steps * dt;
    for (let i = 0; i < steps; i++) { ocean.update(dt); elapsed += dt; }
  }

  function render(dt) {
    elapsed += dt;
    if (propShadowDirty) {
      propShadow.update(renderer, shadowRoot, shadowBodies, sky.sunDir);
      propShadowDirty = false;
    }
    ocean.update(dt);
    caustics.update(sky.sunDir);
    surface.update(camera, elapsed % 3600);
    spray.update();

    if (quality.reflections) {
      reflection.render(renderer, scene, camera);
      su.uReflection.value = reflection.target.texture;
    } else su.uReflection.value = emptyReflection;

    renderer.setRenderTarget(hdrRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);

    su.uShadowMap.value = sunLight.shadow.map.depthTexture;
    su.uCamSide.value = -1;   // always above the water
    hdrRT.resolveDepthBuffer = false;
    renderer.render(waterScene, camera);
    hdrRT.resolveDepthBuffer = true;

    post.render(hdrRT.texture, dt);
  }

  // Compile every shader up front without blocking (KHR_parallel_shader_compile).
  async function compile() {
    await renderer.compileAsync(scene, camera);
    await renderer.compileAsync(waterScene, camera, scene);
  }

  applySun();
  return { THREE, renderer, camera, scene, sky, surface, post, quality, desk, setSize, setShot, project, loadProps, warmUp, render, compile };
}
