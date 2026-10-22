import * as THREE from 'three';
import { hatchMat, outline, hull, glowMat, glowLineMat, GlowTrail } from './hatch.js';

export const PAGE_W = 2.1, PAGE_D = 2.9;
/* Altura do papel: afunda na lombada e abaula de leve no meio da página. */
export const pageY = (x) => { const a = Math.abs(x); return 0.13 - 0.085 * Math.exp(-a * 6) + 0.012 * Math.sin((a / PAGE_W) * Math.PI); };

const ORANGE = '#ff7a1a', BLUE = '#3d7bff', PINK = '#ff3aa8', CYAN = '#2ec4ff', GOLD = '#ffb020';
const WOOD = '#9a7a5a', DARKWOOD = '#6d5643', BRASS = '#b9a27a', STEEL = '#aab4bf', MIRROR = '#cfdbe6';
export const state = { beta: 0.6, simBeta: 0.5, mass: 0.6, still: false };
const fmt = (n, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const tri = (u) => { const m = ((u % 2) + 2) % 2; return m < 1 ? m : 2 - m; };

/* ---------- peças em hachura ---------- */
function mesh(geo, mat, edges = true, angle) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  if (edges) outline(m, angle); else if (mat.userData.opaque) hull(m);
  return m;
}
function box(w, h, d, color, y = 0, edges = true) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2 + y, 0);
  return mesh(g, hatchMat({ color }), edges);
}
function cyl(rt, rb, h, color, y = 0, { seg = 36, open = false, opacity = 1, edges = true } = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); g.translate(0, h / 2 + y, 0);
  const mat = hatchMat({ color, opacity, side: open ? THREE.DoubleSide : THREE.FrontSide, rim: opacity < 1 ? 1.4 : 0, hatch: opacity < 1 ? 0 : 1, dir: 'v' });
  const m = mesh(g, mat, edges);
  if (opacity < 1) m.castShadow = false;
  return m;
}
function glassBox(w, h, d, y) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2 + y, 0);
  const m = mesh(g, hatchMat({ color: '#dfe9ee', opacity: 0.1, side: THREE.DoubleSide, rim: 0.5, hatch: 0 }));
  m.castShadow = false; m.renderOrder = 2; return m;
}
function wheel(r, x, z, color = DARKWOOD) {
  const g = new THREE.CylinderGeometry(r, r, 0.03, 22); g.rotateX(Math.PI / 2);
  const m = mesh(g, hatchMat({ color })); m.position.set(x, r, z); return m;
}
function glowBall(r, hex, k = 4) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 3), glowMat(hex, k)); return m; }
function person(color = '#c7b08f', head = '#e8d6bd') {
  const g = new THREE.Group();
  const bodyG = new THREE.CapsuleGeometry(0.045, 0.13, 6, 14); bodyG.translate(0, 0.11, 0);
  g.add(mesh(bodyG, hatchMat({ color, dir: 'v' }), false));
  const h = new THREE.SphereGeometry(0.045, 20, 14); h.translate(0, 0.26, 0);
  g.add(mesh(h, hatchMat({ color: head, dir: 'v' }), false));
  return g;
}
function rails(len, z = 0.11, n = 14) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) { const r = box(len, 0.022, 0.022, STEEL, 0.018); r.position.z = s * z; g.add(r); }
  for (let i = 0; i < n; i++) { const sl = box(0.05, 0.018, z * 2 + 0.12, '#b59a77'); sl.position.x = -len / 2 + 0.06 + (i * (len - 0.12)) / (n - 1); g.add(sl); }
  return g;
}
function wagon(len, { glass = true } = {}) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(wheel(0.055, sx * (len / 2 - 0.13), sz * 0.15));
  g.add(box(len, 0.04, 0.34, '#c8b59a', 0.09));
  if (glass) g.add(glassBox(len, 0.32, 0.34, 0.13));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = box(0.022, 0.32, 0.022, '#7b8fa6', 0.13); p.position.set(sx * (len / 2 - 0.011), 0, sz * 0.159); g.add(p); }
  g.add(box(len + 0.06, 0.035, 0.4, '#7b8fa6', 0.45));
  return g;
}
/* Peça pop-up: dobra na base, como num livro de recortar. */
function piece(root, obj, x, z, delay = 0) {
  const pivot = new THREE.Group();
  pivot.position.set(x, pageY(x), z);
  pivot.userData.delay = delay;
  pivot.add(obj); root.add(pivot); root.userData.pieces.push(pivot);
  return pivot;
}
function newRoot() { const r = new THREE.Group(); r.userData.pieces = []; return r; }

