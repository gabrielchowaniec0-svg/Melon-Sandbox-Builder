// Turns a build into ordered, plain-language build steps (the "autobuilder").
// Output step: { title, text, tips:[], params:[[label,value]], add:[itemIds], link:[linkIds], tap:[{x,y}], kind }
import { boundsOf, sizeOf, linkKind, CELL } from './data.js';
import { anchorPos } from './render.js';

const EPS = 0.06;
const near = (a, b, e = EPS) => Math.abs(a - b) <= e;
const cr = (n) => {
  const v = Math.round(n * 100) / 100;
  const cells = Math.round(n / CELL);
  return `${v} crate${v === 1 ? '' : 's'} (${cells} grid cell${cells === 1 ? '' : 's'})`;
};

export function nameMap(data, build) {
  const counts = new Map(), totals = new Map();
  const nameOf = (it) => (it.label ? it.label : it.t === 'custom' ? 'Custom block' : (data.byId.get(it.t) || { name: it.t }).name);
  for (const it of build.items) totals.set(nameOf(it), (totals.get(nameOf(it)) || 0) + 1);
  const out = new Map();
  for (const it of build.items) {
    const n = nameOf(it);
    const c = (counts.get(n) || 0) + 1;
    counts.set(n, c);
    out.set(it.id, totals.get(n) > 1 ? `${n} ${c}` : n);
  }
  return { names: out, base: nameOf };
}

function paramText(data, it) {
  if (it.t === 'custom') return [];
  const c = data.byId.get(it.t);
  if (!c || !c.params || !c.params.length || !it.p) return [];
  const out = [];
  for (const def of c.params) {
    if (it.p[def.key] === undefined) continue;
    if (it.p[def.key] === def.default) continue;
    let v = it.p[def.key];
    if (def.type === 'bool') v = v ? 'checked' : 'unchecked';
    out.push([def.label, String(v)]);
  }
  return out;
}

