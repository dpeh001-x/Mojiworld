// A taxi fare out of an expedition is actually paid.
// Per the 2026-09-26 bug hunt: ending a Tower run puts the wallet back to its start-of-run snapshot and re-charges
// only what the run recorded in _spentInRun (the potion auto-buy, v0.30.931). The Taxi Uncle and the world map's
// "back to" buttons both warn "the fare still applies" and deduct it - but never recorded it, so the restore that
// ends the run handed the fare straight back: a free ride out of any run.
//   node scripts/expedition_fare_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html', PORT = String(process.argv[3] || 9978);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _startExpedition === 'function' && typeof _wmRenderRecent === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const r = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player._storyBeatsSeen = new Proxy({}, { get: () => true, has: () => true });
  player.level = 40; player._god = true;
  loadMap('town', 300); game.paused = false; await sleep(600);
  window.uiConfirm = async () => true;
  player.mojicoins = 10000;   // the wallet the run snapshots
  const ok = _startExpedition(); await sleep(2500); game.paused = false;
  const inRun = !!(game.expedition && game.expedition.active), runMap = game.currentMap;
  const coinsInRun = player.mojicoins;
  game.mapHistory = ['town', runMap];
  let host = document.getElementById('worldmap-recent');
  if (!host) { host = document.createElement('div'); host.id = 'worldmap-recent'; document.body.appendChild(host); }
  _wmRenderRecent();
  const btn = host.querySelector('button[data-map-id="town"]');
  const fare = _taxiFare();
  if (btn) btn.onclick();
  await sleep(3000); game.paused = false;
  return { coinsInRun, started: ok, inRun, runMap, fare, clicked: !!btn, endedRun: !(game.expedition && game.expedition.active), map: game.currentMap, coins: player.mojicoins };
});
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(r.inRun && r.clicked, 'CONTROL: in a Tower run, with a "back to" ride on the world map', r);
ok(r.endedRun && r.map === 'town', 'the ride leaves the Tower and ends the run', { map: r.map, ended: r.endedRun });
ok(r.coins === 10000 - r.fare, 'the fare is actually paid once the run has ended (not refunded by the wallet restore)', { coins: r.coins, want: 10000 - r.fare });
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
