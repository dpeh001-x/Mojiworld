// Dash leg-attachment certification (rogue + warrior). The legs are
// ROOT-parented while the torso is a SPINE child; both dash poses translate
// the spine forward (rogue x→+6.8 smear apex, warrior x→+4.5 charge apex). If
// the leg bone offsets don't track that translate, the hips visibly detach
// from the body (user-reported floating leg). Assert: across the whole 0..1
// timeline, each leg's x/y offset stays within a tight band of the spine's
// x/y translate, for BOTH classes' dash poses.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const page = await browser.newContext().then(c => c.newPage());
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof _heroVecRogueDashPose === 'function' && typeof _heroVecWarriorBashPose === 'function' && typeof HERO_VEC_RIG === 'object', null, { timeout: 30000 });

  const rig = await page.evaluate(() => ({ legsRootParented: HERO_VEC_RIG.legL.parent === 'root' && HERO_VEC_RIG.legR.parent === 'root', spineChild: HERO_VEC_RIG.head.parent === 'spine' }));
  ok('rig sanity: legs root-parented, head spine-parented (fix premise holds)', rig.legsRootParented && rig.spineChild, rig);

  for (const [name, fn, apex, spineMin, splitMin] of [
    ['rogue dash',   '_heroVecRogueDashPose',   0.58, 0.8, 1.0],
    ['warrior bash', '_heroVecWarriorBashPose', 0.55, 0.7, 0.7],
  ]) {
    const scan = await page.evaluate(({ fn }) => {
      let worstX = 0, worstY = 0, at = 0;
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const p = window[fn](t);
        const dx = Math.max(Math.abs(p.legLX - p.x), Math.abs(p.legRX - p.x));
        const dy = Math.max(Math.abs(p.legLY - p.y), Math.abs(p.legRY - p.y));
        if (dx > worstX) { worstX = dx; at = t; }
        if (dy > worstY) worstY = dy;
      }
      return { worstX: +worstX.toFixed(2), worstY: +worstY.toFixed(2), at };
    }, { fn });
    ok(name + ': leg X offsets track the spine translate (worst gap ≤ 2px)', scan.worstX <= 2, scan);
    ok(name + ': leg Y offsets track the spine translate (worst gap ≤ 1.5px)', scan.worstY <= 1.5, scan);

    const energy = await page.evaluate(({ fn, apex }) => {
      const p = window[fn](apex);
      return { spine: +p.spine.toFixed(2), split: +(p.legR - p.legL).toFixed(2), x: p.x };
    }, { fn, apex });
    ok(name + ': apex keeps the lunge (spine ≥ ' + spineMin + ', leg split ≥ ' + splitMin + ')', energy.spine >= spineMin && energy.split >= splitMin, energy);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
