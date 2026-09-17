// social-links: the files beside the game. Run by the ship chain AFTER they are re-synced from origin, so the edits land
// on origin's copies. Idempotent; exact-count anchors; LF/CRLF preserved; atomic writes.
//   README.md                    the support section shows the four badges (assets/social/*.svg) and all four links
//   scripts/support_link_test.mjs  becomes a forwarder to scripts/social_links_test.mjs
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };
const put = (F, s, crlf) => { writeFileSync(F + '.tmp', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8'); renameSync(F + '.tmp', F); };

{
  const rel = 'README.md', F = path.join(ROOT, rel); const raw = readFileSync(F, 'utf8'); const crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
  if (s.includes('discord.gg/9CqQwXKcv')) console.log(rel + ': already applied');
  else {
    const a = [
      '### ♥ Support the project',
      '',
      'Mojiworld is built in the open by one person. If you want to see it finished:',
      '**▶ https://ko-fi.com/mojistudios**',
    ].join('\n');
    const b = [
      '### ♥ Support the project',
      '',
      'Mojiworld is built in the open by one person. If you want to see it finished, or just come say hi:',
      '',
      '<a href="https://ko-fi.com/mojistudios"><img src="assets/social/kofi.svg" width="48" alt="Ko-fi"></a>&nbsp;',
      '<a href="https://discord.gg/9CqQwXKcv"><img src="assets/social/discord.svg" width="48" alt="Discord"></a>&nbsp;',
      '<a href="https://www.instagram.com/mojistudios.official/"><img src="assets/social/instagram.svg" width="48" alt="Instagram"></a>&nbsp;',
      '<a href="https://moji-studios.com"><img src="assets/social/website.svg" width="48" alt="Moji Studios website"></a>',
      '',
      '**▶ Ko-fi:** https://ko-fi.com/mojistudios &nbsp;·&nbsp; **Discord:** https://discord.gg/9CqQwXKcv',
      '**▶ Instagram:** https://www.instagram.com/mojistudios.official/ &nbsp;·&nbsp; **Website:** https://moji-studios.com',
    ].join('\n');
    const c = s.split(a).length - 1; if (c !== 1) abort(`${rel}: support section matched ${c}, expected 1`);
    s = s.replace(a, b); put(F, s, crlf); console.log(rel + ': support section shows the four badges and links');
  }
}
{
  const rel = 'scripts/support_link_test.mjs', F = path.join(ROOT, rel); const raw = readFileSync(F, 'utf8');
  if (raw.includes('social_links_test.mjs')) console.log(rel + ': already applied');
  else {
    put(F, [
      '// The Ko-fi support link became one of four community badges (social-links). This name is kept so nothing that',
      '// calls it breaks; the checks live in scripts/social_links_test.mjs.',
      "import './social_links_test.mjs';",
      '',
    ].join('\n'), raw.includes('\r\n'));
    console.log(rel + ': now forwards to social_links_test.mjs');
  }
}
