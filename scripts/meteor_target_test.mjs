// Meteor lands on the nearest foe ahead that can be HIT.
// Per the 2026-09-26 bug hunt: v0.30.1033 aimed Meteor at the nearest monster ahead, skipping only the dead, so an
// IMMUNE one in front (a boss mid-evolve or mid-teleport, Octobaby's sever window, a burrowed mob) drew the whole
// meteor while a hittable foe a step behind it took nothing - the cast spent on "IMMUNE". With nothing hittable
// ahead it still falls where it always did (the nearest, or 80 px ahead), so the player's aim is unchanged.
//   node scripts/meteor_target_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html', PORT = String(process.argv[3] || 9974);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof performMeteor === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const r = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player.level = 60; player._god = true; player.invulnerable = 9e9;
  loadMap('forest', 300); game.paused = false; await sleep(600);
  const cast = (setup) => {
    game.monsters.length = 0; game.hazards.length = 0;
    player.x = 400; player.y = 380; player.facing = 1;
    const mk = (dx) => { const m = spawnMonster(player.x + player.w / 2 + dx - 30, player.y, 'slime'); if (m) { m.currentHp = m.maxHp = 9e6; } return m; };
    const ms = setup(mk);
    performMeteor();
    const h = game.hazards.find((z) => z && z.type === 'meteor_warn');
    const cxOf = (m) => m ? Math.round(m.x + m.w / 2) : null;
    return { cx: h ? Math.round(h.cx) : null, targets: ms.map(cxOf) };
  };
  const out = {};
  // 1. an immune monster in front, a hittable one behind it
  out.immuneFront = cast((mk) => { const a = mk(150), b = mk(320); a.invulnerable = 99999; return [a, b]; });
  // 2. a burrowed one in front
  out.burrowFront = cast((mk) => { const a = mk(150), b = mk(320); a._invulnBurrow = true; return [a, b]; });
  // 3. CONTROL: only an immune monster ahead - it still lands on him, where the player aimed
  out.onlyImmune = cast((mk) => { const a = mk(150); a.invulnerable = 99999; return [a]; });
  // 4. CONTROL: two hittable monsters - the nearest, as before
  out.plain = cast((mk) => [mk(150), mk(320)]);
  game.monsters.length = 0;
  return out;
});
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(r.immuneFront.cx === r.immuneFront.targets[1], 'an IMMUNE monster in front does not take the meteor from a hittable one behind it', r.immuneFront);
ok(r.burrowFront.cx === r.burrowFront.targets[1], 'a BURROWED monster in front does not take it either', r.burrowFront);
ok(r.onlyImmune.cx === r.onlyImmune.targets[0], 'CONTROL: with nothing hittable ahead it still falls on the nearest', r.onlyImmune);
ok(r.plain.cx === r.plain.targets[0], 'CONTROL: two hittable monsters - the nearest, as before', r.plain);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
