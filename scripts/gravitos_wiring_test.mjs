// Is every Gravitos cast set actually WIRED, in the COMMITTED tree?
//
// The laser set has now been lost three times to another session^s stale
// buffer while its art, its FX sprite and its frame-index entry all stayed
// committed. That failure is silent: the files are present, the loader never
// asks for them, nothing 404s, and every animation test passes because those
// tests run against a file the wiring was just applied to.
//
// So this reads HEAD, not the working copy: art-without-code fails here.
//   node scripts/gravitos_wiring_test.mjs
import { execFileSync } from 'node:child_process';
const git = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 268435456 });
const s = git(['show', 'HEAD:mojiworld_game.html']);
const tree = git(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n');
const cnt = (n) => s.split(n).length - 1;
let bad = 0;
const ck = (label, ok, extra) => { console.log(`${ok ? 'ok   ' : 'MISS '} ${label}${extra ? '  ' + extra : ''}`); if (!ok) bad++; };

console.log(`HEAD ${git(['rev-parse', '--short', 'HEAD']).trim()}  ${git(['log', '-1', '--format=%s']).trim().slice(0, 60)}\n`);

for (const [key, fn, states] of [
  ['gravitospunch', '_gravitosPunchFrame', 'crush / slam / zip'],
  ['gravitossoul', '_gravitosSoulFrame', 'soulDrain + form-1 singularity/collapseRain'],
  ['gravitoslaser', '_gravitosLaserFrame', 'laser'],
]) {
  console.log(`--- ${key}  (${states}) ---`);
  ck('type registered for loading', cnt(`\n  '${key}',`) === 1);
  ck('frame picker defined', cnt(`function ${fn}(`) === 1);
  ck('draw override sets the key', cnt(`m._gravStarKey = '${key}';`) === 1);
  ck('frame pick consults it', cnt(`_spriteKey === '${key}' && ${fn}(m)`) === 1);
  const frames = tree.filter((f) => new RegExp(`Sprites/bosses/attack/${key}_\\d\\.webp$`).test(f)).length;
  ck('9 frames committed', frames === 9, `(${frames})`);
  console.log('');
}
console.log('--- laser FX ring ---');
ck('FX sprite registered', cnt(`gravitos_laserring: 'gravitos_laserring.webp'`) === 1);
ck('FX file committed', tree.includes('Sprites/fx/gravitos_laserring.webp'));
ck('charge ring spawns', cnt('m._laserRingUp = true;') === 1);
ck('release pulse spawns', cnt('spin: -Math.PI * 1.4') === 1);
ck('ring flag reset on pattern exit', cnt('m._laserFired = false; m._laserRingUp = false;') === 1);
console.log('');
console.log('--- frame index ---');
const idx = git(['show', 'HEAD:data/sprite_frame_index.js']);
for (const k of ['gravitospunch', 'gravitossoul', 'gravitoslaser'])
  ck(`${k} indexed as 9`, idx.includes(`"${k}": 9`));

console.log(bad ? `\n${bad} problem(s) — NOT fully wired` : '\nAll Gravitos cast sets are wired in HEAD.');
process.exit(bad ? 1 : 0);
