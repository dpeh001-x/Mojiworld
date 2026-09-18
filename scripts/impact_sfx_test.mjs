// WEAPON IMPACTS (final polish audit C6; per user "Work on all the above"). A landed hit plays the class's own recorded
// impact - normal or critical - instead of the one synth beep every class shared; the synth still covers a clip that
// has not loaded; all eight clips decode and are short.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/impact_sfx_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11213';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 40; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    try { audio.muted = false; } catch (e) {}
    loadMap('forest', 300); await sleep(2000); try { closeAllModals(); } catch (e) {} game.paused = true;
    out.files = {};
    for (const c of ['warrior', 'rogue', 'mage', 'archer']) for (const k of ['', '_crit']) {
      const a = new Audio('audio/impact/hit_' + c + k + '.mp3');
      out.files[c + k] = await new Promise((res) => { a.onloadedmetadata = () => res(+a.duration.toFixed(2)); a.onerror = () => res('error'); setTimeout(() => res('timeout'), 8000); });
    }
    const synth = [], clips = [];
    const _ap = audio.play.bind(audio); audio.play = (id) => { if (id === 'hit' || id === 'crit') synth.push(id); return _ap(id); };
    const _pu = window._playUiSfx; window._playUiSfx = function (id) { if (/^impact_/.test(id)) clips.push(id); return _pu.apply(this, arguments); };
    const mob = () => { game.monsters.length = 0; spawnMonster(player.x + 120, player.y - 20, 'slime', false, false); const m = game.monsters[game.monsters.length - 1]; m.maxHp = m.currentHp = 1e9; m.evasion = 0; m.invulnerable = 0; return m; };
    player._oneShot = true;
    // first ever hit of a class, clip not yet buffered: the synth covers it
    player.cls = 'rogue'; game.time = (game.time | 0) + 7; hitMonster(mob(), 10, false, 'melee');
    out.firstHit = { synth: synth.slice(), clips: clips.slice() };
    out.classes = {};
    for (const c of ['warrior', 'rogue', 'mage', 'archer']) {
      player.cls = c;
      if (typeof _uiSfxEl === 'function') { for (const k of ['', '_crit']) { const el = _uiSfxEl('impact_' + c + k); for (let i = 0; i < 50 && el && el.readyState < 2; i++) await sleep(100); } }
      synth.length = 0; clips.length = 0;
      game.time = (game.time | 0) + 7; hitMonster(mob(), 10, false, 'melee'); await sleep(80);
      game.time = (game.time | 0) + 7; hitMonster(mob(), 10, true, 'melee'); await sleep(80);
      out.classes[c] = { clips: clips.slice(), synth: synth.slice() };
    }
    player._oneShot = false; audio.play = _ap; window._playUiSfx = _pu;
    return out;
  });
  const F = Object.values(r.files);
  check(F.length === 8 && F.every((d) => typeof d === 'number' && d > 0.05 && d < 0.6), 'all eight impact clips decode, each under 0.6 s', J(r.files));
  check(r.firstHit.synth.length === 1, 'a hit before the clip has buffered still sounds (the synth covers it)', J(r.firstHit));
  for (const c of ['warrior', 'rogue', 'mage', 'archer']) {
    const x = r.classes[c];
    check(J(x.clips) === J(['impact_' + c, 'impact_' + c + '_crit']) && x.synth.length === 0, `${c === 'archer' ? 'an' : 'a'} ${c}'s hit and crit play the ${c}'s own impacts, not the shared beep`, J(x));
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
