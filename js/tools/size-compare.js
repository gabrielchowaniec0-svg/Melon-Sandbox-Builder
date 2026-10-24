// Size compare: up to 8 catalog items side by side at true relative scale.
import { h, store } from '../util.js';
import { getSprite, onSpritesLoaded, THEME } from '../render.js';
import { field, seg, note, itemPicker, thumb, setupCanvas, watchWidth, saveCanvasPng, r2 } from './kit.js';

const MAX = 8;

export default {
  id: 'size-compare',
  title: 'Size compare',
  blurb: 'Line up to 8 items at true relative scale next to a Crate, with a ruler in crates and grid cells.',
  mount(root, ctx) {
    const { data } = ctx;
    const saved = store.get('tools.size', {}) || {};
    const st = {
      sel: (saved.sel || ['crate', 'pumpkin', 'sword']).filter((id) => data.byId.has(id)).slice(0, MAX),
      base: saved.base !== false,
      crate: saved.crate !== false,
      sort: saved.sort || 'picked',
    };
    const persist = () => store.set('tools.size', st);

    const canvas = h('canvas.tl-canvas', { role: 'img', 'aria-label': 'Selected items drawn side by side at the same scale' });
    const scroller = h('div.tl-scroll', canvas);
    const chips = h('div.tl-chips');
    const status = h('p.muted');

    const picker = itemPicker(data, {
      onPick: (it) => {
        if (st.sel.includes(it.id)) return;
        if (st.sel.length >= MAX) { status.textContent = `You can compare ${MAX} items at once. Remove one first.`; return; }
        st.sel.push(it.id); change();
      },
      mark: (it) => (st.sel.includes(it.id) ? 'Added' : null),
    });

    function ordered() {
      const items = st.sel.map((id) => data.byId.get(id)).filter(Boolean);
      const f = { tall: (a, b) => b.c[1] - a.c[1], wide: (a, b) => b.c[0] - a.c[0], small: (a, b) => a.c[0] * a.c[1] - b.c[0] * b.c[1] }[st.sort];
      return f ? [...items].sort(f) : items;
    }

    function change() {
      persist();
      chips.replaceChildren(...st.sel.map((id) => {
        const it = data.byId.get(id);
        return h('span.chip', thumb(it, 22), it.name,
          h('button.tl-x', { type: 'button', 'aria-label': `Remove ${it.name}`, onclick: () => { st.sel = st.sel.filter((s) => s !== id); change(); } }, 'Remove'));
      }));
      if (!st.sel.length) chips.append(h('span.muted', 'Nothing selected. Pick items from the list.'));
      status.textContent = `${st.sel.length} of ${MAX} items selected.`;
      picker.refresh();
      draw();
    }

    function draw() {
      const list = ordered();
      const crate = data.byId.get('crate');
      const all = (st.crate && !st.sel.includes('crate') ? [{ ...crate, ref: true }] : []).concat(list);
      const avail = Math.max(300, scroller.clientWidth || 600);
      const padL = 56, padR = 16, padT = 22, labelW = 104, gap = 12, labelH = 74;
      const zoneH = avail < 520 ? 250 : 320;
      if (!all.length) {
        const ctx2 = setupCanvas(canvas, avail, 160);
        ctx2.fillStyle = THEME.wall; ctx2.fillRect(0, 0, avail, 160);
        ctx2.fillStyle = THEME.text; ctx2.font = '600 14px "Atkinson Hyperlegible", system-ui, sans-serif';
        ctx2.fillText('Pick items to compare.', 20, 84);
        return;
      }
      const maxH = Math.max(...all.map((i) => i.c[1]));
      let s = Math.min(200, (zoneH - 6) / maxH);
      const slots = (sc) => all.reduce((a, i) => a + Math.max(i.c[0] * sc, labelW), 0) + gap * (all.length - 1);
      while (s > 18 && padL + padR + slots(s) > avail) s -= 1;
      const W = Math.max(avail, Math.ceil(padL + padR + slots(s)));
      const H = padT + zoneH + labelH;
      const c = setupCanvas(canvas, W, H);
      c.imageSmoothingEnabled = false;
      c.fillStyle = THEME.wall; c.fillRect(0, 0, W, H);
      // wall plate lines every 0.7 crate
      c.strokeStyle = THEME.wallLine; c.lineWidth = 1; c.beginPath();
      const plate = 0.7 * s;
      if (plate > 14) {
        for (let x = padL; x < W; x += plate) { c.moveTo(Math.round(x) + .5, 0); c.lineTo(Math.round(x) + .5, padT + zoneH); }
        for (let y = padT + zoneH; y > 0; y -= plate) { c.moveTo(0, Math.round(y) + .5); c.lineTo(W, Math.round(y) + .5); }
      }
      c.stroke();
      const floorY = padT + zoneH;
      const midY = padT + zoneH / 2;
      // floor
      c.fillStyle = THEME.floor; c.fillRect(0, floorY, W, H - floorY);
      c.fillStyle = THEME.floorTop; c.fillRect(0, floorY, W, 3);

      // vertical ruler (crates, with grid cell ticks)
      const originY = st.base ? floorY : midY;
      c.save();
      c.fillStyle = 'rgba(29,33,35,.78)'; c.fillRect(0, 0, padL - 6, floorY);
      c.strokeStyle = '#e1e5df'; c.fillStyle = '#e1e5df'; c.lineWidth = 1;
      c.font = '600 11px "Atkinson Hyperlegible", system-ui, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'right';
      const tick = (v, len) => {
        const y = Math.round(originY - v * s) + .5;
        if (y < padT - 2 || y > floorY + 1) return;
        c.beginPath(); c.moveTo(padL - 8, y); c.lineTo(padL - 8 - len, y); c.stroke();
      };
      const span = st.base ? [0, Math.ceil(zoneH / s)] : [-Math.ceil(zoneH / s / 2), Math.ceil(zoneH / s / 2)];
      for (let k = span[0]; k <= span[1]; k++) {
        tick(k, 14);
        const y = originY - k * s;
        if (y > padT + 4 && y < floorY - 2 && (k !== 0 || !st.base)) c.fillText(k === 0 ? 'centre' : `${Math.abs(k)}`, padL - 26, y);
        if (s * 0.125 >= 5) for (let q = 1; q < 8; q++) tick(k + q / 8, q === 4 ? 9 : 5);
      }
      c.textAlign = 'left'; c.fillStyle = '#bfc5c0';
      c.fillText('crates', 4, 10);
      c.restore();
      if (!st.base) {
        c.strokeStyle = 'rgba(255,255,255,.28)'; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(padL, midY + .5); c.lineTo(W, midY + .5); c.stroke(); c.setLineDash([]);
      }

      // items
      let x = padL;
      all.forEach((it) => {
        const w = it.c[0] * s, hh = it.c[1] * s;
        const slot = Math.max(w, labelW);
        const ix = x + (slot - w) / 2;
        const iy = st.base ? floorY - hh : midY - hh / 2;
        const img = getSprite(it.sprite);
        if (img) c.drawImage(img, ix, iy, w, hh);
        else { c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(ix, iy, w, hh); }
        c.strokeStyle = it.ref || it.id === 'crate' ? THEME.select : 'rgba(255,255,255,.35)';
        c.lineWidth = it.ref || it.id === 'crate' ? 2 : 1;
        c.strokeRect(Math.round(ix) - .5, Math.round(iy) - .5, Math.round(w) + 1, Math.round(hh) + 1);
        // width bracket with grid cell ticks
        const by = floorY + 9;
        c.strokeStyle = '#e1e5df'; c.lineWidth = 1; c.beginPath();
        c.moveTo(ix, by); c.lineTo(ix + w, by);
        const cells = it.c[0] * 8;
        c.moveTo(ix, by - 4); c.lineTo(ix, by + 4); c.moveTo(ix + w, by - 4); c.lineTo(ix + w, by + 4);
        if (w / cells >= 4) for (let q = 1; q < Math.floor(cells); q++) { const tx = ix + (q / 8) * s; c.moveTo(tx, by - 2); c.lineTo(tx, by + 2); }
        c.stroke();
        // labels
        const cx = x + slot / 2;
        c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.fillStyle = THEME.text; c.font = '700 12px "Atkinson Hyperlegible", system-ui, sans-serif';
        c.fillText(clip(c, (it.ref ? 'Reference ' : '') + it.name, slot + gap - 4), cx, floorY + 34);
        c.font = '400 11px "Atkinson Hyperlegible", system-ui, sans-serif'; c.fillStyle = '#d5d9d4';
        c.fillText(`${r2(it.c[0])} × ${r2(it.c[1])} crates`, cx, floorY + 49);
        c.fillText(`${Math.round(it.c[0] * 80) / 10} × ${Math.round(it.c[1] * 80) / 10} cells`, cx, floorY + 63);
        x += slot + gap;
      });
      canvas.setAttribute('aria-label', 'Items at the same scale: ' + all.map((i) => `${i.name} ${i.c[0]} by ${i.c[1]} crates`).join('; '));
    }
    const clip = (c, text, max) => {
      if (c.measureText(text).width <= max) return text;
      while (text.length > 3 && c.measureText(text + '…').width > max) text = text.slice(0, -1);
      return text + '…';
    };

    const controls = h('div.row',
      seg([['1', 'Same baseline'], ['0', 'Centre aligned']], st.base ? '1' : '0', (v) => { st.base = v === '1'; persist(); draw(); }, 'Alignment'),
      h('label.row.tl-check', h('input', { type: 'checkbox', checked: st.crate, onchange: (e) => { st.crate = e.target.checked; persist(); draw(); } }), 'Show a Crate for reference'),
      field('Order', Object.assign(h('select', { onchange: (e) => { st.sort = e.target.value; persist(); draw(); } },
        [['picked', 'As picked'], ['tall', 'Tallest first'], ['wide', 'Widest first'], ['small', 'Smallest first']].map(([v, t]) => h('option', { value: v, selected: v === st.sort }, t))))),
      h('button.btn.primary', { type: 'button', onclick: () => saveCanvasPng(canvas, 'size-compare.png') }, 'Save as PNG'),
      h('button.btn.ghost', { type: 'button', onclick: () => { st.sel = []; change(); } }, 'Clear'));

    root.append(
      h('div.tl-split',
        h('section.panel', h('header', 'Pick items'), h('div.body', picker.el)),
        h('section.tl-main',
          h('div.panel', h('header', 'Selected'), h('div.body.stack', chips, status, controls)),
          h('div.panel', h('header', 'Comparison'), h('div.body.tl-nopad', scroller)),
          note('', h('p', 'Sizes come from our screenshots and are accurate to about 2 px. Tiny items can be off by several percent. This is a planning picture, not an official size chart.')))));
    const stop = watchWidth(scroller, () => draw());
    const off = onSpritesLoaded(() => draw());
    change();
    return () => { stop(); off(); };
  },
};
