#!/usr/bin/env node
// v0.30.1428: the Knight line's damage reflect (per user: crusader and dragoon "very very underpowered", "especially on the damage
// reflect damages, needs major improvement"). Reflect used to bounce back only a share of the damage that reached your HP bar - a
// boss's touch is clamped into a band of YOUR max HP, so it read a few hundred against bosses with millions. Every blow now also
// carries a retaliation scaled by your ATK. Real fight, no mocks: a Lv-50 knight (ATK pinned 400, god mode - the blow is still
// computed and shown) stands in a boss's touch.
//   - GUARDIAN: every reflected blow's ATK retaliation is 5x ATK through the boss's armour (v0.30.1525 op-pass: it skipped armour), in a steady stream
//   - HOLY SHIELD: its retaliation is 1x ATK + 15x DEF through the armour (per user; it was 12x, then 24x ATK) - including while its
//     invulnerability stops the blows; DEF is read without the +9999 of the first 2.5 s (the invulnerability itself)
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
const G_ATK = 10;   // v0.30.1604: doubled with every ATK multiplier (5 before)
const H_RET = (r) => 1 + 15 * r.def / r.atk;   // Holy Shield: 1x ATK + 15x DEF, over ATK (per user)
// v0.30.1525 op-pass - a reflected blow is two hits on one step: the share (thorns) and the ATK retaliation (retaliate)
const blows = (r) => { const by = new Map(); for (const [t, d, inv, sk] of r.refl) { const b = by.get(t) || { t, total: 0, ret: 0, inv }; b.total += d; if (sk === 'retaliate') b.ret += d; by.set(t, b); } return [...by.values()]; };
// each retaliation over ATK x the armour share x what the boss's state added to that hit (crit streak, punish window - thorns get them too)
const rets = (r, keep = () => true) => r.refl.filter((x) => x[3] === 'retaliate' && keep(x)).map((x) => x[1] / (r.atk * r.share * x[4]));
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
    // v0.30.1525 op-pass - the share of a 'retaliate' hit this boss's armour lets through
    let share = 1; { const h0 = m.currentHp; orig(m, 1000000, false, 'retaliate'); share = (h0 - m.currentHp) / 1000000; m.currentHp = h0; }
    window.hitMonster = function (mm, dmg, c, sk) { const b = mm && mm.currentHp;
      // v0.30.1525 op-pass - what any hit on this boss gains this step: the crit streak (+3% each, cap 15%) and a punish window
      const f = (1 + Math.min(0.15, (game.critStreak | 0) * 0.03)) * (mm && mm._stagger > 0 ? BOSS_STAGGER_BONUS : (mm && mm._dirOpenT > 0 ? BOSS_OPENING_BONUS : 1));
      const res = orig.apply(this, arguments);
      if ((sk === 'thorns' || sk === 'retaliate') && mm === m && typeof b === 'number') refl.push([game.time | 0, Math.max(0, b - mm.currentHp), player.invulnerable > 0 ? 1 : 0, sk, f]); return res; };
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
    return { atk: getAtk(), def: _lxParryDef(), refl: refl.map(([t, d, inv, sk, f]) => [t - t0, d, inv, sk, f]), share, marks, wardFed, wardBroke, hsUntil: (player._holyReflectUntil | 0) - t0, gUntil: (player._guardianReflect | 0) - t0 };
  }, { master, plan });
  r.errs = errs.slice(0, 2); await page.close(); return r;
};
try {
  // 1. Guardian alone, 16 s in the King's touch (a crusader, then a dragoon)
  for (const master of ['crusader', 'dragoon']) {
    const r = await fight(master, [[1, 'guardian'], [16 * 60, 'mark', 'end']]);
    const per = rets(r), n = per.length, lo = n ? Math.min(...per) : 0, hi = n ? Math.max(...per) : 0;
    ok(`${master}: Guardian's retaliation is ${G_ATK}x ATK through the boss's armour, in a steady stream`, !r.err && n >= 6 && lo >= G_ATK * 0.9 && hi <= G_ATK * 1.1,
      r.err || `${n} blows in 16 s, ${lo.toFixed(2)}-${hi.toFixed(2)}x ATK after armour share ${r.share.toFixed(3)} and punish windows`);
  }
  // 2. Holy Shield: its reflect, through the invulnerability too
  const h = await fight('crusader', [[1, 'holyShield'], [5 * 60 + 20, 'mark', 'end']]);
  const hB = blows(h).filter((b) => b.t <= 300), hIn = hB.filter((b) => b.inv), hAll = rets(h, (x) => x[0] <= 300);
  ok(`Holy Shield's retaliation is 1x ATK + 15x DEF through the boss's armour (${H_RET(h).toFixed(2)}x ATK at DEF ${h.def}, ATK ${h.atk})`, !h.err && hAll.length >= 3 && Math.min(...hAll) >= H_RET(h) * 0.9 && Math.max(...hAll) <= H_RET(h) * 1.1, h.err || `${hAll.length} blows, ${hAll.map((v) => v.toFixed(1)).join(' ')}x ATK after armour share ${h.share.toFixed(3)} and punish windows`);
  ok('Holy Shield reflects while its invulnerability stops the blows', hIn.length >= 1, `${hIn.length} bounced while invulnerable`);
  // 3. Guardian, then Holy Shield 3 s in: Guardian's reflect must carry on after Holy Shield's 5 s
  const g = await fight('crusader', [[1, 'guardian'], [180, 'holyShield'], [180 + 300 + 120, 'mark', 'hsOver'], [180 + 300 + 120 + 8 * 60, 'mark', 'end']]);
  const after = blows(g).filter((b) => b.t > g.marks.hsOver);
  ok('a Holy Shield cast no longer cuts Guardian\'s reflect short', !g.err && after.length >= 3, g.err || `${after.length} Guardian reflects in the 8 s after Holy Shield ended`);
  // 4. a warded boss: the retaliation lands for 1 and fills the ward's break gauge (like any blow), it does not slip past the ward
  const w = await fight('crusader', [[1, 'guardian'], [60, 'ward', 6 * 60], [60 + 5 * 60, 'mark', 'end']]);
  const inWard = blows(w).filter((b) => b.t > 60 && b.t < 60 + 5 * 60).map((b) => b.total / w.atk);
  ok('against a warded boss the retaliation lands for 1 and fills the break gauge', !w.err && inWard.length >= 2 && Math.max(...inWard) < 1 && (w.wardFed > 0 || w.wardBroke),
    w.err || `${inWard.length} blows in the ward, largest ${Math.max(...inWard).toFixed(2)}x ATK, gauge ${w.wardFed.toFixed(2)}${w.wardBroke ? ', shattered' : ''}`);
  for (const r of [h, g, w]) if (r.errs && r.errs.length) console.log('page errors: ' + r.errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
