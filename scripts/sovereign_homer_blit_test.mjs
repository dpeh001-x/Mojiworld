// The Sovereign's homing orbs draw their own art, and the drain pillar ships cel-shaded.
//
// Per user: "Sovereign spire also shoots these spriteless yellow orbs, generate sprites for these".
// They were never spriteless: v0.30.468 authored msovereign.webp plus nine animation frames and
// listed the key in _PROJ_ANIM_KEYS. What it never added was the row in _PROJ_SPRITE_BLIT, and the
// generic mob-projectile blit is gated on BOTH tables - so the homers fell through to the procedural
// colour-circle fallback from the day they were introduced. Three facts make the art actually draw,
// and each is one line from regressing:
//   node scripts/sovereign_homer_blit_test.mjs [path/to/mojiworld_game.html]
import { existsSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const GAME = process.argv[2] || 'mojiworld_game.html';
const src = readFileSync(GAME, 'utf8');
const inTree = (p) => { try { return execFileSync('git', ['ls-tree', '--name-only', 'origin/main', '--', p], { encoding: 'utf8' }).trim() === p; } catch (e) { return false; } };

// --- the homers -------------------------------------------------------------------------------
ok('msovereign has a sprite in the mob-projectile table', /^\s*msovereign:\s*'msovereign\.webp'/m.test(src), {});
ok('...and is an animated key', /'msovereign',/.test(src.slice(src.indexOf('const _PROJ_ANIM_KEYS'), src.indexOf('const _PROJ_ANIM_KEYS') + 4000)), {});
const blit = src.match(/^\s*msovereign:\s*\{\s*mode:\s*'(\w+)',\s*size:\s*([\d.]+)/m);
ok('...and has a _PROJ_SPRITE_BLIT row, which is the half that was missing', !!blit, {});
ok('...upright, not spun (a crown that spins is not a crown)', blit && blit[1] === 'static', { mode: blit && blit[1] });
ok('...sized so its solid core matches the hitbox (0.5 draws the whole canvas at p.w; the core is 63% of it)', blit && Math.abs(+blit[2] - 0.8) < 0.05, { size: blit && +blit[2] });
ok('the generic blit still requires both tables (the gate this fell through)', /else if \(LX_MOB_PROJ\[p\.skill\] && _PROJ_SPRITE_BLIT\[p\.skill\]\)/.test(src), {});
ok('the art exists on disk with its nine frames', existsSync('Sprites/projectiles/msovereign.webp') && [...Array(9).keys()].every((i) => existsSync(`Sprites/projectiles/anim/msovereign_${i}.webp`)), {});

// --- the drain pillar -------------------------------------------------------------------------
const PIL = 'Sprites/vfx/sovereign_drain_pillar.webp';
ok('the drain pillar art ships', existsSync(PIL) && statSync(PIL).size > 20000, { kb: existsSync(PIL) ? Math.round(statSync(PIL).size / 1024) : 0 });
ok('...and is committed (origin/main)', inTree(PIL), {});
ok('...and the engine loads it as the drainPillar VFX', /drainPillar:\s*'sovereign_drain_pillar\.webp'/.test(src), {});
ok('...drawn stretched into the pillar band, with the edges, rain and label still painted by the engine',
   /ctx\.drawImage\(_dpImg, _px, 0, h\.w, _ph\);/.test(src) && /ctx\.strokeRect\(_px, 0, h\.w, _ph\);/.test(src), {});

const fails = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x && Object.keys(r.x).length ? '  ' + JSON.stringify(r.x) : ''));
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);
