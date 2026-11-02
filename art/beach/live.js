import{$ as e,A as t,B as n,C as r,D as i,E as a,F as o,G as s,I as c,J as l,K as u,M as d,N as f,O as p,Q as m,R as h,S as g,T as _,U as v,V as y,W as b,X as ee,Y as x,Z as S,_ as te,a as C,b as w,c as ne,d as T,et as E,f as re,g as ie,h as ae,i as oe,j as D,k as O,l as se,m as k,n as A,o as ce,p as j,q as le,s as ue,t as de,tt as M,u as N,v as fe,w as pe,x as P,y as me,z as he}from"./chunks/GLTFLoader-wVex79qq.js";var ge=new T;ge.setAttribute(`position`,new me([-1,-1,0,3,-1,0,-1,3,0],3));var F=new h(-1,1,1,-1,0,1),I=`
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;function L(e,t={},n={}){return new u({glslVersion:P,vertexShader:I,fragmentShader:e,uniforms:t,depthTest:!1,depthWrite:!1,...n})}var R=class{constructor(e){this.mesh=new d(ge,e),this.mesh.frustumCulled=!1}get material(){return this.mesh.material}set material(e){this.mesh.material=e}render(e,t){e.setRenderTarget(t),e.render(this.mesh,F)}},_e=8,z=[600,85,12,2.1],ve=9.81,ye=74e-6,B=300,V=`
precision highp float;
precision highp int;
#define N 256
#define PI 3.14159265359
#define G ${ve.toFixed(2)}
#define ST ${ye.toExponential()}
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
float omega(float k) { return sqrt(G * k + ST * k * k * k); }
`,be=V+`
uniform vec4 uSpecA[2]; // scale, angle, spreadBlend, swell
uniform vec4 uSpecB[2]; // alpha, peakOmega, gamma, shortWavesFade
uniform vec4 uLength;
uniform vec4 uCut;      // c0 hi, c1 hi, c2 hi, -
uniform float uCapFade; // short-wave fade for cascade 3 (cascades 0-2 use uSpecB.w)
uniform uint uSeed;
out vec4 outColor;

uvec2 pcg2d(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}

vec2 gauss(ivec2 id, int c) {
  uvec2 h = pcg2d(uvec2(id) + uvec2(uint(c) * 7919u, uint(c) * 104729u) + uSeed);
  float u1 = (float(h.x) + 1.0) / 4294967296.0;
  float u2 = float(h.y) / 4294967296.0;
  float r = sqrt(-2.0 * log(u1));
  return r * vec2(cos(2.0 * PI * u2), sin(2.0 * PI * u2));
}

float jonswap(float w, vec4 a, vec4 b) {
  float wp = b.y;
  float sigma = w <= wp ? 0.07 : 0.09;
  float r = exp(-(w - wp) * (w - wp) / (2.0 * sigma * sigma * wp * wp));
  float iw = 1.0 / w;
  float q = wp * iw;
  return a.x * b.x * G * G * iw * iw * iw * iw * iw * exp(-1.25 * q * q * q * q) * pow(b.z, r);
}

float normalisation(float s) {
  float s2 = s * s, s3 = s2 * s, s4 = s3 * s;
  if (s < 5.0) return -0.000564 * s4 + 0.00776 * s3 - 0.044 * s2 + 0.192 * s + 0.163;
  return -4.80e-08 * s4 + 1.07e-05 * s3 - 9.53e-04 * s2 + 5.90e-02 * s + 3.93e-01;
}

float directional(float theta, float w, vec4 a, vec4 b) {
  float x = w / b.y;
  float s = x > 1.0 ? 9.77 * pow(x, -2.5) : 6.97 * pow(x, 5.0);
  s += 16.0 * tanh(min(x, 20.0)) * a.w * a.w;
  float t = theta - a.y;
  float cosine2s = normalisation(s) * pow(abs(cos(0.5 * t)), 2.0 * s);
  return mix(2.0 / PI * cos(t) * cos(t), cosine2s, a.z);
}

vec2 h0(ivec2 id, int c) {
  float L = uLength[c];
  float dk = 2.0 * PI / L;
  vec2 k = vec2(id - N / 2) * dk;
  float kl = length(k);
  float lo = c == 0 ? 1e-4 : uCut[c - 1];
  float hi = c == 3 ? 1e4 : uCut[c];
  if (kl < lo || kl > hi) return vec2(0.0);
  float w = omega(kl);
  float dwdk = (G + 3.0 * ST * kl * kl) / (2.0 * w);
  float theta = atan(k.y, k.x);
  float S = 0.0;
  for (int i = 0; i < 2; i++) {
    if (uSpecA[i].x <= 0.0) continue;
    float fade = c == 3 ? uCapFade : uSpecB[i].w;
    S += jonswap(w, uSpecA[i], uSpecB[i]) * directional(theta, w, uSpecA[i], uSpecB[i])
       * exp(-fade * fade * kl * kl);
  }
  return gauss(id, c) * sqrt(2.0 * S * dwdk / kl * dk * dk);
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int c = p.y / N;
  ivec2 id = ivec2(p.x, p.y - c * N);
  vec2 a = h0(id, c);
  vec2 b = h0((N - id) % N, c);
  outColor = vec4(a, b.x, -b.y); // h0(k), conj(h0(-k))
}`,xe=V+`
uniform highp sampler2D uH0;
uniform vec4 uLength;
uniform float uTime;
layout(location = 0) out vec4 out0;
layout(location = 1) out vec4 out1;

// two real fields packed as one complex spectrum: IFFT(A + iB) = a + ib
vec2 pack2(vec2 a, vec2 b) { return vec2(a.x - b.y, a.y + b.x); }

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int c = p.y / N;
  vec2 k = vec2(ivec2(p.x, p.y - c * N) - N / 2) * (2.0 * PI / uLength[c]);
  float kl = length(k);
  float ik = kl > 1e-6 ? 1.0 / kl : 0.0;
  const float W0 = 2.0 * PI / ${B.toFixed(1)};
  // ω = n·W0; phase reduced to [0, 2π) before sin/cos (the capillary cascade reaches ω ≈ 130)
  float ph = 2.0 * PI * fract(floor(omega(kl) / W0) * (uTime / ${B.toFixed(1)}));
  vec2 e = vec2(cos(ph), sin(ph));
  vec4 h0 = texelFetch(uH0, p, 0);
  vec2 h = cmul(h0.xy, e) + cmul(h0.zw, vec2(e.x, -e.y));
  vec2 ih = vec2(-h.y, h.x);

  vec2 dx = ih * k.x * ik, dz = ih * k.y * ik;
  vec2 dxdx = -h * k.x * k.x * ik, dzdz = -h * k.y * k.y * ik, dxdz = -h * k.x * k.y * ik;
  vec2 dydx = ih * k.x, dydz = ih * k.y;

  out0 = vec4(pack2(dx, dz), pack2(h, dxdz));
  out1 = vec4(pack2(dydx, dydz), pack2(dxdx, dzdz));
}`,Se=V+`
uniform highp sampler2D uIn0;
uniform highp sampler2D uIn1;
uniform int uSub;      // sub-transform size 2..N
uniform int uVertical;
layout(location = 0) out vec4 out0;
layout(location = 1) out vec4 out1;

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int i = uVertical == 1 ? p.y % N : p.x;
  int hs = uSub >> 1;
  int e = (i / uSub) * hs + (i & (hs - 1));
  ivec2 pe, po;
  if (uVertical == 1) { int base = p.y - i; pe = ivec2(p.x, base + e); po = ivec2(p.x, base + e + N / 2); }
  else { pe = ivec2(e, p.y); po = ivec2(e + N / 2, p.y); }
  float a = 2.0 * PI * float(i & (uSub - 1)) / float(uSub);
  vec2 tw = vec2(cos(a), sin(a));
  vec4 e0 = texelFetch(uIn0, pe, 0), o0 = texelFetch(uIn0, po, 0);
  vec4 e1 = texelFetch(uIn1, pe, 0), o1 = texelFetch(uIn1, po, 0);
  out0 = vec4(e0.xy + cmul(tw, o0.xy), e0.zw + cmul(tw, o0.zw));
  out1 = vec4(e1.xy + cmul(tw, o1.xy), e1.zw + cmul(tw, o1.zw));
}`,Ce=V+`
uniform highp sampler2D uIn0;
uniform highp sampler2D uIn1;
uniform sampler2D uPrev;
uniform int uCascade;
uniform float uLambda;
uniform float uDt;
uniform float uFoamRecovery;
layout(location = 0) out vec4 outDisp;
layout(location = 1) out vec4 outSlope;

void main() {
  ivec2 id = ivec2(gl_FragCoord.xy);
  ivec2 p = id + ivec2(0, uCascade * N);
  // undo the centred-k frequency shift
  float s = ((id.x + id.y) & 1) == 0 ? 1.0 : -1.0;
  vec4 a = texelFetch(uIn0, p, 0) * s; // Dx, Dz, Dy, Dxz
  vec4 b = texelFetch(uIn1, p, 0) * s; // Dyx, Dyz, Dxx, Dzz
  float dxx = uLambda * b.z, dzz = uLambda * b.w, dxz = uLambda * a.w;
  float jac = (1.0 + dxx) * (1.0 + dzz) - dxz * dxz;
  vec2 slope = b.xy / max(vec2(1.0 + dxx, 1.0 + dzz), vec2(0.2));
  float prev = texelFetch(uPrev, id, 0).w;
  // foam follows the jacobian down instantly and recovers at a dt-based rate
  float turb = min(jac, prev + uDt * uFoamRecovery / max(jac, 0.5));
  outDisp = vec4(uLambda * a.x, a.z, uLambda * a.y, turb);
  outSlope = vec4(slope, slope * slope);
}`;function we(e,t){let n=t*1e3;return{alpha:.076*(ve*n/(e*e))**-.22,peakOmega:22*(e*n/(ve*ve))**-.33}}var Te=()=>({windSpeed:9,windDirection:20,fetchKm:120,spreadBlend:.85,windSwell:.25,gamma:3.3,shortWavesFade:.04,capillaryFade:.08,waveScale:1,swellScale:.7,swellWindSpeed:7,swellDirection:-15,swellFetchKm:900,swellSwell:1,choppiness:.85,foamRecovery:.7,timeScale:1}),Ee=class{constructor(e,t=Te()){this.renderer=e,this.params=t,this.time=0,this.dirty=!0,this.parity=0;let n={type:w,minFilter:c,magFilter:c,depthBuffer:!1,generateMipmaps:!1},i=256*z.length;this.h0RT=new M(256,i,n);let a={...n,type:r,count:2};this.ping=new M(256,i,a),this.pong=new M(256,i,a);let o={type:r,minFilter:O,magFilter:p,wrapS:x,wrapT:x,generateMipmaps:!0,anisotropy:e.capabilities.getMaxAnisotropy(),depthBuffer:!1,count:2};this.out=z.map(()=>[new M(256,256,o),new M(256,256,o)]);let s=e.getClearColor(new k),l=e.getClearAlpha();e.setClearColor(0,1);for(let t of this.out)for(let n of t)e.setRenderTarget(n),e.clear(!0,!1,!1);e.setClearColor(s,l),e.setRenderTarget(null);let u=new E(...z);this.initMat=L(be,{uSpecA:{value:[new E,new E]},uSpecB:{value:[new E,new E]},uLength:{value:u},uCut:{value:new E(...z.slice(1).map(e=>2*Math.PI/e*6),0)},uCapFade:{value:0},uSeed:{value:1337}}),this.evolveMat=L(xe,{uH0:{value:this.h0RT.texture},uLength:{value:u},uTime:{value:0}}),this.fftMat=L(Se,{uIn0:{value:null},uIn1:{value:null},uSub:{value:2},uVertical:{value:0}}),this.assembleMat=L(Ce,{uIn0:{value:null},uIn1:{value:null},uPrev:{value:null},uCascade:{value:0},uLambda:{value:1},uDt:{value:0},uFoamRecovery:{value:.45}}),this.quad=new R(this.initMat),this.lengths=z,this.displacement=this.out.map(e=>e[0].textures[0]),this.slope=this.out.map(e=>e[0].textures[1])}updateSpectrum(){let e=this.params,n=this.initMat.uniforms,r=we(e.windSpeed,e.fetchKm),i=we(e.swellWindSpeed,e.swellFetchKm),a=t.degToRad;n.uSpecA.value[0].set(e.waveScale,a(e.windDirection),e.spreadBlend,e.windSwell),n.uSpecB.value[0].set(r.alpha,r.peakOmega,e.gamma,e.shortWavesFade),n.uSpecA.value[1].set(e.swellScale*e.waveScale,a(e.swellDirection),1,e.swellSwell),n.uSpecB.value[1].set(i.alpha,i.peakOmega,e.gamma,e.shortWavesFade),n.uCapFade.value=e.capillaryFade,this.quad.material=this.initMat,this.quad.render(this.renderer,this.h0RT),this.dirty=!1}update(e,t){let n=this.params;t?.begin(`sim.evolve`),this.dirty&&this.updateSpectrum(),e*=n.timeScale,this.time=(this.time+e)%B;let r=this.renderer,i=this.quad;this.evolveMat.uniforms.uTime.value=this.time,i.material=this.evolveMat,i.render(r,this.ping),t?.begin(`sim.fft`);let a=this.ping,o=this.pong,s=this.fftMat.uniforms;i.material=this.fftMat;for(let e=0;e<2;e++){s.uVertical.value=e;for(let e=1;e<=_e;e++)s.uSub.value=1<<e,s.uIn0.value=a.textures[0],s.uIn1.value=a.textures[1],i.render(r,o),[a,o]=[o,a]}t?.begin(`sim.assemble`);let c=this.assembleMat.uniforms;c.uIn0.value=a.textures[0],c.uIn1.value=a.textures[1],c.uLambda.value=n.choppiness,c.uDt.value=e,c.uFoamRecovery.value=n.foamRecovery,i.material=this.assembleMat;let l=this.parity^1;for(let e=0;e<this.out.length;e++)c.uCascade.value=e,c.uPrev.value=this.out[e][this.parity].textures[0],i.render(r,this.out[e][l]),this.displacement[e]=this.out[e][l].textures[0],this.slope[e]=this.out[e][l].textures[1];this.parity=l}},De=`
uniform highp sampler2DShadow uFloatShadow;
uniform mat4 uFloatShadowMatrix;
uniform float uFloatShadowBias;   // depth units; 0 = no casters this frame
float floatShadow(vec3 p) {
  if (uFloatShadowBias <= 0.0) return 1.0;
  vec3 sc = (uFloatShadowMatrix * vec4(p, 1.0)).xyz;
  if (any(lessThan(sc, vec3(0.0))) || any(greaterThan(sc, vec3(1.0)))) return 1.0;
  return texture(uFloatShadow, vec3(sc.xy, sc.z - uFloatShadowBias));
}`,H=new e,Oe=class{constructor(e=1024){let t=new ie(e,e,w);t.compareFunction=515,t.minFilter=t.magFilter=p,this.target=new M(e,e,{format:l,depthTexture:t,generateMipmaps:!1}),this.camera=new h,this.material=new f({colorWrite:!1,side:2}),this.uniforms={uFloatShadow:{value:t},uFloatShadowMatrix:{value:new D},uFloatShadowBias:{value:0}}}update(e,t,n,r){let i=this.uniforms;if(this.ready||=(this.clear(e),!0),!n.length||r.y<=.01){i.uFloatShadowBias.value=0;return}H.set(0,0,0);for(let e of n)H.add(e.pos);H.divideScalar(n.length);let a=1;for(let e of n)a=Math.max(a,e.pos.distanceTo(H)+e.radius);let o=this.camera;o.left=o.bottom=-a,o.right=o.top=a,o.near=1,o.far=a+3e3,o.position.copy(H).addScaledVector(r,a+20),o.lookAt(H),o.updateProjectionMatrix(),o.updateMatrixWorld(),i.uFloatShadowMatrix.value.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(o.projectionMatrix).multiply(o.matrixWorldInverse),i.uFloatShadowBias.value=.03/(o.far-o.near);let s=e.getRenderTarget();t.overrideMaterial=this.material,e.setRenderTarget(this.target),e.clear(!1,!0,!1),e.render(t,o),t.overrideMaterial=null,e.setRenderTarget(s)}clear(e){let t=e.getRenderTarget();e.setRenderTarget(this.target),e.clear(!1,!0,!1),e.setRenderTarget(t)}},ke=384,Ae=60,je=1,Me=3e3,Ne=6e4;function Pe(e){let t=1+2*Math.PI/e,n=[];for(let e=je/16;e<je*.99;e*=1.12)n.push(e);for(let e=je;e<Me;e*=t)n.push(e);n.push(Ne);let r=new Float32Array((1+n.length*e)*3),i=3;for(let t of n)for(let n=0;n<e;n++){let a=n/e*Math.PI*2;r[i++]=Math.cos(a)*t,r[i++]=0,r[i++]=Math.sin(a)*t}let a=[];for(let t=0;t<e;t++)a.push(0,1+(t+1)%e,1+t);for(let t=0;t<n.length-1;t++){let n=1+t*e,r=n+e;for(let t=0;t<e;t++){let i=(t+1)%e;a.push(n+t,n+i,r+t,n+i,r+i,r+t)}}let o=new T;return o.setAttribute(`position`,new N(r,3)),o.setIndex(new N(new Uint32Array(a),1)),o}var Fe=`
uniform sampler2D uShore;
uniform sampler2D uTravel;   // wave travel time from the coast (s), propagation dir xz, shoaling
uniform float uShoreExtent;
uniform float uTime;
uniform vec4 uShoreWave;   // amplitude, wavelength, speed, steepness
uniform vec2 uSwellDir;    // propagation direction of the swell (xz)

