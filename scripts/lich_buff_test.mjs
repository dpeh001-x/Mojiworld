// LICH KIT — uptime / parity guard.
// ============================================================================
// Per user: "Lich (Mage 2nd Advancement) can feel very weak, buff its skills
// even more."
//
// Measured across 60 s in four scenarios (pinned dummies, a free swarm, a
// single boss-like target, and a constantly-moving player) the Lich was
// already the top or near-top mage master for raw damage — so the complaint is
// not throughput. It is DEAD TIME: Soul Vortex ran a 45 s cooldown on a pool
// that only lives 30 s, leaving 15 s per cycle with the signature skill simply
// gone and no way to re-drop it when the fight moved. The engine already
// concedes this — lich_ult was rebuilt to travel with the player precisely
// because the pool's "one weakness is that the fight can leave it".
//
// Simulated DPS is far too noisy to assert on here (the same build measured
// 341k then 195k single-target across runs), so this guard checks the
// DETERMINISTIC properties that were actually changed, and reads the vortex's
// damage off a hazard the engine really spawned rather than off source text.
// Run: node scripts/lich_buff_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9323;
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
await page.fill('#hero-name-input', 'LichTest');
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
  player.job = 'warlock'; player.master = 'lich';
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 1200));
  game.paused = false;
  player.baseAtk = 1000; player.maxMp = 99999; player.mp = 99999;
  player.skillCooldowns = {}; player._castLockUntil = 0;

  // Cast the real skill and read the pool the engine actually created.
  game.hazards.length = 0;
  castSkill('lich_harvest');
  const pool = (game.hazards || []).find(h => h && h.type === 'soul_vortex') || null;
  const atkAtCast = getAtk();
  // pool life is in frames at 60 fps
  const poolLifeMs = pool ? (pool.life / 60) * 1000 : 0;
  // per-second rate: dmg is floor(h.atk * TICK/60) applied every TICK frames
  const perSecond = pool ? pool.atk : 0;

  const cds = {};
  for (const id of ['lich_harvest', 'hexmaster_grandhex', 'sage_meteorshower',
                    'elementalist_cascade', 'archbishop_grail',
                    'lich_ult', 'hexmaster_ult', 'sage_ult',
                    'elementalist_ult', 'archbishop_ult']) {
    cds[id] = SKILLS[id] ? SKILLS[id].cd : null;
  }
  return {
    cds, poolLifeMs, perSecond, atkAtCast,
    ratio: pool ? +(pool.atk / atkAtCast).toFixed(3) : 0,
    harvestDesc: SKILLS.lich_harvest.desc,
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
ok('Soul Vortex has no dead window (cd <= pool life)',
   R.cds.lich_harvest <= R.poolLifeMs,
   `cd=${R.cds.lich_harvest / 1000}s poolLife=${R.poolLifeMs / 1000}s`);
ok('Soul Vortex is no longer the longest slot-x in the mage set',
   R.cds.lich_harvest <= maxXPeer,
   `lich=${R.cds.lich_harvest / 1000}s longestPeer=${maxXPeer / 1000}s`);
ok('Soul Vortex drains at the buffed 2.2x ATK/sec',
   Math.abs(R.ratio - 2.2) < 0.01, `measured ${R.ratio}x ATK/sec off the live hazard`);
ok('tooltip states the rate the code actually applies',
   R.harvestDesc.includes('2.2×'), R.harvestDesc.slice(0, 100));
ok('Necrotic Ascendance is not the longest ult in the mage set',
   R.cds.lich_ult <= maxUltPeer, `lich=${R.cds.lich_ult / 1000}s longestPeer=${maxUltPeer / 1000}s`);

// sustained vortex throughput per minute — the figure the buff targets
const before = 1.8 * 30 * (60 / 45);
const after = (R.perSecond / R.atkAtCast) * (R.poolLifeMs / 1000) * (60 / (R.cds.lich_harvest / 1000));
ok('sustained vortex output per minute improved >= 50%', after >= before * 1.5,
   `${before.toFixed(0)}x ATK/min -> ${after.toFixed(0)}x ATK/min`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
