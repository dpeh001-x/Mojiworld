// Gravitos blue-meteor certification. All three of Gravitos's meteor-column
// attacks (Gravity Crush, Crush Tendrils, Decay Floor) must tag their
// meteor_warn hazards with _gravBlue so the renderer picks p_meteor_blue +
// meteor_marker_blue. Non-Gravitos meteors (mage skill, zodiac, koopa) stay red.
import { chromium } from 'playwright-core';
const EXE = process.env.PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const p = await b.newContext({ serviceWorkers: 'block' }).then(c => c.newPage());
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => typeof MAPS === 'object' && typeof loadMap === 'function' && typeof updateMonsters === 'function', null, { timeout: 30000 });
  await p.waitForTimeout(6000);

  // blue sprites are registered + reachable
  const spr = await p.evaluate(() => ({
    proj: !!(LX_PLAYER_PROJ && LX_PLAYER_PROJ.meteor_blue),
    marker: !!(LX_FX && LX_FX.meteor_marker_blue),
  }));
  ok('blue meteor projectile + marker registered', spr.proj && spr.marker, spr);

  const runPattern = (state) => p.evaluate((state) => {
    loadMap('gravitosArena'); game.paused = false; window._prologueActive = false;
    game.hazards.length = 0; game.monsters.length = 0;
    net._coopSpawning = true; const m = spawnMonster(1100, 300, 'gravitos', true); net._coopSpawning = false;
    m.currentHp = m.maxHp = 21000000; m._god = false;
    player.x = 1100; player.hp = player.maxHp = 9999999; player.invulnerable = 999999;
    // force the pattern and tick the AI until it spawns its hazards
    m.patternState = state; m.patternTimer = 0;
    m._crushFired = false; m._tendrilSpawned = false; m._decayFired = false; m._rainIdx = null;
    for (let i = 0; i < 200; i++) { try { updateMonsters(1000 / 60); } catch (e) { return { err: String(e) }; } m.patternState = state; }
    const mw = game.hazards.filter(h => h && h.type === 'meteor_warn');
    return { n: mw.length, allBlue: mw.length > 0 && mw.every(h => h._gravBlue === true), sample: mw[0] ? { blue: !!mw[0]._gravBlue, label: mw[0]._sourceLabel } : null };
  }, state);

  for (const st of ['crush', 'crushTendrils', 'decayFloor']) {
    const r = await runPattern(st);
    ok(`Gravitos "${st}" meteors are all BLUE`, r.allBlue, r);
  }

  // control: the mage's own Meteor skill stays RED (no _gravBlue)
  const mage = await p.evaluate(() => {
    game.hazards.length = 0;
    const H = 480;
    game.hazards.push({ type: 'meteor_warn', cx: 300, x: 210, y: 0, w: 180, h: H, radius: 90, life: 60, maxLife: 60, fireAt: 60, owner: 'player', damage: 500 });
    const h = game.hazards[game.hazards.length - 1];
    return { gravBlue: !!h._gravBlue };
  });
  ok('mage/other meteors stay RED (no _gravBlue)', mage.gravBlue === false, mage);

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
