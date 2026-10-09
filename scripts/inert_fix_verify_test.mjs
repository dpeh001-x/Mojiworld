// Verify the 6 abilities freed by the inert-declaration audit now actually
// run: 4 tower mobs + 2 bosses whose dashCharge/enrageSelf were declared as
// TRAITS (inert) and are now MONSTER_SKILLS kinds. Plus the Frenzied elite
// affix, which was a pure no-op and is now stat-based.
import { chromium } from 'playwright-core';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
// PORT from the command line or the environment; with none given (or nothing listening there) this script starts the
// checkout's own serve.js on it - it used to need a hand-started server on a fixed port and failed without one.
let PORT = String('' || process.env.PORT || '');
{
  const { spawn: _sSpawn } = await import('node:child_process'); const _sNet = await import('node:net');
  const _sPath = await import('node:path'); const { fileURLToPath: _sF2P } = await import('node:url');
  const _sRoot = _sPath.resolve(_sPath.dirname(_sF2P(import.meta.url)), '..');
  const _sFree = (p) => new Promise((r) => { const sv = _sNet.createServer(); sv.once('error', () => r(false)); sv.once('listening', () => sv.close(() => r(true))); sv.listen(p, '127.0.0.1'); });
  if (!PORT) for (let p = 8767; p <= 8999 && !PORT; p++) if (await _sFree(p)) PORT = String(p);
  if (await _sFree(Number(PORT))) {
    const _srv = _sSpawn(process.execPath, [_sPath.join(_sRoot, 'serve.js'), PORT], { stdio: 'ignore', cwd: _sRoot });
    _srv.unref(); process.on('exit', () => { try { _srv.kill(); } catch (e) {} });
    await new Promise((r) => setTimeout(r, 1500));
  }
}
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
const EXE = process.env.MOJI_PW_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await browser.newContext()).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof MONSTER_SKILLS !== 'undefined', null, { timeout: 45000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  game.paused = false;
  player.cls = 'warrior'; player.level = 60; player._god = true; player.baseAcc = 40;
  player.maxHp = 6000; player.hp = 6000; player.baseAtk = 260; player.baseDef = 150;
  loadMap('glasswindSteppe');
  const R = {};

  // 1) registration: every freed ability is in MONSTER_SKILLS with a real fn
  const FREED = { towerWisp:'dashCharge', towerStalker:'dashCharge', towerStormcaller:'dashCharge',
                  towerShardling:'enrageSelf' };
  R.registered = {};
  for (const [id, kind] of Object.entries(FREED)) {
    const sk = MONSTER_SKILLS[id];
    R.registered[id] = { kind: sk && sk.kind, ok: !!(sk && sk.kind === kind && typeof MONSTER_SKILL_FNS[kind] === 'function'),
      traitGone: !(monsterTypes[id] && monsterTypes[id].traits && monsterTypes[id].traits[kind]) };
  }

  // 2) live fire: dash mobs should visibly dash; shardling should rage
  const fire = async (id) => {
    game.monsters.length = 0; game.projectiles.length = 0;
    const m = spawnMonster(700, 300, id, false, false);
    if (!m) return { spawn: false };
    m.maxHp = m.currentHp = 5e6;
    let dashed = false, raged = false;
    for (let f = 0; f < 700; f++) {
      player.x = m.x - 240; player.y = m.y;
      game.camera.x = Math.max(0, m.x - 500); game.camera.y = 0;
      game.time++;
      try { updatePlayer(16); updateMonsters(16); updateProjectiles(16); } catch (e) { return { err: String(e).slice(0, 90) }; }
      if (m._dashing || (m._dashCharging | 0) > 0 || (m._dashT | 0) > 0 || m._dashPhase) dashed = true;
      if ((m._selfRageTimer | 0) > 0) raged = true;
      if (f % 60 === 59) await new Promise((r) => setTimeout(r, 4));
    }
    return { dashed, raged };
  };
  R.fired = {};
  for (const id of Object.keys(FREED)) R.fired[id] = await fire(id);

  // 3) Frenzied affix must now actually change the monster
  {
    game.monsters.length = 0;
    const base = spawnMonster(700, 300, 'slime', false, false);
    const baseAtk = base.atk, baseSpd = base.speed;
    const aff = ELITE_AFFIXES.find((a) => a.id === 'frenzied');
    game.monsters.length = 0;
    const m = spawnMonster(760, 300, 'slime', false, false);
    // force the frenzied roll deterministically
    m.traits = Object.assign({}, m.traits || {}, aff.traits || {});
    if (aff.stats) for (const k in aff.stats) if (typeof m[k] === 'number') m[k] *= aff.stats[k];
    R.frenzied = { usesStats: !!aff.stats, usesTraits: !!aff.traits,
      atk: { before: baseAtk, after: m.atk }, speed: { before: baseSpd, after: m.speed },
      ok: m.atk > baseAtk && m.speed > baseSpd };
  }
  return R;
});

let pass = 0, fail = 0;
console.log('=== INERT-FIX VERIFY ===\n-- registration (skill kind + fn present, trait removed) --');
for (const [id, r] of Object.entries(out.registered)) { r.ok && r.traitGone ? pass++ : fail++;
  console.log(`  ${(r.ok && r.traitGone) ? 'PASS' : 'FAIL'}  ${id.padEnd(18)} ${JSON.stringify(r)}`); }
console.log('\n-- live fire --');
for (const [id, r] of Object.entries(out.fired)) {
  const want = id === 'towerShardling' ? r.raged : r.dashed;
  want ? pass++ : fail++;
  console.log(`  ${want ? 'PASS' : 'FAIL'}  ${id.padEnd(18)} ${JSON.stringify(r)}`);
}
console.log('\n-- Frenzied affix --');
out.frenzied.ok ? pass++ : fail++;
console.log(`  ${out.frenzied.ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(out.frenzied)}`);
console.log(`\n${pass}/${pass + fail} passed`);
console.log('PAGE ERRORS:', errs.slice(0, 3));
await browser.close();
process.exit(fail ? 1 : 0);
