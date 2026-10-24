// Route #/blueprints and #/blueprints/<id>. Plans are data: data/blueprints.json, produced by melon-build/blueprints_gen.py.
import { h, ensureCss, encodeBuild, copyText, download, toast, slugify, fmt } from '../util.js';
import { buildBounds, CELL } from '../data.js';
import { thumbnail, preload, onSpritesLoaded } from '../render.js';
import { createPlayer } from '../player.js';
import { generateGuide, guideAsText } from '../guide.js';
import { adoptBuild } from '../library.js';

export const title = 'Plans';

const cleanupHooks = [];
const DIFFS = ['Easy', 'Medium', 'Hard'];
const DIFF_NOTE = {
  Easy: 'Stacking and placing. No settings or links.',
  Medium: 'A link, a setting or a power button is involved.',
  Hard: 'Several moving parts. More of it is guesswork.',
};
const diffTone = (d) => (d === 'Easy' ? 'ok' : d === 'Medium' ? 'info' : 'warn');
const DEFAULT_FLOAT_TIP = 'This part floats in the plan. Tap it, then FREEZE, so it stays put until you are ready. Unfreeze it when the rest is built (inferred).';
const ONE = 'Untested plan: we have not built this in the game. Sizes are measured, but how it behaves is a guess.';

function dims(data, bp) {
  const b = buildBounds(data, bp.build);
  if (!b) return { w: 0, h: 0, cw: 0, ch: 0 };
  return { w: b.w, h: b.h, cw: Math.round(b.w / CELL), ch: Math.round(b.h / CELL) };
}
const dimText = (d) => `${fmt(d.w, 2)} × ${fmt(d.h, 2)} crates`;

export async function mount(root, ctx) {
  await ensureCss('css/blueprints.css');
  cleanupHooks.length = 0;
  const plans = ctx.data.blueprints || [];
  const cleanups = [];
  const id = ctx.params[0];
  if (id) detail(root, ctx, plans, id, cleanups); else gallery(root, ctx, plans);
  return () => [...cleanupHooks, ...cleanups].forEach((f) => { try { f(); } catch { /* ignore */ } });
}

// ------------------------------------------------------------------------ gallery
function gallery(root, ctx, plans) {
  const { data } = ctx;
  let diff = 'All', tag = null;
  const tagCount = new Map();
  plans.forEach((p) => p.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
  const tags = [...tagCount.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);

  const thumbs = [];
  preload(data.items.map((i) => i.sprite).filter(Boolean).length ? [...new Set(plans.flatMap((p) => p.build.items.map((i) => (data.byId.get(i.t) || {}).sprite)).filter(Boolean))] : []);
  let rp = 0;
  cleanupHooks.push(onSpritesLoaded(() => { cancelAnimationFrame(rp); rp = requestAnimationFrame(() => thumbs.forEach((t) => t.repaint())); }));
  const results = h('div.bp-results', { 'aria-live': 'polite' });
  const diffBar = h('div.bp-seg', { role: 'group', 'aria-label': 'Difficulty' });
  const tagBar = h('div.bp-tags', { role: 'group', 'aria-label': 'Filter by tag' });

  const card = (p) => {
    const th = thumbnail(data, p.build, 320, 200);
    thumbs.push(th);
    const d = dims(data, p);
    return h('a.card.link.bp-card', { href: '#/blueprints/' + p.id },
      h('div.bp-thumb', th.canvas),
      h('div.bp-card-body',
        h('h3', p.title),
        h('p', p.summary),
        h('div.bp-meta', h('span.badge.' + diffTone(p.difficulty), p.difficulty), h('span.badge.warn', p.status), h('span.bp-dim', dimText(d)))));
  };

  function paint() {
    [...diffBar.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === diff)));
    [...tagBar.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === tag)));
    const list = plans.filter((p) => (diff === 'All' || p.difficulty === diff) && (!tag || p.tags.includes(tag)));
    results.replaceChildren();
    if (!list.length) {
      results.append(h('div.empty', h('h3', 'No plans match'), h('p', 'Try another difficulty or clear the tag.'), h('button.btn', { type: 'button', onclick: () => { diff = 'All'; tag = null; paint(); } }, 'Show all plans')));
      return;
    }
    for (const dname of DIFFS) {
      const sub = list.filter((p) => p.difficulty === dname);
      if (!sub.length) continue;
      results.append(h('section.bp-group', { 'aria-label': dname },
        h('header', h('h2', dname), h('p.muted', DIFF_NOTE[dname])),
        h('div.bp-grid', sub.map(card))));
    }
  }
  ['All', ...DIFFS].forEach((v) => diffBar.append(h('button.btn.sm', { type: 'button', 'data-v': v, 'aria-pressed': 'false', onclick: () => { diff = v; paint(); } }, v)));
  tags.forEach((t) => tagBar.append(h('button.chip.bp-chip', { type: 'button', 'data-v': t, 'aria-pressed': 'false', onclick: () => { tag = tag === t ? null : t; paint(); } }, t)));

  root.append(h('div.page.bp',
    h('header.page-head', h('h1', 'Plans'),
      h('p', 'Premade layouts built from measured sizes. Every part rests exactly on the floor or on the part below it. Open one in the Build page and change it however you like.')),
    h('p.bp-honest', h('span.badge.warn', 'Untested'), ' None of these plans has been tried in the game yet. We know the sizes, not how each one behaves. Notes marked inferred are guesses.'),
    h('div.bp-filters', h('div.bp-filter', h('span.bp-label', 'Difficulty'), diffBar), tags.length ? h('div.bp-filter', h('span.bp-label', 'Tag'), tagBar) : null),
    results));
  paint();
}

