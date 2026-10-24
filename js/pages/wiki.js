// Wiki: item index, item pages, missing-items checklist and reference guides.
// Routes: #/wiki, #/wiki/item/<id>, #/wiki/missing, #/wiki/guide, #/wiki/guide/<slug>
import { h, store, ensureCss, fmt, debounce } from '../util.js';
import { CELL } from '../data.js';
import { ARTICLES, GROUPS, GLOSSARY } from '../wiki-articles.js';

export const title = 'Wiki';

const FLAG_INFO = {
  'edge-unsure': 'The edges were hard to find (glow, shadow or a see-through part), so the box may be a little off.',
  'name-unsure': 'The item was identified from the panel order and its look, not from a name on the field. It may be the wrong item.',
  large: 'A big item. It may not have fitted in the view, so the true size could be larger (inferred).',
};
const BADGE_TEXT = 'Needs a better measurement';
const KIND_LABEL = { seen: 'Seen', inferred: 'Inferred', unknown: 'Not shown' };
const PAGE = 60; // rows added per chunk in the item index

const px = (n) => Math.round(n * 100) / 100 + 'px';
const cellsOf = (c) => [c[0] / CELL, c[1] / CELL];
const area = (it) => it.c[0] * it.c[1];
const sizeText = (it) => `${fmt(it.c[0], 2)} × ${fmt(it.c[1], 2)}`;

