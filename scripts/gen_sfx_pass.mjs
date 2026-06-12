// gen_sfx_pass.mjs — SFX-gap fill via ludo.ai sound-effect endpoint.
// From the 2026-06-12 SFX review: the 4 Bloom Reaches plant monsters are
// silent (no mob_<type>_hit/die files -> generic synth pop), failure has no
// voice (enhance-fail), and the interaction layer is quiet (dialog blip,
// quest accept, boss intro/down stings).
//
// Usage:
//   node scripts/gen_sfx_pass.mjs              # dry-run: list what would generate
//   LUDO_API_KEY=... node scripts/gen_sfx_pass.mjs --generate   # call ludo (2cr each)
//   add --force to regenerate files that already exist
//
// Monster files are pure drop-ins (CUSTOM_SOUNDS.md pipeline picks them up
// with no code change). The audio/ui/ files are wired in mojiworld_game.html
// via _UI_SFX_FILES (wiring shipped alongside this script; players silently
// no-op until the files land).
import fs from 'node:fs';
import path from 'node:path';

const SOUNDS = [
  // ---- Bloom Reaches plant monsters (drop-in, zero code) ----
  { file: 'audio/monster/mob_thornmaw_hit.mp3',  dur: 0.6, desc: 'cartoon woody snap, dry bramble branch crunch, small plant monster taking a hit, snappy and dry' },
  { file: 'audio/monster/mob_thornmaw_die.mp3',  dur: 1.3, desc: 'pile of dry thorny branches collapsing and crackling apart, cartoon plant monster defeated, woody clatter settling' },
  { file: 'audio/monster/mob_elderbark_hit.mp3', dur: 0.7, desc: 'deep hollow knock on a massive old tree trunk, resonant wooden thunk, heavy bark impact' },
  { file: 'audio/monster/mob_elderbark_die.mp3', dur: 1.8, desc: 'great old tree groaning, creaking long and low, then falling with a heavy crash of branches, slow and mournful' },
  { file: 'audio/monster/mob_pinechad_hit.mp3',  dur: 0.6, desc: 'juicy tropical fruit thwack with a stiff leaf rustle, punchy cartoon impact on a firm pineapple' },
  { file: 'audio/monster/mob_pinechad_die.mp3',  dur: 1.3, desc: 'wet fruit burst splat then comical deflating squeak, cartoon pineapple popped, juicy and bouncy' },
  { file: 'audio/monster/mob_meloncholy_hit.mp3',dur: 0.6, desc: 'hollow ripe watermelon thump, deep wet knock, cartoon melon taking a hit' },
  { file: 'audio/monster/mob_meloncholy_die.mp3',dur: 1.5, desc: 'big watermelon splitting open with a wet crack and squelch, followed by a tiny sad descending warble, comic and soggy' },
  // ---- UI / moment stings (wired via _UI_SFX_FILES) ----
  // (boss intro/down stings deliberately NOT generated: _BOSS_SFX_FILES already
  // ships per-boss stingers + a dedicated boss death pipeline for all 22 bosses)
  { file: 'audio/ui/enhance_fail.mp3', dur: 1.2, desc: 'metallic crack of a failed forge enhancement, anvil clink breaking, short sad downward chime, disappointment sting for a game UI' },
  { file: 'audio/ui/dialog_blip.mp3',  dur: 0.2, desc: 'single soft cute pop blip, tiny round bubble tick for opening a game dialog, gentle and unobtrusive' },
  { file: 'audio/ui/quest_accept.mp3', dur: 0.9, desc: 'crisp parchment page flip with a small bright confirmation chime, accepting a quest in a cozy RPG' },
];

const GENERATE = process.argv.includes('--generate');
const FORCE = process.argv.includes('--force');
const apiKey = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);

if (!GENERATE) {
  console.log('DRY RUN — would generate (2cr each, ' + SOUNDS.length * 2 + 'cr total):');
  for (const s of SOUNDS) console.log(`  ${fs.existsSync(s.file) ? '[exists]' : '[ NEW  ]'} ${s.file}  <- "${s.desc.slice(0, 60)}..."`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flag: --force');
  process.exit(0);
}
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function genOne(s) {
  if (fs.existsSync(s.file) && !FORCE) { console.log(`skip (exists): ${s.file}`); return; }
  const res = await fetch(`${API}/audio/sound-effect`, {
    method: 'POST',
    headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({ description: s.desc, duration: s.dur, loop: false }),
  });
  if (!res.ok) throw new Error(`${s.file}: HTTP ${res.status} ${await res.text().catch(() => '')}`);
  const j = await res.json();
  const url = j.url || (j.result && j.result.url);
  if (!url) throw new Error(`${s.file}: no url in response ${JSON.stringify(j).slice(0, 200)}`);
  const audio = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!audio.ok) throw new Error(`${s.file}: download HTTP ${audio.status}`);
  const buf = Buffer.from(await audio.arrayBuffer());
  if (buf.length < 1000) throw new Error(`${s.file}: suspiciously small (${buf.length}B) — not written`);
  fs.mkdirSync(path.dirname(s.file), { recursive: true });
  const tmp = s.file + '.tmp';
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, s.file);   // atomic per project convention
  console.log(`OK ${s.file} (${(buf.length / 1024).toFixed(0)} KB, ${j.duration ?? '?'}s)`);
}

let fail = 0;
for (const s of SOUNDS) {
  try { await genOne(s); } catch (e) { fail++; console.error('FAIL ' + e.message); }
  await sleep(1200);   // gentle pacing between credit-billed calls
}
console.log(fail ? `DONE with ${fail} failures` : 'ALL DONE');
process.exit(fail ? 1 : 0);
