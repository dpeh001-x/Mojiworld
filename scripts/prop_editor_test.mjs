// CTRL PROP EDITOR (v0.29.483) — drives the live MAP_PROPS editor end to end.
//
// Two pages on purpose: one WITHOUT the dev flag (the gate must hold — players
// tapping Ctrl see nothing) and one with ?dev=1 exercising the whole surface:
// bare-tap toggle, chord immunity (Ctrl+C must NOT toggle), add at player,
// armed click-to-place, drag, arrow nudge (and that the swallowed arrows leave
// the player untouched), scale/anchor/snap, Ctrl+Z undo, Delete remove,
// export text, and listener teardown on close.
// Run: node scripts/prop_editor_test.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/');
const browser = await chromium.launch({ channel: 'chrome' });
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? '  — ' + detail : ''}`); if (!ok) bad++; };
const tap = async (page) => { await page.keyboard.down('Control'); await page.keyboard.up('Control'); };

// ---- 1. locked page: the gate must hold --------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof _lxPeToggle === 'function', { timeout: 60000 });
  await tap(page);
  const open = await page.evaluate(() => _LX_PE.open);
  console.log('no dev flag:');
  check(!open, 'bare Ctrl tap does nothing without the dev unlock');
  await page.close();
}

// ---- 2. dev page: the full surface -------------------------------------
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _lxPeToggle === 'function' && typeof MAP_PROPS !== 'undefined', { timeout: 60000 });
await page.evaluate(() => {
  const card = document.querySelector('#class-select-modal .cls-card');
  if (card && !player.cls) { try { card.click(); } catch (e) {} }
  const gate = document.getElementById('class-select-modal');
  if (gate) gate.style.display = 'none';
  game.paused = false;
});

console.log('\ntoggle:');
await tap(page);
check(await page.evaluate(() => _LX_PE.open && _LX_PE.root.style.display === 'block'), 'bare Ctrl tap opens the editor');
await page.keyboard.down('Control'); await page.keyboard.press('KeyC'); await page.keyboard.up('Control');
check(await page.evaluate(() => _LX_PE.open), 'Ctrl+C chord does not toggle it');
await tap(page);
check(await page.evaluate(() => !_LX_PE.open), 'a second tap closes it');
await tap(page);   // back open for the rest

console.log('\nadd:');
const r1 = await page.evaluate(() => {
  _LX_PE.ui.roster.value = 'barrel_stack';
  const n0 = _lxPeList().length;
  _lxPeAddAtPlayer();
  const l = _lxPeList(), p = l[l.length - 1];
  const gy = _lxPeGroundY(p.x, p.y);
  return { grew: l.length === n0 + 1, key: p.key, grounded: gy === p.y, sel: _LX_PE.sel === l.length - 1 };
});
check(r1.grew && r1.key === 'barrel_stack', 'add-at-player appends the roster prop', JSON.stringify(r1));
check(r1.grounded, 'the new prop lands on a platform top');
check(r1.sel, 'the new prop is selected');

const r2 = await page.evaluate(() => {
  _LX_PE.ui.roster.value = 'crate_stack';
  _LX_PE.ui.armBtn.click();                                   // arm placement
  const cv = document.getElementById('game'), r = cv.getBoundingClientRect();
  const wx = ((game.camera && game.camera.x) || 0) + 300, wy = ((game.camera && game.camera.y) || 0) + 300;
  const cx = r.left + (wx - ((game.camera && game.camera.x) || 0)) * (r.width / cv.width);
  const cy = r.top + (wy - ((game.camera && game.camera.y) || 0)) * (r.height / cv.height);
  const n0 = _lxPeList().length;
  cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true, button: 0 }));
  cv.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, bubbles: true, button: 0 }));
  const l = _lxPeList(), p = l[l.length - 1];
  // compare against the WORLD x that was clicked (wx), not a viewport-relative
  // constant — camX is nonzero at boot, and the first draft of this test
  // asserted p.x === 300 where the click was at world camX+300.
  return { grew: l.length === n0 + 1, key: p && p.key, xOk: p && Math.abs(p.x - wx) <= 1, disarmed: _LX_PE.place === null };
});
check(r2.grew && r2.key === 'crate_stack', 'armed click places at the clicked point', JSON.stringify(r2));
check(r2.xOk, 'placed x matches the click x');
check(r2.disarmed, 'placement disarms after one click');

console.log('\nposition:');
const r3 = await page.evaluate(() => {
  const l = _lxPeList(); _LX_PE.sel = l.length - 1;
  const p = l[_LX_PE.sel];
  const cv = document.getElementById('game'), r = cv.getBoundingClientRect();
  const camX = (game.camera && game.camera.x) || 0, camY = (game.camera && game.camera.y) || 0;
  const toClient = (wx, wy) => ({ x: r.left + (wx - camX) * (r.width / cv.width), y: r.top + (wy - camY) * (r.height / cv.height) });
  const x0 = p.x;
  const a = toClient(p.x, p.y - 20), b = toClient(p.x + 120, p.y - 60);
  cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: a.x, clientY: a.y, bubbles: true, button: 0 }));
  cv.dispatchEvent(new PointerEvent('pointermove', { clientX: b.x, clientY: b.y, bubbles: true }));
  cv.dispatchEvent(new PointerEvent('pointerup',   { clientX: b.x, clientY: b.y, bubbles: true, button: 0 }));
  return { dx: p.x - (x0 + 120) };   // expected end = actual start + the 120px drag
});
check(Math.abs(r3.dx) <= 2, 'drag moves the selected prop with the pointer', 'dx off by ' + r3.dx);

const r4 = await page.evaluate(() => { const p = _lxPeSel(); return { x0: p.x, px0: player.x }; });
await page.keyboard.press('ArrowRight');
await page.keyboard.down('Shift'); await page.keyboard.press('ArrowLeft'); await page.keyboard.up('Shift');
const r5 = await page.evaluate(() => { const p = _lxPeSel(); return { x1: p.x, px1: player.x }; });
check(r5.x1 === r4.x0 + 1 - 10, 'arrow nudges 1px, Shift-arrow 10px', `x ${r4.x0} -> ${r5.x1}`);
check(r5.px1 === r4.px0, 'swallowed arrows never reach the player');

console.log('\nedit ops:');
const r6 = await page.evaluate(() => {
  const p = _lxPeSel();
  _lxPeScale(0.3); const sc = p.scale;
  _lxPeAnchorToggle(); const an = p.anchor;
  _lxPeAnchorToggle();
  p.y -= 37; _lxPeSnap();
  const gy = _lxPeGroundY(p.x, p.y);
  return { sc, an, snapped: gy === p.y };
});
check(r6.sc === 1.3, 'scale steps by 0.1', 'got ' + r6.sc);
check(r6.an === 'hang', 'anchor toggles to hang and back');
check(r6.snapped, 'snap returns the prop to the platform top');

const r7 = await page.evaluate(() => {
  const l = _lxPeList(); const n0 = l.length; const xBefore = _lxPeSel().x;
  _lxPeMark(); _lxPeSel().x += 500;                      // an op with a snapshot
  return { n0, xBefore, xAfter: _lxPeSel().x };
});
await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
const r8 = await page.evaluate(() => ({ x: _lxPeSel().x, open: _LX_PE.open, n: _lxPeList().length }));
check(r8.x === r7.xBefore && r8.n === r7.n0, 'Ctrl+Z undoes the last op', `x ${r7.xAfter} -> ${r8.x}`);
check(r8.open, 'the Ctrl+Z chord did not close the editor');

await page.keyboard.press('Delete');
const r9 = await page.evaluate(() => _lxPeList().length);
check(r9 === r7.n0 - 1, 'Delete removes the selected prop', `${r7.n0} -> ${r9}`);

console.log('\nexport:');
const r10 = await page.evaluate(() => { _lxPeExport(); return _LX_PE.ui.out.textContent; });
check(r10.includes('MAP_PROPS.') && r10.includes('barrel_stack'), 'export emits the MAP_PROPS block with the added prop');

console.log('\nteardown:');
await tap(page);
const r11 = await page.evaluate(() => {
  const n0 = _lxPeList().length;
  const cv = document.getElementById('game'), r = cv.getBoundingClientRect();
  cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + 50, clientY: r.top + 50, bubbles: true, button: 0 }));
  return { closed: !_LX_PE.open, inert: _lxPeList().length === n0 && !_LX_PE.drag };
});
check(r11.closed, 'closed via a final tap');
check(r11.inert, 'canvas clicks are inert after close');
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 3).join(' | ') : '\nno page errors');
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