/** Inline markup: **bold**, `code`, [label](href). Returns an array of nodes. */
function inline(str) {
  const out = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    if (m[1] != null) out.push(h('strong', m[1]));
    else if (m[2] != null) out.push(h('code', m[2]));
    else out.push(h('a', { href: m[4] }, m[3]));
    last = re.lastIndex;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

const sprite = (it, cls = '') => h('img.sprite' + (cls ? '.' + cls : ''), {
  src: it.sprite, alt: '', loading: 'lazy', decoding: 'async', width: it.px[0], height: it.px[1],
});

function flagBadges(it, long = false) {
  if (!it.flags || !it.flags.length) return null;
  const tip = it.flags.map((f) => FLAG_INFO[f] || f).join(' ');
  return h('span.badge.warn.wk-flag', { title: tip, tabindex: '0', 'aria-label': `${BADGE_TEXT}. ${tip}` }, long ? BADGE_TEXT : BADGE_TEXT);
}

// ---------------------------------------------------------------- shell
const SECTIONS = [
  { id: 'items', label: 'Items', href: '#/wiki' },
  { id: 'guides', label: 'Guides', href: '#/wiki/guide' },
  { id: 'missing', label: 'Missing items', href: '#/wiki/missing' },
];

function shell(section, crumbs, ctx, activeSlug) {
  const side = h('nav.wk-side', { 'aria-label': 'Wiki sections' },
    h('p.wk-side-title', 'Wiki'),
    h('a.wk-side-link', { href: '#/wiki', 'aria-current': section === 'items' ? 'page' : null }, 'Items', h('span.muted', String(ctx.data.items.length))),
    h('a.wk-side-link', { href: '#/wiki/guide', 'aria-current': section === 'guides' && !activeSlug ? 'page' : null }, 'Guides'),
    h('ul.wk-side-sub', ARTICLES.map((a) => h('li', h('a', { href: '#/wiki/guide/' + a.slug, 'aria-current': activeSlug === a.slug ? 'page' : null }, a.title)))),
    h('a.wk-side-link', { href: '#/wiki/missing', 'aria-current': section === 'missing' ? 'page' : null }, 'Missing items'));
  const tabs = h('nav.tabs.wk-tabs', { 'aria-label': 'Wiki sections' },
    SECTIONS.map((s) => h('a', { href: s.href, 'aria-current': s.id === section ? 'page' : null }, s.label)));
  const main = h('div.wk-main');
  const bc = h('nav.wk-crumbs', { 'aria-label': 'Breadcrumb' },
    h('ol', crumbs.map((c, i) => h('li', c.href && i < crumbs.length - 1 ? h('a', { href: c.href }, c.label) : h('span', { 'aria-current': i === crumbs.length - 1 ? 'page' : null }, c.label)))));
  return { el: h('div.wk', side, h('div.wk-col', tabs, bc, main)), main };
}

// ---------------------------------------------------------------- mount
export async function mount(root, ctx) {
  await ensureCss('css/wiki.css');
  const [sec, arg] = ctx.params;
  const cleanups = [];
  const page = h('div.page.wide.wk-page');
  root.append(page);
  let out;
  if (sec === 'item' && arg) out = itemPage(ctx, arg, cleanups);
  else if (sec === 'missing') out = await missingPage(ctx, cleanups);
  else if (sec === 'guide' && arg) out = articlePage(ctx, arg, cleanups);
  else if (sec === 'guide') out = guideIndex(ctx);
  else out = itemIndex(ctx, cleanups);
  page.append(out.el);
  if (out.after) out.after();
  return () => cleanups.forEach((f) => { try { f(); } catch { /* ignore */ } });
}

// ================================================================ A. item index
const DEFAULT_STATE = { q: '', cat: '', sort: 'name', dir: 1, view: 'grid', same: false, scale: 0 };

function loadState() {
  const s = Object.assign({}, DEFAULT_STATE, store.get('wiki.idx', {}) || {});
  if (!s.scale) s.scale = innerWidth < 640 ? 40 : 56;
  return s;
}

function itemIndex(ctx, cleanups) {
  const { data } = ctx;
  const S = loadState();
  const save = () => store.set('wiki.idx', S);
  const { el, main } = shell('items', [{ label: 'Wiki', href: '#/wiki' }, { label: 'Items' }], ctx);
  const maxH = Math.max(...data.items.map((i) => i.c[1]));

  const intro = h('header.wk-intro',
    h('h1', 'Item wiki'),
    h('p.lead', `${data.items.length} items measured against one reference: the Crate. One crate is the game's wooden box, 263 by 261 pixels in our screenshots. Every size here is in crates. One grid cell is one eighth of a crate.`),
    h('p', 'Sizes come from screenshots taken at a fixed camera and are accurate to about 2 pixels. They are our measurements, not official numbers. ',
      h('a', { href: '#/wiki/guide/measuring-method' }, 'How sizes were measured'), '. Some items have not been measured yet: ',
      h('a', { href: '#/wiki/missing' }, 'see the Missing items page'), '.'),
    h('details.wk-legend',
      h('summary', `What does "${BADGE_TEXT}" mean?`),
      h('ul', Object.entries(FLAG_INFO).map(([k, v]) => h('li', h('code', k), ' ', v)))));

  // controls
  const q = h('input', { type: 'search', id: 'wk-q', placeholder: 'Search by name or category', value: S.q, autocomplete: 'off', 'aria-label': 'Search items' });
  const sortSel = h('select', { id: 'wk-sort', 'aria-label': 'Sort by' },
    [['name', 'Name'], ['width', 'Width'], ['height', 'Height'], ['area', 'Area'], ['cat', 'Category']].map(([v, l]) => h('option', { value: v, selected: v === S.sort }, l)));
  const dirBtn = h('button.btn.icon', { type: 'button', 'aria-label': 'Reverse sort direction' }, S.dir > 0 ? '↑' : '↓');
  const viewBtns = [['grid', 'Grid'], ['table', 'Table']].map(([v, l]) => h('button.btn', { type: 'button', 'aria-pressed': String(S.view === v), dataset: { v } }, l));
  const sameBtn = h('button.btn', { type: 'button', 'aria-pressed': String(S.same) }, 'Same scale');
  const zoom = h('input', { type: 'range', min: 16, max: 72, step: 2, value: S.scale, 'aria-label': 'Pixels per crate' });
  const zoomVal = h('span.muted.wk-zoomval');
  const crateKey = h('span.wk-cratekey');
  const zoomBox = h('label.wk-zoom', h('span', 'Zoom'), zoom, zoomVal, crateKey);
  const catRow = h('div.wk-cats', { role: 'group', 'aria-label': 'Filter by category' });
  const counts = {};
  data.items.forEach((i) => { counts[i.cat] = (counts[i.cat] || 0) + 1; });
  const catBtn = (val, label) => h('button.chip.wk-chip', { type: 'button', 'aria-pressed': String(S.cat === val), dataset: { cat: val } }, label);
  catRow.append(catBtn('', `All ${data.items.length}`), ...data.cats.map((c) => catBtn(c, `${c} ${counts[c] || 0}`)));

  const status = h('p.wk-status.muted', { 'aria-live': 'polite' });
  const listBox = h('div.wk-list');
  const more = h('button.btn.wk-more', { type: 'button' }, 'Show more');
  const sentinel = h('div.wk-sentinel');

  main.append(intro,
    h('div.wk-controls',
      h('div.wk-row', h('label.field.grow', h('span', 'Search'), q)),
      catRow,
      h('div.wk-row.wk-row-tools',
        h('label.field', h('span', 'Sort'), h('div.row', sortSel, dirBtn)),
        h('div.wk-seg', { role: 'group', 'aria-label': 'View' }, viewBtns),
        sameBtn),
      zoomBox),
    status, listBox, sentinel, more);

  // data → list
  const catIdx = new Map(data.cats.map((c, i) => [c, i]));
  const cmp = {
    name: (a, b) => a.name.localeCompare(b.name),
    width: (a, b) => a.c[0] - b.c[0] || a.name.localeCompare(b.name),
    height: (a, b) => a.c[1] - b.c[1] || a.name.localeCompare(b.name),
    area: (a, b) => area(a) - area(b) || a.name.localeCompare(b.name),
    cat: (a, b) => (catIdx.get(a.cat) - catIdx.get(b.cat)) || a.name.localeCompare(b.name),
  };
  let rows = [];
  let shown = 0;
  let gridEl = null;
  let tbody = null;
  const cols = () => (gridEl ? Math.max(1, Math.floor((gridEl.clientWidth + 12) / (150 + 12))) : 2);

  function compute() {
    const term = S.q.trim().toLowerCase();
    rows = data.items.filter((i) => (!S.cat || i.cat === S.cat) && (!term || i.name.toLowerCase().includes(term) || i.cat.toLowerCase().includes(term) || i.id.includes(term)));
    rows.sort((a, b) => (cmp[S.sort] || cmp.name)(a, b) * S.dir);
  }

  function gridCell(it) {
    const same = S.same;
    const sc = S.scale;
    const stage = h('div.wk-stage' + (same ? '.same' : ''));
    if (same) {
      stage.style.height = Math.ceil(maxH * sc) + 8 + 'px';
      const img = sprite(it);
      img.style.width = Math.max(1, Math.round(it.c[0] * sc)) + 'px';
      img.style.height = Math.max(1, Math.round(it.c[1] * sc)) + 'px';
      stage.append(img);
    } else stage.append(sprite(it));
    const cl = cellsOf(it.c);
    const a = h('a.wk-cell', { href: '#/wiki/item/' + it.id },
      stage,
      h('div.wk-cell-body',
        h('strong.wk-name', it.name),
        h('span.wk-cat.muted', it.cat),
        h('span.wk-size', `${sizeText(it)} crates`),
        h('span.wk-sub.muted', `${fmt(cl[0], 1)} × ${fmt(cl[1], 1)} cells · ${it.px[0]} × ${it.px[1]} px`),
        flagBadges(it)));
    if (same) a.dataset.w = String(it.c[0] * sc);
    return a;
  }

  function tableRow(it) {
    const cl = cellsOf(it.c);
    return h('tr',
      h('td.wk-namecell', h('a', { href: '#/wiki/item/' + it.id }, h('span.wk-thumb', sprite(it)), h('span', h('strong', it.name), flagBadges(it)))),
      h('td', { dataset: { label: 'Category' } }, it.cat),
      h('td.num', { dataset: { label: 'Width (crates)' } }, fmt(it.c[0], 2)),
      h('td.num', { dataset: { label: 'Height (crates)' } }, fmt(it.c[1], 2)),
      h('td.num', { dataset: { label: 'Grid cells' } }, `${fmt(cl[0], 1)} × ${fmt(cl[1], 1)}`),
      h('td.num', { dataset: { label: 'Source pixels' } }, `${it.px[0]} × ${it.px[1]}`));
  }

  function spanCells() {
    if (!S.same || !gridEl) return;
    const n = cols();
    const cellW = Math.max(110, gridEl.clientWidth / n - 12);
    gridEl.querySelectorAll('.wk-cell').forEach((c) => {
      const need = Math.ceil((parseFloat(c.dataset.w) + 24) / (cellW + 12));
      c.style.gridColumn = need > 1 ? `span ${Math.min(need, n)}` : '';
    });
  }

  function appendChunk() {
    const end = Math.min(rows.length, shown + PAGE);
    const frag = document.createDocumentFragment();
    for (let i = shown; i < end; i++) frag.append(S.view === 'table' ? tableRow(rows[i]) : gridCell(rows[i]));
    (S.view === 'table' ? tbody : gridEl).append(frag);
    shown = end;
    more.hidden = shown >= rows.length;
    more.textContent = `Show ${Math.min(PAGE, rows.length - shown)} more (${rows.length - shown} left)`;
    spanCells();
  }

  function renderList() {
    compute();
    shown = 0;
    status.textContent = rows.length === data.items.length ? `${rows.length} items` : `${rows.length} of ${data.items.length} items`;
    listBox.replaceChildren();
    if (!rows.length) {
      listBox.append(h('div.empty', h('h3', 'No items match'), h('p', 'Try a shorter search or pick All.'),
        h('button.btn', { type: 'button', onclick: () => { S.q = ''; S.cat = ''; q.value = ''; syncCats(); save(); renderList(); } }, 'Clear filters')));
      more.hidden = true;
      return;
    }
    if (S.view === 'table') {
      const head = [['name', 'Name'], ['cat', 'Category'], ['width', 'Width'], ['height', 'Height'], [null, 'Grid cells'], [null, 'Source px']];
      const tr = h('tr', head.map(([k, l], i) => h('th', {
        class: i >= 2 ? 'num' : '', scope: 'col',
        'aria-sort': k && k === S.sort ? (S.dir > 0 ? 'ascending' : 'descending') : null,
      }, k ? h('button.wk-th', { type: 'button', onclick: () => { if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = 1; } sortSel.value = S.sort; dirBtn.textContent = S.dir > 0 ? '↑' : '↓'; save(); renderList(); } }, l, k === S.sort ? (S.dir > 0 ? ' ↑' : ' ↓') : '') : l)));
      tbody = h('tbody');
      listBox.append(h('div.table-wrap.wk-table-wrap', h('table.data.wk-table', h('thead', tr), tbody)));
      gridEl = null;
    } else {
      gridEl = h('div.wk-grid' + (S.same ? '.same' : ''));
      listBox.append(gridEl);
      tbody = null;
    }
    appendChunk();
  }

  function syncCats() { catRow.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === S.cat))); }
  function syncView() {
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === S.view)));
    sameBtn.setAttribute('aria-pressed', String(S.same));
    sameBtn.hidden = S.view !== 'grid';
    zoomBox.hidden = !(S.same && S.view === 'grid');
    zoomVal.textContent = `${S.scale} px per crate`;
    crateKey.style.width = crateKey.style.height = S.scale + 'px';
    crateKey.title = 'This square is one crate at the current zoom';
  }

  const run = debounce(() => { renderList(); }, 120);
  q.addEventListener('input', () => { S.q = q.value; save(); run(); });
  sortSel.addEventListener('change', () => { S.sort = sortSel.value; save(); renderList(); });
  dirBtn.addEventListener('click', () => { S.dir = -S.dir; dirBtn.textContent = S.dir > 0 ? '↑' : '↓'; save(); renderList(); });
  catRow.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.cat = b.dataset.cat; syncCats(); save(); renderList(); });
  viewBtns.forEach((b) => b.addEventListener('click', () => { S.view = b.dataset.v; save(); syncView(); renderList(); }));
  sameBtn.addEventListener('click', () => { S.same = !S.same; save(); syncView(); renderList(); });
  zoom.addEventListener('input', () => { S.scale = +zoom.value; save(); syncView(); run(); });
  more.addEventListener('click', appendChunk);

  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && shown < rows.length) appendChunk(); }, { rootMargin: '600px' });
    io.observe(sentinel);
    cleanups.push(() => io.disconnect());
  }
  let lastW = 0;
  const onResize = debounce(() => { if (innerWidth !== lastW) { lastW = innerWidth; spanCells(); } }, 150);
  window.addEventListener('resize', onResize);
  cleanups.push(() => window.removeEventListener('resize', onResize));

  syncView();
  renderList();
  return { el };
}

