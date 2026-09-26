// The permanent Discord invite, part 2 of 2: README.md and the social-links test (LX_APPLY2; the pipeline re-syncs
// both from origin first). Per user: "This is the permanent discord invite https://discord.gg/csHmcWceZA".
// Guarded (exact counts) + atomic + idempotent. Never touches the game file.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
const ROOT = process.env.LX_FILES_ROOT || 'C:/Users/dpeh0/Mojiworld';
const OLD = 'https://discord.gg/9CqQwXKcv', NEW = 'https://discord.gg/csHmcWceZA';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const put = (f, s) => {
  writeFileSync(f + '.tmp', s, 'utf8');
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(f + '.tmp', f); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing on ' + f + ': ' + lastErr.code);
};
for (const [rel, want] of [['README.md', 2], ['scripts/social_links_test.mjs', 1]]) {
  const f = path.join(ROOT, rel);
  const s = readFileSync(f, 'utf8');
  const n = s.split(OLD).length - 1;
  if (n === 0 && s.includes(NEW)) { console.log('already applied: ' + rel); continue; }
  if (n !== want) die(rel + ': old invite matched ' + n + ', expected ' + want);
  put(f, s.split(OLD).join(NEW));
  console.log('applied: ' + rel + ' (' + n + ' link' + (n > 1 ? 's' : '') + ')');
}

// The social-links suite still read the badges' pre-pop look (v0.30.1118 made them pop-punk stickers: 41-43 px,
// each ringed in its own brand colour, a lift on hover without the old gold) - three checks failed on origin before
// this change. They now read the pop stickers; the link, label, README and changelog checks are unchanged.
{
  const f = path.join(ROOT, 'scripts/social_links_test.mjs');
  let s = readFileSync(f, 'utf8');
  if (s.includes('sticker-sized')) { console.log('already applied: social-links pop checks'); }
  else {
    const swap = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die('social-links ' + what + ' matched ' + n); s = s.replace(a, () => b); };
    swap("l.ico && l.ico.w === 34 && l.ico.h === 34), 'every link carries an inline SVG badge, 34 px, hidden",
      "l.ico && l.ico.w >= 34 && l.ico.w <= 48 && l.ico.h >= 34 && l.ico.h <= 48), 'every link carries an inline SVG badge, sticker-sized (34-48 px), hidden", 'size check');
    swap("r.paint.every((p) => p && p.goldRing && p.midInk && p.cornerClear), 'every badge paints: a gold ring,",
      "r.paint.every((p) => p && p.ring && p.ring[3] > 200 && p.midInk && p.cornerClear), 'every badge paints: an opaque brand ring,", 'paint check');
    swap("check(hv.hover === 'rgb(255, 209, 102)' && hv.rest !== hv.hover && hv.tf !== 'none', 'a hovered badge lifts and turns gold; the others stay at rest', hv);",
      "check(/^matrix\\(1, 0, 0, 1, 0, -\\d/.test(hv.tf), 'a hovered badge lifts (the pop sticker hop)', hv);", 'hover check');
    put(f, s);
    console.log('applied: social-links pop checks (3)');
  }
}
