// The service worker must EVICT the previous cache generation, not just define
// a new key. Two players on the same map and version saw different Everdawn
// Central backgrounds because 280bae14 replaced the plate without bumping this
// key, so a returning browser kept serving its cached copy forever.
//
// Asserting the constant alone would prove nothing — the constant was already
// there and the sweep was still a no-op for every release between v0.26.949 and
// v0.29.473. So this SEEDS a stale generation with a decoy asset, reloads, and
// checks the decoy is actually gone.
//   node scripts/sw_cache_eviction_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// --- static: the key moved, and the sweep still exists ----------------------
const sw = readFileSync('sw.js', 'utf8');
const key = (sw.match(/const CACHE = '([^']+)'/) || [])[1];
ok('cache key is bumped past the generation that shipped the stale plate', key === 'mojiworld-assets-v4', { key });
ok('the activate sweep that evicts old generations is still present',
   /caches\.keys\(\)/.test(sw) && /caches\.delete/.test(sw), {});
ok('the game HTML is still NOT cached (code updates must never be stale)',
   /ASSET_RE\s*=\s*\/\\\.\(png\|webp/.test(sw) && !/html/i.test((sw.match(/ASSET_RE = [^\n]+/) || [''])[0]), {});

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await b.newContext();
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });

// Seed a STALE generation holding a decoy under the real background's URL —
// this is the shape of the bug: an old plate cached under the current filename.
const seeded = await page.evaluate(async () => {
  const stale = await caches.open('mojiworld-assets-v3');
  await stale.put('/backgrounds/bg_v3_everdawn_central.webp',
    new Response('STALE-PLATE', { headers: { 'Content-Type': 'image/webp' } }));
  const before = await caches.keys();
  const hit = await (await caches.open('mojiworld-assets-v3')).match('/backgrounds/bg_v3_everdawn_central.webp');
  return { keys: before, decoyPresent: !!hit };
});

// Register + activate the worker, then reload so activate() runs its sweep.
await page.evaluate(async () => {
  try { await navigator.serviceWorker.register('/sw.js'); } catch (e) {}
  await navigator.serviceWorker.ready;
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(4000);

const after = await page.evaluate(async () => {
  const keys = await caches.keys();
  let decoy = null;
  if (keys.includes('mojiworld-assets-v3')) {
    const c = await caches.open('mojiworld-assets-v3');
    const hit = await c.match('/backgrounds/bg_v3_everdawn_central.webp');
    decoy = hit ? await hit.text() : null;
  }
  return { keys, decoy };
});
await b.close(); try { srv.kill(); } catch (e) {}

ok('the stale generation was seeded (the test is testing something)',
   seeded.decoyPresent === true && seeded.keys.includes('mojiworld-assets-v3'), seeded);
ok('the OLD cache generation is evicted on activate',
   !after.keys.includes('mojiworld-assets-v3'), { keysAfter: after.keys });
ok('the stale background is gone, not merely shadowed', after.decoy === null, { decoy: after.decoy });
ok('the new generation is the one in use', after.keys.includes('mojiworld-assets-v4'), { keysAfter: after.keys });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
