// Netlify Function: POST /api/ai-build  { prompt, mode:'build'|'tweak', build? }
//                   GET  /api/ai-build?health=1
// Needs one environment variable in Netlify: ANTHROPIC_API_KEY. See docs/AI.md.
// Optional: MODEL, MAX_DAILY_CALLS (whole site, default 200), MAX_IP_DAILY_CALLS (per visitor, default 25),
//           MAX_OUTPUT_TOKENS (default 1500), ALLOWED_ORIGIN (only needed if another site calls this one).
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAi, AiError, DEFAULT_MODEL, LIMITS } from '../../js/ai-core.js';

export const config = { path: '/api/ai-build' };

const int = (v, d, lo, hi) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const settings = () => ({
  key: (process.env.ANTHROPIC_API_KEY || '').trim(),
  model: (process.env.MODEL || '').trim() || DEFAULT_MODEL,
  daily: int(process.env.MAX_DAILY_CALLS, 200, 0, 100000),
  perIp: int(process.env.MAX_IP_DAILY_CALLS, 25, 0, 100000),
  maxTokens: int(process.env.MAX_OUTPUT_TOKENS, 1500, 300, 4000),
  origin: (process.env.ALLOWED_ORIGIN || '').trim().replace(/\/$/, ''),
});

// ---------- catalog (bundled file first, then the published site as a fallback)
let catalogCache = null;
async function loadCatalog(request) {
  if (catalogCache) return catalogCache;
  const rels = ['data/catalog.json'];
  const bases = [process.cwd(), process.env.LAMBDA_TASK_ROOT, process.env.NETLIFY_REPO_ROOT, fileURLToPath(new URL('../../', import.meta.url))].filter(Boolean);
  for (const b of bases) {
    for (const r of rels) {
      try {
        catalogCache = JSON.parse(await readFile(join(b, r), 'utf8'));
        if (catalogCache.items?.length) return catalogCache;
      } catch { /* try next */ }
    }
  }
  try {
    const res = await fetch(new URL('/data/catalog.json', request.url));
    if (res.ok) {
      catalogCache = await res.json();
      if (catalogCache.items?.length) return catalogCache;
    }
  } catch { /* fall through */ }
  catalogCache = null;
  throw new AiError('nocatalog', 'The site could not load its parts list (data/catalog.json). Redeploy the site and try again.', 500);
}

// ---------- daily counters: Netlify Blobs, with in-memory fallback
const memCounts = new Map();
let blobStore;
async function getBlobs() {
  if (blobStore !== undefined) return blobStore;
  try {
    const { getStore } = await import('@netlify/blobs');
    blobStore = getStore('msb-ai-usage');
  } catch {
    blobStore = null;
  }
  return blobStore;
}
const day = () => new Date().toISOString().slice(0, 10);

async function readCount(key) {
  const store = await getBlobs();
  if (store) {
    try {
      const v = await store.get(key, { type: 'json' });
      return Math.max(Number(v?.n) || 0, memCounts.get(key) || 0);
    } catch { /* use memory */ }
  }
  return memCounts.get(key) || 0;
}
async function writeCount(key, n) {
  memCounts.set(key, n);
  const store = await getBlobs();
  if (store) {
    try { await store.setJSON(key, { n }); } catch { /* memory copy still counts */ }
  }
}
async function bump(key) {
  const n = (await readCount(key)) + 1;
  await writeCount(key, n);
  return n;
}

const ipOf = (request, context) =>
  request.headers.get('x-nf-client-connection-ip') || context?.ip || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
const ipKey = (ip) => 'd/' + day() + '/ip-' + createHash('sha256').update(ip).digest('hex').slice(0, 16);
const globalKey = () => 'd/' + day() + '/global';