export function generateGuide(data, build) {
  const steps = [];
  if (!build.items.length) return steps;
  const { names, base } = nameMap(data, build);
  const boundsMap = new Map(build.items.map((it) => [it.id, boundsOf(data, it)]));
  const order = [...build.items].sort((a, b) => {
    const ba = boundsMap.get(a.id), bb = boundsMap.get(b.id);
    if (!near(ba.y0, bb.y0, 0.02)) return ba.y0 - bb.y0;
    return a.x - b.x;
  });

  // group runs of identical items on the same level into one step
  const groups = [];
  for (const it of order) {
    const last = groups[groups.length - 1];
    const b = boundsMap.get(it.id);
    if (last && last.length < 12) {
      const p = last[last.length - 1], pb = boundsMap.get(p.id);
      const sameKind = p.t === it.t && (p.r || 0) === (it.r || 0) && !!p.f === !!it.f && (p.label || '') === (it.label || '') &&
        JSON.stringify(p.p || {}) === JSON.stringify(it.p || {}) && (p.t !== 'custom' || (p.cw === it.cw && p.ch === it.ch));
      if (sameKind && near(pb.y0, b.y0, 0.02)) { last.push(it); continue; }
    }
    groups.push([it]);
  }

  const placed = [];
  const usedCats = new Set();
  const tipsShown = { freeze: false, flip: false, rotate: false, params: false };
  for (const g of groups) {
    const it = g[0];
    const c = it.t === 'custom' ? null : data.byId.get(it.t);
    const b = boundsMap.get(it.id);
    const title = g.length > 1 ? `Place ${g.length} × ${base(it)}` : `Place ${names.get(it.id)}`;
    const tips = [];
    const sentences = [];

    if (c) {
      const first = !usedCats.has(c.cat);
      usedCats.add(c.cat);
      sentences.push(first ? `Open the ${c.cat} section in the item panel, then tap ${c.name}${g.length > 1 ? ` ${g.length} times` : ''}.` :
        `Tap ${c.name}${g.length > 1 ? ` ${g.length} times` : ''} in ${c.cat}.`);
    } else {
      sentences.push(`This is a stand-in block for an item we have not measured yet. Place the real item here.`);
    }

    // where it goes
    const below = placed.filter((p) => {
      const pb = boundsMap.get(p.id);
      return near(pb.y1, b.y0) && pb.x0 < b.x1 - 0.02 && pb.x1 > b.x0 + 0.02;
    });
    const onFloor = near(b.y0, 0);
    const last = placed[placed.length - 1];
    const spread = (list) => {
      if (list.length < 2) return '';
      const xs = list.map((i) => i.x).sort((a, z) => a - z);
      const gap = xs[1] - xs[0] - boundsMap.get(list[0].id).w;
      return gap > 0.03 ? ` Leave ${cr(gap)} between each one.` : ` Put them side by side with no gap.`;
    };
    if (below.length) {
      const t = below[0], tb = boundsMap.get(t.id);
      const off = b.x0 - tb.x0;
      const where = near(off, 0, 0.04) ? 'lined up with its left edge' : near(b.x1, tb.x1, 0.04) ? 'lined up with its right edge' :
        near((b.x0 + b.x1) / 2, (tb.x0 + tb.x1) / 2, 0.04) ? 'centered' : off > 0 ? `${cr(off)} in from its left edge` : `sticking out ${cr(-off)} past its left edge`;
      sentences.push(`${g.length > 1 ? 'Stack them' : 'Rest it'} on top of ${names.get(t.id)}, ${where}.${spread(g)}`);
    } else if (onFloor) {
      if (!placed.length) sentences.push(g.length > 1 ? `Put them on the floor.${spread(g)}` : `Put it on the floor.`);
      else {
        const ref = nearestOf(placed, it, boundsMap);
        const rb = boundsMap.get(ref.id);
        const side = b.x0 >= rb.x1 - 0.02 ? 'right' : b.x1 <= rb.x0 + 0.02 ? 'left' : null;
        if (side) {
          const gap = side === 'right' ? b.x0 - rb.x1 : rb.x0 - b.x1;
          sentences.push(`Put ${g.length > 1 ? 'them' : 'it'} on the floor to the ${side} of ${names.get(ref.id)}${gap > 0.03 ? `, ${cr(gap)} away` : ', touching it'}.${spread(g)}`);
        } else sentences.push(`Put ${g.length > 1 ? 'them' : 'it'} on the floor next to ${names.get(ref.id)}.`);
      }
    } else {
      const ref = nearestOf(placed, it, boundsMap) || last;
      if (ref) {
        const rb = boundsMap.get(ref.id);
        const dx = (b.x0 + b.x1) / 2 - (rb.x0 + rb.x1) / 2, dy = (b.y0 + b.y1) / 2 - (rb.y0 + rb.y1) / 2;
        const parts = [];
        if (Math.abs(dx) > 0.03) parts.push(`${cr(Math.abs(dx))} to the ${dx > 0 ? 'right' : 'left'}`);
        if (Math.abs(dy) > 0.03) parts.push(`${cr(Math.abs(dy))} ${dy > 0 ? 'above' : 'below'}`);
        sentences.push(`Hold ${g.length > 1 ? 'them' : 'it'} ${parts.join(' and ') || 'in the same spot'} from the middle of ${names.get(ref.id)}.${spread(g)}`);
      } else sentences.push(`Hold it ${cr(b.y0)} above the floor.`);
      tips.push(`It floats in this plan. Tap it, then FREEZE, so it stays put when you press play.`);
      tipsShown.freeze = true;
    }
    if (it.r) { sentences.push(`Turn it ${it.r > 0 ? 'counter-clockwise' : 'clockwise'} ${Math.abs(Math.round(it.r))}°.`); }
    if (it.f) { sentences.push(`Tap it, open page 2 of the menu, and tap FLIP.`); }

    const params = [];
    for (const m of g) for (const p of paramText(data, m)) if (!params.some((q) => q[0] === p[0] && q[1] === p[1])) params.push(p);
    if (params.length) sentences.push(`Tap it, choose EDIT PARAMETERS, set ${params.map((p) => `${p[0]} to ${p[1]}`).join(', ')}, then CLOSE.${g.length > 1 ? ' Do this on each one.' : ''}`);
    if (g[0].label) tips.push(`Plan label: “${g[0].label}”.`);
    if (c && c.flags && c.flags.includes('edge-unsure')) tips.push('Its measured size is approximate.');

    steps.push({ title, text: sentences.join(' '), tips, params, add: g.map((m) => m.id), link: [], kind: 'place',
      tap: g.map((m) => ({ x: m.x, y: m.y })) });
    placed.push(...g);
  }

  // links
  const linkTool = (k) => `${linkKind(k).name} tool`;
  for (const l of build.links || []) {
    const k = linkKind(l.kind);
    const A = build.items.find((i) => i.id === l.a), B = build.items.find((i) => i.id === l.b);
    if (!A || !B) continue;
    const pa = anchorPos(A, l.ax, l.ay), pb = anchorPos(B, l.bx, l.by);
    let text = `Pick the ${linkTool(l.kind)} from the picker at the bottom-right of the screen. Tap ${names.get(A.id)}${l.ax || l.ay ? ' at the marked point' : ''}. When SELECT THE SECOND ROPE POINT appears, tap ${names.get(B.id)}${l.bx || l.by ? ' at the marked point' : ''}.`;
    const tips = [];
    if (l.kind === 'wire') {
      text += ` The SELECT INPUT/OUTPUT window opens.${l.out || l.in ? ` Choose ${l.out ? `OUTPUT ${l.out}` : 'an OUTPUT'}${l.in ? ` and INPUT ${l.in}` : ''}.` : ' Choose the OUTPUT on the left and the INPUT on the right.'} Tap APPLY.`;
    }
    if (l.kind === 'electric') tips.push('Then press the power button at the bottom of the screen to send power.');
    if (l.kind === 'elastic') tips.push('This chain stretches, so it can look much longer than the gap.');
    if (l.kind === 'pipe') tips.push('Liquid moves on its own once both containers are connected.');
    steps.push({ title: `${k.name}: ${names.get(A.id)} to ${names.get(B.id)}`, text, tips, params: [], add: [], link: [l.id], kind: 'link', tap: [{ x: pa[0], y: pa[1] }, { x: pb[0], y: pb[1] }] });
  }

  const hasPower = build.items.some((i) => (data.byId.get(i.t) || {}).act);
  steps.push({ title: 'Test it', text: hasPower ? 'Press the power button at the bottom-left or bottom-right of the screen to activate the parts. Use the pause and slow-motion buttons at the top-right to watch what happens.' : 'Press play (unpause) and watch it settle. If something slides, tap it and FREEZE it, or add a rope or rod.', tips: [], params: [], add: [], link: [], kind: 'test', tap: [] });
  return steps;
}

function nearestOf(list, it, boundsMap) {
  let best = null, bd = Infinity;
  const b = boundsMap.get(it.id);
  for (const p of list) {
    const pb = boundsMap.get(p.id);
    const d = Math.hypot((pb.x0 + pb.x1) / 2 - (b.x0 + b.x1) / 2, (pb.y0 + pb.y1) / 2 - (b.y0 + b.y1) / 2);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** Plain-text shopping list: counts per item and total footprint. */
export function partsList(data, build) {
  const m = new Map();
  for (const it of build.items) {
    const key = it.t === 'custom' ? `Custom: ${it.label || 'block'}` : (data.byId.get(it.t) || { name: it.t }).name;
    m.set(key, (m.get(key) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => ({ name, n }));
}

export function guideAsText(data, build, steps) {
  const lines = [`# ${build.name}`, ''];
  const parts = partsList(data, build);
  if (parts.length) { lines.push('Parts:'); parts.forEach((p) => lines.push(`- ${p.n} × ${p.name}`)); lines.push(''); }
  steps.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.title}`);
    lines.push(`   ${s.text}`);
    (s.tips || []).forEach((t) => lines.push(`   Tip: ${t}`));
  });
  return lines.join('\n');
}
