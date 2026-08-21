// The build version reads at the bottom of BOTH the loading screen (front
// page) and the main menu, and always matches the running GAME_VERSION.
// Per user: "ensure in the front page screen and menu the game version is
// indicated at the bottom."
// Run: node scripts/boot_version_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire('C:/Users/dpeh0/Mojiworld/package.json');
const { chromium } = require('playwright-core');
process.chdir('C:/Users/dpeh0/Mojiworld');
const PORT = 9189;
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const srv = spawn(process.execPath, ['serve.js', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const b = await chromium.launch({ channel: 'msedge', headless: true });
const res = []; const ok = (n, c, x) => res.push({ n, pass: !!c, x: String(x ?? '') });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

// ── LOADING SCREEN (front page), sampled early while the bar is still up ────
await p.waitForFunction(() => !!document.getElementById('lo-boot-version'), null, { timeout: 30000 });
await p.waitForTimeout(1500);
const boot = await p.evaluate(() => {
  const el = document.getElementById('lo-boot-version');
  const ov = document.getElementById('loading-overlay');
  const auth = document.getElementById('lo-auth');
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return { text: (el.textContent || '').trim(), opacity: +cs.opacity, display: cs.display,
    bottomGap: +(innerHeight - r.bottom).toFixed(1), centerX: Math.round(r.left + r.width / 2),
    menuUp: ov.classList.contains('menu-up'), authHidden: auth.hasAttribute('hidden'),
    gv: (typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : null };
});
ok('front page: the version line is rendered while the menu is still hidden',
   boot.authHidden === true && !boot.menuUp && boot.display !== 'none', JSON.stringify({ authHidden: boot.authHidden, menuUp: boot.menuUp }));
ok('front page: it is actually VISIBLE (computed opacity > 0.5)', boot.opacity > 0.5, 'opacity ' + boot.opacity);
ok('front page: it shows the running GAME_VERSION', boot.text && boot.text === boot.gv, `"${boot.text}" vs GAME_VERSION ${boot.gv}`);
ok('front page: it sits at the BOTTOM of the screen', boot.bottomGap >= 0 && boot.bottomGap < 40, boot.bottomGap + 'px from the bottom edge');

// ── MAIN MENU ───────────────────────────────────────────────────────────────
await p.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 140000 });
await p.waitForTimeout(1600);
const menu = await p.evaluate(() => {
  const card = document.getElementById('lo-version');
  const bootEl = document.getElementById('lo-boot-version');
  const cc = getComputedStyle(card), bc = getComputedStyle(bootEl);
  const cr = card.getBoundingClientRect();
  const auth = document.getElementById('lo-auth').getBoundingClientRect();
  return { cardText: (card.textContent || '').trim(), cardOpacity: +cc.opacity,
    cardBottomGapInCard: +(auth.bottom - cr.bottom).toFixed(1),
    bootOpacity: +bc.opacity,
    menuUp: document.getElementById('loading-overlay').classList.contains('menu-up'),
    gv: (typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : null };
});
ok('menu: the card version is visible', menu.menuUp && menu.cardOpacity > 0.5, `menuUp=${menu.menuUp} opacity=${menu.cardOpacity}`);
ok('menu: it shows the running GAME_VERSION', menu.cardText === menu.gv, `"${menu.cardText}" vs ${menu.gv}`);
ok('menu: it sits at the BOTTOM of the menu card', menu.cardBottomGapInCard >= 0 && menu.cardBottomGapInCard < 40,
   menu.cardBottomGapInCard + 'px from the card bottom');
ok('menu: the boot line faded out — never two version tags at once', menu.bootOpacity < 0.1, 'boot opacity ' + menu.bootOpacity);

for (const r of res) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.x ? '  (' + r.x + ')' : ''}`);
console.log(`${res.filter(r => r.pass).length}/${res.length} passed`);
await b.close(); srv.kill();
process.exit(res.some(r => !r.pass) ? 1 : 0);
