// A controller can reach and USE the gear in the Items tab.
// Per user: "controller does not allow me to select equipments please enable it".
// Run: node scripts/pad_inventory_nav_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9197;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  window.__pad = { id: 'probe', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__setBtn = (i, v) => { window.__pad.buttons[i] = { pressed: !!v, touched: !!v, value: v ? 1 : 0 };
                                window.__pad.timestamp = performance.now(); };
});
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player.cls = 'archer'; player.level = 20; player.hp = getMaxHp();
  // real gear in the bag, and one worn piece, so both tile kinds exist
  const w = ITEM_POOL.weapons.find(x => x.name === 'Iron Sword');
  const a = ITEM_POOL.armors.find(x => x.tier === 1) || ITEM_POOL.armors[0];
  player.inventory = [
    { ...w, baseName: w.name, stars: 0, slot: 'weapon' },
    { ...a, baseName: a.name, stars: 0, slot: 'armor' },
  ];
  player.equipped = {};
  window.dispatchEvent(new Event('gamepadconnected'));
  await wait(300);
  openLevelUpPanel(); await wait(400);
  const tab = [...document.querySelectorAll('#u-tabs .inv-tab')].find(b => b.dataset.utab === 'items');
  if (tab) tab.click();
  await wait(600);

  const root = _lxPadModalRoot();
  const r = { rootId: root ? root.id : null };
  // what the walker can actually reach — mirror its own selector
  const SEL = 'button, [role="button"], input, select, .toggle, .qj-btn, [data-qaccept], [data-qabandon], [onclick], .cs-dd-item, .class-card, .cs-skin-swatch, .cs-dd-trigger, .inv-slot, .equip-slot';
  const all = [...(root || document).querySelectorAll(SEL)].filter((el) => {
    if (el.disabled) return false;
    const rc = el.getBoundingClientRect();
    if (rc.width < 5 || rc.height < 5) return false;
    if (getComputedStyle(el).visibility === 'hidden') return false;
    if ((el.classList.contains('inv-slot') || el.classList.contains('equip-slot'))
        && typeof el.onclick !== 'function') return false;
    return true;
  });
  r.focusables = all.length;
  r.gearTiles = all.filter(e => e.classList.contains('inv-slot') || e.classList.contains('equip-slot')).length;
  // how many gear tiles EXIST vs how many are reachable
  r.gearOnScreen = [...(root || document).querySelectorAll('.inv-slot, .equip-slot')]
    .filter(e => typeof e.onclick === 'function' && e.getBoundingClientRect().width >= 5).length;

  // drive the ring with the d-pad until it lands on a gear tile, then press A
  r.equippedBefore = player.equipped.weapon ? player.equipped.weapon.name : null;
  let landed = null;
  for (let i = 0; i < 40 && !landed; i++) {
    window.__setBtn(15, 1); await wait(60); window.__setBtn(15, 0); await wait(90);
    const f = document.querySelector('.pad-focus');
    if (f && f.classList.contains('inv-slot')) landed = f.className;   // a BAG tile: pressing A on it should equip
  }
  r.ringReachedGear = !!landed;
  r.landedOn = landed;
  if (landed) { window.__setBtn(0, 1); await wait(140); window.__setBtn(0, 0); await wait(700); }
  r.equippedAfter = player.equipped.weapon ? player.equipped.weapon.name : null;
  return r;
});

ok('the Items tab is the pad root', out.rootId === 'attributes-modal', String(out.rootId));
ok('gear tiles exist on screen', out.gearOnScreen > 0, out.gearOnScreen + ' clickable tiles');
// (a mirrored-selector count was removed: it restated the fix instead of
//  testing it, and passed on the unfixed build. The two checks below are the
//  honest ones - they drive the real walker.)
ok('the focus ring reaches a BAG item tile', out.ringReachedGear === true, out.landedOn || 'never landed');
ok('pressing Ⓐ on it equips the item', out.equippedBefore === null && !!out.equippedAfter,
   `${out.equippedBefore} -> ${out.equippedAfter}`);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
