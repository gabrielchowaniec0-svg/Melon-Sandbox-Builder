// Codec workbench: build JSON <-> MSB1 Base64 code, validate, repair, diff, import.
import { h, encodeBuild, decodeBuild, CODE_PREFIX, toast, deepCopy } from '../util.js';
import { validateBuild, normalizeBuild } from '../data.js';
import { importCode } from '../library.js';
import { note, copyBtn, saveFile, buildSelect } from './kit.js';

const LIMITS = { chat: 2000, url: 8000 };

/** Accept a code, a share link, or raw JSON. Returns a build-like object; throws a plain-language Error. */
export function parseAny(text) {
  const t = String(text || '').trim();
  if (!t) throw new Error('Paste a build code or build JSON first.');
  if (t[0] === '{') {
    let o;
    try { o = JSON.parse(t); } catch (e) { throw new Error(`That looks like JSON but it has a syntax error (${e.message}). Check for a missing comma, quote or bracket near the position it names.`); }
    if (!o || !Array.isArray(o.items)) throw new Error('The JSON has no "items" list. A build needs items: [ ... ].');
    return o;
  }
  return decodeBuild(t);
}

/** Turn validateBuild messages into what is wrong and how to fix it. */
export function explain(errs) {
  return errs.map((e) => {
    let m;
    if ((m = /^Item (.+): unknown type "(.*)"\.$/.exec(e))) return { text: `Item ${m[1]} uses the type "${m[2]}", which is not in the catalog.`, fix: 'Check the spelling against the catalog id, or use Auto-repair to turn it into a 1 × 1 stand-in block.' };
    if ((m = /^Item (.+): x and y must be numbers\.$/.exec(e))) return { text: `Item ${m[1]} has a position that is not a number.`, fix: 'Set x and y to plain numbers in crates. Auto-repair sets bad values to 0.' };
    if ((m = /^Duplicate id (.+)\.$/.exec(e))) return { text: `Two items share the id "${m[1]}".`, fix: 'Every item needs its own id. Auto-repair renames the later copies.' };
    if (/^Item \d+ has no id\.$/.test(e)) return { text: e.replace('.', ' ') + 'so links and steps cannot point at it.', fix: 'Give it an id. Auto-repair adds one.' };
    if ((m = /^Link (\d+) points at a missing item\.$/.exec(e))) return { text: `Link ${m[1]} connects to an item id that does not exist.`, fix: 'Fix the "a" or "b" id on that link, or let Auto-repair remove the link.' };
    if ((m = /^Link (\d+): unknown kind "(.*)"\.$/.exec(e))) return { text: `Link ${m[1]} has the kind "${m[2]}", which this site does not know.`, fix: 'Use rope, cable, rod, chain, elastic, pipe, wire or electric. Auto-repair changes it to rope.' };
    if (e === 'Missing items list.') return { text: 'The build has no items list.', fix: 'Add "items": [] to the JSON.' };
    return { text: e, fix: 'Auto-repair may fix this.' };
  });
}

/** Give missing or repeated ids a fresh value first, then let normalizeBuild finish the job. */
export function repair(data, raw) {
  const b = deepCopy(raw);
  const seen = new Set();
  let n = 0, renamed = 0;
  b.items = (Array.isArray(b.items) ? b.items : []).filter((it) => it && typeof it === 'object').map((it) => {
    let id = it.id == null || it.id === '' ? null : String(it.id);
    if (id == null || seen.has(id)) {
      renamed++;
      do { id = 'r' + (++n); } while (seen.has(id));
    }
    seen.add(id);
    return { ...it, id };
  });
  const out = normalizeBuild(data, b);
  const notes = [];
  const unknown = out.items.filter((it, i) => it.t === 'custom' && b.items[i] && b.items[i].t !== 'custom').length;
  if (renamed) notes.push(`${renamed} item id${renamed > 1 ? 's were' : ' was'} missing or repeated and got new ids.`);
  if (unknown) notes.push(`${unknown} unknown item${unknown > 1 ? 's' : ''} became ${unknown > 1 ? '1 × 1 stand-in blocks' : 'a 1 × 1 stand-in block'} that keep${unknown > 1 ? '' : 's'} the old name as a label.`);
  const dropped = (Array.isArray(raw.links) ? raw.links.length : 0) - out.links.length;
  if (dropped > 0) notes.push(`${dropped} link${dropped > 1 ? 's' : ''} pointing at missing items ${dropped > 1 ? 'were' : 'was'} removed.`);
  const odd = (raw.links || []).filter((l) => l && !['rope', 'cable', 'rod', 'chain', 'elastic', 'pipe', 'wire', 'electric'].includes(l.kind)).length;
  if (odd) notes.push(`${odd} link${odd > 1 ? 's' : ''} with an unknown kind became rope.`);
  if (!notes.length) notes.push('Defaults were filled in. Nothing else needed changing.');
  return { build: out, notes };
}

