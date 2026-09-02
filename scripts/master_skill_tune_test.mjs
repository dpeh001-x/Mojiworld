// MASTER SKILL TUNING — Nightreaper down, Dragoon traded, Ballista untouched.
// ============================================================================
// Per user, against the v0.30.355 audit table: "nightreaper B reduce CD to 45s,
// reduce x ATK to 240 / Dragoon X increase CD to 25s, x ATK to 80 / Nightreaper
// X xATK to 100, CD to 25s / Balista B x ATK to 200".
//
// THREE OF THE FOUR WERE ACTIONED AS ASKED. The fourth was not, because
// re-measuring found the number it was based on was my own measurement error.
//
// The v0.30.355 audit measured a master's two skills back to back in one page
// load. Anything the first skill left running - turret arrays, volley spawners,
// scheduled skill timers, all held on the player where the harness's field-wipe
// could not reach - was still landing during the second skill's window. Every
// FIRST-measured skill was accurate; every SECOND-measured one was inflated:
//     nightreaper.x  164.1 -> 160.9 isolated   (first, accurate)
//     dragoon.x       55.6 ->  56.6 isolated   (first, accurate)
//     nightreaper.b  441.9 -> 177.1 isolated   (second, 2.5x inflated)
//     ballista.b     346.6 ->   3.0 isolated   (second, it was measuring the volley)
// Ballista's War Machine is therefore NOT a 5.4x anomaly. In isolation it is one
// of the weakest buttons in the game, and cutting it to 200 would have been a
// 60x buff to a number that never existed. It is left alone.
//
// Nightreaper B's requested cut is applied as a RATIO for the same reason: the
// user asked for 441.9 -> 240, which is -46%, and -46% of the real 177.1 is
// 96.2. Reading "240" literally would have BUFFED a skill they asked to reduce.
//
// The measured checks below use wide bands on purpose: these skills' hits are
// homing and their per-run spread is 2-17%. The exact numbers are pinned by the
// constant assertions, which are deterministic; the measurements confirm the
// constants actually reach the damage that lands.
// Run: node scripts/master_skill_tune_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9957);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const errs = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
const URL = `http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`;
const boot = async () => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function'
    && typeof SKILLS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(6500);
  await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
  await page.fill('#hero-name-input', 'TuneTest').catch(() => {});
  await page.evaluate(() => {
    const m = document.getElementById('class-select-modal');
    if (!m) return;
    for (const el of m.querySelectorAll('button,div,li')) {
      if (el.children.length > 3) continue;
      if (getComputedStyle(el).display === 'none') continue;
      if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
    }
  });
  await page.click('#cs-nav-next').catch(() => {});
  await page.waitForTimeout(2200);
  await page.evaluate(async () => { loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1400)); });
};
await boot();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

// ---- cooldowns, exactly as asked -------------------------------------------
const cds = await page.evaluate(() => ({
  nrB: SKILLS.nightreaper_ult.cd, nrX: SKILLS.nightreaper_mark.cd,
  drX: SKILLS.dragoon_skylance.cd, baB: SKILLS.ballista_ult.cd,
}));
ok('Nightreaper B cooldown 50s -> 45s', cds.nrB === 45000, `${cds.nrB} ms`);
ok('Nightreaper X cooldown 22s -> 25s', cds.nrX === 25000, `${cds.nrX} ms`);
ok('Dragoon X cooldown 11s -> 25s', cds.drX === 25000, `${cds.drX} ms`);
ok('Ballista B cooldown untouched at 60s', cds.baB === 60000, `${cds.baB} ms`);

// ---- the damage constants — deterministic, so these are the precise pins ----
const src = await page.evaluate(async () => {
  const r = await fetch(location.pathname + location.search);
  const s = await r.text();
  const has = (x) => s.split(x).length - 1;
  return {
    nrShard: has('damage: getAtk() * 0.76 + 8'),
    nrShardOld: has('damage: getAtk() * 1.4 + 8'),
    nrNova: has("performAround(380, 2.2, { color: '#ff2244'"),
    nrDagger: has('getAtk() * 0.62 * (isCrit ? getCritDmg() : 1)'),
    nrSnap: has('getAtk() * 1.24 + 25'),
    drSlam: has("performAround(340, 8.15, { color:'#88ccff'"),
    drExtra: has('dragoon_skylance:  { extraHit: 2.34 }'),
    baTurretUntouched: has('damage: Math.floor(getAtk() * 0.9) + 6'),
  };
});
ok('Bloodmoon shuriken 1.4x -> 0.76x ATK, and the old value is gone',
  src.nrShard === 1 && src.nrShardOld === 0, JSON.stringify({ new: src.nrShard, old: src.nrShardOld }));
