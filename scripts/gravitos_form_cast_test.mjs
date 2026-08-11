// Forms 2 and 3 now have their own punch / soul / laser cast art. This proves
// the art is WIRED, not merely present — the failure mode this session keeps
// hitting is one half landing silently (art with no code, code with no art).
//
// The end-to-end assertion is the last group: build a real mob object for each
// form and pattern, call the actual frame picker the renderer calls, and read
// which file the returned image came from.
//   node scripts/gravitos_form_cast_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const KEYS = ['gravitos2punch', 'gravitos2soul', 'gravitos2laser',
              'gravitos3punch', 'gravitos3soul', 'gravitos3laser'];
for (const k of KEYS) {
  let n = 0; for (let i = 0; i < 9; i++) if (existsSync(`Sprites/bosses/attack/${k}_${i}.webp`)) n++;
  ok(`${k}: 9 frames on disk`, n === 9, { found: n });
}

const net = await import('node:net');
let PORT = process.argv[2];
if (!PORT) {
  const free = (p) => new Promise((r) => { const s = net.createServer();
    s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
  for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
}
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = [], bad = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().split('/').slice(-2).join('/')); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _gravCastKey === 'function' && typeof BOSS_ATTACK_FRAMES === 'object', { timeout: 120000 });

const r = await page.evaluate(async (KEYS) => {
  const dec = (s) => { let n = 0; for (const im of (s || [])) if (im && im.complete && im.naturalWidth > 0) n++; return n; };
  const t0 = Date.now();
  while (Date.now() - t0 < 30000 && KEYS.some(k => dec(BOSS_ATTACK_FRAMES[k]) < 9)) await new Promise(z => setTimeout(z, 300));
  const out = { decoded: {}, keys: {}, picked: {}, fallback: {}, registered: {} };
  for (const k of KEYS) { out.decoded[k] = dec(BOSS_ATTACK_FRAMES[k]); out.registered[k] = BOSS_SPRITE_TYPES.indexOf(k) >= 0; }

  const mob = (phase, pattern) => ({ type: 'gravitos', patternState: pattern, patternTimer: 500,
    _phaseSprite: phase ? 'gravitos' + phase : null, phase: phase || 1 });
  for (const [form, ps] of [[0, null], [2, 'gravitos2'], [3, 'gravitos3']]) {
    const m = { _phaseSprite: ps };
    out.keys[form] = { punch: _gravCastKey(m, 'punch'), soul: _gravCastKey(m, 'soul'), laser: _gravCastKey(m, 'laser') };
  }
  // What the RENDERER would actually draw, per form and pattern.
  const src = (img) => img ? decodeURIComponent(img.src).split('/').pop() : null;
  for (const [form, pattern, fn] of [
    [0, 'crush', '_gravitosPunchFrame'], [2, 'crush', '_gravitosPunchFrame'], [3, 'slam', '_gravitosPunchFrame'],
    [0, 'soulDrain', '_gravitosSoulFrame'], [2, 'soulDrain', '_gravitosSoulFrame'], [3, 'soulDrain', '_gravitosSoulFrame'],
    [0, 'laser', '_gravitosLaserFrame'], [2, 'laser', '_gravitosLaserFrame'], [3, 'laser', '_gravitosLaserFrame'],
  ]) out.picked[`${form}/${pattern}`] = src(window.eval(fn)(mob(form, pattern)));

  // Fallback: hide a form set and the picker must fall back to form 1's, not break.
  const save = BOSS_ATTACK_FRAMES['gravitos2laser'];
  BOSS_ATTACK_FRAMES['gravitos2laser'] = [];
  out.fallback.laser2 = _gravCastKey({ _phaseSprite: 'gravitos2' }, 'laser');
  out.fallback.picked = src(_gravitosLaserFrame(mob(2, 'laser')));
  BOSS_ATTACK_FRAMES['gravitos2laser'] = save;
  return out;
}, KEYS);
await b.close(); try { srv.kill(); } catch (e) {}

for (const k of KEYS) {
  ok(`${k}: registered in BOSS_SPRITE_TYPES`, r.registered[k] === true, {});
  ok(`${k}: 9 frames decode in-game`, r.decoded[k] === 9, { decoded: r.decoded[k] });
}
ok('form 1 still resolves to its own cast keys', r.keys['0'].punch === 'gravitospunch' && r.keys['0'].soul === 'gravitossoul' && r.keys['0'].laser === 'gravitoslaser', r.keys['0']);
ok('form 2 resolves to the form-2 cast keys', r.keys['2'].punch === 'gravitos2punch' && r.keys['2'].soul === 'gravitos2soul' && r.keys['2'].laser === 'gravitos2laser', r.keys['2']);
ok('form 3 resolves to the form-3 cast keys', r.keys['3'].punch === 'gravitos3punch' && r.keys['3'].soul === 'gravitos3soul' && r.keys['3'].laser === 'gravitos3laser', r.keys['3']);

const want = { '0/crush': 'gravitospunch', '2/crush': 'gravitos2punch', '3/slam': 'gravitos3punch',
  '0/soulDrain': 'gravitossoul', '2/soulDrain': 'gravitos2soul', '3/soulDrain': 'gravitos3soul',
  '0/laser': 'gravitoslaser', '2/laser': 'gravitos2laser', '3/laser': 'gravitos3laser' };
for (const [k, pre] of Object.entries(want)) {
  ok(`renderer draws ${pre}_* for ${k}`, !!r.picked[k] && r.picked[k].startsWith(pre + '_'), { got: r.picked[k] });
}
// The bug this fixes: forms 2/3 drew FORM 1's soul art, un-evolving the boss.
ok('Soul Drain no longer draws form-1 art on forms 2/3',
   r.picked['2/soulDrain'] !== r.picked['0/soulDrain'] && r.picked['3/soulDrain'] !== r.picked['0/soulDrain'],
   { form1: r.picked['0/soulDrain'], form2: r.picked['2/soulDrain'], form3: r.picked['3/soulDrain'] });
ok('a missing form set falls back to form 1 instead of breaking',
   r.fallback.laser2 === 'gravitoslaser' && !!r.fallback.picked && r.fallback.picked.startsWith('gravitoslaser_'), r.fallback);
ok('no 404s', bad.length === 0, bad.slice(0, 6));
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (!x.pass && x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
