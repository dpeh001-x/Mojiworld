// POLISH PASS (v0.30.865, per user "look for other polishes to the game"): the Taxi panel fits the screen at 1280x720 and
// 1920x1080; Esc closes Save Backups; the Jukebox title keeps its word gaps; the Multiplayer help has no developer
// instructions and states the real co-op bonus; the frame governor's toasts use plain words; a level jump announces its
// new quests in one toast.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/polish_pass_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11173';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const enter = (page) => page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.level = 30; player._tutorialSeen = true; player.mojicoins = 99999; loadMap('forest', 300); await sleep(1500); game.paused = false;
  game.visitedMaps = {}; for (const k of Object.keys(MAPS).slice(0, 40)) game.visitedMaps[k] = true; });
try {
  for (const [vw, vh] of [[1280, 720], [1920, 1080]]) {
    const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: vw, height: vh } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof openTaxi === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
    await enter(page);
    const taxi = await page.evaluate(async () => { openTaxi(); await new Promise((r) => setTimeout(r, 500)); const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
      const md = document.querySelector('#taxi-modal > .modal'), x = md.querySelector('.close-btn'), h = md.querySelector('h2'), sv = document.querySelector('#taxi-grid svg');
      const out = { vh: innerHeight, modal: r(md), close: r(x), title: r(h), map: sv ? r(sv) : null }; closeAllModals(); return out; });
    check(taxi.modal[0] >= 0 && taxi.modal[1] <= taxi.vh && taxi.close[0] >= 0 && taxi.title[0] >= 0 && taxi.map && taxi.map[1] - taxi.map[0] >= 200, `the Taxi panel, its title and its close button are on screen at ${vw}x${vh} (was: above the top edge)`, J(taxi));
    if (vw === 1280) {
      await page.evaluate(() => openBackupModal()); await page.waitForTimeout(250);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const bk = await page.evaluate(() => ({ open: document.getElementById('backup-modal-bg').classList.contains('on'), paused: !!game.paused }));
      check(!bk.open && !bk.paused, 'Esc closes Save Backups and the game resumes (was: Esc did nothing, still paused)', J(bk));
      const jb = await page.evaluate(() => { openJukebox(); const h = document.querySelector('#jukebox-modal h2'); const o = { text: h.textContent, ws: getComputedStyle(h).wordSpacing }; closeJukebox(); return o; });
      check(jb.text === "\u266A DJ VINYL'S JUKEBOX \u266A" && parseFloat(jb.ws) > 0, 'the Jukebox title keeps its word gaps (was: "DJVINYL\'SJUKEBOX")', J(jb));
      const mp = await page.evaluate(() => { openMultiplayer(); const t = document.getElementById('multiplayer-modal').innerText; closeAllModals(); return { dev: /npm start|localhost|server\//.test(t), old: /\+50% XP|400 px/.test(t), now: /double EXP/.test(t) }; });
      check(!mp.dev && !mp.old && mp.now, 'the Multiplayer help has no developer instructions and states the real co-op bonus', J(mp));
      const src = await page.evaluate(() => [...document.scripts].map((x) => x.textContent).join('\n'));
      check(!/Ultra-perf mode|cast flashes culled/.test(src) && /Effects eased to keep the game smooth/.test(src), 'the frame governor\u2019s toasts use plain words', J({ jargon: /Ultra-perf mode|cast flashes culled/.test(src) }));
      const qb = await page.evaluate(() => { const seen = []; const st = window.showToast; window.showToast = function (m) { seen.push(String(m)); return st.apply(this, arguments); };
        player.quests = { active: {}, completed: {}, unlocked: {} }; player.level = 60; try { tickQuestUnlocks(); } finally { window.showToast = st; }
        const one = seen.filter((m) => /New quest:/.test(m)).length, grouped = seen.filter((m) => /new quests \u2014/.test(m)), story = seen.filter((m) => /STORY —/.test(m)).length, storyGrouped = seen.filter((m) => /new story quests/.test(m)).length;
        return { unlocked: Object.keys(player.quests.unlocked).length, one, grouped: grouped.slice(0, 1), story, storyGrouped }; });
      check(qb.unlocked >= 3 && qb.one === 0 && qb.grouped.length === 1 && qb.story === 0 && qb.storyGrouped === 1, 'a level jump announces its new quests in one toast, and its story quests in one more (was: one toast per quest)', J(qb));
    }
    check(errs.length === 0, `no page errors at ${vw}x${vh}`, J(errs.slice(0, 3)));
    await page.context().close();
  }
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
