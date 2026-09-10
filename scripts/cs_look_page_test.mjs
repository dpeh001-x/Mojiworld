// The creator's LOOK page after the AAA pass: bundled display faces, accented picker plates with
// count chips and watermarks, gender buttons with custom icons, and the page still fits.
// Per user: "Upgrade the character creation page to be just as good or even better than the
// class selection page, also improve on the choice and design of fonts".
//
//   node scripts/cs_look_page_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11235);
const checks = [];
for (const f of ['cinzel-700-latin.woff2', 'cormorant-garamond-500-italic-latin.woff2', 'cormorant-garamond-600-latin.woff2', 'LICENSE-OFL.txt']) {
  const p = path.join(ROOT, 'assets', 'fonts', f);
  checks.push([`assets/fonts/${f} ships`, existsSync(p) && statSync(p).size > 1000]);
}
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const bad404 = [];
page.on('response', (r) => { if (r.status() >= 400 && /assets\/fonts\/|Sprites\/ui\/cs\//.test(r.url())) bad404.push(r.status() + ' ' + r.url().split('/').pop()); });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  await document.fonts.ready;
  const fam = (el) => el ? getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim() : '';
  const dec = (im) => !!(im && im.complete && im.naturalWidth > 0);
  const m = document.getElementById('class-select-modal');
  const sections = [...m.querySelectorAll('.cs-picker-section')];
  const right = m.querySelector('.cs-look-right').getBoundingClientRect();
  const left = m.querySelector('.cs-look-left').getBoundingClientRect();
  const nav = m.querySelector('.cs-page-nav').getBoundingClientRect();
  const counts = sections.map((s) => { const c = s.querySelector('.cs-count'); return c ? c.textContent.trim() : null; });
  const expected = [
    document.getElementById('cs-dd-hair').options.length,
    document.getElementById('cs-dd-eye').options.length,
    document.getElementById('cs-dd-mouth').options.length,
    document.querySelectorAll('#cs-picker-skin .cs-skin-swatch').length,
  ];
  const genders = [...m.querySelectorAll('.gender-btn')];
  return {
    fonts: {
      cinzel: document.fonts.check('700 12px Cinzel'),
      cormorant: document.fonts.check('italic 500 12px "Cormorant Garamond"'),
      title: fam(m.querySelector('.cs-title-line')),
      preamble: fam(m.querySelector('.cs-preamble')),
      label: fam(m.querySelector('.cs-dropdown-label')),
      field: fam(m.querySelector('.cs-field-label')),
      nameInput: fam(document.getElementById('hero-name-input')),
      trigger: fam(m.querySelector('.cs-dd-trigger')),
      nav: fam(m.querySelector('.cs-nav-next')),
      gugumaLine: fam(m.querySelector('.guguma-line')),
      clsName: fam(m.querySelector('.class-card .cls-name')),
    },
    plates: sections.map((s) => ({
      pk: getComputedStyle(s).getPropertyValue('--pk').trim(),
      disc: !!s.querySelector('.cs-label-ico') && getComputedStyle(s.querySelector('.cs-label-ico')).borderRadius === '50%',
    })),
    counts, expected,
    genders: genders.map((b) => ({ ico: dec(b.querySelector('img.cs-gender-ico')), glyph: /[♀♂]/.test(b.textContent) })),
    fit: { rightBottom: right.bottom, leftBottom: left.bottom, navTop: nav.top, navBottom: nav.bottom, modalBottom: m.querySelector('.modal.cs-epic').getBoundingClientRect().bottom },
  };
});
await browser.close(); server.kill();

console.log('fonts:', JSON.stringify(r.fonts));
console.log('plates:', JSON.stringify(r.plates), 'counts', JSON.stringify(r.counts), 'expected', JSON.stringify(r.expected));
checks.push(['Cinzel and Cormorant Garamond are loaded from the bundled files', r.fonts.cinzel && r.fonts.cormorant]);
checks.push(['title, section labels, field labels, name field, nav buttons and class names are Cinzel', ['title', 'label', 'field', 'nameInput', 'nav', 'clsName'].every((k) => r.fonts[k] === 'Cinzel'), JSON.stringify(r.fonts)]);
checks.push(['the preamble and Guguma\'s line are Cormorant Garamond italic', r.fonts.preamble === 'Cormorant Garamond' && r.fonts.gugumaLine === 'Cormorant Garamond']);
checks.push(['dropdown text stays a clean sans for reading', /Calibri|Segoe/.test(r.fonts.trigger), r.fonts.trigger]);
checks.push(['each of the four plates carries its own accent colour', r.plates.length === 4 && r.plates.every((p) => /^#|^rgb/.test(p.pk)) && new Set(r.plates.map((p) => p.pk)).size === 4]);
checks.push(['each label icon sits on a lit disc', r.plates.every((p) => p.disc)]);
checks.push(['the count chips name how many styles / tones each plate holds', r.counts.every((c, i) => c && c.startsWith(String(r.expected[i]))), r.counts.join(' | ')]);
checks.push(['gender buttons use custom icons, no text glyphs', r.genders.length === 2 && r.genders.every((g) => g.ico && !g.glyph), JSON.stringify(r.genders)]);
checks.push(['both columns clear the page nav (no clipping)', r.fit.rightBottom <= r.fit.navTop && r.fit.leftBottom <= r.fit.navTop, `right ${Math.round(r.fit.rightBottom)}, left ${Math.round(r.fit.leftBottom)}, nav ${Math.round(r.fit.navTop)}`]);
checks.push(['the page nav sits inside the modal (overflow is hidden there)', r.fit.navBottom <= r.fit.modalBottom + 1, `nav ends ${Math.round(r.fit.navBottom)}, modal ends ${Math.round(r.fit.modalBottom)}`]);
checks.push(['no 404 for a font or an icon', bad404.length === 0, bad404.join(' | ')]);
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
