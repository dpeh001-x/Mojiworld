// FLYING MONSTERS DAMAGE YOU WHERE THEIR SPRITE IS
// ============================================================================
// Per user: "ensure that all flying monsters does damage when the monster sprite touches me".
//
// Contact damage tested the AUTHORED box (aabb(player, m)) while the sprite is drawn foot-anchored
// at m._visW x m._visH — a much bigger rectangle. 13 of the 14 flying types draw a sprite more than
// 25% larger than the box that can hurt you (towerWisp 33x37 drawn at 81x81), so their bodies could
// overlap the player and pass through.
//
// _mobTouchBox unions the authored box with _atkMonBox — the very rectangle the player's own attacks
// already use — so what can hit you is what you can hit.
//
// What this pins, for EVERY flying type rather than a sample:
//   1. the touch box covers the drawn sprite's central 90%, which is where the art is;
//   2. it is never smaller than the authored box, so nothing that lands today stops landing;
//   3. end to end, standing on the sprite but outside the old box now takes damage;
//   4. standing clear of the sprite still takes none — the box did not simply become huge;
//   5. ground monsters are untouched.
// Run: node scripts/flying_contact_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9772);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Fly');
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 60; loadMap('forest', 300); });
await page.waitForTimeout(5000);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
  try { _lxCineHold(0); } catch (e) {}
  game.paused = false;
  const out = { rows: [], live: [] };
  out.hasFn = typeof _mobTouchBox === 'function';
  const types = Object.keys(monsterTypes || {});
  const fliers = types.filter((t) => monsterTypes[t] && monsterTypes[t].flies === true);
  const ground = types.filter((t) => monsterTypes[t] && !monsterTypes[t].flies).slice(0, 6);

  const measure = async (t) => {
    game.monsters.length = 0;
    player._god = true; player.x = 700; player.y = 300;
    let m = null;
    try { m = spawnMonster(player.x + 220, player.y - 60, t, false); } catch (e) {}
    if (!m) return null;
    m.vx = 0; m.vy = 0;
    for (let i = 0; i < 40 && !(m._visW > 0); i++) await sleep(50);
    if (!m._visW) return null;
    const tb = (typeof _mobTouchBox === 'function') ? _mobTouchBox(m) : { x: m.x, y: m.y, w: m.w, h: m.h };
    // where the art actually is: foot-anchored from m.y+m.h, central 90%
    const artW = m._visW * 0.9, artH = m._visH * 0.9;
    const artCx = m.x + m.w / 2, artCy = (m.y + m.h) - m._visH / 2;
    const art = { x: artCx - artW / 2, y: artCy - artH / 2, w: artW, h: artH };
    const covers = tb.x <= art.x + 0.5 && tb.y <= art.y + 0.5 &&
                   tb.x + tb.w >= art.x + art.w - 0.5 && tb.y + tb.h >= art.y + art.h - 0.5;
    const notSmaller = tb.x <= m.x + 0.5 && tb.y <= m.y + 0.5 &&
                       tb.x + tb.w >= m.x + m.w - 0.5 && tb.y + tb.h >= m.y + m.h - 0.5;
    return { t, box: { x: m.x, y: m.y, w: m.w, h: m.h }, vis: { w: m._visW, h: m._visH }, tb, art, covers, notSmaller,
             grew: +((tb.w * tb.h) / Math.max(1, m.w * m.h)).toFixed(2) };
  };
  for (const t of fliers) { const r = await measure(t); if (r) out.rows.push(r); }
  for (const t of ground) {
    const r = await measure(t);
    if (r) out.live.push({ t, unchanged: r.tb.w === r.box.w && r.tb.h === r.box.h });
  }

  // end to end, on the worst offender: stand ON the sprite but OUTSIDE the old box
  const hit = async (place) => {
    game.monsters.length = 0;
    player._god = false; player.invulnerable = 0; player.parryWindow = 0;
    player.hp = getMaxHp();
    const m = spawnMonster(900, 260, 'towerWisp', false);
    if (!m) return null;
    m.vx = 0; m.vy = 0; m.speed = 0;
    for (let i = 0; i < 40 && !(m._visW > 0); i++) await sleep(50);
    const tb = (typeof _mobTouchBox === 'function') ? _mobTouchBox(m) : { x: m.x, y: m.y, w: m.w, h: m.h };
    place(m, tb);
    m.facing = ((player.x + player.w / 2) >= (m.x + m.w / 2)) ? 1 : -1;   // contact is facing-gated
    const hp0 = player.hp;
    const hx = player.x, hy = player.y;
    // Hold both of them IN THE FRAME LOOP, not on a setInterval. The interval version of this was
    // flaky — it reported 0 damage on some builds and 183 on others, which looked exactly like a
    // regression and was not: a timer competing with the page's own rAF gets throttled under load,
    // the player then falls out of the touch box, and no contact ever registers. Pinning on every
    // sampled frame is what a diagnostic that reproduced 182 every time actually did.
    let overlapped = false;
    for (let i = 0; i < 55; i++) {
      m.vx = 0; m.vy = 0; m.currentHp = m.maxHp;
      player.vx = 0; player.vy = 0; player.x = hx; player.y = hy;
      if (typeof aabb === 'function' && typeof _mobTouchBox === 'function' && aabb(player, _mobTouchBox(m))) overlapped = true;
      await sleep(16);
    }
    const lost = hp0 - player.hp;
    player._god = true; player.hp = getMaxHp();
    return { lost, overlapped };
  };
  // ON the sprite but STRICTLY OUTSIDE the authored box: the sprite is foot-anchored, so it runs
  // from m.y+m.h-visH up to m.y+m.h, and the band above m.y is drawn art that the old box never
  // covered. Sitting the player's whole body in that band is the exact case the user reported.
  // (The first cut placed them at 75% of visH, which still overlapped the old box and so 'passed'
  // on the unfixed build too - a false pass that proved nothing.)
  out.onSpriteR = await hit((m) => {
    player.x = m.x + m.w / 2 - player.w / 2;
    player.y = m.y - player.h - 2;                  // fully above the authored box, inside the art
    player.vx = 0; player.vy = 0;
  });
  // CLEAR of the sprite: well outside everything
  out.offSpriteR = await hit((m, tb) => {
    player.x = tb.x + tb.w + 260;
    player.y = tb.y;
    player.vx = 0; player.vy = 0;
  });
  out.onSprite = out.onSpriteR.lost; out.onOverlap = out.onSpriteR.overlapped;
  out.offSprite = out.offSpriteR.lost; out.offOverlap = out.offSpriteR.overlapped;
  game.monsters.length = 0; player._god = true;
  return out;
});
await browser.close(); server.kill();

