// Per user: "For underwater maps, allow players to do multiple jumps midair up
// to 5 times."
//
// Budget checks read the helper; the behaviour checks drive the REAL input path
// (game.keys[' '] -> updatePlayer) and count jumps that actually fired, because
// asserting the constant would prove nothing about the gate that reads it.
//   node scripts/underwater_jumps_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _lxAirJumpCap === 'function' && typeof updatePlayer === 'function', { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = { caps: {}, maps: {} };
  game.paused = false;
  player.hp = Math.max(1, player.maxHp || 100);
  const md = game.mapData;
  const savedUW = md.isUnderwater, savedND = md.noDoubleJump, savedBonus = md.bonusJumps;
  const savedExtra = (player.mods && player.mods.extraJumps) || 0;
  const setExtra = (v) => { if (!player.mods) player.mods = {}; player.mods.extraJumps = v; };

  // --- A. the budget itself -------------------------------------------------
  const capWith = (uw, extra, bonus) => {
    md.isUnderwater = uw; setExtra(extra);
    if (bonus == null) delete md.bonusJumps; else md.bonusJumps = bonus;
    return _lxAirJumpCap();
  };
  out.caps.landPlain      = capWith(false, 0, null);
  out.caps.landWithBonus1 = capWith(false, 0, 1);
  out.caps.landWithTalent = capWith(false, 1, null);
  out.caps.water          = capWith(true, 0, 1);
  out.caps.waterNoBonus   = capWith(true, 0, null);
  out.caps.waterBigTalent = capWith(true, 8, 1);   // floor must not CAP an earned budget
  out.caps.constant       = LX_UNDERWATER_AIR_JUMPS;

  // --- B. every shipped underwater map is covered --------------------------
  for (const id in MAPS) {
    const m = MAPS[id];
    if (m && m.isUnderwater) out.maps[id] = { bonusJumps: m.bonusJumps || 0, gravityMul: m.gravityMul };
  }

  // --- C. drive the real input path and count jumps that fired -------------
  // `bonus` is the map's own bonusJumps — passed explicitly, because forcing it
  // to 1 everywhere silently adds a jump to the land cases and makes the
  // expected counts wrong rather than the code.
  const countJumps = (uw, noDouble, extra, bonus) => {
    md.isUnderwater = uw;
    if (noDouble) md.noDoubleJump = true; else delete md.noDoubleJump;
    if (bonus == null) delete md.bonusJumps; else md.bonusJumps = bonus;
    setExtra(extra || 0);
    player.airJumps = 0; player.doubleJumpUsed = false;
    player._jumpHeld = false; player.jumpBufferTimer = 0;
    game.keys[' '] = false;
    let fired = 0, err = null;
    try {
      for (let i = 0; i < 12; i++) {
        // hold it airborne, out of coyote grace, high above any platform
        player.onGround = false; player.coyoteTime = 0;
        player.y = 60; player.vy = 0;
        const before = player.airJumps | 0;
        game.keys[' '] = true;   updatePlayer(16);
        if ((player.airJumps | 0) > before) fired++;
        game.keys[' '] = false;  updatePlayer(16);
      }
    } catch (e) { err = String(e).slice(0, 120); }
    game.keys[' '] = false;
    return err ? { err, fired } : fired;
  };
  out.fired = {
    water:      countJumps(true,  false, 0, 1),      // shipped water map: 1 + 0 + 1 -> floored to 5
    land:       countJumps(false, false, 0, null),   // vanilla dry land
    landBonus:  countJumps(false, false, 0, 1),      // a dry map that grants bonusJumps
    waterExtra: countJumps(true,  false, 8, 1),      // 1 + 8 + 1 = 10, above the floor
    waterNoDbl: countJumps(true,  true,  0, 1),
  };

  // --- D. touching the ground gives them all back --------------------------
  out.reset = (() => {
    md.isUnderwater = true; delete md.noDoubleJump; setExtra(0);
    player.airJumps = 4; player.doubleJumpUsed = true;
    player.onGround = true; player.vy = 0;
    updatePlayer(16);
    const after = player.airJumps | 0;
    player.onGround = false;
    return after;
  })();

  // restore everything we poked
  md.isUnderwater = savedUW;
  if (savedND == null) delete md.noDoubleJump; else md.noDoubleJump = savedND;
  if (savedBonus == null) delete md.bonusJumps; else md.bonusJumps = savedBonus;
  setExtra(savedExtra);
  player.airJumps = 0; game.keys[' '] = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('budgets      :', JSON.stringify(r.caps));
console.log('jumps fired  :', JSON.stringify(r.fired));
console.log('ground reset :', r.reset);
console.log('underwater maps:', JSON.stringify(r.maps, null, 0));

ok('underwater grants 5 mid-air jumps', r.caps.water === 5, r.caps);
ok('...with or without the map\'s old bonusJumps:1', r.caps.waterNoBonus === 5, r.caps);
ok('dry land is unchanged: 1 air jump', r.caps.landPlain === 1, r.caps);
ok('a non-underwater map\'s bonusJumps still adds on land', r.caps.landWithBonus1 === 2, r.caps);
ok('the aerial talent still adds on land', r.caps.landWithTalent === 2, r.caps);
ok('underwater is a FLOOR, not a cap — an earned bigger budget survives',
   r.caps.waterBigTalent === 10, r.caps);
ok('the constant is 5', r.caps.constant === 5, r.caps);

ok('pressing jump mid-air underwater fires exactly 5 times, then stops',
   r.fired.water === 5, r.fired);
ok('on vanilla dry land it still fires exactly once', r.fired.land === 1, r.fired);
ok('a dry map granting bonusJumps still fires twice', r.fired.landBonus === 2, r.fired);
ok('a player with +8 earned jumps gets all 10 underwater (floor does not cap)',
   r.fired.waterExtra === 10, r.fired);
ok('a map that opts out of air jumps still wins, underwater or not',
   r.fired.waterNoDbl === 0, r.fired);
ok('landing refills the whole budget', r.reset === 0, { airJumpsAfterLanding: r.reset });

ok('all five shipped underwater maps are covered by the flag',
   Object.keys(r.maps).length === 5, r.maps);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
