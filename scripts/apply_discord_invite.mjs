// The title screen's Discord link moves to the permanent invite (pre-launch audit, 2026-09-27).
// ============================================================================
// The pre-launch audit found the Discord invite 9CqQwXKcv expires 2026-10-16 - every community link (title menu,
// README, changelog header) would die three weeks after launch. Per user: "This is the permanent discord invite
// https://discord.gg/csHmcWceZA" (checked: expires_at null, Moji-studios's server).
// This half edits the game file; apply_discord_invite_files.mjs edits README.md and the social-links test.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const OLD = 'https://discord.gg/9CqQwXKcv', NEW = 'https://discord.gg/csHmcWceZA';
if (s.includes('href="' + NEW + '"') && !s.includes(OLD)) { console.log('already applied'); process.exit(0); }
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

once('<a class="lo-link" id="lo-discord" href="' + OLD + '"',
  '<!-- v0.30.1173 discord-invite: the permanent invite (the old one expired 2026-10-16) -->' +
  '<a class="lo-link" id="lo-discord" href="' + NEW + '"', 'title-menu Discord link');
if (s.includes(OLD)) die('old invite still present elsewhere');

const grew = s.length - n0;
if (grew < 40 || grew > 200) die('moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: discord-invite (+' + grew + ' chars)');
