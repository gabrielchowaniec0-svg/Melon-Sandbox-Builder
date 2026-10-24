// Canvas renderer shared by the builder, blueprints, tutorials and wiki previews.
// World: x to the right, y UP, floor at y = 0, unit = 1 crate. Items are positioned by centre.
import { sizeOf, boundsOf, linkKind, CELL } from './data.js';

const sprites = new Map();
const loadHooks = new Set();
/** Run fn whenever another sprite finishes loading. Returns an unsubscribe function. */
export function onSpritesLoaded(fn) { loadHooks.add(fn); return () => loadHooks.delete(fn); }

export function getSprite(src) {
  let e = sprites.get(src);
  if (!e) {
    const img = new Image();
    e = { img, ok: false };
    img.onload = () => { e.ok = true; loadHooks.forEach((f) => f()); };
    img.onerror = () => { e.err = true; };
    img.src = src;
    sprites.set(src, e);
  }
  return e.ok ? e.img : null;
}
export function preload(srcs) { srcs.forEach(getSprite); }

export const THEME = {
  wall: '#6d7173', wallLine: '#7b8082', plate: '#666a6c', rivet: '#575b5d',
  floor: '#2b2f31', floorTop: '#44494b', grid: 'rgba(255,255,255,.07)', gridMajor: 'rgba(255,255,255,.16)',
  select: '#f4c430', link: '#ffffff', text: '#f2f4f1', ink: '#1d2123',
};

export function makeCam(w, h, scale = 120) { return { x: 0, y: 1.2, s: scale, w, h }; }
export const toScreen = (cam, x, y) => [cam.w / 2 + (x - cam.x) * cam.s, cam.h / 2 - (y - cam.y) * cam.s];
export const toWorld = (cam, sx, sy) => [(sx - cam.w / 2) / cam.s + cam.x, -(sy - cam.h / 2) / cam.s + cam.y];

/** Fit a camera to bounds {x0,x1,y0,y1} with padding (crates). */
export function fitCam(cam, b, pad = 0.8, maxScale = 220, minScale = 24) {
  if (!b) { cam.x = 0; cam.y = 1.4; cam.s = 110; return cam; }
  const w = Math.max(b.x1 - b.x0, 1) + pad * 2, h = Math.max(b.y1 - Math.min(b.y0, 0), 1) + pad * 2;
  cam.s = Math.max(minScale, Math.min(maxScale, Math.min(cam.w / w, cam.h / h)));
  cam.x = (b.x0 + b.x1) / 2;
  cam.y = (Math.min(b.y0, 0) + b.y1) / 2;
  return cam;
}

/** World position of a link anchor (offset is in the item's own frame, crates, y up). */
export function anchorPos(it, ox = 0, oy = 0) {
  const a = ((it.r || 0) * Math.PI) / 180;
  const fx = it.f ? -ox : ox;
  return [it.x + fx * Math.cos(a) - oy * Math.sin(a), it.y + fx * Math.sin(a) + oy * Math.cos(a)];
}

function drawBackground(ctx, cam) {
  const { w, h } = cam;
  ctx.fillStyle = THEME.wall;
  ctx.fillRect(0, 0, w, h);
  // riveted wall plates, 0.7 crate each, anchored to the world so they move with the camera
  const plate = 0.7 * cam.s;
  if (plate > 14) {
    const [ox, oy] = toScreen(cam, 0, 0);
    ctx.strokeStyle = THEME.wallLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = ((ox % plate) + plate) % plate; x < w; x += plate) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
    for (let y = ((oy % plate) + plate) % plate; y < h; y += plate) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
    ctx.stroke();
  }
}

