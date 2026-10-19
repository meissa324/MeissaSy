// Excalidraw-style infinite canvas for the private moodboards.
// Scene is stored in moodboards.strokes as {v:2, elements:[...], view:{x,y,z}}.
(() => {
const boardNames = {main:'things with weight', quiet:'quietly becoming', surface:'under the surface'};
const GREEN = '#315b48';
const COLORS = ['#20251f','#315b48','#c9744c','#c95d52','#4b6a8c','#8a6fb0'];
const FILLS = ['transparent','#d4e38f','#e5d7ca','#d7e0d4','#d7dce4','#f3d1cc'];
const FONTS = {hand:'Caveat, "Comic Sans MS", cursive', sans:'"DM Sans", sans-serif'};
const SHAPES = ['rect','diamond','ellipse'];
const PROPS = {
  rect:['stroke','fill','sw','dash','rough'], diamond:['stroke','fill','sw','dash','rough'], ellipse:['stroke','fill','sw','dash','rough'],
  line:['stroke','sw','dash','rough'], arrow:['stroke','sw','dash','rough'], freedraw:['stroke','sw'],
  text:['stroke','font','fontSize'], image:[], video:[]
};
const ICON = {
  hand:'<path d="M8 13V6.5a1.5 1.5 0 013 0V12m0-5.5v-2a1.5 1.5 0 013 0V12m0-5a1.5 1.5 0 013 0v7a6 6 0 01-6 6h-.5a6 6 0 01-4.7-2.3L4 14.5a1.5 1.5 0 012.3-1.9L8 14"/>',
  select:'<path d="M5 3l14 7-6 2-2 6z"/>',
  rect:'<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  diamond:'<path d="M12 3l9 9-9 9-9-9z"/>',
  ellipse:'<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  arrow:'<path d="M5 19L19 5M10 5h9v9"/>',
  line:'<path d="M5 19L19 5"/>',
  draw:'<path d="M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19z"/><path d="M14 7l3 3"/>',
  text:'<path d="M6 6V4h12v2M12 4v16M9 20h6"/>',
  eraser:'<path d="M8 20h11M5.5 14.5l8-8a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8L11 19H8l-2.5-2.5a2 2 0 010-2z"/>',
  image:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
  video:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
  redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
  fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  front:'<rect x="9" y="9" width="11" height="11" rx="1.5" fill="currentColor" fill-opacity=".25"/><rect x="4" y="4" width="11" height="11" rx="1.5"/>',
  back:'<rect x="4" y="4" width="11" height="11" rx="1.5" fill="currentColor" fill-opacity=".25"/><rect x="9" y="9" width="11" height="11" rx="1.5"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  trash:'<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'
};
const svg = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
const TOOLS = [
  ['hand','Hand — pan (H)','h'], ['select','Select (V)','v'], ['rect','Rectangle (R)','r'], ['diamond','Diamond (D)','d'],
  ['ellipse','Ellipse (O)','o'], ['arrow','Arrow (A)','a'], ['line','Line (L)','l'], ['draw','Draw (P)','p'],
  ['text','Text (T)','t'], ['eraser','Eraser (E)','e']
];
const HOTKEYS = Object.fromEntries(TOOLS.map(([id,, key]) => [key, id]));
const CURSORS = {nw:'nwse-resize', se:'nwse-resize', ne:'nesw-resize', sw:'nesw-resize', n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize', p0:'crosshair', p1:'crosshair'};

const canvas = $('#xdCanvas'), ctx = canvas.getContext('2d'), stage = $('#moodStage'), ta = $('#xdText');
let boardId = 'main', catalog = {...boardNames};
let els = [], view = {x:0, y:0, z:1}, sel = new Set();
let tool = 'select', keepTool = false, spaceDown = false;
let style = {stroke:COLORS[0], fill:'transparent', sw:2, dash:'solid', rough:1, fontSize:28, font:'hand'};
let undoStack = [], redoStack = [], lastState = '[]';
let action = null, editing = null, hoverCursor = '', W = 0, H = 0, dpr = 1, raf = 0;
let saveTimer = 0, dirty = false, loaded = false;
const pointers = new Map(), media = new Map(), measureCache = new Map();

const uid = () => crypto.randomUUID();
const X = x => x * view.z + view.x, Y = y => y * view.z + view.y;
const toWorld = p => ({x:(p.x - view.x) / view.z, y:(p.y - view.y) / view.z});
const screenPt = e => { const r = canvas.getBoundingClientRect(); return {x:e.clientX - r.left, y:e.clientY - r.top}; };
const selected = () => els.filter(el => sel.has(el.id));
const isLinear = el => !!el.points;
const isSeg = el => (el.type === 'line' || el.type === 'arrow') && el.points.length === 2;
const isRich = el => el.type === 'text' || el.type === 'image' || el.type === 'video';
const render = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function toast(message, error = false) {
  const t = $('#xdToast');
  t.textContent = message; t.style.color = error ? 'var(--red)' : 'var(--ink)'; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), error ? 5000 : 2200);
}

/* ---------- geometry ---------- */
function textSize(el) {
  const key = el.font + '|' + el.fontSize + '|' + el.text;
  let m = measureCache.get(key);
  if (m) return m;
  ctx.save();
  ctx.font = `${el.fontSize}px ${FONTS[el.font] || FONTS.sans}`;
  const lines = el.text.split('\n');
  let w = 0;
  lines.forEach(l => { w = Math.max(w, ctx.measureText(l).width); });
  ctx.restore();
  m = {w:Math.ceil(w) + 2, h:Math.ceil(lines.length * el.fontSize * 1.25)};
  measureCache.set(key, m);
  return m;
}
function bounds(el) {
  if (el.type === 'text') { const s = textSize(el); return {x:el.x, y:el.y, w:s.w, h:s.h}; }
  if (el.points) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of el.points) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    return {x:el.x + x0, y:el.y + y0, w:x1 - x0, h:y1 - y0};
  }
  return {x:el.x, y:el.y, w:el.w, h:el.h};
}
function unionBounds(list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const el of list) { const b = bounds(el); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  return {x:x0, y:y0, w:x1 - x0, h:y1 - y0};
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function inPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function hit(el, x, y, tol) {
  if (isLinear(el)) {
    const pts = el.points.map(p => [el.x + p[0], el.y + p[1]]), t = tol + el.sw / 2;
    if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= t;
    for (let i = 1; i < pts.length; i++) if (distSeg(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= t) return true;
    return false;
  }
  const b = bounds(el), filled = el.fill && el.fill !== 'transparent';
  if (el.type === 'rect') {
    const out = x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
    if (!out) return false;
    if (filled) return true;
    return !(x > b.x + tol && x < b.x + b.w - tol && y > b.y + tol && y < b.y + b.h - tol);
  }
  if (el.type === 'ellipse') {
    const rx = b.w / 2 || 1, ry = b.h / 2 || 1, k = Math.hypot((x - b.x - rx) / rx, (y - b.y - ry) / ry);
    return filled ? k <= 1 + tol / Math.min(rx, ry) : Math.abs(k - 1) * Math.min(rx, ry) <= tol;
  }
  if (el.type === 'diamond') {
    const pts = [[b.x + b.w / 2, b.y], [b.x + b.w, b.y + b.h / 2], [b.x + b.w / 2, b.y + b.h], [b.x, b.y + b.h / 2]];
    if (filled && inPoly(x, y, pts)) return true;
    return pts.some((p, i) => { const q = pts[(i + 1) % 4]; return distSeg(x, y, p[0], p[1], q[0], q[1]) <= tol; });
  }
  return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
}
function topHit(wp) {
  const tol = 7 / view.z;
  for (let i = els.length - 1; i >= 0; i--) if (hit(els[i], wp.x, wp.y, tol)) return els[i];
  return null;
}

/* ---------- rendering ---------- */
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function roughLine(c, x1, y1, x2, y2, r) {
  const len = Math.hypot(x2 - x1, y2 - y1), j = Math.min(2, 0.4 + len * 0.01);
  const nx = len ? -(y2 - y1) / len : 0, ny = len ? (x2 - x1) / len : 0;
  for (let pass = 0; pass < 2; pass++) {
    const bow = (r() - .5) * j * 2.2;
    c.moveTo(x1 + (r() - .5) * j * 2, y1 + (r() - .5) * j * 2);
    c.quadraticCurveTo((x1 + x2) / 2 + nx * bow, (y1 + y2) / 2 + ny * bow, x2 + (r() - .5) * j * 2, y2 + (r() - .5) * j * 2);
  }
}
function roughEllipse(c, cx, cy, rx, ry, r) {
  const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const n = Math.max(20, Math.min(140, Math.round(per / 8))), j = Math.min(2.2, 0.4 + Math.min(rx, ry) * 0.02);
  for (let pass = 0; pass < 2; pass++) {
    const a0 = r() * 6.2832, p1 = r() * 6.2832, p2 = r() * 6.2832;
    for (let i = 0; i <= n + 2; i++) {
      const a = a0 + i / n * 6.2832, off = j * (Math.sin(2 * a + p1) * .7 + Math.sin(3 * a + p2) * .5);
      const px = cx + Math.cos(a) * (rx + off), py = cy + Math.sin(a) * (ry + off);
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
  }
}
function shapePath(c, el) {
  const {x, y, w, h} = el;
  if (el.type === 'ellipse') { c.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 6.2832); return; }
  const pts = el.type === 'rect' ? [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] : [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]];
  pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
  c.closePath();
}
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function dashFor(el) {
  return el.dash === 'dashed' ? [el.sw * 4, el.sw * 3] : el.dash === 'dotted' ? [0.1, el.sw * 2.4] : [];
}
function drawEl(c, el) {
  c.save();
  c.lineWidth = el.sw || 2; c.strokeStyle = el.stroke; c.fillStyle = el.fill || 'transparent'; c.lineCap = 'round'; c.lineJoin = 'round';
  const r = rng(el.seed);
  if (SHAPES.includes(el.type)) {
    if (el.fill && el.fill !== 'transparent') { c.beginPath(); shapePath(c, el); c.fill(); }
    c.setLineDash(dashFor(el)); c.beginPath();
    if (!el.rough) shapePath(c, el);
    else if (el.type === 'ellipse') roughEllipse(c, el.x + el.w / 2, el.y + el.h / 2, Math.abs(el.w / 2), Math.abs(el.h / 2), r);
    else {
      const {x, y, w, h} = el;
      const pts = el.type === 'rect' ? [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] : [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]];
      pts.forEach((p, i) => { const q = pts[(i + 1) % 4]; roughLine(c, p[0], p[1], q[0], q[1], r); });
    }
    c.stroke();
  } else if (el.type === 'line' || el.type === 'arrow') {
    const pts = el.points.map(p => [el.x + p[0], el.y + p[1]]);
    c.setLineDash(dashFor(el)); c.beginPath();
    if (el.rough && pts.length === 2) roughLine(c, pts[0][0], pts[0][1], pts[1][0], pts[1][1], r);
    else pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
    c.stroke();
    if (el.type === 'arrow' && pts.length > 1) {
      const p = pts[pts.length - 1], q = pts[pts.length - 2], a = Math.atan2(p[1] - q[1], p[0] - q[0]), L = Math.max(12, el.sw * 5);
      c.setLineDash([]); c.beginPath();
      c.moveTo(p[0] - L * Math.cos(a - .45), p[1] - L * Math.sin(a - .45)); c.lineTo(p[0], p[1]); c.lineTo(p[0] - L * Math.cos(a + .45), p[1] - L * Math.sin(a + .45));
      c.stroke();
    }
  } else if (el.type === 'freedraw') {
    const pts = el.points.map(p => [el.x + p[0], el.y + p[1]]);
    if (pts.length === 1) { c.fillStyle = el.stroke; c.beginPath(); c.arc(pts[0][0], pts[0][1], el.sw / 2 + .5, 0, 6.2832); c.fill(); }
    else {
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); c.stroke();
    }
  } else if (el.type === 'text') {
    c.fillStyle = el.stroke; c.font = `${el.fontSize}px ${FONTS[el.font] || FONTS.sans}`; c.textBaseline = 'middle';
    const lh = el.fontSize * 1.25;
    el.text.split('\n').forEach((line, i) => c.fillText(line, el.x, el.y + (i + .5) * lh));
  } else if (el.type === 'image' || el.type === 'video') {
    const node = getMedia(el);
    rr(c, el.x, el.y, el.w, el.h, 6);
    c.save(); c.clip();
    if (node) c.drawImage(node, el.x, el.y, el.w, el.h);
    else { c.fillStyle = '#e8eae2'; c.fillRect(el.x, el.y, el.w, el.h); }
    c.restore();
    if (el.type === 'video') {
      const cx = el.x + el.w / 2, cy = el.y + el.h / 2, rad = Math.min(el.w, el.h) * .14;
      c.fillStyle = '#20251fb0'; c.beginPath(); c.arc(cx, cy, rad, 0, 6.2832); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(cx - rad * .3, cy - rad * .5); c.lineTo(cx + rad * .55, cy); c.lineTo(cx - rad * .3, cy + rad * .5); c.closePath(); c.fill();
    }
    c.strokeStyle = '#cfd3c8'; c.lineWidth = 1; rr(c, el.x, el.y, el.w, el.h, 6); c.stroke();
  }
  c.restore();
}
function drawGrid() {
  const s = 24 * view.z;
  if (s < 9) return;
  ctx.fillStyle = '#d8ddd4';
  const x0 = ((view.x % s) + s) % s, y0 = ((view.y % s) + s) % s, d = Math.max(1.2, view.z * 1.4);
  for (let x = x0; x < W; x += s) for (let y = y0; y < H; y += s) ctx.fillRect(x - d / 2, y - d / 2, d, d);
}
function handleLayout() {
  const S = selected();
  if (!S.length || editing) return null;
  if (S.length === 1 && isSeg(S[0])) {
    const e = S[0];
    return {handles:{p0:[X(e.x + e.points[0][0]), Y(e.y + e.points[0][1])], p1:[X(e.x + e.points[1][0]), Y(e.y + e.points[1][1])]}, box:null};
  }
  const b = unionBounds(S), pad = 6, x0 = X(b.x) - pad, y0 = Y(b.y) - pad, x1 = X(b.x + b.w) + pad, y1 = Y(b.y + b.h) + pad, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const handles = {nw:[x0, y0], ne:[x1, y0], se:[x1, y1], sw:[x0, y1]};
  if (!S.some(isRich)) Object.assign(handles, {n:[mx, y0], s:[mx, y1], w:[x0, my], e:[x1, my]});
  return {handles, box:[x0, y0, x1 - x0, y1 - y0]};
}
function drawOverlay() {
  const S = selected(), layout = handleLayout();
  if (S.length > 1) {
    ctx.save(); ctx.strokeStyle = GREEN + '88'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    S.forEach(el => { const b = bounds(el); ctx.strokeRect(X(b.x) - 3, Y(b.y) - 3, b.w * view.z + 6, b.h * view.z + 6); });
    ctx.restore();
  }
  if (layout) {
    ctx.save(); ctx.strokeStyle = GREEN; ctx.fillStyle = '#fff'; ctx.lineWidth = 1.5;
    if (layout.box) { ctx.setLineDash(S.length === 1 && isSeg(S[0]) ? [] : [5, 4]); ctx.strokeRect(...layout.box); ctx.setLineDash([]); }
    for (const [name, [hx, hy]] of Object.entries(layout.handles)) {
      ctx.beginPath();
      if (name[0] === 'p') ctx.arc(hx, hy, 5.5, 0, 6.2832); else ctx.rect(hx - 4.5, hy - 4.5, 9, 9);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  if (action && action.type === 'marquee') {
    const a = action, x = Math.min(a.s.x, a.c.x), y = Math.min(a.s.y, a.c.y);
    ctx.save(); ctx.fillStyle = GREEN + '14'; ctx.strokeStyle = GREEN; ctx.lineWidth = 1;
    ctx.fillRect(x, y, Math.abs(a.c.x - a.s.x), Math.abs(a.c.y - a.s.y)); ctx.strokeRect(x, y, Math.abs(a.c.x - a.s.x), Math.abs(a.c.y - a.s.y));
    ctx.restore();
  }
}
function draw() {
  if (!W) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawGrid();
  ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.z, view.z);
  const vx0 = -view.x / view.z, vy0 = -view.y / view.z, vx1 = vx0 + W / view.z, vy1 = vy0 + H / view.z;
  for (const el of els) {
    if (editing && editing.el === el) continue;
    const b = bounds(el), m = 20 + (el.sw || 0);
    if (b.x > vx1 + m || b.y > vy1 + m || b.x + b.w < vx0 - m || b.y + b.h < vy0 - m) continue;
    drawEl(ctx, el);
  }
  ctx.restore();
  drawOverlay();
}
function resize() {
  const r = stage.getBoundingClientRect();
  if (!r.width) return;
  dpr = window.devicePixelRatio || 1; W = r.width; H = r.height;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  draw();
}
new ResizeObserver(resize).observe(stage);
if (document.fonts) { document.fonts.addEventListener('loadingdone', () => { measureCache.clear(); render(); }); document.fonts.load('28px Caveat'); }

/* ---------- media ---------- */
async function signedUrl(path) {
  if (/^https?:/.test(path)) return path;
  const {data, error} = await db.storage.from('moodboard-media').createSignedUrl(path, 3600);
  if (error) { toast(error.message, true); return ''; }
  return data.signedUrl;
}
function getMedia(el) {
  const known = media.get(el.id);
  if (known) return known.node;
  const m = {node:null};
  media.set(el.id, m);
  (async () => {
    const url = el.yt ? `https://i.ytimg.com/vi/${el.yt}/hqdefault.jpg` : await signedUrl(el.path);
    if (!url) return;
    const ready = (node, nw, nh) => {
      m.node = node;
      if (!el.w || !el.h) { const s = Math.min(1, 320 / Math.max(nw, nh)); el.w = Math.round(nw * s); el.h = Math.round(nh * s); lastState = JSON.stringify(els); scheduleSave(); }
      render();
    };
    if (el.type === 'video' && !el.yt) {
      const v = document.createElement('video');
      v.muted = true; v.preload = 'auto'; v.playsInline = true;
      v.onloadeddata = () => { v.currentTime = 0.1; };
      v.onseeked = () => ready(v, v.videoWidth, v.videoHeight);
      v.src = url;
    } else {
      const im = new Image();
      im.onload = () => ready(im, im.naturalWidth, im.naturalHeight);
      im.src = url;
    }
  })();
  return null;
}
function naturalSize(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), done = (w, h) => { URL.revokeObjectURL(url); resolve({w, h}); };
    if (file.type.startsWith('video/')) { const v = document.createElement('video'); v.onloadedmetadata = () => done(v.videoWidth, v.videoHeight); v.onerror = () => done(320, 180); v.src = url; }
    else { const im = new Image(); im.onload = () => done(im.naturalWidth, im.naturalHeight); im.onerror = () => done(300, 200); im.src = url; }
  });
}
function viewCenter() { return toWorld({x:W / 2, y:H / 2}); }
async function addFile(file, at) {
  if (!db || !currentUser) return toast('Sign in to add images and videos.', true);
  if (!/^(image|video)\//.test(file.type)) return;
  toast('Uploading…');
  const path = currentUser.id + '/' + uid() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const {error} = await db.storage.from('moodboard-media').upload(path, file);
  if (error) return toast(error.message, true);
  const nat = await naturalSize(file), s = Math.min(1, 360 / Math.max(nat.w, nat.h, 1));
  const w = Math.max(40, Math.round(nat.w * s)), h = Math.max(40, Math.round(nat.h * s)), c = at || viewCenter();
  const el = mk(file.type.startsWith('video/') ? 'video' : 'image', {x:Math.round(c.x - w / 2), y:Math.round(c.y - h / 2), w, h, path, fill:'transparent'});
  els.push(el); sel = new Set([el.id]); commit(); render(); toast('Added');
}
function addYouTube(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (!m) return false;
  const c = viewCenter(), el = mk('video', {x:Math.round(c.x - 160), y:Math.round(c.y - 90), w:320, h:180, yt:m[1], fill:'transparent'});
  els.push(el); sel = new Set([el.id]); commit(); render();
  return true;
}
function openMedia(el) {
  const box = $('#mediaBox');
  box.innerHTML = '';
  if (el.yt) {
    const f = document.createElement('iframe'); f.src = `https://www.youtube.com/embed/${el.yt}?autoplay=1`; f.allow = 'autoplay; encrypted-media; fullscreen'; f.allowFullscreen = true; box.append(f);
    $('#mediaModal').classList.add('open');
  } else {
    signedUrl(el.path).then(url => {
      if (!url) return;
      const v = document.createElement('video'); v.src = url; v.controls = true; v.autoplay = true; box.append(v);
      $('#mediaModal').classList.add('open');
    });
  }
}
function closeMedia() { $('#mediaModal').classList.remove('open'); $('#mediaBox').innerHTML = ''; }
$('#mediaModal').addEventListener('click', e => { if (e.target.id === 'mediaModal' || e.target.closest('.close')) closeMedia(); });

/* ---------- elements / history / persistence ---------- */
function mk(type, props = {}) {
  const linear = type === 'line' || type === 'arrow' || type === 'freedraw';
  return {
    id:uid(), type, x:0, y:0, w:0, h:0, seed:Math.random() * 2 ** 31 | 0,
    stroke:style.stroke, fill:SHAPES.includes(type) ? style.fill : 'transparent', sw:style.sw, dash:style.dash, rough:style.rough,
    ...(type === 'text' ? {text:'', fontSize:style.fontSize, font:style.font} : {}),
    ...(linear ? {points:[[0, 0]]} : {}),
    ...props
  };
}
function commit() {
  const s = JSON.stringify(els);
  if (s === lastState) { updateUI(); return; }
  undoStack.push(lastState); if (undoStack.length > 150) undoStack.shift();
  redoStack.length = 0; lastState = s;
  scheduleSave(); updateUI();
}
function restore(state) {
  els = JSON.parse(state); lastState = state;
  sel = new Set([...sel].filter(id => els.some(e => e.id === id)));
  scheduleSave(); updateUI(); render();
}
function undo() { if (action || editing || !undoStack.length) return; redoStack.push(lastState); restore(undoStack.pop()); }
function redo() { if (action || editing || !redoStack.length) return; undoStack.push(lastState); restore(redoStack.pop()); }
function setSaveState(text) { $('#xdSave').textContent = text; }
function scheduleSave() { dirty = true; setSaveState('SAVING…'); clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 700); }
async function flushSave() {
  clearTimeout(saveTimer);
  if (!dirty || !db || !loaded) return;
  dirty = false;
  const {error} = await db.from('moodboards').update({strokes:{v:2, elements:els, view}}).eq('id', boardId);
  if (error) { dirty = true; setSaveState('NOT SAVED'); toast(error.message, true); } else setSaveState('SAVED');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

async function migrateLegacy(strokes) {
  const out = [];
  strokes.forEach(stroke => {
    if (!Array.isArray(stroke) || !stroke.length) return;
    const x = stroke[0].x, y = stroke[0].y;
    out.push(mk('freedraw', {x, y, stroke:GREEN, sw:3, rough:0, points:stroke.map(p => [p.x - x, p.y - y])}));
  });
  const {data} = await db.from('moodboard_items').select('*').eq('board_id', boardId).order('created_at', {ascending:true});
  (data || []).forEach(item => {
    const yt = item.body.match(/youtube\.com\/embed\/([A-Za-z0-9_-]+)/);
    if (item.kind === 'text') out.push(mk('text', {x:item.x, y:item.y, text:item.body, font:'sans', fontSize:20}));
    else if (yt) out.push(mk('video', {x:item.x, y:item.y, w:320, h:180, yt:yt[1], fill:'transparent'}));
    else out.push(mk(item.kind, {x:item.x, y:item.y, w:0, h:0, path:item.body, fill:'transparent'}));
  });
  return out;
}
async function loadMoodboard() {
  if (!db) return;
  const {data:rows, error} = await db.from('moodboards').select('id,title,strokes').order('created_at', {ascending:true});
  if (error) return toast(error.message, true);
  if (!rows.length) {
    const defaults = Object.entries(boardNames).map(([id, title]) => ({id, title, strokes:[]}));
    const {data:created, error:createError} = await db.from('moodboards').insert(defaults).select('id,title,strokes');
    if (createError) return toast(createError.message, true);
    rows.push(...created);
  }
  catalog = Object.fromEntries(rows.map(row => [row.id, row.title]));
  if (!catalog[boardId]) boardId = rows[0].id;
  let scene = rows.find(row => row.id === boardId).strokes, migrated = false;
  if (Array.isArray(scene)) { scene = {v:2, elements:await migrateLegacy(scene), view:{x:0, y:0, z:1}}; migrated = true; }
  loaded = false; media.clear();
  els = scene.elements || []; view = scene.view || {x:0, y:0, z:1}; sel = new Set();
  undoStack = []; redoStack = []; lastState = JSON.stringify(els); action = null; editing = null; ta.hidden = true;
  loaded = true;
  renderBoardList(); updateUI(); render();
  if (migrated) { dirty = true; flushSave(); }
}
window.loadMoodboard = loadMoodboard;

function renderBoardList() {
  const list = $('#boardList'); list.innerHTML = '';
  Object.entries(catalog).forEach(([id, title]) => {
    const b = document.createElement('button');
    b.textContent = title; b.className = id === boardId ? 'active' : '';
    b.onclick = async () => { if (id === boardId) return; await flushSave(); boardId = id; await loadMoodboard(); };
    list.append(b);
  });
  $('#boardTitle').textContent = (catalog[boardId] || 'untitled').toUpperCase();
}
$('#newBoard').onclick = async () => {
  const title = prompt('Name your new canvas:');
  if (!title?.trim() || !db) return;
  await flushSave();
  const id = 'board-' + uid();
  const {error} = await db.from('moodboards').insert({id, title:title.trim(), strokes:{v:2, elements:[], view:{x:0, y:0, z:1}}});
  if (error) return toast(error.message, true);
  boardId = id; await loadMoodboard();
};

/* ---------- text editing ---------- */
function layoutTextarea() {
  const el = editing.el, s = textSize({...el, text:ta.value || ' '});
  ta.style.left = X(el.x) + 'px'; ta.style.top = Y(el.y) + 'px';
  ta.style.font = `${el.fontSize * view.z}px ${FONTS[el.font] || FONTS.sans}`; ta.style.lineHeight = '1.25';
  ta.style.color = el.stroke;
  ta.style.width = (s.w * view.z + 24) + 'px'; ta.style.height = (s.h * view.z + 2) + 'px';
}
function startText(el) {
  editing = {el}; ta.hidden = false; ta.value = el.text;
  layoutTextarea(); render();
  setTimeout(() => ta.focus(), 0);
}
function commitText() {
  if (!editing) return;
  const el = editing.el; editing = null; ta.hidden = true;
  el.text = ta.value.replace(/\s+$/, '');
  if (!el.text.trim()) { els = els.filter(x => x !== el); sel.delete(el.id); }
  else { sel = new Set([el.id]); if (!keepTool) tool = 'select'; }
  commit(); render();
}
ta.addEventListener('input', () => { editing.el.text = ta.value; layoutTextarea(); });
ta.addEventListener('blur', commitText);
ta.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) { e.preventDefault(); commitText(); }
});