vec4 shoreSample(vec2 xz) {
  vec2 uv = xz / uShoreExtent + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(-60.0, 1e4, 0.0, 0.0);
  return textureLod(uShore, uv, 0.0);
}
vec4 travelSample(vec2 xz) {
  vec2 uv = xz / uShoreExtent + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return textureLod(uTravel, uv, 0.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + 1.0), u.x), u.y);
}

// phase offset along the coast, the slowly drifting sets, and how much of the swell a
// coast facing dir receives
float shoreNoisePhase(vec2 xz) { return vnoise(xz * 0.0042) * 9.0 + vnoise(xz * 0.011 + 7.0) * 2.5; }
float shoreGroup(vec2 xz) { return 0.45 + 0.55 * vnoise(xz * 0.004 + vec2(uTime * 0.021, -uTime * 0.017)); }
float shoreExposure(vec2 dir) { return mix(0.25, 1.0, smoothstep(-0.3, 0.7, dot(dir, uSwellDir))); }
vec2 shoreDir(vec4 sh, vec4 tr) { return dot(tr.yz, tr.yz) > 0.25 ? normalize(tr.yz) : -sh.zw / max(length(sh.zw), 1e-3); }
`,Ie=`
vec3 swash(vec2 xz, float hgt) {
  vec4 sh = shoreSample(xz);
  if (hgt < -0.3 || sh.y > 60.0 || uShoreWave.x <= 0.0) return vec3(0.0);
  vec2 dir = shoreDir(sh, travelSample(xz));
  float R = 0.55 * uShoreWave.x * shoreExposure(dir) * shoreGroup(xz) * smoothstep(0.35, 0.8, length(sh.zw));
  if (R < 0.02) return vec3(0.0);
  if (hgt > R) return vec3(0.0, 0.0, 0.5 * smoothstep(1.5 * R, R, hgt));   // reached by bigger sets
  float w = sqrt(9.81 * 6.2831853 / uShoreWave.y) * uShoreWave.z;
  // fraction of a period since the last bore reached the waterline (tau = 0 there)
  float s = fract((w * uTime + shoreNoisePhase(xz)) / 6.2831853);
  float eta = R * (s < 0.3 ? sin(s / 0.3 * 1.5708) : cos((s - 0.3) / 0.7 * 1.5708));
  float th = eta - hgt;
  float edge = s < 0.35 ? smoothstep(-0.01, 0.0, th) * (1.0 - smoothstep(0.0, 0.05, th)) : 0.0;
  // drying since the backwash uncovered this height
  float sPass = 0.3 + 0.7 * acos(clamp(hgt / R, 0.0, 1.0)) / 1.5708;
  float dry = (s > sPass ? s - sPass : s + 1.0 - sPass) * 6.2831853 / w;
  return vec3(max(th, 0.0), edge, th > 0.0 ? 1.0 : exp(-dry / 5.0));
}
`,Le=`
#define N_TEX ${256 .toFixed(1)}
#define PI 3.14159265359
uniform sampler2D uDisp0, uDisp1, uDisp2;           // the capillary cascade is slopes only
uniform sampler2D uSlope0, uSlope1, uSlope2, uSlope3;
uniform vec4 uLength;
uniform vec2 uWaveDamp;    // depth where long swell fully exists, chop strength in shallows
uniform vec4 uImpact[8];      // x, z, age (s), amplitude (m); amplitude 0 = free slot
uniform float uImpactSize[8]; // splash radius (m)
${Fe}

// Ripple rings from objects hitting the water (Cauchy-Poisson): by stationary phase a
// point impulse gives local wavenumber k = g t^2 / (4 r^2) at radius r and phase k r, so
// long waves race ahead and short ones trail inside. A splash of radius L excites
// ~ (kL)^2 exp(-(kL)^2); kMax band-limits to what the mesh or pixel can show.
// Returns (height, dh/dx, dh/dz).
vec3 impactWaves(vec2 xz, float kMax) {
  vec3 o = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 e = uImpact[i];
    if (e.w <= 0.0) continue;
    vec2 dv = xz - e.xy;
    float r = length(dv) + 1e-3, L = uImpactSize[i];
    float k = 9.81 * e.z * e.z / (4.0 * r * r);
    float kl2 = k * k * L * L;
    float amp = e.w * 2.72 * kl2 * exp(-kl2 - k * k / (kMax * kMax) - 0.12 * e.z) * L / (L + r);
    float ph = k * r;
    o.x += amp * cos(ph);
    o.yz += dv / r * (amp * k * sin(ph));
  }
  return o;
}

// FFT cascade weights by water depth: long swell is replaced by shore waves in the
// shallows, chop survives almost to the beach.
vec3 cascadeDamp(float depth) {
  float swell = smoothstep(2.0, uWaveDamp.x, depth);
  float chop = smoothstep(-0.4, 2.0, depth) * mix(uWaveDamp.y, 1.0, smoothstep(0.0, 10.0, depth));
  return vec3(swell, chop, chop);
}

// Travelling breakers on the eikonal travel-time field (shoreMap.js): phase = w (tau + t)
// with local wavenumber w / sqrt(g depth), so fronts slow down, bunch up and bend around
// the bathymetry on their way in. Gerstner push along the propagation direction, Green's
// law + ray-tube shoaling, breaking limit A <= 0.42*depth.
// Breaking crests pitch forward of their base (plunging lip), glow where thin (lip) and
// leave lace behind in the surf zone (residual).
// wave0 = (amplitude, k, omega, phase) and breaking (0..1) of the main train, for spray
struct Shore { vec3 disp; vec2 slope; float foam; vec4 wave0; float breaking0; vec2 dir; float lip; float residual; };
Shore shoreWaves(vec2 xz, vec4 sh) {
  Shore o = Shore(vec3(0.0), vec2(0.0), 0.0, vec4(0.0), 0.0, vec2(0.0), 0.0, 0.0);
  float depth = -sh.x, sdf = sh.y;
  float gl = length(sh.zw);
  float env = smoothstep(180.0, 70.0, sdf) * smoothstep(0.35, 0.8, gl) * smoothstep(-0.9, 0.5, depth);
  if (env <= 0.0 || uShoreWave.x <= 0.0) return o;
  vec4 tr = travelSample(xz);
  vec2 dir = shoreDir(sh, tr);
  o.dir = dir;
  // coasts facing the swell get the big sets, lee shores only small ones
  env *= shoreExposure(dir);
  float shoal = dot(tr.yz, tr.yz) > 0.25 ? tr.w : pow(clamp(max(depth, 0.6) / 14.0, 0.04, 1.0), -0.25);
  float cel = sqrt(9.81 * clamp(depth, 0.3, 14.0));
  float amax = 0.42 * max(depth, 0.0) + 0.14;
  float noisePhase = shoreNoisePhase(xz);
  float group = shoreGroup(xz);
  float pinch = 0.85;   // total horizontal compression allowed (Jacobian stays > 0.15)
  for (int i = 0; i < 2; i++) {
    float lambda = uShoreWave.y * (i == 0 ? 1.0 : 0.61);
    float w = sqrt(9.81 * 2.0 * PI / lambda) * uShoreWave.z;
    float k = w / cel;
    float a = min(uShoreWave.x * (i == 0 ? 1.0 : 0.45) * env * shoal * group, amax * (i == 0 ? 1.0 : 0.5));
    float ph = w * (tr.x + uTime) + noisePhase * (i == 0 ? 1.0 : 1.37) + float(i) * 2.1;
    float c = 0.5 + 0.5 * cos(ph);
    float s = sin(ph);
    const float P = 1.6;           // narrower crests, flatter troughs
    float cp = pow(c, P - 1.0);
    float rel = a / max(depth, 0.05);
    // sections of each crest break early or late (peeling), new layout every wave
    float cycle = floor((ph + PI) / (2.0 * PI));
    float early = vnoise(xz * 0.03 + vec2(cycle * 7.3, cycle * 3.1 + float(i) * 31.0));
    float breaking = smoothstep(0.12 + 0.14 * early, 0.3 + 0.2 * early, rel);
    // plunging only around the break point; the inner surf zone runs as a bore
    float pitch = i == 0 ? 2.0 * uShoreWave.w * a * smoothstep(0.16, 0.28, rel) * (1.0 - smoothstep(0.4, 0.6, rel)) : 0.0;
    // a heightfield can't overhang: the lean (up to 1.08 pitch k of compression just
    // ahead of the crest) and both trains' Gerstner pinch share one budget, so the
    // surface never folds over into a glassy fin
    pitch = min(pitch, 0.35 / (1.08 * k));
    pinch -= 1.08 * pitch * k;
    float qak = min(pinch, uShoreWave.w * a * k * 8.0);
    pinch -= qak;
    float c5 = c * c * c * c * c;
    o.disp.y += a * (2.0 * cp * c - 0.78);
    o.disp.xz += dir * ((qak / k) * s + pitch * c5 * c);
    o.slope += dir * (a * k * P * cp * s / max(1.0 - qak * cos(ph) + 3.0 * pitch * k * c5 * s, 0.2));
    // whitewater: on the crest and trailing behind it once the wave is near breaking
    float psi = mod(ph + PI, 2.0 * PI) - PI;
    float f = breaking * smoothstep(-0.45, 0.0, psi) * exp(-max(psi, 0.0) * 0.8);
    o.foam += f;
    if (i == 0) {
      o.wave0 = vec4(a, k, w, ph);
      o.breaking0 = breaking;
      o.lip = breaking * c5 * smoothstep(0.6, -0.2, psi);
      // (the lace outlives single crests: no peeling, or it would pop between waves)
      o.residual = smoothstep(0.18, 0.4, rel) * (0.3 + 0.45 * exp(-mod(ph, 2.0 * PI) * 0.4));
    }
  }
  return o;
}

// Full surface displacement at an undisplaced xz; lod per cascade (0 = finest).
vec3 waterDisplacement(vec2 xz, vec3 lod) {
  vec4 sh = shoreSample(xz);
  vec3 damp = cascadeDamp(-sh.x);
  vec3 d = textureLod(uDisp0, xz / uLength.x, max(lod.x, 0.0)).xyz * damp.x
         + textureLod(uDisp1, xz / uLength.y, max(lod.y, 0.0)).xyz * damp.y
         + textureLod(uDisp2, xz / uLength.z, max(lod.z, 0.0)).xyz * damp.z;
  d += shoreWaves(xz, sh).disp;
  // rings at their world position; cell size back from the finest lod
  d.y += impactWaves(xz + d.xz, 2.0 * N_TEX / (exp2(lod.z - 1.0) * uLength.z)).x;
  return d;
}

// Surface at world xz: invert the choppy horizontal displacement by fixed-point
// iteration, then read the height there. Returns the displacement; .y is the height.
vec3 waterAt(vec2 q, vec3 lod) {
  vec2 p = q;
  vec3 d = vec3(0.0);
  for (int i = 0; i < 4; i++) { d = waterDisplacement(p, lod); p = q - d.xz; }
  return waterDisplacement(p, lod);
}
`,Re=Le+`
uniform float uGridScale;
uniform float uCellStep;
uniform float uWind;
out vec3 vWorld;
out vec2 vXZ;
out float vUnresolved;

