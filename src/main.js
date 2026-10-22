import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import '@fontsource-variable/caveat';
import './style.css';
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, SelectiveBloomEffect, VignetteEffect, NoiseEffect, BlendFunction } from 'postprocessing';
import { LIGHT_DIR, setLineResolution, setHatchScale } from './hatch.js';
import { chapterLeft, chapterRight, titleLeft, contentsRight, setArt, PH } from './pages.js';
import { chapters, state, pageY, PAGE_W, PAGE_D, fmt } from './chapters.js';

await Promise.all([
  document.fonts.load('400 30px "Source Serif 4 Variable"'),
  document.fonts.load('700 30px "Source Serif 4 Variable"'),
  document.fonts.load('italic 400 30px "Source Serif 4 Variable"'),
  document.fonts.load('600 30px "Caveat Variable"'),
]).catch(() => {});

/* Retrato em tinta do sumário: carregado antes da primeira página ser montada. */
await new Promise((ok) => {
  const img = new Image();
  img.onload = () => { setArt(img); ok(); };
  img.onerror = ok;
  img.src = `${import.meta.env.BASE_URL}art/einstein-tinta.png`;
});

/* ---------- renderer e cena ---------- */
const canvas = document.getElementById('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) { document.getElementById('nowebgl').hidden = false; throw e; }
const DPR = Math.min(devicePixelRatio, 2);
renderer.setPixelRatio(DPR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setHatchScale(DPR);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c9d1c8');
scene.fog = new THREE.Fog('#c9d1c8', 6, 15);
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);

scene.add(new THREE.HemisphereLight('#fbfaf6', '#9aa59e', 1.1));
const sun = new THREE.DirectionalLight('#fffaf1', 2.2);
sun.position.copy(LIGHT_DIR).multiplyScalar(8).add(new THREE.Vector3(0.6, 0, 0));
sun.target.position.set(0.6, 0, 0); scene.add(sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3.6, right: 3.6, top: 3.6, bottom: -3.6, near: 1, far: 20 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.015;
scene.add(sun);

/* ---------- mesa ---------- */
function clothTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#9fb0a8'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random() < 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10);
  return t;
}
const table = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: clothTexture(), roughness: 0.95 }));
table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);

/* ---------- livro ---------- */
const book = new THREE.Group(); scene.add(book);
const cover = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W * 2 + 0.18, 0.035, PAGE_D + 0.14), new THREE.MeshStandardMaterial({ color: '#d9a52b', roughness: 0.55 }));
cover.position.y = 0.0175; cover.castShadow = cover.receiveShadow = true; book.add(cover);
function pageBlock(side) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.034);
  for (let i = 0; i <= 40; i++) { const x = (i / 40) * PAGE_W; s.lineTo(x, pageY(x) - 0.004); }
  s.lineTo(PAGE_W, 0.034); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: PAGE_D, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -PAGE_D / 2);
  if (side === 'left') g.scale(-1, 1, 1);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#f1ede4', roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true; return m;
}
book.add(pageBlock('left'), pageBlock('right'));
function pageGeometry(side) {
  const g = new THREE.PlaneGeometry(PAGE_W, PAGE_D, 48, 1); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + (side === 'right' ? PAGE_W / 2 : -PAGE_W / 2); p.setXYZ(i, x, pageY(x), p.getZ(i)); }
  g.computeVertexNormals(); return g;
}
const paperMat = () => new THREE.MeshStandardMaterial({ roughness: 0.92, color: '#ffffff' });
const leftPage = new THREE.Mesh(pageGeometry('left'), paperMat());
const rightPage = new THREE.Mesh(pageGeometry('right'), paperMat());
leftPage.receiveShadow = rightPage.receiveShadow = true;
book.add(leftPage, rightPage);
const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.7), new THREE.MeshStandardMaterial({ color: '#a8321a', roughness: 0.7 }));
ribbon.position.set(0.02, 0.05, PAGE_D / 2 + 0.25); ribbon.rotation.x = 0.08; ribbon.castShadow = true; book.add(ribbon);

/* ---------- folha que vira ---------- */
const flipGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_D, 40, 1); flipGeo.rotateX(-Math.PI / 2); flipGeo.translate(PAGE_W / 2, 0, 0);
const flipBase = flipGeo.attributes.position.array.slice();
const flipFront = new THREE.Mesh(flipGeo, new THREE.MeshStandardMaterial({ roughness: 0.92, side: THREE.FrontSide }));
const flipBack = new THREE.Mesh(flipGeo, new THREE.MeshStandardMaterial({ roughness: 0.92, side: THREE.BackSide }));
const flipper = new THREE.Group(); flipper.add(flipFront, flipBack); flipper.visible = false; book.add(flipper);
flipFront.castShadow = flipBack.castShadow = true;
function setFlip(theta) {
  const p = flipGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = flipBase[i * 3], z = flipBase[i * 3 + 2], s = x / PAGE_W;
    const a = theta * (1 - 0.28 * Math.sin(theta) * s);
    p.setXYZ(i, x * Math.cos(a), pageY(x) + 0.006 + x * Math.sin(a), z);
  }
  p.needsUpdate = true; flipGeo.computeVertexNormals();
}
const mirrored = (t) => { const m = t.clone(); m.wrapS = THREE.RepeatWrapping; m.repeat.x = -1; m.offset.x = 1; m.needsUpdate = true; return m; };

