#!/usr/bin/env node
// v0.30.1392: the Bastion throne room's army. v0.30.1404 (per user: "make a few of them NPCs with goofy dialog", "keep the outlines
// around the silhouette consistent", "the serious one should be well aligned the goofy ones try to align but fail, then add
// animations", "many of them are incomplete somehow"). No browser - reads the game file, the tables and the art:
//   - SERIOUS RANKS: 3 prop designs, two on every stair tier at the same two spots, mirrored about the stairs' centre, one scale,
//     every one facing the throne, standing on its tier with head room; each has a 9-frame loop (LX_OBJECTS_ANIM) on its still's feet
//   - GOOFY FOUR: Flop, Munch, Daisy and Mope are NPCs (role 'soldier') with their own lines and a 9-frame idle; they stand on the
//     floor but fail the line - uneven gaps, not all facing the throne; drawn at the ranks' size
//   - OUTLINES: the 30 rank stills and frames share one silhouette ink weight (13-17 px at 1024); the goofy four's 40, being NPCs,
//     wear the v0.30.1538 NPC line (1.42 game px, per user; 10-13 px by this ruler); 93%+ of every edge inked
//   - v0.30.1405: NO GROUND SHADOW: no still or frame carries the animator's faint ground shadow (stray faint px away from the figure)
//   node scripts/bastion_army_test.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const G = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
const SERIOUS = ['bastion_soldier_bucket', 'bastion_soldier_shield', 'bastion_soldier_visor'], RETIRED = ['bastion_soldier_daisy', 'bastion_soldier_folded', 'bastion_soldier_plume', 'bastion_soldier_snack'];
const SQUAD = { Flop: 'soldier_flop', Munch: 'soldier_munch', Daisy: 'soldier_daisy', Mope: 'soldier_mope' };
const arrayAt = (head, from) => { const i = G.indexOf(head, from); if (i < 0) return null; const k = G.indexOf('[', i + head.length - 1); let d = 0, j;
  const src = G.slice(k).split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  for (j = 0; j < src.length; j++) { if (src[j] === '[') d++; else if (src[j] === ']' && --d === 0) break; }
  return Function('return ' + src.slice(0, j + 1))(); };
