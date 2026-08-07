// Verify the two Archbishop skill icons load through the game's own icon path.
// The skill bar resolves Sprites/skills/<id>.png and silently falls back to the
// emoji when the file 404s or fails to decode — so a broken icon looks like a
// design choice rather than an error. This asserts the real load succeeded.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9031;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const net = [];
page.on('response', r => { if (/skills\/archbishop/.test(r.url())) net.push(`${r.status()} ${r.url().split('/').pop()}`); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

const R = await page.evaluate(async () => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  const IDS = ['archbishop_grail', 'archbishop_ult'];
  for (const id of IDS) {
    const s = (typeof SKILLS === 'object') ? SKILLS[id] : null;
    ok(`${id} is a real skill`, !!s, s ? `${s.name} · slot ${s.slot} · mp ${s.mp}` : 'missing from SKILLS');
  }
  // load exactly as _skillIconUrl does
  const load = (id) => new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ ok: true, w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve({ ok: false });
    im.src = 'Sprites/skills/' + id + '.png';
  });
  for (const id of IDS) {
    const r = await load(id);
    ok(`${id}.png loads`, r.ok, r.ok ? `${r.w}x${r.h}` : 'failed to load — bar would fall back to the emoji');
    ok(`${id}.png is 256x256`, r.ok && r.w === 256 && r.h === 256, r.ok ? `${r.w}x${r.h}` : '');
  }
  // the resolver itself must report success, not just the raw <img>
  if (typeof _skillIconUrl === 'function') {
    for (let i = 0; i < 40; i++) { IDS.forEach(id => _skillIconUrl(id)); await new Promise(r => setTimeout(r, 100));
      if (IDS.every(id => _skillIconUrl(id))) break; }
    for (const id of IDS) ok(`_skillIconUrl("${id}") resolves to the sprite`, !!_skillIconUrl(id), _skillIconUrl(id) || 'null → emoji fallback');
  }
  return res;
});

let pass = 0, fail = 0;
for (const r of R) {
  if (r.pass) { pass++; console.log(`  PASS  ${r.n}${r.extra ? '  (' + r.extra + ')' : ''}`); }
  else { fail++; console.log(`  FAIL  ${r.n}  ${r.extra}`); }
}
console.log(`\n${pass} passed, ${fail} failed`);
console.log('icon responses:', JSON.stringify([...new Set(net)]));
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(fail || errs.length ? 1 : 0);
