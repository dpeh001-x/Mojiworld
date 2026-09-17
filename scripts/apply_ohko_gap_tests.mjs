// ohko-gap: two existing tests learn the strict rest.
//   * grav_safezone_all_test.mjs - its form-3 cadence check waits for a NATURAL rain: the OHKO window now runs from the
//     last OHKO's END in form 3, so the test clears that stamp too; and form-3 boxes are 1.4 s + a 5 s rest apart.
//   * gravitos_rain_reach_test.mjs - forces 30 boxes by resetting _rainIdx, but never reset the wall-clock tick
//     v0.30.796 introduced, so 23 of its 30 boxes never spawned inside its 640 ms wait ("23 missing" - failing on
//     origin since v0.30.796, which did not run it). It resets the tick now, as grav_safezone_all_test always did.
// Run by the ship chain AFTER the files are re-synced from origin. Idempotent; exact-count anchors; LF/CRLF preserved.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = process.env.LX_TESTS_DIR || path.dirname(fileURLToPath(import.meta.url));
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };
const patch = (name, edits) => {
  const F = path.join(DIR, name); const raw = readFileSync(F, 'utf8'); const crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
  if (s.includes('ohko-gap')) { console.log(name + ': already applied'); return; }
  for (const [label, a, b] of edits) { const c = s.split(a).length - 1; if (c !== 1) abort(name + ' / ' + label + ': matched ' + c + ', expected 1'); s = s.replace(a, b); }
  writeFileSync(F + '.tmp', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8'); renameSync(F + '.tmp', F); console.log(name + ': patched (' + edits.length + ' edits)');
};

patch('grav_safezone_all_test.mjs', [
  ['clear the end stamp',
    "m._lastSkillAt = -99999; m._lastOhkoAt = -99999; m._ohkoWarnUntil = null; m._ohkoQueued = null;",
    "m._lastSkillAt = -99999; m._lastOhkoAt = -99999; m._lastOhkoEndAt = -99999; m._ohkoWarnUntil = null; m._ohkoQueued = null;   // (ohko-gap: form 3 measures the window from the last OHKO's END)"],
  ['a longer watch',
    "    while (performance.now() - t0 < 40000) {",
    "    while (performance.now() - t0 < 75000) {   // (ohko-gap: a form-3 rain is 4 boxes and three 5 s rests)"],
  ['form-3 gaps',
    "  check(cad.gaps.length === 3 && cad.gaps.every((g) => g >= 3.6 && g <= 4.8), 'the boxes are 4 s apart on the wall clock (previous build: ~1.9 s in form 3)', cad.gaps);",
    "  check(cad.gaps.length === 3 && cad.gaps.every((g) => g >= 6.2 && g <= 14), 'form 3: each box comes a full 5 s rest after the last one resolved - at least 6.4 s apart (ohko-gap; v0.30.796: 4 s, before it ~1.9 s)', cad.gaps);"],
]);

patch('gravitos_rain_reach_test.mjs', [
  ['reset the tick when forcing a box',
    "      m.patternState = 'collapseRain'; m._rainIdx = 0; m._rainBand0 = k % 2; m.patternTimer = 0; m._ohkoWarnUntil = null;",
    "      m.patternState = 'collapseRain'; m._rainIdx = 0; m._rainBand0 = k % 2; m.patternTimer = 0; m._ohkoWarnUntil = null; m._rainNextAt = null; m._rainRestF = 0;   // (ohko-gap: and the rain's own clocks - the wall-clock tick of v0.30.796 left 23 of these 30 boxes unspawned)"],
  ['and on the re-force',
    "if (!hz && m.patternState !== 'collapseRain') { m.patternState = 'collapseRain'; m._rainIdx = 0; m.patternTimer = 0; }",
    "if (!hz && m.patternState !== 'collapseRain') { m.patternState = 'collapseRain'; m._rainIdx = 0; m.patternTimer = 0; m._rainNextAt = null; m._rainRestF = 0; }"],
]);

//   * collapse_safezone_test.mjs - fast-forwards a rain by driving patternTimer, which stopped being the rain's clock
//     in v0.30.796 ("every rain produced its four boxes [0/8]" on origin since then). It now resets the rain's real
//     clocks each step and clears a box once it has been recorded, since a box never spawns over a live field.
patch('collapse_safezone_test.mjs', [
  ['drive the real clocks',
    "      boss.patternTimer = (boss._rainIdx || 0) * 4000 + 1;\n",
    "      boss.patternTimer = (boss._rainIdx || 0) * 4000 + 1;\n      boss._rainNextAt = null; boss._rainRestF = 0;   // (ohko-gap: the rain's clocks since v0.30.796 / ohko-gap - the wall-clock tick and the rest)\n"],
  ['clear a recorded box',
    "        seen.push({ x: +s.x.toFixed(1), y: +s.y.toFixed(1), w: s.w, h: s.h });\n      }\n",
    "        seen.push({ x: +s.x.toFixed(1), y: +s.y.toFixed(1), w: s.w, h: s.h });\n      }\n      for (let i = game.hazards.length - 1; i >= 0; i--) { const z = game.hazards[i]; if (z && z.type === 'gravitos_singularity' && ids.has(z)) game.hazards.splice(i, 1); }   // (ohko-gap: a box never spawns while another lethal field is live)\n"],
]);

//   * gravitos_ohko_warn_test.mjs - reads the warn window one rAF after it opens and demands EXACTLY 120 / 210 frames;
//     game.time may already have ticked by then (119 / 209 measured, on origin and on this build alike). One frame of
//     sampling slack; the window itself is untouched by ohko-gap.
patch('gravitos_ohko_warn_test.mjs', [
  ['p1 tolerance', "check(p1.windows.every((w) => w === 120), 'phases 1-2 keep their 2.0s window', p1.windows);",
    "check(p1.windows.every((w) => w === 120 || w === 119), 'phases 1-2 keep their 2.0s window', p1.windows);   // (ohko-gap: read one rAF after it opens - game.time may have ticked once)"],
  ['p3 tolerance', "check(p3.windows.length > 0 && p3.windows.every((w) => w === 210),",
    "check(p3.windows.length > 0 && p3.windows.every((w) => w === 210 || w === 209),"],
]);
