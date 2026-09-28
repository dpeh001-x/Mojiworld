#!/usr/bin/env node
// v0.30.1392: the Bastion throne room's army (per user: "generate an army of similar looking soldiers in the room with their helmets
// covered, some goofy looking"). No browser - reads the game file, the tables and the art:
//   - REGISTERED: every soldier design is in LX_OBJECTS_FILES, on disk, and in the bbox, edge and offline-asset tables
//   - PLACED: 10+ soldiers in MAP_PROPS.bastionThrone, every design used
//   - FOOTING: each stands on the top of a throne-room platform (or the floor) that spans it
//   - HEAD ROOM: its drawn body (the art's own content box, at the size drawWorldProps draws it) crosses no other platform
//   - IN THE ROOM: its drawn body stays inside the map (0 to worldWidth)
//   - FACING: the art faces left; every soldier west of the throne is flipped to face it, every one east of it is not
//   - drawWorldProps mirrors a prop that has flip:true
//   node scripts/bastion_army_test.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const G = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
const KEYS = ['bastion_soldier_bucket', 'bastion_soldier_daisy', 'bastion_soldier_folded', 'bastion_soldier_plume', 'bastion_soldier_shield', 'bastion_soldier_snack', 'bastion_soldier_visor'];
// an array literal that starts at `head` (searched from `from`), comments stripped, read as JS
const arrayAt = (head, from) => { const i = G.indexOf(head, from); if (i < 0) return null; let k = G.indexOf('[', i + head.length - 1), d = 0, j = k;
  const src = G.slice(k).split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  for (j = 0; j < src.length; j++) { if (src[j] === '[') d++; else if (src[j] === ']' && --d === 0) break; }
  return Function('return ' + src.slice(0, j + 1))(); };
const plats = arrayAt('platforms: [', G.indexOf("bastionThrone: {\n    name:'The Bastion"));
const props = arrayAt('  bastionThrone: [', G.indexOf('const MAP_PROPS = {'));
const PDH = +(G.match(/const PROP_DEFAULT_H = (\d+);/) || [])[1];
const table = (file, name) => { const t = fs.readFileSync(path.join(ROOT, 'data', file), 'utf8'); return JSON.parse(t.slice(t.indexOf(name + ' = ') + name.length + 3, t.lastIndexOf(';'))); };
const BB = table('sprite_bbox.js', 'window.LX_SPRITE_BBOX'), ED = table('sprite_edges.js', 'window.LX_SPRITE_EDGES');
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'assets_manifest.json'), 'utf8'));
const manList = Array.isArray(MAN) ? MAN : (MAN.assets || MAN.files || Object.values(MAN).find(Array.isArray) || []);
const reg = (G.match(/const LX_OBJECTS_FILES = \[([\s\S]*?)\n\];/) || [])[1] || '';
const miss = KEYS.filter((k) => !reg.includes(`'${k}'`) || !fs.existsSync(path.join(ROOT, 'Sprites', 'objects', k + '.webp'))
  || !BB['objects/' + k + '.webp'] || ED['objects/' + k + '.webp'] == null || !manList.includes('Sprites/objects/' + k + '.webp'));
ok('every soldier design is registered, on disk and in the bbox / edge / asset tables', !miss.length, miss.join(', ') || KEYS.length + ' designs');
ok('the throne room reads (platforms, props, PROP_DEFAULT_H)', Array.isArray(plats) && Array.isArray(props) && PDH > 0, `${plats && plats.length} platforms, ${props && props.length} props`);
const army = (props || []).filter((p) => KEYS.includes(p.key)), throne = (props || []).find((p) => p.key === 'bastion_throne');
ok('10+ soldiers stand in the throne room, every design used', army.length >= 10 && KEYS.every((k) => army.some((p) => p.key === k)), army.length + ' soldiers');
const art = {};
for (const k of KEYS) { if (!fs.existsSync(path.join(ROOT, 'Sprites', 'objects', k + '.webp'))) continue; const { data, info } = await sharp(path.join(ROOT, 'Sprites', 'objects', k + '.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = -1, y0 = info.height; for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 12) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
  art[k] = { W: info.width, H: info.height, x0, x1, y0, bot: +String(BB['objects/' + k + '.webp'] || '').split(',')[1] }; }
const foot = [], head = [], face = [], edge = [];
const WORLD = +(G.slice(G.indexOf("bastionThrone: {\n    name:'The Bastion")).match(/worldWidth: (\d+)/) || [])[1];
for (const s of army) {
  const a = art[s.key], f = Math.max(0.7, Math.min(1.4, Math.max(a.W, a.H) / 512)), h = PDH * (s.scale || 1) * f, w = h * a.W / a.H;   // drawWorldProps
  const sy = s.y - h * ((a.bot + 1) / a.H) + 1, top = sy + h * a.y0 / a.H;
  let l = s.x - w / 2 + w * a.x0 / a.W, r = s.x - w / 2 + w * (a.x1 + 1) / a.W; if (s.flip) [l, r] = [2 * s.x - r, 2 * s.x - l];
  const on = plats.find((p) => p.y === s.y && s.x >= p.x && s.x <= p.x + p.w);
  if (!on) foot.push(`${s.key}@${s.x},${s.y}`);
  const hit = plats.filter((p) => p !== on && l < p.x + p.w - 2 && r > p.x + 2 && top < p.y + p.h - 2 && s.y > p.y + 2);
  if (hit.length) head.push(`${s.key}@${s.x},${s.y} crosses ${hit.map((p) => p.x + ',' + p.y).join(' ')}`);
  if (l < 0 || r > WORLD) edge.push(`${s.key}@${s.x} spans ${l.toFixed(0)}-${r.toFixed(0)}`);
  if (!!s.flip !== (s.x < throne.x)) face.push(`${s.key}@${s.x}`);
}
ok('every soldier stands on a platform top (or the floor) that spans it', !foot.length, foot.join(', '));
ok('no soldier pokes through another platform (head room)', !head.length, head.join('; '));
ok('every soldier stays inside the room (0 to worldWidth)', WORLD > 0 && !edge.length, edge.join(', ') || 'worldWidth ' + WORLD);
ok('every soldier faces the throne (flipped west of it, not east)', !face.length && !!throne, face.join(', ') || 'throne at x ' + (throne && throne.x));
ok('drawWorldProps mirrors a prop with flip:true', /if \(prop\.flip\) \{ ctx\.save\(\); ctx\.translate\(2 \* sx \+ w, 0\); ctx\.scale\(-1, 1\);/.test(G));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
