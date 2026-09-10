// The creator's CLASS page: four cards built from the class crests and job crests (no emoji),
// role chips, and the plate + ring frame. Per user: "improve on this section it needs to look
// like a AAA game" / "the icons please use the custom images rather than emoji".
//
//   node scripts/cs_class_cards_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11225);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const bad404 = [];
page.on('response', (r) => { if (r.status() >= 400 && /Sprites\/ui\/(Class\/|class_crest_)/.test(r.url())) bad404.push(r.status() + ' ' + r.url().split('/').pop()); });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.waitForTimeout(800);
await page.fill('#hero-name-input', 'Moji');
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const EMOJI = /\p{Extended_Pictographic}/u;
  const cards = [...document.querySelectorAll('#class-select-modal #class-options .class-card')];
  const dec = (im) => !!(im && im.complete && im.naturalWidth > 0);
  const optsBox = document.getElementById('class-options').getBoundingClientRect();
  const nav = document.querySelector('#class-select-modal .cs-page-nav');
  return {
    pageShown: getComputedStyle(document.getElementById('cs-page-class')).display !== 'none',
    cardsBottom: optsBox.bottom, navTop: nav ? nav.getBoundingClientRect().top : Infinity,
    cards: cards.map((c) => {
      const crest = c.querySelector('.cls-icon img.cls-crest');
      const mark = c.querySelector('img.cls-watermark');
      const jobs = [...c.querySelectorAll('.cls-jobs .cls-job img')];
      const cs = getComputedStyle(c);
      return {
        name: (c.querySelector('.cls-name') || {}).textContent,
        crest: crest ? { src: crest.src.split('/').slice(-1)[0], ok: dec(crest), w: crest.offsetWidth } : null,
        watermark: mark ? { ok: dec(mark) } : null,
        chips: c.querySelectorAll('.cls-role .cls-chip').length,
        jobs: jobs.length, jobsDecoded: jobs.filter(dec).length,
        emoji: EMOJI.test(c.textContent) || /→/.test(c.querySelector('.cls-jobs').textContent),
        border: cs.borderTopWidth + ' ' + cs.borderTopColor,
        ring: /rgba\(4, 2, 12, 0\.55\) 0px 0px 0px 1px/.test(cs.boxShadow),
        perks: c.querySelectorAll('.cls-perk').length,
        h: c.getBoundingClientRect().height,
      };
    }),
  };
});
await browser.close(); server.kill();

for (const c of r.cards) console.log(`  ${String(c.name).padEnd(8)} crest ${c.crest ? c.crest.src + (c.crest.ok ? ' ok ' : ' DEAD ') + Math.round(c.crest.w) + 'px' : 'none'}, chips ${c.chips}, jobs ${c.jobsDecoded}/${c.jobs}, perks ${c.perks}, h ${Math.round(c.h)}`);
const C = r.cards;
const checks = [
  ['the class page is showing with four cards', r.pageShown && C.length === 4, String(C.length)],
  ['every card leads with its class crest, decoded, at 56px', C.every((c) => c.crest && c.crest.ok && /^class_crest_/.test(c.crest.src) && Math.abs(c.crest.w - 56) < 2)],
  ['every card carries its weapon as a decoded watermark', C.every((c) => c.watermark && c.watermark.ok)],
  ['the role line is three chips', C.every((c) => c.chips === 3), C.map((c) => c.chips).join('/')],
  ['every job is named with its own decoded crest', C.every((c) => c.jobs >= 2 && c.jobsDecoded === c.jobs), C.map((c) => c.jobsDecoded + '/' + c.jobs).join(' ')],
  ['no emoji and no text arrow left on any card', C.every((c) => !c.emoji)],
  ['both perk plates survive the rebuild', C.every((c) => c.perks === 2)],
  ['the frame is the gold hairline with the dark ring', C.every((c) => /^1px rgba\(255, 220, 140/.test(c.border) && c.ring), C[0] && C[0].border],
  ['the four cards are the same height', Math.max(...C.map((c) => c.h)) - Math.min(...C.map((c) => c.h)) < 2, C.map((c) => Math.round(c.h)).join('/')],
  ['the cards clear the page nav (no clipping inside the modal\'s height cap)', r.cardsBottom <= r.navTop, `cards end ${Math.round(r.cardsBottom)}, nav starts ${Math.round(r.navTop)}`],
  ['no 404 for any crest', bad404.length === 0, bad404.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
