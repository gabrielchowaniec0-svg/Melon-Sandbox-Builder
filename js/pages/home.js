import { h, fmt, ensureCss, uid } from '../util.js';
import { newBuild, boundsOf, sizeOf } from '../data.js';
import { createPlayer } from '../player.js';
import { listBuilds } from '../library.js';
import { thumbnail } from '../render.js';
import { icon } from '../icons.js';

export const title = 'Home';

// A small scripted build for the hero: placed with real catalog sizes so every part rests exactly.
function demoBuild(data) {
  const b = newBuild('Table and a rope light');
  const get = (t) => sizeOf(data, { t });
  const add = (t, x, bottom, extra = {}) => { const s = get(t); const it = { id: uid('d'), t, x, y: bottom + s.h / 2, r: 0, f: false, p: {}, label: '', ...extra }; b.items.push(it); return { it, top: bottom + s.h, s }; };
  const table = add('table', 0, 0, { label: 'Table' });
  const cake = add('cake', -0.45, table.top);
  const tea = add('tea-box', 0.2, table.top);
  const lamp = add('edison-lamp', 0.65, table.top);
  const chair = add('chair', -1.45, 0);
  const crate = add('crate', 1.75, 0);
  const crate2 = add('crate', 1.75, crate.top);
  const wc = add('wheel', 2.65, 0);
  b.links.push({ id: uid('l'), a: crate2.it.id, b: lamp.it.id, kind: 'rope', ax: -0.3, ay: 0, bx: 0.0, by: 0.2, label: '', out: '', in: '' });
  return b;
}

export async function mount(root, { data, app }) {
  await ensureCss('css/home.css');
  const demo = demoBuild(data);
  const player = createPlayer({ data, build: demo, autoplay: true, compact: true });
  const placeable = data.items.length + 0;
  const missing = data.missing || null;

  const recent = listBuilds().slice(0, 4);
  const recentEl = recent.length ? h('section.hm-recent', h('h2', 'Pick up where you left off'),
    h('div.cards', recent.map((b) => {
      const t = thumbnail(data, b, 320, 170);
      return h('a.card.link.hm-build', { href: '#/build/' + b.id }, h('div.hm-thumb', t.canvas), h('b', b.name), h('span.muted', `${b.items.length} items, ${b.links.length} connections`));
    }))) : null;

  const tiles = [
    ['build', 'Build', 'Place items on a grid that is drawn to scale. Your work saves in this browser and exports as a Base64 code.', '#/build'],
    ['learn', 'Learn', 'Short animated lessons on menus, parameters, ropes, wires and electricity.', '#/learn'],
    ['plans', 'Plans', 'Ready-made layouts with a step-by-step guide. They are untested in the game, so treat them as starting points.', '#/blueprints'],
    ['wiki', 'Wiki', `Dimensions for ${data.items.length} items, plus the menus, tools and chip gates we have seen.`, '#/wiki'],
    ['tools', 'Dev tools', 'Size comparer, screenshot measurer, Base64 workbench, catalog export and more.', '#/tools'],
  ];

  root.append(h('div.page.hm',
    h('section.hm-hero',
      h('div.hm-copy',
        h('h1', 'Plan your Melon Sandbox build before you spawn it'),
        h('p.hm-lede', `Every item is drawn at its measured size next to a Crate, so a plan on screen matches the build in the game. ${data.items.length} items are measured so far.`),
        h('div.row', h('a.btn.primary', { href: '#/build' }, 'Start a build'), h('a.btn', { href: '#/learn' }, 'Follow a lesson')),
        h('p.muted.small.hm-note', 'This site does not connect to the game. You build in the game by hand; the guide tells you what to tap.')),
      h('div.hm-demo', player.el, h('p.muted.small', 'The guide for this small example builds itself from the plan.'))),
    recentEl,
    h('section.hm-grid', h('h2', 'Everything on this site'),
      h('div.cards', tiles.map(([ic, t, d, href]) => h('a.card.link.hm-tile', { href }, h('span.hm-ic', { html: icon(ic === 'plans' ? 'plans' : ic, 28) }), h('h3', t), h('p', d))))),
    h('section.hm-status', h('h2', 'How complete is the data?'),
      h('div.hm-stats', stat(data.items.length, 'items measured'), stat('about 2 px', 'typical measuring error'), stat('1 crate', '263 × 261 px in our screenshots')),
      h('p', 'Some items are still missing, mostly big ones that did not fit the camera and ones we have not photographed. You can place a stand-in Custom block for any of them, and the wiki lists what is still needed.'),
      h('div.row', h('a.btn', { href: '#/wiki/missing' }, 'See missing items'), h('a.btn.ghost', { href: '#/tools/measure' }, 'Measure an item yourself')))));

  return () => player.destroy();
}
const stat = (n, l) => h('div.hm-stat', h('b', String(n)), h('span', l));
