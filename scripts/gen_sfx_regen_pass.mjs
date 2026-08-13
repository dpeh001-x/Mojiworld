#!/usr/bin/env node
// SFX regeneration pass (ludo.ai /audio/sound-effect).
//
// Per user:
//   * Captain Plum "sounds like a teddy bear enemy when he should be an old captain"
//   * Octobaby "sounds very shrill — regenerate all sfx with it"
//   * regenerate the death sounds of the Withering Tide monsters
//   * "ensure all of them are under 1 second"
//
// Every clip is requested short AND verified: the duration is measured from the
// returned MP3's own frame headers, and anything at or over the 1 s bar is
// retried shorter, then hard-trimmed at a frame boundary as a last resort. The
// API's own reported duration is not trusted — only the file is.
//
// Existing clips are backed up to audio/_regen_backup/<tag>/ first, matching
// the convention already in the repo.
//
//   node scripts/gen_sfx_regen_pass.mjs                # dry-run (print plan)
//   node scripts/gen_sfx_regen_pass.mjs --generate     # call Ludo (2 credits each)
//   flags: --only=<substring>   --tag=<backup folder>
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const only = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const TAG = (argv.find(a => a.startsWith('--tag=')) || '').split('=')[1] || 'pre_sfx_regen';
const MAX_SEC = 1.0;

// Shared negative direction. The two complaints are both TIMBRE complaints, so
// every prompt states what to avoid as well as what to make.
const SHORT = ' Very short one-shot, punchy, no tail, no music, no reverb wash, mono game SFX.';

// Characters were checked against the game's own text rather than guessed —
// two of these prompts were wrong before that pass (see drownedCur, bonebosn).
const SOUNDS = [
  // ---- Captain Plum -------------------------------------------------------
  // Retired captain of the Salt-Tooth, lost her to the abyss, now fishes from
  // shore with "infinite patience" and a dry, tired wit. Written with
  // they/their, so the prompt asks for AGE and WEATHER, not for a man.
  { file: 'audio/npc/npc_captain_plum.mp3', dur: 0.8,
    desc: 'A single short gruff grunt of acknowledgement from an OLD WEATHERED SEA CAPTAIN — ' +
      'salt-worn, gravelly, unhurried, the sound of a retired skipper who has been sitting with ' +
      'a fishing line for hours and barely looks up. Low, dry, rough-edged, world-worn, a little ' +
      'tired. Wordless. ' +
      'NOT cute, NOT a soft plush squeak, NOT a teddy bear, NOT high-pitched, NOT childlike, NOT chirpy.' + SHORT },

  // ---- Octobaby: deep and wet, not shrill --------------------------------
  { file: 'audio/boss/boss_octobaby.mp3', dur: 0.9,
    desc: 'Short menacing sting for a giant deep-sea octopus boss appearing — a LOW booming ' +
      'underwater groan with a wet gurgling swell, dark and heavy, felt in the chest. ' +
      'NO shrill squeal, NO high whistle, NO piercing shriek, NO screech, nothing bright or trebly.' + SHORT },
  { file: 'audio/monster/mob_octobaby_hit.mp3', dur: 0.5,
    desc: 'A wet muffled thud into rubbery octopus flesh — deep squelching slap, low and dull. ' +
      'NO shrill squeal, NO high-pitched yelp, NO screech. Dark and bassy.' + SHORT },
  { file: 'audio/monster/mob_octobaby_die.mp3', dur: 0.9,
    desc: 'A big octopus deflating and collapsing into water — low wet gurgle sinking downward, ' +
      'bubbling away, ending soft. NO shrill squeal, NO high shriek, NO piercing tone.' + SHORT },
  // The four arms are named for their status effect (Frostbite / Venom /
  // Silence / Shock Tentacle), so each keeps the same low wet body and carries
  // only a light touch of its own element.
  ...[
    { leg: 'Freeze',    el: 'a light brittle frost crackle over it' },
    { leg: 'Poison',    el: 'a soft acidic bubbling hiss under it' },
    { leg: 'SkillLock', el: 'a dull smothered muting, sound swallowed as if silenced' },
    { leg: 'Stun',      el: 'a short dry electrical crackle through it' },
  ].flatMap(({ leg, el }) => ([
    { file: `audio/monster/mob_octoLeg${leg}_hit.mp3`, dur: 0.5,
      desc: `A wet slap against a thick rubbery octopus tentacle — dull low squelch, with ${el}. ` +
        'NO shrill squeal, NO high-pitched yelp, NO screech. Dark, wet, bassy.' + SHORT },
    { file: `audio/monster/mob_octoLeg${leg}_die.mp3`, dur: 0.7,
      desc: `A severed octopus tentacle flopping wetly and going limp — low squelchy slap into ` +
        `water with ${el}, fading. NO shrill squeal, NO high shriek.` + SHORT },
  ])),

  // ---- Withering Tide deaths ---------------------------------------------
  // Bonebos'n is a TWIN-CUTLASS PIRATE SKELETON (it even has a parry trait),
  // so its death is blades as much as bones.
  { file: 'audio/monster/mob_bonebosn_die.mp3', dur: 0.9,
    desc: 'A pirate skeleton coming apart on a wrecked deck — dry bones clattering down with the ' +
      'metallic clang of two dropped cutlasses, ending in a soggy rattle on wet planks. ' +
      'Bone first, water second.' + SHORT },
  // A "cur" is a DOG — these are drowned hounds that pack-hunt on broken
  // decks, not drowned sailors.
  { file: 'audio/monster/mob_drownedCur_die.mp3', dur: 0.9,
    desc: 'A drowned HOUND dying — a waterlogged canine whine and choked-off snarl, gurgling as ' +
      'seawater swallows it, ending in a wet slump. Animal, not human. No words.' + SHORT },
  { file: 'audio/monster/mob_spectreCannoneer_die.mp3', dur: 0.9,
    desc: 'A ghostly gunner dissipating — hollow airy moan snuffing out with a soft powder-flash ' +
      'hiss and a distant cannon report dying away. Spectral, breathy, damp.' + SHORT },
  { file: 'audio/monster/mob_brinekraken_die.mp3', dur: 0.9,
    desc: 'A giant tide-rot squid the size of a longboat dying — deep booming underwater groan ' +
      'collapsing into a heavy wet surge of water, vast and sinking. ' +
      'NO shrill squeal, NO high shriek.' + SHORT },
];

