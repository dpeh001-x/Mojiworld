// title-pop: start_menu_test's "Continue card shows class crest" check follows the Continue badge to its new art.
// The title menu's Continue card now wears a pop class sticker (Sprites/ui/menu/menu_pop_class_<cls>.webp) instead of
// the gold crest. The check still demands the saved hero's own class and a loaded, visible image - but it now waits
// (up to 8 s) for that image instead of sampling it once: the gold crests were always warm from the class-select
// screen, so the old instant read only ever passed on cache; the sticker is fetched as the menu mounts and, on a busy
// machine, was still in flight at that exact instant. Guarded + idempotent.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/scripts/start_menu_test.mjs';
let s = readFileSync(F, 'utf8');
if (s.includes('menu_pop_class_mage')) { console.log('already applied'); process.exit(0); }
const A = [
  "  ok('Continue card shows class crest', await page.evaluate(() => {",
  "    const i = document.getElementById('menu-continue-icon');",
  "    return i && i.style.display !== 'none' && i.complete && i.naturalWidth > 0 && i.src.includes('class_crest_mage');",
  "  }));",
];
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const anchor = A.join(EOL);
const n = s.split(anchor).length - 1;
if (n !== 1) { console.error('ABORT: start_menu_test crest check matched ' + n); process.exit(1); }
s = s.replace(anchor, () => [
  "  // title-pop: the Continue badge is a pop class sticker now; wait for it to load rather than sampling it once",
  "  ok('Continue card shows class crest', await page.waitForFunction(() => {",
  "    const i = document.getElementById('menu-continue-icon');",
  "    return i && i.style.display !== 'none' && i.complete && i.naturalWidth > 0 && (i.src.includes('class_crest_mage') || i.src.includes('menu_pop_class_mage'));",
  "  }, null, { timeout: 8000 }).then(() => true, () => false));",
].join(EOL));
writeFileSync(F + '.tmp', s, 'utf8');
renameSync(F + '.tmp', F);
console.log('applied: start_menu_test accepts (and waits for) the pop class sticker');
