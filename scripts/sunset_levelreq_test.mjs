// Sunset Coast is Lv 3+. Reads the LIVE MAPS object, because the source's
// authored levelReq is not the runtime value — a sweep rewrites it (see the
// comment at the exemption list). Asserting on source text would pass while
// the game shipped Lv 1.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv[2] || 'mojiworld_game.html';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
await p.goto('file:///' + path.join(ROOT, FILE).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => typeof MAPS !== 'undefined' && Object.keys(MAPS).length > 50, { timeout: 60000 });

const r = await p.evaluate(() => ({
  sunset: MAPS.sunsetBeach && MAPS.sunsetBeach.levelReq,
  // the four pre-existing exemptions must be untouched by the new `continue`
  exempt: ['distortedThreshold', 'fracturedReflection', 'bloomhaven', 'thornspireThicket']
    .map((id) => [id, MAPS[id] && MAPS[id].levelReq]),
  // Ordinary open maps must still sweep to 1 — the exemption must not leak.
  // slimeCave is deliberately NOT in this list: measured against unpatched
  // origin/main it already reads 10, so it is not a swept map and asserting
  // 1 on it fails identically before and after the change.
  open: ['tidalLagoon', 'town', 'mushroom', 'verdantHollow']
    .filter((id) => MAPS[id]).map((id) => [id, MAPS[id].levelReq]),
  // Proof the sweep still runs at all. An upper bound on the above-1 count was
  // the other wrong assertion — baseline is 44, so "< 40" failed on unpatched
  // origin too. What actually matters is that the sweep still flattens the
  // bulk of the world; count the maps it left at exactly 1.
  atOne: Object.keys(MAPS).filter((id) => MAPS[id].levelReq === 1).length,
  aboveOne: Object.keys(MAPS).filter((id) => (MAPS[id].levelReq || 0) > 1).length,
}));
await b.close();

let fail = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)})`}`); if (!ok) fail++; };

check('sunsetBeach levelReq === 3', r.sunset === 3, r.sunset);
for (const [id, v] of r.exempt) check(`${id} exemption intact (>1)`, (v || 0) > 1, v);
for (const [id, v] of r.open) check(`${id} still sweeps to 1`, v === 1, v);
check('sweep still runs (many maps at exactly 1)', r.atOne > 30, r.atOne);
console.log(`\nmaps at Lv 1: ${r.atOne}   above Lv 1: ${r.aboveOne}`);
console.log(fail ? `\n${fail} FAILED` : '\nall green');
process.exit(fail ? 1 : 0);
