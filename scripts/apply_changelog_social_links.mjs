import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = process.env.LX_CHANGELOG_FILE || path.join(ROOT, 'CHANGELOG.html');
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }

// the header's support link grows into the four community links, each with its badge (inline, so the file stays self-contained)
const icon = (key) => readFileSync(path.join(ROOT, 'assets', 'social', key + '.svg'), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '').replace(/\s*\n\s*/g, ' ').replace(/>\s+</g, '><').trim()
  .replace(/ width="64" height="64"/, ' width="18" height="18" style="vertical-align:-4px;margin-right:4px;"')
  .replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true" focusable="false"');
const HL = '<a href="https://ko-fi.com/mojistudios" style="color:#c9a6ff;">&hearts; Support on Ko-fi</a>';
const links = [
  ['kofi', 'https://ko-fi.com/mojistudios', 'Support on Ko-fi'],
  ['discord', 'https://discord.gg/9CqQwXKcv', 'Discord'],
  ['instagram', 'https://www.instagram.com/mojistudios.official/', 'Instagram'],
  ['website', 'https://moji-studios.com', 'moji-studios.com'],
].map(([k, h, t]) => `<a href="${h}" style="color:#c9a6ff;text-decoration:none;white-space:nowrap;">${icon(k)}${t}</a>`).join(' &middot; ');
const hc = s.split(HL).length - 1;
if (hc === 1) s = s.replace(HL, links);
else if (!s.includes('href="https://discord.gg/9CqQwXKcv"')) { console.error('ABORT: header support link matched ' + hc); process.exit(1); }

const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill feat">feat</span> Discord, Instagram and the studio site join Ko-fi on the title screen, each with a cute badge</span></h2>',
  '<p>Per user: <em>&ldquo;Also put this in the links: https://discord.gg/9CqQwXKcv, https://www.instagram.com/mojistudios.official/, moji-studios.com. Make cute icons for all of them&rdquo;</em>.</p>',
  '<p><b>The change.</b> The one support line under the menu cards is now a row of four round badges &mdash; <b>Ko-fi, Discord, Instagram, Website</b> &mdash; each with its label under it. They are drawn in the menu cards&rsquo; own language: the same gold ring and soft gloss, the platform&rsquo;s colour inside, and a little face on each (a smiling mug with a heart rising from its steam, a sparkly-eyed Discord buddy, a camera smiling out of its lens with a like-heart sticker, a small blushing world). Hovering or tabbing to one lifts it, glows it gold and gives it a wiggle; reduced-motion keeps it still. Every link opens in a new tab without handing the game&rsquo;s window over (<code>rel="noopener noreferrer"</code>), and each names its service to screen readers.</p>',
  '<p><b>How they are made.</b> Hand-drawn SVG in <code>assets/social/</code>. The game carries them inline, so the row makes no extra request, cannot go missing from the portable zip and stays sharp at any render scale. They live in the title overlay, which is hidden with its animations off once play starts, so none of it runs during a fight. The README&rsquo;s support section shows the same four badges, and this changelog&rsquo;s header links all four.</p>',
  '<p><b>Fit.</b> The row is 33&nbsp;px taller than the old line. In the title panel&rsquo;s real compact layout it sits inside the gold frame with no scrolling down to 1280&times;680.</p>',
  '<p><b>Verified.</b> <code>scripts/social_links_test.mjs</code> &mdash; 15 checks against the real title screen: the row is in the menu below the cards; four links in order with exactly the four addresses; all open safely in a new tab; each names its service and shows its label; each badge is an inline 34&nbsp;px SVG that actually paints (gold ring, inked middle, clear corner); all are visible, hittable at their centres, inside the panel and not overlapping; no Patreon and no duplicate SVG ids; a hovered badge lifts and turns gold; at 1280&times;720 the whole row is visible without scrolling; the README shows all four badges and links; this header links all four; the poster generator still prints Ko-fi. <code>support_link_test.mjs</code> now forwards to it.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 9000 || grew > 22000) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
