// Aetherion's attacks die with him: his Shard Lances and his meteor columns do not outlive his death.
// Per the 2026-09-26 full audit. His death scrub removed only the choir (v0.30.933). The Shard Lance is a HOMING enemy
// projectile worth up to half the bar (_heavyFloorPct) and it steers at the player with no link to him, and his
// Fracture / Shardfall / Sky-Break columns are meteor_warn hazards that resolve on the player regardless - so a final
// blow landed with a salvo or a wall in the air hit the player during his death cinematic. The Sovereign got this fix
// in v0.30.933. CONTROL: another source's projectile and hazard survive the same death.
//   node scripts/aetherion_death_scrub_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PORT = String(process.argv[3] || 9988);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _aeLance === 'function' && typeof killMonster === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = player.cls || 'warrior'; player.level = 60; player._god = true; player.invulnerable = 9e9;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  loadMap('forest', 300); game.paused = false; await sleep(1200);
  game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
  const m = spawnMonster(player.x + 400, player.y - 200, 'aetherion', true);
  try { _dismissBossIntro(); } catch (e) {}
  game.paused = true;   // nothing moves or resolves while we set up and kill
  _aeLance(m, 0, 4.6, 1, 0.5); _aeLance(m, 1.2, 4.6, 1, 0.5);
  _aeColumn(player.x + 10, 118, 42, m.atk || 460, "Aetherion's Fracture", 14);
  _aeColumn(player.x + 200, 96, 48, m.atk || 460, "Aetherion's Sky-Break", 22, '#ffffff');
  // control: somebody else's projectile and hazard
  game.projectiles.push({ x: player.x + 300, y: player.y, vx: -2, vy: 0, w: 20, h: 20, life: 200, damage: 10, owner: 'enemy', skill: 'splash', _srcType: 'slime' });
  game.hazards.push({ type: 'meteor_warn', cx: player.x + 400, x: player.x + 350, y: 0, w: 100, h: 500, radius: 50, life: 60, maxLife: 60, fireAt: 60, owner: 'enemy', damage: 5, _sourceLabel: 'Test Meteor' });
  const before = { lances: game.projectiles.filter((p) => p.skill === 'maeshard').length, cols: game.hazards.filter((h) => /^Aetherion/.test(h._sourceLabel || '')).length };
  killMonster(m);
  const after = {
    lances: game.projectiles.filter((p) => p.skill === 'maeshard').length,
    cols: game.hazards.filter((h) => /^Aetherion/.test(h._sourceLabel || '')).length,
    ctlProj: game.projectiles.filter((p) => p.skill === 'splash').length,
    ctlHaz: game.hazards.filter((h) => h._sourceLabel === 'Test Meteor').length,
  };
  game.paused = false;
  return { before, after };
});
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(R.before.lances === 2 && R.before.cols === 2, 'setup: two Shard Lances and two columns in the air before the kill', R.before);
ok(R.after.lances === 0, 'his Shard Lances die with him (homing, up to half the bar)', R.after);
ok(R.after.cols === 0, 'his meteor columns (Fracture / Shardfall / Sky-Break) die with him', R.after);
ok(R.after.ctlProj === 1 && R.after.ctlHaz === 1, 'CONTROL: another source\'s projectile and hazard survive his death', R.after);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
