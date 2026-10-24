// Logic lab: a tiny playground that evaluates standard math and logic for the chip gate names.
// It does NOT copy the game's exact behaviour. Gate meanings are standard-logic assumptions.
import { h, store } from '../util.js';
import { field, note, copyBtn } from './kit.js';

const T = (v) => v !== 0 && !Number.isNaN(v);
const B = (v) => (v ? 1 : 0);
const FN = {
  and: [2, (a, b) => B(T(a) && T(b))], or: [2, (a, b) => B(T(a) || T(b))], not: [1, (a) => B(!T(a))],
  nand: [2, (a, b) => B(!(T(a) && T(b)))], nor: [2, (a, b) => B(!(T(a) || T(b)))],
  xor: [2, (a, b) => B(T(a) !== T(b))], xnor: [2, (a, b) => B(T(a) === T(b))],
  select: [3, (c, a, b) => (T(c) ? a : b)], branch: [3, (c, a, b) => (T(c) ? a : b)],
  eq: [2, (a, b) => B(a === b)], neq: [2, (a, b) => B(a !== b)], gt: [2, (a, b) => B(a > b)], gte: [2, (a, b) => B(a >= b)],
  lt: [2, (a, b) => B(a < b)], lte: [2, (a, b) => B(a <= b)],
  inrange: [3, (x, lo, hi) => B(x >= lo && x <= hi)], inrange_ex: [3, (x, lo, hi) => B(x > lo && x < hi)],
  add: [2, (a, b) => a + b], sub: [2, (a, b) => a - b], mul: [2, (a, b) => a * b], div: [2, (a, b) => a / b],
  rem: [2, (a, b) => a % b], pow: [2, (a, b) => a ** b], min: [2, Math.min], max: [2, Math.max], avg: [2, (a, b) => (a + b) / 2],
  abs: [1, Math.abs], neg: [1, (a) => -a], sqr: [1, (a) => a * a], sqrt: [1, Math.sqrt], floor: [1, Math.floor], ceil: [1, Math.ceil],
  round: [1, Math.round], sign: [1, Math.sign], clamp: [3, (x, lo, hi) => Math.min(hi, Math.max(lo, x))], clamp01: [1, (x) => Math.min(1, Math.max(0, x))],
  sin: [1, Math.sin], cos: [1, Math.cos],
};
const CONST = { pi: Math.PI, e: Math.E, true: 1, false: 0 };

