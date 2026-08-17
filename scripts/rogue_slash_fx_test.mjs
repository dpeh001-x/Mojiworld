// The rogue's basic swings a real violet crescent, drawn procedurally.
// Per user: "incorporate better animation for the purple stab animation for
// rogue's basic attack such as the one attached in the image in purple."
// Run: node scripts/rogue_slash_fx_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9262;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(() => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'rogue'; player.level = 40; player.hp = 9e6; player.maxHp = 9e6;
  player._enh = null; player._warlordBanner = 0;
  if (player.mods) player.mods.diagSlash = 0;
  game.paused = false;
  loadMap('forest', 300);
  player.x = 500; player.y = 400; player.facing = 1;
  const pcx = player.x + player.w / 2;

  game.smoothFx = [];
  game.monsters.length = 0;
  try { SKILL_FNS.stab(); } catch (e) { return { err: String(e).slice(0, 160) }; }
  const fx = game.smoothFx || [];
  const arc = fx.filter(f => f && f.type === 'slash').pop() || null;
  const lance = fx.filter(f => f && f.type === 'stab').pop() || null;

  // does the class SPRITE path still claim this colour? (it must be bypassed)
  const bucket = (typeof _lxFxBucket === 'function') ? _lxFxBucket('#c07bff') : null;

  return {
    hasArc: !!arc,
    arc: arc ? { color: arc.color, edgeCol: arc.edgeCol, spread: arc.spread, thickness: arc.thickness,
                 life: arc.maxLife, noSprite: !!arc.noSprite, clean: !!arc.clean, bodyAlpha: arc.bodyAlpha,
                 squashY: arc.squashY, arcUp: arc.arcUp,
                 originPastCentre: arc.x - pcx, length: arc.length,
                 // How LONG each side of the blade is, measured along the curve
                 // (r * angle). Vertical extent is the wrong measure here: sin
                 // saturates near 90 degrees, so a 0.29pi top and a 0.61pi
                 // bottom came out 22px vs 27px and looked near-symmetric,
                 // while the drawn sides are plainly 1:2.
                 topPx: arc.length * arc.spread * (arc.arcUp != null ? arc.arcUp : 0.5),
                 bottomPx: arc.length * arc.spread * (1 - (arc.arcUp != null ? arc.arcUp : 0.5)),
                 // the arc spans +/-spread/2 around the facing axis at radius
                 // `length`; squashY scales only the vertical extent.
                 widthPx: arc.length * (1 - Math.cos(arc.spread / 2)),
                 heightPx: 2 * arc.length * Math.sin(Math.min(Math.PI / 2, arc.spread / 2)) * (arc.squashY || 1) } : null,
    lance: lance ? { length: lance.length, thickness: lance.thickness, color: lance.color } : null,
    bucketClaimsRogue: bucket === 'rogue',
    arcOuterPastCentre: arc ? (arc.x + arc.length + (arc.thickness || 0) / 2) - pcx : null,
  };
});
await browser.close(); server.kill();

ok('the rogue basic now spawns a swing arc at all', !out.err && out.hasArc, out.err || '');
if (out.hasArc) {
  ok('the arc is violet with a hot near-white cutting edge',
     out.arc.color === '#c07bff' && out.arc.edgeCol === '#fbf2ff',
     `${out.arc.color} -> ${out.arc.edgeCol}`);
  ok('the swing carries the sprite opt-out, so the emblem can never stamp it',
     out.arc.noSprite === true, `noSprite: ${out.arc.noSprite}`);
  // Recorded rather than assumed: the rogue basic's violet is NOT in
  // _LX_FX_ROGUE_COLORS, so the crescent-moon emblem was never in play for
  // this colour. noSprite is belt-and-braces for a future palette edit.
  ok('the basic\'s violet does not map to the emblem sprite today either',
     out.bucketClaimsRogue === false, `_lxFxBucket('#c07bff') buckets rogue: ${out.bucketClaimsRogue}`);
  // The horizontal sweep: the reference is the front half of a FLATTENED
  // ellipse centred on the character, so the arc opens most of the way round
  // and is squashed hard on Y. Without the squash the shape is a circle and
  // its height always tracks its width - it cannot be laid down.
  ok('the arc is flattened into a horizontal sweep',
     out.arc.squashY > 0 && out.arc.squashY < 0.4,
     `squashY ${out.arc.squashY}`);
  ok('it opens wide enough to read as a sweep, and stays a fast flick',
     out.arc.spread >= Math.PI * 0.8 && out.arc.spread <= Math.PI * 1.0 && out.arc.life <= 14,
     `spread ${(out.arc.spread / Math.PI).toFixed(2)}pi, life ${out.arc.life}`);
  ok('the sweep is WIDER than it is tall (the point of the squash)',
     out.arc.widthPx > out.arc.heightPx * 1.6,
     `${Math.round(out.arc.widthPx)}px wide vs ${Math.round(out.arc.heightPx)}px tall`);
  ok('the blade is bold enough to read on a lit map',
     out.arc.thickness >= 8 && out.arc.bodyAlpha >= 0.6,
     `thickness ${out.arc.thickness}, bodyAlpha ${out.arc.bodyAlpha}`);
  ok('the glint and speedlines stay on (that streak is the motion)',
     out.arc.clean === false, `clean: ${out.arc.clean}`);
  ok('the top side is shorter than the bottom',
     out.arc.arcUp > 0 && out.arc.arcUp < 0.45 && out.arc.topPx < out.arc.bottomPx * 0.7,
     `arcUp ${out.arc.arcUp} -> top ${Math.round(out.arc.topPx)}px vs bottom ${Math.round(out.arc.bottomPx)}px`);
  // The arc deliberately sits INSIDE the hit box now: the user asked for it
  // closer to the character. Recorded rather than asserted as a match, so the
  // gap is visible if it ever needs closing (the hit range is the dial).
  ok('the arc hugs the character rather than reaching the hit edge',
     out.arcOuterPastCentre > 80 && out.arcOuterPastCentre < 140,
     `arc rim ${Math.round(out.arcOuterPastCentre)}px past centre; hit box reaches ~169px`);
}
ok('the thrust lance survives, slimmed, as the core of the strike',
   !!out.lance && out.lance.length === 86 && out.lance.thickness === 5,
   out.lance ? `length ${out.lance.length}, thickness ${out.lance.thickness}` : 'no lance');

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
