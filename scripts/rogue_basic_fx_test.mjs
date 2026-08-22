// The rogue basic attack draws the arc slash and NOTHING else.
//
// Per user, on a screenshot of the swing: "can remove the triangle stab portion
// of the rogue basic attack, keep the arc slash." The basic used to spawn two
// overlapping effects — the crescent, plus a spawnStabImpact lance (a tapered
// blade streak with a four-point impact star at the tip). That lance is the
// triangle; it is gone, the crescent stays.
//
// The reason this is a test and not a glance at the diff: spawnStabImpact has a
// SECOND caller. The archer's bow muzzle flash is the same effect in green, and
// deleting the shared function — or the wrong call site — would look identical
// in the rogue screenshot while quietly stripping the archer's shot. So this
// drives the real SKILL_FNS entries for both classes and checks the rogue lost
// exactly one effect and the archer lost none.
// Run: node scripts/rogue_basic_fx_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof SKILL_FNS !== 'undefined' && typeof loadMap === 'function', { timeout: 90000 });

const r = await page.evaluate(() => {
  const cast = (cls, id) => {
    loadMap('town');
    player.cls = cls; player.level = 40; player.mp = 999;
    player.x = 400; player.y = 300; player.facing = 1;
    game.smoothFx = []; game.projectiles = [];
    const _t = window.showToast; window.showToast = function () {};
    try { SKILL_FNS[id](); } catch (e) { return { err: String(e).slice(0, 120) }; }
    finally { window.showToast = _t; }
    const kinds = {};
    for (const fx of (game.smoothFx || [])) kinds[fx.type] = (kinds[fx.type] || 0) + 1;
    return { kinds, colors: (game.smoothFx || []).map(f => f.type + ':' + f.color) };
  };
  return {
    rogue: cast('rogue', 'stab'),
    archer: cast('archer', 'arrowShot'),
    hasFn: typeof spawnStabImpact === 'function',
  };
});

console.log('\nrogue basic  → ' + JSON.stringify(r.rogue.kinds || r.rogue.err));
console.log('archer basic → ' + JSON.stringify(r.archer.kinds || r.archer.err));

console.log('\nROGUE — arc slash only');
check(!r.rogue.err, 'the rogue basic cast without throwing', r.rogue.err);
check((r.rogue.kinds || {}).slash > 0, 'the arc slash still spawns', r.rogue.kinds);
check(!(r.rogue.kinds || {}).stab, 'no stab lance spawns any more', r.rogue.colors);

console.log('\nARCHER — the shared effect must survive');
check(!r.archer.err, 'the archer basic cast without throwing', r.archer.err);
check(r.hasFn, 'spawnStabImpact still exists (it was a call site, not the function, that went)');
check((r.archer.kinds || {}).stab > 0, 'the archer bow muzzle flash still spawns its stab', r.archer.kinds);

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
