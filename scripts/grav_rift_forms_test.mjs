// ONE RIFT PER GRAVITOS FORM (per user: "can you redesign the rift to make it look more fitting for gravitos3", then "redo the voids
// for form 1 and 2 as well"). His teleport warning (_lxGravRiftDraw) draws the form's own tear and halo ring - form 1 a cosmic nebula
// tear with a cyan ring, form 2 a lava-rimmed fracture with a blue-violet ring, form 3 a molten obsidian rift with a flame ring - and
// its glows in the form's colours; the shared violet rift is only the fallback while a form's art decodes.
// One page, the real arena, the real form changes (killMonster), a teleport warning held at 80% (a blink whose 1e9 ms never lands):
//   [1] the art: gravitos<N>_voidrift and gravitos<N>_riftring each have a base and nine loop frames on disk, and the frame index
//       counts nine of each;
//   [2] form 1, 2 and 3 each draw their own rift and ring - and nothing from another form, nor the shared violet art;
//   [3] the glows follow the form: the palette's rim is cyan / lava orange / flame, and a pop (the rift snapping shut) keeps the
//       form it was opened in;
//   [4] no page errors.
// The build before fails [1]-[3].   node scripts/grav_rift_forms_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11889);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
// [1] the art on disk and in the frame index
const KEYS = [1, 2, 3].flatMap((n) => [`gravitos${n}_voidrift`, `gravitos${n}_riftring`]);
const missing = KEYS.flatMap((k) => [`Sprites/fx/${k}.webp`, ...[...Array(9).keys()].map((i) => `Sprites/fx/anim/${k}_${i}.webp`)]).filter((p) => !existsSync(path.join(ROOT, p)));
const idx = readFileSync(path.join(ROOT, 'data/sprite_frame_index.js'), 'utf8');
const unindexed = KEYS.filter((k) => !new RegExp('"' + k + '":\\s*9\\b').test(idx));
ok('[1] each form has its rift and ring: a base + nine loop frames on disk, nine counted in the frame index', missing.length === 0 && unindexed.length === 0, { missing: missing.slice(0, 4), unindexed });
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = { forms: [], pops: [] };
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 100; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._god = true; player.invulnerable = 1e12; player.maxHp = player.hp = 1e12;
    loadMap('gravitosArena', 300); await sleep(3000); try { closeAllModals(); } catch (e) {} game.paused = false;
    const grav = () => game.monsters.find((m) => m.type === 'gravitos' && m.currentHp > 0);
    for (let i = 0; i < 80 && !grav(); i++) await sleep(250);
    const ALL = ['gravitos_voidrift', 'gravitos_riftring', 'gravitos1_voidrift', 'gravitos1_riftring', 'gravitos2_voidrift', 'gravitos2_riftring', 'gravitos3_voidrift', 'gravitos3_riftring'];
    for (const form of [1, 2, 3]) {
      let g = grav(); if (!g) { out.err = 'no gravitos'; break; }
      while ((g._gravitosPhase || 1) < form) { g.currentHp = 0; killMonster(g); await sleep(7000); try { closeAllModals(); } catch (e) {} game.paused = false; g = grav() || g; }
      // ready = the game's own pickers hand back this form's art (until then it draws the stand-in in the form's colour, by design)
      for (let i = 0; i < 150 && !(_lxGravRiftImg(form) && _lxGravRingImg(form)); i++) await sleep(100);
      player.x = g.x - 420; await sleep(300);
      // held every frame: the Ascendant's AI arms its one-shots on its own clock, and an armed one-shot drops a blink (by design)
      const held = { kind: 'blink', el: 0.8e9, ms: 1e9, x: g.x + g.w / 2 - 380, y: g.y + g.h / 2 };
      const hold = () => { g.patternState = 'idle'; g._ohkoWarnUntil = null; if (!g._tpWarn) g._tpWarn = held; };
      hold(); const keep = setInterval(hold, 16);
      await sleep(200);
      // what the rift and ring helpers are handed, identified at draw time (a frame set can swap in shrunk copies at any moment)
      const used = new Set(), keyOf = (img) => { if (!img) return 'stand-in';
        for (const k of ALL) if ((FX_ANIM_FRAMES[k] || []).includes(img) || (typeof LX_FX !== 'undefined' && LX_FX[k] === img)) return k; return 'other'; };
      const oR = window._lxGravRiftAt, oG = window._lxGravRingAt;
      window._lxGravRiftAt = function (img) { used.add(keyOf(img)); return oR.apply(this, arguments); };
      window._lxGravRingAt = function (img) { used.add(keyOf(img)); return oG.apply(this, arguments); };
      await sleep(400); window._lxGravRiftAt = oR; window._lxGravRingAt = oG; clearInterval(keep);
      _lxGravRiftPop(g.x, g.y, 200); out.pops.push(_LX_GTP.pops[_LX_GTP.pops.length - 1].f);
      out.forms.push({ form, phase: g._gravitosPhase || 1, used: [...used].sort(), rim: _LX_GRIFT_PAL[_lxGravForm(g)].rim, warnKept: !!g._tpWarn, pat: g.patternState });
      g._tpWarn = null;
    }
    out.rs = [1, 2, 3].map((f) => _LX_GRIFT_PAL[f].rs);   // the rings' scale per form
    return out;
  });
  const want = (n) => [`gravitos${n}_riftring`, `gravitos${n}_voidrift`];
  ok('[2] each form draws its own rift and ring - nothing from another form, nor the shared violet art', !R.err && R.forms.length === 3
    && R.forms.every((f) => f.phase === f.form && JSON.stringify(f.used) === JSON.stringify(want(f.form))), R.err || R.forms.map((f) => f.form + ':' + f.used.join('+') + (f.warnKept ? '' : ' (warning cleared, ' + f.pat + ')')));
  ok('[3] the glows follow the form (rim cyan / lava / flame), a pop keeps the form it opened in, and the rings are smaller (per user: forms 1 and 2 smaller than the Ascendant\'s, all under the old size)',
    R.forms.map((f) => f.rim).join(' ') === '#5ec8ff #ff7a3a #ff5a1a' && R.pops.join(',') === '1,2,3' && R.rs[0] < R.rs[2] && R.rs[1] < R.rs[2] && R.rs[2] < 1,
    { rims: R.forms.map((f) => f.rim), pops: R.pops, rs: R.rs });
  ok('[4] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