// ================================================================ B. item page
function itemPage(ctx, id, cleanups) {
  const { data, app } = ctx;
  const it = data.byId.get(id);
  if (!it) {
    const { el, main } = shell('items', [{ label: 'Wiki', href: '#/wiki' }, { label: 'Items', href: '#/wiki' }, { label: 'Not found' }], ctx);
    const guess = data.items.filter((i) => i.id.includes(id.toLowerCase()) || i.name.toLowerCase().includes(id.toLowerCase())).slice(0, 6);
    main.append(h('div.callout.warn', h('h1', 'No item called "' + id + '"'),
      h('p', 'It may not be measured yet, or the link is mistyped.'),
      guess.length ? h('p', 'Did you mean: ', guess.map((g, i) => [i ? ', ' : '', h('a', { href: '#/wiki/item/' + g.id }, g.name)])) : null,
      h('div.row', h('a.btn.primary', { href: '#/wiki' }, 'All items'), h('a.btn', { href: '#/wiki/missing' }, 'Missing items'))));
    return { el };
  }
  const { el, main } = shell('items', [{ label: 'Wiki', href: '#/wiki' }, { label: 'Items', href: '#/wiki' }, { label: it.cat, href: '#/wiki' }, { label: it.name }], ctx);
  const cl = cellsOf(it.c);
  const crate = data.byId.get('crate');
  const pump = data.byId.get('pumpkin');

  // header + actions
  const add = () => { store.set('pending', { t: it.id }); app.nav('build'); };
  const catLink = h('a.chip.wk-catlink', { href: '#/wiki', title: 'Show this category in the index', onclick: () => { const s = loadState(); s.cat = it.cat; s.q = ''; store.set('wiki.idx', s); } }, it.cat);
  main.append(h('header.wk-ihead',
    h('div',
      h('h1', it.name),
      h('div.row.wk-tags', catLink,
        it.act ? h('span.badge.ok', 'Has a power button') : null,
        flagBadges(it))),
    h('div.row.wk-actions',
      h('button.btn.primary', { type: 'button', onclick: add }, 'Add to build'),
      h('a.btn', { href: '#/wiki' }, 'All items'))));

  // scale scene
  const sceneWrap = h('div.wk-scene-wrap');
  const sceneCol = h('section.wk-section', h('h2', 'At true scale'),
    h('p.muted', `Drawn next to a Crate (1 crate) and the Pumpkin ragdoll (about 2 crates tall) so you can judge the size. Squares in the background are one crate.`));
  const zoom = h('input', { type: 'range', min: 16, max: 260, step: 2, 'aria-label': 'Pixels per crate' });
  const zv = h('span.muted');
  const fitItem = h('button.btn.sm', { type: 'button' }, 'Zoom to item');
  const fitAll = h('button.btn.sm', { type: 'button' }, 'Fit all');
  const figs = [it];
  if (it.id !== 'crate') figs.push(crate);
  if (it.id !== 'pumpkin') figs.push(pump);

  function draw(S) {
    S = Math.max(16, Math.min(260, Math.round(S)));
    zoom.value = S;
    zv.textContent = `${S} px per crate`;
    const gap = 28;
    const slot = (f) => Math.max(f.c[0] * S, 96);
    const totalW = figs.reduce((s, f) => s + slot(f), 0) + gap * (figs.length + 1);
    const maxHc = Math.max(...figs.map((f) => f.c[1]));
    const inner = h('div.wk-scene', { style: { width: Math.ceil(totalW) + 'px', height: Math.ceil(maxHc * S) + 100 + 'px', '--s': S + 'px', '--cell': S / 8 + 'px' } });
    inner.classList.toggle('fine', S >= 96);
    let x = gap;
    figs.forEach((f, i) => {
      const w = Math.max(1, Math.round(f.c[0] * S)), hh = Math.max(1, Math.round(f.c[1] * S));
      const img = sprite(f);
      img.loading = 'eager';
      img.style.width = w + 'px'; img.style.height = hh + 'px';
      const fig = h('figure.wk-fig' + (i === 0 ? '.main' : ''), { style: { left: x + 'px', width: Math.max(w, 96) + 'px' } },
        img,
        h('figcaption', h('strong', f.name), h('span', `${sizeText(f)}`)));
      fig.style.setProperty('--w', w + 'px');
      img.style.alignSelf = 'flex-start';
      inner.append(fig);
      x += slot(f) + gap;
    });
    // bar: 1 crate in 8 cells
    const bar = h('div.wk-bar', { style: { width: Math.round(S) + 'px' } });
    inner.append(h('div.wk-barbox', bar, h('span', { style: { left: Math.round(S) + 8 + 'px' } }, '1 crate = 8 grid cells')));
    sceneWrap.replaceChildren(inner);
  }
  const fitW = () => {
    const W = (sceneWrap.clientWidth || 640) - 8;
    const sumW = figs.reduce((s, f) => s + f.c[0], 0);
    const maxHc = Math.max(...figs.map((f) => f.c[1]));
    return Math.min(140, (W - 28 * (figs.length + 1)) / sumW, 300 / maxHc);
  };
  fitAll.addEventListener('click', () => draw(fitW()));
  fitItem.addEventListener('click', () => draw(Math.min(260, 190 / Math.max(it.c[0], it.c[1]))));
  zoom.addEventListener('input', () => draw(+zoom.value));
  sceneCol.append(sceneWrap, h('div.row.wk-scene-tools', h('label.wk-zoom', h('span', 'Zoom'), zoom, zv), fitItem, fitAll));

  // size table
  const sizeTbl = h('section.wk-section', h('h2', 'Size'),
    h('div.table-wrap.wk-small', h('table.data',
      h('thead', h('tr', h('th', 'Unit'), h('th.num', 'Width'), h('th.num', 'Height'))),
      h('tbody',
        h('tr', h('td', 'Crates'), h('td.num', fmt(it.c[0], 2)), h('td.num', fmt(it.c[1], 2))),
        h('tr', h('td', 'Grid cells (1 cell = 1/8 crate)'), h('td.num', fmt(cl[0], 1)), h('td.num', fmt(cl[1], 1))),
        h('tr', h('td', 'Source pixels (fixed camera)'), h('td.num', String(it.px[0])), h('td.num', String(it.px[1])))))),
    h('p.muted', `Area: ${fmt(area(it), 3)} square crates. Accurate to about 2 pixels per edge.`));

  // info
  const info = [];
  info.push(h('section.wk-section', h('h2', 'Details'),
    h('dl.wk-dl',
      h('dt', 'Category'), h('dd', it.cat),
      h('dt', 'Power button'), h('dd', it.act ? 'Yes. It shows power buttons at the screen corners.' : 'None seen in the recordings.'),
      it.note ? [h('dt', 'Notes'), h('dd', it.note)] : null)));

  if (it.flags.length) {
    info.push(h('section.wk-section', h('h2', BADGE_TEXT),
      h('p', 'A new screenshot would improve this size. Why it is flagged:'),
      h('ul', it.flags.map((f) => h('li', h('code', f), ' ', FLAG_INFO[f] || ''))),
      h('p', h('a', { href: '#/wiki/missing' }, 'How to send a measurement shot'))));
  }

  const params = it.params || [];
  info.push(h('section.wk-section', h('h2', 'Parameters'),
    params.length
      ? [h('div.table-wrap.wk-small', h('table.data',
        h('thead', h('tr', h('th', 'Label'), h('th', 'Key'), h('th', 'Value seen'), h('th', 'Status'))),
        h('tbody', params.map((p) => h('tr',
          h('td', h('strong', p.label)), h('td', h('code', p.key)),
          h('td', p.type === 'bool' ? (p.default ? 'Checked' : 'Unchecked') : p.type === 'color' ? [h('span.wk-swatch', { style: { background: p.default } }), ' ', String(p.default)] : String(p.default)),
          h('td', p.uncertain ? h('span.badge.warn', 'Unconfirmed') : h('span.badge.ok', 'Seen'))))))),
      h('p.muted', 'Values are what was on screen in a recording. Ranges and units were never shown.')]
      : h('p.muted', 'No parameter panel was opened for this item in the recordings. That does not mean it has none.')));

  // similar + neighbours
  const sim = data.items.filter((o) => o.id !== it.id)
    .map((o) => [Math.abs(Math.log(area(o) / area(it))), o]).sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).slice(0, 6).map((x) => x[1]);
  const catItems = data.items.filter((o) => o.cat === it.cat);
  const idx = catItems.findIndex((o) => o.id === it.id);
  const prev = catItems[idx - 1];
  const next = catItems[idx + 1];
  const mini = (o) => h('a.card.link.wk-mini', { href: '#/wiki/item/' + o.id },
    h('div.wk-stage.small', sprite(o)), h('strong', o.name), h('span.muted', `${sizeText(o)} crates`));

  main.append(sceneCol, h('div.wk-two', sizeTbl, info[0]), ...info.slice(1),
    h('section.wk-section', h('h2', 'Similar size'), h('p.muted', 'The six items closest in area.'), h('div.wk-minis', sim.map(mini))),
    h('nav.wk-pn', { 'aria-label': 'Neighbours in ' + it.cat },
      prev ? h('a.btn', { href: '#/wiki/item/' + prev.id }, '← ' + prev.name) : h('span'),
      h('span.muted', `${idx + 1} of ${catItems.length} in ${it.cat}`),
      next ? h('a.btn', { href: '#/wiki/item/' + next.id }, next.name + ' →') : h('span')));

  const onResize = debounce(() => draw(+zoom.value), 200);
  window.addEventListener('resize', onResize);
  cleanups.push(() => window.removeEventListener('resize', onResize));
  return { el, after: () => draw(fitW()) };
}

