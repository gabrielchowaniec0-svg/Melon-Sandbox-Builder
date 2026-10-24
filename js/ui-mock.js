// A schematic, animated picture of the Melon Sandbox screen (landscape), used by lessons.
// It is drawn from the owner's recordings. It is NOT a screenshot: icons are simplified, positions are approximate.
//
//   import { createUiMock, SCENE_NAMES } from '../ui-mock.js';
//   const m = createUiMock({ scene: 'params', args: { ... }, data, caption: 'optional lead-in' });
//   parent.append(m.el);            // call m.destroy() when the page goes away
//
// A scene is a short script of "beats". Each beat moves the finger to a named element, taps it, and changes the screen.
import { h, esc, ensureCss } from './util.js';

const W = 1000, H = 460, FLOOR = 388, CRATE = 100;
const C = { wall: '#6d7173', wallLine: '#7b8082', floor: '#2b2f31', floorTop: '#44494b', panel: '#2a2f33', panel2: '#363c41', edge: '#15191b', text: '#eef0ec', dim: '#b9bfba', hl: '#f4c430', red: '#e8455f', blue: '#6fc7ff' };
const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// ---------------------------------------------------------------- glyphs (24 x 24 line icons)
const G = {
  swap: '<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z"/>',
  sword: '<path d="M5 19 17 7M14 4h6v6M7 15l2 2M4 20l3-3"/>',
  gear: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  jeep: '<path d="M3 15h18v-4l-3-4H9l-3 4H3z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  back: '<path d="M16 4 6 12l10 8z" fill="currentColor"/>',
  bag: '<path d="M6 8h12l1 12H5zM9 8a3 3 0 0 1 6 0"/>',
  undo: '<path d="M9 5 4 10l5 5"/><path d="M4 10h10a6 6 0 0 1 0 12h-3"/>',
  slowmo: '<circle cx="12" cy="12" r="8"/><path d="M10 8l6 4-6 4z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  move: '<path d="M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  power: '<path d="M12 3v8"/><path d="M7 6a8 8 0 1 0 10 0"/>',
  bolt: '<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  rope: '<path stroke="#c9a064" stroke-width="3" d="M3 17c3-9 6 4 9-4s6-5 9-8"/>',
  cable: '<path stroke="#9aa0a4" stroke-width="3" d="M3 17c3-9 6 4 9-4s6-5 9-8"/>',
  rod: '<path stroke="#b7bcc0" stroke-width="3" d="M5 20 20 4"/>',
  rainbow: '<path d="M3 11h14M13 6l5 5-5 5"/><path stroke="#ff5a5a" d="M3 15h16"/><path stroke="#ffd23f" d="M3 18h16"/><path stroke="#5ac8ff" d="M3 21h16"/>',
  pipe: '<path stroke="#6fc7ff" d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
  chain: '<path stroke="#9aa0a4" stroke-width="3" stroke-dasharray="4 3" d="M3 18 21 6"/>',
  chain2: '<path stroke="#9aa0a4" stroke-width="3" stroke-dasharray="4 3" d="M5 16 19 8"/><path d="M3 18l3-1M21 6l-3 1M3 18l1-3M21 6l-1 3"/>',
  olive: '<path stroke="#8d8f4a" stroke-width="4" d="M12 3v18"/>',
  olive2: '<path stroke="#8d8f4a" stroke-width="4" d="M3 12h18"/>',
  checker: '<path d="M4 4h16v16H4z"/><path fill="currentColor" d="M4 4h8v8H4zM12 12h8v8h-8z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyex: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>',
  bug: '<ellipse cx="12" cy="13" rx="5" ry="6"/><path d="M12 7v12M7 10H3M17 10h4M7 14H3M17 14h4M9 6 7 3M15 6l2-3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  snow: '<path d="M12 2v20M3 7l18 10M21 7 3 17"/>',
  nocol: '<path stroke-dasharray="3 3" d="M4 4h16v16H4z"/><path d="M9 12h6"/>',
  sliders: '<path d="M4 7h16M4 12h16M4 17h16"/><path fill="currentColor" d="M8 5h3v4H8zM14 10h3v4h-3zM6 15h3v4H6z"/>',
  tripod: '<path d="M12 4v6M9 4h6M12 10 6 20M12 10l6 10"/>',
  layers: '<path d="M4 8h11v11H4z"/><path d="M9 4h11v11"/>',
  copy: '<path d="M8 8h12v12H8z"/><path d="M4 16V4h12"/>',
  flip: '<path d="M12 3v18"/><path d="M8 7 3 12l5 5zM16 7l5 5-5 5z"/>',
  shield: '<path d="M12 3 5 6v6c0 5 4 8 7 9 3-1 7-4 7-9V6z"/>',
  resize: '<path d="M5 19 19 5M13 5h6v6M11 19H5v-6"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/>',
  hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10V6.5a1.5 1.5 0 0 1 3 0V13a7 7 0 0 1-7 7c-3 0-4-1-6-4"/><path d="M3 3l18 18"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  close: '<path d="M5 5l14 14M19 5 5 19"/>',
};
function glyph(name, cx, cy, size, color = C.text, sw = 2) {
  const k = size / 24;
  return `<g transform="translate(${cx - 12 * k} ${cy - 12 * k}) scale(${k})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="color:${color}">${G[name] || ''}</g>`;
}

// ---------------------------------------------------------------- catalog of what the screen contains
const TABS = ['heart', 'sword', 'gear', 'jeep'];
const CATEGORIES = {
  Living: { tab: 0, header: 'LIVING', tiles: [['MELON'], ['PUMPKIN', 'pumpkin'], ['CORN'], ['APPLE'], ['CACTUS'], ['TOMATO']] },
  Mechanics: {
    tab: 2, header: 'MECHANICS',
    tiles: [['GYROSCOPE', 'gyroscope'], ['MOTORIZED WHEEL', 'motorized-wheel'], ['IMPULSE ENGINE', 'impulse-engine'], ['ROCKET ENGINE', 'rocket-engine'],
      ['DIRECTIONAL ACCELERATOR', 'directional-accelerator'], ['PISTON', 'piston'], ['BUTTON', 'button'], ['PROPELLER', 'propeller'], ['WING', 'wing']],
  },
};
const MENU1 = [['EDIT PARAMETERS', 'sliders'], ['DEBUG OUTPUTS', 'bug'], ['DELETE', 'trash'], ['FREEZE', 'snow'], ['DISABLE COLLISIONS', 'nocol'], ['ACTIVATE', 'play'], [null, 'power', 'u1'], [null, 'tripod', 'u2'], [null, 'layers', 'u3']];
const MENU2 = [['COPY', 'copy'], ['FLIP', 'flip'], ['DISABLE DAMAGE', 'shield'], ['RESIZE', 'resize'], ['FREEZE ROTATION', 'rotate'], ['INVISIBLE', 'eyex'], ['NON-DRAGGABLE', 'hand']];
const PAL = [
  [['plus', 'plus'], ['rope', 'rope'], ['rod', 'rod'], ['cable', 'cable'], ['rainbow', 'rainbow'], ['pipe', 'pipe']],
  [['bolt', 'electric'], ['chain', 'chain'], ['chain2', 'chain2'], ['olive', 'olive'], ['olive2', 'olive2'], ['checker', 'checker']],
];
const TOOL_PAGE = { rope: 1, rod: 1, cable: 1, wire: 1, pipe: 1, electric: 2, chain: 2 };
const TOOL_GLYPH = { move: 'move', rope: 'rope', rod: 'rod', cable: 'cable', wire: 'rainbow', pipe: 'pipe', electric: 'bolt', chain: 'chain' };
const PAL_ID = { rope: 'rope', rod: 'rod', cable: 'cable', wire: 'rainbow', pipe: 'pipe', electric: 'electric', chain: 'chain' };
const LINK_STYLE = { rope: ['#c9a064', 4, 0.32], cable: ['#9aa0a4', 4, 0.28], rod: ['#b7bcc0', 5, 0], chain: ['#8c9296', 5, 0.04], wire: ['#ff7ad9', 3, 0.1], electric: ['#ffd23f', 3, 0.05], pipe: ['#6fc7ff', 6, 0.1] };

