// Small shared helpers: DOM, storage, Base64 codec, downloads, toasts.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Hyperscript-style element builder: h('div.card#id', {onclick}, child, 'text', [children]) */
export function h(tag, attrs, ...kids) {
  const m = /^([a-z0-9-]*)((?:[.#][\w-]+)*)$/i.exec(tag);
  const el = document.createElement(m && m[1] ? m[1] : 'div');
  if (m && m[2]) {
    for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1));
      else el.id = part.slice(1);
    }
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    kids.unshift(attrs);
    attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  const add = (k) => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return el;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const round = (v, step = 1) => Math.round(v / step) * step;
export const fmt = (n, d = 2) => {
  if (n == null || Number.isNaN(n)) return '–';
  return Number(n.toFixed(d)).toString();
};
export const uid = (p = 'n') => p + Math.random().toString(36).slice(2, 8);
export const deepCopy = (o) => JSON.parse(JSON.stringify(o));
export const debounce = (fn, ms = 200) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

// ---------- safe storage ----------
const mem = new Map();
export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem('msb:' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return mem.has(key) ? mem.get(key) : fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('msb:' + key, JSON.stringify(value));
      return true;
    } catch {
      mem.set(key, value);
      return false;
    }
  },
  del(key) {
    try { localStorage.removeItem('msb:' + key); } catch { /* ignore */ }
    mem.delete(key);
  },
};

// ---------- Base64 (UTF-8 safe) ----------
export function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function fromB64(b64) {
  const clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(clean);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export const CODE_PREFIX = 'MSB1:';
/** Build -> shareable text code ("MSB1:" + Base64 of JSON). */
export function encodeBuild(build) {
  return CODE_PREFIX + toB64(JSON.stringify(build));
}
/** Text code -> Build. Throws Error with a plain-language message. */
export function decodeBuild(text) {
  let t = String(text || '').trim();
  if (!t) throw new Error('Paste a build code first.');
  const hash = t.indexOf('#b=');
  if (hash >= 0) t = t.slice(hash + 3);
  if (t.startsWith(CODE_PREFIX)) t = t.slice(CODE_PREFIX.length);
  let json;
  try {
    json = fromB64(t);
  } catch {
    throw new Error('That is not valid Base64. Copy the whole code, including every character.');
  }
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error('The code decoded, but it is not a build. It may be cut off.');
  }
  if (!obj || !Array.isArray(obj.items)) throw new Error('The code decoded, but it has no items list.');
  return obj;
}

export function download(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}

let toastBox;
export function toast(msg, kind = 'info', ms = 2600) {
  if (!toastBox) toastBox = $('#toasts') || document.body.appendChild(h('div#toasts', { 'aria-live': 'polite' }));
  const t = h('div.toast.' + kind, { role: 'status' }, msg);
  toastBox.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => {
    t.classList.remove('in');
    setTimeout(() => t.remove(), 250);
  }, ms);
}

export const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const loadedCss = new Set();
/** Load a page stylesheet once. Resolves when it has applied. */
export function ensureCss(href) {
  if (loadedCss.has(href)) return Promise.resolve();
  loadedCss.add(href);
  return new Promise((res) => {
    const l = h('link', { rel: 'stylesheet', href });
    l.onload = l.onerror = () => res();
    document.head.append(l);
  });
}
