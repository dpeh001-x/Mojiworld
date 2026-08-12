// Every sprite the COMMITTED frame index promises must itself be COMMITTED.
//
// data/sprite_frame_index.js exists so the loaders request only frames that
// exist — but it is generated from the WORKING COPY, so it happily promises
// files that were never git-added. When that happens the game asks for art the
// repo does not carry: a guaranteed 404 per frame, and a silently missing
// animation for anyone who is not the author.
//
// This has now bitten the Gravitos form-3 cast sets THREE times, each time via
// a commit built from a stale tree that dropped the art while leaving the index
// and BOSS_SPRITE_TYPES pointing at it (58aa714d, 60d19eac, 36e78ed2). The art
// is always still sitting on the author's disk, so nothing fails locally.
//   node scripts/sprite_index_shipped_test.mjs
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const g = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 536870912 });

const tracked = new Set(g(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').map(s => s.trim()).filter(Boolean));
const idxSrc = g(['show', 'HEAD:data/sprite_frame_index.js']);
const idx = JSON.parse(idxSrc.replace(/^[\s\S]*?window\.LX_SPRITE_FRAME_INDEX = /, '').replace(/;\s*$/, ''));

const missing = [], untracked = [];
let promised = 0;
for (const dir in idx.frames || {}) {
  for (const key in idx.frames[dir]) {
    const n = idx.frames[dir][key] | 0;
    for (let i = 0; i < n; i++) {
      const p = `Sprites/${dir}/${key}_${i}.webp`;
      promised++;
      if (!existsSync(p)) missing.push(p);
      else if (!tracked.has(p)) untracked.push(p);
    }
  }
}
for (const key in idx.attackBase || {}) {
  const p = `Sprites/bosses/${idx.attackBase[key]}`;
  promised++;
  if (!existsSync(p)) missing.push(p);
  else if (!tracked.has(p)) untracked.push(p);
}

console.log(`frames + static poses promised by the committed index: ${promised}`);
if (missing.length) { console.log('\nPROMISED BUT NOT ON DISK:'); for (const p of missing.slice(0, 10)) console.log('  ' + p); if (missing.length > 10) console.log(`  ... and ${missing.length - 10} more`); }
if (untracked.length) { console.log('\nON DISK BUT UNTRACKED (the packager drops these -> 404):'); for (const p of untracked.slice(0, 10)) console.log('  ' + p); if (untracked.length > 10) console.log(`  ... and ${untracked.length - 10} more`); }
if (!missing.length && !untracked.length) console.log('every promised sprite is on disk and committed');

ok('every sprite the index promises exists on disk', missing.length === 0, { count: missing.length, sample: missing.slice(0, 4) });
ok('every sprite the index promises is COMMITTED', untracked.length === 0, { count: untracked.length, sample: untracked.slice(0, 4) });

// The static base sprite for any key registered in BOSS_SPRITE_TYPES must ship
// too — the frame index gates FRAME requests but not the base pose, which is
// how the form-3 statics 404'd separately from their frames.
const game = g(['show', 'HEAD:mojiworld_game.html']);
const block = (game.match(/const BOSS_SPRITE_TYPES = \[([\s\S]*?)\n\];/) || [])[1] || '';
const types = [...block.matchAll(/'([A-Za-z0-9_]+)'/g)].map(m => m[1]);
const noBase = types.filter(t => {
  const webp = `Sprites/bosses/${t}.webp`, png = `Sprites/bosses/${t}.png`;
  const has = existsSync(webp) || existsSync(png);
  const trk = tracked.has(webp) || tracked.has(png);
  return has && !trk;
});
console.log(`\nBOSS_SPRITE_TYPES entries: ${types.length}`);
ok('every registered boss type with art on disk has it COMMITTED', noBase.length === 0, noBase.slice(0, 6));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
