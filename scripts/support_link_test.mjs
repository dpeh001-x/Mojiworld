// The game's support link points at Ko-fi (kofi). Per user: "remove the patreon link and change it to
// https://ko-fi.com/mojistudios". Checks the REAL title screen - the link is in the main menu, carries the exact URL,
// opens safely in a new tab, is visible and clickable, sits below the menu cards - and that no live Patreon link is
// left in the page, the README, the changelog or the promo-poster generator.
//   PORT=10271 node scripts/support_link_test.mjs [candidate.html]     MOJI_GAME_FILE / LX_CHANGELOG_FILE honoured
import { chromium } from 'playwright-core';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10271';
const FILE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const URL_WANT = 'https://ko-fi.com/mojistudios';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: FILE } });
await new Promise((r) => setTimeout(r, 1500));
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('lo-auth') !== null, null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const o = { ver: (typeof GAME_VERSION === 'string') ? GAME_VERSION : '?' };
    // show the menu the way the boot does: .lo-auth is display:none until it gains 'shown'
    const ov = document.getElementById('loading-overlay'); if (ov) { ov.classList.add('menu-up'); ov.style.display = 'flex'; }
    const auth = document.getElementById('lo-auth'); if (auth) { auth.hidden = false; auth.classList.add('shown'); }
    await new Promise((res) => setTimeout(res, 400));
    o.patreonLinks = [...document.querySelectorAll('a[href]')].filter((x) => /patreon/i.test(x.getAttribute('href'))).length;
    o.patreonText = /patreon/i.test(document.body.innerText || '');
    const a = document.getElementById('lo-support'); o.exists = !!a; if (!a) return o;
    o.href = a.getAttribute('href'); o.target = a.getAttribute('target'); o.rel = a.getAttribute('rel') || ''; o.text = (a.textContent || '').trim();
    const cs = getComputedStyle(a); o.display = cs.display; o.visibility = cs.visibility; o.opacity = +cs.opacity;
    const rect = a.getBoundingClientRect(); o.rect = { w: Math.round(rect.width), h: Math.round(rect.height) };
    o.inMenu = !!a.closest('#lo-auth');
    const menu = document.getElementById('lo-menu'); const mr = menu ? menu.getBoundingClientRect() : null;
    o.belowMenu = !!(mr && rect.top >= mr.bottom - 1); o.menuCards = menu ? menu.querySelectorAll('button.menu-item').length : 0;
    const hit = document.elementFromPoint(Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2));
    o.hittable = !!(hit && (hit === a || a.contains(hit)));
    return o;
  });
  console.log('build ' + r.ver + (r.exists ? ' link "' + r.text + '" -> ' + r.href : ' NO #lo-support'));
  check(r.exists && r.inMenu, 'the title screen carries a support link inside the main menu', r);
  check(r.href === URL_WANT, 'it points at exactly ' + URL_WANT, r.href);
  check(r.target === '_blank' && /noopener/.test(r.rel), 'it opens in a new tab without handing over window.opener', r.target + ' / ' + r.rel);
  check(/ko-?fi/i.test(r.text || '') && /support/i.test(r.text || ''), 'it says what it is (names Ko-fi and support)', r.text);
  check(r.display !== 'none' && r.visibility !== 'hidden' && r.opacity > 0.3 && r.rect && r.rect.w > 60 && r.rect.h > 6 && r.hittable, 'it is visible and clickable, not a zero-box or a covered element', r);
  check(r.belowMenu && r.menuCards >= 4, 'it sits below the menu cards rather than competing with them', { belowMenu: r.belowMenu, menuCards: r.menuCards });
  check(r.patreonLinks === 0 && !r.patreonText, 'no Patreon link or mention is left on the title screen', { links: r.patreonLinks, text: r.patreonText });
  // the files beside the game
  const live = (s) => (s.match(/href="https?:\/\/(www\.)?patreon\.com[^"]*"/gi) || []).length;
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  check(readme.includes(URL_WANT) && !/patreon\.com/i.test(readme), 'the README points at Ko-fi and no longer at Patreon', { kofi: readme.includes(URL_WANT), patreon: /patreon\.com/i.test(readme) });
  const clPath = process.env.LX_CHANGELOG_FILE && existsSync(process.env.LX_CHANGELOG_FILE) ? process.env.LX_CHANGELOG_FILE : path.join(ROOT, 'CHANGELOG.html');
  const cl = readFileSync(clPath, 'utf8');
  check(live(cl) === 0 && cl.includes('href="' + URL_WANT + '"'), 'the changelog header links Ko-fi; no clickable Patreon link remains (old entries keep their wording as history)', { livePatreon: live(cl), kofi: cl.includes('href="' + URL_WANT + '"') });
  const poster = readFileSync(path.join(ROOT, 'scripts', 'gen_monster_contact_sheet.mjs'), 'utf8');
  check(poster.includes('ko-fi.com/mojistudios') && !/patreon\.com/i.test(poster), 'the promo-poster generator prints the Ko-fi page in its footer', {});
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
