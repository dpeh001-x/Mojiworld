// BOSS FRAMES DECODE ONCE, OFF THE HOT PATH
// ============================================================================
// `decoding = 'async'` on an <img> only defers the DECISION about when to decode. The
// pixels are still decoded SYNCHRONOUSLY inside the first drawImage, on the render
// thread. Every other animation loader in the game calls decode() at load for exactly
// that reason — the mob loader's own note measured "24ms per re-decode, 311ms worst
// frame" — but _loadBossFrames never did. So a boss fight hitched as the idle loop
// first showed, again on the first walk, and again on the first frame of every attack
// set the fight reached for, including sets a boss only opens late in a phase.
//
// The fix is a per-type warm at spawn (decoding all eleven sets at boot would put the
// whole boss roster through the decoder during the loading screen for the one boss you
// are about to fight).
//
// What this pins:
//   1. spawning a boss warms its own frames — idle, walk, attack — without being asked;
//   2. and its per-move sets ('gravitospunch', the form swaps), which is where a fight
//      hitches worst, because those decode mid-swing;
//   3. the prefix rule does not drag in a DIFFERENT boss that shares a stem
//      ('king' must not warm 'kingKrook');
//   4. a zodiac boss warms its sign's six sets, which are keyed by sign and not by the
//      'zodiac_<sign>' type spawnMonster is handed;
//   5. the warm is idempotent — a second spawn decodes nothing;
//   6. and a warmed frame's first draw is no dearer than a cold one. Only a guard, not
//      the proof: the cold sign here gets drawn by the test itself, so both readings
//      are of already-decoded pixels. The proof that the decode moved is (1)-(5).
//   node scripts/boss_frame_warm_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9780);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Warm');
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 100; loadMap('forest', 300); });
await page.waitForTimeout(5000);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
  try { _lxCineHold(0); } catch (e) {}
  game.paused = false; player._god = true;
  const out = { err: null };
  out.hasWarm = (typeof _lxWarmBossFrames === 'function');

  const sets = (map, key) => (map && map[key]) || [];
  // _lxShrinkFrames REPLACES a slot's <img> with a baked <canvas> in place once the set
  // has drawn, and the bake carries no warm flag of its own. Reading the slot naively
  // therefore reports a warmed set as cold as soon as it is on screen — which is what
  // the first cut of this test did, and it looked exactly like the fix not working.
  // Every bake keeps its source addressable on _lxSrc, so follow that.
  const src = (im) => (im && im.tagName === 'CANVAS' && im._lxSrc) ? im._lxSrc : im;
  const tally = (arr) => {
    let total = 0, warmed = 0, decoded = 0, baked = 0;
    for (const raw of arr || []) {
      if (!raw) continue;
      total++;
      if (raw.tagName === 'CANVAS') baked++;
      const im = src(raw);
      if (im && im._lxWarmed) warmed++;
      if (im && im.complete && im.naturalWidth > 0) decoded++;
    }
    return { total, warmed, decoded, baked };
  };

  // Cold reading first: nothing has spawned a boss this session, so nothing should be
  // warmed. (If the game ever starts warming these at boot, this is what will say so.)
  out.coldGravitos = tally(sets(typeof BOSS_ATTACK_FRAMES !== 'undefined' ? BOSS_ATTACK_FRAMES : null, 'gravitos'));

  game.monsters.length = 0;
  const g = spawnMonster(900, 300, 'gravitos', true, false);
  if (!g) return { err: 'no gravitos' };
  await sleep(2500);

  out.atk   = tally(sets(BOSS_ATTACK_FRAMES, 'gravitos'));
  out.idle  = tally(sets(BOSS_IDLE_FRAMES, 'gravitos'));
  out.walk  = tally(sets(BOSS_WALK_FRAMES, 'gravitos'));
  out.punch = tally(sets(BOSS_ATTACK_FRAMES, 'gravitospunch'));
  out.krook = tally(sets(BOSS_ATTACK_FRAMES, 'kingKrook'));   // must stay cold: different boss
  out.edgesWarm = (sets(BOSS_ATTACK_FRAMES, 'gravitos') || []).map(src).filter((im) => im && im._lxEdgesWarm).length;

  // idempotent: a second call decodes nothing new
  out.second = out.hasWarm ? _lxWarmBossFrames('gravitos') : -1;

  // zodiac: keyed by the bare sign, spawned as 'zodiac_<sign>'
  game.monsters.length = 0;
  const z = spawnMonster(900, 300, 'zodiac_leo', true, false);
  out.zSpawned = !!z;
  await sleep(2500);
  out.zIdle   = tally(sets(ZODIAC_IDLE_FRAMES, 'leo'));
  out.zAttack = tally(sets(ZODIAC_ATTACK_FRAMES, 'leo'));
  out.zPounce = tally(sets(ZODIAC_POUNCE_FRAMES, 'leo'));
  out.zOther  = tally(sets(ZODIAC_ATTACK_FRAMES, 'pisces'));   // untouched sign

  // ---- first-draw cost, warm vs cold, in one batch (absolute ms thresholds do not
  // travel between builds, so the comparison has to be made here and now). 'virgo' is
  // a sign neither spawn above touched, so its frames are genuinely cold.
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const c2 = cv.getContext('2d');
  const firstDraw = (arr) => {
    let worst = 0;
    for (const im of arr || []) {
      if (!im || !im.complete || !(im.naturalWidth > 0)) continue;
      const t = performance.now();
      try { c2.drawImage(im, 0, 0, 64, 64); } catch (e) { continue; }
      const d = performance.now() - t;
      if (d > worst) worst = d;
    }
    return +worst.toFixed(2);
  };
  out.coldDrawMs = firstDraw(sets(ZODIAC_ATTACK_FRAMES, 'virgo'));
  out.warmDrawMs = firstDraw(sets(ZODIAC_ATTACK_FRAMES, 'leo'));

  game.monsters.length = 0;
  return out;
});
await browser.close(); server.kill();
if (R.err) { console.log(R.err); process.exit(1); }