void main() {
  vec2 local = position.xz;
  float r = length(local);
  float scale = r > ${(Me*2).toFixed(1)} ? 1.0 : uGridScale;
  vec2 xz = cameraPosition.xz + local * scale;
  float cell = max(r, ${je.toFixed(1)}) * uCellStep * scale;

  // +1 LOD bias: box-filtered mips still leak a little past Nyquist
  vec3 d = waterDisplacement(xz, log2(cell * N_TEX / uLength.xyz) + 1.0);
  // Cox-Munk mean square slope minus what the cascades carry (each one's 1x1 mip is its
  // mean square slope): the rest is sub-texel roughness
  vec4 m0 = textureLod(uSlope0, vec2(0.5), 8.0), m1 = textureLod(uSlope1, vec2(0.5), 8.0);
  vec4 m2 = textureLod(uSlope2, vec2(0.5), 8.0), m3 = textureLod(uSlope3, vec2(0.5), 8.0);
  vUnresolved = max(0.003 + 0.00512 * uWind - (m0.z + m0.w + m1.z + m1.w + m2.z + m2.w + m3.z + m3.w), 0.0);

  vXZ = xz;
  vWorld = vec3(xz.x + d.x, d.y, xz.y + d.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`,ze=Le+De+`
precision highp sampler2DShadow;
uniform vec2 uResolution;
uniform vec2 uNearFar;
uniform sampler2D uSceneColor;
uniform sampler2D uSceneDepth;
uniform sampler2D uReflection;
uniform mat4 uReflMatrix;
uniform samplerCube uSkyCube;
uniform float uSkyMaxLod;
uniform sampler2D uFoamTex;
uniform sampler2DShadow uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowBias;  // depth units
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAbsorption;
uniform vec3 uScatterColor;
uniform vec3 uFoamTint;     // thin foam: the water colour showing through the bubbles
uniform vec4 uSSS;          // peak strength, view strength, shadow strength, -
uniform vec4 uFoam;         // bias, scale, shore band (m), brightness
uniform vec4 uOptics;       // base roughness, refraction strength, reflection distortion, fog density
uniform vec3 uCamForward;
uniform int uDebug;
uniform float uGlint;
uniform float uCamSide;     // -1 camera above the surface, 1 below, 0 straddling it
in vec3 vWorld;
in vec2 vXZ;
in float vUnresolved;
out vec4 fragColor;

float linearDepth(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - z * (uNearFar.y - uNearFar.x));
}

float sunShadow(vec3 p) {
  float s = 1.0;
  vec4 sc = uShadowMatrix * vec4(p, 1.0);
  // one hardware 2x2 PCF tap: texels are ~0.44 m, soft enough on moving water. The water
  // casts nothing, so the bias only has to cover depth precision.
  if (all(greaterThan(sc.xy, vec2(0.0))) && all(lessThan(sc.xyz, vec3(1.0)))) s = texture(uShadowMap, vec3(sc.xy, sc.z - uShadowBias));
  return min(s, floatShadow(p));
}

// Poisson count with mean lam from one uniform number: inverse CDF, normal (logistic)
// approximation for large means
float poisson(float lam, float u) {
  if (lam > 6.0) return max(0.0, lam + sqrt(lam) * log(u / (1.0 - u)) / 1.702);
  float p = exp(-lam), F = p, n = 0.0;
  for (int k = 0; k < 14; k++) { if (u <= F) break; n += 1.0; p *= lam / n; F += p; }
  return n;
}

vec3 skyLod(vec3 dir, float lod) {
  dir.y = max(dir.y, 0.0);
  return textureLod(uSkyCube, dir, lod).rgb;
}

void main() {
  // folded crests flip triangles; drop faces that can't face the camera's side
  if (gl_FrontFacing ? uCamSide > 0.5 : uCamSide < -0.5) discard;
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 uv = gl_FragCoord.xy / uResolution;

  // --- surface: slopes + slope variance from the three cascades -----------------
  vec4 sh = shoreSample(vXZ);
  float depthBelow = -sh.x;
  vec3 damp = cascadeDamp(depthBelow);
  vec4 s0 = texture(uSlope0, vXZ / uLength.x) * damp.x;
  vec4 s1 = texture(uSlope1, vXZ / uLength.y) * damp.y;
  vec4 s2 = texture(uSlope2, vXZ / uLength.z) * damp.z;
  vec4 s3 = texture(uSlope3, vXZ / uLength.w) * damp.z;
  s0.zw *= damp.x; s1.zw *= damp.y; s2.zw *= damp.z; s3.zw *= damp.z;   // second moments scale by damp^2
  Shore shore = shoreWaves(vXZ, sh);
  vec2 fwXZ = fwidth(vXZ);
  vec3 imp = impactWaves(vWorld.xz, 2.0 / max(max(fwXZ.x, fwXZ.y), 1e-3));
  vec2 slope = s0.xy + s1.xy + s2.xy + s3.xy + shore.slope + imp.yz;
  vec2 variance = max(s0.zw - s0.xy * s0.xy, 0.0) + max(s1.zw - s1.xy * s1.xy, 0.0)
                + max(s2.zw - s2.xy * s2.xy, 0.0) + max(s3.zw - s3.xy * s3.xy, 0.0);
  vec3 Nrm = normalize(vec3(-slope.x, 1.0, -slope.y));
  // the normal's tilt as a screen offset: project a small world step along it
  vec3 vp = (viewMatrix * vec4(vWorld, 1.0)).xyz;
  vec3 dv = mat3(viewMatrix) * vec3(Nrm.x, 0.0, Nrm.z);
  vec2 nS = dv.xy - vp.xy / vp.z * dv.z;

  // geometric specular AA (Kaplanyan): normal change across the pixel adds variance
  vec3 dndx = dFdx(Nrm), dndy = dFdy(Nrm);
  float geoVar = min(0.25 * (dot(dndx, dndx) + dot(dndy, dndy)), 0.18);
  float alpha2 = uOptics.x * uOptics.x + vUnresolved * damp.z * damp.z + variance.x + variance.y + geoVar;
  float alpha = sqrt(alpha2);

  float NoV = max(dot(Nrm, V), 1e-4);
  float NoL = dot(Nrm, uSunDir);
  float shadow = sunShadow(vWorld);

  // --- foam -------------------------------------------------------------------
  float t0 = texture(uDisp0, vXZ / uLength.x).w, t1 = texture(uDisp1, vXZ / uLength.y).w, t2 = texture(uDisp2, vXZ / uLength.z).w;
  float jac = mix(1.0, t0, damp.x) + mix(1.0, t1, damp.y) + mix(1.0, t2, damp.z) - 2.0;
  float foam = clamp((uFoam.x - jac) * uFoam.y, 0.0, 1.0);

  // --- seen from below: Snell's window + total internal reflection ---------------
  // (the camera->surface water column is fogged later by the underwater pass)
  if (!gl_FrontFacing) {
    vec3 Nu = -Nrm;
    float cosI = dot(V, Nu);
    // outside Snell's window total internal reflection mirrors the deep water: the same
    // colour the underwater pass fogs towards, for the reflected direction
    vec3 Rd = reflect(-V, Nu);
    vec3 ambientU = skyLod(vec3(0.0, 1.0, 0.0), uSkyMaxLod);
    vec3 deep = uScatterColor * (ambientU + uSunColor * max(uSunDir.y, 0.0)) * mix(0.55, 1.35, Rd.y * 0.5 + 0.5);
    vec3 colU = deep;
    // the window edge (critical angle) blurred by the sub-pixel roughness, so rough
    // patches fade between window and mirror instead of switching
    const float COS_CRIT = 0.6614;   // sqrt(1 - 1/1.33^2)
    float edge = max(alpha * 1.5, 0.02);
    float win = smoothstep(COS_CRIT - edge, COS_CRIT + edge, cosI);
    if (win > 0.0) {
      vec3 Tdir = refract(-V, Nu, 1.33);
      if (dot(Tdir, Tdir) == 0.0) Tdir = normalize(-V - Nu * dot(-V, Nu));   // grazing, just past the edge
      float cosT = max(dot(Tdir, Nrm), 0.0);
      float Fu = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
      // sky through the window is the refracted direction (the 180-degree sky squeezed
      // into the ~97-degree cone); anything opaque above water comes from the frame
      vec2 wuv = uv + nS * 0.04;
      vec3 above = textureLod(uSceneDepth, wuv, 0.0).r > 0.999999
        ? skyLod(Tdir, clamp(log2(alpha * 900.0), 0.0, uSkyMaxLod)) : textureLod(uSceneColor, wuv, 0.0).rgb;
      // sun through the window: GGX transmission lobe, widened by the roughness
      float aT = max(alpha * 1.4, 0.03), mu = max(dot(Tdir, uSunDir), 0.0);
      float dT = mu * mu * (aT * aT - 1.0) + 1.0;
      float sunLobe = aT * aT / (PI * dT * dT) * 0.25;
      colU = mix(deep, mix(above + uSunColor * sunLobe * shadow, deep, Fu), win);
    }
    colU *= 1.0 - 0.55 * max(foam, clamp(shore.foam, 0.0, 1.0));
    // alpha tags what the pixel sees for the underwater pass: 0 underside, 2 top
    // (everything else writes 1, so MSAA edge averages never look like the other face)
    fragColor = vec4(colU, 0.0);
    return;
  }

  // --- refraction + absorption -------------------------------------------------
  float waterDepth = linearDepth(gl_FragCoord.z);
  float sceneDepth = linearDepth(textureLod(uSceneDepth, uv, 0.0).r);
  float viewCos = max(dot(-V, uCamForward), 0.05);
  float thick = max(sceneDepth - waterDepth, 0.0) / viewCos;
  vec2 ruv = uv + nS * uOptics.y * clamp(thick * 0.25, 0.0, 1.0) / max(waterDepth * 0.02, 1.0);
  float rDepth = linearDepth(textureLod(uSceneDepth, ruv, 0.0).r);
  // the offset landed on something in front of the water: fall back towards no offset,
  // smoothly so object edges don't get a hard outline
  float keep = smoothstep(waterDepth - 0.3, waterDepth + 0.3, rDepth);
  ruv = mix(uv, ruv, keep);
  thick = mix(thick, max(rDepth - waterDepth, 0.0) / viewCos, keep);
  vec3 refracted = textureLod(uSceneColor, ruv, 0.0).rgb;
  vec3 T = exp(-uAbsorption * thick);

  // shoreline contact foam where the water gets thin (in the shallows only: around
  // floating props it would be a white frill)
  float contact = (1.0 - smoothstep(0.0, uFoam.z, thick * viewCos)) * smoothstep(6.0, 2.0, depthBelow);
  foam = max(foam, contact * 0.9);
  float shoreFoam = clamp(shore.foam, 0.0, 1.0);

  // --- lighting ------------------------------------------------------------------
  vec3 ambient = skyLod(vec3(0.0, 1.0, 0.0), uSkyMaxLod);
  vec3 sun = uSunColor * shadow;
  // in-scatter of the water column (sun + sky), then Atlas-style SSS on crests
  vec3 inscatter = uScatterColor * (ambient + uSunColor * (0.3 + 0.7 * shadow) * max(uSunDir.y, 0.0));
  float h = max(vWorld.y, 0.0);
  float k1 = uSSS.x * h * pow(clamp(dot(uSunDir, -V), 0.0, 1.0), 4.0) * pow(0.5 - 0.5 * NoL, 3.0);
  float k2 = uSSS.y * pow(NoV, 2.0);
  vec3 sss = (k1 + k2) * uScatterColor * sun + uSSS.z * max(NoL, 0.0) * uScatterColor * sun;
  // thin breaking lips: sunlight through about a metre of water glows turquoise,
  // strongest looking into the sun
  sss += shore.lip * sun * exp(-uAbsorption * 2.0) * 0.06 * (0.3 + 2.5 * pow(clamp(dot(uSunDir, -V), 0.0, 1.0), 3.0));
  vec3 body = refracted * T + (inscatter + sss) * (1.0 - T);

  // Fresnel with roughness-aware F90 (Lagarde) so the rough far field doesn't go white
  const float F0 = 0.02;
  float F90 = max(1.0 - 0.7 * sqrt(alpha), F0);
  float F = F0 + (F90 - F0) * pow(1.0 - NoV, 5.0);

  // --- reflection: half-res planar (terrain) over the sky cube -----------------------
  vec3 R = reflect(-V, Nrm);
  R.y = abs(R.y);
  float lod = clamp(log2(alpha * 650.0), 0.0, uSkyMaxLod);
  vec3 refl = skyLod(R, lod);
  // (premultiplied: the target clears to 0, so blurred mips fade to the sky, not black)
  vec4 pc = uReflMatrix * vec4(vWorld.x, 0.0, vWorld.z, 1.0);
  vec2 puv = pc.xy / pc.w + nS * uOptics.z / max(1.0, waterDepth * 0.01);
  vec4 planar = textureLod(uReflection, puv, clamp(log2(alpha * 300.0), 0.0, 6.0));
  refl = refl * (1.0 - planar.a) + planar.rgb;

  // --- sun specular: GGX, alpha floored so the sun acts as a small area light ---------
  float aS = max(alpha, 0.015);
  float aS2 = aS * aS;
  vec3 H = normalize(uSunDir + V);
  float NoH = max(dot(Nrm, H), 0.0);
  float nl = max(NoL, 0.0);
  float dd = NoH * NoH * (aS2 - 1.0) + 1.0;
  float D = aS2 / (PI * dd * dd);
  float vis = 0.5 / (nl * sqrt(NoV * NoV * (1.0 - aS2) + aS2) + NoV * sqrt(nl * nl * (1.0 - aS2) + aS2) + 1e-5);
  float Fs = F0 + (1.0 - F0) * pow(1.0 - max(dot(V, H), 0.0), 5.0);
  vec3 spec = sun * (PI * D * vis * Fs * nl);

  // glitter: the lobe as a finite number of sub-pixel facets. Per cell of about the
  // pixel footprint the expected count mirroring the sun is lam = facet density * area *
  // D * (sun solid angle / 4 VoH); a Poisson draw / lam scales the smooth lobe (mean 1,
  // energy kept). Dense cells (close to the lobe core, far away) stay smooth, sparse
  // ones break into points; each cell crossfades between draws so they twinkle.
  if (uGlint > 0.0 && dot(spec, vec3(1.0)) > 0.02) {
    const float FACETS = 2e4;   // per m^2 (calibration knob)
    float lf = log2(max(max(fwXZ.x, fwXZ.y), 1e-3)) + 1.0;
    float l0 = floor(lf);
    float per = FACETS * D * NoH * 6.8e-5 / (4.0 * max(dot(V, H), 0.05));
    float m = 0.0;
    for (int j = 0; j < 2; j++) {
      float l = l0 + float(j), sz = exp2(l);
      vec2 cell = floor(vXZ / sz);
      float lam = per * sz * sz;
      float tt = uTime * 3.0 + hash12(cell + l * 17.17) * 64.0, it = floor(tt);
      float n0 = poisson(lam, clamp(hash12(cell * 1.31 + it * 3.7), 1e-4, 0.9999));
      float n1 = poisson(lam, clamp(hash12(cell * 1.31 + (it + 1.0) * 3.7), 1e-4, 0.9999));
      m += (j == 0 ? 1.0 - (lf - l0) : lf - l0) * min(mix(n0, n1, smoothstep(0.0, 1.0, tt - it)) / max(lam, 1e-4), 300.0);
    }
    spec *= mix(1.0, m, uGlint * smoothstep(4.0, 30.0, dist));
  }

  vec3 col = mix(body, refl, F) + spec;

  // --- foam surface: eroded by age via the pattern threshold, kills specular ----------
  // erosion: dense foam is nearly solid, ageing foam thins out to the lace network
  // (texture taps only where there is foam; most of the ocean has none). Each source
  // also gives a billow height + gradient (world) and a density for the shading.
  float cover = 0.0, pat = 0.0, fh = 0.5, dens = 0.0;
  vec2 fg = vec2(0.0);
  if (foam > 0.0) {
    vec4 t0 = texture(uFoamTex, vXZ * 0.11);
    pat = t0.r * 0.65 + texture(uFoamTex, vXZ * 0.031 + 0.37).r * 0.35;
    cover = smoothstep(1.05 - foam, 1.3 - foam, pat) * sqrt(foam);
    fh = t0.g; fg = (t0.ba - 0.5) * 64.0 * 0.11; dens = foam;
  }
  if (shoreFoam > 0.0) {
    // whitewater rides shoreward with the bore: a world-space flow map at the phase
    // speed, two phases crossfaded every half period (which also makes it churn). On the
    // displaced surface, so the crest pinch doesn't squash it into streaks; a coordinate
    // tied to the front direction would shear wherever the fronts curve.
    const float FLOW_T = 2.5;   // s
    vec2 vel = shore.dir * shore.wave0.z / max(shore.wave0.y, 1e-3);
    float f0 = fract(uTime / FLOW_T), f1 = fract(uTime / FLOW_T + 0.5), wb = abs(2.0 * f0 - 1.0);
    vec4 b0 = texture(uFoamTex, (vWorld.xz - vel * (f0 * FLOW_T)) * 0.15);
    vec4 b1 = texture(uFoamTex, (vWorld.xz - vel * (f1 * FLOW_T)) * 0.15 + 0.43);
    float sh_ = mix(b0.g, b1.g, wb);
    float sPattern = mix(b0.r, b1.r, wb) * 0.3 + sh_ * 0.45 + texture(uFoamTex, vWorld.xz * 0.023 + 0.5).r * 0.25;
    float sCover = smoothstep(1.0 - shoreFoam * 1.1, 1.2 - shoreFoam * 1.1, sPattern) * sqrt(shoreFoam);
    if (sCover >= cover) {
      pat = sPattern; fh = sh_; dens = shoreFoam;
      fg = mix(b0.ba, b1.ba, wb) * (64.0 * 0.15) - 32.0 * 0.15;
    }
    cover = max(cover, sCover);
  }
  if (shore.residual > 0.0) {
    // lace left behind in the surf zone, drifting shoreward (two-phase flow map)
    float fp = fract(uTime / 8.0);
    vec2 drift = shore.dir * 2.8;
    float r0 = texture(uFoamTex, (vWorld.xz - drift * fp) * 0.06).r;
    float r1 = texture(uFoamTex, (vWorld.xz - drift * fract(fp + 0.5)) * 0.06 + 0.5).r;
    float rp = mix(r0, r1, abs(2.0 * fp - 1.0));
    float rCover = smoothstep(1.2 - shore.residual, 1.35 - shore.residual, rp) * shore.residual;
    if (rCover >= cover) { pat = rp; fh = 0.5; fg = vec2(0.0); dens = shore.residual * 0.5; }
    cover = max(cover, rCover);
  }
  if (cover > 0.0) {
    // billows bump the normal (whitewater is lumpy, thin lace lies flat) and shade
    // their creases; thin foam is a bubble film tinted by the water under it, dense foam
    // a bright diffuse white with a little sheen on the bubble tops
    vec3 fN = normalize(Nrm - vec3(fg.x, 0.0, fg.y) * (0.03 + 0.12 * dens));
    float fl = dot(fN, uSunDir);
    float ao = mix(0.45, 1.0, smoothstep(0.15, 0.75, fh));
    float solid = smoothstep(0.2, 0.9, dens * (0.55 + 0.7 * fh));
    vec3 foamAlbedo = mix(uFoamTint, vec3(0.95), max(solid, smoothstep(0.3, 0.9, pat) * 0.6));
    vec3 lit = sun * (0.15 + 0.85 * clamp(fl * 0.8 + 0.2, 0.0, 1.0)) * mix(ao, 1.0, 0.4) + ambient * 1.1 * ao;
    // sun behind the crest shines through the thin foam on top
    lit += sun * pow(clamp(dot(uSunDir, -V), 0.0, 1.0), 4.0) * 0.4 * (1.0 - solid);
    vec3 foamCol = uFoam.w * foamAlbedo * lit;
    foamCol += sun * pow(max(dot(fN, H), 0.0), 90.0) * 0.5 * smoothstep(0.55, 0.85, fh) * solid;
    col = mix(col, foamCol, cover * mix(0.8, 1.0, solid));
  }

  // --- aerial perspective into the horizon sky ---------------------------------------
  float fog = 1.0 - exp(-dist * uOptics.w);
  col = mix(col, skyLod(-V, 3.0), fog);

  if (uDebug == 1) col = Nrm * 0.5 + 0.5;
  else if (uDebug == 2) col = spec;
  else if (uDebug == 3) col = vec3(foam, cover, shoreFoam);
  else if (uDebug == 4) col = vec3(alpha * 5.0, sqrt(geoVar) * 5.0, sqrt(variance.x + variance.y) * 5.0);
  else if (uDebug == 5) col = vec3(F);
  else if (uDebug == 6) col = body;
  else if (uDebug == 7) col = refl;
  fragColor = vec4(col, 2.0);
}`,Be=class{constructor(t,n,r,i){this.sim=t,this.uniforms={uDisp0:{value:null},uDisp1:{value:null},uDisp2:{value:null},uSlope0:{value:null},uSlope1:{value:null},uSlope2:{value:null},uSlope3:{value:null},uLength:{value:new E(...t.lengths)},uWind:{value:0},uImpact:{value:Array.from({length:8},()=>new E)},uImpactSize:{value:Array(8).fill(1)},uShore:{value:n.texture},uTravel:{value:n.travel},uShoreExtent:{value:n.extent},uTime:{value:0},uShoreWave:{value:new E(.55,30,1,1)},uWaveDamp:{value:new m(26,.55)},uSwellDir:{value:new m(1,0)},uGridScale:{value:1},uCellStep:{value:2*Math.PI/ke},uResolution:{value:new m(1,1)},uNearFar:{value:new m(.5,8e4)},uSceneColor:{value:null},uSceneDepth:{value:null},uReflection:{value:null},uReflMatrix:{value:new D},uSkyCube:{value:r.cube},uSkyMaxLod:{value:Math.log2(r.cubeSize)},uFoamTex:{value:null},uShadowMap:{value:null},uShadowMatrix:{value:new D},uShadowBias:{value:1e-5},...i,uSunDir:{value:r.sunDir},uSunColor:{value:r.sunColor},uAbsorption:{value:new e(.42,.075,.048)},uScatterColor:{value:new k(0,.05,.08)},uFoamTint:{value:new k(.62,.78,.82)},uSSS:{value:new E(1.6,.06,.05,0)},uFoam:{value:new E(.05,1.3,.35,.85)},uOptics:{value:new E(.02,.06,.04,1/18e3)},uCamForward:{value:new e},uDebug:{value:0},uGlint:{value:.6},uCamSide:{value:-1}},this.material=new S({glslVersion:P,vertexShader:Re,fragmentShader:ze,uniforms:this.uniforms,side:2}),this.grids=[Pe(ke),Pe(ke/2)],this.mesh=new d(this.grids[0],this.material),this.mesh.frustumCulled=!1}update(e,n){let r=this.uniforms,i=this.sim;r.uDisp0.value=i.displacement[0],r.uDisp1.value=i.displacement[1],r.uDisp2.value=i.displacement[2],r.uSlope0.value=i.slope[0],r.uSlope1.value=i.slope[1],r.uSlope2.value=i.slope[2],r.uSlope3.value=i.slope[3],r.uWind.value=i.params.windSpeed,r.uTime.value=n;let a=t.degToRad(i.params.swellDirection);r.uSwellDir.value.set(-Math.cos(a),-Math.sin(a)),r.uGridScale.value=Math.max(1,Math.abs(e.position.y)/2);let o=+(Math.abs(e.position.y)>Ae);this.mesh.geometry=this.grids[o],r.uCellStep.value=2*Math.PI/(ke>>o),r.uNearFar.value.set(e.near,e.far),e.getWorldDirection(r.uCamForward.value)}},Ve=0x56bc75e2d63100000;function He(e,t,n,r,i){let a=0;r[0]=0,i[0]=-0x56bc75e2d63100000,i[1]=Ve;for(let n=1;n<t;n++){let t=(e[n]+n*n-(e[r[a]]+r[a]*r[a]))/(2*n-2*r[a]);for(;t<=i[a];)a--,t=(e[n]+n*n-(e[r[a]]+r[a]*r[a]))/(2*n-2*r[a]);a++,r[a]=n,i[a]=t,i[a+1]=Ve}a=0;for(let o=0;o<t;o++){for(;i[a+1]<o;)a++;n[o]=(o-r[a])*(o-r[a])+e[r[a]]}}function Ue(e,t){let n=new Float64Array(t*t);for(let t=0;t<n.length;t++)n[t]=e[t]?0:Ve;let r=new Float64Array(t),i=new Float64Array(t),a=new Int32Array(t),o=new Float64Array(t+1);for(let e=0;e<t;e++){for(let i=0;i<t;i++)r[i]=n[i*t+e];He(r,t,i,a,o);for(let r=0;r<t;r++)n[r*t+e]=i[r]}for(let e=0;e<t;e++){for(let i=0;i<t;i++)r[i]=n[e*t+i];He(r,t,i,a,o);for(let r=0;r<t;r++)n[e*t+r]=i[r]}return n}var U=(e,t)=>e<0?0:e>t?t:e;function W(e,t,n){let r=new Float32Array(e.length),i=new Float32Array(e.length),a=2*n+1,o=t-1;for(let i=0;i<t;i++){let s=i*t,c=0;for(let t=-n;t<=n;t++)c+=e[s+U(t,o)];for(let i=0;i<t;i++)r[s+i]=c/a,c+=e[s+U(i+n+1,o)]-e[s+U(i-n,o)]}for(let e=0;e<t;e++){let s=0;for(let i=-n;i<=n;i++)s+=r[U(i,o)*t+e];for(let c=0;c<t;c++)i[c*t+e]=s/a,s+=r[U(c+n+1,o)*t+e]-r[U(c-n,o)*t+e]}return i}function We(e,t){let n=new ae(e,t,t,b,w);return n.minFilter=n.magFilter=p,n.wrapS=n.wrapT=j,n.needsUpdate=!0,n}var Ge=9.81,Ke=.3,qe=14,Je=64,Ye=50,Xe=3,Ze=300,Qe=1/25;function $e(e,t){let n=t*t,r=e.slice(),i=new Uint8Array(n),a=new Int32Array(n),o=new Int32Array(n);for(let s=0;s<n;s++){if(e[s]||i[s])continue;let c=0,l=0;for(a[c++]=s,i[s]=1;c>0;){let r=a[--c],s=r%t;o[l++]=r,s>0&&!e[r-1]&&!i[r-1]&&(i[r-1]=1,a[c++]=r-1),s<t-1&&!e[r+1]&&!i[r+1]&&(i[r+1]=1,a[c++]=r+1),r>=t&&!e[r-t]&&!i[r-t]&&(i[r-t]=1,a[c++]=r-t),r<n-t&&!e[r+t]&&!i[r+t]&&(i[r+t]=1,a[c++]=r+t)}if(l<Je)for(let e=0;e<l;e++)r[o[e]]=1}return r}function et(e,t,n,r){for(let i=0;i<t.length;i++)t[i]=Math.sqrt(Ge*Math.min(qe,Math.max(Ke,-e[i]))),n[i]=r/t[i]}function tt(e,t,n,r,i,a){let o=a+2;t.fill(2);for(let e=0;e<a;e++)t.fill(1,(e+1)*o+1,(e+1)*o+1+a);for(let s=0;s<a;s++)for(let c=0;c<a;c++){let l=s*a+c,u=r[l],d=n[l],f=1/0,p=1/0;if(c>0&&r[l-1]!==u&&(f=d/(d-n[l-1])),c<a-1&&r[l+1]!==u&&(f=Math.min(f,d/(d-n[l+1]))),s>0&&r[l-a]!==u&&(p=d/(d-n[l-a])),s<a-1&&r[l+a]!==u&&(p=Math.min(p,d/(d-n[l+a]))),f===1/0&&p===1/0)continue;let m=f===1/0?p:p===1/0?f:f*p/(Math.sqrt(f*f+p*p)||1),h=l+2*s+o+1;e[h]=m*i[l],t[h]=2}}function nt(e,t,n,r,i,a){let o=r+2,s=0;for(let c=0,l=a>0?0:r-1;c<r;c++,l+=a)for(let a=0,c=i>0?0:r-1;a<r;a++,c+=i){let i=l*r+c,a=i+2*l+o+1;if(t[a]!==1)continue;t[a]=0;let u=e[a-1],d=e[a+1],f=e[a-o],p=e[a+o],m=u<d?u:d,h=f<p?f:p,g=n[i],_=m>h?m-h:h-m,v=_>=g?(m<h?m:h)+g:.5*(m+h+Math.sqrt(2*g*g-_*_));v<e[a]-1e-4&&(e[a]=v,s++,t[a-1]===0&&(t[a-1]=1),t[a+1]===0&&(t[a+1]=1),t[a-o]===0&&(t[a-o]=1),t[a+o]===0&&(t[a+o]=1))}return s}var rt=(e,t,n,r)=>nt(e,t,n,r,1,1)+nt(e,t,n,r,-1,1)+nt(e,t,n,r,1,-1)+nt(e,t,n,r,-1,-1);function it(e,t,n){let r=new Float32Array(n*n);for(let i=0;i<n;i++)for(let a=0;a<n;a++){let o=i*n+a,s=e[o+2*i+n+3];r[o]=s===1/0?0:t[o]?s:-s}return r}function at(e,t,n,r,i,a,o){for(let s=0;s<a;s++){let c=s>0?-a:0,l=s<a-1?a:0;for(let u=0;u<a;u++){let d=s*a+u,f=u>0?-1:0,p=e[d+ +(u<a-1)]-e[d+f],m=e[d+l]-e[d+c],h=Math.sqrt(p*p+m*m);h>1e-9&&(n[d]=-p/h,r[d]=-m/h);let g=Math.min(1,Math.max(0,(h/(2*o)*t[d]-.7)/.25));i[d]=g*g*(3-2*g)}}}function ot(e,t,n,r,i){let a=new Float32Array(r*r);for(let o=0;o<r;o++){let s=o>0?-r:0,c=o<r-1?r:0;for(let l=0;l<r;l++){let u=o*r+l,d=l>0?-1:0,f=-(e[u+ +(l<r-1)]-e[u+d]+t[u+c]-t[u+s])/(2*i);a[u]=Math.min(Qe,Math.max(-.04,f))*n[u]}}return a}function st(e,t,n,r,i,a){let o=i>>1,s=new Float32Array(o*o),c=Xe*a,l=Math.ceil(2.5*Ye/c),u=new Float32Array(l);for(let e=0;e<l;e++)u[e]=Math.exp(-e*c/Ye)*c;for(let c=0;c<o;c++)for(let d=0;d<o;d++){let f=2*d,p=2*c,m=p*i+f,h=Math.min(1,Math.max(0,(Ze-r[m])/80));if(r[m]<-3*a||h===0)continue;let g=f,_=p,v=0;for(let r=0;r<l;r++){let a=Math.min(i-2,g|0),o=Math.min(i-2,_|0),s=o*i+a,c=g-a,l=_-o,d=(1-c)*(1-l),f=c*(1-l),p=(1-c)*l,m=c*l;if(v+=u[r]*(e[s]*d+e[s+1]*f+e[s+i]*p+e[s+i+1]*m),g-=Xe*(t[s]*d+t[s+1]*f+t[s+i]*p+t[s+i+1]*m),_-=Xe*(n[s]*d+n[s+1]*f+n[s+i]*p+n[s+i+1]*m),g<0||_<0||g>i-1||_>i-1)break}s[c*o+d]=v*h}return s}function ct(e,t,n,r,i,a,o){let s=o>>1,c=new Float32Array(o*o*4);for(let l=0;l<o;l++){let u=Math.min(s-1,l*.5),d=Math.min(s-2,u|0),f=u-d;for(let u=0;u<o;u++){let p=Math.min(s-1,u*.5),m=Math.min(s-2,p|0),h=p-m,g=d*s+m,_=(r[g]*(1-h)+r[g+1]*h)*(1-f)+(r[g+s]*(1-h)+r[g+s+1]*h)*f,v=l*o+u,y=1/Math.sqrt(Math.sqrt(Math.min(1,Math.max(.04,Math.max(-i[v],.6)/qe))));c[v*4]=e[v],c[v*4+1]=t[v],c[v*4+2]=n[v],c[v*4+3]=Math.min(2.5,Math.max(.3,_===0?y:y*Math.exp(.5*_)))*a[v]}}return c}function lt(e,t,n,r,i){let a=r*r,o=$e(t,r),s=new Float32Array(a),c=new Float64Array(a);et(e,s,c,i);let l=new Float64Array((r+2)*(r+2)).fill(1/0),u=new Uint8Array((r+2)*(r+2));tt(l,u,e,o,c,r);for(let e=0;e<12&&rt(l,u,c,r)>0;e++);let d=W(W(it(l,o,r),r,2),r,2),f=new Float32Array(a),p=new Float32Array(a),m=new Float32Array(a);at(d,s,f,p,m,r,i);let h=W(W(ot(f,p,m,r,i),r,2),r,2),g=W(W(m,r,2),r,2),_=ct(d,f,p,st(h,f,p,n,r,i),e,g,r);return{travel:We(_,r),travelData:_}}function ut(e,t,n=512){let r=t/n,i=new Float32Array(n*n),a=new Uint8Array(n*n),o=new Uint8Array(n*n);for(let r=0;r<n;r++)for(let s=0;s<n;s++){let c=e(((s+.5)/n-.5)*t,((r+.5)/n-.5)*t),l=r*n+s;i[l]=c,a[l]=c>0,o[l]=c<=0}let s=Ue(a,n),c=Ue(o,n),l=new Float32Array(n*n);for(let e=0;e<l.length;e++)l[e]=o[e]?(Math.sqrt(s[e])-.5)*r:-(Math.sqrt(c[e])-.5)*r;l=W(W(l,n,2),n,2);let u=new Float32Array(n*n*4);for(let e=0;e<n;e++)for(let t=0;t<n;t++){let a=e*n+t,o=(e,t)=>l[Math.min(n-1,Math.max(0,t))*n+Math.min(n-1,Math.max(0,e))];u[a*4]=i[a],u[a*4+1]=l[a],u[a*4+2]=(o(t+1,e)-o(t-1,e))/(2*r),u[a*4+3]=(o(t,e+1)-o(t,e-1))/(2*r)}return{texture:We(u,n),extent:t,data:u,size:n,...lt(i,o,l,n,r)}}var dt=`
precision highp float;
in vec2 vUv;
out vec4 outColor;
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
// tileable voronoi: cell ids wrap at period
vec2 voronoi(vec2 p, float period) {
  vec2 i = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y);
    vec2 o = hash22(mod(i + g, period));
    float d = length(g + o - f);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return vec2(f1, f2);
}
// cauliflower whitewater: every voronoi cell bulges (dome over the distance to its
// edge, creased where cells meet), at three scales
float billow(vec2 uv) {
  vec2 a = voronoi(uv * 7.0 + 0.3, 7.0), b = voronoi(uv * 17.0 + 0.7, 17.0), c = voronoi(uv * 41.0 + 0.1, 41.0);
  return 0.5 * sqrt(clamp((a.y - a.x) * 2.2, 0.0, 1.0)) + 0.32 * sqrt(clamp((b.y - b.x) * 2.2, 0.0, 1.0))
       + 0.18 * sqrt(clamp((c.y - c.x) * 2.2, 0.0, 1.0));
}
void main() {
  vec2 a = voronoi(vUv * 9.0, 9.0);
  vec2 b = voronoi(vUv * 23.0 + 0.5, 23.0);
  vec2 c = voronoi(vUv * 61.0, 61.0);
  float lace = 1.0 - smoothstep(0.0, 0.22, a.y - a.x);
  float fine = 1.0 - smoothstep(0.0, 0.16, b.y - b.x);
  float bubbles = smoothstep(0.55, 0.15, c.x);
  float v = lace * 0.55 + fine * 0.3 + bubbles * 0.25 + (1.0 - a.x) * 0.25;
  const float e = 1.0 / 1024.0;
  vec2 g = vec2(billow(vUv + vec2(e, 0.0)) - billow(vUv - vec2(e, 0.0)), billow(vUv + vec2(0.0, e)) - billow(vUv - vec2(0.0, e))) / (2.0 * e);
  outColor = vec4(clamp(v * 0.85, 0.0, 1.0), billow(vUv), clamp(0.5 + g / 64.0, 0.0, 1.0));
}`;function ft(e,t,n){let r=new M(n,n,{wrapS:x,wrapT:x,minFilter:O,magFilter:p,generateMipmaps:!0,depthBuffer:!1,anisotropy:e.capabilities.getMaxAnisotropy()}),i=L(t);return new R(i).render(e,r),i.dispose(),e.setRenderTarget(null),r.texture}function pt(e){return{foam:ft(e,dt,512)}}var G=6360,K=6460,mt=.01,ht=256,gt=64,_t=32,vt=192,yt=108;function bt(e){let t=e.turbidity*e.turbidity;return{rayleigh:[.005802,.013558,.0331].map(t=>t*e.rayleigh),mieScattering:.003996*t,mieExtinction:.00444*t,ozone:[65e-5,.001881,85e-6]}}function xt(e,t,n){let r=e*(2*G+e)+n*(2*(G+e)*t+n);return r/(Math.sqrt(G*G+r)+G)}function St(e,t,n,r=[0,0,0]){let i=G+t,a=Math.max(-i*n+Math.sqrt(Math.max(i*i*(n*n-1)+K*K,0)),0),o=[0,0,0];for(let r=0;r<40;r++){let i=Math.max(xt(t,n,a*((r+.5)/40)**2),0),s=(2*r+1)*a/1600,c=Math.exp(-i/8)*s,l=Math.exp(-i/1.2)*s,u=Math.max(0,1-Math.abs(i-25)/15)*s;for(let t=0;t<3;t++)o[t]+=e.rayleigh[t]*c+e.mieExtinction*l+e.ozone[t]*u}for(let e=0;e<3;e++)r[e]=Math.exp(-o[e]);return r}var Ct=mt,wt=`
precision highp float;
precision highp sampler2D;
#define PI 3.14159265359
const float RB = ${G.toFixed(1)}, RT = ${K.toFixed(1)}, OBS_H = ${mt};
const float H_TOP = ${Math.sqrt(K*K-G*G).toFixed(4)};  // sqrt(RT^2 - RB^2)
const float MIE_G = 0.8;
const float GROUND_ALBEDO = 0.1;
const vec2 SKY_RES = vec2(${vt}.0, ${yt}.0);
uniform vec3 uRayleigh;     // Rayleigh scattering at sea level (1/km)
uniform vec2 uMie;          // aerosol scattering, extinction at sea level (1/km)
uniform vec3 uOzone;        // ozone absorption at the layer peak (1/km)
uniform float uSunIllum;    // sun illuminance outside the atmosphere
uniform sampler2D uTransLut;
uniform sampler2D uMsLut;
uniform sampler2D uSkyView;

