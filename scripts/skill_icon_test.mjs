// The desktop skill bar must show authored sprites, not emoji fallbacks.
//
//   node serve.js 8862 && node scripts/skill_icon_test.mjs 8862 [page]
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
const PORT = process.argv[2] || '8862';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const onDisk = new Set(readdirSync('Sprites/skills').filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)));
ok('the authored sprites exist on disk as .webp', onDisk.size > 50, { count: onDisk.size });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
const net = [];
page.on('response', r => { if (/Sprites\/skills\//.test(r.url())) net.push({ s: r.status(), f: r.url().split('/').pop() }); });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try {
  return typeof eval('renderSkillBar') === 'function' && typeof eval('_skillIconUrl') === 'function' && !!eval('player');
} catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(async () => {
  const p = eval('player');
  p.cls = p.cls || 'warrior';
  const render = eval('renderSkillBar');
  render();
  // The loader is async: the first render kicks off the probes, so give the
  // images a chance to decode before asking what the bar looks like.
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    await new Promise(res => setTimeout(res, 120));
    render();
    const slots = [...document.querySelectorAll('#skill-bar .skill-icon, .skill-slot .skill-icon')];
    if (slots.filter(e => e.dataset && e.dataset.skIco).length >= 4) break;
  }
  render();
  const slots = [...document.querySelectorAll('#skill-bar .skill-icon, .skill-slot .skill-icon')];
  const detail = slots.map(e => ({
    id: (e.dataset && e.dataset.skIco) || null,
    bg: (e.style.backgroundImage || '').replace(/^url\(["']?|["']?\)$/g, ''),
    text: (e.textContent || '').trim(),
  }));
  return {
    total: slots.length,
    withSprite: detail.filter(d => d.id).length,
    stillEmoji: detail.filter(d => !d.id && d.text).map(d => d.text),
    sample: detail.filter(d => d.id).slice(0, 4),
    probe: eval('_skillIconUrl')('powerStrike'),
  };
});

ok('the skill bar rendered slots at all', r.total > 0, { slots: r.total });
ok('ICONS LOAD: most slots now carry a sprite, not an emoji',
   r.withSprite >= Math.max(3, Math.floor(r.total * 0.5)), { withSprite: r.withSprite, of: r.total, stillEmoji: r.stillEmoji });
ok('the sprite URLs are .webp (the bug was a .png probe)',
   r.sample.length > 0 && r.sample.every(d => /\.webp$/.test(d.bg)), r.sample);
ok('_skillIconUrl resolves a known skill to its .webp',
   r.probe === 'Sprites/skills/powerStrike.webp', { probe: r.probe });
ok('the browser really fetched them, with no 404s',
   net.some(x => x.s === 200) && !net.some(x => x.s === 404),
   { ok200: net.filter(x => x.s === 200).length, notFound: net.filter(x => x.s === 404).slice(0, 4) });
ok('nothing requested a .png skill sprite any more',
   !net.some(x => /\.png$/.test(x.f)), net.filter(x => /\.png$/.test(x.f)).slice(0, 4));
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
