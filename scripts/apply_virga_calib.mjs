// v0.30.293 — size compensation for the Virga repad.
// The 27 idle/walk/attack frames were rescaled to k=0.913 inside their canvas
// (apply_virga_repad.mjs) to clear the feather probe. s = 1/k restores her
// exact on-screen size; both the repad and calib s are anchored at the feet,
// so they cancel precisely. fly is untouched and stays at s=1.
// Keys verified against _loadBossFrames: 'zodiac/idle' | 'zodiac/walk' | 'zodiac/attack'.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/data/anim_calib.js';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('zodiac_virgo')) { console.log('already applied'); process.exit(0); }
const S = +(1 / 0.913).toFixed(3);   // 1.095
const anchor = '"zodiac_taurus": {';
if ((s.split(anchor).length - 1) !== 1) { console.error('ABORT: taurus anchor not unique'); process.exit(1); }
const block = '"zodiac_virgo": {\n'
  + '    "zodiac/idle":   { "s": ' + S + ', "dx": 0, "dy": 0 },\n'
  + '    "zodiac/walk":   { "s": ' + S + ', "dx": 0, "dy": 0 },\n'
  + '    "zodiac/attack": { "s": ' + S + ', "dx": 0, "dy": 0 }\n'
  + '  },\n  ' + anchor;
s = s.split(anchor).join(block);
const grew = s.length - n0;
if (grew < 100 || grew > 500) { console.error(`ABORT: moved ${grew} chars`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 500) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: zodiac_virgo calib s=${S} for idle/walk/attack (+${grew} chars)`);
