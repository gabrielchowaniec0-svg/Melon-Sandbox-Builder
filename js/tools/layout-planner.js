// Layout planner: will a list of items fit in a rectangle? Shelf packing preview and Build code export.
import { h, store, encodeBuild, toast } from '../util.js';
import { CELL, newBuild } from '../data.js';
import { saveBuild } from '../library.js';
import { makeCam, fitCam, drawScene, toScreen, onSpritesLoaded } from '../render.js';
import { field, seg, note, copyBtn, saveFile, itemPicker, thumb, setupCanvas, watchWidth, r2 } from './kit.js';

/** Shelf packing. items: [{id, w, h}] in crates. Rows are filled left to right, tallest items first. */
export function shelfPack(items, W, H, gap) {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  const placed = [], unplaced = [];
  let x = 0, y = 0, rowH = 0, row = 0;
  for (const it of sorted) {
    if (it.w > W + 1e-9) { unplaced.push({ ...it, why: 'wider than the space' }); continue; }
    if (x > 0 && x + gap + it.w > W + 1e-9) { y += rowH + gap; x = 0; rowH = 0; row++; }
    else if (x > 0) x += gap;
    if (y + it.h > H + 1e-9) { unplaced.push({ ...it, why: 'no room left' }); continue; }
    placed.push({ ...it, x0: x, y0: y, row });
    x += it.w; rowH = Math.max(rowH, it.h);
  }
  return { placed, unplaced };
}