/* ---------- tools & selection UI ---------- */
function setTool(t) {
  commitText();
  tool = t;
  if (t !== 'select' && t !== 'hand') sel = new Set();
  updateUI(); render();
}
function updateCursor(p) {
  let c = 'default';
  if (spaceDown || tool === 'hand') c = action && action.type === 'pan' ? 'grabbing' : 'grab';
  else if (action && action.type === 'move') c = 'move';
  else if (tool === 'select') {
    const h = p && !action ? handleAt(p) : null;
    c = h ? CURSORS[h] : p && !action && topHit(toWorld(p)) ? 'move' : 'default';
  } else c = tool === 'text' ? 'text' : 'crosshair';
  if (c !== hoverCursor) canvas.style.cursor = hoverCursor = c;
}
function handleAt(p) {
  const layout = handleLayout();
  if (!layout) return null;
  for (const [name, [hx, hy]] of Object.entries(layout.handles)) if (Math.abs(p.x - hx) <= 8 && Math.abs(p.y - hy) <= 8) return name;
  return null;
}
function buildToolbar() {
  const bar = $('#xdTools');
  bar.innerHTML = `<button class="xd-btn" id="xdLock" title="Keep tool active (Q)">${svg('lock')}</button><span class="xd-sep"></span>` +
    TOOLS.map(([id, title]) => `<button class="xd-btn" data-tool="${id}" title="${title}">${svg(id)}</button>`).join('') +
    `<span class="xd-sep"></span><button class="xd-btn" id="xdImage" title="Add image or video file (I)">${svg('image')}</button><button class="xd-btn" id="xdVideo" title="Add YouTube link">${svg('video')}</button>`;
  bar.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) setTool(b.dataset.tool);
    else if (b.id === 'xdLock') { keepTool = !keepTool; updateUI(); }
    else if (b.id === 'xdImage') $('#mediaFile').click();
    else if (b.id === 'xdVideo') { const url = prompt('Paste a YouTube video link:'); if (url && !addYouTube(url)) toast('That does not look like a YouTube link.', true); }
  };
  $('#xdZoom').innerHTML = `<button class="xd-btn" data-z="out" title="Zoom out">−</button><button class="xd-btn xd-pct" data-z="reset" title="Reset zoom to 100%"></button><button class="xd-btn" data-z="in" title="Zoom in">+</button><button class="xd-btn" data-z="fit" title="Fit all content (F)">${svg('fit', 18)}</button><span class="xd-sep"></span><button class="xd-btn" data-z="undo" title="Undo (Ctrl+Z)">${svg('undo', 18)}</button><button class="xd-btn" data-z="redo" title="Redo (Ctrl+Shift+Z)">${svg('redo', 18)}</button>`;
  $('#xdZoom').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.z;
    if (k === 'in') zoomAt({x:W / 2, y:H / 2}, 1.25); else if (k === 'out') zoomAt({x:W / 2, y:H / 2}, .8);
    else if (k === 'reset') zoomTo({x:W / 2, y:H / 2}, 1); else if (k === 'fit') fitContent();
    else if (k === 'undo') undo(); else redo();
  };
  const swatch = (k, v, inner) => `<button class="xd-sw" data-k="${k}" data-v="${esc(JSON.stringify(v))}" title="${esc(v)}">${inner}</button>`;
  const opt = (k, v, label) => `<button class="xd-opt" data-k="${k}" data-v="${esc(JSON.stringify(v))}">${label}</button>`;
  $('#xdProps').innerHTML =
    `<div data-sec="stroke"><div class="xd-label">STROKE</div><div class="xd-row">${COLORS.map(c => swatch('stroke', c, `<i style="background:${c}"></i>`)).join('')}</div></div>` +
    `<div data-sec="fill"><div class="xd-label">BACKGROUND</div><div class="xd-row">${FILLS.map(c => swatch('fill', c, `<i class="${c === 'transparent' ? 'none' : ''}" style="background:${c === 'transparent' ? '' : c}"></i>`)).join('')}</div></div>` +
    `<div data-sec="sw"><div class="xd-label">STROKE WIDTH</div><div class="xd-row">${opt('sw', 1, '<b style="height:1px"></b>')}${opt('sw', 2, '<b style="height:2px"></b>')}${opt('sw', 4, '<b style="height:4px"></b>')}</div></div>` +
    `<div data-sec="dash"><div class="xd-label">STROKE STYLE</div><div class="xd-row">${opt('dash', 'solid', '—')}${opt('dash', 'dashed', '- -')}${opt('dash', 'dotted', '···')}</div></div>` +
    `<div data-sec="rough"><div class="xd-label">SLOPPINESS</div><div class="xd-row">${opt('rough', 0, 'Clean')}${opt('rough', 1, 'Sketchy')}</div></div>` +
    `<div data-sec="font"><div class="xd-label">FONT</div><div class="xd-row">${opt('font', 'hand', '<span style="font-family:Caveat,cursive;font-size:17px">Hand</span>')}${opt('font', 'sans', 'Sans')}</div></div>` +
    `<div data-sec="fontSize"><div class="xd-label">SIZE</div><div class="xd-row">${opt('fontSize', 20, 'S')}${opt('fontSize', 28, 'M')}${opt('fontSize', 40, 'L')}${opt('fontSize', 64, 'XL')}</div></div>` +
    `<div data-sec="layers"><div class="xd-label">ACTIONS</div><div class="xd-row"><button class="xd-opt" data-act="back" title="Send to back ([)">${svg('back', 16)}</button><button class="xd-opt" data-act="front" title="Bring to front (])">${svg('front', 16)}</button><button class="xd-opt" data-act="dup" title="Duplicate (Ctrl+D)">${svg('copy', 16)}</button><button class="xd-opt" data-act="del" title="Delete (Del)">${svg('trash', 16)}</button></div></div>`;
  $('#xdProps').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) applyProp(b.dataset.k, JSON.parse(b.dataset.v));
    else if (b.dataset.act === 'front') reorder(true); else if (b.dataset.act === 'back') reorder(false);
    else if (b.dataset.act === 'dup') duplicate(); else if (b.dataset.act === 'del') deleteSel();
  };
}
function activeKinds() {
  const S = selected();
  if (S.length) return new Set(S.map(e => e.type));
  const t = tool === 'draw' ? 'freedraw' : tool;
  return PROPS[t] ? new Set([t]) : new Set();
}
function updateProps() {
  const kinds = activeKinds(), allowed = new Set([...kinds].flatMap(k => PROPS[k] || [])), S = selected();
  $('#xdProps').hidden = !kinds.size;
  $$('#xdProps [data-sec]').forEach(sec => { sec.hidden = sec.dataset.sec === 'layers' ? !S.length : !allowed.has(sec.dataset.sec); });
  const cur = k => { const el = S.find(e => (PROPS[e.type] || []).includes(k)); return el ? el[k] : style[k]; };
  $$('#xdProps [data-k]').forEach(b => b.classList.toggle('on', cur(b.dataset.k) === JSON.parse(b.dataset.v)));
}
function updateUI() {
  $$('#xdTools [data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  $('#xdLock').classList.toggle('active', keepTool);
  $('#xdZoom .xd-pct').textContent = Math.round(view.z * 100) + '%';
  $('#xdZoom [data-z="undo"]').disabled = !undoStack.length; $('#xdZoom [data-z="redo"]').disabled = !redoStack.length;
  $('#moodEmpty').style.display = els.length ? 'none' : 'block';
  updateProps(); updateCursor();
}
function applyProp(k, v) {
  style[k] = v;
  const S = selected();
  S.forEach(el => { if ((PROPS[el.type] || []).includes(k)) el[k] = v; });
  if (S.length) commit();
  if (editing) layoutTextarea();
  updateProps(); render();
}
function reorder(front) {
  const S = selected(); if (!S.length) return;
  const rest = els.filter(e => !sel.has(e.id));
  els = front ? [...rest, ...S] : [...S, ...rest];
  commit(); render();
}
function duplicate() {
  const S = selected(); if (!S.length) return;
  const copies = S.map(el => ({...structuredClone(el), id:uid(), seed:Math.random() * 2 ** 31 | 0, x:el.x + 20, y:el.y + 20}));
  els.push(...copies); sel = new Set(copies.map(c => c.id)); commit(); render();
}
function deleteSel() {
  if (!sel.size) return;
  els = els.filter(e => !sel.has(e.id)); sel = new Set(); commit(); render();
}

/* ---------- view ---------- */
function zoomTo(p, z) {
  z = Math.max(.1, Math.min(5, z));
  const w = toWorld(p);
  view.z = z; view.x = p.x - w.x * z; view.y = p.y - w.y * z;
  scheduleSave(); updateUI(); render();
  if (editing) layoutTextarea();
}
const zoomAt = (p, f) => zoomTo(p, view.z * f);
function fitContent() {
  if (!els.length) { view = {x:0, y:0, z:1}; scheduleSave(); updateUI(); render(); return; }
  const b = unionBounds(els), pad = 60, z = Math.max(.1, Math.min(1.5, Math.min((W - pad * 2) / Math.max(b.w, 1), (H - pad * 2) / Math.max(b.h, 1))));
  view = {z, x:W / 2 - (b.x + b.w / 2) * z, y:H / 2 - (b.y + b.h / 2) * z};
  scheduleSave(); updateUI(); render();
}
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  commitText();
  const p = screenPt(e);
  if (e.ctrlKey || e.metaKey) zoomAt(p, Math.exp(-e.deltaY * .01));
  else { view.x -= e.deltaX; view.y -= e.deltaY; scheduleSave(); render(); }
}, {passive:false});

