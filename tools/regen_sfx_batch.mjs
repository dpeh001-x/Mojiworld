#!/usr/bin/env node
// Regenerate the 25 clips ticked in the animator SFX board (sfx_regen_list.json).
// Skill SFX cut SHORT and succinct (archer/mage tightest); boss themes go via
// POST /audio/music (3cr, 90s loopable); everything else via /audio/sound-effect
// (2cr). Originals backed up to audio/_regen_backup/<same path> before overwrite.
//   node tools/regen_sfx_batch.mjs            # dry-run
//   node tools/regen_sfx_batch.mjs --generate # all (needs LUDO_API_KEY)
//   flags: --only a,b | --force (regen even if backup already exists)
import { writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const has = (f) => process.argv.slice(2).includes(f);
const arg = (f) => { const a = process.argv.slice(2); const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };

// id -> { file, ep: 'sfx'|'music', d: prompt, sec }
const ITEMS = {
  // ---- skill casts: SHORT + succinct (old: arrow 1.4s, evade 3.0s, meteor 3.0s...) ----
  archer_arrow:        { file: 'audio/skill/archer_arrow.mp3',        ep: 'sfx', sec: 0.45, d: 'a single quick bowstring release with a tight arrow whoosh, clean and crisp, extremely short game skill sound' },
  archer_charged:      { file: 'audio/skill/archer_charged.mp3',      ep: 'sfx', sec: 0.8,  d: 'a brief drawn bowstring creak then one powerful snap release with a piercing whoosh, punchy, very short' },
  archer_evade:        { file: 'audio/skill/archer_evade.mp3',        ep: 'sfx', sec: 0.5,  d: 'a quick acrobatic backflip dodge whoosh with a light cloth flutter, agile, extremely short' },
  ballista_volley:     { file: 'audio/skill/ballista_volley.mp3',     ep: 'sfx', sec: 0.6,  d: 'three extremely rapid heavy crossbow bolt thunks fired in under half a second, tight mechanical burst, cut abruptly with no tail, extremely short' },
  crusader_aegis:      { file: 'audio/skill/crusader_aegis.mp3',      ep: 'sfx', sec: 0.7,  d: 'one quick bright holy shield pop: a single warm chime ping with instant shimmer, cut abruptly, no reverb tail, extremely short' },
  deadeye:             { file: 'audio/skill/deadeye.mp3',             ep: 'sfx', sec: 0.6,  d: 'one instant precision shot: a tiny aim click then a single sharp crack, cut abruptly with no echo, extremely short' },
  dragoon_ult:         { file: 'audio/skill/dragoon_ult.mp3',         ep: 'sfx', sec: 1.4,  d: 'a thunderous dragon-lance dive impact: sharp draconic energy crack into a compact boom, epic but tight, short' },
  elementalist_cascade:{ file: 'audio/skill/elementalist_cascade.mp3',ep: 'sfx', sec: 1.1,  d: 'a quick four-element burst layered into one cascade: fire crackle, ice glint, electric spark, arcane hum, short' },
  hexmaster_grandhex:  { file: 'audio/skill/hexmaster_grandhex.mp3',  ep: 'sfx', sec: 1.0,  d: 'a dark spreading curse pulse with a witchy descending warble, ominous magical hex, short' },
  lich_harvest:        { file: 'audio/skill/lich_harvest.mp3',        ep: 'sfx', sec: 1.0,  d: 'a ghostly soul-drain inhale sweeping inward with an eerie cold chime, necromantic, short' },
  mage_ice:            { file: 'audio/skill/mage_ice.mp3',            ep: 'sfx', sec: 0.6,  d: 'a sharp ice crystal forming instantly: crisp frost crackle with a glassy ring, cold and clean, extremely short' },
  mage_meteor:         { file: 'audio/skill/mage_meteor.mp3',         ep: 'sfx', sec: 1.0,  d: 'a fast fiery meteor whoosh ending in one compact impact boom, no rumble tail, punchy, short' },
  warrior_roar:        { file: 'audio/skill/warrior_roar.mp3',        ep: 'sfx', sec: 0.9,  d: 'one fierce battle roar shout, powerful and commanding, single burst with no echo tail, short' },
  // ---- mob fire / deaths / ui ----
  mquery:              { file: 'audio/mobs/mquery.mp3',               ep: 'sfx', sec: 0.5,  d: 'a wobbly uncertain magical bloop with a comedic warbling pitch bend, hesitant spell misfire, very short' },
  mspine:              { file: 'audio/mobs/mspine.mp3',               ep: 'sfx', sec: 0.4,  d: 'a quick wet needle dart spit: sharp little pop with a thin whistling whoosh, very short' },
  mob_axolotl_die:     { file: 'audio/monster/mob_axolotl_die.mp3',   ep: 'sfx', sec: 0.6,  d: 'a cute small aquatic creature defeated: soft squeaky blub deflating into bubbles, gentle and adorable, very short' },
  mob_pathsBane_die:   { file: 'audio/monster/mob_pathsBane_die.mp3', ep: 'sfx', sec: 1.0,  d: 'an eerie tide spirit dissolving: ghostly watery sigh dispersing into mist with a faint glyph chime, short' },
  mob_potato_uncle_die:{ file: 'audio/monster/mob_potato_uncle_die.mp3', ep: 'sfx', sec: 0.8, d: 'a comical heavy potato thud followed by a short deflating grumble, funny cartoon defeat, very short' },
  land:                { file: 'audio/ui/land.mp3',                   ep: 'sfx', sec: 0.3,  d: 'a soft quick footfall landing thump on grass, subtle and muffled, pleasant when repeated, extremely short' },
  // ---- boss themes via /audio/music: 90s loopable battle pieces ----
  boss_koopaloo:       { file: 'audio/boss/boss_koopaloo.mp3',        ep: 'music', sec: 90, d: 'intense playful koopa-king boss battle theme, marching brass and fiery taiko percussion, chiptune-orchestral hybrid, relentless driving tempo, seamless loop' },
  boss_mirrorSelf:     { file: 'audio/boss/boss_mirrorSelf.mp3',      ep: 'music', sec: 90, d: 'eerie mirror-double boss battle theme, unsettling reversed piano motifs and glassy textures over a driving dark pulse, uncanny tension, seamless loop' },
  boss_shroomaloo:     { file: 'audio/boss/boss_shroomaloo.mp3',      ep: 'music', sec: 90, d: 'whimsical giant mushroom queen boss theme, bouncy bassoon and woodwinds over heavy driving drums, sparkling spore magic shimmer, mischievous and dangerous, seamless loop' },
  boss_young_confused_barnaby: { file: 'audio/boss/boss_young_confused_barnaby.mp3', ep: 'music', sec: 90, d: 'tragic confused sentinel boss theme, an off-kilter melancholic waltz with martial snare drums and weeping strings, beautiful but unsettling, seamless loop' },
  boss_zodiac_taurus:  { file: 'audio/boss/boss_zodiac_taurus.mp3',   ep: 'music', sec: 90, d: 'earth-shaking taurus zodiac boss theme, massive stomping percussion, deep blaring horns, molten driving energy, unstoppable charge feel, seamless loop' },
  boss_zodiac_virgo:   { file: 'audio/boss/boss_zodiac_virgo.mp3',    ep: 'music', sec: 90, d: 'celestial judgment virgo zodiac boss theme, austere choir voices, tolling justice bells, severe driving strings, divine and merciless, seamless loop' },
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
let keys = Object.keys(ITEMS);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k.includes(o)));