// ================================================================ C. missing items
async function missingPage(ctx, cleanups) {
  const { el, main } = shell('missing', [{ label: 'Wiki', href: '#/wiki' }, { label: 'Missing items' }], ctx);
  let md;
  try {
    const r = await fetch('data/missing.json');
    if (!r.ok) throw new Error(r.status);
    md = await r.json();
  } catch (e) {
    main.append(h('div.callout.warn', h('h1', 'Missing items'), h('p', 'Could not load the list (' + e.message + ').')));
    return { el };
  }
  const saved = store.get('wiki.missing', {}) || {};
  const ticked = new Set(Object.keys(saved).filter((k) => saved[k]));
  const keyOf = (g, n) => g.name + '|' + n;
  const needed = md.groups.filter((g) => !g.skip);
  const total = needed.reduce((s, g) => s + g.items.length, 0);
  const persist = () => store.set('wiki.missing', Object.fromEntries([...ticked].map((k) => [k, true])));

  const countEl = h('strong.wk-prog-n');
  const barFill = h('div.wk-prog-fill');
  const prog = h('div.wk-prog', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-label': 'Photographed so far' }, barFill);
  const groupCounters = [];
  let hideDone = false;

  function update() {
    const done = needed.reduce((s, g) => s + g.items.filter((n) => ticked.has(keyOf(g, n))).length, 0);
    countEl.textContent = `${done} of ${total} photographed`;
    barFill.style.width = (total ? (done / total) * 100 : 0) + '%';
    prog.setAttribute('aria-valuenow', String(done));
    groupCounters.forEach((f) => f());
  }

  const howto = h('section.wk-section.wk-howto', h('h2', 'How to send a measurement shot'),
    h('ol.wk-steps',
      h('li', h('strong', 'Put a Crate on the floor. '), 'The Crate is the size reference. It must be in the picture.'),
      h('li', h('strong', 'Spawn the item next to it. '), 'Use the same camera zoom and the same spot on the screen as before. Do not pinch or pan between shots.'),
      h('li', h('strong', 'Keep the view clean. '), 'Nothing else should touch the item. Avoid sparks, smoke, glow or a ragdoll beside it, because they make the edges hard to read.'),
      h('li', h('strong', 'Take one screenshot per item. '), 'If an item is too big to fit in the view, shoot it anyway and say so. It will carry a "large" note.'),
      h('li', h('strong', 'Send the shots. '), 'Tick the item here when you have photographed it. The ticks stay on this device only.')),
    h('p.muted', 'A shot with a spawned item next to a Crate is all we need. Sizes are worked out from the pixels.'));

  const hideBtn = h('button.btn.sm', { type: 'button', 'aria-pressed': 'false', onclick: (e) => { hideDone = !hideDone; e.currentTarget.setAttribute('aria-pressed', String(hideDone)); list.classList.toggle('hide-done', hideDone); } }, 'Hide ticked');
  const resetBtn = h('button.btn.sm.ghost', { type: 'button', onclick: () => { if (ticked.size && confirm('Clear every tick on this checklist?')) { ticked.clear(); persist(); list.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = false; c.closest('li').classList.remove('done'); }); update(); } } }, 'Clear all ticks');

  const list = h('div.wk-groups');
  needed.forEach((g) => {
    const cnt = h('span.muted');
    const boxes = g.items.map((n) => {
      const k = keyOf(g, n);
      const cb = h('input', { type: 'checkbox', checked: ticked.has(k), onchange: (e) => { if (e.target.checked) ticked.add(k); else ticked.delete(k); li.classList.toggle('done', e.target.checked); persist(); update(); } });
      const li = h('li' + (ticked.has(k) ? '.done' : ''), h('label.wk-check', cb, h('span', n)));
      return li;
    });
    groupCounters.push(() => { cnt.textContent = `${g.items.filter((n) => ticked.has(keyOf(g, n))).length} of ${g.items.length}`; });
    list.append(h('details.wk-group', { open: true }, h('summary', h('h3', g.name), cnt), h('ul.wk-checks', boxes)));
  });

  const skipped = md.groups.filter((g) => g.skip);
  const skippedEls = skipped.map((g) => h('details.wk-group.skipped',
    h('summary', h('h3', g.name), h('span.muted', `${g.items.length} skipped`)),
    h('p', 'These are worn on a ragdoll, not placed in a build, so we do not plan to measure them. If you want one as a prop, send a shot and we will add it.'),
    h('ul.wk-plain', g.items.map((n) => h('li', n)))));

  main.append(
    h('header.wk-intro', h('h1', 'Missing items'),
      h('p.lead', md.note || 'Items from the game list with no measured size yet.'),
      h('p', 'The measured ones are in the ', h('a', { href: '#/wiki' }, 'item index'), '. Large items that do not fit the camera view are expected here too.')),
    h('div.card.wk-progress', h('div.row', countEl, h('span.grow'), hideBtn, resetBtn), prog),
    howto,
    h('h2', 'Checklist'), list,
    skippedEls.length ? [h('h2', 'Skipped on purpose'), skippedEls] : null);
  update();
  return { el };
}

