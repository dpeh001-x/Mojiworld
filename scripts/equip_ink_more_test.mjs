// EQUIPMENT INK OUTLINE IN THE FORGE AND THE ENHANCEMENT FORGE (v0.30.1262). Per user, with a screenshot of the enhancement
// preview: "Ensure that the equipments in the forge and enhancement UI also has a 1.5px black outline". Opens the forge
// (openShop(weapon)) and the enhancement forge with an item picked; every equipment image in them must draw through
// #lx-ink-2px (the inventory's 1.5 px outline).   [PORT=12603] node scripts/equip_ink_more_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const require = createRequire(path.join(ROOT, 'x.js')); const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '12603'; let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof openEnhancementModal === 'function', null, { timeout: 180000 });
await page.evaluate(async () => { const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
  applyClass('warrior'); player.level = 40; loadMap('town', 900); await W8(1500); try { closeAllModals(); } catch (e) {} player.mojicoins = 999999; game.paused = false;
  document.documentElement.classList.remove('lx-nobackdrop'); const fo = document.getElementById('map-fade-overlay'); if (fo) fo.style.display = 'none'; });
// f9b14d283 v0.30.1562: a worn-art icon (Whittled Stick, Stormcaller Bow, Cosmic Wand...) arrives as a blob: URL, so the
// anvil's picked item is also recognised by its #enhance-stage-item home
const list = () => page.evaluate(() => [...document.querySelectorAll('.modal-overlay img, #enhance-modal img')].filter((im) => im.offsetParent !== null && (/equipment|items|weapons|armors/i.test(im.src) || (/^blob:/.test(im.src) && !!im.closest('#enhance-stage-item')))).map((im) => { const p = []; let e = im; for (let i = 0; i < 4 && e; i++, e = e.parentElement) p.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')); const r = im.getBoundingClientRect(); return [p.reverse().join(' > '), Math.round(r.width) + 'x' + Math.round(r.height), getComputedStyle(im).filter, im.src.split('/').slice(-2).join('/')]; }));
await page.evaluate(() => { openShop('weapon'); }); await page.waitForTimeout(1500);
await page.evaluate(() => { const s = document.querySelector('#shop-list .shop-item'); if (s) s.click(); }); await page.waitForTimeout(800);
const forge = await list(); check(forge.length >= 3 && forge.every((r) => r[2].includes('lx-ink-2px')), 'FORGE: every equipment card image draws the 1.5 px ink outline', forge.length + ' images; ' + [...new Set(forge.map((r) => r[2].slice(0, 30)))].join(' | '));
await page.evaluate(() => { closeAllModals(); const w = player.equipped && (player.equipped.weapon || Object.values(player.equipped).find(Boolean)); openEnhancementModal(w ? 'weapon' : undefined); }); await page.waitForTimeout(1500);
await page.evaluate(() => { const s = document.querySelector('#enhance-list .inv-slot'); if (s) s.click(); }); await page.waitForTimeout(1200);
const enh = await list(); const stage = enh.filter((r) => r[0].includes('enhance-stage-item'));
check(stage.length === 1 && stage[0][2].includes('lx-ink-2px'), 'ENHANCE: the picked item on the anvil draws the 1.5 px ink outline', JSON.stringify(stage.map((r) => r[2])));
check(enh.length >= 2 && enh.every((r) => r[2].includes('lx-ink-2px')), 'ENHANCE: every equipment image in the enhancement forge does', enh.length + ' images');
await browser.close(); server.kill();
console.log(String.fromCharCode(10) + pass + '/' + (pass + fail) + ' checks passed'); process.exit(fail ? 1 : 0);
