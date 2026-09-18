// SIGN NAMES + CURRENCY WORDS (v0.30.870, per user "Keep the zodiac fight toasts just use star-sign names" and "Currency
// write as Mojicoins standardise"). Zodiac fight toasts name the sign ("Gemini", "Virgo"), never the boss ("Gem & Mini",
// "Virga") - portal labels keep the boss's short name. Player-facing text calls the currency Mojicoins (not coins, gold or
// the coin emoji after an amount), and Setshards take the capital the HUD gives them.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/zodiac_sign_names_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11183';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof ZODIAC_SIGNS !== 'undefined', null, { timeout: 180000 }); await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const src = [...document.scripts].map((x) => x.textContent).join('\n'), html = document.documentElement.outerHTML;
    const lines = src.split('\n').filter((l) => !/^\s*\/\//.test(l));
    const toastLines = lines.filter((l) => l.includes('showToast('));
    const sign = typeof _lxZodiacSign === 'function' ? ZODIAC_SIGNS.map((z) => _lxZodiacSign(z)) : null;
    const gem = ZODIAC_SIGNS.find((z) => z.id === 'gemini');
    const old = ['Taur BULLDOZES', 'Virga ascends', 'Virga takes wing', "'Virga — Starburst'", 'Aqua summons',
      " coins, +'", "' mojicoins in '", "_fee + ' coins)'", '}c · +${m.shards}', 'A ticket costs 7 mojicoins', "' mojicoin fare", "% coin');", "}% coins`",
      "' coins; tier 6", 'levels, gold, scars', 'level, gold and gear', 'items and coins gathered', 'counts coins into', "costs only coins'", 'make the coins shinier',
      '% EXP/coins', 'quarter of your coin at', 'Your coin is not for my keeping', 'Coin purses run heavy', 'Need \' + COST + \'◈ setshards',
      "'Not enough setshards'", "'◈ setshards?", "' setshards for '", 'bosses drop +25% setshards', 'Brok pays setshards'];
    return {
      sign, portal: typeof _lxZodiacShort === 'function' ? _lxZodiacShort(gem) : null,
      shortInToasts: toastLines.filter((l) => /_lxZodiacShort\(|\$\{z\.name\}|\$\{_sign\.name\}/.test(l)).map((l) => l.trim().slice(0, 90)),
      coinEmojiToasts: toastLines.filter((l) => /\}\s?🪙|' ?🪙|\+ '🪙/.test(l)).map((l) => l.trim().slice(0, 90)),
      oldLeft: old.filter((t) => src.includes(t) || html.includes(t)),
      sigil: src.includes('name: `${_lxZodiacSign(_sign)} Sigil`'),
      signToasts: ['Taurus BULLDOZES', '♍ Virgo takes wing', '♒ Aquarius summons', 'BADGE EARNED — ${_lxZodiacSign(z)}', '_signName = _lxZodiacSign(z)'].filter((t) => !src.includes(t)),
    };
  });
  check(J(r.sign) === J(['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']), 'every zodiac boss is named by its sign in fight toasts', J(r.sign));
  check(r.portal === 'Gem & Mini', 'portal labels keep the boss short name', J(r.portal));
  check(r.shortInToasts.length === 0, 'no toast names a zodiac boss by its boss name', J(r.shortInToasts));
  check(r.signToasts.length === 0, 'the phase / volley / Taurus / Virgo / Aquarius / badge toasts use the sign', J(r.signToasts));
  check(r.sigil, 'a zodiac sigil is named for its sign ("Aries Sigil")');
  check(r.coinEmojiToasts.length === 0, 'no toast writes an amount with the coin emoji', J(r.coinEmojiToasts));
  check(r.oldLeft.length === 0, 'no player-facing coins / gold / mojicoins / setshards wording is left', J(r.oldLeft));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
