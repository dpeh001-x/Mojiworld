// OCTOBABY TENTACLES — size + defence.
// ============================================================================
// Per user: "reduce the size of the octababy tenctacles, and increase their def".
//
// Reads the LIVE legs the boss actually spawns (not the authored type table —
// the arena multiplies them by HUMONGOUS_SCALE, so the table's 80x60 is not
// what fights you), and measures mitigation by putting identical damage
// through the real hitMonster pipeline rather than recomputing the formula
// here — a test that re-implements 300/(defVal+300) would agree with itself
// whatever the code does.
//
// Also pins the things that must NOT move: the legs still spawn (4 of them),
// still anchor to the head, and are still killable — a "tankier" change that
// accidentally made them immortal would otherwise pass.
// Run: node scripts/octo_tentacle_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9391;
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
await page.fill('#hero-name-input', 'OctoTest');
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

const R = await page.evaluate(async () => {
  player.level = 99; player._god = true;
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 1400));
  game.paused = false;
  game.monsters.length = 0;

  // Spawn the head and let its AI create the legs.
  const head = spawnMonster(player.x + 400, player.y - 40, 'octobaby', true);
  if (!head) return { err: 'no head' };
  head.currentHp = head.maxHp;
  for (let f = 0; f < 120; f++) { game.time += 1; try { updateMonsters(16.667); } catch (e) {} }

  const LEGS = ['octoLegPoison', 'octoLegFreeze', 'octoLegSkillLock', 'octoLegStun'];
  const legs = game.monsters.filter(m => m && LEGS.includes(m.type));
  if (!legs.length) return { err: 'no legs spawned' };
  const leg = legs[0];
  const size = { w: leg.w, h: leg.h, area: leg.w * leg.h };

  // Anchoring: legs should sit near the head, not drift off.
  const hcx = head.x + head.w / 2;
  const maxOffset = Math.max(...legs.map(l => Math.abs((l.x + l.w / 2) - hcx)));

  // --- mitigation, measured through the REAL damage pipeline --------------
  // Identical raw damage into a leg vs a def-less control of the same type.
  const RAW = 10000;
  const measure = (target) => {
    target.currentHp = 1e9; target.maxHp = 1e9;
    target._defVar = 1;                 // pin the per-mob variance roll
    const before = target.currentHp;
    hitMonster(target, RAW, false, 'probe');
    return before - target.currentHp;
  };
  const dealtToLeg = measure(leg);
  // The four legs are four DISTINCT types, so there is no same-type sibling to
  // use as a control. Any other leg is still a valid one: they share hp/atk/def
  // verbatim and all four match _ARMOR_SOFT (/octo/), so the only difference
  // between this pair is the def value we zero out.
  const ctrl = legs.find(m => m !== leg) || null;
  let dealtNoDef = null;
  if (ctrl) { ctrl.def = 0; ctrl._defVar = 1; dealtNoDef = measure(ctrl); }
  const mitigationPct = (dealtNoDef && dealtNoDef > 0)
    ? +(100 * (1 - dealtToLeg / dealtNoDef)).toFixed(1) : null;

  // Still killable?
  const victim = legs[legs.length - 1];
  victim.maxHp = 5000; victim.currentHp = 5000;
  victim._defVar = 1;
  for (let i = 0; i < 40 && victim.currentHp > 0; i++) hitMonster(victim, 5000, false, 'probe');
  const killable = victim.currentHp <= 0;

  return {
    legCount: legs.length, size, maxOffset: Math.round(maxOffset),
    authoredDef: monsterTypes[leg.type].def, liveDef: leg.def,
    dealtToLeg, dealtNoDef, mitigationPct, killable,
  };
});
await browser.close(); server.kill();
if (R.err) { console.log('FAIL setup: ' + R.err); process.exit(1); }

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 130) });

ok('the boss still spawns its 4 tentacles', R.legCount === 4, `${R.legCount} legs`);
// SIZE — the live fighting size, not the authored 80x60 table value.
ok('tentacles are smaller than the old 208x156', R.size.w < 200 && R.size.h < 150,
   `${R.size.w}x${R.size.h} (was 208x156)`);
ok('but still substantially larger than the 80x60 base', R.size.w > 100,
   `${R.size.w}x${R.size.h}`);
// DEF — measured through hitMonster, not recomputed.
ok('tentacle def is raised', R.liveDef > 20, `live def ${R.liveDef} (authored ${R.authoredDef})`);
ok('def now mitigates meaningfully (>12%)', R.mitigationPct != null && R.mitigationPct > 12,
   `${R.mitigationPct}% of ${R.dealtNoDef} raw absorbed (was ~4%)`);
// Guards against overshooting.
ok('mitigation is not excessive (<40%)', R.mitigationPct != null && R.mitigationPct < 40,
   `${R.mitigationPct}%`);
ok('tentacles are still killable', R.killable);
ok('tentacles still anchor to the head', R.maxOffset < 700, `furthest leg ${R.maxOffset}px from head centre`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
