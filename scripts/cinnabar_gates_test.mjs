// The Cinnabar Gates (per user: the Cinnabar Caves bridge between Emerald Village and the Reach of Vermillion becomes an emerald-themed
// road that leads toward Vermillion, with a redesigned backdrop - E3 picked, emblem picked). Static checks on the game file + art:
//   the map keeps its id, doors and layout, and is now "The Cinnabar Gates" on its own painted plate (bg_v4_cinnabarGates, one copy);
//   the cave's red look is gone (sky, floor, ledges, embers, cave sound, lava music, lava crystals, gem icons) for the road's;
//   both neighbours' door signs name it; the world-map emblem is the torii art, not the crystal.
//   node scripts/cinnabar_gates_test.mjs   (MOJI_GAME_FILE override)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import crypto from 'node:crypto';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = fs.readFileSync(path.join(ROOT, process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + String(x).slice(0, 200) + ']' : '')); };
const i0 = G.indexOf('\n  cinnabarCaves: {\n'), block = i0 > 0 ? G.slice(i0, G.indexOf('\n  },\n', i0)) : '';
ok('the map is still cinnabarCaves, now named "The Cinnabar Gates"', /name: "The Cinnabar Gates"/.test(block));
ok('its own painted plate, drawn once across the scroll', /bg: 'cinnabarGates'/.test(block) && /bgNoMirror: true/.test(block) && /cinnabarGates:\s+_loadBG\('backgrounds\/bg_v4_cinnabarGates\.webp'\)/.test(G) && fs.existsSync(path.join(ROOT, 'backgrounds/bg_v4_cinnabarGates.webp')));
ok('the same doors (Emerald Village west, the Reach of Vermillion east)', /dest: 'emeraldVillage'/.test(block) && /dest: 'reachOfVermillion'/.test(block));
ok('sky, floor and ledges in the road\'s colours, not the red cave\'s', !/#ce4b5a/.test(block) && /cinnabarCaves: \{ top: '#c9a676', body: '#495e40' \}/.test(G) && /cinnabarCaves: 'cobble'/.test(G));
ok('falling maple leaves, the wood\'s sound and the jade road\'s music', /id === 'cinnabarCaves'\)\s+\{[^}]*type = 'leaf'/.test(G) && /cinnabarCaves:\s+'audio\/ambient\/forest\.mp3'/.test(G) && /cinnabarCaves:\s+'audio\/bgm_jade_grove\.mp3'/.test(G));
const pj = G.indexOf('\n  cinnabarCaves: ['), props = pj > 0 ? G.slice(pj, G.indexOf('\n  ],', pj)) : '', keys = [...props.matchAll(/key:'([a-z_]+)'/g)].map((m) => m[1]);
ok('lanterns and the Reach\'s banner instead of lava crystals, every one real art', keys.length === 4 && !keys.includes('lava_crystal_cluster') && keys.every((k) => fs.existsSync(path.join(ROOT, 'Sprites/objects', k + '.webp'))), keys.join(','));
ok('a torii icon, not the gem', /cinnabarCaves:'⛩'/.test(G) && /cinnabarCaves: '⛩️'/.test(G) && !/cinnabarCaves: ?'💎'/.test(G));
ok('both neighbours\' door signs name it', G.includes('"name":"▶ The Cinnabar Gates"') && G.includes('"name":"◀ The Cinnabar Gates"') && !/Cinnabar Caves"/.test(G.slice(G.indexOf('const B = '))));
const emb = path.join(ROOT, 'Sprites/world/regions/cinnabarCaves.webp'), h = fs.existsSync(emb) ? crypto.createHash('sha1').update(fs.readFileSync(emb)).digest('hex') : '';
ok('the world-map emblem is the torii art (not the red crystal it replaced)', h && h !== '0c09c350a4d06010f18133f4975cf357d43cd94f', h.slice(0, 12));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
