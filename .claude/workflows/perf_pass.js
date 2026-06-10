export const meta = {
  name: 'perf-pass',
  description: 'Static performance hot-path analysis of mojiworld_game.html — fan out per-dimension finders, then dedupe/rank into safe actionable fixes',
  phases: [
    { title: 'Analyze' },
    { title: 'Synthesize' },
  ],
};

const FILE = 'C:/Users/Xenon/Desktop/Mojiworld/mojiworld_game.html';
const cycle = (args && args.cycle) || 1;
const avoid = (args && args.avoid) || [];

const DIMENSIONS = [
  { key: 'alloc', lens: 'Per-frame ALLOCATIONS & GC churn in the main update/draw loop: object/array/closure literals, .map/.filter/.forEach creating temp arrays, spread, JSON.parse/stringify, new Date, string concatenation building values EVERY frame inside requestAnimationFrame / the game tick. Find the main rAF loop + update() + draw() first.' },
  { key: 'canvas', lens: 'Canvas2D draw COST in hot paths: ctx.shadowBlur / shadowColor churn, createLinearGradient/createRadialGradient/createPattern built per-frame instead of cached, ctx.filter usage, excessive ctx.save/restore, getImageData/putImageData in render, drawImage with non-integer scaling, beginPath churn, per-pixel loops.' },
  { key: 'dom', lens: 'Per-frame DOM access / layout thrash: document.getElementById / querySelector inside loops or the tick (should be cached), innerHTML rebuilds each frame, reading offsetWidth/getBoundingClientRect (forces reflow), writing .style repeatedly, HUD/minimap text updates every frame when unchanged.' },
  { key: 'particles', lens: 'Particle / effect / projectile systems: unbounded array growth, Array.splice inside for-loops (O(n^2) removal), nested loops over particles*entities, particles never capped, dead-object retention, re-sorting large arrays every frame.' },
  { key: 'collision', lens: 'Collision / spatial / AI queries: O(n^2) entity-vs-entity loops, repeated Math.sqrt for distance when squared-distance compares suffice, Math.hypot in loops, no broad-phase / no early-out, per-frame full scans that could be throttled.' },
  { key: 'sprite', lens: 'Image / sprite handling: sprite cache misses, re-decoding, redundant offscreen-canvas creation each frame instead of reuse, drawImage source-rect math recomputed, scaled-sprite cache not used in a hot branch, repeated naturalWidth reads.' },
  { key: 'timers', lens: 'Timers / listeners / audio / storage: setInterval doing heavy work, leaked event listeners, AudioContext nodes created without cleanup, localStorage.getItem/setItem or JSON parse in hot paths, repeated regex compilation (new RegExp / literal in loop).' },
  { key: 'recompute', lens: 'Redundant recomputation that could be cached/memoized: constant lookups recomputed each frame, Math-heavy values (trig, pow) recomputed when inputs unchanged, array .find/.indexOf in hot loops where a Map/Set would be O(1), repeated property chains.' },
];

const FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    dimension: { type: 'string' },
    summary: { type: 'string', description: 'one line: what is hot in this dimension' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: 'short, specific' },
          lineHint: { type: 'string', description: 'approximate line number(s) or a unique grep-able code snippet to locate it' },
          evidence: { type: 'string', description: 'the offending code, quoted briefly' },
          fix: { type: 'string', description: 'concrete behavior-preserving change; show before->after if small' },
          cadence: { type: 'string', description: 'PROVEN execution frequency: trace the call chain. One of "per-frame" (in the rAF tick / update*/draw* called every frame), "per-cast" (only when a skill fires), "per-event" (per kill/pickup/map-load), or "one-time" (boot init). Only per-frame items belong in this report.' },
          impact: { type: 'string', enum: ['high', 'med', 'low'] },
          risk: { type: 'string', enum: ['low', 'med', 'high'] },
          autoSafe: { type: 'boolean', description: 'true ONLY if mechanical & behavior-preserving (safe to apply without gameplay testing)' },
        },
        required: ['title', 'lineHint', 'evidence', 'fix', 'cadence', 'impact', 'risk', 'autoSafe'],
      },
    },
  },
  required: ['dimension', 'summary', 'findings'],
};

