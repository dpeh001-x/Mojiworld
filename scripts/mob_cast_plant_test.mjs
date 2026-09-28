// MOB CAST / WALK TEST — v0.29.419.
//   A. PLANT     a mob mid-cast (ranged windup, heavy-swing telegraph) has its
//                vx zeroed, so the windup pose does not slide.
//   B. NO-FREEZE a contact hit stamps atkAnimUntil for 650ms but must NOT root
//                the mob — otherwise every touch stutters the chase.
//   C. WALK WINS a MOVING mob near the player plays its WALK cycle; the
//                proximity pose is for standing still.
//   D. ATTACK    a committed cast is PLANTED (vx zeroed in updateMonsters) and
//                the planted mob plays its attack frames, and contact hits
//                still animate (v0.29.273 must not regress).
//                v0.30.x (23cf165c, per user "make sure monsters only move
//                horizontally when the walking sprite plays") made WALK outrank
//                every attack pose in _monsterStateFrame: a mob that is really
//                moving is drawn walking. A cast still reads because the plant
//                zeroes its vx first, so D now checks the plant + the planted
//                frame, instead of a cast flag on a mob still doing vx 2.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('file:///' + path.join(ROOT, FILE).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _mobCasting === 'function' && typeof _mobAttackAnim === 'function' && typeof _monsterStateFrame === 'function', { timeout: 60000 });

const out = await page.evaluate(() => {
  const R = [];
  const ok = (n, c, d) => R.push({ n, pass: !!c, d: d || '' });
  const now = () => performance.now();

  // A — casting predicate: only the two deliberate windups
  ok('ranged windup counts as casting', _mobCasting({ _shootWindup: 200 }) === true);
  ok('heavy-swing telegraph counts as casting', _mobCasting({ _bigMeleeFiring: true }) === true);
  ok('contact-hit window is NOT casting', _mobCasting({ atkAnimUntil: now() + 650 }) === false,
     'rooting on it would freeze mobs 650ms per touch');
  ok('idle mob is not casting', _mobCasting({}) === false);

  // B — but the contact window DOES animate (v0.29.273 must not regress)
  ok('contact hit still animates', _mobAttackAnim({ atkAnimUntil: now() + 650 }) === true);
  ok('expired window stops animating', _mobAttackAnim({ atkAnimUntil: now() - 10 }) === false);

  // C — frame priority. Fake decoded frame sets so the picker returns ours.
  const mk = (tag) => { const a = []; for (let i = 0; i < 9; i++) a.push({ complete: true, naturalWidth: 8, naturalHeight: 8, _tag: tag, _i: i }); return a; };
  const TYPE = '__cast_probe__';
  MONSTER_FRAMES[TYPE] = { idle: mk('idle'), walk: mk('walk'), attack: mk('attack') };
  const mob = (over) => Object.assign({ type: TYPE, x: 0, y: 0, w: 40, h: 40, vx: 0, _animXV: 0 }, over);
  const savedX = player.x, savedY = player.y, savedHp = player.hp;
  player.hp = 100; player.x = 0; player.y = 0;   // player sits right on top of the mob → proximity true

  const moving = mob({ vx: 2.0 });               // clearly walking, and adjacent
  ok('MOVING mob next to player plays WALK', (_monsterStateFrame(moving) || {})._tag === 'walk',
     'got ' + ((_monsterStateFrame(moving) || {})._tag));

  const still = mob({ vx: 0 });                  // standing next to player
  ok('STILL mob next to player plays attack pose', (_monsterStateFrame(still) || {})._tag === 'attack',
     'got ' + ((_monsterStateFrame(still) || {})._tag));

  // D — the physics half: updateMonsters zeroes vx on any casting mob, right before integration
  const _um = String(typeof updateMonsters === 'function' ? updateMonsters : '');
  ok('updateMonsters plants a casting mob (vx = 0)', /_mobCasting\(m\)\)\s*m\.vx\s*=\s*0/.test(_um));
  // ...and the planted caster plays its attack frames, with the player FAR away so the
  // proximity pose cannot be what picked them
  player.x = 5000;
  const planted = mob({ vx: 0, _shootWindup: 200 });
  ok('a PLANTED caster plays attack, not idle', (_monsterStateFrame(planted) || {})._tag === 'attack',
     'got ' + ((_monsterStateFrame(planted) || {})._tag));
  const plantedMelee = mob({ vx: 0, _bigMeleeFiring: true });
  ok('a planted heavy-swing telegraph plays attack', (_monsterStateFrame(plantedMelee) || {})._tag === 'attack',
     'got ' + ((_monsterStateFrame(plantedMelee) || {})._tag));
  // v0.30.x (23cf165c) — walk outranks the attack pose when the mob really moves
  // (e.g. shoved mid-cast): the art yields, it does not slide under a swing
  const castingWhileMoving = mob({ vx: 2.0, _shootWindup: 200 });
  ok('a caster that is really moving is drawn WALKING (walk outranks, v0.30.x)', (_monsterStateFrame(castingWhileMoving) || {})._tag === 'walk',
     'got ' + ((_monsterStateFrame(castingWhileMoving) || {})._tag));
  player.x = 0;

  const farIdle = mob({ vx: 0 });
  player.x = 5000;                                // far away, standing still
  ok('far + still plays IDLE', (_monsterStateFrame(farIdle) || {})._tag === 'idle',
     'got ' + ((_monsterStateFrame(farIdle) || {})._tag));

  player.x = savedX; player.y = savedY; player.hp = savedHp;
  delete MONSTER_FRAMES[TYPE];
  return R;
});
await browser.close();

let bad = 0;
for (const r of out) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  (' + r.d + ')' : ''}`); }
console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
console.log(`${out.length - bad}/${out.length} passed`);
process.exit(bad || errs.length ? 1 : 0);
