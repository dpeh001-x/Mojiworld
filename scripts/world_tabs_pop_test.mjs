// THE IN-WORLD TABS, POP PUNK (v0.30.1197). Per user, with a screenshot of the "[up] Return" prompt: "work on these tabs
// NPC Return Etc similar tabs to make it more POP PUNK styled". Read from pixels and draw calls in the running game:
//   - PILL: the one interact prompt (portal Enter / Return, NPC Talk, chest Open) has a butter keycap, a hard ink offset
//     and a body that is still translucent
//   - PORTAL: the destination plate is a paper sticker (cream plate, ink offset)
//   - NPC: the name tag's name is outlined in ink (strokeText) and filled butter
//   - PLAYER: the hero's own tag carries the same hard ink offset
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/world_tabs_pop_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12364';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxPromptPill === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 40;
    await document.fonts.load('900 11px Nunito');
    const px = (g, x, y) => Array.from(g.getImageData(Math.round(x), Math.round(y), 1, 1).data);
    const near = (p, rgb, tol = 24) => rgb.every((v, i) => Math.abs(p[i] - v) <= tol);
    const out = {};
    // PILL, drawn on a clear offscreen canvas
    const c = document.createElement('canvas'); c.width = 240; c.height = 60; const g = c.getContext('2d');
    _lxPromptPill(g, 120, 28, 'N', 'Talk', { tint: '#88aaff' });
    const m = _lxPromptMetrics(g, 'N', 'Talk'); const x0 = Math.round(120 - m.w / 2), y0 = Math.round(28 - m.h / 2);
    const capC = px(g, x0 + _LX_PROMPT_PAD - 1 + 3, y0 + m.h / 2 - 5);      // inside the keycap, clear of the glyph
    const off = px(g, x0 + m.w / 2, y0 + m.h + 1);                          // the offset's crescent, under the body's middle
    const body = px(g, x0 + m.w - 5, y0 + m.h / 2);                         // the body between the verb's end and the tint ring
    out.pill = { cap: capC, off, body, capButter: near(capC, [255, 224, 122]), offInk: near(off, [13, 10, 20], 12) && off[3] > 240, bodyAlpha: body[3] };
    // PORTAL: stand at a portal so its label bakes
    loadMap('sunsetBeach', 300); await W8(1200); try { closeAllModals(); } catch (e) {} game.paused = false;
    const po = game.portals[0]; const fy = (typeof po.y === 'number') ? po.y : 480;
    player.x = po.x - player.w / 2; player.y = fy - player.h; await W8(1200);
    if (po._lblSprite) {
      const lg = po._lblSprite.getContext('2d'), S = po._lblS || 1;
      // scan the plate's rows: the plate is cream (row 4, above the lettering) and its offset shows as ink below it (row 21)
      const row = (y) => { const d = lg.getImageData(0, Math.round(y * S), po._lblSprite.width, 1).data; const out2 = []; for (let i = 0; i < d.length; i += 4) out2.push([d[i], d[i + 1], d[i + 2], d[i + 3]]); return out2; };
      const creamN = row(4.5).filter((p) => near(p, [244, 241, 234], 20) && p[3] > 240).length;
      const inkN = row(21).filter((p) => near(p, [13, 10, 20], 14) && p[3] > 240).length;
      out.portal = { creamPx: creamN, inkPx: inkN, cream: creamN >= 40 * S, ink: inkN >= 30 * S };
    } else out.portal = { baked: false };
    // NPC: record the text strokes of a few frames in town
    loadMap('town', 300); await W8(1200); try { closeAllModals(); } catch (e) {} game.paused = false;
    const strokes = []; const _st = CanvasRenderingContext2D.prototype.strokeText;
    CanvasRenderingContext2D.prototype.strokeText = function (t) { strokes.push(String(t)); return _st.apply(this, arguments); };
    await W8(900); CanvasRenderingContext2D.prototype.strokeText = _st;
    const names = game.npcs.filter((n) => Math.abs(n.x - (game.camera.x + W / 2)) < W / 2).map((n) => n.name);
    out.npc = { onScreen: names, stroked: names.filter((n) => strokes.includes(n)) };
    // PLAYER: the tag bake carries the ink offset under its right end
    const pc = (typeof _playerNameTagCache !== 'undefined') && _playerNameTagCache.cv;
    if (pc) { const pg = pc.getContext('2d'), s2 = pc.width / (_playerNameTagCache.lw || 1); out.player = { off: px(pg, (_playerNameTagCache.tw / 2) * s2, 14.8 * s2) }; out.player.ink = near(out.player.off, [13, 10, 20], 14) && out.player.off[3] > 120; }
    else out.player = { baked: false };
    return out;
  });
  check(r.pill.capButter && r.pill.offInk && r.pill.bodyAlpha >= 170 && r.pill.bodyAlpha <= 225, 'PILL: a butter keycap, a hard ink offset, and a body still translucent (the world reads through it)', J(r.pill));
  check(r.portal.cream && r.portal.ink, 'PORTAL: the destination plate is a paper sticker with an ink offset', J(r.portal));
  check(r.npc.onScreen.length > 0 && r.npc.stroked.length === r.npc.onScreen.length, 'NPC: every on-screen NPC\'s name is outlined in ink', J(r.npc));
  check(!!r.player.ink, 'PLAYER: the hero\'s own tag carries the hard ink offset', J(r.player));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