ok('Bloodmoon nova 4.0x -> 2.2x ATK', src.nrNova === 1);
ok('Eclipse dagger 1.0x -> 0.62x ATK', src.nrDagger === 1);
ok('Eclipse snap 2.0x -> 1.24x ATK', src.nrSnap === 1);
ok('Sky Lance slam 5.2x -> 8.15x ATK (a BUFF against a 2.3x longer cooldown)', src.drSlam === 1);
ok('Sky Lance extra hit 1.5x -> 2.34x, scaled with the slam', src.drExtra === 1);
ok('Ballista War Machine turret damage is UNCHANGED at 0.9x — it was never an anomaly',
  src.baTurretUntouched === 1, 'the 346.6 xATK reading was the volley bleeding into its window');

// ---- what actually lands ----------------------------------------------------
const measure = async (master, cls, job, skillId) => page.evaluate(async ({ master, cls, job, skillId }) => {
  game.paused = false;
  player.cls = cls; player.job = job; player.master = master;
  player.level = 50; player._god = true; player.baseAtk = 400; player.baseAcc = 900;
  player.mods = player.mods || {}; player.mods.critDmg = 0; player.crit = 0; player.baseCrit = 0;
  player.mp = 9e9; player.skillCooldowns = {}; player.buffs = {};
  game.monsters = []; game.projectiles.length = 0; game.hazards.length = 0;
  const t = (game.mapData.spawns.find((sp) => sp && sp.type && !sp.boss) || {}).type;
  const ds = [];
  for (let k = 0; k < 6; k++) {
    spawnMonster(player.x + 190 + k * 66, player.y, t, false);
    const x = game.monsters[game.monsters.length - 1];
    if (x) { x.maxHp = x.currentHp = 9e12; x.def = 0; x.evasion = 0; x.invulnerable = 0; x._px = x.x; x._py = x.y; ds.push(x); }
  }
  const dset = new Set(ds);
  let dealt = 0;
  const orig = window.hitMonster;
  window.hitMonster = function (m, d, c, tag) {
    const b = m && m.currentHp; const r = orig.apply(this, arguments);
    if (dset.has(m) && typeof b === 'number') dealt += Math.max(0, b - m.currentHp);
    return r;
  };
  try { castSkill(skillId); } catch (e) {}
  for (let i = 0; i < 480; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    for (const x of ds) { x.currentHp = x.maxHp; x.x = x._px; x.y = x._py; x.vx = 0; x.vy = 0; }
    player.mp = 9e9; player.hp = getMaxHp();
  }
  window.hitMonster = orig;
  const atk = getAtk();
  game.monsters = []; game.projectiles.length = 0; game.hazards.length = 0;
  return +(dealt / atk).toFixed(1);
}, { master, cls, job, skillId });

// One page load per skill — the whole point of the v0.30.357 harness fix.
await boot();
const mNrB = await measure('nightreaper', 'rogue', 'assassin', 'nightreaper_ult');
await boot();
const mNrX = await measure('nightreaper', 'rogue', 'assassin', 'nightreaper_mark');
await boot();
const mDrX = await measure('dragoon', 'warrior', 'knight', 'dragoon_skylance');

ok('Bloodmoon Domain lands near 96 xATK — the -46% the user asked for, applied to its REAL 177.1',
  mNrB >= 70 && mNrB <= 125, `${mNrB} xATK/cast (isolated mean measured 93.8; band is wide because spread is 17%)`);
ok('Eclipse Massacre lands near the requested 100 xATK',
  mNrX >= 78 && mNrX <= 122, `${mNrX} xATK/cast (isolated mean 98.1, spread 2%)`);
ok('Sky Lance lands near the requested 80 xATK',
  mDrX >= 62 && mDrX <= 100, `${mDrX} xATK/cast (isolated mean 83.2, spread 14%)`);
ok('and Sky Lance is now a burst button, not a sustain one: 5.05 -> ~3.3 xATK per second of cooldown',
  (mDrX / 25) < 4.2, `${(mDrX / 25).toFixed(2)} xATK/s against 5.05 before`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
