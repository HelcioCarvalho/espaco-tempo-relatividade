import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';

export const INK = new THREE.Color('#1e2026');
const PAPER = new THREE.Color('#f6f3ec');
export const LIGHT_DIR = new THREE.Vector3(-0.55, 1, 0.45).normalize();

/* Todos os LineMaterial precisam saber o tamanho da tela. */
const lineMats = new Set();
export function setLineResolution(w, h) { for (const m of lineMats) m.resolution.set(w, h); }
const hatchMats = new Set();
export function setHatchScale() {}

const vertexShader = /* glsl */`
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
void main() {
  vP = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/* Sombreado de caneta: riscos presos à superfície do objeto (não à tela).
   Quanto mais escura a face, mais camadas de riscos. */
const fragmentShader = /* glsl */`
uniform vec3 uLight;
uniform vec3 uColor;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uGlow;
uniform vec3 uDir1;
uniform vec3 uDir2;
uniform float uFreq;
uniform float uGlowAmt;
uniform float uOpacity;
uniform float uRim;
uniform float uHatch;
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
float stripe(float v, float w) {
  float d = abs(fract(v) - 0.5);
  float aa = fwidth(v);
  float s = smoothstep(0.5 - w - aa, 0.5 - w + aa, d);
  return s * (1.0 - smoothstep(0.3, 0.6, aa));
}
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vW);
  float shade = clamp(dot(n, uLight), 0.0, 1.0) * 0.75 + 0.25;
  float h1 = stripe(dot(vP, uDir1) * uFreq, 0.1) * (1.0 - smoothstep(0.58, 0.74, shade));
  float h2 = stripe(dot(vP, uDir2) * uFreq * 1.1, 0.09) * (1.0 - smoothstep(0.36, 0.5, shade));
  float ink = max(h1, h2) * uHatch;
  float rim = (1.0 - smoothstep(0.04, 0.22, abs(dot(n, v)))) * uRim;
  vec3 col = mix(uColor, uPaper, 0.82) * (0.82 + 0.18 * shade);
  col = mix(col, uInk, max(ink * 0.8, rim));
  col += uGlow * uGlowAmt;
  float a = clamp(uOpacity + max(ink, rim) * (1.0 - uOpacity), 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}`;

const DIRS = {
  d: [new THREE.Vector3(0.8, 0.6, 0.35).normalize(), new THREE.Vector3(-0.6, 0.75, 0.5).normalize()],
  v: [new THREE.Vector3(1, 0, 0.35).normalize(), new THREE.Vector3(0, 1, 0)],
};
export function hatchMat({ color = '#f3ecdd', glow = '#000000', glowAmt = 0, opacity = 1, side = THREE.FrontSide, rim = 0, hatch = 1, dir = 'd', freq = 62 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: LIGHT_DIR }, uColor: { value: new THREE.Color(color) }, uPaper: { value: PAPER }, uInk: { value: INK },
      uGlow: { value: new THREE.Color(glow) }, uGlowAmt: { value: glowAmt }, uOpacity: { value: opacity },
      uRim: { value: rim }, uHatch: { value: hatch }, uDir1: { value: DIRS[dir][0] }, uDir2: { value: DIRS[dir][1] }, uFreq: { value: freq },
    },
    vertexShader, fragmentShader, side,
    transparent: opacity < 1, depthWrite: opacity >= 1,
  });
  m.userData.opaque = opacity >= 1;
  m.userData.glow = glow !== '#000000';
  hatchMats.add(m);
  return m;
}

export function inkLineMat(width = 1.6, color = INK, opacity = 1) {
  const m = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity });
  lineMats.add(m); return m;
}
/* Cor acima de 1 passa do limiar do bloom e "acende". */
export function glowLineMat(hex, width = 4, k = 3) {
  const m = new LineMaterial({ color: new THREE.Color(hex).multiplyScalar(Math.min(1.3, k * 0.45)), linewidth: width, transparent: true, toneMapped: false });
  m.userData.glow = true; lineMats.add(m); return m;
}
export function glowMat(hex, k = 4) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(Math.min(1.3, k * 0.35)), toneMapped: false });
  m.userData.glow = true; return m;
}

let strokeA, strokeB;
const rnd = (a) => (Math.random() - 0.5) * 2 * a;
/* Traço à mão: cada aresta vira uma linha levemente torta que passa um pouco da quina. */
function sketchSegments(edges, wobble, over) {
  const p = edges.attributes.position.array, out = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < p.length; i += 6) {
    a.set(p[i], p[i + 1], p[i + 2]); b.set(p[i + 3], p[i + 4], p[i + 5]);
    const len = a.distanceTo(b); if (len < 1e-5) continue;
    d.subVectors(b, a).divideScalar(len);
    const o = Math.min(over, len * 0.12);
    const s0 = -o * Math.random(), s1 = len + o * Math.random();
    const n = Math.max(1, Math.ceil((s1 - s0) / 0.05));
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = s0 + ((s1 - s0) * k) / n, w = k === 0 || k === n ? wobble * 0.4 : wobble;
      const q = [a.x + d.x * t + rnd(w), a.y + d.y * t + rnd(w), a.z + d.z * t + rnd(w)];
      if (prev) out.push(...prev, ...q);
      prev = q;
    }
  }
  return out;
}
/* Silhueta: casca invertida um pouco maior, pintada de tinta. */
const hullMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
hullMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.0045;');
};
export function hull(mesh) {
  const h = new THREE.Mesh(mesh.geometry, hullMat);
  h.raycast = () => {}; h.castShadow = false;
  mesh.add(h); return mesh;
}
/* Contorno a tinta: dois traços tremidos nas arestas vivas e silhueta nos objetos opacos. */
export function outline(mesh, angle = 28) {
  strokeA ||= inkLineMat(2.3);
  strokeB ||= inkLineMat(1.1, INK, 0.75);
  const edges = new THREE.EdgesGeometry(mesh.geometry, angle);
  for (const [mat, wob, over] of [[strokeA, 0.0016, 0.012], [strokeB, 0.003, 0.02]]) {
    const g = new LineSegmentsGeometry().setPositions(sketchSegments(edges, wob, over));
    const l = new LineSegments2(g, mat); l.raycast = () => {};
    mesh.add(l);
  }
  if (mesh.material.userData?.opaque) hull(mesh);
  return mesh;
}

/* Rastro de luz com espessura, com memória pré-alocada (sem vazar buffers). */
export class GlowTrail {
  constructor(mat, max = 400) {
    this.max = max; this.count = 0;
    this.geo = new LineGeometry();
    this.geo.setPositions(new Float32Array(max * 3));
    this.data = this.geo.attributes.instanceStart.data;
    this.geo.instanceCount = 0;
    this.line = new Line2(this.geo, mat);
    this.line.frustumCulled = false;
    this.line.raycast = () => {};
    this.last = new THREE.Vector3();
  }
  add(x, y, z, minStep = 0.004) {
    if (this.count >= this.max) return;
    if (this.count > 0) {
      if (Math.hypot(x - this.last.x, y - this.last.y, z - this.last.z) < minStep) return;
      const a = this.data.array, i = (this.count - 1) * 6;
      a[i] = this.last.x; a[i + 1] = this.last.y; a[i + 2] = this.last.z;
      a[i + 3] = x; a[i + 4] = y; a[i + 5] = z;
      this.data.needsUpdate = true;
      this.geo.instanceCount = this.count;
    }
    this.last.set(x, y, z); this.count++;
  }
  setPoints(pts) { this.clear(); for (const p of pts) this.add(p.x, p.y, p.z, 0); }
  clear() { this.count = 0; this.geo.instanceCount = 0; }
}