/* ---------- capítulos ---------- */
export const chapters = [
  {
    id: 'referenciais', title: 'Referenciais', kicker: 'Capítulo 1', titleLines: ['Tudo se move,', 'mas em relação', 'a quê?'], folio: 2,
    page: [
      'Num trem que anda reto e sem trancos, jogar uma bola para cima é igual a jogá-la parado: ela sobe e volta para a mão.',
      'Quem está **dentro** vê uma reta vertical. Quem está na **plataforma** vê um arco. Os dois estão certos.',
      'As leis da física são as mesmas em todo referencial que se move com velocidade constante.',
    ],
    note: 'velocidade é relativa. e a luz?',
    fig: 'Fig. 1 · Um trem, uma bola, dois pontos de vista.',
    hint: 'Toque no trem para jogar a bola de novo.',
    sheet: `<p>Dentro de um trem que anda em linha reta, sem trancos, jogar uma bola para cima é igual a jogá-la parado na plataforma: ela sobe e cai na sua mão. Quem está dentro vê a bola numa <b class="c-blue">linha reta vertical</b>.</p>
<p>Quem está na plataforma vê outra coisa: a bola também avança com o trem e desenha um <b class="c-orange">arco</b>. Os dois estão certos; só não concordam sobre a forma do caminho.</p>
<p>Galileu percebeu isso há 400 anos: <b>as leis da física são as mesmas em todo referencial que se move com velocidade constante</b>. Nenhum experimento feito só lá dentro diz se o trem está parado ou andando.</p>`,
    build() {
      const root = newRoot();
      const track = new THREE.Group(); track.add(rails(1.9));
      const w = wagon(0.9); track.add(w);
      const pass = person('#9fb3c8'); pass.position.set(-0.24, 0.13, 0.02); w.add(pass);
      const ball = glowBall(0.035, ORANGE); w.add(ball);
      const inside = new GlowTrail(glowLineMat(BLUE, 3, 2.2), 4);
      inside.setPoints([new THREE.Vector3(-0.15, 0.19, 0), new THREE.Vector3(-0.15, 0.41, 0)]); w.add(inside.line);
      const trail = new GlowTrail(glowLineMat(ORANGE, 4, 3), 500); track.add(trail.line);
      piece(root, track, 1.05, -0.2, 0);
      const plat = new THREE.Group();
      plat.add(box(0.6, 0.05, 0.26, '#d9cdb8'));
      const obs = person('#c99a6b'); obs.position.set(0.05, 0.05, 0); plat.add(obs);
      const bench = box(0.18, 0.06, 0.07, WOOD, 0.05); bench.position.set(-0.18, 0, 0.04); plat.add(bench);
      piece(root, plat, 1.25, 0.62, 0.25);
      let T = 0, lastX = -9;
      const restart = () => { T = 0; trail.clear(); lastX = -9; };
      return {
        root, restart,
        taps: [{ object: track, fn: restart }],
        update(dt) {
          T += dt;
          const x = -0.48 + ((T * 0.28) % 0.96);
          if (x < lastX) trail.clear();
          lastX = x; w.position.x = x;
          const u = (T % 1.15) / 1.15, by = 0.19 + 0.22 * 4 * u * (1 - u);
          ball.position.set(-0.15, by, 0);
          trail.add(x - 0.15, by, 0);
        },
      };
    },
  },
  {
    id: 'relogio', title: 'O relógio de luz', kicker: 'Capítulo 2', titleLines: ['A luz não', 'espera ninguém'], folio: 4,
    page: [
      'A luz anda a **299 792 458 m/s**, e esse número é **o mesmo para todos**, parados ou não. Einstein levou isso a sério em 1905.',
      'Um relógio de luz é um pulso que sobe e desce entre dois espelhos. Visto passando, o pulso faz um **zigue-zague mais longo**; cada tique demora mais.',
    ],
    eq: 'Δt = γ · Δt₀      γ = 1 / √(1 − v²/c²)',
    note: 'a 99% de c, um tique lá vale sete aqui.',
    fig: 'Fig. 2 · Dois relógios de luz: um parado, um sobre o carrinho.',
    hint: 'Mude a velocidade na aba abaixo.',
    controls: `<label class="slider"><span>Velocidade do carrinho <b><span data-out="beta"></span> c</b> · γ = <b data-out="gamma"></b></span>
<input type="range" min="0" max="0.99" step="0.01" data-beta aria-label="Velocidade como fração de c"></label>
<div class="ticks"><div><small>tiques do relógio parado</small><b id="ticksRest">0</b></div><div><small>tiques do relógio em movimento</small><b id="ticksMov">0</b></div></div>`,
    sheet: `<p>As equações de Maxwell dizem que a luz viaja a <b>c = 299 792 458 m/s</b>. Em 1887, Michelson e Morley procuraram uma velocidade que se somasse a esse valor e não acharam nenhuma. Em 1905, Einstein aceitou o resultado: <b>c é igual para todos os observadores</b>.</p>
<p>Cada vez que o pulso de luz toca o espelho de cima, o relógio faz <i>tique</i>. Para quem vê o carrinho passar, a luz percorre um <b class="c-blue">zigue-zague</b> mais longo. Como a luz não pode ir mais rápido, cada tique demora mais: <b>o tempo do relógio em movimento passa mais devagar</b>. A razão entre os tiques se aproxima de γ.</p>`,
    build() {
      const root = newRoot();
      const C = 0.75, LO = 0.075, L = 0.75;
      const makeClock = () => {
        const g = new THREE.Group();
        g.add(cyl(0.15, 0.16, 0.04, WOOD));
        g.add(cyl(0.1, 0.1, 0.015, MIRROR, 0.04));
        g.add(cyl(0.085, 0.085, 0.78, '#dfe9ee', 0.055, { open: true, opacity: 0.14 }));
        g.add(cyl(0.1, 0.1, 0.015, MIRROR, 0.835));
        g.add(cyl(0.15, 0.15, 0.035, WOOD, 0.85));
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; const p = cyl(0.01, 0.01, 0.81, DARKWOOD, 0.04, { seg: 8, edges: false }); p.position.set(Math.cos(a) * 0.125, 0, Math.sin(a) * 0.125); g.add(p); }
        return g;
      };
      const rest = makeClock(); const pRest = glowBall(0.026, ORANGE); rest.add(pRest);
      piece(root, rest, 0.42, -0.4, 0);
      const track = new THREE.Group(); track.add(rails(1.3, 0.1, 10));
      const cart = new THREE.Group(); track.add(cart);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cart.add(wheel(0.05, sx * 0.12, sz * 0.14));
      cart.add(box(0.36, 0.04, 0.3, '#b59a77', 0.07));
      const mov = makeClock(); mov.position.y = 0.11; cart.add(mov);
      const pMov = glowBall(0.026, ORANGE); track.add(pMov);
      const trail = new GlowTrail(glowLineMat(BLUE, 3.5, 2.6), 700); track.add(trail.line);
      piece(root, track, 1.38, 0.32, 0.25);
      let T = 0, lastX = -9, tr = -1, tm = -1;
      const restart = () => { T = 0; lastX = -9; trail.clear(); };
      return {
        root, restart,
        taps: [{ object: rest, fn: restart }, { object: track, fn: restart }],
        update(dt) {
          T += dt;
          const be = state.beta, sq = Math.sqrt(1 - be * be);
          const uR = (T * C) / L, uM = (T * C * sq) / L;
          pRest.position.y = LO + L * tri(uR);
          let x = -0.5;
          if (be > 0.005) x = -0.5 + ((be * C * T) % 1.0);
          if (x < lastX) trail.clear();
          lastX = x; cart.position.x = x;
          const y = 0.11 + LO + L * tri(uM);
          pMov.position.set(x, y, 0);
          trail.add(x, y, 0);
          const a = Math.floor((uR + 1) / 2), b = Math.floor((uM + 1) / 2);
          if (a !== tr) { tr = a; const e = document.getElementById('ticksRest'); if (e) e.textContent = a; }
          if (b !== tm) { tm = b; const e = document.getElementById('ticksMov'); if (e) e.textContent = b; }
        },
      };
    },
    bind() { this._sync?.(); },
  },
  {
    id: 'simultaneidade', title: 'Simultaneidade', kicker: 'Capítulo 3', titleLines: ['Ao mesmo', 'tempo… para', 'quem?'], folio: 6,
    page: [
      'Uma lâmpada pisca **no meio** de um vagão. Para quem está dentro, a luz chega às duas paredes **juntas**.',
      'Para quem está na plataforma, a parede de trás vem ao encontro da luz e a da frente foge dela: **a de trás acende primeiro**.',
      'Nenhum dos dois está errado. “Agora” depende de quem olha.',
    ],
    eq: 't′ = γ ( t − v·x / c² )',
    note: 'causa e efeito, porém, nunca se invertem.',
    fig: 'Fig. 3 · O vagão de Einstein: uma lâmpada, duas paredes.',
    hint: 'Toque na lâmpada para piscar de novo.',
    controls: `<div class="seg" role="group" aria-label="Ponto de vista"><button data-view="plat" class="on">da plataforma</button><button data-view="dentro">de dentro do vagão</button></div>
<label class="slider"><span>Velocidade do vagão <b><span data-out="sbeta"></span> c</b></span>
<input type="range" min="0" max="0.6" step="0.01" data-sbeta aria-label="Velocidade do vagão como fração de c"></label>
<p class="readout" id="simOut"></p>`,
    sheet: `<p>É o experimento mental do próprio Einstein. A lâmpada está exatamente no meio do vagão, e a luz vai para os dois lados com a mesma velocidade c.</p>
<p><b>De dentro do vagão</b>, as duas paredes estão à mesma distância e paradas: a luz chega às duas ao mesmo tempo.</p>
<p><b>Da plataforma</b>, a luz também vai a c para os dois lados (ela não “pega carona” no trem), mas a parede de trás <b class="c-orange">avança ao encontro do pulso</b> e a da frente <b class="c-pink">se afasta</b>. A de trás acende primeiro. Dois eventos simultâneos num referencial não são simultâneos no outro.</p>`,
    build() {
      const root = newRoot();
      const C = 0.7, HALF = 0.345, LAMP_Y = 0.3;
      const track = new THREE.Group(); track.add(rails(1.95));
      const w = wagon(0.8); track.add(w);
      const stand = cyl(0.012, 0.016, 0.13, BRASS, 0.13, { seg: 10 }); w.add(stand);
      const bulbMat = hatchMat({ color: '#fff3c4', glow: '#ffcf5a', glowAmt: 0 });
      const bulb = mesh(new THREE.SphereGeometry(0.038, 24, 16), bulbMat, false); bulb.position.y = LAMP_Y; w.add(bulb);
      const detMat = [hatchMat({ color: '#e7dcc7', glow: ORANGE, glowAmt: 0 }), hatchMat({ color: '#e7dcc7', glow: PINK, glowAmt: 0 })];
      const dets = [-1, 1].map((s, i) => { const d = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.14), detMat[i]); outline(d); d.castShadow = true; d.position.set(s * (HALF + 0.02), LAMP_Y, 0); w.add(d); return d; });
      const pulses = [glowBall(0.024, ORANGE), glowBall(0.024, PINK)]; pulses.forEach((p) => { p.visible = false; track.add(p); });
      const trails = [new GlowTrail(glowLineMat(ORANGE, 3.5, 3), 300), new GlowTrail(glowLineMat(PINK, 3.5, 3), 300)];
      trails.forEach((t) => track.add(t.line));
      piece(root, track, 1.05, -0.12, 0);
      const plat = new THREE.Group();
      plat.add(box(0.5, 0.05, 0.24, '#d9cdb8'));
      const obs = person('#c99a6b'); obs.position.y = 0.05; plat.add(obs);
      piece(root, plat, 1.05, 0.62, 0.25);
      let T = 0, view = 'plat';
      const restart = () => { T = 0; trails.forEach((t) => t.clear()); };
      const speed = () => (view === 'dentro' ? 0 : state.simBeta * C);
      const report = () => {
        const el = document.getElementById('simOut'); if (!el) return;
        const v = speed();
        if (v < 0.005) { el.innerHTML = 'As duas paredes acendem <b>ao mesmo tempo</b>.'; return; }
        const tr = HALF / (C + v), tf = HALF / (C - v);
        el.innerHTML = `A parede de trás acende primeiro. A da frente leva <b>${fmt(tf / tr)}×</b> mais tempo para receber a luz.`;
      };
      return {
        root, restart, report,
        taps: [{ object: w, fn: restart }],
        setView(v) { view = v; restart(); report(); },
        update(dt) {
          T += dt;
          const v = speed(), X0 = view === 'dentro' ? 0 : -0.52, TF = 0.5;
          const x = X0 + v * T; w.position.x = x;
          const tau = T - TF, xe = X0 + v * TF;
          const tr = HALF / (C + v), tf = HALF / (C - v);
          bulbMat.uniforms.uGlowAmt.value = tau > 0 ? Math.max(0, 3 * (1 - tau / 0.5)) : 0;
          [0, 1].forEach((i) => {
            const s = i === 0 ? -1 : 1, hit = i === 0 ? tr : tf;
            const on = tau > 0;
            const tt = Math.min(Math.max(tau, 0), hit);
            const px = xe + s * C * tt;
            pulses[i].visible = on && tau < hit + 0.05;
            pulses[i].position.set(px, LAMP_Y, 0);
            if (on && tau <= hit + 0.02) trails[i].add(px, LAMP_Y, 0);
            detMat[i].uniforms.uGlowAmt.value = tau >= hit ? 2.6 : 0;
          });
          if (tau > Math.max(tr, tf) + 1.3) restart();
          dets.forEach((d) => (d.visible = true));
        },
      };
    },
  },
  {
    id: 'gravidade', title: 'A massa curva o espaço', kicker: 'Capítulo 4', titleLines: ['A massa curva', 'o espaço-tempo'], folio: 8,
    page: [
      'Em 1915, Einstein incluiu a gravidade: ela **não é uma força** puxando à distância, é a **forma** do espaço-tempo.',
      'A massa afunda o tecido e tudo segue o caminho mais reto que a curva permite. Até a luz entorta, como se mediu no eclipse de 1919.',
      'O GPS corrige cerca de **38 microssegundos por dia** por causa disso.',
    ],
    note: 'a matéria diz ao espaço como se curvar; o espaço diz à matéria como se mover.',
    fig: 'Fig. 4 · Um tecido esticado, uma massa e um raio de luz.',
    hint: 'Toque na bolinha para relançá-la.',
    controls: `<label class="slider"><span>Massa do corpo central <b><span data-out="mass"></span>%</b></span>
<input type="range" min="0.05" max="1" step="0.01" data-mass aria-label="Massa do corpo central"></label>`,
    sheet: `<p>Na Relatividade Geral, a massa (e a energia) curva o espaço-tempo. A <b class="c-orange">bolinha</b> contorna o corpo central porque o terreno é inclinado, não porque algo a puxa. O tecido esticado é só uma imagem: a curvatura real é do espaço <i>e</i> do tempo juntos.</p>
<p>A <b class="c-blue">luz</b> também segue a curva. Em 1919, durante um eclipse, mediram que estrelas atrás do Sol pareciam deslocadas, como a teoria previa.</p>
<p>Os relógios dos satélites de GPS andam cerca de 45 µs/dia mais rápido pela gravidade mais fraca e 7 µs/dia mais devagar pela velocidade: saldo de <b>38 µs por dia</b>. Sem essa correção, o GPS erraria vários quilômetros por dia.</p>`,
    build() {
      const root = newRoot();
      const S = 0.75, Y = 0.34;
      const frame = new THREE.Group();
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = box(0.05, Y, 0.05, WOOD); p.position.set(sx * S, 0, sz * S); frame.add(p); }
      for (const s of [-1, 1]) {
        const a = box(S * 2 + 0.05, 0.04, 0.05, WOOD, Y - 0.02); a.position.z = s * S; frame.add(a);
        const b = box(0.05, 0.04, S * 2 + 0.05, WOOD, Y - 0.02); b.position.x = s * S; frame.add(b);
      }
      const N = 56;
      const memG = new THREE.PlaneGeometry(S * 2, S * 2, N, N); memG.rotateX(-Math.PI / 2);
      const base = memG.attributes.position.array.slice();
      const membrane = new THREE.Mesh(memG, hatchMat({ color: '#ebe3d2', side: THREE.DoubleSide }));
      membrane.position.y = Y; membrane.receiveShadow = true; membrane.castShadow = true; frame.add(membrane);
      const GL = 15, gridArr = new Float32Array(GL * 2 * N * 2 * 3);
      const gridG = new THREE.BufferGeometry(); gridG.setAttribute('position', new THREE.BufferAttribute(gridArr, 3));
      const grid = new THREE.LineSegments(gridG, new THREE.LineBasicMaterial({ color: '#2a2420', transparent: true, opacity: 0.55 }));
      grid.position.y = Y + 0.003; frame.add(grid);
      const h = (x, z) => {
        const r = Math.hypot(x, z), edge = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), 0.48, 0.74);
        return -state.mass * 0.55 / Math.sqrt(1 + (r / 0.13) ** 2) * edge;
      };
      const sun = mesh(new THREE.SphereGeometry(0.12, 32, 20), hatchMat({ color: '#f6d27a', glow: GOLD, glowAmt: 1.8, dir: 'v' }), false);
      frame.add(sun);
      const marble = glowBall(0.032, ORANGE); frame.add(marble);
      const orbit = new GlowTrail(glowLineMat(ORANGE, 2, 1.6), 130); frame.add(orbit.line);
      const ray = new GlowTrail(glowLineMat(BLUE, 3.5, 2.6), 130); frame.add(ray.line);
      const photon = glowBall(0.022, CYAN); frame.add(photon);
      piece(root, frame, 1.05, -0.08, 0);
      const orbitPos = (a) => { const r = 0.44 / (1 + 0.22 * Math.cos(a)); return [r * Math.cos(a), r * Math.sin(a)]; };
      const rayZ = (x) => -0.56 + state.mass * 0.17 * Math.exp(-(x * x) / 0.07);
      const rebuild = () => {
        const p = memG.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = base[i * 3], z = base[i * 3 + 2]; p.setY(i, h(x, z)); }
        p.needsUpdate = true; memG.computeVertexNormals();
        let k = 0;
        for (let a = 0; a < GL; a++) {
          const c = -S + 0.05 + (a / (GL - 1)) * (2 * S - 0.1);
          for (let j = 0; j < N; j++) {
            const u0 = -S + (j / N) * 2 * S, u1 = -S + ((j + 1) / N) * 2 * S;
            gridArr.set([u0, h(u0, c), c, u1, h(u1, c), c, c, h(c, u0), u0, c, h(c, u1), u1], k); k += 12;
          }
        }
        gridG.attributes.position.needsUpdate = true;
        sun.position.set(0, Y + h(0, 0) + 0.11, 0);
        const op = []; for (let i = 0; i <= 120; i++) { const [x, z] = orbitPos((i / 120) * Math.PI * 2); op.push(new THREE.Vector3(x, Y + h(x, z) + 0.006, z)); }
        orbit.setPoints(op);
        const rp = []; for (let i = 0; i <= 120; i++) { const x = -0.72 + (i / 120) * 1.44, z = rayZ(x); rp.push(new THREE.Vector3(x, Y + h(x, z) + 0.01, z)); }
        ray.setPoints(rp);
      };
      let ang = 0, last = -1, T = 0;
      const restart = () => { ang = Math.PI; };
      return {
        root, restart,
        taps: [{ object: marble, fn: restart }, { object: frame, fn: restart }],
        update(dt) {
          T += dt;
          if (last !== state.mass) { last = state.mass; rebuild(); }
          const [px, pz] = orbitPos(ang), r = Math.hypot(px, pz);
          ang += dt * 1.3 * Math.sqrt(state.mass + 0.12) * (0.44 / r) ** 1.5;
          marble.position.set(px, Y + h(px, pz) + 0.03, pz);
          const x = -0.72 + ((T * 0.45) % 1.44), z = rayZ(x);
          photon.position.set(x, Y + h(x, z) + 0.02, z);
        },
      };
    },
  },
  {
    id: 'resumo', title: 'Resumo', kicker: 'Fechamento', titleLines: ['O que levar', 'desta lição'], folio: 10,
    page: [
      '**1.** As leis da física são iguais para quem se move sem acelerar.',
      '**2.** A velocidade da luz é a mesma para todos; disso vem o resto.',
      '**3.** Relógios em movimento andam devagar, e “ao mesmo tempo” depende de quem olha.',
      '**4.** A gravidade é a curvatura do espaço-tempo.',
    ],
    eq: 'E = m c²',
    note: 'massa e energia: a próxima lição.',
    fig: 'Fig. 5 · O cone de luz: o que pode afetar o “agora” e o que ele pode afetar.',
    hint: 'Arraste para girar o livro.',
    sheet: `<p>Tudo nesta lição sai de duas ideias: as leis da física valem igualmente para quem se move sem acelerar, e a luz tem a mesma velocidade para todos.</p>
<p>O <b>cone de luz</b> da figura junta tudo: o ponto <b class="c-orange">laranja</b> é um “agora”. Só o que está dentro do cone de baixo pode tê-lo afetado; só o que está dentro do cone de cima ele pode afetar. A linha <b class="c-blue">azul</b> é a história de um observador, sempre dentro do cone, porque nada passa da luz.</p>
<h3>Para pensar</h3>
<p>Dois gêmeos se separam: um viaja a 0,9 c e volta. Qual envelhece menos? (Pista: quem viajou precisou <i>acelerar</i> para voltar, e isso quebra a simetria.)</p>`,
    build() {
      const root = newRoot();
      const sculpt = new THREE.Group();
      sculpt.add(box(0.5, 0.08, 0.5, WOOD));
      sculpt.add(cyl(0.012, 0.012, 0.92, BRASS, 0.08, { seg: 10 }));
      const cones = new THREE.Group(); cones.position.y = 0.56; sculpt.add(cones);
      const H = 0.36, R = 0.32;
      const up = new THREE.ConeGeometry(R, H, 48, 1, true); up.rotateX(Math.PI); up.translate(0, H / 2, 0);
      const dn = new THREE.ConeGeometry(R, H, 48, 1, true); dn.translate(0, -H / 2, 0);
      for (const g of [up, dn]) { const m = mesh(g, hatchMat({ color: '#dfe9ee', opacity: 0.14, side: THREE.DoubleSide, rim: 1.2, hatch: 0 }), true, 20); m.castShadow = false; cones.add(m); }
      const pts = []; for (let y = -0.34; y <= 0.34; y += 0.02) pts.push(new THREE.Vector3(0.1 * Math.sin(y * 6), y, 0.06 * Math.sin(y * 4)));
      cones.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.007, 8), glowMat(BLUE, 2.4)));
      const now = glowBall(0.026, ORANGE); cones.add(now);
      piece(root, sculpt, 0.8, -0.15, 0);
      const c = document.createElement('canvas'); c.width = 512; c.height = 300;
      const g = c.getContext('2d'); g.fillStyle = '#f8f3e8'; g.fillRect(0, 0, 512, 300);
      g.strokeStyle = '#2a2420'; g.lineWidth = 6; g.strokeRect(10, 10, 492, 280);
      g.fillStyle = '#2a2420'; g.font = 'italic 600 120px "Source Serif 4 Variable", serif'; g.textAlign = 'center'; g.fillText('E = mc²', 256, 190);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const paper = new THREE.MeshStandardMaterial({ color: '#f3ecdd', roughness: 0.9 });
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.26, 0.008), [paper, paper, paper, paper, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), paper]);
      card.geometry.translate(0, 0.13, 0); card.rotation.x = -0.2; card.castShadow = true; outline(card);
      piece(root, card, 1.6, 0.35, 0.3);
      let T = 0;
      return {
        root, restart() { T = 0; }, taps: [],
        update(dt) { T += dt; cones.rotation.y = T * 0.4; now.scale.setScalar(1 + 0.2 * Math.sin(T * 3)); },
      };
    },
  },
];
export { fmt };
