// THE QUEST TRACKER, POP PUNK (v0.30.1200). Per user, with a screenshot of the tracker: "similarly this can be more POP
// PUNK styled as well". Read from the running tracker with a live Ticket Rush quest, the Next story row and new quests:
//   - INK: Nunito, an ink rim, a translucent plate (the world still reads through)
//   - STICKERS: the QUESTS head is a butter sticker, the new-quests count a berry one; the Next row sits on a berry stripe
//   - COMPACT: same width and position as before, at most 4 px taller
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/quest_tracker_pop_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12378';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderQuestTracker === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 30; player.quests = { active: {}, completed: {}, unlocked: {} };
    try { _ensureQuests(); tickQuestUnlocks(); } catch (e) {}
    loadMap('town', 900); await W8(1200); try { closeAllModals(); } catch (e) {} game.paused = false;
    player.quests.unlocked.q_clockwork_underpass = true; acceptQuest('q_clockwork_underpass', true);
    await document.fonts.load('900 11px Nunito'); renderQuestTracker(); await W8(400);
    document.documentElement.classList.remove('lx-nobackdrop');
    const qt = document.getElementById('quest-tracker'), cs = getComputedStyle(qt), rc = qt.getBoundingClientRect();
    const head = qt.querySelector('.qt-head'), hcs = head ? getComputedStyle(head) : null, nw = qt.querySelector('.qt-new');
    const next = qt.querySelector('.qt-row[style*="border-left"]');
    return { font: cs.fontFamily, rim: cs.borderTopColor + ' ' + cs.borderTopWidth, bg: cs.backgroundImage.slice(0, 80), w: cs.width, right: cs.right, bottom: cs.bottom, h: Math.round(rc.height / (rc.width / parseFloat(cs.width))),
      head: hcs && { bg: hcs.backgroundColor, color: hcs.color }, newBg: nw ? getComputedStyle(nw).backgroundColor : null, next: next ? getComputedStyle(next).borderLeftColor : null };
  });
  const alphas = (r.bg.match(/rgba\([^)]*,\s*([\d.]+)\)/g) || []).map((x) => +x.match(/([\d.]+)\)$/)[1]);
  check(/Nunito/.test(r.font) && r.rim === 'rgb(13, 10, 20) 2px' && alphas.length >= 2 && alphas.every((a) => a < 0.9), 'INK: Nunito, a 2 px ink rim, a translucent plate', J({ font: r.font.split(',')[0], rim: r.rim, alphas }));
  check(r.head && r.head.bg === 'rgb(255, 224, 122)' && r.head.color === 'rgb(13, 10, 20)' && r.newBg === 'rgb(217, 70, 127)', 'STICKERS: the QUESTS head is butter with ink lettering, the new-quests count berry', J({ head: r.head, newBg: r.newBg }));
  check(r.next === 'rgb(217, 70, 127)', 'STICKERS: the Next story row sits on a berry stripe', r.next);
  check(r.w === '220px' && r.right === '10px' && r.bottom === '182px', 'COMPACT: same width (220) and the same anchor (right 10, bottom 182)', J({ w: r.w, right: r.right, bottom: r.bottom }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
