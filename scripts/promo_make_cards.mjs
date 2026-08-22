#!/usr/bin/env node
// Build the promo's card set. Every figure is COUNTED from the repo here, so
// the video can never quote a number the project stopped backing up.
//   node scripts/promo_make_cards.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const VERTICAL = process.argv.includes('--vertical');
if (VERTICAL) { process.env.PROMO_W = '1080'; process.env.PROMO_H = '1920';
  process.env.PROMO_CARDS = 'C:/Users/dpeh0/AppData/Local/Temp/claude/promo/cards_v'; }
// dynamic import: the card module reads its size from env at module scope, and
// a static import would be hoisted above the assignment above.
const { bigNumber, statement, triple, endCard, beforeAfter, OUTDIR } = await import('./promo_cards.mjs');

const ROOT = 'C:/Users/dpeh0/Mojiworld';
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const n = (v) => Number(v).toLocaleString('en-US');

const commits30 = git(['rev-list', '--count', '--since=30 days ago', 'origin/main']);
const commitsAll = git(['rev-list', '--count', 'origin/main']);
const firstTs = Number(git(['log', '--reverse', '--format=%at', 'origin/main']).split('\n')[0]);
const days = Math.floor((Date.now() / 1000 - firstTs) / 86400);

const countFiles = (dir, ext) => {
  let c = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('_') || e.name === 'node_modules') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith(ext)) c++;
    }
  };
  try { walk(join(ROOT, dir)); } catch (e) {}
  return c;
};
const sprites = countFiles('Sprites', '.webp');
const sounds = countFiles('audio', '.mp3');
const tests = readdirSync(join(ROOT, 'scripts')).filter((f) => f.endsWith('_test.mjs')).length;

console.log({ commits30, commitsAll, days, sprites, sounds, tests });

await bigNumber('c_hook', n(commits30), 'commits in the last 30 days');
await statement('c_hook2', 'That was one month.', `Mojiworld is ${days} days old.`);
await triple('c_stats', [[n(sprites), 'sprites'], [n(sounds), 'sounds'], [String(tests), 'test suites']]);
await statement('c_craft', 'Polish is not a phase.', "It's the whole job.");
await bigNumber('c_total', n(commitsAll), 'commits, and counting', '#c8a8ff');
await endCard('c_end', 'MOJIWORLD', `${days} days in. Still building.`, 'wishlist on steam');

const BA = join('C:/Users/dpeh0/AppData/Local/Temp/claude/promo', 'ba');
if (existsSync(join(BA, 'pad_before.webp'))) {
  await beforeAfter('ba_pad', readFileSync(join(BA, 'pad_before.webp')), readFileSync(join(BA, 'pad_after.webp')), 'the arena launch pad');
  await beforeAfter('ba_apo', readFileSync(join(BA, 'apo_before.webp')), readFileSync(join(BA, 'apo_after.webp')), 'projectile linework');
}
console.log('cards ->', OUTDIR);