/* ---------- pointer interaction ---------- */
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  commitText();
  const p = screenPt(e), w = toWorld(p);
  pointers.set(e.pointerId, p);
  canvas.setPointerCapture(e.pointerId);
  if (pointers.size === 2) {
    if (action && action.el && (action.type === 'create' || action.type === 'draw')) els = els.filter(x => x !== action.el);
    const [a, b] = [...pointers.values()];
    action = {type:'pinch', dist:Math.hypot(a.x - b.x, a.y - b.y), mid:{x:(a.x + b.x) / 2, y:(a.y + b.y) / 2}, view:{...view}};
    return;
  }
  if (pointers.size > 2) return;
  if (e.button === 1 || tool === 'hand' || spaceDown) { action = {type:'pan', s:p, view:{...view}}; updateCursor(p); return; }
  if (e.button !== 0) return;
  if (tool === 'select') {
    const h = handleAt(p);
    if (h) {
      const S = selected();
      action = h[0] === 'p'
        ? {type:'point', idx:+h[1], el:S[0], orig:structuredClone(S[0])}
        : {type:'resize', h, ob:unionBounds(S), orig:new Map(S.map(el => [el.id, structuredClone(el)])), uniform:S.some(isRich) || e.shiftKey};
      return;
    }
    const el = topHit(w);
    if (el) {
      if (e.shiftKey) { if (sel.has(el.id)) sel.delete(el.id); else sel.add(el.id); }
      else if (!sel.has(el.id)) sel = new Set([el.id]);
      const S = selected();
      action = S.length ? {type:'move', s:w, orig:new Map(S.map(x => [x.id, {x:x.x, y:x.y}])), moved:false} : null;
    } else {
      if (!e.shiftKey) sel = new Set();
      action = {type:'marquee', s:p, c:p, base:new Set(sel)};
    }
    updateUI(); render(); return;
  }
  if (SHAPES.includes(tool) || tool === 'arrow' || tool === 'line') {
    const el = mk(tool, {x:w.x, y:w.y});
    if (tool === 'arrow' || tool === 'line') el.points = [[0, 0], [0, 0]];
    els.push(el); action = {type:'create', el, s:w}; render(); return;
  }
  if (tool === 'draw') {
    const el = mk('freedraw', {x:w.x, y:w.y}); els.push(el); action = {type:'draw', el}; render(); return;
  }
  if (tool === 'text') {
    const existing = topHit(w);
    if (existing && existing.type === 'text') { startText(existing); return; }
    const el = mk('text', {x:w.x, y:w.y - style.fontSize * .625}); els.push(el); startText(el); return;
  }
  if (tool === 'eraser') { action = {type:'erase', erased:false}; eraseAt(w); }
});

