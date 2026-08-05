// Monster Plant Spawn / Kill-all certification.
//   1. Spawn button adds exactly ONE mob of the selected type near the player.
//   2. Kill-all removes every hostile mob on the field...
//   3. ...but KEEPS the player's own allies / summons.
//   4. Repeated spawns each add exactly one (spawn is per-click, not toggle).
//   5. Kill-all on an empty field is a safe no-op.
import { chromium } from 'playwright-core';
const EXE = process.env.PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem('LX_DEV', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof _lxMpToggle === 'function' && typeof _lxMpSpawn === 'function' && typeof _lxMpKillAll === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    try { player.cls = player.cls || 'warrior'; game.paused = false; window._prologueActive = false; } catch (e) {}
    loadMap('town');
    game.monsters.length = 0;                     // clean slate
    _lxMpToggle();                                // open the overlay
    _lxMpSelect('mushpup');
  });

  const countType = (t) => page.evaluate((t) => game.monsters.filter(m => m && m.type === t && m.currentHp > 0 && !m._suppressed).length, t);

  // 1) Spawn exactly one
  const before = await countType('mushpup');
  await page.evaluate(() => _lxMpSpawn());
  const after1 = await countType('mushpup');
  ok('Spawn adds exactly one mushpup', after1 - before === 1, { before, after1 });

  // 4) Each click spawns one more
  await page.evaluate(() => { _lxMpSpawn(); _lxMpSpawn(); });
  const after3 = await countType('mushpup');
  ok('three spawn clicks → three mushpups total', after3 === 3, { after3 });

  // spawn a DIFFERENT type + a player ally to prove selectivity
  await page.evaluate(() => {
    _lxMpSelect('slime'); _lxMpSpawn();
    // fabricate a player-owned ally that kill-all must keep
    const ally = { type: 'ally_test', x: player.x + 30, y: player.y, w: 32, h: 32, currentHp: 100, maxHp: 100, ally: true, _playerOwned: true, facing: 1 };
    game.monsters.push(ally);
  });
  const preKill = await page.evaluate(() => ({
    total: game.monsters.filter(m => m && m.currentHp > 0).length,
    hostile: game.monsters.filter(m => m && m.currentHp > 0 && !m.ally && !m.isSummon && !m._playerOwned).length,
    allies: game.monsters.filter(m => m && m.ally).length,
  }));
  ok('field has hostiles + a kept ally before kill-all', preKill.hostile >= 4 && preKill.allies === 1, preKill);

  // 2+3) Kill all
  await page.evaluate(() => _lxMpKillAll());
  const postKill = await page.evaluate(() => ({
    hostile: game.monsters.filter(m => m && m.currentHp > 0 && !m.ally && !m.isSummon && !m._playerOwned).length,
    allies: game.monsters.filter(m => m && m.ally && m.currentHp > 0).length,
  }));
  ok('kill-all removes every hostile mob', postKill.hostile === 0, postKill);
  ok('kill-all KEEPS the player-owned ally', postKill.allies === 1, postKill);

  // 5) empty-field no-op (allies remain, no throw)
  await page.evaluate(() => { game.monsters = game.monsters.filter(m => m && m.ally); });
  const emptyOk = await page.evaluate(() => { try { _lxMpKillAll(); return true; } catch (e) { return String(e); } });
  ok('kill-all on an all-ally field is a safe no-op', emptyOk === true, { emptyOk });

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
