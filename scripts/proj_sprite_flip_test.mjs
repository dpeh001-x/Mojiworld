// PROJECTILE SPRITE FLIP — p_octohead renders the right way up.
// ============================================================================
// Per user: "p_octohead animation should be flipped Y axis".
//
// _PROJ_SPRITE_BLIT supported mode / size / alpha / spinRate but had no flip
// option, so art authored the wrong way up could not be corrected without
// re-exporting the asset. flipX / flipY were added with the same meaning they
// already carry in the equipment attach table and the smooth-FX layer
// (flipY === the animator's "Flip V" === scale(1, -1)).
//
// This drives the REAL renderer rather than reading the table: it spies on
// ctx.scale while drawProjectiles() runs with one octoHead in flight, so it
// verifies the transform actually reaches the canvas. It also measures the
// sprite's own top/bottom asymmetry — a vertically symmetric sprite would make
// the flip invisible, and an assertion that cannot see its own effect is worth
// nothing.
//
// v0.30.1242 (6c48115e, per user) replaced octoHead's orient + flipY with the
// new 'face' blit (_lxProjFaceUpright): the art is upright facing right, and
// orient + flipY left it belly-up one way or the other. So octoHead now must
// NOT flip vertically in either direction - it mirrors horizontally on a
// leftward shot instead. The generic flipX / flipY support this suite was
// written for is still checked, on a temporary blit entry.
// Run: node scripts/proj_sprite_flip_test.mjs   (MOJI_GAME_FILE overrides, PORT env)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 9353;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { window._lxFxEager = true; });   // v0.30.x lazy-fx - this suite inspects the art itself: it stays eager here
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'FlipTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 1200));
  game.paused = false;

  // How asymmetric is the art top-to-bottom? If it were symmetric the flip
  // would be invisible and this whole test would be measuring nothing.
  const img = LX_MOB_PROJ['octoHead'];
  let asym = null;
  if (img && img.naturalWidth) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let top = 0, bot = 0;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const a = d[(y * c.width + x) * 4 + 3];
        if (y < c.height / 2) top += a; else bot += a;
      }
    }
    asym = { ratio: +(top / (bot || 1)).toFixed(3) };
  }

  // Spy on the real draw. One octoHead, flat heading so the orient rotate is 0
  // and any scale we see is the flip rather than a side effect of rotation.
  const spy = (skill, vx = 6) => {
    game.projectiles.length = 0;
    game.projectiles.push({
      x: player.x + 60, y: player.y, vx, vy: 0, w: 40, h: 40,
      life: 200, damage: 1, owner: 'enemy', skill,
    });
    const scales = [];
    const orig = ctx.scale.bind(ctx);
    ctx.scale = function (a, b) { scales.push([a, b]); return orig(a, b); };
    try { drawProjectiles(); } catch (e) {}
    ctx.scale = orig;
    return scales;
  };

  const octo = spy('octoHead');          // rightward shot
  const octoL = spy('octoHead', -6);     // leftward shot (v0.30.1242 'face' mirrors here)
  // A sibling that must NOT be flipped — proves the change is targeted rather
  // than a blanket mirror on every blitted projectile.
  const leg = spy('octoLeg');
  // The flipY key itself still reaches the canvas: lend it to octoLeg for one
  // draw, then restore the table entry exactly as it was.
  const legBlit = _PROJ_SPRITE_BLIT['octoLeg'];
  _PROJ_SPRITE_BLIT['octoLeg'] = Object.assign({}, legBlit, { flipY: true });
  let legFlipped; try { legFlipped = spy('octoLeg'); } finally { _PROJ_SPRITE_BLIT['octoLeg'] = legBlit; }

  return {
    asym, octo, octoL, leg, legFlipped,
    blitOcto: _PROJ_SPRITE_BLIT['octoHead'],
    blitLeg: _PROJ_SPRITE_BLIT['octoLeg'],
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 125) });
const hasVFlip = (list) => Array.isArray(list) && list.some(s => s[0] === 1 && s[1] === -1);

ok('the sprite is vertically asymmetric, so a flip is visible',
   R.asym && Math.abs(R.asym.ratio - 1) > 0.02, `top/bottom alpha ratio ${R.asym && R.asym.ratio}`);
// v0.30.1242: octoHead is 'face' (upright art, mirrored by heading), no flipY.
ok('octoHead uses the upright face blit at size 1, no flipY (v0.30.1242)',
   !!(R.blitOcto && R.blitOcto.mode === 'face' && R.blitOcto.size === 1.0 && !R.blitOcto.flipY), JSON.stringify(R.blitOcto));
ok('octoHead is never drawn belly-up: no vertical flip on a rightward or a leftward shot',
   !hasVFlip(R.octo) && !hasVFlip(R.octoL), 'right: ' + JSON.stringify(R.octo) + ' left: ' + JSON.stringify(R.octoL));
ok('octoHead mirrors horizontally on a leftward shot and not on a rightward one',
   R.octoL.some(s => s[0] === -1 && s[1] === 1) && !R.octo.some(s => s[0] === -1),
   'right: ' + JSON.stringify(R.octo) + ' left: ' + JSON.stringify(R.octoL));
ok('the flipY key still reaches the canvas during drawProjectiles',
   hasVFlip(R.legFlipped), 'ctx.scale calls: ' + JSON.stringify(R.legFlipped));
ok('octoLeg is NOT flipped (change is targeted, not a blanket mirror)',
   !hasVFlip(R.leg), 'ctx.scale calls: ' + JSON.stringify(R.leg));

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
