#!/usr/bin/env node
// Boss intro stingers (A) + master signature-skill sounds (C) via Ludo
// /audio/sound-effect. Mirrors gen_monster_sounds.mjs conventions.
// =============================================================================
//   node tools/gen_boss_skill_sfx.mjs                 # dry-run (prompts + cost)
//   node tools/gen_boss_skill_sfx.mjs --kind boss     # boss | skill | both(default)
//   node tools/gen_boss_skill_sfx.mjs --generate
//   node tools/gen_boss_skill_sfx.mjs --generate --only zodiac_aries,lich_harvest --force
// Boss stingers → audio/boss/boss_<key>.mp3 (longer, ~4s). Skill sounds →
// audio/skill/<id>.mp3 (~1.3s). Wire-up (maps) is done in mojiworld_game.html.
// =============================================================================
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const arg = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// A — boss intro stingers. key → flavour (wrapped in a stinger template below).
const BOSS = {
  zodiac_aries:'a charging fiery ram, crackling flame and a thunderous horned bellow',
  zodiac_taurus:'a molten stone bull, ground-shaking stomp and a hot snorting roar',
  zodiac_gemini:'ethereal twin spirits, a shimmering airy chime doubling into an echo',
  zodiac_cancer:'an armoured crab, wet shell clack and a deep tidal surge',
  zodiac_leo:'a regal lion, a roaring flame burst with a brassy fanfare',
  zodiac_virgo:'a celestial maiden, soft choral shimmer rising to a sharp sting',
  zodiac_libra:'cosmic scales, a ringing metallic balance chime and an ominous swell',
  zodiac_scorpio:'a venomous scorpion, chittering carapace and a dark watery hiss',
  zodiac_sagittarius:'a centaur archer, a whistling flaming arrow draw over a war drum',
  zodiac_capricorn:'a mountain sea-goat, grinding stone and a low resonant horn',
  zodiac_aquarius:'a cosmic water-bearer, cascading ethereal droplets and an airy swell',
  zodiac_pisces:'twin cosmic fish, a deep bubbling current and a haunting whale-like tone',
  sundered_smith:'a molten forge titan, hammer clang on anvil, roaring furnace and a heavy step',
  young_confused_barnaby:'a confused young sentinel, a wobbly off-key fanfare and an uncertain shield clank',
  brinekraken:'a deep-sea kraken, a monstrous watery roar, crashing waves and a tentacle slap',
  mirrorSelf:'a mirror reflection, a glassy shimmer shattering into a reversed warped echo',
};
// C — master signature skill cast sounds.
const SKILL = {
  doombringer_apoc:'an apocalyptic dark explosion ultimate, massive doom blast',
  dragoon_skylance:'a diving spear sky-lance, piercing metallic crash on impact',
  warlord_warcry:'a thunderous warlord battle cry, a rallying commanding roar',
  crusader_aegis:'a holy shield barrier raised, a radiant protective chime',
  shadowlord_clones:'shadow clones summoned, a multiplying dark whoosh',
  shinobi_seal:'a ninja hand-seal cast, a sharp spectral seal snap',
  nightreaper_mark:'a death mark applied, an ominous dark bell toll',
  phantom_cut:'a phantom blade flurry, rapid spectral slashes',
  hexmaster_grandhex:'a grand hex curse, a crackling dark-frost burst',
  archbishop_grail:'a holy grail blessing, a radiant choral heal swell',
  sage_meteorshower:'a meteor shower, repeated falling fireball impacts',
  elementalist_cascade:'an elemental cascade, a fire-ice-lightning surge combo',
  lich_harvest:'a soul vortex, a draining ghostly suction pull',
  skyhunter_gale:'a gale of arrows, a whistling wind-charged volley',
  deadeye:'a deadeye focus shot, a precise charged twang and crack',
  snipe_railgun:'a railgun snipe, an electric charge then a piercing supersonic crack',
  marksman_oneshot:'a one-shot kill shot, a heavy charged boom',
  ballista_volley:'a siege ballista volley, heavy bolt thuds',
  beastmaster_pack:'a beast pack summoned, a snarling chorus of animal calls',
};

const kind = (arg('--kind') || 'both').toLowerCase();
const onlyArg = arg('--only');
const only = onlyArg ? new Set(onlyArg.split(',').map(s => s.trim())) : null;
let work = [];
if (kind === 'boss' || kind === 'both') for (const k in BOSS) work.push({ k, cat:'boss',
  path:`audio/boss/boss_${k}.mp3`, dur:4.0,
  prompt:`Epic video-game BOSS APPEARS intro stinger: ${BOSS[k]}. Dramatic, cinematic, builds then hits hard, no looping music.` });
if (kind === 'skill' || kind === 'both') for (const id in SKILL) work.push({ k:id, cat:'skill',
  path:`audio/skill/${id}.mp3`, dur:1.3,
  prompt:`Video-game skill cast sound effect: ${SKILL[id]}. Short, punchy, impactful, no music.` });
if (only) work = work.filter(w => only.has(w.k));
if (!work.length) { console.error('No entries match.'); process.exit(1); }

if (!has('--generate')) {
  for (const w of work) console.log(`## [${w.cat}] ${w.k} -> ${w.path}\n${w.prompt}\n`);
  console.log(`# ${work.length} clips (~${work.length*2} credits). Re-run with --generate.`);
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 120000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = async p => { try { await access(p); return true; } catch { return false; } };
async function fetchTimed(url, opts={}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; } finally { clearTimeout(t); }
}
async function once(w, dest) {
  const res = await fetchTimed(`${BASE}/audio/sound-effect`, { method:'POST',
    headers:{ 'Authorization':`ApiKey ${apiKey}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ description:w.prompt, duration:w.dur, loop:false, augment_prompt:false }) });
  if (!res.ok) throw new Error(`Ludo ${res.status}: ${(await res.text()).slice(0,150)}`);
  const data = await res.json();
  const url = data?.url || (Array.isArray(data) ? data[0]?.url : null);
  if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0,120));
  const a = await fetchTimed(url); if (!a.ok) throw new Error('fetch ' + a.status);
  const buf = Buffer.from(await a.arrayBuffer()); if (!buf.length) throw new Error('empty');
  await mkdir(dirname(dest), { recursive:true }); await writeFile(dest, buf);
}
console.log(`Generating ${work.length} clips (skip-existing: ${!force})...`);
let made=0, skip=0, fail=0;
for (const w of work) {
  const dest = join(repoRoot, w.path);
  process.stdout.write(`[${w.cat}] ${w.k} ... `);
  if (!force && await exists(dest)) { skip++; console.log('skip'); continue; }
  try { await once(w, dest); } catch (e) { try { await sleep(1500); await once(w, dest); } catch (e2) { fail++; console.log('FAIL: ' + e2.message); continue; } }
  made++; console.log('OK'); await sleep(250);
}
console.log(`Done. ${made} made, ${skip} skipped, ${fail} failed.`);
process.exit(fail ? 2 : 0);
