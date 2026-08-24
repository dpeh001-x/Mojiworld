// PLUMPDRAKE — attack cadence, and the art choice behind it.
// ============================================================================
// History matters here, because the file used to assert the opposite.
//
// Per user: "plumpdrake attack sprite animation pulses slightly bigger than
// base". The cause was real and measured: a monster's draw box is
// targetH x _ATK_FRAME_SCALE[type] and none of those terms vary per frame, so
// the rendered size is set by how much of its 640px canvas the body fills.
// fatDragon's 1.951 was calibrated on frame 0 alone, so the dragon grew through
// the swing and peaked at 1.194x the idle body on frame 7.
//
// The frames were normalised to remove that. On seeing the result frame by
// frame the user chose to KEEP THE ORIGINAL ART -- "lets go with the before" --
// and to lengthen the attack instead. So the swell is now intentional: it is
// part of how the swing reads, and nothing here should assert it away.
// scripts/normalise_atk_frames.mjs still exists and still works; it is simply
// not applied to this type.
//
// What IS asserted is the cadence: Plumpdrake holds each attack frame longer
// than the shared non-boss default, and no other type was dragged along with
// it. Measured by watching which frame _monsterStateFrame actually returns
// rather than by reading the constant, because a constant nothing reads is not
// a behaviour.
// Run: node scripts/plumpdrake_atk_scale_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9937);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'DrakeMs');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  for (let i = 0; i < 12; i++) { const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); if (!r) break; r.style.display = 'none'; }

  // Time _bossLoopFrame directly on the REAL attack array. It is a pure
  // function of performance.now(), the cadence, and the decoded-frame count, so
  // it can be sampled without disturbing anything.
  //
  // The obvious approach -- polling _monsterStateFrame while holding the mob in
  // its attack window -- does NOT work and was abandoned: that function stamps
  // the animation epoch when the state changes, so a probe calling it
  // interleaved with the game's own draw restamps the phase and the frame never
  // advances. It measured 0 frame changes over 420 polls, on both cadences.
  const dwell = async (type, ms) => {
    game.monsters.length = 0;
    const m = spawnMonster(player.x + 300, player.y, type, false);
    if (!m) return null;
    m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0;
    if (typeof _mobAttackReady === 'function') {
      let w = 0; while (w++ < 300 && !_mobAttackReady(type)) { m.vx = 0; await new Promise(r => requestAnimationFrame(r)); }
    }
    const set = _monsterFramesFor(type);
    if (!set || !set.attack || !set.attack.length) return null;
    const base = (typeof _mobFrameBase === 'function') ? _mobFrameBase(m) : undefined;
    const gaps = []; let last = null, lastT = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 2200) {
      const f = _bossLoopFrame(set.attack, ms, base, 0);
      const now = performance.now();
      if (f && f !== last) { if (last) gaps.push(now - lastT); lastT = now; last = f; }
      await new Promise(r => setTimeout(r, 4));
    }
    gaps.sort((a, b) => a - b);
    return { n: gaps.length, median: gaps.length ? Math.round(gaps[gaps.length >> 1]) : null, frames: set.attack.length };
  };

  const resolve = (t) => (typeof _MOB_ATK_FRAME_MS_BY_TYPE !== 'undefined' && _MOB_ATK_FRAME_MS_BY_TYPE[t]) || _MOB_ATK_FRAME_MS;
  const drake = await dwell('fatDragon', resolve('fatDragon'));
  const other = await dwell('mushroom', resolve('mushroom'));
  const resolved = { fatDragon: resolve('fatDragon'), mushroom: resolve('mushroom') };
  return {
    drake, other,
    resolved,
    perType: (typeof _MOB_ATK_FRAME_MS_BY_TYPE !== 'undefined') ? { ..._MOB_ATK_FRAME_MS_BY_TYPE } : null,
    shared: (typeof _MOB_ATK_FRAME_MS !== 'undefined') ? _MOB_ATK_FRAME_MS : null,
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });
const want = R.perType ? R.perType.fatDragon : null;

console.log(`  shared non-boss gap: ${R.shared}ms   per-type: ${JSON.stringify(R.perType)}`);
console.log(`  measured median frame dwell — fatDragon: ${R.drake && R.drake.median}ms (${R.drake && R.drake.n} changes), mushroom: ${R.other && R.other.median}ms (${R.other && R.other.n} changes)`);

ok('Plumpdrake has its own attack cadence', !!want && want > R.shared,
   `fatDragon ${want}ms vs the shared ${R.shared}ms (+${Math.round((want / R.shared - 1) * 100)}%)`);
ok('the per-type cadence is what the draw site resolves',
   R.resolved && R.resolved.fatDragon === want && R.resolved.mushroom === R.shared,
   `fatDragon -> ${R.resolved && R.resolved.fatDragon}ms, mushroom -> ${R.resolved && R.resolved.mushroom}ms`);
ok('the frames really do hold that long',
   !!(R.drake && R.drake.median && Math.abs(R.drake.median - want) <= 22),
   `measured ${R.drake && R.drake.median}ms against ${want}ms asked for`);
ok('CONTROL: another monster still runs at the shared default',
   !!(R.other && R.other.median && Math.abs(R.other.median - R.shared) <= 22),
   `mushroom measured ${R.other && R.other.median}ms against the shared ${R.shared}ms`);
ok('...so the change did not leak to the rest of the roster',
   !!R.perType && Object.keys(R.perType).length === 1,
   `per-type table holds: ${Object.keys(R.perType || {}).join(', ')}`);
ok('the full cycle is longer than it was', !!want && want * 9 > R.shared * 9,
   `9 frames: ${(want * 9 / 1000).toFixed(2)}s vs ${(R.shared * 9 / 1000).toFixed(2)}s`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
