// Male defaults the hair to Flow, the counterpart of Female's Ponytail.
// Per user: "male default hair will be flow the counterpart of the female
// ponytail." The pills must ROUND-TRIP: female->male returns to Flow just as
// male->female goes to Ponytail, and neither stomps a hair customised after
// the switch.
// Run: node scripts/male_flow_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9211;
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
  if (typeof openClassSelect === 'function') openClassSelect();
  await new Promise(r => setTimeout(r, 600));
  const hair = document.getElementById('cs-dd-hair');
  const fBtn = document.querySelector('#gender-row .gender-btn[data-gender="female"]');
  const mBtn = document.querySelector('#gender-row .gender-btn[data-gender="male"]');
  if (!hair || !fBtn || !mBtn) return { err: 'creator pieces missing' };
  const wait = () => new Promise(r => setTimeout(r, 100));
  const trigText = () => {
    const w = hair.closest('.cs-dropdown-wrap');
    const t = w && w.querySelector('.cs-dd-trigger');
    return t ? (t.textContent || '').trim() : null;
  };
  const snap = () => ({ hair: hair.value, look: player.lookCustom && player.lookCustom.hairId,
                        gender: player.look && player.look.gender, trig: trigText() });
  const r = {};

  // ── the round trip: start female (ponytail), switch to male ───────────────
  fBtn.click(); await wait();
  r.female = snap();
  mBtn.click(); await wait();
  r.afterMale = snap();

  // ── customising after the male switch sticks ─────────────────────────────
  const alt = Array.prototype.map.call(hair.options, o => o.value).find(v => v !== 'flow' && v !== 'ponytail');
  hair.value = alt; hair.dispatchEvent(new Event('change')); await wait();
  r.afterCustom = { ...snap(), alt };

  // ── re-clicking the already-selected Male pill must NOT stomp it ─────────
  mBtn.click(); await wait();
  r.afterReclick = snap();

  // ── a fresh female -> male switch re-applies Flow ────────────────────────
  fBtn.click(); await wait();
  mBtn.click(); await wait();
  r.afterReswitch = snap();

  // ── full round trip still lands Ponytail on the way back (no regression) ─
  fBtn.click(); await wait();
  r.backToFemale = snap();
  return r;
});

ok('creator opens with all pieces', !out.err, out.err || '');
if (!out.err) {
  ok('baseline: Female still lands Ponytail',
     out.female.hair === 'ponytail' && out.female.look === 'ponytail',
     JSON.stringify(out.female));
  ok('switching to Male auto-selects Flow (select + saved look + label)',
     out.afterMale.hair === 'flow' && out.afterMale.look === 'flow'
       && out.afterMale.gender === 'male' && /Flow/i.test(out.afterMale.trig || ''),
     JSON.stringify(out.afterMale));
  ok('customising the hair after the Male switch sticks',
     out.afterCustom.hair === out.afterCustom.alt && out.afterCustom.look === out.afterCustom.alt,
     JSON.stringify(out.afterCustom));
  ok('re-clicking the selected Male pill never stomps the custom pick',
     out.afterReclick.hair === out.afterCustom.alt && out.afterReclick.look === out.afterCustom.alt,
     JSON.stringify(out.afterReclick));
  ok('a fresh female->male switch re-applies the Flow default',
     out.afterReswitch.hair === 'flow' && out.afterReswitch.look === 'flow',
     JSON.stringify(out.afterReswitch));
  ok('the pills round-trip: back to Female lands Ponytail again',
     out.backToFemale.hair === 'ponytail' && out.backToFemale.look === 'ponytail',
     JSON.stringify(out.backToFemale));
}

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
