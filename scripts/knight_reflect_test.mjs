#!/usr/bin/env node
// v0.30.1428: the Knight line's damage reflect (per user: crusader and dragoon "very very underpowered", "especially on the damage
// reflect damages, needs major improvement"). Reflect used to bounce back only a share of the damage that reached your HP bar - a
// boss's touch is clamped into a band of YOUR max HP, so it read a few hundred against bosses with millions. Every blow now also
// carries a retaliation scaled by your ATK. Real fight, no mocks: a Lv-50 knight (ATK pinned 400, god mode - the blow is still
// computed and shown) stands in a boss's touch.
//   - GUARDIAN: every reflected blow deals at least 5x ATK, and a steady stream lands
//   - HOLY SHIELD: its blows reflect at least 12x ATK - including while its invulnerability stops them
//   - SEPARATE WINDOWS: a Holy Shield cast during Guardian no longer cuts Guardian's reflect off when its own 5 s end
//   - BOTH MASTERS: a dragoon's Guardian reflects the same as a crusader's (the reflect belongs to the Knight job)
//   - WARDS: a warded boss takes 1 from the retaliation and its break gauge fills, as from any blow (the boss ward is held off in
//     the other fights so they measure the reflect itself)
//   [SERVE_ROOT=<dir>] [PORT=n] node scripts/knight_reflect_test.mjs
import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVE = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11694';
const require = createRequire(path.join(ROOT, 'x.js')); const { chromium } = require('playwright-core');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const G_ATK = 5, H_ATK = 12;
const server = spawn(process.execPath, [path.join(SERVE, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE, env: { ...process.env, MOJI_GAME_FILE: '' } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const fight = async (master, plan) => {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function' && typeof spawnMonster === 'function', null, { timeout: 300000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async ({ master, plan }) => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; player._gravitosCineSeen = true;
    loadMap('forest', 300); await sleep(1500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    player.cls = 'warrior'; player.job = 'knight'; player.master = master; player.level = 50; player._god = true;
    player.baseAtk = 400; player.baseAcc = 900; player.mods = player.mods || {}; player.mods.critDmg = 0; player.mods.thorns = 0; player.crit = 0; player.baseCrit = 0;
    player.mp = 9e9; player.skillCooldowns = {};
    Object.defineProperty(game, 'comboMult', { get: () => 1, set() {}, configurable: true });
    game.monsters = []; game.projectiles.length = 0; game.hazards.length = 0;
    spawnMonster(player.x + 40, player.y, 'kingKrook', true);
    const m = game.monsters[game.monsters.length - 1]; if (!m) return { err: 'no boss' };
    m.maxHp = m.currentHp = 9e12;
    m._wardNextAt = 1e12; m._wardUntil = 0;   // the boss ward (1-damage windows) is held off, except where a step forces one
    let wardFed = 0, wardBroke = 0;
    const refl = [];   // [sim step, damage, player invulnerable at the time]
    const orig = window.hitMonster;
    window.hitMonster = function (mm, dmg, c, sk) { const b = mm && mm.currentHp; const res = orig.apply(this, arguments);
      if (sk === 'thorns' && mm === m && typeof b === 'number') refl.push([game.time | 0, Math.max(0, b - mm.currentHp), player.invulnerable > 0 ? 1 : 0]); return res; };
    const t0 = game.time | 0, marks = {};
    for (const step of plan) {   // [at sim step, action]
      const until = t0 + step[0];
      while ((game.time | 0) < until) { await new Promise((res) => requestAnimationFrame(res)); player.mp = 9e9; player.x = m.x + m.w / 2 - player.w / 2; player.vx = 0;
        if ((m._wardGauge || 0) > wardFed) wardFed = m._wardGauge; if ((m._wardBreakUntil | 0) > (game.time | 0)) wardBroke = 1; }
      if (step[1] === 'mark') marks[step[2]] = (game.time | 0) - t0;
      else if (step[1] === 'ward') { m._wardUntil = (game.time | 0) + step[2]; m._wardGauge = 0; m._wardLen = step[2]; }
      else castSkill(step[1]);
    }
    window.hitMonster = orig;
    return { atk: getAtk(), refl: refl.map(([t, d, inv]) => [t - t0, d, inv]), marks, wardFed, wardBroke, hsUntil: (player._holyReflectUntil | 0) - t0, gUntil: (player._guardianReflect | 0) - t0 };
  }, { master, plan });
  r.errs = errs.slice(0, 2); await page.close(); return r;
};
try {
  // 1. Guardian alone, 16 s in the King's touch (a crusader, then a dragoon)
  for (const master of ['crusader', 'dragoon']) {
    const r = await fight(master, [[1, 'guardian'], [16 * 60, 'mark', 'end']]);
    const per = r.refl.map(([, d]) => d / r.atk), n = per.length, lo = n ? Math.min(...per) : 0, mean = n ? per.reduce((a, b) => a + b, 0) / n : 0;
    ok(`${master}: Guardian reflects at least ${G_ATK}x ATK a blow, in a steady stream`, !r.err && n >= 6 && lo >= G_ATK - 0.05,
      r.err || `${n} blows in 16 s, ${lo.toFixed(2)}-${Math.max(...per).toFixed(2)}x ATK (mean ${mean.toFixed(2)}x)`);
  }
  // 2. Holy Shield: its reflect, through the invulnerability too
  const h = await fight('crusader', [[1, 'holyShield'], [5 * 60 + 20, 'mark', 'end']]);
  const hIn = h.refl.filter(([t, , inv]) => t <= 300 && inv), hAll = h.refl.filter(([t]) => t <= 300).map(([, d]) => d / h.atk);
  ok(`Holy Shield reflects at least ${H_ATK}x ATK a blow`, !h.err && hAll.length >= 3 && Math.min(...hAll) >= H_ATK - 0.05, h.err || `${hAll.length} blows, ${hAll.map((v) => v.toFixed(1)).join(' ')}x ATK`);
  ok('Holy Shield reflects while its invulnerability stops the blows', hIn.length >= 1, `${hIn.length} bounced while invulnerable`);
  // 3. Guardian, then Holy Shield 3 s in: Guardian's reflect must carry on after Holy Shield's 5 s
  const g = await fight('crusader', [[1, 'guardian'], [180, 'holyShield'], [180 + 300 + 120, 'mark', 'hsOver'], [180 + 300 + 120 + 8 * 60, 'mark', 'end']]);
  const after = g.refl.filter(([t]) => t > g.marks.hsOver);
  ok('a Holy Shield cast no longer cuts Guardian\'s reflect short', !g.err && after.length >= 3, g.err || `${after.length} Guardian reflects in the 8 s after Holy Shield ended`);
  // 4. a warded boss: the retaliation lands for 1 and fills the ward's break gauge (like any blow), it does not slip past the ward
  const w = await fight('crusader', [[1, 'guardian'], [60, 'ward', 6 * 60], [60 + 5 * 60, 'mark', 'end']]);
  const inWard = w.refl.filter(([t]) => t > 60 && t < 60 + 5 * 60).map(([, d]) => d / w.atk);
  ok('against a warded boss the retaliation lands for 1 and fills the break gauge', !w.err && inWard.length >= 2 && Math.max(...inWard) < 1 && (w.wardFed > 0 || w.wardBroke),
    w.err || `${inWard.length} blows in the ward, largest ${Math.max(...inWard).toFixed(2)}x ATK, gauge ${w.wardFed.toFixed(2)}${w.wardBroke ? ', shattered' : ''}`);
  for (const r of [h, g, w]) if (r.errs && r.errs.length) console.log('page errors: ' + r.errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
