// FIGHT LAG, damage-number atlases vs the resolution governor (v0.30.1234). Per user: "reduce the lag of the game
// especially fights and boss fights even more". Under 4x CPU, 90% of drawDamageNumbers' time was the frames that built
// a glyph atlas (44-120 ms each). Every atlas was keyed on the LIVE render scale, so the governor easing the scale in a
// slow fight (and giving it back) rebuilt the whole working set, twice.
//   - DIP: a pop's atlases built at the live scale are all reused through a governor dip and its return (no rebuild)
//   - STICKY: the key scale is the map's highest; a new map starts from the live scale
//   - SIZE: an atlas built at a higher scale draws the same width on screen as one built at the live scale (both blits)
//   - LIVE: a real fight still draws its numbers from atlases, with no page errors
// Unchanged scale = unchanged pixels: scripts/dn_atlas_pop_test.mjs (13 checks) passes on this build as on the last.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] [PORT=12397] node scripts/dn_atlas_dip_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12397';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxDnAtlasGet === 'function', null, { timeout: 180000 });
  await page.evaluate(() => { try { _LX_DN_WORKER_ON = false; } catch (e) {} });   // v0.30.1239 the Worker atlas build lands a frame or more later; this test reads atlases the same frame
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 30; player.job = 'berserker'; loadMap('mushroom', 600); await W8(2000); try { closeAllModals(); } catch (e) {} game.paused = true;
    // the scale drawDamageNumbers passes: its clamp of the live scale, through the sticky key where the build has one
    const live = () => Math.max(0.25, Math.min(3, _LX_DPR));
    const keyDpr = () => (typeof _lxDnAtlasDpr === 'function' ? _lxDnAtlasDpr(live()) : live());
    let builds = 0; const ob = window._lxDnAtlasBuild; window._lxDnAtlasBuild = function () { builds++; return ob.apply(this, arguments); };
    const og = window._lxGbAtlasBuild; window._lxGbAtlasBuild = function () { builds++; return og.apply(this, arguments); };
    // DIP: one figure's pop and one sticker's, at the live scale, then through a dip and back
    _lxDnAtlasTrim(1); _LX_DN_ATLAS.clear(); _lxDnAtlasPx = 0;
    const pop = [0.64, 0.8, 0.9, 1.0, 1.12, 1.0], b0 = 27, d = { big: true }, col = '#ff9a3c';
    const ladder = () => { for (const sc of pop) { const px = _lxDnAtlasPx4(b0, sc); _lxDnAtlasBudget = 1; _lxDnAtlasGet(b0, px, b0, d, col, false, true, false, keyDpr()); _lxDnAtlasBudget = 1; _lxGbAtlasGet(b0, px, false, '#ffd84a', false, keyDpr()); } };
    const s0 = _LX_DPR;
    builds = 0; ladder(); out.first = builds;
    _lxApplyRenderScale(Math.max(0.75, s0 - 0.5)); builds = 0; ladder(); out.dip = builds;
    _lxApplyRenderScale(s0); builds = 0; ladder(); out.back = builds;
    window._lxDnAtlasBuild = ob; window._lxGbAtlasBuild = og;
    // STICKY
    out.sticky = { hasFn: typeof _lxDnAtlasDpr === 'function' };
    if (out.sticky.hasFn) { const a = _lxDnAtlasDpr(s0); const b = _lxDnAtlasDpr(Math.max(0.75, s0 - 0.5)); const mapWas = game.currentMap; game.currentMap = '__probe__'; const c = _lxDnAtlasDpr(Math.max(0.75, s0 - 0.5)); game.currentMap = mapWas; _lxDnAtlasDpr(s0); out.sticky = Object.assign(out.sticky, { a, b, c }); }
    // SIZE: an atlas built at 1.5x the live scale, drawn by each blit, against one built at the live scale
    const ink = (fn) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 200); ctx.restore();
      ctx.save(); ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); ctx.translate(100, 70); fn(); ctx.restore();
      const px = ctx.getImageData(0, 0, 400, 200).data; let x0 = 1e9, x1 = -1; for (let y = 0; y < 200; y++) for (let x = 0; x < 400; x++) { const i = (y * 400 + x) * 4; if (px[i] > 120 && px[i + 1] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; } } return x1 >= x0 ? x1 - x0 + 1 : 0; };
    const A1 = _lxDnAtlasBuild(b0, b0, b0, d, col, false, true, false, _LX_DPR), A2 = _lxDnAtlasBuild(b0, b0, b0, d, col, false, true, false, _LX_DPR * 1.5);
    out.size = { live: ink(() => _lxDnAtlasBlit(A1, '888', 1, false, 1)), high: ink(() => _lxDnAtlasBlit(A2, '888', 1, false, 1)) };
    const G1 = _lxGbAtlasBuild(b0, b0, false, '#ffd84a', true, _LX_DPR), G2 = _lxGbAtlasBuild(b0, b0, false, '#ffd84a', true, _LX_DPR * 1.5);
    if (G1 && G2) { out.size.gbLive = ink(() => _lxGbAtlasBlit(G1, '888', 1, false, 1, false)); out.size.gbHigh = ink(() => _lxGbAtlasBlit(G2, '888', 1, false, 1, false)); }
    // LIVE: a fight in the low-effects mode a heavy fight runs in, counting atlas blits that drew
    game.paused = false; player._god = true; player.mp = player.maxMp = 9999; let blits = 0; const obl = window._lxDnAtlasBlit; window._lxDnAtlasBlit = function () { const ok = obl.apply(this, arguments); if (ok) blits++; return ok; };
    const lf = window._perfLowFx; window._perfLowFx = () => true;
    const T = setInterval(() => { try { player.mp = 9999; const m = game.monsters.find((x) => x && x.currentHp > 0); if (m) { player.x = m.x - 120; player.facing = 1; } for (const id of ['slash', 'powerStrike', 'groundSlam', 'rush']) if (!((player.skillCooldowns || {})[id] > 0)) castSkill(id); } catch (e) {} }, 120);
    await W8(3500); clearInterval(T); window._perfLowFx = lf; window._lxDnAtlasBlit = obl; out.liveBlits = blits;
    return out;
  });
  check(r.first > 0 && r.dip === 0 && r.back === 0, 'DIP: a pop\'s figure and sticker atlases are all reused through a governor dip and its return', J({ built: r.first, rebuiltAtDip: r.dip, rebuiltOnReturn: r.back }));
  const S = r.sticky;
  check(S.hasFn && S.b === S.a && S.c < S.a, 'STICKY: the key scale is the map\'s highest; a new map starts from the live one', J(S));
  const Z = r.size;
  check(Z.live > 10 && Math.abs(Z.high - Z.live) <= 2 && (Z.gbLive === undefined || Math.abs(Z.gbHigh - Z.gbLive) <= 2), 'SIZE: an atlas built at 1.5x the live scale draws the same width on screen (figure and sticker blits)', J(Z));
  check(r.liveBlits > 20, 'LIVE: a real fight draws its numbers from atlases', 'atlas blits ' + r.liveBlits);
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
