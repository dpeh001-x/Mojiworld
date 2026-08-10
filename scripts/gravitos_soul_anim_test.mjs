// GRAVITOS SOUL SET WIRING (v0.29.567).
//
// gravitossoul_0..8 shipped but nothing referenced it — the key was absent from
// BOSS_SPRITE_TYPES, so it never loaded and never drew. It is now the caster
// counterpart to gravitospunch, covering the channelled specials:
//   soulDrain    — every form (its signature pulse)
//   singularity  — form 1 ONLY (forms 2/3 keep authored gravitos2star/3star)
//   collapseRain — form 1 ONLY, same reason
//
// Asserted against the REAL draw path: drawMonster is called and the resulting
// m._gravStarKey is read, so this measures the selection the renderer actually
// makes rather than re-deriving the branch under test. The intercepted blit
// confirms a soul frame reaches the canvas.
// Run: node scripts/gravitos_soul_anim_test.mjs [game-file]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv[2] || 'mojiworld_game.html';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [], failed = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
page.on('response', (r) => { if (r.status() >= 400 && /gravitossoul/i.test(r.url())) failed.push(r.status() + ' ' + r.url().split('/').pop()); });
await page.goto('file:///' + path.join(ROOT, FILE).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof drawMonster === 'function' && typeof BOSS_ATTACK_FRAMES === 'object', { timeout: 60000 });