// ---------------------------------------------------------------- drawing
function baseState() {
  return { panel: true, tab: 0, header: 'LIVING', tiles: CATEGORIES.Living.tiles, objs: [], links: [], menu: 0, frozenMenu: false, params: null, kbd: null, prompt: '', palette: 0, tool: 'move',
    dialog: null, power: false, pwPress: false, arcs: [], sparks: [], glow: [], badge: [], hl: [], fresh: [], mark: null, line: null };
}

function render(state, data) {
  const reg = {};
  const out = [];
  const R = (id, x, y) => { reg[id] = [x, y]; };
  const hl = (id) => (state.hl.includes(id) ? ` stroke="${C.hl}" stroke-width="4"` : '');
  const fresh = (id) => (state.fresh.includes(id) ? ' class="uim-pop"' : '');
  const sizeOfObj = (o) => {
    const c = data && data.byId && data.byId.get(o.t);
    return c ? [c.c[0] * CRATE, c.c[1] * CRATE] : [80, 80];
  };
  const objBox = (o) => {
    const [w, hh] = sizeOfObj(o);
    const sy = o.sy || 1;
    return { x: o.x, w, h: hh * sy, top: FLOOR - (o.e || 0) - hh * sy, bottom: FLOOR - (o.e || 0) };
  };
  const anchor = (id, off) => {
    const o = state.objs.find((q) => q.id === id);
    if (!o) return null;
    const b = objBox(o);
    const [dx, dy] = off || [0, 0];
    return [o.x + dx * CRATE, (b.top + b.bottom) / 2 - dy * CRATE];
  };

  // wall + floor
  out.push(`<rect width="${W}" height="${H}" fill="${C.wall}"/>`);
  for (let x = 0; x < W; x += 140) out.push(`<path d="M${x} 0V${FLOOR}" stroke="${C.wallLine}" stroke-width="2" opacity=".6"/>`);
  for (let y = 0; y < FLOOR; y += 140) out.push(`<path d="M0 ${y}H${W}" stroke="${C.wallLine}" stroke-width="2" opacity=".6"/>`);
  out.push(`<rect y="${FLOOR}" width="${W}" height="${H - FLOOR}" fill="${C.floor}"/><rect y="${FLOOR}" width="${W}" height="6" fill="${C.floorTop}"/>`);

  // glow (lit lamps)
  for (const id of state.glow) {
    const o = state.objs.find((q) => q.id === id);
    if (o) { const b = objBox(o); out.push(`<circle cx="${o.x}" cy="${(b.top + b.bottom) / 2}" r="130" fill="#ffd27a" opacity=".28" class="uim-glow"/>`); }
  }

  // objects
  for (const o of state.objs) {
    const b = objBox(o);
    const cls = state.fresh.includes('obj:' + o.id) ? ' class="uim-drop"' : '';
    const sprite = data && data.byId && data.byId.get(o.t) ? data.byId.get(o.t).sprite : null;
    out.push(`<g${cls}>`);
    if (sprite) out.push(`<image href="${esc(sprite)}" x="${o.x - b.w / 2}" y="${b.top}" width="${b.w}" height="${b.h}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`);
    else out.push(`<rect x="${o.x - b.w / 2}" y="${b.top}" width="${b.w}" height="${b.h}" fill="#8a6bd1" stroke="#000" stroke-opacity=".5"/>`);
    if (state.badge.includes(o.id)) out.push(glyph('snow', o.x, b.top - 14, 26, C.blue, 2.4));
    out.push('</g>');
    R('obj:' + o.id, o.x, (b.top + b.bottom) / 2);
    const m = (state.mark && state.mark.startsWith('obj:' + o.id + '@')) ? state.mark : null;
    if (m) { const p = anchor(o.id, m.split('@')[1].split(',').map(Number)); if (p) out.push(`<circle cx="${p[0]}" cy="${p[1]}" r="11" fill="none" stroke="#fff" stroke-width="3"/><circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#fff"/>`); }
    if (state.selected === o.id) out.push(`<rect x="${o.x - b.w / 2 - 4}" y="${b.top - 4}" width="${b.w + 8}" height="${b.h + 8}" fill="none" stroke="${C.blue}" stroke-width="3" stroke-dasharray="8 5"/>`);
  }

  // links
  for (const l of state.links) {
    const a = anchor(l.a, l.pa), b = anchor(l.b, l.pb);
    if (!a || !b) continue;
    const st = LINK_STYLE[l.kind] || LINK_STYLE.rope;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + Math.hypot(a[0] - b[0], a[1] - b[1]) * st[2];
    const fr = state.fresh.includes('link:' + l.id) ? ' class="uim-fade"' : '';
    const dash = l.kind === 'chain' ? ' stroke-dasharray="9 5"' : '';
    out.push(`<path${fr} d="M${a[0]} ${a[1]}Q${mx} ${my} ${b[0]} ${b[1]}" fill="none" stroke="${st[0]}" stroke-width="${st[1]}"${dash} stroke-linecap="round"/>`);
    out.push(`<circle cx="${a[0]}" cy="${a[1]}" r="5" fill="${st[0]}"/><circle cx="${b[0]}" cy="${b[1]}" r="5" fill="${st[0]}"/>`);
  }
  // electricity
  for (const id of state.arcs) {
    const o = state.objs.find((q) => q.id === id);
    if (!o) continue;
    const b = objBox(o);
    for (let k = 0; k < 3; k++) {
      const x0 = o.x, y0 = b.top + 8;
      const dir = -1, len = 90 + k * 28;
      const pts = [[x0, y0]];
      for (let s = 1; s <= 5; s++) pts.push([x0 + dir * (len * s) / 5 + (s % 2 ? 9 : -9), y0 - 14 * k + (s % 2 ? -18 : 12) + s * 6]);
      out.push(`<polyline class="uim-arc" style="animation-delay:${k * 0.12}s" points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#e9d9ff" stroke-width="3.5" stroke-linejoin="round"/>`);
    }
  }
  for (const id of state.sparks) {
    const o = state.objs.find((q) => q.id === id);
    if (!o) continue;
    const b = objBox(o);
    for (let k = 0; k < 6; k++) {
      const cx = o.x + (k % 2 ? 20 : -20), cy = b.top + 30 + k * ((b.bottom - b.top - 50) / 6);
      out.push(`<path class="uim-arc" style="animation-delay:${k * 0.09}s" d="M${cx - 9} ${cy}l6 -7 4 9 6 -8 5 7" fill="none" stroke="#ffe27a" stroke-width="3" stroke-linecap="round"/>`);
    }
  }
  if (state.prompt) {
    out.push(`<g${fresh('prompt')}><text x="${W / 2 + (state.panel ? 90 : 0)}" y="36" text-anchor="middle" font-size="24" font-weight="800" fill="#fff" stroke="#15191b" stroke-width="5" paint-order="stroke" letter-spacing=".5">${esc(state.prompt)}</text></g>`);
  }

  // ---- left panel
  if (state.panel) {
    out.push(`<g${fresh('panel')}><rect x="0" y="0" width="270" height="${H}" fill="${C.panel}"/><path d="M270 0V${H}" stroke="${C.edge}" stroke-width="3"/>`);
    out.push(`<rect x="8" y="8" width="40" height="40" fill="${C.panel2}" stroke="${state.hl.includes('swap') ? C.hl : C.edge}" stroke-width="3"/>${glyph('swap', 28, 28, 24)}`);
    R('swap', 28, 28);
    TABS.forEach((g, i) => {
      const x = 56 + i * 50;
      const on = state.tab === i;
      out.push(`<rect x="${x}" y="8" width="44" height="40" fill="${on ? '#4a525a' : C.panel2}" stroke="${state.hl.includes('tab:' + i) ? C.hl : on ? C.text : C.edge}" stroke-width="${state.hl.includes('tab:' + i) ? 4 : 3}"/>${glyph(g, x + 22, 28, 24)}`);
      R('tab:' + i, x + 22, 28);
    });
    out.push(`<text x="12" y="76" font-size="15" font-weight="800" fill="${C.text}">${esc(state.header)}</text><path d="M236 76l8-8 8 8" fill="none" stroke="${C.text}" stroke-width="3"/>`);
    state.tiles.forEach((t, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 10 + col * 85, y = 88 + row * 94;
      const id = 'tile:' + t[0];
      out.push(`<g><rect x="${x}" y="${y}" width="80" height="88" fill="${C.panel2}" stroke="${state.hl.includes(id) ? C.hl : C.edge}" stroke-width="${state.hl.includes(id) ? 4 : 3}"/>`);
      const c = t[1] && data && data.byId && data.byId.get(t[1]);
      if (c) {
        const sc = Math.min(52 / (c.c[0] * 100), 52 / (c.c[1] * 100), 1);
        const ww = c.c[0] * 100 * sc, hh = c.c[1] * 100 * sc;
        out.push(`<image href="${esc(c.sprite)}" x="${x + 40 - ww / 2}" y="${y + 30 - hh / 2}" width="${ww}" height="${hh}" preserveAspectRatio="none"/>`);
      } else out.push(`<circle cx="${x + 40}" cy="${y + 30}" r="16" fill="none" stroke="${C.dim}" stroke-width="3" stroke-dasharray="4 4"/>`);
      const words = t[0].split(' ');
      const lines = words.length > 1 && t[0].length > 11 ? words : [t[0]];
      lines.slice(0, 2).forEach((ln, k) => out.push(`<text x="${x + 40}" y="${y + 66 + k * 13}" text-anchor="middle" font-size="11" font-weight="700" fill="${C.text}">${esc(ln)}</text>`));
      out.push('</g>');
      R(id, x + 40, y + 34);
    });
    out.push(`<rect x="0" y="${H - 52}" width="270" height="52" fill="${C.panel}"/><path d="M0 ${H - 52}H270" stroke="${C.edge}" stroke-width="3"/>`);
    out.push(`<rect x="8" y="${H - 44}" width="36" height="36" fill="${C.panel2}" stroke="${C.edge}" stroke-width="3"/>${glyph('menu', 26, H - 26, 22)}`);
    out.push(`<rect x="50" y="${H - 44}" width="120" height="36" fill="#5a2a2a" stroke="${state.hl.includes('clearAll') ? C.hl : C.edge}" stroke-width="${state.hl.includes('clearAll') ? 4 : 3}"/><text x="110" y="${H - 21}" text-anchor="middle" font-size="12" font-weight="800" fill="${C.text}">CLEAR EVERYTHING</text>`);
    out.push(`<rect x="176" y="${H - 44}" width="88" height="36" fill="#5a2a2a" stroke="${state.hl.includes('clearLiving') ? C.hl : C.edge}" stroke-width="${state.hl.includes('clearLiving') ? 4 : 3}"/><text x="220" y="${H - 21}" text-anchor="middle" font-size="12" font-weight="800" fill="${C.text}">CLEAR LIVING</text>`);
    R('clearAll', 110, H - 26); R('clearLiving', 220, H - 26);
    out.push('</g>');
    out.push(`<rect x="278" y="8" width="38" height="44" fill="${C.panel}" stroke="${state.hl.includes('collapse') ? C.hl : C.edge}" stroke-width="3"/>${glyph('back', 297, 30, 24)}`);
    R('collapse', 297, 30);
    out.push(`<rect x="278" y="58" width="38" height="38" fill="${C.panel}" stroke="${C.edge}" stroke-width="3"/>${glyph('bag', 297, 78, 22)}<circle cx="312" cy="62" r="6" fill="${C.red}"/>`);
  } else {
    out.push(`<rect x="8" y="8" width="44" height="44" fill="${C.panel}" stroke="${state.hl.includes('reopen') ? C.hl : C.edge}" stroke-width="${state.hl.includes('reopen') ? 4 : 3}"/>${glyph('grid', 30, 30, 26)}`);
    R('reopen', 30, 30);
    out.push(`<rect x="8" y="58" width="38" height="38" fill="${C.panel}" stroke="${C.edge}" stroke-width="3"/>${glyph('bag', 27, 78, 22)}<circle cx="42" cy="62" r="6" fill="${C.red}"/>`);
  }

  // ---- top right
  [['undo', 'undo', 856], ['slowmo', 'slowmo', 902], ['pause', 'pause', 948]].forEach(([id, g, x]) => {
    out.push(`<rect x="${x - 20}" y="8" width="40" height="40" fill="${C.panel}" stroke="${state.hl.includes(id) ? C.hl : C.edge}" stroke-width="${state.hl.includes(id) ? 4 : 3}"/>${glyph(g, x, 28, 24)}`);
    R(id, x, 28);
  });
  out.push(`<rect x="882" y="52" width="86" height="5" fill="${C.text}" opacity=".8"/>`);

  // ---- bottom right tool button + palette
  const tg = TOOL_GLYPH[state.tool] || 'move';
  out.push(`<rect x="940" y="${H - 58}" width="52" height="50" fill="${C.panel}" stroke="${state.hl.includes('tool') ? C.hl : C.edge}" stroke-width="${state.hl.includes('tool') ? 4 : 3}"/>${glyph(tg, 966, H - 33, 30)}`);
  R('tool', 966, H - 33);
  if (state.palette) {
    const px = 600, py = H - 168, pw = 330, ph = 152;
    out.push(`<g${fresh('palette')}><rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${C.panel}" stroke="${C.edge}" stroke-width="3"/>`);
    out.push(`<rect x="${px + 8}" y="${py + 8}" width="52" height="${ph - 16}" fill="${C.panel2}" stroke="${C.edge}" stroke-width="3"/>${glyph('move', px + 34, py + 36, 24)}${glyph('rope', px + 34, py + 78, 24, '#6ee59a')}${glyph('rotate', px + 34, py + 116, 22)}`);
    PAL[state.palette - 1].forEach(([g, id], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = px + 68 + col * 84, y = py + 8 + row * 70;
      const pid = 'pal:' + id;
      out.push(`<rect x="${x}" y="${y}" width="76" height="62" fill="${C.panel2}" stroke="${state.hl.includes(pid) ? C.hl : C.edge}" stroke-width="${state.hl.includes(pid) ? 4 : 3}"/>${glyph(g, x + 38, y + 31, 34)}`);
      R(pid, x + 38, y + 31);
    });
    out.push('</g>');
  }

  // ---- power buttons
  if (state.power) {
    [['left', state.panel ? 336 : 70], ['right', 880]].forEach(([side, x]) => {
      const hot = state.pwPress && side === 'left';
      out.push(`<circle cx="${x}" cy="${H - 34}" r="${hot ? 30 : 26}" fill="${hot ? '#7a1f2d' : C.panel}" stroke="${state.hl.includes('pw:' + side) || hot ? C.hl : C.text}" stroke-width="4"/>${glyph('power', x, H - 34, 26, hot ? C.hl : C.text, 2.6)}`);
      R('pw:' + side, x, H - 34);
    });
  }

  // ---- context menu
  if (state.menu) {
    const x0 = 650, y0 = 56, cw = 100, ch = 74;
    const cells = state.menu === 1 ? MENU1 : MENU2;
    out.push(`<g${fresh('menu')}><rect x="${x0}" y="${y0}" width="${cw * 3 + 16}" height="${ch * 3 + 16}" fill="${C.panel}" stroke="${C.text}" stroke-width="3"/>`);
    cells.forEach(([label, g, uid], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = x0 + 8 + col * cw, y = y0 + 8 + row * ch;
      const lab = label === 'FREEZE' && state.frozenMenu ? 'UNFREEZE' : label;
      const id = 'menu:' + (label || uid);
      const on = state.hl.includes(id);
      out.push(`<rect x="${x + 2}" y="${y + 2}" width="${cw - 4}" height="${ch - 4}" fill="${C.panel2}" stroke="${on ? C.hl : C.edge}" stroke-width="${on ? 4 : 3}"/>${glyph(g, x + cw / 2, y + 25, 26)}`);
      if (lab) {
        const words = lab.split(' ');
        const lines = words.length === 1 ? [lab] : words.length === 2 ? words : [words[0], words.slice(1).join(' ')];
        lines.forEach((ln, k) => out.push(`<text x="${x + cw / 2}" y="${y + 50 + k * 13}" text-anchor="middle" font-size="${ln.length > 11 ? 10.5 : 11.5}" font-weight="800" fill="${C.text}">${esc(ln)}</text>`));
      } else out.push(`<text x="${x + cw / 2}" y="${y + 58}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${C.dim}">no label</text>`);
      R(id, x + cw / 2, y + ch / 2);
    });
    out.push(`<circle cx="${x0 + cw * 3 + 8}" cy="${y0 - 2}" r="15" fill="${C.panel}" stroke="${C.text}" stroke-width="3"/>${glyph('close', x0 + cw * 3 + 8, y0 - 2, 14)}</g>`);
    R('menuX', x0 + cw * 3 + 8, y0 - 2);
    if (state.menu === 1) R('menu:page2', x0 + cw * 3 - 20, y0 + ch * 3 + 4);
  }

  // ---- parameter panel
  if (state.params) {
    const rows = state.params.rows;
    const x0 = 640, y0 = 56, pw = 330, rh = 46;
    const ph = rows.length * rh + 72;
    const sel = state.objs.find((q) => q.id === state.params.target);
    if (sel) { const b = objBox(sel); out.push(`<path d="M${x0} ${y0 + 30}L${sel.x + b.w / 2} ${(b.top + b.bottom) / 2}" stroke="#fff" stroke-width="2.5" fill="none"/>`); }
    out.push(`<g${fresh('params')}><rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" fill="${C.panel}" stroke="${C.text}" stroke-width="3"/>`);
    rows.forEach((r, i) => {
      const y = y0 + 12 + i * rh;
      out.push(`<text x="${x0 + 16}" y="${y + 28}" font-size="15" font-weight="800" fill="${C.text}">${esc(r.l)}</text>`);
      const id = 'param:' + r.l;
      const on = state.hl.includes(id);
      if (typeof r.v === 'boolean') {
        out.push(`<rect x="${x0 + pw - 64}" y="${y + 6}" width="38" height="38" fill="${C.ink || '#15191b'}" stroke="${on ? C.hl : C.text}" stroke-width="${on ? 4 : 3}"/>`);
        if (r.v) out.push(`<path d="M${x0 + pw - 57} ${y + 26}l8 9 14-17" fill="none" stroke="${C.hl}" stroke-width="5" stroke-linecap="square"/>`);
        R(id, x0 + pw - 45, y + 25);
      } else {
        out.push(`<rect x="${x0 + pw - 124}" y="${y + 6}" width="100" height="38" fill="#15191b" stroke="${on ? C.hl : C.text}" stroke-width="${on ? 4 : 3}"/><text x="${x0 + pw - 74}" y="${y + 32}" text-anchor="middle" font-size="17" font-weight="800" fill="${C.text}">${esc(String(r.v))}</text>`);
        R(id, x0 + pw - 74, y + 25);
      }
    });
    const by = y0 + ph - 56;
    out.push(`<rect x="${x0 + pw / 2 - 60}" y="${by}" width="120" height="42" fill="${C.panel2}" stroke="${state.hl.includes('paramClose') ? C.hl : C.text}" stroke-width="${state.hl.includes('paramClose') ? 4 : 3}"/><text x="${x0 + pw / 2}" y="${by + 27}" text-anchor="middle" font-size="16" font-weight="800" fill="${C.text}">CLOSE</text></g>`);
    R('paramClose', x0 + pw / 2, by + 21);
  }

  // ---- wire dialog
  if (state.dialog) {
    const d = state.dialog, x0 = 290, y0 = 40, dw = 420, dh = 318;
    out.push(`<g${fresh('dialog')}><rect x="${x0}" y="${y0}" width="${dw}" height="${dh}" fill="${C.panel}" stroke="${C.text}" stroke-width="3"/>`);
    out.push(`<text x="${x0 + dw / 2}" y="${y0 + 30}" text-anchor="middle" font-size="18" font-weight="800" fill="${C.text}">SELECT INPUT/OUTPUT</text>`);
    out.push(`<text x="${x0 + 110}" y="${y0 + 64}" text-anchor="middle" font-size="14" font-weight="800" fill="${C.dim}">OUTPUT</text><text x="${x0 + 310}" y="${y0 + 64}" text-anchor="middle" font-size="14" font-weight="800" fill="${C.dim}">INPUT</text>`);
    const btn = (id, label, x, y, w, sel, bg) => {
      const on = state.hl.includes(id);
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="44" fill="${sel ? '#2f6b3f' : bg || C.panel2}" stroke="${on ? C.hl : sel ? '#8fe0a8' : C.edge}" stroke-width="${on ? 4 : 3}"/><text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" font-size="15" font-weight="800" fill="${C.text}">${esc(label)}</text>`);
      R(id, x + w / 2, y + 22);
    };
    btn('dlg:out:ACTIVATION', 'ACTIVATION', x0 + 20, y0 + 78, 180, d.out === 'ACTIVATION');
    btn('dlg:out:ANGLE', 'ANGLE', x0 + 20, y0 + 130, 180, d.out === 'ANGLE');
    btn('dlg:in:ACTIVATION', 'ACTIVATION', x0 + 220, y0 + 78, 180, d.inn === 'ACTIVATION');
    btn('dlg:in:COLOR', 'COLOR', x0 + 220, y0 + 130, 180, d.inn === 'COLOR');
    const pair = d.out && d.inn ? `${d.out} / ${d.inn}` : '';
    out.push(`<text x="${x0 + 20}" y="${y0 + 232}" font-size="15" font-weight="800" fill="${C.hl}">${esc(pair)}</text>${glyph('eyex', x0 + dw - 40, y0 + 226, 26)}`);
    btn('dlg:APPLY', 'APPLY', x0 + 20, y0 + 254, 180, false, '#2f6b3f');
    btn('dlg:CLOSE', 'CLOSE', x0 + 220, y0 + 254, 180, false);
    out.push('</g>');
  }

  // ---- keyboard
  if (state.kbd) {
    out.push(`<g${fresh('kbd')}><rect x="0" y="262" width="${W}" height="${H - 262}" fill="#20252a" stroke="${C.edge}" stroke-width="3"/>`);
    out.push(`<rect x="330" y="272" width="340" height="40" fill="#15191b" stroke="${C.text}" stroke-width="2"/><text x="346" y="300" font-size="20" font-weight="800" fill="${C.text}">${esc(state.kbd)}<tspan fill="${C.hl}">|</tspan></text>`);
    const keys = '1234567890';
    for (let i = 0; i < 10; i++) out.push(`<rect x="${210 + i * 56}" y="324" width="50" height="46" fill="#3a4147" stroke="${C.edge}" stroke-width="2"/><text x="${235 + i * 56}" y="355" text-anchor="middle" font-size="20" font-weight="700" fill="${C.text}">${keys[i]}</text>`);
    out.push(`<rect x="590" y="380" width="180" height="56" fill="#3f8f5b" stroke="${state.hl.includes('key:OK') ? C.hl : C.edge}" stroke-width="${state.hl.includes('key:OK') ? 4 : 2}"/><text x="680" y="416" text-anchor="middle" font-size="22" font-weight="800" fill="#fff">OK</text></g>`);
    R('key:OK', 680, 408);
  }
  return { svg: out.join(''), reg, anchor };
}

