// Client side of the AI helper: status check, the panel UI, and calls to Claude.
// Two routes to Claude, both using the same code in ai-core.js:
//   1. the site's own Netlify function (/api/ai-build), when the owner has added ANTHROPIC_API_KEY
//   2. the visitor's own key, sent straight from their browser to api.anthropic.com
// With neither, the panel offers "quick starters" that need no AI.
import { h, store, ensureCss, deepCopy } from './util.js';
import { runAi, AiError, DEFAULT_MODEL, EXAMPLE_PROMPTS, LIMITS, quickStarters } from './ai-core.js';

const ENDPOINT = '/api/ai-build';
const COOLDOWN_MS = 15000;
const KEY_NAME = 'ai-key';

export const getOwnKey = () => {
  const k = store.get(KEY_NAME, '');
  return typeof k === 'string' ? k.trim() : '';
};

/** Ask the site whether the AI helper is switched on. Never calls Anthropic. */
export async function aiStatus() {
  const none = { available: false, mode: 'none', model: DEFAULT_MODEL, remaining: 0 };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(`${ENDPOINT}?health=1`, { cache: 'no-store', signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return none;
    const j = await res.json();
    if (!j?.ok || !j.configured) return { ...none, model: j?.model || DEFAULT_MODEL };
    return { available: true, mode: 'server', model: j.model, remaining: j.remainingToday ?? 0 };
  } catch {
    return none;
  }
}

let lastRun = 0; // shared by every panel on the page

async function viaServer({ prompt, mode, build }) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, mode, build: mode === 'tweak' ? build : undefined }),
    });
  } catch {
    throw new AiError('network', 'Could not reach the site. Check your connection and try again.');
  }
  let j = null;
  try { j = await res.json(); } catch { /* not json */ }
  if (!j) throw new AiError('upstream', `The site answered with an error (${res.status}). Try again in a moment.`);
  if (!j.ok) throw new AiError(j.code || 'upstream', j.error || 'Something went wrong.', res.status, { notes: j.notes });
  return j;
}

async function viaOwnKey({ prompt, mode, build, data, key }) {
  const out = await runAi({ apiKey: key, browser: true, who: 'browser', model: DEFAULT_MODEL, catalog: data.catalog, prompt, mode, build, timeoutMs: 40000 });
  return { ok: true, build: out.build, notes: out.notes, usage: out.usage };
}

const SETUP_STEPS = [
  'Get a key: sign in at console.anthropic.com, open API keys and choose Create key.',
  'In Netlify, open this site, then Site configuration > Environment variables.',
  'Choose Add a variable. Name it ANTHROPIC_API_KEY and paste the key as its value.',
  'Open Deploys > Trigger deploy > Deploy site and wait for it to finish.',
  'Reload this page. The status at the top of this panel changes to Ready.',
];

