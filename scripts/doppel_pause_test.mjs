// A Doppel Cast echo waits out a pause instead of being thrown away.
// Per the 2026-09-26 bug hunt: the echo fires 200 ms after the cast on a real-time timer that returned early when the
// game was paused, so a menu opened in that window silently discarded a rolled echo ("setTimeout across a pause":
// defer, never discard). A map change or death in between still cancels it.
//   node scripts/doppel_pause_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html', PORT = String(process.argv[3] || 9979);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const r = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player._storyBeatsSeen = new Proxy({}, { get: () => true, has: () => true });
  player.cls = 'warrior'; player.level = 30; player._god = true;
  loadMap('forest', 300); game.paused = false; await sleep(500);
  // a warrior skill slot that is not the basic ('d'): the first learned one
  const id = Object.keys(SKILLS).find((k) => SKILLS[k].cls === 'warrior' && !SKILLS[k].job && SKILLS[k].slot && SKILLS[k].slot !== 'd' && typeof SKILL_FNS !== 'undefined' && SKILL_FNS[k]);
  player.mods = player.mods || {}; player.mods.doppelChance = 1;
  let calls = 0; const f0 = SKILL_FNS[id]; SKILL_FNS[id] = function () { calls++; return f0.apply(this, arguments); };
  const run = async (pauseMs) => {
    calls = 0; player.skillCooldowns[id] = 0; player.mp = player.maxMp = 9999; player._castLockUntil = 0; player._skillLockTimer = 0;
    castSkill(id);
    if (pauseMs) { game.paused = true; await sleep(pauseMs); game.paused = false; }
    await sleep(700);
    return calls;
  };
  const plain = await run(0), paused = await run(600);
  SKILL_FNS[id] = f0; player.mods.doppelChance = 0;
  return { id, plain, paused };
});
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(r.plain === 2, 'CONTROL: at 100% doppel a cast runs twice', r);
ok(r.paused === 2, 'a pause straight after the cast does not throw the echo away', r);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
