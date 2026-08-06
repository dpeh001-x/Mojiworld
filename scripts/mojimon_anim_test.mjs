// MOJIMON ANIMATION TEST — v0.29.454. The companion must play its species'
// real animation sets: idle when standing, walk while displacing, attack when
// it strikes — same frames, same phasing, as the wild monster.
// Observed from the OUTSIDE: _mojimonTintedFrame is wrapped so we record the
// exact frame object the draw hands to the canvas, and its src tells us which
// set it came from (Sprites/monsters/{idle,walk,attack}/...).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _mojimonDraw === 'function' && typeof _mojimonSummon === 'function', { timeout: 60000 });

const out = await page.evaluate(async () => {
  const R = [];
  const ok = (n, c, d) => R.push({ n, pass: !!c, d: d || '' });
  const T = 'slime';

  // decode the frame sets first (the draw falls back to static until then)
  const set = _monsterFramesFor(T);
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const rdy = ['idle', 'walk', 'attack'].every((m) => set[m] && set[m][0] && set[m][0].complete && set[m][0].naturalWidth > 0);
    if (rdy) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  ok('species frame sets decode', ['idle', 'walk', 'attack'].every((m) => set[m][0] && set[m][0].naturalWidth > 0));

  // field a companion
  player.mojimon = { roster: { [T]: { upg: { hp: 0, atk: 0, def: 0 }, at: 1 } }, cdUntil: 0, out: null };
  player.level = 50;
  try { _mojimonSummon(T, {}); } catch (e) { ok('summon works', false, e.message); }
  const mn = (game.minions || []).find((m) => m && m.mojimon);
  ok('companion fielded', !!mn);
  if (!mn) return R;

  // spy: record the frame handed to the tint step (its .src names the set)
  const seen = [];
  const orig = window._mojimonTintedFrame;
  window._mojimonTintedFrame = function (frame, type) { seen.push(frame && frame.src ? frame.src : '(baked)'); return orig(frame, type); };
  const setOf = (s) => (/\/idle\//.test(s) ? 'idle' : /\/walk\//.test(s) ? 'walk' : /\/attack\//.test(s) ? 'attack' : s ? 'static' : 'none');
  const draw = () => { seen.length = 0; try { _mojimonDraw(mn, 200, 200); } catch (e) { seen.push('THREW:' + e.message); } return seen[0] || null; };

  // IDLE — stationary, no attack window
  mn.atkAnimUntil = 0; mn.x = 400; mn._animPX = 400; mn._animXV = 0; mn._walkLatch = false; mn._animSt = null;
  const idleSrc = draw();
  ok('standing still plays IDLE frames', setOf(idleSrc) === 'idle', setOf(idleSrc) + ' <- ' + String(idleSrc).split('/').slice(-2).join('/'));

  // WALK — displace it a few frames so the EMA builds
  let walkSrc = null;
  for (let i = 0; i < 10; i++) { mn.x += 3; walkSrc = draw(); }
  ok('moving plays WALK frames', setOf(walkSrc) === 'walk', setOf(walkSrc) + ' <- ' + String(walkSrc).split('/').slice(-2).join('/'));

  // stop -> EMA decays -> back to idle (the hysteresis releases)
  let backSrc = null;
  for (let i = 0; i < 40; i++) backSrc = draw();
  ok('stopping returns to IDLE', setOf(backSrc) === 'idle', setOf(backSrc));

  // ATTACK — stamped window beats walking, and starts at frame 0
  mn._animSt = null;
  for (let i = 0; i < 3; i++) { mn.x += 3; draw(); }               // walking...
  mn.atkAnimUntil = performance.now() + 500;
  mn.x += 3;                                                       // still moving
  const atkSrc = draw();
  ok('striking plays ATTACK frames (beats walk)', setOf(atkSrc) === 'attack', setOf(atkSrc) + ' <- ' + String(atkSrc).split('/').slice(-2).join('/'));
  ok('attack starts at frame 0 (v0.29.418 phasing)', /_0\.webp/.test(String(atkSrc)), String(atkSrc).split('/').pop());

  // window expiry returns to idle/walk
  mn.atkAnimUntil = performance.now() - 1;
  mn._animXV = 0; mn._walkLatch = false;
  ok('expired attack window releases', setOf(draw()) === 'idle');

  // REAL STRIKE PATH — updateMinions must stamp atkAnimUntil on a melee hit
  game.monsters.length = 0;
  const foe = spawnMonster(mn.x + 20, mn.y, 'snail', false, false);
  if (foe && !foe._suppressed) {
    foe.currentHp = 1e9; foe.maxHp = 1e9;
    mn.atkAnimUntil = 0;
    let stamped = false;
    for (let i = 0; i < 240 && !stamped; i++) {
      game.time++;
      try { updateMinions(16.67); } catch (e) {}
      if (mn.atkAnimUntil > 0) stamped = true;
    }
    ok('a real melee strike stamps the attack window', stamped, stamped ? 'stamped within ' + '240 frames' : 'never stamped');
  } else ok('a real melee strike stamps the attack window', false, 'foe spawn failed');
  game.monsters.length = 0;

  // unknown species must not throw (falls back to static path)
  const ghost = { mojimon: true, type: '__nope__', x: 0, y: 0, w: 40, h: 40, currentHp: 10, maxHp: 10, facing: 1 };
  let threw = null;
  try { _mojimonDraw(ghost, 100, 100); } catch (e) { threw = e.message; }
  ok('unknown species does not throw', !threw, threw || '');

  window._mojimonTintedFrame = orig;
  game.minions.length = 0;
  return R;
});
await browser.close();

let bad = 0;
for (const r of out) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  (' + r.d + ')' : ''}`); }
console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
console.log(`${out.length - bad}/${out.length} passed`);
process.exit(bad || errs.length ? 1 : 0);
