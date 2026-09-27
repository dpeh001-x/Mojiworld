// THE QUEST NAVIGATOR, POP PUNK (v0.30.1258). Per user, with a screenshot of it: "For this navigator HUD make it a little pop
// punk look that blends in well without having too much opacity". Read from the running widget with a tracked quest:
//   - INK: Nunito lettering, a 2 px ink rim, a butter key sticker
//   - SEE-THROUGH: every background layer under 0.5 alpha
//   - COMPACT: no more than 200 x 42 CSS px
//   [PORT=12593] node scripts/qnav_pop_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const require = createRequire(path.join(ROOT, 'x.js')); const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '12593'; let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _qnavDrawKey === 'function', null, { timeout: 180000 });
const info = await page.evaluate(async () => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
  applyClass('warrior'); player.level = 30; player.quests = { active: {}, completed: {}, unlocked: {} };
  try { _ensureQuests(); tickQuestUnlocks(); } catch (e) {}
  loadMap('town', 900); await W8(1200); try { closeAllModals(); } catch (e) {} game.paused = false;
  player.quests.unlocked.q_clockwork_underpass = true; acceptQuest('q_clockwork_underpass', true);
  try { game._qnavOptOut = false; _qnavAutoTrack(); } catch (e) {} await document.fonts.load('900 11px Nunito');
  for (let i = 0; i < 60; i++) { await W8(100); const k = document.getElementById('qnav-key'); if (k && getComputedStyle(k).display !== 'none') break; }
  document.documentElement.classList.remove('lx-nobackdrop');
  const fo = document.getElementById('map-fade-overlay'); if (fo) fo.style.display = 'none';
  await W8(600);
  const k = document.getElementById('qnav-key'); if (!k) return null; const cs = getComputedStyle(k), r = k.getBoundingClientRect();
  return { rect: [r.x, r.y, r.width, r.height], display: cs.display, bg: cs.backgroundImage.slice(0, 90), bgFull: cs.backgroundImage, border: cs.borderTopColor + ' ' + cs.borderTopWidth, font: getComputedStyle(k.querySelector('.qk-t b')).fontFamily.split(',')[0], key: k.querySelector('.qk-k') ? getComputedStyle(k.querySelector('.qk-k')).backgroundColor : null, text: k.textContent.trim().slice(0, 60) };
});
const al = ((info && info.bgFull) || '').match(/rgba\([^)]*,\s*([\d.]+)\)/g) || []; const alphas = al.map((x) => +x.match(/([\d.]+)\)$/)[1]);
check(!!info && info.display === 'flex', 'the navigator shows for a tracked quest', info && info.text);
check(!!info && info.font === 'Nunito' && info.border === 'rgb(13, 10, 20) 2px' && info.key === 'rgb(255, 224, 122)', 'INK: Nunito, a 2 px ink rim, a butter key', JSON.stringify(info && { font: info.font, border: info.border, key: info.key }));
check(alphas.length >= 2 && alphas.every((a) => a < 0.5), 'SEE-THROUGH: every background layer under 0.5 alpha', JSON.stringify(alphas));
check(!!info && info.rect[2] <= 200 && info.rect[3] <= 42, 'COMPACT: no more than 200 x 42', info && info.rect.slice(2).map((v) => Math.round(v)).join('x'));
await browser.close(); server.kill();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed'); process.exit(fail ? 1 : 0);
