// v0.29.x — three reported bugs, verified in a booted client:
//   1. shackled + downed = permanently stuck
//   2. Mirror Self drew a red BOX instead of a silhouette tint
//   3. Mirror Self's heal was large enough to read as constant regeneration
//
//   node serve.js 8803 && node scripts/shackle_mirror_fix_test.mjs 8803
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8803';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_coopTryDowned') === 'function' && typeof eval('mirrorSelfAI') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

// ---- 1. shackled + downed ---------------------------------------------------
const shackle = await page.evaluate(() => {
  const p = eval('player'), Q = eval('_QTE');
  const saved = { downed: p._downed, hp: p.hp, noDown: p._noDownUntil };
  p._downed = false; p._noDownUntil = 0; p.hp = 50;
  // Put a shackle QTE up, then go down while it is live.
  Q.active = true;
  const before = Q.active;
  let threw = null;
  try { eval('_coopTryDowned')(); } catch (e) { threw = String(e).slice(0, 90); }
  const after = eval('_QTE').active;
  // restore
  try { if (eval('_QTE').active && typeof eval('_qteEnd') === 'function') eval('_qteEnd')(false); } catch (e) {}
  p._downed = saved.downed; p.hp = saved.hp; p._noDownUntil = saved.noDown;
  return { qteBefore: before, qteAfterDown: after, threw };
});
ok('going down while shackled CLEARS the QTE (was: stuck forever)',
   shackle.qteBefore === true && shackle.qteAfterDown === false, shackle);
ok('the downed path does not throw', shackle.threw === null, shackle.threw);

// ---- 2 + 3. Mirror Self -----------------------------------------------------
const mirror = await page.evaluate(() => {
  // Strip comments first. The first cut matched the WORD 'source-atop' inside
  // the comment that explains why the wash was removed, and reported the bug as
  // still present — a false failure from testing prose instead of code.
  const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const src = decomment(eval('_drawMirrorSelf').toString());
  const ai = decomment(eval('mirrorSelfAI').toString());
  return {
    // the red wash was an actual assignment + fillRect, not a mention
    hasRedWashRect: /globalCompositeOperation\s*=\s*['"]source-atop['"]/.test(src) && /fillRect\s*\(/.test(src),
    hasAngryIcon: /😠/.test(src),
    // heal fraction still present, and how big
    healFrac: (/_healAmt = Math\.floor\(m\.maxHp \* ([\d.]+)\)/.exec(ai) || [])[1],
    healStillOnce: /!m\._healed/.test(ai),
    rageThreshold: (/m\.currentHp <= m\.maxHp \* ([\d.]+)[\s\S]{0,60}_raged = true/.exec(ai) || [])[1],
  };
});
ok('the red box is gone (no source-atop fillRect in the mirror draw)', mirror.hasRedWashRect === false);
ok('an angry icon replaces it', mirror.hasAngryIcon === true);
ok('the icon is gated on the low-HP rage state', mirror.rageThreshold === '0.4', { threshold: mirror.rageThreshold });
ok('Mirror Heal is reduced to 10% of maxHp', mirror.healFrac === '0.10', { healFrac: mirror.healFrac });
ok('heal still fires only ONCE per fight (mechanic kept, not removed)', mirror.healStillOnce === true);

ok('no page errors', errs.length === 0, errs.slice(0, 3));
await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