// ================================================================ D. guides
function factCounts(a) {
  const c = { seen: 0, inferred: 0, unknown: 0 };
  a.blocks.forEach((b) => { if (b.t === 'facts') b.items.forEach(([k]) => { c[k]++; }); });
  return c;
}

function guideIndex(ctx) {
  const { el, main } = shell('guides', [{ label: 'Wiki', href: '#/wiki' }, { label: 'Guides' }], ctx);
  main.append(h('header.wk-intro', h('h1', 'Guides'),
    h('p.lead', 'Short reference pages built only from what the recordings showed. Each fact is marked as seen, inferred or not shown, so you can tell what is solid.'),
    h('p', 'For step-by-step practice, use the ', h('a', { href: '#/learn' }, 'Learn page'), ' instead.'),
    keyLegend()));
  GROUPS.forEach((g) => {
    const arts = ARTICLES.filter((a) => a.group === g.id);
    main.append(h('section.wk-section', h('h2', g.name),
      h('div.cards.wk-guides', arts.map((a) => {
        const c = factCounts(a);
        const has = c.seen + c.inferred > 0;
        return h('a.card.link.wk-guide', { href: '#/wiki/guide/' + a.slug },
          h('h3', a.title), h('p', a.summary),
          has ? h('span.wk-counts', h('span.badge.ok', `${c.seen} seen`), h('span.badge.info', `${c.inferred} inferred`), h('span.badge', `${c.unknown} not shown`)) : null);
      }))));
  });
  return { el };
}

