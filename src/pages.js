import * as THREE from 'three';

/* Páginas desenhadas em canvas e usadas como textura do papel. */
export const PW = 900, PH = Math.round(900 * 2.9 / 2.1);
const SERIF = '"Source Serif 4 Variable", Georgia, serif';
const HAND = '"Caveat Variable", cursive';
const INK = '#2a2420', MUTED = '#7a6a58', BLUE = '#1f4fb8', RED = '#a8321a';
const PAPER = '#fbfaf6';
const KEYS = [['#ff7a1a', 'luz e eventos'], ['#1f4fb8', 'quem se move junto'], ['#e0309a', 'outro evento'], ['#f2b52a', 'massa e gravidade']];

/* Retrato em tinta, carregado uma vez antes de montar o sumário. */
let art = null;
export function setArt(img) { art = img; }

function base(side) {
  const c = document.createElement('canvas'); c.width = PW; c.height = PH;
  const g = c.getContext('2d');
  g.fillStyle = PAPER; g.fillRect(0, 0, PW, PH);
  // fibra do papel
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(90,70,40,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * PW, Math.random() * PH, 1 + Math.random() * 2, 1);
  }
  // sombra da lombada
  const gx = side === 'left' ? PW : 0;
  const grad = g.createLinearGradient(gx, 0, side === 'left' ? PW - 130 : 130, 0);
  grad.addColorStop(0, 'rgba(60,40,20,0.28)'); grad.addColorStop(1, 'rgba(60,40,20,0)');
  g.fillStyle = grad; g.fillRect(side === 'left' ? PW - 130 : 0, 0, 130, PH);
  g.textBaseline = 'alphabetic';
  return { c, g };
}

/* Quebra de linha com suporte a **negrito**. */
function para(g, text, x, y, maxW, size, lh, color = INK, italic = false) {
  const words = text.split(/\s+/);
  let bold = false, line = [], lineW = 0;
  const font = (b) => `${italic ? 'italic ' : ''}${b ? 650 : 400} ${size}px ${SERIF}`;
  const flush = () => {
    let cx = x;
    for (const w of line) { g.font = font(w.b); g.fillStyle = w.b ? INK : color; g.fillText(w.t, cx, y); cx += g.measureText(w.t + ' ').width; }
    line = []; lineW = 0; y += lh;
  };
  for (let raw of words) {
    let startsBold = raw.startsWith('**'), endsBold = raw.endsWith('**') && raw.length > 2;
    if (startsBold) { bold = true; raw = raw.slice(2); }
    if (raw.endsWith('**')) raw = raw.slice(0, -2);
    g.font = font(bold);
    const w = g.measureText(raw + ' ').width;
    if (lineW + w > maxW && line.length) flush();
    line.push({ t: raw, b: bold }); lineW += w;
    if (endsBold) bold = false;
  }
  if (line.length) flush();
  return y;
}

function spaced(g, text, x, y, size, color, spacing = 4, weight = 600) {
  g.font = `${weight} ${size}px ${SERIF}`; g.fillStyle = color;
  let cx = x;
  for (const ch of text) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + spacing; }
}

function folio(g, n, side) {
  g.font = `400 22px ${SERIF}`; g.fillStyle = MUTED;
  g.textAlign = side === 'left' ? 'left' : 'right';
  g.fillText(String(n), side === 'left' ? 70 : PW - 70, PH - 60);
  g.textAlign = 'left';
  spaced(g, side === 'left' ? 'ESPAÇO-TEMPO' : 'LIÇÃO 1 · RELATIVIDADE', side === 'left' ? 70 : PW - 330, 64, 15, MUTED, 3, 500);
}

function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function chapterLeft(ch, folioN) {
  const { c, g } = base('left');
  folio(g, folioN, 'left');
  const x = 76, w = PW - 150;
  spaced(g, ch.kicker.toUpperCase(), x, 150, 20, BLUE, 4);
  g.font = `700 54px ${SERIF}`; g.fillStyle = INK;
  let y = 222;
  for (const l of ch.titleLines) { g.fillText(l, x, y); y += 60; }
  g.strokeStyle = RED; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 30); g.quadraticCurveTo(x + 140, y - 22, x + 260, y - 32); g.stroke();
  y += 20;
  for (const p of ch.page) y = para(g, p, x, y, w, 25, 37) + 14;
  if (ch.eq) {
    y += 6;
    g.fillStyle = 'rgba(31,79,184,0.08)'; g.fillRect(x, y - 6, w, 70);
    g.fillStyle = BLUE; g.fillRect(x, y - 6, 5, 70);
    g.font = `italic 500 30px ${SERIF}`; g.fillStyle = INK; g.textAlign = 'center';
    g.fillText(ch.eq, x + w / 2, y + 40); g.textAlign = 'left';
    y += 96;
  }
  if (ch.note) {
    g.font = `600 34px ${HAND}`; g.fillStyle = RED;
    para2(g, '✎ ' + ch.note, x + 10, Math.max(y + 20, PH - 230), w - 20, 34);
  }
  return tex(c);
}
function para2(g, text, x, y, maxW, lh) {
  let line = '';
  for (const w of text.split(' ')) {
    if (g.measureText(line + w).width > maxW && line) { g.fillText(line, x, y); y += lh; line = ''; }
    line += w + ' ';
  }
  g.fillText(line, x, y);
}

