// Step-by-step animated build player. Drops each item in, draws links, shows a tap marker and the caption.
import { h, clamp } from './util.js';
import { buildBounds } from './data.js';
import { drawScene, makeCam, fitCam, preload, onSpritesLoaded } from './render.js';
import { generateGuide } from './guide.js';

const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const bounce = (t) => {
  if (t < 0.62) { const k = t / 0.62; return k * k; }
  if (t < 0.82) { const k = (t - 0.62) / 0.2 - 1; return 1 - 0.07 * (1 - k * k) * 1; }
  const k = (t - 0.82) / 0.18; return 1 - 0.03 * Math.sin(k * Math.PI);
};

/**
 * createPlayer({ data, build, steps?, autoplay?, compact?, title? }) -> { el, destroy, goTo, play, pause }
 * `steps` defaults to generateGuide(data, build).
 */
export function createPlayer({ data, build, steps, autoplay = true, compact = false, startAt = 0 }) {
  steps = steps && steps.length ? steps : generateGuide(data, build);
  const itemStep = new Map(); // item id -> step index where it appears
  const linkStep = new Map();
  steps.forEach((s, i) => { (s.add || []).forEach((id) => itemStep.set(id, i)); (s.link || []).forEach((id) => linkStep.set(id, i)); });
  // anything not named by a step shows from the start
  const state = { i: clamp(startAt, 0, steps.length - 1), t: 0, playing: autoplay && !reduced(), speed: 1, hold: 0, last: 0 };

  const cv = h('canvas.pl-canvas', { role: 'img', 'aria-label': 'Animated build preview' });
  const ctx = cv.getContext('2d');
  const cam = makeCam(600, 340);
  const caption = h('div.pl-caption', { 'aria-live': 'polite' });
  const dots = h('div.pl-dots', { role: 'tablist', 'aria-label': 'Steps' });
  const btnPlay = h('button.btn.icon', { 'aria-label': 'Play or pause', onclick: () => (state.playing ? pause() : play()) });
  const btnPrev = h('button.btn.icon', { 'aria-label': 'Previous step', onclick: () => goTo(state.i - 1) }, '‹');
  const btnNext = h('button.btn.icon', { 'aria-label': 'Next step', onclick: () => goTo(state.i + 1) }, '›');
  const btnRestart = h('button.btn.icon', { 'aria-label': 'Restart', onclick: () => goTo(0) }, '↺');
  const speedSel = h('select.pl-speed', { 'aria-label': 'Speed', onchange: (e) => { state.speed = +e.target.value; } },
    [['0.5', '0.5×'], ['1', '1×'], ['2', '2×']].map(([v, l]) => h('option', { value: v, selected: v === '1' }, l)));
  const el = h('section.player' + (compact ? '.compact' : ''), { tabindex: 0, 'aria-label': 'Step-by-step build player' },
    h('div.pl-stage', cv),
    h('div.pl-bar', btnRestart, btnPrev, btnPlay, btnNext, h('span.grow'), speedSel),
    dots, caption);

  dots.append(...steps.map((s, i) => h('button.pl-dot', { role: 'tab', 'aria-label': `Step ${i + 1}: ${s.title}`, onclick: () => goTo(i) })));

  const stepDur = (s) => 0.55 + 0.42 * Math.min((s.add || []).length, 5) + 0.9 * (s.link || []).length + (s.kind === 'test' ? 0.4 : 0);

  function setCaption() {
    const s = steps[state.i];
    caption.replaceChildren(
      h('div.pl-count', `Step ${state.i + 1} of ${steps.length}`),
      h('h3.pl-title', s.title),
      h('p.pl-text', s.text),
      ...(s.params && s.params.length ? [h('div.pl-params', s.params.map(([k, v]) => h('span.chip.param', h('b', k), ' ', v)))] : []),
      ...(s.tips || []).map((t) => h('p.pl-tip', h('span.tipmark', 'Tip'), ' ', t)),
    );
    [...dots.children].forEach((d, i) => { d.classList.toggle('on', i === state.i); d.classList.toggle('done', i < state.i); d.setAttribute('aria-selected', i === state.i); });
    btnPlay.textContent = state.playing ? '❚❚' : '▶';
    btnPrev.disabled = state.i === 0;
    btnNext.disabled = state.i === steps.length - 1;
  }

  function goTo(i) {
    state.i = clamp(i, 0, steps.length - 1);
    state.t = reduced() ? 99 : 0;
    state.hold = 0;
    setCaption();
    kick();
  }
  function play() { state.playing = true; if (state.i === steps.length - 1 && state.t >= stepDur(steps[state.i])) goTo(0); setCaption(); kick(); }
  function pause() { state.playing = false; setCaption(); }

  function resize() {
    const r = cv.getBoundingClientRect();
    const w = Math.max(240, Math.round(r.width)), hh = Math.max(180, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== w * dpr || cv.height !== hh * dpr) { cv.width = w * dpr; cv.height = hh * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam.w = w; cam.h = hh;
    fitCam(cam, buildBounds(data, build) && (() => { const b = buildBounds(data, build); return { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 + 0.4 }; })(), 0.7, 200, 20);
  }

  function frame(now) {
    raf = 0;
    if (!el.isConnected || !visible) return;
    const dt = Math.min(0.05, (now - (state.last || now)) / 1000) * state.speed;
    state.last = now;
    const s = steps[state.i];
    const dur = stepDur(s);
    state.t += dt;
    if (state.playing && state.t > dur + 1.6) {
      if (state.i < steps.length - 1) { state.i++; state.t = 0; setCaption(); } else { state.playing = false; setCaption(); }
    }
    paint(now);
    if (state.playing || state.t < dur + 0.2 || (s.tap && s.tap.length)) raf = requestAnimationFrame(frame);
  }

  function paint(now) {
    resize();
    const s = steps[state.i];
    const fx = new Map(), linkFx = new Map(), order = [];
    const dur = stepDur(s);
    const addN = (s.add || []).length;
    for (const it of build.items) {
      const at = itemStep.has(it.id) ? itemStep.get(it.id) : -1;
      if (at > state.i) { fx.set(it.id, { alpha: 0 }); continue; }
      if (at === state.i) {
        const k = (s.add || []).indexOf(it.id);
        const t0 = 0.15 + k * 0.42 * (addN > 5 ? 5 / addN : 1);
        const p = clamp((state.t - t0) / 0.7, 0, 1);
        const e = bounce(p);
        fx.set(it.id, { dy: (1 - e) * (2.4 + Math.min(it.y, 3)), alpha: clamp(p * 5, 0, 1), glow: p > 0.95 ? clamp(1 - (state.t - t0 - 0.7) / 1.2, 0, 0.9) : 0 });
      }
      order.push(it);
    }
    for (const l of build.links || []) {
      const at = linkStep.has(l.id) ? linkStep.get(l.id) : -1;
      if (at > state.i) linkFx.set(l.id, 0);
      else if (at === state.i) linkFx.set(l.id, clamp((state.t - 0.9) / 0.8, 0, 1));
    }
    // tap marker
    let tap = null;
    if (s.tap && s.tap.length && state.t < dur + 1.2 && s.kind !== 'test') {
      if (s.kind === 'link') tap = state.t < 0.9 ? s.tap[0] : s.tap[s.tap.length - 1];
      else {
        const k = Math.min(Math.floor(state.t / 0.45), s.tap.length - 1);
        const it = build.items.find((m) => m.id === s.add[k]);
        if (it && state.t < 0.15 + (k + 1) * 0.45 + 0.4) tap = { x: it.x, y: it.y + (fx.get(it.id) ? fx.get(it.id).dy || 0 : 0) };
      }
    }
    drawScene(ctx, cam, build, { data, grid: 0.125, fx, linkFx, order, time: now, tap, labels: true });
  }

  let raf = 0, visible = true;
  function kick() { state.last = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }

  const ro = new ResizeObserver(() => kick());
  ro.observe(cv);
  const off = onSpritesLoaded(kick);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { goTo(state.i + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { goTo(state.i - 1); e.preventDefault(); }
    else if (e.key === ' ' && e.target === el) { state.playing ? pause() : play(); e.preventDefault(); }
  });
  preload(build.items.map((i) => (data.byId.get(i.t) || {}).sprite).filter(Boolean));
  // only run while on screen
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0.05 });
  io.observe(el);
  setCaption();
  state.t = reduced() ? 99 : 0;
  kick();
  return { el, goTo, play, pause, steps, destroy() { cancelAnimationFrame(raf); raf = 0; ro.disconnect(); io.disconnect(); off(); } };
}