// ------------------------------------------------------------------------ detail
function detail(root, ctx, plans, id, cleanups) {
  const { data, app } = ctx;
  const p = plans.find((x) => x.id === id);
  if (!p) {
    root.append(h('div.page.bp', h('div.empty', h('h3', 'That plan does not exist'), h('p', 'It may have been renamed.'), h('a.btn', { href: '#/blueprints' }, 'All plans'))));
    return;
  }
  document.title = `${p.title} · Plans · Melon Sandbox Builder`;
  const build = p.build;
  const steps = generateGuide(data, build);
  const floating = new Set(p.floating || []);
  steps.forEach((s) => {
    if (s.kind === 'place' && s.add.some((i) => floating.has(i))) s.tips = (s.tips || []).map((t) => (/floats in this plan/.test(t) ? (p.floatTip || DEFAULT_FLOAT_TIP) : t));
  });

  const counts = new Map();
  for (const it of build.items) counts.set(it.t, (counts.get(it.t) || 0) + 1);
  const parts = [...counts.entries()].map(([t, n]) => ({ t, n, name: (data.byId.get(t) || { name: t }).name })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const d = dims(data, p);

  const player = createPlayer({ data, build, steps, autoplay: true });
  cleanups.push(() => player.destroy());

  const open = () => {
    const b = adoptBuild(build);
    app.nav('build/' + b.id);
  };
  const copy = async () => toast((await copyText(encodeBuild(build))) ? 'Base64 code copied.' : 'Copy failed. Use Download instead.', 'good');
  const dl = () => download(`${slugify(p.title)}-guide.txt`, guideAsText(data, build, steps));

  const related = plans.filter((x) => x.id !== id && x.tags.some((t) => p.tags.includes(t))).slice(0, 3);

  root.append(h('div.page.bp',
    h('nav.bp-crumb', { 'aria-label': 'Breadcrumb' }, h('a', { href: '#/blueprints' }, 'All plans'), h('span', { 'aria-hidden': 'true' }, ' / '), p.title),
    h('header.bp-head',
      h('h1', p.title),
      h('div.bp-meta', h('span.badge.' + diffTone(p.difficulty), p.difficulty), h('span.badge.warn', p.status), ...p.tags.map((t) => h('span.badge', t))),
      h('p', p.summary)),
    h('div.bp-actions',
      h('button.btn.primary', { type: 'button', onclick: open }, 'Open in builder'),
      h('button.btn', { type: 'button', onclick: copy }, 'Copy Base64 code'),
      h('button.btn', { type: 'button', onclick: dl }, 'Download guide as text')),
    h('p.bp-untested', h('b', 'Untested plan. '), ONE.replace('Untested plan: ', '')),
    h('div.bp-layout',
      h('div.bp-main', player.el),
      h('aside.bp-side',
        h('section.panel', h('header', 'Size'),
          h('div.body', h('p.bp-big', dimText(d)), h('p.muted', `${d.cw} × ${d.ch} grid cells (1 cell = 1/8 crate). ${build.items.length} parts${build.links.length ? `, ${build.links.length} link${build.links.length > 1 ? 's' : ''}` : ''}.`))),
        h('section.panel', h('header', 'Parts list'),
          h('div.body.bp-parts', h('ul', parts.map((x) => h('li', h('span.bp-n', `${x.n} ×`), data.byId.has(x.t) ? h('a', { href: '#/wiki/item/' + x.t }, x.name) : x.name))))),
        p.notes && p.notes.length ? h('section.panel', h('header', 'Before you build'),
          h('div.body', h('ul.bp-notes', p.notes.map((n) => h('li', n))))) : null)),
    related.length ? h('section.bp-related', h('h2', 'Similar plans'),
      h('div.bp-rel', related.map((x) => h('a.btn', { href: '#/blueprints/' + x.id }, x.title)))) : null));
}