/* ---------- páginas (texturas) ---------- */
const spreads = [{ id: 'sumario', title: 'Sumário' }, ...chapters];
const texCache = new Map();
let contentsRows = [];
function spreadTex(i) {
  if (texCache.has(i)) return texCache.get(i);
  let t;
  if (i === 0) { const r = contentsRight(chapters); contentsRows = r.rows; t = { left: titleLeft(), right: r.texture }; }
  else { const ch = chapters[i - 1]; t = { left: chapterLeft(ch, ch.folio), right: chapterRight(ch, ch.folio + 1) }; }
  texCache.set(i, t); return t;
}
function trimCache(keep) {
  for (const [k, v] of texCache) if (!keep.includes(k)) { v.left.dispose(); v.right.dispose(); texCache.delete(k); }
}

/* ---------- dioramas ---------- */
const dioramas = new Map();
function diorama(i) {
  if (i === 0) return null;
  if (!dioramas.has(i)) { const d = chapters[i - 1].build(); d.pop = 0; d.target = 0; d.root.visible = false; scene.add(d.root); dioramas.set(i, d);
    d.root.traverse((o) => { if (o.material?.userData?.glow) bloom.selection.add(o); });
  }
  return dioramas.get(i);
}
const easeOutBack = (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
function applyPop(d, dt) {
  const dir = Math.sign(d.target - d.pop);
  d.pop = THREE.MathUtils.clamp(d.pop + dir * dt / (dir > 0 ? 1.1 : 0.45), 0, 1);
  d.root.visible = d.pop > 0.001;
  for (const pv of d.root.userData.pieces) {
    const local = THREE.MathUtils.clamp((d.pop - pv.userData.delay * 0.5) / (1 - pv.userData.delay * 0.5), 0, 1);
    const e = d.target > 0 ? easeOutBack(local) : local * local;
    pv.rotation.x = -(1 - e) * Math.PI / 2;
  }
}

/* ---------- pós-processamento ---------- */
const composer = new EffectComposer(renderer, { multisampling: 4 });
composer.addPass(new RenderPass(scene, camera));
/* Só os pontos de energia brilham: o papel e os desenhos ficam fora do bloom. */
const bloom = new SelectiveBloomEffect(scene, camera, { intensity: 2.4, luminanceThreshold: 0, luminanceSmoothing: 0.1, mipmapBlur: true, radius: 0.7 });
bloom.ignoreBackground = true;
const noise = new NoiseEffect({ blendFunction: BlendFunction.MULTIPLY }); noise.blendMode.opacity.value = 0.07;
composer.addPass(new EffectPass(camera, bloom, new VignetteEffect({ offset: 0.3, darkness: 0.5 }), noise));

/* ---------- câmera ---------- */
let W = 1, H = 1, portrait = false;
function camFor(i) {
  if (portrait) return i === 0 ? { pos: [0.95, 3.9, 3.1], look: [0.95, 0, -0.25], fov: 50 } : { pos: [1.05, 2.25, 3.2], look: [1.05, 0.32, -0.08], fov: 48 };
  return i === 0 ? { pos: [0, 4.1, 3.5], look: [0, 0, -0.1], fov: 40 } : { pos: [0.95, 1.95, 2.75], look: [0.98, 0.32, -0.1], fov: 38 };
}
function resize() {
  W = innerWidth; H = innerHeight; portrait = W / H < 0.95;
  camera.aspect = W / H;
  camera.setViewOffset(W, H, 0, H * (portrait ? 0.16 : 0.07), W, H);
  camera.updateProjectionMatrix();
  composer.setSize(W, H);
  setLineResolution(W, H);
}
addEventListener('resize', resize); resize();

/* ---------- navegação ---------- */
let current = 0, busy = false, flip = null;
const camPos = new THREE.Vector3(0, 5.5, 4.5), camLook = new THREE.Vector3(0, 0, 0);
let fov = 40, yaw = 0, pitch = 0, zoom = 1, panR = 0, panF = 0;
const ZMIN = 0.32, ZMAX = 1.7;
const setZoom = (z) => { zoom = THREE.MathUtils.clamp(z, ZMIN, ZMAX); };
const resetView = () => { yaw = pitch = panR = panF = 0; zoom = 1; };

function showSpread(i) {
  const t = spreadTex(i);
  leftPage.material.map = t.left; rightPage.material.map = t.right;
  leftPage.material.needsUpdate = rightPage.material.needsUpdate = true;
}
function go(i) {
  if (busy || i < 0 || i >= spreads.length || i === current) return;
  const from = current; current = i; resetView();
  const oldD = diorama(from); if (oldD) oldD.target = 0;
  const newD = diorama(i);
  renderUI();
  busy = true;
  const a = spreadTex(from), b = spreadTex(i), fwd = i > from;
  if (fwd) {
    flipFront.material.map = a.right; flipBack.material.map = mirrored(b.left);
    rightPage.material.map = b.right;
  } else {
    flipFront.material.map = b.right; flipBack.material.map = mirrored(a.left);
    leftPage.material.map = b.left;
  }
  for (const m of [flipFront.material, flipBack.material, rightPage.material, leftPage.material]) m.needsUpdate = true;
  const backTex = flipBack.material.map;
  flip = { t: 0, fwd, pop: newD, done: () => { showSpread(i); backTex.dispose(); trimCache([i]); } };
  setFlip(fwd ? 0 : Math.PI);
  flipper.visible = true;
}

/* ---------- interface ---------- */
const $ = (s) => document.querySelector(s);
const sheet = $('#sheet');
function bindControls(root) {
  const g = 1 / Math.sqrt(1 - state.beta ** 2);
  root.querySelectorAll('[data-out=beta]').forEach((e) => (e.textContent = fmt(state.beta)));
  root.querySelectorAll('[data-out=gamma]').forEach((e) => (e.textContent = fmt(g)));
  root.querySelectorAll('[data-out=sbeta]').forEach((e) => (e.textContent = fmt(state.simBeta)));
  root.querySelectorAll('[data-out=mass]').forEach((e) => (e.textContent = Math.round(state.mass * 100)));
  root.querySelectorAll('input[data-beta]').forEach((el) => { el.value = state.beta; el.oninput = () => { state.beta = +el.value; bindControls(root); diorama(current)?.restart(); }; });
  root.querySelectorAll('input[data-sbeta]').forEach((el) => { el.value = state.simBeta; el.oninput = () => { state.simBeta = +el.value; bindControls(root); const d = diorama(current); d?.restart(); d?.report?.(); }; });
  root.querySelectorAll('input[data-mass]').forEach((el) => { el.value = state.mass; el.oninput = () => { state.mass = +el.value; bindControls(root); }; });
  root.querySelectorAll('[data-view]').forEach((el) => {
    el.onclick = () => { root.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b === el)); diorama(current)?.setView(el.dataset.view); };
  });
}
function renderUI() {
  const sp = spreads[current];
  $('#sheetTitle').textContent = current === 0 ? 'Sumário' : `${current}. ${sp.title}`;
  $('#barTitle').innerHTML = current === 0 ? 'Sumário' : `<i>${current}</i> ${sp.title}`;
  $('#bPrev').disabled = current === 0; $('#bNext').disabled = current === spreads.length - 1;
  const ctr = $('#sheetControls'), body = $('#sheetBody');
  if (current === 0) {
    ctr.innerHTML = '';
    body.innerHTML = `<p>Uma lição em cinco páginas duplas. Cada figura se ergue da página: toque nas peças, mude os controles e arraste para girar o livro.</p><ol class="toc">${chapters.map((c, k) => `<li><button data-go="${k + 1}"><span>${k + 1}</span>${c.title}</button></li>`).join('')}</ol>`;
    body.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(+b.dataset.go)));
  } else {
    ctr.innerHTML = sp.controls || '';
    body.innerHTML = sp.sheet;
    bindControls(ctr);
    diorama(current)?.report?.();
  }
  $('#bStill').setAttribute('aria-pressed', String(state.still));
}
$('#sheetHead').onclick = () => { const o = sheet.classList.toggle('open'); $('#sheetHead').setAttribute('aria-expanded', String(o)); };
$('#bPrev').onclick = () => go(current - 1);
$('#bNext').onclick = () => go(current + 1);
$('#bToc').onclick = () => go(0);
$('#bPlay').onclick = () => { state.still = false; diorama(current)?.restart(); renderUI(); };
$('#bStill').onclick = () => { state.still = !state.still; renderUI(); };
addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(current + 1); if (e.key === 'ArrowLeft') go(current - 1); });

