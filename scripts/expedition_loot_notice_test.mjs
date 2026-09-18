// Expedition loot is REMOVED when the run ends - and the game says so everywhere it matters.
//
// Per user: "Make it very clear that any Loot that a player receive from the expedition will be
// REMOVED". Driven through the real surfaces, in the order a player meets them:
//   1. Bravo: a first run cannot start until the loot card is accepted; the acceptance persists
//   2. Bravo's speech states the rule every time; after acceptance, Begin goes straight in
//   3. "Find out more -> What you keep" renders (no literal <b>) and says REMOVED
//   4. the start toast states the rule (and the Lv-50 toast reads as a sentence, not code); Bravo
//      mid-run and her Abandon button say walking out removes it
//   5. the quest pin carries the rule for the whole run
//   6. a real pickup marks the item, floats "REMOVED ON EXIT", and warns once per floor
//   7. the bag: a banner over the grid and a TOWER mark on the item; gone once the run ends
//   8. the way out: the item is gone and a toast counts what was removed
//   node scripts/expedition_loot_notice_test.mjs      (MOJI_GAME_FILE to test a candidate)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT; for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: process.env });
await new Promise((r) => setTimeout(r, 2000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _startExpedition === 'function' && typeof openNPC === 'function', null, { timeout: 180000 });
await page.evaluate(() => {
  try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
  document.querySelectorAll('[id^="story-beat"], #lo-stack, #tutorial-modal').forEach((e) => e.remove());
  player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9; player._expLootAck = false;
  loadMap('town', 300); game.paused = false;
});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {}; const toasts = []; const _st = window.showToast; window.showToast = (t, k) => { toasts.push(String(t)); try { _st(t, k); } catch (e) {} };
  const bravo = (game.npcs || []).find((n) => n && n.role === 'expedition');
  out.bravo = !!bravo;
  const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
  const html = () => (document.getElementById('dialog-text') || {}).innerHTML || '';
  const buttons = () => [...document.querySelectorAll('#dialog-options button, #dialog-options .option, #dialog-options > *')];
  const click = (re) => { const b = buttons().find((x) => re.test(x.textContent || '')); if (b) b.click(); return !!b; };
  const aboveFold = () => { const el = document.getElementById('dialog-text'); if (!el) return false;
    const sp = [...el.querySelectorAll('span')].find((x) => /REMOVED/.test(x.textContent || '') && /ff6b6b/.test(x.getAttribute('style') || '')); if (!sp) return false;
    const a = el.getBoundingClientRect(), r = sp.getBoundingClientRect(); return r.height > 0 && r.top >= a.top - 1 && r.bottom <= a.bottom + 1; };
  const settle = async () => { await wait(250); const d = document.getElementById('dialog'); if (d) d.click(); await wait(250); };   // skip the typewriter
  // 1-2. first contact
  openNPC(bravo); await settle();
  out.speechWarns = /REMOVED when the run ends/.test(text());
  out.speechFold = aboveFold();
  game._expInfo = 1; openNPC(bravo); await settle();
  click(/What you keep/); await wait(200);
  out.keepHtml = html(); out.keepText = text();
  game._expInfo = null; openNPC(bravo); await settle();
  out.clickedBegin = click(/Begin Expedition/); await settle();
  out.cardShown = /EVERYTHING YOU LOOT IN THE TOWER IS REMOVED/.test(text());
  out.cardFold = aboveFold();
  out.notStartedYet = !(game.expedition && game.expedition.active);
  out.clickedAccept = click(/I understand/); await wait(2500);
  out.startedAfterAccept = !!(game.expedition && game.expedition.active);
  out.ackSaved = player._expLootAck === true && PLAYER_SAVE_FIELDS.includes('_expLootAck');
  // 4. the start toast
  out.startToast = toasts.find((t) => /EXPEDITION BEGUN/.test(t)) || null;
  // 5. the pin
  _renderExpeditionQuestPin();
  out.pin = (document.getElementById('expedition-quest-pin') || {}).textContent || '';
  // 6. a real pickup: drop an item on the player and let the loop collect it
  const loot = { name: 'Tower Test Blade', baseName: 'Tower Test Blade', slot: 'weapon', stars: 0, atk: 10, rarity: 'common' };
  toasts.length = 0;
  const dn0 = game.damageNumbers.length;
  game.drops.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, vy: 0, type: 'item', item: loot, life: 90000 });
  if (typeof closeDialog === 'function') closeDialog(); game.paused = false;
  for (let i = 0; i < 120 && player.inventory.indexOf(loot) < 0; i++) await wait(50);
  out.pickedUp = player.inventory.indexOf(loot) >= 0;
  out.marked = loot._expLoot === true;
  out.floatTag = game.damageNumbers.slice(dn0).some((d) => /REMOVED ON EXIT/.test(d.text || '')) || game.damageNumbers.some((d) => /REMOVED ON EXIT/.test(d.text || ''));
  out.floorToast = toasts.filter((t) => /REMOVED when the run ends/.test(t)).length;
  const loot2 = { name: 'Tower Test Ring', baseName: 'Tower Test Ring', slot: 'accessory', stars: 0, rarity: 'common' };
  game.drops.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, vy: 0, type: 'item', item: loot2, life: 90000 });
  for (let i = 0; i < 120 && player.inventory.indexOf(loot2) < 0; i++) await wait(50);
  out.floorToastOnce = toasts.filter((t) => /REMOVED when the run ends/.test(t)).length === 1;
  // 7. the bag
  game._invTab = 'equip';
  renderInventory('');
  const bn = document.getElementById('exp-loot-banner');
  out.banner = bn ? { shown: bn.style.display !== 'none', text: bn.textContent } : null;
  out.tileMark = /TOWER/.test((document.getElementById('inv-grid') || {}).innerHTML || '');
  // 4b. Bravo mid-run: walking out is where the loot is lost, so that is where it is said
  openNPC(bravo); await settle();
  out.midRunText = text();
  out.midRunFold = aboveFold();
  out.abandonLabel = (buttons().find((x) => /Abandon/.test(x.textContent || '')) || {}).textContent || null;
  closeDialog();
  // 8. the way out
  toasts.length = 0;
  _endExpedition('abandon'); await wait(1700);
  out.lootGone = player.inventory.indexOf(loot) < 0 && !player.inventory.some((x) => x && x.name === 'Tower Test Blade');
  out.exitToast = toasts.find((t) => /Expedition loot REMOVED/.test(t)) || null;
  renderInventory('');
  const bn2 = document.getElementById('exp-loot-banner');
  out.bannerAfter = bn2 ? bn2.style.display : 'absent';
  // 2b. second visit: the speech still warns, Begin goes straight in
  openNPC(bravo); await settle();
  out.speechWarnsAgain = /REMOVED when the run ends/.test(text());
  click(/Begin Expedition/); await wait(2500);
  out.secondRunDirect = !!(game.expedition && game.expedition.active);
  // the Lv-50 toast (v0.30.874) printed its own code; enter under 50 once to read it
  _endExpedition('abandon'); await wait(400);
  player.level = 35; toasts.length = 0; _startExpedition(); await wait(2200);
  out.lv50Toast = toasts.find((t) => /does not come down to you/.test(t)) || null;
  _endExpedition('abandon');
  window.showToast = _st;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}