const mapAt = G.indexOf("bastionThrone: {\n    name:'The Bastion");
const plats = arrayAt('platforms: [', mapAt), npcs = arrayAt('npcs: [', mapAt), props = arrayAt('  bastionThrone: [', G.indexOf('const MAP_PROPS = {'));
const WORLD = +(G.slice(mapAt).match(/worldWidth: (\d+)/) || [])[1], PDH = +(G.match(/const PROP_DEFAULT_H = (\d+);/) || [])[1];
const PXG = +(G.match(/const NPC_PX_PER_GAME_PX = (\d+);/) || [])[1];
const js = (file, name) => { const t = fs.readFileSync(path.join(ROOT, 'data', file), 'utf8'); return JSON.parse(t.slice(t.indexOf(name + ' = ') + name.length + 3, t.lastIndexOf(';'))); };
const BB = js('sprite_bbox.js', 'window.LX_SPRITE_BBOX'), ED = js('sprite_edges.js', 'window.LX_SPRITE_EDGES');
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'assets_manifest.json'), 'utf8'));
const FI = fs.readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
const OFF = fs.readFileSync(path.join(ROOT, 'data', 'npc_offsets.js'), 'utf8');
const has = (rel) => fs.existsSync(path.join(ROOT, 'Sprites', rel)) && BB[rel] && ED[rel] != null && MAN.includes('Sprites/' + rel);
const reg = (G.match(/const LX_OBJECTS_FILES = \[([\s\S]*?)\n\];/) || [])[1] || '';
ok('the three serious designs are registered props, on disk and tabled', SERIOUS.every((k) => reg.includes(`'${k}'`) && has(`objects/${k}.webp`)));
ok('the four goofy prop designs are retired (not registered, not on disk, not tabled)', RETIRED.every((k) => !reg.includes(`'${k}'`) && !fs.existsSync(path.join(ROOT, 'Sprites', 'objects', k + '.webp')) && !BB[`objects/${k}.webp`] && !MAN.includes(`Sprites/objects/${k}.webp`)));
const anim = (G.match(/const LX_OBJECTS_ANIM = \{([^}]*)\}/) || [])[1] || '';
const frames = (dir, base) => { const out = []; for (let i = 0; i < 9; i++) out.push(`${dir}/${base}_${i}.webp`); return out; };
const bot = (rel) => +String(BB[rel] || '').split(',')[1];
const animBad = SERIOUS.filter((k) => !new RegExp(k + ': ?9').test(anim) || !frames('objects/anim', k).every((r) => has(r) && Math.abs(bot(r) - bot(`objects/${k}.webp`)) <= 1));
ok('every serious design has a 9-frame loop standing on its still\'s feet (LX_OBJECTS_ANIM)', !animBad.length && /_lxPropFrame\(prop\) \|\| LX_OBJECTS\[prop\.key\]/.test(G), animBad.join(', '));
const army = (props || []).filter((p) => SERIOUS.includes(p.key)), tiers = (plats || []).filter((p) => p.type === 'platform' && p.w === 160 && p.y !== 280);
const tierBad = tiers.map((t) => { const on = army.filter((s) => s.y === t.y && s.x >= t.x && s.x <= t.x + t.w).map((s) => s.x - t.x).sort((a, b) => a - b); return on.join('/') === '42/118' ? null : `${t.x}:${on.join('/')}`; }).filter(Boolean);
ok('the serious ranks hold the same two spots on every stair tier (tier + 42, tier + 118)', tiers.length === 4 && !tierBad.length, tierBad.join(' ') || tiers.length + ' tiers');
const onTiers = army.filter((s) => s.y !== 480), mirrorBad = onTiers.filter((s) => !onTiers.some((o) => o.x === 1520 - s.x && o.y === s.y && o.key === s.key));
ok('the ranks mirror each other about the stairs\' centre (x 760), design for design', !mirrorBad.length, mirrorBad.map((s) => s.key + '@' + s.x).join(', '));
ok('one scale for every serious soldier, and every one faces the throne', new Set(army.map((s) => s.scale)).size === 1 && army.every((s) => !!s.flip === (s.x < 760)), [...new Set(army.map((s) => s.scale))].join(','));
const art = {}; for (const k of SERIOUS) { const { data, info } = await sharp(path.join(ROOT, 'Sprites', 'objects', k + '.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = -1, y0 = info.height; for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 12) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
  art[k] = { W: info.width, H: info.height, x0, x1, y0, bot: bot(`objects/${k}.webp`) }; }
const standBad = [];
for (const s of army) { const a = art[s.key], f = Math.max(0.7, Math.min(1.4, Math.max(a.W, a.H) / 512)), h = PDH * s.scale * f, w = h * a.W / a.H, sy = s.y - h * ((a.bot + 1) / a.H) + 1, top = sy + h * a.y0 / a.H;
  let l = s.x - w / 2 + w * a.x0 / a.W, r = s.x - w / 2 + w * (a.x1 + 1) / a.W; if (s.flip) [l, r] = [2 * s.x - r, 2 * s.x - l];
  const on = plats.find((p) => p.y === s.y && s.x >= p.x && s.x <= p.x + p.w), hit = plats.filter((p) => p !== on && l < p.x + p.w - 2 && r > p.x + 2 && top < p.y + p.h - 2 && s.y > p.y + 2);
  if (!on || hit.length || l < 0 || r > WORLD) standBad.push(`${s.key}@${s.x},${s.y}`); }
ok('every serious soldier stands on a platform top with head room, inside the room', army.length === 10 && !standBad.length, standBad.join(', ') || army.length + ' soldiers');
const squad = (npcs || []).filter((n) => n.role === 'soldier'), linesAt = G.indexOf('const LX_SOLDIER_LINES = {');
const lines = linesAt >= 0 ? Function('return ' + G.slice(linesAt + 25, G.indexOf('\n};', linesAt) + 2))() : {};
const squadBad = Object.entries(SQUAD).filter(([n, b]) => !squad.some((s) => s.name === n) || !new RegExp(`'${n}': +'${b}\\.webp'`).test(G) || !has(`npc/${b}.webp`)
  || !frames('npc/idle', b).every(has) || !new RegExp(`"${b}": 9`).test(FI) || !lines[n] || !['greet', 'askT', 'askA', 'line'].every((k) => typeof lines[n][k] === 'string' && lines[n][k].length > 10));
ok('Flop, Munch, Daisy and Mope are NPCs with a sprite, a 9-frame idle and their own lines', squad.length === 4 && !squadBad.length && /npc\.role === 'soldier'/.test(G), squadBad.map(([n]) => n).join(', '));
const xs = squad.map((s) => s.x).sort((a, b) => a - b), gaps = xs.slice(1).map((x, i) => x - xs[i]);
ok('the goofy four stand on the floor but fail the line: uneven gaps, not all facing the throne', squad.every((s) => s.y + 44 === 480) && Math.max(...gaps) - Math.min(...gaps) >= 30
  && squad.some((s) => (s.facing === -1) !== (s.x < 780)), 'gaps ' + gaps.join('/') + ', facing ' + squad.map((s) => s.name + ':' + s.facing).join(' '));
const sc = Object.keys(SQUAD).map((n) => +(OFF.match(new RegExp(`"${n}": ([\\d.]+)`, 'g')) || []).map((m) => m.split(': ')[1]).pop());
const npcH = sc.map((s) => 1024 / PXG * s), propH = PDH * (army[0] && army[0].scale) * 1.4;
ok('the NPC four are drawn at the ranks\' size (within 2 px)', npcH.every((h) => Math.abs(h - propH) <= 2), `npc ${npcH.map((h) => h.toFixed(1)).join('/')} vs prop ${propH.toFixed(1)}`);
const inkOf = async (rel) => { const { data: d, info } = await sharp(path.join(ROOT, 'Sprites', rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height, runs = [];
  const dark = (x, y) => { const i = (y * W + x) * 4; return d[i + 3] >= 128 && (d[i] + d[i + 1] + d[i + 2]) / 3 < 80; }, solid = (x, y) => d[(y * W + x) * 4 + 3] >= 128;
  const walk = (x, y, dx, dy) => { let n = 0; while (x >= 0 && y >= 0 && x < W && y < H && dark(x, y) && n < 60) { n++; x += dx; y += dy; } runs.push(n); };
  for (let y = 0; y < H; y += 4) { let x = 0; while (x < W && !solid(x, y)) x++; if (x < W) walk(x, y, 1, 0); x = W - 1; while (x >= 0 && !solid(x, y)) x--; if (x >= 0) walk(x, y, -1, 0); }
  for (let x = 0; x < W; x += 4) { let y = 0; while (y < H && !solid(x, y)) y++; if (y < H) walk(x, y, 0, 1); }
  const inked = runs.filter((n) => n >= 3).sort((a, b) => a - b); return { med: inked[inked.length >> 1] || 0, share: inked.length / Math.max(1, runs.length) }; };
const all = [...SERIOUS.flatMap((k) => [`objects/${k}.webp`, ...frames('objects/anim', k)]), ...Object.values(SQUAD).flatMap((b) => [`npc/${b}.webp`, ...frames('npc/idle', b)])];
// v0.30.1538 re-lined every NPC to 1.42 game px (per user: "make all of them have 1.42 px black outline"), the goofy four included,
// so they no longer share the ranks' heavier line (the ranks are props, which that pass left alone): each group keeps one weight
const RANK = new Set(all.filter((rel) => rel.startsWith('objects/'))), span = { rank: [99, 0], npc: [99, 0] }, inkBad = [];
for (const rel of all) { const r = await inkOf(rel), g = RANK.has(rel) ? 'rank' : 'npc', [a, b] = g === 'rank' ? [13, 17] : [10, 13];
  span[g] = [Math.min(span[g][0], r.med), Math.max(span[g][1], r.med)];
  if (r.med < a || r.med > b || r.share < 0.93) inkBad.push(`${rel} ${r.med}px ${(r.share * 100).toFixed(0)}%`); }
ok(`one silhouette ink weight per group on all ${all.length} soldier stills and frames (the ranks 13-17 px, the NPC four 10-13 px, 93%+ inked)`,
  all.length === 70 && RANK.size === 30 && !inkBad.length, inkBad.join(', ') || `ranks ${span.rank.join('-')} px, NPCs ${span.npc.join('-')} px`);
// v0.30.1405: the sprite animator left a faint ground shadow under Flop's feet (frames 1-6, ~7% opacity) that pulsed with the loop.
// A stray is a faint pixel (alpha 4-127) more than 3 px from the figure's solid ink; the figures' own anti-aliased edges sit within 1-2 px.
const strayOf = async (rel) => { const { data: d, info } = await sharp(path.join(ROOT, 'Sprites', rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height, N = W * H;
  const solid = new Uint8Array(N); for (let p = 0; p < N; p++) solid[p] = d[p * 4 + 3] >= 128 ? 1 : 0;
  let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = d[(y * W + x) * 4 + 3]; if (a < 4 || a >= 128) continue; let near = false;
    for (let v = -3; v <= 3 && !near; v++) for (let u = -3; u <= 3; u++) { const X = x + u, Y = y + v; if (X >= 0 && Y >= 0 && X < W && Y < H && solid[Y * W + X]) { near = true; break; } } if (!near) n++; }
  return n; };
const strayBad = []; for (const rel of all) { const n = await strayOf(rel); if (n >= 50) strayBad.push(`${rel} ${n}`); }
ok('no faint ground shadow around any soldier (under 50 stray faint px in every still and frame)', !strayBad.length, strayBad.join(', '));
ok('drawWorldProps still mirrors a prop with flip:true', /if \(prop\.flip\) \{ ctx\.save\(\); ctx\.translate\(2 \* sx \+ w, 0\); ctx\.scale\(-1, 1\);/.test(G));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
