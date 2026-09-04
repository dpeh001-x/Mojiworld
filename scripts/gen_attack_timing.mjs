#!/usr/bin/env node
// BAKE DEFAULT ATTACK FRAME TIMING for every boss attack set that has none.
// ============================================================================
// Per user: "for bosses during their attack phase make sure the animation
// sprites have slightly longer intervals and hold critical sprite frames
// longer to make attacks not feel rushed".
//
// The game already has a per-frame timing channel: an `ft` array (ms per
// frame) on a calib state, authored in monster_animator.html, walked by
// _lxFtWalk in the game and mirrored by the animator's playback. Where it is
// absent the game falls back to a flat 48ms per frame - a nine-frame swing in
// 432ms, every frame equal, the strike gone as fast as the windup. This bakes
// a default `ft` into data/anim_calib.js for each boss attack set that has no
// authored timing, so BOTH the game and the animator play it the same way.
//
// The rule, fitted to the eight timings the artist already authored (which
// all ramp to a peak at frames 4-5 of nine):
//   base 60ms  (the "slightly longer" interval; was 48)
//   strike frame       x2.2   the critical frame, held
//   frames either side x1.5   commit and follow-through
//   first frame        x1.2   anticipation
//   last frame         x1.6   settle
// The strike is the middle frame, nudged to the frame AFTER the apex when the
// manifest's per-frame boxes show a clear one (the apex is the frame with the
// greatest vertical extent - a raised weapon - and the strike follows it).
// A nine-frame set totals 720ms.
//
// Baked entries carry `ftAuto: true`. The animator's export drops unknown
// fields, so a timing the artist touches loses the flag and is treated as
// authored from then on - never overwritten here.
//   node scripts/gen_attack_timing.mjs            bake (atomic write)
//   node scripts/gen_attack_timing.mjs --check    exit 1 if the file is stale
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// MOJI_CALIB_FILE / MOJI_MANIFEST_FILE read elsewhere (a scratch copy of the
// tip, so a stale working copy never leaks in); MOJI_CALIB_OUT writes elsewhere.
const CALIB = process.env.MOJI_CALIB_FILE || path.join(ROOT, 'data', 'anim_calib.js');
const OUT = process.env.MOJI_CALIB_OUT || CALIB;
const MANIFEST = process.env.MOJI_MANIFEST_FILE || path.join(ROOT, 'data', 'anim_calib_manifest.js');
const CHECK = process.argv.includes('--check');

export const LX_ATK_BASE_MS = 60;
export const LX_ATK_HOLD = { strike: 2.2, side: 1.5, first: 1.2, last: 1.6 };

// cb entries are [top, bottom, bodyTop, bodyBottom] in source pixels (see
// scripts/gen_anim_manifest.mjs). Returns the default dwell array for n frames.
export function defaultAttackFt(n, cb, frameH) {
  if (!(n > 1)) return null;
  let strike = Math.round((n - 1) / 2);
  if (Array.isArray(cb) && cb.length === n && frameH > 0) {
    let apex = -1, best = Infinity, lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const b = cb[i]; if (!Array.isArray(b) || b.length < 2) { apex = -1; break; }
      const top = +b[0];
      if (top < best) { best = top; apex = i; }
      lo = Math.min(lo, top); hi = Math.max(hi, top);
    }
    // only trust the apex when the extent actually moves (> 3% of the frame)
    // and it sits inside the swing, not on the resting first/last frames
    if (apex >= 1 && apex <= n - 3 && (hi - lo) / frameH > 0.03) strike = Math.min(n - 3, Math.max(2, apex + 1));
  }
  const ft = new Array(n);
  for (let i = 0; i < n; i++) {
    let k = 1;
    if (i === strike) k = LX_ATK_HOLD.strike;
    else if (Math.abs(i - strike) === 1) k = LX_ATK_HOLD.side;
    if (i === 0) k = Math.max(k, LX_ATK_HOLD.first);
    if (i === n - 1) k = Math.max(k, LX_ATK_HOLD.last);
    ft[i] = Math.round(LX_ATK_BASE_MS * k);
  }
  return ft;
}

