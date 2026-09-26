// Live test: THE U PANEL'S FRAME, POP PUNK (per user: "Pop punk frame" for the U panel's gold header and tabs, in the
// calm palette - not neon, painted background kept). Opens the real U panel and reads computed style: an ink edge with
// a berry slab and the painted plate still under it; the class name in butter-yellow Nunito comic lettering; the
// CHARACTER label on black tape; the XP bar filling berry to butter on an inked track; the open tab butter yellow on a
// berry slab (not uppercase, 2px edge - the item tabs keep their own 3px look); the shared pop close disc; and the
// Boons tab's plain talent line reading as one paragraph (it was split into three flex columns).
//   node scripts/u_frame_pop_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 18831; p <= 18929 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openLevelUpPanel === 'function' && typeof toggleSharedModal === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { window._perfTick = function () {}; LX_PERF.veryLowFx = false; _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.job = 'berserker'; player.level = 60; player._storyBeatsSeen = new Proxy({}, { get: () => true });
  if (player.talents) delete player.talents.berserker;
  const open = async (tab) => { try { closeAllModals(); } catch (e) {} game._uTab = tab; toggleSharedModal('attributes-modal', 'lp', openLevelUpPanel); await sleep(800); document.documentElement.classList.remove('lx-nobackdrop'); };
  const cs = (sel, p) => { const e = document.querySelector(sel); return e ? getComputedStyle(e, p || null) : null; };
  await open('lp');
  const m = cs('#attributes-modal > .modal'), nm = cs('#attributes-modal .u-name-class'), pre = cs('#attributes-modal .u-name-pre'), fill = cs('#attributes-modal .u-xp-fill');
  const tab = cs('#u-tabs .inv-tab.active'), idle = cs('#u-tabs .inv-tab:not(.active)'), close = cs('#attributes-modal .modal .close-btn');
  const out = { border: m.borderTopWidth + ' ' + m.borderTopColor, shadow: m.boxShadow, bg: m.backgroundImage, nameColor: nm.color, nameFont: nm.fontFamily, nameStroke: nm.webkitTextStrokeWidth,
    preBg: pre.backgroundColor, preColor: pre.color, fill: fill.backgroundImage, tabBg: tab.backgroundColor, tabBorder: tab.borderTopWidth, tabUpper: tab.textTransform, tabShadow: tab.boxShadow,
    idleBg: idle.backgroundColor, closeBorder: close.borderTopColor };
  await open('boons');
  const tl = document.querySelector('#lp-boons .bl-talent:not(.is-eq)');
  out.talent = tl ? { display: getComputedStyle(tl).display, text: tl.textContent.trim().slice(0, 40) } : null;
  try { closeAllModals(); } catch (e) {}
  return out;
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x }); const J = (o) => JSON.stringify(o);
const AY = 'rgb(255, 224, 122)', INK = 'rgb(13, 10, 20)', BERRY = 'rgb(125, 35, 82)';
ok('the frame is an ink edge with a berry slab, and the painted plate is still the background', R.border === '3px ' + INK && R.shadow.includes(BERRY + ' 8px 8px') && /url\(/.test(R.bg), { border: R.border, shadow: R.shadow.slice(0, 60), bg: R.bg.slice(0, 60) });
ok('the class name is butter-yellow Nunito comic lettering with an ink stroke (was gold serif)', R.nameColor === AY && /^"?Nunito/.test(R.nameFont) && parseFloat(R.nameStroke) >= 4, { color: R.nameColor, font: R.nameFont });
ok('the CHARACTER label sits on black tape', R.preBg === INK && R.preColor === AY, { bg: R.preBg, color: R.preColor });
ok('the XP bar fills berry to butter', /linear-gradient/.test(R.fill) && R.fill.includes('rgb(217, 70, 127)') && R.fill.includes(AY), R.fill.slice(0, 90));
ok('the open tab is butter yellow on a berry slab, a 2px edge and no capitals (the item tabs keep their own look)', R.tabBg === AY && R.tabBorder === '2px' && R.tabUpper !== 'uppercase' && R.tabShadow.includes(BERRY), { bg: R.tabBg, border: R.tabBorder, upper: R.tabUpper });
ok('idle tabs are quiet (no fill)', R.idleBg === 'rgba(0, 0, 0, 0)', R.idleBg);
ok('the close disc is the shared pop one (cream ring, not gold)', R.closeBorder === 'rgb(244, 241, 234)', R.closeBorder);
ok("the Boons tab's plain talent line reads as one paragraph (was split into three flex columns)", !!R.talent && R.talent.display === 'block', R.talent);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + J(q.x ?? '').slice(0, 200));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
