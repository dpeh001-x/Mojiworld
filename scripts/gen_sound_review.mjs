#!/usr/bin/env node
// Build tools/sound_review.html — the sound-review page a PLAYTESTER uses.
//
// Audience note, because it drives every decision in here: the tester is not a
// developer. The page therefore contains no shell commands, no generator names,
// no API/credit talk and no jargon — just play, judge, comment, export. The
// older tools/monster_sound_review.html is the developer-side tool; this is not
// a replacement for it, it is the half a tester is meant to see.
//
// The clip list and all display names are BAKED INTO the generated file rather
// than fetched at runtime. That is deliberate: a tester may well open the page
// straight off disk by double-clicking it, and browsers refuse fetch() on
// file:// URLs. Baking keeps the page working from a folder, a zip or a shared
// drive with no server and nothing to install. <audio> still resolves the mp3s
// relatively, so the page must stay next to the repo it was built from.
//
// Inputs:  data/sfx_manifest.js          (run scripts/gen_sfx_manifest.mjs first)
//          tools/sound_review_names.json (display names; see REFRESHING below)
// Output:  tools/sound_review.html
//
// REFRESHING THE NAMES: sound_review_names.json is a snapshot of MAPS[].npcs and
// LX_MONSTER_STATS/monsterTypes taken from a running game. Monsters and NPCs get
// added far more slowly than clips do, so a snapshot is fine; when it drifts,
// open mojiworld_game.html and re-dump those two tables. Anything missing from
// the snapshot still renders — it just falls back to the raw key as its name.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const manifestSrc = await readFile(join(root, 'data', 'sfx_manifest.js'), 'utf8');
const MANIFEST = JSON.parse(manifestSrc.slice(manifestSrc.indexOf('['), manifestSrc.lastIndexOf(']') + 1));
const NAMES = JSON.parse(await readFile(join(root, 'tools', 'sound_review_names.json'), 'utf8'));

const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// The five family clips are not monsters. They are the fallback a monster plays
// on its FIRST encounter while its own clip is still decoding, and permanently
// for anything with no custom clip — so they are the sound a player actually
// hears most often, and they get their own reviewable section instead of being
// silently dropped for failing the monster lookup.
const FAMILY = { bat: 'Bats & fliers', beast: 'Beasts', dragon: 'Dragons', ghost: 'Ghosts & undead', plant: 'Plants & fungi' };

const rows = [];
for (const clip of MANIFEST) {
  if (clip.cat === 'monster-hit' || clip.cat === 'monster-die') {
    const kind = clip.cat === 'monster-hit' ? 'hit' : 'die';
    const key = clip.id.replace(/^mob_/, '').replace(/_(hit|die)$/, '');
    if (FAMILY[key]) {
      rows.push({ id: clip.id, file: clip.file, sec: 'family', kind,
        name: FAMILY[key], sub: 'fallback sound', kb: clip.kb,
        when: kind === 'hit'
          ? `Played when you hit any ${FAMILY[key].toLowerCase()} that has no sound of its own — and on the very first hit of every one of them.`
          : `Played when any ${FAMILY[key].toLowerCase()} without its own sound dies.` });
      continue;
    }
    const m = NAMES.mons[key] || {};
    rows.push({ id: clip.id, file: clip.file, sec: kind === 'hit' ? 'hit' : 'die', kind,
      name: m.name || titleCase(key), sub: [m.lv ? 'Lv ' + m.lv : '', m.boss ? 'BOSS' : ''].filter(Boolean).join(' · '),
      boss: !!m.boss, lv: m.lv || 0, key, kb: clip.kb,
      when: kind === 'hit' ? `Played every time you hit ${m.name || key}.` : `Played when ${m.name || key} dies.` });
    continue;
  }
  if (clip.cat === 'npc') {
    const key = clip.id.replace(/^npc_/, '');
    const n = NAMES.npcs[key];
    rows.push({ id: clip.id, file: clip.file, sec: 'npc', kind: 'talk',
      name: n ? n.name : titleCase(key), sub: n ? (n.maps || []).slice(0, 2).join(', ') : 'not placed on any map',
      orphan: !n, key, kb: clip.kb,
      when: n ? `Played when you start talking to ${n.name}${n.maps && n.maps.length ? ' in ' + n.maps[0] : ''}.`
              : `This voice has no character on any map right now — it may be left over from a cut NPC.` });
  }
}

const ORDER = { hit: 0, die: 1, npc: 2, family: 3 };
rows.sort((a, b) => ORDER[a.sec] - ORDER[b.sec] || (a.lv || 0) - (b.lv || 0) || a.name.localeCompare(b.name));

const SECTIONS = [
  { id: 'hit',    label: 'Monster hit sounds',   blurb: 'The sound when you land a hit on a monster. You hear these more than any other sound in the game, so they matter most.' },
  { id: 'die',    label: 'Monster death sounds', blurb: 'The sound when a monster dies.' },
  { id: 'npc',    label: 'NPC voices',           blurb: 'The little babble a character makes when you start talking to them. It should suit their personality.' },
  { id: 'family', label: 'Fallback sounds',      blurb: 'Shared backup sounds. You hear these the first time you meet any creature of that kind, before its own sound has loaded.' },
];

const built = { rows, sections: SECTIONS, gameVer: NAMES.ver || '', builtFrom: MANIFEST.length };
const template = await readFile(join(root, 'scripts', 'sound_review_template.html'), 'utf8');
const html = template.replace('/*__DATA__*/null', JSON.stringify(built));
await writeFile(join(root, 'tools', 'sound_review.html'), html);

const per = SECTIONS.map((s) => `${s.id}:${rows.filter((r) => r.sec === s.id).length}`).join('  ');
console.log(`Wrote tools/sound_review.html — ${rows.length} clips  (${per})`);