console.log('type'.padEnd(18) + 'damage box   drawn      touch box grew   covers art');
for (const r of R.rows) {
  console.log(r.t.padEnd(18) + `${String(Math.round(r.box.w)).padStart(3)}x${String(Math.round(r.box.h)).padStart(3)}      ${String(Math.round(r.vis.w)).padStart(3)}x${String(Math.round(r.vis.h)).padStart(3)}    x${String(r.grew).padStart(5)}          ${r.covers ? 'yes' : 'NO'}`);
}
const notCovering = R.rows.filter((r) => !r.covers).map((r) => r.t);
const shrunk = R.rows.filter((r) => !r.notSmaller).map((r) => r.t);
const groundChanged = R.live.filter((r) => !r.unchanged).map((r) => r.t);
console.log(`\non the sprite: ${R.onSprite} damage   |   clear of it: ${R.offSprite} damage`);

const checks = [
  ['the touch box exists', R.hasFn === true],
  ['every flying type was measured', R.rows.length >= 12, R.rows.length + ' types'],
  ['every flier\'s touch box covers the drawn sprite', notCovering.length === 0, notCovering.join(', ')],
  ['no flier\'s touch box is smaller than its authored box', shrunk.length === 0, shrunk.join(', ')],
  ['standing on the sprite, outside the old box, now takes damage', R.onSprite > 0 && R.onOverlap === true, R.onSprite + ' hp, boxes overlapped: ' + R.onOverlap],
  ['standing clear of the sprite still takes none', R.offSprite <= 0 && R.offOverlap === false, R.offSprite + ' hp (regen can tick it up a point, so this is <= 0), overlapped: ' + R.offOverlap],
  ['ground monsters are untouched', groundChanged.length === 0, groundChanged.join(', ')],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
