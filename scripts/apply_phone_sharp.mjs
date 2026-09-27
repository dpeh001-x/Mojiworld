// Sharp Display: an opt-in Settings > Graphics switch that draws the game canvas at the screen's own sharpness
// (pre-launch UI audit #13, "blurry canvas on phones", 2026-09-27).
// ============================================================================
// The bug: a phone renders the game at scale 1 on purpose (v0.25.14: "mobile perf: cap dpr at 1 on touch/narrow
// viewports", to spare phone GPUs the fill). So on a 844x390 phone at devicePixelRatio 3 the 960x560 canvas is shown in
// a 669x390 CSS box = ~2000x1170 device pixels: every canvas pixel is stretched ~2x and all canvas text looks soft.
// Desktops follow devicePixelRatio x fit scale but stop at 2 (v0.30.238), so a HiDPI desktop is also ~1.3-1.9x soft.
// The fix: a "Sharp Display (uses more battery)" switch in Settings > Graphics, OFF by default everywhere (the caps
// above stay the default, so nobody's frame or battery budget changes). ON, the canvas backing store becomes
// min(devicePixelRatio, 2) store pixels per CSS pixel of the box the game is shown in (never below what it already
// had, never above the 3x that every bake helper clamps to). It goes through the same _lxApplyRenderScale /
// setTransform(_LX_DPR) path the desktop and the resolution governor already use, so world coordinates, the camera,
// click/tap hit-testing (which maps through the CSS box and the logical 960x560 grid) and the DOM HUD do not move.
// It persists in LX_SETTINGS like the other graphics switches; Reset puts it back to the default.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxSharpDpr(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the setting's mirrors + the sharp target, just ahead of the render-scale resolver that reads them
once('function _lxTargetDpr() {', J(
  '// v0.30.1227 phone-sharp - SHARP DISPLAY (Settings > Graphics). The mobile cap of 1 above and the desktop cap of 2 stay the',
  '// default; this opt-in lifts the backing store to min(devicePixelRatio, 2) store px per CSS px of the box the game is',
  '// shown in (never below the capped value, never above the 3x every bake helper clamps to). Same setTransform(_LX_DPR)',
  '// path as ever, so world coordinates, hit-testing and the HUD do not move. Saved as LX_SETTINGS.sharp: true | false,',
  '// or null = the default (off). _lxGetSettings is still in its TDZ here, so the boot read is direct (as LX_GFX does).',
  "function _lxSharpResolve(p) { return !!(p && typeof p.sharp === 'boolean' && p.sharp); }",
  'function _lxSharpUcap(p) { const u = Number(p && p.scale); return (u > 0.2) ? (u >= 3.999 ? 99 : u) : 2.0; }   // v0.30.1227 phone-sharp - the Resolution slider: a desktop\'s largest shown scale ("Fit" = no cap)',
  'let _LX_SHARP = false, _LX_SHARP_UCAP = 2.0;',
  "try { const _p = JSON.parse(localStorage.getItem('LX_SETTINGS') || 'null') || {}; _LX_SHARP = _lxSharpResolve(_p); _LX_SHARP_UCAP = _lxSharpUcap(_p); } catch (e) {}",
  'function _lxSharpDpr(dev) {',
  '  // v0.30.1227 phone-sharp - the scale the wrapper is really shown at: the window fit, and on the desktop layout the Resolution',
  '  // slider caps it too (the touch layout ignores that slider). Cached reads only: the governor calls this per frame.',
  '  const disp = _LX_IS_MOBILE ? _lxFitScale() : Math.min(_lxFitScale(), _LX_SHARP_UCAP);',
  '  return Math.min(3, Math.min(dev, 2) * disp);',
  '}',
  'function _lxSharpApply(s) {   // v0.30.1227 phone-sharp - from _applySettings: boot, every Settings change, Reset',
  '  const on = _lxSharpResolve(s), ucap = _lxSharpUcap(s);',
  '  const flipped = on !== _LX_SHARP, capMoved = on && ucap !== _LX_SHARP_UCAP;',
  '  _LX_SHARP = on; _LX_SHARP_UCAP = ucap;',
  '  if ((!flipped && !capMoved) || _LX_RSCALE != null) return;',
  '  let want = _lxTargetDpr();',
  "  if (typeof LX_DRS !== 'undefined' && (LX_DRS.active || LX_DRS.emerg)) want = Math.min(want, _LX_DPR);   // v0.30.1227 phone-sharp - a governed reduction holds; the governor gives it back",
  '  // v0.30.1227 phone-sharp - a flip applies at once; a Resolution-slider drag only past 5% (re-assigning canvas.width resets the context, see below)',
  '  const d = Math.abs(want - _LX_DPR) / Math.max(_LX_DPR, 0.001);',
  '  if (flipped ? d > 0.001 : d > 0.05) _lxApplyRenderScale(want);',
  '}',
  'function _lxTargetDpr() {'), '_lxTargetDpr head');