const sizeInfo = (text) => {
  const chars = text.length;
  const bytes = new Blob([text]).size;
  const tier = chars <= LIMITS.chat ? 'ok' : chars <= LIMITS.url ? 'warn' : 'bad';
  const msg = {
    ok: 'Short enough for a chat message and a link.',
    warn: 'Too long for a chat message limit of about 2,000 characters, but fine as a file or in apps with larger limits. Links up to roughly 8,000 characters usually still open.',
    bad: 'Very long. Share it as a downloaded file, not as pasted text or a link.',
  }[tier];
  return { chars, bytes, tier, msg };
};

export function diffBuilds(data, A, B) {
  const nm = (it) => (it.t === 'custom' ? `Custom block${it.label ? ` "${it.label}"` : ''}` : (data.byId.get(it.t) || { name: it.t }).name);
  const mapA = new Map(A.items.map((i) => [i.id, i])), mapB = new Map(B.items.map((i) => [i.id, i]));
  const pos = (it) => `x ${+it.x.toFixed(3)}, y ${+it.y.toFixed(3)}`;
  const out = { added: [], removed: [], moved: [], changed: [], links: [], meta: [] };
  for (const [id, it] of mapB) if (!mapA.has(id)) out.added.push(`${nm(it)} (${id}) at ${pos(it)}`);
  for (const [id, it] of mapA) if (!mapB.has(id)) out.removed.push(`${nm(it)} (${id}) from ${pos(it)}`);
  for (const [id, a] of mapA) {
    const b = mapB.get(id);
    if (!b) continue;
    if (a.t !== b.t) { out.changed.push(`${id}: type changed from ${nm(a)} to ${nm(b)}`); continue; }
    const dx = (b.x || 0) - (a.x || 0), dy = (b.y || 0) - (a.y || 0);
    if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) out.moved.push(`${nm(a)} (${id}) moved ${Math.abs(dx) > 0.0005 ? `${Math.abs(+dx.toFixed(3))} ${dx > 0 ? 'right' : 'left'}` : ''}${Math.abs(dx) > 0.0005 && Math.abs(dy) > 0.0005 ? ' and ' : ''}${Math.abs(dy) > 0.0005 ? `${Math.abs(+dy.toFixed(3))} ${dy > 0 ? 'up' : 'down'}` : ''} (crates)`);
    if ((a.r || 0) !== (b.r || 0)) out.changed.push(`${nm(a)} (${id}) rotation ${a.r || 0}° to ${b.r || 0}°`);
    if (!!a.f !== !!b.f) out.changed.push(`${nm(a)} (${id}) flip ${a.f ? 'on' : 'off'} to ${b.f ? 'on' : 'off'}`);
    if ((a.label || '') !== (b.label || '')) out.changed.push(`${nm(a)} (${id}) label "${a.label || ''}" to "${b.label || ''}"`);
    const pa = a.p || {}, pb = b.p || {};
    for (const k of new Set([...Object.keys(pa), ...Object.keys(pb)])) if (JSON.stringify(pa[k]) !== JSON.stringify(pb[k])) out.changed.push(`${nm(a)} (${id}) parameter ${k}: ${JSON.stringify(pa[k])} to ${JSON.stringify(pb[k])}`);
    if (a.t === 'custom' && (a.cw !== b.cw || a.ch !== b.ch)) out.changed.push(`${id}: stand-in size ${a.cw} × ${a.ch} to ${b.cw} × ${b.ch}`);
  }
  const la = new Map((A.links || []).map((l) => [l.id, l])), lb = new Map((B.links || []).map((l) => [l.id, l]));
  for (const [id, l] of lb) if (!la.has(id)) out.links.push(`Added ${l.kind} from ${l.a} to ${l.b}`);
  for (const [id, l] of la) if (!lb.has(id)) out.links.push(`Removed ${l.kind} from ${l.a} to ${l.b}`);
  for (const [id, l] of la) { const m = lb.get(id); if (m && (m.a !== l.a || m.b !== l.b || m.kind !== l.kind)) out.links.push(`Changed link ${id}: ${l.kind} ${l.a}-${l.b} to ${m.kind} ${m.a}-${m.b}`); }
  if (A.name !== B.name) out.meta.push(`Name "${A.name}" to "${B.name}"`);
  return out;
}

