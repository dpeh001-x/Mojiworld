// LEGOSAURUS FIGHT - the three reported defects, driven in-engine.
// =============================================================================
//   1. POST-KILL   a quake must not detonate after its caster dies
//   2. DODGE       grounded takes the hit, jumping does not, and says so
//   3. ENTRANCE    no launch pad where the player walks in
//   4. SCOPE       the far escape pad and other quake casters still work
// Run: node scripts/legosaurus_fight_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9132;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const R = await page.evaluate(() => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay','boss-intro-overlay'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  loadMap('blockland_apex'); game.currentMap = 'blockland_apex'; game.paused = false;
  const gp = (game.mapData.platforms || []).find(p => p.type === 'ground');
  player.level = 70; player.maxHp = 99999;

  // The camera must track the player: mob_ hazards are culled when their
  // centre leaves the viewport, so a parked camera silently voids the test.
  const cam = () => {
    game.camera.x = Math.max(0, Math.min((game.mapData.worldWidth || 2000) - W, player.x + player.w / 2 - W / 2));
    game.camera.y = 0;
  };
  const arm = (airborne) => {
    game.monsters.length = 0; game.hazards.length = 0;
    player.hp = 99999; player.invulnerable = 0;
    player.x = 1080; player.vy = 0;
    player.y = gp.y - player.h - (airborne ? 120 : 0);
    const b = spawnMonster(1000, 300, 'legosaurus', true, false);
    b._legosaurusQuakeAt = (game.time | 0) - 1;
    try { _bossSpecialAttacks(b, 16.667); } catch (e) {}
    return b;
  };
  const runFrames = (n, onFrame) => {
    for (let i = 0; i < n; i++) {
      game.time++; cam(); player.invulnerable = 0;
      if (onFrame) onFrame(i);
      try { updateProjectiles(16.667); } catch (e) { return 'ERR ' + e.message; }
    }
    return null;
  };

  // -- 1. the quake still works at all (the control) -----------------------
  {
    const b = arm(false);
    ok('a quake is actually cast', game.hazards.some(h => h.type === 'mob_quake'));
    const hp0 = player.hp;
    runFrames(200);
    ok('a GROUNDED player takes the quake', player.hp < hp0, `lost ${hp0 - player.hp}`);
  }
  // -- 2. jumping dodges it, and says so -----------------------------------
  {
    arm(true);
    const hp0 = player.hp;
    const n0 = (game.damageNumbers || []).length;
    runFrames(200);
    ok('a JUMPING player takes nothing', player.hp === hp0, `lost ${hp0 - player.hp}`);
    const dodged = (game.damageNumbers || []).slice(n0).some(d => String(d.text) === 'DODGED!');
    ok('the successful dodge is shown to the player', dodged,
       dodged ? 'DODGED! shown' : 'no feedback — a dodge and a dud look identical');
  }
  // -- 3. THE POST-KILL BUG ------------------------------------------------
  {
    const b = arm(false);
    const hp0 = player.hp;
    const err = runFrames(200, (i) => {
      if (i !== 30) return;                       // kill mid-telegraph
      b.currentHp = 0; b.dead = true;
      const ix = game.monsters.indexOf(b); if (ix >= 0) game.monsters.splice(ix, 1);
    });
    ok('no error while resolving', !err, err || '');
    ok('a quake does NOT detonate after its caster dies', player.hp === hp0,
       player.hp === hp0 ? 'no damage on the victory lap' : `still took ${hp0 - player.hp}`);
    ok('the orphaned quake is cleaned up', !game.hazards.some(h => h.type === 'mob_quake'),
       `${game.hazards.length} hazards left`);
  }
  // -- 4. the entrance pad ------------------------------------------------
  {
    const pads = (MAPS.blockland_apex.launchPads || []);
    ok('the entrance launch pad is gone', !pads.some(p => p.x < 800),
       pads.map(p => `x${p.x}`).join(',') || 'none');
    ok('the far escape pad is kept', pads.some(p => p.x === 1690), `${pads.length} pad(s)`);
    // the player enters from the left; nothing should be sitting on top of them
    ok('nothing launches the player at the arena entrance',
       !pads.some(p => p.x <= 400), pads.map(p => `x${p.x}`).join(',') || 'none');
  }
  // (The shared groundStun quake used by other monsters is covered by the
  // source-level owner-tag check after this evaluate — asserting it here would
  // need one of those monsters spawned in this arena.)
  return res;
});

let pass = 0, failed = 0;
for (const r of R) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
// source-level: BOTH quake casters must tag their owner, or one boss keeps the bug
const fs = await import('node:fs');
const src = fs.readFileSync(path.join(ROOT, process.env.MOJI_GAME_FILE || 'mojiworld_game.html'), 'utf8');
const tagged = (src.match(/_owner: m,/g) || []).length;
const casts = (src.match(/type:\s*'mob_quake'/g) || []).length;
if (tagged === casts) { pass++; console.log(`  PASS  every mob_quake caster tags its owner  (${tagged}/${casts})`); }
else { failed++; console.log(`  FAIL  every mob_quake caster tags its owner  ${tagged}/${casts}`); }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
