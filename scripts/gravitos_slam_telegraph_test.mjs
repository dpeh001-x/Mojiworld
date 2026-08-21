// The grounded Gravitos slam warns before it lands.
//
// Per user: "yes have a replacement telegraph for it, use ludo.ai to generate
// the necessary sprites". Pinning him to the floor (v0.29.772) killed the old
// tell — he used to rise, hang, and plummet, and the impact fired off a
// foot-height landing test that reads TRUE immediately once he can't leave the
// ground, so the stomp landed about one frame after he repositioned.
//
// The replacement is two beats: a gravity well at his feet during the wind-up,
// then a floor band across the strike column, then the impact. What matters is
// not that sprites exist but that the player gets READABLE LEAD TIME, and that
// the band tells the truth about the hitbox — so this measures both.
// Run: node scripts/gravitos_slam_telegraph_test.mjs [file.html]
// Negative control: a pre-telegraph build has ~0ms of lead and no band.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof LX_FX !== 'undefined', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 100; player._god = true; player.hp = player.maxHp = 999999;
  player._gravitosCineSeen = true;
  loadMap('gravitosArena');
});
await page.waitForTimeout(10000);

const r = await page.evaluate(async () => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const out = {};
  // 1. the art itself decoded — a missing FX key fails silently in game
  const artOf = (k) => {
    const im = LX_FX && LX_FX[k];
    if (!im) return { missing: true };
    return { complete: !!im.complete, w: im.naturalWidth || 0, h: im.naturalHeight || 0 };
  };
  out.ring = artOf('gravitos_slamring');
  out.zone = artOf('gravitos_slamzone');

  game.paused = false;
  let m = (game.monsters || []).find((x) => x && x.type === 'gravitos');
  if (!m) { try { spawnMonster(1100, 300, 'gravitos'); } catch (e) {} }
  m = (game.monsters || []).find((x) => x && x.type === 'gravitos');
  out.spawned = !!m;
  if (!m) return out;
  m.currentHp = m.maxHp = 9e9;
  player._god = true;                       // survive the stomp
  player.x = 700; player.y = 380;

  // Drive one full slam and watch, per frame, when each beat appears.
  game.smoothFx = [];
  m.patternState = 'slam'; m.patternTimer = 0;
  m._slamPrep = false; m._slamHit = false; m._slamGather = false;
  let ringAt = null, zoneAt = null, hitAt = null, zoneRec = null, hitCx = null;
  for (let i = 0; i < 200; i++) {
    await frame();
    if (m.patternState !== 'slam') break;
    const t = m.patternTimer;
    const fx = game.smoothFx || [];
    if (ringAt === null && fx.some((f) => f && f.spriteKey === 'gravitos_slamring')) ringAt = t;
    if (zoneAt === null) {
      const z = fx.find((f) => f && f.spriteKey === 'gravitos_slamzone');
      if (z) { zoneAt = t; zoneRec = { x: Math.round(z.x), y: Math.round(z.y), size: z.size, keepAspect: !!z.keepAspect }; }
    }
    if (hitAt === null && m._slamHit) { hitAt = t; hitCx = Math.round(m.x + m.w / 2); }
    if (hitAt !== null) break;
  }
  out.ringAt = ringAt; out.zoneAt = zoneAt; out.hitAt = hitAt;
  out.zoneRec = zoneRec; out.hitCx = hitCx;
  out.leadMs = (zoneAt !== null && hitAt !== null) ? (hitAt - zoneAt) : null;
  // The band's drawn width, derived the same way the renderer does it
  if (zoneRec && out.zone && out.zone.w) {
    out.zoneDrawW = Math.round(zoneRec.size * (out.zone.w / out.zone.h));
  }
  return out;
});
await browser.close();

const DMG_HALF = 180;   // the slam's damage check is |dx| < 180
console.log(`  art: ring ${JSON.stringify(r.ring)}  zone ${JSON.stringify(r.zone)}`);
console.log(`  beats (patternTimer ms): gather ring @${r.ringAt}, floor band @${r.zoneAt}, impact @${r.hitAt}`);
console.log(`  band: ${JSON.stringify(r.zoneRec)} → drawn width ${r.zoneDrawW}px (damage band ${DMG_HALF * 2}px), lead ${r.leadMs}ms`);

check(r.spawned, 'Gravitos exists to slam', r.spawned);
check(r.ring && !r.ring.missing && r.ring.complete && r.ring.w > 0, 'the wind-up gravity-well sprite decoded', r.ring);
check(r.zone && !r.zone.missing && r.zone.complete && r.zone.w > 0, 'the floor-band sprite decoded', r.zone);
check(r.ringAt !== null && r.ringAt < 400, 'the gather ring appears in the wind-up, before he commits to a column', r.ringAt);
check(r.zoneAt !== null, 'a floor band marks the strike column', r.zoneAt);
check(r.hitAt !== null, 'and the stomp still actually lands (the attack is not broken)', r.hitAt);
// The whole point: readable warning. One frame is ~17ms; the old behaviour was
// impact immediately after the reposition.
check(r.leadMs !== null && r.leadMs >= 180, 'the band is up for a readable window before impact, not a single frame', r.leadMs);
check(r.zoneRec && Math.abs(r.zoneRec.x - r.hitCx) <= 4, 'the band sits on the column that actually gets hit', { band: r.zoneRec && r.zoneRec.x, impact: r.hitCx });
// A marker narrower than the hitbox lies to the player; far wider cries wolf.
check(r.zoneDrawW != null && r.zoneDrawW >= DMG_HALF * 2 - 20 && r.zoneDrawW <= DMG_HALF * 2 + 60,
      'and is drawn the width of the hitbox it promises', { drawn: r.zoneDrawW, damage: DMG_HALF * 2 });
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
