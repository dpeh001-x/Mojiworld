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
import { voiceReport } from './sfx_analyze.mjs';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(repoRoot, 'audio', 'npc');
const BACKUP = path.join(DIR, '_recast_backup');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (n) => (argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1];

// key -> { desc, dur }. `desc` describes a VOICE TIMBRE plus a babble pattern.
const VOICES = {
  cedric: {
    // Reported: "Cedric Meows despite being a block golem."
    // He is NOT a cat — NPC_SPRITES maps him to cedric.webp, "Cedric the
    // Confused Morphed Legoman": a block-headed humanoid with mismatched
    // brick limbs, the guide for the block-land warped-toy chain. (Easy to
    // confuse with the Stormbearer, a lightning TIGER, which is a separate
    // NPC on its own sprite — a meow would almost suit that one.)
    //
    // So the timbre wanted is toy brick and stone, not animal: a low hollow
    // knock with plastic-brick clicks. The negatives are heavy because the
    // endpoint reaches for animal vocalisations on anything read as a
    // creature, which is presumably how a meow got here in the first place.
    desc: 'Animal Crossing style character voice BABBLE for a video game: nonsense vocal '
      + 'syllables only, NOT real words, NOT speech, NOT singing. Single voice, clean dry studio '
      + 'recording, no music, no background noise, no reverb. A FRIENDLY TOY BLOCK GOLEM made of '
      + 'plastic building bricks and stone: a low hollow wooden-block knocking mumble, warm and '
      + 'gentle but blocky and clunky, each syllable a soft percussive brick click, slightly '
      + 'muffled as if spoken from inside a hollow box. Absolutely NOT a cat, NOT a meow, NOT any '
      + 'animal sound, NOT a purr, mew, chirp or squeak. No high-pitched feline tones.',
    dur: 1.2,
  },
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
    // v0.29.x — REPORTED AGAIN: "Bravo NPC sounds like an animal, make sure
    // she produces a human girl sound." The kawaii recast above overshot: it
    // chased "not granny" with PITCH, and pitch was never the granny signal
    // (the clip it replaced read as a granny at 552 Hz — rasp and creak did
    // that, not register).
    //
    // The overshoot is visible in one measurement. A human vowel puts its
    // first formant at roughly 300-900 Hz and carries real energy there; at
    // f0 668 Hz there is no harmonic under 1 kHz except the fundamental, so
    // there is nothing left to form a vowel out of. Measured share of energy
    // below 1 kHz (scripts/sfx_analyze.mjs --voice):
    //     Bravo  f0 668  vowel-band 0.026   <- reads as a chirp
    //     Felina f0 711  vowel-band 0.139
    //     Nurse Joyce f0 242  vowel-band 0.661   <- unmistakably a person
    // "tiny happy chirps" got exactly what it asked for.
    //
    // So this prompt is TIMBRE-led, not pitch-led: a real girl's voice with
    // open vowels, kept young and bright but inside a register that can still
    // hold a vowel. The anti-granny negatives stay, because that complaint was
    // real and must not come back.
    desc: 'Animal Crossing style character voice BABBLE for a video game: playful nonsense vocal '
      + 'syllables only, NOT real words, NOT speech, NOT singing. Single voice, clean dry studio '
      + 'recording, no music, no background noise, no reverb. A REAL HUMAN LITTLE GIRL about eight '
      + 'years old, speaking cheerfully: a clear warm child voice with OPEN ROUNDED VOWEL sounds '
      + 'like "ba da ya na", full-bodied and breathy and natural, bright and friendly with an '
      + 'upward lilt at the end. It must sound like an actual child talking. '
      + 'Absolutely NOT an animal, NOT a creature, NOT a bird, NOT a chirp, squeak, trill, whistle, '
      + 'peep, mew or chitter. NOT a chipmunk, NOT pitch-shifted or sped-up, NOT a synthesised or '
      + 'robotic voice. '
      + 'Absolutely NOT an old woman, NOT elderly, NOT raspy, croaky, creaky, nagging, '
      + 'scolding, weary or grumpy. No vibrato, no growl, no low chest tones.',
    dur: 1.2,
    // MEASURED acceptance — a prompt that reads right can still miss, and this
    // one has missed twice in opposite directions.
    //   f0 band: high enough to stay a child and clear of the granny register,
    //     low enough that harmonics still land in the vowel band.
    //   vowelBand: the actual "is this a person" test. Well above the 0.026
    //     chirp being replaced; not as low-heavy as Nurse Joyce, who is an
    //     adult and deliberately darker.
    accept: { minF0: 280, maxF0: 520, minVowelBand: 0.25 },
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

const ATTEMPTS = Number(arg('attempts') || 4);

// Measured acceptance for voices that carry an `accept` spec. Two recasts of
// Bravo shipped on "the prompt reads right", and both were wrong in ways a
// single number would have caught, so the roll is now scored before it lands.
// The incumbent file is seeded as a candidate: a bad run can tell us it failed,
// but it can never leave the character worse than it found them.
const scoreOf = (m) => m.vowelBand;   // "is this a person" is the deciding axis
function verdict(m, acc) {
  const okF0 = m.f0 >= acc.minF0 && m.f0 <= acc.maxF0;
  const okVowel = m.vowelBand >= acc.minVowelBand;
  return { ok: okF0 && okVowel, why: [okF0 ? '' : `f0 ${m.f0} outside ${acc.minF0}-${acc.maxF0}`,
    okVowel ? '' : `vowel-band ${m.vowelBand} < ${acc.minVowelBand}`].filter(Boolean).join(', ') };
}

let fail = 0;
for (const k of keys) {
  const v = VOICES[k];
  const dest = path.join(outDir, `npc_${k}.mp3`);
  const acc = v.accept;
  const tries = acc ? ATTEMPTS : 1;
  let best = null;
  if (acc && fs.existsSync(dest)) {
    const m0 = voiceReport(dest);
    best = { buf: fs.readFileSync(dest), m: m0, incumbent: true };
    console.log(`  incumbent npc_${k}: f0 ${m0.f0}Hz, vowel-band ${m0.vowelBand} — must be beaten`);
  }
  for (let attempt = 1; attempt <= tries; attempt++) {
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

    let pick = { buf, m: null };
    if (acc) {
      const scratch = path.join(repoRoot, 'scripts', '_tmp_voice_cand.mp3');
      fs.writeFileSync(scratch, buf);
      const m = voiceReport(scratch);
      try { fs.unlinkSync(scratch); } catch (_) {}
      const vd = verdict(m, acc);
      console.log(`  npc_${k} attempt ${attempt}: f0 ${m.f0}Hz, vowel-band ${m.vowelBand}` +
        (vd.ok ? '  ACCEPT' : `  reject — ${vd.why}`));
      if (!best || scoreOf(m) > scoreOf(best.m)) best = { buf, m };
      if (!vd.ok) {
        if (attempt < tries) continue;
        if (best.incumbent) {
          console.error(`FAIL npc_${k}: ${tries} attempts, none beat the incumbent — nothing written`);
          fail++; break;
        }
        console.log(`  ! bar never cleared — keeping the most human take (vowel-band ${best.m.vowelBand})`);
      }
      pick = vd.ok ? { buf, m } : best;
    }

    // Back up ONCE per key, so a second run cannot overwrite the true original
    // with the previous run's reject.
    if (outDir === DIR && fs.existsSync(dest)) {
      fs.mkdirSync(BACKUP, { recursive: true });
      const bak = path.join(BACKUP, `npc_${k}.mp3`);
      if (!fs.existsSync(bak)) fs.copyFileSync(dest, bak);
    }
    const tmp = dest + '.tmp';
    fs.writeFileSync(tmp, pick.buf);
    fs.renameSync(tmp, dest);      // atomic, per project convention
    console.log(`OK npc_${k}.mp3 (${(pick.buf.length / 1024).toFixed(1)} KB) -> ${dest}` +
      (pick.m ? `  f0 ${pick.m.f0}Hz, vowel-band ${pick.m.vowelBand}` : ''));
    break;
  } catch (e) {
    if (acc && attempt < tries) { console.error(`  npc_${k} attempt ${attempt} error: ${e.message}`); continue; }
    fail++; console.error(`FAIL npc_${k}: ${e.message}`); break;
  }
  }
}
process.exit(fail ? 1 : 0);