/** Parse an expression into a function of a variable map. Throws Error with a plain message. */
export function compile(src) {
  const toks = [];
  const re = /\s*(?:(\d+\.?\d*|\.\d+)|([A-Za-z_]\w*)|(&&|\|\||==|!=|<=|>=|[-+*\/%^()<>!,]))/y;
  let pos = 0;
  src = src.trim();
  if (!src) throw new Error('Type an expression, for example and(a, b) or a + b * 2.');
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) throw new Error(`I do not understand the character "${src.slice(pos).trim()[0]}" at position ${pos + 1}. Use numbers, letters, + - * / % ^, comparisons and parentheses.`);
    pos = re.lastIndex;
    if (m[1] != null) toks.push({ t: 'n', v: parseFloat(m[1]) });
    else if (m[2] != null) toks.push({ t: 'id', v: m[2].toLowerCase(), raw: m[2] });
    else toks.push({ t: 'op', v: m[3] });
  }
  let i = 0;
  const vars = new Set();
  const peek = () => toks[i];
  const eat = (v) => { if (peek() && peek().t === 'op' && peek().v === v) { i++; return true; } return false; };
  const need = (v) => { if (!eat(v)) throw new Error(`Expected "${v}" ${peek() ? `before "${peek().v}"` : 'at the end'}. Check your brackets.`); };
  const bin = (next, ops) => () => {
    let l = next();
    for (;;) {
      const p = peek();
      if (p && p.t === 'op' && ops[p.v]) { i++; const r = next(); const f = ops[p.v], a = l; l = ((L, R) => (env) => f(L(env), R(env)))(a, r); } else return l;
    }
  };
  let expr;
  const primary = () => {
    const p = toks[i++];
    if (!p) throw new Error('The expression ends too early. Something is missing after the last operator.');
    if (p.t === 'n') return () => p.v;
    if (p.t === 'op' && p.v === '(') { const e = expr(); need(')'); return e; }
    if (p.t === 'id') {
      if (peek() && peek().v === '(' && peek().t === 'op') {
        i++;
        const def = FN[p.v];
        if (!def) throw new Error(`"${p.raw}" is not a known function. Try: ${Object.keys(FN).slice(0, 14).join(', ')} and more in the gate list above.`);
        const args = [];
        if (!eat(')')) { do { args.push(expr()); } while (eat(',')); need(')'); }
        if (args.length !== def[0]) throw new Error(`${p.raw} needs ${def[0]} input${def[0] > 1 ? 's' : ''} but you gave ${args.length}.`);
        return (env) => def[1](...args.map((a) => a(env)));
      }
      if (p.v in CONST) return () => CONST[p.v];
      vars.add(p.v);
      return (env) => env[p.v];
    }
    throw new Error(`Unexpected "${p.v}". A number, a name or an opening bracket is expected there.`);
  };
  const unary = () => {
    if (eat('-')) { const e = unary(); return (env) => -e(env); }
    if (eat('!')) { const e = unary(); return (env) => B(!T(e(env))); }
    return power();
  };
  const power = () => { const b = primary(); if (eat('^')) { const e = unary(); return (env) => b(env) ** e(env); } return b; };
  const mul = bin(unary, { '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b });
  const add = bin(mul, { '+': (a, b) => a + b, '-': (a, b) => a - b });
  const cmp = bin(add, { '<': (a, b) => B(a < b), '>': (a, b) => B(a > b), '<=': (a, b) => B(a <= b), '>=': (a, b) => B(a >= b) });
  const eq = bin(cmp, { '==': (a, b) => B(a === b), '!=': (a, b) => B(a !== b) });
  const andd = bin(eq, { '&&': (a, b) => B(T(a) && T(b)) });
  expr = bin(andd, { '||': (a, b) => B(T(a) || T(b)) });
  const fn = expr();
  if (i < toks.length) throw new Error(`Unexpected "${toks[i].v}" after the end of the expression. Did you forget an operator or a comma?`);
  return { fn, vars: [...vars].sort() };
}

const GATES = [
  ['Logic', 'And', 'and(a, b)', 'Gives 1 when both inputs are not 0.', 'And', ['0,1', '0,1']],
  ['Logic', 'Or', 'or(a, b)', 'Gives 1 when at least one input is not 0.', 'Or', ['0,1', '0,1']],
  ['Logic', 'Not', 'not(a)', 'Flips 0 to 1 and anything else to 0.', 'Not', ['0,1']],
  ['Logic', 'XOR (Exclusive Or)', 'xor(a, b)', 'Gives 1 when exactly one input is not 0.', 'Exclusive Or', ['0,1', '0,1']],
  ['Logic', 'NAND (Not And)', 'nand(a, b)', 'The opposite of And.', 'Not And', ['0,1', '0,1']],
  ['Logic', 'NOR (Not Or)', 'nor(a, b)', 'The opposite of Or.', 'Not Or', ['0,1', '0,1']],
  ['Logic', 'XNOR (Not Exclusive Or)', 'xnor(a, b)', 'Gives 1 when both inputs are equal in truth.', 'Not Exclusive Or', ['0,1', '0,1']],
  ['Logic', 'Select / Branch', 'select(a, b, c)', 'Gives b when a is not 0, otherwise c. This is an assumption about what Select and Branch do.', 'Select', ['0,1', '10', '20']],
  ['Comparisons', 'Equal', 'eq(a, b)', 'Gives 1 when a equals b.', 'Equal', ['1,2,3', '1,2,3']],
  ['Comparisons', 'Not Equal', 'neq(a, b)', 'Gives 1 when a differs from b.', 'Not Equal', ['1,2,3', '1,2,3']],
  ['Comparisons', 'Greater', 'gt(a, b)', 'Gives 1 when a is bigger than b.', 'Greater', ['1,2,3', '1,2,3']],
  ['Comparisons', 'Greater Or Equal', 'gte(a, b)', 'Gives 1 when a is at least b.', 'Greater Or Equal', ['1,2,3', '1,2,3']],
  ['Comparisons', 'Less', 'lt(a, b)', 'Gives 1 when a is smaller than b.', 'Less', ['1,2,3', '1,2,3']],
  ['Comparisons', 'Less Or Equal', 'lte(a, b)', 'Gives 1 when a is at most b.', 'Less Or Equal', ['1,2,3', '1,2,3']],
  ['Comparisons', 'Is In Range Inclusive', 'inrange(a, b, c)', 'Gives 1 when a is between b and c, ends included.', 'Is In Range Inclusive', ['0,5,10', '0', '10']],
  ['Comparisons', 'Is In Range Exclusive', 'inrange_ex(a, b, c)', 'Gives 1 when a is between b and c, ends not included.', 'Is In Range Exclusive', ['0,5,10', '0', '10']],
  ['Math', 'Add', 'add(a, b)', 'a plus b.', 'Add', ['1,2,3', '10,20']],
  ['Math', 'Subtract', 'sub(a, b)', 'a minus b.', 'Subtract', ['10,20', '1,2,3']],
  ['Math', 'Multiply', 'mul(a, b)', 'a times b.', 'Multiply', ['1,2,3', '10,20']],
  ['Math', 'Divide', 'div(a, b)', 'a divided by b. Dividing by 0 shows n/a here.', 'Divide', ['10,20', '0,2,4']],
  ['Math', 'Remainder', 'rem(a, b)', 'What is left after dividing a by b.', 'Remainder', ['7,8,9', '2,3']],
  ['Math', 'Power', 'pow(a, b)', 'a raised to the power b.', 'Power', ['2,3', '0,1,2,3']],
  ['Math', 'Min', 'min(a, b)', 'The smaller of a and b.', 'Min', ['1,5', '3']],
  ['Math', 'Max', 'max(a, b)', 'The larger of a and b.', 'Max', ['1,5', '3']],
  ['Math', 'Abs', 'abs(a)', 'a without its minus sign.', 'Abs', ['-3,0,3']],
  ['Math', 'Negate', 'neg(a)', 'a with its sign flipped.', 'Negate', ['-3,0,3']],
  ['Math', 'Clamp', 'clamp(a, b, c)', 'a, but never below b and never above c.', 'Clamp', ['-5,0,5,15', '0', '10']],
  ['Math', 'Clamp01', 'clamp01(a)', 'a, kept between 0 and 1.', 'Clamp01', ['-1,0,0.5,2']],
  ['Math', 'Average', 'avg(a, b)', 'The mean of a and b.', 'Average', ['2,4', '6']],
  ['Math', 'Sqr', 'sqr(a)', 'a times a.', 'Sqr', ['-2,3']],
  ['Math', 'Sqrt', 'sqrt(a)', 'Square root of a. Negative inputs show n/a here.', 'Sqrt', ['4,9,-1']],
  ['Math', 'Sign', 'sign(a)', '-1, 0 or 1 depending on the sign of a.', 'Sign', ['-5,0,5']],
  ['Math', 'Floor', 'floor(a)', 'a rounded down.', 'Floor', ['1.2,1.8,-1.2']],
  ['Math', 'Ceil', 'ceil(a)', 'a rounded up.', 'Ceil', ['1.2,1.8,-1.2']],
  ['Math', 'Round', 'round(a)', 'a rounded to the nearest whole number.', 'Round', ['1.2,1.5,1.8']],
];
const PRESETS = [
  ['Half adder', 'sum = xor(a, b); carry = and(a, b)', ['0,1', '0,1']],
  ['Full adder', 'sum = xor(xor(a, b), c); carry = or(and(a, b), and(c, xor(a, b)))', ['0,1', '0,1', '0,1']],
  ['Dead zone', 'out = select(gt(abs(a), 2), a, 0)', ['-5,-2,-1,0,1,2,5']],
];
const fmtV = (v) => (Number.isNaN(v) ? 'n/a' : v === Infinity || v === -Infinity ? 'n/a (divide by zero)' : String(Math.round(v * 1e6) / 1e6));

export default {
  id: 'logic-lab',
  title: 'Logic lab',
  blurb: 'Try the chip gates on paper: pick a gate or type an expression and see its result table.',
  mount(root, ctx) {
    const { data } = ctx;
    const inGame = new Set(data.gates.groups.flatMap((g) => g.gates.map((x) => x.toLowerCase())));
    const saved = store.get('tools.logic', {}) || {};
    const gateSel = h('select', { 'aria-label': 'Choose a gate', onchange: () => pickGate(+gateSel.value) });
    const groups = [...new Set(GATES.map((g) => g[0]))];
    groups.forEach((gr) => gateSel.append(h('optgroup', { label: gr }, GATES.map((g, i) => g[0] === gr ? h('option', { value: i }, g[1]) : null).filter(Boolean))));
    gateSel.prepend(h('option', { value: -1 }, 'Pick a gate…'));
    const presetSel = h('select', { 'aria-label': 'Example circuits', onchange: () => { const p = PRESETS[+presetSel.value]; if (p) { setExpr(p[1], p[2]); } } },
      h('option', { value: -1 }, 'Or try an example circuit…'), PRESETS.map((p, i) => h('option', { value: i }, p[0])));
    const desc = h('p.muted');
    const expr = h('textarea', { rows: 3, spellcheck: false, 'aria-label': 'Expression', placeholder: 'and(a, b)\nor: a > 3 && b < 2\nSeveral outputs: sum = xor(a, b); carry = and(a, b)' });
    const varBox = h('div.tl-grid3');
    const out = h('div');
    const err = h('p.tl-error', { role: 'alert' });
    let valLists = saved.vals || {};

    function setExpr(text, lists) {
      expr.value = text;
      valLists = {};
      if (lists) { const names = compileAll(text).vars; names.forEach((v, i) => { if (lists[i] != null) valLists[v] = lists[i]; }); }
      renderVars();
    }
    function split(text) {
      return text.split(/;|\n/).map((s) => s.trim()).filter(Boolean).map((s, i) => {
        const m = /^([A-Za-z_]\w*)\s*=(?!=)\s*(.*)$/.exec(s);
        return m ? { label: m[1], src: m[2] } : { label: text.split(/;|\n/).filter((x) => x.trim()).length > 1 ? `out${i + 1}` : 'result', src: s };
      });
    }
    function compileAll(text) {
      const outs = split(text).map((o) => ({ ...o, ...compile(o.src) }));
      return { outs, vars: [...new Set(outs.flatMap((o) => o.vars))].sort() };
    }
    function pickGate(i) {
      const g = GATES[i];
      if (!g) return;
      desc.textContent = `${g[3]}${inGame.has(g[4].toLowerCase()) ? ' Listed in the game chip editor.' : ''}`;
      setExpr(g[2], g[5]);
    }
    function renderVars() {
      err.textContent = '';
      let c;
      try { c = compileAll(expr.value); } catch (e) { err.textContent = e.message; varBox.replaceChildren(); out.replaceChildren(); return; }
      varBox.replaceChildren(...c.vars.map((v) => field(`Values for ${v}`, h('input', {
        type: 'text', value: valLists[v] ?? '0,1', inputmode: 'text', 'aria-label': `Values to try for ${v}, separated by commas`,
        oninput: (e) => { valLists[v] = e.target.value; table(c); },
      }), 'Comma separated')));
      table(c);
    }
    function table(c) {
      store.set('tools.logic', { expr: expr.value, vals: valLists });
      const lists = c.vars.map((v) => (valLists[v] ?? '0,1').split(/[\s,;]+/).filter(Boolean).map(Number));
      const bad = c.vars.filter((v, k) => lists[k].some((n) => !Number.isFinite(n)));
      if (bad.length) { err.textContent = `The values for ${bad.join(', ')} must be numbers separated by commas, for example 0,1,2.`; out.replaceChildren(); return; }
      err.textContent = '';
      const total = lists.reduce((n, l) => n * l.length, 1);
      if (!c.vars.length) {
        out.replaceChildren(h('div.tl-results', c.outs.map((o) => h('div.tl-result', h('span.muted', o.label), h('b', fmtV(o.fn({})))))));
        return;
      }
      if (total > 512) { err.textContent = `That would be ${total} rows. Use fewer values so there are at most 512 rows.`; out.replaceChildren(); return; }
      const rows = [];
      const walk = (k, env) => {
        if (k === c.vars.length) { rows.push({ env: { ...env }, res: c.outs.map((o) => o.fn(env)) }); return; }
        for (const v of lists[k]) { env[c.vars[k]] = v; walk(k + 1, env); }
      };
      walk(0, {});
      const asText = () => [[...c.vars, ...c.outs.map((o) => o.label)].join('\t'), ...rows.map((r) => [...c.vars.map((v) => r.env[v]), ...r.res.map(fmtV)].join('\t'))].join('\n');
      out.replaceChildren(
        h('div.table-wrap', h('table.data.tl-truth',
          h('thead', h('tr', c.vars.map((v) => h('th.num', v)), c.outs.map((o) => h('th.num.tl-outcol', o.label)))),
          h('tbody', rows.map((r) => h('tr', c.vars.map((v) => h('td.num', String(r.env[v]))), r.res.map((v) => h('td.num.tl-outcol', fmtV(v)))))))),
        h('div.row.tl-gap', h('span.muted', `${rows.length} row${rows.length === 1 ? '' : 's'}`), copyBtn(asText, 'Copy table')));
    }
    expr.addEventListener('input', () => renderVars());
    const refTable = h('details.tl-details', h('summary', 'Expression guide'),
      h('div.stack.tl-gap',
        h('p', 'Write gates as functions: ', h('code', 'and(a, b)'), ', ', h('code', 'clamp(a, 0, 10)'), ', ', h('code', 'select(a, b, c)'), '. Or use operators: ', h('code', '+ - * / % ^'), ', ', h('code', '== != < > <= >='), ', ', h('code', '&& || !'), '. Names like a, b and c are inputs. pi, e, true and false are constants.'),
        h('p', 'Functions: ', h('code', Object.keys(FN).join(', ')), '.')));

    root.append(h('div.stack',
      note('warn', h('p', h('b', 'This is standard math, not the game. '), 'The lab uses ordinary logic and arithmetic to explain what a gate name usually means. It does not copy how the game computes each gate, how it treats numbers that are not 0 or 1, or how it handles divide by zero. Test any real circuit in the game.')),
      h('section.panel', h('header', 'Gate or expression'), h('div.body.stack',
        h('div.tl-grid2', gateSel, presetSel), desc,
        field('Expression', expr), err, varBox, refTable)),
      h('section.panel', h('header', 'Result table'), h('div.body.stack', out))));
    if (saved.expr) { expr.value = saved.expr; renderVars(); } else { gateSel.value = GATES.findIndex((g) => g[1] === 'And'); pickGate(+gateSel.value); }
  },
};
