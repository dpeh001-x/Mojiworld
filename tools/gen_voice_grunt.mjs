#!/usr/bin/env node
// SHORT player "groan" / hurt-grunt vocalisations via Ludo /audio/sound-effect.
// Regenerates audio/voice/<class>_<m|f>_hit{1,2}.mp3 as SHORT pained grunts (the
// groan played when a monster hits you). Per user "make the male and female
// groan sounds shorter". Keeps each class's vocal character; only the length is
// trimmed (short prompt + short ludo duration). Death cries are NOT touched.
//   node tools/gen_voice_grunt.mjs            # dry-run (print prompts)
//   node tools/gen_voice_grunt.mjs --generate # call Ludo (needs LUDO_API_KEY)
//   node tools/gen_voice_grunt.mjs --generate --force   # overwrite existing
// Existing files were backed up to audio/voice/_pre_short_backup/ beforehand.
// =============================================================================
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'audio', 'voice');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

// Per-class vocal character (kept consistent with the existing voice set).
const CLASS = {
  warrior: 'deep, gruff, strong',
  mage:    'young, light, refined',
  thief:   'young, nimble, sharp',
  bowman:  'steady, focused',
  pirate:  'rough, hearty',
};
const GENDER = { m: 'male', f: 'female' };
// Two short variants per voice so hit1/hit2 differ slightly.
const VARIANT = {
  1: "a quick sharp \"ugh!\"",
  2: "a short low \"oof\"",
};

const ITEMS = {};
for (const cls of Object.keys(CLASS)) {
  for (const g of ['m', 'f']) {
    for (const n of [1, 2]) {
      ITEMS[`${cls}_${g}_hit${n}`] =
        `One VERY SHORT ${CLASS[cls]} ${GENDER[g]} pained grunt — ${VARIANT[n]} as the ` +
        `character takes a hit. Clean and dry, a single quick vocalisation, about ` +
        `0.4 seconds, abruptly cut, NO trailing breath, no music, no reverb tail.`;
    }
  }
}

// --only key1,key2 — regenerate just specific clips.
const _onlyI = argv.indexOf('--only');
if (_onlyI >= 0 && argv[_onlyI + 1]) {
  const keep = new Set(argv[_onlyI + 1].split(','));
  for (const k of Object.keys(ITEMS)) if (!keep.has(k)) delete ITEMS[k];
}

if (!has('--generate')) {
  console.log(`# ${Object.keys(ITEMS).length} short groan voices -> audio/voice/<key>.mp3 (Ludo /audio/sound-effect)\n`);
  for (const k in ITEMS) console.log(`## ${k}\n${ITEMS[k]}\n`);
  console.log('# Re-run with --generate (needs LUDO_API_KEY). Add --force to overwrite.');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const DURATION = Number(process.env.LUDO_SFX_DURATION || 0.5);   // short groan
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
        body: JSON.stringify({ description: ITEMS[k], duration: DURATION, loop: false, augment_prompt: false }),
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
console.log(`Generating ${Object.keys(ITEMS).length} short groan voices (dur ${DURATION}s)...`);
let made = 0, skip = 0, fail = 0;
for (const k in ITEMS) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skip++; console.log('skip'); } else { made++; console.log('OK ' + r); await sleep(600); } }
  catch (e) { fail++; console.log('FAIL: ' + e.message); }
}
console.log(`Done. ${made} made, ${skip} skipped, ${fail} failed.`);
process.exit(fail ? 2 : 0);
