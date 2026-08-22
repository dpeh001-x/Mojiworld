#!/usr/bin/env node
// Capture real Mojiworld gameplay as video for the promo cut.
// Playwright's recordVideo grabs the live canvas at a true 25 fps — a
// screenshot loop stutters and lies about pacing, which a promo cannot afford.
//
// Recording starts when the CONTEXT is created, and the game's asset load runs
// ~30 s, so every clip opens on the loading screen. Rather than fight that, the
// script writes a sidecar .json with the exact offset at which gameplay begins;
// the edit trims from there.
//
// SKILL KEYS are the real bindings (KEY_TO_SLOT_DEFAULT), not guesses:
//   z basic · x skill2 · s skill3 · c skill4 · d skill5
//   f job signature · v job ultimate · g master signature · b master ultimate
// (q/m are the QUEST JOURNAL and MAP — pressing them opens UI over the shot.)
//
//   node scripts/promo_capture.mjs <shot> [outDir]
// shots: combat | boss | traverse | arena
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const SHOT = process.argv[2] || 'combat';
const OUT = (process.argv[3] || 'C:/Users/dpeh0/AppData/Local/Temp/claude/promo/raw') + '/' + SHOT;
mkdirSync(OUT, { recursive: true });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT; for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));

const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
         '--force-device-scale-factor=1'] });
const T_CTX = Date.now();
const ctx = await b.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof player === 'object', null, { timeout: 180000 });
await page.waitForLoadState('load', { timeout: 240000 }).catch(() => {});
// Wait for the real "assets are in" signal rather than a fixed sleep: the
// loading overlay fades itself out when the boot pipeline finishes.
await page.waitForFunction(() => {
  const el = document.getElementById('loading-overlay');
  if (!el) return true;
  const cs = getComputedStyle(el);
  return el.classList.contains('fade') || cs.display === 'none' || Number(cs.opacity) < 0.05;
}, null, { timeout: 240000 }).catch(() => {});
await page.waitForTimeout(2500);

const CAST = SHOT === 'traverse'
  ? { cls: 'rogue', job: 'ninja', master: 'shadowlord' }
  : { cls: 'mage', job: 'archmage', master: 'elementalist' };

await page.evaluate((cls) => {
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal', 'advancement-modal', 'boot-gate', 'intro-overlay']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  // hide UI chrome the promo should not show
  const css = document.createElement('style');
  css.textContent = `#toast-host,.toast,#first-time-tip,#hotkey-hint,#quest-hud,#minimap,
    #version-badge,#fps-meter,.moji-toast,#tip-bar{display:none !important;}`;
  document.head.appendChild(css);
  game.paused = false;
  player.cls = cls.cls; player.job = cls.job; player.master = cls.master;
  player.level = 75;
  player.talents = player.talents || {}; player.talents[cls.job] = player.talents[cls.job] || null;
  player.skillCooldowns = {}; player._castLockUntil = 0;
  if (typeof refreshGearCache === 'function') refreshGearCache();
  player.hp = (typeof getMaxHp === 'function') ? getMaxHp() : 9999;
  player.mp = 999999;
  player._god = true;                        // the promo never shows a death
}, CAST);

const tap = async (k, ms = 80) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const hold = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const wait = (ms) => page.waitForTimeout(ms);
const topUp = () => page.evaluate(() => { player.mp = 999999; player.skillCooldowns = {}; player.hp = getMaxHp(); player._god = true; });
const pack = (n, type, spread = 95) => page.evaluate(({ n, type, spread }) => {
  for (let i = 0; i < n; i++) { try { spawnMonster(player.x + 240 + i * spread, player.y - 30, type, false); } catch (e) {} }
}, { n, type, spread });
// Entering a map can fire a STORY BEAT ("ACT IV — THE SUNDERED DEEP", press
// Enter to continue) which swallows every subsequent keypress — the first
// capture pass recorded four minutes of story cards instead of combat. Mark
// the beats seen, then mash Enter to clear anything already on screen.
const goMap = async (m) => {
  await page.evaluate((m) => {
    try {
      player._storyBeatsSeen = player._storyBeatsSeen || {};
      if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    } catch (e) {}
    try { loadMap(m); } catch (e) {}
  }, m);
  await wait(2400);
  for (let i = 0; i < 6; i++) { await tap('Enter', 60); await wait(220); }
  await wait(600);
  await page.evaluate(() => {
    game.monsters.length = 0;
    // any beat/overlay still mounted gets hidden outright
    document.querySelectorAll('.lx-ending-card, #story-beat, .story-beat, #map-title').forEach(e => { e.style.display = 'none'; });
  });
  await topUp();
};

// ---- gameplay begins here; everything before this is load + setup ----------
const T0 = Date.now();

if (SHOT === 'combat') {
  await goMap('forest');
  await pack(6, 'slime');
  await wait(600);
  for (let i = 0; i < 6; i++) { await tap('z', 60); await wait(95); }   // bolt burst on contact
  await tap('x', 80); await wait(850);                                   // fireball
  await pack(5, 'mushroom');
  await tap('s', 80); await wait(750);                                   // ice spike
  await topUp();
  await tap('f', 80); await wait(1300);                                  // meteor
  await topUp();
  await tap('g', 80); await wait(2100);                                  // prismatic cascade
  await topUp();
  await pack(6, 'slime');
  await wait(400);
  await hold('b', 1700); await wait(2800);                               // apotheosis
  await wait(700);
} else if (SHOT === 'boss') {
  await goMap('gravitosArena');
  await page.evaluate(() => {
    game.monsters.length = 0;
    try { spawnMonster(player.x + 430, player.y - 140, 'gravitos', true); } catch (e) {}
  });
  await topUp();
  await wait(2200);
  for (let i = 0; i < 5; i++) { await tap('z', 60); await wait(130); }
  await topUp();
  await tap('f', 80); await wait(1500);
  await topUp();
  await tap('g', 80); await wait(1900);
  await topUp();
  await hold('b', 1700); await wait(3200);
} else if (SHOT === 'traverse') {
  await goMap('skyGarden');
  await wait(600);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.down('ArrowRight');
    await tap('c', 70);                       // rogue dash -> ghost afterimages
    await wait(480);
    await tap(' ', 60);
    await wait(400);
    await page.keyboard.up('ArrowRight');
    await wait(180);
  }
  await topUp();
  await pack(4, 'slime', 80);
  await wait(400);
  await tap('g', 80); await wait(1800);
} else if (SHOT === 'arena') {
  await goMap('gravitosArena');
  await page.evaluate(() => {
    game.monsters.length = 0;
    const pads = (game.mapData && game.mapData.launchPads) || [];
    if (pads[0]) { player.x = pads[0].x - 150; player.y = pads[0].y - player.h - 2; }
  });
  await wait(1000);
  await page.keyboard.down('ArrowRight');
  await wait(1400);
  await page.keyboard.up('ArrowRight');
  await wait(2800);
}

const OFFSET = T0 - T_CTX;
await wait(800);
await ctx.close();     // flushes the webm
await b.close(); srv.kill();
const vid = readdirSync(OUT).find(f => f.endsWith('.webm'));
writeFileSync(OUT + '/meta.json', JSON.stringify({ shot: SHOT, video: vid, gameplayStartMs: OFFSET }, null, 1));
console.log(`shot=${SHOT} file=${vid} gameplayStartsAt=${(OFFSET / 1000).toFixed(1)}s`);
