// Live test: the forge fail card's pity note as a pop-punk sticker (per user: "The section with the next
// attempt can be embellished to look nicer and pop").
//   * the text still reads "+N% success" in one run (forge_failure_card_test's contract)
//   * one pip per failed attempt: +6% -> 1, +18% -> 3, +30% -> 5, and the tag reads MAXED at the cap
//   * the bonus sits in a starburst (clip-path), the pill pops in (ecPityPop) and is a sticker (ink edge)
//   * a win right after a loss shows no pill (the doubled-id display rule must not beat :empty)
//   * the pill fits inside the card band
//   node scripts/forge_pity_sticker_test.mjs [port]   (MOJI_GAME_FILE honored)
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
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof openEnhancementModal === 'function' && typeof _showEnhanceFailure === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    try { _lxBootGateDone = true; } catch (e) {}
    const lo = document.getElementById('loading-overlay'); if (lo) lo.remove();
    window._ecArmDismiss = () => {};
    player.mojicoins = 99999999; const it = rollItemDrop(1, 40); player.inventory.push(it);
    openEnhancementModal();
    const el = document.getElementById('enhance-celebration'), p = document.getElementById('ec-pity');
    const out = {};
    for (const pv of [6, 18, 30]) {
      el.classList.remove('go', 'fail'); it.stars = 4;
      _showEnhanceFailure(it, { lostStar: false, pity: pv });
      await wait(1900);
      const cs = getComputedStyle(p), val = p.querySelector('.pp-val');
      const pr = p.getBoundingClientRect(), cr = el.querySelector('.ec-card').getBoundingClientRect();
      out[pv] = { text: p.textContent, on: p.querySelectorAll('.pp-pips i.on').length, pips: p.querySelectorAll('.pp-pips i').length,
        tag: (p.querySelector('.pp-tag') || {}).textContent, max: p.classList.contains('max'), display: cs.display,
        anim: cs.animationName, border: parseFloat(cs.borderTopWidth), font: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        star: val ? getComputedStyle(val, '::after').clipPath : '', inside: pr.top >= cr.top && pr.bottom <= cr.bottom };
    }
    el.classList.remove('go', 'fail'); it.stars = 4;
    _showEnhanceCelebration(it, 5); await wait(400);
    out.win = { text: p.textContent, display: getComputedStyle(p).display };
    return out;
  });
  for (const [pv, want] of [[6, 1], [18, 3], [30, 5]]) {
    const x = r[pv];
    ok(`+${pv}%: still reads "+${pv}% success" in one run`, new RegExp('\\+' + pv + '% success').test(x.text), x.text);
    ok(`+${pv}%: ${want} of 5 pips lit`, x.on === want && x.pips === 5, x);
    ok(`+${pv}%: tag reads ${pv >= 30 ? 'MAXED' : 'NEXT TRY'}`, x.tag === (pv >= 30 ? 'MAXED' : 'NEXT TRY') && x.max === (pv >= 30), x);
  }
  const s = r[6];
  ok('a sticker: shown as a flex row (the card blockifies inline-flex), ink edge, Nunito', /flex/.test(s.display) && s.border >= 2 && s.font === 'Nunito', s);
  ok('it pops in', /ecPityPop/.test(s.anim), s.anim);
  ok('the bonus sits in a starburst', /polygon/.test(s.star), s.star.slice(0, 40));
  ok('it fits inside the card band', [6, 18, 30].every((pv) => r[pv].inside), [6, 18, 30].map((pv) => r[pv].inside));
  ok('a win right after a loss shows no pill', r.win.text === '' && r.win.display === 'none', r.win);
  ok('no page errors', errs.length === 0, errs);
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== FORGE PITY STICKER ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
