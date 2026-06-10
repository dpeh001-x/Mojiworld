#!/usr/bin/env node
// Lv-50 ULTIMATE (B-slot) skill cast SFX via Ludo /audio/sound-effect.
// Mirrors tools/gen_boss_skill_sfx.mjs. One epic 2-3.5s clip per master ult,
// strongly themed to the skill. Output -> audio/skill/<master>_ult.mp3.
// Wire-up: _SKILL_SFX_FILES in mojiworld_game.html (done alongside this).
// =============================================================================
//   node tools/gen_ult_skill_sfx.mjs                 # dry-run (prompts + cost)
//   node tools/gen_ult_skill_sfx.mjs --only lich_ult,sage_ult --generate
//   node tools/gen_ult_skill_sfx.mjs --generate --force
// Needs LUDO_API_KEY. Resumable: skips a clip whose mp3 already exists.
// =============================================================================
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const arg = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// id (= SKILLS slot-'b' id) -> { p: skill-relevant flavour, dur: seconds (1-3.5) }
const ULT = {
  warlord_ult:      { p: 'a commanding war-horn rally over a thunderous spectral cavalry charge, ending in a booming ground shockwave', dur: 3.5 },
  doombringer_ult:  { p: 'a titanic doom greatsword swung in screen-wide cleaves, ringing dark metal and an apocalyptic explosive boom', dur: 3.5 },
  crusader_ult:     { p: 'a radiant holy barrier rising with a sacred hum, then bursting into a divine light nova', dur: 3.0 },
  dragoon_ult:      { p: 'a soaring dragon ascent, then a rain of piercing lance impacts and a heavy crashing slam', dur: 3.0 },
  shadowlord_ult:   { p: 'a dark shadow-swarm whoosh with multiplying echoing strikes collapsing into an implosion', dur: 3.0 },
  shinobi_ult:      { p: 'a time-slowing whoosh, then a rapid flurry of katana slashes ending in a smoke burst', dur: 3.0 },
  nightreaper_ult:  { p: 'an ominous blood-eclipse bell toll with whirling spectral soul-scythes and dripping dark energy', dur: 3.0 },
  phantom_ult:      { p: 'a warping void singularity sucking everything inward, building to a collapsing implosion boom', dur: 3.0 },
  sage_ult:         { p: 'a screaming comet descending into a massive fiery impact with a rumbling ground quake', dur: 3.5 },
  elementalist_ult: { p: 'a swirling four-element surge — fire roar, ice shatter, lightning crackle, arcane hum — converging into a beam blast', dur: 3.5 },
  lich_ult:         { p: 'a ghostly necrotic surge with rattling rising bones, then a soul-detonation blast', dur: 3.0 },
  hexmaster_ult:    { p: 'a sickly cursed incantation crackle spreading like contagion, then a malignant dark burst', dur: 2.5 },
  archbishop_ult:   { p: 'a soaring choral angelic ascension with a sweeping radiant holy light beam', dur: 3.5 },
  marksman_ult:     { p: 'a focus time-slow hush, then several precise charged rifle cracks firing at once', dur: 2.5 },
  ballista_ult:     { p: 'a heavy siege-engine winch and lock, then a barrage of explosive bolt thuds and a big anchor-shot boom', dur: 3.0 },
  beastmaster_ult:  { p: 'a primal apex-beast fusion roar with a thundering trampling charge', dur: 3.0 },
  skyhunter_ult:    { p: 'a swirling wind-tempest with a whistling cascade of homing arrows raining down', dur: 3.0 },
};

const onlyArg = arg('--only');
const only = onlyArg ? new Set(onlyArg.split(',').map(s => s.trim())) : null;
let work = Object.keys(ULT).filter(k => !only || only.has(k)).map(k => ({
  k, path: `audio/skill/${k}.mp3`, dur: ULT[k].dur,
  prompt: `Epic video-game ULTIMATE skill cast sound effect: ${ULT[k].p}. Cinematic, powerful, impactful, builds and hits hard, mono game SFX, no looping music.`,
}));
if (!work.length) { console.error('No entries match.'); process.exit(1); }

if (!has('--generate')) {
  for (const w of work) console.log(`## ${w.k} (${w.dur}s) -> ${w.path}\n${w.prompt}\n`);
  console.log(`# ${work.length} clips (~${work.length * 2} credits). Re-run with --generate (needs LUDO_API_KEY).`);
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 120000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = async p => { try { await access(p); return true; } catch { return false; } };
async function fetchTimed(url, opts = {}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; } finally { clearTimeout(t); }
}
async function once(w, dest) {
  const res = await fetchTimed(`${BASE}/audio/sound-effect`, {
    method: 'POST', headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: w.prompt, duration: w.dur, loop: false, augment_prompt: false }),
  });
  if (!res.ok) throw new Error(`Ludo ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  const url = data?.url || (Array.isArray(data) ? data[0]?.url : null);
  if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 120));
  const a = await fetchTimed(url); if (!a.ok) throw new Error('fetch ' + a.status);
  const buf = Buffer.from(await a.arrayBuffer()); if (!buf.length) throw new Error('empty');
  await mkdir(dirname(dest), { recursive: true }); await writeFile(dest, buf);
}
console.log(`Generating ${work.length} ultimate SFX (skip-existing: ${!force})...`);
let made = 0, skip = 0, fail = 0;
for (const w of work) {
  const dest = join(repoRoot, w.path);
  process.stdout.write(`${w.k} ... `);
  if (!force && await exists(dest)) { skip++; console.log('skip'); continue; }
  let ok = false, lastErr;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    try { await once(w, dest); ok = true; }
    catch (e) { lastErr = e; if (attempt < 4) await sleep(3000 * attempt); }
  }
  if (ok) { made++; console.log('OK'); await sleep(300); }
  else { fail++; console.log('FAIL: ' + (lastErr && lastErr.message)); }
}
console.log(`Done. ${made} made, ${skip} skipped, ${fail} failed.`);
process.exit(fail ? 2 : 0);
