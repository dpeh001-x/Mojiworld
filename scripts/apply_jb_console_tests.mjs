// jb-console: the jukebox window is a DJ console now, with its own body - it no longer wears the Persona plate.
// ui_panel_plates_test.mjs checks every plated window; the jukebox leaves its list (its plate file stays on disk,
// unused). Run by the ship chain AFTER the file is re-synced from origin. Idempotent; exact-count anchors; LF/CRLF kept.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = process.env.LX_TESTS_DIR || path.dirname(fileURLToPath(import.meta.url));
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };
const patch = (name, edits) => {
  const F = path.join(DIR, name); const raw = readFileSync(F, 'utf8'); const crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
  if (s.includes('jb-console')) { console.log(name + ': already applied'); return; }
  for (const [label, a, b] of edits) { const c = s.split(a).length - 1; if (c !== 1) abort(name + ' / ' + label + ': matched ' + c + ', expected 1'); s = s.replace(a, b); }
  writeFileSync(F + '.tmp', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8'); renameSync(F + '.tmp', F); console.log(name + ': patched (' + edits.length + ' edits)');
};
patch('ui_panel_plates_test.mjs', [
  ['panel', " tutorial: '#tutorial-modal > .modal', jukebox: '#jukebox-modal', backup: '#backup-modal',",
    " tutorial: '#tutorial-modal > .modal', backup: '#backup-modal',   // (jb-console: the jukebox is a DJ console with its own body now, no plate)"],
  ['themed', "const THEMED = new Set(['mojidex', 'tutorial', 'jukebox', 'backup', 'powerup', 'sage']);",
    "const THEMED = new Set(['mojidex', 'tutorial', 'backup', 'powerup', 'sage']);"],
]);
