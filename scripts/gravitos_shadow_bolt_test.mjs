// GRAVITOS SHADOW + PROJECTILE ASPECT (v0.29.553).
//
// Two user reports, two independent fixes:
//   1. Every Gravitos form drew a ground-shadow ellipse. He is the one boss
//      that never touches the floor (the AI excludes him from
//      _bossSeekPlatform because he hovers/teleports), so the ellipse read as
//      a decal sliding under a floating titan.
//   2. p_gravbolt looked squished. The themed-projectile blit forced EVERY
//      sprite into a square r*2 x r*2 box, so non-square art was distorted —
//      gravbolt is 256x77, i.e. crushed 3.3x vertically.
//
// Both are measured against what actually reaches the canvas: ctx.ellipse and
// ctx.drawImage are intercepted, so the assertions read real draw calls rather
// than re-deriving the maths under test.
// Run: node scripts/gravitos_shadow_bolt_test.mjs [game-file]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv[2] || 'mojiworld_game.html';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto('file:///' + path.join(ROOT, FILE).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof drawMonster === 'function' && typeof drawProjectiles === 'function'
  && typeof LX_MOB_PROJ !== 'undefined' && game.mapData, { timeout: 60000 });

const out = await page.evaluate(async () => {
  const res = {};

  // ---- 1. shadow ellipses under Gravitos vs a control mob ----------------
  // Force shadows ON so the test can't pass merely because they're disabled.
  try { LX_ENTITY_SHADOWS = true; } catch (e) {}
  try { if (typeof LX_GFX !== 'undefined') LX_GFX.quality = 'custom'; } catch (e) {}
  const realEllipse = CanvasRenderingContext2D.prototype.ellipse;
  let ellipses = [];
  CanvasRenderingContext2D.prototype.ellipse = function (...a) { ellipses.push(a); return realEllipse.apply(this, a); };

  const groundY = ((game.mapData.platforms || []).find((p) => p.type === 'ground') || { y: 480 }).y;
  const mkMob = (type, phaseSprite) => {
    const t = monsterTypes[type] || monsterTypes.gravitos;
    return { type, name: t.name, isBoss: !!t.hp && t.hp > 10000,
      x: 400, y: groundY - t.h, w: t.w, h: t.h, facing: 1,
      hp: t.hp, maxHp: t.hp, currentHp: t.hp, atk: t.atk, def: t.def,
      vx: 0, vy: 0, phase: 1, patternState: 'idle', patternTimer: 0,
      _phaseSprite: phaseSprite || null };
  };
  const countFor = (mob) => {
    ellipses = [];
    ctx.save();
    try { drawMonster(mob); } catch (e) { /* the count is still what matters */ }
    ctx.restore();
    return ellipses.length;
  };
  res.shadow = {
    gravitos1: countFor(mkMob('gravitos')),
    gravitos2: countFor(mkMob('gravitos', 'gravitos2')),
    gravitos3: countFor(mkMob('gravitos', 'gravitos3')),
  };
  // a control: some ordinary ground mob MUST still cast one
  const ctrlType = Object.keys(monsterTypes).find((k) => !/gravitos/i.test(k) && monsterTypes[k].w && !monsterTypes[k].flies);
  res.shadow.controlType = ctrlType;
  res.shadow.control = countFor(mkMob(ctrlType));
  CanvasRenderingContext2D.prototype.ellipse = realEllipse;

  // ---- 2. the projectile blit rect ---------------------------------------
  const realDraw = CanvasRenderingContext2D.prototype.drawImage;
  let blits = [];
  CanvasRenderingContext2D.prototype.drawImage = function (...a) { blits.push(a); return realDraw.apply(this, a); };

  const probe = async (skill) => {
    const spr = LX_MOB_PROJ[skill];
    if (!spr) return { err: 'no sprite' };
    const t0 = Date.now();
    while ((!spr.complete || !spr.naturalWidth) && Date.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 150));
    if (!spr.naturalWidth) return { err: 'never decoded' };
    game.projectiles = [{ x: 300, y: groundY - 200, w: 28, h: 10, vx: 6, vy: 0, skill,
      damage: 1, owner: 'enemy', life: 100 }];
    blits = [];
    ctx.save();
    try { drawProjectiles(); } catch (e) { return { err: 'threw: ' + String(e.message).slice(0, 60) }; }
    ctx.restore();
    game.projectiles = [];
    const b = blits.find((z) => z[0] === spr);
    if (!b || b.length < 5) return { err: 'no blit captured' };
    const dw = b[b.length - 2], dh = b[b.length - 1];
    return { srcW: spr.naturalWidth, srcH: spr.naturalHeight,
      srcAR: +(spr.naturalWidth / spr.naturalHeight).toFixed(3),
      dw: +dw.toFixed(1), dh: +dh.toFixed(1), drawAR: +(dw / dh).toFixed(3) };
  };
  res.proj = {};
  for (const s of ['gravbolt', 'mhornshot', 'mvoltzap', 'micicle', 'mbubble']) res.proj[s] = await probe(s);
  CanvasRenderingContext2D.prototype.drawImage = realDraw;
  return res;
});
await browser.close();

let bad = 0;
const check = (c, n, extra) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${!c && extra !== undefined ? ' — ' + JSON.stringify(extra) : ''}`); if (!c) bad++; };
console.log('gravitos ground shadow (ellipse draw calls per frame):');
for (const k of ['gravitos1', 'gravitos2', 'gravitos3']) check(out.shadow[k] === 0, `${k} draws no shadow ellipse`, out.shadow);
check(out.shadow.control > 0, `the control mob (${out.shadow.controlType}) still casts one — the fix is Gravitos-only`, out.shadow);

console.log('\nprojectile blit aspect (draw AR must equal source AR):');
for (const [k, r] of Object.entries(out.proj)) {
  if (r.err) { check(false, `${k}: ${r.err}`); continue; }
  const ok = Math.abs(r.drawAR - r.srcAR) < 0.02;
  check(ok, `${k} ${r.srcW}x${r.srcH} (AR ${r.srcAR}) draws at ${r.dw}x${r.dh} (AR ${r.drawAR})`, r);
}
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 3).join(' | ') : '\nno page errors');
console.log(bad ? `\n${bad} check(s) failed` : '\nall good — no shadow on any Gravitos form, projectiles keep their authored proportions');
process.exit(bad || errs.length ? 1 : 0);
