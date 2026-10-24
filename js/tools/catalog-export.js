// Catalog export: browse and download the item catalog as JSON, CSV or a Markdown table, with a schema guide.
import { h, store } from '../util.js';
import { field, seg, copyBtn, saveFile, toCsv, note } from './kit.js';

const FIELDS = [
  ['id', 'text', 'Stable lowercase id made from the name, for example blue-sword. Use it as the item type (t) in build files.'],
  ['name', 'text', 'Display name as read in the game. If the flags include name-unsure, the name was hard to read in the recording.'],
  ['cat', 'text', 'Category, matching the sections of the item panel in the game.'],
  ['px', '[width, height]', 'Size in pixels in our fixed-camera screenshots, where a Crate is 263 by 261 pixels. Not a game unit.'],
  ['c', '[width, height]', 'Size in crates. 1 crate is the Crate item. 1 grid cell is 1/8 crate. This is px divided by 263 and 261, rounded to 3 decimals.'],
  ['sprite', 'text', 'Path to the cropped item image on this site.'],
  ['flags', 'list of text', 'edge-unsure: the edges were hard to find (glow, shadow or a see-through part), so the box may be a little off. name-unsure: the item was identified from the panel order and its look, not a name on the field, so it may be the wrong item. large: the item is big and may have been partly cut off in the view (inferred), so the true size could be bigger.'],
  ['act', 'true or false', 'True when the item shows a power button, so it can be activated.'],
  ['params', 'list', 'Parameters seen in the item edit window: key, label (as shown in the game), type (number, bool or color) and the default value seen. Marked uncertain if not confirmed.'],
  ['note', 'text', 'Free-text remark from the measuring session. May be empty.'],
];

export default {
  id: 'catalog-export',
  title: 'Catalog export',
  blurb: 'Browse the item catalog and download it as JSON, CSV or a Markdown table, with a guide to every field.',
  mount(root, ctx) {
    const { data } = ctx;
    const saved = store.get('tools.catalog', {}) || {};
    const st = { fmt: saved.fmt || 'json', cat: '', detail: saved.detail || 'compact', flagged: false };
    const pre = h('pre.tl-pre', { tabindex: 0, 'aria-label': 'Export preview' });
    const info = h('p.muted');

    const rows = () => data.items.filter((i) => (!st.cat || i.cat === st.cat) && (!st.flagged || i.flags.length));
    const compact = (i) => ({ id: i.id, name: i.name, cat: i.cat, px: i.px, c: i.c });
    const build = () => {
      const list = rows();
      const full = st.detail === 'full';
      if (st.fmt === 'json') return JSON.stringify({ version: data.catalog.version, crate: data.catalog.crate, count: list.length, items: list.map((i) => (full ? i : compact(i))) }, null, 2);
      if (st.fmt === 'csv') {
        const head = full ? ['id', 'name', 'cat', 'px_w', 'px_h', 'crates_w', 'crates_h', 'cells_w', 'cells_h', 'flags', 'act', 'sprite', 'note'] : ['id', 'name', 'cat', 'px_w', 'px_h', 'crates_w', 'crates_h'];
        return toCsv([head, ...list.map((i) => {
          const b = [i.id, i.name, i.cat, i.px[0], i.px[1], i.c[0], i.c[1]];
          return full ? [...b, Math.round(i.c[0] * 80) / 10, Math.round(i.c[1] * 80) / 10, i.flags.join(' '), i.act, i.sprite, i.note] : b;
        })]);
      }
      const head = full ? ['Name', 'Category', 'Crates (w × h)', 'Cells (w × h)', 'Pixels (w × h)', 'Flags'] : ['Name', 'Category', 'Crates (w × h)', 'Pixels (w × h)'];
      const esc = (s) => String(s).replace(/\|/g, '\\|');
      const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`];
      for (const i of list) {
        const cells = [esc(i.name), esc(i.cat), `${i.c[0]} × ${i.c[1]}`];
        if (full) cells.push(`${Math.round(i.c[0] * 80) / 10} × ${Math.round(i.c[1] * 80) / 10}`);
        cells.push(`${i.px[0]} × ${i.px[1]}`);
        if (full) cells.push(i.flags.join(', ') || '');
        lines.push(`| ${cells.join(' | ')} |`);
      }
      return lines.join('\n');
    };
    let text = '';
    const refresh = () => {
      store.set('tools.catalog', { fmt: st.fmt, detail: st.detail });
      text = build();
      const n = rows().length;
      pre.textContent = text.length > 60000 ? text.slice(0, 60000) + '\n… (preview cut off; the download has everything)' : text;
      info.textContent = `${n} item${n === 1 ? '' : 's'} · ${text.length.toLocaleString()} characters`;
    };
    const ext = { json: ['json', 'application/json'], csv: ['csv', 'text/csv'], md: ['md', 'text/markdown'] };
    const catSel = h('select', { 'aria-label': 'Category', onchange: (e) => { st.cat = e.target.value; refresh(); } },
      h('option', { value: '' }, 'All categories'), data.cats.map((c) => h('option', { value: c }, `${c} (${data.items.filter((i) => i.cat === c).length})`)));

    root.append(h('div.stack',
      h('section.panel', h('header', 'Export'), h('div.body.stack',
        h('div.row', seg([['json', 'JSON'], ['csv', 'CSV'], ['md', 'Markdown table']], st.fmt, (v) => { st.fmt = v; refresh(); }, 'Format'),
          seg([['compact', 'Compact'], ['full', 'All fields']], st.detail, (v) => { st.detail = v; refresh(); }, 'Detail')),
        h('div.tl-grid2', field('Category', catSel), h('label.row.tl-check', h('input', { type: 'checkbox', onchange: (e) => { st.flagged = e.target.checked; refresh(); } }), 'Only items with a flag')),
        info, pre,
        h('div.row', copyBtn(() => text, 'Copy'), h('button.btn.primary', { type: 'button', onclick: () => saveFile(`melon-catalog${st.cat ? '-' + st.cat.toLowerCase().replace(/\W+/g, '-') : ''}.${ext[st.fmt][0]}`, text, ext[st.fmt][1]) }, 'Download')))),
      h('section.panel', h('header', 'Schema'), h('div.body.stack',
        h('p', 'The JSON file is { version, crate, items: [...] }. Each item has these fields.'),
        h('div.table-wrap', h('table.data', h('thead', h('tr', h('th', 'Field'), h('th', 'Type'), h('th', 'Meaning'))),
          h('tbody', FIELDS.map(([k, t, d]) => h('tr', h('td', h('code', k)), h('td', t), h('td', d)))))),
        h('h3', 'How accurate are the sizes?'),
        h('p', 'Every size was measured from screenshots by comparing the item with a Crate. The error is about 2 pixels on each edge. For big items that is under 1 percent. For the smallest items it can be up to about 8 percent. These are not official numbers from the game developer.'),
        note('', h('p', 'Compact exports keep id, name, cat, px and c. Choose All fields to include flags, power button, sprite path, parameters and notes (parameters only in JSON).')))),
      h('section.panel', h('header', 'Crate reference'), h('div.body', h('p', `The reference unit is the Crate: ${data.catalog.crate.w} × ${data.catalog.crate.h} pixels in our screenshots, which equals 1 crate or 8 grid cells.`)))));
    refresh();
  },
};