once('  return Math.min(_LX_IS_MOBILE ? 1 : 2, Math.max(1, dev * _lxFitScale()));', J(
  '  const _capped = Math.min(_LX_IS_MOBILE ? 1 : 2, Math.max(1, dev * _lxFitScale()));',
  '  return _LX_SHARP ? Math.max(_capped, _lxSharpDpr(dev)) : _capped;   // v0.30.1227 phone-sharp'), '_lxTargetDpr return');

// 2) the default, so Reset returns to it
once('  fxDmgNum: true,      // floating damage numbers', J(
  '  fxDmgNum: true,      // floating damage numbers',
  '  sharp: null,         // v0.30.1227 phone-sharp - Sharp Display: true | false | null (= the default, off)'), 'LX_SETTINGS_DEFAULTS');

// 3) Settings > Graphics: the switch (existing row + toggle markup), after the per-effect switches
once(J('    <div class="settings-row" style="display:none;">', '      <label>Low FX Mode</label>'), J(
  '    <!-- v0.30.1227 phone-sharp - Sharp Display: the canvas at the screen\'s own sharpness (see _lxSharpDpr). Off by default. -->',
  '    <div class="settings-row" id="set-sharp-row">',
  '      <label title="Draw the game at your screen\'s full sharpness, so text and edges on the game screen look crisp on phones and high-resolution screens. It draws more pixels every frame, so it uses more battery and graphics power: turn it off if the game stutters.">Sharp Display (uses more battery)</label>',
  '      <div class="ctrl" style="justify-content:flex-end;">',
  '        <div class="toggle" id="set-sharp" onclick="this.classList.toggle(\'on\'); applySettingsLive();"></div>',
  '      </div>',
  '    </div>',
  '    <div class="settings-row" style="display:none;">',
  '      <label>Low FX Mode</label>'), 'the hidden Low FX row');
once("    set('set-fx-dmgnum',  s.fxDmgNum  !== false);", J(
  "    set('set-fx-dmgnum',  s.fxDmgNum  !== false);",
  "    set('set-sharp', _lxSharpResolve(s));   // v0.30.1227 phone-sharp"), 'openSettingsModal switches');
once("    gfxBase: (typeof _lxGfxBase !== 'undefined') ? _lxGfxBase : 'high',", J(
  "    gfxBase: (typeof _lxGfxBase !== 'undefined') ? _lxGfxBase : 'high',",
  "    sharp: (() => { const e = document.getElementById('set-sharp'); return e ? e.classList.contains('on') : _LX_SHARP; })(),   // v0.30.1227 phone-sharp"), 'applySettingsLive gfxBase');
once('  _lxPerFrameSettingsSync(s);   // v0.30.287 perf — keep the frame-loop mirror fresh', J(
  '  _lxPerFrameSettingsSync(s);   // v0.30.287 perf — keep the frame-loop mirror fresh',
  '  try { _lxSharpApply(s); } catch (e) {}   // v0.30.1227 phone-sharp - Sharp Display re-sizes the backing store when it flips'), '_applySettings head');

const grew = s.length - n0;
if (grew < 3000 || grew > 7000) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: phone-sharp (+' + grew + ' chars)');
