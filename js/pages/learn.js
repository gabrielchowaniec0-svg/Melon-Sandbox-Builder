// Route #/learn and #/learn/<lessonId>. Lessons are data: see data/lessons.json and docs/LESSONS.md.
import { h, ensureCss, store } from '../util.js';
import { createUiMock } from '../ui-mock.js';
import { createPlayer } from '../player.js';
import { newBuild } from '../data.js';

export const title = 'Learn';

const LEVELS = [
  { id: 'Beginner', head: 'Start here', blurb: 'Finding items, the menu, power buttons and freezing. No wiring needed.', tone: 'ok' },
  { id: 'Intermediate', head: 'Next steps', blurb: 'Settings, links between objects, and planning on the grid.', tone: 'info' },
  { id: 'Advanced', head: 'Wires and electricity', blurb: 'The least is known here. Expect more notes about what we have not seen.', tone: 'warn' },
];

const doneSet = () => new Set(store.get('learn.done', []) || []);
const saveDone = (set) => store.set('learn.done', [...set]);

/** Turn the small build in a lesson step into a full Build object. */
function lessonBuild(src, name) {
  const b = newBuild(name);
  b.items = (src.items || []).map((it) => ({ id: it.id, t: it.t, x: it.x, y: it.y, r: it.r || 0, f: !!it.f, p: it.p || {}, label: it.label || '' }));
  b.links = (src.links || []).map((l, i) => ({ id: l.id || 'l' + i, a: l.a, b: l.b, kind: l.kind, ax: l.ax || 0, ay: l.ay || 0, bx: l.bx || 0, by: l.by || 0, label: '', out: l.out || '', in: l.in || '' }));
  return b;
}

export async function mount(root, ctx) {
  await ensureCss('css/learn.css');
  const { data } = ctx;
  const lessons = data.lessons || [];
  const cleanups = [];
  const id = ctx.params[0];
  if (!id) renderList(root, lessons, data, cleanups);
  else renderLesson(root, lessons, id, data, cleanups);
  return () => cleanups.forEach((f) => { try { f(); } catch { /* ignore */ } });
}

// ------------------------------------------------------------------------------ list
function levelBadge(level) {
  const tone = (LEVELS.find((l) => l.id === level) || {}).tone || '';
  return h('span.badge.' + tone, level);
}

function renderList(root, lessons, data, cleanups) {
  const done = doneSet();
  const next = lessons.find((l) => !done.has(l.id)) || lessons[0];
  const nDone = lessons.filter((l) => done.has(l.id)).length;

  const mock = createUiMock({ scene: 'spawn', data, label: true });
  cleanups.push(() => mock.destroy());

  const hero = h('section.ln-hero',
    h('div.ln-hero-text',
      h('h1', 'Learn to build in Melon Sandbox'),
      h('p', 'Short lessons with a picture of the game screen that shows exactly where to tap. Each lesson takes a few minutes.'),
      h('p.ln-honest', 'Everything here comes from screen recordings of the game. When a fact is a guess, the lesson says inferred. When we never saw it, the lesson says so.'),
      lessons.length ? h('div.row',
        h('a.btn.primary', { href: '#/learn/' + next.id }, nDone ? `Continue: ${next.title}` : 'Start with lesson 1'),
        h('span.muted', `${nDone} of ${lessons.length} lessons done`)) : null),
    h('div.ln-hero-media', mock.el));

  const groups = LEVELS.map((lv) => {
    const items = lessons.map((l, i) => ({ l, i })).filter((x) => x.l.level === lv.id);
    if (!items.length) return null;
    return h('section.ln-group', { 'aria-labelledby': 'g-' + lv.id },
      h('header', h('h2', { id: 'g-' + lv.id }, lv.head), h('p.muted', lv.blurb)),
      h('div.ln-cards', items.map(({ l, i }) => h('a.card.link.ln-card', { href: '#/learn/' + l.id },
        h('div.ln-card-top', h('span.ln-lesson', `Lesson ${i + 1}`), done.has(l.id) ? h('span.badge.ok', 'Done') : null),
        h('h3', l.title),
        h('p', l.summary),
        h('div.ln-meta', levelBadge(l.level), h('span.badge', `${l.minutes} min`), h('span.badge', `${l.steps.length} steps`))))));
  });

  root.append(h('div.page.ln', hero, ...groups, lessons.length ? null : h('div.empty', h('h3', 'No lessons yet'), h('p', 'Add lessons to data/lessons.json.'))));
}