// ---------- http helpers
function corsHeaders(request, s) {
  const o = request.headers.get('origin');
  if (s.origin && o === s.origin) return { 'access-control-allow-origin': s.origin, vary: 'origin', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  return {};
}
function json(request, s, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(request, s) },
  });
}
const fail = (request, s, status, code, message, extra = {}) => json(request, s, status, { ok: false, code, error: message, ...extra });

const SETUP_HELP = 'The AI helper is not switched on yet. Site owner: in Netlify open Site configuration > Environment variables > Add a variable. Name it ANTHROPIC_API_KEY and paste your key from console.anthropic.com. Then open Deploys > Trigger deploy > Deploy site.';

export default async function handler(request, context) {
  const s = settings();
  const url = new URL(request.url);

  try {
    // origin check: only this site (or ALLOWED_ORIGIN) may call it from a browser
    const origin = request.headers.get('origin');
    if (origin) {
      const same = (() => { try { return new URL(origin).host === url.host; } catch { return false; } })();
      if (!same && origin !== s.origin) return fail(request, s, 403, 'origin', 'This address is not allowed to use the AI helper.');
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, s) });

    if (request.method === 'GET') {
      if (!url.searchParams.has('health')) return fail(request, s, 405, 'method', 'Use POST to make a plan.');
      const used = await readCount(globalKey());
      return json(request, s, 200, {
        ok: true, configured: !!s.key, model: s.model, remainingToday: Math.max(0, s.daily - used), dailyLimit: s.daily,
      });
    }
    if (request.method !== 'POST') return fail(request, s, 405, 'method', 'Use POST to make a plan.');

    if (!s.key) return fail(request, s, 503, 'not-configured', SETUP_HELP);

    // read and check the body
    const text = await request.text();
    if (text.length > 60000) return fail(request, s, 413, 'too-big', 'That request is too large.');
    let body;
    try { body = JSON.parse(text); } catch { return fail(request, s, 400, 'bad-body', 'The request was not valid JSON.'); }
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    if (!prompt.trim()) return fail(request, s, 400, 'empty', 'Type a short description of what you want to build first.');
    if (prompt.length > LIMITS.maxPrompt) return fail(request, s, 400, 'too-long', `Keep the description under ${LIMITS.maxPrompt} characters.`);
    const mode = body?.mode === 'tweak' ? 'tweak' : 'build';

    // daily limits (checked and counted before calling Claude so parallel requests cannot slip past)
    const ip = ipOf(request, context);
    const gKey = globalKey(), iKey = ipKey(ip);
    const [gUsed, iUsed] = await Promise.all([readCount(gKey), readCount(iKey)]);
    if (gUsed >= s.daily) {
      return fail(request, s, 429, 'global-limit', `The site's AI plans for today are used up (${s.daily} a day). Try again tomorrow, or open "Advanced" and use your own API key.`, { remaining: 0 });
    }
    if (iUsed >= s.perIp) {
      return fail(request, s, 429, 'ip-limit', `You have used your ${s.perIp} AI plans for today. Try again tomorrow, or open "Advanced" and use your own API key.`, { remaining: 0 });
    }
    const catalog = await loadCatalog(request);
    const g = await bump(gKey);
    await bump(iKey);

    const out = await runAi({
      apiKey: s.key, model: s.model, maxTokens: s.maxTokens, catalog, prompt, mode, build: body?.build, who: 'server', timeoutMs: 22000,
    });
    return json(request, s, 200, {
      ok: true, build: out.build, notes: out.notes, usage: out.usage, remaining: Math.max(0, Math.min(s.daily - g, s.perIp - (iUsed + 1))),
    });
  } catch (e) {
    if (e instanceof AiError) {
      return fail(request, s, e.status || 500, e.code, e.message, e.notes ? { notes: e.notes } : {});
    }
    console.error('ai-build failed:', e?.name, String(e?.message || '').replace(/sk-ant-[\w-]+/g, '[key]').slice(0, 200));
    return fail(request, s, 500, 'internal', 'Something went wrong on the site. Try again in a moment.');
  }
}
