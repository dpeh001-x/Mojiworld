// Guard against shipping a stale depot. The Steam build live on 3 Aug was
// packaged BEFORE the controller fixes landed, and nothing flagged it: both the
// depot and the repo read GAME_VERSION v0.29.410, because the version was bumped
// before the build and the later commits did not bump it again.
//
// This compares the packaged artefact against the working tree for a set of
// marker strings, so "did my fix actually ship?" has an answer that does not
// depend on the version stamp.
//
//   node scripts/verify_depot_matches_repo.mjs
import { readFileSync, existsSync } from 'node:fs';

const ASAR = 'steam/release/win-unpacked/resources/app.asar';
const GAME = 'steam/release/win-unpacked/resources/app/mojiworld_game.html';
if (!existsSync(ASAR) || !existsSync(GAME)) {
  console.error('No packaged build found — run `cd steam && npx electron-builder --win dir` first.');
  process.exit(2);
}
const b = readFileSync(ASAR);
const hdrSize = b.readUInt32LE(4), jsonLen = b.readUInt32LE(12);
const header = JSON.parse(b.slice(16, 16 + jsonLen).toString('utf8'));
const base = 16 + hdrSize - 8;
const fromAsar = (n) => { const e = header.files[n]; if (!e) return '';
  return b.slice(base + +e.offset, base + +e.offset + e.size).toString('utf8'); };

const shippedGame = readFileSync(GAME, 'utf8');
const repoGame = readFileSync('mojiworld_game.html', 'utf8');
const shippedPreload = fromAsar('preload.js');
const repoPreload = readFileSync('steam/preload.js', 'utf8');

// marker, which pair, human description
const MARKERS = [
  ['v0.29.x — was gated on `onDeck`', 'preload', 'Big Picture keyboard ungated'],
  ["'lo-auth', 'settings-modal-bg'",  'game',    'title screen pad-navigable'],
  ['_veryLowFxImpact',                'game',    'class hit spark in boss fights'],
  ['applyArcherBowCounter',           'game',    'archer bow decoupled'],
  ['phase === 2 ? 5 : 3',             'game',    'Gravitos phase-2 grading'],
  ['!game.mapData.isZodiac) return',  'game',    'rune columns zodiac-only'],
];

let stale = 0, skipped = 0;
for (const [marker, which, desc] of MARKERS) {
  const shipped = which === 'game' ? shippedGame : shippedPreload;
  const repo = which === 'game' ? repoGame : repoPreload;
  if (!repo.includes(marker)) { skipped++; console.log(`SKIP     ${desc} (marker absent from repo — moved or renamed)`); continue; }
  const ok = shipped.includes(marker);
  if (!ok) stale++;
  console.log(`${ok ? 'SHIPPED ' : 'STALE   '} ${desc}`);
}

const gv = (/GAME_VERSION = '([^']+)'/.exec(shippedGame) || [])[1];
const rv = (/GAME_VERSION = '([^']+)'/.exec(repoGame) || [])[1];
const appid = fromAsar('steam_appid.txt').trim();
console.log(`\ndepot GAME_VERSION ${gv}   repo GAME_VERSION ${rv}   ${gv === rv ? '(equal — note this proves NOTHING about freshness)' : '(DIFFERENT)'}`);
console.log(`depot steam_appid.txt ${JSON.stringify(appid)}`);
console.log(`\n${MARKERS.length - stale - skipped}/${MARKERS.length - skipped} checked fixes are present in the packaged build`);
if (stale) console.log('\nThe depot is STALE. Rebuild before uploading, or players get code you already fixed.');
process.exit(stale ? 1 : 0);
