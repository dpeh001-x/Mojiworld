#!/usr/bin/env node
// Firing SFX for the 11 distinct mob projectiles (de-share pass) →
// audio/mobs/<key>.mp3 via ludo.ai POST /audio/sound-effect (2 cr each).
// Wired in-game through _UI_SFX_FILES slots + a fire-site hook with per-id
// cooldowns so mob packs don't machine-gun the clip.
//   node tools/gen_distinct_mob_sfx.mjs              # dry-run
//   node tools/gen_distinct_mob_sfx.mjs --generate   # all (needs LUDO_API_KEY)
// =============================================================================
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'audio', 'mobs');
const has = (f) => process.argv.slice(2).includes(f);
const arg = (f) => { const a = process.argv.slice(2); const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };

// key (matches the new m.shoot id) -> { d: description, sec: duration }
const SFX = {
  mquery:       { d: 'a wobbly uncertain magical bloop, comedic hesitant spell misfire with a warbling pitch bend, cute game sound, short', sec: 0.7 },
  mossbaton:    { d: 'a dry bone baton thrown with a spinning whoosh and a light skeletal rattle, short game throw sound', sec: 0.6 },
  mspine:       { d: 'a quick wet spike dart launch, sharp pop with a thin whistling whoosh, small fish spitting a needle, short', sec: 0.5 },
  mgaleblade:   { d: 'a sharp slicing wind blade whoosh, compressed air sickle cutting forward, clean and fast, short', sec: 0.6 },
  mcryshard:    { d: 'a crystalline shard launch with an icy magical ring and glassy chime tail, arcane, short', sec: 0.7 },
  mbark:        { d: 'a heavy wood chunk thrown, knocking woody thunk with a tumbling whoosh, forest game sound, short', sec: 0.6 },
  mrivet:       { d: 'a hot metal rivet launched with a forge hiss and a high metallic ping, sizzling sparks, short', sec: 0.6 },
  mcoffinshard: { d: 'a ghostly wooden splinter whoosh with a faint eerie whisper and cold reverb tail, spooky, short', sec: 0.8 },
  mstormorb:    { d: 'a crackling electric storm orb launch, sputtering thunder fizz with a deep cloud rumble, short', sec: 0.8 },
  mfeather:     { d: 'a radiant feather dart whoosh with a soft angelic chime sparkle, holy and light, short', sec: 0.7 },
  mhexbolt:     { d: 'a cursed hex zap, dark magic pulse with a witchy warble and ominous low tail, short', sec: 0.7 },
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
let keys = Object.keys(SFX);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k.includes(o)));

if (!has('--generate')) {
  console.log(`# ${keys.length} mob-fire SFX -> audio/mobs/<key>.mp3 (2 credits each)\n`);
  for (const k of keys) console.log(`  ${k}  (${SFX[k].sec}s)`);
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Generating ${keys.length} mob-fire SFX...`);
let made = 0, skipped = 0, failed = 0;
await mkdir(OUT_DIR, { recursive: true });
for (const k of keys) {
  const out = join(OUT_DIR, `${k}.mp3`);
  if (!has('--force') && await exists(out)) { skipped++; console.log(`  ${k} ... skip`); continue; }
  process.stdout.write(`  ${k} ... `);
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API}/audio/sound-effect`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
        body: JSON.stringify({ description: SFX[k].d, duration: SFX[k].sec, loop: false }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const url = data.url;
      if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 120));
      const ar = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!ar.ok) throw new Error('audio fetch ' + ar.status);
      await writeFile(out, Buffer.from(await ar.arrayBuffer()));
      console.log('OK'); made++; lastErr = null; await sleep(700);
      break;
    } catch (e) { lastErr = e; if (attempt < 3) await sleep(2500 * attempt); }
  }
  if (lastErr) { failed++; console.log(`FAIL: ${lastErr.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
