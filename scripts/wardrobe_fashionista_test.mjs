// Fashionista wardrobe gate + makeover fee (v0.29.375).
//   - the Wardrobe opens ONLY through her dialog (Q no longer opens it)
//   - Q routes to her chat when she is present, and says where she is when not
//   - a look CHANGE costs WARDROBE_FEE Mojicoins
//   - browsing (open, apply nothing, close) is free
//   - an unaffordable makeover ABORTS with the look untouched
//
// The fee used to be advertised but optional: the pre-v0.29.375 rule was
// "never abort on insufficient coins", so once you were broke every restyle
// was free. These assertions pin that it is now binding.
//   node scripts/wardrobe_fashionista_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8937)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8937;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const o = await page.evaluate(() => {
  const out = {};
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  for (const id of ['story-beat-overlay', 'boss-intro-overlay']) {
    const el = document.getElementById(id); if (el && el.classList) el.classList.remove('on');
  }
  player.cls = player.cls || 'warrior'; player.level = 30; player.hp = 500; player.maxHp = 500;
  const isOpen = () => { const el = document.getElementById('char-studio-overlay');
                         return !!el && el.classList.contains('open'); };
  const shut = () => { try { if (typeof closeCharStudio === 'function') closeCharStudio(); } catch (e) {}
                       try { closeAllModals(); } catch (e) {} };

  out.fee = (typeof WARDROBE_FEE === 'number') ? WARDROBE_FEE : null;

  // 1. openCharStudio without her ticket must refuse
  shut();
  try { openCharStudio(); out.rawThrew = null; } catch (e) { out.rawThrew = String(e).slice(0, 100); }
  out.openedWithoutTicket = isOpen();
  shut();

  // 2. with her ticket it opens
  try { _csGrantWardrobe(); openCharStudio(); } catch (e) { out.ticketThrew = String(e).slice(0, 100); }
  out.openedWithTicket = isOpen();
  shut();

  // 3. the ticket is one-shot — a second open without a new grant refuses
  try { openCharStudio(); } catch (e) {}
  out.ticketReusable = isOpen();
  shut();

  // 4. Q on a map WITHOUT her: does not open the wardrobe
  const noHer = Object.entries(MAPS).find(([id, mp]) => !mp.isVoid && (mp.platforms || []).length &&
    !((mp.npcs || []).some(n => n && n.role === 'wardrobe')));
  if (noHer) {
    loadMap(noHer[0]);
    try { _wardrobeHotkey(); } catch (e) { out.qAwayThrew = String(e).slice(0, 100); }
    out.qAwayOpened = isOpen();
    out.qAwayMap = noHer[0];
    shut();
  }

  // 5. Q on her map: opens her DIALOG, not the wardrobe
  const herMap = Object.entries(MAPS).find(([id, mp]) => (mp.npcs || []).some(n => n && n.role === 'wardrobe'));
  if (herMap) {
    loadMap(herMap[0]);
    try { _wardrobeHotkey(); } catch (e) { out.qHereThrew = String(e).slice(0, 100); }
    const dlg = document.getElementById('dialog');
    out.qHereMap = herMap[0];
    out.qHereOpenedWardrobe = isOpen();
    out.qHereOpenedDialog = !!dlg && dlg.style.display === 'block';
    out.qHereDialogName = (document.getElementById('dialog-name') || {}).textContent || '';
    shut();
  }

  // 6. FEE: a real look change costs exactly WARDROBE_FEE
  const FEE = out.fee || 1000;
  loadMap(herMap ? herMap[0] : (noHer ? noHer[0] : game.currentMap));
  player.mojicoins = 5000;
  _csGrantWardrobe(); openCharStudio();
  const before = player.mojicoins;
  CHAR_STUDIO.skinIdx = ((CHAR_STUDIO.skinIdx | 0) + 3) % 8;      // a genuine change
  try { applyCharStudioToPlayer(); } catch (e) { out.applyThrew = String(e).slice(0, 100); }
  out.chargedForChange = before - player.mojicoins;
  out.lookCommitted = (player.lookCustom || {}).skinIdx === CHAR_STUDIO.skinIdx;
  shut();

  // 7. BROWSING IS FREE: open, apply with nothing changed, close
  player.mojicoins = 5000;
  _csGrantWardrobe(); openCharStudio();
  const before2 = player.mojicoins;
  try { applyCharStudioToPlayer(); } catch (e) {}
  out.chargedForNoChange = before2 - player.mojicoins;
  shut();

  // 8. UNAFFORDABLE: aborts, look untouched, no coins move
  player.mojicoins = FEE - 1;
  _csGrantWardrobe(); openCharStudio();
  const skinBefore = (player.lookCustom || {}).skinIdx;
  const coinsBefore = player.mojicoins;
  CHAR_STUDIO.skinIdx = ((CHAR_STUDIO.skinIdx | 0) + 2) % 8;
  try { applyCharStudioToPlayer(); } catch (e) { out.poorThrew = String(e).slice(0, 100); }
  out.poorCoinsMoved = coinsBefore - player.mojicoins;
  out.poorLookChanged = (player.lookCustom || {}).skinIdx !== skinBefore;
  shut();

  player.mojicoins = 1000;
  return out;
});

const results = [];
const ok = (n, c, e) => results.push({ n, pass: !!c, e });
ok('WARDROBE_FEE is defined', o.fee != null, `${o.fee}`);
ok('wardrobe refuses to open without her ticket', !o.openedWithoutTicket);
ok('wardrobe opens with her ticket', o.openedWithTicket, o.ticketThrew);
ok('her ticket is one-shot (not reusable)', !o.ticketReusable);
ok('Q away from her does not open the wardrobe', !o.qAwayOpened, `map ${o.qAwayMap}${o.qAwayThrew ? ' threw ' + o.qAwayThrew : ''}`);
ok('Q on her map opens her dialog', o.qHereOpenedDialog, `map ${o.qHereMap}, name "${o.qHereDialogName}"${o.qHereThrew ? ' threw ' + o.qHereThrew : ''}`);
ok('Q on her map does not open the wardrobe directly', !o.qHereOpenedWardrobe);
ok('a look change costs exactly the fee', o.chargedForChange === (o.fee || 1000), `charged ${o.chargedForChange}`);
ok('the changed look is committed', o.lookCommitted, o.applyThrew);
ok('browsing without changes is free', o.chargedForNoChange === 0, `charged ${o.chargedForNoChange}`);
ok('an unaffordable makeover moves no coins', o.poorCoinsMoved === 0, `moved ${o.poorCoinsMoved}`);
ok('an unaffordable makeover leaves the look untouched', !o.poorLookChanged, o.poorThrew);

for (const t of results) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}${t.e ? '  (' + t.e + ')' : ''}`);
const failed = results.filter(t => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} wardrobe assertions pass`);
console.log('pageerrors:', errs.length, errs.slice(0, 4));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
