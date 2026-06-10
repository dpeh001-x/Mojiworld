#!/usr/bin/env node
// Monster SFX generation runner — drives per-monster hit/die clips through the
// Ludo /audio/sound-effect endpoint. Mirrors generate_equipment_sprites.mjs.
// =============================================================================
//   node scripts/generate_monster_sounds.mjs                 # dry-run print
//   node scripts/generate_monster_sounds.mjs --json          # JSON manifest
//   node scripts/generate_monster_sounds.mjs --kind die      # die | hit | both
//   node scripts/generate_monster_sounds.mjs --skip-bosses   # drop die for bosses
//   node scripts/generate_monster_sounds.mjs --only slime,king
//   node scripts/generate_monster_sounds.mjs --limit 3
//   node scripts/generate_monster_sounds.mjs --generate      # call Ludo (costs credits)
//   node scripts/generate_monster_sounds.mjs --generate --force
//
// Generate mode requires LUDO_API_KEY in env. Output lands at
// audio/monster/mob_<id>_<kind>.mp3 — exactly the names the engine probes
// (mojiworld_game.html _playMonsterSfx). Re-running skips files that already
// exist unless --force. Dry-run / JSON modes are free; use them to review the
// composed prompts and target paths before paying (2 credits per clip).
// =============================================================================
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MONSTERS, BOSSES, familyFor, buildSoundPrompt } = require('../tools/gen_monster_sounds.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, '..');

const argv = process.argv.slice(2);
const has  = (flag) => argv.includes(flag);
const arg  = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };

// --kind: die (default) | hit | both
const kindArg = (arg('--kind') || 'die').toLowerCase();
const KINDS = kindArg === 'both' ? ['die', 'hit'] : [kindArg];
if (!KINDS.every((k) => k === 'die' || k === 'hit')) {
  console.error('--kind must be one of: die | hit | both'); process.exit(1);
}

const onlyArg = arg('--only');
const onlySet = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null;
const skipBosses = has('--skip-bosses');

// Build the work manifest: one entry per (monster, kind).
let work = [];
for (const id of MONSTERS) {
  if (onlySet && !onlySet.has(id)) continue;
  for (const kind of KINDS) {
    // Bosses never play a die clip (engine guards die with !m.isBoss). With
    // --skip-bosses we drop those wasted generations; hit clips always kept.
    if (skipBosses && kind === 'die' && BOSSES.has(id)) continue;
    work.push({
      id, kind, family: familyFor(id), boss: BOSSES.has(id),
      prompt: buildSoundPrompt(id, kind),
      targetPath: `audio/monster/mob_${id}_${kind}.mp3`,
    });
  }
}

const limit = arg('--limit');
if (limit) work = work.slice(0, Number(limit));
if (!work.length) { console.error('No entries match the filters.'); process.exit(1); }

const mode = has('--generate') ? 'generate' : has('--json') ? 'json' : 'dry-run';

if (mode === 'dry-run') {
  console.log(`# Composed monster SFX prompts (${work.length} entries, kind=${KINDS.join('+')})\n`);
  for (const e of work) {
    console.log(`## ${e.id} [${e.family}${e.boss ? ', boss' : ''}] ${e.kind} -> ${e.targetPath}`);
    console.log(e.prompt);
    console.log('');
  }
  const credits = work.length * 2;
  console.log(`# ${work.length} clips shown (~${credits} credits). Re-run with --generate to call Ludo.`);
  process.exit(0);
}

if (mode === 'json') {
  console.log(JSON.stringify(work, null, 2));
  process.exit(0);
}

// ---- generate mode ----
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) {
  console.error('LUDO_API_KEY env var is required for --generate mode.');
  console.error('Get one at https://ludo.ai, then run (PowerShell):');
  console.error('  $env:LUDO_API_KEY="..."; node scripts/generate_monster_sounds.mjs --generate');
  process.exit(1);
}
const LUDO_API_BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
// 0 = let Ludo auto-pick a tight duration from the description. Override with
// LUDO_SFX_DURATION (seconds, 0–10) if you want a fixed length.
const DURATION = Number(process.env.LUDO_SFX_DURATION || 0);

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

// Per-request hard timeout so one stuck Ludo call can't wedge the whole
// sequential batch (the v1 run hung indefinitely on a single request). Tune
// via LUDO_REQ_TIMEOUT_MS. AbortController fires after the deadline.
const REQ_TIMEOUT_MS = Number(process.env.LUDO_REQ_TIMEOUT_MS || 120000);
async function fetchTimed(url, opts = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), REQ_TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (err) { if (ac.signal.aborted) throw new Error(`timeout after ${REQ_TIMEOUT_MS}ms`); throw err; }
  finally { clearTimeout(t); }
}

async function generateOnce(entry, dest) {
  const res = await fetchTimed(`${LUDO_API_BASE}/audio/sound-effect`, {
    method: 'POST',
    headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: entry.prompt,
      duration: DURATION,
      loop: false,
      augment_prompt: false,
    }),
  });
  if (!res.ok) throw new Error(`Ludo API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  // POST /audio/sound-effect returns an AudioResult { url, ... } (object, not
  // array). Be tolerant in case the beta wraps it in an array.
  const url = data?.url || (Array.isArray(data) ? data[0]?.url : null);
  if (!url) throw new Error(`No audio URL in response: ${JSON.stringify(data).slice(0, 200)}`);
  const aRes = await fetchTimed(url);
  if (!aRes.ok) throw new Error(`Audio fetch ${aRes.status} for ${url}`);
  const buf = Buffer.from(await aRes.arrayBuffer());
  if (!buf.length) throw new Error('empty audio body');
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
}

async function generateOne(entry) {
  const dest = join(repoRoot, entry.targetPath);
  if (!force && await exists(dest)) return { dest, skipped: true };
  // One retry on timeout/transient error before giving up on this clip.
  try { await generateOnce(entry, dest); }
  catch (err) {
    await sleep(1500);
    try { await generateOnce(entry, dest); }
    catch (err2) { throw new Error(`${err.message} (retry: ${err2.message})`); }
  }
  return { dest, skipped: false };
}

// Beta rate limit: 1 simultaneous request per endpoint. Sequential honours it;
// LUDO_DELAY_MS adds a cushion after each real hit to dodge 429s.
const DELAY_MS = Number(process.env.LUDO_DELAY_MS || 800);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Generating ${work.length} monster SFX (kind=${KINDS.join('+')}, skip-existing: ${!force})...`);
let done = 0, made = 0, skipped = 0, failed = 0;
for (const e of work) {
  process.stdout.write(`[${++done}/${work.length}] mob_${e.id}_${e.kind} ... `);
  try {
    const { dest, skipped: sk } = await generateOne(e);
    if (sk) { skipped++; console.log('skip (exists)'); }
    else { made++; console.log(`OK -> ${dest.replace(repoRoot, '.')}`); if (DELAY_MS) await sleep(DELAY_MS); }
  } catch (err) { failed++; console.log(`FAIL: ${err.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
