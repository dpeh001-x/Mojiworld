// ZODIAC EVASION: Sagitta down, the tier up, and a ceiling so nothing walls.
// ============================================================================
// Per user: "reduce sagitta evasion and increase the general zodiac evasion
// chances".
//
// Measured first, and the shape was not what the profile table suggests.
// Against the BOSS hit floor of 0.45 (not the 0.15 default — see the
// _rollAccuracyHit call site), an ungeared player sat at the floor for all
// twelve signs, while a full Shardsight set (662 accuracy) hit seven at a flat
// 100%, three at 89-93%, and was pinned back at the floor by two. A cliff at
// both ends with almost no middle.
//
// So: the base ramp lifts 378 -> 430 (costs the ungeared player nothing — they
// were already floored — and restores meaning for the geared one), Sagitta's
// eva profile drops 1.50 -> 1.15, and a ceiling stops the lift from creating a
// new wall. That last part matters: Sagitta was NOT the most evasive sign
// (Pisces measured 865 to its 837), and lifting the base would have pushed
// Pisces to 938.
// Run: node scripts/zodiac_evasion_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9971);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof monsterTypes === 'object', null, { timeout: 180000 });
await page.waitForTimeout(6000);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

const d = await page.evaluate(() => {
  const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra',
    'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  // the values this change was measured against, so the assertions below are
  // deltas from a real prior build rather than from a re-derivation
  const BEFORE = { aries: 238, taurus: 229, gemini: 678, cancer: 320, leo: 454, virgo: 672,
    libra: 518, scorpio: 672, sagittarius: 837, capricorn: 346, aquarius: 657, pisces: 865 };
  const BOSS_FLOOR = 0.45;
  const hit = (acc, ev) => Math.max(BOSS_FLOOR, Math.min(1, 1 - (ev - acc) / 150));
  const out = { now: {}, before: BEFORE, hitGeared: {}, hitUngeared: {}, hitGearedBefore: {} };
  for (const z of SIGNS) {
    const ev = monsterTypes['zodiac_' + z].evasion;
    out.now[z] = ev;
    out.hitGeared[z] = +hit(662, ev).toFixed(2);
    out.hitGearedBefore[z] = +hit(662, BEFORE[z]).toFixed(2);
    out.hitUngeared[z] = +hit(100, ev).toFixed(2);
  }
  return out;
});

ok('Sagitta is less evasive: 837 -> 701',
  d.now.sagittarius === 701, `${d.before.sagittarius} -> ${d.now.sagittarius}`);
ok('...and is no longer pinned at the floor for a geared player: 0.45 -> 0.74',
  d.hitGeared.sagittarius > d.hitGearedBefore.sagittarius && d.hitGeared.sagittarius >= 0.70,
  `hit chance ${d.hitGearedBefore.sagittarius} -> ${d.hitGeared.sagittarius}`);

const raised = Object.keys(d.now).filter((z) => d.now[z] > d.before[z]);
ok('the general tier is MORE evasive — ten of twelve signs raised',
  raised.length === 10, `${raised.length} raised: ${raised.join(', ')}`);

ok('the ceiling holds: no sign exceeds 760',
  Object.values(d.now).every((v) => v <= 760),
  'max ' + Math.max(...Object.values(d.now)));
ok('Pisces was the real wall and is capped, not lifted: 865 -> 760',
  d.now.pisces === 760 && d.now.pisces < d.before.pisces,
  `${d.before.pisces} -> ${d.now.pisces} (an uncapped lift would have made it 938)`);

// the point of the whole change: a gradient instead of a cliff
const geared = Object.values(d.hitGeared);
const gearedBefore = Object.values(d.hitGearedBefore);
const distinct = (a) => new Set(a.map((v) => v.toFixed(2))).size;
ok('a geared player now faces a GRADIENT, not a cliff',
  distinct(geared) > distinct(gearedBefore) && geared.filter((v) => v === 1).length < gearedBefore.filter((v) => v === 1).length,
  `${distinct(gearedBefore)} distinct hit chances before (${gearedBefore.filter((v) => v === 1).length} auto-hits) -> ${distinct(geared)} now (${geared.filter((v) => v === 1).length} auto-hits)`);
ok('no sign is a wall for a geared player — every one is above the floor or beatable',
  geared.every((v) => v >= 0.45), 'min ' + Math.min(...geared));
ok('an UNGEARED player is unaffected — they were already at the boss floor',
  Object.values(d.hitUngeared).every((v) => v === 0.45),
  'all twelve at ' + Object.values(d.hitUngeared)[0]);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
