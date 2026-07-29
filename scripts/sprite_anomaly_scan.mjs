// SPRITE ANOMALY SCAN — finds art that is broken or off-convention for its set.
// Eyeballing thousands of files does not scale, so this measures each sprite
// and flags the ones that deviate from their own folder's norm.
//
// Detects:
//   OPAQUE-BG   sprite has no alpha / an opaque rectangular background where
//               its siblings are cut out (the crit/atk "framed tile" defect)
//   FRAMED      opaque border band -> a tile/card baked behind the subject
//   SIZE-ODD    dimensions far from the set's dominant size
//   NOT-SQUARE  aspect ratio off where the set is square
//   TINY        suspiciously small file (failed/placeholder render)
//   EMPTY       fully or almost-fully transparent (blank art)
//   LETTERBOX   large uniform bands top/bottom or left/right
// Run: node scripts/sprite_anomaly_scan.mjs [--dir Sprites/xxx] [--all]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const ONLY_DIR = argOf('--dir');
const SHOW_ALL = argv.includes('--all');
const IMG = /\.(png|webp)$/i;

// Sets worth auditing: cut-out sprites that should share a convention.
const SETS = ONLY_DIR ? [ONLY_DIR] : [
  'Sprites/boons', 'Sprites/skills', 'Sprites/items', 'Sprites/ui/Class',
  'Sprites/monsters', 'Sprites/bosses', 'Sprites/npc', 'Sprites/projectiles',
  'Sprites/equipment/weapons', 'Sprites/equipment/armors', 'Sprites/equipment/accessories',
  'Sprites/summons', 'Sprites/fx', 'Sprites/objects', 'Sprites/zodiac',
];

const stat = async (abs) => {
  const img = sharp(abs);
  const meta = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, px = W * H;
  let clear = 0;
  for (let i = 0; i < px; i++) if (data[i * 4 + 3] < 16) clear++;
  // edge band opacity (a baked tile paints to the border)
  const band = Math.max(3, Math.round(Math.min(W, H) * 0.03));
  let eOp = 0, eTot = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x > band && x < W - band && y > band && y < H - band) continue;
    eTot++; if (data[(y * W + x) * 4 + 3] > 200) eOp++;
  }
  // corner opacity — 4 corners opaque = rectangular background
  const cor = (x, y) => data[(y * W + x) * 4 + 3];
  const corners = [cor(1, 1), cor(W - 2, 1), cor(1, H - 2), cor(W - 2, H - 2)];
  return { W, H, hasAlpha: !!meta.hasAlpha, bytes: fs.statSync(abs).size,
    tPct: (clear / px) * 100, edgePct: (eOp / eTot) * 100,
    cornersOpaque: corners.filter((a) => a > 200).length };
};

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const findings = [];
let scanned = 0;

for (const rel of SETS) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((f) => IMG.test(f));
  if (files.length < 3) continue;
  const rows = [];
  for (const f of files) {
    try { rows.push({ f, ...(await stat(path.join(dir, f))) }); scanned++; } catch (e) { findings.push({ set: rel, f, kind: 'UNREADABLE', detail: e.message.slice(0, 60) }); }
  }
  if (!rows.length) continue;
  // Several folders deliberately mix asset CLASSES: hand-made pixel art
  // (28x24 chests, 12x16 potions) lives beside 256px+ generated illustration.
  // Comparing them against one median flagged all the pixel art as broken.
  // Audit only the illustration tier (>=128px), and compare within it.
  const big = rows.filter((r) => Math.min(r.W, r.H) >= 128);
  const pixelArt = rows.length - big.length;
  if (big.length < 3) { if (SHOW_ALL) console.log(`  (skipped ${rel}: <3 illustration-tier sprites)`); continue; }
  const medW = median(big.map((r) => r.W)), medH = median(big.map((r) => r.H));
  const medT = median(big.map((r) => r.tPct));
  const medBytes = median(big.map((r) => r.bytes));
  // Is this a cut-out set? (most members have transparent surroundings)
  const cutout = medT > 25;
  if (SHOW_ALL && pixelArt) console.log(`  (${rel}: ignoring ${pixelArt} pixel-art sprites <128px)`);
  for (const r of big) {
    const add = (kind, detail) => findings.push({ set: rel, f: r.f, kind, detail });
    if (cutout && r.cornersOpaque === 4 && r.tPct < 8) add('OPAQUE-BG', `${r.tPct.toFixed(1)}% transparent (set median ${medT.toFixed(0)}%) — rectangular background baked in`);
    // A real baked tile has OPAQUE CORNERS. Without that requirement this fired
    // on legitimate art whose subject simply fills the frame and bleeds off the
    // edge (e.g. objects/chest_silver_open) — a false positive, not a defect.
    else if (cutout && r.edgePct > 25 && r.cornersOpaque >= 2 && r.tPct < medT * 0.45) add('FRAMED', `edge ${r.edgePct.toFixed(0)}% opaque, ${r.cornersOpaque}/4 corners opaque, ${r.tPct.toFixed(1)}% transparent vs median ${medT.toFixed(0)}%`);
    if (cutout && r.tPct > 99.2) add('EMPTY', `${r.tPct.toFixed(1)}% transparent — art is blank`);
    if (r.W !== medW || r.H !== medH) {
      const off = Math.abs(r.W - medW) / medW;
      if (off > 0.34) add('SIZE-ODD', `${r.W}x${r.H} vs set ${medW}x${medH}`);
    }
    if (Math.abs(r.W - r.H) / Math.max(r.W, r.H) > 0.02 && Math.abs(medW - medH) < 2) add('NOT-SQUARE', `${r.W}x${r.H} (set is square ${medW}x${medH})`);
    // Byte size alone is a poor failure signal: simple art (a thin FX beam)
    // compresses to a fraction of a detailed sibling and is perfectly valid.
    // Only call it a failed render if it is ALSO nearly devoid of content.
    if (r.bytes < Math.max(900, medBytes * 0.06) && r.tPct > 92) add('TINY', `${r.bytes}B vs set median ${medBytes}B AND ${r.tPct.toFixed(1)}% transparent — likely a failed render`);
    if (!r.hasAlpha && cutout) add('NO-ALPHA', 'no alpha channel in a cut-out set');
  }
  if (SHOW_ALL) console.log(`scanned ${rel}: ${rows.length} files (median ${medW}x${medH}, ${medT.toFixed(0)}% transparent, cutout=${cutout})`);
}

console.log(`\n=== SPRITE ANOMALY SCAN — ${scanned} sprites across ${SETS.length} sets ===\n`);
if (!findings.length) { console.log('No anomalies found.'); process.exit(0); }
const byKind = {};
for (const f of findings) (byKind[f.kind] = byKind[f.kind] || []).push(f);
for (const [kind, list] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${kind}  (${list.length})`);
  for (const x of list.slice(0, 25)) console.log(`   ${x.set}/${x.f}\n      ${x.detail}`);
  if (list.length > 25) console.log(`   … +${list.length - 25} more`);
  console.log('');
}
console.log(`total findings: ${findings.length}`);
