// The talent picker must show authored ludo.ai art, not emoji — and must fall
// back to the emoji for any talent whose art is missing.
//
//   node serve.js 8880 && node scripts/talent_icon_test.mjs 8880 [page]
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
const PORT = process.argv[2] || '8880';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const onDisk = new Set(readdirSync('Sprites/talents').filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)));

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
const net = [];
page.on('response', r => { if (/Sprites\/talents\//.test(r.url())) net.push({ s: r.status(), f: r.url().split('/').pop() }); });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try {
  return typeof eval('JOB_TALENTS') === 'object' && typeof eval('_talentIconHtml') === 'function';
} catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(async () => {
  const JT = eval('JOB_TALENTS'), p = eval('player');
  const ids = Object.values(JT).flat().map(t => t.id);
  const jobs = Object.keys(JT);

  // Render every talent's icon into the DOM so the browser really fetches them.
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute; left:-9999px; top:0';
  document.body.appendChild(host);
  host.innerHTML = Object.values(JT).flat()
    .map(t => eval('_talentIconHtml')(t.id, t.icon, 40)).join('');
  const imgs = [...host.querySelectorAll('img')];
  await Promise.all(imgs.map(i => i.decode().catch(() => null)));
  const decoded = imgs.filter(i => i.naturalWidth > 0).length;

  // Drive the REAL picker for a job and read what the card actually contains.
  p.job = 'knight'; p.talents = {};
  window._prologueActive = false;
  let modal = null;
  try {
    eval('openTalentPick')();
    const opts = document.getElementById('advancement-options');
    const cards = [...opts.querySelectorAll('.class-card')];
    await Promise.all([...opts.querySelectorAll('img')].map(i => i.decode().catch(() => null)));
    modal = cards.map(c => {
      const im = c.querySelector('img');
      return {
        name: (c.textContent.match(/Bulwark|Crusade|Lifewall/) || [])[0] || null,
        hasImg: !!im, src: im && im.getAttribute('src'),
        imgDecoded: !!(im && im.naturalWidth > 0),
        // the emoji sibling must exist but stay hidden while the art works
        glyphHidden: (() => { const s = im && im.nextElementSibling; return !!s && s.style.display === 'none'; })(),
      };
    });
    document.getElementById('advancement-modal').style.display = 'none';
    eval('game').paused = false;
  } catch (e) { modal = 'THREW: ' + String(e).slice(0, 120); }

  // A talent with NO art must still show its emoji.
  const fake = eval('_talentIconHtml')('__nope__', '🛡️', 40);
  host.innerHTML = fake;
  const fi = host.querySelector('img');
  await new Promise(res => { if (!fi) return res(); fi.addEventListener('error', res, { once: true }); setTimeout(res, 3000); });
  const fallback = { imgHidden: fi && fi.style.display === 'none',
                     glyphShown: (() => { const s = fi && fi.nextElementSibling; return !!s && s.style.display === 'inline-block' && s.textContent.trim().length > 0; })() };

  return { ids, jobs, total: ids.length, decoded, modal, fallback };
});

ok('every talent id has authored art on disk',
   r.ids.every(id => onDisk.has(id)), { missing: r.ids.filter(id => !onDisk.has(id)), have: onDisk.size, need: r.total });
ok('all 27 icons decode in the browser', r.decoded === r.total, { decoded: r.decoded, of: r.total });
// `__nope__` is this test's own synthetic miss, deliberately requested below to
// prove the emoji fallback fires. It MUST 404, so excluding it is the point.
const real404 = net.filter(x => x.s === 404 && !/^__nope__/.test(x.f));
ok('no 404 for any real talent icon', real404.length === 0, real404.slice(0, 5));
ok('the picker built its three cards', Array.isArray(r.modal) && r.modal.length === 3, r.modal);
ok('CUSTOM ART: each card shows an <img>, not an emoji glyph',
   Array.isArray(r.modal) && r.modal.every(c => c.hasImg && /Sprites\/talents\/.+\.webp$/.test(c.src)), r.modal);
ok('the art in the cards actually decoded',
   Array.isArray(r.modal) && r.modal.every(c => c.imgDecoded), r.modal);
ok('the emoji sibling stays hidden while the art works',
   Array.isArray(r.modal) && r.modal.every(c => c.glyphHidden), r.modal);
ok('FALLBACK: a talent with no art still shows its emoji',
   r.fallback.imgHidden === true && r.fallback.glyphShown === true, r.fallback);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
