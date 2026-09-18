// ART POLISH (final polish audit R1, R2; per user "Work on all the above"). A 4:3 backdrop is cropped to the screen's
// aspect (anchored at the ground) instead of stretched ~34% wide, while a 16:9 plate is untouched; Octobaby's four
// tentacles - one painted arm - each wear their status colour and glyph (Venom keeps the art's purple).
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/art_polish_test.mjs [page.html] [--shot=<png>]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11203';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SHOT = (process.argv.find((a) => a.startsWith('--shot=')) || '').slice(7);
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxBgScaled === 'function' && typeof drawMonster === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    try { LX_PERF.veryLowFx = false; } catch (e) {}
    // R1 — what the bake draws for a 4:3 plate and for a 16:9 one
    const bake = async (map) => {
      loadMap(map, 300); await sleep(1500);
      const img = _pickBGImage(); for (let i = 0; i < 60 && !(img && img.naturalWidth); i++) await sleep(100);
      if (!img || !img.naturalWidth) return { map, err: 'no plate' };
      delete img._lxBgS; const calls = []; const P = CanvasRenderingContext2D.prototype, _di = P.drawImage;
      P.drawImage = function (...a) { if (a[0] === img) calls.push(a.slice(1).map((v) => Math.round(v))); return _di.apply(this, a); };
      let cv; try { cv = _lxBgScaled(img, 1280, 720); } finally { P.drawImage = _di; }
      const c = calls[0] || [];
      return { map, src: [img.naturalWidth, img.naturalHeight], call: c, srcAsp: c.length === 8 ? +(c[2] / c[3]).toFixed(3) : +(img.naturalWidth / img.naturalHeight).toFixed(3), baked: cv !== img };
    };
    out.fourThree = await bake('magmaFoundry'); out.wide = await bake('forest');
    // R2 — the four tentacles
    loadMap('forest', 300); await sleep(1200); game.monsters.length = 0;
    spawnMonster(player.x + 420, player.y - 200, 'octobaby', true, false); const ob = game.monsters[game.monsters.length - 1];
    ob._legRefs = ob._legRefs || []; _lxOctoSpawnArms(ob, 0); const legs = game.monsters.filter((m) => /^octoLeg/.test(m.type));
    for (let i = 0; i < 80 && legs.some((l) => !(MONSTER_SPRITES[l.type] && MONSTER_SPRITES[l.type].naturalWidth)); i++) await sleep(100);
    out.legs = {};
    const _tb = window._lxTintBake, _ts = window._txtSprite;
    for (const l of legs) {
      const seen = { tint: [], glyph: [] };
      window._lxTintBake = function (img, f) { seen.tint.push(f); return _tb.apply(this, arguments); };
      window._txtSprite = function (t) { seen.glyph.push(t); return _ts.apply(this, arguments); };
      l.hitFlash = 0; l.freezeTimer = l.burnTimer = l.stunTimer = 0;
      try { const sx = l.x - game.camera.x, sy = l.y - (game.camera.y || 0); ctx.save(); drawMonster(l); ctx.restore(); } catch (e) { seen.err = e.message; }
      out.legs[l.type] = { tint: seen.tint.filter(Boolean)[0] || null, glyph: seen.glyph.find((g) => /[☠❄🔒⚡]/u.test(g)) || null, err: seen.err };
    }
    window._lxTintBake = _tb; window._txtSprite = _ts;
    game.paused = false; await sleep(600); game.paused = true;
    out.legBox = legs.map((l) => [Math.round(l.x - game.camera.x), Math.round(l.y - (game.camera.y || 0)), l.w, l.h]);
    return out;
  });
  const f = r.fourThree, w = r.wide;
  check(!!f.call && f.call.length === 8 && Math.abs(f.srcAsp - 1280 / 720) < 0.02, 'a 4:3 backdrop is cropped to the screen\'s aspect, not stretched', J(f));
  check(f.call.length === 8 && f.call[1] + f.call[3] === f.src[1], '...anchored at the ground (the crop comes off the sky)', J(f.call));
  check(!w.err && (w.call.length === 4 || (!w.baked && w.call.length === 0)), 'a 16:9 backdrop is drawn whole, as before (baked uncropped, or blitted as is)', J(w));
  const L = r.legs;
  check(!L.octoLegPoison || !L.octoLegPoison.tint, 'Venom keeps the art\'s own purple', J(L.octoLegPoison));
  check(['octoLegFreeze', 'octoLegSkillLock', 'octoLegStun'].every((t) => L[t] && L[t].tint) && new Set(['octoLegFreeze', 'octoLegSkillLock', 'octoLegStun'].map((t) => L[t] && L[t].tint)).size === 3, 'Frostbite, Silence and Shock each wear their own colour', J(L));
  check(J(['octoLegPoison', 'octoLegFreeze', 'octoLegSkillLock', 'octoLegStun'].map((t) => L[t] && L[t].glyph)) === J(['☠', '❄', '🔒', '⚡']), 'each tentacle carries its glyph badge', J(Object.values(L).map((x) => x.glyph)));
  if (SHOT) {
    const b = r.legBox.reduce((a, [x, y, ww, hh]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x + ww), Math.max(a[3], y + hh)], [1e9, 1e9, -1e9, -1e9]);
    await page.screenshot({ path: SHOT, clip: { x: Math.max(0, b[0] - 20), y: Math.max(0, b[1] - 20), width: Math.min(1280, b[2] - b[0] + 40), height: Math.min(720, b[3] - b[1] + 40) } }).catch(() => page.screenshot({ path: SHOT }));
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
