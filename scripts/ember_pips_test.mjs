// v0.29.x — Arcane Ember pips must (a) explain themselves and (b) only exist
// once Fireball is actually castable. Previously they were bare 🔥 emoji with
// no label, shown to any mage from Lv 1 — four levels before Fireball (slot
// 's', SLOT_LEVEL_REQ 5) unlocks.
//
//   node serve.js 8805 && node scripts/ember_pips_test.mjs 8805
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8805';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_renderEmberPips') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(() => {
  const p = eval('player');
  const saved = { cls: p.cls, lv: p.level, st: p._emberStacks };
  const read = () => { const el = document.getElementById('ember-pips');
    return { shown: !!(el && el.style.display !== 'none' && el.innerHTML), html: el ? el.innerHTML : '' }; };
  const set = (cls, lv, st) => { p.cls = cls; p.level = lv; p._emberStacks = st; eval('_renderEmberPips')(); return read(); };

  const req = (typeof eval('slotLevelReq') === 'function') ? eval('slotLevelReq')('s') : null;
  const out = {
    slotReq: req,
    mageBelowReq: set('mage', req - 1, 3),      // charging toward a skill they lack
    mageAtReq:    set('mage', req, 3),
    mageNoStacks: set('mage', req, 0),
    mageFull:     set('mage', req, 5),
    warrior:      set('warrior', 50, 3),        // not a mage at all
  };
  p.cls = saved.cls; p.level = saved.lv; p._emberStacks = saved.st;
  try { eval('_renderEmberPips')(); } catch (e) {}
  return out;
});

ok('Fireball slot gate is Lv 5', r.slotReq === 5, { req: r.slotReq });
ok('hidden below the Fireball unlock level (was: shown from Lv 1)', r.mageBelowReq.shown === false);
ok('shown once Fireball is unlocked', r.mageAtReq.shown === true);
ok('hidden with zero stacks', r.mageNoStacks.shown === false);
ok('never shown for a non-mage', r.warrior.shown === false);
ok('label states the payoff at 3 stacks', /×3\s*→\s*Fireball \+36%/.test(r.mageAtReq.html), r.mageAtReq.html.slice(-70));
ok('label scales with stacks (5 → +60%)', /×5\s*→\s*Fireball \+60%/.test(r.mageFull.html), r.mageFull.html.slice(-70));
ok('still renders 5 pip slots', (r.mageAtReq.html.match(/🔥/g) || []).length === 5);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