function keyLegend() {
  return h('p.wk-key', h('span.badge.ok', 'Seen'), ' on screen in a recording. ', h('span.badge.info', 'Inferred'), ' our reading, not confirmed. ', h('span.badge', 'Not shown'), ' no evidence either way.');
}

function articlePage(ctx, slug, cleanups) {
  const art = ARTICLES.find((a) => a.slug === slug);
  if (!art) {
    const { el, main } = shell('guides', [{ label: 'Wiki', href: '#/wiki' }, { label: 'Guides', href: '#/wiki/guide' }, { label: 'Not found' }], ctx);
    main.append(h('div.callout.warn', h('h1', 'No guide called "' + slug + '"'), h('a.btn.primary', { href: '#/wiki/guide' }, 'All guides')));
    return { el };
  }
  const { el, main } = shell('guides', [{ label: 'Wiki', href: '#/wiki' }, { label: 'Guides', href: '#/wiki/guide' }, { label: art.title }], ctx, slug);
  const body = h('article.wk-article');
  const hasFacts = art.blocks.some((b) => b.t === 'facts');
  main.append(h('header.wk-intro', h('h1', art.title), h('p.lead', art.summary), hasFacts ? keyLegend() : null), body);
  art.blocks.forEach((b) => { const n = renderBlock(b, ctx, cleanups); if (n) body.append(n); });

  const i = ARTICLES.indexOf(art);
  const rel = (art.related || []).map((s) => ARTICLES.find((a) => a.slug === s)).filter(Boolean);
  if (rel.length) main.append(h('section.wk-section', h('h2', 'Related'), h('div.cards.wk-guides', rel.map((a) => h('a.card.link.wk-guide', { href: '#/wiki/guide/' + a.slug }, h('h3', a.title), h('p', a.summary))))));
  const prev = ARTICLES[i - 1], next = ARTICLES[i + 1];
  main.append(h('nav.wk-pn', { 'aria-label': 'Guide neighbours' },
    prev ? h('a.btn', { href: '#/wiki/guide/' + prev.slug }, '← ' + prev.title) : h('span'),
    next ? h('a.btn', { href: '#/wiki/guide/' + next.slug }, next.title + ' →') : h('span')));
  return { el };
}

