// Bloodmoon Domain (nightreaper_ult) executes NON-boss foes under 25% HP. Its guard used to read m.boss, a flag no live
// monster carries (spawnMonster sets isBoss / isMiniBoss), so a boss at 24% HP died to the execute. This casts the skill
// at a normal mob, a mini-boss and a boss, all at 20% HP, and checks who is standing afterwards.
//
//   [SERVE_ROOT=<dir with serve.js + data/ + art>] node scripts/bloodmoon_execute_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11102';
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof SKILL_FNS !== 'undefined' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(1500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    for (let i = 0; i < 30 && !player.onGround; i++) await sleep(100);
    player.cls = 'rogue'; player.job = 'assassin'; player.master = 'nightreaper'; player.masteries = { nightreaper: true };
    player._god = true; player.level = 90; player.baseAtk = 1000; player.maxMp = 9999; player.mp = 9999; player.maxHp = 999999; player.hp = 999999; player.facing = 1;
    window.rollCrit = () => false; window.getCritDmg = () => 1; Math.random = () => 0.95;
    game.monsters.length = 0;
    // three foes in Bloodmoon's reach (950 x 520 px around the player), each at 20% of a huge pool so the 27 shuriken
    // and the nova cannot finish them - only the execute can
    const pin = (m, x) => { m.maxHp = 9e12; m.currentHp = 0.2 * m.maxHp; m.evasion = 0; m.speed = 0; m.atk = 0; m.x = x; m.y = player.y - 10; m.vx = 0; m.vy = 0; m.frozenTimer = 1e9; return m; };
    // four foes: a normal mob, a mini-boss (isMiniBoss), a real boss whose type definition carries boss: true, and a
    // normal type spawned AS a boss (isBoss without the definition flag) - the old guard only looked at m.boss
    const mob = pin(spawnMonster(player.x + 150, player.y - 10, 'slime', false), player.x + 150);
    const mini = pin(spawnMonster(player.x - 220, player.y - 10, 'slime', false, true), player.x - 220);
    const boss = pin(spawnMonster(player.x + 420, player.y - 10, 'legosaurus', true), player.x + 420);   // no intro banner for this one
    const flagBoss = pin(spawnMonster(player.x - 420, player.y - 10, 'slime', true), player.x - 420);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    const fl = (m) => ({ isBoss: !!m.isBoss, boss: !!m.boss, isMiniBoss: !!m.isMiniBoss });
    const flags = { boss: fl(boss), flagBoss: fl(flagBoss), mini: fl(mini), mob: fl(mob) };
    const before = { mob: mob.currentHp, mini: mini.currentHp, boss: boss.currentHp, flagBoss: flagBoss.currentHp };
    let err = null; try { SKILL_FNS.nightreaper_ult(); } catch (e) { err = String(e.message).slice(0, 160); }
    // the execute fires 880 ms after the cast; the game clock is slow in a headless browser, so wait generously
    for (let i = 0; i < 60 && !(mob.currentHp <= 0); i++) { await sleep(100); mob.x = player.x + 150; mini.x = player.x - 220; boss.x = player.x + 420; flagBoss.x = player.x - 420; }
    await sleep(1500);
    const frac = (m) => +(m.currentHp / m.maxHp).toFixed(4);
    return { err, flags, before, after: { mob: mob.currentHp, mini: mini.currentHp, boss: boss.currentHp, flagBoss: flagBoss.currentHp }, frac: { mob: frac(mob), mini: frac(mini), boss: frac(boss), flagBoss: frac(flagBoss) }, ver: GAME_VERSION };
  });
  console.log('build ' + r.ver);
  check(!r.err && r.flags.boss.isBoss && r.flags.flagBoss.isBoss && !r.flags.flagBoss.boss && r.flags.mini.isMiniBoss && !r.flags.mini.boss && !r.flags.mob.isBoss, 'the flags are what spawnMonster sets: isBoss / isMiniBoss; m.boss comes only from a boss type definition', JSON.stringify(r.flags) + (r.err ? ' err ' + r.err : ''));
  check(r.after.mob <= 0, 'a normal foe under 25% HP is executed', `mob ${r.before.mob.toExponential(2)} -> ${r.after.mob}`);
  check(r.after.boss > 0 && r.frac.boss > 0.15, 'a boss under 25% HP survives the execute (still takes the shuriken and nova)', `boss 20% -> ${(r.frac.boss * 100).toFixed(2)}%`);
  check(r.after.flagBoss > 0 && r.frac.flagBoss > 0.15, 'a boss spawned from a type without boss: true survives too', `flag-only boss 20% -> ${(r.frac.flagBoss * 100).toFixed(2)}%`);
  check(r.after.mini > 0 && r.frac.mini > 0.15, 'a mini-boss under 25% HP survives the execute', `mini-boss 20% -> ${(r.frac.mini * 100).toFixed(2)}%`);
  check(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
