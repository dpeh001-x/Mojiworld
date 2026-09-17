// kofi: the files beside the game that pointed at Patreon. Run by the ship chain AFTER they are re-synced from origin,
// so the edits land on origin's copies. Idempotent; exact-count anchors; LF/CRLF preserved; atomic writes.
//   README.md                              the "Support the project" link
//   scripts/gen_monster_contact_sheet.mjs  the promo poster's footer (so the next poster carries the right page)
//   scripts/patreon_link_test.mjs          becomes a forwarder to scripts/support_link_test.mjs
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };
const put = (F, s, crlf) => { writeFileSync(F + '.tmp', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8'); renameSync(F + '.tmp', F); };
const patch = (rel, edits) => {
  const F = path.join(ROOT, rel); const raw = readFileSync(F, 'utf8'); const crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
  if (s.includes('ko-fi.com/mojistudios')) { console.log(rel + ': already applied'); return; }
  for (const [label, a, b] of edits) { const c = s.split(a).length - 1; if (c !== 1) abort(`${rel} / ${label}: matched ${c}, expected 1`); s = s.replace(a, b); }
  if (/patreon\.com/i.test(s)) abort(rel + ': a patreon.com URL survives');
  put(F, s, crlf); console.log(rel + ': patched (' + edits.length + ' edits)');
};

patch('README.md', [
  ['support link', '**▶ https://www.patreon.com/c/Mojiworld**', '**▶ https://ko-fi.com/mojistudios**'],
]);
patch('scripts/gen_monster_contact_sheet.mjs', [
  ['header note', 'The sheet carries the play link and the Patreon link in its footer', 'The sheet carries the play link and the Ko-fi link in its footer'],
  ['footer', 'Support the project &middot; <b>patreon.com/c/Mojiworld</b>', 'Support the project &middot; <b>ko-fi.com/mojistudios</b>'],
]);
{
  const rel = 'scripts/patreon_link_test.mjs', F = path.join(ROOT, rel);
  const raw = readFileSync(F, 'utf8');
  if (raw.includes('support_link_test.mjs')) console.log(rel + ': already applied');
  else {
    put(F, [
      '// The support link moved from Patreon to Ko-fi (kofi). This name is kept so nothing that calls it breaks;',
      '// the checks live in scripts/support_link_test.mjs.',
      "import './support_link_test.mjs';",
      '',
    ].join('\n'), raw.includes('\r\n'));
    console.log(rel + ': now forwards to support_link_test.mjs');
  }
}
