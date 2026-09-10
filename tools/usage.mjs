// What the model calls have actually cost.
//
//   npm run usage           # the last 30 days
//   npm run usage -- 7      # the last 7
//
// Reads lib/usage.js's ledger, which the server appends to after every model
// call. Deliberately a command rather than a route: spend is not something to
// put behind a URL, and the operator of this server has a shell.
//
// The number to look at is `cache hits`. The system prompt is ~15,000 tokens
// and is offered to Gemini's context cache on every profile run; if that share
// is near zero while calls are being made, the cache is cold or broken, and
// every one of those calls is paying full rate for the same 15,000 tokens.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const usage = await import(join(here, '..', 'lib', 'usage.js')).then(m => m.default || m);

const days = Number(process.argv[2]) || 30;
const t = usage.summary(days);

const money = n => '$' + n.toFixed(4);
const rows = [
  ['window', t.days + ' days'],
  ['calls', String(t.calls)],
  ['by kind', Object.keys(t.byKind).length
    ? Object.entries(t.byKind).map(([k, n]) => k + ' ' + n).join(', ') : '—'],
  ['models', t.models.length ? t.models.join(', ') : '—'],
  ['input tokens', t.input.toLocaleString()],
  ['output tokens', t.output.toLocaleString()],
  ['cache hits', t.input ? (t.cachedShare * 100).toFixed(1) + '% of input tokens' : '—'],
  ['total', money(t.costUsd) + ' (estimated)'],
  ['per call', money(t.costPerCallUsd)],
];

console.log('\n  PsycheAI usage\n');
for (const [label, value] of rows) console.log('  ' + label.padEnd(15) + value);

if (!t.calls) {
  console.log('\n  No calls recorded. Either none have been made, or the ledger at');
  console.log('  ' + usage.STORE);
  console.log('  is not where this process is looking — on a host with an ephemeral');
  console.log('  filesystem it is wiped on every deploy. Set PSYCHEAI_USAGE_STORE to a');
  console.log('  path on a persistent disk.');
} else if (t.cachedShare < 0.2) {
  console.log('\n  Cache hits are low. Every profile run sends a system prompt of about');
  console.log('  15,000 tokens; served from cache it bills at a quarter of the rate.');
  console.log('  PSYCHEAI_GEMINI_CACHE_TTL defaults to 900 seconds, so at a handful of');
  console.log('  calls a day the cache has almost always expired before the next one.');
}
console.log('');