// v0.30.382 - THE MONSTER RULE, INDIVIDUALISED (per user: "improving the smoothness
// of the monster animation sprite time interval, it should be well timed with the
// attack, should not be rushed, and should not be spammy" / "the frames should be
// individualised per monster so do look into the attack frames especially").
// Every one of the 110 monster attack sets has per-frame content boxes in the
// manifest, and the apex (the frame whose content top is highest - a raised claw,
// a reared body) sits anywhere from frame 0 to 8 across them. So each set gets its
// own timing from its own frames:
//   base 72ms (the shared mob cadence; fatDragon keeps its authored 96)
//   strike = the frame after the apex when the apex is clear (>= 3% of the frame
//            height); a late apex (the last two frames) makes the strike the frame
//            before the settle; a flat set (a pulse, a spit) strikes mid-sequence
//   strike hold = 1.8x + 2.5x the apex prominence, capped at 2.8x - a snail that
//            rears 39% of its frame holds its strike 2.8x, a squid that barely
//            moves 1.8x
//   sides x1.5, first frame x1.2, last x1.6, as the bosses
// The game walks the result ONCE per attack (v0.30.382, _monsterStateFrame).
export const LX_MOB_ATK_BASE_MS = 72;
export const LX_MOB_ATK_BASE_BY_TYPE = { fatDragon: 96 };
export const LX_MOB_HOLD = { strikeMin: 1.8, strikeSlope: 2.5, strikeMax: 2.8, side: 1.5, first: 1.2, last: 1.6, pulse: 1.8, clearApex: 0.03 };
export function defaultMobAttackFt(n, cb, frameH, base) {
  if (!(n > 1)) return null;
  base = base > 0 ? base : LX_MOB_ATK_BASE_MS;
  let strike = Math.round((n - 1) / 2), prom = 0;
  if (Array.isArray(cb) && cb.length === n && frameH > 0) {
    let apex = -1, best = Infinity, lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const b = cb[i]; if (!Array.isArray(b) || b.length < 2) { apex = -1; break; }
      const top = +b[0];
      if (top < best) { best = top; apex = i; }
      lo = Math.min(lo, top); hi = Math.max(hi, top);
    }
    if (apex >= 0) prom = (hi - lo) / frameH;
    if (prom >= LX_MOB_HOLD.clearApex) {
      if (apex >= 1 && apex <= n - 3) strike = Math.min(n - 3, Math.max(2, apex + 1));
      else if (apex >= n - 2) strike = n - 2;
    }
  }
  const strikeHold = prom < LX_MOB_HOLD.clearApex ? LX_MOB_HOLD.pulse : Math.min(LX_MOB_HOLD.strikeMax, LX_MOB_HOLD.strikeMin + prom * LX_MOB_HOLD.strikeSlope);
  const ft = new Array(n);
  for (let i = 0; i < n; i++) {
    let k = 1;
    if (i === strike) k = strikeHold;
    else if (Math.abs(i - strike) === 1) k = LX_MOB_HOLD.side;
    if (i === 0) k = Math.max(k, LX_MOB_HOLD.first);
    if (i === n - 1) k = Math.max(k, LX_MOB_HOLD.last);
    ft[i] = Math.round(base * k);
  }
  return ft;
}
function main() {
  const src = readFileSync(CALIB, 'utf8');
  const m = src.match(/^([\s\S]*?)window\.LX_ANIM_CALIB = ([\s\S]*?);\nwindow\.LX_ATK_HITBOX = ([\s\S]*?);\n$/);
  if (!m) { console.error('anim_calib.js: unexpected layout'); process.exit(2); }
  const header = m[1], calib = JSON.parse(m[2]), hitbox = JSON.parse(m[3]);
  const man = readFileSync(MANIFEST, 'utf8');
  const M = JSON.parse(man.slice(man.indexOf('{'), man.lastIndexOf('}') + 1));
  let baked = 0, kept = 0, stale = 0;
  const report = [];
  for (const key of Object.keys(M).sort()) {
    const e = M[key];
    if (!e || (e.group !== 'boss' && e.group !== 'monster') || !e.states || !e.states.attack) continue;   // v0.30.382 - monsters too
    const st = e.states.attack;
    const n = st.count | 0;
    if (n < 2) continue;
    const cur = calib[key] && calib[key].attack;
    if (cur && Array.isArray(cur.ft) && !cur.ftAuto) { kept++; continue; }   // authored: never touched
    const ft = e.group === 'boss' ? defaultAttackFt(n, st.cb, st.h) : defaultMobAttackFt(n, st.cb, st.h, LX_MOB_ATK_BASE_BY_TYPE[key]);   // v0.30.382
    if (!ft) continue;
    const same = cur && Array.isArray(cur.ft) && cur.ft.length === ft.length && cur.ft.every((v, i) => v === ft[i]) && cur.ftAuto === true;
    if (same) continue;
    stale++;
    if (!CHECK) {
      calib[key] = calib[key] || {};
      calib[key].attack = Object.assign({}, calib[key].attack || {}, { ft, ftAuto: true });
      baked++;
      report.push(key + ': ' + ft.join('/'));
    }
  }
  if (CHECK) {
    if (stale) { console.error(`gen_attack_timing --check: ${stale} attack set(s) lack the default timing - run node scripts/gen_attack_timing.mjs`); process.exit(1); }
    console.log(`gen_attack_timing --check: ok (${kept} authored kept)`);
    return;
  }
  if (!baked) { console.log(`nothing to bake (${kept} authored kept)`); return; }
  const out = header + 'window.LX_ANIM_CALIB = ' + JSON.stringify(calib, null, 2) + ';\n'
    + 'window.LX_ATK_HITBOX = ' + JSON.stringify(hitbox, null, 2) + ';\n';
  const tmp = OUT.replace(/\.js$/, '') + '.tmp.js';   // node --check wants a .js extension
  writeFileSync(tmp, out);
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' });
  renameSync(tmp, OUT);
  console.log(`baked ${baked} attack timing(s), kept ${kept} authored`);
  for (const r of report) console.log('  ' + r);
}
if (process.argv[1] && /gen_attack_timing\.mjs$/.test(process.argv[1])) main();
