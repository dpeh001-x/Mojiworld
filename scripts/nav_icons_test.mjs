// The U-panel jump row uses authored icon art, and every file actually decodes.
// Per user: "make sure that the world map quest codex mojidex are using custom
// icons if not please create those custom icons".
// Run: node scripts/nav_icons_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9193;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const failed404 = [];
page.on('response', (r) => { if (r.status() >= 400 && /Sprites\/ui\/nav\//.test(r.url())) failed404.push(r.url() + ' -> ' + r.status()); });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player.cls = 'archer';
  openLevelUpPanel();
  await wait(700);
  const jumps = [...document.querySelectorAll('#u-jump-row .u-jump')];
  const icons = jumps.map((b) => {
    const img = b.querySelector('img.uj-ico');
    const cs = img ? getComputedStyle(img) : null;
    return {
      key: b.dataset.ujump,
      isImg: !!img,
      src: img ? img.getAttribute('src') : null,
      // complete && naturalWidth>0 is the only honest "it decoded" test
      decoded: !!(img && img.complete && img.naturalWidth > 0),
      nw: img ? img.naturalWidth : 0,
      w: cs ? cs.width : null,
      stillEmoji: /[\u{1F300}-\u{1FAFF}]/u.test(b.textContent || ''),
    };
  });
  // the tutorial prompt should show the same art
  const tut = (typeof _tutTouchify === 'function')
    ? _tutTouchify('Unfold the map — press <kbd>W</kbd>') : '';
  return { count: jumps.length, icons, tutHasArt: /Sprites\/ui\/nav\/map\.webp/.test(tut), tut };
});

ok('the jump row still has all four buttons', out.count === 4, out.count + ' buttons');
ok('every button uses an <img>, not an emoji glyph',
   out.icons.every(i => i.isImg) && out.icons.every(i => !i.stillEmoji),
   out.icons.map(i => i.key + ':' + (i.isImg ? 'img' : 'EMOJI')).join(' '));
ok('all four point at Sprites/ui/nav/ art',
   out.icons.every(i => /^Sprites\/ui\/nav\/\w+\.webp$/.test(i.src || '')),
   out.icons.map(i => i.src).join(' '));
ok('all four DECODED (no broken/missing file)',
   out.icons.every(i => i.decoded), out.icons.map(i => i.key + ':' + i.nw + 'px').join(' '));
ok('they are sized for the row (20px)',
   out.icons.every(i => i.w === '20px'), out.icons.map(i => i.w).join(' '));
ok('no 404 was served for any nav icon', failed404.length === 0, failed404.join(' | ') || 'none');
ok('the tutorial prompt shows the same art', out.tutHasArt === true, out.tut);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
