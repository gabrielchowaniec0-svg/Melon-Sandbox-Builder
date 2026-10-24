// The 2D grid builder. Pointer-driven canvas editor with a palette, inspector, links, undo/redo,
// autosave to localStorage and Base64 import/export.
import { $, h, clamp, round, fmt, uid, deepCopy, debounce, store, toast, copyText, download, encodeBuild, ensureCss, toB64 } from '../util.js';
import { CELL, sizeOf, boundsOf, buildBounds, LINK_KINDS, linkKind, newBuild, validateBuild } from '../data.js';
import { drawScene, makeCam, fitCam, toWorld, toScreen, hitTest, hitLink, preload, onSpritesLoaded, anchorPos } from '../render.js';
import { createPlayer } from '../player.js';
import { generateGuide, partsList, guideAsText } from '../guide.js';
import { listBuilds, getBuild, saveBuild, deleteBuild, duplicateBuild, createBuild, getCurrentId, setCurrentId, importCode } from '../library.js';
import { icon } from '../icons.js';

export const title = 'Build';

export async function mount(root, ctx) {
  const { data, app } = ctx;
  await ensureCss('css/build.css');
  preload(data.items.map((i) => i.sprite));

  // ---------- state ----------
  let build = null;
  const S = {
    tool: 'select', // select | pan | link
    linkKind: 'rope',
    sel: new Set(), selLink: null,
    placing: null,  // {t, cw?, ch?, ...}
    snap: store.get('snap', CELL),
    multi: false,
    hover: null, pointerWorld: null, pendingLink: null,
    undo: [], redo: [], dirty: true, saved: true,
    cat: 'All', q: '',
  };
  const cam = makeCam(800, 500, store.get('zoom', 110));

  // ---------- load build ----------
  const openBuild = (b) => { build = b; S.sel.clear(); S.selLink = null; S.undo = []; S.redo = []; S.placing = null; S.pendingLink = null; setCurrentId(b.id); };
  function loadInitial() {
    if (ctx.query.b) {
      try { const b = importCode(data, 'MSB1:' + ctx.query.b); toast('Shared build opened as a new copy.', 'good'); setTimeout(() => app.nav('build/' + b.id), 0); return b; }
      catch (e) { toast(e.message, 'error', 4500); }
    }
    const want = ctx.params[0] || getCurrentId();
    return (want && getBuild(want)) || listBuilds()[0] || createBuild('My first build');
  }
  openBuild(loadInitial());
  if (ctx.params[0] && ctx.params[0] !== build.id) app.nav('build/' + build.id);

  // ---------- DOM ----------
  const cv = h('canvas.bd-canvas', { tabindex: 0, 'aria-label': 'Build grid. Use the toolbar and palette to add items.' });
  const ctx2d = cv.getContext('2d');
  const nameInput = h('input.bd-name', { value: build.name, 'aria-label': 'Build name', maxlength: 80, oninput: (e) => { build.name = e.target.value; touch(false); } });
  const savedEl = h('span.bd-saved.muted', 'Saved');
  const hint = h('div.bd-hint', { 'aria-live': 'polite' });
  const btn = (label, ic, fn, extra = {}) => h('button.btn.sm' + (extra.cls ? '.' + extra.cls : ''), { title: label, 'aria-label': label, onclick: fn, ...extra.attrs, html: icon(ic, 18) + (extra.text ? `<span>${extra.text}</span>` : '') });
  const toolBtn = (id, label, ic) => h('button.btn.sm.tool', { dataset: { tool: id }, title: label, 'aria-label': label, 'aria-pressed': 'false', onclick: () => setTool(id), html: icon(ic, 18) + `<span>${label}</span>` });
  const btnUndo = btn('Undo', 'undo', () => undo(), { attrs: {} });
  const btnRedo = btn('Redo', 'redo', () => redo());
  const linkSel = h('select.bd-linksel', { 'aria-label': 'Connection type', onchange: (e) => { S.linkKind = e.target.value; setTool('link'); } },
    LINK_KINDS.map((k) => h('option', { value: k.id }, k.name)));
  const snapSel = h('select.bd-snap', { 'aria-label': 'Snap to grid', onchange: (e) => { S.snap = +e.target.value; store.set('snap', S.snap); redraw(); } },
    [[0.125, 'Snap 1/8'], [0.25, 'Snap 1/4'], [0.5, 'Snap 1/2'], [1, 'Snap 1'], [0, 'Snap off']].map(([v, l]) => h('option', { value: v, selected: v === S.snap }, l)));
  const multiBtn = h('button.btn.sm', { 'aria-pressed': 'false', onclick: () => { S.multi = !S.multi; multiBtn.setAttribute('aria-pressed', S.multi); }, title: 'Tap several items to select them together' }, 'Multi');

  const toolbar = h('div.bd-toolbar', { role: 'toolbar', 'aria-label': 'Tools' },
    toolBtn('select', 'Move', 'pointer'), toolBtn('pan', 'Pan', 'hand'),
    h('span.bd-sep'), toolBtn('link', 'Connect', 'link'), linkSel,
    h('span.bd-sep'), snapSel, multiBtn,
    h('span.bd-sep'), btnUndo, btnRedo,
    h('span.grow'),
    btn('Zoom out', 'close', () => zoomBy(0.8), { attrs: { html: undefined } }),
  );
  // replace the zoom-out icon with a minus sign
  toolbar.lastChild.innerHTML = '<span aria-hidden="true" style="font:700 20px/1 var(--font-head)">−</span>';
  toolbar.append(btn('Zoom in', 'plus', () => zoomBy(1.25)), btn('Fit to view', 'ruler', () => fit(), { text: 'Fit' }));

  const topbar = h('div.bd-top',
    nameInput, savedEl, h('span.grow'),
    btn('New build', 'plus', () => newOne(), { text: 'New' }),
    btn('Saved builds', 'layers', () => libraryDialog(), { text: 'Saved' }),
    btn('Import a Base64 code', 'upload', () => importDialog(), { text: 'Import' }),
    btn('Export as Base64', 'download', () => exportDialog(), { text: 'Export' }),
    btn('Step-by-step guide', 'play', () => guideDialog(), { text: 'Guide', cls: 'primary' }),
    btn('Ask Claude to draft a plan', 'spark', () => aiDialog(), { text: 'Ask Claude' }),
  );

  // palette
  const search = h('input', { type: 'search', placeholder: 'Search items', 'aria-label': 'Search items', oninput: debounce((e) => { S.q = e.target.value.trim().toLowerCase(); renderPalette(); }, 90) });
  const chips = h('div.bd-chips', { role: 'tablist', 'aria-label': 'Categories' });
  const list = h('div.bd-list');
  const palette = h('aside.bd-side.bd-palette', { 'aria-label': 'Items' },
    h('div.bd-side-head', h('h2', 'Items'), h('button.btn.sm.ghost.bd-close', { 'aria-label': 'Close items', onclick: () => closeSheets(), html: icon('close', 18) })),
    h('div.bd-search', search), chips, list);
  function renderChips() {
    chips.replaceChildren(...['All', ...data.cats].map((c) => h('button.chip', { role: 'tab', 'aria-selected': S.cat === c, onclick: () => { S.cat = c; renderChips(); renderPalette(); } }, c)));
  }
  function renderPalette() {
    const items = data.items.filter((i) => (S.cat === 'All' || i.cat === S.cat) && (!S.q || i.name.toLowerCase().includes(S.q) || i.cat.toLowerCase().includes(S.q)));
    const frag = document.createDocumentFragment();
    if (!S.q && S.cat === 'All') {
      frag.append(h('button.bd-tile.custom', { onclick: () => customDialog() },
        h('span.bd-thumb', h('span.bd-plus', '+')), h('span.bd-tn', h('b', 'Custom block'), h('small', 'A stand-in for an item we have not measured yet'))));
    }
    for (const i of items) {
      frag.append(h('button.bd-tile', { dataset: { id: i.id }, onclick: () => startPlacing({ t: i.id }), title: `${i.name}: ${fmt(i.c[0])} × ${fmt(i.c[1])} crates` },
        h('span.bd-thumb', h('img.sprite', { src: i.sprite, alt: '', loading: 'lazy', width: 48, height: 48, style: { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' } })),
        h('span.bd-tn', h('b', i.name), h('small', `${fmt(i.c[0])} × ${fmt(i.c[1])} crates`))));
    }
    if (!items.length) frag.append(h('div.empty', h('h3', 'No items match'), h('p', 'Try a shorter search or pick All.')));
    list.replaceChildren(frag);
  }

  // inspector
  const inspector = h('aside.bd-side.bd-inspector', { 'aria-label': 'Selected item' });
  const stageWrap = h('div.bd-stage', cv, hint,
    h('div.bd-fab',
      h('button.btn.primary.bd-items-btn', { onclick: () => openSheet('palette'), html: icon('plus', 18) + '<span>Items</span>' }),
      h('button.btn.bd-edit-btn', { onclick: () => openSheet('inspector'), html: icon('layers', 18) + '<span>Edit</span>' })));
  const sheetScrim = h('div.bd-scrim', { onclick: () => closeSheets() });
  const layout = h('div.bd-layout', palette, h('div.bd-center', toolbar, stageWrap), inspector, sheetScrim);
  const page = h('div.bd-page', topbar, layout);
  root.append(page);

  function openSheet(which) { page.dataset.sheet = which; }
  function closeSheets() { delete page.dataset.sheet; }

  // ---------- helpers ----------
  const snapV = (v) => (S.snap ? round(v, S.snap) : v);
  const itemById = (id) => build.items.find((i) => i.id === id);
  const nameOfItem = (it) => (it.label || (it.t === 'custom' ? 'Custom block' : (data.byId.get(it.t) || { name: it.t }).name));
  function redraw() { S.dirty = true; if (!raf) raf = requestAnimationFrame(loop); }
  let raf = 0;
  function loop(now) {
    raf = 0;
    resize();
    const showGrid = cam.s * CELL >= 7 ? CELL : cam.s >= 14 ? 1 : 0;
    let ghost = null;
    if (S.placing && S.pointerWorld) {
      const p = placeAt(S.placing, S.pointerWorld);
      ghost = { ...S.placing, x: p.x, y: p.y };
    }
    let pending = null;
    if (S.pendingLink && S.pointerWorld) pending = { ...S.pendingLink, x: S.pointerWorld[0], y: S.pointerWorld[1] };
    drawScene(ctx2d, cam, build, { data, grid: showGrid, selection: S.sel, hover: S.hover, ghost, pendingLink: pending, showSizes: true, labels: true, time: now, marquee: S.marquee });
    // selected link highlight
    if (S.selLink) {
      const l = build.links.find((x) => x.id === S.selLink);
      const A = l && itemById(l.a), B = l && itemById(l.b);
      if (A && B) {
        const p = toScreen(cam, ...anchorPos(A, l.ax, l.ay)), q = toScreen(cam, ...anchorPos(B, l.bx, l.by));
        ctx2d.save(); ctx2d.strokeStyle = '#f4c430'; ctx2d.lineWidth = 2; ctx2d.setLineDash([5, 4]);
        ctx2d.beginPath(); ctx2d.moveTo(...p); ctx2d.lineTo(...q); ctx2d.stroke(); ctx2d.restore();
      }
    }
    S.dirty = false;
    if (S.placing || S.pendingLink || build.links.some((l) => l.kind === 'pipe')) raf = requestAnimationFrame(loop);
  }
  function resize() {
    const r = stageWrap.getBoundingClientRect();
    const w = Math.max(200, Math.round(r.width)), hh = Math.max(200, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
      cv.style.width = w + 'px'; cv.style.height = hh + 'px';
    }
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam.w = w; cam.h = hh;
  }
  function fit() {
    resize();
    const b = buildBounds(data, build);
    fitCam(cam, b && { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }, 1, 180, 20);
    if (!b) { cam.x = 0; cam.y = Math.max(1.2, cam.h / 2 / cam.s - 0.4); cam.s = 110; }
    redraw();
  }
  function zoomBy(f, cx = cam.w / 2, cy = cam.h / 2) {
    const [wx, wy] = toWorld(cam, cx, cy);
    cam.s = clamp(cam.s * f, 14, 520);
    cam.x = wx - (cx - cam.w / 2) / cam.s;
    cam.y = wy + (cy - cam.h / 2) / cam.s;
    store.set('zoom', Math.round(cam.s));
    redraw();
  }

  // ---------- history + save ----------
  const snapshot = () => JSON.stringify({ items: build.items, links: build.links });
  function checkpoint() {
    S.undo.push(snapshot());
    if (S.undo.length > 120) S.undo.shift();
    S.redo = [];
    syncUndo();
  }
  function restore(js) { const o = JSON.parse(js); build.items = o.items; build.links = o.links; S.sel = new Set([...S.sel].filter((id) => itemById(id))); if (S.selLink && !build.links.some((l) => l.id === S.selLink)) S.selLink = null; touch(); renderInspector(); redraw(); }
  function undo() { if (!S.undo.length) return; S.redo.push(snapshot()); restore(S.undo.pop()); syncUndo(); }
  function redo() { if (!S.redo.length) return; S.undo.push(snapshot()); restore(S.redo.pop()); syncUndo(); }
  function syncUndo() { btnUndo.disabled = !S.undo.length; btnRedo.disabled = !S.redo.length; }
  const persist = debounce(() => {
    const ok = saveBuild(build);
    S.saved = ok;
    savedEl.textContent = ok ? 'Saved in this browser' : 'Could not save: browser storage is full or blocked. Export a code to keep your work.';
    savedEl.classList.toggle('bad', !ok);
  }, 350);
  function touch(rerender = true) { build.updated = Date.now(); savedEl.textContent = 'Saving…'; persist(); if (rerender) renderStatus(); }

  // ---------- placement ----------
  function restY(it, x) {
    const { w, h: hh } = sizeOf(data, it);
    const probe = { ...it, x, y: 0 };
    const b = boundsOf(data, probe);
    let floor = 0;
    for (const o of build.items) {
      if (o.id === it.id) continue;
      const ob = boundsOf(data, o);
      if (ob.x0 < b.x1 - 0.01 && ob.x1 > b.x0 + 0.01 && ob.y1 > floor && ob.y1 <= (it.y != null ? it.y + b.h / 2 + 4 : 99)) floor = Math.max(floor, ob.y1);
    }
    return floor + b.h / 2;
  }
  function placeAt(spec, wp) {
    const x = snapV(wp[0]);
    const probe = { ...spec, r: spec.r || 0, f: false };
    const hh = boundsOf(data, { ...probe, x, y: 0 }).h;
    // surfaces under the pointer: rest on the highest item under the cursor column, else follow pointer height but not below floor
    let y = restY({ ...probe, id: '__g', y: wp[1] + hh }, x);
    if (wp[1] - hh / 2 > y + 0.02) y = snapV(wp[1]);
    return { x, y: S.snap ? Math.max(y, hh / 2) : y };
  }
  function startPlacing(spec) {
    S.placing = { ...spec };
    setTool('select', true);
    hint.textContent = `Placing ${spec.t === 'custom' ? (spec.label || 'Custom block') : data.byId.get(spec.t).name}. Tap the grid to drop it. Tap Done when finished.`;
    hint.innerHTML = '';
    hint.append(h('span', `Placing ${spec.t === 'custom' ? (spec.label || 'custom block') : data.byId.get(spec.t).name}. Tap the grid to place it.`), h('button.btn.sm.good', { onclick: stopPlacing }, 'Done'));
    hint.classList.add('on');
    closeSheets();
    redraw();
  }
  function stopPlacing() { S.placing = null; hint.classList.remove('on'); redraw(); }
  function addItem(spec, x, y) {
    checkpoint();
    const it = { id: uid('i'), t: spec.t, x, y, r: 0, f: false, p: {}, label: spec.label || '' };
    if (spec.t === 'custom') { it.cw = spec.cw; it.ch = spec.ch; it.color = spec.color; }
    build.items.push(it);
    S.sel = new Set([it.id]); S.selLink = null;
    touch(); renderInspector(); redraw();
    return it;
  }

  // ---------- tools ----------
  function setTool(t, keepPlacing) {
    S.tool = t;
    if (!keepPlacing) { S.placing = null; hint.classList.remove('on'); }
    if (t !== 'link') S.pendingLink = null;
    toolbar.querySelectorAll('.tool').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === t));
    if (t === 'link') { hint.innerHTML = ''; hint.append(h('span', `${linkKind(S.linkKind).name}: tap the first item, then the second.`)); hint.classList.add('on'); }
    else if (!S.placing) hint.classList.remove('on');
    cv.style.cursor = t === 'pan' ? 'grab' : t === 'link' ? 'crosshair' : 'default';
    redraw();
  }

  // ---------- pointer handling ----------
  const pts = new Map();
  let drag = null, pinch = null;
  const localPt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    const p = localPt(e);
    pts.set(e.pointerId, p);
    cv.focus({ preventScroll: true });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: cam.s };
      drag = null; return;
    }
    const wp = toWorld(cam, ...p);
    S.pointerWorld = wp;
    if (S.placing) { return; }
    if (S.tool === 'pan') { drag = { kind: 'pan', start: p, cx: cam.x, cy: cam.y }; cv.style.cursor = 'grabbing'; return; }
    if (S.tool === 'link') { linkClick(wp); return; }
    const hit = hitTest(data, build, wp[0], wp[1]);
    if (hit) {
      const additive = S.multi || e.shiftKey || e.ctrlKey || e.metaKey;
      if (additive) { S.sel.has(hit.id) ? S.sel.delete(hit.id) : S.sel.add(hit.id); }
      else if (!S.sel.has(hit.id)) S.sel = new Set([hit.id]);
      S.selLink = null;
      drag = { kind: 'move', start: wp, orig: new Map([...S.sel].map((id) => { const o = itemById(id); return [id, [o.x, o.y]]; })), moved: false };
      renderInspector(); redraw();
    } else {
      const l = hitLink(data, build, cam, p[0], p[1], 10);
      if (l) { S.selLink = l.id; S.sel.clear(); renderInspector(); redraw(); return; }
      if (!(S.multi || e.shiftKey)) { S.sel.clear(); S.selLink = null; renderInspector(); }
      drag = { kind: 'pan', start: p, cx: cam.x, cy: cam.y };
      redraw();
    }
  });
  cv.addEventListener('pointermove', (e) => {
    const p = localPt(e);
    if (pts.has(e.pointerId)) pts.set(e.pointerId, p);
    const wp = toWorld(cam, ...p);
    S.pointerWorld = wp;
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      const target = clamp(pinch.s * d / pinch.d, 14, 520);
      zoomBy(target / cam.s, cx, cy);
      return;
    }
    if (drag) {
      if (drag.kind === 'pan') {
        cam.x = drag.cx - (p[0] - drag.start[0]) / cam.s;
        cam.y = drag.cy + (p[1] - drag.start[1]) / cam.s;
      } else if (drag.kind === 'move') {
        const dx = wp[0] - drag.start[0], dy = wp[1] - drag.start[1];
        if (!drag.moved && Math.hypot(dx, dy) * cam.s < 4) return;
        if (!drag.moved) { checkpoint(); drag.moved = true; }
        for (const [id, o] of drag.orig) {
          const it = itemById(id);
          it.x = snapV(o[0] + dx); it.y = Math.max(snapV(o[1] + dy), 0.01 + (boundsOf(data, it).h / 2) * 0 );
        }
        touch(false);
      }
      redraw();
    } else {
      const hit = (S.tool === 'select' && !S.placing) ? hitTest(data, build, wp[0], wp[1]) : null;
      const hv = hit ? hit.id : (S.tool === 'link' ? ((hitTest(data, build, wp[0], wp[1]) || {}).id || null) : null);
      if (hv !== S.hover) { S.hover = hv; redraw(); }
      if (S.placing || S.pendingLink) redraw();
    }
  });
  const endPtr = (e) => {
    const p = localPt(e);
    const was = pts.has(e.pointerId);
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (S.placing && was && !drag) {
      const wp = toWorld(cam, ...p);
      const pos = placeAt(S.placing, wp);
      addItem(S.placing, pos.x, pos.y);
      return;
    }
    if (drag && drag.kind === 'move' && drag.moved) { renderInspector(); }
    if (drag && drag.kind === 'pan') cv.style.cursor = S.tool === 'pan' ? 'grab' : 'default';
    drag = null;
    redraw();
  };
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = null; drag = null; });
  cv.addEventListener('pointerleave', () => { if (!drag) { S.pointerWorld = S.placing ? S.pointerWorld : null; } });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = localPt(e); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, p[0], p[1]); }, { passive: false });
  cv.style.touchAction = 'none';

  function linkClick(wp) {
    const hit = hitTest(data, build, wp[0], wp[1]);
    if (!hit) { S.pendingLink = null; hint.firstChild && (hint.firstChild.textContent = `${linkKind(S.linkKind).name}: tap the first item, then the second.`); redraw(); return; }
    // anchor offset in item frame
    const a = ((hit.r || 0) * Math.PI) / 180;
    const dx = wp[0] - hit.x, dy = wp[1] - hit.y;
    let ox = dx * Math.cos(a) + dy * Math.sin(a), oy = -dx * Math.sin(a) + dy * Math.cos(a);
    if (hit.f) ox = -ox;
    ox = round(ox, CELL); oy = round(oy, CELL);
    if (!S.pendingLink) {
      S.pendingLink = { from: hit.id, ax: ox, ay: oy, kind: S.linkKind };
      hint.firstChild.textContent = 'SELECT THE SECOND ROPE POINT: tap the second item.';
    } else {
      if (S.pendingLink.from === hit.id) { toast('Pick a different item for the second point.'); return; }
      checkpoint();
      const l = { id: uid('l'), a: S.pendingLink.from, b: hit.id, kind: S.linkKind, ax: S.pendingLink.ax, ay: S.pendingLink.ay, bx: ox, by: oy, label: '', out: '', in: '' };
      build.links.push(l);
      S.pendingLink = null; S.selLink = l.id; S.sel.clear();
      hint.firstChild.textContent = `${linkKind(S.linkKind).name} added. Tap another first item, or pick Move.`;
      touch(); renderInspector();
    }
    redraw();
  }

  // keyboard
  const onKey = (e) => {
    if (!page.isConnected) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.shiftKey ? redo() : undo(); e.preventDefault(); }
    else if (mod && e.key.toLowerCase() === 'y') { redo(); e.preventDefault(); }
    else if (mod && e.key.toLowerCase() === 'd') { dupSel(); e.preventDefault(); }
    else if (mod && e.key.toLowerCase() === 'a') { S.sel = new Set(build.items.map((i) => i.id)); renderInspector(); redraw(); e.preventDefault(); }
    else if (e.key === 'Escape') { stopPlacing(); S.pendingLink = null; S.sel.clear(); S.selLink = null; setTool('select'); renderInspector(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { delSel(); e.preventDefault(); }
    else if (e.key.startsWith('Arrow') && (S.sel.size)) {
      const st = S.snap || CELL; const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
      checkpoint(); S.sel.forEach((id) => { const it = itemById(id); it.x += d[0]; it.y += d[1]; }); touch(); renderInspector(); redraw(); e.preventDefault();
    } else if (e.key.toLowerCase() === 'r' && S.sel.size) rotSel(90);
    else if (e.key.toLowerCase() === 'f' && S.sel.size) flipSel();
    else if (e.key.toLowerCase() === 'v') setTool('select');
    else if (e.key.toLowerCase() === 'h') setTool('pan');
    else if (e.key.toLowerCase() === 'l') setTool('link');
  };
  document.addEventListener('keydown', onKey);

  // ---------- actions ----------
  function delSel() {
    if (S.selLink) { checkpoint(); build.links = build.links.filter((l) => l.id !== S.selLink); S.selLink = null; touch(); renderInspector(); redraw(); return; }
    if (!S.sel.size) return;
    checkpoint();
    build.items = build.items.filter((i) => !S.sel.has(i.id));
    build.links = build.links.filter((l) => !S.sel.has(l.a) && !S.sel.has(l.b));
    S.sel.clear(); touch(); renderInspector(); redraw();
  }
  function dupSel() {
    if (!S.sel.size) return;
    checkpoint();
    const map = new Map(); const created = [];
    for (const id of S.sel) { const o = itemById(id); const c = deepCopy(o); c.id = uid('i'); c.x += 0.25; c.y += 0; map.set(id, c.id); build.items.push(c); created.push(c.id); }
    for (const l of [...build.links]) if (map.has(l.a) && map.has(l.b)) build.links.push({ ...deepCopy(l), id: uid('l'), a: map.get(l.a), b: map.get(l.b) });
    S.sel = new Set(created); touch(); renderInspector(); redraw();
  }
  function rotSel(d) { checkpoint(); S.sel.forEach((id) => { const it = itemById(id); it.r = ((((it.r || 0) + d) % 360) + 360) % 360; }); touch(); renderInspector(); redraw(); }
  function flipSel() { checkpoint(); S.sel.forEach((id) => { const it = itemById(id); it.f = !it.f; }); touch(); renderInspector(); redraw(); }
  function restSel() {
    checkpoint();
    [...S.sel].map(itemById).sort((a, b) => a.y - b.y).forEach((it) => { it.y = restY(it, it.x); });
    touch(); renderInspector(); redraw();
  }
  function order(front) {
    checkpoint();
    const sel = build.items.filter((i) => S.sel.has(i.id)), rest = build.items.filter((i) => !S.sel.has(i.id));
    build.items = front ? [...rest, ...sel] : [...sel, ...rest];
    touch(); redraw();
  }

  // ---------- inspector ----------
  function numField(label, val, step, onSet, opts = {}) {
    const i = h('input', { type: 'number', step, value: fmt(val, 3), inputmode: 'decimal', 'aria-label': label, onchange: (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onSet(v); else e.target.value = fmt(val, 3); } });
    return h('label.field', h('span', label), i);
  }
  function renderStatus() { /* hook for build-level stats (re-rendered by inspector when nothing selected) */ if (!S.sel.size && !S.selLink) renderInspector(); }
  function renderInspector() {
    const el = inspector;
    const head = h('div.bd-side-head', h('h2', S.sel.size ? 'Selected' : S.selLink ? 'Connection' : 'This build'), h('button.btn.sm.ghost.bd-close', { 'aria-label': 'Close panel', onclick: () => closeSheets(), html: icon('close', 18) }));
    page.classList.toggle('has-sel', !!(S.sel.size || S.selLink));
    if (S.selLink) {
      const l = build.links.find((x) => x.id === S.selLink);
      if (!l) { S.selLink = null; return renderInspector(); }
      const A = itemById(l.a), B = itemById(l.b);
      el.replaceChildren(head, h('div.bd-body',
        h('p.muted', `${nameOfItem(A)} to ${nameOfItem(B)}`),
        h('label.field', h('span', 'Type'), h('select', { onchange: (e) => { checkpoint(); l.kind = e.target.value; touch(); renderInspector(); redraw(); } }, LINK_KINDS.map((k) => h('option', { value: k.id, selected: k.id === l.kind }, k.name)))),
        h('p.muted.small', linkKind(l.kind).hint),
        h('label.field', h('span', 'Label (shown on the plan)'), h('input', { value: l.label || '', maxlength: 40, onchange: (e) => { checkpoint(); l.label = e.target.value; touch(); redraw(); } })),
        l.kind === 'wire' ? h('div.stack', h('label.field', h('span', 'OUTPUT (for example ACTIVATION)'), h('input', { value: l.out || '', maxlength: 30, onchange: (e) => { checkpoint(); l.out = e.target.value; touch(); } })),
          h('label.field', h('span', 'INPUT (for example ACTIVATION, ANGLE, COLOR)'), h('input', { value: l.in || '', maxlength: 30, onchange: (e) => { checkpoint(); l.in = e.target.value; touch(); } }))) : null,
        h('div.row', h('button.btn.sm', { onclick: () => { checkpoint(); const t = l.a; l.a = l.b; l.b = t; [l.ax, l.bx] = [l.bx, l.ax]; [l.ay, l.by] = [l.by, l.ay]; touch(); redraw(); } }, 'Swap ends'), h('button.btn.sm', { onclick: delSel, html: icon('trash', 16) + '<span>Delete</span>' }))));
      return;
    }
    if (!S.sel.size) {
      const b = buildBounds(data, build);
      const parts = partsList(data, build);
      el.replaceChildren(head, h('div.bd-body',
        h('p.muted', build.items.length ? 'Tap an item to edit it. Tap Items to add more.' : 'This build is empty. Tap Items, pick something, then tap the grid to place it.'),
        h('div.bd-stats',
          stat('Items', build.items.length), stat('Connections', build.links.length),
          stat('Width', b ? `${fmt(b.w)} crates` : '–'), stat('Height', b ? `${fmt(b.h)} crates` : '–')),
        parts.length ? h('details', { open: parts.length < 8 }, h('summary', 'Parts list'), h('ul.bd-parts', parts.map((p) => h('li', `${p.n} × ${p.name}`)))) : null,
        h('label.field', h('span', 'Notes'), h('textarea', { rows: 4, maxlength: 2000, placeholder: 'Anything you want to remember', value: build.notes || '', oninput: debounce((e) => { build.notes = e.target.value; touch(false); }, 300) }, build.notes || '')),
        h('details', h('summary', 'Shortcuts'), h('ul.bd-keys', [['V', 'Move'], ['H', 'Pan'], ['L', 'Connect'], ['R', 'Rotate 90°'], ['F', 'Flip'], ['Delete', 'Remove'], ['Arrows', 'Nudge'], ['Ctrl+Z / Y', 'Undo / redo'], ['Ctrl+D', 'Duplicate'], ['Esc', 'Cancel']].map(([k, v]) => h('li', h('span.kbd', k), ' ', v))))));
      return;
    }
    const sel = [...S.sel].map(itemById).filter(Boolean);
    if (sel.length > 1) {
      el.replaceChildren(head, h('div.bd-body', h('p', `${sel.length} items selected`),
        h('div.row', h('button.btn.sm', { onclick: () => rotSel(90) }, 'Rotate 90°'), h('button.btn.sm', { onclick: flipSel }, 'Flip'), h('button.btn.sm', { onclick: restSel }, 'Rest on surface')),
        h('div.row', h('button.btn.sm', { onclick: dupSel }, 'Duplicate'), h('button.btn.sm', { onclick: () => order(true) }, 'To front'), h('button.btn.sm', { onclick: () => order(false) }, 'To back')),
        h('div.row', h('button.btn.sm', { onclick: () => alignSel('left') }, 'Align left'), h('button.btn.sm', { onclick: () => alignSel('bottom') }, 'Align bottoms')),
        h('button.btn.sm', { onclick: delSel, html: icon('trash', 16) + '<span>Delete all selected</span>' })));
      return;
    }
    const it = sel[0];
    const cat = it.t === 'custom' ? null : data.byId.get(it.t);
    const sz = sizeOf(data, it);
    const bb = boundsOf(data, it);
    const params = cat ? cat.params : [];
    el.replaceChildren(head, h('div.bd-body',
      h('div.bd-ihead',
        cat ? h('img.sprite', { src: cat.sprite, alt: '', style: { maxWidth: '64px', maxHeight: '64px' } }) : h('span.bd-thumb.big', { style: { background: it.color || '#8a6bd1' } }),
        h('div', h('h3', cat ? cat.name : 'Custom block'), h('p.muted.small', cat ? `${cat.cat}. ${fmt(sz.w)} × ${fmt(sz.h)} crates (${fmt(sz.w / CELL, 1)} × ${fmt(sz.h / CELL, 1)} cells)` : `${fmt(sz.w)} × ${fmt(sz.h)} crates`),
          cat && cat.flags.length ? h('span.badge.warn', 'Size is approximate') : null)),
      h('label.field', h('span', 'Label'), h('input', { value: it.label || '', maxlength: 40, placeholder: 'Optional name on the plan', onchange: (e) => { checkpoint(); it.label = e.target.value; touch(); redraw(); } })),
      h('div.bd-two', numField('X (crates)', it.x, 0.125, (v) => { checkpoint(); it.x = v; touch(); redraw(); renderInspector(); }), numField('Y (crates)', it.y, 0.125, (v) => { checkpoint(); it.y = v; touch(); redraw(); renderInspector(); })),
      h('div.bd-two', numField('Rotation (°)', it.r || 0, 15, (v) => { checkpoint(); it.r = ((v % 360) + 360) % 360; touch(); redraw(); renderInspector(); }),
        h('div.field', h('span.muted.small', 'Quick'), h('div.row.tight', h('button.btn.sm.icon', { title: 'Rotate 90°', 'aria-label': 'Rotate 90 degrees', onclick: () => rotSel(90), html: icon('rotate', 18) }), h('button.btn.sm.icon', { title: 'Flip', 'aria-label': 'Flip', onclick: flipSel, html: icon('flip', 18) })))),
      it.t === 'custom' ? h('div.bd-two', numField('Width', it.cw, 0.125, (v) => { checkpoint(); it.cw = Math.max(0.0625, v); touch(); redraw(); renderInspector(); }), numField('Height', it.ch, 0.125, (v) => { checkpoint(); it.ch = Math.max(0.0625, v); touch(); redraw(); renderInspector(); })) : null,
      params.length ? h('fieldset.bd-params', h('legend', 'Settings in game'), params.map((pd) => paramField(it, pd))) : null,
      cat && cat.act ? h('p.muted.small', 'This item has a power button in game. Press it to activate.') : null,
      h('div.row', h('button.btn.sm', { onclick: restSel }, 'Rest on surface'), h('button.btn.sm', { onclick: dupSel, html: icon('copy', 16) + '<span>Duplicate</span>' }), h('button.btn.sm', { onclick: delSel, html: icon('trash', 16) + '<span>Delete</span>' })),
      h('div.row', h('button.btn.sm.ghost', { onclick: () => order(true) }, 'To front'), h('button.btn.sm.ghost', { onclick: () => order(false) }, 'To back'),
        cat ? h('a.btn.sm.ghost', { href: '#/wiki/item/' + cat.id }, 'Wiki page') : null),
      cat && cat.note ? h('p.muted.small', cat.note) : null));
  }
  const stat = (k, v) => h('div.bd-stat', h('b', String(v)), h('span', k));
  function paramField(it, pd) {
    const val = it.p && it.p[pd.key] !== undefined ? it.p[pd.key] : pd.default;
    const set = (v) => { checkpoint(); it.p = it.p || {}; it.p[pd.key] = v; touch(false); };
    const lab = h('span', pd.label + (pd.uncertain ? ' (unconfirmed)' : ''));
    if (pd.type === 'bool') return h('label.field.inline', h('input', { type: 'checkbox', checked: !!val, onchange: (e) => set(e.target.checked) }), lab);
    if (pd.type === 'color') return h('label.field', lab, h('input', { type: 'color', value: val, onchange: (e) => set(e.target.value) }));
    return h('label.field', lab, h('input', { type: 'number', value: val, step: 'any', inputmode: 'decimal', onchange: (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) set(v); } }));
  }
  function alignSel(how) {
    checkpoint();
    const sel = [...S.sel].map(itemById);
    if (how === 'left') { const m = Math.min(...sel.map((i) => boundsOf(data, i).x0)); sel.forEach((i) => { i.x += m - boundsOf(data, i).x0; }); }
    else { const m = Math.min(...sel.map((i) => boundsOf(data, i).y0)); sel.forEach((i) => { i.y += m - boundsOf(data, i).y0; }); }
    touch(); redraw();
  }

  // ---------- dialogs ----------
  function modal(titleText, body, actions = []) {
    const d = h('dialog', { 'aria-label': titleText },
      h('header', h('span', titleText), h('span.grow'), h('button.btn.sm.ghost', { 'aria-label': 'Close', onclick: () => d.close(), html: icon('close', 18) })),
      h('div.body', body),
      actions.length ? h('footer', actions) : null);
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    return d;
  }
  function customDialog() {
    const nm = h('input', { placeholder: 'For example Streetlight', maxlength: 40 });
    const w = h('input', { type: 'number', value: 1, step: 0.125, min: 0.0625, inputmode: 'decimal' });
    const hh = h('input', { type: 'number', value: 1, step: 0.125, min: 0.0625, inputmode: 'decimal' });
    const col = h('input', { type: 'color', value: '#8a6bd1' });
    const d = modal('Custom block', h('div.stack',
      h('p.muted', 'Use this for items we have not measured yet. Give it a name and a size in crates, then place it like any other item.'),
      h('label.field', h('span', 'Name'), nm),
      h('div.bd-two', h('label.field', h('span', 'Width (crates)'), w), h('label.field', h('span', 'Height (crates)'), hh)),
      h('label.field', h('span', 'Colour'), col)),
      [h('button.btn', { onclick: () => d.close() }, 'Cancel'), h('button.btn.primary', { onclick: () => {
        const cw = parseFloat(w.value), ch = parseFloat(hh.value);
        if (!(cw > 0 && ch > 0)) { toast('Width and height must be above zero.', 'error'); return; }
        d.close(); startPlacing({ t: 'custom', cw, ch, color: col.value, label: nm.value.trim() });
      } }, 'Place it')]);
  }
  function exportDialog() {
    const code = encodeBuild(build);
    const share = location.origin + location.pathname + '#/build?b=' + encodeURIComponent(toB64(JSON.stringify(build)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    const ta = h('textarea', { readonly: true, rows: 7, 'aria-label': 'Base64 build code' }, code);
    const d = modal('Export as Base64', h('div.stack',
      h('p', 'This text is your whole build. Paste it into Import on any device to open it again.'),
      ta, h('p.muted.small', `${code.length.toLocaleString()} characters. Includes ${build.items.length} items and ${build.links.length} connections.`)),
      [h('button.btn', { onclick: async () => { toast((await copyText(share)) ? 'Link copied.' : 'Copy failed. Select the text instead.', 'good'); } }, 'Copy share link'),
        h('button.btn', { onclick: () => download(`${(build.name || 'build').replace(/[^\w-]+/g, '-')}.msb.txt`, code) }, 'Download .txt'),
        h('button.btn.primary', { onclick: async () => { ta.select(); toast((await copyText(code)) ? 'Code copied.' : 'Copy failed. Select the text instead.', 'good'); } }, 'Copy code')]);
    setTimeout(() => ta.select(), 50);
  }
  function importDialog() {
    const ta = h('textarea', { rows: 8, placeholder: 'Paste a code that starts with MSB1:', 'aria-label': 'Base64 build code' });
    const msg = h('p.muted.small');
    const fileIn = h('input', { type: 'file', accept: '.txt,.json,text/plain', 'aria-label': 'Choose a code file', onchange: async (e) => { const f = e.target.files[0]; if (f) ta.value = await f.text(); } });
    const d = modal('Import a build', h('div.stack', h('p', 'Paste a Base64 code or choose a saved file. The build opens as a new copy; nothing you already have is changed.'), ta, fileIn, msg),
      [h('button.btn', { onclick: () => d.close() }, 'Cancel'), h('button.btn.primary', { onclick: () => {
        try { const b = importCode(data, ta.value); d.close(); toast(`Opened “${b.name}”.`, 'good'); app.nav('build/' + b.id); }
        catch (e) { msg.textContent = e.message; msg.classList.add('bad'); }
      } }, 'Import')]);
  }
  function libraryDialog() {
    const body = h('div.stack');
    const render = () => {
      const all = listBuilds();
      body.replaceChildren(all.length ? h('ul.bd-lib', all.map((b) => h('li', { class: b.id === build.id ? 'cur' : '' },
        h('div.bd-lib-main', h('b', b.name), h('small.muted', `${b.items.length} items · ${new Date(b.updated).toLocaleString()}`)),
        h('div.row.tight',
          h('button.btn.sm', { onclick: () => { d.close(); app.nav('build/' + b.id); } }, b.id === build.id ? 'Open (current)' : 'Open'),
          h('button.btn.sm.ghost', { onclick: () => { const c = duplicateBuild(b.id); toast('Duplicated.'); render(); }, 'aria-label': `Duplicate ${b.name}` }, 'Copy'),
          h('button.btn.sm.ghost', { 'aria-label': `Delete ${b.name}`, onclick: () => { if (confirm(`Delete “${b.name}”? This cannot be undone. Export it first if you may want it back.`)) { deleteBuild(b.id); if (b.id === build.id) { const n = listBuilds()[0] || createBuild('My first build'); d.close(); app.nav('build/' + n.id); } else render(); } } }, 'Delete'))))) :
        h('div.empty', h('h3', 'Nothing saved yet'), h('p', 'Your builds appear here automatically.')));
    };
    const d = modal('Saved in this browser', body, [h('button.btn.primary', { onclick: () => { d.close(); newOne(); } }, 'New build')]);
    render();
  }
  function newOne() { saveBuild(build); const b = createBuild('Untitled build'); app.nav('build/' + b.id); }
  function guideDialog() {
    if (!build.items.length) { toast('Add some items first, then the guide builds itself.'); return; }
    const copyB = deepCopy(build);
    const steps = generateGuide(data, copyB);
    const pl = createPlayer({ data, build: copyB, steps, autoplay: true });
    const d = modal('Step-by-step guide', h('div.stack', pl.el, h('details', h('summary', 'Parts list'), h('ul.bd-parts', partsList(data, copyB).map((p) => h('li', `${p.n} × ${p.name}`))))),
      [h('button.btn', { onclick: async () => toast((await copyText(guideAsText(data, copyB, steps))) ? 'Guide copied as text.' : 'Copy failed.', 'good') }, 'Copy as text'),
        h('button.btn', { onclick: () => download(`${(build.name || 'guide').replace(/[^\w-]+/g, '-')}-guide.txt`, guideAsText(data, copyB, steps)) }, 'Download text'),
        h('button.btn.primary', { onclick: () => d.close() }, 'Close')]);
    d.classList.add('wide');
    d.addEventListener('close', () => pl.destroy());
  }
  async function aiDialog() {
    let mod;
    try { mod = await import('../ai.js'); } catch (e) { toast('The Claude helper is not available in this version of the site.', 'error', 4000); return; }
    const panel = mod.createAiPanel({ data, getBuild: () => build, onResult: (nb) => {
      checkpoint();
      const norm = { ...build, items: nb.items || [], links: nb.links || [] };
      build.items = norm.items; build.links = norm.links;
      if (nb.name && !build.items.length === false && /^(Untitled|My first)/.test(build.name)) { build.name = nb.name; nameInput.value = build.name; }
      S.sel.clear(); touch(); renderInspector(); fit(); d.close(); toast('Plan loaded. Use Undo to go back.', 'good');
    } });
    const d = modal('Ask Claude to draft a plan', panel);
    d.classList.add('wide');
  }

  // ---------- init ----------
  renderChips(); renderPalette(); renderInspector(); syncUndo(); setTool('select');
  const ro = new ResizeObserver(() => redraw());
  ro.observe(stageWrap);
  const offSprites = onSpritesLoaded(redraw);
  const onVis = () => redraw();
  window.addEventListener('resize', onVis);
  requestAnimationFrame(() => { resize(); if (build.items.length) fit(); else { cam.x = 1.5; cam.y = Math.max(1.2, cam.h / 2 / cam.s - 0.5); redraw(); } });
  const pending = store.get('pending');
  if (pending && pending.t) { store.del('pending'); if (data.byId.has(pending.t)) setTimeout(() => startPlacing({ t: pending.t }), 50); }
  window.__msbBuild = { get: () => build, state: S, addItem, fit, cam };

  return () => {
    persist.flush ? persist.flush() : saveBuild(build);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onVis);
    ro.disconnect(); offSprites(); cancelAnimationFrame(raf);
    saveBuild(build);
    document.querySelectorAll('dialog').forEach((d) => d.remove());
    delete window.__msbBuild;
  };
}