// ---------------------------------------------------------------- scenes
const o = (id, t, x, extra = {}) => ({ id, t, x, e: 0, ...extra });
const cap = (s) => s;

export const SCENES = {
  spawn() {
    const mech = CATEGORIES.Mechanics;
    return {
      title: 'Spawning an item from the left panel',
      base: {},
      beats: [
        { hl: ['tab:0', 'tab:1', 'tab:2', 'tab:3'], caption: 'The left panel holds the items. The row of icons at the top switches category. The game shows icons only, no names.', d: 3800 },
        { at: 'tab:2', tap: true, set: { tab: mech.tab, header: mech.header, tiles: mech.tiles, hl: ['tab:2'] }, caption: 'Tap a category icon. The header and the item tiles change (here: Mechanics).' },
        { at: 'tile:PISTON', tap: true, set: { hl: ['tile:PISTON'] }, caption: 'Tap an item tile once.' },
        { at: 'obj:p', set: { objs: [o('p', 'piston', 600)], fresh: ['obj:p'], hl: [] }, caption: 'The item appears in the field and falls under gravity until it lands.' },
        { hl: ['clearAll', 'clearLiving'], caption: 'At the bottom of the panel: CLEAR EVERYTHING removes all items, CLEAR LIVING removes ragdolls.', d: 3600 },
        { at: 'collapse', tap: true, set: { panel: false, hl: [] }, caption: 'Tap the left arrow to hide the panel when you need more room.' },
        { at: 'reopen', tap: true, set: { panel: true, fresh: ['panel'] }, caption: 'A grid icon takes its place at the top-left. Tap it to bring the panel back.' },
      ],
    };
  },

  menu(args = {}) {
    const part = args.part || 1;
    const item = args.item || 'piston';
    const objs = [o('x', item, 440, { })];
    const hover = (label, caption) => ({ at: 'menu:' + label, set: { hl: ['menu:' + label] }, caption, d: 3300 });
    if (part === 2) {
      return {
        title: 'Context menu, page 2', base: { panel: false, objs },
        beats: [
          { at: 'obj:x', tap: true, set: { menu: 1, selected: 'x' }, caption: 'Tap an object to open its menu. Page 1 is shown first.' },
          { at: 'menu:page2', set: { menu: 2, fresh: ['menu'], hl: [] }, caption: 'Page 2 has seven buttons. (How the game switches pages was not clear in the recordings. Look for an arrow or try swiping.)', d: 4200 },
          hover('COPY', 'COPY. The name says it all, but the result was not shown (inferred: makes a copy).'),
          hover('FLIP', 'FLIP. Mirrors the object left to right (inferred). The step guides on this site use it.'),
          hover('RESIZE', 'RESIZE. Used on resizable parts. The resize controls were never shown.'),
          { at: 'menu:NON-DRAGGABLE', set: { hl: ['menu:DISABLE DAMAGE', 'menu:FREEZE ROTATION', 'menu:INVISIBLE', 'menu:NON-DRAGGABLE'] }, caption: 'DISABLE DAMAGE, FREEZE ROTATION, INVISIBLE and NON-DRAGGABLE: names only. We did not see what they do.', d: 4200 },
        ],
      };
    }
    return {
      title: 'Context menu, page 1', base: { panel: false, objs },
      beats: [
        { at: 'obj:x', tap: true, set: { menu: 1, selected: 'x', fresh: ['menu'] }, caption: 'Tap an object in the field. A 3 by 3 menu opens. The X at its corner closes it.' },
        hover('EDIT PARAMETERS', 'EDIT PARAMETERS opens the settings panel for this object (next lesson).'),
        hover('DEBUG OUTPUTS', 'DEBUG OUTPUTS opens a small debug window. What it shows was never captured.'),
        hover('DELETE', 'DELETE removes the object.'),
        hover('FREEZE', 'FREEZE holds the object in place. Once frozen, the button reads UNFREEZE.'),
        hover('DISABLE COLLISIONS', 'DISABLE COLLISIONS: name only, the effect was not shown.'),
        hover('ACTIVATE', 'ACTIVATE triggers the object, like its power button (inferred).'),
        { at: 'menu:u2', set: { hl: ['menu:u1', 'menu:u2', 'menu:u3'] }, caption: 'Three icons have no label on screen: a power symbol, a tripod symbol and overlapping squares. We do not know what they do. Leave them out of plans until we do.', d: 4800 },
      ],
    };
  },

  params(args = {}) {
    const rows = (args.rows || [['FORCE', '600']]).map((r) => ({ l: r[0], v: r[1] }));
    const first = rows.find((r) => typeof r.v !== 'boolean') || rows[0];
    const bool = rows.find((r) => typeof r.v === 'boolean');
    const beats = [
      { at: 'obj:x', tap: true, set: { menu: 1, selected: 'x', fresh: ['menu'] }, caption: 'Tap the object to open its menu.' },
      { at: 'menu:EDIT PARAMETERS', tap: true, set: { menu: 0, hl: [], params: { rows, target: 'x' }, fresh: ['params'] }, caption: 'Tap EDIT PARAMETERS. A panel opens beside the object, joined to it by a thin white line.' },
    ];
    if (typeof first.v !== 'boolean') {
      beats.push({ at: 'param:' + first.l, tap: true, set: { hl: ['param:' + first.l], kbd: String(first.v), fresh: ['kbd'] }, caption: `Tap a number box. The Android keyboard opens. Type the number (here ${first.l} ${first.v}).` });
      beats.push({ at: 'key:OK', tap: true, set: { kbd: null, hl: [] }, caption: 'Tap OK on the keyboard to confirm.' });
    }
    if (bool) {
      beats.push({ at: 'param:' + bool.l, tap: true, set: (s) => ({ params: { ...s.params, rows: s.params.rows.map((r) => (r.l === bool.l ? { ...r, v: !r.v } : r)) }, hl: ['param:' + bool.l] }), caption: `Yes/no settings are checkboxes. Tap ${bool.l} to tick or untick it.` });
    }
    beats.push({ at: 'paramClose', tap: true, set: { params: null, hl: [], selected: null }, caption: 'Tap CLOSE when you are done.' });
    return { title: `Editing parameters${args.name ? ' of ' + args.name : ''}`, base: { panel: false, objs: [o('x', args.item || 'rocket-engine', 440)] }, beats };
  },

  link(args = {}) {
    const kind = args.kind || 'rope';
    const page = TOOL_PAGE[kind] || 1;
    const names = { rope: 'tan twisted rope', rod: 'thin grey rod', cable: 'grey twisted cable', chain: 'grey chain', wire: 'arrow with a rainbow line', electric: 'lightning bolt over a wooden bar', pipe: 'light-blue pipe with a droplet' };
    const A = args.a || { t: 'crate', x: 380 }, B = args.b || { t: 'crate', x: 700 };
    const pa = args.pa || [0.3, 0.3], pb = args.pb || [-0.3, 0.3];
    const link = { id: 'l1', kind, a: 'a', b: 'b', pa, pb };
    return {
      title: `Attaching a ${kind}`,
      base: { panel: false, objs: [o('a', A.t, A.x), o('b', B.t, B.x)] },
      beats: [
        { at: 'tool', tap: true, set: { palette: page, fresh: ['palette'], hl: [] }, caption: 'Tap the button at the bottom-right. The tool picker opens. It scrolls sideways to more pages.' },
        { at: 'pal:' + PAL_ID[kind], tap: true, set: { palette: 0, tool: kind, hl: [] }, caption: `Pick the tool: the ${names[kind]}. The picker closes and the button shows your tool.` },
        { at: `obj:a@${pa.join(',')}`, tap: true, set: { mark: `obj:a@${pa.join(',')}`, prompt: 'SELECT THE SECOND ROPE POINT', fresh: ['prompt'] }, caption: 'Tap point A on the first object. A ring marks it and the prompt SELECT THE SECOND ROPE POINT appears.' },
        { at: `obj:b@${pb.join(',')}`, tap: true, set: { mark: null, prompt: '', links: [link], fresh: ['link:l1'] }, caption: 'Tap point B on the second object. The link is drawn between the two points you tapped.' },
        ...(args.after ? args.after : []),
      ],
    };
  },

  wire() {
    const pa = [0, 0.1], pb = [0, 0.1];
    const link = { id: 'w1', kind: 'wire', a: 'a', b: 'b', pa: [0.05, 0.05], pb: [0, 0.2] };
    return {
      title: 'Connecting a wire',
      base: { panel: false, objs: [o('a', 'button', 400), o('b', 'edison-lamp', 760)] },
      beats: [
        { at: 'tool', tap: true, set: { palette: 1, fresh: ['palette'] }, caption: 'Open the tool picker at the bottom-right.' },
        { at: 'pal:rainbow', tap: true, set: { palette: 0, tool: 'wire', hl: [] }, caption: 'Pick the arrow with the rainbow line. This is the wire tool.' },
        { at: 'obj:a@0.05,0.05', tap: true, set: { mark: 'obj:a@0.05,0.05', prompt: 'SELECT THE SECOND ROPE POINT', fresh: ['prompt'] }, caption: 'Tap the first object (the one that sends the signal).' },
        { at: 'obj:b@0,0.2', tap: true, set: { mark: null, prompt: '', dialog: { out: null, inn: null }, fresh: ['dialog'] }, caption: 'Tap the second object. The SELECT INPUT/OUTPUT window opens.' },
        { at: 'dlg:out:ACTIVATION', tap: true, set: (s) => ({ dialog: { ...s.dialog, out: 'ACTIVATION' }, hl: [] }), caption: 'Left column, OUTPUT: what the first object sends. Here ACTIVATION.' },
        { at: 'dlg:in:ACTIVATION', tap: true, set: (s) => ({ dialog: { ...s.dialog, inn: 'ACTIVATION' } }), caption: 'Right column, INPUT: what the second object receives. Here ACTIVATION. (COLOR was also seen, for lamps.)' },
        { at: 'dlg:APPLY', tap: true, set: { dialog: null, links: [link], fresh: ['link:w1'], hl: [] }, caption: 'Tap APPLY. A coloured wire is drawn between the objects. CLOSE leaves without making a wire.' },
        { at: 'obj:a', set: { glow: ['b'] }, caption: 'In the recordings, triggering the first object lit the second one. The wire is a real line that swings with the objects.', d: 3600 },
      ],
    };
  },

  electric() {
    const link = { id: 'e1', kind: 'electric', a: 'g', b: 't', pa: [0.4, 0.3], pb: [0, -0.7] };
    return {
      title: 'Generator, electric wire and Tesla Coil',
      base: { panel: false, objs: [o('g', 'generator', 360), o('t', 'tesla-coil', 760)] },
      beats: [
        { at: 'tool', tap: true, set: { palette: 2, fresh: ['palette'] }, caption: 'Open the tool picker and scroll to page 2.' },
        { at: 'pal:electric', tap: true, set: { palette: 0, tool: 'electric', hl: [] }, caption: 'Pick the lightning bolt over a wooden bar. This is the electric wire (the name is inferred from what it did).' },
        { at: 'obj:g@0.4,0.3', tap: true, set: { mark: 'obj:g@0.4,0.3', prompt: 'SELECT THE SECOND ROPE POINT', fresh: ['prompt'] }, caption: 'Tap the Generator.' },
        { at: 'obj:t@0,-0.7', tap: true, set: { mark: null, prompt: '', links: [link], fresh: ['link:e1'], power: true }, caption: 'Tap the Tesla Coil. The wire is drawn and power buttons appear at the bottom corners.' },
        { at: 'pw:left', tap: true, set: { pwPress: true, arcs: ['t'], hl: [] }, caption: 'Press a power button. In the recordings the Tesla Coil then shot arcs, and a wired ragdoll showed sparks.', d: 3800 },
      ],
    };
  },

  power() {
    return {
      title: 'Power buttons',
      base: { panel: false, objs: [o('p', 'piston', 560), o('c', 'crate', 560, { e: 94 })] },
      beats: [
        { hl: ['pw:left', 'pw:right'], set: { power: true }, caption: 'When an activatable object is in the field, two power buttons appear: one at the bottom-left, one at the bottom-right.', d: 3600 },
        { at: 'pw:left', tap: true, set: { pwPress: true, hl: [], objs: [o('p', 'piston', 560, { sy: 1.7 }), o('c', 'crate', 560, { e: 160 })] }, caption: 'Tap a power button. The Piston rod extends and lifts the crate (seen in the recordings, SPEED 1).' },
        { at: 'pw:left', set: { pwPress: false, objs: [o('p', 'piston', 560), o('c', 'crate', 560, { e: 94 })] }, caption: 'The rod retracts again after it fires.', d: 3000 },
        { at: 'obj:p', tap: true, set: { menu: 1, selected: 'p', fresh: ['menu'], hl: ['menu:ACTIVATE'] }, caption: 'You can also tap the object and choose ACTIVATE in its menu (inferred to do the same thing).', d: 3600 },
      ],
    };
  },

  hud() {
    return {
      title: 'Top-right buttons',
      base: { panel: false, objs: [o('x', 'crate', 520)] },
      beats: [
        { at: 'undo', set: { hl: ['undo'] }, caption: 'Undo: the curved arrow at the top-right.', d: 2800 },
        { at: 'slowmo', set: { hl: ['slowmo'] }, caption: 'Slow motion: the dial with a small play symbol. Handy for watching fast things.', d: 3000 },
        { at: 'pause', set: { hl: ['pause'] }, caption: 'Pause: two bars. While paused the symbol turns into a play triangle. A white bar sits under these buttons; what it measures was not shown.', d: 4200 },
      ],
    };
  },

  freeze() {
    return {
      title: 'Freezing an object',
      base: { panel: false, objs: [o('x', 'crate', 440, { e: 110 })] },
      beats: [
        { at: 'obj:x', tap: true, set: { menu: 1, selected: 'x', fresh: ['menu'] }, caption: 'Tap the object to open its menu.' },
        { at: 'menu:FREEZE', tap: true, set: { menu: 0, selected: null, badge: ['x'], hl: [] }, caption: 'Tap FREEZE. The crate now stays where it is, even though nothing is under it.' },
        { at: 'obj:x', tap: true, set: { menu: 1, selected: 'x', frozenMenu: true, fresh: ['menu'], hl: ['menu:FREEZE'] }, caption: 'Open the menu again. The button now reads UNFREEZE. Tap it to let the object fall.' },
      ],
    };
  },
};
export const SCENE_NAMES = Object.keys(SCENES);

