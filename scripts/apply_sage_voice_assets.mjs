// The assets half of sage-voice (runs as the pipeline's LX_APPLY2, AFTER sw.js / the clip / gen_npc_voice.mjs are
// re-synced from origin):
//   1) audio/npc/npc_mystery_sage.mp3 <- the chosen take (LX_VOICE_SRC): take 3 of four ludo rolls, f0 380 Hz,
//      vowel-band 0.85 - the one in the young-woman band with the most voice in it (the others: 613 / 525 Hz squeaks,
//      and a thinner 416 Hz take). The old clip was f0 130 Hz, "a bored sigh".
//   2) sw.js: the asset cache generation +1, with a note - the clip is REPLACED under its own name, and the service
//      worker's stale-while-revalidate would otherwise keep playing the old sigh to every returning browser.
//   3) scripts/gen_npc_voice.mjs: the mystery_sage voice (so a re-roll reproduces this cast) and the job-API poll -
//      /audio/sound-effect now answers {id, status} and the tool threw "no url" on every (paid) roll.
// Idempotent; guarded.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const atomic = (f, data) => { fs.writeFileSync(f + '.tmp', data); fs.renameSync(f + '.tmp', f); };

// 1) the clip
const SRC = process.env.LX_VOICE_SRC;
const DEST = path.join(ROOT, 'audio', 'npc', 'npc_mystery_sage.mp3');
if (!SRC || !fs.existsSync(SRC)) die('LX_VOICE_SRC missing: ' + SRC);
const buf = fs.readFileSync(SRC);
if (buf.length < 8000 || buf.length > 200000) die('the take is an odd size: ' + buf.length);
if (!fs.existsSync(DEST) || !fs.readFileSync(DEST).equals(buf)) { atomic(DEST, buf); console.log('clip: npc_mystery_sage.mp3 replaced (' + buf.length + ' B)'); }
else console.log('clip: already the new take');

// 2) sw.js cache generation
const SW = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
if (!/sage-voice/.test(sw)) {
  const m = sw.match(/^const CACHE = 'mojiworld-assets-v(\d+)';.*$/m);
  if (!m) die('sw.js CACHE line not found');
  const cur = +m[1], next = cur + 1;
  const EOL = sw.includes('\r\n') ? '\r\n' : '\n';
  const note = `// v0.30.x sage-voice - v${cur} -> v${next}. audio/npc/npc_mystery_sage.mp3 ("???", Sage Mira) is REPLACED under its own${EOL}// name (recast from a 130 Hz sigh to a soft young elf woman), so a returning browser would otherwise keep the old clip.${EOL}`;
  sw = sw.replace(m[0], () => note + `const CACHE = 'mojiworld-assets-v${next}';   // v0.30.x sage-voice - the ??? NPC's voice recast`);
  atomic(SW, sw);
  console.log(`sw.js: cache v${cur} -> v${next}`);
} else console.log('sw.js: already bumped');

// 3) the voice tool
const G = path.join(ROOT, 'scripts', 'gen_npc_voice.mjs');
let g = fs.readFileSync(G, 'utf8');
if (!g.includes('mystery_sage: {')) {
  const A = "    accept: { minF0: 280, maxF0: 520, minVowelBand: 0.25 },\n  },\n};";
  const Ar = A.replace(/\n/g, '\r\n');
  const anchor = g.includes(A) ? A : (g.includes(Ar) ? Ar : null);
  if (!anchor) die('gen_npc_voice VOICES end not found');
  const E = anchor === Ar ? '\r\n' : '\n';
  const entry = [
    '    accept: { minF0: 280, maxF0: 520, minVowelBand: 0.25 },',
    '  },',
    '  mystery_sage: {',
    '    // Reported (2026-09-26): the "???" NPC\'s voice "doesn\'t match" (earlier tester note: "sounds like a bored sigh").',
    '    // "???" is Sage Mira (sage_mira.webp): a young-looking elf woman with long silver hair in white-and-gold robes,',
    '    // calm and mysterious, who offers the 12-hour boon. The old clip measured f0 130 Hz. Shipped: take 3 of four,',
    '    // f0 380 Hz / vowel-band 0.85 (the others 613 and 525 Hz squeaks, and a thinner 416 Hz take).',
    "    desc: 'Animal Crossing style character voice BABBLE for a video game: nonsense vocal syllables only, NOT real '",
    "      + 'words, NOT speech, NOT singing. Single voice, clean dry studio recording, no music, no background noise. '",
    "      + 'A SERENE YOUNG ELF SAGE WOMAN with long silver hair: a soft, airy, gentle feminine voice, calm and kind '",
    "      + 'and a little mysterious, light lilting unhurried syllables with a faint magical shimmer, clear and '",
    "      + 'graceful. NOT a sigh, NOT bored, NOT low-pitched, NOT male, NOT old, NOT a squeaky child, NOT an animal.',",
    '    dur: 1.0,',
    '    accept: { minF0: 230, maxF0: 460, minVowelBand: 0.25 },',
    '  },',
    '};'].join(E);
  g = g.replace(anchor, () => entry);
  console.log('gen_npc_voice: mystery_sage voice added');
}
if (!g.includes('/assets/jobs/')) {
  const B = '    const j = await res.json();';
  const U = '    const url = j.url || (j.result && j.result.url);';
  if (g.split(B).length !== 2 || g.split(U).length !== 2) die('gen_npc_voice response lines not found');
  const E = g.includes('\r\n') ? '\r\n' : '\n';
  g = g.replace(B, () => [
    '    let j = await res.json();',
    '    // 2026-09-26: /audio/sound-effect answers with a JOB ({id, status}); the finished job at GET /assets/jobs/<id>',
    '    // carries result [{url}]. A job is paid the moment it is accepted: always poll it, never re-POST.',
    '    for (let _t = 0; j && j.id && !(j.url || (j.result && (j.result.url || (Array.isArray(j.result) && j.result[0])))) && _t < 120; _t++) {',
    "      if (j.status === 'failed' || j.status === 'error' || j.status === 'cancelled') throw new Error('job ' + j.status);",
    '      await new Promise((r) => setTimeout(r, Math.max(3000, Number(j.poll_after_ms) || 4000)));',
    '      const pr = await fetch(`${API}/assets/jobs/${j.id}`, { headers: { Authorization: `ApiKey ${apiKey}` }, signal: AbortSignal.timeout(30000) });',
    '      if (pr.status === 429) continue;',
    '      if (!pr.ok) throw new Error(`job HTTP ${pr.status}`);',
    '      j = await pr.json();',
    '    }'].join(E));
  g = g.replace(U, () => '    const url = j.url || (Array.isArray(j.result) && j.result[0] && j.result[0].url) || (j.result && j.result.url);');
  console.log('gen_npc_voice: job-API poll added');
}
atomic(G, g);
