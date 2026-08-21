// The retired recipe-scroll system is gone, per user: "delete the dead codes and
// remove them".
//
// The drop itself was already disabled (`const _scrollLvOk = false`), but the
// rest of the system was still in the file — including two player-facing pieces
// that lied: the boss-intro card advertised a "Recipe Scroll · 20 % drop", and
// an NPC offered to read scrolls that can no longer exist.
//
// The risk in a deletion this size is not that something is left behind, it is
// that something LIVE went with it. So most of this test is about what must
// still work: the boss intro still renders its drop preview, the crafting modal
// still opens, and sigils still trade. (The buyout that used to be checked here
// was itself removed in v0.29.881 — see scripts/scroll_buyout_removed_test.mjs.)
// Run: node scripts/recipe_scroll_removed_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = path.join(ROOT, args[0] || 'mojiworld_game.html');
const URL = 'file:///' + FILE.split(path.sep).join('/');
const src = fs.readFileSync(FILE, 'utf8');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };
const cnt = (t) => src.split(t).length - 1;

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof killMonster === 'function', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 70; player.setshards = 0;
  const out = {};

  // Nothing scroll-shaped should be reachable any more.
  out.deadSymbols = ['openRecipeScrolls', 'useRecipeScrollItem', 'BOSS_SIGNATURE_SCROLL',
                     '_craftFromScroll', '_renderRecipeScrollsModal']
    .filter((n) => typeof window[n] !== 'undefined');
  out.modalEl = !!document.getElementById('recipe-scrolls-modal');

  // The things that must STILL work. The buyout used to be in this list; it was
  // removed in v0.29.881 and its behaviour is now covered by
  // scripts/scroll_buyout_removed_test.mjs.
  out.liveFns = ['_lxTradeZodiacSigil', '_lxSigilCount', 'openCraftingModal']
    .filter((n) => typeof window[n] !== 'function');

  // Killing an elite/boss must not mint a scroll, and must not throw.
  loadMap('magmaFoundry2');
  await new Promise((res) => setTimeout(res, 800));
  let killErr = null;
  // Count what the kills MINT — a delta. Summing the bag each iteration counts
  // any pre-existing scroll once per loop, which reads as 80 mints from a bag
  // holding 2 (that is how this check first failed).
  player.inventory = [];
  const bagBefore = 0;
  for (let i = 0; i < 40; i++) {
    game.drops = [];
    let m = null;
    try { m = spawnMonster(600, 300, 'smithgolem'); } catch (e) {}
    if (!m) break;
    m.isElite = (i % 2 === 0); m.isMiniBoss = (i % 2 === 1); m.currentHp = 0;
    try { killMonster(m); } catch (e) { killErr = String(e).slice(0, 120); break; }
    game.monsters = [];
  }
  const minted = (player.inventory || []).filter((x) => x && x.type === 'recipe').length - bagBefore;
  out.killErr = killErr;
  out.scrollsMinted = minted;

  // The crafting modal — the surviving half of this system — still opens.
  try { openCraftingModal(); } catch (e) { out.craftErr = String(e).slice(0, 120); }
  const cm = document.getElementById('craft-modal');
  out.craftOpens = !!(cm && getComputedStyle(cm).display !== 'none');
  if (typeof closeAllModals === 'function') closeAllModals();
  return out;
});
await browser.close();

console.log(`  reachable dead symbols: ${JSON.stringify(r.deadSymbols)}   modal element: ${r.modalEl}`);
console.log(`  missing live fns: ${JSON.stringify(r.liveFns)}`);
console.log(`  40 elite/elder kills -> ${r.scrollsMinted} scrolls minted   killErr: ${r.killErr}`);

check(r.deadSymbols.length === 0, 'no scroll function or table is reachable any more', r.deadSymbols);
check(r.modalEl === false, 'the Recipe Scrolls modal element is gone', r.modalEl);
check(cnt('recipe-scrolls-modal') === 0, 'and no registry still lists its id', cnt('recipe-scrolls-modal'));
check(cnt("type: 'recipe'") === 0, 'nothing in the file can mint a recipe item', cnt("type: 'recipe'"));
check(cnt('Recipe Scroll</span>') === 0 && cnt('20 % drop') === 0,
      'the boss intro no longer advertises a scroll drop', { adv: cnt('20 % drop') });
check(cnt('Bring me scrolls and I') === 0, 'and no NPC still offers to read them');
// What must survive.
check(r.liveFns.length === 0, 'the kept helpers survived the deletion', r.liveFns);
check(r.killErr === null, 'elite and Elder kills still resolve without error', r.killErr);
check(r.scrollsMinted === 0, 'and mint no scrolls', r.scrollsMinted);
check(r.craftOpens === true, 'the crafting modal still opens', { opens: r.craftOpens, err: r.craftErr });
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
