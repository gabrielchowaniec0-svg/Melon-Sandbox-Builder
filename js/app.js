// Router, shell, theme. Pages live in js/pages/*.js and export `mount(root, ctx)` returning an optional cleanup fn.
import { $, h, store, toast } from './util.js';
import { loadData } from './data.js';
import { icon } from './icons.js';

const ROUTES = [
  { id: 'home', path: '', label: 'Home', icon: 'home', nav: false },
  { id: 'build', path: 'build', label: 'Build', icon: 'build', nav: true },
  { id: 'learn', path: 'learn', label: 'Learn', icon: 'learn', nav: true },
  { id: 'blueprints', path: 'blueprints', label: 'Plans', icon: 'plans', nav: true },
  { id: 'wiki', path: 'wiki', label: 'Wiki', icon: 'wiki', nav: true },
  { id: 'tools', path: 'tools', label: 'Dev tools', icon: 'tools', nav: true },
];

const app = {
  data: null,
  routes: ROUTES,
  nav(path) { location.hash = '#/' + path.replace(/^#?\/?/, ''); },
  toast,
};
window.msb = app; // handy for debugging in the console

let cleanup = null;
let token = 0;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
  return { segs, query, route: ROUTES.find((r) => r.path === (segs[0] || '')) };
}

function shell() {
  const rail = h('nav.rail', { 'aria-label': 'Main' },
    h('a.brand', { href: '#/' }, h('img', { src: 'assets/logo.svg', alt: '', width: 40, height: 40 }), h('span', 'Melon Sandbox Builder')),
    ...ROUTES.filter((r) => r.nav).map((r) => h('a.nav-link', { href: '#/' + r.path, dataset: { route: r.id }, html: icon(r.icon) + `<span>${r.label}</span>` })),
    h('div.foot', h('button.btn.icon.ghost', { id: 'theme', 'aria-label': 'Switch light or dark theme', html: icon('sun', 20), onclick: toggleTheme })));
  const main = h('main#app', { tabindex: -1 });
  document.body.replaceChildren(h('a.sr', { href: '#app' }, 'Skip to content'), h('div.shell', rail, main), h('div#toasts', { 'aria-live': 'polite' }));
  return main;
}

function toggleTheme() {
  const cur = document.documentElement.dataset.theme;
  const next = cur === 'light' ? 'dark' : cur === 'dark' ? 'light' : (matchMedia('(prefers-color-scheme: light)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
}

async function route() {
  const my = ++token;
  const main = $('#app');
  const { segs, query, route } = parseHash();
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  document.querySelectorAll('.nav-link').forEach((a) => a.toggleAttribute('aria-current', a.dataset.route === (route && route.id)));
  document.querySelectorAll('.nav-link[aria-current]').forEach((a) => a.setAttribute('aria-current', 'page'));
  document.querySelectorAll('.nav-link:not([aria-current])').forEach((a) => a.removeAttribute('aria-current'));
  if (!route) { main.replaceChildren(h('div.page', h('div.empty', h('h3', 'That page does not exist'), h('p', 'Pick a section from the menu.'), h('a.btn', { href: '#/' }, 'Go home')))); return; }
  main.replaceChildren(h('div.page', h('p.muted', 'Loading…')));
  try {
    const mod = await import(`./pages/${route.id}.js`);
    main.classList.toggle('is-bd', route.id === 'build');
    if (my !== token) return;
    main.replaceChildren();
    const out = await mod.mount(main, { data: app.data, app, params: segs.slice(1), query, route });
    if (my !== token) { if (typeof out === 'function') out(); return; }
    cleanup = typeof out === 'function' ? out : null;
    document.title = (mod.title ? mod.title + ' · ' : route.label !== 'Home' ? route.label + ' · ' : '') + 'Melon Sandbox Builder';
    if (!query.keepscroll) window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div.page', h('div.callout.warn', h('h3', 'This page failed to load'), h('p', String(err && err.message || err)), h('a.btn', { href: '#/' }, 'Back to home'))));
  }
}

async function boot() {
  const t = store.get('theme');
  if (t) document.documentElement.dataset.theme = t;
  shell();
  try {
    app.data = await loadData();
  } catch (err) {
    $('#app').replaceChildren(h('div.page', h('div.callout.warn', h('h3', 'Could not load the item data'), h('p', String(err.message)), h('p.muted', 'If you opened index.html straight from a folder, serve the site over http instead (the Netlify link works).'))));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}
boot();
