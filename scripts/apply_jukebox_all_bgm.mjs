// DJ Vinyl's jukebox carries every BGM in the game, and every one of them can be unlocked.
// ============================================================================
// Per user: "ensure that the jukebox NPCs plays all the available BGM in the game".
//
// AUDITED against the game's own tables (98 maps in _BGM_MAP_FILES, 42 distinct files, plus the generic
// boss theme, the default world theme and the start-page theme):
//
//   MISSING from JUKEBOX_TRACKS, though the game plays them:
//     audio/bgm_king.mp3            - The Inner Dimension, the Confused Vigil, Block-land Apex (v0.29.631)
//     audio/bgm_bone_graveyard.mp3  - Crypt of Whispers and all three Bone Graveyard maps
//     audio/Moji is loading.mp3     - the loading / start-page theme every player hears first
//
//   LISTED but could NEVER be unlocked: the jukebox is a discovery log (v0.29.76, per user) - a track opens
//   once _setBossBgm has played its file on a map - and two tracks have no map to play on:
//     zodiacHall  - bgm_zodiac_hall.mp3 was replaced by bgm_zodiac_sanctum and plays nowhere now
//     the title theme above - it plays before a save is even loaded, outside the map path entirely
//
// FIX: add the three tracks, and give JUKEBOX_TRACKS an `always` flag honoured by _isTrackHeard for the two
// with no in-world source. The discovery lock itself is untouched: every other track still opens only when
// it is heard, and the two new map tracks open through the existing hook automatically, because
// _JUKEBOX_FILE_TO_ID is derived from this same list.
//
// Not added, deliberately: audio/boss/* are 2-4 s intro stingers, audio/story/* is narration, audio/ambient/*
// are ambience beds, audio/_themes_backup/* is five backups the game never references, and
// audio/bgm_glasswind.mp3 is the legacy file the real Glasswind track (already listed) replaced.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) jb-all/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the start-page theme, at the end of Hub / Towns ---------------------------------------
sub('title theme',
  "    { id:'megamall',       name:'Everdawn Megamall',               file:'audio/bgm_everdawn_megamall.mp3',      tag:'market' },",
  J("    { id:'megamall',       name:'Everdawn Megamall',               file:'audio/bgm_everdawn_megamall.mp3',      tag:'market' },",
    "    // v0.30.786 jb-all — the loading / start-page theme. It plays before a save exists, so no map can ever mark it",
    "    // heard: `always` opens it from the start (see _isTrackHeard).",
    "    { id:'titleTheme',     name:'Moji is Loading (title theme)',   file:'audio/Moji is loading.mp3',            tag:'title', always:true },"));

// ---- 2. Bone Graveyard, with the other wilds ---------------------------------------------------
sub('bone graveyard',
  "    { id:'distortedPortal',name:'Distorted Portal',                file:'audio/bgm_distorted_portal.mp3',  tag:'portal' },",
  J("    { id:'distortedPortal',name:'Distorted Portal',                file:'audio/bgm_distorted_portal.mp3',  tag:'portal' },",
    "    { id:'boneGraveyard',  name:'Bone Graveyard & Crypt of Whispers', file:'audio/bgm_bone_graveyard.mp3', tag:'crypt' },   // v0.30.786 jb-all — played on four maps, was never listed"));

// ---- 3. the legacy Zodiac Hall can no longer be heard anywhere ---------------------------------
sub('zodiac hall',
  "    { id:'zodiacHall',     name:'Zodiac Hall (legacy)',            file:'audio/bgm_zodiac_hall.mp3',            tag:'zodiac' },",
  "    { id:'zodiacHall',     name:'Zodiac Hall (legacy)',            file:'audio/bgm_zodiac_hall.mp3',            tag:'zodiac', always:true },   // v0.30.786 jb-all — replaced by the Sanctum theme and played nowhere, so it could never be discovered");

// ---- 4. the shared echo-arena boss theme --------------------------------------------------------
sub('king theme',
  "    { id:'gravitosArena',  name:'The Singularity (Gravitos)',      file:'audio/The Singularity.mp3',            tag:'boss' },  // v0.26.493",
  J("    { id:'gravitosArena',  name:'The Singularity (Gravitos)',      file:'audio/The Singularity.mp3',            tag:'boss' },  // v0.26.493",
    "    { id:'echoArenas',     name:'The Inner Dimension · Confused Vigil · Block-land Apex', file:'audio/bgm_king.mp3', tag:'boss' },   // v0.30.786 jb-all — v0.29.631 gave these three arenas this theme; it was never listed"));

// ---- 5. discovery honours `always` --------------------------------------------------------------
sub('heard',
  'function _isTrackHeard(id) { return !!_jukeboxHeardSet()[id]; }',
  J('// v0.30.786 jb-all — a track with no in-world source (`always` in JUKEBOX_TRACKS) is open from the start; every',
    '// other track still has to be heard first, exactly as the v0.29.76 discovery log was asked to work.',
    'const _JUKEBOX_ALWAYS = new Set(JUKEBOX_TRACKS.flatMap((g) => g.tracks.filter((t) => t.always).map((t) => t.id)));',
    'function _isTrackHeard(id) { return _JUKEBOX_ALWAYS.has(id) || !!_jukeboxHeardSet()[id]; }'));

const grew = s.length - n0;
if (grew < 900 || grew > 3000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: jukebox gains 3 tracks, 2 always-open (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
