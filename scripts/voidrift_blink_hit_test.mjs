// Voidrift Blink (assassin V, SKILL_FNS.sleight) strikes every foe its zip passes through.
//
// Per user: "Voidrift Blink does not deal damage to enemies". The hit test was "monster CENTRE inside
// the player's 44 px band +-6", so any monster taller than ~100 px standing in the path was skipped:
// 42 of 111 non-boss types, every boss, and 81 of 111 when cast mid-jump. It is body overlap now.
//   1. every monster type, standing on the ground in the path, is struck (bosses included)
//   2. cast mid-jump, a short foe whose body the zip still crosses is struck
//   3. the path is still a path: a foe wholly above it, behind the player, or past the zip's end is not
//   4. through the REAL castSkill: all three charges land on a tall foe, in the running game
//   node scripts/voidrift_blink_hit_test.mjs        (MOJI_GAME_FILE to test a candidate)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT; for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: process.env });
await new Promise((r) => setTimeout(r, 2000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof loadMap === 'function' && typeof monsterTypes === 'object', null, { timeout: 180000 });
await page.evaluate(() => {
  try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
  document.querySelectorAll('[id^="story-beat"], #lo-stack, #tutorial-modal').forEach((e) => e.remove());
  try { window.showToast = function () {}; } catch (e) {}
  player.cls = 'rogue'; player.job = 'assassin'; player.master = null; player.level = 40; player.invulnerable = 9e9;
  loadMap('forest', 300); game.paused = false;
});
await page.waitForTimeout(3000);

const r = await page.evaluate(async () => {
  const out = {};
  const feet = player.y + player.h;
  // SYNCHRONOUS placement + cast: the game loop cannot move anything between the two.
  const cast = (t, place) => {
    game.monsters.length = 0;
    try { spawnMonster(0, 0, t, false, false); } catch (e) { return null; }
    const m = game.monsters[game.monsters.length - 1]; if (!m) return null;
    player.x = 300; player.y = feet - player.h; player.facing = 1; player._sleightCharges = 2;
    m.currentHp = m.maxHp = 1e9; m.x = player.x + 220; m.y = feet - m.h;
    if (place) place(m);
    let hits = 0; const _hm = window.hitMonster;
    window.hitMonster = function (mm, d, c, tag) { if (tag === 'sleight' && mm === m) hits++; return _hm.apply(this, arguments); };
    try { SKILL_FNS.sleight(); } finally { window.hitMonster = _hm; player.y = feet - player.h; }
    return { t, h: m.h, hit: hits > 0 };
  };
  const types = Object.keys(monsterTypes);
  const all = types.map((t) => cast(t)).filter(Boolean);
  out.total = all.length; out.missed = all.filter((x) => !x.hit).map((x) => x.t + ':' + x.h);
  out.bosses = all.filter((x) => monsterTypes[x.t] && (monsterTypes[x.t].boss || monsterTypes[x.t].isBoss)).length;
  out.tallest = all.reduce((a, x) => (x.h > a.h ? x : a), { h: 0 });
  // mid-jump: the player is 40 px up and a 42 px snail's body still reaches into the path (its CENTRE does not)
  const jump = cast('snail', (m) => { player.y = feet - player.h - 40; });
  out.jumpShort = jump && jump.hit;
  // not the path
  out.above = cast('snail', (m) => { m.y = feet - player.h - 12 - m.h - 40; });          // wholly above the corridor
  out.behind = cast('snail', (m) => { m.x = player.x - 260; });                               // behind the player
  out.beyond = cast('snail', (m) => { m.x = player.x + (typeof W === 'number' ? W : 1100) * 0.5 + player.w + 120; });  // past the zip
  // the real cast path, three charges, in the running game. The accuracy and level-gap rolls are
  // pinned: a Bone Golem carries 80 evasion, and a legitimate MISS is not what this checks.
  window._rollAccuracyHit = () => true; window._rollHitVsLevelGap = () => true;
  player.maxMp = 99999;
  game.monsters.length = 0;
  spawnMonster(0, 0, 'boneGolem', false, false);
  const g = game.monsters[game.monsters.length - 1];
  const hp = [];
  player.skillCooldowns = {}; player._sleightCharges = 0; player.mp = 9999;
  for (let i = 0; i < 3; i++) {
    player.x = 300; player.y = feet - player.h; player.facing = 1; player.vx = 0; player._castLockUntil = 0;
    g.currentHp = g.maxHp = 1e9; g.x = player.x + 220; g.y = feet - g.h; g.vx = 0;
    player.skillCooldowns.sleight = 0; player.mp = 99999;
    castSkill('sleight');
    hp.push(1e9 - g.currentHp);
    await new Promise((res) => setTimeout(res, 320));
  }
  out.realCast = { gh: g.h, dealt: hp };
  game.monsters.length = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}
console.log(JSON.stringify(r, null, 1));
ok(`every monster type standing in the path is struck (${r.total} types, ${r.bosses} bosses, tallest ${r.tallest.t} at ${r.tallest.h}px)`, r.total > 100 && r.missed.length === 0, r.missed.slice(0, 12).join(', '));
ok('cast mid-jump, a short foe whose body the zip crosses is struck', r.jumpShort === true, r.jumpShort);
ok('a foe wholly above the path is not struck', r.above && r.above.hit === false, JSON.stringify(r.above));
ok('a foe behind the player is not struck', r.behind && r.behind.hit === false, JSON.stringify(r.behind));
ok('a foe past the end of the zip is not struck', r.beyond && r.beyond.hit === false, JSON.stringify(r.beyond));
ok('through castSkill, all three charges damage a Bone Golem', r.realCast.dealt.length === 3 && r.realCast.dealt.every((d) => d > 0), JSON.stringify(r.realCast));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
let fail = 0;
for (const x of results) { if (!x.pass) fail++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.pass ? '' : '  -- ' + x.x}`); }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
