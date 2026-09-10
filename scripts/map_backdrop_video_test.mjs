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

const CLIPS = { town: 'backgrounds/everdawn.mp4', gravitosArena: 'backgrounds/gravitos.mp4' };
const PLATES = { town: 'backgrounds/bg_v3_everdawn_central.webp', gravitosArena: 'backgrounds/bg_v3_gravitosArena.webp' };
for (const [id, clip] of Object.entries(CLIPS)) {
  const mb = existsSync(clip) ? statSync(clip).size / 1048576 : 0;
  ok(`${id}: the clip ships (${clip})`, mb > 0.5 && mb < 12, { mb: +mb.toFixed(1) });
  ok(`${id}: ...and is committed`, execFileSync('git', ['ls-files', '--', clip], { encoding: 'utf8' }).trim() === clip, {});
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
ok('...and paints the plate first while the ramp runs', /_bgVid && bgPick && _lxMapVideoAlpha < 1/.test(src), {});
ok('...and resets globalAlpha after the mirrored copy', /if \(_bgVid\) ctx\.globalAlpha = 1;/.test(src), {});
ok('loadMap sleeps the other clips and warms this one', src.includes('_lxMapVideoRest(id); _lxMapVideoEnsure(id);'), {});
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
