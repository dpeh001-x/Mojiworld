// LAUNCH LOOPS (v0.30.861, per user "fix this" on launch sweep L6): the cursed chest is today's and opens once per map per
// day; Nightmare / zodiac echoes pay gear on the refight terms, once per 10 play-minutes per boss; a day that goes
// backwards grants no daily, parcel or Boss Rush reward; an away player's summon kills pay and count nothing.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/loops_fix_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11163';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof killMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const boot = () => page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; _playBossIntro = function () {}; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 40; player._god = true; player.hp = player.maxHp = 99999; player._tutorialSeen = true;
    loadMap('glasswindSteppe', 900); await sleep(1500); game.paused = false; return true; });
  await boot();
  const closeAll = () => page.evaluate(() => { try { closeAllModals && closeAllModals(); } catch (e) {} game.paused = false; });

  // ---- 1. cursed chest ----
  const c1 = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const elig = (id) => { const m = MAPS[id]; if (!m || m.isTown || m.isBossArena || m.isVoid || m._noNaturalChests || id === 'void' || id.indexOf('tower_b') === 0 || id.indexOf('clockwork') === 0 || id.indexOf('exp_') === 0) return false; return Array.isArray(m.spawns) && m.spawns.some((sp) => sp && sp.type && (sp.count == null || sp.count > 0)); };
    const ids = Object.keys(MAPS).filter(elig); const seeded = typeof _lxCurseRoll === 'function';
    const touched = seeded ? ids.find((i) => _lxCurseRoll(i)) : ids[0], calm = seeded ? ids.find((i) => !_lxCurseRoll(i)) : null;
    const R = Math.random; Math.random = () => 0.05;   // every per-load roll lands on "cursed"
    let chests = 0, cursedLoads = 0; const loads = 6;
    try { for (let k = 0; k < loads; k++) { loadMap(touched, 400); await sleep(250); if (game._mapCursed) cursedLoads++;
        const cc = (game.chests || []).filter((c) => c && c._cursed); chests += cc.length; for (const c of cc) { try { openChest(c); } catch (e) {} } game._curseHex = null; } } finally { Math.random = R; }
    let calmCursed = 0; if (calm) { Math.random = () => 0.05; try { for (let k = 0; k < 4; k++) { loadMap(calm, 400); await sleep(150); if (game._mapCursed) calmCursed++; } } finally { Math.random = R; } }
    let saved = null; try { if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow(); else saveState(); const raw = localStorage.getItem(SAVE_KEY); saved = raw ? (JSON.parse(raw).game || {})._cursedChestOpened || null : null; } catch (e) { saved = 'err ' + e.message; }
    return { seeded, touched, calm, loads, cursedLoads, chests, calmCursed, saved };
  });
  check(c1.seeded && c1.cursedLoads === c1.loads && c1.chests === 1, 'a nightmare-touched map stays touched on every re-entry and its Cursed Chest appears once (was: one per load)', J(c1));
  check(c1.seeded && c1.calm && c1.calmCursed === 0, 'a map that is not touched today cannot be rolled into one by re-entering', J({ calm: c1.calm, calmCursed: c1.calmCursed }));
  check(c1.saved && typeof c1.saved === 'object' && Object.keys(c1.saved).some((k) => k.indexOf(c1.touched + '@') === 0), 'the opened chest is in the save', J(c1.saved));
  await closeAll(); await boot();

  // ---- 2. echo gear ----
  const c2 = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const run = async (flags) => { const m = spawnMonster(player.x + 200, player.y - 40, 'mooma', true, false); Object.assign(m, flags); m.evasion = 0;
      const before = game.drops.length; const R = Math.random; Math.random = () => 0.001;
      try { m.currentHp = 0; killMonster(m); } finally { Math.random = R; }
      await sleep(60); const gear = game.drops.slice(before).filter((d) => d && d.type === 'item' && d.item && ['weapon', 'armor', 'accessory', 'accessorie'].includes(d.item.slot)).length;
      game.drops.length = 0; try { closeAllModals && closeAllModals(); } catch (e) {} game.paused = false; return gear; };
    game._echoGearAt = {}; const nm = { _echoBoss: true, _nightmareEcho: true };
    const a = await run(nm), b = await run(nm), c = await run(nm); game._playMs = (game._playMs || 0) + 10 * 60 * 1000 + 1000; const d = await run(nm);
    const z = await run({ _echoBoss: true, zodiacBoss: true, zodiacSign: 'aries' }), z2 = await run({ _echoBoss: true, zodiacBoss: true, zodiacSign: 'aries' });
    const duo = await run({ _echoBoss: true, _duoTrial: true });
    return { nightmare: [a, b, c, d], zodiac: [z, z2], duo };
  });
  check(c2.nightmare[0] === 1 && c2.nightmare[1] === 0 && c2.nightmare[2] === 0 && c2.nightmare[3] === 1, 'a Nightmare echo drops one gear piece per 10 play-minutes (refight budget), not three per summon', J(c2));
  check(c2.zodiac[0] <= 1 && c2.zodiac[1] === 0, 'a zodiac echo is on the same terms', J(c2.zodiac));
  check(c2.duo >= 2, 'the Duo Trial keeps its full drop (unchanged)', J(c2.duo));
  await closeAll(); await boot();

  // ---- 3. dailies and the Boss Rush reward when the day goes backwards ----
  const c3 = await page.evaluate(() => { const D = dailyIndex(); const coins = () => (player.mojicoins || 0);
    const st = (day, extra) => Object.assign({ day, streak: 5, challenge: 'kill10', progress: 0, claimed: true, seenMaps: [], seenNpcs: [], parcelClaimed: true }, extra || {});
    game.dailyState = st(D + 1); let c0 = coins(); checkDaily(); const back = { paid: coins() - c0, day: game.dailyState.day - D, parcel: !!game.dailyState.parcelClaimed, streak: game.dailyState.streak };
    game.dailyState = st(D - 1); c0 = coins(); checkDaily(); const fwd = { paid: coins() - c0, day: game.dailyState.day - D, streak: game.dailyState.streak };
    game._dailyClockHealed = false; game.dailyState = st(D + 40); c0 = coins(); checkDaily(); const heal1 = { paid: coins() - c0, day: game.dailyState.day - D };
    game.dailyState = st(D + 40); c0 = coins(); checkDaily(); const heal2 = { paid: coins() - c0, day: game.dailyState.day - D };
    const rush = (last) => { game._bossRushRewardDay = last; game.bossRush = { active: true, t0: Date.now() - 60000, downs: 3, idx: 3, queue: ['a', 'b', 'c'], splits: [] }; const s0 = player.setshards || 0; try { _bossRushComplete(); } catch (e) { return 'err ' + e.message; } return (player.setshards || 0) - s0; };
    return { back, fwd, heal1, heal2, rushBack: rush(D + 1), rushFwd: rush(D - 1) };
  });
  check(c3.back.paid === 0 && c3.back.day === 1 && c3.back.parcel && c3.back.streak === 5, 'a clock set back a day pays no login bonus, keeps the parcel claimed and the streak (was: paid again, streak reset)', J(c3.back));
  check(c3.fwd.paid > 0 && c3.fwd.day === 0 && c3.fwd.streak === 6, 'the next real day still pays and grows the streak', J(c3.fwd));
  check(c3.heal1.paid === 0 && c3.heal1.day === 0 && c3.heal2.paid === 0 && c3.heal2.day === 40, 'a day stored 40 days ahead is healed once to today without paying, and never again', J({ heal1: c3.heal1, heal2: c3.heal2 }));
  check(c3.rushBack === 0 && c3.rushFwd > 0, 'the Boss Rush daily reward: not re-paid when the day goes back, paid on a later day', J({ back: c3.rushBack, fwd: c3.rushFwd }));
  await closeAll(); await boot();

  // ---- 4. away: a summon's kill pays and counts nothing; the player's own kill still pays ----
  const kill = (tag, away) => page.evaluate(async ({ tag, away }) => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (away) window._lxLastInputAt = performance.now() - 200000;
    const m = spawnMonster(player.x + 60, player.y - 10, 'slime', false, false); m.maxHp = m.currentHp = 10; m.evasion = 0; m.traits = null;
    const e0 = player.exp, k0 = game.kills, lv0 = player.level, d0 = game.drops.length; const R = Math.random; Math.random = () => 0.001;
    try { hitMonster(m, 99999, false, tag); } finally { Math.random = R; } await sleep(80);
    const out = { exp: (player.level > lv0) ? 'lvl' : player.exp - e0, kills: game.kills - k0, drops: game.drops.length - d0, dead: m.currentHp <= 0 };
    game.drops.length = 0; return out; }, { tag, away });
  const awayMon = await kill('mojimon', true), awayMin = await kill('minion', true), awayOwn = await kill('melee', true);
  await page.keyboard.press('Shift'); await page.waitForTimeout(100);
  const backMon = await kill('mojimon', false);
  check(awayMon.dead && awayMon.exp === 0 && awayMon.kills === 0 && awayMon.drops === 0, 'away for 2 min: a MojiMon kill pays no EXP, no drops and counts no kill (was: full EXP)', J(awayMon));
  check(awayMin.dead && awayMin.exp === 0 && awayMin.kills === 0, 'the same for any other summon', J(awayMin));
  check(awayOwn.dead && (awayOwn.exp === 'lvl' || awayOwn.exp > 0) && awayOwn.kills === 1, 'the player\u2019s own kill still pays', J(awayOwn));
  check(backMon.dead && (backMon.exp === 'lvl' || backMon.exp > 0) && backMon.kills === 1, 'one real key press later the MojiMon\u2019s kills pay again', J(backMon));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
