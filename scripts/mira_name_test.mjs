// Sage Mira's tags read "Mira" once she has told you her name.
//
// Per user: "yes switch her tag to Mira after she tells you". The sage stands at The Gate and at the foot of the
// Interdimensional Ascension as "???" and says her name only on her "Who are you?" page ("Mira. The name will mean
// nothing to you..."). One page, a fresh warrior:
//   1. at The Gate, before she says it: her dialog tag and the plate under her feet read ???;
//   2. the real "Who are you?" button: that page's tag reads Mira while she says it;
//   3. back in the world her plate reads Mira, at The Gate and at the Ascension (where her greeting's tag is Mira too);
//   4. the name rides the save (written, then loaded back), and other NPCs keep their own names.
// The build before fails 5 of the 7 (every check after the first).   node scripts/mira_name_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11771), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 60; }
    player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._gravitosCineSeen = true;
    // every string the canvases draw while recording (the plate under an NPC's feet is canvas text)
    window._drawn = new Set(); window._rec = false;
    for (const P of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D]) {
      if (!P) continue; const of = P.prototype.fillText;
      P.prototype.fillText = function (t, ...a) { if (window._rec) window._drawn.add(String(t)); return of.call(this, t, ...a); };
    }
  });
  const sleep = (ms) => page.waitForTimeout(ms);
  // what her plate draws: record ~1 s of frames with the hero beside her
  const plate = async (map) => page.evaluate(async (map) => {
    const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {}
    if (game.currentMap !== map) { loadMap(map, 400); await sl(1500); }
    const npc = game.mapData.npcs.find((n) => n.role === 'sage');
    player.x = npc.x + 70; player.vx = 0; game.paused = false;
    await sl(400); window._drawn.clear(); window._rec = true; await sl(1000); window._rec = false;
    return { q: window._drawn.has('???'), mira: window._drawn.has('Mira') };
  }, map);
  const tag = () => page.evaluate(() => ({ tag: (document.getElementById('dialog-name') || {}).textContent, text: ((document.getElementById('dialog-text') || {}).textContent || '').slice(0, 40), named: player._miraNamed === true }));

  // 1. before she says it
  const p0 = await plate('wayfarersLantern2');
  await page.evaluate(() => openNPC(game.mapData.npcs.find((n) => n.role === 'sage')));
  await sleep(300);
  const t0 = await tag();
  ok('before she says it, her dialog tag and her plate read ???', t0.tag === '???' && p0.q && !p0.mira, { tag: t0, plate: p0 });

  // 2. "Who are you?" - the page where she says "Mira."
  const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => /Who are you\?/.test(x.textContent || '')); if (b) b.click(); return !!b; });
  await sleep(600);
  const t1 = await tag();
  ok('"Who are you?": the tag reads Mira on the page where she says it', clicked && t1.tag === 'Mira' && /^Mira\./.test(t1.text) && t1.named, { clicked, ...t1 });

  // 3. the plate, at The Gate and at the Ascension
  const p1 = await plate('wayfarersLantern2');
  ok('back in the world, her plate at The Gate reads Mira', p1.mira && !p1.q, p1);
  const p2 = await plate('interdimensionalAscension');
  await page.evaluate(() => openNPC(game.mapData.npcs.find((n) => n.role === 'sage'))); await sleep(300);
  const t2 = await tag();
  ok('at the foot of the Ascension her plate and her greeting\'s tag read Mira too', p2.mira && !p2.q && t2.tag === 'Mira', { plate: p2, tag: t2.tag });

  // 4. the save, and everyone else
  const sv = await page.evaluate(async () => {
    try { closeDialog(); } catch (e) {}
    const listed = PLAYER_SAVE_FIELDS.includes('_miraNamed');
    _flushSaveStateNow(); player._miraNamed = false;
    try { loadState(); } catch (e) { return { listed, err: String(e.message).slice(0, 100) }; }
    await new Promise((r) => setTimeout(r, 800));
    return { listed, afterLoad: player._miraNamed === true };
  });
  ok('the name rides the save (written, then loaded back)', sv.listed && sv.afterLoad === true, sv);
  const others = await page.evaluate(async () => {
    const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { closeAllModals(); } catch (e) {}
    loadMap('shadowWovenHood', 400); await sl(1500);
    openNPC(game.mapData.npcs.find((n) => n.name === 'Ren')); await sl(300);
    const ren = document.getElementById('dialog-name').textContent; closeDialog();
    return { ren, amn: (typeof _lxNpcDisplayName === 'function') ? _lxNpcDisplayName({ name: 'The Amnesiac', role: 'amnesiac' }) : '(no helper)' };
  });
  ok('other NPCs keep their own names', others.ren === 'Ren' && others.amn === 'The Amnesiac', others);
  await ctx.close();
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
