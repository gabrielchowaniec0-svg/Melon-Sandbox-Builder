// Build stats: parts, bounds, centre of mass by area, categories, floating and overlapping items.
import { h, store } from '../util.js';
import { boundsOf, sizeOf, buildBounds, CELL } from '../data.js';
import { makeCam, fitCam, drawScene, toScreen, onSpritesLoaded } from '../render.js';
import { generateGuide, guideAsText, partsList, nameMap } from '../guide.js';
import { note, copyBtn, saveFile, buildSelect, setupCanvas, watchWidth, r2, r3, PX_W, PX_H } from './kit.js';

const TOL = 0.06; // crates: how close counts as touching

export function analyse(data, build) {
  const names = nameMap(data, build).names;
  const bs = new Map(build.items.map((i) => [i.id, boundsOf(data, i)]));
  const linked = new Set();
  for (const l of build.links || []) { linked.add(l.a); linked.add(l.b); }
  const floating = [], overlaps = [];
  for (const it of build.items) {
    const b = bs.get(it.id);
    if (b.y0 <= TOL) continue; // on the floor (or below it)
    const rests = build.items.some((o) => {
      if (o === it) return false;
      const ob = bs.get(o.id);
      return Math.abs(ob.y1 - b.y0) <= TOL && Math.min(ob.x1, b.x1) - Math.max(ob.x0, b.x0) > 0.02;
    });
    if (!rests) floating.push({ it, gap: b.y0, linked: linked.has(it.id) });
  }
  for (let i = 0; i < build.items.length; i++) {
    for (let j = i + 1; j < build.items.length; j++) {
      const a = bs.get(build.items[i].id), b = bs.get(build.items[j].id);
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ox > 0.03 && oy > 0.03) overlaps.push({ a: build.items[i], b: build.items[j], ox, oy });
    }
  }
  let area = 0, mx = 0, my = 0;
  for (const it of build.items) { const { w, h: hh } = sizeOf(data, it); area += w * hh; mx += w * hh * it.x; my += w * hh * it.y; }
  const com = area ? { x: mx / area, y: my / area } : null;
  const cats = new Map();
  for (const it of build.items) {
    const k = it.t === 'custom' ? 'Custom blocks' : (data.byId.get(it.t) || {}).cat || 'Unknown';
    cats.set(k, (cats.get(k) || 0) + 1);
  }
  return { names, bounds: buildBounds(data, build), floating, overlaps, area, com, cats: [...cats.entries()].sort((a, b) => b[1] - a[1]) };
}

