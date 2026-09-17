// The support link moves from Patreon to Ko-fi.
// ============================================================================
// Per user: "remove the patreon link and change it to https://ko-fi.com/mojistudios".
// The title screen's one support line (v0.30.445) keeps its place, weight and safety attributes; only where it
// points and what it says change. The README, the changelog header and the promo-poster footer are moved by
// scripts/apply_kofi_files.mjs and the changelog script, so no live Patreon link is left anywhere the project owns.
// Guarded + atomic + idempotent. ASCII-only anchors.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) kofi/.test(s)) { console.log('already applied'); process.exit(0); }
const EOL = ((s.match(/\r\n/g) || []).length > (s.match(/\n/g) || []).length / 2) ? '\r\n' : '\n';
const sub = (label, a, b) => { const c = s.split(a).length - 1; if (c !== 1) { console.error(`ABORT ${label}: matched ${c}, expected 1`); process.exit(1); } s = s.split(a).join(b); };

sub('comment', '        <a class="lo-support" id="lo-support" href="https://www.patreon.com/c/Mojiworld"',
  '        <!-- v0.30.822 kofi - per user: the support page is Ko-fi now (https://ko-fi.com/mojistudios), not Patreon. Same line,' + EOL +
  '             same place, same rel/target; only the destination and the label moved. -->' + EOL +
  '        <a class="lo-support" id="lo-support" href="https://www.patreon.com/c/Mojiworld"');
sub('href', 'href="https://www.patreon.com/c/Mojiworld"', 'href="https://ko-fi.com/mojistudios"');
sub('label', 'Support Mojiworld on Patreon</a>', 'Support Mojiworld on Ko-fi</a>');
if (/patreon\.com/i.test(s)) { console.error('ABORT: a patreon.com URL survives in the game file'); process.exit(1); }

const grew = s.length - n0;
if (grew < 150 || grew > 600) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: kofi - the title-screen support link points at ko-fi.com/mojistudios (+${grew})`);
