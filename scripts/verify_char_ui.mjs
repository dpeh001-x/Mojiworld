import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');
import { mkdirSync } from 'fs'; mkdirSync(OUT, { recursive: true });
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8765/mojiworld_game.html';
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
await page.evaluate(() => localStorage.setItem('levelx_save_v1', JSON.stringify({ v: 1, t: Date.now(), player: { cls: 'mage', level: 12, look: { name: 'Everdawn' } }, game: { currentMap: 'town' } })));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#menu-continue', { state: 'visible', timeout: 90000 });
await page.click('#menu-continue');
await page.waitForSelector('#loading-overlay', { state: 'detached', timeout: 30000 });
await page.waitForTimeout(700);

// --- Character-creation screen (bg + Guguma cute font + bolder lore) ---
await page.evaluate(() => { try { if (typeof openClassSelect === 'function') openClassSelect(); } catch (e) {} });
await page.waitForTimeout(900);
const csVisible = await page.evaluate(() => { const m = document.getElementById('class-select-modal'); return m && getComputedStyle(m).display !== 'none'; });
const gugumaFont = await page.evaluate(() => { const el = document.querySelector('.guguma-line'); return el ? getComputedStyle(el).fontFamily + ' | style=' + getComputedStyle(el).fontStyle : 'none'; });
const bgUsed = await page.evaluate(() => { const el = document.querySelector('#class-select-modal .modal.cs-epic'); return el ? getComputedStyle(el).backgroundImage.includes('bg_char_create') : false; });
console.log('class-select visible:', csVisible, '| bg wired:', bgUsed);
console.log('guguma-line font:', gugumaFont);
if (csVisible) await page.screenshot({ path: join(OUT, 'verify_char_create.png') });

// --- Storyline slide (bolder) ---
await page.evaluate(() => {
  const o = document.getElementById('story-beat-overlay');
  if (!o) return;
  o.className = 'mode-epilogue on';
  document.getElementById('story-beat-text').textContent = 'Something at the treeline\nwears a shape you know.';
});
await page.waitForTimeout(400);
const wt = await page.evaluate(() => { const el = document.getElementById('story-beat-text'); return el ? getComputedStyle(el).fontWeight : 'none'; });
console.log('story-beat-text font-weight:', wt);
await page.screenshot({ path: join(OUT, 'verify_storyline.png') });
console.log('page errors:', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
