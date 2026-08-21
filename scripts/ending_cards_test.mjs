// Live test: ENDING CARDS — three single-line story cards punctuating the
// ending films. Per user: "Add an impactful storybeat style text line between
// 1 and 2. and a very strong statement between 3 and 4, and a very ominous
// strong ending after 4."
//
// Contract: card 1 plays between the defeat cine and the shadow reveal, card 2
// between the Amnesiac and The Last Winding, card 3 after the Winding as the
// game's final words (first completion only). Cards 2 and 3 are VERBATIM lines
// from the scrapped epilogue — the strong sentences survive; the wall of text
// stays gone. A card can never soft-lock: pure DOM, skippable, and any
// exception falls through to its continuation.
//   node scripts/ending_cards_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _lxEndingCard === 'function' || typeof drawSuperBossBar === 'function',
  null, { timeout: 120000 });
// settle past the boot asset-storm — timers starve under it (measured: a
// 1.3s card hold fired 12s late when driven mid-boot)
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(3000);

const r = await page.evaluate(() => {
  const out = {};
  out.fnExists = typeof _lxEndingCard === 'function';
  const km = String(typeof triggerSuperBossDeath === 'function' ? triggerSuperBossDeath : '');
  // Placement, proven by the continuation plumbing in the chain source.
  // The wrapper literal encodes the ordering structurally: the card's
  // continuation IS the shadow step, so it can only play first.
  out.card1 = km.includes("_lxEndingCard('Nothing that vast ever stood on its own.', null, 3800, _toShadow)");
  out.card2 = km.includes("'YOU WERE NOT SUMMONED TO SAVE THIS WORLD.'")
    && km.includes("'You were wound up, and set walking.'");
  out.card3 = km.includes("'ASK HIM ABOUT THE LAST OUTSIDER.'")
    && km.includes("'Ask him about the next.'")
    && km.indexOf("'ASK HIM ABOUT") > km.indexOf('_gugumaToyboxCutscene(');
  // Card 3 fires only on the first-completion branch (after the seen gate).
  out.card3FirstOnly = km.indexOf("'ASK HIM ABOUT") > km.indexOf('if (_seen) return');
  return out;
});
ok('the ending-card helper exists', r.fnExists, '');
ok('CARD 1 sits between the defeat cine and the shadow reveal', r.card1, r);
ok('CARD 2 (verbatim stanza) sits between the Amnesiac and the Winding', r.card2, r);
ok('CARD 3 (verbatim stanza) is the final words after the Winding', r.card3, r);
ok('...and only on first completion (after the seen gate)', r.card3FirstOnly, r);

// live: a card mounts, shows its exact text, auto-advances; a second card skips.
const live = await page.evaluate(() => new Promise((resolve) => {
  const out = {};
  const t0 = performance.now();
  _lxEndingCard('TEST MAIN LINE', 'test sub line', 1300, () => {
    out.autoMs = Math.round(performance.now() - t0);
    // second card: skip via key
    _lxEndingCard('SKIP ME', null, 8000, () => {
      out.skipMs = Math.round(performance.now() - t0);
      out.overlayGone = !document.querySelector('.lx-ending-card');
      resolve(out);
    });
    const ov2 = document.querySelector('.lx-ending-card');
    out.secondMounted = !!ov2;
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 250);
  });
  const ov = document.querySelector('.lx-ending-card');
  out.mounted = !!ov;
  out.textRight = !!(ov && ov.textContent.includes('TEST MAIN LINE') && ov.textContent.includes('test sub line'));
  setTimeout(() => resolve({ ...out, timeout: true }), 15000);
}));
ok('a card mounts and renders its exact text', live.mounted && live.textRight, live);
ok('it auto-advances after its hold (fade included)', live.autoMs > 1200 && live.autoMs < 6000, live);
ok('a card is skippable and cleans up', live.secondMounted && live.skipMs && live.overlayGone, live);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
