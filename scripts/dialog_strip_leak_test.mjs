// Bravo's weight strip stays on Bravo's card (per user, with a screenshot: "When entering gravitos arena weird UI pop ups").
// The strip (#dialog-tabs) was only cleared when the NEXT NPC card opened, so after a talk with Bravo the Stair's "Boss Arena
// Ahead" card showed her Easy / Normal / Hard row, and clicking it opened Bravo on top of the boss card, wearing its silhouette.
//   1. talk to Bravo, pick a weight with a real click, Leave: the strip is gone with the card
//   2. walk to the Stair's arena door and press Up: the Boss Arena card has no strip
//   3. Esc out of Bravo's card is as clean as Leave
//   4. a confirm card opened while Bravo's card is up takes no strip with it
//   5. Bravo's card opened over a boss card does not keep the boss silhouette (class / --boss-shade)
//   6. CONTROL - Bravo still shows her three weights, and picking one still re-renders her card
// node scripts/dialog_strip_leak_test.mjs   (MOJI_GAME_FILE / PORT override)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11981), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 260) + ']' : '')); };
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await p.waitForTimeout(5000);
  const strip = () => p.evaluate(() => { const t = document.getElementById('dialog-tabs'), r = t.getBoundingClientRect(), d = document.getElementById('dialog');
    return { name: document.getElementById('dialog-name').textContent, open: d.style.display === 'block', on: t.className === 'on', tabs: t.querySelectorAll('button').length, shown: r.height > 0 && getComputedStyle(t).display !== 'none', boss: d.classList.contains('boss-arena'), shade: !!d.style.getPropertyValue('--boss-shade') }; });
  await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (!player.cls) applyClass('mage'); player.level = 90; player._gravitosCineSeen = true; player._expLootAck = true;
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; player._storyBeatsSeen.everdawn_welcome = true; } catch (e) {}
    game.paused = false; loadMap('town'); await sleep(2500);
    window._bravo = game.npcs.find((n) => n.name === 'Bravo'); openNPC(window._bravo); await sleep(500);
  });
  // ---- 6 (control, first half) ----
  const c0 = await strip();
  const hard = await p.$('#dialog-tabs button[data-tab="hard"]'); if (hard) await hard.click(); await p.waitForTimeout(400);
  const c1 = await strip(), diff1 = await p.evaluate(() => game._expeditionDifficulty);
  const norm = await p.$('#dialog-tabs button[data-tab="normal"]'); if (norm) await norm.click(); await p.waitForTimeout(400);
  // ---- 1 ----
  await p.evaluate(() => { const l = [...document.querySelectorAll('#dialog-options button')].find((x) => /Leave/.test(x.textContent)); if (l) l.click(); });
  await p.waitForTimeout(400);
  const s1 = await strip();
  ok('1. Leave takes Bravo\'s weight strip with the card', !s1.open && !s1.on && s1.tabs === 0, s1);
  // ---- 2 ----
  await p.evaluate(async () => { loadMap('weightbearerStair'); await new Promise((r) => setTimeout(r, 3000));
    const po = game.portals.find((q) => q.dest === 'gravitosArena'); player.x = po.x - player.w / 2 + 20; player.y = (typeof po.y === 'number' ? po.y - player.h : 380); player.vx = player.vy = 0;   /* b2ad02e55 v0.30.1594 stair-steep: the Singularity door moved up to (2860, y 200) - feet on the portal's own y, the line tryPortal measures */ await new Promise((r) => setTimeout(r, 600)); });
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(900);
  const s2 = await strip();
  ok('2. the Stair\'s Boss Arena card shows no weight strip', s2.open && /Boss Arena/.test(s2.name) && !s2.on && s2.tabs === 0 && !s2.shown, s2);
  // ---- 5 ----
  await p.evaluate(() => openNPC(window._bravo)); await p.waitForTimeout(500);
  const s5 = await strip();
  ok('5. Bravo opened over the boss card does not wear its silhouette', s5.open && s5.name === 'Bravo' && !s5.boss && !s5.shade, s5);
  // ---- 3 ----
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const s3 = await strip();
  ok('3. Esc out of Bravo\'s card is as clean as Leave', !s3.open && !s3.on && s3.tabs === 0, s3);
  // ---- 4 ----
  await p.evaluate(() => { openNPC(window._bravo); _openConfirmDialog('Test card', 'body', 'Yes', closeDialog, 'No', closeDialog); }); await p.waitForTimeout(400);
  const s4 = await strip();
  ok('4. a confirm card opened over Bravo\'s card takes no strip with it', s4.open && s4.name === 'Test card' && !s4.on && s4.tabs === 0, s4);
  ok('6. CONTROL - Bravo still shows her three weights, and a pick still applies', c0.open && c0.on && c0.tabs === 3 && diff1 === 'hard' && c1.name === 'Bravo' && c1.tabs === 3, { c0, diff1 });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
