// Sprite fit audit: measures the real content box of every animation frame under
// Sprites/{monsters,bosses,npc} and flags sets whose art does not fit the way the
// game draws it. Every loader scales a frame to a box derived from the monster's
// w/h, so what matters is the pixels' own size and placement, frame to frame and
// state to state:
//   body-size drift   - frames of one state whose content height differs from the
//                       state median by more than 20% (the smith-golem defect)
//   state mismatch    - a walk/attack whose median body height, after the calib's
//                       per-frame scale, is more than 25% off the idle's
//   foot-line jump    - the content bottom moves more than 12% of the frame between
//                       frames of a looping state (a hop on every loop)
//   clipped           - content touching the frame edge (art cut off)
//   sparse            - content under 3% of the frame (a blank or a speck)
//   box aspect        - the sprite's content aspect against the monster's w/h box,
//                       more than 2.2x off (the art is a different shape than its box)
//   incomplete sets   - a type with idle/walk/attack counts that disagree
// Writes docs/reports/sprite_fit_audit.json and prints a ranked summary.
//   node scripts/sprite_fit_audit.mjs [--json out.json] [--top N]
import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const TOP = Number((args[args.indexOf('--top') + 1]) || 40); const OUT = args.includes('--json') ? args[args.indexOf('--json') + 1] : path.join(ROOT, 'docs', 'reports', 'sprite_fit_audit.json');
// ---- tables ---------------------------------------------------------------------------------------------
const idxSrc = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
const IDX = JSON.parse(idxSrc.slice(idxSrc.indexOf('{', idxSrc.indexOf('window.LX_SPRITE_FRAME_INDEX')), idxSrc.lastIndexOf('}') + 1));
const calibSrc = readFileSync(path.join(ROOT, 'data', 'anim_calib.js'), 'utf8');
const CALIB = (() => { const a = calibSrc.indexOf('window.LX_ANIM_CALIB = ') + 'window.LX_ANIM_CALIB = '.length; const b = calibSrc.indexOf('window.LX_ATK_HITBOX', a); return JSON.parse(calibSrc.slice(a, b).replace(/;\s*$/, '')); })();
const game = readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const BOX = {}; for (const m of game.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*):\s*\{\s*name:'[^']*',\s*w:\s*(\d+),\s*h:\s*(\d+)/mg)) if (!BOX[m[1]]) BOX[m[1]] = { w: +m[2], h: +m[3] };
// ---- measurement ------------------------------------------------------------------------------------------
async function box(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0; let eL = 0, eR = 0, eT = 0, eB = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (data[(y * W + x) * 4 + 3] > 24) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x === 0) eL++; if (x === W - 1) eR++; if (y === 0) eT++; if (y === H - 1) eB++; } }
  if (x1 < 0) return { W, H, empty: true, w: 0, h: 0, n: 0 };
  // clipped = opaque pixels along the top/left/right edge over more than 6% of that edge (art cut off);
  // feet resting on the canvas floor are normal, so the bottom counts only as a wide flat cut (> 45%)
  const clipped = (eT / W > 0.06) || (eL / H > 0.06) || (eR / H > 0.06) || (eB / W > 0.45);
  return { W, H, x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n, cx: (x0 + x1) / 2 / W, bottom: y1 / H, frac: n / (W * H), clipped, edges: { t: +(eT / W).toFixed(2), l: +(eL / H).toFixed(2), r: +(eR / H).toFixed(2), b: +(eB / W).toFixed(2) } };
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const sets = [];   // { dir, key, state, frames:[box] }
function collect(dir, key, n) { const out = []; for (let i = 0; i < n; i++) { const f = path.join(ROOT, 'Sprites', dir, `${key}_${i}.webp`); if (existsSync(f)) out.push(f); } return out; }
const stateOf = (dir) => dir.endsWith('/attack') ? 'attack' : dir.endsWith('/walk') ? 'walk' : dir.endsWith('/idle') ? 'idle' : dir === 'bosses' || dir === 'monsters' ? 'idle' : path.basename(dir);
for (const dir of Object.keys(IDX.frames)) {
  if (!/^(monsters|bosses|npc)(\/|$)/.test(dir)) continue;
  for (const key of Object.keys(IDX.frames[dir])) { const files = collect(dir, key, IDX.frames[dir][key]); if (files.length) sets.push({ dir, key, state: stateOf(dir), files }); }
}
console.log(`measuring ${sets.length} sets, ${sets.reduce((a, s) => a + s.files.length, 0)} frames ...`);
for (const s of sets) { s.frames = []; for (const f of s.files) { try { s.frames.push(await box(f)); } catch (e) { s.frames.push({ err: String(e.message) }); } } }
// ---- findings --------------------------------------------------------------------------------------------
const findings = [];
const flag = (sev, kind, s, detail, extra) => findings.push({ sev, kind, dir: s.dir, key: s.key, state: s.state, detail, ...extra });
const byType = {};
for (const s of sets) {
  const good = s.frames.filter((f) => f && !f.err && !f.empty);
  const fam = s.dir.split('/')[0]; const t = (byType[fam + ':' + s.key] = byType[fam + ':' + s.key] || {}); t[s.state] = s;
  for (const [i, f] of s.frames.entries()) { if (f.err) flag(3, 'decode', s, `frame ${i} failed to decode: ${f.err}`); else if (f.empty || f.frac < 0.03) flag(2, 'sparse', s, `frame ${i} content ${f.empty ? 'empty' : (f.frac * 100).toFixed(1) + '% of the frame'}`); }
  const clipped = s.frames.map((f, i) => (f && f.clipped ? i : -1)).filter((i) => i >= 0);
  if (clipped.length) flag(2, 'clipped', s, `content touches the frame edge on frame${clipped.length > 1 ? 's' : ''} ${clipped.join(',')}`);
  if (good.length >= 3) {
    const fs = (CALIB[s.key] && CALIB[s.key][s.state] && Array.isArray(CALIB[s.key][s.state].fs)) ? CALIB[s.key][s.state].fs : null;
    const hs = good.map((f, i) => f.h * (fs ? (fs[s.frames.indexOf(f)] || 1) : 1)); const med = median(hs);
    const off = hs.map((h, i) => ({ i: s.frames.indexOf(good[i]), r: h / med })).filter((o) => Math.abs(o.r - 1) > 0.2);
    if (off.length) flag(off.length >= 3 ? 2 : 1, 'body-drift', s, `${off.length} frame${off.length > 1 ? 's' : ''} ${off.length >= 3 ? 'well ' : ''}off the state's body height: ` + off.map((o) => `${o.i}:${(o.r * 100).toFixed(0)}%`).join(' ') + (fs ? ' (after calib fs)' : ''), { offCount: off.length });
    if (s.state !== 'attack') { const bots = good.map((f) => f.bottom); const jump = Math.max(...bots) - Math.min(...bots); if (jump > 0.12) flag(1, 'foot-line', s, `content bottom moves ${(jump * 100).toFixed(0)}% of the frame across the loop`); }
  }
}
for (const id of Object.keys(byType)) {
  const t = byType[id]; const idle = t.idle && t.idle.frames.filter((f) => f && !f.err && !f.empty);
  if (!idle || idle.length < 3) continue;
  const idleS = (CALIB[t.idle.key] && CALIB[t.idle.key].idle && CALIB[t.idle.key].idle.s) || 1;
  const im = median(idle.map((f) => f.h)) * idleS, iw = median(idle.map((f) => f.w)) * idleS;
  for (const st of ['walk', 'attack']) {
    const s = t[st]; if (!s) continue; const g = s.frames.filter((f) => f && !f.err && !f.empty); if (g.length < 3) continue;
    const fs = (CALIB[s.key] && CALIB[s.key][st] && Array.isArray(CALIB[s.key][st].fs)) ? CALIB[s.key][st].fs : null; const sc = (CALIB[s.key] && CALIB[s.key][st] && CALIB[s.key][st].s) || 1;
    const hs = g.map((f) => f.h * (fs ? (fs[s.frames.indexOf(f)] || 1) : 1)).sort((a, b) => a - b);
    // the body, not the pose: attack frames carry slashes and flares that make the content taller, so the
    // three smallest frames stand for the body (a state whose smallest frames are the idle's size is fine)
    const body = median(hs.slice(0, 3)) * sc, all = median(hs) * sc; const r = body / im, rAll = all / im;
    if (r < 0.75 || r > 1.25) flag(2, 'state-size', s, `${st} body height is ${(r * 100).toFixed(0)}% of the idle's (state median ${(rAll * 100).toFixed(0)}%; calib s ${sc}${idleS !== 1 ? ', idle s ' + idleS : ''}${fs ? ', per-frame fs' : ''}) -> calib s ${(sc / r).toFixed(2)} would match`, { ratio: +r.toFixed(2), suggestS: +(sc / r).toFixed(2) });
  }
  const key = id.split(':')[1]; const b = BOX[key];
  if (b && b.w > 0 && b.h > 0 && t.idle) { const ar = (iw / im) / (b.w / b.h); if (ar > 2.2 || ar < 1 / 2.2) flag(1, 'box-aspect', t.idle, `idle art aspect ${(iw / im).toFixed(2)} vs box aspect ${(b.w / b.h).toFixed(2)} (w ${b.w} h ${b.h}): ${ar > 1 ? 'much wider' : 'much taller'} than its box`, { ar: +ar.toFixed(2) }); }
  const counts = ['idle', 'walk', 'attack'].map((st) => t[st] ? t[st].files.length : 0);
  if (id.startsWith('monsters:') && counts.some((c) => c > 0) && (counts[0] === 0 || counts[1] === 0 || counts[2] === 0)) flag(1, 'incomplete', t.idle || t.walk || t.attack, `idle/walk/attack frames ${counts.join('/')}`);
}
findings.sort((a, b) => b.sev - a.sev || a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), sets: sets.length, frames: sets.reduce((a, s) => a + s.files.length, 0), findings, boxes: Object.fromEntries(sets.map((s) => [s.dir + '/' + s.key, s.frames.map((f) => f && !f.err ? [f.w, f.h, f.empty ? 0 : +(f.bottom || 0).toFixed(3), +(f.frac || 0).toFixed(3)] : null)])) }, null, 1));
const byKind = {}; for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
console.log(`findings ${findings.length}: ` + Object.entries(byKind).map(([k, n]) => k + ' ' + n).join(', '));
for (const f of findings.slice(0, TOP)) console.log(`  [${f.sev}] ${f.kind.padEnd(11)} ${(f.dir + '/' + f.key).padEnd(36)} ${f.detail}`);
console.log(`wrote ${path.relative(ROOT, OUT)}`);