export default {
  id: 'build-stats',
  title: 'Build stats',
  blurb: 'Parts, size, centre of mass, floating and overlapping items for any saved build, plus the guide as text.',
  mount(root, ctx) {
    const { data } = ctx;
    const out = h('div.stack');
    let off = null, stopW = null;
    const sel = buildSelect((b) => show(b), { blank: 'Choose a saved build' });
    const first = store.get('tools.stats.last');
    function show(b) {
      if (off) { off(); off = null; }
      if (stopW) { stopW(); stopW = null; }
      out.replaceChildren();
      if (!b) { out.append(h('div.empty', h('h3', 'Pick a build'), h('p', 'Choose one of your saved builds above. Build something on the Build page first if the list is empty.'), h('a.btn', { href: '#/build' }, 'Open the builder'))); return; }
      store.set('tools.stats.last', b.id);
      if (!b.items.length) { out.append(note('warn', h('p', 'This build has no items yet. Add some on the Build page, then come back.'))); return; }
      const A = analyse(data, b);
      const bb = A.bounds;
      const fmtB = (n) => `${r2(n)} crates · ${Math.round(n / CELL * 10) / 10} cells`;
      const parts = partsList(data, b);
      const steps = generateGuide(data, b);
      const text = guideAsText(data, b, steps);

      const canvas = h('canvas.tl-canvas', { role: 'img', 'aria-label': 'The build with the centre of mass marked' });
      const wrap = h('div.tl-previewbox', canvas);
      const paint = () => {
        const w = Math.max(280, wrap.clientWidth || 600), hh = w < 500 ? 240 : 320;
        const c = setupCanvas(canvas, w, hh);
        const cam = makeCam(w, hh);
        fitCam(cam, bb, 0.7);
        drawScene(c, cam, b, { data, grid: CELL * 8, labels: true });
        if (A.com) {
          const [sx, sy] = toScreen(cam, A.com.x, A.com.y);
          c.strokeStyle = '#1d2123'; c.lineWidth = 5; c.beginPath(); c.arc(sx, sy, 9, 0, 7); c.moveTo(sx - 15, sy); c.lineTo(sx + 15, sy); c.moveTo(sx, sy - 15); c.lineTo(sx, sy + 15); c.stroke();
          c.strokeStyle = '#f4c430'; c.lineWidth = 2.5; c.beginPath(); c.arc(sx, sy, 9, 0, 7); c.moveTo(sx - 15, sy); c.lineTo(sx + 15, sy); c.moveTo(sx, sy - 15); c.lineTo(sx, sy + 15); c.stroke();
        }
      };
      off = onSpritesLoaded(paint);

      const stat = (k, v, sub) => h('div.tl-stat', h('span.muted', k), h('b', v), sub ? h('small.muted', sub) : null);
      const comRel = A.com ? { x: A.com.x - bb.x0, y: A.com.y } : null;
      const maxCat = Math.max(...A.cats.map((c) => c[1]));
      const who = (it) => A.names.get(it.id) || it.id;
      out.append(
        h('div.tl-stats',
          stat('Items', String(b.items.length), `${(b.links || []).length} links`),
          stat('Width', `${r2(bb.w)} crates`, `${Math.round(bb.w / CELL * 10) / 10} cells · ${Math.round(bb.w * PX_W)} px`),
          stat('Height', `${r2(bb.h)} crates`, `${Math.round(bb.h / CELL * 10) / 10} cells · ${Math.round(bb.h * PX_H)} px`),
          stat('Total item area', `${r2(A.area)} crate²`, 'sum of item boxes')),
        h('section.panel', h('header', 'Picture and centre of mass'), h('div.body.stack', wrap,
          A.com ? h('p', h('b', 'Centre of mass by area, not weight: '), `${r2(comRel.x)} crates from the left edge (${Math.round(comRel.x / CELL * 10) / 10} cells), ${r2(comRel.y)} crates above the floor. Marked with the yellow cross. The game gives items different weights, which this tool does not know, so treat it as a rough guide.`) : null,
          h('p.muted', `Bounding box: ${fmtB(bb.w)} wide, ${fmtB(bb.h)} tall, from x ${r2(bb.x0)} to ${r2(bb.x1)} and y ${r2(bb.y0)} to ${r2(bb.y1)}.`))),
        h('div.tl-cols',
          h('section.panel', h('header', 'Parts list'), h('div.body', h('div.table-wrap', h('table.data',
            h('thead', h('tr', h('th', 'Item'), h('th.num', 'Count'))),
            h('tbody', parts.map((p) => h('tr', h('td', p.name), h('td.num', p.n)))))),
          h('div.row.tl-gap', copyBtn(parts.map((p) => `${p.n} x ${p.name}`).join('\n'), 'Copy parts list')))),
          h('section.panel', h('header', 'By category'), h('div.body.stack', A.cats.map(([k, n]) =>
            h('div.tl-barrow', h('span', k), h('div.tl-bar', h('i', { style: { width: (n / maxCat) * 100 + '%' } })), h('b', String(n))))))),
        h('section.panel', h('header', `Floating items (${A.floating.length})`), h('div.body.stack',
          A.floating.length ? [h('p', 'These are not on the floor and nothing sits directly under them. In the game they fall unless you freeze them or hold them with a link.'),
            h('ul', A.floating.map((f) => h('li', h('b', who(f.it)), ` is ${r2(f.gap)} crates above the floor `, f.linked ? h('span.badge.ok', 'has a link') : h('span.badge.warn', 'no link'))))] :
            h('p', 'Nothing floats. Every item is on the floor or resting on another item.'),
          h('p.muted', 'Rotated items are checked by their outer box, so a tilted item may be reported in error.'))),
        h('section.panel', h('header', `Overlapping pairs (${A.overlaps.length})`), h('div.body.stack',
          A.overlaps.length ? [h('p', 'These item boxes cross each other by more than a quarter of a grid cell. Check the plan: move one of them, or ignore this if the overlap is on purpose. Boxes are the outer size, so a tilted or oddly shaped item can look like it overlaps when it does not.'),
            h('ul', A.overlaps.map((o) => h('li', h('b', who(o.a)), ' and ', h('b', who(o.b)), ` overlap by ${r2(o.ox)} × ${r2(o.oy)} crates`)))] :
            h('p', 'No item boxes overlap.'))),
        h('section.panel', h('header', 'Guide as text'), h('div.body.stack',
          (() => { const t = h('textarea', { rows: 12, readonly: true, 'aria-label': 'Guide text' }); t.value = text; return t; })(),
          h('div.row', copyBtn(text, 'Copy guide'), h('button.btn.sm', { type: 'button', onclick: () => saveFile(`${(b.name || 'guide').replace(/\W+/g, '-')}-guide.txt`, text) }, 'Download guide')))));
      stopW = watchWidth(wrap, paint);
      paint();
    }
    root.append(h('div.stack', h('section.panel', h('header', 'Build'), h('div.body', sel)), out));
    const want = first && [...sel.options].some((o) => o.value === first) ? first : null;
    if (want) { sel.value = want; sel.dispatchEvent(new Event('change')); } else show(null);
    return () => { if (off) off(); if (stopW) stopW(); };
  },
};
void r3;