// ---------------------------------------------------------------- the component
/**
 * createUiMock({ scene, args, data, caption, autoplay, label }) -> { el, goTo, play, pause, destroy, beats }
 * `data` (from ctx.data) lets the mock draw item sprites at true relative size. `caption` is an optional lead-in line.
 */
export function createUiMock({ scene = 'spawn', args = {}, data = null, caption = '', autoplay = true, label = true } = {}) {
  ensureCss('css/ui-mock.css');
  const def = (SCENES[scene] || SCENES.spawn)(args);
  const all = def.beats;
  const from = args.from || 0;
  const beats = all.slice(from, args.to == null ? all.length : args.to);
  const rm = reduced();
  let idx = rm ? beats.length - 1 : 0;
  let playing = false, userPaused = false;
  let timer = 0, tapTimer = 0, destroyed = false, narrow = false, raf = 0;
  let cur = { x: 0, y: 0, w: W, h: H };

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'uim-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Schematic of the Melon Sandbox screen: ${def.title}. The captions below describe each step.`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const scene$ = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const fingerG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  fingerG.setAttribute('class', 'uim-finger');
  fingerG.innerHTML = '<circle r="30" fill="#fff" opacity=".18"/><circle r="17" fill="#fff" opacity=".55" stroke="#15191b" stroke-width="3"/><g class="uim-ripple"></g>';
  const rippleG = fingerG.querySelector('.uim-ripple');
  svg.append(scene$, fingerG);

  const capEl = h('p.uim-caption', { 'aria-live': 'polite' });
  const lead = caption ? h('p.uim-lead', caption) : null;
  const count = h('span.uim-count');
  const btnPlay = h('button.btn.icon', { type: 'button', 'aria-label': 'Play or pause the animation', onclick: () => { if (playing) { userPaused = true; pause(); } else { userPaused = false; play(); } } });
  const btnPrev = h('button.btn.icon', { type: 'button', 'aria-label': 'Previous beat', onclick: () => { pause(); goTo(idx - 1); } }, '‹');
  const btnNext = h('button.btn.icon', { type: 'button', 'aria-label': 'Next beat', onclick: () => { pause(); goTo(idx + 1); } }, '›');
  const btnAgain = h('button.btn.icon', { type: 'button', 'aria-label': 'Replay from the start', onclick: () => { goTo(0); play(); } }, '↺');
  const list = h('details.uim-list', { open: rm }, h('summary', 'Read the steps as text'), h('ol', beats.map((b) => h('li', b.caption))));
  const tag = label ? h('div.uim-tag', h('span.badge.info', 'Schematic, not a screenshot'), h('span.uim-title', def.title)) : null;
  const el = h('figure.uim', { 'data-scene': scene },
    tag,
    h('div.uim-frame', svg),
    h('div.uim-bar', btnAgain, btnPrev, btnPlay, btnNext, count),
    lead, capEl, list);

  const foldAbs = (upto) => {
    let s = { ...baseState(), ...def.base };
    for (let i = 0; i <= upto; i++) {
      const b = all[i];
      s = { ...s, fresh: [] };
      if (b.hl) s.hl = b.hl;
      const set = typeof b.set === 'function' ? b.set(s) : b.set;
      if (set) s = { ...s, ...set };
    }
    return s;
  };
  const fold = (i) => foldAbs(from + i);
  const before = (i) => ({ ...foldAbs(from + i - 1), fresh: [] });

  // The region of the 1000 x 460 screen worth showing on a narrow phone, given what is open right now.
  function viewFor(state, target) {
    if (!narrow) return { x: 0, y: 0, w: W, h: H };
    const regs = [];
    if (state.dialog) regs.push([290, 40, 420, 318]);
    else if (state.menu) regs.push([650, 56, 316, 238]);
    else if (state.params) regs.push([640, 56, 330, Math.min(state.params.rows.length, 5) * 46 + 72]);
    else if (state.kbd) regs.push([200, 262, 600, 190]);
    else if (state.palette) regs.push([596, 292, 400, 168]);
    else if (state.panel && (!target || target[0] < 330)) regs.push(target && target[1] > 330 ? [0, 160, 330, 300] : [0, 0, 330, 300]);
    else if (state.objs.length >= 2 && (!target || target[0] > 330)) { const xs = state.objs.map((q) => q.x); regs.push([Math.min(...xs) - 90, FLOOR - 230, Math.max(...xs) - Math.min(...xs) + 180, 270]); }
    else if (target) regs.push([target[0] - 250, target[1] - 190, 500, 330]);
    else regs.push([300, 100, 400, 280]);
    if (state.prompt) regs.push([200, 14, 600, 40]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y, w, hh] of regs) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + hh); }
    let w = x1 - x0 + 24, hh = y1 - y0 + 24;
    if (w / hh > 1.5) hh = w / 1.5; else w = hh * 1.5;
    w = Math.min(w, W); hh = w / 1.5;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { x: Math.max(0, Math.min(W - w, cx - w / 2)), y: Math.max(0, Math.min(H - hh, cy - hh / 2)), w, h: hh };
  }
  function setView(v, instant) {
    cancelAnimationFrame(raf);
    const from = { ...cur };
    if (instant || reduced()) { cur = v; svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 450), e = 1 - Math.pow(1 - k, 3);
      cur = { x: from.x + (v.x - from.x) * e, y: from.y + (v.y - from.y) * e, w: from.w + (v.w - from.w) * e, h: from.h + (v.h - from.h) * e };
      svg.setAttribute('viewBox', `${cur.x} ${cur.y} ${cur.w} ${cur.h}`);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  let lastFinger = null;
  function show(i, animate) {
    const b = beats[i];
    const prev = before(i);
    const next = fold(i);
    const rNext = render(next, data), rPrev = render(prev, data);
    const tgtId = b.at;
    let tgt = null;
    if (tgtId) {
      tgt = rNext.reg[tgtId] || rPrev.reg[tgtId] || null;
      if (!tgt && tgtId.includes('@')) {
        const [oid, offs] = tgtId.slice(4).split('@');
        tgt = rNext.anchor(oid, offs.split(',').map(Number)) || rPrev.anchor(oid, offs.split(',').map(Number));
      }
    }
    capEl.textContent = b.caption;
    count.textContent = `${i + 1} / ${beats.length}`;
    btnPrev.disabled = i === 0;
    btnNext.disabled = i === beats.length - 1;
    btnPlay.textContent = playing ? '❚❚' : '▶';
    clearTimeout(tapTimer);
    const paint = (r) => { scene$.innerHTML = r.svg; };
    if (tgt) {
      fingerG.style.opacity = '1';
      fingerG.style.transform = `translate(${tgt[0]}px, ${tgt[1]}px)`;
      lastFinger = tgt;
    } else if (!lastFinger) fingerG.style.opacity = '0';
    if (animate && tgt) {
      paint(rPrev);
      setView(viewFor(prev, tgt));
      tapTimer = setTimeout(() => {
        paint(rNext);
        setView(viewFor(next, tgt));
        if (b.tap) { rippleG.innerHTML = ''; void rippleG.getBoundingClientRect(); rippleG.innerHTML = '<circle r="14" class="uim-ring"/>'; }
      }, 800);
    } else {
      paint(rNext);
      setView(viewFor(next, tgt), !animate);
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (!playing || destroyed) return;
    const b = beats[idx];
    const last = idx === beats.length - 1;
    timer = setTimeout(() => {
      if (!el.isConnected) { schedule(); return; }
      if (last) { idx = 0; lastFinger = null; fingerG.style.opacity = '0'; show(0, true); } else { idx++; show(idx, true); }
      schedule();
    }, (b.d || 3300) + (last ? 1800 : 0));
  }
  function goTo(i) {
    idx = Math.max(0, Math.min(beats.length - 1, i));
    // jumping lands on the finished state of that beat
    show(idx, false);
    if (playing) schedule();
  }
  function play() { playing = true; btnPlay.textContent = '❚❚'; schedule(); }
  function pause() { playing = false; clearTimeout(timer); btnPlay.textContent = '▶'; }

  const ro = new ResizeObserver(() => {
    const n = el.clientWidth < 640;
    if (n !== narrow) { narrow = n; show(idx, false); }
  });
  ro.observe(el);
  narrow = el.clientWidth ? el.clientWidth < 640 : window.innerWidth < 640;
  show(idx, false);
  const io = new IntersectionObserver((es) => {
    if (destroyed) return;
    if (es[0].isIntersecting) { if (autoplay && !reduced() && !playing && !userPaused) play(); } else if (playing) pause();
  }, { threshold: 0.2 });
  io.observe(el);
  return {
    el, beats, goTo, play, pause,
    destroy() { destroyed = true; clearTimeout(timer); clearTimeout(tapTimer); cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); },
  };
}
