// The game points at its own Patreon (v0.30.445). Per user: "could you help me push improving, advertise
// https://www.patreon.com/c/Mojiworld". Nothing in the game linked it, so every player of the hosted build and the
// portable zip left without learning the page exists.
// Checks the REAL title screen: the link is in the main menu, carries the exact URL, opens safely in a new tab, is
// visible and clickable once the menu is up, and sits below the five menu cards rather than competing with them.
//   node scripts/patreon_link_test.mjs      MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree
// Negative control: any build before this one has no #lo-support at all.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10271); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const URL_WANT = 'https://www.patreon.com/c/Mojiworld';
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('lo-auth') !== null, null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const o = { ver: (typeof GAME_VERSION === 'string') ? GAME_VERSION : '?' };
    // show the menu the way the boot does, so what is measured is the screen a player actually sees. .lo-auth is
    // display:none until it gains the 'shown' class (#loading-overlay .lo-auth.shown), so clearing [hidden] alone
    // leaves every child a 0x0 box - which is exactly what the first run of this test measured.
    const ov = document.getElementById('loading-overlay'); if (ov) { ov.classList.add('menu-up'); ov.style.display = 'flex'; }
    const auth = document.getElementById('lo-auth'); if (auth) { auth.hidden = false; auth.classList.add('shown'); }
    await new Promise((r) => setTimeout(r, 400));
    const a = document.getElementById('lo-support');
    o.exists = !!a;
    if (!a) return o;
    o.href = a.getAttribute('href'); o.target = a.getAttribute('target'); o.rel = a.getAttribute('rel') || '';
    o.text = (a.textContent || '').trim();
    const cs = getComputedStyle(a); o.display = cs.display; o.visibility = cs.visibility; o.opacity = +cs.opacity;
    const rect = a.getBoundingClientRect(); o.rect = { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top) };
    o.inMenu = !!(a.closest('#lo-auth'));
    // the link must sit BELOW the five menu cards, not among them
    const menu = document.getElementById('lo-menu'); const mr = menu ? menu.getBoundingClientRect() : null;
    o.belowMenu = !!(mr && rect.top >= mr.bottom - 1); o.menuCards = menu ? menu.querySelectorAll('button.menu-item').length : 0;
    // the element the browser would actually hit at the link's centre is the link (nothing covers it)
    const hit = document.elementFromPoint(Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2));
    o.hittable = !!(hit && (hit === a || a.contains(hit)));
    return o;
  });
  console.log('build ' + r.ver + (r.exists ? ' link "' + r.text + '"' : ' NO #lo-support'));
  ok('the title screen carries a support link inside the main menu', r.exists && r.inMenu, JSON.stringify({ exists: r.exists, inMenu: r.inMenu }));
  ok('it points at exactly ' + URL_WANT, r.href === URL_WANT, r.href);
  ok('it opens in a new tab without handing over window.opener (target=_blank + rel noopener)', r.target === '_blank' && /noopener/.test(r.rel), r.target + ' / ' + r.rel);
  ok('it says what it is (names Patreon and support)', /patreon/i.test(r.text) && /support/i.test(r.text), r.text);
  ok('it is actually visible and clickable, not a zero-box or a covered element', r.display !== 'none' && r.visibility !== 'hidden' && r.opacity > 0.3 && r.rect && r.rect.w > 60 && r.rect.h > 6 && r.hittable, JSON.stringify({ display: r.display, opacity: r.opacity, rect: r.rect, hittable: r.hittable }));
  ok('it sits below the five menu cards rather than competing with them', r.belowMenu && r.menuCards >= 4, JSON.stringify({ belowMenu: r.belowMenu, menuCards: r.menuCards }));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
