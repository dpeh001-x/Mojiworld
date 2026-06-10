#!/usr/bin/env node
// Themed ambient-loop generator → audio/ambient/<name>.mp3 via Ludo /audio/ambiance.
// =============================================================================
//   node tools/gen_ambiance.mjs            # dry-run: print prompts + target maps
//   node tools/gen_ambiance.mjs --generate # call Ludo (2 credits each)
//   node tools/gen_ambiance.mjs --generate --force --only beach,storm
//
// After generating, add the printed _AMBIENT_FILES entries to mojiworld_game.html.
// Each ambiance is a seamless loop; skip-existing makes the run resumable.
//
// NOTE: /audio/ambiance returns WAV data (not MP3) — this script saves it as-is
// to <name>.mp3. Transcode to real MP3 before shipping (≈10x smaller), e.g.:
//   ffmpeg -y -i audio/ambient/<name>.mp3 -codec:a libmp3lame -q:a 5 out.mp3
// (the imageio-ffmpeg pip package provides a standalone ffmpeg binary).
// =============================================================================
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// name → { prompt, maps }. maps = the map ids that should use this loop.
const AMBIANCES = {
  beach: {
    prompt: 'Gentle ocean shore ambiance: soft lapping waves on sand, distant seagull calls, a light sea breeze. Calm, seamless, no music.',
    maps: ['sunsetBeach', 'tidepoolShoals'],
  },
  clockwork: {
    prompt: 'Mechanical clockwork room ambiance: steady ticking gears, rhythmic metal clicks, low machine hum, faint hiss of steam. Industrial, seamless loop, no music.',
    maps: ['clockworkExpress', 'clockworkUnderpassLobby'],
  },
  blockland: {
    prompt: 'Playful toy-block world ambiance: soft hollow plastic clicks and knocks, light bouncy wooden taps, a cheerful airy room tone. Whimsical, gentle, seamless, no music.',
    maps: ['blockland_meadow', 'blockland_grove', 'blockland_dunes', 'blockland_quarry', 'blockland_outpost', 'blockland_citadel', 'blockland_apex'],
  },
  storm: {
    prompt: 'High windy storm ridge ambiance: howling gusts of wind, distant rolling thunder, faint whistling air over rock. Tense, seamless loop, no music, no rain.',
    maps: ['stormCrest'],
  },
  meadow: {
    prompt: 'Open sunny meadow ambiance: soft breeze through tall grass, gentle birdsong, faint rustling leaves, distant insects. Peaceful, seamless loop, no music.',
    maps: ['wildflowerPlains', 'candyCanyon', 'skyGarden', 'graniteBluffs'],
  },
};

const onlyArg = arg('--only');
const only = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null;
let names = Object.keys(AMBIANCES).filter((n) => !only || only.has(n));

if (!has('--generate')) {
  console.log(`# ${names.length} ambiances (dry-run, ~${names.length * 2} credits)\n`);
  for (const n of names) {
    console.log(`## ${n} -> audio/ambient/${n}.mp3   maps: ${AMBIANCES[n].maps.join(', ')}`);
    console.log(AMBIANCES[n].prompt + '\n');
  }
  console.log('# _AMBIENT_FILES entries to add:');
  for (const n of names) for (const m of AMBIANCES[n].maps) console.log(`  ${m}: 'audio/ambient/${n}.mp3',`);
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY env var required for --generate.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const DURATION = Number(process.env.LUDO_AMB_DURATION || 10);
const REQ_TIMEOUT_MS = Number(process.env.LUDO_REQ_TIMEOUT_MS || 120000);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTimed(url, opts = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), REQ_TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error(`timeout ${REQ_TIMEOUT_MS}ms`); throw e; }
  finally { clearTimeout(t); }
}

console.log(`Generating ${names.length} ambiances (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0;
for (const n of names) {
  const dest = join(repoRoot, `audio/ambient/${n}.mp3`);
  process.stdout.write(`[${n}] ... `);
  if (!force && await exists(dest)) { skipped++; console.log('skip (exists)'); continue; }
  try {
    const res = await fetchTimed(`${BASE}/audio/ambiance`, {
      method: 'POST',
      headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: AMBIANCES[n].prompt, duration: DURATION, augment_prompt: false }),
    });
    if (!res.ok) throw new Error(`Ludo ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const data = await res.json();
    const url = data?.url || (Array.isArray(data) ? data[0]?.url : null);
    if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 160)}`);
    const a = await fetchTimed(url);
    if (!a.ok) throw new Error(`audio fetch ${a.status}`);
    const buf = Buffer.from(await a.arrayBuffer());
    if (!buf.length) throw new Error('empty body');
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    made++; console.log(`OK -> audio/ambient/${n}.mp3`);
    await sleep(300);
  } catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
