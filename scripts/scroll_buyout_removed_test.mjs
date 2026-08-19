// The recipe-scroll buyout and its legacy migration are gone, per user:
// "Remove _lxRetireRecipeScrolls(), the 200-shard buyout, and the legacy
// player.recipeScrolls[] migration".
//
// The removal itself is four small cuts. The risk is entirely in WHERE they
// were: the migration sat inside the save-load path, wedged between the
// setshards defaulter and the shadowSlums map rename. Cutting a block out of
// that chain and taking a neighbour with it would corrupt loads silently, so
// this loads real saves and checks the surrounding migrations still fire.
// Run: node scripts/scroll_buyout_removed_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = path.join(ROOT, args[0] || 'mojiworld_game.html');
const URL = 'file:///' + FILE.split(path.sep).join('/');
const src = fs.readFileSync(FILE, 'utf8');
const cnt = (t) => src.split(t).length - 1;
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof saveState === 'function', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  const out = {};

  out.gone = ['_lxRetireRecipeScrolls', 'SCROLL_BUYOUT_SHARDS'].filter((n) => typeof window[n] !== 'undefined');
  out.playerField = Object.prototype.hasOwnProperty.call(player, 'recipeScrolls');

  // Build an OLD save carrying everything the removed block used to handle,
  // plus the neighbours whose migrations must still run.
  const key = (typeof SAVE_KEY === 'string') ? SAVE_KEY : 'levelx_save_v1';
  const stale = {
    // loadState() discards any save whose `v` does not match SAVE_VERSION and
    // starts fresh, so a fixture without it never loads at all — which reads
    // exactly like the migration eating the inventory.
    v: (typeof SAVE_VERSION !== 'undefined') ? SAVE_VERSION : 1,
    player: {
      level: 30, cls: 'warrior', mojicoins: 1234,
      recipeScrolls: [{ setId: 'dawnshard' }, { setId: 'voidcaller' }],   // legacy array
      inventory: [{ name: 'Old Recipe', type: 'recipe', setId: 'dawnshard' },
                  { name: 'Real Sword', slot: 'weapon', price: 100 }],
      currentMap: 'shadowSlums',                                          // pre-rename id
    },
    game: { currentMap: 'shadowSlums', bossDefeated: { shadowSlums: true } },
  };
  delete stale.player.setshards;   // the defaulter just above the removed block
  try { localStorage.setItem(key, JSON.stringify(stale)); } catch (e) {}
  out.loadErr = null;
  try {
    if (typeof loadState === 'function') loadState();
    else if (typeof loadGame === 'function') loadGame();
    else out.noLoader = true;
  } catch (e) { out.loadErr = String(e).slice(0, 150); }

  out.setshards = player.setshards;                       // defaulter above the cut
  out.mapRenamed = (player.currentMap !== 'shadowSlums'); // rename below the cut
  out.gameMapRenamed = (game.currentMap !== 'shadowSlums');
  out.scrollsInBag = (player.inventory || []).filter((i) => i && i.type === 'recipe').length;
  out.keptRealGear = (player.inventory || []).some((i) => i && i.name === 'Real Sword');
  out.legacyArray = player.recipeScrolls === undefined ? 'absent' : JSON.stringify(player.recipeScrolls);

  // A save round-trip must not resurrect the field.
  // saveState() DEBOUNCES through setTimeout(_SAVE_DEBOUNCE_MS), so reading
  // localStorage straight after it returns the fixture that was injected, not
  // the game's own write — which reads exactly like the field being persisted.
  try { saveState(); } catch (e) { out.saveErr = String(e).slice(0, 120); }
  const _wait = (typeof _SAVE_DEBOUNCE_MS === 'number') ? _SAVE_DEBOUNCE_MS + 400 : 2000;
  await new Promise((res) => setTimeout(res, _wait));
  out.saveTimerCleared = !game._saveTimer;
  let raw = null; try { raw = localStorage.getItem(key); } catch (e) {}
  out.persistsField = !!(raw && raw.indexOf('recipeScrolls') !== -1);
  return out;
});
await browser.close();

console.log(`  removed symbols still present: ${JSON.stringify(r.gone)}`);
console.log(`  old save -> setshards=${r.setshards}  mapRenamed=${r.mapRenamed}/${r.gameMapRenamed}  scrollsInBag=${r.scrollsInBag}  legacyArray=${r.legacyArray}`);
console.log(`  loadErr: ${r.loadErr}   re-saved with the field: ${r.persistsField}`);

check(r.gone.length === 0, 'the buyout function and its constant are gone', r.gone);
check(r.playerField === false, 'the player object no longer carries recipeScrolls', r.playerField);
check(cnt('recipeScrolls') === 0 && cnt('SCROLL_BUYOUT_SHARDS') === 0,
      'and no mention of either survives anywhere in the file');
// The load path must still work — this is where the cut was made.
check(r.loadErr === null, 'an old save still loads without error', r.loadErr);
check(r.setshards === 0, 'the setshards defaulter directly above the cut still runs', r.setshards);
check(r.mapRenamed && r.gameMapRenamed,
      'the shadowSlums rename directly below the cut still runs', { p: r.mapRenamed, g: r.gameMapRenamed });
check(r.keptRealGear === true, 'real gear in that save is untouched', r.keptRealGear);
check(r.persistsField === false, 'a re-save does not write the retired field back', r.persistsField);
// And the documented consequence: leftover scrolls are simply inert now.
check(r.scrollsInBag === 1, 'a scroll left in a very old bag is now inert rather than bought out', r.scrollsInBag);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
