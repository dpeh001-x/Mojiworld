// v0.29.423 — co-op must be initiable without editing anything. Covers the two
// failures that made it impossible: the relay default pointed at the player's
// own machine, and every connect message went into a modal the menu flow never
// opens (so a 90s cold start and a hard failure both looked like silence).
//
//   node serve.js 8811 && node scripts/coop_seamless_test.mjs 8811
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8811';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_mpBanner') === 'function' && typeof eval('mpConnect') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

// --- the default endpoint ----------------------------------------------------
const cfg = await page.evaluate(() => ({
  fallback: eval('MP_FALLBACK_URL'),
  dflt: eval('MP_DEFAULT_URL'),
}));
ok('relay default is a wss:// URL (ws:// is blocked from an https page)', /^wss:\/\//.test(cfg.dflt), cfg.dflt);
ok('relay default is no longer the player\'s own machine', !/localhost|127\.0\.0\.1/.test(cfg.dflt), cfg.dflt);
ok('MP_FALLBACK_URL is the literal CI rewrites', typeof cfg.fallback === 'string' && cfg.fallback.length > 0, cfg.fallback);

// --- the banner lives OUTSIDE the multiplayer modal --------------------------
const banner = await page.evaluate(() => {
  eval('_mpBanner')('probe text', 'work', { dismiss: false });
  const el = document.getElementById('mp-banner');
  const modal = document.getElementById('multiplayer-modal');
  const out = {
    exists: !!el,
    visible: !!el && el.style.display !== 'none',
    insideModal: !!(el && modal && modal.contains(el)),
    modalHidden: !!modal && getComputedStyle(modal).display === 'none',
    text: el ? el.textContent : '',
    z: el ? +getComputedStyle(el).zIndex : 0,
  };
  eval('_mpBannerDismiss')();
  out.dismissed = !!el && el.style.display === 'none';
  return out;
});
ok('a connect banner exists', banner.exists);
ok('banner is NOT inside the multiplayer modal', banner.insideModal === false);
ok('banner shows while the modal is closed (the menu co-op case)', banner.visible && banner.modalHidden);
ok('banner renders its message', /probe text/.test(banner.text), banner.text);
ok('banner sits above the HUD', banner.z >= 10000, banner.z);
ok('banner can be dismissed', banner.dismissed === true);

// --- failure is announced, with a retry --------------------------------------
const fail = await page.evaluate(async () => {
  let retried = 0;
  eval('_mpBanner')('could not reach', 'bad', { retry: () => { retried++; } });
  const el = document.getElementById('mp-banner');
  const btns = [...el.querySelectorAll('button')].map(x => x.textContent);
  const rb = [...el.querySelectorAll('button')].find(x => /Retry/i.test(x.textContent));
  if (rb) rb.click();
  return { btns, retried, tone: el.style.borderColor };
});
ok('a failed join offers Retry', fail.btns.some(t => /Retry/i.test(t)), fail.btns);
ok('Retry actually re-fires the connect', fail.retried === 1);

// --- success hands over a shareable invite -----------------------------------
const invite = await page.evaluate(() => {
  // NB: do not name this local `net` — `const net = eval('net')` puts the
  // outer lookup inside the local binding's temporal dead zone and throws.
  const N = eval('net');
  const saved = N.baseRoom;
  N.baseRoom = 'dragon';
  const txt = eval('_mpInviteText')();
  eval('_mpBanner')('in party', 'good', { invite: true });
  const el = document.getElementById('mp-banner');
  const btns = [...el.querySelectorAll('button')].map(x => x.textContent);
  N.baseRoom = saved;
  eval('_mpBannerDismiss')();
  return { txt, btns };
});
ok('success banner offers Copy invite', invite.btns.some(t => /Copy invite/i.test(t)), invite.btns);
ok('invite text carries the party code in caps', /DRAGON/.test(invite.txt), invite.txt);
ok('invite text carries an auto-join link on the web', /[?&]join=DRAGON/.test(invite.txt), invite.txt);

// --- a dead relay must not hang forever --------------------------------------
const deadline = await page.evaluate(() => {
  const src = eval('mpConnect').toString();
  return {
    hasDeadTimer: /_deadTimer\s*=\s*setTimeout/.test(src),
    // anchor on the ASSIGNMENT — an earlier cut anchored on the first mention
    // of _deadTimer (its clearTimeout guard) and picked up the 1000ms tick of
    // the setInterval that sits between, reporting a 1s deadline.
    ms: (src.match(/_deadTimer\s*=\s*setTimeout\([\s\S]*?\},\s*(\d+)\);/) || [])[1],
    countsUp: /setInterval/.test(src),
  };
});
ok('connect has a hard deadline (no infinite "Waking...")', deadline.hasDeadTimer === true);
ok('deadline is generous enough for a ~90s cold start', +deadline.ms >= 100000, { ms: deadline.ms });
ok('the wait ticks a visible elapsed counter', deadline.countsUp === true);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail2 = 0;
for (const x of results) { (x.pass ? pass++ : fail2++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail2} checks passed`);
process.exit(fail2 ? 1 : 0);
