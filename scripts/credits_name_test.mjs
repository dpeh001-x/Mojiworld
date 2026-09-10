// The end-credits roll names DADPEH, and the old name is gone everywhere.
// ============================================================================
// Per user: "change Dr Daryl Peh at the end credits to DADPEH".
//
// The credit roll is built by string concatenation inside _showGameComplete(),
// so a source grep alone would not prove the text reaches the page. This calls
// the real function and reads the rendered overlay.
//
//   1. the two "name" lines under Created & Directed by / Design·Story·Art·Code
//      read exactly DADPEH
//   2. the closing small line reads "— Moji-Studios · DADPEH —"
//   3. nothing anywhere in the overlay still says "Daryl"
//   4. CONTROL: Moji-Studios survives — the replace was scoped to the person,
//      not the studio, and both share those lines
//   5. file-wide: "Daryl" appears nowhere in mojiworld_game.html (the header
//      comment, the meta copyright tag and the loading-screen copy already
//      said DADPEH; the credits were the last holdout, and this keeps them
//      from drifting apart again)
// Run: node scripts/credits_name_test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

const src = readFileSync(path.join(ROOT, FILE), 'utf8');
ok('the old name appears nowhere in the game file', !src.includes('Daryl'),
   src.includes('Daryl') ? (src.split('Daryl').length - 1) + ' occurrences left' : 'clean');

const PORT = Number(process.env.PORT || 11301);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => typeof _showGameComplete === 'function', null, { timeout: 60000 });
await page.waitForTimeout(2000);

const R = await page.evaluate(() => {
  try { _showGameComplete(); } catch (e) { return { err: String(e.message).slice(0, 120) }; }
  const ov = document.getElementById('game-complete-overlay');
  if (!ov) return { err: 'overlay not created' };
  const names = [...ov.querySelectorAll('#gc-roll .name')].map((n) => n.textContent.trim());
  const small = [...ov.querySelectorAll('#gc-roll .small')].map((n) => n.textContent.trim());
  const text = ov.textContent || '';
  return { names, small, hasOld: /Daryl/i.test(text), hasStudio: text.includes('Moji-Studios'), len: text.length };
});
await browser.close(); server.kill();

if (R.err) ok('the credits overlay rendered', false, R.err);
else {
  console.log(`  name lines: ${JSON.stringify(R.names)}`);
  console.log(`  closing line: ${JSON.stringify(R.small)}`);
  ok('both credited name lines read DADPEH',
     R.names.filter((n) => n === 'DADPEH').length === 2, JSON.stringify(R.names));
  ok('the closing line credits Moji-Studios and DADPEH',
     R.small.some((t) => t.includes('DADPEH') && t.includes('Moji-Studios')), JSON.stringify(R.small));
  ok('the rendered credits never say the old name', R.hasOld === false);
  ok('CONTROL: Moji-Studios is untouched (it shares those lines)', R.hasStudio === true);
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
