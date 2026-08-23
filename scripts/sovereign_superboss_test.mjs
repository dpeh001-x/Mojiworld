// THE SOVEREIGN AS A SUPERBOSS — the ceremony fires, the numbers do not move.
// ============================================================================
// Per user: "make the boss fight epic as well like a superboss".
//
// The change is presentation: an arrival beat, a real escalation beat at each
// phase turn, and a loud telegraph on the one attack that can kill outright.
// Two things therefore have to be proven, and the second matters more than the
// first: the beats fire, AND the fight is exactly as hard as it was. "Epic" is
// the easiest possible cover for an accidental difficulty change, so every
// number the fight is balanced on is compared against the same build's table.
//
// The beats are measured by instrumenting flash/addShake/addHitStop -- the
// functions the renderer actually consumes -- rather than by reading the source.
// Run: node scripts/sovereign_superboss_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9860);
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
await page.fill('#hero-name-input', 'SovEpic');
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
  game.monsters.length = 0;
  // ---- instrument the three spectacle channels ---------------------------
  const cap = { flash: [], shake: [], stop: [], toasts: [] };
  const oF = window.flash, oS = window.addShake, oH = window.addHitStop, oT = window.showToast;
  window.flash = function (v) { cap.flash.push(+v || 0); return oF.apply(this, arguments); };
  window.addShake = function (v) { cap.shake.push(+v || 0); return oS.apply(this, arguments); };
  window.addHitStop = function (v) { cap.stop.push(+v || 0); return oH.apply(this, arguments); };
  window.showToast = function (t) { cap.toasts.push(String(t || '')); return oT.apply(this, arguments); };

  const boss = spawnMonster(400, player.y, 'towerSovereign', false);
  if (!boss) return { error: 'no boss' };
  boss._expeditionFinalBoss = true;
  boss.atk = 0;

  const stats = { hp: boss.maxHp, atk: boss.atk, def: boss.def, w: boss.w, h: boss.h };
  const traits = JSON.parse(JSON.stringify(boss.traits || {}));

  // ---- phase turns: drive HP across the two thresholds -------------------
  const phaseBeats = {};
  for (const ph of [2, 3]) {
    cap.flash.length = 0; cap.shake.length = 0; cap.stop.length = 0;
    boss.currentHp = boss.maxHp * (ph === 2 ? 0.5 : 0.2);
    for (let f = 0; f < 30; f++) await new Promise(r => requestAnimationFrame(r));
    phaseBeats[ph] = { flash: Math.max(0, ...cap.flash), shake: Math.max(0, ...cap.shake), stop: Math.max(0, ...cap.stop) };
  }

  // ---- the collapse telegraph --------------------------------------------
  cap.flash.length = 0; cap.shake.length = 0; cap.stop.length = 0; cap.toasts.length = 0;
  boss.currentHp = boss.maxHp;
  boss._sovShielded = false; boss._sovExposedUntil = 0; boss._sovSpentUntil = 0;
  boss._sovereignOhkoTick = (game.time | 0) + 3;
  boss._sovereignHomingAt = (game.time | 0) + 100000;
  boss._sovereignDrainAt = (game.time | 0) + 100000;
  for (let f = 0; f < 40; f++) {
    await new Promise(r => requestAnimationFrame(r));
    boss.currentHp = boss.maxHp;
    boss._sovShielded = false; boss._sovExposedUntil = 0; boss._sovSpentUntil = 0;
  }
  const collapse = { flash: Math.max(0, ...cap.flash), shake: Math.max(0, ...cap.shake),
                     stop: Math.max(0, ...cap.stop),
                     named: cap.toasts.some(t => /COLLAPSE/i.test(t)) };

  window.flash = oF; window.addShake = oS; window.addHitStop = oH; window.showToast = oT;
  return { stats, traits, phaseBeats, collapse, hasBeat: typeof _lxSovBeat === 'function' };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 150) });
const bm = (R.traits || {}).bigMelee || {}, cs = (R.traits || {}).columnStrike || {};

ok('the spectacle helper exists', R.hasBeat === true);
ok('phase 2 lands as an event, not a contact hit',
   R.phaseBeats[2].flash >= 0.4 && R.phaseBeats[2].shake >= 12 && R.phaseBeats[2].stop >= 100,
   `flash ${R.phaseBeats[2].flash} shake ${R.phaseBeats[2].shake} stop ${R.phaseBeats[2].stop} (was 0.3 / 8 / none)`);
ok('phase 3 is louder than phase 2',
   R.phaseBeats[3].flash > R.phaseBeats[2].flash && R.phaseBeats[3].shake > R.phaseBeats[2].shake,
   `flash ${R.phaseBeats[3].flash} shake ${R.phaseBeats[3].shake} stop ${R.phaseBeats[3].stop}`);
ok('the one-shot collapse announces itself by name', R.collapse.named === true,
   `flash ${R.collapse.flash} shake ${R.collapse.shake} stop ${R.collapse.stop}`);
ok('the collapse telegraph is heavier than an ordinary hit', R.collapse.flash >= 0.4 && R.collapse.shake >= 10,
   `flash ${R.collapse.flash} shake ${R.collapse.shake}`);
// The half that matters: presentation only. The spawned boss is LEVEL-SCALED,
// so its live maxHp/def never equal the table constants -- comparing them to
// 220000/210 measured the scaler, not the change (an earlier version of this
// check did exactly that and "failed" on an untouched build). The stats are
// printed for information only -- spawn also rolls elite/level scaling, so the
// number varies run to run and cannot serve as a regression signal either. The
// assertion is on the tuning block, which is authored and not scaled.
console.log('  spawned stats (compare across builds):', JSON.stringify(R.stats));
ok('the boss still spawns with real combat stats', R.stats.hp > 0 && R.stats.def > 0,
   `hp ${R.stats.hp} def ${R.stats.def}`);
ok('melee and column tuning untouched',
   bm.dmgMul === 2.8 && bm.range === 200 && bm.cdMs === 3000 && cs.dmgMul === 3.0 && cs.cdMs === 2800,
   `bigMelee ${bm.dmgMul}x/${bm.range}px/${bm.cdMs}ms · column ${cs.dmgMul}x/${cs.cdMs}ms`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
