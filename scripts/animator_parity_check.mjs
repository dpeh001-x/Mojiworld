#!/usr/bin/env node
// Does the animator still show exactly what the game renders?
// =============================================================================
// The animator's subtitle promises "renders EXACTLY what the game renders", and
// three separate ways of breaking that promise have now been found by hand:
//
//   1. NEW ART NOT IN THE MANIFEST. aetherionastral was a complete nine-frame
//      set, committed, with its own passing test, that the animator could not
//      show at all because the generated manifest had never been re-run.
//   2. NO HITBOX ROW -> NO GAME SIZE. data/monster_hitboxes.js was missing the
//      twelve zodiac bosses and four plant mobs. A type with no row has no m.h,
//      so geometry() loses its game base and silently falls back to the 220px
//      preview - while still printing the number under the heading "in-game".
//   3. STALE CONTENT BOXES. The manifest bakes a per-frame content box that
//      feeds content-normalisation. Redraw the art without re-running the
//      generator and the tool normalises against boxes that no longer describe
//      the pixels.
//
// Each was caught only because someone happened to look. This is that look,
// automated, so it becomes a command instead of a prompt.
//
//   node scripts/animator_parity_check.mjs
//
// Exits non-zero on any failure. Run it after ANY art drop under Sprites/ and
// after any change to monster_animator.html or the data/ tables.
// =============================================================================
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'x.js'));
const { chromium } = require('playwright-core');
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MAN = join(root, 'data', 'anim_calib_manifest.js');

const results = [];
const ok = (name, pass, extra) => { results.push({ name, pass: !!pass, extra }); };
const readMan = (src) => JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('};') + 1));

// ---------- 1. the generated indexes are current --------------------------
try {
  execFileSync(process.execPath, [join(root, 'scripts', 'gen_sprite_frame_index.mjs'), '--check'],
    { cwd: root, stdio: 'pipe' });
  ok('data/sprite_frame_index.js is current', true);
} catch (e) {
  ok('data/sprite_frame_index.js is current', false, 'run: node scripts/gen_sprite_frame_index.mjs');
}

// ---------- 2. the manifest describes the art that is on disk -------------
// Regenerate into a scratch copy and compare: a missing entity means art that
// cannot be previewed at all; a changed entity means boxes that no longer
// describe the pixels the tool is normalising against.
const before = readMan(readFileSync(MAN, 'utf8'));
const backup = readFileSync(MAN);
let after = null;
try {
  execFileSync(process.execPath, [join(root, 'scripts', 'gen_anim_manifest.mjs')], { cwd: root, stdio: 'pipe' });
  after = readMan(readFileSync(MAN, 'utf8'));
} catch (e) {
  ok('the manifest generator runs', false, String(e.message || e).slice(0, 200));
} finally {
  writeFileSync(MAN, backup);   // never leave a regenerate behind
}
if (after) {
  const missing = Object.keys(after).filter((k) => !(k in before));
  const stale = Object.keys(after).filter((k) => k in before && JSON.stringify(after[k]) !== JSON.stringify(before[k]));
  ok('every animated set on disk is in the manifest', missing.length === 0,
    missing.length ? missing.join(', ') + '  -> node scripts/gen_anim_manifest.mjs' : null);
  ok('no manifest entity has stale content boxes', stale.length === 0,
    stale.length ? stale.join(', ') + '  -> node scripts/gen_anim_manifest.mjs' : null);

  // defence in depth for the degenerate-box bug the generator now refuses to
  // write: catches a manifest that arrived by any other route
  const degenerate = [];
  for (const [t, ent] of Object.entries(before)) {
    for (const [st, info] of Object.entries(ent.states || {})) {
      const cb = info.cb;
      if (!Array.isArray(cb) || cb.length < 2 || cb.some((b) => b == null)) continue;
      const f0 = JSON.stringify(cb[0]);
      if (cb.every((b) => JSON.stringify(b) === f0)) degenerate.push(t + '.' + st);
    }
  }
  ok('no state baked ONE content box for every frame', degenerate.length === 0,
    degenerate.length ? degenerate.join(', ') + '  -> node scripts/gen_anim_manifest.mjs' : null);
}

// ---------- 3. every previewable type can resolve a GAME size -------------
const free = (p) => new Promise((r) => {
  const s = createServer();
  s.once('error', () => r(false));
  s.once('listening', () => s.close(() => r(true)));
  s.listen(p, '127.0.0.1');
});
let PORT = null;
for (let p = 8840; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', cwd: root });
await new Promise((r) => setTimeout(r, 2200));

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const failed = [], errs = [];
  page.on('requestfailed', (r) => failed.push(r.url().split('/').pop()));
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/monster_animator.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__app && window.__app.MAN, null, { timeout: 30000 });

  const scan = await page.evaluate(async () => {
    const A = window.__app, out = { total: 0, noGameSize: [], undecoded: [], noMetric: [] };
    const types = Object.keys(A.MAN);
    out.total = types.length;
    for (const t of types) {
      A.select(t);
      await new Promise((r) => setTimeout(r, 130));
      const ent = A.MAN[t];
      for (const st of A.STATES) {
        if (!ent.states[st]) continue;
        const m = A.gameMetrics(st);
        if (!m) { out.noMetric.push(t + '/' + st); continue; }
        if (!m.isGameSize) out.noGameSize.push(t + '/' + st);
        if (m.decoded < m.frames) out.undecoded.push(t + '/' + st + ' ' + m.decoded + '/' + m.frames);
      }
    }
    return out;
  });

  const badTypes = [...new Set(scan.noGameSize.map((x) => x.split('/')[0]))];
  ok('every state reports a REAL in-game size, not the 220px preview',
    scan.noGameSize.length === 0,
    badTypes.length ? badTypes.join(', ') + '  -> node scripts/gen_mob_hitboxes.mjs' : null);
  ok('every frame of every state decodes', scan.undecoded.length === 0, scan.undecoded.slice(0, 8).join('; ') || null);
  ok('every state produces a metric', scan.noMetric.length === 0, scan.noMetric.slice(0, 8).join('; ') || null);
  ok('the animator loads with no failed asset request', failed.length === 0,
    failed.length ? [...new Set(failed)].slice(0, 6).join(', ') : null);
  ok('the animator loads with no page error', errs.length === 0, errs.slice(0, 3).join(' | ') || null);
  console.log('scanned ' + scan.total + ' entities');
} finally {
  await browser.close();
  srv.kill();
}

// ---------- report ---------------------------------------------------------
console.log('');
let bad = 0;
for (const r of results) {
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.extra ? '\n        ' + r.extra : ''));
  if (!r.pass) bad++;
}
console.log('\n' + (results.length - bad) + '/' + results.length + ' checks passed');
if (existsSync(join(root, 'scripts', '_tmp_mob_hb_check.js'))) unlinkSync(join(root, 'scripts', '_tmp_mob_hb_check.js'));
process.exit(bad ? 1 : 0);
