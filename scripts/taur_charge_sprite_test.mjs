#!/usr/bin/env node
// Does Taur charge in his OWN body?
// ============================================================================
// Per user, with a screenshot of Legosaurus wearing Taur's health bar: "Taur is
// using the wrong sprite, taur should be using his own boss sprite".
//
// legosaurusdash is Legosaurus's authored sprint. braceDash is a SHARED engine
// trait, and drawMonster's key picked the dash art on "is something
// brace-dashing" alone:
//
//   const _spriteKey = (m._braceDashing && BOSS_ATTACK_FRAMES.legosaurusdash && …)
//     ? 'legosaurusdash' : …
//
// Taur opts into braceDash for his goring charge, so he inherited another
// boss's body. His own nine charge frames were on disk the whole time and
// unreachable: that key feeds _bossAttackImg, whose branch sits ABOVE the
// zodiac branch that knows about ZODIAC_CHARGE_FRAMES.
//
// This asserts on the BLIT, not on any intermediate flag - hooking _lxDrawSoft
// is the only place the question "whose pixels reached the screen" is actually
// answered. Needs the probe server on :8766 and a staged page to test.
//
//   node scripts/taur_charge_sprite_test.mjs [page] [port]
// ============================================================================
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const PAGE = process.argv[2] || '_taur_probe.html';
const PORT = process.argv[3] || '8766';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!EXE) { console.error('Chrome not found'); process.exit(1); }

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://localhost:${PORT}/${PAGE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof player === 'object', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => {
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal', 'advancement-modal', 'boot-gate', 'intro-overlay'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  game.paused = false; player.level = 90;
  if (typeof refreshGearCache === 'function') refreshGearCache();
  player.hp = getMaxHp(); player._god = true;
  try { loadMap('innerDimension'); } catch (e) {}
});
await page.waitForTimeout(2600);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }

// Record every sprite blitted for the bull, tagged by whether he was charging.
await page.evaluate(() => {
  window.__seen = [];
  const orig = window._lxDrawSoft;
  window._lxDrawSoft = function (ctx, img, dx, dy, w, h) {
    try {
      const m = window.__taur;
      if (m && img && img.src) {
        const f = img.src.slice(img.src.lastIndexOf('/') + 1);
        window.__seen.push({ f, charging: !!m._braceDashing });
      }
    } catch (e) {}
    return orig.apply(this, arguments);
  };
  game.monsters.length = 0;
  const m = spawnMonster(player.x + 420, player.y - 40, 'zodiac_taurus', true);
  window.__taur = m;
});
await page.waitForTimeout(1200);

// Drive the brace-dash directly: the trait's own fields, so this is the real
// state the renderer sees rather than a flag invented by the test.
await page.evaluate(() => {
  const m = window.__taur;
  m._braceDashing = true;
  m._bdPhase = 'dash';
  m._bdVx = 6;
  m.atkAnimUntil = performance.now() + 6000;
});
await page.waitForTimeout(2500);

const R = await page.evaluate(() => {
  const chg = window.__seen.filter((s) => s.charging);
  const names = {};
  for (const s of chg) names[s.f] = (names[s.f] || 0) + 1;
  return { total: window.__seen.length, charging: chg.length, names };
});

// The other half of the fix: narrowing the key must not bench the boss it
// belongs to. Legosaurus still has to sprint in legosaurusdash.
const L = await page.evaluate(async () => {
  window.__seen = [];
  game.monsters.length = 0;
  const m = spawnMonster(player.x + 420, player.y - 40, 'legosaurus', true);
  window.__taur = m;
  await new Promise((r) => setTimeout(r, 900));
  m._braceDashing = true; m._bdPhase = 'dash'; m._bdVx = 6;
  m.atkAnimUntil = performance.now() + 5000;
  await new Promise((r) => setTimeout(r, 2200));
  const chg = window.__seen.filter((s) => s.charging);
  const names = {};
  for (const s of chg) names[s.f] = (names[s.f] || 0) + 1;
  return { charging: chg.length, names };
});
await b.close();

console.log(`  ${R.total} blits recorded, ${R.charging} of them while brace-dashing`);
for (const k of Object.keys(R.names)) console.log(`    ${k}  x${R.names[k]}`);

const files = Object.keys(R.names);
if (!R.charging) { console.error('\n  FAIL — never observed a charging frame; test drove nothing'); process.exit(1); }
const wrong = files.filter((f) => /legosaurus/i.test(f));
const right = files.filter((f) => /taurus/i.test(f));
if (wrong.length) {
  console.error(`\n  FAIL — Taur charged in another boss's body: ${wrong.join(', ')}`);
  process.exit(1);
}
if (!right.length) {
  console.error('\n  FAIL — no taurus art was blitted during the charge');
  process.exit(1);
}
console.log('  ok — Taur charges in his own art, and no legosaurus frame is drawn');

const lFiles = Object.keys(L.names);
console.log(`\n  Legosaurus: ${L.charging} blits while brace-dashing`);
for (const k of lFiles) console.log(`    ${k}  x${L.names[k]}`);
if (!lFiles.some((f) => /legosaurusdash/i.test(f))) {
  console.error('\n  FAIL — narrowing the key benched Legosaurus\'s own dash art');
  process.exit(1);
}
console.log('  ok — Legosaurus still sprints in legosaurusdash');
console.log('\n  PASS');
