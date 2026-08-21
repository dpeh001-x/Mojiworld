// Guguma's starter kit reaches every class, through every exit from the
// tutorial, and repairs a character who somehow missed it.
// Per user: "archer class does not receive the beginner gear from guguma" /
// "when i skip tutorial I do not get the gears".
// Run: node scripts/starter_gear_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9190;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(() => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  const reset = (cls) => { player.cls = cls; player.inventory = []; player.equipped = {}; player._starterWeaponGiven = false; };
  const snap = () => ({ given: !!player._starterWeaponGiven,
    weapon: player.equipped.weapon ? player.equipped.weapon.name : null,
    armor: player.equipped.armor ? player.equipped.armor.name : null,
    bag: player.inventory.map(i => i && i.name) });
  const r = { perClass: {} };

  // 1. every class gets the full kit from a clean start
  for (const cls of Object.keys(CLASSES)) { reset(cls); _grantTutorialStarterWeapon(); r.perClass[cls] = snap(); }

  // 2. a PARTIAL grant repairs itself (weapon landed, armor did not)
  reset('archer');
  const _armors = ITEM_POOL.armors; ITEM_POOL.armors = [];
  _grantTutorialStarterWeapon();
  ITEM_POOL.armors = _armors;
  r.partial = snap();
  _grantTutorialStarterWeapon();      // any later path: skip / replay / death
  r.partialHealed = snap();

  // 3. flag persisted true but the hero owns NOTHING (the reported state)
  player.cls = 'archer'; player.inventory = []; player.equipped = {};
  player._starterWeaponGiven = true;
  _grantTutorialStarterWeapon();
  r.stuckHealed = snap();

  // 4. anti-farm: a kitted-out hero gets no second kit
  reset('archer'); _grantTutorialStarterWeapon();
  const _before = JSON.stringify(snap());
  for (let i = 0; i < 5; i++) _grantTutorialStarterWeapon();
  r.noFarm = { same: JSON.stringify(snap()) === _before, bagLen: player.inventory.length, after: snap() };

  // 5. a hero who moved on to better gear is left alone
  reset('archer');
  player.equipped.weapon = { name: 'Runed Sabre', baseName: 'Runed Sabre', slot: 'weapon' };
  player.equipped.armor = { name: 'Arcane Vestments', baseName: 'Arcane Vestments', slot: 'armor' };
  _grantTutorialStarterWeapon();
  r.movedOn = snap();

  return r;
});

ok('every class receives the full kit', Object.keys(out.perClass).every(c =>
     out.perClass[c].weapon === 'Whittled Stick' && out.perClass[c].armor === 'Threadbare Rags'),
   JSON.stringify(out.perClass.archer));
ok('the ARCHER specifically receives it', out.perClass.archer
     && out.perClass.archer.weapon === 'Whittled Stick' && out.perClass.archer.armor === 'Threadbare Rags',
   JSON.stringify(out.perClass.archer));
ok('a PARTIAL grant leaves the armor missing (the defect)', out.partial.armor === null, JSON.stringify(out.partial));
ok('...and the next path REPAIRS it', out.partialHealed.armor === 'Threadbare Rags', JSON.stringify(out.partialHealed));
ok('a flagged-but-empty character is repaired (the reported bug)',
   out.stuckHealed.weapon === 'Whittled Stick' && out.stuckHealed.armor === 'Threadbare Rags',
   JSON.stringify(out.stuckHealed));
ok('a kitted-out hero never gets a second kit (no farm)',
   out.noFarm.same === true && out.noFarm.bagLen === 0, JSON.stringify(out.noFarm));
ok('a hero in better gear is left untouched',
   out.movedOn.weapon === 'Runed Sabre' && out.movedOn.armor === 'Arcane Vestments' && out.movedOn.bag.length === 0,
   JSON.stringify(out.movedOn));

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