if (!has('--generate')) {
  console.log(`# ${keys.length} clips. sfx=2cr music=3cr -> est ${keys.reduce((n,k)=>n+(ITEMS[k].ep==='music'?3:2),0)} credits`);
  for (const k of keys) console.log(`  ${k}  [${ITEMS[k].ep}${ITEMS[k].ep==='sfx'?' '+ITEMS[k].sec+'s':' '+ITEMS[k].sec+'s'}]`);
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  const it = ITEMS[k];
  const dest = join(root, it.file);
  const bak = join(root, 'audio', '_regen_backup', it.file.replace(/^audio\//, ''));
  if (!has('--force') && await exists(bak)) { skipped++; console.log(`  ${k} ... skip (already regenerated; --force to redo)`); continue; }
  process.stdout.write(`  ${k} [${it.ep}] ... `);
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const body = it.ep === 'music'
        ? { description: it.d, duration: it.sec, augment_prompt: true }
        : { description: it.d, duration: it.sec, loop: false };
      const res = await fetch(`${API}/audio/${it.ep === 'music' ? 'music' : 'sound-effect'}`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(it.ep === 'music' ? 300000 : 120000),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      if (!data.url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 120));
      const ar = await fetch(data.url, { signal: AbortSignal.timeout(120000) });
      if (!ar.ok) throw new Error('audio fetch ' + ar.status);
      const buf = Buffer.from(await ar.arrayBuffer());
      if (buf.length < 1000) throw new Error('suspiciously small payload ' + buf.length);
      // backup original ONLY after a good generation, then atomic-ish replace
      await mkdir(dirname(bak), { recursive: true });
      if (await exists(dest)) await copyFile(dest, bak);
      const tmp = dest + '.tmp';
      await writeFile(tmp, buf);
      const { rename } = await import('node:fs/promises');
      await rename(tmp, dest);
      console.log(`OK ${(buf.length / 1024).toFixed(0)}kB`);
      made++; lastErr = null; await sleep(800);
      break;
    } catch (e) { lastErr = e; if (attempt < 3) await sleep(3000 * attempt); }
  }
  if (lastErr) { failed++; console.log(`FAIL: ${lastErr.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