export default {
  id: 'layout-planner',
  title: 'Layout planner',
  blurb: 'Check whether a list of items fits in a space and preview a simple shelf layout you can export as a build.',
  mount(root, ctx) {
    const { data } = ctx;
    const saved = store.get('tools.layout', {}) || {};
    const st = {
      w: saved.w ?? 8, h: saved.h ?? 4, gap: saved.gap ?? 1, rot: saved.rot !== false, style: saved.style || 'shelf',
      list: (saved.list || [['crate', 6], ['door', 1], ['table', 1]]).filter(([id]) => data.byId.has(id)),
    };
    const persist = () => store.set('tools.layout', st);

    const wIn = h('input', { type: 'number', min: 0.125, step: 'any', inputmode: 'decimal', value: st.w, 'aria-label': 'Space width in crates' });
    const hIn = h('input', { type: 'number', min: 0.125, step: 'any', inputmode: 'decimal', value: st.h, 'aria-label': 'Space height in crates' });
    const gapIn = h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric', value: st.gap, 'aria-label': 'Gap in grid cells' });
    const rotChk = h('input', { type: 'checkbox', checked: st.rot });
    const listEl = h('div.stack');
    const verdict = h('div');
    const canvas = h('canvas.tl-canvas', { role: 'img', 'aria-label': 'Preview of the packed layout' });
    const wrap = h('div.tl-previewbox', canvas);
    const unplacedEl = h('div');
    const codeBox = h('textarea', { rows: 4, readonly: true, spellcheck: false, 'aria-label': 'Build code' });
    let result = null, build = null, cam = null;

    const picker = itemPicker(data, { onPick: (it) => { const e = st.list.find((l) => l[0] === it.id); if (e) e[1]++; else st.list.push([it.id, 1]); update(); }, mark: (it) => { const e = st.list.find((l) => l[0] === it.id); return e ? `x${e[1]}` : null; } });

    function renderList() {
      listEl.replaceChildren(...(st.list.length ? st.list.map((l, i) => {
        const it = data.byId.get(l[0]);
        const cnt = h('input', { type: 'number', min: 1, max: 99, step: 1, value: l[1], inputmode: 'numeric', 'aria-label': `How many ${it.name}`, onchange: (e) => { l[1] = Math.max(1, Math.min(99, Math.round(+e.target.value) || 1)); update(); } });
        return h('div.tl-listrow', thumb(it, 36), h('span.tl-pick-text', h('b', it.name), h('small.muted', `${it.c[0]} × ${it.c[1]} crates`)), cnt,
          h('button.btn.sm.ghost', { type: 'button', 'aria-label': `Remove ${it.name}`, onclick: () => { st.list.splice(i, 1); update(); } }, 'Remove'));
      }) : [h('p.muted', 'The list is empty. Pick items on the left.')]));
    }

    function compute() {
      const W = +wIn.value, H = +hIn.value;
      st.w = W; st.h = H; st.gap = Math.max(0, Math.round(+gapIn.value) || 0); st.rot = rotChk.checked;
      const gap = st.gap * CELL;
      const flat = [];
      for (const [id, n] of st.list) {
        const it = data.byId.get(id);
        for (let k = 0; k < n; k++) {
          // with turning allowed, lay tall items on their side when that helps them fit the width and the height
          let w = it.c[0], hh = it.c[1], r = 0;
          if (st.rot && hh > w) { w = it.c[1]; hh = it.c[0]; r = 90; }
          flat.push({ id: `${id}#${k}`, t: id, name: it.name, w, h: hh, r });
        }
      }
      return { W, H, gap, flat };
    }

    function update() {
      persist();
      renderList();
      picker.refresh();
      const p = compute();
      if (!(p.W > 0) || !(p.H > 0)) { verdict.replaceChildren(note('warn', h('p', 'Enter a width and a height greater than zero.'))); result = null; paint(); return; }
      result = shelfPack(p.flat, p.W, p.H, p.gap);
      const itemArea = p.flat.reduce((a, f) => a + f.w * f.h, 0), space = p.W * p.H;
      const fitAll = result.unplaced.length === 0 && p.flat.length > 0;
      const usedH = result.placed.reduce((m, f) => Math.max(m, f.y0 + f.h), 0);
      verdict.replaceChildren(
        p.flat.length ? note(fitAll ? 'good' : 'warn',
          h('p', h('b', fitAll ? 'Everything fits. ' : `${result.unplaced.length} of ${p.flat.length} items do not fit. `),
            `The items add up to ${r2(itemArea)} crate² of a ${r2(space)} crate² space (${Math.round((itemArea / space) * 100)} percent). `,
            fitAll ? `The shelf layout uses ${r2(usedH)} of ${r2(p.H)} crates in height.` : itemArea > space ? 'They need more area than the space has, so no layout could hold them all.' : 'The area is enough, but this simple shelf method wastes gaps. A cleverer arrangement by hand may still fit them.')) :
          note('', h('p', 'Add some items to see if they fit.')));
      unplacedEl.replaceChildren(result.unplaced.length ? h('div', h('h3', 'Did not fit'), h('ul', result.unplaced.map((u) => h('li', `${u.name} (${r2(u.w)} × ${r2(u.h)} crates): ${u.why}`)))) : null);
      buildExport();
      paint();
    }

    function buildExport() {
      const p = compute();
      const b = newBuild('Layout plan');
      const placed = result.placed;
      if (st.style === 'shelf') {
        for (const f of placed) b.items.push({ id: f.id.replace('#', '_'), t: f.t, x: +(f.x0 + f.w / 2).toFixed(3), y: +(f.y0 + f.h / 2).toFixed(3), r: f.r, f: false, p: {}, label: '' });
      } else {
        // everything on the floor, rows laid end to end along x
        let x = 0;
        const all = [...[...placed].sort((a, c) => a.row - c.row || a.x0 - c.x0), ...result.unplaced];
        for (const f of all) { b.items.push({ id: f.id.replace('#', '_'), t: f.t, x: +(x + f.w / 2).toFixed(3), y: +(f.h / 2).toFixed(3), r: f.r, f: false, p: {}, label: '' }); x += f.w + p.gap; }
      }
      b.notes = `Made with the Layout planner for a ${st.w} x ${st.h} crate space. Untested plan.`;
      build = b;
      codeBox.value = b.items.length ? encodeBuild(b) : '';
    }

    function paint() {
      const w = Math.max(280, wrap.clientWidth || 600);
      const W = +wIn.value || 1, H = +hIn.value || 1;
      const hh = Math.round(Math.max(200, Math.min(w < 500 ? 300 : 420, (w * H) / W + 70)));
      const c = setupCanvas(canvas, w, hh);
      cam = makeCam(w, hh);
      fitCam(cam, { x0: 0, x1: W, y0: 0, y1: H }, 0.5, 200, 8);
      const items = result ? result.placed.map((f) => ({ id: f.id, t: f.t, x: f.x0 + f.w / 2, y: f.y0 + f.h / 2, r: f.r, f: false })) : [];
      drawScene(c, cam, { items, links: [] }, { data, grid: CELL * 8, scaleBar: false });
      const [x0, y0] = toScreen(cam, 0, H), [x1, y1] = toScreen(cam, W, 0);
      c.save(); c.strokeStyle = '#1d2123'; c.lineWidth = 5; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
      c.strokeStyle = '#f4c430'; c.lineWidth = 2.5; c.setLineDash([8, 5]); c.strokeRect(x0, y0, x1 - x0, y1 - y0); c.restore();
      c.fillStyle = 'rgba(29,33,35,.9)'; c.font = '700 12px "Atkinson Hyperlegible", system-ui, sans-serif';
      const t = `${r2(W)} × ${r2(H)} crates`; const tw = c.measureText(t).width + 12;
      c.fillRect(x0, y0 - 22 < 0 ? y0 + 4 : y0 - 22, tw, 18); c.fillStyle = '#f4c430'; c.textBaseline = 'middle'; c.fillText(t, x0 + 6, (y0 - 22 < 0 ? y0 + 4 : y0 - 22) + 9);
    }

    [wIn, hIn, gapIn].forEach((el) => el.addEventListener('input', update));
    rotChk.addEventListener('change', update);
    const styleSeg = seg([['shelf', 'Shelves (upper rows float)'], ['floor', 'One row on the floor']], st.style, (v) => { st.style = v; persist(); if (result) buildExport(); }, 'Export style');

    root.append(h('div.tl-split',
      h('section.panel', h('header', 'Pick items'), h('div.body', picker.el)),
      h('div.tl-main',
        h('section.panel', h('header', 'Space and items'), h('div.body.stack',
          h('div.tl-grid3', field('Width (crates)', wIn), field('Height (crates)', hIn), field('Gap (grid cells)', gapIn)),
          h('label.row.tl-check', rotChk, 'Lay tall items on their side to save height'),
          listEl, h('button.btn.ghost.sm', { type: 'button', onclick: () => { st.list = []; update(); } }, 'Clear list'))),
        h('section.panel', h('header', 'Will it fit?'), h('div.body.stack', verdict, wrap, unplacedEl,
          h('p.muted', 'Items are packed in rows from the floor up, tallest first. Each row is as tall as its tallest item. Items in higher rows have nothing under them unless you add supports in the game.'))),
        h('section.panel', h('header', 'Export as a build'), h('div.body.stack',
          styleSeg, codeBox,
          h('div.row', copyBtn(() => codeBox.value, 'Copy code'),
            h('button.btn.sm', { type: 'button', onclick: () => codeBox.value && saveFile('layout-plan.msb.txt', codeBox.value) }, 'Download code'),
            h('button.btn.sm.primary', { type: 'button', onclick: () => { if (!build || !build.items.length) { toast('Nothing to save yet. Add items first.', 'error'); return; } build.id = 'b' + Date.now().toString(36); saveBuild(build) ? toast('Saved to your library as "Layout plan".', 'good') : toast('The browser could not save. Storage may be full.', 'error'); } }, 'Save to my library')),
          h('p.muted', 'Shelves keeps the layout you see above. One row on the floor lays every item on the floor side by side, which is the safest plan for gravity but can be wider than the space.')))))
    );
    const stop = watchWidth(wrap, paint);
    const off = onSpritesLoaded(paint);
    update();
    return () => { stop(); off(); };
  },
};