vec2 toSub(vec2 u, vec2 n) { return u * (n - 1.0) / n + 0.5 / n; }
vec2 fromSub(vec2 u, vec2 n) { return (u - 0.5 / n) * n / (n - 1.0); }

// altitude after travelling t along a ray from altitude h with zenith cosine mu; r = radius
float altAt(float h, float mu, float t, out float r) {
  float q = h * (2.0 * RB + h) + t * (2.0 * (RB + h) * mu + t);  // r^2 - RB^2 without cancellation
  r = sqrt(RB * RB + q);
  return q / (r + RB);
}

struct Medium { vec3 ray; float mie; vec3 scat; vec3 ext; };
Medium medium(float h) {
  h = max(h, 0.0);
  float dM = exp(-h / 1.2);
  Medium m;
  m.ray = uRayleigh * exp(-h / 8.0);
  m.mie = uMie.x * dM;
  m.scat = m.ray + m.mie;
  m.ext = m.ray + uMie.y * dM + uOzone * max(0.0, 1.0 - abs(h - 25.0) / 15.0);  // ozone: tent 10..40 km
  return m;
}

float distTop(float r, float mu) { return max(-r * mu + sqrt(max(r * r * (mu * mu - 1.0) + RT * RT, 0.0)), 0.0); }

// Bruneton's transmittance parameterisation (covers the rays that miss the ground)
vec2 transUv(float h, float mu) {
  float r = RB + h, rho = sqrt(max(h, 0.0) * (2.0 * RB + h));
  float dMin = RT - r, dMax = rho + H_TOP;
  return vec2((distTop(r, mu) - dMin) / (dMax - dMin), rho / H_TOP);
}
vec3 transmittance(float h, float mu) { return textureLod(uTransLut, transUv(h, mu), 0.0).rgb; }

