// The baked platform tint must (a) exist and be well-formed, (b) be consulted BEFORE any pixel
// readback, and (c) not have been hand-edited into disagreeing with the game's own sampler.
// Why it matters: the sampler's readback cost 39-67 ms on the first drawn frame of every map.
//   node scripts/map_platform_tint_test.mjs   (MOJI_GAME_FILE overrides the game)
import { readFileSync, existsSync } from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(process.env.MOJI_GAME_FILE || path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
const TBL = path.join(ROOT, 'data', 'map_platform_tint.js');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  ' + x : '')); };
ok('data/map_platform_tint.js ships', existsSync(TBL));
const src = existsSync(TBL) ? readFileSync(TBL, 'utf8') : '';
let tbl = null; try { tbl = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1)); } catch (e) {}
ok('the table parses', !!tbl, tbl ? `${Object.keys(tbl).length} maps` : 'parse failed');
if (tbl) {
  const bad = Object.entries(tbl).filter(([, v]) => !v || !/^#[0-9a-fA-F]{6}$/.test(v.top || '') || !/^#[0-9a-fA-F]{6}$/.test(v.body || ''));
  ok('every entry is a { top, body } pair of 6-digit hex', bad.length === 0, bad.slice(0, 3).map(([k]) => k).join(', '));
  const maps = [...game.matchAll(/^  ([A-Za-z_0-9]+):\s*\{/gm)].map((m) => m[1]);
  const known = Object.keys(tbl).filter((k) => game.includes(`'${k}'`) || game.includes(`"${k}"`) || maps.includes(k));
  ok('the table is keyed on ids the game knows', known.length >= Object.keys(tbl).length * 0.9, `${known.length}/${Object.keys(tbl).length}`);
  ok('the table covers a real share of the roster (not a stub)', Object.keys(tbl).length >= 80, `${Object.keys(tbl).length} maps`);
}
ok('the game loads the table', /<script src="data\/map_platform_tint\.js"><\/script>/.test(game));
// the lookup has to sit BEFORE the sampler, or it saves nothing
const iLookup = game.indexOf('window.LX_MAP_PLATFORM_TINT[id]');
const iSample = game.indexOf('_lxDominantColor(bg, sky)');
ok('the baked lookup runs before the pixel sampler', iLookup > 0 && iSample > 0 && iLookup < iSample, `lookup@${iLookup} sampler@${iSample}`);
ok('a hit is cached as fromBg, so it is resolved once and never recomputed',
  /_MAP_PLATFORM_TINT_CACHE\[id\] = \{ tint: _bt, fromBg: true \}/.test(game));
ok('the live sampler survives for maps the table does not know', iSample > 0 && /const dom = bg \? _lxDominantColor\(bg, sky\) : null;/.test(game));
// the generator must SAMPLE, not echo: with the table loaded, _mapPlatformTint answers from it before the sampler runs, so a run
// that leaves it in place writes the old values back and its --check passes in a loop (a redrawn backdrop kept its old tint)
{ const gp = path.join(ROOT, 'scripts', 'gen_map_platform_tint.mjs'), gsrc = existsSync(gp) ? readFileSync(gp, 'utf8') : '';
  const iClear = gsrc.indexOf('window.LX_MAP_PLATFORM_TINT = {};'), iLoop = gsrc.indexOf('for (const id of ids)');
  ok('the generator empties the baked table and the resolver cache before it samples, and drops each map\'s entry before loading it',
    iClear > 0 && iLoop > iClear && /for \(const k of Object\.keys\(_MAP_PLATFORM_TINT_CACHE\)\) delete _MAP_PLATFORM_TINT_CACHE\[k\];/.test(gsrc)
    && /delete _MAP_PLATFORM_TINT_CACHE\[id\];\s*try \{ loadMap\(id\); \}/.test(gsrc), `clear@${iClear} loop@${iLoop}`); }
// per user ("Keep today's colours"): re-sampling would have dulled two maps' ledges to match their redrawn plates; they keep the
// colours they had as set (authored) pairs, which beat the table - and the table, re-sampled, records the same pairs
{ const SET = { stormCrest: ['#b2ddf5', '#3d445a'], ancient: ['#355f4d', '#161c24'] }, miss = [];
  for (const [k, [t, b]] of Object.entries(SET)) { const i = game.indexOf('\n  ' + k + ': {'), j = i < 0 ? -1 : game.indexOf('\n  },', i);
    if (i < 0 || !game.slice(i, j).includes(`platTint: { top:'${t}', body:'${b}' }`) || !tbl || !tbl[k] || tbl[k].top !== t || tbl[k].body !== b) miss.push(k); }
  ok('Storm Crest and Elderwood keep their ledge colours as set pairs, and the table agrees', miss.length === 0, miss.join(', ')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exitCode = fail ? 1 : 0;