function renderBlock(b, ctx, cleanups) {
  const { data } = ctx;
  switch (b.t) {
    case 'p': return h('p', inline(b.x));
    case 'h': return h('h2', b.x);
    case 'h3': return h('h3', b.x);
    case 'ul': return h('ul.wk-list-plain', b.items.map((x) => h('li', inline(x))));
    case 'ol': return h('ol.wk-steps', b.items.map((x) => h('li', inline(x))));
    case 'callout': return h('div.callout' + (b.kind ? '.' + b.kind : ''), h('p', inline(b.x)));
    case 'facts': return h('ul.wk-facts', b.items.map(([k, x]) => h('li.' + k, h('span.badge.wk-kind.' + (k === 'seen' ? 'ok' : k === 'inferred' ? 'info' : 'none'), KIND_LABEL[k]), h('span', inline(x)))));
    case 'table': return h('div.table-wrap.wk-small', h('table.data.wk-resp',
      b.cap ? h('caption', b.cap) : null,
      h('thead', h('tr', b.head.map((x) => h('th', { scope: 'col' }, x)))),
      h('tbody', b.rows.map((r) => h('tr', r.map((c, ci) => h('td', { dataset: { label: b.head[ci] } }, inline(c))))))));
    case 'items': return h('div.wk-chips', b.ids.map((id) => { const it = data.byId.get(id); return it ? h('a.chip.wk-itemchip', { href: '#/wiki/item/' + id }, h('span.wk-chipimg', sprite(it)), it.name) : null; }));
    case 'menu': return h('figure.wk-menu', h('figcaption', b.title), h('div.wk-menugrid', b.cells.map((c) => h('span.wk-menucell' + (c.startsWith('(') ? '.blank' : ''), c))));
    case 'params': return paramsTable(data);
    case 'gates': return gatesBlock(data);
    case 'glossary': return h('dl.wk-gloss', GLOSSARY.map(([t, d]) => [h('dt', t), h('dd', inline(d))]));
    default: return null;
  }
}

