#!/usr/bin/env node
// v0.29.311 — verify that percentage coin penalties (death haircut, Reset
// Stats fee) size off wallet + Mojibank and collect from both.
//
// Extracts totalCoins() / chargeCoins() verbatim from mojiworld_game.html
// (no reimplementation — a drifted copy would certify nothing) and runs the
// real death / reset formulas over them.
//
//   node scripts/bank_penalty_test.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');

function extract(name) {
  const start = src.indexOf(`\nfunction ${name}(`);
  if (start < 0) throw new Error(`${name}() not found in mojiworld_game.html`);
  // Brace-match from the opening { of the function body.
  let i = src.indexOf('{', start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error(`unbalanced braces in ${name}()`);
}

let player;
const _monoNow = () => 1_000_000;
const harness = new Function('getPlayer', 'setPlayer', '_monoNow', `
  let player = getPlayer();
  ${extract('totalCoins')}
  ${extract('chargeCoins')}
  return { totalCoins, chargeCoins, sync: (p) => { player = p; } };
`);
const api = harness(() => player, (p) => { player = p; }, _monoNow);

// The two live call sites, transcribed from mojiworld_game.html:
//   triggerDeath : Math.min(100000, Math.floor(totalCoins() * 0.35))
//   resetStats   : Math.floor(totalCoins() * 0.20)
const deathCost = () => Math.min(100000, Math.floor(api.totalCoins() * 0.35));
const resetCost = () => Math.floor(api.totalCoins() * 0.20);

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`); }
}

function withPlayer(wallet, bank) {
  player = { mojicoins: wallet, bankBalance: bank, bankLastTick: 0 };
  api.sync(player);
  return player;
}

console.log('\n== totalCoins() ==');
withPlayer(300, 0);      check('wallet only', api.totalCoins(), 300);
withPlayer(0, 50000);    check('bank only', api.totalCoins(), 50000);
withPlayer(4000, 6000);  check('wallet + bank', api.totalCoins(), 10000);
player = { mojicoins: 500 };                   api.sync(player);
check('missing bankBalance treated as 0', api.totalCoins(), 500);
player = { mojicoins: 500, bankBalance: NaN }; api.sync(player);
check('NaN bankBalance treated as 0', api.totalCoins(), 500);
withPlayer(-50, -50);    check('negative fields floor to 0', api.totalCoins(), 0);

console.log('\n== chargeCoins() — wallet first, bank second ==');
let p = withPlayer(1000, 5000);
check('charge inside wallet: taken', api.chargeCoins(400), 400);
check('charge inside wallet: wallet', p.mojicoins, 600);
check('charge inside wallet: bank untouched', p.bankBalance, 5000);

p = withPlayer(1000, 5000);
check('charge spills into bank: taken', api.chargeCoins(3000), 3000);
check('charge spills into bank: wallet drained', p.mojicoins, 0);
check('charge spills into bank: bank debited', p.bankBalance, 3000);
check('charge spills into bank: interest clock re-stamped', p.bankLastTick, _monoNow());

p = withPlayer(100, 200);
check('charge exceeding net worth takes what exists', api.chargeCoins(9999), 300);
check('charge exceeding net worth: wallet 0', p.mojicoins, 0);
check('charge exceeding net worth: bank 0', p.bankBalance, 0);

p = withPlayer(1000, 5000);
check('zero charge is a no-op', api.chargeCoins(0), 0);
check('zero charge leaves wallet', p.mojicoins, 1000);
check('zero charge leaves interest clock', p.bankLastTick, 0);

p = withPlayer(1000, 5000);
check('negative charge is a no-op', api.chargeCoins(-500), 0);
check('negative charge leaves wallet', p.mojicoins, 1000);

console.log('\n== death haircut (35% of wallet + bank, capped 100k) ==');
p = withPlayer(0, 10000);
let cost = deathCost();
check('all-banked stash is no longer free: cost', cost, 3500);
api.chargeCoins(cost);
check('all-banked stash: bank debited', p.bankBalance, 6500);
check('all-banked stash: net worth after', api.totalCoins(), 6500);

p = withPlayer(10000, 0);
cost = deathCost();
check('all-carried stash unchanged from before: cost', cost, 3500);
api.chargeCoins(cost);
check('all-carried stash: wallet debited', p.mojicoins, 6500);

p = withPlayer(5000, 5000);
cost = deathCost();
check('split stash costs the same as either extreme', cost, 3500);
api.chargeCoins(cost);
check('split stash: wallet paid first', p.mojicoins, 1500);
check('split stash: bank untouched (wallet covered it)', p.bankBalance, 5000);

p = withPlayer(1000, 9000);
cost = deathCost();
check('thin wallet, fat bank: cost', cost, 3500);
api.chargeCoins(cost);
check('thin wallet, fat bank: wallet emptied', p.mojicoins, 0);
check('thin wallet, fat bank: bank covers remainder', p.bankBalance, 6500);

p = withPlayer(0, 10_000_000);
check('100k cap still applies to bank-side worth', deathCost(), 100000);
api.chargeCoins(deathCost());
check('100k cap: bank debited exactly 100k', p.bankBalance, 9_900_000);

p = withPlayer(0, 0);
check('broke player owes nothing', deathCost(), 0);

console.log('\n== Reset Stats fee (20% of wallet + bank) ==');
p = withPlayer(0, 10000);
cost = resetCost();
check('banking the stash no longer makes the reset free', cost, 2000);
check('affordability check passes on bank-only worth', api.totalCoins() >= cost, true);
api.chargeCoins(cost);
check('reset fee: bank debited', p.bankBalance, 8000);

p = withPlayer(2000, 8000);
cost = resetCost();
check('split stash fee', cost, 2000);
api.chargeCoins(cost);
check('split stash fee: wallet paid it', p.mojicoins, 0);
check('split stash fee: bank untouched', p.bankBalance, 8000);

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail} checks\n`);
process.exit(fail === 0 ? 0 : 1);
