#!/usr/bin/env node
// Build sfx_manifest.js for monster_animator.html's SFX board.
// Scans audio/**/*.mp3 (skipping _*backup dirs) and pairs every clip with a
// human "when it plays in-game" description: curated for audio/ui/*, pattern-
// derived for monster/skill/boss/voice/bgm/ambient/mobs. Re-run after adding
// clips:  node scripts/gen_sfx_manifest.mjs
import { readdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const UI_WHEN = {
  ui_toggle: 'Opening/closing any UI panel (inventory, skills, map...)',
  boon_gain: 'Picking a boon reward after a boss/elite clear',
  rare_drop: 'A rare-or-better item drop hits the ground',
  upgrade_success: 'Forge: gear upgrade/enhance SUCCEEDS',
  enhance_fail: 'Forge: star-enhance attempt FAILS',
  jump: 'Player jumps',
  land: 'Player lands from a fall (fall-speed gated, 150ms cooldown)',
  close: 'A dialog/modal closes (Leave, Esc, walk-away)',
  option_click: 'Selecting an option inside an NPC dialog',
  error: 'Action denied (not enough coins / level gate / inventory full)',
  portal: 'Entering a portal / map travel',
  pickup_coin: 'Picking up mojicoins',
  pickup_item: 'Picking up an equipment/etc item drop',
  level_up: 'Player level-up fanfare',
  low_hp: 'HP first drops below 25% of max (re-arms above 35%)',
  quest_accept: 'Accepting a quest from an NPC',
  quest_complete: 'Completing a quest / handing it in',
  dialog_blip: 'NPC dialog typewriter text blips',
  qte_capture: 'Boss Shackle QTE: the chain-stun LANDS on the player',
  qte_tap: 'Shackle QTE: pressing a CORRECT arrow (chip pops green)',
  qte_wrong: 'Shackle QTE: pressing a WRONG arrow (progress resets, -300ms)',
  qte_break: 'Shackle QTE: completing the sequence — chains shatter',
  qte_perfect: 'Shackle QTE: zero-mistake PERFECT break (crit ring + bigger burst)',
};
// de-share pass mob projectile clips: shoot key -> firing monster
const MOB_FIRE = {
  mquery: 'young_confused_barnaby fires his wobbling question-mark bolt',
  mossbaton: 'towerOssifer throws his spinning bone baton',
  mspine: 'pufferfish spits a venom needle dart',
  mgaleblade: 'razorgale throws a wind-sickle crescent',
  mcryshard: 'shardlich casts a necro-crystal shard',
  mbark: 'stump hurls a mossy bark chunk',
  mrivet: 'forgewight spits a white-hot molten rivet',
  mcoffinshard: 'tombWraith launches a ghost-flame coffin splinter',
  mstormorb: 'towerStormcaller launches a crackling storm orb',
  mfeather: 'seraph fires a radiant feather blade',
  mhexbolt: 'towerHexer casts a cursed evil-eye hex bolt',
};
const VOICE_CLASS = { bowman: 'archer', mage: 'mage', pirate: 'pirate', thief: 'rogue', warrior: 'warrior' };

function describe(rel) {
  const parts = rel.split('/');
  const base = parts[parts.length - 1].replace(/\.(mp3|wav|ogg)$/i, '');
  const dir = parts.length > 1 ? parts[parts.length - 2] : '';
  if (dir === 'ui')   return { cat: 'ui', when: UI_WHEN[base] || 'UI event SFX (unmapped — play to identify, then add to gen_sfx_manifest.mjs)' };
  if (dir === 'mobs') return { cat: 'mob-fire', when: 'Fires when ' + (MOB_FIRE[base] || base + ' projectile is fired') + ' (380ms anti-spam cooldown).' };
  if (dir === 'monster') {
    const m = base.match(/^mob_(.+)_(hit|die)$/);
    if (m) return { cat: 'monster-' + m[2], when: (m[2] === 'hit' ? 'Plays when the player HITS a ' : 'Plays when a ') + m[1] + (m[2] === 'die' ? ' DIES' : '') };
    return { cat: 'monster', when: 'Monster SFX: ' + base };
  }
  if (dir === 'skill') return { cat: 'skill', when: 'Cast SFX — plays when the player uses the "' + base.replace(/_/g, ' ') + '" skill' };
  if (dir === 'boss')  return { cat: 'boss-voice', when: 'Boss intro VOICE — plays once when first entering the ' + base.replace(/^boss_/, '').replace(/_/g, ' ') + ' arena (gated by _bossIntrosSeen)' };
  if (dir === 'ambient') return { cat: 'ambient', when: 'Ambient loop layered under the BGM on ' + base + '-biome maps' };
  if (dir === 'voice') {
    const v = base.match(/^(\w+?)_(m|f)_(hit\d|death|.*)$/) || base.match(/^(cheer)_(m|f)_(\d)$/);
    if (v) {
      const cls = VOICE_CLASS[v[1]] || v[1];
      const what = v[3].startsWith('hit') ? 'takes a hit (variant ' + v[3].slice(3) + ')' : v[3] === 'death' ? 'dies' : 'cheer emote';
      return { cat: 'voice', when: 'Player voice — ' + cls + ' (' + (v[2] === 'm' ? 'male' : 'female') + ') ' + what };
    }
    return { cat: 'voice', when: 'Player voice line: ' + base };
  }
  if (base.startsWith('bgm_')) return { cat: 'bgm', when: 'Background music for the ' + base.slice(4).replace(/_/g, ' ') + ' area' };
  return { cat: 'bgm', when: 'Background music track "' + base + '" (map theme)' };
}

const out = [];
async function walk(dir) {
  for (const e of await readdir(join(root, dir), { withFileTypes: true })) {
    if (e.isDirectory()) { if (!e.name.startsWith('_')) await walk(dir + '/' + e.name); continue; }
    if (!/\.(mp3|wav|ogg)$/i.test(e.name)) continue;
    const rel = dir + '/' + e.name;
    const d = describe(rel.replace(/^audio\//, ''));
    const st = await stat(join(root, rel));
    out.push({ id: e.name.replace(/\.(mp3|wav|ogg)$/i, ''), file: rel, cat: d.cat, when: d.when, kb: Math.round(st.size / 1024) });
  }
}
await walk('audio');
out.sort((a, b) => a.cat.localeCompare(b.cat) || a.id.localeCompare(b.id));
await writeFile(join(root, 'sfx_manifest.js'),
  '// AUTO-GENERATED by scripts/gen_sfx_manifest.mjs — do not hand-edit.\n' +
  '// Every game audio clip + when it plays, for monster_animator.html\'s SFX board.\n' +
  'window.LX_SFX_MANIFEST = ' + JSON.stringify(out) + ';\n');
console.log('Wrote sfx_manifest.js —', out.length, 'clips in', new Set(out.map(o => o.cat)).size, 'categories');
