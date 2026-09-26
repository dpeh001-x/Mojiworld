// Live test: SAVE BACKUPS, CONTROLS & KEYBINDS, EDICTS AND THE ITEM TOOLTIP (per user: "Fix all you have found" - the
// last windows on the old violet-and-gold looks). Opens each and reads computed style:
//   - Save Backups and Controls & Keybinds wear the pop window: a 3px ink edge on a berry slab, the butter comic title
//     (Nunito 1000, ink stroke under the fill, berry slab), Nunito text; the Keybinds P5 plate stays;
//   - the open Keybinds tab is the butter one and follows a tab switch (the kbm-on class); idle tabs are not butter;
//   - Backups: Backup current save is butter, Secure Save berry, Done ink;
//   - Edicts keeps its glossy glass (per user, v0.30.491) and only its face changes to Nunito;
//   - the item tooltip is an ink body in a 2px ink edge on a berry slab, Nunito, and now carries data-rarity, so its
//     rarity stripe (designed in v0.25.879, dead until now) shows in the rarity colour;
//   - SCOPE: a key chip keeps its own face and background (v0.30.1163).
//   node scripts/pop_windows_more_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT || process.argv[2]; for (let p = 19061; p <= 19099 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof openBackupModal === 'function' && typeof attachTooltip === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
const R = await page.evaluate(async () => {
  // headless trips the perf governor into reduced-effects mode (html.lx-nobackdrop strips every box-shadow and
  // backdrop-filter): pin full effects so the frame / slab / glass reads are real
  const full = () => { try { window._perfTick = function () {}; LX_PERF.veryLowFx = false; } catch (e) {} document.documentElement.classList.remove('lx-nobackdrop'); };
  full();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; _prologueActive = false; localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
  loadMap('town', 600); await sleep(2000); try { closeAllModals(); } catch (e) {}
  const fam = (el) => getComputedStyle(el).fontFamily.split(',')[0].split('"').join('').trim();
  const frame = (el) => { const c = getComputedStyle(el); return { edge: c.borderTopWidth + ' ' + c.borderTopColor, shadow: c.boxShadow, face: fam(el), bg: c.backgroundImage.slice(0, 80) }; };
  const title = (h) => { const c = getComputedStyle(h); return { face: fam(h), weight: c.fontWeight, fill: c.webkitTextFillColor, stroke: c.webkitTextStrokeWidth + ' ' + c.webkitTextStrokeColor, paint: c.paintOrder, shadow: c.textShadow }; };
  const out = {};
  openBackupModal(); await sleep(450); full();
  const bk = document.getElementById('backup-modal');
  out.backup = { ...frame(bk), title: title(bk.querySelector('h2')), now: getComputedStyle(document.getElementById('backup-now-btn')).backgroundColor,
    secure: getComputedStyle(document.getElementById('backup-secure-btn')).backgroundColor, done: getComputedStyle(bk.querySelector('.bk-close')).backgroundColor };
  try { closeBackupModal(); } catch (e) {} await sleep(200);
  toggleKeybindModal(); await sleep(500); full();
  const km = document.querySelector('#keybind-modal > div');
  const tabs = () => [...document.querySelectorAll('#keybind-modal .kbm-tab-btn')].map((t) => ({ tab: t.dataset.kbmtab, on: t.classList.contains('kbm-on'), bg: getComputedStyle(t).backgroundColor, face: fam(t) }));
  const chip = document.querySelector('#keybind-modal kbd, #keybind-modal .kbm-key, #keybind-modal [class*="kbd"]');
  out.keys = { ...frame(km), title: title(km.querySelector('h2')), tabs0: tabs(), chip: chip && { cls: chip.className || chip.tagName, face: fam(chip), bg: getComputedStyle(chip).backgroundColor } };
  const pot = document.querySelector('#keybind-modal .kbm-tab-btn[data-kbmtab="potions"]'); if (pot) pot.click(); await sleep(300);
  out.keys.tabs1 = tabs();
  toggleKeybindModal(); await sleep(250);
  openEdictsPanel(); await sleep(450); full();
  const ed = document.getElementById('edicts-modal');
  out.edicts = { h2: fam(ed.querySelector('h2')), row: fam(ed.querySelector('.edict-row') || ed), card: getComputedStyle(ed.querySelector('.ed-card')).borderTopColor, glass: getComputedStyle(ed).backdropFilter || getComputedStyle(ed).webkitBackdropFilter };
  try { closeAllModals(); } catch (e) {} await sleep(250);
  const d = document.createElement('div'); d.style.cssText = 'position:absolute; left:300px; top:160px; width:48px; height:48px;'; (document.querySelector('.game-wrapper') || document.body).appendChild(d);
  const it = rollItemDrop(40, 40); it.rarity = 'legendary'; attachTooltip(d, it); d.onmouseenter({ currentTarget: d, target: d, clientX: 320, clientY: 180 }); await sleep(250); full();
  const tt = document.getElementById('item-tooltip'); const tc = getComputedStyle(tt);
  out.tip = { shown: tc.display !== 'none', rarity: tt.dataset.rarity, top: tc.borderTopWidth + ' ' + tc.borderTopColor, left: tc.borderLeftWidth + ' ' + tc.borderLeftColor, shadow: tc.boxShadow, face: fam(tt), bg: tc.backgroundImage.slice(0, 80) };
  d.onmouseleave(); d.remove();
  return out;
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x }); const J = (o) => JSON.stringify(o);
const popFrame = (f) => f && f.edge === '3px rgb(13, 10, 20)' && /rgb\(125, 35, 82\) 8px 8px 0px/.test(f.shadow) && f.face === 'Nunito';
const popTitle = (t) => t && t.face === 'Nunito' && +t.weight >= 1000 && t.fill === 'rgb(255, 224, 122)' && /^4\.5px rgb\(13, 10, 20\)/.test(t.stroke) && /^stroke/.test(t.paint) && /rgb\(125, 35, 82\) 3px 3px/.test(t.shadow);
ok('Save Backups wears the pop window: ink edge on a berry slab, Nunito, the butter comic title', popFrame(R.backup) && popTitle(R.backup.title), { f: R.backup && [R.backup.edge, R.backup.shadow.slice(0, 50), R.backup.face], t: R.backup && R.backup.title });
ok('Backups: Backup current save is butter, Secure Save berry, Done ink', R.backup.now === 'rgb(255, 224, 122)' && R.backup.secure === 'rgb(217, 70, 127)' && R.backup.done === 'rgb(26, 20, 36)', [R.backup.now, R.backup.secure, R.backup.done]);
ok('Controls & Keybinds wears the pop window and keeps its P5 plate', popFrame(R.keys) && popTitle(R.keys.title) && /panel_p5/.test(R.keys.bg), { f: [R.keys.edge, R.keys.shadow.slice(0, 50), R.keys.face, R.keys.bg.slice(0, 40)], t: R.keys.title });
const on0 = R.keys.tabs0.filter((t) => t.on), on1 = R.keys.tabs1.filter((t) => t.on);
ok('the open Keybinds tab is the butter one, idle tabs are not, and it follows a tab switch', on0.length === 1 && on0[0].bg === 'rgb(255, 224, 122)' && R.keys.tabs0.filter((t) => !t.on).every((t) => t.bg !== 'rgb(255, 224, 122)')
  && on1.length === 1 && on1[0].tab === 'potions' && on1[0].bg === 'rgb(255, 224, 122)' && R.keys.tabs0.every((t) => t.face === 'Nunito'), { before: R.keys.tabs0, after: R.keys.tabs1.map((t) => t.tab + ':' + t.on) });
ok('SCOPE: a key chip keeps its own look (v0.30.1163)', !R.keys.chip || R.keys.chip.bg !== 'rgb(255, 224, 122)', R.keys.chip);
ok('Edicts keeps its glass (per user, v0.30.491) and only its face changes to Nunito', R.edicts.h2 === 'Nunito' && R.edicts.row === 'Nunito' && /blur/.test(R.edicts.glass || '') && !/13, 10, 20/.test(R.edicts.card), R.edicts);
ok('the item tooltip is an ink body in a 2px ink edge on a berry slab, set in Nunito', R.tip.shown && R.tip.top === '2px rgb(13, 10, 20)' && /rgb\(125, 35, 82\) 4px 4px 0px/.test(R.tip.shadow) && R.tip.face === 'Nunito' && !/40, 24, 64/.test(R.tip.bg), R.tip);
ok('the tooltip carries its rarity and shows it as a stripe in the rarity colour (the v0.25.879 stripe, never switched on before)', R.tip.rarity === 'legendary' && R.tip.left === '4px rgb(255, 184, 102)', { rarity: R.tip.rarity, left: R.tip.left });
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + J(q.x ?? '').slice(0, 260));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
