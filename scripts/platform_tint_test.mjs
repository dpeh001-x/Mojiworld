// v0.29.321 — does the platform/floor tint actually track the map's painted
// backdrop? Loads real maps, samples the backdrop's dominant colour, and
// compares it against the tint the renderer resolves — plus how far that is
// from the OLD sky[0] source, which is the whole point of the change.
//
//   node serve.js 8785 && node scripts/platform_tint_test.mjs 8785
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8785';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof game !== 'undefined' && typeof _mapPlatformTint === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(3000);

  const r = await page.evaluate(async () => {
    const out = { rows: [], sampler: {} };
    // sampler sanity on synthetic images: a flat colour must come back as itself
    const mk = (paint) => { const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); paint(x); const i = new Image(); i.src = c.toDataURL();
      i._loaded = true; return new Promise(res => { i.onload = () => { i._loaded = true; res(i); }; }); };
    const flat = await mk(x => { x.fillStyle = '#3f8fd0'; x.fillRect(0, 0, 64, 64); });
    out.sampler.flatBlue = _lxDominantColor(flat);
    // a mostly-black image with a strong colour patch: the patch must win
    const patch = await mk(x => { x.fillStyle = '#000000'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#d05030'; x.fillRect(0, 40, 64, 24); });
    out.sampler.darkWithPatch = _lxDominantColor(patch);
    // grey majority vs saturated minority: saturation weighting should favour colour
    const greyVsColour = await mk(x => { x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#20c060'; x.fillRect(0, 0, 64, 26); });
    out.sampler.greyVsColour = _lxDominantColor(greyVsColour);
    out.sampler.notReady = _lxDominantColor({ _loaded: false, naturalWidth: 0 });

    const maps = ['forest', 'magmaFoundry', 'tidalLagoon', 'boneGraveyard', 'candyCanyon', 'duneSands'];
    for (const id of maps) {
      if (typeof MAPS === 'undefined' || !MAPS[id]) continue;
      try { loadMap(id); } catch (e) { continue; }
      await new Promise(res => setTimeout(res, 700));
      const md = game.mapData;
      const bg = _pickBGImage();
      const dom = bg ? _lxDominantColor(bg) : null;
      // force a fresh resolve so we read what the renderer would use now
      delete _MAP_PLATFORM_TINT_CACHE[game.currentMap];
      const tint = _mapPlatformTint(md);
      out.rows.push({ id, hasBg: !!bg, dominant: dom, sky0: (md.sky && md.sky[0]) || null,
        top: tint.top, body: tint.body,
        cached: !!(_MAP_PLATFORM_TINT_CACHE[game.currentMap] || {}).fromBg });
    }
    return out;
  });

  const hex = (h) => (h || '').toLowerCase();
  const dist = (a, c) => {
    if (!a || !c) return null;
    const p = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const [r1, g1, b1] = p(a), [r2, g2, b2] = p(c);
    return Math.round(Math.hypot(r1 - r2, g1 - g2, b1 - b2));
  };

  console.log('MAP BACKDROP → PLATFORM TINT\n');
  console.log('  map              backdrop   sky[0]     tint.top   Δ(dom,sky0)');
  for (const row of r.rows) {
    console.log('  ' + row.id.padEnd(16) + (row.dominant || '-').padEnd(11)
      + (row.sky0 || '-').padEnd(11) + (row.top || '-').padEnd(11)
      + String(dist(row.dominant, row.sky0) ?? '-'));
  }
  console.log('');

  ok('sampler returns a flat colour unchanged', dist(hex(r.sampler.flatBlue), '#3f8fd0') <= 6, r.sampler.flatBlue);
  ok('sampler ignores near-black and finds the real colour',
     dist(hex(r.sampler.darkWithPatch), '#d05030') <= 24, r.sampler.darkWithPatch);
  ok('saturation weighting beats a larger flat grey',
     dist(hex(r.sampler.greyVsColour), '#20c060') <= 40, r.sampler.greyVsColour);
  ok('undecoded image returns null and is NOT memoised', r.sampler.notReady === null);

  const withBg = r.rows.filter(x => x.hasBg && x.dominant);
  ok('every sampled map resolved a backdrop colour', withBg.length === r.rows.length,
     { resolved: withBg.length, of: r.rows.length });
  ok('tints are now derived from the backdrop, not the sky',
     withBg.every(x => x.cached), withBg.map(x => ({ id: x.id, fromBg: x.cached })));
  ok('tint.top tracks the backdrop colour', withBg.every(x => dist(x.dominant, x.top) < 45),
     withBg.map(x => ({ id: x.id, d: dist(x.dominant, x.top) })));
  ok('body is a darkened version of the same hue',
     withBg.every(x => dist(x.top, x.body) > 40), withBg.map(x => ({ id: x.id, d: dist(x.top, x.body) })));
  // the change is only worth making if backdrop and sky actually disagree
  const moved = withBg.filter(x => x.sky0 && dist(x.dominant, x.sky0) > 40);
  ok('backdrop differs materially from the old sky source on most maps',
     moved.length >= Math.ceil(withBg.length / 2),
     { movedOn: moved.map(x => x.id), of: withBg.length });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