export default {
  id: 'codec',
  title: 'Code workbench',
  blurb: 'Turn builds into MSB1 Base64 codes and back, check them against the catalog, repair them, and compare two builds.',
  mount(root, ctx) {
    const { data } = ctx;
    const src = h('textarea', { rows: 9, spellcheck: false, placeholder: 'Paste an MSB1 code, a share link, or build JSON.\nOr load a saved build from the list above.', 'aria-label': 'Build code or JSON' });
    const sel = buildSelect((b) => { if (b) { src.value = JSON.stringify(b, null, 2); run(); } }, { blank: 'Load a saved build' });
    const result = h('div.stack');
    let current = null; // raw parsed build

    function run() {
      result.replaceChildren();
      current = null;
      if (!src.value.trim()) { result.append(h('div.empty', h('h3', 'Nothing to convert yet'), h('p', 'Paste a code or JSON, or load a saved build. The tool detects which one it is.'))); return; }
      let b;
      try { b = parseAny(src.value); } catch (e) { result.append(note('warn', h('p', h('b', 'Could not read that. '), e.message))); return; }
      current = b;
      const isJson = src.value.trim()[0] === '{';
      const code = encodeBuild(b);
      const pretty = JSON.stringify(b, null, 2);
      const info = sizeInfo(code);
      const errs = validateBuild(data, b);
      const exp = explain(errs);

      const codeBox = h('textarea', { rows: 5, readonly: true, spellcheck: false, 'aria-label': 'MSB1 code' }); codeBox.value = code;
      const jsonBox = h('textarea', { rows: 14, readonly: true, spellcheck: false, 'aria-label': 'Pretty JSON' }); jsonBox.value = pretty;
      const val = h('div');
      const showVal = (bld) => {
        const e2 = validateBuild(data, bld), x2 = explain(e2);
        val.replaceChildren(
          e2.length ? h('div.callout.warn', h('p', h('b', `${e2.length} problem${e2.length > 1 ? 's' : ''} found`)),
            h('ul.tl-errs', x2.map((x) => h('li', x.text, ' ', h('span.muted', x.fix))))) :
            h('div.callout.good', h('p', h('b', 'Valid. '), `Every item type is in the catalog, ids are unique and links point at real items. ${bld.items.length} item${bld.items.length === 1 ? '' : 's'}, ${(bld.links || []).length} link${(bld.links || []).length === 1 ? '' : 's'}.`)));
      };
      showVal(b);
      const doRepair = () => {
        const { build, notes } = repair(data, b);
        src.value = JSON.stringify(build, null, 2);
        run();
        const slot = result.querySelector('.tl-valslot');
        slot && slot.prepend(h('div.callout.good', h('p', h('b', 'Auto-repair done. ')), h('ul', notes.map((n) => h('li', n)))));
      };
      const doImport = () => {
        try {
          const nb = importCode(data, encodeBuild(b));
          toast(`Saved "${nb.name}" to your library.`, 'good');
          sel.refresh();
        } catch (e) { toast(e.message, 'error'); }
      };
      result.append(
        h('p', h('span.badge.info', isJson ? 'Detected JSON, encoded below' : 'Detected a code, decoded below'), ' ', h('b', b.name || 'Untitled'), h('span.muted', ` · ${b.items.length} items`)),
        h('div.panel', h('header', 'Code'), h('div.body.stack', codeBox,
          h('div.row', copyBtn(code, 'Copy code'), h('button.btn.sm', { type: 'button', onclick: () => saveFile(`${(b.name || 'build').replace(/\W+/g, '-')}.msb.txt`, code) }, 'Download code')),
          h('div.tl-meter', { 'data-tier': info.tier },
            h('b', `${info.chars.toLocaleString()} characters`), h('span.muted', ` · ${info.bytes.toLocaleString()} bytes as text · ${new Blob([JSON.stringify(b)]).size.toLocaleString()} bytes of JSON`),
            h('div.tl-bar', h('i', { style: { width: Math.min(100, (info.chars / LIMITS.url) * 100) + '%' } })),
            h('p.muted', info.msg)))),
        h('div.panel', h('header', 'Check against the catalog'), h('div.body.stack.tl-valslot', val,
          h('div.row',
            h('button.btn.primary', { type: 'button', onclick: doRepair, disabled: errs.length === 0 }, 'Auto-repair'),
            h('button.btn', { type: 'button', onclick: doImport }, 'Import into my library'),
            errs.length === 0 ? h('span.muted', 'Auto-repair is only needed when there are problems.') : h('span.muted', 'Auto-repair rewrites the text above. You can undo by pasting your original again.')))),
        h('div.panel', h('header', 'Pretty JSON'), h('div.body.stack', jsonBox,
          h('div.row', copyBtn(pretty, 'Copy JSON'), h('button.btn.sm', { type: 'button', onclick: () => saveFile(`${(b.name || 'build').replace(/\W+/g, '-')}.json`, pretty, 'application/json') }, 'Download JSON')))));
      void exp;
    }
    src.addEventListener('input', () => { clearTimeout(run.t); run.t = setTimeout(run, 250); });

    // ---- compare
    const cmp = { a: h('textarea', { rows: 5, spellcheck: false, 'aria-label': 'Build A' }), b: h('textarea', { rows: 5, spellcheck: false, 'aria-label': 'Build B' }) };
    const cmpOut = h('div.stack');
    const side = (key, label) => {
      const s = buildSelect((bld) => { if (bld) { cmp[key].value = encodeBuild(bld); doDiff(); } }, { blank: `Load ${label} from library` });
      cmp[key].addEventListener('input', doDiff);
      return h('div.stack', h('b', label), s, cmp[key]);
    };
    function doDiff() {
      cmpOut.replaceChildren();
      if (!cmp.a.value.trim() || !cmp.b.value.trim()) { cmpOut.append(h('p.muted', 'Fill in both sides to see what changed.')); return; }
      let A, B;
      try { A = parseAny(cmp.a.value); } catch (e) { cmpOut.append(note('warn', h('p', 'Build A: ' + e.message))); return; }
      try { B = parseAny(cmp.b.value); } catch (e) { cmpOut.append(note('warn', h('p', 'Build B: ' + e.message))); return; }
      const d = diffBuilds(data, A, B);
      const total = Object.values(d).reduce((n, l) => n + l.length, 0);
      const sect = (title, rows) => rows.length ? h('div', h('h3', `${title} (${rows.length})`), h('ul', rows.map((r) => h('li', r)))) : null;
      cmpOut.append(...[
        total ? h('p', h('b', `${total} difference${total > 1 ? 's' : ''}`), ' from A to B. Items are matched by id.') : note('good', h('p', 'The two builds are the same. Same items, positions, parameters and links.')),
        sect('Added', d.added), sect('Removed', d.removed), sect('Moved', d.moved), sect('Changed', d.changed), sect('Links', d.links), sect('Name', d.meta)].filter(Boolean));
    }

    root.append(h('div.stack',
      h('section.panel', h('header', 'Convert and check'), h('div.body.stack', sel, src,
        h('div.row', h('button.btn.ghost', { type: 'button', onclick: () => { src.value = ''; run(); } }, 'Clear'),
          h('span.muted', `Codes start with ${CODE_PREFIX} and are the build JSON written as Base64.`)))),
      result,
      h('section.panel', h('header', 'Compare two builds'), h('div.body.stack',
        h('div.tl-grid2', side('a', 'Build A (before)'), side('b', 'Build B (after)')), cmpOut))));
    run(); doDiff();
  },
};
