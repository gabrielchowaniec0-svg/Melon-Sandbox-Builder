// Developer tools: index (#/tools) and tool pages (#/tools/<id>).
import { h, ensureCss } from '../util.js';

export const title = 'Dev tools';
const IDS = ['size-compare', 'unit-converter', 'measure', 'codec', 'build-stats', 'catalog-export', 'logic-lab', 'layout-planner'];

async function loadTools() {
  const mods = await Promise.all(IDS.map(async (id) => {
    try { return (await import(`../tools/${id}.js`)).default; } catch (e) { console.error(e); return { id, title: id, blurb: 'This tool failed to load.', broken: true }; }
  }));
  return mods;
}

async function dataHealth(data) {
  const flagged = data.items.filter((i) => i.flags && i.flags.length);
  const by = (f) => flagged.filter((i) => i.flags.includes(f)).length;
  let missing = null, modified = null;
  try {
    const r = await fetch('data/missing.json');
    const j = await r.json();
    missing = j.groups.filter((g) => !g.skip).reduce((n, g) => n + g.items.length, 0);
  } catch { /* shown as unknown */ }
  try {
    const r = await fetch('data/catalog.json', { method: 'HEAD' });
    const lm = r.headers.get('last-modified');
    if (lm) modified = new Date(lm);
  } catch { /* ignore */ }
  const total = data.items.length;
  return h('section.panel.tl-health', h('header', 'Data health'),
    h('div.body.stack',
      h('div.tl-stats',
        h('div.tl-stat', h('span.muted', 'Measured items'), h('b', String(total)), h('small.muted', `${data.cats.length} categories`)),
        h('div.tl-stat', h('span.muted', 'Flagged items'), h('b', String(flagged.length)), h('small.muted', `${by('edge-unsure')} edge, ${by('name-unsure')} name, ${by('large')} large`)),
        h('div.tl-stat', h('span.muted', 'Missing items'), h('b', missing == null ? 'unknown' : String(missing)), h('small.muted', missing == null ? 'missing.json did not load' : `${Math.round((total / (total + missing)) * 100)} percent measured`)),
        h('div.tl-stat', h('span.muted', 'Data version'), h('b', `catalog v${data.catalog.version}`), h('small.muted', `gates v${data.gates.version ?? '?'}${modified ? ` · updated ${modified.toLocaleDateString()}` : ''}`))),
      h('p.muted', 'Flagged items need a better screenshot. Missing items are in the game but not measured yet: use the Measure tool to add them.')));
}

export async function mount(root, ctx) {
  await ensureCss('css/tools.css');
  const id = ctx.params[0];
  const tools = await loadTools();
  const page = h('div.page.tl-page');
  root.append(page);
  const crumb = (...parts) => h('nav.tl-crumbs', { 'aria-label': 'Breadcrumb' }, h('ol', parts.map((p, i) => h('li', i === parts.length - 1 ? { 'aria-current': 'page' } : null, p))));
  const tool = id && tools.find((t) => t.id === id);

  if (!id || !tool) {
    page.append(
      h('header.page-head', crumb('Dev tools'), h('h1', 'Dev tools'),
        h('p', 'Tools for people who plan, measure and share builds. Everything runs in your browser. Nothing is uploaded.')),
      id ? h('div.callout.warn', h('p', `There is no tool called "${id}". Pick one below.`)) : '',
      h('div.cards.tl-cards', tools.map((t) => h('a.card.link', { href: `#/tools/${t.id}` }, h('h3', t.title), h('p.muted', t.blurb)))),
      h('div.tl-gap', h('p.muted', 'Loading data health…')));
    const slot = page.lastChild;
    dataHealth(ctx.data).then((el) => slot.replaceWith(el)).catch(() => slot.replaceChildren());
    return;
  }

  const idx = tools.indexOf(tool);
  const prev = tools[idx - 1], next = tools[idx + 1];
  const body = h('div.tl-body');
  page.append(
    h('header.page-head', crumb(h('a', { href: '#/tools' }, 'Dev tools'), tool.title), h('h1', tool.title), h('p', tool.blurb)),
    body,
    h('nav.tl-pager', { 'aria-label': 'Other tools' },
      prev ? h('a.btn.ghost', { href: `#/tools/${prev.id}` }, `Previous: ${prev.title}`) : h('span'),
      next ? h('a.btn.ghost', { href: `#/tools/${next.id}` }, `Next: ${next.title}`) : h('span')));
  document.title = `${tool.title} · Dev tools · Melon Sandbox Builder`;
  if (tool.broken) { body.append(h('div.callout.warn', h('p', 'This tool could not load. Reload the page. If it keeps failing, the site files may be out of date.'))); return; }
  try {
    const cleanup = await tool.mount(body, ctx);
    return typeof cleanup === 'function' ? cleanup : undefined;
  } catch (e) {
    console.error(e);
    body.append(h('div.callout.warn', h('h3', 'This tool hit an error'), h('p', String(e && e.message || e)), h('a.btn', { href: '#/tools' }, 'Back to all tools')));
  }
}
