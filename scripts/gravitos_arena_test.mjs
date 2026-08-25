#!/usr/bin/env node
// Per user: option 10 "the arena fights back", scoped to Gravitos, plus "make
// the map background tint darker with gravitos2 and even darker with gravitos3".
//
// Drives the REAL transition path — killMonster(m) on a spawned Gravitos is
// what promotes him from form 1 to 2 to 3 — then advances the production tick
// past the collapse telegraph and reads the arena back.
//
// The four assertions that matter are the SAFETY ones, not the feature ones.
// A collapse that eats the wrong slab does not look like a bug, it looks like a
// hard difficulty spike:
//   * the y:480 ground must survive. It is full-width and this map runs 3x
//     gravity; a hole in it is an unrecoverable fall.
//   * the y:260 centre must survive. collapseRain hard-codes midPlatY = 260
//     when it places safe boxes, so dropping it would suspend 40% of that
//     pattern's MANDATORY dodge targets over a pit.
//   * MAPS.gravitosArena must come back untouched. _variedMapData used to
//     shallow-copy boss-arena platforms (.slice() copies the array, not the
//     objects), so writing per-fight state to one wrote through to the source
//     table — the arena would have stayed collapsed for the rest of the session.
//   * a launch pad whose platform fell must fall with it, or it hangs over a
//     hole still launching.
//
//   node scripts/gravitos_arena_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof killMonster === 'function', { timeout: 90000 });

const out = await page.evaluate(async () => {
  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise((r) => setTimeout(r, 20000))]); } catch (e) {}

  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 160) });

  // Top-level `let`/`const` are NOT window properties — they live in the global
  // lexical environment and are only reachable by bare name.
  const tintTo = () => { try { return _lxGravTintTo; } catch (e) { return null; } };
  const tintCur = () => { try { return _lxGravTintCur; } catch (e) { return null; } };
  const hasFeature = (() => { try { return typeof _lxGravCollapse === 'function'; } catch (e) { return false; } })();
  ok('the collapse system is present at all', hasFeature);
  if (!hasFeature) return res;

  loadMap('gravitosArena');
  player.cls = 'warrior'; player.level = 100; player._god = true; game.paused = false;

  const floating = () => (game.mapData.platforms || []).filter((p) => p.type !== 'ground').length;
  const at = (x, y) => (game.mapData.platforms || []).some((p) => p.x === x && p.y === y);
  const ground = () => (game.mapData.platforms || []).filter((p) => p.type === 'ground');
  const pads = () => (game.mapData.launchPads || []).length;
  // Advance the PRODUCTION tick past the 900 ms telegraph in 16 ms steps, the
  // way the update loop does — not one 1000 ms jump, which would skip the
  // telegraph's own per-frame state entirely.
  const settle = (ms) => { for (let t = 0; t < ms; t += 16) _lxGravArenaTick(16); };

  const p0 = floating(), pad0 = pads(), t0 = tintTo();
  ok('arena starts with 7 floating platforms + 5 pads', p0 === 7 && pad0 === 5, `platforms ${p0}, pads ${pad0}`);
  ok('form 1 tint is the authored 0.42', Math.abs(t0 - 0.42) < 0.001, `tint ${t0}`);

  for (const q of (game.monsters || [])) q.currentHp = 0;
  game.monsters.length = 0;
  spawnMonster(1100, 300, 'gravitos', false, false);
  const m = game.monsters.find((q) => q && q.type === 'gravitos');
  if (!m) { ok('gravitos spawned', false); return res; }

  // ---- FORM 1 -> 2 -------------------------------------------------------
  m.currentHp = 0;
  killMonster(m);
  ok('form 2 reached', m._gravitosPhase === 2, `phase ${m._gravitosPhase}`);
  const midTell = floating();
  ok('platforms are still SOLID during the telegraph', midTell === 7, `still standing: ${midTell}`);
  settle(1100);
  const p2 = floating(), t2 = tintTo();
  ok('form 2 drops the two high perches (7 -> 5)', p2 === 5, `floating ${p2}`);
  ok('...and it was the y:180 pair', !at(340, 180) && !at(1700, 180));
  ok('form 2 tint is darker than form 1', t2 > t0 + 0.1, `${t0} -> ${t2}`);

  // ---- FORM 2 -> 3 -------------------------------------------------------
  m.currentHp = 0;
  killMonster(m);
  ok('form 3 reached', m._gravitosPhase === 3, `phase ${m._gravitosPhase}`);
  settle(1100);
  const p3 = floating(), t3 = tintTo(), pad3 = pads();
  ok('form 3 drops the y:320 pair (5 -> 3)', p3 === 3, `floating ${p3}`);
  ok('...and it was the y:320 pair', !at(500, 320) && !at(1500, 320));
  ok('form 3 tint is darker still', t3 > t2 + 0.1, `${t2} -> ${t3}`);
  ok('the 2 pads riding those platforms fell with them', pad3 === 3, `pads ${pad0} -> ${pad3}`);
  ok('...and all 3 GROUND pads survived',
     (game.mapData.launchPads || []).every((q) => q.y === 480), JSON.stringify((game.mapData.launchPads || []).map((q) => q.y)));

  // ---- SAFETY ------------------------------------------------------------
  const g = ground();
  ok('SAFETY: the full-width ground is untouched',
     g.length === 1 && g[0].x === 0 && g[0].w === 2200, JSON.stringify(g.map((q) => [q.x, q.w])));
  ok('SAFETY: the y:260 centre survives (collapseRain targets it)', at(900, 260));
  ok('SAFETY: arena is still traversable (ground + 3 floating + 3 pads)',
     p3 === 3 && g.length === 1 && pad3 === 3);

  // The eased tint must actually converge in the DRAW path. Nothing here calls
  // it directly — if the render hook is missing, _lxGravTintCur never moves.
  await new Promise((r) => setTimeout(r, 1600));
  const cur = tintCur();
  ok('the tint is actually applied by the render path', cur != null && Math.abs(cur - t3) < 0.05,
     `eased ${cur == null ? 'null' : (+cur).toFixed(3)} toward target ${t3}`);

  // ---- THE SHALLOW-COPY REGRESSION --------------------------------------
  const src = MAPS.gravitosArena.platforms;
  ok('MAPS.gravitosArena still holds all 8 platforms', src.length === 8, `source has ${src.length}`);
  ok('...and none of them carries per-fight state', src.every((p) => !p._lxDoomed));
  ok('MAPS.gravitosArena still holds all 5 launch pads',
     (MAPS.gravitosArena.launchPads || []).length === 5, `source pads ${(MAPS.gravitosArena.launchPads || []).length}`);
  loadMap('gravitosArena');
  ok('re-entering the arena gives an INTACT arena', floating() === 7 && pads() === 5,
     `floating ${floating()}, pads ${pads()}`);
  ok('re-entry resets the tint to form 1', Math.abs(tintTo() - 0.42) < 0.001, `tint ${tintTo()}`);

  return res;
});
await browser.close();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + FILE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
