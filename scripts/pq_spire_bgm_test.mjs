// CLOCKWORK SPIRE BGM — regression guard.
// ============================================================================
// Reported as "the music for this map is the first stage, change up to a more
// appropriate music". Measured cause: clockworkSpire had NO entry in
// _BGM_MAP_FILES at all, so Solo PQ Stage 2 — the only jump-quest map in the
// chain — fell through to the DEFAULT overworld theme (bgm_mojiworld.mp3),
// while stage 1 (clockworkUnderpassLobby), the Carriage (tower) and the
// Express all play Train PQ.mp3.
//
// Drives the live audio router (_setBossBgm, the same call loadMap makes)
// rather than reading the table, and asserts for every stage of the chain:
//   1. the Spire resolves to a per-map track, not the default world theme
//   2. it is NOT stage 1's track (the user asked for a change, not a match)
//   3. the sibling stages still share Train PQ.mp3 with each other
// Run: node scripts/pq_spire_bgm_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9294;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'BgmTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

// The prologue cinematic parks BGM requests (_cineOwnsMix) — release the mix,
// otherwise _setBossBgm returns early and every map measures identical.
const heard = async (mapId) => await page.evaluate((id) => {
  try { _cineOwnsMix = false; } catch (e) {}
  const short = (u) => u ? decodeURIComponent(u).split('/').slice(-1)[0] : null;
  _setBossBgm(!!(typeof MAPS !== 'undefined' && MAPS[id] && MAPS[id].isBossArena), id);
  return {
    perMap: (typeof _bgmActiveMapEl !== 'undefined' && _bgmActiveMapEl) ? short(_bgmActiveMapEl.src) : null,
    fellBackToDefault: !(typeof _bgmActiveMapEl !== 'undefined' && _bgmActiveMapEl),
  };
}, mapId);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 90) });

const lobby  = await heard('clockworkUnderpassLobby');
const spire  = await heard('clockworkSpire');
const carr   = await heard('tower');
const expr   = await heard('clockworkExpress');

ok('stage 1 lobby plays Train PQ', lobby.perMap === 'Train PQ.mp3', lobby.perMap);
ok('Carriage plays Train PQ',      carr.perMap  === 'Train PQ.mp3', carr.perMap);
ok('Express plays Train PQ',       expr.perMap  === 'Train PQ.mp3', expr.perMap);

ok('Spire does NOT fall back to the default world theme', spire.fellBackToDefault === false,
   spire.fellBackToDefault ? 'fell through to bgm_mojiworld.mp3' : spire.perMap);
ok('Spire has its own per-map track', !!spire.perMap, spire.perMap);
ok('Spire is NOT stage 1\'s track', spire.perMap && spire.perMap !== lobby.perMap, spire.perMap);
ok('Spire is not the generic boss theme', spire.perMap !== 'bgm_boss.mp3', spire.perMap);

await browser.close(); server.kill();
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
