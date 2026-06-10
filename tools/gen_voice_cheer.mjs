#!/usr/bin/env node
// Player "cheer" vocalisations (short happy laugh / "yeah!") via Ludo
// /audio/sound-effect → audio/voice/cheer_m_1.mp3 + cheer_f_1.mp3. Played when
// the player lands a kill (the "if not being attacked" positive vocal). Named
// with the _m_/_f_ token so the voice loader applies the SAME male pitch-up as
// the grunts → consistent pitch with the character's voice.
//   node tools/gen_voice_cheer.mjs            # dry-run
//   node tools/gen_voice_cheer.mjs --generate # call Ludo (needs LUDO_API_KEY)
// =============================================================================
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'audio', 'voice');
const has = (f) => process.argv.slice(2).includes(f);

const ITEMS = {
  cheer_m_1: 'A single short, upbeat young male triumphant cheer — a quick light "yeah!" / happy chuckle, clean and dry, energetic, about 0.7 seconds, no music, no reverb tail.',
  cheer_f_1: 'A single short, upbeat young female triumphant cheer — a quick light "yeah!" / happy giggle, clean and dry, energetic, about 0.7 seconds, no music, no reverb tail.',
};

if (!has('--generate')) {
  console.log('# cheer voice -> audio/voice/<key>.mp3 (Ludo /audio/sound-effect)\n');
  for (const k in ITEMS) console.log(`## ${k}\n${ITEMS[k]}\n`);
  console.log('# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchTimed(url, opts = {}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; } finally { clearTimeout(t); }
}
async function genOne(k) {
  const dest = join(DIR, k + '.mp3');
  if (!has('--force') && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetchTimed(`${BASE}/audio/sound-effect`, {
        method: 'POST', headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: ITEMS[k], duration: 1.0, loop: false, augment_prompt: false }),
      });
      if (!res.ok) throw new Error(`Ludo ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = data?.url || (Array.isArray(data) ? data[0]?.url : null);
      if (!url) throw new Error('no url');
      const a = await fetchTimed(url); if (!a.ok) throw new Error('fetch ' + a.status);
      const buf = Buffer.from(await a.arrayBuffer()); if (!buf.length) throw new Error('empty');
      await mkdir(DIR, { recursive: true }); await writeFile(dest, buf);
      return buf.length + ' bytes';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(2500 * attempt); }
  }
  throw lastErr;
}
console.log('Generating cheer voice clips...');
let made = 0, skip = 0, fail = 0;
for (const k in ITEMS) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skip++; console.log('skip'); } else { made++; console.log('OK ' + r); await sleep(600); } }
  catch (e) { fail++; console.log('FAIL: ' + e.message); }
}
console.log(`Done. ${made} made, ${skip} skipped, ${fail} failed.`);
process.exit(fail ? 2 : 0);