function eraseAt(w) {
  const el = topHit(w);
  if (!el) return;
  els = els.filter(x => x !== el); sel.delete(el.id); action.erased = true; render();
}

canvas.addEventListener('pointermove', e => {
  const p = screenPt(e), w = toWorld(p);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
  if (!action) { updateCursor(p); return; }
  const a = action;
  switch (a.type) {
    case 'pinch': {
      const [p1, p2] = [...pointers.values()]; if (!p2) break;
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y), mid = {x:(p1.x + p2.x) / 2, y:(p1.y + p2.y) / 2};
      const z = Math.max(.1, Math.min(5, a.view.z * dist / (a.dist || 1)));
      const wx = (a.mid.x - a.view.x) / a.view.z, wy = (a.mid.y - a.view.y) / a.view.z;
      view = {z, x:mid.x - wx * z, y:mid.y - wy * z}; $('#xdZoom .xd-pct').textContent = Math.round(z * 100) + '%'; scheduleSave();
      break;
    }
    case 'pan': view = {...a.view, x:a.view.x + p.x - a.s.x, y:a.view.y + p.y - a.s.y}; break;
    case 'move': {
      const dx = w.x - a.s.x, dy = w.y - a.s.y;
      if (!a.moved && Math.hypot(dx, dy) * view.z < 3) break;
      a.moved = true;
      selected().forEach(el => { const o = a.orig.get(el.id); el.x = o.x + dx; el.y = o.y + dy; });
      break;
    }
    case 'marquee': {
      a.c = p;
      const x0 = Math.min(a.s.x, p.x), x1 = Math.max(a.s.x, p.x), y0 = Math.min(a.s.y, p.y), y1 = Math.max(a.s.y, p.y);
      sel = new Set(a.base);
      els.forEach(el => { const b = bounds(el); if (X(b.x) >= x0 && X(b.x + b.w) <= x1 && Y(b.y) >= y0 && Y(b.y + b.h) <= y1) sel.add(el.id); });
      updateProps();
      break;
    }
    case 'create': {
      const el = a.el;
      if (el.points) {
        let dx = w.x - el.x, dy = w.y - el.y;
        if (e.shiftKey) { const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12), len = Math.hypot(dx, dy); dx = Math.cos(ang) * len; dy = Math.sin(ang) * len; }
        el.points = [[0, 0], [dx, dy]];
      } else {
        let dx = w.x - a.s.x, dy = w.y - a.s.y;
        if (e.shiftKey) { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m; }
        el.x = Math.min(a.s.x, a.s.x + dx); el.y = Math.min(a.s.y, a.s.y + dy); el.w = Math.abs(dx); el.h = Math.abs(dy);
      }
      break;
    }
    case 'draw': {
      const el = a.el, last = el.points[el.points.length - 1], px = w.x - el.x, py = w.y - el.y;
      if (Math.hypot(px - last[0], py - last[1]) * view.z > 1.2) el.points.push([px, py]);
      break;
    }
    case 'point': {
      const el = a.el, other = a.orig.points[1 - a.idx];
      let px = w.x - el.x, py = w.y - el.y;
      if (e.shiftKey) { const dx = px - other[0], dy = py - other[1], ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12), len = Math.hypot(dx, dy); px = other[0] + Math.cos(ang) * len; py = other[1] + Math.sin(ang) * len; }
      el.points[a.idx] = [px, py];
      break;
    }
    case 'resize': doResize(a, w, e.shiftKey); break;
    case 'erase': eraseAt(w); break;
  }
  if (editing) layoutTextarea();
  render();
});