export function chapterRight(ch, folioN) {
  const { c, g } = base('right');
  folio(g, folioN, 'right');
  const x = 90;
  g.strokeStyle = 'rgba(42,36,32,0.25)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x, PH - 205); g.lineTo(PW - 90, PH - 205); g.stroke();
  g.font = `italic 400 22px ${SERIF}`; g.fillStyle = MUTED;
  g.fillText(ch.fig, x, PH - 170);
  g.font = `italic 500 27px ${SERIF}`; g.fillStyle = INK;
  g.fillText(ch.hint, x, PH - 128);
  return tex(c);
}

export function titleLeft() {
  const { c, g } = base('left');
  g.textAlign = 'center';
  g.font = `italic 600 92px ${SERIF}`; g.fillStyle = INK; g.fillText('Espaço-Tempo', PW / 2, 470);
  g.strokeStyle = RED; g.lineWidth = 3; g.beginPath(); g.moveTo(PW / 2 - 230, 505); g.quadraticCurveTo(PW / 2, 520, PW / 2 + 230, 500); g.stroke();
  g.textAlign = 'left';
  spaced(g, 'LIÇÃO 1', PW / 2 - 70, 585, 24, RED, 6);
  g.textAlign = 'center';
  g.font = `400 36px ${SERIF}`; g.fillStyle = INK; g.fillText('Teoria da Relatividade', PW / 2, 645);
  g.font = `italic 400 26px ${SERIF}`; g.fillStyle = MUTED;
  g.fillText('Quando a luz dita as regras,', PW / 2, 760);
  g.fillText('o tempo deixa de ser de todos.', PW / 2, 798);
  g.font = `600 34px ${HAND}`; g.fillStyle = BLUE;
  g.fillText('um livro para tocar, girar e pensar', PW / 2, PH - 190);
  g.textAlign = 'left';
  // legenda das cores, que saiu do sumário
  spaced(g, 'AS CORES DESTE LIVRO', 150, 880, 16, RED, 3);
  KEYS.forEach(([col, txt], i) => {
    const kx = 150 + (i % 2) * 330, ky = 936 + Math.floor(i / 2) * 64;
    g.fillStyle = col; g.fillRect(kx, ky - 30, 46, 38);
    g.font = `400 26px ${SERIF}`; g.fillStyle = INK; g.textAlign = 'left'; g.fillText(txt, kx + 62, ky);
  });
  return tex(c);
}

/* Devolve também as faixas de cada linha do sumário para o toque na página. */
export function contentsRight(chapters) {
  const { c, g } = base('right');
  folio(g, 1, 'right');
  const x = 96, w = PW - 190;
  g.font = `700 60px ${SERIF}`; g.fillStyle = INK; g.fillText('Sumário', x, 220);
  let y = 320; const rows = [];
  chapters.forEach((ch, i) => {
    g.font = `400 21px ${SERIF}`; g.fillStyle = RED; g.fillText(String(i + 1), x, y);
    g.font = `500 31px ${SERIF}`; g.fillStyle = INK; g.fillText(ch.title, x + 40, y);
    const tw = g.measureText(ch.title).width;
    g.fillStyle = 'rgba(42,36,32,0.35)';
    for (let dx = x + 54 + tw; dx < x + w - 40; dx += 12) g.fillRect(dx, y - 4, 2.5, 2.5);
    g.font = `400 24px ${SERIF}`; g.fillStyle = MUTED; g.textAlign = 'right';
    g.fillText(String(ch.folio), x + w, y); g.textAlign = 'left';
    rows.push({ y0: y - 40, y1: y + 18, index: i + 1 });
    y += 68;
  });
  // retrato abaixo da lista, centralizado na página
  if (art) {
    const ih = 430, iw = ih * art.width / art.height, ix = (PW - iw) / 2, iy = 640;
    g.drawImage(art, ix, iy, iw, ih);
  }
  g.font = `italic 400 22px ${SERIF}`; g.fillStyle = MUTED;
  g.fillText('Toque num capítulo para abrir.', x, PH - 140);
  return { texture: tex(c), rows };
}