// ------------------------------------------------------------------------------ lesson
function renderLesson(root, lessons, id, data, cleanups) {
  const idx = lessons.findIndex((l) => l.id === id);
  if (idx < 0) {
    root.append(h('div.page.ln', h('div.empty', h('h3', 'That lesson does not exist'), h('p', 'It may have been renamed.'), h('a.btn', { href: '#/learn' }, 'All lessons'))));
    return;
  }
  const L = lessons[idx];
  const prev = lessons[idx - 1], next = lessons[idx + 1];
  document.title = `${L.title} · Learn · Melon Sandbox Builder`;

  const steps = L.steps.map((s, i) => {
    const media = [];
    if (s.mock) {
      const m = createUiMock({ scene: s.mock.scene, args: s.mock.args || {}, data, caption: s.mock.caption || '' });
      cleanups.push(() => m.destroy());
      media.push(m.el);
    }
    if (s.build) {
      const pl = createPlayer({ data, build: lessonBuild(s.build, s.title), compact: true });
      cleanups.push(() => pl.destroy());
      media.push(h('div.ln-player', pl.el));
    }
    const body = h('div.ln-body',
      ...(Array.isArray(s.text) ? s.text : [s.text]).filter(Boolean).map((t) => h('p', t)),
      s.facts ? h('dl.ln-facts', s.facts.map(([k, v]) => [h('dt', k), h('dd', v)])) : null,
      s.table ? h('div.table-wrap.ln-table', h('table.data', h('thead', h('tr', s.table.head.map((c) => h('th', c)))), h('tbody', s.table.rows.map((r) => h('tr', r.map((c, k) => h(k === 0 ? 'th' : 'td', { scope: k === 0 ? 'row' : null }, c))))))) : null,
      ...(s.tips || []).map((t) => h('p.ln-tip', h('b', 'Tip '), t)),
      s.unknown && s.unknown.length ? h('div.ln-unknown', h('span.badge.warn', 'Not seen in the recordings'), h('ul', s.unknown.map((u) => h('li', u)))) : null,
      s.links ? h('div.row', s.links.map((l) => h('a.btn', { href: l.href }, l.label))) : null);
    return h('section.ln-step' + (media.length ? '.has-media' : ''), { 'aria-labelledby': `st${i}` },
      h('header', h('span.ln-stepno', `Step ${i + 1} of ${L.steps.length}`), h('h2', { id: 'st' + i }, s.title)),
      h('div.ln-grid', media.length ? h('div.ln-media', media) : null, body));
  });

  const done = doneSet();
  const doneBtn = h('button.btn', { type: 'button', 'aria-pressed': String(done.has(L.id)) });
  const paintDone = () => {
    const d = doneSet().has(L.id);
    doneBtn.setAttribute('aria-pressed', String(d));
    doneBtn.textContent = d ? 'Marked as done' : 'Mark lesson as done';
  };
  doneBtn.addEventListener('click', () => { const s = doneSet(); s.has(L.id) ? s.delete(L.id) : s.add(L.id); saveDone(s); paintDone(); });
  paintDone();

  root.append(h('div.page.ln',
    h('nav.ln-crumb', { 'aria-label': 'Breadcrumb' }, h('a', { href: '#/learn' }, 'All lessons'), h('span', { 'aria-hidden': 'true' }, ' / '), `Lesson ${idx + 1}`),
    h('header.ln-head',
      h('h1', L.title),
      h('div.ln-meta', levelBadge(L.level), h('span.badge', `${L.minutes} min`), h('span.badge', `${L.steps.length} steps`)),
      h('p', L.intro)),
    ...steps,
    h('footer.ln-foot',
      h('div.row', doneBtn, prev ? h('a.btn.ghost', { href: '#/learn/' + prev.id }, 'Previous lesson') : null),
      next ? h('a.card.link.ln-next', { href: '#/learn/' + next.id }, h('span.ln-lesson', 'Next lesson'), h('h3', next.title), h('p', next.summary))
        : h('div.card.ln-next', h('span.ln-lesson', 'That was the last lesson'), h('p', 'Try a premade plan, or plan your own on the Build page.'),
          h('div.row', h('a.btn.primary', { href: '#/blueprints' }, 'Browse plans'), h('a.btn', { href: '#/build' }, 'Open the Build page'))))));
}
