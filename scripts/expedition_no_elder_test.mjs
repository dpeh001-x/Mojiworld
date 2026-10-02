// No random Elder on the expedition floors - so no stray warning arrow once a floor is cleared.
// ============================================================================
// Per user: "there seems to be a warning sign at the top left even when the monsters are cleared" (a phone video of B9,
// Stormlit Antechamber). The sign was the off-screen threat arrow pointing at a random Elder the map timer dropped 60-90 s
// into the floor: a Bulwark Elder Stormcaller 1,100 px up the B9 climb, no part of the floor's goal, still there (or only
// arriving) after the floor was cleared. Per user, the expedition gets no random Elders; hunting maps keep theirs.
//   1. B9 (vertical) and B2 (horizontal): arriving arms no Elder timer
//   2. ...and a timer that was armed anyway (a mini-boss slain re-arms it) neither runs down nor spawns an Elder
//   3. ...so once the floor is cleared the off-screen arrow draws nothing
//   4. CONTROL: a hunting map (forest) still arms the 60-90 s timer, and it still brings its Elder
//   5. no page errors
// Run: node scripts/expedition_no_elder_test.mjs   (PORT=..., MOJI_GAME_FILE=... for another build)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = (process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')).replace(/\\/g, '/');
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12941);
const res = [];
const ok = (n, c, extra) => { res.push({ n, pass: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra === undefined ? '' : '  [' + String(extra).slice(0, 260) + ']')); };
const J = JSON.stringify;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof game === 'object' && game.mapData, null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { try { _lxBootGateDone = true; localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('mage'); player.level = 120; player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._storyBeatsSeen.everdawn_welcome = true; try { window._playVoidIntro = function () {}; } catch (e) {} window._prologueActive = false; game.paused = false;
    setInterval(() => { if ('maxHp' in player) player.maxHp = 1e9; for (const k of ['hp', 'currentHp']) if (k in player) player[k] = 1e9; game.paused = false; }, 60); });
  for (let k = 0; k < 12; k++) { await page.evaluate(() => { for (const id of ['plg-dagger-skip', 'plg-skip']) { const sk = document.getElementById(id); if (sk) sk.click(); } for (const [id, c] of [['void-intro-overlay', 'show'], ['story-beat-overlay', 'on'], ['boss-intro-overlay', 'on']]) { const e = document.getElementById(id); if (e) e.classList.remove(c); } window._prologueActive = false; game.paused = false; }); await page.waitForTimeout(250); }
  // arrive on a map; then clear it, arm the timer short and see what turns up and what the arrow draws
  const visit = async (map) => {
    await page.evaluate((map) => { loadMap(map, 300); game.paused = false; }, map);
    await page.waitForTimeout(3000);
    const arrival = await page.evaluate(() => ({ map: game.currentMap, timer: Math.round(game.miniBossTimer || 0), exp: !!(game.mapData && game.mapData._expeditionMap) }));
    await page.evaluate(() => { for (const m of game.monsters) if (m) m.currentHp = 0; game.miniBossActive = false; game.miniBossTimer = 800; });
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => { let glyphs = 0; const o = ctx.fillText; ctx.fillText = function (t) { if (t === String.fromCharCode(0x26A0) || t === String.fromCodePoint(0x1F480)) glyphs++; return o.apply(this, arguments); };
      return new Promise((res) => setTimeout(() => { ctx.fillText = o; res({ timer: Math.round(game.miniBossTimer || 0), elders: game.monsters.filter((m) => m && m.currentHp > 0 && m.isMiniBoss).map((m) => m.name), arrowGlyphs: glyphs }); }, 700)); });
    return { arrival, after };
  };
  for (const map of ['tower_b9', 'tower_b2']) {
    const v = await visit(map);
    ok(`1. ${map}: arriving arms no Elder timer`, v.arrival.map === map && v.arrival.exp && v.arrival.timer === 0, J(v.arrival));
    ok(`2. ${map}: an armed timer neither runs down nor spawns an Elder`, v.after.timer === 800 && v.after.elders.length === 0, J(v.after));
    ok(`3. ${map}: the cleared floor draws no off-screen warning arrow`, v.after.arrowGlyphs === 0, J(v.after));
  }
  const f = await visit('forest');
  ok('4. CONTROL forest: the 60-90 s Elder timer is armed, and it brings its Elder', f.arrival.map === 'forest' && f.arrival.timer >= 55000 && f.arrival.timer <= 90000 && f.after.elders.length === 1, J(f));
  ok('5. no page errors', errs.length === 0, J(errs));
} finally { await browser.close(); server.kill(); }
const fail = res.filter((r) => !r.pass).length;
console.log(`\n${res.length - fail}/${res.length} passed`);
process.exit(fail ? 1 : 0);
