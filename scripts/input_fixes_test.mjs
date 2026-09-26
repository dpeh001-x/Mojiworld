// Input + audio fixes from the second bug hunt (v0.30.x input-fixes).
//   node scripts/input_fixes_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// 1) the skill pickup refuses E / O / H; 2) and a remapped action's old key; 3) a key pressed plain and released under
// Shift doesn't stick; 4) SFX at 0 plays no footsteps and no dialogue blips; 5) phone: F beside a chest opens it with
// the F skill moved to another key.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11091';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const open = async (vp, map) => {
  const ctx = await browser.newContext({ ...vp, serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof toggleKeybindModal === 'function', null, { timeout: 150000 });
  await p.evaluate(async (map) => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 40;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap(map); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
  }, map);
  return { ctx, p };
};
try {
  const { ctx, p } = await open({ viewport: { width: 1280, height: 720 } }, 'mushroom');
  // 1) + 2) the skill pickup
  const bindTry = async (key) => { await p.evaluate(() => { toggleKeybindModal(); _skillPickup = 'a'; }); await p.keyboard.press(key); await p.waitForTimeout(200); const r = await p.evaluate((k) => !!KEY_TO_SLOT[k === 'Space' ? ' ' : k], key); await p.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; }); return r; };
  const eoh = { e: await bindTry('e'), o: await bindTry('o'), h: await bindTry('h') };
  check(!eoh.e && !eoh.o && !eoh.h, 'a skill can no longer be bound to E, O or H (their own actions fired alongside it)', eoh);
  await p.evaluate(() => { player.actionBinds = Object.assign({}, player.actionBinds || {}, { jump: 'r' }); try { applyKeybinds(); } catch (e) {} });
  const space = await bindTry('Space');
  await p.evaluate(() => { delete player.actionBinds.jump; try { applyKeybinds(); } catch (e) {} });
  check(!space, 'with Jump moved to R, a skill cannot be bound to Space (Jump\'s old key is neutralised, so it could never cast)', { space });

  // 3) Shift-release with a punctuation-bound Move Right
  await p.evaluate(async () => { player.actionBinds = Object.assign({}, player.actionBinds || {}, { moveRight: '.' }); try { applyKeybinds(); } catch (e) {} player.x = 400; player.vx = 0; await new Promise((s) => setTimeout(s, 600)); });
  // a real browser's sequence: '.' goes down plain, Shift goes down, the same physical key comes up as '>' (e.key follows Shift)
  const kev = (type, key, code, shift) => p.evaluate(([type, key, code, shift]) => window.dispatchEvent(new KeyboardEvent(type, { key, code, shiftKey: shift, bubbles: true })), [type, key, code, shift]);
  await kev('keydown', '.', 'Period', false); await p.waitForTimeout(300);
  await kev('keydown', 'Shift', 'ShiftLeft', true); await p.waitForTimeout(150);
  await kev('keyup', '>', 'Period', true); await p.waitForTimeout(100);
  await kev('keyup', 'Shift', 'ShiftLeft', false); await p.waitForTimeout(300);
  const st = await p.evaluate(async () => { const x0 = player.x; await new Promise((s) => setTimeout(s, 900)); return { held: !!(game.keys.arrowright || game.keys['.']), moved: Math.round(player.x - x0) }; });
  await p.evaluate(() => { delete player.actionBinds.moveRight; try { applyKeybinds(); } catch (e) {} game.keys = {}; });
  console.log('shift', JSON.stringify(st));
  check(!st.held && Math.abs(st.moved) < 8, 'releasing a punctuation-bound move key while Shift is down stops the hero (it walked on)', st);

  // 4) SFX at 0: no footsteps, no dialogue blips
  await p.keyboard.press('Shift'); await p.waitForTimeout(200);
  const snd = await p.evaluate(async () => {
    try { if (!audio.ctx) audio.init(); } catch (e) {}
    try { if (audio.ctx && audio.ctx.state !== 'running') await audio.ctx.resume(); } catch (e) {}
    _setSfxMasterVolume(0);
    const hits = [];
    const o = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function (v) { const st = (new Error().stack || ''); if (v > 0.0001 && /_lxSurfaceStep|_twBlip/.test(st)) hits.push((/_twBlip/.test(st) ? 'blip ' : 'step ') + (+v).toFixed(4)); return o.apply(this, arguments); };
    loadMap('town'); await new Promise((s) => setTimeout(s, 1500));
    try { _lxSurfaceStep(1); _lxSurfaceStep(1); } catch (e) {}
    const n = (game.npcs || [])[0]; if (n) { player.x = n.x; openNPC(n); }
    await new Promise((s) => setTimeout(s, 2500));
    try { closeAllModals(); } catch (e) {}
    AudioParam.prototype.setValueAtTime = o;
    return { ctx: audio.ctx && audio.ctx.state, hits: hits.slice(0, 6), n: hits.length };
  });
  console.log('sfx0', JSON.stringify(snd));
  check(snd.ctx === 'running' && snd.n === 0, 'with SFX at 0, footsteps and dialogue blips stay silent (only Mute used to stop them)', snd);
  await ctx.close();

  // 5) phone: F beside a chest with the F skill moved to R
  const P = await open({ viewport: { width: 842, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'mushroom');
  await P.p.evaluate(() => { toggleKeybindModal(); _skillPickup = 'q'; });
  await P.p.keyboard.press('r'); await P.p.waitForTimeout(200);
  await P.p.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  const moved = await P.p.evaluate(() => KEY_TO_SLOT.r === 'q');
  await P.p.evaluate(async () => { for (let i = 0; i < 60 && !(player.onGround && Math.abs(player.vx) < 0.05); i++) await new Promise((s) => setTimeout(s, 50)); game.chests.push({ x: player.x + player.w / 2 - 17, y: player.y + player.h - 30, w: 35, h: 30, opened: false, tier: 'wood', bob: 0 }); game._lastInteractT = 0; });
  await P.p.waitForTimeout(700);
  const fb = await P.p.evaluate(() => { const b = document.querySelector('#mobile-deck [data-dynamic="f-block"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, st: b.dataset.fstate }; });
  if (fb) { await P.p.touchscreen.tap(fb.x, fb.y); await P.p.waitForTimeout(600); }
  const opened = await P.p.evaluate(() => !!(game.chests[game.chests.length - 1] || {}).opened);
  console.log('phone chest', JSON.stringify({ moved, fb, opened }));
  check(moved && fb && fb.st === 'interact' && opened, 'phone: with the F skill moved to R, tapping F beside a chest opens it', { moved, fb, opened });
  await P.ctx.close();
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
