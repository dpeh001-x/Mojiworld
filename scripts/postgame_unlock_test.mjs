// Dawn's Favor - what finishing the story unlocks (v0.30.803) - and the Titles panel that carries it. The aura is
// painted art since v0.30.813 (scripts/gen_everdawn_aura.mjs).
// One character is measured before and after it holds the Conqueror title (what a finished save looks like):
// coins and kill EXP must pay exactly +10%, the aura must draw and switch off, titles must be choosable, the
// credits must lead into the panel, and the U panel must offer it. Nothing may change for an unfinished save.
//
//   [SERVE_ROOT=<dir with serve.js + data/ + art>] node scripts/postgame_unlock_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11108';
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof killMonster === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    try { _playStoryBeat = function () { return false; }; } catch (e) {}   // a fresh character's story beats would own the pause
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(1500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    player.cls = 'warrior'; player._god = true; player.level = 50; player.expToNext = 1e15; player.titles = {}; player.equippedTitle = '';
    player._storyBeatsSeen = {}; delete player._dawnFavorSeen; delete player.dawnAuraOff;
    const out = { ver: GAME_VERSION, has: typeof _lxStoryComplete === 'function' && typeof openTitlesPanel === 'function' && typeof drawDawnAura === 'function' };
    if (!out.has) return out;
    const coins = () => { const b = player.mojicoins || 0; _grantMojicoins(100000, { full: true }); return (player.mojicoins || 0) - b; };
    const killExp = () => {
      game.monsters.length = 0; game.comboMult = 1; if (player.buffs) player.buffs.comboXp = 0;
      const m = spawnMonster(player.x + 120, player.y - 10, 'slime', false); m.exp = 1000000; m.level = player.level;
      const ks = (typeof _ksXpMul === 'function') ? _ksXpMul() : 1, b = player.exp; killMonster(m); return (player.exp - b) / ks;
    };
    // one drawDawnAura() call, counted: painted layers are drawImage calls, the stand-in crown is nine strokes
    const layers = () => { let st = 0, im = 0; const alphas = []; const os = ctx.stroke, oi = ctx.drawImage; ctx.stroke = function () { st++; return os.apply(this, arguments); }; ctx.drawImage = function () { im++; alphas.push(+ctx.globalAlpha.toFixed(3)); return oi.apply(this, arguments); };
      try { drawDawnAura(); } finally { ctx.stroke = os; ctx.drawImage = oi; } return { strokes: st, images: im, alphas }; };
    const strokes = () => layers().strokes;
    // ---- an unfinished save ----
    out.before = { done: _lxStoryComplete(), coins: coins(), exp: killExp(), strokes: strokes(), seen: !!player._dawnFavorSeen };
    const hush = () => { for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } };
    hush();   // a fresh character's first-kill story beat would otherwise own the pause
    openTitlesPanel();
    out.panelBefore = { rows: document.querySelectorAll('#titles-modal .tt-row').length, locked: document.querySelectorAll('#titles-modal .tt-row.locked').length,
      favorLocked: !!document.querySelector('#titles-modal .tt-favor.locked'), toggle: !!document.getElementById('tt-aura'), paused: game.paused };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    out.escCloses = !document.getElementById('titles-modal') && game.paused === false;
    // ---- the same character, holding the title a Gravitos kill grants ----
    player.titles[LX_TITLE_CONQUEROR] = true; player.titles['Echo Walker'] = true; player.equippedTitle = LX_TITLE_CONQUEROR;
    await sleep(900);                                                     // a few frames: the one-time notice
    out.after = { done: _lxStoryComplete(), coins: coins(), exp: killExp(), strokes: strokes(), seen: !!player._dawnFavorSeen,
      toast: /Dawn's Favor/.test(document.body.innerText) };
    // v0.30.813 - the painted aura: wait for its art, then count the layers; blank the art to see the stand-in
    for (let i = 0; i < 150 && !(LX_DAWN_ART.frames && LX_DAWN_ART.halo.naturalWidth && LX_DAWN_ART.sigil.naturalWidth && LX_DAWN_ART.frames.every((f) => f.naturalWidth)); i++) await sleep(100);
    out.artReady = !!(LX_DAWN_ART.frames && LX_DAWN_ART.frames.every((f) => f.naturalWidth > 0) && LX_DAWN_ART.halo.naturalWidth > 0 && LX_DAWN_ART.sigil.naturalWidth > 0);
    out.painted = layers();
    // v0.30.817 - translucent: every painted layer is see-through, and the wings' cross-fade holds its cover between frames
    { const A = LX_DAWN_WINGS_ALPHA, p = LX_DAWN_XFADE_P; const cover = [0, 0.25, 0.5, 0.75, 1].map((f) => 1 - (1 - A * Math.pow(1 - f, p)) * (1 - A * Math.pow(f, p)));
      out.sheer = { wings: A, halo: LX_DAWN_HALO_ALPHA, sigil: LX_DAWN_SIGIL_ALPHA, maxDrawn: Math.max.apply(null, out.painted.alphas), cover: cover.map((c) => +c.toFixed(3)) }; }
    const keepHalo = LX_DAWN_ART.halo; LX_DAWN_ART.halo = new Image(); out.standIn = layers(); LX_DAWN_ART.halo = keepHalo;
    player.dawnAuraOff = true; out.off = layers(); out.offStrokes = out.off.strokes; player.dawnAuraOff = false;
    // motes are particles, and particles live in WORLD x: scroll the camera and see where they are born
    loadMap('forest', 1500); await sleep(1500); hush(); game.paused = false;
    const born = (emit) => { const n0 = game.particles.length; emit(); return game.particles.slice(n0).filter((p) => !p.text); };
    const wx = () => player.x + player.w / 2;
    const motes = born(() => { for (let k = 0; k < 18; k++) { game.time = (game.time | 0) + 1; drawDawnAura(); } });
    out.motes = { camX: game.camera.x, n: motes.length, worstDx: motes.reduce((m, p) => Math.max(m, Math.abs(p.x - wx())), 0) };
    const ember = Object.keys(SETS).find((k) => SETS[k].aura && SETS[k].aura.shape === 'ember');
    const keepSets = player._activeFullSetsCache; player._activeFullSetsCache = [ember];
    const embers = born(() => { game.time = 8 * Math.ceil(((game.time | 0) + 1) / 8); drawSetAura(); });
    player._activeFullSetsCache = keepSets;
    out.embers = { set: ember, n: embers.length, worstDx: embers.reduce((m, p) => Math.max(m, Math.abs(p.x - wx())), 0) };
    openTitlesPanel();
    const rowOf = (t) => [...document.querySelectorAll('#titles-modal .tt-row')].find((b) => b.getAttribute('data-title') === t);
    out.panelAfter = { conquerorWorn: rowOf(LX_TITLE_CONQUEROR).classList.contains('on'), echoLocked: rowOf('Echo Walker').classList.contains('locked'),
      twinLocked: rowOf('Twin Star').classList.contains('locked'), toggle: !!document.getElementById('tt-aura') };
    rowOf('').click(); await sleep(400); out.noTitle = { eq: player.equippedTitle, hud: getComputedStyle(document.getElementById('hud-player-title')).display };
    rowOf('Twin Star').click(); out.lockedClick = player.equippedTitle;
    rowOf('Echo Walker').click(); await sleep(400); out.echo = { eq: player.equippedTitle, hud: document.getElementById('hud-player-title').textContent };
    document.getElementById('tt-aura').click(); out.toggledOff = player.dawnAuraOff === true;
    document.getElementById('tt-close').click();
    if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow();   // saveState() itself is debounced
    let saved = ''; for (let i = 0; i < localStorage.length; i++) { const v = localStorage.getItem(localStorage.key(i)) || ''; if (v.includes('dawnAuraOff')) saved = v; }
    out.persisted = /"dawnAuraOff":true/.test(saved) && /"_dawnFavorSeen":true/.test(saved) && /"equippedTitle":"Echo Walker"/.test(saved);
    // ---- the credits lead into the panel ----
    _showGameComplete(); await sleep(300); document.getElementById('gc-close').click(); await sleep(2200);
    out.credits = { fresh: !!document.querySelector('#titles-modal .tt-fresh'), paused: game.paused };
    const x = document.getElementById('tt-close'); if (x) x.click();
    return out;
  });
  console.log('build ' + r.ver);
  check(r.has, 'the build has Dawn\'s Favor and the Titles panel');
  if (r.has) {
    const cr = r.after.coins / r.before.coins, er = r.after.exp / r.before.exp;
    check(!r.before.done && r.before.strokes === 0 && !r.before.seen, 'an unfinished save: no favor, no aura, no notice', JSON.stringify(r.before));
    check(r.panelBefore.rows >= 13 && r.panelBefore.locked === r.panelBefore.rows - 1 && r.panelBefore.favorLocked && !r.panelBefore.toggle && r.panelBefore.paused,
      'Titles panel before the ending: every title listed as a goal, Dawn\'s Favor shown locked', JSON.stringify(r.panelBefore));
    check(r.escCloses, 'Escape closes the panel and releases the pause');
    check(r.after.done && Math.abs(cr - 1.10) < 0.0005, 'a finished save earns exactly +10% Mojicoins', `${r.before.coins} -> ${r.after.coins} (x${cr.toFixed(4)})`);
    check(Math.abs(er - 1.10) < 0.0005, 'and exactly +10% EXP from a kill', `${r.before.exp} -> ${r.after.exp} (x${er.toFixed(4)})`);
    check(r.artReady && r.painted.images >= 4 && r.painted.strokes === 0, 'the Everdawn Aura is painted: halo, wings (cross-faded, with bloom) and sigil are drawn as art', JSON.stringify(r.painted));
    check(r.sheer.maxDrawn <= 0.62 && r.sheer.wings <= 0.6 && r.sheer.halo <= 0.6 && r.sheer.sigil <= 0.6 && r.sheer.cover.every((c) => Math.abs(c - r.sheer.wings) <= 0.02),
      'the aura is translucent: no layer is drawn above 62% and the wings hold their cover through the cross-fade', JSON.stringify(r.sheer));
    check(r.standIn.strokes === 9 && r.standIn.images === 0, 'until the art has decoded the nine-ray stand-in is drawn instead', JSON.stringify(r.standIn));
    check(r.off.strokes === 0 && r.off.images === 0, 'switched off, nothing is drawn', JSON.stringify(r.off));
    check(r.motes.camX > 500 && r.motes.n >= 2 && r.motes.worstDx <= 45, 'with the camera scrolled, motes are born at the hero (world x), not at the screen x', JSON.stringify(r.motes));
    check(r.embers.n >= 1 && r.embers.worstDx <= 30, 'and so are the embers of the set-bonus aura (they used the screen x)', JSON.stringify(r.embers));
    check(r.after.seen && r.after.toast, 'a save that finished before this build is told once', JSON.stringify({ seen: r.after.seen, toast: r.after.toast }));
    check(r.panelAfter.conquerorWorn && !r.panelAfter.echoLocked && r.panelAfter.twinLocked && r.panelAfter.toggle, 'Titles panel after: earned titles wearable, unearned locked, aura switch present', JSON.stringify(r.panelAfter));
    check(r.noTitle.eq === '' && r.noTitle.hud === 'none' && r.lockedClick === '' && r.echo.eq === 'Echo Walker' && /ECHO WALKER/.test(r.echo.hud), 'choosing: no title hides the HUD line, a locked row does nothing, an earned one is worn', JSON.stringify({ n: r.noTitle, l: r.lockedClick, e: r.echo }));
    check(r.toggledOff && r.persisted, 'the aura switch and the chosen title are saved');
    check(r.credits.fresh && r.credits.paused, 'closing the credits opens the panel with the unlocked banner', JSON.stringify(r.credits));
  }
  // the U panel offers it, and the L button is called what its panel is called
  await page.evaluate(() => { game.paused = false; }); await page.keyboard.press('u'); await page.waitForTimeout(900);
  const u = await page.evaluate(() => { const row = document.getElementById('u-jump-row'); const t = row && row.querySelector('[data-ujump="titles"]');
    const lbl = row ? row.textContent.replace(/\s+/g, ' ') : ''; if (t) t.click(); return { lbl, opened: !!document.getElementById('titles-modal') }; });
  check(/Compendium L/.test(u.lbl) && !/MojiDex L/.test(u.lbl) && u.opened, 'U panel: the L button says Compendium, and Titles opens the panel', u.lbl);
  const art = ['Sprites/fx/dawn_halo.webp', 'Sprites/fx/dawn_sigil.webp', 'Sprites/fx/dawn_aura.webp']; for (let i = 0; i < 9; i++) art.push('Sprites/fx/anim/dawn_aura_' + i + '.webp');
  const served = await page.evaluate(async (list) => { const bad = []; for (const u of list) { try { const r = await fetch(u); if (!r.ok || !/webp/.test(r.headers.get('content-type') || '')) bad.push(u + ' ' + r.status); } catch (e) { bad.push(u + ' ' + e.message); } } return bad; }, art);
  check(served.length === 0, 'all 12 aura files are served as WebP', served.slice(0, 3).join(' | '));
  check(!errs.length, 'no page errors', errs.slice(0, 2).join(' | '));
} catch (e) { check(false, 'harness error', String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
