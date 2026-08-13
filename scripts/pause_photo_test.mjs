// PAUSE SAFETY + PHOTO MODE KEYS - the two reported traps, driven in-engine.
// =============================================================================
//   1. PAUSE   a paused co-op player takes no damage; the world keeps stepping
//   2. SOLO    unchanged (was already safe)
//   3. PHOTO   held O = ONE toggle; Escape exits; arrows move again after
// Run: node scripts/pause_photo_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9138;
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
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  loadMap('forest'); game.paused = false; game.dying = false;
  player.cls = player.cls || 'warrior';
  const gp = (game.mapData.platforms || []).find(p => p.type === 'ground');

  const setup = () => {
    game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;
    player.level = 40; player.maxHp = 5000; player.hp = 5000;
    player.invulnerable = 0; player.hitStun = 0; game.dying = false;
    player.x = 900; player.y = gp.y - player.h; player.vy = 0;
    const m = spawnMonster(900, gp.y - 60, 'stump', false, false);
    if (m) { m.x = player.x; m.y = gp.y - m.h; }
    return m;
  };
  const pausedFrames = (n) => {
    game.paused = true;
    for (let i = 0; i < n; i++) {
      game.time++;
      if (game.paused && !document.hidden && typeof _lxCoopWorldStep === 'function') _lxCoopWorldStep(16.667);
    }
    game.paused = false;
  };

  // -- 1. co-op: paused player is safe, world still moves ------------------
  net.connected = true; net.myId = 1;
  net.peers = { 2: { map: game.currentMap, hp: 100, name: 'P2' } };
  net.ws = { readyState: 1, send: () => {} };
  ok('co-op session is active for the test', typeof _coopActive === 'function' && _coopActive());
  {
    const m = setup();
    // park the monster off the player so its movement is observable
    m.x = player.x - 300; const mx0 = m.x;
    const hp0 = player.hp;
    pausedFrames(240);
    ok('a paused co-op player takes NO damage', player.hp === hp0, `hp ${hp0} -> ${player.hp}`);
    ok('the world keeps running for the room while one player is paused',
       Math.abs(m.x - mx0) > 1, `monster moved ${(m.x - mx0).toFixed(1)} px`);
  }
  {
    setup();
    player.hp = 60;
    pausedFrames(600);
    ok('a paused co-op player cannot die', player.hp === 60 && !game.dying, `hp ${player.hp}, dying=${!!game.dying}`);
  }
  // unpaused co-op must still hurt — pause is the shield, not co-op itself.
  // STOP AT THE FIRST HIT: running to 0 HP fires triggerDeath, whose overlay
  // timers can asynchronously re-pause the game and contaminate the photo-mode
  // movement assertions below (observed as an intermittent x 600 -> 600).
  {
    const m = setup();
    const hp0 = player.hp;
    game.paused = false;
    // Contact is facing-gated and the AI wanders, so an unpinned stump can
    // spend the whole window walking away (observed as an intermittent
    // hp 5000 -> 5000). Re-pin it onto the player, facing them, every frame.
    for (let i = 0; i < 600 && player.hp === hp0; i++) {
      game.time++; player.invulnerable = 0;
      if (m) { m.x = player.x; m.y = player.y; m.facing = 1; m.vx = 0; m.vy = 0; }
      try { _lxCoopWorldStep(16.667); } catch (e) {}
    }
    ok('an UNPAUSED co-op player still takes contact damage', player.hp < hp0, `hp ${hp0} -> ${player.hp}`);
    game.monsters.length = 0;   // nothing left to interfere with the photo tests
  }
  net.connected = false; net.ws = null; net.peers = {};

  // -- 2. photo mode -------------------------------------------------------
  const key = (k, opts = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));
  const keyUp = (k) => window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true }));
  if (game._photoMode) { key('o'); keyUp('o'); }

  // a held key fires 1 real press + N auto-repeats: must be ONE toggle
  key('o');
  for (let i = 0; i < 5; i++) key('o', { repeat: true });
  keyUp('o');
  ok('holding O toggles photo mode exactly once', game._photoMode === true, `photoMode=${!!game._photoMode} after 1 press + 5 repeats`);

  // Escape gets you out
  key('Escape'); keyUp('Escape');
  ok('Escape exits photo mode', !game._photoMode, `photoMode=${!!game._photoMode}`);
  ok('the photo chrome is gone after Escape',
     document.getElementById('photo-bar').style.display === 'none' && !document.body.classList.contains('photo-mode'));

  // arrows move the character again, and do not pan
  {
    // The unpaused-contact assertion above ran the player to 0 HP, and a dead
    // player does not walk — revive fully before measuring movement.
    game.dying = false; player.hp = 5000; player.hitStun = 0; player.invulnerable = 0;
    game.paused = false; player.vx = 0;
    player.x = 600; player.y = gp.y - player.h; player.vy = 0; player.onGround = true;
    const x0 = player.x;
    const pan0 = JSON.stringify(game._photoPan || {});
    key('ArrowRight');
    for (let i = 0; i < 10; i++) { game.time++; try { updatePlayer(16.667); } catch (e) {} }
    keyUp('ArrowRight');
    ok('arrows move the character after exiting photo mode', player.x > x0, `x ${x0.toFixed(0)} -> ${player.x.toFixed(0)}`);
    ok('arrows no longer pan the camera', JSON.stringify(game._photoPan || {}) === pan0);
  }
  // while IN photo mode arrows still pan (the feature is intact)
  {
    key('o'); keyUp('o');
    const px0 = (game._photoPan || {}).x || 0;
    key('ArrowRight');
    ok('arrows still pan while photo mode is genuinely on', ((game._photoPan || {}).x || 0) > px0,
       `pan.x ${px0} -> ${(game._photoPan || {}).x}`);
    key('o'); keyUp('o');   // leave clean
  }
  return res;
});

let pass = 0, failed = 0;
for (const r of R) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
