// Status Cure Remedy ends Soul Drain, and the cure key / the bag see it (fix-cure-soul-drain).
//   node scripts/cure_soul_drain_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Soul Drain (the 10-second 10%-of-max-HP-a-second affliction) is cleared by a Remedy: useConsumable zeroes player._sdLeft. But the two gates in front of
// it - _hasActiveAilment (the cure key, R) and _lxCureNeeded (the "nothing to cure" refusal of a drink from the bag) - did not list it, so a hero with ONLY Soul
// Drain pressed R and nothing happened, and a Remedy from the bag was refused with "Nothing to cure" while the drain kept ticking. With any other status
// up as well, the same potion cleared both. The drain is applied through the real _lxSoulDrainApply; the cure key is a real key press.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10741';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const R = {}; const errs = [];
const STATUS = ['burnTimer', 'frozenTimer', 'freezeTimer', 'stunTimer', 'hitStun', '_slowTimer', '_poisonTimer', '_skillLockTimer', '_electrocuteTimer', '_iceFloor', '_virgoSin', '_sdLeft'];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxSoulDrainApply === 'function' && typeof useConsumable === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._lxAwaitingCreation = false; window._lxInWorld = true;
    player._tutorialSeen = true; applyClass('mage'); player.level = 40;
    for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true;
    loadMap('town'); await new Promise((s) => setTimeout(s, 2000)); document.getElementById('everdawn-welcome-overlay')?.remove();
  });
  await page.waitForFunction(() => !game.paused, null, { timeout: 20000 }).catch(() => {});   // the map-load fade holds the game paused for a few seconds: a key press there is ignored by design
  await page.keyboard.press('Shift'); await page.waitForTimeout(400);   // one throwaway press: the first key into a fresh page was not reaching the cure key in this harness (seen on the unfixed build too)
  const reset = (st) => page.evaluate((st) => { for (const k of st) player[k] = 0; player._god = false; player.hp = getMaxHp(); player.mp = getMaxMp(); player.consumables.cure = 3; game.paused = false; }, STATUS);
  const settle = (page_) => page_.waitForFunction(() => player.consumables.cure < 3 || (player._sdLeft | 0) === 0, null, { timeout: 4000 }).catch(() => {}).then(() => page_.waitForTimeout(250));
  const snap = () => page.evaluate(() => ({ sd: player._sdLeft | 0, cure: player.consumables.cure, slow: player._slowTimer | 0, ailment: _hasActiveAilment(), needed: _lxCureNeeded() }));
  // 0. control: nothing up, nothing to cure
  await reset(STATUS);
  R.clean = await page.evaluate(() => ({ ailment: _hasActiveAilment(), needed: _lxCureNeeded(), useless: _lxDrinkUseless('cure') }));
  // 1. only Soul Drain: the gates, then the real R key
  await reset(STATUS);
  R.applied = await page.evaluate(() => _lxSoulDrainApply());
  R.drainGates = await page.evaluate(() => ({ sd: player._sdLeft | 0, ailment: _hasActiveAilment(), needed: _lxCureNeeded(), useless: _lxDrinkUseless('cure') }));
  await page.keyboard.press('r'); await settle(page);
  R.afterR = await snap();
  await page.keyboard.press('r'); await page.waitForTimeout(500);   // nothing left to cure: the second press keeps the potion
  R.afterR2 = await snap();
  // 2. only Soul Drain, the drink from the bag (the inventory path)
  await reset(STATUS);
  await page.evaluate(() => { _lxSoulDrainApply(); });
  R.bagRet = await page.evaluate(() => { const r = useConsumable('cure'); return r === undefined ? 'used' : r; });
  R.afterBag = await snap();
  // 3. controls: a slow on its own still cures with the key (unchanged), and a slow beside the drain clears both once
  await reset(STATUS);
  await page.evaluate(() => { player._slowTimer = 4000; });
  await page.keyboard.press('r'); await settle(page);
  R.slowOnly = await snap();
  await reset(STATUS);
  await page.evaluate(() => { _lxSoulDrainApply(); player._slowTimer = 4000; });
  await page.keyboard.press('r'); await settle(page);
  R.both = await snap();
} finally { await browser.close(); srv.kill(); }
check(R.clean && !R.clean.ailment && !R.clean.needed && R.clean.useless, 'control: with nothing up the cure key stays idle and a drink is still refused as useless', R.clean);
check(R.applied === true && R.drainGates.sd > 0, 'Soul Drain is applied through the real _lxSoulDrainApply', R);
check(R.drainGates.ailment === true, 'the cure key sees Soul Drain on its own as an ailment (_hasActiveAilment)', R.drainGates);
check(R.drainGates.needed === true && R.drainGates.useless === false, 'a Remedy from the bag is not "useless" against Soul Drain alone (_lxCureNeeded)', R.drainGates);
check(R.afterR.sd === 0 && R.afterR.cure === 2, 'the R key ends Soul Drain and drinks exactly one Remedy (3 -> 2)', R.afterR);
check(R.afterR2.cure === 2 && R.afterR2.sd === 0, 'a second R press with nothing left to cure keeps the potion', R.afterR2);
check(R.bagRet === 'used' && R.afterBag.sd === 0 && R.afterBag.cure === 2, 'a Remedy drunk from the bag against Soul Drain alone works and is spent once', { ret: R.bagRet, ...R.afterBag });
check(R.slowOnly.slow === 0 && R.slowOnly.cure === 2, 'control: a slow on its own is still cured by the key', R.slowOnly);
check(R.both.slow === 0 && R.both.sd === 0 && R.both.cure === 2, 'control: Soul Drain beside another status is cleared with it by one Remedy', R.both);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
