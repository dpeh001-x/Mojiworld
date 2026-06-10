#!/usr/bin/env node
// Skill-bar icons that RESEMBLE the skill's real effect art (ludo editImage).
// =============================================================================
// Each skill already has cast-VFX art in Sprites/fx/<key>. This feeds that art
// to ludo /assets/image/edit as the reference and "iconizes" it: same subject,
// colors and style, recomposed as one clean centered die-cut sticker (no box).
// Output overwrites Sprites/skills/<iconId>.png. The previous batch is preserved
// at Sprites/skills/_sticker_backup/.
//
//   node scripts/generate_skill_icons_fromfx.mjs                 # dry-run map
//   node scripts/generate_skill_icons_fromfx.mjs --only fireball --generate
//   node scripts/generate_skill_icons_fromfx.mjs --generate      # all mapped
//   flags: --only a,b  --force
// Needs LUDO_API_KEY.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX_DIR = join(repoRoot, 'Sprites', 'fx');
const OUT_DIR = join(repoRoot, 'Sprites', 'skills');
const SIZE = 256;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const EDIT_PROMPT = 'Turn this game spell-effect art into a clean SKILL ICON sticker. Keep the SAME subject, the SAME colors and the SAME art style as the source image; just recompose it as ONE bold, clear, centered emblem filling about 80% of the square. ' +
  'It must be a die-cut sticker on a FULLY TRANSPARENT background — ABSOLUTELY NO rounded-square, NO tile, NO card, NO frame, NO border, NO panel, NO background fill, NO scene. ' +
  'Simple clean chibi style, a thin even ~2px black outline, flat vibrant colors, light shading. ABSOLUTELY NO TEXT, letters or numbers.';

// skill icon id (Sprites/skills/<id>.png) -> reference fx file in Sprites/fx/
const MAP = {
  arcaneBurst: 'arcane_burst.png', archbishop_grail: 'archbishop_grail.png', arrowRain: 'arrow_rain.png',
  backstab: 'backstab.png', ballista_volley: 'ballista_volley.png', beastmaster_pack: 'beastmaster_pack.png',
  blink: 'blink.png', bloodlust: 'bloodlust.png', celestialAurora: 'celestial_aurora.png',
  chargedShot: 'charged_shot.png', crusader_aegis: 'crusader_aegis.png', darkPulse: 'hexmaster_darkpulse.webp',
  deathBlossom: 'death_blossom.png', doombringer_apoc: 'doombringer_apoc.png', dragoon_skylance: 'dragoon_skylance.png',
  eagleEye: 'eagle_eye.png', elemental: 'archmage_elemental.png', elementalArrows: 'elemental_arrows.png',
  elementalist_cascade: 'elementalist_cascade.png', evadeRoll: 'evade_burst.png', fireball: 'fireball.png',
  flurry: 'flurry.webp', groundSlam: 'ground_slam.png', guardian: 'knight_guardian.png',
  hexmaster_grandhex: 'hexmaster_grandhex.png', holyLight: 'holy_light.png', holyShield: 'holy_shield.png',
  iceSpike: 'ice_spike.png', lich_harvest: 'soul_vortex.webp', magicBolt: 'magic_bolt.png',
  marksman_oneshot: 'marksman_oneshot.png', meteor: 'meteor.png', multiShot: 'multi_shot.png',
  nightreaper_mark: 'nightreaper_eclipse.png', phantom_cut: 'phantom_cut.png', powerStrike: 'power_strike.png',
  rampage: 'rampage.webp', rush: 'rush.webp', sage_meteorshower: 'sage_meteorshower.png',
  shadowStrike: 'shadow_strike.png', shadowlord_clones: 'shadowlord_clones.png', shinobi_seal: 'shinobi_seal.png',
  skyhunter_gale: 'skyhunter_gale.png', slash: 'slash_warrior.webp', sleight: 'phantom_voidrift.png',
  warlord_warcry: 'warlord_banner.png',
  smokeBomb: 'shinshuriken.png', smokeDash: 'smoke_dash.png', snipe_railgun: 'railshot.png',
  soulSiphon: 'soul_vortex1.webp', stab: 'stab.webp', throwDagger: 'throw_dagger.png',
  warCry: 'warcry.png', wildBond: 'wild_bond.png',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
const toUri = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(980, 980, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');

let keys = Object.keys(MAP);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching skills.'); process.exit(1); }
if (!has('--generate')) {
  console.log(`# ${keys.length} skill icons from fx art -> Sprites/skills/<id>.png\n`);
  for (const k of keys) console.log(`  ${k.padEnd(22)} <- fx/${MAP[k]}`);
  console.log('\n# Note: arrowShot has no clean fx match — left on its current icon.');
  console.log('# Re-run with --generate (needs LUDO_API_KEY). Flags: --only a,b --force');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen(k) {
  const fxPath = join(FX_DIR, MAP[k]);
  if (!(await exists(fxPath))) return 'NO FX';
  const uri = await toUri(await readFile(fxPath));
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image/edit`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image: uri, prompt: EDIT_PROMPT, n: 1, augment_prompt: false }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 140)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(join(OUT_DIR, `${k}.png`), await sharp(await fetchBuf(url)).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
      return 'OK';
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}

console.log(`Iconizing ${keys.length} skills from fx art...`);
let made = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} <- ${MAP[k]} ... `);
  try { const r = await gen(k); if (r === 'OK') { made++; console.log('OK'); await sleep(350); } else { failed++; console.log(r); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${failed} failed.`);
process.exit(failed ? 2 : 0);
