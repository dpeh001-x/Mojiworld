// STALE-TAB NOTICE (v0.30.1715, per user). A tab left open keeps the build it loaded; the Pages deploy writes version.json and the
// game, on the public site, offers a refresh when it names a newer build (_lxVersionWatch). version.json is served by a route.
//   [1] public host, a newer build: a no-store request after boot, and the notice on the title with both version numbers
//   [2] "Later" hides it and remembers that version; later checks stay quiet; a still-newer build asks again
//   [3] the same build or an older one (a stale CDN copy) never shows it; a 404 stops the checks for good
//   [4] localhost, 127.0.0.1 and the Steam app (MOJI_PACKAGED) never ask - no request at all
//   [5] in play (localhost ?lxver=1): a live boss and a boss lock tuck it away and calm brings it back; an expedition, a Boss
//       Rush, a story beat and a film read as busy; co-op adds a line; it fits a 667x375 phone
//   [6] Refresh flushes the save and reloads; [7] no page errors
//   node scripts/version_notice_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11899), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 5000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const errs = [], sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bump = (v, d) => { const p = v.slice(1).split('.').map(Number); p[2] += d; return 'v' + p.join('.'); };
// one browser context per scenario; S is what version.json answers, and what was asked
const open = async (host, query, extra) => {
  const S = { status: 200, v: '', hits: 0, urls: [] };
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(`(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    window.LX_VER_FIRST_MS = 600; window.LX_VER_EVERY_MS = 1500; window.LX_VER_AGAIN_MS = 400; window.LX_VER_CALM_MS = 250; ${extra || ''} })();`);
  await ctx.route('**/version.json*', (r) => { S.hits++; S.urls.push(r.request().url());
    r.fulfill({ status: S.status, contentType: 'application/json', body: S.status === 200 ? JSON.stringify({ v: S.v, sha: 'test' }) : 'not found' }); });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(host + ': ' + String(e.message).slice(0, 160)));
  await page.goto(`http://${host}:${PORT}/${FILE}${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof GAME_VERSION === 'string' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  S.game = await page.evaluate(() => GAME_VERSION);
  return { ctx, page, S };
};
const shown = (page) => page.evaluate(() => { const el = document.getElementById('lx-ver'); return !!(el && el.classList.contains('on')); });
const waitShown = async (page, want, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await shown(page) === want) return true; await sleep(150); } return false; };
try {
  // [1] [2] public host
  { const { ctx, page, S } = await open('play.mojiworld.test', '?lxhold=0'); S.v = bump(S.game, 1);
    const up = await waitShown(page, true);
    const txt = await page.evaluate(() => { const el = document.getElementById('lx-ver'); return el ? { num: el.querySelector('.lxv-num').textContent, sub: el.querySelector('.lxv-sub').textContent, z: +getComputedStyle(el).zIndex } : null; });
    ok('1a. public host: version.json is asked for after boot, each time under a fresh ?t= (no cached copy can answer)', S.hits >= 1 && S.urls.every((u) => /[?]t=\d+/.test(u)) && new Set(S.urls).size === S.urls.length, { hits: S.hits, url: S.urls[0] });
    ok('1b. a newer build shows the notice over the title, naming both versions', up && txt && txt.num === S.v && txt.sub.includes(S.game) && txt.z > 9999, txt);
    await page.click('#lx-ver .lxv-later', { timeout: 5000 }).catch(() => {}); await sleep(400);
    const h0 = S.hits; await sleep(4000);
    const quiet = { shown: await shown(page), later: await page.evaluate(() => localStorage.getItem('lx_ver_later')), more: S.hits - h0 };
    ok('2a. Later hides it, remembers that version, and later checks stay quiet', !quiet.shown && quiet.later === S.v && quiet.more >= 1, quiet);
    S.v = bump(S.game, 2);
    ok('2b. a still-newer build asks again', await waitShown(page, true) && (await page.evaluate(() => document.querySelector('#lx-ver .lxv-num').textContent)) === S.v, S.v);
    await ctx.close(); }
  // [3] same / older build, then a 404
  { const { ctx, page, S } = await open('play.mojiworld.test', '?lxhold=0'); S.v = S.game;
    await sleep(3500); const same = { shown: await shown(page), hits: S.hits };
    S.v = bump(S.game, -1); await sleep(3500); const older = { shown: await shown(page), hits: S.hits };
    ok('3a. the same build never shows it', !same.shown && same.hits >= 2, same);
    ok('3b. an older build (a stale CDN copy) never shows it', !older.shown && older.hits > same.hits, older);
    S.status = 404; await sleep(2000); const h404 = S.hits; await sleep(4000);
    ok('3c. a 404 stops the checks for good', S.hits === h404 && await page.evaluate(() => window._lxVerWatch.stop === true), { at404: h404, after: S.hits });
    await ctx.close(); }
  // [4] hosts that never ask
  for (const [host, q, extra, name] of [['localhost', '?dev=1', '', 'localhost'], ['127.0.0.1', '?dev=1', '', '127.0.0.1'], ['play.mojiworld.test', '?lxhold=0', 'window.MOJI_PACKAGED = true;', 'the Steam app (MOJI_PACKAGED)']]) {
    const { ctx, page, S } = await open(host, q, extra); S.v = bump(S.game, 1); await sleep(3500);
    ok(`4. ${name} never asks`, S.hits === 0 && await page.evaluate(() => typeof window._lxVerWatch === 'undefined'), { hits: S.hits });
    await ctx.close();
  }
  // [5] [6] in play
  { const { ctx, page, S } = await open('localhost', '?dev=1&lxver=1'); S.v = bump(S.game, 1);
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
      for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      applyClass('warrior'); player._tutorialSeen = true; player._gravitosCineSeen = true; window._lxAutoPause = () => {};
      player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
      await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
      player.level = 30; player._god = true; loadMap('forest', 300); await sleep(2500); game.paused = false; try { closeAllModals(); } catch (e) {}
    });
    ok('5a. in play, calm: the notice shows', await waitShown(page, true), await page.evaluate(() => window._lxVerWatch.why));
    await page.evaluate(() => { window.__boss = spawnMonster(player.x + 260, player.y - 40, 'king', true); });
    const boss = { hid: await waitShown(page, false, 4000), why: await page.evaluate(() => window._lxVerWatch.why) };
    ok('5b. a live boss tucks it away', boss.hid && boss.why === 'boss', boss);
    await page.evaluate(() => { const m = window.__boss; m.currentHp = 0; killMonster(m); });
    ok('5c. the boss down, it comes back', await waitShown(page, true, 6000), await page.evaluate(() => window._lxVerWatch.why));
    await page.evaluate(() => { player._god = false; player.hp = player.maxHp; player.stunTimer = 0; _qteShackleStart({ type: 'zodiac_scorpio', zodiacSign: 'scorpio', boss: true }); _QTE.remain = 1e9; _QTE.total = 1e9; player.stunTimer = 1e9; });
    const lock = { hid: await waitShown(page, false, 4000), why: await page.evaluate(() => window._lxVerWatch.why) };
    await page.evaluate(() => { _qteEnd(false); player.stunTimer = 0; player._god = true; });
    ok('5d. a boss lock tucks it away, and it comes back after', lock.hid && lock.why === 'lock' && await waitShown(page, true, 6000), lock);
    const flags = await page.evaluate(() => { const W = window._lxVerWatch, out = {}, g = game;
      const ex = g.expedition; g.expedition = { active: true }; out.expedition = W.busy(); g.expedition = ex;
      const br = g.bossRush; g.bossRush = { active: true }; out.rush = W.busy(); g.bossRush = br;
      const sb = document.getElementById('story-beat-overlay'); sb.classList.add('on'); out.beat = W.busy(); sb.classList.remove('on');
      window._lxKillFilmPending = Date.now(); out.film = W.busy(); window._lxKillFilmPending = 0; out.calm = W.busy(); return out; });
    ok('5e. an expedition, a Boss Rush, a story beat and a film read as busy; calm reads calm', flags.expedition === 'expedition' && flags.rush === 'boss rush' && flags.beat === 'scene' && flags.film === 'film' && flags.calm === '', flags);
    await page.evaluate(() => { window.__coop = window._coopActive; window._coopActive = () => true; }); await sleep(700);
    const coopTxt = await page.evaluate(() => document.querySelector('#lx-ver .lxv-sub').textContent);
    await page.evaluate(() => { window._coopActive = window.__coop; });
    ok('5f. in co-op it says a refresh leaves the session', /co-op session/.test(coopTxt), coopTxt);
    await page.setViewportSize({ width: 667, height: 375 }); await sleep(500);
    const box = await page.evaluate(() => { const r = document.getElementById('lx-ver').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), h: Math.round(r.height) }; });
    ok('5g. on a 667x375 phone it fits the screen and stays compact', box.l >= 0 && box.r <= 667 && box.t >= 0 && box.h <= 64, box);
    await page.evaluate(() => { const f = window._flushSaveStateNow; window._flushSaveStateNow = function () { sessionStorage.setItem('vt_flushed', '1'); return f.apply(this, arguments); }; });
    await page.setViewportSize({ width: 1280, height: 720 }); await waitShown(page, true, 8000);
    const nav = await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 180000 }), page.click('#lx-ver .lxv-go', { timeout: 8000 })]).then(() => true, (e) => String(e.message).split('\n')[0]);
    ok('6. Refresh flushes the save and reloads the page', nav === true && await page.evaluate(() => sessionStorage.getItem('vt_flushed')) === '1', { reloaded: nav });
    await ctx.close(); }
  ok('7. no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
