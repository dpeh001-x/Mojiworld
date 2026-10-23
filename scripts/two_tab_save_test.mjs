// A stale second tab must not overwrite the other tab's save (fix-two-tab-save).
//   node scripts/two_tab_save_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Two pages in ONE browser context share one localStorage, like two tabs of a browser profile. Tab 1 plays and saves, tab 2 continues from that save and plays on; tab 1's
// timers (heartbeat, tab-hide, close, debounce) then fire with its old state. A tab that is not meant to write is held quiet meanwhile, and its timers are then fired by hand.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10631';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = []; const URL = `http://localhost:${PORT}/${FILE}`;
const ready = (p) => p.waitForFunction(() => typeof loadMap === 'function' && typeof openLevelUpPanel === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
const saved = (p) => p.evaluate(() => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return { coins: s.player.mojicoins, kills: s.game.kills, t: s.t }; } catch (e) { return null; } });
const banners = (p) => p.evaluate(() => document.querySelectorAll('#lx-stale-tab').length);
async function enterNew(p) {   // a fresh hero straight into the world (no save yet)
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(p); await p.waitForTimeout(3000);
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._prologueAfterCreation = false; window._lxAwaitingCreation = false; window._lxInWorld = true;
    player._tutorialSeen = true; applyClass('warrior'); player.level = 30; player.hp = getMaxHp();
    for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true;
    loadMap('town'); await new Promise((s) => setTimeout(s, 2000)); document.getElementById('everdawn-welcome-overlay')?.remove();
  });
}
async function enterContinue(p) {   // the title's Continue card, as a player does it
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(p);
  await p.waitForSelector('#menu-continue', { state: 'visible', timeout: 90000 }); await p.click('#menu-continue');
  await p.waitForSelector('#loading-overlay', { state: 'detached', timeout: 30000 }).catch(() => {}); await p.waitForTimeout(3000);
  await p.evaluate(() => { document.getElementById('everdawn-welcome-overlay')?.remove(); });
}
// a tab that sits still while another plays: its flush is a no-op (so its heartbeat and debounce write nothing) but it still listens for storage events
const quiet = (p, on) => p.evaluate((on) => { if (on) { window.__realFlush = _flushSaveStateNow; _flushSaveStateNow = () => {}; } else if (window.__realFlush) { _flushSaveStateNow = window.__realFlush; window.__realFlush = null; } }, on);
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const t1 = await ctx.newPage(); t1.on('pageerror', (e) => errs.push('t1 ' + String(e.message).slice(0, 140)));
  await enterNew(t1);
  const head = await t1.evaluate(async () => { player.mojicoins = 1000; game.kills = 10; _flushSaveStateNow(); await new Promise((r) => setTimeout(r, 300)); return localStorage.getItem(SAVE_KEY).slice(0, 32); });
  check(/^\{"v":\d+,"t":\d+,/.test(head), 'a stored save starts with its version and stamp (the head the guard reads)', head);
  await quiet(t1, true);
  // ---- tab 2 continues from tab 1's save and earns more
  const t2 = await ctx.newPage(); t2.on('pageerror', (e) => errs.push('t2 ' + String(e.message).slice(0, 140)));
  await enterContinue(t2);
  await t2.evaluate(async () => { player.mojicoins = 55555; game.kills = 777; _flushSaveStateNow(); await new Promise((r) => setTimeout(r, 300)); });
  const s2 = await saved(t2);
  check(s2 && s2.coins === 55555 && s2.kills === 777, 'tab 2 continued from tab 1 and its progress was saved', s2);
  // ---- tab 1's timers fire with its old state
  await quiet(t1, false);
  const r1 = await t1.evaluate(async () => {
    game._autosaveHeartbeat();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange', { bubbles: true })); delete document.hidden;
    window.dispatchEvent(new Event('beforeunload'));
    saveState(); await new Promise((r) => setTimeout(r, 2200));   // the 1.5 s debounce
    return { banner: document.querySelectorAll('#lx-stale-tab').length, text: (document.getElementById('lx-stale-tab') || {}).innerText || '' };
  });
  const s1 = await saved(t1);
  check(s1 && s1.coins === 55555 && s1.kills === 777, 'heartbeat, tab-hide, close and debounce in the stale tab leave tab 2\'s save alone', { s1, s2 });
  check(r1.banner === 1 && /another tab/i.test(r1.text) && /not being saved/i.test(r1.text) && /Reload/.test(r1.text), 'the stale tab shows one banner naming the other tab and the reload', r1);
  check((await banners(t1)) === 1 && (await t1.evaluate(() => !!game._staleTab)), 'it stays one banner after every flush attempt, and the tab is marked stale', await banners(t1));
  await t1.close({ runBeforeUnload: true });
  const s3 = await saved(t2);
  check(s3 && s3.coins === 55555 && s3.kills === 777, 'closing the stale tab does not write over the newer save', { s3, s2 });
  // ---- the newer tab keeps saving
  const r2 = await t2.evaluate(async () => { player.mojicoins = 66666; game._autosaveHeartbeat(); await new Promise((r) => setTimeout(r, 200)); return { stale: !!game._staleTab, banner: document.querySelectorAll('#lx-stale-tab').length, coins: JSON.parse(localStorage.getItem(SAVE_KEY)).player.mojicoins }; });
  check(r2.coins === 66666 && !r2.stale && r2.banner === 0, 'the newer tab\'s heartbeat still saves, with no banner', r2);
  // ---- one tab saving 100 times in a row, on the title, a failing write, an old-build save, a reset
  const r3 = await t2.evaluate(async () => {
    const out = {}; for (let i = 0; i < 100; i++) { player.mojicoins = 70000 + i; _flushSaveStateNow(); }
    out.coins = JSON.parse(localStorage.getItem(SAVE_KEY)).player.mojicoins; out.stale = !!game._staleTab; out.banner = document.querySelectorAll('#lx-stale-tab').length;
    const raw = localStorage.getItem(SAVE_KEY); const newer = raw.replace(/^\{"v":(\d+),"t":(\d+)/, (m, v, t) => '{"v":' + v + ',"t":' + (Number(t) + 5000));
    localStorage.setItem(SAVE_KEY, newer);
    const hold = () => (typeof _lxStaleTabHold === 'function') ? _lxStaleTabHold() : false;
    game._resetting = true; out.resetting = hold(); game._resetting = false;
    const inW = window._lxInWorld; let ov = document.getElementById('loading-overlay'); const made = !ov; if (made) { ov = document.createElement('div'); ov.id = 'loading-overlay'; document.body.appendChild(ov); }
    const was = [ov.className, ov.style.display]; ov.className = ''; ov.style.display = 'flex'; window._lxInWorld = false;
    out.title = hold(); window._lxInWorld = inW; if (made) ov.remove(); else { ov.className = was[0]; ov.style.display = was[1]; }
    for (const [k, odd] of [['noStamp', raw.replace(/^\{"v":(\d+),"t":(\d+),/, '{"v":$1,')], ['textStamp', raw.replace(/^\{"v":(\d+),"t":(\d+)/, '{"v":$1,"t":"zz"')], ['order', raw.replace(/^\{"v":(\d+),"t":(\d+),/, '{"t":99999999999999,"v":$1,')]]) {
      localStorage.setItem(SAVE_KEY, odd); player.mojicoins = 80001; out[k] = { hold: hold(), stale: !!game._staleTab }; _flushSaveStateNow(); out[k].wrote = JSON.parse(localStorage.getItem(SAVE_KEY)).player.mojicoins === 80001;
    }
    const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k) { if (k === SAVE_KEY) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return orig.apply(this, arguments); };
    try { _flushSaveStateNow(); out.quota = { stale: !!game._staleTab, banner: document.querySelectorAll('#lx-stale-tab').length }; } finally { Storage.prototype.setItem = orig; }
    // a write that lands and then throws (the paint record does not fit) is still this tab's own save
    const wr = _lxPaintWrite; _lxPaintWrite = (sv) => { wr(sv); const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
    try { player.mojicoins = 80002; _flushSaveStateNow(); } finally { _lxPaintWrite = wr; }
    player.mojicoins = 80003; _flushSaveStateNow();
    out.partial = { stale: !!game._staleTab, banner: document.querySelectorAll('#lx-stale-tab').length, coins: JSON.parse(localStorage.getItem(SAVE_KEY)).player.mojicoins };
    return out;
  });
  check(r3.partial && r3.partial.coins === 80003 && !r3.partial.stale && r3.partial.banner === 0, 'a write that stored the save and then threw (paint record / quota) is still this tab own save: the next save goes through', r3.partial);
  check(r3.coins === 70099 && !r3.stale && r3.banner === 0, 'a single tab saving 100 times in a row never trips it', r3);
  check(r3.resetting === false && r3.title === false, 'a reset in progress and the title screen never trip it', r3);
  check(['noStamp', 'textStamp', 'order'].every((k) => r3[k] && r3[k].hold === false && !r3[k].stale && r3[k].wrote), 'a stored save with no readable stamp (an older build) never trips it and is saved over', r3);
  check(r3.quota && !r3.quota.stale && r3.quota.banner === 0, 'a failing storage write is not mistaken for another tab', r3.quota);
  await t2.evaluate(() => { game._staleTab = false; });
  await quiet(t2, true);
  // ---- reload from the banner: the stale state never lands over the newer save
  const t3 = await ctx.newPage(); t3.on('pageerror', (e) => errs.push('t3 ' + String(e.message).slice(0, 140)));
  await enterContinue(t3);
  await t3.evaluate(async () => { player.mojicoins = 91919; _flushSaveStateNow(); await new Promise((r) => setTimeout(r, 300)); });
  await t2.waitForSelector('#lx-stale-tab', { timeout: 10000 }).catch(() => {});   // the storage event is delivered between pages, not instantly
  await quiet(t2, false);
  check((await banners(t2)) === 1 && (await t2.evaluate(() => !!game._staleTab)), 'tab 2 sees the newer save at once (storage event), before any timer', await banners(t2));
  await t2.evaluate(() => { player.mojicoins = 12; });
  await Promise.all([t2.waitForEvent('load', { timeout: 60000 }).catch(() => {}), t2.click('#lx-stale-tab .lxs-go')]);
  await t2.waitForTimeout(1500);
  const s4 = await saved(t3);
  check(s4 && s4.coins === 91919, 'Reload from the banner does not write the stale state over the newer save', s4);
  await t3.close({ runBeforeUnload: true });   // one tab again
  await ready(t2); await t2.waitForSelector('#menu-continue', { state: 'visible', timeout: 90000 }); await t2.click('#menu-continue');
  await t2.waitForSelector('#loading-overlay', { state: 'detached', timeout: 30000 }).catch(() => {}); await t2.waitForTimeout(2500);
  const f2 = await t2.evaluate(() => ({ coins: player.mojicoins, banner: document.querySelectorAll('#lx-stale-tab').length }));
  check(f2.coins === 91919 && f2.banner === 0, 'after the reload the tab continues from the newest save, with no banner', f2);
  console.log('errors:', errs.slice(0, 4));
} catch (e) { console.log('ERROR', String(e && e.stack || e).slice(0, 600)); bad++; total++; }
await browser.close().catch(() => {}); try { srv.kill(); } catch (e) {}
console.log(`${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
