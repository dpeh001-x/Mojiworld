// THE MONSTER PLANT VET. Per user, after Path's Bane sank into the floor: "vet other monsters as well". Every grounded
// monster was drawn through the game's own _drawMonsterSprite on a flat canvas; the house plant is feet ~2-6 px into
// the floor (+ = into the floor). This pins what the vet fixed:
//   - SUNK: the Ossuary Tyrant (27 px) and Blight Elder (21 px) stand 2-8 px deep again - their plant offsets predated
//     two changes to their draw scale
//   - ATTACK DROP: the Forgewight's attack starts where its idle stands (it dropped 8 px - a calib dy from before attack
//     frames were planted by their own feet)
//   - STILL SIZE: Octobaby's arms draw their still (shown before their frames decode) at their frames' size - a tinted
//     copy was drawn with no size and came out 37% too big, 80-100 px into the floor
//   [PORT=13904] node scripts/mob_plant_vet_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '13904'; let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d) : '')); ok ? pass++ : fail++; };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _drawMonsterSprite === 'function', null, { timeout: 180000 });
const R = await page.evaluate(async () => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  document.documentElement.classList.remove('lx-nobackdrop');
  player._god = true; loadMap('forest', 300); await W8(2500); game.paused = true;
  const cv = document.querySelector('canvas'), c2 = cv.getContext('2d'), W = cv.width, H = cv.height, out = {};
  for (const type of ['ossuaryTyrant', 'blightElder', 'forgewight', 'octoLegFreeze', 'octoLegStun', 'octoLegSkillLock']) {
    const m = spawnMonster(player.x + 120, player.y - 100, type, false); const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1);
    m.facing = 1; m.vx = 0; m.vy = 0; m.freezeTimer = m.burnTimer = m.stunTimer = 0;
    const set = _monsterFramesFor(type), ready = (im) => im && (im.naturalWidth || im.width);
    for (let t = 0; t < 120 && !(ready(MONSTER_SPRITES[type]) && ['idle', 'attack'].every((s) => set[s] && set[s].length && set[s].every(ready))); t++) await W8(250);
    const sx = Math.round(W / 2 - m.w / 2), sy = Math.round(H - 140 - m.h), lineY = sy + m.h, orig = window._monsterStateFrame;
    const meas = (img, isAtk) => {
      window._monsterStateFrame = () => { m._frameIsAttack = !!isAtk; return img; };
      m._frameIsAttack = !!isAtk;
      c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.fillStyle = '#00ff00'; c2.fillRect(0, 0, W, H); _drawMonsterSprite(m, sx, sy); c2.restore();
      const d = c2.getImageData(0, 0, W, H).data; let top = -1, bot = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 2) { const k = (y * W + x) * 4; if (d[k] + Math.abs(d[k + 1] - 255) + d[k + 2] > 90) { if (top < 0) top = y; bot = y; break; } }
      return { h: bot - top + 1, bury: bot - lineY + 1 };
    };
    out[type] = { still: meas(null, false), idle: meas(set.idle[0], false), attack: meas(set.attack[0], true) };
    window._monsterStateFrame = orig;
  }
  return out;
});
console.log(JSON.stringify(R));
const inHouse = (b) => b >= 2 && b <= 8;
check(inHouse(R.ossuaryTyrant.idle.bury) && inHouse(R.blightElder.idle.bury), 'SUNK: the Ossuary Tyrant and Blight Elder stand 2-8 px into the floor (were 27 and 21)', { ossuaryTyrant: R.ossuaryTyrant.idle.bury, blightElder: R.blightElder.idle.bury });
check(Math.abs(R.forgewight.attack.bury - R.forgewight.idle.bury) <= 2, 'ATTACK DROP: the Forgewight\'s attack starts where its idle stands (it dropped 8 px)', { idle: R.forgewight.idle.bury, attack: R.forgewight.attack.bury });
const legs = ['octoLegFreeze', 'octoLegStun', 'octoLegSkillLock'];
check(legs.every((t) => Math.abs(R[t].still.h / R[t].idle.h - 1) <= 0.05 && Math.abs(R[t].still.bury - R[t].idle.bury) <= 3), 'STILL SIZE: Octobaby\'s arms draw their still at their frames\' size and depth (was 37% too big, 80-100 px deep)', legs.map((t) => ({ t, still: R[t].still, idle: R[t].idle })));
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
