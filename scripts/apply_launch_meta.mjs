// Launch meta, game half (pre-launch infra audit #7 + #8, 2026-09-27). The repo half is apply_launch_meta_files.mjs.
// ============================================================================
// 1) A link to https://play.moji-studios.com/ pasted into Discord, X, iMessage or a search result showed a bare URL:
//    the page had no meta description, no Open Graph / Twitter card tags and no web app manifest (/manifest.webmanifest
//    and /robots.txt were 404). Now the <head> carries a description, og:title / og:description / og:url / og:type /
//    og:image (the title key art, streamed from jsDelivr like the rest of backgrounds/ - Pages does not ship that folder),
//    a twitter:card and a <link rel="manifest"> (the manifest itself + robots.txt are written by the repo half).
// 2) The dev lock icon (_lxDevLockIcon) sat on the public web for every player since v0.30.894 (it was put back for one
//    tester) - a visible door whose only lock is an unsalted SHA-256 in view-source. Now it shows on a developer surface
//    (localhost, the LAN, file://, or a browser already unlocked with its password) or when the URL carries ?devlock=1,
//    which is the tester's way in. The packaged Steam app is unchanged: never shown.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('<link rel="manifest" href="manifest.webmanifest">')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) share cards + manifest, right after the icons
const DESC = 'A 2D action-platformer RPG in your browser: four classes, roguelite loot, boss fights and drop-in co-op with a friend. No install, no account.';
const OG_IMG = 'https://cdn.jsdelivr.net/gh/dpeh001-x/Mojiworld@main/backgrounds/title_keyart_pop.webp';
once('<link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">', J(
  '<link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">',
  '<!-- v0.30.1180 launch-meta - SHARE CARDS + INSTALL MANIFEST (launch audit). A link to the game pasted into a chat app or',
  '     a search result showed a bare URL. These give it a title, one line and the title key art; og:image is absolute on',
  '     jsDelivr because Pages does not ship backgrounds/ (the deploy streams that folder from the same CDN). The manifest',
  '     and robots.txt sit at the repo root and ship with the site. -->',
  '<meta name="description" content="' + DESC + '">',
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="Mojiworld">',
  '<meta property="og:title" content="Mojiworld \u2014 The Everdawn Cycle">',
  '<meta property="og:description" content="' + DESC + '">',
  '<meta property="og:url" content="https://play.moji-studios.com/">',
  '<meta property="og:image" content="' + OG_IMG + '">',
  '<meta property="og:image:type" content="image/webp">',
  '<meta property="og:image:width" content="1920">',
  '<meta property="og:image:height" content="1072">',
  '<meta property="og:image:alt" content="Four chibi heroes on a hill above a castle town and a crystal spire at sunset">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<link rel="manifest" href="manifest.webmanifest">'), 'the apple-touch-icon link');

// 2) the dev lock: developer surfaces, or ?devlock=1 (the tester's path). Goes after the Steam line (never in the app).
if (s.split('    if (window.MOJI_PACKAGED === true) return;   // v0.30.894 dev-lock-web').length !== 2) die('the dev lock Steam guard moved');
once("    if (document.getElementById('lx-dev-lock')) return;", J(
  '    // v0.30.1180 launch-meta - not on the public web any more (launch audit: every player saw it). A developer surface -',
  '    // localhost, the LAN, file://, or a browser already unlocked with the password - keeps it as before; the tester opens',
  '    // the site once with ?devlock=1 to get it back (after the password that browser is a developer surface for good).',
  "    try { if (!_lxDevSurface() && !/[?&]devlock=1(?:&|$)/.test(location.search)) return; } catch (e) { return; }",
  "    if (document.getElementById('lx-dev-lock')) return;"), 'the dev lock re-install guard');

const grew = s.length - n0;
if (grew < 1500 || grew > 4500) die('size moved ' + grew);
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
console.log('applied: launch-meta game half (+' + grew + ' chars)');
