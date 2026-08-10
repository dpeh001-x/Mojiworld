// PROLOGUE / GRAVITOS TUTORIAL EXPERIENCE (v0.29.550).
//
// Per user: no low-HP/MP moments, a smooth fight, skippable cutscenes, and no
// lag between the dagger clip and the Gravitos entrance clip. Four fronts:
//  1. Soul Drain honours godmode — it is a CLAMP, not damage, so it bypassed
//     every `player._god` damage guard and set HP→1 / MP→1 mid-tutorial, and
//     nothing ever restored the MP (the tick pinned HP only).
//  2. The prologue tick pins BOTH pools while the god window runs, and the
//     window now covers the whole 30s memory (45s, superseding v0.29.108).
//  3. Every prologue cutscene (dagger, entry, punch, void, stanzas) exposes a
//     Skip control and finishes on Escape.
//  4. The entrance clip is preloaded at prologue start and its buffered
//     element adopted by the cutscene, killing the black cold-fetch gap.
// Run: node scripts/prologue_pleasant_test.mjs [game-file]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv[2] || 'mojiworld_game.html';
let bad = 0;
const check = (c, n, extra) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${!c && extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 140) : ''}`); if (!c) bad++; };

// ---- source-level assertions (closures the page can't reach) --------------
const src = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
console.log('source:');
check(src.includes('_prologueGodUntil = Date.now() + 45000'), 'the god window covers the whole memory (45s)');
check(src.includes("player.hp = getMaxHp(); player.mp = getMaxMp();"), 'the tick pins BOTH pools');
check(src.includes('window._prologueEntryPreload = _pv'), 'the entrance clip preloads at prologue start');
check(src.includes('clip_prologue_punch.mp4') && src.match(/_wv\.preload = 'auto'/), 'the end-of-memory clips warm during the fight');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto('file:///' + path.join(ROOT, FILE).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof bossAI === 'function' && typeof _gravitosEntryCutscene === 'function' && game.mapData, { timeout: 60000 });

// ---- 1. Soul Drain vs godmode --------------------------------------------
const drain = await page.evaluate(() => {
  const t = monsterTypes.gravitos;
  const mk = () => ({ type: 'gravitos', isBoss: true, x: 600, y: 200, w: t.w, h: t.h, facing: 1,
    hp: t.hp, maxHp: t.hp, currentHp: t.hp, atk: t.atk, def: t.def, vx: 0, vy: 0, phase: 1,
    patternState: 'soulDrain', patternTimer: 1600, _drainAnnounced: true,
    _soulTimer: 99999, _instaTimer: 99999, _rainTimer: 99999, _warpTimer: 99999,
    _lastSkillAt: 0, _lastOhkoAt: 0 });
  player.x = 640; player.y = 400;
  const hpMax = getMaxHp(), mpMax = getMaxMp();
  // god ON: pools must survive the resolve untouched
  player._god = true; player.hp = hpMax; player.mp = mpMax;
  bossAI(mk(), 16.7, 300);
  const god = { hp: player.hp, mp: player.mp };
  // god OFF: the mortal clamp must still bite (the real endgame fight)
  player._god = false; player.hp = hpMax; player.mp = mpMax;
  bossAI(mk(), 16.7, 300);
  const mortal = { hp: player.hp, mp: player.mp };
  player.hp = hpMax; player.mp = mpMax;
  return { god, mortal, hpMax, mpMax };
});
console.log('\nsoul drain:');
check(drain.god.hp === drain.hpMax && drain.god.mp === drain.mpMax, 'godmode keeps HP and MP untouched through the drain', drain.god);
check(drain.mortal.hp === 1 && drain.mortal.mp === 1, 'the mortal clamp still bites outside godmode', drain.mortal);

// ---- 2. the tick pins both pools -----------------------------------------
const tick = await page.evaluate(() => {
  window._prologueActive = true;
  window._prologueGodUntil = Date.now() + 45000;
  window._prologueLeftMs = 30000; window._prologueLastTick = Date.now() - 250;
  player._god = false; player.hp = 5; player.mp = 1;
  _prologueTick();
  const r = { god: player._god, hp: player.hp, mp: player.mp, hpMax: getMaxHp(), mpMax: getMaxMp() };
  window._prologueActive = false; window._prologueGodUntil = 0; player._god = false;
  clearInterval(window._prologueTimer);
  player.hp = r.hpMax; player.mp = r.mpMax;
  const hud = document.getElementById('prologue-hud'); if (hud) hud.remove();
  return r;
});
console.log('\nprologue tick:');
check(tick.god === true, 'godmode is re-asserted each tick');
check(tick.hp === tick.hpMax && tick.mp === tick.mpMax, 'a drained HP 5 / MP 1 is restored to full within one tick', tick);

// ---- 3. every cutscene is skippable --------------------------------------
console.log('\ncutscenes:');
for (const [label, fn, skipSel] of [
  ['dagger', '_prologueDaggerCutscene', '#plg-dagger-skip'],
  ['gravitos entry', '_gravitosEntryCutscene', '#grav-entry-skip'],
  ['punch', '_prologuePunchCutscene', '#plg-punch-skip'],
  ['void', '_prologueVoidCutscene', '#plg-void-skip'],
]) {
  const r = await page.evaluate(async ({ fn, skipSel }) => {
    window._cbFired = false;
    window[fn](() => { window._cbFired = true; });
    await new Promise((r2) => setTimeout(r2, 250));
    const hasSkip = !!document.querySelector(skipSel);
    const hasVideo = !!document.querySelector('video[id$="-vid"]');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r2) => setTimeout(r2, 150));
    const overlayGone = !document.querySelector(skipSel);
    return { hasSkip, hasVideo, cb: window._cbFired, overlayGone };
  }, { fn, skipSel });
  check(r.hasSkip && r.cb && r.overlayGone, `${label}: skip button present, Escape finishes, overlay torn down`, r);
}
// stanza overlay: its skip button aborts the whole prologue
const stz = await page.evaluate(async () => {
  window._sk = null;
  _prologueOverlay(['LINE ONE', 'LINE TWO'], (skipped) => { window._sk = skipped; });
  await new Promise((r2) => setTimeout(r2, 200));
  const btn = document.getElementById('plg-skip');
  const has = !!btn;
  if (btn) btn.click();
  await new Promise((r2) => setTimeout(r2, 150));
  return { has, skipped: window._sk, gone: !document.getElementById('plg-skip') };
});
check(stz.has && stz.skipped === true && stz.gone, 'stanzas: Skip prologue button fires onDone(skipped) and tears down', stz);

// ---- 4. the entrance clip adopts the preloaded element --------------------
const pre = await page.evaluate(async () => {
  const marker = document.createElement('video');
  marker.setAttribute('data-preloaded', '1');
  marker.src = 'steam/higgsfield/cinematics/clip_gravitos_entry.mp4';
  window._prologueEntryPreload = marker;
  window._cb2 = false;
  _gravitosEntryCutscene(() => { window._cb2 = true; });
  await new Promise((r2) => setTimeout(r2, 250));
  const vid = document.getElementById('grav-entry-vid');
  const adopted = !!(vid && vid.getAttribute('data-preloaded') === '1');
  const consumed = window._prologueEntryPreload === null;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise((r2) => setTimeout(r2, 150));
  // fallback: no preload → the cutscene still builds its own video
  window._cb3 = false;
  _gravitosEntryCutscene(() => { window._cb3 = true; });
  await new Promise((r2) => setTimeout(r2, 250));
  const fallbackVid = !!document.getElementById('grav-entry-vid');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise((r2) => setTimeout(r2, 150));
  return { adopted, consumed, cb: window._cb2, fallbackVid, cb3: window._cb3 };
});
console.log('\nentrance-clip preload:');
check(pre.adopted, 'the cutscene adopts the preloaded (buffered) element', pre);
check(pre.consumed, 'the preload handle is consumed exactly once');
check(pre.fallbackVid && pre.cb3, 'with no preload it still builds its own video (fail-open)');

console.log(errs.length ? '\npage errors: ' + errs.slice(0, 3).join(' | ') : '\nno page errors');
console.log(bad ? `\n${bad} check(s) failed` : '\nall good — no drain through godmode, both pools pinned, every cutscene skippable, entrance clip preloaded');
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
