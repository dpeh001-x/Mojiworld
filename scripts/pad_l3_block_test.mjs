// L3 (left-stick click) performs Block, driven through the real pad poller.
// Per user: "Controller L3 key should be the block (A) function."
// Run: node scripts/pad_l3_block_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9258;
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

const out = await page.evaluate(async () => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.level = 30; player.hp = 9e6; player.maxHp = 9e6;
  game.paused = false;
  loadMap('forest', 300);

  const r = {};
  r.mapped = JSON.stringify(_LX_PAD_MAP[10]);
  r.resolved = (typeof _lxPadResolveKey === 'function') ? _lxPadResolveKey(_LX_PAD_MAP[10]) : null;
  r.label = (typeof _lxPadSpecLabel === 'function') ? _lxPadSpecLabel(_LX_PAD_MAP[10]) : null;
  r.remapperHasBlock = (typeof _LX_PAD_ACTIONS !== 'undefined')
    && _LX_PAD_ACTIONS.some(a => a.s && a.s.a === 'block');
  r.remapperHasDash = (typeof _LX_PAD_ACTIONS !== 'undefined')
    && _LX_PAD_ACTIONS.some(a => a.s && a.s.a === 'dodge');
  // a rebind of Block must carry the pad with it
  const savedBinds = player.actionBinds;
  player.actionBinds = Object.assign({}, savedBinds || {}, { block: 'g' });
  r.resolvedAfterRebind = _lxPadResolveKey(_LX_PAD_MAP[10]);
  player.actionBinds = savedBinds;

  // Clear whatever surface owns the pause first. The poller deliberately
  // routes to MENU NAV whenever a modal is up (a story beat fires on map
  // entry), so pressing L3 with one open tests the menu path, not gameplay.
  for (let i = 0; i < 40 && (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); i++) {
    const root = _lxPadModalRoot();
    if (!root) break;
    try { root.classList.remove('on', 'open'); root.style.display = 'none'; } catch (e) {}
  }
  game.paused = false;
  await new Promise(x => setTimeout(x, 150));
  r.modalRootBeforePress = (typeof _lxPadModalRoot === 'function' && _lxPadModalRoot())
    ? (_lxPadModalRoot().id || 'unnamed') : null;
  r.pausedBeforePress = game.paused;

  // drive the REAL poller with a synthetic pad and watch what key it dispatches
  const pad = { connected: true, index: 0, id: 'lx-test-pad', mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0], timestamp: 0 };
  navigator.getGamepads = () => [pad];
  window.dispatchEvent(new Event('gamepadconnected'));
  const seen = [];
  const onKey = (e) => seen.push(e.key);
  window.addEventListener('keydown', onKey, true);
  pad.buttons[10].pressed = true; pad.buttons[10].value = 1;
  await new Promise(x => setTimeout(x, 400));
  pad.buttons[10].pressed = false; pad.buttons[10].value = 0;
  await new Promise(x => setTimeout(x, 200));
  window.removeEventListener('keydown', onKey, true);
  r.dispatched = seen.slice(0, 6);
  return r;
});
await browser.close(); server.kill();

ok('L3 is bound to the block action', out.mapped === '{"a":"block"}', out.mapped);
ok('it resolves to the Block key', out.resolved === 'a', `resolved to "${out.resolved}"`);
ok('rebinding Block in Hotkeys carries the pad with it',
   out.resolvedAfterRebind === 'g', `after rebinding block->g, L3 resolves to "${out.resolvedAfterRebind}"`);
ok('the pad remapper shows a readable label, not a raw id',
   out.label === 'Block / Parry', `label "${out.label}"`);
ok('Block is assignable in the pad remapper', out.remapperHasBlock);
ok('Dash is still assignable there too (it lost only its default button)', out.remapperHasDash);
ok('the gameplay path is the one under test (no modal owns the pad)',
   !out.modalRootBeforePress && out.pausedBeforePress === false,
   `modal root: ${out.modalRootBeforePress}, paused: ${out.pausedBeforePress}`);
ok('pressing L3 actually dispatches the Block key through the real poller',
   out.dispatched.includes('a'), 'dispatched: ' + JSON.stringify(out.dispatched));

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
