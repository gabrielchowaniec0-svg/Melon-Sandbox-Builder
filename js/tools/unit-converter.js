// Unit converter: crates, grid cells and screenshot pixels, batch mode, and "what fits".
import { h, store } from '../util.js';
import { CELL } from '../data.js';
import { field, seg, note, copyBtn, thumb, toCsv, PX_W, PX_H } from './kit.js';

const UNITS = [
  ['crates', 'Crates', 1],
  ['cells', 'Grid cells (1/8 crate)', CELL],
  ['pxw', `Pixels, width (${PX_W} per crate)`, 1 / PX_W],
  ['pxh', `Pixels, height (${PX_H} per crate)`, 1 / PX_H],
];
const toCrates = (unit, v) => v * UNITS.find((u) => u[0] === unit)[2];
const fromCrates = (unit, c) => c / UNITS.find((u) => u[0] === unit)[2];

export default {
  id: 'unit-converter',
  title: 'Unit converter',
  blurb: 'Convert crates, grid cells and screenshot pixels, in bulk, and find which items fit in a space.',
  mount(root, ctx) {
    const { data } = ctx;
    const saved = store.get('tools.units', {}) || {};
    const st = { from: saved.from || 'crates', digits: saved.digits ?? 3 };
    const persist = () => store.set('tools.units', st);
    const fmtN = (n) => (Number.isFinite(n) ? String(Number(n.toFixed(st.digits))) : 'n/a');

    // ---- single + batch
    const fromSel = h('select', { 'aria-label': 'Convert from', onchange: (e) => { st.from = e.target.value; persist(); run(); } },
      UNITS.map(([v, t]) => h('option', { value: v, selected: v === st.from }, t)));
    const digitsSel = h('select', { 'aria-label': 'Decimal places', onchange: (e) => { st.digits = +e.target.value; persist(); run(); } },
      [0, 1, 2, 3, 4].map((d) => h('option', { value: d, selected: d === st.digits }, `${d} decimals`)));
    const input = h('textarea', { rows: 5, placeholder: 'Type one number, or paste many.\nSeparate them with new lines, spaces or commas.\nExample: 0.5 1.25 2', 'aria-label': 'Numbers to convert' });
    input.value = '1';
    const out = h('div');
    const problems = h('p.tl-error', { role: 'status' });
    let rows = [];

    function run() {
      const toks = input.value.split(/[\s,;]+/).filter(Boolean);
      const bad = [];
      rows = [];
      for (const t of toks) {
        const v = Number(t.replace(',', '.'));
        if (!Number.isFinite(v)) { bad.push(t); continue; }
        const c = toCrates(st.from, v);
        rows.push({ v, crates: c, cells: c / CELL, pxw: c * PX_W, pxh: c * PX_H });
      }
      problems.textContent = bad.length ? `Skipped ${bad.length} value${bad.length > 1 ? 's that are' : ' that is'} not a number: ${bad.slice(0, 6).join(', ')}${bad.length > 6 ? '…' : ''}. Use digits and a decimal point only.` : '';
      if (!rows.length) { out.replaceChildren(h('p.muted', 'Enter a number above to see the conversion.')); return; }
      if (rows.length === 1) {
        const r = rows[0];
        out.replaceChildren(h('div.tl-results', [
          ['Crates', r.crates], ['Grid cells', r.cells], [`Pixels wide (${PX_W}/crate)`, r.pxw], [`Pixels tall (${PX_H}/crate)`, r.pxh],
        ].map(([l, n]) => h('div.tl-result', h('span.muted', l), h('b', fmtN(n)), copyBtn(fmtN(n), 'Copy')))));
        return;
      }
      out.replaceChildren(h('div.table-wrap', h('table.data',
        h('thead', h('tr', ['Input', 'Crates', 'Grid cells', 'Px wide', 'Px tall'].map((t, i) => h('th' + (i ? '.num' : ''), t)))),
        h('tbody', rows.map((r) => h('tr', h('td', fmtN(r.v)), h('td.num', fmtN(r.crates)), h('td.num', fmtN(r.cells)), h('td.num', fmtN(r.pxw)), h('td.num', fmtN(r.pxh))))))));
    }
    input.addEventListener('input', run);
    const tableText = (sep) => {
      const head = ['Input', 'Crates', 'Grid cells', 'Px wide', 'Px tall'];
      const body = rows.map((r) => [r.v, r.crates, r.cells, r.pxw, r.pxh].map(fmtN));
      return sep === ',' ? toCsv([head, ...body]) : [head, ...body].map((r) => r.join('\t')).join('\n');
    };

    // ---- what fits
    const fit = { w: saved.fw ?? 2, h: saved.fh ?? 1, unit: saved.fu || 'crates', rot: saved.rot !== false, cat: '' };
    const fitOut = h('div');
    const wIn = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: fit.w, 'aria-label': 'Width' });
    const hIn = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: fit.h, 'aria-label': 'Height' });
    const catSel = h('select', { 'aria-label': 'Category' }, h('option', { value: '' }, 'All categories'), data.cats.map((c) => h('option', { value: c }, c)));
    const unitSel = seg([['crates', 'Crates'], ['cells', 'Grid cells']], fit.unit, (v) => { fit.unit = v; runFit(); }, 'Space unit');
    const rotChk = h('input', { type: 'checkbox', checked: fit.rot });
    function runFit() {
      store.set('tools.units', { ...st, fw: +wIn.value, fh: +hIn.value, fu: fit.unit, rot: rotChk.checked });
      const k = fit.unit === 'cells' ? CELL : 1;
      const W = +wIn.value * k, H = +hIn.value * k;
      if (!(W > 0) || !(H > 0)) { fitOut.replaceChildren(note('warn', h('p', 'Enter a width and a height greater than zero.'))); return; }
      const eps = 1e-6;
      const res = [];
      for (const it of data.items) {
        if (catSel.value && it.cat !== catSel.value) continue;
        const [w, hh] = it.c;
        const upright = w <= W + eps && hh <= H + eps;
        const turned = rotChk.checked && hh <= W + eps && w <= H + eps;
        if (!upright && !turned) continue;
        const nUp = upright ? Math.floor((W + eps) / w) * Math.floor((H + eps) / hh) : 0;
        const nTurn = turned ? Math.floor((W + eps) / hh) * Math.floor((H + eps) / w) : 0;
        res.push({ it, n: Math.max(nUp, nTurn), onlyTurned: !upright });
      }
      res.sort((a, b) => b.it.c[0] * b.it.c[1] - a.it.c[0] * a.it.c[1]);
      const label = `${fmtN(W)} × ${fmtN(H)} crates (${fmtN(W / CELL)} × ${fmtN(H / CELL)} cells)`;
      fitOut.replaceChildren(
        h('p', h('b', `${res.length} of ${data.items.length} items fit`), ` inside ${label}.`),
        res.length ? h('div.table-wrap', h('table.data',
          h('thead', h('tr', h('th', 'Item'), h('th', 'Category'), h('th.num', 'Size (crates)'), h('th.num', 'Copies in a grid'))),
          h('tbody', res.map(({ it, n, onlyTurned }) => h('tr',
            h('td', h('span.row', thumb(it, 32), h('a', { href: `#/wiki/item/${it.id}` }, it.name), onlyTurned ? h('span.badge', 'turned 90°') : null)),
            h('td', it.cat), h('td.num', `${it.c[0]} × ${it.c[1]}`), h('td.num', n)))))) :
          h('div.empty', h('h3', 'Nothing fits'), h('p', 'Every catalog item is bigger than this space. Make the space larger or allow turning items 90°.')),
        h('p.muted', 'Copies in a grid counts rows and columns of identical items with no gaps. Real packing with mixed sizes can differ. Sizes are measured to about 2 px.'));
    }
    [wIn, hIn].forEach((el) => el.addEventListener('input', runFit));
    catSel.addEventListener('change', runFit);
    rotChk.addEventListener('change', runFit);

    root.append(h('div.stack',
      h('section.panel', h('header', 'Convert'), h('div.body.stack',
        h('div.tl-grid2', field('Convert from', fromSel), field('Rounding', digitsSel)),
        field('Numbers', input, 'One number gives a result card. Several numbers give a table.'),
        problems, out,
        h('div.row', copyBtn(() => (rows.length > 1 ? tableText(',') : ''), 'Copy table as CSV'), copyBtn(() => (rows.length > 1 ? tableText('\t') : ''), 'Copy for a spreadsheet'),
          h('span.muted', 'Table copy needs two or more numbers.')),
        note('', h('p', `1 crate is 1.0 on this site. 1 grid cell is 1/8 crate. Our screenshots show a Crate at ${PX_W} by ${PX_H} pixels, so pixels differ slightly between width and height.`)))),
      h('section.panel', h('header', 'What fits'), h('div.body.stack',
        h('div.tl-grid3', field('Width', wIn), field('Height', hIn), field('Unit', unitSel)),
        h('div.tl-grid2', field('Category', catSel), h('label.row.tl-check', rotChk, 'Allow turning items 90°')),
        fitOut))));
    run();
    runFit();
  },
};