phase('Analyze');
const avoidNote = avoid.length ? `\n\nALREADY APPLIED in earlier cycles — do NOT re-report these or anything equivalent:\n- ${avoid.join('\n- ')}` : '';

const reports = await parallel(DIMENSIONS.map(d => () => agent(
  `You are a performance auditor for a single-file HTML/canvas game. The entire game is in ${FILE} (~100k lines, ~5MB). ` +
  `Your lens for THIS pass: ${d.lens}\n\n` +
  `Method: use Grep to locate candidate patterns for your lens WITHIN that file (do not read the whole file). Read only the surrounding regions you need. ` +
  `CRITICAL — CADENCE VERIFICATION: before reporting ANY finding, trace its call chain and PROVE it runs PER FRAME (inside the requestAnimationFrame tick: the main loop, update*/draw*/render* functions called every frame). Set the "cadence" field accordingly. ` +
  `REJECT and do NOT report anything that only runs per skill-CAST (skill handler / SKILL_FNS / *_ult), per EVENT (per mob-kill, per pickup, per map-load, per click), or ONE-TIME at boot (_wire* init, setup). Earlier cycles wasted effort on per-cast/per-event/one-time code mis-ranked as per-frame — a filter/alloc that runs when the player presses their ultimate, kills a mob, or loads a map is NOT a per-frame hot path no matter how expensive. Only genuine per-frame cost counts. ` +
  `Focus on code that runs EVERY FRAME or in tight per-frame loops — ignore one-time init/setup cost. ` +
  `Report 3-8 of the highest-impact, most concrete findings with accurate line hints and a real before->after fix. ` +
  `Mark autoSafe=true ONLY for mechanical, behavior-preserving edits (e.g. hoisting an invariant out of a loop, caching a getElementById, swapping sqrt for squared-distance compare, reusing a gradient). ` +
  `Anything that could change gameplay, visuals, or timing => autoSafe=false. Be precise; no speculation. Stop once you have your top findings (cap ~1200 words).${avoidNote}`,
  { label: `perf:${d.key}`, phase: 'Analyze', schema: FINDING_SCHEMA, agentType: 'Explore' }
)));

const valid = reports.filter(Boolean);
log(`cycle ${cycle}: ${valid.length}/${DIMENSIONS.length} dimensions reported, ${valid.reduce((n, r) => n + (r.findings ? r.findings.length : 0), 0)} raw findings`);

phase('Synthesize');
const RANK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ranked: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          lineHint: { type: 'string' },
          fix: { type: 'string' },
          impact: { type: 'string', enum: ['high', 'med', 'low'] },
          risk: { type: 'string', enum: ['low', 'med', 'high'] },
          autoSafe: { type: 'boolean' },
          rationale: { type: 'string', description: 'why this ranks here / how often the path runs' },
        },
        required: ['title', 'lineHint', 'fix', 'impact', 'risk', 'autoSafe', 'rationale'],
      },
    },
    notes: { type: 'string', description: 'cross-cutting observations, risky-but-high-value items to flag for manual review' },
  },
  required: ['ranked', 'notes'],
};

const synth = await agent(
  `Here are per-dimension performance findings for a single-file canvas game (cycle ${cycle}). FIRST drop every finding whose cadence is not "per-frame" (per-cast / per-event / one-time items are out of scope and must be discarded, not ranked). Then dedupe overlapping items, drop anything trivial or speculative, and rank by (impact / risk). ` +
  `Put autoSafe=true, low-risk, high/med-impact items FIRST (these get auto-applied). Keep risky-but-valuable items but mark them clearly in notes. Return the top ~14 actionable items.\n\n` +
  `FINDINGS JSON:\n${JSON.stringify(valid)}`,
  { label: 'synthesize', phase: 'Synthesize', schema: RANK_SCHEMA }
);

return { cycle, dimensionsReported: valid.length, ranked: synth.ranked, notes: synth.notes };