// 0 where the planet hides the sun from altitude h (radius r)
float sunVisible(float h, float r, float muS) { return step(-sqrt(max(h, 0.0) * (2.0 * RB + h)) / r, muS); }

// sky-view LUT, upper hemisphere only (the observer is at sea level): u = sqrt of the azimuth
// cosine to the sun, v = sqrt(elevation / 90deg) so texels crowd the horizon
vec3 skyView(vec3 d, vec3 sunDir) {
  float v = sqrt(asin(clamp(d.y, 0.0, 1.0)) / (0.5 * PI));
  float cosPhi = dot(d.xz, sunDir.xz) * inversesqrt(max(dot(d.xz, d.xz) * dot(sunDir.xz, sunDir.xz), 1e-12));
  float u = sqrt(clamp(0.5 - 0.5 * cosPhi, 0.0, 1.0));
  return textureLod(uSkyView, toSub(vec2(u, v), SKY_RES), 0.0).rgb;
}
`,Tt=`
in vec2 vUv;
out vec4 fragColor;
`,Et=`
float rayleighPhase(float c) { return 0.0596831 * (1.0 + c * c); }
float miePhase(float c) {
  float k = 1.0 + MIE_G * MIE_G - 2.0 * MIE_G * c;
  return (1.0 - MIE_G * MIE_G) / (4.0 * PI * k * sqrt(k));
}
vec3 multiScatter(float h, float muS) {
  vec2 uv = clamp(vec2(muS * 0.5 + 0.5, h / (RT - RB)), 0.0, 1.0);
  return textureLod(uMsLut, toSub(uv, vec2(${_t}.0)), 0.0).rgb;
}
vec3 integrate(float h, float mu, float muS, float nu, int n, out vec3 fms) {
  float r0 = RB + h;
  float gd = r0 * r0 * (mu * mu - 1.0) + RB * RB;
  bool ground = mu < 0.0 && gd >= 0.0;
  float tMax = ground ? max(-r0 * mu - sqrt(gd), 0.0) : distTop(r0, mu);
#ifdef MS_PASS
  float pR = 1.0 / (4.0 * PI), pM = pR;
#else
  float pR = rayleighPhase(nu), pM = miePhase(nu);
#endif
  vec3 L = vec3(0.0), T = vec3(1.0);
  fms = vec3(0.0);
  float k = tMax / float(n * n);
  for (int i = 0; i < n; i++) {
    float fi = float(i);
    float t = k * (fi + 0.5) * (fi + 0.5), dt = k * (2.0 * fi + 1.0);
    float r;
    float ht = altAt(h, mu, t, r);
    float muSt = clamp((r0 * muS + t * nu) / r, -1.0, 1.0);
    Medium m = medium(ht);
    vec3 S = transmittance(ht, muSt) * sunVisible(ht, r, muSt) * (m.ray * pR + m.mie * pM);
#ifndef MS_PASS
    S += m.scat * multiScatter(ht, muSt);
#endif
    vec3 Ts = exp(-m.ext * dt);
    vec3 seg = (1.0 - Ts) / max(m.ext, vec3(1e-7));
    L += T * S * seg;
    fms += T * m.scat * seg;
    T *= Ts;
  }
#ifdef MS_PASS
  if (ground) {
    float muSg = clamp((r0 * muS + tMax * nu) / RB, -1.0, 1.0);
    L += T * transmittance(0.0, muSg) * max(muSg, 0.0) * (GROUND_ALBEDO / PI);
  }
#endif
  return L;
}
`,Dt=wt+Tt+`
void main() {
  float rho = H_TOP * vUv.y;
  float r = sqrt(rho * rho + RB * RB), h = rho * rho / (r + RB);
  float dMin = RT - r, d = mix(dMin, rho + H_TOP, vUv.x);
  float mu = d <= 0.0 ? 1.0 : clamp((H_TOP * H_TOP - rho * rho - d * d) / (2.0 * r * d), -1.0, 1.0);
  vec3 od = vec3(0.0);
  for (int i = 0; i < 40; i++) {
    float fi = float(i), rr;
    od += medium(altAt(h, mu, d * (fi + 0.5) * (fi + 0.5) / 1600.0, rr)).ext * (2.0 * fi + 1.0);
  }
  fragColor = vec4(exp(-od * (d / 1600.0)), 1.0);
}`,Ot=`#define MS_PASS
`+wt+Tt+Et+`
void main() {
  vec2 uv = fromSub(vUv, vec2(${_t}.0));
  float muS = uv.x * 2.0 - 1.0, h = max(uv.y * (RT - RB), OBS_H);
  float sinS = sqrt(max(1.0 - muS * muS, 0.0));
  vec3 L = vec3(0.0), F = vec3(0.0), fms;
  for (int j = 0; j < 8; j++) {
    float mu = 1.0 - 2.0 * (float(j) + 0.5) / 8.0, sinV = sqrt(1.0 - mu * mu);
    for (int i = 0; i < 8; i++) {
      float nu = cos(2.0 * PI * (float(i) + 0.5) / 8.0) * sinV * sinS + mu * muS;
      L += integrate(h, mu, muS, nu, 20, fms);
      F += fms;
    }
  }
  fragColor = vec4((L / 64.0) / (1.0 - F / 64.0), 1.0);
}`,kt=wt+Tt+Et+`
uniform float uSunMu;
void main() {
  vec2 uv = fromSub(vUv, SKY_RES);
  float cosPhi = 1.0 - 2.0 * uv.x * uv.x, elev = 0.5 * PI * uv.y * uv.y;
  float mu = sin(elev), cosE = cos(elev);
  vec3 v = vec3(cosE * cosPhi, mu, cosE * sqrt(max(1.0 - cosPhi * cosPhi, 0.0)));
  vec3 s = vec3(sqrt(max(1.0 - uSunMu * uSunMu, 0.0)), uSunMu, 0.0);
  vec3 fms;
  fragColor = vec4(integrate(OBS_H, mu, uSunMu, dot(v, s), 32, fms) * uSunIllum, 1.0);
}`,At=(e,t)=>new M(e,t,{type:r,depthBuffer:!1,generateMipmaps:!1,minFilter:p,magFilter:p}),jt=class{constructor(){this.transRT=At(ht,gt),this.msRT=At(_t,_t),this.skyRT=At(vt,yt),this.uniforms={uRayleigh:{value:new e},uMie:{value:new m},uOzone:{value:new e},uSunIllum:{value:1},uTransLut:{value:this.transRT.texture},uMsLut:{value:this.msRT.texture},uSkyView:{value:this.skyRT.texture}};let{uTransLut:t,uMsLut:n,uSkyView:r,...i}=this.uniforms;this.transPass=new R(L(Dt,i)),this.msPass=new R(L(Ot,{...i,uTransLut:t})),this.skyPass=new R(L(kt,{...i,uTransLut:t,uMsLut:n,uSunMu:{value:0}}))}update(e,t,n,r){let i=this.uniforms;i.uRayleigh.value.fromArray(t.rayleigh),i.uMie.value.set(t.mieScattering,t.mieExtinction),i.uOzone.value.fromArray(t.ozone),i.uSunIllum.value=r,this.skyPass.material.uniforms.uSunMu.value=n,this.transPass.render(e,this.transRT),this.msPass.render(e,this.msRT),this.skyPass.render(e,this.skyRT)}},Mt=1024,Nt=2.5,Pt=`
out vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww; // far plane
}`,Ft=`
uniform samplerCube uCube;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
in vec3 vDir;
out vec4 fragColor;
void main() {
  vec3 d = normalize(vDir);
  vec4 sky = textureLod(uCube, vec3(d.x, max(d.y, 0.0), d.z), 0.0);
  float c = dot(d, uSunDir);
  // 0.27 deg disc with limb darkening, plus a tight glow; hidden by clouds (cube alpha)
  float disc = smoothstep(0.999985, 0.999992, c) * (0.6 + 0.4 * smoothstep(0.999985, 1.0, c));
  vec3 col = sky.rgb + uSunColor * (disc * 900.0 + pow(max(c, 0.0), 2200.0) * 1.5) * step(0.0, d.y) * sky.a;
  fragColor = vec4(col, 1.0);
}`,It=wt+`
const float CLOUD_H = ${Nt.toFixed(2)};
const vec3 WATER = vec3(0.02, 0.035, 0.045);  // deep-water body reflectance for the lower hemisphere
uniform int uFace;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uCloudCoverage;
in vec2 vUv;
out vec4 fragColor;

vec3 faceDir(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  if (uFace == 0) return vec3(1.0, -c.y, -c.x);
  if (uFace == 1) return vec3(-1.0, -c.y, c.x);
  if (uFace == 2) return vec3(c.x, 1.0, c.y);
  if (uFace == 3) return vec3(c.x, -1.0, -c.y);
  if (uFace == 4) return vec3(c.x, -c.y, 1.0);
  return vec3(-c.x, -c.y, -1.0);
}

