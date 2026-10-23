// gravitos-ohko-rework, the extras half (the pipeline's LX_APPLY2; runs after the LX_EXTRA files are re-synced from origin):
// the Soul Drain icon joins the asset manifest, and the suites that assumed Soul Drain sets HP to 1 on the spot are updated.
// Exact-line, count-guarded swaps (each old line must appear exactly once), EOL-aware, atomic, idempotent per file.
//   boss_fairness_test - the open-ground run now expects the SOUL DRAIN status (10 ticks to come) and no instant drop to 1 HP;
//                        the sheltered run expects neither; each run starts with the status cleared.
//   prologue_pleasant_test - outside godmode the drain now lands the status (was: HP and MP clamped to 1); godmode: no status.
//   LX_TESTS_ROOT=<dir holding scripts/> (default: the repo) to patch copies.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const ROOT = process.env.LX_TESTS_ROOT || 'C:/Users/dpeh0/Mojiworld';
const T = 'v0.30.x gravitos-ohko-rework';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const FILES = {
  'scripts/boss_fairness_test.mjs': [
    ['    player._healLockUntil = 0; player._potionLockUntil = 0;',
     `    player._healLockUntil = 0; player._potionLockUntil = 0; player._sdLeft = 0;   // ${T} - each run starts without the Soul Drain status`],
    ['             drained: lo <= 1 };',
     `             drained: lo <= 1, sd: player._sdLeft | 0 };   // ${T} - the Soul Drain status's ticks still to come`],
    ["check(!!(r.exposedRun && r.exposedRun.fired && r.exposedRun.drained), 'caught in the open, the drain still takes you to 1 HP', r.exposedRun);",
     `check(!!(r.exposedRun && r.exposedRun.fired && r.exposedRun.sd === 10 && !r.exposedRun.drained), 'caught in the open, the drain lands the Soul Drain status (10 ticks to come) and no instant drop to 1 HP', r.exposedRun);   // ${T}`],
    ["check(!!(r.shelteredRun && r.shelteredRun.fired && !r.shelteredRun.drained), 'behind cover, the drain resolves and does NOT drain you', r.shelteredRun);",
     `check(!!(r.shelteredRun && r.shelteredRun.fired && !r.shelteredRun.drained && !r.shelteredRun.sd), 'behind cover, the drain resolves and does NOT drain you (no status)', r.shelteredRun);   // ${T}`],
  ],
  'scripts/prologue_pleasant_test.mjs': [
    ['  const god = { hp: player.hp, mp: player.mp };',
     `  const god = { hp: player.hp, mp: player.mp, sd: player._sdLeft | 0 };   // ${T} - and no Soul Drain status`],
    ['  const mortal = { hp: player.hp, mp: player.mp };',
     `  const mortal = { hp: player.hp, mp: player.mp, sd: player._sdLeft | 0 }; player._sdLeft = 0;   // ${T} - the drain is a status now`],
    ["check(drain.god.hp === drain.hpMax && drain.god.mp === drain.mpMax, 'godmode keeps HP and MP untouched through the drain', drain.god);",
     `check(drain.god.hp === drain.hpMax && drain.god.mp === drain.mpMax && !drain.god.sd, 'godmode keeps HP and MP untouched through the drain (no Soul Drain status)', drain.god);   // ${T}`],
    ["check(drain.mortal.hp === 1 && drain.mortal.mp === 1, 'the mortal clamp still bites outside godmode', drain.mortal);",
     `check(drain.mortal.sd === 10 && drain.mortal.hp === drain.hpMax, 'outside godmode the drain still bites: the Soul Drain status lands (10 ticks of 10% max HP to come)', drain.mortal);   // ${T}`],
  ],
};
// The Soul Drain HUD icon (ludo.ai, job 4764d51a... of three; trimmed, 86% on a transparent 256 square) must be the reviewed file;
// it joins data/assets_manifest.json (sorted, as gen_assets_manifest writes it) so the service worker trickle-fetches it. A new
// filename needs no sw.js CACHE bump (nothing to evict).
{
  const ICON = 'Sprites/skills/buff_soulDrain.webp', SHA = 'ce7cee0893fb345a91edf1d709d543b41f1abbbf686413e32511378f31085039';
  const ib = readFileSync(path.join(ROOT, ICON));
  if (createHash('sha256').update(ib).digest('hex') !== SHA) die(ICON + ' is not the reviewed file');
  const MF = path.join(ROOT, 'data/assets_manifest.json'), ms = readFileSync(MF, 'utf8'), man = JSON.parse(ms);
  if (!Array.isArray(man) || man.length < 5000) die('manifest shape');
  if (man.includes(ICON)) console.log('already listed: ' + ICON);
  else {
    man.push(ICON); man.sort();
    const out = JSON.stringify(man) + (/\n$/.test(ms) ? '\n' : '');
    if (out.length - ms.length !== ICON.length + 3) die('manifest grew ' + (out.length - ms.length));
    writeFileSync(MF + '.tmp', out, 'utf8'); renameSync(MF + '.tmp', MF);
    console.log('listed: ' + ICON + ' (' + man.length + ' paths)');
  }
}
for (const [rel, swaps] of Object.entries(FILES)) {
  const F = path.join(ROOT, rel);
  const s = readFileSync(F, 'utf8');
  if (s.includes(T)) { console.log('already applied: ' + rel); continue; }
  const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
  const EOL = crlf > lf / 2 ? '\r\n' : '\n';
  const L = s.split(EOL);
  for (const [a, b] of swaps) {
    const hits = L.reduce((n, x) => n + (x === a ? 1 : 0), 0);
    if (hits !== 1) die(rel + ': line matched ' + hits + ': ' + a.slice(0, 70));
    if (/[^\x09\x20-\x7e]/.test(b)) die(rel + ': non-ASCII in the new line');
    L[L.indexOf(a)] = b;
  }
  const out = L.join(EOL), marks = out.split(T).length - 1;
  if (marks !== swaps.length) die(rel + ': markers ' + marks);
  writeFileSync(F + '.tmp', out, 'utf8');
  let done = false, lastErr = null;
  for (let k = 1; k <= 8 && !done; k++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * k); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
  console.log(`applied: ${rel} (${swaps.length} lines, ${marks} marks)`);
}
