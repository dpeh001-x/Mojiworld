// A boss fight must not decode full-size boss art on the main thread.
//
// Boss frames are 1100-1656 px against a 1104 px draw cap. A raw frame handed to the canvas is a
// synchronous decode of up to 2.5 MP (40-65 ms each, measured), so the build must (1) have baked the
// boss's current form before the fight - _lxBossBakeQueue at spawn - (2) never blit a raw over-cap frame
// while its set bakes - _lxBossStandIn, one held frame per set at most - and (3) answer bbox questions from
// data/sprite_bbox.js rather than a scan of the raw source. Driven by scripts/perf_boss_decode_bench.mjs,
// which draws every animation set of the arena's boss through the game's own picker and draw.
//
//   SERVE_ROOT=<dir with the game's Sprites/ and data/> node scripts/boss_decode_stall_test.mjs [candidate.html]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cand = process.argv[2] || '';
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
const bench = (map, extra) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'perf_boss_decode_bench.mjs')].concat(cand ? [cand] : []), { encoding: 'utf8', env: Object.assign({}, process.env, { MAP: map, T: '11000', SET_MS: '1000', PERF_PORT: String(9700 + Math.floor(Math.random() * 200)) }, extra || {}), timeout: 420000 });
  const line = (r.stdout || '').split(/\r?\n/).find((l) => l.startsWith('JSON '));
  if (!line) { console.log((r.stdout || '') + (r.stderr || '')); return null; }
  return JSON.parse(line.slice(5));
};

// ---- Gravitos: the heaviest family (1656 px; three forms, four attack sets each) ----
const g = bench('gravitosArena');
check(!!g, 'the bench ran in the Gravitos arena', g ? `boss ${g.boss}, ${g.sets.length} sets` : 'no JSON');
if (g) {
  check(g.art404 === 0 && g.marks >= 2, 'the art was served and the trace saw the set marks', `404s ${g.art404}, marks ${g.marks}`);
  const form = g.sets.filter((s) => !s.phase), phase = g.sets.filter((s) => s.phase);
  const unbaked = form.filter((s) => s.rawBefore > 0);
  check(form.length >= 5 && !unbaked.length, "the boss's current form was baked before the fight (spawn queue)", unbaked.map((s) => `${s.label} ${s.rawBefore}/${s.n} raw`).join(', ') || `${form.length} sets, all baked`);
  const formRaw = form.reduce((a, s) => a + s.rawBlits, 0);
  check(formRaw === 0, 'no raw over-cap blit while drawing the current form', `${formRaw} raw blits`);
  const heldTooMuch = phase.filter((s) => s.rawBlits > 1);
  check(phase.length >= 6 && !heldTooMuch.length, 'a phase form met mid-fight costs at most one held frame per set, not one per frame', heldTooMuch.map((s) => `${s.label} ${s.rawBlits}`).join(', ') || `${phase.length} phase sets`);
  const bboxScans = Object.entries(g.rawStacks || {}).filter(([k]) => /_detectSpriteBbox/.test(k)).reduce((a, [, n]) => a + n, 0);
  check(bboxScans === 0, 'no bbox scan of a raw source (data/sprite_bbox.js covers the boss art)', `${bboxScans} scans; ${JSON.stringify(g.rawStacks)}`);
  const formDecodes = form.reduce((a, s) => a + s.decodes, 0);
  check(formDecodes <= 12, 'main-thread image decodes while the current form animates stay near zero', `${formDecodes} decodes over ${form.length} sets (was 71 before the queue)`);
  check(g.raw <= phase.length, 'raw over-cap blits across all 20 sets are bounded by the phase sets', `${g.raw} raw blits, ${phase.length} phase sets (was 109)`);
}

// ---- a zodiac boss: its own frame stores, keyed by sign ----
const z = bench('zod_leo', { PHASES: '0' });
check(!!z, 'the bench ran in the Leo arena', z ? `boss ${z.boss} (${z.sign}), ${z.sets.length} sets` : 'no JSON');
if (z) {
  const unbaked = z.sets.filter((s) => s.rawBefore > 0);
  check(z.art404 === 0 && !unbaked.length, "a zodiac boss's sets are baked before the fight too", unbaked.map((s) => `${s.label} ${s.rawBefore}/${s.n}`).join(', ') || `${z.sets.length} sets baked`);
  check(z.raw === 0, 'no raw over-cap blit drawing the zodiac boss', `${z.raw} raw blits`);
}
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
