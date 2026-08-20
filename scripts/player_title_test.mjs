// Live test: CONQUEROR OF MOJIWORLD — the earned title under the character's
// name (per user: "after killing gravitos3, gain a grandlooking title under
// the character's name").
//
// Driven through the REAL handlers: triggerSuperBossDeath grants it,
// _drawPlayerNameTag paints it (ctx.fillText spied), updateUI mirrors it into
// the HUD, and the save whitelist round-trips it. The pre-endgame state is
// asserted too — a player who has not finished must see no title anywhere.
//   node scripts/player_title_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _drawPlayerNameTag === 'function'
  && typeof triggerSuperBossDeath === 'function' && typeof updateUI === 'function',
  null, { timeout: 120000 });
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = player.cls || 'warrior';
  player.look = player.look || {}; player.look.name = 'Testarossa';

  // every string the nameplate paints, in order
  const tagTexts = () => {
    const painted = [];
    const _ft = ctx.fillText, _st = ctx.strokeText;
    ctx.fillText = function (t) { painted.push(String(t)); return _ft.apply(this, arguments); };
    ctx.strokeText = function () { return _st.apply(this, arguments); };
    try { _drawPlayerNameTag(200, 300); } catch (e) { painted.push('THREW:' + e); }
    ctx.fillText = _ft; ctx.strokeText = _st;
    return painted;
  };
  const hud = () => {
    try { updateUI(); } catch (e) {}
    const el = document.getElementById('hud-player-title');
    return el ? { text: el.textContent || '', shown: el.style.display === 'block' } : null;
  };

  // ---- BEFORE: nothing earned ----
  delete player.equippedTitle;
  player.titles = {};
  out.beforeTag = tagTexts();
  out.beforeHud = hud();

  // ---- the kill. Stub the cinematic chain so nothing seizes the screen;
  // the grant must not depend on any of it. ----
  const _saved = {};
  for (const fn of ['_gravitosDefeatCutscene', '_gugumaToyboxCutscene', '_gugumaRebirthCutscene', '_playStoryBeat', '_showGameComplete', '_sbPreloadClip']) {
    if (typeof window[fn] === 'function') { _saved[fn] = window[fn]; window[fn] = function (a, cb) { if (typeof a === 'function') a(); else if (typeof cb === 'function') cb(); }; }
  }
  const grav = { type: 'gravitos', name: 'Gravitos', x: 500, y: 400, w: 120, h: 160,
                 currentHp: 0, maxHp: 1000, isBoss: true, boss: true, superBoss: true, level: 90 };
  try { triggerSuperBossDeath(grav); out.killThrew = null; } catch (e) { out.killThrew = String(e).slice(0, 140); }
  for (const fn in _saved) window[fn] = _saved[fn];

  out.granted = !!(player.titles && player.titles['Conqueror of Mojiworld']);
  out.equipped = player.equippedTitle || '';
  out.afterTag = tagTexts();
  out.afterHud = hud();

  // ---- the save whitelist actually carries it ----
  out.inSaveFields = (typeof PLAYER_SAVE_FIELDS !== 'undefined') && PLAYER_SAVE_FIELDS.indexOf('equippedTitle') >= 0;
  let round = null;
  try {
    // saveState() only marks dirty + schedules; the write lands later in
    // _flushSaveStateNow. Flush synchronously so this asserts the SERIALISER
    // (does the whitelist carry the field) and not the debounce timer.
    if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow(); else saveState();
    const raw = localStorage.getItem(typeof SAVE_KEY !== 'undefined' ? SAVE_KEY : 'lx_save');
    out.saveKey = (typeof SAVE_KEY !== 'undefined') ? SAVE_KEY : '(unknown)';
    round = !!raw && raw.indexOf('Conqueror of Mojiworld') >= 0;
  } catch (e) { round = 'ERR:' + String(e).slice(0, 60); }
  out.savedToDisk = round;

  // ---- a repeat kill must not stomp a player's own choice ----
  player.equippedTitle = 'Echo Walker';
  try { triggerSuperBossDeath(grav); } catch (e) {}
  out.afterRepeat = player.equippedTitle;

  player.equippedTitle = 'Conqueror of Mojiworld';
  return out;
});

const D = '\u2756';
const beforeHasTitle = (r.beforeTag || []).some(t => /CONQUEROR/i.test(t));
const afterTitleLine = (r.afterTag || []).find(t => /CONQUEROR/i.test(t));
ok('the kill handler runs clean', !r.killThrew, r.killThrew);
ok('BEFORE the endgame: no title under the name, HUD line hidden',
  !beforeHasTitle && r.beforeHud && !r.beforeHud.shown, { tag: r.beforeTag, hud: r.beforeHud });
ok('killing gravitos grants the title', r.granted, { granted: r.granted });
ok('...and auto-equips it', r.equipped === 'Conqueror of Mojiworld', { equipped: r.equipped });
ok('the nameplate paints the name AND the title beneath it',
  (r.afterTag || []).includes('Testarossa') && !!afterTitleLine, r.afterTag);
ok('the title reads as regalia — flanking diamonds, upper case',
  !!afterTitleLine && afterTitleLine === `${D} CONQUEROR OF MOJIWORLD ${D}`, { line: afterTitleLine });
ok('the HUD mirrors it under the character name',
  r.afterHud && r.afterHud.shown && /CONQUEROR OF MOJIWORLD/.test(r.afterHud.text), r.afterHud);
ok('equippedTitle is on the save whitelist', r.inSaveFields, { inSaveFields: r.inSaveFields });
ok('...and survives a real save flush to localStorage', r.savedToDisk === true, { savedToDisk: r.savedToDisk, key: r.saveKey });
ok('a REPEAT kill leaves the player\'s own choice alone', r.afterRepeat === 'Echo Walker', { afterRepeat: r.afterRepeat });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
