// Small shared helpers for the developer tools (DOM pieces, canvas setup, file saving).
import { h, copyText, toast } from '../util.js';
import { getSprite } from '../render.js';
import { listBuilds } from '../library.js';

export const PX_W = 263; // screenshot pixels per crate, horizontal
export const PX_H = 261; // screenshot pixels per crate, vertical
export const CELLS_PER_CRATE = 8;

export const r2 = (n) => Math.round(n * 100) / 100;
export const r3 = (n) => Math.round(n * 1000) / 1000;
export const cratesTxt = (n) => `${r2(n)}`;
export const cellsTxt = (n) => `${Math.round(n * 80) / 10}`;

/** Labelled form field. */
export function field(label, input, hint) {
  return h('label.field', h('span', label), input, hint ? h('small.muted', hint) : null);
}

/** Segmented control made of toggle buttons. options: [[value, label]]. */
export function seg(options, value, onChange, label) {
  const wrap = h('div.tl-seg', { role: 'group', 'aria-label': label || null });
  const draw = () => {
    for (const b of wrap.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(value)));
  };
  for (const [v, text] of options) {
    wrap.append(h('button.btn.sm', {
      type: 'button', dataset: { v: String(v) },
      onclick: () => { value = v; draw(); onChange(v); },
    }, text));
  }
  draw();
  wrap.set = (v) => { value = v; draw(); };
  return wrap;
}

export function copyBtn(getText, label = 'Copy', cls = '') {
  return h(`button.btn.sm${cls ? '.' + cls : ''}`, {
    type: 'button',
    onclick: async () => {
      const t = typeof getText === 'function' ? getText() : getText;
      if (!t) { toast('There is nothing to copy yet.', 'error'); return; }
      toast((await copyText(t)) ? 'Copied.' : 'Copy was blocked. Select the text and copy it by hand.', 'info');
    },
  }, label);
}

/** Save a Blob or string as a downloaded file. */
export function saveFile(name, data, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
export function saveCanvasPng(canvas, name) {
  canvas.toBlob((b) => {
    if (!b) { toast('The browser could not make the PNG. Try a smaller selection.', 'error'); return; }
    saveFile(name, b, 'image/png');
  }, 'image/png');
}

export const note = (kind, ...kids) => h(`div.callout${kind ? '.' + kind : ''}`, kids);

export function thumb(item, size = 40) {
  const img = h('img.sprite.tl-thumb', { src: item.sprite, alt: '', loading: 'lazy', width: size, height: size });
  img.style.width = img.style.height = size + 'px';
  return img;
}

/** Size a canvas for the device pixel ratio. Returns its 2D context scaled to CSS pixels. */
export function setupCanvas(canvas, w, h2) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h2 * dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h2 + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Watch an element's width. Returns a stop function. */
export function watchWidth(el, fn) {
  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }
  const ro = new ResizeObserver(() => fn());
  ro.observe(el);
  return () => ro.disconnect();
}

/**
 * Searchable catalog picker. opts: { onPick(item), mark(item) -> string|null (small badge text), max }
 * Returns { el, refresh() }.
 */
export function itemPicker(data, opts = {}) {
  const q = h('input', { type: 'search', placeholder: 'Search items by name', 'aria-label': 'Search items by name', autocomplete: 'off' });
  const cat = h('select', { 'aria-label': 'Filter by category' }, h('option', { value: '' }, 'All categories'),
    data.cats.map((c) => h('option', { value: c }, c)));
  const list = h('div.tl-picklist', { role: 'list' });
  const count = h('p.muted.tl-pickcount');
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    const rows = data.items.filter((i) => (!cat.value || i.cat === cat.value) && (!t || i.name.toLowerCase().includes(t) || i.id.includes(t)));
    list.replaceChildren(...rows.map((i) => {
      const m = opts.mark ? opts.mark(i) : null;
      return h('button.tl-pick', { type: 'button', role: 'listitem', onclick: () => opts.onPick(i), title: `Add ${i.name}` },
        thumb(i, 36),
        h('span.tl-pick-text', h('b', i.name), h('small.muted', `${i.cat} · ${i.c[0]} × ${i.c[1]} crates`)),
        m ? h('span.badge.info', m) : null);
    }));
    if (!rows.length) list.append(h('p.muted.tl-empty', 'No item matches. Clear the search or pick another category.'));
    count.textContent = `${rows.length} of ${data.items.length} items`;
  };
  q.addEventListener('input', draw);
  cat.addEventListener('change', draw);
  draw();
  return { el: h('div.tl-picker', h('div.tl-pickbar', q, cat), list, count), refresh: draw };
}

/** A select listing saved builds. onChange(build|null). */
export function buildSelect(onChange, { blank = 'Choose a saved build' } = {}) {
  const sel = h('select', { 'aria-label': blank });
  const fill = () => {
    const keep = sel.value;
    const all = listBuilds();
    sel.replaceChildren(h('option', { value: '' }, all.length ? blank : 'No saved builds yet'),
      ...all.map((b) => h('option', { value: b.id }, `${b.name} (${b.items.length} items)`)));
    if (all.some((b) => b.id === keep)) sel.value = keep;
  };
  fill();
  sel.addEventListener('change', () => onChange(listBuilds().find((b) => b.id === sel.value) || null));
  sel.refresh = fill;
  return sel;
}

/** Download a table of rows as CSV text. */
export function toCsv(rows) {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}

export { getSprite };
