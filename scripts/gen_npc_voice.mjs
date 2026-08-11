#!/usr/bin/env node
// Recast an NPC's talk babble via the ludo.ai sound-effect endpoint.
// Output -> audio/npc/npc_<key>.mp3, the file _playNpcTalkSfx streams.
//
// These are Animal-Crossing-style BABBLE clips (nonsense vocal syllables), not
// speech — the endpoint is /audio/sound-effect, not TTS, so every prompt says
// so explicitly or you get something that tries to pronounce words.
//
//   node scripts/gen_npc_voice.mjs                     # dry-run, prints prompts
//   node scripts/gen_npc_voice.mjs --generate          # needs LUDO_API_KEY
//   flags: --only=bravo  --force  --out=<dir>
//
// The existing clip is moved to audio/npc/_recast_backup/ before being
// replaced, so a bad roll is one `mv` away from being undone.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(repoRoot, 'audio', 'npc');
const BACKUP = path.join(DIR, '_recast_backup');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (n) => (argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1];

// key -> { desc, dur }. `desc` describes a VOICE TIMBRE plus a babble pattern.
const VOICES = {
  bravo: {
    // Reported: the shipped clip "sounds like a naggy granny on a young girl".
    // Bravo's art is a chibi girl explorer — pith hat, backpack, huge grin.
    //
    // This is the prompt that WON a measured 4-way roll, not the first idea.
    // A straight "young girl, ten years old, eager" prompt came back at
    // f0 345 Hz — 8 semitones BELOW the clip it was replacing, i.e. more
    // granny, not less. "Kawaii mascot" is what actually reached the register:
    //   old            552 Hz / 4042 centroid
    //   squeaky child  527 / 3600      eager scout  516 / 3219
    //   plucky teen    578 / 3329      KAWAII       667 / 4065   <- shipped
    // 667 Hz also puts Bravo alongside the game's other bright NPCs
    // (Guguma 706, Felina 706) instead of down with Nurse Joyce at 242.
    desc: 'Animal Crossing style character voice BABBLE for a video game: playful nonsense vocal '
      + 'syllables only, NOT real words, NOT speech, NOT singing. Single voice, clean dry studio '
      + 'recording, no music, no background noise, no reverb. A CUTE KAWAII CARTOON MASCOT GIRL: '
      + 'sweet, sparkly, very high-pitched and melodic, soft and friendly, tiny happy chirps with an '
      + 'upward lilt. Absolutely NOT an old woman, NOT elderly, NOT raspy, croaky, creaky, nagging, '
      + 'scolding, weary or grumpy. No vibrato, no growl, no low chest tones.',
    dur: 1.2,
  },
};

const only = arg('only');
const keys = Object.keys(VOICES).filter((k) => !only || k === only);
if (!keys.length) { console.error(`no voice named "${only}"`); process.exit(1); }

if (!has('--generate')) {
  console.log('# NPC voice recast -> audio/npc/\n');
  for (const k of keys) {
    const f = path.join(DIR, `npc_${k}.mp3`);
    console.log(`## npc_${k}.mp3  ${fs.existsSync(f) ? `[exists ${fs.statSync(f).size}B]` : '[NEW]'}  dur ${VOICES[k].dur}s`);
    console.log(VOICES[k].desc + '\n');
  }
  console.log('# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only=<key>');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const outDir = arg('out') ? path.resolve(arg('out')) : DIR;

let fail = 0;
for (const k of keys) {
  const v = VOICES[k];
  const dest = path.join(outDir, `npc_${k}.mp3`);
  try {
    const res = await fetch(`${API}/audio/sound-effect`, {
      method: 'POST',
      headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT),
      body: JSON.stringify({ description: v.desc, duration: v.dur, loop: false }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 140)}`);
    const j = await res.json();
    const url = j.url || (j.result && j.result.url);
    if (!url) throw new Error(`no url in ${JSON.stringify(j).slice(0, 160)}`);
    const a = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!a.ok) throw new Error(`download HTTP ${a.status}`);
    const buf = Buffer.from(await a.arrayBuffer());
    if (buf.length < 2000) throw new Error(`suspiciously small (${buf.length}B) — not written`);
    fs.mkdirSync(outDir, { recursive: true });
    if (outDir === DIR && fs.existsSync(dest)) {
      fs.mkdirSync(BACKUP, { recursive: true });
      fs.copyFileSync(dest, path.join(BACKUP, `npc_${k}.mp3`));
    }
    const tmp = dest + '.tmp';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, dest);      // atomic, per project convention
    console.log(`OK npc_${k}.mp3 (${(buf.length / 1024).toFixed(1)} KB, ${j.duration ?? '?'}s) -> ${dest}`);
  } catch (e) { fail++; console.error(`FAIL npc_${k}: ${e.message}`); }
}
process.exit(fail ? 1 : 0);
