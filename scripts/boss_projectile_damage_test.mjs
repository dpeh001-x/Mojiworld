#!/usr/bin/env node
// Boss + zodiac projectile damage - v0.30.594. Per user: "projectiles such as these for zodiac bosses and
// bosses should all be doing more damage".
//
// Two faults, two halves. (1) The 3000-5000 zodiac band (v0.30.475/477) keys on p._zodiacSign, and only the
// generic aura bolt and the homing bolt carried it - the 31 sign-specific spawns (quake, boulder, shards,
// pincers, arrows, ice, waves, whirls...) fell through to the plain-mob path and were crushed by armour. The
// test that pinned the band built its own tagged projectile, so it never saw this. (2) Non-zodiac boss shots
// were clamped to 0.75 of _refLoAtLv (~1,750 at Lv 70) or carried no band at all; they now roll a band of the
// class-neutral at-level bar through the same DEF ramp (_lxRolledProjLoss).
//
// Checked three ways: STATICALLY on the shipped file (no untagged spawn in the zodiac / boss AI - this is the
// check the old test lacked), LIVE (each boss spawned in an arena, every projectile it fires inspected), and
// by MEASURED HP LOSS (banded shots fired into a real player across a DEF sweep, plain shot as the control).
//   node scripts/boss_projectile_damage_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10373); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const GAME = process.env.MOJI_GAME_FILE ? path.resolve(process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const avg = (a) => Math.round(a.reduce((s, x) => s + x, 0) / Math.max(1, a.length));