function doResize(a, w, shift) {
  const ob = a.ob;
  let x0 = ob.x, y0 = ob.y, x1 = ob.x + ob.w, y1 = ob.y + ob.h;
  if (a.h.includes('w')) x0 = w.x; if (a.h.includes('e')) x1 = w.x;
  if (a.h.includes('n')) y0 = w.y; if (a.h.includes('s')) y1 = w.y;
  const MIN = 4;
  if (a.uniform && a.h.length === 2) {
    const s = Math.max(MIN / Math.max(ob.w, 1), Math.abs(x1 - x0) / Math.max(ob.w, 1), Math.abs(y1 - y0) / Math.max(ob.h, 1)) ;
    const nw = Math.max(ob.w, 1) * s, nh = Math.max(ob.h, 1) * s;
    if (a.h.includes('w')) x0 = ob.x + ob.w - nw; else x1 = ob.x + nw;
    if (a.h.includes('n')) y0 = ob.y + ob.h - nh; else y1 = ob.y + nh;
  }
  if (x1 - x0 < MIN) { if (a.h.includes('w')) x0 = x1 - MIN; else x1 = x0 + MIN; }
  if (y1 - y0 < MIN) { if (a.h.includes('n')) y0 = y1 - MIN; else y1 = y0 + MIN; }
  const sx = ob.w ? (x1 - x0) / ob.w : 1, sy = ob.h ? (y1 - y0) / ob.h : 1;
  selected().forEach(el => {
    const o = a.orig.get(el.id);
    if (o.points) {
      el.points = o.points.map(pt => [(x0 + (o.x + pt[0] - ob.x) * sx) - o.x, (y0 + (o.y + pt[1] - ob.y) * sy) - o.y]);
    } else {
      el.x = x0 + (o.x - ob.x) * sx; el.y = y0 + (o.y - ob.y) * sy;
      if (o.type === 'text') el.fontSize = Math.max(8, Math.round(o.fontSize * (sx + sy) / 2));
      else { el.w = o.w * sx; el.h = o.h * sy; }
    }
  });
}

