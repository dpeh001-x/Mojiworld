// Headless certification of the SECURE SAVE feature: signed export, import
// verification, tamper detection, and cross-impl consistency with Node's HMAC.
import { chromium } from 'playwright-core';
import crypto from 'node:crypto';
const URL = 'http://localhost:8080/mojiworld_game.html';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
let pass = 0, fail = 0;
const ok = (n, c, d) => { (c ? pass++ : fail++); console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d ? '  ' + JSON.stringify(d) : '')); };

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 45000 }).catch(() => {});
await page.click('#menu-newgame').catch(() => {});
await page.waitForSelector('#auth-user', { state: 'visible', timeout: 10000 }).catch(() => {});
await page.fill('#auth-user', 'Vault').catch(() => {});
await page.click('#auth-submit').catch(() => {});
await page.waitForFunction(() => { const c = document.getElementById('class-select-modal'); return c && getComputedStyle(c).display !== 'none'; }, null, { timeout: 15000 }).catch(() => {});
await page.evaluate(() => { try { applyClass('warrior'); } catch (e) {} });
await page.waitForTimeout(1200);
// Ensure SAVE_KEY is populated (saveState is gated during the prologue). Seed a
// representative save so exportSaveSecure has real bytes to sign.
await page.evaluate(() => {
  try { window._prologueActive = false; window._prologuePending = false; } catch (e) {}
  try { if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow(); } catch (e) {}
  if (!localStorage.getItem(SAVE_KEY)) {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, player: { cls: 'warrior', level: 7, mojicoins: 1234 }, savedAt: 1 }));
  }
});
await page.waitForTimeout(200);
const hasSaveNow = await page.evaluate(() => !!localStorage.getItem(SAVE_KEY));
ok('a save exists to secure', hasSaveNow);

// 1) The API + UI exist.
const surf = await page.evaluate(() => ({
  fns: ['exportSaveSecure', '_lxHmacSaveHex', '_lxSaveSigBody', '_lxSigEqual', '_lxSha256Bytes'].every(f => typeof window[f] === 'function'),
  btn: !![...document.querySelectorAll('button')].find(b => /secure save/i.test(b.textContent)),
  accept: (document.getElementById('save-import-file') || {}).accept || '',
}));
ok('secure-save functions present', surf.fns);
ok('🔒 Secure Save button present in Hard Save panel', surf.btn);
ok('import input accepts .mojisave', surf.accept.includes('.mojisave'), { accept: surf.accept });

// 2) Build a signed payload exactly as exportSaveSecure would, then check the
//    signature verifies with the SAME in-game HMAC.
const built = await page.evaluate(() => {
  const data = localStorage.getItem(SAVE_KEY) || '{}';
  const body = { _lxSave: 2, alg: 'hmac-sha256', key: SAVE_KEY, gameV: SAVE_VERSION, savedAt: 1620000000000, data: data };
  body.sig = _lxHmacSaveHex(_lxSaveSigBody(body));
  return { body, canonical: _lxSaveSigBody(body), selfVerify: _lxSigEqual(_lxHmacSaveHex(_lxSaveSigBody(body)), body.sig) };
});
ok('freshly-signed save self-verifies', built.selfVerify);

// 3) Cross-impl: the in-game HMAC equals Node's HMAC over the same canonical body + secret.
const SECRET = await page.evaluate(() => _LX_SAVE_SECRET);
const nodeSig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(Buffer.from(built.canonical, 'utf8')).digest('hex');
ok('in-game HMAC matches Node crypto HMAC (portable)', nodeSig === built.body.sig, { game: built.body.sig.slice(0, 16), node: nodeSig.slice(0, 16) });

// 4) Tamper detection: flip one byte of data -> verdict flips to bad; restore -> ok.
const verdicts = await page.evaluate(() => {
  const good = JSON.parse(JSON.stringify((() => {
    const data = localStorage.getItem(SAVE_KEY) || '{}';
    const b = { _lxSave: 2, alg: 'hmac-sha256', key: SAVE_KEY, gameV: SAVE_VERSION, savedAt: 111, data };
    b.sig = _lxHmacSaveHex(_lxSaveSigBody(b)); return b;
  })()));
  const verify = (o) => { try { return _lxSigEqual(_lxHmacSaveHex(_lxSaveSigBody(o)), o.sig) ? 'ok' : 'bad'; } catch (e) { return 'bad'; } };
  const okV = verify(good);
  // tamper the inner data (e.g. a cheater bumps a value)
  const edited = JSON.parse(JSON.stringify(good)); edited.data = good.data.replace(/\}$/, ',"x":1}');
  const badV = verify(edited);
  // tamper the savedAt header
  const edited2 = JSON.parse(JSON.stringify(good)); edited2.savedAt = 999;
  const badV2 = verify(edited2);
  // forged sig
  const edited3 = JSON.parse(JSON.stringify(good)); edited3.sig = 'deadbeef';
  const badV3 = verify(edited3);
  return { okV, badV, badV2, badV3 };
});
ok('untampered signed save verifies OK', verdicts.okV === 'ok', verdicts);
ok('edited save DATA is detected (bad)', verdicts.badV === 'bad', verdicts);
ok('edited save HEADER (savedAt) is detected (bad)', verdicts.badV2 === 'bad', verdicts);
ok('forged signature is detected (bad)', verdicts.badV3 === 'bad', verdicts);

// 5) exportSaveSecure actually writes a .mojisave download with a valid signed
//    body. Intercept the real bytes via URL.createObjectURL + the anchor's
//    download name (Playwright's blob-download capture is flaky headless).
const dl = await page.evaluate(() => new Promise((resolve) => {
  const origCreate = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
  let name = '';
  HTMLAnchorElement.prototype.click = function () { name = this.download || name; };
  URL.createObjectURL = function (blob) {
    const fr = new FileReader();
    fr.onload = () => { URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick; resolve({ name, text: String(fr.result || '') }); };
    fr.readAsText(blob);
    return 'blob:captured';
  };
  try { exportSaveSecure(); } catch (e) { resolve({ name, text: '', err: String(e) }); }
  setTimeout(() => { URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick; resolve({ name, text: '' }); }, 4000);
}));
let dlOk = false;
try { const o = JSON.parse(dl.text); dlOk = o._lxSave === 2 && o.alg === 'hmac-sha256' && typeof o.sig === 'string' && o.sig.length === 64 && crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(Buffer.from(String(o.key) + '\n' + String(o.gameV) + '\n' + String(o.savedAt) + '\n' + String(o.data), 'utf8')).digest('hex') === o.sig; } catch (e) {}
ok('exportSaveSecure writes a .mojisave file', /\.mojisave$/.test(dl.name), { name: dl.name });
ok('exported file is a valid signed secure save', dlOk);

ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
