// Certify the v0.29.286 seeded-RNG helpers by pulling them out of the game
// file and exercising determinism + code roundtrip + rehydration.
import { readFileSync } from 'node:fs';
const src = readFileSync('mojiworld_game.html', 'utf8');
const grab = (name, kind) => {
  const re = new RegExp('(?:^|\\n)(?:const |function )' + name + '\\b');
  const i = src.search(re);
  if (i < 0) throw new Error('not found: ' + name);
  // brace-match forward from the first { after the declaration
  let j = src.indexOf('{', i), d = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) break; } }
  return src.slice(i, kind === 'const' ? src.indexOf(';', k) + 1 : k + 1);
};
const code = [
  grab('_lxMulberry32'), grab('_lxSeedFromString'),
  "const _LX_SEED_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';",
  "const _LX_SEED_SPACE = 887503681;",
  grab('_lxSeedToCode'), grab('_lxCodeToSeed'),
].join('\n');
const F = new Function(code + '; return {_lxMulberry32,_lxSeedFromString,_lxSeedToCode,_lxCodeToSeed};')();

const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// 1) determinism
const a = F._lxMulberry32(12345), b = F._lxMulberry32(12345);
const seqA = [a(), a(), a(), a(), a()], seqB = [b(), b(), b(), b(), b()];
ok('same seed -> identical stream', JSON.stringify(seqA) === JSON.stringify(seqB), seqA.slice(0, 2));

// 2) different seeds diverge
const c = F._lxMulberry32(12346);
ok('different seed -> different stream', c() !== seqA[0]);

// 3) range
let min = 1, max = 0; const r = F._lxMulberry32(999);
for (let i = 0; i < 200000; i++) { const v = r(); if (v < min) min = v; if (v > max) max = v; }
ok('all draws in [0,1)', min >= 0 && max < 1, { min: +min.toFixed(6), max: +max.toFixed(6) });

// 4) rough uniformity across 10 buckets (<3% deviation from 10%)
const buckets = new Array(10).fill(0); const r2 = F._lxMulberry32(4242);
for (let i = 0; i < 100000; i++) buckets[Math.floor(r2() * 10)]++;
const dev = Math.max(...buckets.map(n => Math.abs(n / 100000 - 0.1)));
ok('uniform within 3%', dev < 0.03, { maxDeviation: +(dev * 100).toFixed(2) + '%' });

// 5) code roundtrip over many seeds
let bad = null;
for (let i = 0; i < 20000; i++) {
  const s = Math.floor(Math.random() * 887503681);
  const back = F._lxCodeToSeed(F._lxSeedToCode(s));
  if (back !== s) { bad = { s, code: F._lxSeedToCode(s), back }; break; }
}
ok('seed -> code -> seed roundtrips exactly (20k)', bad === null, bad);

// 6) codes use only the safe alphabet
const sample = F._lxSeedToCode(0xDEADBEEF);
ok('code uses safe alphabet only', [...sample].every(ch => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'.includes(ch)), sample);

// 7) arbitrary words are accepted and stable
ok('word seed is stable', F._lxCodeToSeed('banana') === F._lxCodeToSeed('banana'));
ok('word seed is case-insensitive', F._lxCodeToSeed('Banana') === F._lxCodeToSeed('BANANA'));
ok('distinct words -> distinct seeds', F._lxCodeToSeed('banana') !== F._lxCodeToSeed('apple'));
ok('blank -> null (random run)', F._lxCodeToSeed('') === null && F._lxCodeToSeed(null) === null);

// 8) rehydration: replaying N draws resumes the identical position
const seed = 777, orig = F._lxMulberry32(seed);
for (let i = 0; i < 37; i++) orig();
const nextOrig = orig();
const rehy = F._lxMulberry32(seed);
for (let i = 0; i < 37; i++) rehy();
ok('rehydrated stream resumes exactly (save/load safety)', rehy() === nextOrig);

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x !== undefined ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
