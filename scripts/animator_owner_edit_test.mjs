// ANIMATOR — an owned set's sliders edit the OWNER's calibration.
// ============================================================================
// Per user, on the aetherionastral entry: "I cant seem to edit this".
//
// aetherionastral is an owned set (ART_OWNER -> aetherion): the game takes its
// FRAMES from _aetherionAstralKey but draws them through _drawBossSprite with
// m.type === 'aetherion', so geometry and calibration are his. The animator's
// own panel note says so — "the sliders here move his attack calib".
//
// They did not. Reads resolved through ownerOf(); writes went to A.cur. The
// value landed under 'aetherionastral', which nothing reads, so the preview
// never moved and the control looked dead.
//
// This drives the REAL slider element and dispatches a real 'input' event, so
// it exercises the path a person actually uses rather than calling setVal.
// Run: node scripts/animator_owner_edit_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9999);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/monster_animator.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!(window.__app && window.__app.CALIB), null, { timeout: 30000 });
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  const A = window.__app;
  const out = { ownerExported: typeof A.ownerOf === 'function' };
  if (!out.ownerExported) return out;
  out.owner = A.ownerOf('aetherionastral');
  out.selfOwner = A.ownerOf('king');

  const nudge = async (entity, st, key, value) => {
    A.select(entity);
    await new Promise(r => setTimeout(r, 600));
    if (typeof window.__buildControls === 'function') window.__buildControls();
    await new Promise(r => setTimeout(r, 400));
    const el = document.querySelector(`input[data-st="${st}"][data-k="${key}"]`);
    if (!el) return { ok: false, why: 'no slider for ' + entity + '/' + st + '/' + key };
    const before = A.CALIB()[A.ownerOf(entity)] && A.CALIB()[A.ownerOf(entity)][st]
      ? A.CALIB()[A.ownerOf(entity)][st][key] : null;
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    // Compare against the control's OWN value, not the number typed in: the
    // slider quantises to its step, so asking for 1.234 stores 1.23 and an
    // exact-match assertion fails a working build. (It did, first run.)
    const want = +el.value;
    const C = A.CALIB();
    return {
      ok: true, want, before,
      onOwner: C[A.ownerOf(entity)] && C[A.ownerOf(entity)][st] ? C[A.ownerOf(entity)][st][key] : null,
      onSelf: C[entity] && C[entity][st] ? C[entity][st][key] : null,
    };
  };

  // OWNED set: the write must land on aetherion.
  out.astral = await nudge('aetherionastral', 'attack', 's', 1.234);
  // CONTROL: an ordinary entity must still edit itself.
  out.king = await nudge('king', 'attack', 's', 1.111);

  // The copy-patch must name the owner, not the selected set.
  A.select('aetherionastral');
  await new Promise(r => setTimeout(r, 500));
  let copied = null;
  try {
    navigator.clipboard.writeText = (t) => { copied = t; return Promise.resolve(); };
  } catch (e) {}
  const btn = document.getElementById('copycur');
  if (btn) { btn.click(); await new Promise(r => setTimeout(r, 400)); }
  out.patchRaw = copied;
  try { out.patch = copied ? JSON.parse(copied) : null; } catch (e) { out.patch = null; }
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

console.log(`  ownerOf('aetherionastral') = ${R.owner}   ownerOf('king') = ${R.selfOwner}`);
console.log(`  astral slider -> owner ${R.astral && R.astral.onOwner}, self ${R.astral && R.astral.onSelf}`);
console.log(`  king  slider -> owner ${R.king && R.king.onOwner}, self ${R.king && R.king.onSelf}`);
console.log(`  patch type: ${R.patch && R.patch.type}`);

ok('ownerOf is exposed to the controls layer', R.ownerExported,
   'without it the edit path cannot know which entity it is really editing');
ok('aetherionastral is owned by aetherion', R.owner === 'aetherion', `ownerOf -> ${R.owner}`);
ok('moving its slider writes to AETHERION',
   !!(R.astral && R.astral.ok && R.astral.onOwner === R.astral.want && R.astral.onOwner !== R.astral.before),
   `aetherion.attack.s ${R.astral && R.astral.before} -> ${R.astral && R.astral.onOwner} (slider asked for ${R.astral && R.astral.want}); it used to land on a key nothing reads`);
ok('CONTROL: an ordinary entity still edits itself',
   !!(R.king && R.king.ok && R.king.onSelf === R.king.want),
   `king.attack.s = ${R.king && R.king.onSelf} (asked ${R.king && R.king.want}), ownerOf('king') = ${R.selfOwner}`);
ok('the copy-patch names the OWNER', !!(R.patch && R.patch.type === 'aetherion'),
   `patch type = ${R.patch && R.patch.type} — a patch under 'aetherionastral' bakes a key the game never reads for calib`);
ok('...and carries a full calib block, not a partial one',
   !!(R.patch && R.patch.calib && Object.keys(R.patch.calib).length >= 2),
   `${R.patch && R.patch.calib ? Object.keys(R.patch.calib).length : 0} states — the baker replaces the block, so a partial one would drop the rest`);
ok('CONTROL: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
