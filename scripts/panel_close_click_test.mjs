// Every panel's ✕ must close it with a real MOUSE click - not just Esc. Per user ("do a detailed bug hunt, final polish
// before this game gets published"): on v0.30.1108, seven of sixteen panels ignored a click on their ✕ - the panel's
// own title was painted over it (Crafting, Reforge, Taxi, Forge, Sell Desk, Codex, Multiplayer), and the corner tray
// sat on top of Crafting / Enhance / Reforge's. The MojiDex world panel had no ✕ at all.
//   node scripts/panel_close_click_test.mjs [page.html] [port] [WxH]     (MOJI_GAME_FILE / 1280x720 by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9932), SIZE = (process.argv[4] || '1280x720').split('x').map(Number);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof openShop === 'function', null, { timeout: 90000 });
await page.evaluate(async () => {
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  applyClass('rogue'); player.level = 45; player._tutorialSeen = true; player._storyBeatsSeen = player._storyBeatsSeen || {}; player._storyBeatsSeen.everdawn_welcome = true; loadMap('town', 300);
  await new Promise((r) => setTimeout(r, 1500)); try { _closeTutorial(true); } catch (e) {}
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; } document.body.classList.remove('sb-active');
  const ew = document.getElementById('everdawn-welcome-overlay'); if (ew) ew.remove();
});
const P = [['craft', 'openCraftingModal()', '#craft-modal'], ['enhance', 'openEnhancementModal()', '#enhance-modal'], ['reforge', 'openReforgeModal()', '#reforge-modal'], ['taxi', 'openTaxi()', '#taxi-modal'],
  ['potion', "openShop('potion')", '#shop-modal'], ['forge', "openShop('weapon')", '#shop-modal'], ['sell', "openShop('sell')", '#shop-modal'], ['codex', 'openCodex()', '#codex-modal'], ['mojidex', 'openMojidex()', '#mojidex-modal'],
  ['lore', 'openLoreMap()', '#lore-modal'], ['quests', 'toggleQuestJournal()', '#quest-modal'], ['worldmap', 'toggleWorldMap()', '#worldmap-modal'], ['u', 'openLevelUpPanel()', '#attributes-modal'],
  ['multi', 'openMultiplayer()', '#multiplayer-modal'], ['keys', 'openHelp()', '#keybind-modal'], ['boon', "showPowerupChoice({ name: 'X', icon: 'X' })", '#powerup-modal']];
const res = [];
for (const [name, open, sel] of P) {
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} }); await page.waitForTimeout(250);
  await page.evaluate((o) => { try { eval(o); } catch (e) {} }, open); await page.waitForTimeout(900);
  const b = await page.evaluate((sel) => { const e = document.querySelector(sel + ' .close-btn') || document.querySelector(sel + ' #kbm-close'); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, sel);
  if (!b) { res.push({ name, ok: false, why: 'no visible ✕' }); continue; }
  await page.mouse.click(b.x, b.y); await page.waitForTimeout(400);
  const open2 = await page.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none'); }, sel);
  res.push({ name, ok: !open2, why: open2 ? 'still open after clicking its ✕' : '' });
}
await browser.close(); server.kill();
let fails = 0;
for (const r of res) { if (!r.ok) fails++; console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + ' closes on a click of its ✕' + (r.why ? '  [' + r.why + ']' : '')); }
console.log(fails ? 'FAIL(' + fails + ')' : 'ALL PASS - ' + res.length + ' panels');
process.exit(fails ? 1 : 0);
