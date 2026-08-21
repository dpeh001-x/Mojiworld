// SUMMON AI ROUND 2 — the master's mark.
// ============================================================================
// Per user: "Further improve on AI of summons."
//
// Measured first: the pack joined the mob the PLAYER was actively fighting for
// 0% of frames — summons had no concept of what their master attacks. (Defend
// and platform-reach measured fine and are covered by summon_targeting_test.)
//
// The fix: every player-originated hit marks its victim for ~4 s and each
// summon family treats a live mark as a COMMAND. A score weight was tried
// first and measured only 15% adoption — a minion already standing on another
// live target never leaves it for a weighted alternative — so the mark
// overrides the pick outright, and ordinary scoring resumes when it expires.
//
// The subtle assertions are the ones that keep the mark honest:
//   * summon-owned hits must NOT stamp (self-locking feedback loop),
//   * a mark must die with its mob AND with its mob's REMOVAL — a mob can
//     leave game.monsters without dying (map change, despawn), and a mark
//     held through that measurably sent the pack to empty ground (the defend
//     metric dropped 100% -> 64% from exactly this before the membership
//     check existed).
// Run: node scripts/summon_assist_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9421;
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
await page.fill('#hero-name-input', 'AssistTest');
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
  await new Promise(r => setTimeout(r, 1400));
  game.paused = false;
  player.maxMp = 99999; player.mp = 99999; player.baseAtk = 500;
  const GY = player.y;

  const mk = (dx) => {
    const m = spawnMonster(player.x + dx, GY, 'slime', false);
    if (m) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; m.speed = 0; m._px = player.x + dx; }
    return m;
  };
  const reset = () => {
    game.monsters.length = 0; game.minions = []; game.projectiles.length = 0;
    game._pFocusTgt = null; game._pFocusAt = 0;
    player.x = 400; player.skillCooldowns = {}; player.hp = getMaxHp();
  };
  const run = (frames, pin, cb) => {
    for (let f = 0; f < frames; f++) {
      game.time += 1;
      if (pin) pin(f);
      try { updateMinions(16.667); } catch (e) {}
      try { updatePlayer(16.667); } catch (e) {}
      try { updateMonsters(16.667); } catch (e) {}
      if (cb) cb(f);
    }
  };
  const onTgt = (t) => game.minions.filter(mn => mn._mnTgt === t).length;

  // ---- 1. the pack converges on what the player attacks -------------------
  reset();
  castSkill('darkPulse');
  const near = mk(150), marked = mk(-260);
  run(60, () => { near.currentHp = near.maxHp; marked.currentHp = marked.maxHp; }, null);
  let assistFrames = 0, total = 0;
  run(60 * 6, (f) => {
    near.currentHp = near.maxHp; marked.currentHp = marked.maxHp;
    near.x = near._px; marked.x = marked._px;
    if (f % 20 === 0) { try { hitMonster(marked, 500, false, 'probe'); } catch (e) {} }
  }, () => { total++; if (onTgt(marked) >= 4) assistFrames++; });
  const assistPct = +(assistFrames / total * 100).toFixed(1);

  // ---- 2. wolf + eagle honour the mark too --------------------------------
  reset();
  player.pet = { x: player.x, y: GY, vx: 0, vy: 0, hp: 80000, maxHp: 80000,
                 life: 60000, maxLife: 60000, cdAtk: 0, scale: 2.4 };
  player.ultPet = { x: player.x, y: GY - 80, vx: 0, vy: 0, hp: 9999, maxHp: 9999,
                    life: 60000, maxLife: 60000, shooter: true, fireCd: 0, scale: 1 };
  const wNear = mk(120), wMarked = mk(-420);
  run(60, () => { wNear.currentHp = wNear.maxHp; wMarked.currentHp = wMarked.maxHp; }, null);
  let wolfOn = 0, eagleOn = 0, wTotal = 0;
  run(60 * 5, (f) => {
    wNear.currentHp = wNear.maxHp; wMarked.currentHp = wMarked.maxHp;
    wNear.x = wNear._px; wMarked.x = wMarked._px;
    if (f % 20 === 0) { try { hitMonster(wMarked, 500, false, 'probe'); } catch (e) {} }
  }, () => {
    wTotal++;
    if (player.pet && player.pet._tgtRef === wMarked) wolfOn++;
    if (player.ultPet && player.ultPet._tgtRef === wMarked) eagleOn++;
  });
  const wolfPct = +(wolfOn / wTotal * 100).toFixed(1);
  const eaglePct = +(eagleOn / wTotal * 100).toFixed(1);

  // ---- 3. summon hits do NOT stamp a mark ---------------------------------
  reset();
  castSkill('darkPulse');
  const prey = mk(120);
  run(60 * 3, () => { prey.currentHp = prey.maxHp; prey.x = prey._px; }, null);
  const summonStamped = !!game._pFocusTgt;   // only minion contact hit it

  // ---- 4. the mark expires and ordinary spread resumes --------------------
  reset();
  castSkill('darkPulse');
  const a4 = mk(140), b4 = mk(-200);
  run(30, null, null);
  try { hitMonster(b4, 500, false, 'probe'); } catch (e) {}
  run(60 * 6, () => { a4.currentHp = a4.maxHp; b4.currentHp = b4.maxHp; a4.x = a4._px; b4.x = b4._px; }, null);
  // _lxPlayerFocus does not exist on the pre-fix build — treat that as "no
  // focus system" rather than crashing, so the baseline runs to real FAILs.
  const _pf = (typeof _lxPlayerFocus === 'function') ? _lxPlayerFocus() : null;
  const afterExpiry = { focus: !!_pf, onA: onTgt(a4), onB: onTgt(b4) };

  // ---- 5. a REMOVED (not killed) mark releases the pack -------------------
  reset();
  castSkill('darkPulse');
  const g1 = mk(140), ghost = mk(-260);
  run(30, null, null);
  try { hitMonster(ghost, 500, false, 'probe'); } catch (e) {}
  run(30, () => { ghost.currentHp = ghost.maxHp; }, null);
  const idx = game.monsters.indexOf(ghost);
  if (idx >= 0) game.monsters.splice(idx, 1);       // vanishes ALIVE
  run(60, () => { g1.currentHp = g1.maxHp; g1.x = g1._px; }, null);
  const ghostHeld = onTgt(ghost);

  return { assistPct, wolfPct, eaglePct, summonStamped, afterExpiry, ghostHeld,
           minionCount: game.minions.length };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 125) });

ok('the undead pack converges on the marked target', R.assistPct >= 70,
   `${R.assistPct}% of frames with 4+/5 on the mark (pre-fix: 0%)`);
ok('the wolf hunts the mark', R.wolfPct >= 60, `${R.wolfPct}% of frames`);
ok('the eagle shoots the mark', R.eaglePct >= 60, `${R.eaglePct}% of frames`);
ok('summon hits never stamp a mark (no self-lock)', !R.summonStamped);
ok('an expired mark releases the pack', !R.afterExpiry.focus && R.afterExpiry.onA >= 1,
   `focus=${R.afterExpiry.focus} spread A:${R.afterExpiry.onA} B:${R.afterExpiry.onB}`);
ok('a mark REMOVED alive (map change/despawn) is dropped, not chased',
   R.ghostHeld === 0, `${R.ghostHeld} minions still targeting the removed mob`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
