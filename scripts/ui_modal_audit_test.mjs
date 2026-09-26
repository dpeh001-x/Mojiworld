// Six modal / input gaps from the 2026-09-26 full audit, each driven through the real functions and real keys:
//  1. WARDROBE ESC: Esc reaches closeAllModals first, which only removed the wardrobe's .open - so closeCharStudio's
//     revert never ran and an un-applied hair dye (or posture) was kept and saved without Apply or its fee.
//  2. WARDROBE + K: K opens the keybind card without closing the wardrobe; K again closed it and unpaused, because
//     _anyOtherModalOpen() left the wardrobe out - the world ran under a 94%-opaque wardrobe.
//  3. FIRST MOJIMON CARD: the full-screen celebration never paused and was in no pause-owner table; mobs hit the hero
//     behind it.
//  4. BOSS BOON WHEEL: its 1.5 s timer waited only for a story beat or the pause card, so it opened hidden under the
//     journal / attributes / codex, and closing that panel (Esc, U, J) threw the boss boon away unseen.
//  5. BOSS INTRO under the PAUSE CARD: the arena intro opened beneath #lx-pause and ate the key meant for Resume.
//  6. EVERDAWN WELCOME: "press any key to skip" let the key through, so J skipped the clip AND opened the journal.
//   node scripts/ui_modal_audit_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PORT = String(process.argv[3] || 9992);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof openCharStudio === 'function' && document.getElementById('hero-name-input'), null, { timeout: 180000 });
await page.waitForTimeout(6000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Modal').catch(() => {});
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); if (!m) return; for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await page.evaluate(async () => {
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  player._tutorialSeen = true; player.level = 60; player._god = true; player.invulnerable = 9e9;
  player._storyBeatsSeen.everdawn_welcome = true;   // its first-arrival clip is not a STORY_BEATS key: it would play on this loadMap and take the next Esc
  try { closeAllModals(); } catch (e) {} loadMap('town'); game.paused = false;
  await new Promise((z) => setTimeout(z, 1500));
  try { closeAllModals(); } catch (e) {} game.paused = false;
});
const sleep = (ms) => page.waitForTimeout(ms);
const R = {};
// 1 + 2 wardrobe
R.dye = await page.evaluate(() => { player.mojicoins = 50000; try { _csGrantWardrobe(); } catch (e) {} openCharStudio();   // her chair: a one-shot grant and the 1,000 fee in the wallet
 
  const orig = (CHAR_STUDIO._origHairHue | 0), dyed = (orig + 90) % 360;
  player.lookCustom = player.lookCustom || {}; player.lookCustom.hairHue = dyed; CHAR_STUDIO.hairHue = dyed;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  return { orig, dyed, open: document.getElementById('char-studio-overlay').classList.contains('open') }; });
await page.keyboard.press('Escape'); await sleep(400);
Object.assign(R.dye, await page.evaluate(() => ({ after: player.lookCustom.hairHue | 0, stillOpen: document.getElementById('char-studio-overlay').classList.contains('open') })));
await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; player.mojicoins = 50000; try { _csGrantWardrobe(); openCharStudio(); } catch (e) {} if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
await sleep(300);
await page.keyboard.press('k'); await sleep(300); await page.keyboard.press('k'); await sleep(400);
R.kk = await page.evaluate(() => ({ wardrobeOpen: document.getElementById('char-studio-overlay').classList.contains('open'), paused: !!game.paused }));
await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
await sleep(300);
// 3 first MojiMon card
R.mm = await page.evaluate(async () => { game.paused = false; _mojimonFirstBindModal('slime'); await new Promise((z) => setTimeout(z, 300));
  return { paused: !!game.paused, owned: (typeof _lxPauseOwners === 'function' ? _lxPauseOwners() : []).some((e) => e && e.id === 'mojimon-firstbind') }; });
await page.keyboard.press('Escape'); await sleep(700);
Object.assign(R.mm, await page.evaluate(() => ({ gone: !document.getElementById('mojimon-firstbind'), pausedAfter: !!game.paused })));
await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
// 4 boon wheel under the journal
R.wheel = await page.evaluate(async () => { game.paused = false; toggleQuestJournal(); await new Promise((z) => setTimeout(z, 200));
  showPowerupChoice({ name: 'Test' }); await new Promise((z) => setTimeout(z, 300));
  const pm = document.getElementById('powerup-modal');
  const underJournal = pm.style.display === 'flex';
  closeAllModals(); await new Promise((z) => setTimeout(z, 1200));
  return { openedUnderJournal: underJournal, openedAfter: pm.style.display === 'flex' }; });
await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
// 5 boss intro under the pause card
R.intro = await page.evaluate(async () => { game.paused = false; _lxPauseOpen(); await new Promise((z) => setTimeout(z, 200));
  _playBossIntro('kingKrook'); await new Promise((z) => setTimeout(z, 300));
  const ov = document.getElementById('boss-intro-overlay'); const under = ov.classList.contains('on');
  _lxPauseClose(); await new Promise((z) => setTimeout(z, 900));
  const after = ov.classList.contains('on'); try { _dismissBossIntro(); } catch (e) {} return { openedUnderPause: under, openedAfter: after }; });
await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
// 6 Everdawn welcome skipped with J
await page.evaluate(() => { delete player._storyBeatsSeen.everdawn_welcome; game.paused = false; _playEverdawnWelcome(); });
await sleep(700);
await page.keyboard.press('j'); await sleep(900);
R.everdawn = await page.evaluate(() => { const q = document.getElementById('quest-modal'); const qOpen = !!(q && (q.style.display === 'flex' || q.style.display === 'block'));
  return { clipGone: !document.querySelector('#everdawn-welcome-overlay[style*="flex"]'), journalOpened: qOpen, pausedWithJournal: qOpen ? !!game.paused : null }; });
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(R.dye.open && !R.dye.stillOpen && R.dye.after === R.dye.orig, 'Esc on the wardrobe reverts an un-applied dye (no free recolour)', R.dye);
ok(R.kk.wardrobeOpen && R.kk.paused, 'K twice in the wardrobe does not unpause the world behind it', R.kk);
ok(R.mm.paused && R.mm.owned && R.mm.gone && !R.mm.pausedAfter, 'the first-MojiMon card pauses, owns the pause, and gives it back on close', R.mm);
ok(!R.wheel.openedUnderJournal && R.wheel.openedAfter, 'the boss boon wheel waits for the journal to close instead of opening hidden under it', R.wheel);
ok(!R.intro.openedUnderPause && R.intro.openedAfter, 'the boss intro waits for the pause card instead of playing unseen beneath it', R.intro);
ok(!R.everdawn.journalOpened, 'the key that skips the Everdawn welcome does not also open a panel', R.everdawn);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
