#!/usr/bin/env node
// v0.30.1472 - COACH STRIDE LIVES IN THE JADE GROVE (per user: "Relocate coach stride to the jade grove"). He stood in the Bastion
// Courtyard (x:300) since v0.25.809; he now runs his drills on the Grove's old archery range. No browser - reads the game file:
//   - the Grove's MAPS literal lists him, standing ON the archery range (an NPC is 44 tall: y = the platform's top - 44)
//   - the Stage Editor bake (const B), which REPLACES the Grove's npcs at boot, lists him at the same spot, on a platform
//     the bake itself has there (the bake's geometry is what the game runs)
//   - he is listed nowhere else: not in the Bastion, not twice
//   - his greeting and send-off name the Grove's range, not the Courtyard's pits
//   [MOJI_GAME_FILE=x.html] node scripts/coach_stride_grove_test.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(process.env.MOJI_GAME_FILE ? path.resolve(process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const block = (key, next) => { const i = src.indexOf(`\n  ${key}: {\n`); const j = src.indexOf(`\n  ${next}: {\n`, i); return i >= 0 && j > i ? src.slice(i, j) : ''; };
const grove = block('jadeGrove', 'emeraldVillage'), bastion = block('bastion', 'bastionThrone');
const lit = grove.match(/\{x:(\d+), y:(\d+), name:'Coach Stride', role:'arena'/);
ok('the Grove lists Coach Stride (role arena)', !!lit, lit ? lit[0] : 'not found in the jadeGrove block');
// the Stage Editor bake: one JSON literal assigned to `const B` inside _lxHardbakeMapLayouts
const bi = src.indexOf('  const B = {"'), line = bi >= 0 ? src.slice(bi, src.indexOf('\n', bi)) : '';
let B = null; try { B = JSON.parse(line.slice(line.indexOf('{'), line.lastIndexOf('}') + 1)); } catch (e) {}
ok('the Stage Editor bake parses', !!B);
const bg = B && B.jadeGrove, bn = bg && (bg.npcs || []).find((n) => n && n.name === 'Coach Stride');
ok('the bake lists him in the Grove (it replaces the Grove\'s npcs at boot)', !!bn, bn ? JSON.stringify(bn) : 'missing');
ok('the bake and the map agree on where he stands', !!(lit && bn && +lit[1] === bn.x && +lit[2] === bn.y), lit && bn ? `${lit[1]},${lit[2]} vs ${bn.x},${bn.y}` : '');
const floor = bn && (bg.platforms || []).find((p) => p && p.type !== 'ground' && bn.x >= p.x && bn.x <= p.x + p.w && p.y === bn.y + 44);
ok('he stands on a real platform in the bake (the archery range, top = his y + 44)', !!floor, floor ? JSON.stringify(floor) : 'no platform under him');
ok('...and it is the archery range (x 600-880, y 340)', !!(floor && floor.x === 600 && floor.w === 280 && floor.y === 340), floor ? `${floor.x}+${floor.w} @ ${floor.y}` : '');
ok('the Bastion no longer lists him', bastion.length > 0 && !/name:'Coach Stride'/.test(bastion), bastion ? 'bastion block read' : 'bastion block not found');
const everywhere = (src.match(/name:'Coach Stride'/g) || []).length, baked = (line.match(/"name":"Coach Stride"/g) || []).length;
ok('he has one home: one map literal, one bake entry', everywhere === 1 && baked === 1, `literal ${everywhere}, bake ${baked}`);
const dlg = src.slice(src.indexOf("} else if (npc.role === 'arena') {"), src.indexOf("} else if (npc.role === 'stormbearer') {"));
ok('his greeting names the Grove\'s range, not the Courtyard\'s pits', /Grove\\'s old archery range/.test(dlg) && !/Courtyard/.test(dlg.replace(/\/\/[^\n]*/g, '')), dlg ? 'arena branch read' : 'arena branch not found');
ok('his send-off follows him', /The range is all yours/.test(dlg) && !/Pits are that way/.test(dlg));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
