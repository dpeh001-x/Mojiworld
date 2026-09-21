// ONE LEAVE BUTTON PER DIALOG (v0.30.957).
//
// A generic 'Leave' is appended to every dialog whose role does not author its own options. Three
// roles ALSO pushed a '(leave)' of their own, so the taxi, the sage and the jukebox each offered two
// buttons that did the same thing - visible on Taxi Uncle as "(leave)" sitting beside "Leave".
//
// The taxi's copy was not purely cosmetic: its handler was the only thing clearing _caravanStage.
// The reset moved to _lxResetDialogStages, called from BOTH ways a dialog ends. closeDialog held it
// before - but Escape does not call closeDialog, it calls closeAllModals, which only hid #dialog. So
// the case closeDialog's own comment worried about ("dismissing mid-script via ESC / walk-away") was
// still live for the sage and the amnesiac, and would have become live for the taxi the moment his
// button went. Leaving him any way at all now opens the next chat on his introduction instead of
// halfway through "Fifty Mojicoins a trip...". The third check drives all three exits.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/dialog_single_leave_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11349';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
// count the buttons that close the conversation, whatever they are called
const leaves = () => page.evaluate(() => [...document.querySelectorAll('#dialog-options button')]
  .map((b) => (b.textContent || '').trim())
  .filter((t) => /^\(?leave\)?\.?$/i.test(t)));
const talkTo = (role, stage) => page.evaluate(async ({ role, stage }) => {
  try { closeAllModals(); } catch (e) {}
  if (stage != null) game._caravanStage = stage;
  const n = (game.npcs || []).find((x) => x && x.role === role);
  if (!n) return 'no ' + role + ' on this map';
  openNPC(n); await new Promise((r) => setTimeout(r, 600));
  return true;
}, { role, stage });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40;
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 2000)); game.paused = false;
  });
  for (let i = 0; i < 14; i++) { const c = await page.evaluate(() => (document.body.className.match(/cinematic|sb-active/g) || []).join('+')); if (!c) break; await page.keyboard.press('Space'); await page.waitForTimeout(400); }
  // the taxi, at each of the four stages that had one
  const taxi = [];
  for (const stage of [0, 1, 2, 3]) {
    const ok = await talkTo('caravan', stage);
    if (ok !== true) { taxi.push('stage ' + stage + ': ' + ok); continue; }
    const l = await leaves();
    if (l.length !== 1) taxi.push('stage ' + stage + ': ' + J(l));
  }
  check(taxi.length === 0, 'Taxi Uncle offers exactly one leave button at every stage', taxi.length ? J(taxi) : 'stages 0-3, one "Leave" each');
  // and the two other roles that had the same pair
  const others = [];
  for (const role of ['jukebox']) {   // the sage lives elsewhere; the jukebox is the other role that had the pair
    const ok = await talkTo(role, null);
    if (ok !== true) { others.push(role + ': ' + ok); continue; }
    const l = await leaves();
    if (l.length !== 1) others.push(role + ': ' + J(l));
  }
  check(others.length === 0, 'so does the jukebox, the other role that had the pair', others.length ? J(others) : 'one each');
  // leaving any way at all must reset the taxi's conversation stage
  const stageAfter = await page.evaluate(async () => {
    const n = (game.npcs || []).find((x) => x && x.role === 'caravan');
    const out = {};
    for (const [how, fn] of [['the Leave button', () => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => /^leave$/i.test((x.textContent || '').trim())); if (b) b.click(); }],
      ['closeDialog()', () => closeDialog()],
      ['closeAllModals()', () => closeAllModals()]]) {
      game._caravanStage = 2; openNPC(n); await new Promise((r) => setTimeout(r, 400));
      fn(); await new Promise((r) => setTimeout(r, 300));
      out[how] = game._caravanStage | 0;
    }
    return out;
  });
  const stuck = Object.entries(stageAfter).filter(([, v]) => v !== 0).map(([k, v]) => k + ' -> stage ' + v);
  check(stuck.length === 0, 'and however you leave him, the next chat starts from the top', stuck.length ? J(stuck) : J(stageAfter));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
