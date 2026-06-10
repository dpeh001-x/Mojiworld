#!/usr/bin/env node
// Monster weapon-SWING attack runner (morph technique) — v0.26.370
// =============================================================================
// For melee weapon-wielders the in-place animateSprite won't carry the weapon
// through a full strike arc, so we MORPH: editImage(base) -> a "weapon at the
// end of its strike" pose, then animateSprite(initial=base, final=pose) so the
// in-between frames sweep the weapon through the full swing. Output overwrites
// Sprites/monsters/attack/<type>_0..8.webp (the renderer cycles them on attack).
// Same strict framing: frame_size:-9 (True-Size) + resize to EXACT base dims.
//
//   node scripts/generate_monster_swing.mjs                       # dry-run
//   node scripts/generate_monster_swing.mjs --only echoKnight --generate
//   node scripts/generate_monster_swing.mjs --generate            # all listed
// Needs LUDO_API_KEY.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const MON_DIR = join(repoRoot, 'Sprites', 'monsters');
const OUT_DIR = join(MON_DIR, 'attack');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const TAIL = ' Same character, colours and outline as the source; full body, feet planted, ONE single connected figure (do not duplicate or detach limbs or the weapon); keep the WHOLE weapon inside the frame; stay centered at the EXACT same size, framing and left/right facing; transparent background; do not mirror or flip.';
// type -> { edit: end-pose prompt, motion: swing prompt }
const SWINGS = {
  goblinMauler: {
    edit: 'the SAME green goblin brute at the END of a mighty MAUL SMASH — it has swung its big stone maul/sledgehammer DOWN and forward so the maul head is now low near the ground in front of it, body crouched and lunged into the smash, with a burst of dust and sparks at the impact.' + TAIL,
    motion: 'the goblin hoists its heavy maul up over its shoulder then SWINGS it down and forward in a powerful overhead smash, the heavy head crashing down with an impact burst at the end — a big weighty swing arc.' + TAIL },
  echoKnight: {
    edit: 'the SAME blue-flame armored knight at the END of a sweeping SWORD SLASH — its blue flaming sword has swung across to the far side, a blue flame trail arcing behind the blade, body twisted and lunging into the slash.' + TAIL,
    motion: 'the knight winds up and SLASHES its blue flaming sword across in a powerful arc, a blue flame trail following the blade, ending lunged into the slash.' + TAIL },
  pathsBane: {
    edit: 'the SAME red-hooded reaper at the END of a wide SCYTHE REAP — it has swept its great curved scythe across and low in a reaping arc so the blade is now forward and low, hood and cloak flaring with the motion, a trail of dark crimson energy along the arc.' + TAIL,
    motion: 'the reaper winds the great scythe back then SWEEPS it across in a wide low reaping arc, the curved blade tracing a dark crimson energy trail, the cloak flaring.' + TAIL },
  forgewight: {
    edit: 'the SAME molten forge-construct at the END of an overhead HAMMER SMASH — it has slammed its glowing forge hammer DOWN to the ground in front, the hammer head low at ground level, body lunged forward, with a burst of sparks and embers at the impact.' + TAIL,
    motion: 'the forge construct raises its glowing hammer overhead then SLAMS it down to the ground in a powerful smash, sparks and embers bursting at the impact.' + TAIL },
  deranged_kuro: {
    edit: 'the SAME black-clad ninja at the END of a fast KATANA SLASH — it has slashed its glowing purple energy katana across and forward in a low lunge, a vivid purple slash-arc trailing the blade, body lunged into the strike.' + TAIL,
    motion: 'the ninja winds up and SLASHES its glowing purple energy katana across in a fast lunging strike, a vivid purple slash-arc trailing the blade.' + TAIL },
  shardlich: {
    edit: 'the SAME crystalline ice lich at the END of an ICE STAFF STRIKE — it has swung its tall crystal staff down and forward so the staff head is low at the strike point, frost shards and icy mist bursting at the impact, robe flaring.' + TAIL,
    motion: 'the ice lich raises its tall crystal staff then SWINGS and SLAMS it down and forward in a striking blow, frost shards and icy mist bursting at the impact.' + TAIL },
  bonebosn: {
    edit: 'the SAME chibi pirate skeleton at the END of a wide CUTLASS SLASH — it has swung its curved cutlass sword across and forward so the blade is now extended out to the front, body lunged into the slash, a faint steel gleam tracing the arc; the WHOLE blade stays well inside the frame.' + TAIL,
    motion: 'the pirate skeleton winds the cutlass back over one shoulder then SLASHES it across and forward in a fast wide sword arc, lunging into the strike, a steel gleam trailing the blade, then settles; keep the full blade inside the frame the whole time.' + TAIL },
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const basePath = async (t) => { for (const e of ['.png', '.webp']) { const p = join(MON_DIR, t + e); if (await exists(p)) return p; } return null; };
const small = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(980, 980, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
async function framesFrom(d, n) {
  if (d.spritesheet_url && d.num_cols && d.num_rows) {
    const sheet = await fetchBuf(d.spritesheet_url), m = await sharp(sheet).metadata();
    const cw = Math.floor(m.width / d.num_cols), ch = Math.floor(m.height / d.num_rows), o = [];
    for (let r = 0; r < d.num_rows && o.length < n; r++) for (let c = 0; c < d.num_cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const u = d.individual_frame_urls || []; if (u.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(u[i])); return o; } throw new Error('no frames');
}

let types = Object.keys(SWINGS);
const only = arg('--only'); if (only) types = only.split(',').filter((t) => SWINGS[t]);
if (!has('--generate')) { console.log('# weapon-swing morph for: ' + types.join(', ') + '\n# Re-run with --generate.'); process.exit(0); }

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
async function post(path, body, ms) {
  let last; for (let a = 1; a <= 4; a++) { try {
    const r = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(ms), body: JSON.stringify(body) });
    if (!r.ok) { const t = await r.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(r.status + ': ' + t.slice(0, 140)); }
    return r.json();
  } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await new Promise(s => setTimeout(s, 4000 * a)); } }
  throw last;
}

let made = 0, failed = 0;
for (const t of types) {
  process.stdout.write(`  ${t} ... `);
  try {
    const bp = await basePath(t); if (!bp) { console.log('NO BASE'); continue; }
    const baseBuf = await readFile(bp); const { width: W, height: H } = await sharp(baseBuf).metadata();
    const baseUri = await small(baseBuf);
    const ed = await post('/assets/image/edit', { image: baseUri, prompt: SWINGS[t].edit, n: 1, augment_prompt: false }, 150000);
    const poseUrl = Array.isArray(ed) ? ed[0]?.url : ed?.url; if (!poseUrl) throw new Error('no pose url');
    const poseUri = await small(await fetchBuf(poseUrl));
    const an = await post('/assets/sprite/animate', { initial_image: baseUri, final_image: poseUri, motion_prompt: SWINGS[t].motion, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite' }, 290000);
    const bufs = await framesFrom(an, FRAMES);
    await mkdir(OUT_DIR, { recursive: true });
    for (let i = 0; i < bufs.length; i++) await writeFile(join(OUT_DIR, `${t}_${i}.webp`), await sharp(bufs[i]).resize(W, H, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
    made++; console.log(`OK ${W}x${H}`);
  } catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS — stopping ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${failed} failed.`);
process.exit(failed ? 2 : 0);