// cloud layer ported from three's Sky.js (static: time = 0, its cloudScale/elevation/density)
vec2 gradient(vec2 i) {
  vec3 p = fract(i.xyx * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.xx + p.yz) * p.zy) * 2.0 - 1.0;
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradient(i), f);
  float b = dot(gradient(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(gradient(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(gradient(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.6;
}
float fbm(vec2 p) {
  float s = 0.0, a = 1.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); a *= 0.5; p *= 2.0; }
  return s;
}

void main() {
  vec3 d = normalize(faceDir(vUv));
  vec3 up = skyView(vec3(0.0, 1.0, 0.0), uSunDir);
  if (d.y < 0.0) {
    // below the horizon: sea, Fresnel between the mirrored sky and a dark water body
    float F = 0.02 + 0.98 * pow(1.0 + d.y, 5.0);
    vec3 body = WATER * (uSunColor * max(uSunDir.y, 0.0) + up);
    fragColor = vec4(mix(body, skyView(vec3(d.x, -d.y, d.z), uSunDir), F), 1.0);
    return;
  }
  vec3 col = skyView(d, uSunDir);
  float vis = 1.0;
  if (d.y > 1e-3 && uCloudCoverage > 0.0) {
    vec2 p = d.xz / d.y * 0.396;   // cloudScale 2e-4 * 1000 / mix(1, 0.1, cloudElevation 0.55)
    float n = clamp(fbm(p) * 0.7 + 0.5, 0.0, 1.0);
    float th = 1.0 - clamp(uCloudCoverage + noise(p * 0.3) * 0.222, 0.0, 1.0);  // clear gaps / dense banks
    float fade = smoothstep(0.0, 0.063, d.y);
    float mask = smoothstep(th, th + 0.3, n) * fade;
    float depth = max(0.0, n - th);
    float beer = exp(-4.0 * depth);
    float shade = mix(0.45, 1.0, clamp(beer * (1.0 - beer * beer) * 2.6, 0.0, 1.0));  // beer-powder
    float c = dot(d, uSunDir);
    float silver = clamp(0.51 / pow(1.49 - c * 1.4, 1.5), 0.0, 3.0);  // HG g = 0.7 rim toward the sun
    float edge = mask * (1.0 - mask) * 4.0;
    float alpha = (1.0 - exp(-depth * 6.6)) * fade;                    // cloudDensity 0.55

    // the deck point along d: sunlight through the atmosphere (and planet shadow) to it, and the
    // eye-to-deck transmittance so distant clouds dissolve into the haze
    float r0 = RB + OBS_H, rc = RB + CLOUD_H;
    float t = -r0 * d.y + sqrt(r0 * r0 * d.y * d.y + (rc - r0) * (rc + r0));
    float muV = (r0 * d.y + t) / rc;
    float muS = clamp((r0 * uSunDir.y + t * c) / rc, -1.0, 1.0);
    vec3 sun = uSunIllum * transmittance(CLOUD_H, muS) * sunVisible(CLOUD_H, rc, muS) * 0.22;  // albedo/pi
    vec3 cloud = up + sun * (shade + silver * edge * 0.6);
    vec3 tv = clamp(transmittance(OBS_H, d.y) / max(transmittance(CLOUD_H, muV), vec3(1e-4)), 0.0, 1.0);
    col = mix(col, mix(col, cloud, tv), alpha);
    vis = 1.0 - alpha;
  }
  fragColor = vec4(col, vis);
}`,Lt=class{constructor(t){this.renderer=t,this.cubeSize=Mt,this.sunDir=new e(0,1,0),this.sunColor=new e(1,1,1),this.params={elevation:3.5,azimuth:205,turbidity:2,rayleigh:1,cloudCoverage:.38,sunIntensity:9},this.atmosphere=new jt,this.cubeRT=new C(Mt,{type:r,generateMipmaps:!0,depthBuffer:!1,minFilter:O,magFilter:p}),this.cube=this.cubeRT.texture,this.cubePass=new R(L(It,{...this.atmosphere.uniforms,uFace:{value:0},uSunDir:{value:this.sunDir},uSunColor:{value:this.sunColor},uCloudCoverage:{value:0}})),this.camera=new re,this.background=new d(new se(1,1,1),new S({glslVersion:P,vertexShader:Pt,fragmentShader:Ft,uniforms:{uCube:{value:this.cube},uSunDir:{value:this.sunDir},uSunColor:{value:this.sunColor}},side:1,depthWrite:!1})),this.background.frustumCulled=!1,this.background.renderOrder=1e3}update(){let e=this.params,n=this.renderer,r=t.degToRad(90-e.elevation),i=t.degToRad(e.azimuth);this.sunDir.setFromSphericalCoords(1,r,i);let a=bt(e),o=St(a,Ct,Math.max(this.sunDir.y,0)),s=t.smoothstep(e.elevation,-2,2);this.sunColor.set(o[0],o[1],o[2]).multiplyScalar(e.sunIntensity*s);let c=n.getRenderTarget(),l=n.getActiveCubeFace(),u=n.getActiveMipmapLevel();this.atmosphere.update(n,a,this.sunDir.y,Math.PI*e.sunIntensity);let d=this.cubePass.material.uniforms;d.uCloudCoverage.value=e.cloudCoverage;for(let e=0;e<6;e++)d.uFace.value=e,this.cube.generateMipmaps=e===5,n.setRenderTarget(this.cubeRT,e),n.render(this.cubePass.mesh,this.camera);n.setRenderTarget(c,l,u),this.cube.needsPMREMUpdate=!0}};function Rt(e,t,n){let r=Math.imul(e,374761393)^Math.imul(t,668265263)^Math.imul(n,2147483647);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967295}function zt(e,t,n=0){let r=Math.floor(e),i=Math.floor(t),a=e-r,o=t-i,s=a*a*(3-2*a),c=o*o*(3-2*o),l=Rt(r,i,n),u=Rt(r+1,i,n),d=Rt(r,i+1,n),f=Rt(r+1,i+1,n);return(l+(u-l)*s+(d-l)*c+(l-u-d+f)*s*c)*2-1}function q(e,t,n=5,r=0){let i=0,a=.5,o=0;for(let s=0;s<n;s++){i+=a*zt(e,t,r+s*17),o+=a;let n=1.6*e-1.2*t,c=1.2*e+1.6*t;e=n,t=c,a*=.5}return i/o}function Bt(e,t,n=5,r=0){let i=0,a=.5,o=0;for(let s=0;s<n;s++){let n=1-Math.abs(zt(e,t,r+s*31));i+=a*n*n,o+=a;let c=1.6*e-1.2*t,l=1.2*e+1.6*t;e=c,t=l,a*=.5}return i/o}var Vt=2400,Ht=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function J(e,t){let n=q(e*.0035+11.3,t*.0035-4.1,4,3),r=Math.hypot(e-40*n,t+30*n)*(1+.32*q(e*.003,t*.003,3,7)),i=62*Math.exp(-((r/190)**2))+15*Math.exp(-((r/430)**2))-10;i-=32*Ht(380,1100,r);let a=Ht(4,40,i);return i+=a*26*(Bt(e*.009,t*.009,5,1)-.45),i>0&&i<5?i*=.55+.09*i:i<=0&&i>-14&&(i=-14*(-i/14)**1.8),i+=1.2*q(e*.05,t*.05,3,9)*Ht(-30,2,i),i}function Ut(e=384,t=256){let n=new y(Vt,Vt,e,e);n.rotateX(-Math.PI/2);let r=n.attributes.position;for(let e=0;e<r.count;e++)r.setY(e,J(r.getX(e),r.getZ(e)));let i=n.index.array,a=[];for(let e=0;e<i.length;e+=3)Math.max(r.getY(i[e]),r.getY(i[e+1]),r.getY(i[e+2]))>-34&&a.push(i[e],i[e+1],i[e+2]);n.setIndex(a),n.computeVertexNormals(),n.computeBoundingSphere();let o=new Float32Array(t*t);for(let e=0;e<t;e++)for(let n=0;n<t;n++){let r=((n+.5)/t-.5)*Vt,i=((e+.5)/t-.5)*Vt;o[e*t+n]=J(r,i)}let s=new ae(o,t,t,l,w);return s.minFilter=s.magFilter=p,s.wrapS=s.wrapT=j,s.needsUpdate=!0,{geometry:n,heightMap:s}}var Wt=z[2],Gt=1/1.33,Kt=16,qt=[{res:512,format:l},{res:256,format:s}],Jt=[{depth:1.5,target:0,channel:0,cells:128,margin:6},{depth:4,target:1,channel:0,cells:64,margin:7},{depth:10,target:1,channel:1,cells:32,margin:8}],Y=e=>e.toPrecision(9),[Yt,Xt,Zt]=Jt.map(e=>Y(e.depth)),Qt=`
precision highp float;
in vec3 position;               // PlaneGeometry vertex: cell coords - uCells / 2
uniform highp sampler2D uSlope; // cascade 2 (sx, sz, ...)
uniform vec3 uSun;              // towards the sun
uniform float uDepth, uCells, uLod, uMargin, uRes;
out vec2 vOld;

// cubic B-spline from 4 bilinear taps (GPU Gems 2, ch. 20). The landed intensity goes
// with the slope's derivative, which bilinear makes piecewise constant: every slope texel
// would land as its own bead along the caustic lines.
vec2 slopeBSpline(vec2 uv, float lod) {
  vec2 size = vec2(textureSize(uSlope, int(lod)));
  vec2 st = uv * size - 0.5, i = floor(st), f = st - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / g0) / size, h1 = (i + 1.5 + w3 / g1) / size;
  return g0.y * (g0.x * textureLod(uSlope, h0, lod).xy + g1.x * textureLod(uSlope, vec2(h1.x, h0.y), lod).xy)
       + g1.y * (g0.x * textureLod(uSlope, vec2(h0.x, h1.y), lod).xy + g1.x * textureLod(uSlope, h1, lod).xy);
}

void main() {
  vec2 t = (position.xy + 0.5 * uCells + 0.5) / uCells;   // tile uv, at a texel centre of mip uLod
  vec2 s = slopeBSpline(t, uLod);
  vec3 r = refract(-uSun, normalize(vec3(-s.x, 1.0, -s.y)), ${Y(Gt)});
  vec3 rf = refract(-uSun, vec3(0.0, 1.0, 0.0), ${Y(Gt)});
  vec2 d = (r.xz / max(-r.y, 0.05) - rf.xz / -rf.y) * (uDepth / ${Y(Wt)});
  // ponytail: offsets past the margin (steep facets at low sun) are clamped, widen the margin if it shows
  d = clamp(d, -uMargin, uMargin);
  vOld = t * uRes;
  gl_Position = vec4((t + d) * 2.0 - 1.0, 0.0, 1.0);
}`,$t=`
precision highp float;
uniform vec3 uMask;
in vec2 vOld;
out vec4 outColor;

void main() {
  // raster space is the landed space at one texel per pixel, so the landed area is 1 and
  // the ratio is the undisturbed area (in texels) per pixel
  vec2 a = dFdx(vOld), b = dFdy(vOld);
  outColor = vec4(uMask * min(abs(a.x * b.y - a.y * b.x), ${Y(Kt)}), 0.0);
}`,en=`
uniform sampler2D uCaustics, uCausticsDeep;
const float CAUSTIC_TEXELS_PER_M = ${Y(qt[0].res/Wt)};
float waveCaustic(vec2 entryXZ, float depth, float lod) {
  vec2 uv = entryXZ * ${Y(1/Wt)};
  float v = textureLod(uCaustics, uv, lod).r;
  if (depth > ${Yt}) {
    // deep texels are 2x the near ones; past the deepest slice keep it, one mip blurrier
    // per doubling of depth
    vec2 d = textureLod(uCausticsDeep, uv, max(lod - 1.0, 0.0) + log2(max(depth / ${Zt}, 1.0))).rg;
    v = depth < ${Xt} ? mix(v, d.r, (depth - ${Yt}) / (${Xt} - ${Yt}))
                      : mix(d.r, d.g, clamp((depth - ${Xt}) / (${Zt} - ${Xt}), 0.0, 1.0));
  }
  return mix(1.0, v, clamp(depth / ${Yt}, 0.0, 1.0));   // no caustic at zero depth
}
`,tn=new k,nn=class{constructor(t,n){this.renderer=t,this.sim=n,this.targets=qt.map(({res:e,format:t})=>new M(e,e,{type:r,format:t,samples:4,minFilter:O,magFilter:p,wrapS:x,wrapT:x,generateMipmaps:!0,depthBuffer:!1})),this.uniforms={uCaustics:{value:this.targets[0].texture},uCausticsDeep:{value:this.targets[1].texture}},this.slope={value:null},this.sun={value:new e},this.scenes=qt.map(()=>new g),Jt.forEach(({depth:t,target:n,channel:r,cells:i,margin:a})=>{let o=L($t,{uSlope:this.slope,uSun:this.sun,uRes:{value:qt[n].res},uDepth:{value:t},uCells:{value:i},uLod:{value:Math.max(0,Math.log2(256/i))},uMargin:{value:(a-1)/i},uMask:{value:new e().setComponent(r,1)}},{vertexShader:Qt,side:2,blending:5,blendSrc:201,blendDst:201}),s=i+2*a,c=new d(new y(s,s,s,s),o);c.frustumCulled=!1,this.scenes[n].add(c)}),this.camera=new re,this.flat=!1,this.update(new e(0,-1,0))}update(e){let t=e.y>0;if(!t&&this.flat)return;this.flat=!t;let n=this.renderer,r=n.getRenderTarget(),i=n.getActiveCubeFace(),a=n.getActiveMipmapLevel(),o=n.getClearAlpha();n.getClearColor(tn),this.sun.value.copy(e).normalize(),this.slope.value=this.sim.slope[2],n.setClearColor(t?0:16777215,1),this.targets.forEach((e,r)=>{this.scenes[r].visible=t,n.setRenderTarget(e),n.clear(!0,!1,!1),n.render(this.scenes[r],this.camera)}),n.setRenderTarget(r,i,a),n.setClearColor(tn,o)}},rn=`
varying vec3 vWPos;
varying vec3 vWNrm;
`,an=`
varying vec3 vWPos;
varying vec3 vWNrm;
uniform samplerCube uSkyCube;
uniform vec3 uAbsorption;
uniform vec3 uSunDirT;
uniform float uCausticStrength;
uniform float uFogDensity;
${en}
${De}
${Fe}
${Ie}
float th(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float tn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(th(i), th(i + vec2(1, 0)), u.x), mix(th(i + vec2(0, 1)), th(i + 1.0), u.x), u.y); }
// ripple marks: the phase along d (wavenumber w) is warped by noise of scale s and
// amplitude a (metres along d), so crests meander and fork where the warp gets steep
float ripplePhase(vec2 p, vec2 d, float w, float s, float a) {
  return w * (dot(p, d) + (tn(p * s) - 0.5) * a + (tn(p * s * 0.27 + 4.0) - 0.5) * a * 3.0);
}
// slope of h = amp (sin ph - 0.25 cos 2ph): sharp crests, broad troughs
vec2 rippleSlope(vec2 p, vec2 d, float w, float s, float a, float amp) {
  float ph = ripplePhase(p, d, w, s, a);
  vec2 grad = (vec2(ripplePhase(p + vec2(0.01, 0.0), d, w, s, a), ripplePhase(p + vec2(0.0, 0.01), d, w, s, a)) - ph) / 0.01;
  return grad * amp * (cos(ph) + 0.5 * sin(2.0 * ph));
}
uniform mat4 uSunShadowMatrix;
`,on=`
  float hgt = vWPos.y;
  float flat_ = clamp(vWNrm.y, 0.0, 1.0);
  float n1 = tn(vWPos.xz * 0.08), n2 = tn(vWPos.xz * 0.6), n3 = tn(vWPos.xz * 0.013);
  vec3 sand = mix(vec3(0.80, 0.71, 0.53), vec3(0.72, 0.62, 0.45), n1) * (0.92 + 0.16 * n2);
  vec3 seabed = mix(vec3(0.78, 0.72, 0.56), vec3(0.62, 0.58, 0.44), n1 * n3);
  vec3 grass = mix(vec3(0.20, 0.30, 0.10), vec3(0.33, 0.37, 0.15), n1) * (0.85 + 0.3 * n2);
  vec3 rock = mix(vec3(0.33, 0.31, 0.29), vec3(0.45, 0.41, 0.36), n2) * (0.8 + 0.4 * n3);
#ifdef ROCK
  vec3 albedo = rock * mix(0.9, 1.15, n1);
#else
  float sandLine = 2.4 + 1.6 * n3 + 0.8 * n1;
  vec3 albedo = hgt < 0.0 ? seabed : sand;
  albedo = mix(albedo, grass, smoothstep(sandLine, sandLine + 1.5, hgt) * smoothstep(0.62, 0.8, flat_));
  albedo = mix(albedo, rock, smoothstep(0.78, 0.62, flat_) * smoothstep(-6.0, 1.0, hgt));
  albedo = mix(albedo, rock * 1.1, smoothstep(38.0, 52.0, hgt + n1 * 8.0));
#endif
  // wet band above the waterline, plus where the swash has run (dries over seconds)
  vec3 sw = swash(vWPos.xz, hgt);
  float wet = max(1.0 - smoothstep(0.35, 1.3 + 0.5 * n1, hgt), sw.z);
  albedo *= mix(1.0, 0.58, wet);
  // the swash film itself: a faint water tint and foam on its leading edge
  float film = smoothstep(0.0, 0.015, sw.x) * step(0.0, hgt);
  albedo *= mix(vec3(1.0), vec3(0.78, 0.88, 0.92), film);
  albedo = mix(albedo, vec3(0.92), sw.y * (0.5 + 0.5 * n2));
  diffuseColor.rgb = albedo;
`,sn=`
#ifndef ROCK
  {
    vec2 fw = fwidth(vWPos.xz);
    float px = max(fw.x, fw.y);
    if (px < 0.5) {   // both ripple bands are faded out beyond this
    float sandMask = (1.0 - smoothstep(sandLine - 0.5, sandLine + 0.5, hgt)) * smoothstep(0.85, 0.95, flat_);
    sandMask *= mix(1.0, 0.25, smoothstep(-0.3, 0.6, hgt)); // dry sand: faint wind ripples only
    // long wave-formed ripples (~1.6 m) and short ones (~0.3 m), each fading in and out
    // in patches
    vec2 p = vWPos.xz;
    vec2 d1 = normalize(vec2(0.8, 0.6) + (vec2(tn(p * 0.02), tn(p * 0.02 + 5.0)) - 0.5));
    float a1 = 0.02 * (0.3 + 0.7 * smoothstep(0.25, 0.75, tn(p * 0.06 + 11.0)));
    vec2 g = rippleSlope(p, d1, 3.9, 0.35, 0.8, a1) * (1.0 - smoothstep(0.15, 0.5, px));
    if (px < 0.09) {
      float a2 = 0.002 * (0.3 + 0.7 * smoothstep(0.25, 0.75, tn(p * 0.15 + 3.0)));
      g += rippleSlope(p, normalize(d1 + vec2(-d1.y, d1.x) * 0.3), 21.0, 2.2, 0.1, a2) * (1.0 - smoothstep(0.03, 0.09, px));
    }
    vec3 nW = normalize(vWNrm - vec3(g.x, 0.0, g.y) * sandMask);
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
    }
  }
#endif
`,cn=`
  float wdepth = max(-vWPos.y, 0.0);
  // sun and sky light reaching the bed through the water column (the sun along its
  // refracted path)
  vec3 rsun = refract(-uSunDirT, vec3(0.0, 1.0, 0.0), 1.0 / 1.33);
  float sunPath = wdepth / max(-rsun.y, 0.1);
  diffuseColor.rgb *= exp(-uAbsorption * (sunPath * 0.6 + wdepth * 0.4));
`,ln=oe.lights_fragment_begin.replace(`getDirectionalLightInfo( directionalLight, directLight );`,`
    getDirectionalLightInfo( directionalLight, directLight );
    float under = smoothstep(0.05, -0.25, vWPos.y);
    vec3 shadowAt = vWPos + vWNrm * 0.04;
    bool viaSurface = false;
    if (under > 0.0) {
      vec3 rsun = refract(-uSunDirT, vec3(0.0, 1.0, 0.0), 1.0 / 1.33);
      viaSurface = rsun.y < -0.05 && under > 0.5;
      if (viaSurface) shadowAt = vec3(vWPos.x - rsun.x / rsun.y * vWPos.y, 0.05, vWPos.z - rsun.z / rsun.y * vWPos.y);
      directLight.direction = normalize(mix(directLight.direction, (viewMatrix * vec4(-rsun, 0.0)).xyz, under));
      float Ft = 0.02 + 0.98 * pow(1.0 - max(uSunDirT.y, 0.0), 5.0);
      directLight.color *= 1.0 - Ft * under;
    }
    directLight.color *= floatShadow(shadowAt);
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    vec4 sunShadowCoord = viaSurface ? uSunShadowMatrix * vec4(shadowAt, 1.0) : vDirectionalShadowCoord[ 0 ];
#endif
`).replace(`vDirectionalShadowCoord[ i ]`,`sunShadowCoord`),un=`
  roughnessFactor = mix(mix(roughnessFactor, 0.32, wet * step(0.0, hgt)), 0.06, film);
`,dn=`
  if (wdepth > 0.0 && rsun.y < -0.05) {
    vec2 entry = vWPos.xz + rsun.xz / rsun.y * wdepth;   // where this light entered the surface
    vec2 fwc = fwidth(entry);
    float c = waveCaustic(entry, wdepth, log2(max(max(fwc.x, fwc.y) * CAUSTIC_TEXELS_PER_M, 1.0)));
    reflectedLight.directDiffuse *= max(mix(1.0, c, uCausticStrength), 0.0);
  }
`,fn=`
  vec3 fdir = normalize(vWPos - cameraPosition);
  float fogAmt = 1.0 - exp(-length(vWPos - cameraPosition) * uFogDensity);
  outgoingLight = mix(outgoingLight, textureLod(uSkyCube, vec3(fdir.x, max(fdir.y, 0.0), fdir.z), 3.0).rgb, fogAmt);
`;function pn(e,t,n){let r=n!==`prop`;n===`rock`&&(e.defines={...e.defines,ROCK:``}),e.onBeforeCompile=e=>{Object.assign(e.uniforms,t),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
`+rn).replace(`#include <project_vertex>`,`#include <project_vertex>
  vec4 wp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
#endif
  vWPos = (modelMatrix * wp).xyz;
  vec3 wn = objectNormal;
#ifdef USE_INSTANCING
  wn = mat3(instanceMatrix) * wn;
#endif
  vWNrm = normalize(mat3(modelMatrix) * wn);`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
`+an).replace(`#include <map_fragment>`,`#include <map_fragment>
`+(r?on:``)+cn).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
`+(r?un:``)).replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>
`+(r?sn:``)).replace(`#include <lights_fragment_begin>`,ln).replace(`#include <lights_fragment_end>`,`#include <lights_fragment_end>
`+dn).replace(`#include <opaque_fragment>`,fn+`#include <opaque_fragment>`)},e.customProgramCacheKey=()=>`gelatin-`+n}function mn(){let t=new pe(1,4);t.deleteAttribute(`normal`),t.deleteAttribute(`uv`),t=A(t);let n=t.attributes.position,r=new e;for(let e=0;e<n.count;e++){r.fromBufferAttribute(n,e);let t=q(r.x*1.4+3,r.z*1.4+r.y*.7,5,21),i=Math.abs(q(r.x*3.1,r.y*3.1+r.z,3,5));r.multiplyScalar(1+.38*t-.12*i),r.y<-.2&&(r.y=-.2+(r.y+.2)*.4),n.setXYZ(e,r.x,r.y,r.z)}return t.computeVertexNormals(),t}function hn(e,t){let n=[];for(let r=0;r<e*6&&n.length<e;r++){let r=t()*Math.PI*2,i=150;for(;i<700&&J(Math.cos(r)*i,Math.sin(r)*i)>0;)i+=4;i+=(t()-.6)*40;let a=Math.cos(r)*i,o=Math.sin(r)*i,s=J(a,o);if(s<-5||s>6)continue;let c=1.5+t()**2.2*9;n.push({x:a,z:o,y:s-c*.15,s:c});for(let r=0;r<3&&n.length<e;r++){let e=a+(t()-.5)*c*4,r=o+(t()-.5)*c*4,i=c*(.25+t()*.35);n.push({x:e,z:r,y:J(e,r)-i*.2,s:i})}}return n}function gn({sky:t,caustics:n,floatShadow:r,water:a,absorption:s,reflectionLayer:c=1}){let l={...r,...Object.fromEntries([`uShore`,`uTravel`,`uShoreExtent`,`uTime`,`uShoreWave`,`uSwellDir`].map(e=>[e,a[e]])),...n,uSkyCube:{value:t.cube},uAbsorption:{value:s},uSunDirT:{value:t.sunDir},uSunShadowMatrix:{value:new D},uCausticStrength:{value:1},uFogDensity:{value:1/18e3}},{geometry:u}=Ut(384),f=new o({roughness:.92,metalness:0,envMapIntensity:.9});pn(f,l,`terrain`);let p=new d(u,f);p.castShadow=p.receiveShadow=!0;let m=7,h=()=>(m=Math.imul(m,1664525)+1013904223>>>0)/4294967296,_=hn(90,h),y=new o({roughness:.85,metalness:0,envMapIntensity:.9});pn(y,l,`rock`);let b=new i(mn(),y,_.length),ee=new D,x=new v,S=new fe,te=new e;_.forEach((t,n)=>{S.set(h()*.6,h()*Math.PI*2,h()*.6),te.set(t.s*(.8+h()*.6),t.s*(.5+h()*.5),t.s*(.8+h()*.6)),ee.compose(new e(t.x,t.y,t.z),x.setFromEuler(S),te),b.setMatrixAt(n,ee)}),b.computeBoundingSphere(),b.castShadow=b.receiveShadow=!0;let C=new g;C.add(p,b);for(let e of[p,b])e.layers.enable(c);return{group:C,uniforms:l,patchProp:e=>pn(e,l,`prop`)}}var _n=new e(0,1,0),vn=new e,yn=new e,bn=new e,xn=new D,X=new n,Z=new E,Sn=new E,Cn=class{constructor(e=1){this.camera=new he,this.camera.layers.set(e),this.textureMatrix=new D,this.target=new M(1,1,{type:r,generateMipmaps:!0,minFilter:O}),this.scale=.5}setSize(e,t){this.target.setSize(Math.max(1,Math.floor(e*this.scale)),Math.max(1,Math.floor(t*this.scale)))}render(e,t,n){let r=this.camera;vn.setFromMatrixPosition(n.matrixWorld),xn.extractRotation(n.matrixWorld),yn.set(0,0,-1).applyMatrix4(xn).add(vn),bn.set(yn.x,-yn.y,yn.z),r.position.set(vn.x,-vn.y,vn.z),r.up.set(0,1,0).applyMatrix4(xn).reflect(_n),r.lookAt(bn),r.far=n.far,r.updateMatrixWorld(),r.projectionMatrix.copy(n.projectionMatrix),this.textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(r.projectionMatrix).multiply(r.matrixWorldInverse),X.setFromNormalAndCoplanarPoint(_n,bn.set(0,0,0)).applyMatrix4(r.matrixWorldInverse),Z.set(X.normal.x,X.normal.y,X.normal.z,X.constant);let i=r.projectionMatrix.elements;Sn.set((Math.sign(Z.x)+i[8])/i[0],(Math.sign(Z.y)+i[9])/i[5],-1,(1+i[10])/i[14]),Z.multiplyScalar(2/Z.dot(Sn)),i[2]=Z.x,i[6]=Z.y,i[10]=Z.z+1,i[14]=Z.w,r.projectionMatrixInverse.copy(r.projectionMatrix).invert(),e.setRenderTarget(this.target),e.setClearColor(0,0),e.clear(!0,!0,!1),e.render(t,r)}},wn=6,Tn=32,En=`
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`,Dn=`
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
`,On=`
uniform sampler2D tSrc;
uniform vec2 uTexel; // source texel size
#ifdef PREFILTER
uniform vec4 uCurve; // threshold-knee, 2*knee, 0.25/knee, threshold
uniform float uClamp;
#endif

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 tap(vec2 o) {
  vec3 c = texture(tSrc, vUv + o * uTexel).rgb;
#ifdef PREFILTER
  c = max(c, 0.0); // negatives (and NaN on most GPUs) -> 0
  float l = max(luma(c), 1e-4);
  c *= min(1.0, uClamp / l);
  l = min(l, uClamp);
  float q = clamp(l - uCurve.x, 0.0, uCurve.y);
  c *= max(uCurve.z * q * q, l - uCurve.w) / l;
#endif
  return c;
}

