// THE DEV KEY IS A DIGEST (v0.30.924). The ` prompt compared a plain string that anyone could read in
// view-source, and it unlocks the same LX_DEV flag as the lock icon (hashed in v0.30.917). This pins both
// halves: the word is not in the shipped page, and the digest still accepts the real key.
//   [LX_DEV_KEY=<the key>] [SERVE_ROOT=<dir with serve.js>] node scripts/dev_key_digest_test.mjs [page.html]
// Without LX_DEV_KEY the round-trip checks are skipped; the source checks always run.
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11318';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };

// 1. the shipped source carries no plain key
const src = readFileSync(PAGE, 'utf8');
check(!/const LX_DEV_KEY = '/.test(src), 'no plain dev-key literal in the page');
check(!/_entry === LX_DEV_KEY/.test(src), 'the ` prompt does not compare a plain string');
check(/const _LX_DEV_KEY_SHA = '[0-9a-f]{64}'/.test(src), 'the key is stored as a SHA-256 digest');
check(/const _LX_DEV_PW_SHA = '[0-9a-f]{64}'/.test(src), 'the passphrase digest is still there (v0.30.917)');

const KEY = process.env.LX_DEV_KEY || '';
if (!KEY) console.log('SKIP the round-trip checks — set LX_DEV_KEY to the real key to run them');
else {
  const env = { ...process.env, MOJI_GAME_FILE: PAGE };
  const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
  await new Promise((r) => setTimeout(r, 1800));
  const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
  try {
    const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof _lxDevKeyOk === 'function', null, { timeout: 180000 });
    const r = await page.evaluate((k) => ({ real: _lxDevKeyOk(k), wrong: _lxDevKeyOk(k + 'x'), empty: _lxDevKeyOk(''), nul: _lxDevKeyOk(null) }), KEY);
    check(r.real === true, 'the real key still unlocks', JSON.stringify({ real: r.real }));
    check(r.wrong === false && r.empty === false && r.nul === false, 'a wrong, empty or null entry does not', JSON.stringify({ wrong: r.wrong, empty: r.empty, nul: r.nul }));
  } catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
  await browser.close(); server.kill();
}
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
