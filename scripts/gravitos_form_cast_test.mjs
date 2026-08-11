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

// Data-driven on purpose. Form 3's sets were withdrawn when every roll came back
// cropped or zoomed, and a test that hard-codes six sets would then fail for a
// deliberate decision — training you to ignore it. It asserts what SHOULD be
// true of each form given the art that exists: a form with art uses its own,
// and a form without art declines rather than borrowing another form's body.
const ALL = ['gravitos2punch', 'gravitos2soul', 'gravitos2laser',
             'gravitos3punch', 'gravitos3soul', 'gravitos3laser'];
const KEYS = [], ABSENT = [];
for (const k of ALL) {
  let n = 0; for (let i = 0; i < 9; i++) if (existsSync(`Sprites/bosses/attack/${k}_${i}.webp`)) n++;
  if (n === 9) KEYS.push(k);
  else if (n === 0) ABSENT.push(k);
  else ok(`${k}: partial set on disk — ${n}/9 frames`, false, { found: n });
}
console.log(`# present: ${KEYS.join(', ') || '(none)'}\n# absent : ${ABSENT.join(', ') || '(none)'}\n`);
ok('at least one form ships its own cast art', KEYS.length > 0, { present: KEYS.length });

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

const r = await page.evaluate(async ({ KEYS, ABSENT }) => {
  const dec = (s) => { let n = 0; for (const im of (s || [])) if (im && im.complete && im.naturalWidth > 0) n++; return n; };
  const t0 = Date.now();
  while (Date.now() - t0 < 30000 && KEYS.some(k => dec(BOSS_ATTACK_FRAMES[k]) < 9)) await new Promise(z => setTimeout(z, 300));
  const out = { decoded: {}, keys: {}, picked: {}, fallback: {}, registered: {}, absentReg: {} };
  for (const k of KEYS) { out.decoded[k] = dec(BOSS_ATTACK_FRAMES[k]); out.registered[k] = BOSS_SPRITE_TYPES.indexOf(k) >= 0; }
  // A key with no art must NOT be registered — the loader would request its
  // static sprite and 404, which the frame index does not gate.
  for (const k of ABSENT) out.absentReg[k] = BOSS_SPRITE_TYPES.indexOf(k) >= 0;

  const mob = (phase, pattern) => ({ type: 'gravitos', patternState: pattern, patternTimer: 500,
    _phaseSprite: phase ? 'gravitos' + phase : null, phase: phase || 1 });
  for (const [form, ps] of [[0, null], [2, 'gravitos2'], [3, 'gravitos3']]) {
    const m = { _phaseSprite: ps };
    out.keys[form] = { punch: _gravCastKey(m, 'punch'), soul: _gravCastKey(m, 'soul'), laser: _gravCastKey(m, 'laser') };
  }
  // What the RENDERER would actually draw, per form and pattern.
  const src = (img) => img ? decodeURIComponent(img.src).split('/').pop() : null;
  for (const [form, pattern, fn] of [
    [0, 'crush', '_gravitosPunchFrame'], [2, 'crush', '_gravitosPunchFrame'], [3, 'crush', '_gravitosPunchFrame'],
    [0, 'soulDrain', '_gravitosSoulFrame'], [2, 'soulDrain', '_gravitosSoulFrame'], [3, 'soulDrain', '_gravitosSoulFrame'],
    [0, 'laser', '_gravitosLaserFrame'], [2, 'laser', '_gravitosLaserFrame'], [3, 'laser', '_gravitosLaserFrame'],
  ]) out.picked[`${form}/${pattern}`] = src(window.eval(fn)(mob(form, pattern)));

  // Missing form set: the picker must decline (null) so the boss keeps its OWN
  // generic attack art. It must NOT borrow form 1's cast art — that is the
  // un-evolve bug, and it is worse than having no dedicated animation at all.
  const save = BOSS_ATTACK_FRAMES['gravitos2laser'];
  BOSS_ATTACK_FRAMES['gravitos2laser'] = [];
  out.fallback.key2 = _gravCastKey({ _phaseSprite: 'gravitos2' }, 'laser');
  out.fallback.picked = src(_gravitosLaserFrame(mob(2, 'laser')));
  BOSS_ATTACK_FRAMES['gravitos2laser'] = save;
  // form 1 with its own set absent still has nowhere else to go, and its own
  // key is the right answer there.
  out.fallback.key1 = _gravCastKey({ _phaseSprite: null }, 'laser');
  return out;
}, { KEYS, ABSENT });
await b.close(); try { srv.kill(); } catch (e) {}

for (const k of KEYS) {
  ok(`${k}: registered in BOSS_SPRITE_TYPES`, r.registered[k] === true, {});
  ok(`${k}: 9 frames decode in-game`, r.decoded[k] === 9, { decoded: r.decoded[k] });
}
for (const k of ABSENT) {
  ok(`${k}: NOT registered while its art is absent (a registered key 404s)`, r.absentReg[k] === false, {});
}
ok('form 1 still resolves to its own cast keys', r.keys['0'].punch === 'gravitospunch' && r.keys['0'].soul === 'gravitossoul' && r.keys['0'].laser === 'gravitoslaser', r.keys['0']);

// Per form and cast: use your OWN art when you have it, decline when you don't.
// Never another form's body.
for (const [form, pattern, cast] of [[2, 'crush', 'punch'], [2, 'soulDrain', 'soul'], [2, 'laser', 'laser'],
                                     [3, 'crush', 'punch'], [3, 'soulDrain', 'soul'], [3, 'laser', 'laser']]) {
  const key = `gravitos${form}${cast}`;
  const drew = r.picked[`${form}/${pattern}`];
  if (KEYS.includes(key)) {
    ok(`form ${form} ${cast}: resolves + renderer draws ${key}_*`,
       r.keys[String(form)][cast] === key && !!drew && drew.startsWith(key + '_'), { key: r.keys[String(form)][cast], drew });
  } else {
    ok(`form ${form} ${cast}: declines (no art) — falls back to its OWN generic set`,
       r.keys[String(form)][cast] === null && drew == null, { key: r.keys[String(form)][cast], drew });
  }
}
for (const [k, pre] of Object.entries({ '0/crush': 'gravitospunch', '0/soulDrain': 'gravitossoul', '0/laser': 'gravitoslaser' })) {
  ok(`renderer draws ${pre}_* for form 1 (${k})`, !!r.picked[k] && r.picked[k].startsWith(pre + '_'), { got: r.picked[k] });
}
// The bug this fixes: forms 2/3 drew FORM 1's soul art, un-evolving the boss.
// Whether or not a form has its own art, it must never draw form 1's.
ok('Soul Drain never draws form-1 art on forms 2/3',
   r.picked['2/soulDrain'] !== r.picked['0/soulDrain'] && r.picked['3/soulDrain'] !== r.picked['0/soulDrain'],
   { form1: r.picked['0/soulDrain'], form2: r.picked['2/soulDrain'], form3: r.picked['3/soulDrain'] });
ok('a form with NO cast art declines rather than borrowing form 1\'s body',
   r.fallback.key2 === null && r.fallback.picked == null, r.fallback);
ok('form 1 still resolves its own key when asked', r.fallback.key1 === 'gravitoslaser', r.fallback);
ok('no 404s', bad.length === 0, bad.slice(0, 6));
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (!x.pass && x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
