// Live test: the ZODIAC SANCTUM sign is a baked plaque, not a stroked box.
//   node scripts/zodiac_sign_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const src = readFileSync(GAME, 'utf8');
ok('the old stroked box is gone from the star draw path',
  !src.includes("ctx.strokeRect(cx - tw/2, cy + 22, tw, 14);") && src.includes('const _zs = _zodiacSignSprite();'), '');
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _zodiacSignSprite === 'function', null, { timeout: 120000 });
const r = await page.evaluate(() => {
  const a = _zodiacSignSprite(), b2 = _zodiacSignSprite();
  const c = a.getContext('2d');
  const px = (x, y) => Array.from(c.getImageData(x, y, 1, 1).data);
  // the star arms are thin and anti-aliased; scan its box for any gold pixel
  let gold = [0,0,0,0]; for (let y = 14; y <= 26 && !(gold[0] > 220); y++) for (let x = 33; x <= 45; x++) { const q = px(x, y); if (q[0] > 220 && q[1] > 170 && q[2] < 140) { gold = q; break; } }
  const border = px(8, 20);               // outer border, left edge (violet end)
  const body = px(116, 12);               // inside the body, above the text
  // text band: scan the middle row for bright warm pixels
  let warm = 0; for (let x = 60; x < 172; x++) { const p = px(x, 20); if (p[0] > 200 && p[1] > 170 && p[3] > 200) warm++; }
  return { same: a === b2, w: a.width, h: a.height, gold, border, body, warm,
    dataUrl: a.toDataURL('image/png') };
});
ok('bakes once (cached canvas, 232x40)', r.same && r.w === 232 && r.h === 40, { w: r.w, h: r.h });
ok('a gold star sits at the left ornament', r.gold[0] > 220 && r.gold[1] > 180 && r.gold[2] < 160, r.gold);
ok('the border edge is violet-tinted', r.border[2] > r.border[1] && r.border[3] > 120, r.border);
ok('the body is a dark violet, not black', r.body[2] > r.body[0] && r.body[2] > 30 && r.body[0] < 90, r.body);
ok('the title band carries cream/gold text pixels', r.warm > 40, r.warm);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
if (process.env.ZS_PNG) { const { writeFileSync } = await import('node:fs'); writeFileSync(process.env.ZS_PNG, Buffer.from(r.dataUrl.split(',')[1], 'base64')); }
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
