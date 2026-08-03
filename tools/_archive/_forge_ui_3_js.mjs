// Forge UI redesign · 3/3 — renderEnhancementModal stage hookup: selected item
// floats above the anvil; hint shows when the stage is empty.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const OLD = `  // Preview — v0.26.259 simplified + clarified.
  if (selectedItem) {`;
const NEW = `  // v0.26.873 — Forge stage: float the selected item above the anvil and
  // toggle the empty-stage hint. The stage is the dedicated home of the
  // success/fail animation, so the player's eye is already parked there.
  const _stageIt = document.getElementById('enhance-stage-item');
  const _stageHint = document.getElementById('enhance-stage-hint');
  if (_stageIt) _stageIt.innerHTML = selectedItem ? itemIconHtml(selectedItem, 56) : '';
  if (_stageHint) _stageHint.style.display = selectedItem ? 'none' : 'block';
  // Preview — v0.26.259 simplified + clarified.
  if (selectedItem) {`;

const c = src.split(OLD).length - 1;
if (c !== 1) { console.error('FAIL: ' + c); process.exit(2); }
src = src.replace(OLD, NEW);
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: stage hookup applied.');
