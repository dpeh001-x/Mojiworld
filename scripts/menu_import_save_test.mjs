// MENU: LOAD A SAVE FILE (per user: "From the menu screen the load backup option should allow the user to browse for the save
// file to import"). The title menu's Save Backups opened a slot list that could snapshot, restore and download, but never load
// a file - the only picker sat in Settings. On a fresh browser profile at the title screen:
//   1. Save Backups shows "Load a save file" with no save at all (a new device), and the empty state points at it;
//   2. picking a signed .mojisave opens the import confirm ON TOP of the title screen (the element at the Yes button is the
//      Yes button), says the signature is verified and that it LOADS (there is nothing to overwrite);
//   3. confirming reloads into a title menu whose Continue card is the imported hero, and the stored save is it;
//   4. with a save present, a second file asks to OVERWRITE, and Cancel leaves the save as it was;
//   5. the menu line advertises import; 6. no page errors.
// The build before fails 1-5.   node scripts/menu_import_save_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11798), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  const title = async () => { await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 180000 }); await page.waitForFunction(() => typeof importSave === 'function' && typeof _lxSecureSavePayload === 'function', null, { timeout: 60000 }); };
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await title();
  // a signed save, built the way the game signs one (the live signature inside, the .mojisave wrapper outside)
  const mk = (name, level) => page.evaluate(([name, level]) => {
    const inner = { v: SAVE_VERSION, t: Date.now(), player: { cls: 'mage', level, look: { name } }, game: { currentMap: 'town' } };
    inner.sig = _lxLocalSaveSig(inner);
    return _lxSecureSavePayload(JSON.stringify(inner), Date.now());
  }, [name, level]);
  const file = (name, text) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
  const confirmState = () => page.evaluate(() => {
    const m = document.getElementById('confirm-modal'), y = document.getElementById('confirm-yes');
    const shown = !!m && getComputedStyle(m).display !== 'none';
    let top = false; if (shown && y) { const r = y.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); top = !!el && (el === y || y.contains(el)); }
    return { shown, top, title: (document.getElementById('confirm-title') || {}).textContent || '', body: (document.getElementById('confirm-body') || {}).textContent || '' };
  });
  // 1. a new device: no save, Save Backups offers the picker
  const fresh = await page.evaluate(() => ({ save: hasSave(), cont: !document.getElementById('menu-continue').hidden && getComputedStyle(document.getElementById('menu-continue')).display !== 'none' }));
  await page.click('#menu-backups'); await page.waitForSelector('#backup-modal', { state: 'visible', timeout: 5000 });
  const m1 = await page.evaluate(() => ({ btn: !!document.getElementById('backup-import-btn') && document.getElementById('backup-import-btn').offsetParent !== null,
    accept: (document.getElementById('backup-import-file') || {}).accept || '', empty: document.getElementById('backup-slots').textContent, sub: document.getElementById('menu-backups-sub').textContent }));
  ok('[1] no save yet: Save Backups shows "Load a save file", and the empty state points at it', !fresh.save && m1.btn && /\.mojisave/.test(m1.accept) && /No backups yet/.test(m1.empty) && /Load a save file/.test(m1.empty), { fresh, m1 });
  ok('[5] the menu line advertises import', /import/.test(m1.sub), m1.sub);
  // 2. pick a signed file: the confirm sits on top of the title screen
  const chooser = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await page.click('#backup-import-btn'); const fc = await chooser;
  ok('[1] the button opens the browser\'s file picker', !!fc);
  await page.setInputFiles('#backup-import-file', file('importa.mojisave', await mk('Importa', 12)));
  await page.waitForFunction(() => { const m = document.getElementById('confirm-modal'); return m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 8000 });
  const c1 = await confirmState();
  ok('[2] the import confirm is on top of the title screen, signature verified, and it loads (nothing to overwrite)', c1.top && /Signature verified/.test(c1.body) && /This loads the save/.test(c1.body) && !/OVERWRITE/.test(c1.body), c1);
  // 3. confirm: the page reloads into the imported hero
  await page.evaluate(() => { window.__lxBefore = 1; });
  await page.click('#confirm-yes');
  await page.waitForFunction(() => !window.__lxBefore && document.readyState !== 'loading', null, { timeout: 30000 }).catch(() => {});
  await title();
  const after = await page.evaluate(() => { const s = _lxSafeJsonParse(localStorage.getItem(SAVE_KEY) || 'null');
    return { lv: s && s.player && s.player.level, name: s && s.player && s.player.look && s.player.look.name, sub: (document.getElementById('menu-continue-sub') || {}).textContent || '',
      cont: getComputedStyle(document.getElementById('menu-continue')).display !== 'none' && !document.getElementById('menu-continue').hidden }; });
  ok('[3] after the reload the stored save is the imported hero and Continue shows it', after.lv === 12 && after.name === 'Importa' && after.cont && /Importa/.test(after.sub) && /Lv\.12/.test(after.sub), after);
  // 4. with a save, a second file asks to OVERWRITE; Cancel keeps the save
  await page.click('#menu-backups'); await page.waitForSelector('#backup-modal', { state: 'visible', timeout: 5000 });
  await page.setInputFiles('#backup-import-file', file('other.mojisave', await mk('Other', 30)));
  await page.waitForFunction(() => { const m = document.getElementById('confirm-modal'); return m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 8000 });
  const c2 = await confirmState();
  await page.click('#confirm-no'); await page.waitForTimeout(400);
  const kept = await page.evaluate(() => { const s = _lxSafeJsonParse(localStorage.getItem(SAVE_KEY) || 'null'); return { lv: s && s.player && s.player.level, input: document.getElementById('backup-import-file').value }; });
  ok('[4] with a save, the confirm asks to OVERWRITE; Cancel keeps the save and clears the picker', /OVERWRITE/.test(c2.body) && c2.top && kept.lv === 12 && kept.input === '', { body: c2.body.slice(0, 90), kept });
  ok('[6] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
