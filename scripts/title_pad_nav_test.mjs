// v0.29.x — the title screen must be reachable by controller. Before this, the
// gamepad poller was running at boot but _lxPadModalRoot() had no id matching the
// title menu, so a controller-only player on desktop could not press New Game.
//
//   node serve.js 8797 && node scripts/title_pad_nav_test.mjs 8797
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8797';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });

// Wait for the title screen (the auth/main-menu panel) to actually be shown.
await page.waitForFunction(() => {
  const el = document.getElementById('lo-auth');
  return !!(el && el.classList.contains('shown') && el.offsetParent);
}, null, { timeout: 180000 });

const probe = await page.evaluate(() => {
  const ids = eval('_LX_PAD_MODAL_IDS');
  const root = eval('_lxPadModalRoot')();
  const auth = document.getElementById('lo-auth');
  // What the nav routine would actually offer as focus targets.
  const targets = root ? [...root.querySelectorAll('button, [role="button"], input, select, a[href]')]
    .filter(e => e.offsetParent && !e.disabled).length : 0;
  return {
    listedFirst: ids[0],
    includesTitle: ids.includes('lo-auth'),
    rootIsTitle: root === auth,
    rootId: root ? root.id : null,
    focusTargets: targets,
    padStarted: typeof eval('_lxStartGamepad') === 'function',
  };
});

ok('the title screen id is in the pad-navigable roots', probe.includesTitle, { first: probe.listedFirst });
ok('it leads the list so it wins while the title is up', probe.listedFirst === 'lo-auth');
ok('_lxPadModalRoot() resolves to the title screen at boot', probe.rootIsTitle, { got: probe.rootId });
ok('the title screen exposes focusable targets for the pad', probe.focusTargets > 0, { targets: probe.focusTargets });
ok('the gamepad poller exists at boot', probe.padStarted);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

// Regression: the in-game modals must still resolve once the title is gone.
const after = await page.evaluate(() => {
  const auth = document.getElementById('lo-auth');
  if (auth) { auth.classList.remove('shown'); auth.setAttribute('hidden', ''); auth.style.display = 'none'; }
  const root = eval('_lxPadModalRoot')();
  return { rootAfterTitleClosed: root ? root.id : null };
});
ok('with the title closed the root falls through to in-game modals (no false lock)',
   after.rootAfterTitleClosed !== 'lo-auth', after);

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