function paramsTable(data) {
  const rows = [];
  data.items.forEach((it) => (it.params || []).forEach((p) => rows.push([it, p])));
  return h('div.table-wrap.wk-small', h('table.data.wk-resp',
    h('thead', h('tr', ['Item', 'Parameter', 'Type', 'Value on screen', 'Status'].map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', rows.map(([it, p]) => h('tr',
      h('td', { dataset: { label: 'Item' } }, h('a', { href: '#/wiki/item/' + it.id }, it.name)),
      h('td', { dataset: { label: 'Parameter' } }, h('strong', p.label)),
      h('td', { dataset: { label: 'Type' } }, p.type === 'bool' ? 'Checkbox' : p.type === 'color' ? 'Colour' : 'Number'),
      h('td', { dataset: { label: 'Value on screen' } }, p.type === 'bool' ? (p.default ? 'Checked' : 'Unchecked') : p.type === 'color' ? [h('span.wk-swatch', { style: { background: p.default } }), ' ', String(p.default)] : String(p.default)),
      h('td', { dataset: { label: 'Status' } }, p.uncertain ? h('span.badge.warn', 'Unconfirmed') : h('span.badge.ok', 'Seen')))))));
}

function gatesBlock(data) {
  const total = data.gates.groups.reduce((s, g) => s + g.gates.length, 0);
  const q = h('input', { type: 'search', placeholder: 'Search gates, for example "add" or "angle"', 'aria-label': 'Search gates', autocomplete: 'off' });
  const status = h('p.muted', { 'aria-live': 'polite' });
  const out = h('div.wk-gates');
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    let n = 0;
    out.replaceChildren(...data.gates.groups.map((g) => {
      const list = g.gates.filter((x) => !t || x.toLowerCase().includes(t) || g.name.toLowerCase().includes(t));
      n += list.length;
      if (!list.length) return null;
      return h('details.wk-group', { open: !!t || g.name === 'Common' || g.name === 'Math' },
        h('summary', h('h3', g.name), h('span.muted', String(list.length))),
        h('ul.wk-gatelist', list.map((x) => h('li', x))));
    }).filter(Boolean));
    status.textContent = t ? `${n} of ${total} gates match` : `${total} gates in ${data.gates.groups.length} groups`;
    if (t && !n) out.append(h('div.empty', 'No gate matches that.'));
  };
  q.addEventListener('input', debounce(draw, 100));
  draw();
  return h('div.wk-gatebox', h('label.field', h('span', 'Search the gate list'), q), status, out);
}
