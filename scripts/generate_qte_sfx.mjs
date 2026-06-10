#!/usr/bin/env node
// Boss Shackle QTE sound effects (ludo.ai POST /audio/sound-effect, 2 cr/call)
// =============================================================================
// Five short clips for the QTE beats, saved to audio/ui/<id>.mp3 and wired via
// the existing _UI_SFX_FILES lazy-load slots (missing file = silent no-op).
//
//   node scripts/generate_qte_sfx.mjs                # dry-run list
//   node scripts/generate_qte_sfx.mjs --generate     # all (needs LUDO_API_KEY)
//   flags: --force | --only a,b
// Resumable: skips ids whose file already exists.
// =============================================================================
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'audio', 'ui');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// id -> { d: description, sec: duration (0 = auto) }
const SFX = {
  qte_capture: { d: 'heavy magical chains rapidly wrapping around a person then locking shut with a deep metallic clank, dark fantasy binding spell, punchy, short', sec: 1.3 },
  qte_tap:     { d: 'a single light metallic chain-link click, crisp short high-pitched game UI tick, satisfying', sec: 0.4 },
  qte_wrong:   { d: 'a dull heavy chain clank combined with a short low error buzz, negative game feedback, blunt, short', sec: 0.6 },
  qte_break:   { d: 'metal chains snapping and shattering apart with a bright magical release ring, liberating burst, game victory sting, short', sec: 1.1 },
  qte_perfect: { d: 'crystalline chains shattering into sparkles with bright chimes and a short triumphant magical flourish, euphoric game perfect-clear sting', sec: 1.5 },
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
let keys = Object.keys(SFX);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k.includes(o)));

if (!has('--generate')) {
  console.log(`# ${keys.length} QTE SFX -> audio/ui/<id>.mp3 (2 credits each)\n`);
  for (const k of keys) console.log(`  ${k}  (${SFX[k].sec}s)  ${SFX[k].d.slice(0, 70)}...`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Generating ${keys.length} QTE SFX...`);
let made = 0, skipped = 0, failed = 0;
await mkdir(OUT_DIR, { recursive: true });
for (const k of keys) {
  const out = join(OUT_DIR, `${k}.mp3`);
  if (!force && await exists(out)) { skipped++; console.log(`  ${k} ... skip`); continue; }
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
      const url = data.url || (Array.isArray(data) && data[0] && data[0].url);
      if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 120));
      const ar = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!ar.ok) throw new Error('audio fetch ' + ar.status);
      const buf = Buffer.from(await ar.arrayBuffer());
      const ctype = ar.headers.get('content-type') || '';
      await writeFile(out, buf);
      console.log(`OK ${(buf.length / 1024).toFixed(0)}kB (${data.type || ctype}, ${data.duration || '?'}s)`);
      made++; lastErr = null; await sleep(700);
      break;
    } catch (e) { lastErr = e; if (attempt < 3) await sleep(2500 * attempt); }
  }
  if (lastErr) { failed++; console.log(`FAIL: ${lastErr.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