export function createAiPanel({ data, getBuild, onResult, onBuildReplace } = {}) {
  ensureCss('css/ai.css');
  let status = null; // from aiStatus()
  let busy = false;
  let mode = 'build';
  let last = null; // last request, for "Try again"
  let timer = null;

  const badge = h('span.badge', 'Checking');
  const text = h('textarea.ai-text', {
    id: 'ai-text', rows: 4, maxlength: LIMITS.maxPrompt, placeholder: 'Describe what you want to build, in your own words.',
    'aria-describedby': 'ai-count',
  });
  const count = h('span.ai-count', { id: 'ai-count' }, `0 / ${LIMITS.maxPrompt}`);
  const stateLine = h('p.ai-state', { role: 'status', 'aria-live': 'polite' });
  const go = h('button.btn.primary.ai-go', { type: 'button' }, 'Make a plan');
  const out = h('div.ai-out');
  const setup = h('div.ai-setup', { hidden: true });
  const quota = h('p.ai-quota.muted', { hidden: true });
  const modeNew = h('button.btn.sm', { type: 'button', 'aria-pressed': 'true' }, 'New plan');
  const modeTweak = h('button.btn.sm', { type: 'button', 'aria-pressed': 'false', title: 'Ask for changes to the plan you have open' }, 'Change current plan');
  const adv = buildAdvanced();

  const hasPlan = () => !!(getBuild?.()?.items?.length);
  const ownKey = () => getOwnKey();
  const aiReady = () => !!ownKey() || !!status?.available;

  function setMode(m) {
    mode = m === 'tweak' && hasPlan() ? 'tweak' : 'build';
    modeNew.setAttribute('aria-pressed', String(mode === 'build'));
    modeTweak.setAttribute('aria-pressed', String(mode === 'tweak'));
    text.placeholder = mode === 'tweak' ? 'Say what to change, for example: add a second rocket engine at the back.' : 'Describe what you want to build, in your own words.';
  }
  modeNew.onclick = () => setMode('build');
  modeTweak.onclick = () => { if (hasPlan()) setMode('tweak'); else showError('There is no plan open yet. Make or open a plan first, then ask for changes.'); };

  text.addEventListener('input', () => { count.textContent = `${text.value.length} / ${LIMITS.maxPrompt}`; });

  const examples = h('div.ai-examples', EXAMPLE_PROMPTS.slice(0, 4).map((p) =>
    h('button.btn.sm.ghost', { type: 'button', onclick: () => { text.value = p; text.dispatchEvent(new Event('input')); setMode('build'); text.focus(); } }, p)));

  function refreshHead() {
    const own = !!ownKey();
    let cls = 'badge warn', label = 'Not set up';
    if (!status) { cls = 'badge'; label = 'Checking'; }
    else if (own) { cls = 'badge info'; label = 'Using your key'; }
    else if (status.available && status.remaining > 0) { cls = 'badge ok'; label = 'Claude ready'; }
    else if (status.available) { cls = 'badge warn'; label = 'Daily limit reached'; }
    badge.className = cls; badge.textContent = label;

    const showSetup = !!status && !aiReady();
    setup.hidden = !showSetup;
    quota.hidden = !(status?.available && !own);
    if (status?.available && !own) {
      quota.textContent = status.remaining > 0
        ? `The site has about ${status.remaining} AI plans left today. Each visitor also has a daily share.`
        : 'The site\'s AI plans for today are used up. Quick starters still work, or add your own key under Advanced.';
    }
    const canAi = aiReady() && !(status?.available && status.remaining === 0 && !own);
    go.textContent = canAi || !status ? 'Make a plan' : 'Find quick starters';
    modeTweak.disabled = !hasPlan();
    if (mode === 'tweak' && !hasPlan()) setMode('build');
  }

  function renderSetup() {
    setup.replaceChildren(
      h('h4', 'AI planning is not switched on for this site'),
      h('p', 'The site owner needs to do this once. It takes about five minutes and the key stays on Netlify, never in the page.'),
      h('ol', SETUP_STEPS.map((s) => h('li', s))),
      h('p.muted', 'Visitors can still use quick starters below, or paste their own key under Advanced.'),
    );
  }
  renderSetup();

  // ----- cooldown
  function tick() {
    const left = Math.ceil((lastRun + COOLDOWN_MS - Date.now()) / 1000);
    if (!busy) {
      if (left > 0 && aiReady()) { go.disabled = true; go.textContent = `Wait ${left}s`; }
      else { go.disabled = false; refreshHead(); }
    }
    if (left <= 0 || !panel.isConnected) { clearInterval(timer); timer = null; if (!busy) { go.disabled = false; refreshHead(); } }
  }
  function startCooldown() {
    lastRun = Date.now();
    clearInterval(timer);
    timer = setInterval(tick, 500);
    tick();
  }

  // ----- results
  function showError(msg, extra) {
    out.replaceChildren(h('div.callout.warn.ai-error', { role: 'alert' },
      h('p', msg),
      extra?.length ? h('ul.ai-notes', extra.map((n) => h('li', n))) : null,
      h('div.row', last ? h('button.btn.sm', { type: 'button', onclick: () => run(last.prompt, last.mode) }, 'Try again') : null)));
  }

  function partsSummary(build) {
    const counts = new Map();
    for (const it of build.items) {
      const name = data?.byId?.get(it.t)?.name || it.t;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts].map(([n, c]) => h('span.chip', c > 1 ? `${n} x${c}` : n));
  }

  function showResult(res, usedMode) {
    const b = res.build;
    const done = h('p.ai-done', { hidden: true, role: 'status' }, 'Added. You can keep editing it on the grid.');
    const use = h('button.btn.primary', { type: 'button' }, usedMode === 'tweak' ? 'Use this change' : 'Use this plan');
    use.onclick = () => {
      const copy = deepCopy(b);
      if (usedMode === 'tweak' && onBuildReplace) onBuildReplace(copy);
      else onResult?.(copy);
      done.hidden = false;
      use.disabled = true;
    };
    out.replaceChildren(h('div.ai-result',
      h('div.ai-result-head', h('h4', b.name), h('span.badge.warn', 'Untested')),
      b.notes ? h('p.ai-says', b.notes) : null,
      h('p.muted.ai-counts', `${b.items.length} ${b.items.length === 1 ? 'part' : 'parts'}, ${b.links.length} ${b.links.length === 1 ? 'link' : 'links'}`),
      h('div.ai-parts', partsSummary(b)),
      res.notes?.length ? h('div.ai-warn', h('h5', 'What I changed or want you to know'), h('ul.ai-notes', res.notes.map((n) => h('li', n)))) : null,
      h('div.row.ai-buttons', use, h('button.btn.ghost', { type: 'button', onclick: () => run(last.prompt, last.mode) }, 'Try again')),
      done));
    out.querySelector('.ai-result').scrollIntoView?.({ block: 'nearest' });
  }

  function showStarters(promptText) {
    const q = quickStarters(data, promptText);
    const parts = [];
    if (q.plans.length) {
      parts.push(h('h5', 'Premade plans that match'));
      q.plans.forEach((p) => parts.push(h('button.btn.sm.ai-starter', { type: 'button', onclick: () => onResult?.(deepCopy(p.build)) }, 'Open plan: ' + p.name)));
    }
    if (q.build) {
      parts.push(h('h5', 'Matching parts'));
      parts.push(h('div.ai-parts', q.parts.map((p) => h('span.chip', p.name))));
      parts.push(h('button.btn.sm.ai-starter', { type: 'button', onclick: () => onResult?.(deepCopy(q.build)) }, 'Start with these parts'));
    }
    if (!parts.length) parts.push(h('p', 'Nothing matched. Try plain part words such as cart, wheel, rocket, tower, rod or crate.'));
    out.replaceChildren(h('div.ai-result.ai-quick',
      h('div.ai-result-head', h('h4', 'Quick starters'), h('span.badge.info', 'No AI')),
      h('p.muted', 'These come from matching your words against the premade plans and the parts list. They are not a custom design.'),
      ...parts));
  }

  // ----- run
  async function run(promptText, wantMode) {
    const clean = String(promptText || '').trim();
    if (!clean) { showError('Type a short description first, or tap one of the examples.'); text.focus(); return; }
    const own = ownKey();
    const serverOk = status?.available && status.remaining > 0;
    if (!own && !serverOk) { showStarters(clean); return; }
    if (busy || Date.now() - lastRun < COOLDOWN_MS) return;
    const useMode = wantMode === 'tweak' && hasPlan() ? 'tweak' : 'build';
    last = { prompt: clean, mode: useMode };
    busy = true;
    go.disabled = true;
    go.textContent = 'Thinking...';
    out.replaceChildren(h('div.ai-thinking', { role: 'status' }, h('div.ai-bar', h('i'), h('i'), h('i'), h('i'), h('i')), h('p', 'Claude is drawing your plan. This usually takes 5 to 15 seconds.')));
    stateLine.textContent = '';
    try {
      const build = useMode === 'tweak' ? getBuild() : undefined;
      const res = own
        ? await viaOwnKey({ prompt: clean, mode: useMode, build, data, key: own })
        : await viaServer({ prompt: clean, mode: useMode, build });
      if (res.remaining != null && status) status.remaining = res.remaining;
      showResult(res, useMode);
    } catch (e) {
      const msg = e instanceof AiError ? e.message : 'Something unexpected went wrong. Try again.';
      showError(msg, e?.notes);
      if (e?.code === 'not-configured' && status) status.available = false;
      if (e?.code === 'global-limit' || e?.code === 'ip-limit') { if (status) status.remaining = 0; }
      if (e?.code === 'auth' && own) stateLine.textContent = 'Your saved key was refused. Check it under Advanced.';
    } finally {
      busy = false;
      startCooldown();
      refreshHead();
      tick();
    }
  }

  go.onclick = () => run(text.value, mode);
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go.click(); } });

  // ----- advanced: own key
  function buildAdvanced() {
    const wrap = h('details.ai-adv');
    const body = h('div.ai-adv-body');
    const input = h('input', { type: 'password', id: 'ai-key', autocomplete: 'off', spellcheck: 'false', placeholder: 'sk-ant-...', 'aria-label': 'Your Anthropic API key' });
    const msg = h('p.ai-keymsg', { role: 'status', 'aria-live': 'polite' });
    const save = h('button.btn.sm', { type: 'button' }, 'Save key in this browser');
    const clear = h('button.btn.sm.ghost', { type: 'button' }, 'Remove key');
    const draw = () => {
      const k = getOwnKey();
      clear.hidden = !k;
      input.value = '';
      input.placeholder = k ? `Saved (ends in ${k.slice(-4)})` : 'sk-ant-...';
      msg.textContent = k ? 'Your key is saved in this browser and is being used instead of the site\'s.' : '';
    };
    save.onclick = () => {
      const k = input.value.trim();
      if (!k) { msg.textContent = 'Paste your key first.'; return; }
      if (!/^sk-ant-[\w-]{20,}$/.test(k)) { msg.textContent = 'That does not look like an Anthropic key. It should start with sk-ant- and have no spaces.'; return; }
      store.set(KEY_NAME, k);
      draw();
      refreshHead();
    };
    clear.onclick = () => { store.del(KEY_NAME); draw(); refreshHead(); msg.textContent = 'Key removed from this browser.'; };
    body.append(
      h('p', 'You can use your own Anthropic account instead of the site\'s. Plans are then billed to you and the site\'s daily limits do not apply.'),
      h('p', 'Your key is stored only in this browser. It is sent only to api.anthropic.com, straight from your device, and never to this site\'s server. Do not use this on a shared computer unless you remove the key afterwards.'),
      h('label.field', { for: 'ai-key' }, h('span', 'Anthropic API key'), input),
      h('div.row', save, clear), msg);
    wrap.append(h('summary', 'Advanced: use my own API key'), body);
    draw();
    return wrap;
  }

  const panel = h('section.ai-panel', { 'aria-label': 'Plan with AI' },
    h('header.ai-head', h('h3', 'Plan with AI'), badge),
    h('div.ai-body',
      h('p.ai-lead', 'Describe a contraption and Claude drafts a plan using only parts from the catalog. Check every plan before you trust it.'),
      h('div.ai-modes', { role: 'group', 'aria-label': 'What to do' }, modeNew, modeTweak),
      h('label.field', { for: 'ai-text' }, h('span', 'Your description'), text),
      h('div.ai-meta', count),
      h('div.ai-ex-wrap', h('p.ai-ex-title', 'Tap an example to fill the box'), examples),
      h('div.ai-actions', go, stateLine),
      quota,
      setup,
      out,
      adv));

  // status check
  (async () => {
    status = await aiStatus();
    refreshHead();
    tick();
  })();
  panel.refresh = async () => { status = await aiStatus(); refreshHead(); setMode(mode); };
  panel.setPrompt = (p) => { text.value = p; text.dispatchEvent(new Event('input')); };
  refreshHead();
  return panel;
}