const targets = SOUNDS.filter(s => !only || s.file.includes(only));

// ---- MP3 duration straight from the frame headers ---------------------------
const RATES = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
const SR = [44100, 48000, 32000, 0];
function frames(buf) {
  let p = 0;
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') {
    const sz = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    p = 10 + sz;
  }
  const out = [];
  let dur = 0;
  while (p + 4 < buf.length) {
    if (buf[p] !== 0xff || (buf[p + 1] & 0xe0) !== 0xe0) { p++; continue; }
    const br = RATES[(buf[p + 2] >> 4) & 0x0f] * 1000;
    const sr = SR[(buf[p + 2] >> 2) & 0x03];
    if (!br || !sr) { p++; continue; }
    const len = Math.floor(144 * br / sr) + ((buf[p + 2] >> 1) & 1);
    dur += 1152 / sr;
    out.push({ off: p, end: p + len, at: dur });
    p += len;
  }
  return { list: out, dur, start: out.length ? out[0].off : 0 };
}
const durationOf = (buf) => frames(buf).dur;
// Trim to the last frame that keeps us under the bar (frame boundary, so the
// file stays a valid MP3).
function trimTo(buf, maxSec) {
  const f = frames(buf);
  if (f.dur <= maxSec || !f.list.length) return buf;
  let cut = f.list[f.list.length - 1].end;
  for (const fr of f.list) if (fr.at > maxSec) { cut = fr.off; break; }
  return buf.subarray(0, cut);
}

if (!has('--generate')) {
  console.log(`DRY RUN — ${targets.length} clips (2 credits each = ${targets.length * 2}cr). Bar: < ${MAX_SEC}s\n`);
  for (const s of targets) {
    const abs = path.join(ROOT, s.file);
    const cur = fs.existsSync(abs) ? durationOf(fs.readFileSync(abs)) : null;
    console.log(`  ${(cur == null ? '(new)' : cur.toFixed(2) + 's').padStart(7)} -> req ${s.dur}s  ${s.file}`);
    console.log(`        "${s.desc.slice(0, 96)}..."`);
  }
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const BACKUP = path.join(ROOT, 'audio', '_regen_backup', TAG);
fs.mkdirSync(BACKUP, { recursive: true });

let failures = 0;
for (const s of targets) {
  const abs = path.join(ROOT, s.file);
  let done = false, last;
  for (let a = 1; a <= 3 && !done; a++) {
    // Ask progressively shorter if the model overshoots the bar.
    const req = Math.max(0.35, s.dur - (a - 1) * 0.2);
    try {
      process.stdout.write(`${s.file} attempt ${a} (req ${req}s) ... `);
      const res = await fetch(`${API}/audio/sound-effect`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ description: s.desc, duration: req, loop: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`);
      const j = await res.json();
      const url = j.url || (j.result && j.result.url);
      if (!url) throw new Error('no url in response');
      const dl = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
      if (!dl.ok) throw new Error(`download HTTP ${dl.status}`);
      let buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length < 1000) throw new Error(`suspiciously small (${buf.length}B)`);
      let dur = durationOf(buf);
      if (!dur) throw new Error('not a decodable MP3');
      if (dur >= MAX_SEC && a < 3) throw new Error(`${dur.toFixed(2)}s — over the ${MAX_SEC}s bar, retrying shorter`);
      if (dur >= MAX_SEC) {                     // last attempt: trim at a frame boundary
        buf = trimTo(buf, MAX_SEC - 0.05);
        dur = durationOf(buf);
        console.log(`(trimmed) `);
      }
      if (dur >= MAX_SEC) throw new Error(`still ${dur.toFixed(2)}s after trim`);
      if (fs.existsSync(abs)) fs.copyFileSync(abs, path.join(BACKUP, path.basename(abs)));
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const tmp = abs + '.tmp';
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, abs);                  // atomic, per project convention
      console.log(`OK ${dur.toFixed(2)}s, ${(buf.length / 1024).toFixed(0)} KB`);
      done = true;
    } catch (e) {
      last = e; console.log('FAIL: ' + e.message);
      if (/\b402\b|credits/i.test(e.message)) { console.error('OUT OF CREDITS'); process.exit(3); }
      if (a < 3) await sleep(1500 * a);
    }
  }
  if (!done) { failures++; console.error(`giving up on ${s.file}: ${last?.message}`); }
  await sleep(1200);
}
console.log(failures ? `DONE with ${failures} failure(s)` : 'ALL DONE');
process.exit(failures ? 1 : 0);