function endPointer(e) {
  pointers.delete(e.pointerId);
  const a = action;
  if (!a) return;
  if (a.type === 'pinch') { if (pointers.size < 2) { action = null; updateUI(); } return; }
  action = null;
  if (a.type === 'create') {
    const el = a.el, ok = el.points ? Math.hypot(...el.points[1]) > 3 : el.w > 3 || el.h > 3;
    if (!ok) els = els.filter(x => x !== el);
    else { sel = new Set([el.id]); if (!keepTool) tool = 'select'; commit(); }
  } else if (a.type === 'draw') {
    sel = new Set([a.el.id]); if (!keepTool) tool = 'select'; commit();
  } else if (a.type === 'move' || a.type === 'resize' || a.type === 'point') commit();
  else if (a.type === 'erase') { if (a.erased) commit(); }
  else if (a.type === 'pan') scheduleSave();
  updateUI(); render();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('dblclick', e => {
  if (tool !== 'select') return;
  const w = toWorld(screenPt(e)), el = topHit(w);
  if (el && el.type === 'text') startText(el);
  else if (el && el.type === 'video') openMedia(el);
  else if (!el) {
    const t = mk('text', {x:w.x, y:w.y - style.fontSize * .625}); els.push(t); startText(t);
  }
});

/* ---------- keyboard / clipboard / files ---------- */
const panelActive = () => $('#workspaceView').classList.contains('active') && $('#panel-moodboard').classList.contains('active');
const typing = t => /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
window.addEventListener('keydown', e => {
  if (!panelActive() || typing(e.target)) return;
  if (e.key === 'Escape' && $('#mediaModal').classList.contains('open')) { closeMedia(); return; }
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (mod) {
    if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (k === 'y') { e.preventDefault(); redo(); }
    else if (k === 'a') { e.preventDefault(); sel = new Set(els.map(x => x.id)); tool = 'select'; updateUI(); render(); }
    else if (k === 'd') { e.preventDefault(); duplicate(); }
    return;
  }
  if (e.altKey) return;
  if (k === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; updateCursor(); } return; }
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); }
  else if (k === 'escape') { if (action) return; sel = new Set(); tool = 'select'; updateUI(); render(); }
  else if (k.startsWith('arrow') && sel.size) {
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1, dx = k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, dy = k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0;
    selected().forEach(el => { el.x += dx; el.y += dy; }); commit(); render();
  }
  else if (k === ']') reorder(true);
  else if (k === '[') reorder(false);
  else if (k === 'q') { keepTool = !keepTool; updateUI(); }
  else if (k === 'f') fitContent();
  else if (k === 'i') $('#mediaFile').click();
  else if (HOTKEYS[k]) setTool(HOTKEYS[k]);
});
window.addEventListener('keyup', e => { if (e.key === ' ' && spaceDown) { spaceDown = false; updateCursor(); } });
window.addEventListener('blur', () => { spaceDown = false; });

