// Pause/Settings panel: Persona pass + fit. Proves the truncation fix (the
// report's screenshot had the top row clipped with no scrollbar), the
// generated background actually ships and decodes, and the style hooks landed.
//   node scripts/pause_panel_style_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// --- static -----------------------------------------------------------------
const src = readFileSync('mojiworld_game.html', 'utf8');
// count the actual url() wire, not mere mentions (the rule's own comment
// names the file too, which is documentation rather than a second wire)
const artRefs = src.split("url('Sprites/ui/panel_pause.webp')").length - 1;
ok('the CSS wires the generated art exactly once', artRefs === 1, { refs: artRefs });
ok('the art exists on disk at a sane size', existsSync('Sprites/ui/panel_pause.webp')
   && statSync('Sprites/ui/panel_pause.webp').size > 8000
   && statSync('Sprites/ui/panel_pause.webp').size < 400000,
   { bytes: existsSync('Sprites/ui/panel_pause.webp') ? statSync('Sprites/ui/panel_pause.webp').size : 0 });
const tracked = execFileSync('git', ['ls-files', '--', 'Sprites/ui/panel_pause.webp'], { encoding: 'utf8' }).trim();
ok('the art is COMMITTED (packagers ship only tracked files)', tracked === 'Sprites/ui/panel_pause.webp', { tracked });
ok('the desktop rule has the scale-aware cap',
   src.includes('max-height: calc(92vh / var(--game-scale-y, var(--game-scale, 1)));'), {});

// --- live -------------------------------------------------------------------
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const allErrs = [];

const run = async (w, h) => {
  const page = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  page.on('pageerror', e => allErrs.push(w + 'x' + h + ': ' + String(e).slice(0, 120)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof openSettingsModal === 'function', { timeout: 120000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
    openSettingsModal();
    await new Promise(r2 => setTimeout(r2, 200));
    const m = document.getElementById('settings-modal');
    const mr = m.getBoundingClientRect();
    const st = getComputedStyle(m);
    const rows = m.querySelectorAll('.settings-row');
    const firstRow = rows[0] && rows[0].getBoundingClientRect();
    const out = {
      fits: mr.top >= -1 && mr.bottom <= innerHeight + 1,
      top: Math.round(mr.top), bottom: Math.round(mr.bottom), vh: innerHeight,
      scrolls: m.scrollHeight > m.clientHeight + 1,
      bgHasArt: /panel_pause\.webp/.test(st.backgroundImage),
      firstRowVisible: !!firstRow && firstRow.top >= mr.top - 1,
      h2Chip: (() => { const h2 = m.querySelector('h2'); if (!h2) return false;
        const cs2 = getComputedStyle(h2); return cs2.clipPath !== 'none' && cs2.transform !== 'none'; })(),
      rowCount: rows.length,
    };
    // the bottom controls must be reachable with the panel's own scrollbar
    m.scrollTop = 1e9;
    await new Promise(r2 => setTimeout(r2, 80));
    const imp = [...m.querySelectorAll('button')].find(b2 => /import/i.test(b2.textContent || ''));
    out.bottomReachable = !!imp && imp.getBoundingClientRect().bottom <= innerHeight + 2;
    m.scrollTop = 0;
    // the art really decodes when fetched from the served tree
    out.artDecodes = await new Promise(res => {
      const im = new Image();
      im.onload = () => res(im.naturalWidth > 100);
      im.onerror = () => res(false);
      im.src = 'Sprites/ui/panel_pause.webp?t=' + Math.random();
    });
    try { closeSettingsModal(); } catch (e) {}
    return out;
  });
  await page.close();
  return r;
};

const a = await run(1600, 838);
const c = await run(1366, 728);
await b.close(); try { srv.kill(); } catch (e) {}

for (const [tag, r] of [['1600x838', a], ['1366x728', c]]) {
  console.log(`--- ${tag} ---`, JSON.stringify(r));
  ok(tag + ': the panel sits fully ON screen (was centre-clipped both ends)', r.fits === true,
     { top: r.top, bottom: r.bottom, vh: r.vh });
  ok(tag + ': the panel scrolls internally', r.scrolls === true, { scrolls: r.scrolls });
  ok(tag + ': the FIRST row is visible at the top (the reported clip)', r.firstRowVisible === true, {});
  ok(tag + ': the bottom Import button is reachable by scrolling', r.bottomReachable === true, {});
  ok(tag + ': the generated art backs the panel', r.bgHasArt === true, {});
  ok(tag + ': the title wears the skewed Persona chip', r.h2Chip === true, {});
}
ok('the art decodes when served (not just present)', a.artDecodes === true && c.artDecodes === true,
   { a: a.artDecodes, c: c.artDecodes });
ok('no page errors', allErrs.length === 0, allErrs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
