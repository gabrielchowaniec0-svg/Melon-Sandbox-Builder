// Measure from screenshot: box a Crate and a new item, get the item size in crates.
import { h, store, slugify, toast } from '../util.js';
import { field, seg, note, copyBtn, saveFile, toCsv, setupCanvas, watchWidth, PX_W, PX_H, r3 } from './kit.js';

const KEY = 'tools.measurements';
const HANDLE = 22; // touch radius in screen px
const norm = (b) => ({ x0: Math.min(b.x0, b.x1), x1: Math.max(b.x0, b.x1), y0: Math.min(b.y0, b.y1), y1: Math.max(b.y0, b.y1) });

export default {
  id: 'measure',
  title: 'Measure from screenshot',
  blurb: 'Load a screenshot with a Crate next to a new item, box both, and get the item size in crates.',
  mount(root, ctx) {
    const { data } = ctx;
    const st = {
      img: null, iw: 0, ih: 0, name: '',
      view: { ox: 0, oy: 0, s: 1 },
      boxes: { crate: null, item: null },
      mode: 'crate', edge: 'all', step: 1,
      pending: null, drag: null, loupe: null, hover: null,
    };
    let list = store.get(KEY, []) || [];
    const saveList = () => store.set(KEY, list);

    // ---------- DOM
    const canvas = h('canvas.tl-canvas.tl-measure-canvas', { tabindex: 0, 'aria-label': 'Screenshot. Drag to draw a box. Arrow keys nudge the selected edge.' });
    const stage = h('div.tl-stage', canvas);
    const hint = h('p.tl-hint', { role: 'status' });
    const fileIn = h('input', { type: 'file', accept: 'image/*', class: 'sr', id: 'tl-file', onchange: (e) => e.target.files[0] && loadFile(e.target.files[0]) });
    const drop = h('div.tl-drop',
      h('h3', 'Load a screenshot'),
      h('p', 'Use a screenshot where a Crate sits on the floor next to the new item, at the same camera zoom.'),
      h('div.row',
        h('label.btn.primary', { for: 'tl-file' }, 'Choose a screenshot'),
        h('button.btn', { type: 'button', onclick: pasteFromClipboard }, 'Paste from clipboard')),
      h('p.muted', 'You can also drop an image here, or paste with Ctrl+V.'));
    const emptyWrap = h('div.tl-emptywrap', drop);
    const modeSeg = seg([['crate', 'Crate box'], ['item', 'Item box'], ['pan', 'Move view']], st.mode, (v) => { st.mode = v; st.pending = null; updateUi(); draw(); }, 'What to draw');
    const zoomBar = h('div.row',
      h('button.btn.sm.icon', { type: 'button', 'aria-label': 'Zoom out', onclick: () => zoomBy(1 / 1.5) }, '−'),
      h('button.btn.sm.icon', { type: 'button', 'aria-label': 'Zoom in', onclick: () => zoomBy(1.5) }, '+'),
      h('button.btn.sm', { type: 'button', onclick: fit }, 'Fit'),
      h('button.btn.sm', { type: 'button', onclick: () => zoomTo(1) }, '1:1'));

    // nudge
    const edgeSeg = seg([['all', 'Whole box'], ['x0', 'Left edge'], ['x1', 'Right edge'], ['y0', 'Top edge'], ['y1', 'Bottom edge']], st.edge, (v) => { st.edge = v; updateUi(); }, 'Which edge to nudge');
    const stepSeg = seg([['1', '1 px'], ['5', '5 px'], ['10', '10 px']], '1', (v) => { st.step = +v; }, 'Nudge step');
    const arrow = (txt, label, dx, dy) => h('button.btn.icon', { type: 'button', 'aria-label': label, onclick: () => nudge(dx, dy), dataset: { dir: label } }, txt);
    const pad = h('div.tl-pad',
      h('span'), arrow('↑', 'Nudge up', 0, -1), h('span'),
      arrow('←', 'Nudge left', -1, 0), h('span.tl-pad-mid', 'Nudge'), arrow('→', 'Nudge right', 1, 0),
      h('span'), arrow('↓', 'Nudge down', 0, 1), h('span'));
    const nums = {};
    const numRow = h('div.tl-grid4', ['x0', 'y0', 'w', 'h'].map((k) => {
      const lbl = { x0: 'Left', y0: 'Top', w: 'Width', h: 'Height' }[k];
      nums[k] = h('input', { type: 'number', step: 1, inputmode: 'numeric', 'aria-label': `${lbl} in image pixels`, onchange: () => numEdit(k) });
      return field(lbl + ' (px)', nums[k]);
    }));
    const boxLabel = h('p.tl-boxlabel');
    const result = h('div.tl-measure-result');
    const nameIn = h('input', { type: 'text', placeholder: 'Item name, for example Wooden Plank', maxlength: 60, 'aria-label': 'Item name' });
    const catSel = h('select', { 'aria-label': 'Category' }, data.cats.map((c) => h('option', { value: c }, c)));
    const noteIn = h('input', { type: 'text', placeholder: 'Optional note', maxlength: 160, 'aria-label': 'Note' });
    const addBtn = h('button.btn.primary', { type: 'button', onclick: addMeasurement }, 'Add to my measurements');
    const cropBtn = h('button.btn', { type: 'button', onclick: downloadCrop }, 'Save item crop (PNG)');
    const listWrap = h('div');
    const nudgeCard = h('section.panel', h('header', 'Fine tune'), h('div.body.stack', boxLabel, edgeSeg, pad, stepSeg, numRow));

    // ---------- geometry
    const toImg = (sx, sy) => [(sx - st.view.ox) / st.view.s, (sy - st.view.oy) / st.view.s];
    const toScr = (ix, iy) => [st.view.ox + ix * st.view.s, st.view.oy + iy * st.view.s];
    const cw = () => stage.clientWidth || 360;
    const chh = () => stage.clientHeight || 360;
    const snap = (v, max) => Math.max(0, Math.min(max, Math.round(v)));

    function fit() {
      if (!st.img) return;
      const s = Math.min(cw() / st.iw, chh() / st.ih);
      st.view = { s, ox: (cw() - st.iw * s) / 2, oy: (chh() - st.ih * s) / 2 };
      draw();
    }
    function zoomTo(s, cx = cw() / 2, cy = chh() / 2) {
      if (!st.img) return;
      const [ix, iy] = toImg(cx, cy);
      s = Math.max(0.05, Math.min(60, s));
      st.view = { s, ox: cx - ix * s, oy: cy - iy * s };
      draw();
    }
    const zoomBy = (k, cx, cy) => zoomTo(st.view.s * k, cx, cy);

    // ---------- loading
    function loadFile(file) {
      if (!file || !file.type.startsWith('image/')) { toast('That file is not an image. Choose a PNG or JPG screenshot.', 'error'); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        st.img = img; st.iw = img.naturalWidth; st.ih = img.naturalHeight;
        st.boxes = { crate: null, item: null }; st.pending = null; st.mode = 'crate'; modeSeg.set('crate');
        emptyWrap.hidden = true; stage.hidden = false;
        requestAnimationFrame(() => { sizeCanvas(); fit(); updateUi(); stage.scrollIntoView({ block: 'center' }); });
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('The browser could not open that image. Try saving it as PNG or JPG first.', 'error'); };
      img.src = url;
    }
    async function pasteFromClipboard() {
      try {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          const type = it.types.find((t) => t.startsWith('image/'));
          if (type) { loadFile(new File([await it.getType(type)], 'pasted.png', { type })); return; }
        }
        toast('The clipboard has no image. Copy a screenshot first.', 'error');
      } catch {
        toast('The browser blocked clipboard access. Press Ctrl+V on this page instead, or choose a file.', 'error', 4200);
      }
    }
    const onPaste = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
      if (f) { e.preventDefault(); loadFile(f); }
    };
    document.addEventListener('paste', onPaste);
    const onDrag = (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); };
    const onDrop = (e) => { const f = e.dataTransfer?.files?.[0]; if (f) { e.preventDefault(); loadFile(f); } };
    for (const el of [emptyWrap, stage]) { el.addEventListener('dragover', onDrag); el.addEventListener('drop', onDrop); }

    // ---------- canvas drawing
    function sizeCanvas() {
      const w = cw(), hh = chh();
      return setupCanvas(canvas, w, hh);
    }
    function draw() {
      if (!st.img) return;
      const c = sizeCanvas();
      const w = cw(), hh = chh();
      c.fillStyle = '#15181a'; c.fillRect(0, 0, w, hh);
      c.imageSmoothingEnabled = st.view.s < 1.5;
      c.drawImage(st.img, st.view.ox, st.view.oy, st.iw * st.view.s, st.ih * st.view.s);
      const colors = { crate: '#f4c430', item: '#ff6b84' };
      for (const k of ['crate', 'item']) {
        const b = st.boxes[k];
        if (!b) continue;
        const [x0, y0] = toScr(b.x0, b.y0), [x1, y1] = toScr(b.x1, b.y1);
        c.fillStyle = k === 'crate' ? 'rgba(244,196,48,.12)' : 'rgba(255,107,132,.14)';
        c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = '#1d2123'; c.lineWidth = 4; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = colors[k]; c.lineWidth = 2; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
        c.font = '700 12px "Atkinson Hyperlegible", system-ui, sans-serif';
        const t = `${k === 'crate' ? 'Crate' : 'Item'} ${b.x1 - b.x0} × ${b.y1 - b.y0} px`;
        const tw = c.measureText(t).width + 10;
        const ty = y0 > 24 ? y0 - 22 : y1 + 4;
        c.fillStyle = 'rgba(29,33,35,.92)'; c.fillRect(x0, ty, tw, 18);
        c.fillStyle = colors[k]; c.textBaseline = 'middle'; c.fillText(t, x0 + 5, ty + 9);
        if (st.mode === k || st.mode === 'pan') {
          for (const [hx, hy] of handlePoints(x0, y0, x1, y1)) {
            c.fillStyle = colors[k]; c.strokeStyle = '#1d2123'; c.lineWidth = 2;
            c.fillRect(hx - 6, hy - 6, 12, 12); c.strokeRect(hx - 6, hy - 6, 12, 12);
          }
        }
      }
      if (st.pending) {
        const [px, py] = toScr(st.pending.x, st.pending.y);
        c.strokeStyle = st.mode === 'crate' ? '#f4c430' : '#ff6b84'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(px - 14, py); c.lineTo(px + 14, py); c.moveTo(px, py - 14); c.lineTo(px, py + 14); c.stroke();
      }
      if (st.loupe) drawLoupe(c, w, hh);
    }
    const handlePoints = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1], [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]];
    function drawLoupe(c, w, hh) {
      const { ix, iy, sx } = st.loupe;
      const size = 116, zoom = 8, half = size / zoom / 2;
      const lx = sx < w / 2 ? w - size - 8 : 8, ly = 8;
      c.save();
      c.fillStyle = '#15181a'; c.fillRect(lx - 3, ly - 3, size + 6, size + 6);
      c.beginPath(); c.rect(lx, ly, size, size); c.clip();
      c.imageSmoothingEnabled = false;
      c.drawImage(st.img, ix - half, iy - half, half * 2, half * 2, lx, ly, size, size);
      c.restore();
      c.strokeStyle = '#f4c430'; c.lineWidth = 2; c.strokeRect(lx - 1, ly - 1, size + 2, size + 2);
      c.strokeStyle = '#ff2d55'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(lx + size / 2, ly); c.lineTo(lx + size / 2, ly + size); c.moveTo(lx, ly + size / 2); c.lineTo(lx + size, ly + size / 2); c.stroke();
    }

    // ---------- pointer handling
    const ptrs = new Map();
    let pinch = null;
    function hitHandle(b, sx, sy) {
      const [x0, y0] = toScr(b.x0, b.y0), [x1, y1] = toScr(b.x1, b.y1);
      const names = [['x0', 'y0'], ['x1', 'y0'], ['x0', 'y1'], ['x1', 'y1'], [null, 'y0'], [null, 'y1'], ['x0', null], ['x1', null]];
      const pts = handlePoints(x0, y0, x1, y1);
      let best = null, bd = HANDLE;
      pts.forEach(([hx, hy], i) => {
        const d = Math.hypot(hx - sx, hy - sy);
        const corner = i < 4;
        if (d < bd && (corner || d < HANDLE * 0.85)) { bd = d; best = { hx: names[i][0], hy: names[i][1] }; }
      });
      if (best) return best;
      // edges anywhere along their length
      const inX = sx > x0 - HANDLE / 2 && sx < x1 + HANDLE / 2, inY = sy > y0 - HANDLE / 2 && sy < y1 + HANDLE / 2;
      const t = 12;
      if (inX && Math.abs(sy - y0) < t) return { hx: null, hy: 'y0' };
      if (inX && Math.abs(sy - y1) < t) return { hx: null, hy: 'y1' };
      if (inY && Math.abs(sx - x0) < t) return { hx: 'x0', hy: null };
      if (inY && Math.abs(sx - x1) < t) return { hx: 'x1', hy: null };
      if (sx > x0 && sx < x1 && sy > y0 && sy < y1) return { move: true };
      return null;
    }
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    canvas.addEventListener('pointerdown', (e) => {
      if (!st.img) return;
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(e.pointerId);
      const [sx, sy] = pos(e);
      ptrs.set(e.pointerId, { sx, sy });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1, s: st.view.s, ox: st.view.ox, oy: st.view.oy, mx: (a.sx + b.sx) / 2, my: (a.sy + b.sy) / 2 };
        st.drag = null; st.loupe = null; draw();
        return;
      }
      const [ix, iy] = toImg(sx, sy);
      const panning = st.mode === 'pan' || e.button === 1 || e.button === 2 || e.shiftKey;
      const b = st.boxes[st.mode];
      if (!panning && b) {
        const hit = hitHandle(b, sx, sy);
        if (hit && hit.move) { st.drag = { type: 'move', sx, sy, b: { ...b } }; return; }
        if (hit) { st.drag = { type: 'handle', hx: hit.hx, hy: hit.hy }; st.loupe = { ix, iy, sx }; return; }
      }
      if (!panning && st.mode !== 'pan') {
        const px = snap(ix, st.iw), py = snap(iy, st.ih);
        st.drag = { type: 'draw', sx, sy, x: px, y: py, moved: false };
        st.loupe = { ix: px, iy: py, sx };
        draw();
        return;
      }
      if (st.mode === 'pan' && (st.boxes.crate || st.boxes.item)) {
        // in move-view mode a handle grab still resizes the nearest box
        for (const k of ['item', 'crate']) {
          const bb = st.boxes[k];
          const hit = bb && hitHandle(bb, sx, sy);
          if (hit && !hit.move) { st.mode = k; modeSeg.set(k); st.drag = { type: 'handle', hx: hit.hx, hy: hit.hy }; st.loupe = { ix, iy, sx }; updateUi(); return; }
        }
      }
      st.drag = { type: 'pan', sx, sy, ox: st.view.ox, oy: st.view.oy };
    });

    canvas.addEventListener('pointermove', (e) => {
      const [sx, sy] = pos(e);
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { sx, sy });
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1;
        const s = Math.max(0.05, Math.min(60, pinch.s * d / pinch.d));
        const mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2;
        const ix = (pinch.mx - pinch.ox) / pinch.s, iy = (pinch.my - pinch.oy) / pinch.s;
        st.view = { s, ox: mx - ix * s, oy: my - iy * s };
        draw();
        return;
      }
      const d = st.drag;
      if (!d) { updateCursor(sx, sy); return; }
      const [ix, iy] = toImg(sx, sy);
      if (d.type === 'pan') { st.view.ox = d.ox + (sx - d.sx); st.view.oy = d.oy + (sy - d.sy); }
      else if (d.type === 'draw') {
        if (Math.hypot(sx - d.sx, sy - d.sy) > 6) d.moved = true;
        if (d.moved) {
          const px = snap(ix, st.iw), py = snap(iy, st.ih);
          st.boxes[st.mode] = norm({ x0: d.x, y0: d.y, x1: px, y1: py });
          st.pending = null;
          st.loupe = { ix: px, iy: py, sx };
        }
      } else if (d.type === 'handle') {
        const b = st.boxes[st.mode];
        if (d.hx) b[d.hx] = snap(ix, st.iw);
        if (d.hy) b[d.hy] = snap(iy, st.ih);
        if (b.x0 > b.x1) { [b.x0, b.x1] = [b.x1, b.x0]; d.hx = d.hx === 'x0' ? 'x1' : d.hx === 'x1' ? 'x0' : d.hx; }
        if (b.y0 > b.y1) { [b.y0, b.y1] = [b.y1, b.y0]; d.hy = d.hy === 'y0' ? 'y1' : d.hy === 'y1' ? 'y0' : d.hy; }
        st.loupe = { ix: d.hx ? b[d.hx] : ix, iy: d.hy ? b[d.hy] : iy, sx };
      } else if (d.type === 'move') {
        const dx = Math.round((sx - d.sx) / st.view.s), dy = Math.round((sy - d.sy) / st.view.s);
        const bw = d.b.x1 - d.b.x0, bh = d.b.y1 - d.b.y0;
        const x0 = Math.max(0, Math.min(st.iw - bw, d.b.x0 + dx)), y0 = Math.max(0, Math.min(st.ih - bh, d.b.y0 + dy));
        st.boxes[st.mode] = { x0, y0, x1: x0 + bw, y1: y0 + bh };
      }
      draw();
      if (d.type !== 'pan') syncNums();
    });

    const endPtr = (e) => {
      const had = ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (!had) return;
      const d = st.drag;
      if (d && d.type === 'draw' && !d.moved && e.type === 'pointerup') {
        // a tap: first tap sets one corner, second tap sets the opposite one
        if (!st.pending) st.pending = { x: d.x, y: d.y };
        else {
          const b = norm({ x0: st.pending.x, y0: st.pending.y, x1: d.x, y1: d.y });
          st.pending = null;
          if (b.x1 - b.x0 >= 1 && b.y1 - b.y0 >= 1) st.boxes[st.mode] = b;
          else toast('Those two taps are on the same line. Tap a corner that is across from the first one.', 'error', 3400);
        }
      }
      if (d && (d.type === 'draw' || d.type === 'handle') && st.boxes[st.mode]) afterBox();
      st.drag = null; st.loupe = null;
      draw(); updateUi();
    };
    canvas.addEventListener('pointerup', endPtr);
    canvas.addEventListener('pointercancel', endPtr);
    canvas.addEventListener('lostpointercapture', (e) => { if (ptrs.has(e.pointerId)) endPtr({ pointerId: e.pointerId, type: 'cancel' }); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      if (!st.img) return;
      e.preventDefault();
      const [sx, sy] = pos(e);
      zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, sx, sy);
    }, { passive: false });
    function updateCursor(sx, sy) {
      let cur = st.mode === 'pan' ? 'grab' : 'crosshair';
      const b = st.boxes[st.mode];
      if (b && st.mode !== 'pan') {
        const hit = hitHandle(b, sx, sy);
        if (hit) cur = hit.move ? 'move' : hit.hx && hit.hy ? ((hit.hx === 'x0') === (hit.hy === 'y0') ? 'nwse-resize' : 'nesw-resize') : hit.hx ? 'ew-resize' : 'ns-resize';
      }
      canvas.style.cursor = cur;
    }
    canvas.addEventListener('keydown', (e) => {
      const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!m) return;
      e.preventDefault();
      nudge(m[0] * (e.shiftKey ? 5 : 1) / st.step, m[1] * (e.shiftKey ? 5 : 1) / st.step);
    });

    // ---------- box editing
    function afterBox() {
      if (st.mode === 'crate' && st.boxes.crate && !st.boxes.item) { st.mode = 'item'; modeSeg.set('item'); }
    }
    function nudge(dx, dy) {
      const b = st.boxes[st.mode === 'pan' ? (st.boxes.item ? 'item' : 'crate') : st.mode];
      if (!b) { toast('Draw a box first, then nudge it.', 'error'); return; }
      const k = st.step;
      if (st.edge === 'all') {
        const w = b.x1 - b.x0, hh = b.y1 - b.y0;
        b.x0 = Math.max(0, Math.min(st.iw - w, b.x0 + dx * k)); b.x1 = b.x0 + w;
        b.y0 = Math.max(0, Math.min(st.ih - hh, b.y0 + dy * k)); b.y1 = b.y0 + hh;
      } else {
        const axisX = st.edge[0] === 'x';
        const d = axisX ? dx : dy;
        if (!d) return;
        b[st.edge] = Math.max(0, Math.min(axisX ? st.iw : st.ih, b[st.edge] + d * k));
        if (axisX && b.x0 >= b.x1) b[st.edge] = st.edge === 'x0' ? b.x1 - 1 : b.x0 + 1;
        if (!axisX && b.y0 >= b.y1) b[st.edge] = st.edge === 'y0' ? b.y1 - 1 : b.y0 + 1;
      }
      draw(); syncNums(); updateResult();
    }
    function numEdit(k) {
      const key = st.mode === 'pan' ? (st.boxes.item ? 'item' : 'crate') : st.mode;
      let b = st.boxes[key];
      const v = Math.round(+nums[k].value);
      if (!Number.isFinite(v)) return;
      if (!b) b = st.boxes[key] = { x0: 0, y0: 0, x1: Math.min(50, st.iw), y1: Math.min(50, st.ih) };
      const w = b.x1 - b.x0, hh = b.y1 - b.y0;
      if (k === 'x0') { b.x0 = Math.max(0, Math.min(st.iw - 1, v)); b.x1 = Math.min(st.iw, b.x0 + w); }
      if (k === 'y0') { b.y0 = Math.max(0, Math.min(st.ih - 1, v)); b.y1 = Math.min(st.ih, b.y0 + hh); }
      if (k === 'w') b.x1 = Math.min(st.iw, b.x0 + Math.max(1, v));
      if (k === 'h') b.y1 = Math.min(st.ih, b.y0 + Math.max(1, v));
      draw(); syncNums(); updateUi();
    }
    function syncNums() {
      const key = st.mode === 'pan' ? (st.boxes.item ? 'item' : 'crate') : st.mode;
      const b = st.boxes[key];
      boxLabel.textContent = b ? `Editing the ${key === 'crate' ? 'Crate' : 'item'} box.` : `The ${key === 'crate' ? 'Crate' : 'item'} box is empty. Drag on the screenshot, or type a size below.`;
      nums.x0.value = b ? b.x0 : ''; nums.y0.value = b ? b.y0 : '';
      nums.w.value = b ? b.x1 - b.x0 : ''; nums.h.value = b ? b.y1 - b.y0 : '';
    }

    // ---------- results
    function measurement() {
      const { crate, item } = st.boxes;
      if (!crate || !item) return null;
      const cwid = crate.x1 - crate.x0, chei = crate.y1 - crate.y0, iw = item.x1 - item.x0, ih = item.y1 - item.y0;
      const c = [iw / cwid, ih / chei];
      return { cwid, chei, iw, ih, c, px: [Math.round(c[0] * PX_W), Math.round(c[1] * PX_H)] };
    }
    function updateResult() {
      const m = measurement();
      if (!m) { result.replaceChildren(h('p.muted', 'The size appears here once both boxes are drawn.')); addBtn.disabled = true; cropBtn.disabled = !st.boxes.item; return; }
      addBtn.disabled = false; cropBtn.disabled = false;
      const warns = [];
      const aspect = m.cwid / m.chei, ref = PX_W / PX_H;
      if (Math.abs(aspect / ref - 1) > 0.06) warns.push(`Your Crate box is ${m.cwid} × ${m.chei} px, a ratio of ${r3(aspect)}. A Crate should be close to ${r3(ref)}. Check that the box hugs the Crate and that the screenshot is not stretched.`);
      if (m.cwid < 60 || m.chei < 60) warns.push(`The Crate is only ${m.cwid} × ${m.chei} px in this screenshot. A 1 px slip then changes the answer by about ${Math.round(100 / Math.min(m.cwid, m.chei))} percent. Zoom the game in or use a larger screenshot.`);
      if (m.iw < 12 || m.ih < 12) warns.push('The item box is very small. Zoom in on the screenshot and re-check the edges.');
      const near = data.items.filter((i) => Math.abs(i.c[0] / m.c[0] - 1) < 0.04 && Math.abs(i.c[1] / m.c[1] - 1) < 0.04 && i.id !== 'crate').slice(0, 3);
      const err = Math.round((100 / Math.min(m.cwid, m.chei) + 100 / Math.min(m.iw, m.ih)) * 10) / 10;
      result.replaceChildren(
        h('div.tl-results',
          h('div.tl-result', h('span.muted', 'Size in crates'), h('b', `${r3(m.c[0])} × ${r3(m.c[1])}`)),
          h('div.tl-result', h('span.muted', 'Size in grid cells'), h('b', `${Math.round(m.c[0] * 80) / 10} × ${Math.round(m.c[1] * 80) / 10}`)),
          h('div.tl-result', h('span.muted', `Catalog pixels (${PX_W} × ${PX_H} Crate)`), h('b', `${m.px[0]} × ${m.px[1]}`)),
          h('div.tl-result', h('span.muted', 'Your boxes'), h('b', `item ${m.iw} × ${m.ih} px, Crate ${m.cwid} × ${m.chei} px`))),
        h('p.muted', `Rough error from a 1 px slip on each box: up to about ${err} percent.`),
        near.length ? note('', h('p', `This is close to an item we already have: ${near.map((n) => `${n.name} (${n.c[0]} × ${n.c[1]})`).join(', ')}. Make sure it is really a new item.`)) : null,
        ...warns.map((w) => note('warn', h('p', w))));
    }

    function addMeasurement() {
      const m = measurement();
      const name = nameIn.value.trim();
      if (!m) { toast('Draw both boxes first.', 'error'); return; }
      if (!name) { toast('Give the item a name, then add it.', 'error'); nameIn.focus(); return; }
      let id = slugify(name) || 'item', n = 1;
      const taken = (x) => data.byId.has(x) || list.some((l) => l.id === x);
      while (taken(id)) id = `${slugify(name)}-${++n}`;
      list.push({
        id, name, cat: catSel.value, px: m.px, c: [r3(m.c[0]), r3(m.c[1])], sprite: '', flags: [], act: false, params: [],
        note: (noteIn.value.trim() ? noteIn.value.trim() + ' ' : '') + `Measured with the Measure tool, Crate box ${m.cwid} x ${m.chei} px.`,
      });
      saveList(); nameIn.value = ''; noteIn.value = ''; drawList(); toast(`Added ${name}.`, 'good');
    }
    function downloadCrop() {
      const b = st.boxes.item;
      if (!b || !st.img) return;
      const cv = document.createElement('canvas');
      cv.width = b.x1 - b.x0; cv.height = b.y1 - b.y0;
      cv.getContext('2d').drawImage(st.img, b.x0, b.y0, cv.width, cv.height, 0, 0, cv.width, cv.height);
      cv.toBlob((blob) => blob && saveFile(`${slugify(nameIn.value) || 'item'}-crop.png`, blob, 'image/png'));
    }

    function drawList() {
      const asJson = () => JSON.stringify({ version: 1, note: 'Measured with the Melon Sandbox Builder Measure tool. Same shape as data/catalog.json items.', items: list }, null, 2);
      const asCsv = () => toCsv([['id', 'name', 'cat', 'px_w', 'px_h', 'c_w', 'c_h', 'note'], ...list.map((l) => [l.id, l.name, l.cat, l.px[0], l.px[1], l.c[0], l.c[1], l.note])]);
      listWrap.replaceChildren(
        list.length ? h('div.table-wrap', h('table.data',
          h('thead', h('tr', h('th', 'Name'), h('th', 'Category'), h('th.num', 'Crates'), h('th.num', 'Px'), h('th', h('span.sr', 'Remove')))),
          h('tbody', list.map((l, i) => h('tr', h('td', h('b', l.name), h('br'), h('small.muted', l.id)), h('td', l.cat), h('td.num', `${l.c[0]} × ${l.c[1]}`), h('td.num', `${l.px[0]} × ${l.px[1]}`),
            h('td', h('button.btn.sm.ghost', { type: 'button', 'aria-label': `Remove ${l.name}`, onclick: () => { list.splice(i, 1); saveList(); drawList(); } }, 'Remove'))))))) :
          h('div.empty', h('h3', 'No measurements yet'), h('p', 'Items you add appear here and stay in this browser.')),
        h('div.row',
          h('button.btn', { type: 'button', disabled: !list.length, onclick: () => saveFile('measurements.json', asJson(), 'application/json') }, 'Download JSON'),
          h('button.btn', { type: 'button', disabled: !list.length, onclick: () => saveFile('measurements.csv', asCsv(), 'text/csv') }, 'Download CSV'),
          copyBtn(() => (list.length ? asJson() : ''), 'Copy JSON'),
          h('button.btn.ghost', { type: 'button', disabled: !list.length, onclick: () => { if (confirm('Remove all saved measurements from this browser?')) { list = []; saveList(); drawList(); } } }, 'Clear all')),
        h('p.muted', 'The JSON has the same fields as items in data/catalog.json, so you can paste the entries into the catalog. Leave sprite empty until you have a cropped image.'));
    }

    function updateUi() {
      const { crate, item } = st.boxes;
      hint.textContent = !st.img ? '' :
        st.mode === 'pan' ? 'Drag to move the view. Pinch or scroll to zoom. Grab a box handle to resize it.' :
        st.pending ? 'Now tap the opposite corner.' :
        st.mode === 'crate' ? (crate ? 'Crate box set. Drag its handles to adjust, or switch to Item box.' : 'Step 1. Drag a box around the Crate, or tap two opposite corners. Hug its edges.') :
        item ? 'Item box set. Adjust it with the handles or the fine tune controls, then name it below.' : 'Step 2. Drag a box around the new item, or tap two opposite corners.';
      const arrows = pad.querySelectorAll('button');
      const axis = st.edge === 'all' ? 'xy' : st.edge[0];
      arrows.forEach((b) => {
        const d = b.dataset.dir;
        b.disabled = (axis === 'x' && /up|down/.test(d)) || (axis === 'y' && /left|right/.test(d));
      });
      syncNums(); updateResult();
    }

    // ---------- layout
    root.append(h('div.stack',
      note('', h('p', 'Take a game screenshot with a Crate on the floor right next to the new item, at the same camera zoom. Box the Crate, then the item. The tool divides the item by the Crate to get its size in crates.')),
      h('div.tl-measure',
        h('div.tl-measure-view',
          emptyWrap,
          h('div.tl-viewtools', modeSeg, zoomBar, h('label.btn.sm', { for: 'tl-file' }, 'Other image')),
          hint, stage, fileIn),
        h('div.tl-measure-side',
          nudgeCard,
          h('section.panel', h('header', 'Result'), h('div.body.stack', result,
            field('Name', nameIn), h('div.tl-grid2', field('Category', catSel), field('Note', noteIn)),
            h('div.row', addBtn, cropBtn)))),
      ),
      h('section.panel', h('header', 'My measurements'), h('div.body.stack', listWrap))));
    stage.hidden = true;
    drawList(); updateUi();
    const stop = watchWidth(stage, () => { if (st.img) { const keep = st.view; draw(); void keep; } });
    return () => { document.removeEventListener('paste', onPaste); stop(); };
  },
};