void main() {
  vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0, 0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0)), h = tap(vec2(0.0, -2.0)), i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0)), l = tap(vec2(-1.0, -1.0)), m = tap(vec2(1.0, -1.0));
  vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25;
  vec3 g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25;
  vec3 g4 = (j + k + l + m) * 0.25;
#ifdef PREFILTER
  float w0 = 0.125 / (1.0 + luma(g0)), w1 = 0.125 / (1.0 + luma(g1));
  float w2 = 0.125 / (1.0 + luma(g2)), w3 = 0.125 / (1.0 + luma(g3));
  float w4 = 0.5 / (1.0 + luma(g4));
  vec3 r = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
#else
  vec3 r = g4 * 0.5 + (g0 + g1 + g2 + g3) * 0.125;
#endif
  fragColor = vec4(r, 1.0);
}`,kn=`
uniform sampler2D tSrc;
uniform vec2 uTexel; // source (coarser) texel size
void main() {
  vec4 d = uTexel.xyxy * vec4(1.0, 1.0, -1.0, 0.0);
  vec3 s = texture(tSrc, vUv - d.xy).rgb + texture(tSrc, vUv - d.wy).rgb * 2.0 + texture(tSrc, vUv - d.zy).rgb
    + texture(tSrc, vUv + d.zw).rgb * 2.0 + texture(tSrc, vUv).rgb * 4.0 + texture(tSrc, vUv + d.xw).rgb * 2.0
    + texture(tSrc, vUv + d.zy).rgb + texture(tSrc, vUv + d.wy).rgb * 2.0 + texture(tSrc, vUv + d.xy).rgb;
  fragColor = vec4(s * (1.0 / 16.0), 1.0);
}`,An=`
uniform sampler2D tSrc;
uniform vec2 uJitter; // [0,1)^2
void main() {
  float s = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 o = (vec2(float(i), float(j)) + uJitter) * 0.25 - 0.5;
    vec3 c = max(texture(tSrc, vUv + o * ${(1/Tn).toFixed(8)}).rgb, 0.0);
    s += log2(clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4, 64.0));
  }
  fragColor = vec4(s * (1.0 / 16.0), 0.0, 0.0, 1.0);
}`,jn=`
uniform sampler2D tSrc;  // metering target, linear filtered
uniform sampler2D tPrev; // previous 1x1 state
uniform vec2 uK;         // blend factor when scene brightens (x) / darkens (y); 1 = snap
uniform vec2 uRange;     // allowed log2 luminance range (from min/max exposure)
void main() {
  float sum = 0.0;
  for (int j = 0; j < 16; j++) for (int i = 0; i < 16; i++)
    sum += texture(tSrc, (vec2(float(i), float(j)) + 0.5) * (1.0 / 16.0)).r;
  float t = clamp(sum * (1.0 / 256.0), uRange.x, uRange.y);
  float prev = texelFetch(tPrev, ivec2(0), 0).r;
  float k = t > prev ? uK.x : uK.y;
  float s = k >= 1.0 ? t : prev + (t - prev) * k;
  if (isnan(s)) s = t;
  fragColor = vec4(s, 0.0, 0.0, 1.0);
}`,Mn=`
uniform sampler2D tHdr;
uniform sampler2D tBloom;
uniform sampler2D tExp;   // 1x1 adapted log2 average luminance
uniform float uExposure;  // exposure compensation (auto) or absolute exposure
uniform float uAuto;      // 1 = auto exposure
uniform vec3 uExpo;       // keyValue, minExposure, maxExposure
uniform float uBloom;
uniform vec2 uLook;       // AgX look: power (contrast), saturation
uniform float uFrame;     // 0..255, dither seed
uniform float uDroplets;  // 0..1
uniform float uTime;      // seconds, wraps at 4096
uniform float uAspect;    // width / height
uniform float uResY;      // height in pixels