const pct = (t) => t.total ? Math.round(100 * t.warmed / t.total) : -1;
console.log(`gravitos   attack ${R.atk.warmed}/${R.atk.total} warmed, idle ${R.idle.warmed}/${R.idle.total}, walk ${R.walk.warmed}/${R.walk.total}`);
console.log(`           gravitospunch ${R.punch.warmed}/${R.punch.total}   kingKrook ${R.krook.warmed}/${R.krook.total} (must be 0)`);
console.log(`zodiac_leo idle ${R.zIdle.warmed}/${R.zIdle.total}, attack ${R.zAttack.warmed}/${R.zAttack.total}, pounce ${R.zPounce.warmed}/${R.zPounce.total}   pisces ${R.zOther.warmed}/${R.zOther.total} (must be 0)`);
console.log(`worst first drawImage: cold ${R.coldDrawMs} ms   warm ${R.warmDrawMs} ms`);

const checks = [
  ['the warm exists', R.hasWarm === true],
  ['boss frames start cold — nothing is decoded at boot', R.coldGravitos.total > 0 && R.coldGravitos.warmed === 0, R.coldGravitos.warmed + '/' + R.coldGravitos.total],
  ['spawning the boss warms its attack frames', R.atk.total > 0 && pct(R.atk) === 100, pct(R.atk) + '%'],
  ['and its idle frames', R.idle.total > 0 && pct(R.idle) === 100, pct(R.idle) + '%'],
  ['and its walk frames', R.walk.total > 0 && pct(R.walk) === 100, pct(R.walk) + '%'],
  ['and the per-move set it swings mid-fight', R.punch.total > 0 && pct(R.punch) === 100, pct(R.punch) + '%'],
  ['every warmed frame actually decoded', R.atk.decoded === R.atk.total, R.atk.decoded + '/' + R.atk.total],
  ['the edge probe rode along, so no sync re-probe later', R.edgesWarm >= R.atk.total, R.edgesWarm + '/' + R.atk.total],
  ['a different boss sharing a stem stays cold (king vs kingKrook)', R.krook.total > 0 && R.krook.warmed === 0, R.krook.warmed + '/' + R.krook.total],
  ['a second warm decodes nothing', R.second === 0, String(R.second)],
  ['a zodiac boss warms its sign, not its type key', R.zSpawned && R.zIdle.total > 0 && pct(R.zIdle) === 100 && pct(R.zAttack) === 100, 'idle ' + pct(R.zIdle) + '% attack ' + pct(R.zAttack) + '%'],
  ['including the optional states (pounce)', R.zPounce.total === 0 || pct(R.zPounce) === 100, R.zPounce.warmed + '/' + R.zPounce.total],
  ['a sign nobody fought stays cold', R.zOther.total > 0 && R.zOther.warmed === 0, R.zOther.warmed + '/' + R.zOther.total],
  ['a warmed frame\'s first draw is no dearer than a cold one', R.warmDrawMs <= R.coldDrawMs + 0.5, 'warm ' + R.warmDrawMs + ' vs cold ' + R.coldDrawMs + ' ms'],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