const out = await page.evaluate(async () => {
  const res = {};
  // the set must LOAD at all — that was the whole bug
  const frames = BOSS_ATTACK_FRAMES.gravitossoul;
  res.registered = !!frames;
  if (frames) {
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      if (frames.every((f) => f && f.complete && f.naturalWidth > 0)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    res.set = { total: frames.length, decoded: frames.filter((f) => f && f.complete && f.naturalWidth > 0).length,
      w: frames[0] && frames[0].naturalWidth, h: frames[0] && frames[0].naturalHeight };
  }
  // the LASER set, same treatment — both must be wired, per user
  const lframes = BOSS_ATTACK_FRAMES.gravitoslaser;
  res.laserRegistered = !!lframes;
  if (lframes) {
    const t1 = Date.now();
    while (Date.now() - t1 < 30000) {
      if (lframes.every((f) => f && f.complete && f.naturalWidth > 0)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    res.laserSet = { total: lframes.length, decoded: lframes.filter((f) => f && f.complete && f.naturalWidth > 0).length,
      w: lframes[0] && lframes[0].naturalWidth, h: lframes[0] && lframes[0].naturalHeight };
  }
  const groundY = ((game.mapData.platforms || []).find((p) => p.type === 'ground') || { y: 480 }).y;
  const t = monsterTypes.gravitos;
  const blits = [];
  const realDraw = window._lxDrawSoft;
  window._lxDrawSoft = function (c, img, ...a) { blits.push(img); return realDraw.apply(this, arguments); };

  const pick = (patternState, phaseSprite, timer) => {
    const m = { type: 'gravitos', isBoss: true, x: 400, y: groundY - t.h, w: t.w, h: t.h, facing: 1,
      hp: t.hp, maxHp: t.hp, currentHp: t.hp, atk: t.atk, def: t.def, vx: 0, vy: 0, phase: 1,
      patternState, patternTimer: timer == null ? 200 : timer, _phaseSprite: phaseSprite || null };
    blits.length = 0;
    ctx.save();
    try { drawMonster(m); } catch (e) { return { err: String(e.message).slice(0, 80) }; }
    ctx.restore();
    const drewSoul = blits.some((im) => im && (frames || []).indexOf(im) >= 0);
    const drewLaser = blits.some((im) => im && (lframes || []).indexOf(im) >= 0);
    return { key: m._gravStarKey, drewSoul, drewLaser };
  };
  res.cases = {
    'soulDrain form1': pick('soulDrain', null),
    'soulDrain form2': pick('soulDrain', 'gravitos2'),
    'soulDrain form3': pick('soulDrain', 'gravitos3'),
    'singularity form1': pick('singularity', null),
    'singularity form2': pick('singularity', 'gravitos2'),
    'singularity form3': pick('singularity', 'gravitos3'),
    'collapseRain form1': pick('collapseRain', null),
    'collapseRain form2': pick('collapseRain', 'gravitos2'),
    'laser form1': pick('laser', null),
    'laser form2': pick('laser', 'gravitos2'),
    'laser form3': pick('laser', 'gravitos3'),
    'crush form1 (punch, unchanged)': pick('crush', null),
    'idle form1 (no override)': pick('idle', null),
  };
  // The once-through must advance across the cast window, then HOLD.
  // typeof-guarded: against an UNWIRED build the helper does not exist, and an
  // unguarded call threw out of page.evaluate — a crash instead of a readable
  // failure, which is the wrong way for a regression to surface.
  if (frames && frames.length && typeof _gravitosSoulFrame === 'function') {
    const at = (ms) => { const f = _gravitosSoulFrame({ type: 'gravitos', patternState: 'soulDrain', patternTimer: ms }); return frames.indexOf(f); };
    res.progression = [0, 500, 950, 1500, 1899, 5000, 20000].map((ms) => ({ ms, frame: at(ms) }));
  }
  window._lxDrawSoft = realDraw;
  return res;
});
await browser.close();

let bad = 0;
const ck = (c, n, x) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${!c && x !== undefined ? ' — ' + JSON.stringify(x) : ''}`); if (!c) bad++; };
console.log('the set loads at all:');
ck(out.registered, 'gravitossoul is registered in BOSS_SPRITE_TYPES');
ck(out.laserRegistered, 'gravitoslaser is registered in BOSS_SPRITE_TYPES');
if (out.laserSet) ck(out.laserSet.decoded === out.laserSet.total && out.laserSet.total >= 9,
  `all ${out.laserSet.total} laser frames decode at ${out.laserSet.w}x${out.laserSet.h}`, out.laserSet);
if (out.set) ck(out.set.decoded === out.set.total && out.set.total >= 9,
  `all ${out.set.total} frames decode at ${out.set.w}x${out.set.h}`, out.set);

console.log('\nwhich set each state/form selects (read off the real draw):');
const EXPECT = {
  'soulDrain form1': 'gravitossoul', 'soulDrain form2': 'gravitossoul', 'soulDrain form3': 'gravitossoul',
  'singularity form1': 'gravitossoul', 'singularity form2': 'gravitos2star', 'singularity form3': 'gravitos3star',
  'collapseRain form1': 'gravitossoul', 'collapseRain form2': 'gravitos2star',
  // Laser Sweep is FORM 1 ONLY, per user. Forms 2/3 deliberately fall through
  // to their phase art — an earlier draft of this test expected all three and
  // failed correct code.
  'laser form1': 'gravitoslaser', 'laser form2': null, 'laser form3': null,
  'crush form1 (punch, unchanged)': 'gravitospunch', 'idle form1 (no override)': null,
};
for (const [label, want] of Object.entries(EXPECT)) {
  const got = out.cases[label];
  if (!got || got.err) { ck(false, `${label}: ${got && got.err}`); continue; }
  ck(got.key === want, `${label.padEnd(32)} -> ${got.key === null ? '(none)' : got.key}`, got);
}
const soulCases = ['soulDrain form1', 'singularity form1', 'collapseRain form1'];
ck(soulCases.every((k) => out.cases[k] && out.cases[k].drewSoul), 'a soul frame actually reaches the canvas on those casts');
ck(out.cases['laser form1'] && out.cases['laser form1'].drewLaser, 'a laser frame actually reaches the canvas on the form-1 sweep');
ck(['laser form2','laser form3'].every((k) => out.cases[k] && !out.cases[k].drewLaser), 'forms 2/3 do NOT take the laser set (form-1 only, by design)');

console.log('\nonce-through then hold (soulDrain, 1900ms window):');
const p = out.progression || [];
const early = p.find((x) => x.ms === 0), mid = p.find((x) => x.ms === 950), late = p.find((x) => x.ms === 20000);
ck(early && early.frame === 0, 'starts on frame 0', early);
ck(mid && mid.frame > 0 && mid.frame < 8, 'is mid-sequence halfway through', mid);
ck(late && late.frame === 8, 'holds the LAST frame long past the window (no slow-motion crawl)', late);
console.log('  ' + p.map((x) => `${x.ms}ms:f${x.frame}`).join('  '));

ck(!failed.length, 'no failed gravitossoul requests', failed);
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 2).join(' | ') : '\nno page errors');
console.log(bad ? `\n${bad} problem(s)` : '\nall good — the soul set loads, drives its three casts, and never steals the star sets');
process.exit(bad || errs.length ? 1 : 0);
