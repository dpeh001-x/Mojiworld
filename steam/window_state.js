// Window state + the desktop fullscreen keys for the Electron shell (final polish audit U1). Kept out of main.js so
// it stays testable in plain Node, like static_server.js and launch_args.js - see test_window_state.mjs.
//
// Before this, the window always opened at 1280x800 wherever the OS put it, forgot a resize, a move and fullscreen
// on every launch, and Alt+Enter / F11 did nothing.
'use strict';
const fs = require('fs');

const DEFAULT = { width: 1280, height: 800 };   // Steam Deck native
const MIN = { width: 960, height: 560 };

// The saved state, sanitised: anything unreadable or out of range falls back to the default size, never throws.
function loadState(file) {
  let s = null;
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { s = null; }
  const out = { width: DEFAULT.width, height: DEFAULT.height, maximized: false, fullscreen: false };
  if (!s || typeof s !== 'object') return out;
  if (Number.isFinite(s.width) && Number.isFinite(s.height)) {
    out.width = Math.min(16384, Math.max(MIN.width, Math.round(s.width)));
    out.height = Math.min(16384, Math.max(MIN.height, Math.round(s.height)));
  }
  if (Number.isFinite(s.x) && Number.isFinite(s.y)) { out.x = Math.round(s.x); out.y = Math.round(s.y); }
  out.maximized = s.maximized === true;
  out.fullscreen = s.fullscreen === true;
  return out;
}

// A saved position is used only while the title bar would still land on a display (a monitor may have been
// unplugged since). areas: the displays' work areas, [{ x, y, width, height }].
function onScreen(st, areas) {
  if (!st || !Number.isFinite(st.x) || !Number.isFinite(st.y)) return false;
  const px = st.x + 100, py = st.y + 16;   // a point on the title bar, clear of the corner
  return (areas || []).some((a) => a && px >= a.x && py >= a.y && px < a.x + a.width && py < a.y + a.height);
}

// What to remember about a live window: its normal (un-maximized, windowed) bounds plus the two modes.
function snapshot(win) {
  const b = win.getNormalBounds ? win.getNormalBounds() : win.getBounds();
  return { x: b.x, y: b.y, width: b.width, height: b.height, maximized: !!win.isMaximized(), fullscreen: !!win.isFullScreen() };
}

// Written through a temp file, so a crash mid-write cannot leave half a JSON behind.
function saveState(file, snap) {
  try {
    fs.writeFileSync(file + '.tmp', JSON.stringify(snap));
    fs.renameSync(file + '.tmp', file);
    return true;
  } catch (e) { return false; }
}

// Alt+Enter and F11 toggle fullscreen - the two keys a PC player reaches for. Key-down only, no auto-repeat, and
// not with Ctrl / Meta (Ctrl+Alt+Enter belongs to someone else).
function isFullscreenKey(input) {
  if (!input || input.type !== 'keyDown' || input.isAutoRepeat) return false;
  if (input.key === 'F11') return !input.alt && !input.control && !input.meta;
  return input.key === 'Enter' && !!input.alt && !input.control && !input.meta;
}

// v0.30.1744 release15 - fractional display scaling (125 / 150 / 175 %) makes Electron's DIP <-> pixel round trip lossy: a window opened at
// 1000x600 @100,50 reads back 1005x605 @99,49 (setBounds and useContentSize round the same way), and saving that read-back grew
// the window ~5 px and slid it up-left on EVERY launch. A read-back within DRIFT px of what the window was opened with is that
// rounding, not the player, so the opened values are kept. Size and position are judged apart: a real move still saves while
// the size stays put, and the other way round. asked: { width, height, x?, y? } as passed to the BrowserWindow (null = nothing
// restored, the read-back stands).
const DRIFT = 8;
function settle(asked, snap, tol) {
  if (!asked || !snap) return snap;
  const t = Number.isFinite(tol) ? tol : DRIFT;
  const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
  const out = Object.assign({}, snap);
  if (near(asked.width, snap.width) && near(asked.height, snap.height)) { out.width = asked.width; out.height = asked.height; }
  if (near(asked.x, snap.x) && near(asked.y, snap.y)) { out.x = asked.x; out.y = asked.y; }
  return out;
}

module.exports = { DEFAULT, MIN, DRIFT, loadState, onScreen, snapshot, settle, saveState, isFullscreenKey };
