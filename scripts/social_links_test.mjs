// The title screen's community links (social-links). Per user: "put this in the links: Discord, Instagram,
// moji-studios.com. Make cute icons for all of them" (after "change [Patreon] to https://ko-fi.com/mojistudios").
// Checks the REAL title screen in its real compact layout, then the README and the changelog header.
//   PORT=10291 node scripts/social_links_test.mjs [candidate.html]     MOJI_GAME_FILE / LX_CHANGELOG_FILE honoured
import { chromium } from 'playwright-core';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10291';
const FILE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const WANT = [
  { id: 'lo-support', href: 'https://ko-fi.com/mojistudios', label: 'Ko-fi', name: /ko-?fi/i, svg: 'kofi' },
  { id: 'lo-discord', href: 'https://discord.gg/9CqQwXKcv', label: 'Discord', name: /discord/i, svg: 'discord' },
  { id: 'lo-instagram', href: 'https://www.instagram.com/mojistudios.official/', label: 'Instagram', name: /instagram/i, svg: 'instagram' },
  { id: 'lo-website', href: 'https://moji-studios.com', label: 'Website', name: /moji-studios\.com/i, svg: 'website' },
];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: FILE } });
await new Promise((r) => setTimeout(r, 1500));
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1630, height: 944 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('lo-auth') !== null, null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const measure = () => page.evaluate(async (WANT) => {
    // the menu as _showAuthGate brings it up: stack compact, auth shown
    const ov = document.getElementById('loading-overlay'); if (ov) { ov.classList.add('menu-up'); ov.style.display = 'flex'; }
    const stack = ov && ov.querySelector('.lo-stack'); if (stack) stack.classList.add('compact');
    const auth = document.getElementById('lo-auth'); if (auth) { auth.hidden = false; auth.classList.add('shown'); }
    await new Promise((r) => setTimeout(r, 2500));
    const o = { ver: (typeof GAME_VERSION === 'string') ? GAME_VERSION : '?' };
    const row = document.getElementById('lo-links'); o.row = !!row; if (!row) return o;
    const rr = row.getBoundingClientRect(), sr = stack.getBoundingClientRect(), menu = document.getElementById('lo-menu'), mr = menu.getBoundingClientRect();
    o.inMenu = !!row.closest('#lo-auth'); o.belowMenu = rr.top >= mr.bottom - 1; o.rowBottom = Math.round(rr.bottom); o.stackBottom = Math.round(sr.bottom); o.scrollTop = stack.scrollTop;
    o.links = [...row.querySelectorAll('a')].map((a) => {
      const r = a.getBoundingClientRect(), ico = a.querySelector('.lo-link-ico'), svg = a.querySelector('svg'), ir = ico ? ico.getBoundingClientRect() : null;
      const hit = ir ? document.elementFromPoint(ir.left + ir.width / 2, ir.top + ir.height / 2) : null;
      const cs = getComputedStyle(a);
      return { id: a.id, href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') || '', aria: a.getAttribute('aria-label') || '', title: a.getAttribute('title') || '',
        label: (a.querySelector('.lo-link-lab') || {}).textContent || '', svg: !!svg, svgHidden: svg && svg.getAttribute('aria-hidden') === 'true',
        ico: ir ? { l: ir.left, r: ir.right, t: ir.top, b: ir.bottom, w: Math.round(ir.width), h: Math.round(ir.height) } : null,
        visible: cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.3, hittable: !!(hit && a.contains(hit)), inRow: r.left >= rr.left - 1 && r.right <= rr.right + 1,
        insidePanel: r.left >= sr.left && r.right <= sr.right && r.bottom <= sr.bottom };
    });
    // each inline SVG must actually paint: serialise it, draw it, sample the gold ring and the middle
    o.paint = [];
    for (const a of row.querySelectorAll('a')) {
      const svg = a.querySelector('svg'); if (!svg) { o.paint.push(null); continue; }
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML);
      try { await img.decode(); } catch (e) { o.paint.push({ err: 'decode' }); continue; }
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
      const px = (X, Y) => [...x.getImageData(X, Y, 1, 1).data];
      const ring = px(4, 32), mid = px(32, 33), corner = px(1, 1);   // the ring's side, where its gradient is fully gold (the top is a pale highlight)
      o.paint.push({ ring, mid, corner, goldRing: ring[3] > 200 && ring[0] > 180 && ring[1] > 120 && ring[0] - ring[2] > 60, midInk: mid[3] > 200, cornerClear: corner[3] < 10 });
    }
    o.patreon = [...document.querySelectorAll('a[href]')].some((x) => /patreon/i.test(x.getAttribute('href'))) || /patreon/i.test(document.body.innerText || '');
    const ids = [...document.querySelectorAll('[id^="lxs-"]')].map((e) => e.id); o.dupIds = ids.length - new Set(ids).size;
    return o;
  }, WANT.map((w) => ({ id: w.id })));
  const r = await measure();
  console.log('build ' + r.ver + ' · row ' + (r.row ? r.links.map((l) => l.label).join(' / ') : 'MISSING'));
  check(r.row && r.inMenu && r.belowMenu, 'the link row is in the main menu, below the menu cards', { row: r.row, inMenu: r.inMenu, belowMenu: r.belowMenu });
  check(r.row && r.links.length === 4 && WANT.every((w, i) => r.links[i].id === w.id && r.links[i].href === w.href), 'four links, in order, with exactly the Ko-fi / Discord / Instagram / website addresses', r.links && r.links.map((l) => [l.id, l.href]));
  check(r.row && r.links.every((l) => l.target === '_blank' && /noopener/.test(l.rel)), 'every link opens in a new tab without handing over window.opener', r.links && r.links.map((l) => l.target + '/' + l.rel));
  check(r.row && WANT.every((w, i) => w.name.test(r.links[i].aria) && r.links[i].label.trim() === w.label), 'every link names its service to assistive tech and shows its label', r.links && r.links.map((l) => [l.aria, l.label]));
  check(r.row && r.links.every((l) => l.svg && l.svgHidden && l.ico && l.ico.w === 34 && l.ico.h === 34), 'every link carries an inline SVG badge, 34 px, hidden from assistive tech (the link names it)', r.links && r.links.map((l) => [l.svg, l.svgHidden, l.ico && l.ico.w]));
  check(r.paint && r.paint.length === 4 && r.paint.every((p) => p && p.goldRing && p.midInk && p.cornerClear), 'every badge paints: a gold ring, an inked middle, a clear corner', r.paint);
  check(r.row && r.links.every((l) => l.visible && l.hittable && l.inRow && l.insidePanel), 'every badge is visible, is what a click at its centre hits, and sits inside the panel', r.links && r.links.map((l) => [l.id, l.visible, l.hittable, l.insidePanel]));
  check(r.row && r.links.every((l, i) => i === 0 || l.ico.l >= r.links[i - 1].ico.r + 4), 'no two badges overlap', r.links && r.links.map((l) => l.ico && [Math.round(l.ico.l), Math.round(l.ico.r)]));
  check(!r.patreon && r.dupIds === 0, 'no Patreon link or mention on the title screen, and no duplicate SVG ids', { patreon: r.patreon, dupIds: r.dupIds });
  // hover: lifts and turns gold
  await page.hover('#lo-discord'); await page.waitForTimeout(450);
  const hv = await page.evaluate(() => { const a = document.getElementById('lo-discord'), k = document.getElementById('lo-support'); return { hover: getComputedStyle(a).color, rest: getComputedStyle(k).color, tf: getComputedStyle(a).transform }; });
  check(hv.hover === 'rgb(255, 209, 102)' && hv.rest !== hv.hover && hv.tf !== 'none', 'a hovered badge lifts and turns gold; the others stay at rest', hv);
  // a short screen: the row must still be inside the framed panel without scrolling
  await page.mouse.move(5, 5); await page.setViewportSize({ width: 1280, height: 720 });
  const s = await measure();
  check(s.row && s.rowBottom <= s.stackBottom && s.scrollTop === 0, 'at 1280x720 the whole row is visible inside the frame without scrolling', { rowBottom: s.rowBottom, stackBottom: s.stackBottom, scrollTop: s.scrollTop });
  // the files beside the game
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const imgs = [...readme.matchAll(/<img src="(assets\/social\/[a-z]+\.svg)"/g)].map((m) => m[1]);
  check(WANT.every((w) => readme.includes(w.href)) && imgs.length === 4 && imgs.every((p) => existsSync(path.join(ROOT, p))) && !/patreon\.com/i.test(readme), 'the README shows all four badges (files present) and all four links, and no Patreon', { imgs, missing: imgs.filter((p) => !existsSync(path.join(ROOT, p))) });
  const clPath = process.env.LX_CHANGELOG_FILE && existsSync(process.env.LX_CHANGELOG_FILE) ? process.env.LX_CHANGELOG_FILE : path.join(ROOT, 'CHANGELOG.html');
  const cl = readFileSync(clPath, 'utf8'); const meta = (cl.match(/<div class="meta">[\s\S]*?<\/div>/) || [''])[0];
  check(WANT.every((w) => meta.includes('href="' + w.href + '"')) && !/href="https?:\/\/(www\.)?patreon\.com/i.test(cl), "the changelog header links all four; no clickable Patreon link anywhere in it", { inHeader: WANT.map((w) => meta.includes('href="' + w.href + '"')) });
  const poster = readFileSync(path.join(ROOT, 'scripts', 'gen_monster_contact_sheet.mjs'), 'utf8');
  check(poster.includes('ko-fi.com/mojistudios') && !/patreon\.com/i.test(poster), 'the promo-poster generator still prints the Ko-fi page', {});
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