const mat3 SRGB_TO_REC2020 = mat3(
  vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
const mat3 REC2020_TO_SRGB = mat3(
  vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
const mat3 AGX_INSET = mat3(
  vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
  vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
  vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
const mat3 AGX_OUTSET = mat3(
  vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
  vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
  vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
const float AGX_MIN_EV = -12.47393;
const float AGX_MAX_EV = 4.026069;

vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

vec3 agx(vec3 c) {
  c = AGX_INSET * (SRGB_TO_REC2020 * c);
  c = clamp((log2(max(c, 1e-10)) - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV), 0.0, 1.0);
  c = agxContrast(c);
  // AgX "punchy"-style look in the encoded domain
  c = pow(max(c, 0.0), vec3(uLook.x));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = l + uLook.y * (c - l);
  c = AGX_OUTSET * c;
  return clamp(REC2020_TO_SRGB * pow(max(c, 0.0), vec3(2.2)), 0.0, 1.0);
}

// Dave Hoskins hash without sine
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// ---- lens droplets (only evaluated when uDroplets > 0) -----------------------------------------
// All lengths are in screen-height units (p = vUv * vec2(aspect, 1)). Each drop is a tiny lens: the
// image under it is sampled from the mirrored side of its centre, sample = centre - (K-1) * d, so it
// looks inverted and slightly magnified, with a faint dark rim.
const float DROP_K = 1.8;

// d: pixel - drop centre, r: radius. Returns (uv offset, darkening).
vec3 lensDrop(vec2 d, float r) {
  float dist = length(d);
  float cov = clamp((r - dist) * uResY + 0.5, 0.0, 1.0); // 1px AA
  if (cov <= 0.0) return vec3(0.0);
  return vec3(-d * DROP_K * cov, 0.22 * smoothstep(0.6, 1.0, dist / r) * cov);
}

// One drop (at most) per grid cell, kept inside its cell so only the own cell is tested.
vec3 dropLayer(vec2 p, float scale, float density, float seed) {
  vec2 q = p * scale + seed * 17.31;
  vec2 id = floor(q);
  vec3 h = hash33(vec3(id, seed)), g = hash33(vec3(id + 57.0, seed));
  if (h.x > density) return vec3(0.0);
  float fade = clamp((uDroplets - g.x * 0.8) * 6.0, 0.0, 1.0); // drops dry up one by one (order = g.x)
  float rf = mix(0.10, 0.24, h.y * h.y);                          // radius, cell units
  vec2 c = rf + vec2(h.z, g.y) * (1.0 - 2.0 * rf);
  return lensDrop((fract(q) - c) / scale, rf * fade / scale);
}

// A drop sliding down the lens, leaving a thin wet trail above it. speed in cycles/s.
// Head enters above the screen and leaves below with its trail fully off-screen, so the wrap never pops.
vec3 streak(vec2 p, float id, float speed, float amp) {
  const float R = 0.016, L = 0.45, W = 0.0035;
  float u = uTime * speed + id * 0.37;
  float cyc = mod(floor(u), 128.0), f = fract(u);
  f += 0.012 * sin(f * 47.0); // stick-slip
  vec3 h = hash33(vec3(id, cyc, 5.1));
  float x0 = (0.08 + 0.84 * h.x) * uAspect;
  float hy = mix(1.0 + R, -R - L, f);
  float hx = x0 + 0.006 * sin(hy * 14.0 + h.y * 6.28);
  vec3 o = lensDrop(p - vec2(hx, hy), R * amp);
  float ty = p.y - hy;
  if (ty > 0.0 && ty < L) {
    float a = smoothstep(0.0, 0.03, ty) * (1.0 - ty / L) * amp;
    float tx = (p.x - x0 - 0.006 * sin(p.y * 14.0 + h.y * 6.28)) / W;
    float cov = clamp((1.0 - abs(tx)) * W * uResY + 0.5, 0.0, 1.0) * a;
    o += vec3(-tx * W * DROP_K * cov, 0.0, 0.12 * smoothstep(0.5, 1.0, abs(tx)) * cov);
  }
  return o;
}

// Returns (uv offset, darkening).
vec3 droplets() {
  vec2 p = vUv * vec2(uAspect, 1.0);
  float sa = smoothstep(0.0, 0.4, uDroplets);
  vec3 a = dropLayer(p, 6.0, 0.30, 0.0) + dropLayer(p, 10.0, 0.20, 1.0) + dropLayer(p, 17.0, 0.06, 2.0)
    + streak(p, 0.0, 0.0625, sa) + streak(p, 1.0, 0.03125, sa);
  return vec3(a.xy / vec2(uAspect, 1.0), min(a.z, 0.5));
}

void main() {
  float ex = uExposure;
  if (uAuto > 0.5) ex *= clamp(uExpo.x * exp2(-texelFetch(tExp, ivec2(0), 0).r), uExpo.y, uExpo.z);

  vec2 uv = vUv;
  float dark = 0.0;
  if (uDroplets > 0.001) {
    vec3 dr = droplets();
    uv += dr.xy;
    dark = dr.z;
  }

  vec3 c = (texture(tHdr, uv).rgb + texture(tBloom, uv).rgb * uBloom) * (ex * (1.0 - dark));
  vec2 d = (vUv - 0.5) * 1.41421356; // |d|^2 = 1 at corners
  c = agx(c) * (1.0 - 0.08 * dot(d, d));
  vec3 o = mix(pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));

  // TPDF dither, +-1/255, after sRGB encoding and before the 8-bit store
  vec3 n = hash33(vec3(gl_FragCoord.xy, uFrame)) + hash33(vec3(gl_FragCoord.xy, uFrame + 17.0));
  fragColor = vec4(o + (n - 1.0) * (1.0 / 255.0), 1.0);
}`,Q=(e,t,n={},r={})=>new u({glslVersion:P,vertexShader:En,fragmentShader:Dn+e,uniforms:t,defines:n,depthTest:!1,depthWrite:!1,...r}),Nn=class{params={exposure:1,autoExposure:!0,keyValue:.18,adaptUp:2.5,adaptDown:1,minExposure:.05,maxExposure:20,bloomStrength:.06,bloomThreshold:1,bloomClamp:64,contrast:1.12,saturation:1.3,droplets:0};constructor(t){this.renderer=t,this.geometry=new T,this.geometry.setAttribute(`position`,new me([-1,-1,0,3,-1,0,-1,3,0],3)),this.mesh=new d(this.geometry),this.mesh.frustumCulled=!1,this.camera=new h(-1,1,1,-1,0,1);let n=()=>({tSrc:{value:null},uTexel:{value:null}});this.matPre=Q(On,{...n(),uCurve:{value:new E},uClamp:{value:64}},{PREFILTER:1}),this.matDown=Q(On,n()),this.matUp=Q(kn,n(),{},{blending:5,blendEquation:100,blendSrc:201,blendDst:201}),this.matMeter=Q(An,{tSrc:{value:null},uJitter:{value:new m}}),this.matAdapt=Q(jn,{tSrc:{value:null},tPrev:{value:null},uK:{value:new m(1,1)},uRange:{value:new m(-8,4)}}),this.matComp=Q(Mn,{tHdr:{value:null},tBloom:{value:null},tExp:{value:null},uExposure:{value:1},uAuto:{value:1},uExpo:{value:new e(.18,.05,20)},uBloom:{value:0},uLook:{value:new m(1,1)},uFrame:{value:0},uDroplets:{value:0},uTime:{value:0},uAspect:{value:1},uResY:{value:1}}),this.levels=[],this.texel=[new m];for(let e=0;e<wn;e++)this.levels.push(new M(1,1,{type:r,format:b,minFilter:p,magFilter:p,wrapS:j,wrapT:j,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1})),this.texel.push(new m);this.meterRT=new M(Tn,Tn,{type:r,format:b,minFilter:p,magFilter:p,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1});let i=t.extensions.has(`EXT_color_buffer_float`);this.adapt=[0,1].map(()=>new M(1,1,{type:i?w:r,format:b,minFilter:c,magFilter:c,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1})),this._cur=0,this._snap=!0,this._frame=0,this._time=0;let a=t.getDrawingBufferSize(new m);this.setSize(a.x,a.y)}setSize(e,t){let n=Math.max(1,Math.floor(e)),r=Math.max(1,Math.floor(t));this.matComp.uniforms.uAspect.value=n/r,this.matComp.uniforms.uResY.value=r,this._snap=!0,this.texel[0].set(1/n,1/r);for(let e=0;e<wn;e++)n=Math.max(1,Math.floor(n/2)),r=Math.max(1,Math.floor(r/2)),this.levels[e].setSize(n,r),this.texel[e+1].set(1/n,1/r)}_pass(e,t){this.mesh.material=e,this.renderer.setRenderTarget(t),this.renderer.render(this.mesh,this.camera)}_blit(e,t,n,r){e.uniforms.tSrc.value=t,e.uniforms.uTexel.value=n,this._pass(e,r)}_meterExposure(e,t){let n=this.params,r=this.matMeter.uniforms,i=this.matAdapt.uniforms,a=this._frame;r.tSrc.value=e,r.uJitter.value.set(a*.7548776662466927%1,a*.5698402909980532%1),this._pass(this.matMeter,this.meterRT);let o=Math.max(n.keyValue,1e-4),s=Math.max(Math.min(n.minExposure,n.maxExposure),1e-4),c=Math.max(n.minExposure,n.maxExposure,1e-4);i.tSrc.value=this.meterRT.texture,i.tPrev.value=this.adapt[this._cur].texture,i.uK.value.set(this._snap?1:1-Math.exp(-t*n.adaptUp),this._snap?1:1-Math.exp(-t*n.adaptDown)),i.uRange.value.set(Math.log2(o/c),Math.log2(o/s)),this._cur^=1,this._pass(this.matAdapt,this.adapt[this._cur]),this._snap=!1}render(e,t=1/60){let n=this.renderer,r=this.params,i=this.levels,a=this.texel;t=t>0?Math.min(t,1):0,this._frame=this._frame+1&255,this._time=(this._time+t)%4096;let o=n.getRenderTarget(),s=n.autoClear,c=n.info.autoReset;n.autoClear=!1,n.info.autoReset=!1,r.autoExposure?this._meterExposure(e,t):this._snap=!0;let l=r.bloomThreshold,u=Math.max(l*.5,1e-4),d=this.matPre.uniforms;d.uCurve.value.set(l-u,2*u,.25/u,l),d.uClamp.value=r.bloomClamp,this._blit(this.matPre,e,a[0],i[0]);for(let e=1;e<wn;e++)this._blit(this.matDown,i[e-1].texture,a[e],i[e]);for(let e=4;e>=0;e--)this._blit(this.matUp,i[e+1].texture,a[e+2],i[e]);let f=this.matComp.uniforms;f.tHdr.value=e,f.tBloom.value=i[0].texture,f.tExp.value=this.adapt[this._cur].texture,f.uExposure.value=r.exposure,f.uAuto.value=+!!r.autoExposure,f.uExpo.value.set(r.keyValue,Math.min(r.minExposure,r.maxExposure),Math.max(r.minExposure,r.maxExposure)),f.uLook.value.set(r.contrast,r.saturation),f.uBloom.value=r.bloomStrength,f.uFrame.value=this._frame,f.uDroplets.value=Math.min(Math.max(r.droplets,0),1),f.uTime.value=this._time,this._pass(this.matComp,null),n.setRenderTarget(o),n.autoClear=s,n.info.autoReset=c}dispose(){for(let e of this.levels)e.dispose();this.meterRT.dispose();for(let e of this.adapt)e.dispose();for(let e of[this.matPre,this.matDown,this.matUp,this.matMeter,this.matAdapt,this.matComp])e.dispose();this.geometry.dispose()}},Pn=`
precision highp float;
${Le}
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform samplerCube uSkyCube;
uniform float uSkyMaxLod;
uniform vec3 uSpray;        // amount, size, max distance
out vec2 vUv;
out float vAlpha;
out vec3 vLight;
out float vSeed;
out float vViewZ;

// camera-facing quad of the given size at p; droplets: strong forward scattering of the
// sun + sky ambient
void billboard(vec3 p, float size) {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec4 view = viewMatrix * vec4(p + (right * position.x + up * position.y) * size, 1.0);
  gl_Position = projectionMatrix * view;
  vViewZ = -view.z;
  vUv = position.xy;
  float mu = dot(normalize(p - cameraPosition), uSunDir);
  const float g = 0.6;
  float phase = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 sky = textureLod(uSkyCube, vec3(0.0, 1.0, 0.0), uSkyMaxLod).rgb;
  vLight = 0.9 * (uSunColor * (0.25 + 1.6 * phase) + sky * 1.1);
}
`,Fn=Pn+`
in vec4 aEmit;              // emitter xz, two randoms

void main() {
  vAlpha = 0.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // dead instances fall outside the clip volume
  vec2 e = aEmit.xy;
  float r1 = aEmit.z, r2 = aEmit.w;
  vec2 toE = e - cameraPosition.xz;
  if (dot(toE, toE) > uSpray.z * uSpray.z) return;

  Shore s = shoreWaves(e, shoreSample(e));
  float a = s.wave0.x, k = s.wave0.y, w = s.wave0.z;
  float strength = s.breaking0 * smoothstep(0.08, 0.35, a);
  if (strength <= 0.01) return;
  // seconds since the crest passed this emitter, staggered per particle
  float psi = mod(s.wave0.w + PI, 2.0 * PI) - PI;
  float age = psi / w - r1 * 0.3;
  float life = 0.9 + 1.5 * r2;
  if (age < 0.0 || age > life) return;

  // thrown with the crest (towards the beach) and up, slowed by air drag
  const float KD = 1.7, G = 9.81;
  float ex = (1.0 - exp(-KD * age)) / KD;
  float c = w / k;
  vec2 side = vec2(-s.dir.y, s.dir.x) * (fract(r1 * 31.7) - 0.5) * 1.6;
  vec2 xz = e + side + s.dir * c * (0.25 + 0.45 * fract(r2 * 17.3)) * ex;
  float vy = (1.2 + 3.2 * fract(r1 * 7.9)) * sqrt(a);
  float y = 1.1 * a + (vy + G / KD) * ex - G * age / KD;
  if (y < -0.3) return;

  float size = (0.1 + 0.6 * age) * (0.6 + 0.8 * fract(r2 * 5.3)) * uSpray.y * sqrt(a / 0.5);
  billboard(vec3(xz.x, y, xz.y), size);
  vSeed = r1;
  vAlpha = strength * uSpray.x * smoothstep(0.0, 0.12, age) * pow(1.0 - age / life, 1.5)
         * smoothstep(-0.3, 0.2, y) * smoothstep(uSpray.z, uSpray.z * 0.7, sqrt(dot(toE, toE)))
         * smoothstep(2.5, 10.0, vViewZ);   // no giant blobs on the lens
}`,In=Pn+`
void main() {
  vAlpha = 0.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vec4 e = uImpact[gl_InstanceID % 8];
  float L = uImpactSize[gl_InstanceID % 8];
  float r1 = hash12(vec2(float(gl_InstanceID), 1.7)), r2 = hash12(vec2(float(gl_InstanceID), 8.3));
  float r3 = hash12(vec2(float(gl_InstanceID), 4.1));
  float life = 0.5 + 1.1 * r2;
  float age = e.z;
  if (e.w <= 0.0 || age > life) return;
  const float KD = 1.2, G = 9.81;
  float ex = (1.0 - exp(-KD * age)) / KD;
  float ang = r1 * 2.0 * PI;
  vec2 out_ = vec2(cos(ang), sin(ang));
  float strength = sqrt(e.w / 0.2);
  float vy = (1.5 + 4.0 * r3 * r3) * strength;
  vec2 xz = e.xy + out_ * (L * (0.6 + 0.5 * r2) + (0.5 + 2.0 * r3) * strength * ex);
  float y = (vy + G / KD) * ex - G * age / KD;
  if (y < -0.2) return;
  billboard(vec3(xz.x, y, xz.y), (0.05 + 0.25 * age) * (0.5 + r2) * uSpray.y);
  vSeed = r1;
  vAlpha = uSpray.x * 0.6 * smoothstep(0.0, 0.05, age) * pow(1.0 - age / life, 1.5)
         * smoothstep(-0.2, 0.1, y) * smoothstep(1.0, 4.0, vViewZ);
}`,Ln=`
precision highp float;
uniform sampler2D uSceneDepth;
uniform sampler2D uFoamTex;
uniform vec2 uResolution;
uniform vec2 uNearFar;
in vec2 vUv;
in float vAlpha;
in vec3 vLight;
in float vSeed;
in float vViewZ;
out vec4 fragColor;

void main() {
  float r = length(vUv);
  if (vAlpha <= 0.0 || r > 1.0) discard;
  // soft gaussian puff, broken up only at low frequency so it reads as mist
  float n = texture(uFoamTex, vUv * 0.08 + vSeed * 17.0).r;
  float a = vAlpha * exp(-3.5 * r * r) * (0.5 + n);
  // soft against the opaque scene (the water surface itself is handled by the depth test)
  float d = texelFetch(uSceneDepth, ivec2(gl_FragCoord.xy), 0).r * 2.0 - 1.0;
  float sceneZ = 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - d * (uNearFar.y - uNearFar.x));
  a *= clamp((sceneZ - vViewZ) / 0.8, 0.0, 1.0);
  fragColor = vec4(vLight * a, a);
}`;function Rn(e,t){let{data:n,size:r,extent:i}=e,a=new Float32Array(t*4),o=11,s=0,c=()=>(o=Math.imul(o,1664525)+1013904223>>>0)/4294967296;for(let e=0;s<t&&e<t*400;e++){let e=Math.floor(c()*r),t=Math.floor(c()*r),o=(t*r+e)*4,l=-n[o],u=n[o+1];l<.3||l>3.2||u>150||(a.set([((e+c())/r-.5)*i,((t+c())/r-.5)*i,c(),c()],s*4),s++)}return{data:a.subarray(0,s*4),count:s}}function zn(e){let t=new a;return t.setAttribute(`position`,new me([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3)),t.setIndex([0,1,2,0,2,3]),t.instanceCount=e,t}var Bn=class{constructor(t,n,r=15e4){let i=Rn(n,r),a=zn(i.count);a.setAttribute(`aEmit`,new _(i.data,4)),this.params={amount:1,size:1,distance:350},this.uniforms={...t.uniforms,uSpray:{value:new e}};let o=e=>new S({glslVersion:P,vertexShader:e,fragmentShader:Ln,uniforms:this.uniforms,transparent:!0,depthWrite:!1,blending:5,blendSrc:201,blendDst:205,blendSrcAlpha:200,blendDstAlpha:201});this.mesh=new d(a,o(Fn)),this.mesh.frustumCulled=!1,this.splash=new d(zn(1280),o(In)),this.splash.frustumCulled=!1}update(){let e=this.params;this.uniforms.uSpray.value.set(e.amount,e.size,e.distance),this.mesh.visible=this.splash.visible=e.amount>0}},Vn=1,$={bearing:0,back:7,sun:{elevation:38,azimuth:222,cloudCoverage:.5},spray:.15,exposure:.123},Hn={home:{aspect:16/9,cam:[-1.25,1.3,4.5],target:[0,1,0],fov:33,filmOffset:-7},phone:{aspect:9/16,cam:[-.6,1.3,2.35],target:[-.14,.95,0],fov:56,filmOffset:0}};function Un(n,{msaa:i=4,reflections:a=!0,reflectionScale:o=.5,shadowSize:s=4096,powerPreference:c=`high-performance`}={}){let l=new ce({canvas:n,antialias:!1,depth:!1,stencil:!1,alpha:!1,powerPreference:c});l.autoClear=!1,l.shadowMap.enabled=!0,l.shadowMap.type=1,l.shadowMap.autoUpdate=!1;let u=new he(40,16/9,.1,8e4),d=new Lt(l),f=ut(J,1800,512),p=pt(l),h=new Ee(l,Te()),_=new nn(l,h),v=new Oe(2048),y=new Be(h,f,d,v.uniforms);y.uniforms.uFoamTex.value=p.foam;let b=y.uniforms,x=new ee;x.environment=d.cube,x.add(d.background);let S=gn({sky:d,caustics:_.uniforms,floatShadow:v.uniforms,water:b,absorption:b.uAbsorption.value,reflectionLayer:Vn});x.add(S.group);let C=new te(16777215,Math.PI);C.castShadow=!0,C.shadow.mapSize.set(s,s),Object.assign(C.shadow.camera,{left:-900,right:900,top:900,bottom:-900,near:10,far:5e3}),C.shadow.bias=-4e-4,C.shadow.normalBias=.6,x.add(C,C.target),b.uShadowMatrix.value=S.uniforms.uSunShadowMatrix.value=C.shadow.matrix,b.uShadowBias.value=.05/(C.shadow.camera.far-C.shadow.camera.near);let T=new g;x.add(T);let E=new ee,re=[],oe=!0,D=new Cn(Vn);b.uReflMatrix.value=D.textureMatrix;let O=new ae(new Uint8Array(4),1,1);O.needsUpdate=!0;let se=new ee,k=new Bn(y,f);k.params.amount=$.spray,se.add(y.mesh,k.mesh,k.splash);let A=new Nn(l);A.params.bloomStrength=.05,A.params.bloomThreshold=1.5,A.params.autoExposure=!1,A.params.exposure=$.exposure;let j={msaa:i,reflections:a,reflectionScale:o},N=null;function fe(e,t,n){l.setPixelRatio(n),l.setSize(e,t,!1);let i=l.getDrawingBufferSize(new m);N?.dispose(),N=new M(i.x,i.y,{type:r,samples:j.msaa,generateMipmaps:!1,depthTexture:new ie(i.x,i.y,w)}),b.uSceneColor.value=N.texture,b.uSceneDepth.value=N.depthTexture,b.uResolution.value.copy(i),D.scale=j.reflectionScale,D.setSize(i.x,i.y),A.setSize(i.x,i.y)}function pe(){Object.assign(d.params,$.sun),d.update(),C.position.copy(d.sunDir).multiplyScalar(2e3),C.color.setRGB(d.sunColor.x,d.sunColor.y,d.sunColor.z).multiplyScalar(1/Math.max(d.sunColor.x,1e-4)),C.intensity=Math.PI*Math.max(d.sunColor.x,1e-4),l.shadowMap.needsUpdate=!0,oe=!0}let P=new le;function me(t,n){P.set(new e(t,500,n),new e(0,-1,0));let r=P.intersectObject(S.group.children[0],!1)[0];return r?r.point.y:J(t,n)}let ge=t.degToRad($.bearing),F=new m(Math.cos(ge),Math.sin(ge)),I=100;for(;I<900&&J(F.x*I,F.y*I)>1.6;)I+=.5;let L={x:F.x*(I-$.back),z:F.y*(I-$.back)},R=Hn.home,_e=Math.atan2(R.target[2]-R.cam[2],R.target[0]-R.cam[0]);T.rotation.y=_e-Math.atan2(F.y,F.x),T.position.set(L.x,me(L.x,L.z),L.z),T.updateMatrixWorld(!0);async function z(t){let n=(await new de().loadAsync(t)).scene;n.traverse(e=>{if(e.isMesh){e.castShadow=!1,e.receiveShadow=!0,e.layers.enable(Vn);for(let t of[].concat(e.material))t.isMeshStandardMaterial&&S.patchProp(t)}}),T.add(n),T.updateMatrixWorld(!0);let r=n.clone();r.matrixAutoUpdate=!1,r.matrix.copy(n.matrixWorld),E.add(r),re.push({pos:new ne().setFromObject(n).getCenter(new e),radius:1.6}),oe=!0}function ve(t,n){let r=Hn[t];u.position.copy(T.localToWorld(new e(...r.cam))),u.fov=r.fov,u.filmGauge=35,u.filmOffset=r.filmOffset,u.aspect=n??r.aspect,u.updateProjectionMatrix(),u.lookAt(T.localToWorld(new e(...r.target))),u.updateMatrixWorld(!0)}function ye(t){let n=T.localToWorld(new e(...t)).project(u);return[(n.x+1)/2,(1-n.y)/2]}let B=0;function V(e,t=40){let n=1/30;B=e-t*n;for(let e=0;e<t;e++)h.update(n),B+=n}function be(e){B+=e,oe&&=(v.update(l,E,re,d.sunDir),!1),h.update(e),_.update(d.sunDir),y.update(u,B%3600),k.update(),j.reflections?(D.render(l,x,u),b.uReflection.value=D.target.texture):b.uReflection.value=O,l.setRenderTarget(N),l.setClearColor(0,1),l.clear(!0,!0,!1),l.render(x,u),b.uShadowMap.value=C.shadow.map.depthTexture,b.uCamSide.value=-1,N.resolveDepthBuffer=!1,l.render(se,u),N.resolveDepthBuffer=!0,A.render(N.texture,e)}async function xe(){await l.compileAsync(x,u),await l.compileAsync(se,u,x)}return pe(),{THREE:ue,renderer:l,camera:u,scene:x,sky:d,surface:y,post:A,quality:j,desk:T,setSize:fe,setShot:ve,project:ye,loadProps:z,warmUp:V,render:be,compile:xe}}function Wn(){try{let e=document.createElement(`canvas`).getContext(`webgl2`),t=!!e&&!!e.getExtension(`EXT_color_buffer_float`);return e?.getExtension(`WEBGL_lose_context`)?.loseContext(),t}catch{return!1}}async function Gn({stage:e,shot:t,active:n,propsUrl:r,small:i=!1}){let a=document.createElement(`canvas`);a.className=`home-live`,a.setAttribute(`aria-hidden`,`true`);let o;try{o=Un(a,{msaa:i?2:4,reflectionScale:i?.35:.5,shadowSize:i?2048:4096}),await o.loadProps(r)}catch(e){return console.warn(`beach: not started`,e),o?.renderer.dispose(),null}let s=Math.min(devicePixelRatio||1,i?1:1.5),c=i?Math.min(s,.8):Math.min(s,1),l=null;function u(){let n=Math.max(1,e.clientWidth),r=Math.max(1,e.clientHeight),i=Math.min(c,Math.sqrt(26e5/(n*r)));o.setSize(n,r,i);let a=t();o.setShot(a,n/r),l=a}u(),e.append(a);try{await o.compile()}catch{}o.warmUp(12);let d=0,f=0,p=!1,m=!1,h=[];function g(e){if(d=0,m||!n())return;let r=f?Math.min((e-f)/1e3,.1):1/60;if(f=e,t()!==l&&u(),o.render(r),p||(p=!0,requestAnimationFrame(()=>a.classList.add(`is-ready`))),h.push(r),h.length===150){let e=h.slice(30).reduce((e,t)=>e+t,0)/120;if(h.length=0,e>1/30){if(c>.55)c=Math.max(.5,c*.75),o.quality.reflections=c>.6,u();else if(e>1/20)return v()}}d=requestAnimationFrame(g)}function _(){m||d||!n()||(f=0,d=requestAnimationFrame(g))}function v(){return m=!0,d&&cancelAnimationFrame(d),a.classList.remove(`is-ready`),setTimeout(()=>{a.remove(),o.renderer.dispose()},600),null}return new ResizeObserver(()=>{m||(u(),_())}).observe(e),_(),{resume:_,stop:v}}export{Gn as start,Wn as supported};