// King Krook fights in short strings, per user ("for #3 we can have krook to
// short strings").
//
// He used to pick one basic, return to idle and re-roll — five independent dice
// per cycle, so his basics never formed a phrase and there was nothing to
// anticipate. He now commits: 2 beats (3 in phase 2), fast inside the string,
// with a recovery at the end that scales with the string's length.
//
// The two claims this has to defend are (a) that strings actually happen, and
// (b) that they are NOT a stealth buff — the whole point is legibility, so the
// basic-attack rate must land near the old one. Both are measured against the
// live boss, not read out of the source.
// Run: node scripts/krook_attack_strings_test.mjs [file.html]
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
await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS !== 'undefined', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 90;
  loadMap('krookThrone');
});
await page.waitForTimeout(9000);

const run = async (phase2) => page.evaluate(async (p2) => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const m = game.monsters.find((x) => x.type === 'kingKrook');
  if (!m) return { noBoss: true, saw: game.monsters.map((x) => x.type) };
  const BASIC = { claw: 1, fireBreath: 1, jumpSlam: 1 };
  const SPECIAL = { earthquake: 1, fireballRain: 1, megaFireball: 1, firebomb: 1, shellSpin: 1 };
  let specials = 0;
  const seq = []; let last = null; let fr = 0;
  for (let i = 0; i < 6000; i++) {
    m.maxHp = 1e6; m.currentHp = p2 ? 2e5 : 9e5;      // below / above the 60% phase-2 line
    m.aggro = true;
    m._lastShellAt = m._lastMegaAt = m._lastFirebombAt = game.time | 0;
    player.hp = player.maxHp = 9e8; player.mp = player.maxMp || 100;
    player.x = m.x + m.w + 110; player.y = m.y + m.h - player.h;
    await frame(); fr++;
    if (m.patternState !== last) {
      // Record how many beats are still pending when each basic STARTS. A
      // string of length L produces L-1, L-2, ... 0. Inferring strings from
      // frame gaps instead does not work: the within-string gap and the
      // recovery gap overlap once frame timing jitters, so the two cadences are
      // not separable by a threshold. This reads the mechanic directly, and on
      // a build without strings the value is always 0 — one beat per string.
      if (BASIC[m.patternState]) seq.push([m.patternState, fr, (m._kString || []).length]);
      if (SPECIAL[m.patternState]) specials++;
      last = m.patternState;
    }
  }
  // Close a string each time the pending count reaches 0.
  const strings = []; let cur = 0;
  for (const [, , pending] of seq) {
    cur++;
    if (pending === 0) { strings.push(cur); cur = 0; }
  }
  if (cur) strings.push(cur);
  return {
    frames: fr, basics: seq.length, specials, strings,
    maxString: Math.max(...strings),
    multi: strings.filter((n) => n >= 2).length,
    singles: strings.filter((n) => n === 1).length,
    basicsPerKFrame: +(1000 * seq.length / fr).toFixed(2),
    phase2: !!m._bossPhase2,
  };
}, phase2);

const p1 = await run(false);
const p2 = await run(true);
await browser.close();
console.log(`  phase 1: ${JSON.stringify(p1)}`);
console.log(`  phase 2: ${JSON.stringify(p2)}`);

check(!p1.noBoss, 'King Krook is in the arena', p1.saw);
check(p1.basics >= 6, 'the survey saw him throw basics', p1.basics);
check(p1.maxString >= 2, 'phase 1: basics arrive in strings, not one at a time', p1.strings);
check(p1.multi >= 2, 'phase 1: stringing is his normal behaviour, not a one-off', { multi: p1.multi, singles: p1.singles });
check(p2.phase2 === true, 'the phase-2 run really is in phase 2', p2.phase2);
check(p2.maxString >= 3, 'phase 2: strings grow to three beats', p2.strings);
// Not a stealth buff. The load-bearing half of that is the SPECIALS — his
// dangerous attacks — and they must keep coming. Strings originally starved
// them: the random special bands roll once per decision, and a string used to
// eat a whole decision, so phase 2 lost 22% of its specials. Both phases must
// still see specials in a window this size.
// (Rate parity against the old build was established separately, by a 12k-frame
// census with nothing suppressed. This run suppresses three specials to isolate
// the basic cadence, so it can only show that specials still break the strings.)
// Pooled across both runs on purpose. This setup suppresses three specials to
// isolate the basic cadence, leaving earthquake and rain at 15/15 — about 2.7
// expected per run, so a per-run threshold of 3 would sit on the mean and flap.
check(p1.specials + p2.specials >= 3, 'specials still interrupt the strings',
      { p1: p1.specials, p2: p2.specials });
// Basics run modestly busier (beats inside a string are cheap); this is the
// ceiling, not the target. Base measured 1.0-1.5 per 1000 frames.
check(p1.basicsPerKFrame <= 3.0, 'phase 1 basic rate stays in the same band as before', p1.basicsPerKFrame);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
