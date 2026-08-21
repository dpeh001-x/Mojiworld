// Do the new FX sprites actually DECODE and get used, or does the game fall
// back to its procedural stand-in?
//
// The banner and the Rampage ring both ship a hand-drawn fallback for the
// window before their art decodes. That fallback is indistinguishable from
// "the art never shipped" unless you check the image itself — which is exactly
// how a working copy missing the files still looked wired: the banner drew as
// a plain red rectangle on a brown pole and reported no error anywhere.
// So: assert the decoded bitmap, not the presence of a draw call.
//   node scripts/fx_sprites_decode_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const ART = ['Sprites/fx/warlord_banner_planted.webp', 'Sprites/fx/rampage_pulse.webp'];
for (const f of ART) {
  ok(`${f} is on disk`, existsSync(f) && statSync(f).size > 3000, { bytes: existsSync(f) ? statSync(f).size : 0 });
  ok(`${f} is committed`, execFileSync('git', ['ls-files', '--', f], { encoding: 'utf8' }).trim() === f, {});
}

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
const failed404 = [];
page.on('response', (res) => { if (res.status() >= 400 && /Sprites\/fx\//.test(res.url())) failed404.push(res.url().split('/').pop() + ' ' + res.status()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof LX_FX === 'object' && typeof SKILL_FNS === 'object', { timeout: 120000 });
await page.waitForTimeout(3500);   // let the FX preload settle

const r = await page.evaluate(async () => {
  const out = {};
  const probe = (key) => {
    const img = LX_FX && LX_FX[key];
    return {
      registered: !!img,
      complete: !!(img && img.complete),
      w: img ? img.naturalWidth : 0, h: img ? img.naturalHeight : 0,
      ready: (typeof _lxFxReady === 'function') ? !!_lxFxReady(img) : null,
      src: img && img.src ? img.src.split('/').pop() : null,
    };
  };
  // force a decode attempt for anything still pending
  for (const k of ['warlord_banner_planted', 'rampage_pulse']) {
    const im = LX_FX && LX_FX[k];
    if (im && !im.complete) { try { await im.decode(); } catch (e) {} }
  }
  out.banner = probe('warlord_banner_planted');
  out.ring = probe('rampage_pulse');

  // and confirm the live skills reach the sprite path (not the fallback)
  game.paused = true;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.job = 'berserker'; player.master = 'warlord';
  player.hp = getMaxHp(); player.mp = 9999; player.skillCooldowns = {};
  game.hazards.length = 0;
  SKILL_FNS.warlord_warcry();
  const hz = game.hazards.find(h => h.type === 'warlord_banner');
  out.bannerHazard = !!hz;
  // the draw branch takes the sprite path iff _lxFxReady is true for the key
  out.bannerUsesSprite = !!(hz && typeof _lxFxReady === 'function' && _lxFxReady(LX_FX.warlord_banner_planted));
  game.hazards.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('banner:', JSON.stringify(r.banner));
console.log('ring  :', JSON.stringify(r.ring));
console.log('banner hazard planted:', r.bannerHazard, '| uses sprite (not fallback):', r.bannerUsesSprite);
if (failed404.length) console.log('FX 404s:', failed404.join(', '));

ok('the banner sprite is registered in LX_FX', r.banner.registered === true, r.banner);
ok('the banner sprite DECODES (real pixels, not a broken image)',
   r.banner.complete === true && r.banner.w > 50 && r.banner.h > 50, r.banner);
ok('the banner passes _lxFxReady — the draw takes the SPRITE path, not the procedural fallback',
   r.banner.ready === true && r.bannerUsesSprite === true, { ready: r.banner.ready, uses: r.bannerUsesSprite });
ok('the Rampage ring is registered in LX_FX', r.ring.registered === true, r.ring);
ok('the Rampage ring DECODES', r.ring.complete === true && r.ring.w > 50 && r.ring.h > 50, r.ring);
ok('the Rampage ring passes _lxFxReady', r.ring.ready === true, r.ring);
ok('no 404 for any FX sprite during boot', failed404.length === 0, failed404.slice(0, 5));
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
