// The 83 area icons, pop punk and accurate (final polish, region-pop). Per user: "regenerate the 83 area icons in pop punk style
// and make sure they are accurate (the maps should match the monsters in it)", naming Sauro Slope's green dinosaur as the example.
// Held: every map id with a region icon (WM_REGION_ICON_IDS) plus verdantHaven has its file, 256x256, with real content and nothing on
// the border (no cut-offs); every one has a brief in scripts/region_icon_briefs.json; and the icon the game loads for Sauro Slope is
// the new art (not byte-identical to the dinosaur it replaced) and decodes in the game, on the world map path.
//   node scripts/region_icons_pop_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const sharp = require('sharp'); sharp.cache(false);
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9949);
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${c ? '' : JSON.stringify(x).slice(0, 260)}`); };
const briefs = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'region_icon_briefs.json'), 'utf8'));
const DIR = path.join(ROOT, 'Sprites', 'world', 'regions');
const bad = [];
for (const id of Object.keys(briefs)) {
  const f = path.join(DIR, id + '.webp');
  if (!fs.existsSync(f)) { bad.push(id + ' missing'); continue; }
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let edge = 0, opaque = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const a = data[(y * info.width + x) * 4 + 3]; if (a > 40) { opaque++; if (x < 2 || y < 2 || x >= info.width - 2 || y >= info.height - 2) edge++; } }
  if (info.width !== 256 || info.height !== 256) bad.push(`${id} ${info.width}x${info.height}`);
  if (edge > 0) bad.push(`${id} touches the border (${edge}px)`);
  if (opaque < 256 * 256 * 0.2) bad.push(`${id} nearly empty`);
}
ok(`all ${Object.keys(briefs).length} briefed area icons exist at 256x256 with real content and nothing cut off`, bad.length === 0, bad.slice(0, 6));
// the Sauro Slope dinosaur (the user's example) is gone
const DINO_SHA1 = 'f11db5b43cefa267a442490c9b8fffa4ca71f5ea';   // Sprites/world/regions/sauroSlope.webp as of v0.30.1273
const sauroSha = crypto.createHash('sha1').update(fs.readFileSync(path.join(DIR, 'sauroSlope.webp'))).digest('hex');
ok("Sauro Slope's icon is the new art, not the green dinosaur", sauroSha !== DINO_SHA1 && /fire lizard/.test(briefs.sauroSlope) && /volcanic/.test(briefs.sauroSlope), { sauroSha });
// in the game: every WM_REGION_ICON_IDS entry has a brief, and the icons decode through the world-map path
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
const miss = []; page.on('response', (r) => { if (r.status() >= 400 && /world\/regions\//.test(r.url())) miss.push(r.url().split('/').pop()); });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof WM_REGION_ICON_IDS !== 'undefined', null, { timeout: 180000 });
const r = await page.evaluate(async () => {
  const ids = [...WM_REGION_ICON_IDS];
  const res = await Promise.all(ids.map((id) => new Promise((ok) => { const im = new Image(); im.onload = () => ok([id, im.naturalWidth]); im.onerror = () => ok([id, 0]); im.src = 'Sprites/world/regions/' + id + '.webp'; })));
  return { ids, broken: res.filter(([, w]) => !w).map(([id]) => id) };
});
await browser.close(); server.kill();
ok('every map the world map draws an icon for has a brief', r.ids.every((id) => briefs[id]), r.ids.filter((id) => !briefs[id]));
ok('every region icon decodes in the game', r.broken.length === 0 && miss.length === 0, { broken: r.broken, miss });
ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