/* ---------- toque, arraste, pinça e zoom ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pointers = new Map();
let down = null, pinch = null, mx = 0, my = 0;
const panBy = (dx, dy) => { const k = 0.0016 * zoom; panR -= dx * k; panF -= dy * k; panR = THREE.MathUtils.clamp(panR, -1.6, 1.6); panF = THREE.MathUtils.clamp(panF, -1.6, 1.6); };
function startPinch() {
  const [a, b] = [...pointers.values()];
  pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  if (down) down.moved = true;
}
canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (pointers.size === 2) { startPinch(); return; }
  const pan = e.button === 2 || e.shiftKey;
  down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, yaw, pitch, moved: false, pan };
});
canvas.addEventListener('pointermove', (e) => {
  mx = e.clientX / W - 0.5; my = e.clientY / H - 0.5;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    setZoom(pinch.z * (pinch.d / Math.max(d, 1)));
    panBy(cx - pinch.mx, cy - pinch.my); pinch.mx = cx; pinch.my = cy;
    return;
  }
  if (!down) { canvas.style.cursor = hit(e) ? 'pointer' : 'grab'; return; }
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (Math.hypot(dx, dy) > 6) down.moved = true;
  if (down.moved) {
    if (down.pan) panBy(e.clientX - down.lx, e.clientY - down.ly);
    else {
      yaw = THREE.MathUtils.clamp(down.yaw - dx * 0.005, -1.2, 1.2);
      pitch = THREE.MathUtils.clamp(down.pitch + dy * 0.003, -0.5, 0.55);
    }
    canvas.style.cursor = 'grabbing';
  }
  down.lx = e.clientX; down.ly = e.clientY;
});
const endPointer = (e) => {
  const wasTap = down && !down.moved && pointers.size === 1;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (wasTap) hit(e)?.();
  if (pointers.size === 0) down = null;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.ctrlKey) setZoom(zoom * Math.exp(e.deltaY * 0.01)); // pinça do trackpad
  else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) panBy(-e.deltaX, 0);
  else setZoom(zoom * Math.exp(e.deltaY * 0.0015));
}, { passive: false });
canvas.addEventListener('dblclick', resetView);
$('#zIn').onclick = () => setZoom(zoom / 1.35);
$('#zOut').onclick = () => setZoom(zoom * 1.35);
$('#zReset').onclick = resetView;
addEventListener('keydown', (e) => { if (e.key === '+' || e.key === '=') setZoom(zoom / 1.2); if (e.key === '-') setZoom(zoom * 1.2); if (e.key === '0') resetView(); });
function hit(e) {
  if (busy) return null;
  ndc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (current === 0) {
    const r = ray.intersectObject(rightPage)[0];
    if (!r) return null;
    const py = (1 - r.uv.y) * PH;
    const row = contentsRows.find((rw) => py >= rw.y0 && py <= rw.y1);
    return row ? () => go(row.index) : null;
  }
  const d = diorama(current); if (!d) return null;
  for (const t of d.taps) if (ray.intersectObject(t.object, true).length) return t.fn;
  return null;
}

/* ---------- laço ---------- */
const clock = new THREE.Clock();
const tp = new THREE.Vector3(), tl = new THREE.Vector3(), off = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), fwd = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const c = camFor(current);
  tl.set(...c.look);
  off.set(...c.pos).sub(tl).applyAxisAngle(UP, yaw);
  side.crossVectors(off, UP).normalize();
  off.applyAxisAngle(side, -pitch).multiplyScalar(zoom);
  fwd.set(-off.x, 0, -off.z).normalize();
  tl.addScaledVector(side, -panR).addScaledVector(fwd, -panF);
  tp.copy(tl).add(off);
  if (!state.still && !down && !pinch) { tp.x += mx * 0.2 * zoom; tp.y -= my * 0.12 * zoom; }
  const k = 1 - Math.exp(-(down || pinch ? 9 : 2.6) * dt);
  camPos.lerp(tp, k); camLook.lerp(tl, k);
  fov += (c.fov - fov) * k;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.position.copy(camPos); camera.lookAt(camLook);

  if (flip) {
    flip.t += dt;
    const x = Math.min(flip.t, 1), e = x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
    setFlip(flip.fwd ? e * Math.PI : (1 - e) * Math.PI);
    if (flip.t >= 0.7 && flip.pop && flip.pop.target === 0) { flip.pop.target = 1; flip.pop.restart(); }
    if (flip.t >= 1) { flipper.visible = false; flip.done(); flip = null; busy = false; }
  }
  for (const d of dioramas.values()) {
    if (d.pop !== d.target) applyPop(d, dt);
    if (d.root.visible && !state.still) d.update(dt);
  }
  composer.render(dt);
  requestAnimationFrame(frame);
}

showSpread(0);
renderUI();
requestAnimationFrame(frame);
const intro = document.getElementById('intro');
setTimeout(() => intro.classList.add('gone'), 1900);
intro.onclick = () => intro.classList.add('gone');
