// v0.29.423 — end-to-end proof that co-op can be INITIATED with zero setup:
// two real browser clients, the shipped default relay (nothing typed into
// Advanced), the same party code, each must see the other as a peer. Also
// exercises the ?join= invite link and the no-hero-yet pending join.
//
//   node serve.js 8813 && node scripts/coop_e2e_two_clients_test.mjs 8813
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8813';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
// Unique per run so a stale room from an earlier run can't fake a pass.
const CODE = 'E2E' + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 5).toUpperCase();

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
async function boot(label, query) {
  const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
  page.on('pageerror', e => console.log(`  [${label}] pageerror`, String(e).slice(0, 120)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html${query || ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { try { return typeof eval('mpConnect') === 'function' && !!eval('player'); } catch { return false; } }, null, { timeout: 180000 });
  return page;
}

const A = await boot('A');
const B = await boot('B');

// Give both a hero so mpConnect's hello is well-formed, then connect using the
// SHIPPED DEFAULT endpoint — the whole point is that nothing is configured.
const connect = (page, who) => page.evaluate(([code, who]) => {
  const p = eval('player');
  if (!p.cls) p.cls = 'warrior';
  p.level = 5;
  eval('mpConnect')(eval('MP_DEFAULT_URL'), who, code);
  return eval('MP_DEFAULT_URL');
}, [CODE, who]);

const urlA = await connect(A, 'AlphaHero');
await connect(B, 'BetaHero');
ok('both clients used the shipped default relay (nothing configured)', /^wss:\/\//.test(urlA), urlA);

const settled = (page) => page.waitForFunction(() => {
  try { const n = eval('net'); return n && n.connected === true; } catch { return false; }
}, null, { timeout: 150000 }).then(() => true).catch(() => false);

const [okA, okB] = await Promise.all([settled(A), settled(B)]);
ok('client A connected to the party', okA);
ok('client B connected to the party', okB);

// The actual co-op assertion: each sees the other.
const peers = (page) => page.waitForFunction(() => {
  try { const n = eval('net'); return n && n.peers && Object.keys(n.peers).length >= 1; } catch { return false; }
}, null, { timeout: 60000 }).then(() => page.evaluate(() => Object.values(eval('net').peers).map(p => p && p.name)))
  .catch(() => []);

const [pA, pB] = await Promise.all([peers(A), peers(B)]);
ok('A sees B in the party', pA.includes('BetaHero'), pA);
ok('B sees A in the party', pB.includes('AlphaHero'), pB);

// The success banner is what tells the player it worked.
const bannerA = await A.evaluate(() => {
  const el = document.getElementById('mp-banner');
  return { shown: !!el && el.style.display !== 'none', text: el ? el.textContent : '' };
});
ok('A got an on-screen confirmation naming the party',
   bannerA.shown && /In party/i.test(bannerA.text) && bannerA.text.includes(CODE),
   bannerA.text.slice(0, 90));
ok('the confirmation offers the invite copy', /Copy invite/i.test(bannerA.text), bannerA.text.slice(0, 90));

// --- the invite link path ----------------------------------------------------
const C = await boot('C', '?join=' + CODE);
const armed = await C.waitForFunction((code) => {
  try {
    const el = document.getElementById('menu-coop-code') || document.getElementById('mp-room');
    const saved = localStorage.getItem(eval('MP_ROOM_KEY'));
    return (saved || '').toUpperCase() === code || (el && (el.value || '').toUpperCase() === code);
  } catch { return false; }
}, CODE, { timeout: 30000 }).then(() => true).catch(() => false);
ok('?join= link picks the party code out of the URL', armed, CODE);

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed   (party ${CODE})`);
process.exit(fail ? 1 : 0);
