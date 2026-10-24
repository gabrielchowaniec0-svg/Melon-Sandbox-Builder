// Loads the item catalog, gate list, blueprints and lessons; exposes sizing helpers.
// 1 "crate" is the game's Crate (263 x 261 px in our fixed-camera screenshots). All sizes are in crates.
import { deepCopy } from './util.js';

export const CELL = 0.125; // one grid cell = 1/8 crate

let cache = null;
const J = async (p) => {
  const r = await fetch(p);
  if (!r.ok) throw new Error(`Could not load ${p} (${r.status})`);
  return r.json();
};

export async function loadData() {
  if (cache) return cache;
  const [catalog, gates, blueprints, lessons] = await Promise.all([
    J('data/catalog.json'),
    J('data/gates.json'),
    J('data/blueprints.json').catch(() => ({ blueprints: [] })),
    J('data/lessons.json').catch(() => ({ lessons: [] })),
  ]);
  const byId = new Map(catalog.items.map((i) => [i.id, i]));
  cache = {
    catalog,
    items: catalog.items,
    cats: catalog.cats,
    byId,
    gates,
    blueprints: blueprints.blueprints || [],
    lessons: lessons.lessons || [],
  };
  return cache;
}

/** Size of an item as placed (before rotation), in crates. Custom blocks carry their own size. */
export function sizeOf(data, it) {
  if (it.t === 'custom') return { w: it.cw || 1, h: it.ch || 1 };
  const c = data.byId.get(it.t);
  if (!c) return { w: 1, h: 1 };
  return { w: c.c[0], h: c.c[1] };
}

/** Axis-aligned bounds of a placed item after rotation. */
export function boundsOf(data, it) {
  const { w, h } = sizeOf(data, it);
  const a = ((it.r || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
  const bw = w * cos + h * sin, bh = w * sin + h * cos;
  return { x0: it.x - bw / 2, x1: it.x + bw / 2, y0: it.y - bh / 2, y1: it.y + bh / 2, w: bw, h: bh };
}

export function buildBounds(data, build) {
  if (!build.items.length) return null;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const it of build.items) {
    const b = boundsOf(data, it);
    x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1);
    y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1);
  }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
}

export function newBuild(name = 'Untitled build') {
  const now = Date.now();
  return { v: 1, id: 'b' + now.toString(36), name, created: now, updated: now, items: [], links: [], steps: [], notes: '' };
}

export const LINK_KINDS = [
  { id: 'rope', name: 'Rope', hint: 'Tan twisted rope. Sags when slack.', color: '#c9a064', sag: 0.35 },
  { id: 'cable', name: 'Cable', hint: 'Grey twisted cable. Sags when slack.', color: '#9aa0a4', sag: 0.3 },
  { id: 'rod', name: 'Rod', hint: 'Rigid bar between two points.', color: '#b7bcc0', sag: 0 },
  { id: 'chain', name: 'Chain', hint: 'Grey chain. Stays taut.', color: '#8c9296', sag: 0.05 },
  { id: 'elastic', name: 'Stretch chain', hint: 'Chain with the double arrow. Stretched to about 3x in testing.', color: '#a8afb4', sag: 0.05 },
  { id: 'pipe', name: 'Pipe', hint: 'Moves liquid between containers.', color: '#6fc7ff', sag: 0.1 },
  { id: 'wire', name: 'Wire', hint: 'Rainbow-arrow tool. Sends an output to an input (ACTIVATION, ANGLE, COLOR...).', color: '#ff7ad9', sag: 0.12 },
  { id: 'electric', name: 'Electric wire', hint: 'Lightning-bolt tool. Carries power from a Generator.', color: '#ffd23f', sag: 0.1 },
];
export const linkKind = (id) => LINK_KINDS.find((k) => k.id === id) || LINK_KINDS[0];

export function validateBuild(data, b) {
  const errs = [];
  if (!b || typeof b !== 'object') return ['Not an object.'];
  if (!Array.isArray(b.items)) return ['Missing items list.'];
  const ids = new Set();
  b.items.forEach((it, i) => {
    if (!it.id) errs.push(`Item ${i + 1} has no id.`);
    if (ids.has(it.id)) errs.push(`Duplicate id ${it.id}.`);
    ids.add(it.id);
    if (it.t !== 'custom' && !data.byId.has(it.t)) errs.push(`Item ${it.id}: unknown type "${it.t}".`);
    if (typeof it.x !== 'number' || typeof it.y !== 'number') errs.push(`Item ${it.id}: x and y must be numbers.`);
  });
  (b.links || []).forEach((l, i) => {
    if (!ids.has(l.a) || !ids.has(l.b)) errs.push(`Link ${i + 1} points at a missing item.`);
    if (!LINK_KINDS.some((k) => k.id === l.kind)) errs.push(`Link ${i + 1}: unknown kind "${l.kind}".`);
  });
  return errs;
}

/** Make an imported build safe: fill defaults, drop broken links, keep unknown items as custom blocks. */
export function normalizeBuild(data, raw) {
  const b = deepCopy(raw);
  b.v = 1;
  b.id = b.id || 'b' + Date.now().toString(36);
  b.name = String(b.name || 'Imported build').slice(0, 80);
  b.created = b.created || Date.now();
  b.updated = Date.now();
  b.notes = b.notes || '';
  b.steps = Array.isArray(b.steps) ? b.steps : [];
  b.items = (b.items || []).filter((it) => it && it.id).map((it) => {
    const o = { id: String(it.id), t: it.t, x: +it.x || 0, y: +it.y || 0, r: +it.r || 0, f: !!it.f, p: it.p || {}, label: it.label || '' };
    if (o.t !== 'custom' && !data.byId.has(o.t)) {
      o.label = o.label || String(o.t);
      o.t = 'custom'; o.cw = 1; o.ch = 1;
    } else if (o.t === 'custom') {
      o.cw = +it.cw || 1; o.ch = +it.ch || 1; o.color = it.color;
    }
    return o;
  });
  const ids = new Set(b.items.map((i) => i.id));
  b.links = (b.links || []).filter((l) => l && ids.has(l.a) && ids.has(l.b)).map((l, i) => ({
    id: l.id || 'l' + i, a: l.a, b: l.b, kind: LINK_KINDS.some((k) => k.id === l.kind) ? l.kind : 'rope',
    ax: +l.ax || 0, ay: +l.ay || 0, bx: +l.bx || 0, by: +l.by || 0, label: l.label || '', out: l.out || '', in: l.in || '',
  }));
  return b;
}
