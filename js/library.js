// Saved builds live in the browser (localStorage). Export / import uses Base64 text codes ("MSB1:...").
import { store, encodeBuild, decodeBuild, deepCopy } from './util.js';
import { newBuild, normalizeBuild } from './data.js';

const KEY = 'builds';
const MAX = 60;

export function listBuilds() {
  return (store.get(KEY, []) || []).sort((a, b) => (b.updated || 0) - (a.updated || 0));
}
export function getBuild(id) {
  return (store.get(KEY, []) || []).find((b) => b.id === id) || null;
}
/** Insert or update. Returns false if the browser refused the write (storage full or blocked). */
export function saveBuild(build) {
  const all = store.get(KEY, []) || [];
  const copy = deepCopy(build);
  copy.updated = Date.now();
  const i = all.findIndex((b) => b.id === copy.id);
  if (i >= 0) all[i] = copy; else all.push(copy);
  all.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return store.set(KEY, all.slice(0, MAX));
}
export function deleteBuild(id) {
  store.set(KEY, (store.get(KEY, []) || []).filter((b) => b.id !== id));
  if (store.get('current') === id) store.del('current');
}
export function duplicateBuild(id) {
  const b = getBuild(id);
  if (!b) return null;
  const c = deepCopy(b);
  c.id = 'b' + Date.now().toString(36);
  c.name = b.name + ' copy';
  c.created = Date.now();
  saveBuild(c);
  return c;
}
export const getCurrentId = () => store.get('current');
export const setCurrentId = (id) => store.set('current', id);
export function createBuild(name) {
  const b = newBuild(name);
  saveBuild(b);
  setCurrentId(b.id);
  return b;
}
export const exportCode = (b) => encodeBuild(b);
/** Decode a pasted code, repair it and save it as a new build. Throws a plain-language Error. */
export function importCode(data, text) {
  const raw = decodeBuild(text);
  const b = normalizeBuild(data, raw);
  b.id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
  saveBuild(b);
  return b;
}
/** Copy a read-only plan (blueprint, lesson) into the library as an editable build. */
export function adoptBuild(source) {
  const b = deepCopy(source);
  b.id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
  b.created = Date.now();
  b.name = source.name;
  saveBuild(b);
  setCurrentId(b.id);
  return b;
}