console.log(JSON.stringify(r, null, 1));
ok('1. a first run cannot start before the loot card is accepted', r.clickedBegin && r.cardShown && r.notStartedYet, JSON.stringify({ b: r.clickedBegin, card: r.cardShown, notStarted: r.notStartedYet }));
ok('1. accepting it starts the run, and the acceptance is saved', r.clickedAccept && r.startedAfterAccept && r.ackSaved, JSON.stringify({ a: r.clickedAccept, s: r.startedAfterAccept, saved: r.ackSaved }));
ok('2. Bravo\'s speech states the rule, first visit and every visit after', r.speechWarns && r.speechWarnsAgain, `${r.speechWarns}/${r.speechWarnsAgain}`);
ok('the rule is ABOVE THE FOLD at 1280x720 - speech, card and mid-run (the box scrolls; a rule below it is unseen)', r.speechFold && r.cardFold && r.midRunFold, JSON.stringify({ speech: r.speechFold, card: r.cardFold, midRun: r.midRunFold }));
ok('2. once accepted, Begin goes straight into the run', r.secondRunDirect, r.secondRunDirect);
ok('3. "What you keep" renders its markup and says REMOVED', !/<b>|&lt;b&gt;/.test(r.keepText) && /REMOVED/.test(r.keepText) && /EXP and levels/.test(r.keepText), r.keepText.slice(0, 160));
ok('4b. Bravo mid-run says walking out REMOVES the loot, and so does the Abandon button', /everything you looted is REMOVED/.test(r.midRunText || '') && /REMOVED/.test(r.abandonLabel || ''), (r.abandonLabel || '') + ' | ' + (r.midRunText || '').slice(0, 120));
ok('4. the start toast states the rule', /REMOVED WHEN THE RUN ENDS/.test(r.startToast || ''), r.startToast);
ok('4. the Lv-50 toast reads as a sentence, not code', r.lv50Toast && !/' \+ EM \+ '/.test(r.lv50Toast) && /\u2014 below Lv 50/.test(r.lv50Toast), r.lv50Toast);
ok('5. the quest pin carries the rule', /Loot is REMOVED when the run ends/.test(r.pin), r.pin.slice(0, 160));
ok('6. a real pickup is marked and floats "REMOVED ON EXIT"', r.pickedUp && r.marked && r.floatTag, JSON.stringify({ p: r.pickedUp, m: r.marked, f: r.floatTag }));
ok('6. the pickup warning comes once per floor, not per item', r.floorToast === 1 && r.floorToastOnce, `${r.floorToast} / once ${r.floorToastOnce}`);
ok('7. the bag shows a REMOVED banner and marks the tower item', r.banner && r.banner.shown && /REMOVED/.test(r.banner.text) && r.tileMark, JSON.stringify(r.banner) + ' mark ' + r.tileMark);
ok('7. the banner is gone once the run ends', r.bannerAfter === 'none', r.bannerAfter);
ok('8. the tower item is gone after the run, and a toast counts what was removed', r.lootGone && /Expedition loot REMOVED: .*item/.test(r.exitToast || ''), r.exitToast);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
let fail = 0;
for (const x of results) { if (!x.pass) fail++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.pass ? '' : '  -- ' + x.x}`); }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
