// Choosing Female defaults the hair to Ponytail - and stays customisable.
// Per user: "when choosing the female character, auto change to the ponytail
// hair but allow customisations after."
// Run: node scripts/female_ponytail_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9210;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  // open the real creator
  if (typeof openClassSelect === 'function') openClassSelect();
  await new Promise(r => setTimeout(r, 600));
  const modal = document.getElementById('class-select-modal');
  const hair = document.getElementById('cs-dd-hair');
  const fBtn = document.querySelector('#gender-row .gender-btn[data-gender="female"]');
  const mBtn = document.querySelector('#gender-row .gender-btn[data-gender="male"]');
  if (!modal || !hair || !fBtn || !mBtn) return { err: 'creator pieces missing: ' + [!!modal, !!hair, !!fBtn, !!mBtn].join(',') };
  const trigText = () => {
    const w = hair.closest('.cs-dropdown-wrap');
    const t = w && w.querySelector('.cs-dd-trigger');
    return t ? (t.textContent || '').trim() : null;
  };
  const r = {};

  // baseline state: male, default hair
  mBtn.click();
  hair.value = 'flow'; hair.dispatchEvent(new Event('change'));
  r.before = { hair: hair.value, look: player.lookCustom && player.lookCustom.hairId };

  // 1. switching to Female auto-selects ponytail through the normal path
  fBtn.click();
  await new Promise(r2 => setTimeout(r2, 100));
  r.afterFemale = { hair: hair.value, look: player.lookCustom && player.lookCustom.hairId,
                    gender: player.look && player.look.gender, trig: trigText() };

  // 2. customisation after: pick a different hair - it must stick
  const alt = Array.prototype.map.call(hair.options, o => o.value).find(v => v !== 'ponytail');
  hair.value = alt; hair.dispatchEvent(new Event('change'));
  r.afterCustom = { hair: hair.value, look: player.lookCustom && player.lookCustom.hairId, alt };

  // 3. re-clicking the already-selected Female pill must NOT stomp the custom pick
  fBtn.click();
  await new Promise(r2 => setTimeout(r2, 100));
  r.afterReclick = { hair: hair.value, look: player.lookCustom && player.lookCustom.hairId };

  // 4. a fresh male -> female switch re-applies the default again
  mBtn.click();
  fBtn.click();
  await new Promise(r2 => setTimeout(r2, 100));
  r.afterReswitch = { hair: hair.value, look: player.lookCustom && player.lookCustom.hairId };
  return r;
});

ok('creator opens with all pieces', !out.err, out.err || '');
if (!out.err) {
  ok('switching to Female auto-selects Ponytail (select + saved look + label)',
     out.afterFemale.hair === 'ponytail' && out.afterFemale.look === 'ponytail'
       && out.afterFemale.gender === 'female' && /Ponytail/i.test(out.afterFemale.trig || ''),
     JSON.stringify(out.afterFemale));
  ok('customising the hair afterwards sticks',
     out.afterCustom.hair === out.afterCustom.alt && out.afterCustom.look === out.afterCustom.alt,
     JSON.stringify(out.afterCustom));
  ok('re-clicking the selected Female pill never stomps the custom pick',
     out.afterReclick.hair === out.afterCustom.alt && out.afterReclick.look === out.afterCustom.alt,
     JSON.stringify(out.afterReclick));
  ok('a fresh male->female switch re-applies the Ponytail default',
     out.afterReswitch.hair === 'ponytail' && out.afterReswitch.look === 'ponytail',
     JSON.stringify(out.afterReswitch));
}

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
