// Map backdrop videos: the clips ship, and the game is actually wired to paint them.
//
// Per user: "backgrounds/everdawn should replace as the background for everdawn central (can use
// video or GIF whichever loads faster), fallback to bg_v3_everdawn_central if unable to load fast
// enough. same concept for backgrounds/gravitos to replace bg_v3_gravitosArena".
//
// The interesting failures are all silent ones - a clip that is on disk but not committed, a table
// row without the draw hook, a hook without the loadMap rest - because the runtime falls back to
// the plate in every one of them and nothing errors. So each link in the chain is asserted from
// the source, and the clips themselves are probed when ffprobe is on the PATH.
//   node scripts/map_backdrop_video_test.mjs [path/to/mojiworld_game.html]
import { existsSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const GAME = process.argv[2] || 'mojiworld_game.html';
const src = readFileSync(GAME, 'utf8');

// gravitosFinale is not a map but a STATE of gravitosArena (once form 2 falls); it shares that
// map's plate as its fallback
const CLIPS = { town: 'backgrounds/everdawn.mp4', gravitosArena: 'backgrounds/gravitos.mp4', gravitosFinale: 'backgrounds/gravitosfinale.mp4' };
const PLATES = { town: 'backgrounds/bg_v3_everdawn_central.webp', gravitosArena: 'backgrounds/bg_v3_gravitosArena.webp', gravitosFinale: 'backgrounds/bg_v3_gravitosArena.webp' };
for (const [id, clip] of Object.entries(CLIPS)) {
  const mb = existsSync(clip) ? statSync(clip).size / 1048576 : 0;
  ok(`${id}: the clip ships (${clip})`, mb > 0.5 && mb < 12, { mb: +mb.toFixed(1) });
  // Checked against the PUSHED tree, not the local index. This repo is edited by several sessions
  // that commit through plumbing against origin/main, so the working copy's HEAD and index are
  // routinely many commits stale; `git ls-files` answered "not committed" for clips that were
  // already on origin, which is the wrong signal in exactly the situation this test exists for.
  const inTree = (ref) => { try { return execFileSync('git', ['ls-tree', '--name-only', ref, '--', clip], { encoding: 'utf8' }).trim() === clip; } catch (e) { return false; } };
  ok(`${id}: ...and is committed (in origin/main, or HEAD if there is no remote)`, inTree('origin/main') || inTree('HEAD'), {});
  ok(`${id}: the fallback plate still exists`, existsSync(PLATES[id]), {});
  ok(`${id}: the map is in the _LX_MAP_VIDEO table pointing at that clip`, new RegExp(`${id}:\\s+'${clip}'`).test(src), {});
  // the clip itself, when a probe is available: h264 keeps hardware decode on every target; a
  // short loop keeps the file small; 16:9-ish matches the plates it replaces
  try {
    const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
      'stream=codec_name,width,height:format=duration', '-of', 'json', clip], { encoding: 'utf8' }));
    const s = j.streams[0], dur = +j.format.duration;
    ok(`${id}: h264 and short (${s.codec_name}, ${dur.toFixed(1)}s)`, s.codec_name === 'h264' && dur > 2 && dur < 12, {});
    ok(`${id}: near the plate's aspect (${(s.width / s.height).toFixed(3)} vs 1.784)`, Math.abs(s.width / s.height - 1.784) < 0.05, {});
  } catch (e) { ok(`${id}: ffprobe not available - clip properties not checked`, true, { skipped: true }); }
}
// the chain: table -> draw hook -> loadMap hook. Any one missing and the clips are dead art.
ok('drawBackground asks for the frame in the plate slot', src.includes('_lxMapVideoFrame(game.currentMap)'), {});
// v0.30.565 — the underlay is the outgoing clip when there is one and the plate otherwise; either way
// it is painted first and the incoming clip fades over it
ok('...and paints an underlay first while the ramp runs (outgoing clip, else the plate)', /const _bgUnder = \(_bgVid && _lxMapVideoAlpha < 1\)/.test(src) && /if \(_bgUnder\) \{\n\s*const _pl = _bgUnder;/.test(src), {});
ok('...and resets globalAlpha after the mirrored copy', /if \(_bgVid\) ctx\.globalAlpha = 1;/.test(src), {});
ok('loadMap sleeps the other clips and warms this one', src.includes('_lxMapVideoRest(id); _lxMapVideoEnsure(id);'), {});
// the finale: a clip switch driven by the fight, riding the same hooks as the arena's tint
ok('the map resolves its clip key (gravitosArena -> gravitosFinale once form 2 falls)', /function _lxMapVideoKeyFor\(mapId\)[\s\S]{0,200}mapId === 'gravitosArena' && _lxGravFinaleBg\) return 'gravitosFinale'/.test(src), {});
ok('the draw site still asks by MAP id, so the marker and the hook did not move', src.split('_lxMapVideoFrame(game.currentMap)').length - 1 === 1, {});
ok('form 2 falling sets the finale flag (in _lxGravCollapse, phase 3)', /if \(\(phase \| 0\) === 3\) _lxGravFinaleBg = true;/.test(src), {});
ok('form 1 falling warms the finale clip, paused (phase 2)', /\(phase \| 0\) === 2\) \{ const _fv = _lxMapVideoEnsure\('gravitosFinale'\); if \(_fv\) \{ try \{ _fv\.autoplay = false; _fv\.pause\(\);/.test(src), {});
ok('every arena entry clears it (in _lxGravArenaReset)', /_lxGravTintTo = _LX_GRAV_TINT\[1\];\n\s*_lxGravFinaleBg = false;/.test(src), {});
ok('a mid-map switch crosses clip to clip, not clip to plate', /_lxMapVideoUnder\(\)\) \|\| \(bgPick \? _lxBgScaled\(bgPick, _bgW, _bgH\) : null\)/.test(src) && /_lxMapVideoPrev = \(_lxMapVideoAlphaFor && _lxMapVideoEls\[_lxMapVideoAlphaFor\]\) \|\| null;/.test(src), {});
ok('...and the outgoing clip is paused once the fade completes', /_lxMapVideoAlpha >= 1 && _lxMapVideoPrev\) \{ try \{ _lxMapVideoPrev\.pause\(\);/.test(src), {});
ok("the Void's own sky hook is untouched", src.split("_voidVideoRest();").length - 1 === 1, {});
ok('the clip yields to prefers-reduced-motion and data-saver', /prefers-reduced-motion: reduce.*\n?.*saveData/s.test(src.slice(src.indexOf('function _lxMapVideoAllowed'), src.indexOf('function _lxMapVideoAllowed') + 600)), {});
ok('a hidden tab pauses the clips', /visibilitychange.*_lxMapVideoRest\(null\)/.test(src), {});
// packaging: backgrounds/** is the whole folder, so an mp4 there ships to Steam without a listing
const pkg = readFileSync('steam/package.json', 'utf8');
ok('steam packaging ships backgrounds/** wholesale', /"backgrounds\/\*\*"/.test(pkg), {});
// the worker must NOT own these: cache.match ignores Range, and a ranged media request answered
// from cache is the classic stall
const sw = readFileSync('sw.js', 'utf8');
const re = sw.match(/const ASSET_RE = (\/.*?\/i);/);
ok('the service worker leaves mp4 alone (not in ASSET_RE)', re && !/mp4/.test(re[1]), { ASSET_RE: re && re[1] });

const fails = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x && Object.keys(r.x).length ? '  ' + JSON.stringify(r.x) : ''));
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);