const copyPayload = () => 'moodboard:' + JSON.stringify(selected());
document.addEventListener('copy', e => {
  if (!panelActive() || typing(e.target) || !sel.size) return;
  e.clipboardData.setData('text/plain', copyPayload()); e.preventDefault();
});
document.addEventListener('cut', e => {
  if (!panelActive() || typing(e.target) || !sel.size) return;
  e.clipboardData.setData('text/plain', copyPayload()); e.preventDefault(); deleteSel();
});
document.addEventListener('paste', e => {
  if (!panelActive() || typing(e.target)) return;
  const files = [...(e.clipboardData.files || [])].filter(f => /^(image|video)\//.test(f.type));
  if (files.length) { e.preventDefault(); files.forEach(f => addFile(f)); return; }
  const text = (e.clipboardData.getData('text/plain') || '').trim();
  if (!text) return;
  e.preventDefault();
  if (text.startsWith('moodboard:')) {
    try {
      const copies = JSON.parse(text.slice(10)).map(el => ({...el, id:uid(), seed:Math.random() * 2 ** 31 | 0, x:el.x + 20, y:el.y + 20}));
      els.push(...copies); sel = new Set(copies.map(c => c.id)); tool = 'select'; commit(); render();
    } catch { toast('Nothing to paste.', true); }
  } else if (!addYouTube(text)) {
    const c = viewCenter(), t = mk('text', {x:c.x - 80, y:c.y - 14, text:text.slice(0, 500)});
    els.push(t); sel = new Set([t.id]); tool = 'select'; commit(); render();
  }
});
$('#mediaFile').onchange = async e => { for (const f of e.target.files) await addFile(f); e.target.value = ''; };
stage.addEventListener('dragover', e => { e.preventDefault(); });
stage.addEventListener('drop', e => {
  e.preventDefault();
  const at = toWorld(screenPt(e));
  [...e.dataTransfer.files].forEach((f, i) => addFile(f, {x:at.x + i * 24, y:at.y + i * 24}));
});

$$('[data-panel]').forEach(b => b.addEventListener('click', () => { if (b.dataset.panel === 'moodboard') setTimeout(resize, 50); }));
buildToolbar(); renderBoardList(); updateUI(); render();
})();
