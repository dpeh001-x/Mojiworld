// COMBAT FEEL + CLASS VOICES (final polish audit C1-C3, A1; per user "Work on all the above"). A struck enemy shows
// its white flash for the whole hit window (it was off through the hit-stop); a skill whose hits carry a tag, not
// its own id, lands with its own weight (an ultimate froze the frame like a basic), once per cast per 250 ms; the
// enemy's pain clip plays on a landed hit, not on IMMUNE; each class speaks with its own voice, not the warrior's.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/combat_feel_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11199';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function' && typeof drawMonster === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(2500); game.paused = true; try { closeAllModals(); } catch (e) {}
    const mob = () => { game.monsters.length = 0; spawnMonster(player.x + 120, player.y - 20, 'slime', false, false); const m = game.monsters[game.monsters.length - 1];
      m.maxHp = m.currentHp = 1e9; m.evasion = 0; m.invulnerable = 0; m.def = 0; return m; };
    // C1 — the flash decision in the draw, the moment a hit sets it (as it stands through the hit-stop)
    let m = mob(); m.hitFlash = 50; game._flashBudgetFrame = _lxDrawSeq; game._flashBudgetUsed = 0;
    try { drawMonster(m); } catch (e) { out.drawErr = e.message; }
    out.flashAt50 = game._flashBudgetUsed;
    // C2 — the hit-stop a tagged hit from an ultimate asks for
    const stops = []; const _hs = window.addHitStop; window.addHitStop = function (ms) { stops.push(ms); return _hs.apply(this, arguments); };
    player._oneShot = true;   // no miss roll: the weight is what is measured
    m = mob(); _lxRankSrc = 'doombringer_ult'; hitMonster(m, 10, false, 'aoe'); _lxRankSrc = 'doombringer_ult'; hitMonster(m, 10, false, 'aoe');
    _lxRankSrc = null; out.ultStops = stops.slice(); stops.length = 0;
    m = mob(); hitMonster(m, 10, false, 'melee'); out.basicStop = stops.slice();
    window.addHitStop = _hs;
    // C3 — the pain clip on IMMUNE vs on a landed hit
    let sfx = 0; const _ps = window._playMonsterSfx; window._playMonsterSfx = function (mm, kind) { if (kind === 'hit') sfx++; return _ps.apply(this, arguments); };
    m = mob(); m.invulnerable = 5000; hitMonster(m, 10, false, 'melee'); out.sfxImmune = sfx; sfx = 0;
    m = mob(); hitMonster(m, 10, false, 'melee'); out.sfxLanded = sfx;
    window._playMonsterSfx = _ps; player._oneShot = false;
    // A1 — the voice bundle each class reads
    out.voice = {}; for (const c of ['warrior', 'mage', 'rogue', 'archer']) { player.cls = c; out.voice[c] = _classKey(); }
    player.cls = 'warrior';
    return out;
  });
  check(r.flashAt50 === 1, 'a struck enemy shows its white flash the moment the hit lands (hitFlash 50, held through the hit-stop)', J({ used: r.flashAt50, err: r.drawErr }));
  check(r.ultStops[0] >= 95, 'an ultimate whose hits carry a tag ("aoe") freezes the frame at its own weight, not a basic\'s 35 ms', J(r.ultStops));
  check(r.ultStops.length >= 2 && r.ultStops[1] < r.ultStops[0], 'its next hit inside 250 ms lands at the tag\'s own weight (no strobing multi-hit)', J(r.ultStops));
  check(r.basicStop[0] === 35, 'a basic attack still stops for 35 ms', J(r.basicStop));
  check(r.sfxImmune === 0, 'an IMMUNE hit plays no pain clip', J(r.sfxImmune));
  check(r.sfxLanded === 1, 'a landed hit plays it', J(r.sfxLanded));
  check(r.voice.mage === 'mage' && r.voice.rogue === 'thief' && r.voice.archer === 'bowman' && r.voice.warrior === 'warrior', 'each class speaks with its own voice (mage, rogue -> thief, archer -> bowman)', J(r.voice));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
