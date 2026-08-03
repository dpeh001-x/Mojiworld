// Boot de-bake: the loading overlay's static markup carried POST-BOOT state
// (a DOM-snapshot bake artifact): auth form 'shown', bar 100%, 'Ready ✓',
// stack 'compact', tip hidden. Result: a clickable "Continue as Guest"
// rendered the moment the page painted — seconds BEFORE the 4.5MB script
// parsed and _wireAuthForm attached handlers, so first clicks were dropped.
// Reset to true initial state: bar 0% + honest progress, form hidden until
// the asset+decode gate clears and the handlers exist.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  { old: `    <div class="lo-stack compact">`,
    neu: `    <div class="lo-stack"><!-- v0.26.904 — de-baked: 'compact' is added by _showAuthGate, not shipped -->` },
  { old: `      <div class="bar-wrap"><div class="bar" id="loading-bar" style="width: 100%;"></div></div>`,
    neu: `      <div class="bar-wrap"><div class="bar" id="loading-bar" style="width: 0%;"></div></div>` },
  { old: `      <p class="status" id="loading-status"><span class="pct">100%</span> · <span style="color:#c8ffc8;">Ready ✓</span></p>`,
    neu: `      <p class="status" id="loading-status"><span class="pct">0%</span> · <span class="pulse">Waking Mojiworld…</span></p>` },
  { old: `      <div class="lo-auth shown" id="lo-auth">`,
    neu: `      <div class="lo-auth" id="lo-auth" hidden><!-- v0.26.904 — hidden until assets+decode finish AND handlers are wired (_showAuthGate); clicking a dead form was the "multiple clicks" bug -->` },
  { old: `  <div class="lo-tip" style="display: none;">`,
    neu: `  <div class="lo-tip">` },
];

let n = 0;
for (let { old, neu } of reps) {
  let o = old, r = neu;
  if (src.split(o).length - 1 !== 1) { o = old.replace(/\n/g, '\r\n'); r = neu.replace(/\n/g, '\r\n'); }
  const c = src.split(o).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(o, r); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' de-bake edits applied.');
