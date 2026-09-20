#!/usr/bin/env node
// Rotate the dev-tools passphrase (and the ` dev key) without writing the word anywhere.
//
//   node scripts/set_dev_pw.mjs                 # prompts (no echo), prints the digests only
//   node scripts/set_dev_pw.mjs --write         # also bakes them into mojiworld_game.html
//   node scripts/set_dev_pw.mjs --write --file path/to/mojiworld_game.html
//
// Why this exists: until v0.30.924 the passphrase was a plain string in the page AND announced in
// CHANGELOG.html, which is published to the public site — so the word was the whole of the gate. The page now
// compares SHA-256 digests (_LX_DEV_PW_SHA, _LX_DEV_KEY_SHA). This script is the only thing that needs to see
// the word: it reads it from the terminal with the echo off, prints digests, and never logs or stores it.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import readline from 'node:readline';

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const fileArg = (() => { const i = argv.indexOf('--file'); return i >= 0 ? argv[i + 1] : null; })();
const GAME = path.resolve(fileArg || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'mojiworld_game.html'));

const ask = (label) => new Promise((res) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = process.stdout;
  rl.question(label, (a) => { out.write('\n'); rl.close(); res(a); });
  rl._writeToOutput = (s) => { if (s.startsWith(label)) out.write(label); };   // echo the prompt, not the answer
});

const sha = (t) => createHash('sha256').update(String(t), 'utf8').digest('hex');

const pw = process.env.LX_DEV_PW_NEW || await ask('New dev passphrase (typed anywhere to unlock): ');
if (!pw || pw.length < 6) { console.error('refusing: use at least 6 characters'); process.exit(1); }
const key = process.env.LX_DEV_KEY_NEW || await ask('New dev key (the ` prompt; blank = same as above): ') || pw;

const pwSha = sha(pw), keySha = sha(key);
console.log('_LX_DEV_PW_SHA  = ' + pwSha);
console.log('_LX_DEV_KEY_SHA = ' + keySha);

if (!WRITE) { console.log('\n(nothing written — re-run with --write to bake these into the game file)'); process.exit(0); }

let s = readFileSync(GAME, 'utf8');
const swap = (name, digest) => {
  const re = new RegExp("(const " + name + " = ')[0-9a-f]{64}(')");
  if (!re.test(s)) throw new Error(name + ' not found in ' + GAME);
  s = s.replace(re, (m, a, b) => a + digest + b);
};
swap('_LX_DEV_PW_SHA', pwSha);
try { swap('_LX_DEV_KEY_SHA', keySha); } catch (e) { console.log('(no _LX_DEV_KEY_SHA in this build — passphrase only)'); }
// atomic: write beside the target, verify, then replace (the game file is 10 MB and shared between sessions)
const tmp = GAME + '.tmp';
writeFileSync(tmp, s);
if (readFileSync(tmp, 'utf8').length !== s.length) throw new Error('short write');
renameSync(tmp, GAME);
console.log('\nbaked into ' + GAME + ' — commit it, and do not paste the word into a commit message or the changelog.');
