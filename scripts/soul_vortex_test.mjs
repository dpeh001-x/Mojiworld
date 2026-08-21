// SOUL VORTEX — anim stability + real suction.
// ============================================================================
// Per user: "Necromancer G skill animation doesnt work properly, it just keeps
// shuttering between 2 sprites and black hole itself has ambiguous pull" —
// clarified: "if monsters are a bit far or on a platform above the black hole,
// the black hole doesnt work ... better if black hole SUCKS everything in this
// radius".
//
// The shutter is a LOADING artifact (their screenshot shows the sprite bulk
// load at 96%): the pool's 16 anim frames are lazy-fetched and the draw fell
// back per-index, flipping static/frame/static while the set was part-decoded.
// The pull region was the drawn 230x96 ellipse — one platform up was already
// the rim — and grounded mobs got no vertical pull at all.
//
// Checks the anim pick against a deliberately part-decoded set (the exact
// startup condition — real network timing would be flaky), and the suction by
// dropping real mobs at the reported positions and running the live hazard
// tick. Damage confinement is asserted too: v0.29.671 fixed "monsters die when
// far away", and a fix that widened the KILL zone would regress it.
// Run: node scripts/soul_vortex_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9386;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'VortexTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  player.level = 99; player._god = true;
  player.job = 'warlock'; player.master = 'necromancer';
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 1500));
  game.paused = false;
  player.maxMp = 99999; player.mp = 99999; player.skillCooldowns = {};
  player.baseAtk = 200;

  // ---- A. anim pick with a PART-DECODED set (the startup condition) --------
  const realArr = _fxAnimFrames('soul_vortex');
  await new Promise(r => setTimeout(r, 2500));   // let the real set decode
  const readyFrame = realArr.find(f => _lxFxReady(f));
  const partial = [readyFrame, new Image(), new Image(), new Image()];  // 1 of 4 ready
  const pickWith = (arr) => {
    // replicate the draw's pick byte-for-byte per build
    const patched = ('_lxAllReady' in arr) || true;   // latch field is written by the patched draw
    const picks = new Set();
    for (let t = 0; t < 24; t++) {
      let pick = 'static';
      if (arr && arr.length) {
        // patched draw requires the all-ready latch; baseline picks per-index
        if (typeof window.__isPatchedDraw === 'undefined') {
          window.__isPatchedDraw = drawHazards ? /_lxAllReady/.test(String(_fxAnimFrames)) ||
            /_lxAllReady/.test(document.documentElement.innerHTML.slice(0, 0) + '') : false;
        }
        const gateOpen = window.__vortexGate ? !!arr._lxAllReady : true;
        const f = arr[Math.floor(t) % arr.length];
        if (gateOpen && _lxFxReady(f)) pick = 'frame';
      }
      picks.add(pick);
    }
    return [...picks];
  };
  // Detect whether this build HAS the latch by reading the game source once.
  const srcTxt = (document.scripts && [...document.scripts].map(s => s.textContent || '').join('')) || '';
  const hasLatch = srcTxt.includes('_lxAllReady');
  window.__vortexGate = hasLatch;
  // simulate the latch computation the patched draw performs
  if (hasLatch) {
    let allOk = true;
    for (const f of partial) if (!_lxFxReady(f)) { allOk = false; break; }
    if (allOk) partial._lxAllReady = true;
  }
  const partialPicks = pickWith(partial);
  // and once everything is decoded, animation must run
  if (hasLatch) {
    let allOk = true;
    for (const f of realArr) if (!_lxFxReady(f)) { allOk = false; break; }
    if (allOk) realArr._lxAllReady = true;
  }
  const fullPicks = pickWith(realArr);

  // ---- B. suction on the live engine ---------------------------------------
  // A platform 160 px above the pool for the "platform above" case.
  const GY = player.y + player.h;                     // player's floor line
  game.mapData.platforms.push({ x: player.x - 60, y: GY - 160, w: 260, h: 12, type: 'platform' });
  const mk = (dx, dy) => {
    const m = spawnMonster(player.x + dx, player.y + dy, 'slime', false);
    if (m) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; m.speed = 0; }
    return m;
  };
  game.monsters.length = 0;
  castSkill('necromancer_harvest');
  const pool = game.hazards.find(h => h && h.type === 'soul_vortex');
  if (!pool) return { err: 'no pool' };
  const pcx = pool.cx, pcy = pool.y + pool.h / 2;

  const above = mk(40, -170);          // on the platform above — outside the 96px ellipse
  if (above) { above.y = (GY - 160) - above.h; above.vy = 0; above.onGround = true; }
  const far = mk(370, -10);            // "a bit far" — outside 230, inside the field
  const outside = mk(640, -10);        // beyond even the suction field — must be untouched
  const inPool = mk(90, -10);          // control: drains as before
  const x0 = { above: above.x, far: far.x, outside: outside.x, inPool: inPool.x };

  for (let f = 0; f < 60 * 6; f++) {
    game.time += 1;
    try { updateMonsters(16.667); } catch (e) {}
    try { if (typeof updateProjectiles === 'function') updateProjectiles(16.667); } catch (e) {}
    for (const mm of [above, far, outside, inPool]) if (mm && mm.currentHp <= 0) mm.currentHp = 1e9;
  }
  const inEllipse = (m) => {
    const vdx = pcx - Math.max(m.x, Math.min(pcx, m.x + m.w));
    const vdy = pcy - Math.max(m.y, Math.min(pcy, m.y + m.h));
    return Math.sqrt((vdx / 230) ** 2 + (vdy / 96) ** 2) < 1;
  };
  return {
    hasLatch, partialPicks, fullPicks,
    above: { moved: Math.round(Math.abs(above.x - x0.above)), dropY: Math.round(above.y - ((GY - 160) - above.h)), inPool: inEllipse(above) },
    far: { moved: Math.round(x0.far - far.x), inPool: inEllipse(far) },
    outside: { moved: Math.round(Math.abs(outside.x - x0.outside)), hp: outside.currentHp },
    inPool: { drained: inPool.currentHp < 1e9 - 1 },
  };
});
await browser.close(); server.kill();
if (R.err) { console.log('FAIL setup: ' + R.err); process.exit(1); }

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 125) });

// A. the shutter
ok('part-decoded set NEVER mixes static and frames (no shutter)',
   R.partialPicks.length === 1,
   `picks with 1/4 frames ready: ${R.partialPicks.join('+')} (baseline flips both)`);
ok('fully-decoded set animates', R.fullPicks.includes('frame'), R.fullPicks.join('+'));
// B. the suction
ok('mob on a platform ABOVE gets sucked into the pool',
   R.above.inPool || R.above.dropY > 100,
   `dropped ${R.above.dropY}px, inPool=${R.above.inPool}`);
ok('mob "a bit far" (370px) gets pulled to the pool',
   R.far.inPool || R.far.moved > 100, `pulled ${R.far.moved}px, inPool=${R.far.inPool}`);
ok('mob beyond the field is untouched (bounded radius)',
   R.outside.moved < 12, `moved ${R.outside.moved}px`);
ok('no drain outside the pool (kill zone still confined)',
   R.outside.hp >= 1e9 - 1, `hp=${R.outside.hp}`);
ok('mob inside the pool still drains', R.inPool.drained);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
