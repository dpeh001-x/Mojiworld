// NECROMANCER KIT — uptime / parity guard.
// ============================================================================
// Per user: "Necromancer (Mage 2nd Advancement) can feel very weak, buff its skills
// even more."
//
// Measured across 60 s in four scenarios (pinned dummies, a free swarm, a
// single boss-like target, and a constantly-moving player) the Necromancer was
// already the top or near-top mage master for raw damage — so the complaint is
// not throughput. It is DEAD TIME: Soul Vortex ran a 45 s cooldown on a pool
// that only lives 30 s, leaving 15 s per cycle with the signature skill simply
// gone and no way to re-drop it when the fight moved. The engine already
// concedes this — necromancer_ult was rebuilt to travel with the player precisely
// because the pool's "one weakness is that the fight can leave it".
//
// Simulated DPS is far too noisy to assert on here (the same build measured
// 341k then 195k single-target across runs), so this guard checks the
// DETERMINISTIC properties that were actually changed, and reads the vortex's
// damage off a hazard the engine really spawned rather than off source text.
//
// RETUNED SINCE, PER USER (the buff numbers below are no longer the design):
//   - v0.30.174 (0c0ae5ae) the user's tuner patch set the DECLARED cd 30 -> 40 s
//     on purpose ("the deliberate correction to the skill that measured the
//     highest throughput"); it stays the longest mage slot-x by design. The
//     APPLIED cooldown after baseline CDR (~20 s) is still inside the 30 s pool,
//     so the no-dead-window promise is checked against the cooldown the engine
//     really sets, and a recast RELOCATES the pool (one pool, v0.30.171).
//   - v0.30.284 (054a883c, "warlock nerf per user") cut the drain 2.2 -> 1.1x
//     and the user's Skill Editor patch v0.30.785 (3c51eff1) set it to 1.2x.
// Run: node scripts/necromancer_buff_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9323);
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
await page.fill('#hero-name-input', 'NecromancerTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  player.level = 99; player._god = true;
  player.job = 'warlock'; player.master = 'necromancer';
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 1200));
  game.paused = false;
  player.baseAtk = 1000; player.maxMp = 99999; player.mp = 99999;
  player.skillCooldowns = {}; player._castLockUntil = 0;

  // Cast the real skill and read the pool the engine actually created.
  game.hazards.length = 0;
  castSkill('necromancer_harvest');
  const pool = (game.hazards || []).find(h => h && h.type === 'soul_vortex') || null;
  const atkAtCast = getAtk();
  // pool life is in frames at 60 fps
  const poolLifeMs = pool ? (pool.life / 60) * 1000 : 0;
  // per-second rate: dmg is floor(h.atk * TICK/60) applied every TICK frames
  const perSecond = pool ? pool.atk : 0;
  // the cooldown the engine actually applied (declared cd after CDR)
  const appliedCd = (player.skillCooldowns || {}).necromancer_harvest || 0;
  // an early recast relocates the pool: never two live pools
  player.skillCooldowns = {}; player._castLockUntil = 0; player.mp = 99999;
  castSkill('necromancer_harvest');
  const poolsAfterRecast = (game.hazards || []).filter(h => h && h.type === 'soul_vortex').length;

  const cds = {};
  for (const id of ['necromancer_harvest', 'hexmaster_grandhex', 'sage_meteorshower',
                    'elementalist_cascade', 'archbishop_grail',
                    'necromancer_ult', 'hexmaster_ult', 'sage_ult',
                    'elementalist_ult', 'archbishop_ult']) {
    cds[id] = SKILLS[id] ? SKILLS[id].cd : null;
  }
  return {
    cds, poolLifeMs, perSecond, atkAtCast, appliedCd, poolsAfterRecast,
    ratio: pool ? +(pool.atk / atkAtCast).toFixed(3) : 0,
    harvestDesc: SKILLS.necromancer_harvest.desc,
    spawned: !!pool,
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 120) });

const xPeers = ['hexmaster_grandhex', 'sage_meteorshower', 'elementalist_cascade', 'archbishop_grail'];
const ultPeers = ['hexmaster_ult', 'sage_ult', 'elementalist_ult', 'archbishop_ult'];
const maxXPeer = Math.max(...xPeers.map(k => R.cds[k]));
const maxUltPeer = Math.max(...ultPeers.map(k => R.cds[k]));

ok('Soul Vortex actually spawns a pool', R.spawned);
// The core fix: no window where the signature skill is unavailable AND expired.
// v0.30.174: judged on the APPLIED cooldown (declared 40 s after CDR).
ok('Soul Vortex has no dead window (applied cd <= pool life)',
   R.appliedCd > 0 && R.appliedCd <= R.poolLifeMs,
   `appliedCd=${R.appliedCd / 1000}s (declared ${R.cds.necromancer_harvest / 1000}s) poolLife=${R.poolLifeMs / 1000}s`);
ok('declared cd is the user-tuned 40 s (v0.30.174)',
   R.cds.necromancer_harvest === 40000, `necromancer=${R.cds.necromancer_harvest / 1000}s longestPeer=${maxXPeer / 1000}s`);
ok('an early recast relocates the pool (one live pool)', R.poolsAfterRecast === 1, `${R.poolsAfterRecast} pool(s)`);
// v0.30.284 nerf per user, v0.30.785 user patch: 1.2x
ok('Soul Vortex drains at 2.4x ATK/sec (the user-tuned 1.2x, doubled in v0.30.1604)',
   Math.abs(R.ratio - 2.4) < 0.01, `measured ${R.ratio}x ATK/sec off the live hazard`);
ok('tooltip states the rate the code actually applies',
   R.harvestDesc.includes(`${+R.ratio.toFixed(2)}×`), R.harvestDesc.slice(0, 100));
ok('Necrotic Ascendance is not the longest ult in the mage set',
   R.cds.necromancer_ult <= maxUltPeer, `necromancer=${R.cds.necromancer_ult / 1000}s longestPeer=${maxUltPeer / 1000}s`);

// (the ">= 50% more output per minute" check measured the v0.29.865 buff,
// which the user reversed in v0.30.284 - retired with it.)

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