// ---- static: every enemy projectile spawned inside these AI functions must carry its tag ----
const src = readFileSync(GAME, 'utf8');
function untagged(startAnchor, endAnchor, good) {
  const a = src.indexOf(startAnchor), b = src.indexOf(endAnchor); if (a < 0 || b < a) return ['range not found'];
  // every owner:'enemy' (either spacing) whose ENCLOSING object literal is a projectile (it has a skill:; hazards
  // carry type:) - so a projectile built in a variable and pushed by name (the Smith's hammer) is seen too.
  // Matches on a comment line are skipped.
  const region = src.slice(a, b), out = []; const re = /owner:\s*'enemy'/g; let m;
  while ((m = re.exec(region))) {
    if (region.slice(region.lastIndexOf('\n', m.index) + 1, m.index).includes('//')) continue;
    let i = m.index, depth = 0; for (; i >= 0; i--) { const ch = region[i]; if (ch === '}') depth++; else if (ch === '{') { if (depth === 0) break; depth--; } }
    let j = m.index; depth = 0; for (; j < region.length; j++) { const ch = region[j]; if (ch === '{') depth++; else if (ch === '}') { if (depth === 0) break; depth--; } }
    const body = region.slice(i, j + 1); if (!/\bskill:/.test(body)) continue;
    if (!good(body)) out.push((body.match(/skill:\s*'([^']+)'/) || [])[1] || '?');
  }
  return out;
}
const zU = untagged('function zodiacBossAI(', 'function drawAetherion(', (b) => b.includes('_zodiacSign'));
const bU = [...untagged('function _bossSpecialAttacks(', 'function _bossThreatHit(', (b) => /_bossBand|_gravBand|getMaxHp/.test(b)),
            ...untagged('function bossAI(', 'function _bossDiffMul(', (b) => /_bossBand|_gravBand|getMaxHp/.test(b))];
ok('static: every projectile the zodiac AI spawns carries _zodiacSign', zU.length === 0, zU.join(',') || 'none untagged');
ok('static: every projectile the boss AI spawns carries a band (Gravitos band / death-orb law excepted)', bU.length === 0, bU.join(',') || 'none untagged');

// ---- live ----
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _bossHitBand === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('innerDimension', 300); await sleep(900);
    const o = { ver: GAME_VERSION, bands: { super: LX_BOSS_PROJ_SUPER, story: LX_BOSS_PROJ_STORY }, bar65: _refBarAtLv(65), bar50: _refBarAtLv(50), errs: [] };
    // live: spawn, let it fire, inspect every projectile it puts on the field
    player._god = true; game.paused = false;
    // a boss's delayed patterns (scheduleSkillTimer / setTimeout) outlive the array wipe and would fire into the
    // NEXT boss's window - the Smith's hammers landed in the Sovereign's sample - so each boss is killed, its
    // pending timers cleared, and a beat waited before the next spawn
    const clearField = async () => {
      for (const m of game.monsters) { m.currentHp = 0; m._dying = true; }
      for (const id of (player._pendingTimeouts || [])) clearTimeout(id);
      if (player._pendingTimeouts) player._pendingTimeouts.length = 0;
      game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0; await sleep(700); game.projectiles.length = 0;
    };
    const live = async (type, sign, ms) => {
      await clearField();
      try { spawnMonster(player.x + 420, player.y - 10, type, true); } catch (e) { return { n: 0, bad: {}, err: String(e.message).slice(0, 80) }; }
      const m = game.monsters[game.monsters.length - 1]; if (!m || m.type !== type) return { n: 0, bad: {}, err: 'no spawn' };
      if (sign) { m.zodiacBoss = true; if (!m.zodiacSign) m.zodiacSign = sign; }
      const seen = new Set(), bad = {}; let n = 0; const t0 = performance.now();
      while (performance.now() - t0 < ms && n < 10) {
        game.paused = false; player.hp = getMaxHp(); player.invulnerable = 0; m.currentHp = m.maxHp || m.currentHp || 1;
        for (const p of game.projectiles) { if (!p || p.owner !== 'enemy' || seen.has(p)) continue; seen.add(p); n++;
          const good = sign ? (p._zodiacSign === sign) : !!(p._bossBand || p._gravBand || p._srcType); if (!good) bad[p.skill || '?'] = (bad[p.skill || '?'] | 0) + 1; }
        await sleep(40);
      }
      game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
      return { n, bad };
    };
    o.zodiac = {}; for (const s of ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']) o.zodiac[s] = await live('zodiac_' + s, s, 12000);
    o.boss = {}; for (const t of ['kingKrook', 'octobaby', 'aetherion', 'sundered_smith', 'towerSovereign']) o.boss[t] = await live(t, null, 12000);
    // measured loss: banded shots into a real Lv 85 mage, DEF swept, plain shot as the control
    player._god = false; player.level = 85; player.cls = 'mage';
    const fire = async (defVal, extra, pl) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        game.paused = false; player.baseDef = defVal; player.mods.def = 0;
        if (typeof invalidateEquipBonusCache === 'function') invalidateEquipBonusCache(); if (typeof refreshGearCache === 'function') refreshGearCache();
        player.maxHp = 400000; player.hp = 400000; player.blockTimer = 0; player._aegis = false; player.invulnerable = 0; player.lastHitTime = -9999;
        Object.assign(player, pl || {}); if (pl && pl.maxHp) player.hp = pl.maxHp;
        game.projectiles.length = 0; const before = player.hp;
        game.projectiles.push(Object.assign({ x: player.x + player.w / 2 - 6, y: player.y + player.h / 2 - 6, vx: 0, vy: 0, w: 12, h: 12, life: 120, damage: 400, owner: 'enemy', skill: 'mbolt', color: '#fff' }, extra || {}));
        for (let i = 0; i < 25 && player.hp === before; i++) await sleep(20);
        const lost = before - player.hp; game.projectiles.length = 0; player.invulnerable = 0; player.lastHitTime = -9999;
        if (lost > 0) return { lost, def: Math.round(getDef()) };
      }
      return { lost: 0, def: Math.round(getDef()) };
    };
    const sample = async (defVal, n, extra, pl) => { const out = []; for (let i = 0; i < n; i++) out.push((await fire(defVal, extra, pl)).lost); return out; };
    o.superBand = _bossHitBand({ isBoss: true, superBoss: true, level: 65, type: 'aetherion' }, 'ranged');
    o.storyBand = _bossHitBand({ isBoss: true, level: 50, type: 'kingKrook' }, 'ranged');
    o.sweep = []; for (const d of [0, 2000, 4000, 8000]) { const z = await sample(d, 12, { _bossBand: o.superBand }); const p = await fire(d); o.sweep.push({ set: d, def: p.def, plain: p.lost, all: z }); }
    o.story0 = await sample(0, 8, { _bossBand: o.storyBand });
    o.krook = await sample(0, 4, { _bossBand: o.storyBand, _srcType: 'kingKrook' }, { maxHp: 10000 });
    o.zodiac0 = await sample(0, 6, { _zodiacAttacker: true, _zodiacSign: 'taurus' });
    o.blocked = await sample(0, 4, { _bossBand: o.superBand }, { blockTimer: 600 });
    // Gravitos: a form-1 comet (ceiling 1,717) must now land at least the hyper roll on the Lv-100 bar; form 3's
    // 17,750 ceiling must still carry a huge shot above that roll
    o.bar100 = _refBarAtLv(100);
    o.gravP1 = await sample(0, 8, { _gravBand: _gravHeavyBand(1, 'comet'), damage: 2916, _ignoreDef: true });
    o.gravP1hi = await sample(8000, 4, { _gravBand: _gravHeavyBand(1, 'comet'), damage: 2916, _ignoreDef: true });
    o.gravP3 = await sample(0, 3, { _gravBand: _gravHeavyBand(3, 'comet'), damage: 99999, _ignoreDef: true });
    return o;
  });
  console.log(`build ${r.ver}  bands super ${r.bands.super} story ${r.bands.story}  bar(65) ${r.bar65}  bar(50) ${r.bar50}`);
  let fired = 0;
  for (const [s, v] of Object.entries(r.zodiac)) { if (v.n === 0) { console.log(`NOTE ${s}: fired nothing in 12 s${v.err ? ' (' + v.err + ')' : ''}`); continue; } fired++; ok(`live: zodiac ${s} fired ${v.n} projectile(s), every one tagged with its sign`, Object.keys(v.bad).length === 0, Object.entries(v.bad).map(([k, c]) => k + ' x' + c).join(', ') || 'all tagged'); }
  ok('live: at least eight zodiac bosses fired in the arena window', fired >= 8, fired + '/12 fired');
  for (const [t, v] of Object.entries(r.boss)) { if (v.n === 0) { console.log(`NOTE ${t}: fired nothing in 12 s${v.err ? ' (' + v.err + ')' : ''}`); continue; } ok(`live: ${t} fired ${v.n} projectile(s), every one banded`, Object.keys(v.bad).length === 0, Object.entries(v.bad).map(([k, c]) => k + ' x' + c).join(', ') || 'all banded'); }
  const B = r.bar65, mid = 0.24 * B, S = r.sweep.map((s) => ({ ...s, mean: avg(s.all), min: Math.min(...s.all), max: Math.max(...s.all) }));
  for (const s of S) console.log(`  DEF ${String(s.def).padStart(5)}  super-boss shot mean ${s.mean} (${s.min}-${s.max})   plain shot ${s.plain}`);
  ok('the boss bands are declared: super 18-30%, story 12-20% of the at-level bar', r.bands.super[0] === 0.18 && r.bands.super[1] === 0.30 && r.bands.story[0] === 0.12 && r.bands.story[1] === 0.20);
  ok('_bossHitBand(ranged) returns a ROLL band on the class-neutral bar at the boss level', r.superBand.roll === true && r.superBand.ref === r.bar65 && r.storyBand.ref === r.bar50, JSON.stringify(r.superBand));
  ok('a super boss shot at DEF 0 lands inside 18-30% of the Lv-65 bar', S[0].min >= Math.floor(0.18 * B) - 1 && S[0].max <= Math.ceil(0.30 * B) + 1, `${S[0].min}-${S[0].max} of ${Math.floor(0.18 * B)}-${Math.ceil(0.30 * B)}`);
  ok('DEF 2,000 brings it to about x0.75 (the v0.30.477 anchor)', Math.abs(S[1].mean - 0.75 * mid) <= 0.06 * B, `mean ${S[1].mean} vs ${Math.round(0.75 * mid)}`);
  ok('DEF 4,000 brings it to about x0.50', Math.abs(S[2].mean - 0.50 * mid) <= 0.05 * B, `mean ${S[2].mean} vs ${Math.round(0.50 * mid)}`);
  ok('DEF 8,000 floors at x0.35 - armour never makes a boss harmless', Math.abs(S[3].mean - 0.35 * mid) <= 0.05 * B, `mean ${S[3].mean} vs ${Math.round(0.35 * mid)}`);
  ok('the sweep is monotone in DEF', S[0].mean > S[1].mean && S[1].mean > S[2].mean && S[2].mean > S[3].mean);
  ok('a PLAIN mob shot is still crushed by the same armour (the control)', S[0].plain > 0 && S[0].plain >= 4 * Math.max(1, S[3].plain), `${S[0].plain} -> ${S[3].plain}`);
  ok('a story boss shot at DEF 0 lands inside 12-20% of the Lv-50 bar', Math.min(...r.story0) >= Math.floor(0.12 * r.bar50) - 1 && Math.max(...r.story0) <= Math.ceil(0.20 * r.bar50) + 1, `${Math.min(...r.story0)}-${Math.max(...r.story0)} of ${Math.floor(0.12 * r.bar50)}-${Math.ceil(0.20 * r.bar50)}`);
  ok("Krook's 15%-of-max-HP floor (v0.30.397) still wins where it is higher", Math.min(...r.krook) >= 1400, 'min ' + Math.min(...r.krook) + ' at 10,000 max HP');
  ok('a zodiac shot is unchanged: 3,000-5,000 at DEF 0', Math.min(...r.zodiac0) >= 3000 && Math.max(...r.zodiac0) <= 5000, `${Math.min(...r.zodiac0)}-${Math.max(...r.zodiac0)}`);
  ok('blocking trims a banded shot to ~30%', Math.abs(avg(r.blocked) - 0.30 * mid) <= 0.06 * B, `mean ${avg(r.blocked)} vs ${Math.round(0.30 * mid)}`);
  const G = r.bar100;
  ok('a Gravitos form-1 comet lands at least the hyper roll on the Lv-100 bar (was capped at 1,717)', Math.min(...r.gravP1) >= Math.floor(0.18 * G) - 1 && Math.max(...r.gravP1) <= Math.ceil(0.30 * G) + 1, `${Math.min(...r.gravP1)}-${Math.max(...r.gravP1)} of ${Math.floor(0.18 * G)}-${Math.ceil(0.30 * G)}`);
  ok('at DEF 8,000 that floor still holds at x0.35 of the roll', Math.min(...r.gravP1hi) >= Math.floor(0.35 * 0.18 * G) - 1 && Math.max(...r.gravP1hi) <= Math.ceil(0.35 * 0.30 * G) + 1, `${Math.min(...r.gravP1hi)}-${Math.max(...r.gravP1hi)}`);
  ok("a Gravitos form-3 comet still reaches its 17,750 ceiling - the floor lifts, it never lowers", Math.min(...r.gravP3) === 17750 && Math.max(...r.gravP3) === 17750, `${Math.min(...r.gravP3)}-${Math.max(...r.gravP3)}`);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
