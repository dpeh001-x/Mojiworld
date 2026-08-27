// Live test: DEPOT BOOT — serves the repo through the Steam wrapper's own
// static server, but marks every path NOT covered by steam/package.json's
// extraResources filter (the shipped depot contents) with an x-depot:blocked
// 404. Booting the game against this exactly simulates the SHIPPED depot:
// any runtime request for a file that won't be packaged fails HERE instead
// of on a player's machine. Plain stat-404s (webp→png fallback probes etc.)
// are pre-existing web behaviour and only reported, not failed.
// Also case-verifies every referenced path against the real directory
// listings — Windows dev is case-insensitive, the Deck's ext4 is NOT.
// Run: node scripts/steam_depot_boot_test.mjs   (MOJI_PW_EXE overrides Chrome)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = require(path.join(ROOT, 'steam', 'static_server.js'));
const pkg = require(path.join(ROOT, 'steam', 'package.json'));
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// MOJI_PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.MOJI_PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const PORT = 47901;
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });

// --- depot filter from extraResources (single source of truth) -------------
const filter = pkg.build.extraResources.find((r) => r.to === 'app').filter;
const exact = new Set(); const buckets = [];
for (const f of filter) { if (f.endsWith('/**')) buckets.push(f.slice(0, -3) + '/'); else exact.add(f); }
const inDepot = (rel) => exact.has(rel) || buckets.some((b) => rel.startsWith(b));

// --- (0) CASE-SENSITIVITY AUDIT (Deck ext4) ---------------------------------
const dirCache = new Map();
const listing = (dir) => { let l = dirCache.get(dir); if (!l) { try { l = new Set(fs.readdirSync(dir)); } catch (e) { l = new Set(); } dirCache.set(dir, l); } return l; };
const caseExact = (rel) => { let dir = ROOT; for (const seg of rel.split('/')) { if (!listing(dir).has(seg)) return false; dir = path.join(dir, seg); } return true; };
const refs = new Set();
try { for (const a of JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'assets_manifest.json'), 'utf8'))) if (typeof a === 'string') refs.add(a.replace(/^\.?\//, '')); } catch (e) {}
const html = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const re = /(?:Sprites|audio|backgrounds|steam\/higgsfield\/cinematics)\/[A-Za-z0-9_\-./]+?\.(?:png|webp|jpg|jpeg|gif|svg|mp3|ogg|wav|m4a|mp4|webm|json)/g;
let m; while ((m = re.exec(html))) { if (!m[0].includes('..')) refs.add(m[0]); }
const caseMismatch = [];
for (const r of refs) if (fs.existsSync(path.join(ROOT, r)) && !caseExact(r)) caseMismatch.push(r);
ok('no case-mismatched asset paths (' + refs.size + ' refs checked; ext4/Deck-safe)', caseMismatch.length === 0, caseMismatch.slice(0, 15));

// --- depot-filtered server ---------------------------------------------------
const inner = srv.requestHandler(ROOT, '/mojiworld_game.html');
const server = http.createServer((req, res) => {
  const p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p !== '/' && !inDepot(p.replace(/^\//, ''))) { res.writeHead(404, { 'x-depot': 'blocked' }); res.end('not in depot'); return; }
  inner(req, res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const page = await (await browser.newContext()).newPage();
  const pageErrors = []; const depotBlocked = []; const statMisses = []; const netFails = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
  page.on('response', (r) => {
    if (r.status() < 400 || /favicon\.ico$/.test(r.url())) return;
    const rel = r.url().replace(/^http:\/\/[^/]+/, '');
    if (r.headers()['x-depot'] === 'blocked') depotBlocked.push(rel); else statMisses.push(rel);
  });
  page.on('requestfailed', (r) => {
    const err = (r.failure() && r.failure().errorText) || '';
    // ERR_ABORTED = the page cancelled its own media preload (normal for
    // <video>/<audio> priming). Anything else is a real transport failure.
    if (/favicon\.ico$/.test(r.url()) || /ERR_ABORTED/.test(err)) return;
    netFails.push(err + ' ' + r.url().replace(/^http:\/\/[^/]+/, ''));
  });

  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof updatePlayer === 'function', null, { timeout: 45000 });
  ok('game scripts booted (loadMap + updatePlayer defined)', true);

  await page.waitForTimeout(3000);
  const played = await page.evaluate(() => {
    try {
      player.cls = 'warrior'; game.paused = false; window._prologueActive = false;
      const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
      loadMap('glasswindSteppe');
      for (let i = 0; i < 30; i++) updatePlayer(16);
      return { map: game.currentMap, simOk: typeof player.x === 'number' && isFinite(player.x) };
    } catch (e) { return { err: String(e).slice(0, 120) }; }
  });
  ok('map loads + player simulates under depot serving', played.map === 'glasswindSteppe' && played.simOk === true && !played.err, played);

  // world streamer kicks ~8s post-reveal — wait it out so every map's sprites
  // and registries get requested against the depot filter
  await page.waitForTimeout(14000);

  const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
  ok('no depot-blocked requests (file exists but is NOT packaged)', depotBlocked.length === 0, uniq(depotBlocked).slice(0, 20));
  ok('no hard network failures', netFails.length === 0, uniq(netFails).slice(0, 10));
  ok('no page errors under depot serving', pageErrors.length === 0, pageErrors.slice(0, 5));
  const misses = uniq(statMisses);
  console.log('INFO  stat-404s (webp→png fallback probes etc.; same on web): ' + misses.length + (misses.length ? '  e.g. ' + misses.slice(0, 3).join(', ') : ''));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); server.close(); }

const passed = results.filter((r) => r.pass).length;
console.log('\n=== STEAM DEPOT BOOT (extraResources-filtered serving + case audit) ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
