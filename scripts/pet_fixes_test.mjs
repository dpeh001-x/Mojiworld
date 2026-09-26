// MojiMon / expedition / boon fixes from the second bug hunt (v0.30.x pet-fixes).
//   node scripts/pet_fixes_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// 1) the minion cap never evicts the fielded MojiMon; 2) H doesn't summon while dead (and still does once alive);
// 3) mirages and away-summon kills don't feed species mastery; 4) Ascend with no heirloom picked names none; 5) an
// expedition's end keeps what the run spent (the potion auto-buy) - every ending shares the one reset; Abandon is driven.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11061';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _startExpedition === 'function' && typeof _mojimonCapture === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 80;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
    loadMap('forest'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    window.__ticks = (n) => new Promise((res) => { const t0 = game.time; const go = () => (game.time - t0 >= n ? res() : setTimeout(go, 20)); go(); });
    player.invulnerable = 999999;
  });

  // 1) bind + field a MojiMon, then fill the minion cap with a warlock's undead
  const C = await p.evaluate(async () => {
    const m = game.monsters.find((x) => !x.isBoss && !x.isMiniBoss && !x.isElite && x.type !== 'mirageStalker') || game.monsters[0];
    game.bestiary[m.type] = 10000; _mojimonCapture(m);
    await new Promise((r) => setTimeout(r, 2500)); document.getElementById('mojimon-firstbind')?.remove(); try { closeAllModals(); } catch (e) {} game.paused = false;
    _mojimonQuickSummon(); await __ticks(20);
    const before = game.minions.some((x) => x.mojimon);
    player.cls = 'mage'; player.job = 'warlock';
    for (const id of ['darkPulse', 'darkPulse', 'soulSiphon', 'darkPulse']) { player.mp = 99999; player.skillCooldowns = player.skillCooldowns || {}; player.skillCooldowns[id] = 0; game._lastCastAt = 0; try { castSkill(id); } catch (e) {} await __ticks(3); }
    await __ticks(5);
    return { before, minions: game.minions.length, cap: (typeof MAX_MINIONS !== 'undefined' ? MAX_MINIONS : null), fielded: !!(player.mojimon && player.mojimon.out) && game.minions.some((x) => x.mojimon) };
  });
  console.log('cap', JSON.stringify(C));
  check(C.before && C.minions >= C.cap && C.fielded, "a warlock's undead filling the minion cap trims the other minions, not the fielded MojiMon", C);

  // 2) H while dead, then alive again
  await p.evaluate(() => { try { _mojimonDismiss(true); } catch (e) {} if (player.mojimon) player.mojimon.cdUntil = 0; player.job = null; game.minions.length = 0; player.invulnerable = 0; player.hp = 0; triggerDeath(); });
  await p.keyboard.press('h'); await p.waitForTimeout(400);
  const D = await p.evaluate(() => ({ hp: player.hp, out: !!(player.mojimon && player.mojimon.out), fielded: game.minions.some((x) => x.mojimon), cd: Math.max(0, ((player.mojimon && player.mojimon.cdUntil) || 0) - Date.now()) }));
  console.log('dead H', JSON.stringify(D));
  check(!(D.hp > 0) && !D.out && !D.fielded && D.cd === 0, 'pressing H while dead fields nothing and starts no cooldown', D);
  await p.evaluate(async () => { game.dying = 0; try { respawnAtTown(); } catch (e) {} await __ticks(20); player.hp = getMaxHp(); player.invulnerable = 999999; try { closeAllModals(); } catch (e) {} game.paused = false; });
  await p.keyboard.press('h'); await p.waitForTimeout(600);
  const D2 = await p.evaluate(() => ({ hp: player.hp, fielded: game.minions.some((x) => x.mojimon) }));
  console.log('alive H', JSON.stringify(D2));
  check(D2.hp > 0 && D2.fielded, 'alive again, H summons it as before', D2);

  // 3) mastery
  const M = await p.evaluate(async () => {
    loadMap('forest'); await new Promise((r) => setTimeout(r, 1500)); player.invulnerable = 999999;
    const T = 'mirageStalker', b0 = game.bestiary[T] | 0;
    const m = spawnMonster(player.x + 150, player.y - 40, T, false, false); m.evasion = 0; m.def = 0;
    hitMonster(m, 1, false, 'probe'); await __ticks(3);
    for (let it = 0; it < 40 && game.monsters.some((x) => x.type === T); it++) { for (const x of game.monsters.filter((y) => y.type === T)) { x.currentHp = 1; x.evasion = 0; x._iFrames = 0; x.invuln = 0; hitMonster(x, 1e9, false, 'probe'); } await __ticks(2); }
    const mirage = (game.bestiary[T] | 0) - b0;
    const S = 'snail', s0 = game.bestiary[S] | 0;
    const sn = spawnMonster(player.x + 150, player.y - 40, S, false, false);
    window._lxLastInputAt = performance.now() - 200000; sn.evasion = 0; sn.currentHp = 1;
    hitMonster(sn, 1e9, false, 'mojimon'); await __ticks(10);
    window._lxLastInputAt = performance.now();
    return { mirage, afk: (game.bestiary[S] | 0) - s0 };
  });
  console.log('mastery', JSON.stringify(M));
  check(M.mirage === 1 && M.afk === 0, "species mastery counts a Mirage Stalker once (not per mirage) and nothing for an away summon's kill", M);

  // 4) Ascend from the pause menu with no heirloom picked
  const H = await p.evaluate(async () => {
    player.level = 100; delete game._heirloomIdx; game._prestigeOffered = false;
    document.getElementById('guguma-ascend-go')?.remove();
    try { _lxPauseAct('ascend'); } catch (e) { return { err: String(e).slice(0, 100) }; }
    await new Promise((s) => setTimeout(s, 800));
    const body = [...document.querySelectorAll('#confirm-modal, .confirm-modal, [id*=confirm]')].map((e) => e.textContent).join(' ');
    const no = document.getElementById('confirm-no'); if (no) no.click();
    player.level = 80;
    return { mentions: /HEIRLOOM boon/i.test(body), sawDialog: body.length > 20 };
  });
  console.log('ascend', JSON.stringify(H));
  check(H.sawDialog && !H.mentions, 'Ascend with no heirloom picked does not name one (was: whatever sat in bag slot 0)', H);

  // 5) an expedition that is abandoned keeps the potion it bought
  const E = await p.evaluate(async () => {
    try { closeAllModals(); } catch (e) {} game.paused = false; loadMap('town'); await new Promise((r) => setTimeout(r, 1500));
    player.mojicoins = 100000; player.consumables = {};
    _startExpedition(); await new Promise((r) => setTimeout(r, 2000)); try { closeAllModals(); } catch (e) {} game.paused = false;
    player.invulnerable = 999999;
    const snap = (game.expedition && game.expedition.snapshot && game.expedition.snapshot.mojicoins) | 0;
    player.consumables = {}; player.hp = Math.max(1, Math.floor(getMaxHp() * 0.2)); player._potionCdHp = 0; player._potionCdMp = 0;
    const c0 = player.mojicoins; useQuickPotion('hp', false); const cost = c0 - player.mojicoins;
    _endExpedition('abandon'); await new Promise((r) => setTimeout(r, 3500));
    return { snap, cost, wallet: player.mojicoins };
  });
  console.log('expedition', JSON.stringify(E));
  check(E.snap > 0 && E.cost > 0 && E.wallet === E.snap - E.cost, "an abandoned expedition keeps the potion it bought - the pre-run wallet minus the run's spend, not a refund", E);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