function drawGrid(ctx, cam, step) {
  const { w, h } = cam;
  const px = step * cam.s;
  if (px < 5) return;
  const [ox, oy] = toScreen(cam, 0, 0);
  const major = 8; // every crate
  ctx.lineWidth = 1;
  const x0 = Math.floor(toWorld(cam, 0, 0)[0] / step), x1 = Math.ceil(toWorld(cam, w, 0)[0] / step);
  const y1 = Math.ceil(toWorld(cam, 0, 0)[1] / step), y0 = Math.floor(toWorld(cam, 0, h)[1] / step);
  for (let i = x0; i <= x1; i++) {
    const x = Math.round(ox + i * px) + 0.5;
    ctx.strokeStyle = i % major === 0 ? THEME.gridMajor : THEME.grid;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let j = y0; j <= y1; j++) {
    const y = Math.round(oy - j * px) + 0.5;
    ctx.strokeStyle = j % major === 0 ? THEME.gridMajor : THEME.grid;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function drawFloor(ctx, cam) {
  const [, fy] = toScreen(cam, 0, 0);
  if (fy > cam.h) return;
  ctx.fillStyle = THEME.floor;
  ctx.fillRect(0, fy, cam.w, cam.h - fy + 2);
  ctx.fillStyle = THEME.floorTop;
  ctx.fillRect(0, fy, cam.w, 3);
}

function drawLinkPath(ctx, kind, p, q, sag, t, s) {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const len = Math.hypot(dx, dy);
  const cx = (p[0] + q[0]) / 2, cy = (p[1] + q[1]) / 2 + len * kind.sag * 0.9;
  const lw = Math.max(2, s * 0.025);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind.id === 'rod') {
    ctx.strokeStyle = '#1d2123'; ctx.lineWidth = lw * 2.4;
    ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke();
    ctx.strokeStyle = kind.color; ctx.lineWidth = lw * 1.4;
    ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke();
  } else if (kind.id === 'electric') {
    const n = Math.max(6, Math.round(len / 14));
    const nx = -dy / (len || 1), ny = dx / (len || 1);
    ctx.strokeStyle = kind.color; ctx.lineWidth = lw * 1.2;
    ctx.beginPath(); ctx.moveTo(...p);
    for (let i = 1; i < n; i++) {
      const f = i / n, k = (i % 2 ? 1 : -1) * lw * 1.6;
      const bx = p[0] + dx * f, by = p[1] + dy * f + Math.sin(f * Math.PI) * len * kind.sag;
      ctx.lineTo(bx + nx * k, by + ny * k);
    }
    ctx.lineTo(...q); ctx.stroke();
  } else if (kind.id === 'chain' || kind.id === 'elastic') {
    ctx.strokeStyle = '#1d2123'; ctx.lineWidth = lw * 1.9;
    ctx.beginPath(); ctx.moveTo(...p); ctx.quadraticCurveTo(cx, cy, ...q); ctx.stroke();
    ctx.strokeStyle = kind.color; ctx.lineWidth = lw * 1.2; ctx.setLineDash([lw * 1.6, lw * 0.9]);
    ctx.beginPath(); ctx.moveTo(...p); ctx.quadraticCurveTo(cx, cy, ...q); ctx.stroke();
    ctx.setLineDash([]);
  } else if (kind.id === 'wire') {
    const g = ctx.createLinearGradient(p[0], p[1], q[0], q[1]);
    ['#ff5c5c', '#ffd23f', '#5cff9a', '#5cc8ff', '#c05cff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    ctx.strokeStyle = g; ctx.lineWidth = lw * 0.9;
    ctx.beginPath(); ctx.moveTo(...p); ctx.quadraticCurveTo(cx, cy, ...q); ctx.stroke();
  } else {
    ctx.strokeStyle = '#1d2123'; ctx.lineWidth = lw * 1.8;
    ctx.beginPath(); ctx.moveTo(...p); ctx.quadraticCurveTo(cx, cy, ...q); ctx.stroke();
    ctx.strokeStyle = kind.color; ctx.lineWidth = lw * 1.1;
    ctx.beginPath(); ctx.moveTo(...p); ctx.quadraticCurveTo(cx, cy, ...q); ctx.stroke();
  }
  // end caps
  ctx.fillStyle = '#f2f4f1'; ctx.strokeStyle = '#1d2123'; ctx.lineWidth = 1.5;
  for (const e of [p, q]) { ctx.beginPath(); ctx.arc(e[0], e[1], Math.max(3, s * 0.02), 0, 7); ctx.fill(); ctx.stroke(); }
  if (kind.id === 'pipe' && t != null) {
    // droplets travel along the pipe
    for (let i = 0; i < 3; i++) {
      const f = (t / 1200 + i / 3) % 1;
      const x = (1 - f) * (1 - f) * p[0] + 2 * (1 - f) * f * cx + f * f * q[0];
      const y = (1 - f) * (1 - f) * p[1] + 2 * (1 - f) * f * cy + f * f * q[1];
      ctx.fillStyle = '#d8f1ff'; ctx.beginPath(); ctx.arc(x, y, Math.max(2, s * 0.014), 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Draw a build.
 * opts: { data, grid: step|0, selection:Set, hover:id, time:ms, ghost:{t,x,y,r,f,cw,ch}, showSizes, labels,
 *         hideLinks, fx: Map(id -> {dy, alpha, scale, glow}), linkFx: Map(id -> progress 0..1), pendingLink:{from:id, x, y, kind},
 *         marquee:{x0,y0,x1,y1}, scaleBar:true, snapMarks:[[x,y]] }
 */
export function drawScene(ctx, cam, build, opts = {}) {
  const { data } = opts;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  drawBackground(ctx, cam);
  if (opts.grid) drawGrid(ctx, cam, opts.grid);
  drawFloor(ctx, cam);
  const byId = new Map(build.items.map((i) => [i.id, i]));
  const sel = opts.selection || new Set();
  const fxm = opts.fx || new Map();

  const drawItem = (it, ghost) => {
    const { w, h } = sizeOf(data, it);
    const fx = fxm.get(it.id) || {};
    const alpha = ghost ? 0.55 : fx.alpha == null ? 1 : fx.alpha;
    if (alpha <= 0.01) return;
    const [sx, sy] = toScreen(cam, it.x, it.y + (fx.dy || 0));
    const sc = fx.scale == null ? 1 : fx.scale;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((-(it.r || 0) * Math.PI) / 180);
    if (it.f) ctx.scale(-1, 1);
    ctx.scale(sc, sc);
    ctx.globalAlpha = alpha;
    const pw = w * cam.s, ph = h * cam.s;
    if (it.t === 'custom') {
      ctx.fillStyle = it.color || '#8a6bd1';
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
      ctx.strokeRect(-pw / 2 + 1, -ph / 2 + 1, pw - 2, ph - 2); ctx.setLineDash([]);
    } else {
      const c = data.byId.get(it.t);
      const img = c ? getSprite(c.sprite) : null;
      if (img) ctx.drawImage(img, -pw / 2, -ph / 2, pw, ph);
      else { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-pw / 2, -ph / 2, pw, ph); }
    }
    ctx.restore();
    if (fx.glow) {
      ctx.save();
      ctx.strokeStyle = THEME.select; ctx.globalAlpha = fx.glow; ctx.lineWidth = 3;
      const b = boundsOf(data, it);
      const [a1, b1] = toScreen(cam, b.x0, b.y1 + (fx.dy || 0));
      ctx.strokeRect(a1 - 4, b1 - 4, b.w * cam.s + 8, b.h * cam.s + 8);
      ctx.restore();
    }
    if (!ghost && (sel.has(it.id) || opts.hover === it.id)) {
      const b = boundsOf(data, it);
      const [a1, b1] = toScreen(cam, b.x0, b.y1);
      ctx.save();
      ctx.strokeStyle = sel.has(it.id) ? THEME.select : 'rgba(255,255,255,.55)';
      ctx.lineWidth = sel.has(it.id) ? 2 : 1;
      ctx.setLineDash(sel.has(it.id) ? [] : [4, 3]);
      ctx.strokeRect(a1 - 2.5, b1 - 2.5, b.w * cam.s + 5, b.h * cam.s + 5);
      ctx.restore();
    }
    if (opts.labels && it.label) {
      const b = boundsOf(data, it);
      const [lx, ly] = toScreen(cam, it.x, b.y1 + (fx.dy || 0));
      label(ctx, it.label, lx, ly - 8, true);
    }
    if (opts.showSizes && sel.has(it.id)) {
      const b = boundsOf(data, it);
      const [lx, ly] = toScreen(cam, it.x, b.y0);
      label(ctx, `${fmtC(b.w)} × ${fmtC(b.h)} crates`, lx, ly + 16, false);
    }
  };

  // links behind items? Real game draws ropes on top; we draw on top for readability.
  const items = opts.order ? opts.order : build.items;
  for (const it of items) drawItem(it, false);

  if (!opts.hideLinks) {
    for (const l of build.links || []) {
      const A = byId.get(l.a), B = byId.get(l.b);
      if (!A || !B) continue;
      const prog = opts.linkFx ? (opts.linkFx.has(l.id) ? opts.linkFx.get(l.id) : 1) : 1;
      if (prog <= 0) continue;
      const fa = fxm.get(A.id) || {}, fb = fxm.get(B.id) || {};
      const pa = anchorPos(A, l.ax, l.ay), pb = anchorPos(B, l.bx, l.by);
      const p = toScreen(cam, pa[0], pa[1] + (fa.dy || 0));
      const qf = toScreen(cam, pb[0], pb[1] + (fb.dy || 0));
      const q = [p[0] + (qf[0] - p[0]) * prog, p[1] + (qf[1] - p[1]) * prog];
      drawLinkPath(ctx, linkKind(l.kind), p, q, 0, opts.time, cam.s);
      if (l.label && prog >= 1) label(ctx, l.label, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 10, false);
    }
  }
  if (opts.pendingLink) {
    const A = byId.get(opts.pendingLink.from);
    if (A) {
      const pa = anchorPos(A, opts.pendingLink.ax || 0, opts.pendingLink.ay || 0);
      const p = toScreen(cam, pa[0], pa[1]);
      const q = toScreen(cam, opts.pendingLink.x, opts.pendingLink.y);
      drawLinkPath(ctx, linkKind(opts.pendingLink.kind), p, q, 0, opts.time, cam.s);
      label(ctx, 'Tap the second point', q[0], q[1] - 14, true);
    }
  }
  if (opts.ghost) drawItem({ id: '__ghost', r: 0, f: false, ...opts.ghost }, true);
  if (opts.marquee) {
    const m = opts.marquee;
    ctx.fillStyle = 'rgba(244,196,48,.12)'; ctx.strokeStyle = THEME.select; ctx.lineWidth = 1;
    ctx.fillRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0); ctx.strokeRect(m.x0 + .5, m.y0 + .5, m.x1 - m.x0, m.y1 - m.y0);
  }
  if (opts.tap) drawTap(ctx, cam, opts.tap, opts.time || 0);
  if (opts.scaleBar !== false) drawScaleBar(ctx, cam, data);
  ctx.restore();
}

function drawTap(ctx, cam, tap, t) {
  const [x, y] = toScreen(cam, tap.x, tap.y);
  const k = (t % 1100) / 1100;
  ctx.save();
  ctx.strokeStyle = THEME.select; ctx.lineWidth = 3; ctx.globalAlpha = 1 - k;
  ctx.beginPath(); ctx.arc(x, y, 8 + k * 26, 0, 7); ctx.stroke();
  ctx.globalAlpha = 0.95; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.strokeStyle = '#1d2123'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); ctx.stroke();
  ctx.restore();
}

const fmtC = (n) => (Math.round(n * 100) / 100).toString();

function label(ctx, text, x, y, up) {
  ctx.save();
  ctx.font = '600 12px "Atkinson Hyperlegible", system-ui, sans-serif';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(29,33,35,.88)';
  ctx.fillRect(x - w / 2, y - 11, w, 18);
  ctx.fillStyle = THEME.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 2);
  ctx.restore();
}

/** A Crate-sized square bottom-left: the measuring stick for everything on screen. */
function drawScaleBar(ctx, cam, data) {
  const c = data && data.byId.get('crate');
  const s = cam.s;
  const x = 12;
  const sz = Math.min(s, 40);
  const hh = sz, ww = sz;
  const yy = 12;
  ctx.save();
  ctx.globalAlpha = 0.9;
  const img = c ? getSprite(c.sprite) : null;
  ctx.fillStyle = 'rgba(29,33,35,.7)'; ctx.fillRect(x - 4, yy - 4, ww + 8 + 62, hh + 8);
  if (img) { ctx.imageSmoothingEnabled = false; ctx.drawImage(img, x, yy, ww, hh); }
  ctx.fillStyle = THEME.text; ctx.font = '600 11px "Atkinson Hyperlegible", system-ui, sans-serif'; ctx.textBaseline = 'middle';
  ctx.fillText(sz === s ? '1 crate' : `1 crate = ${Math.round(s)}px`, x + ww + 8, yy + hh / 2);
  ctx.restore();
}

/** Topmost item under a world point, or null. Honors rotation. */
export function hitTest(data, build, wx, wy) {
  for (let i = build.items.length - 1; i >= 0; i--) {
    const it = build.items[i];
    const { w, h } = sizeOf(data, it);
    const a = ((it.r || 0) * Math.PI) / 180;
    const dx = wx - it.x, dy = wy - it.y;
    const lx = dx * Math.cos(a) + dy * Math.sin(a);
    const ly = -dx * Math.sin(a) + dy * Math.cos(a);
    const pad = 0.04;
    if (Math.abs(lx) <= w / 2 + pad && Math.abs(ly) <= h / 2 + pad) return it;
  }
  return null;
}

export function hitLink(data, build, cam, sx, sy, tol = 8) {
  const byId = new Map(build.items.map((i) => [i.id, i]));
  for (let i = (build.links || []).length - 1; i >= 0; i--) {
    const l = build.links[i];
    const A = byId.get(l.a), B = byId.get(l.b);
    if (!A || !B) continue;
    const pa = anchorPos(A, l.ax, l.ay), pb = anchorPos(B, l.bx, l.by);
    const p = toScreen(cam, ...pa), q = toScreen(cam, ...pb);
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((sx - p[0]) * dx + (sy - p[1]) * dy) / L2));
    const cx = p[0] + t * dx, cy = p[1] + t * dy;
    if (Math.hypot(sx - cx, sy - cy) <= tol) return l;
  }
  return null;
}

export { CELL };

/** Render a build to a standalone canvas (for thumbnails). */
export function thumbnail(data, build, w = 320, h = 200) {
  const cv = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const cam = makeCam(w, h);
  const b = build.items.length ? build.items.reduce((acc, it) => {
    const bb = boundsOf(data, it);
    return { x0: Math.min(acc.x0, bb.x0), x1: Math.max(acc.x1, bb.x1), y0: Math.min(acc.y0, bb.y0), y1: Math.max(acc.y1, bb.y1) };
  }, { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 }) : null;
  fitCam(cam, b, 0.5);
  const paint = () => drawScene(ctx, cam, build, { data, grid: 0, scaleBar: false });
  paint();
  let off = null, pending = 0;
  off = onSpritesLoaded(() => {
    if (!cv.isConnected && pending > 40) { off(); return; }
    pending++;
    cancelAnimationFrame(thumbnail._raf);
    thumbnail._raf = requestAnimationFrame(() => { if (cv.isConnected || pending < 40) paint(); });
  });
  return { canvas: cv, repaint: paint };
}
