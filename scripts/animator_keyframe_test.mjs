// Animator key frames (v0.30.1390 anim-key): the preview shows WHERE THE GAME LANDS THE HIT. Per user, the hand-set boss
// timings stay as they are; the game lands every blow on its hit (v0.30.1363 key frames), so the animator marks that
// frame - the blow - on the timing strip and flashes a HIT marker on the stage while it is drawn.
//   PORT=<static server port> node scripts/animator_keyframe_test.mjs
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const PORT = process.env.PORT || '8080';
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
// the game's own table, read from the game file
const gm = readFileSync(new URL('../mojiworld_game.html', import.meta.url), 'utf8').match(/const LX_BOSS_KEY_FRAME = \{([^}]*)\}/);
const GAME_KEYS = Object.fromEntries([...(gm ? gm[1] : '').matchAll(/([a-zA-Z_][a-zA-Z0-9_]*): *(\d+)/g)].map((x) => [x[1], +x[2]]));
const strikeOf = (ft) => { let s = 0, b = -1; ft.forEach((v, i) => { const w = v > 0 ? v : 48; if (w > b) { b = w; s = i; } }); return s; };
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const p = await b.newContext({ serviceWorkers: 'block' }).then((c) => c.newPage());
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(`http://localhost:${PORT}/monster_animator.html?nojump`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__core && window.__core.keyFrame && window.__app && window.__buildControls, null, { timeout: 30000 });
  await p.waitForTimeout(800);

  // 1) the table is the game's, and the fallback is the game's (_lxBossKeyFrame -> _lxFtStrike)
  const t = await p.evaluate(() => ({ table: window.__core.LX_BOSS_KEY_FRAME,
    calib: Object.fromEntries(Object.entries(window.LX_ANIM_CALIB || {}).filter(([, v]) => v && v.attack && Array.isArray(v.attack.ft)).map(([k, v]) => [k, v.attack.ft])),
    kf: null }));
  ok('the animator\'s key-frame table equals the game\'s', Object.keys(GAME_KEYS).length >= 7 && JSON.stringify(t.table) === JSON.stringify(GAME_KEYS), { anim: t.table, game: GAME_KEYS });
  const probe = await p.evaluate((keys) => keys.map(([k, ft]) => [k, window.__core.keyFrame(k, ft.length, ft)]), Object.entries(t.calib));
  const wrong = probe.filter(([k, v]) => v !== (k in GAME_KEYS && GAME_KEYS[k] < t.calib[k].length ? GAME_KEYS[k] : strikeOf(t.calib[k])));
  ok(`every attack set's blow is the game's (${probe.length} sets: named key, else the longest-held frame)`, probe.length > 100 && wrong.length === 0, wrong.slice(0, 6));

  // 2) the timing strip marks the blow - one hand-set boss, one generated boss, one monster
  const strip = async (key) => p.evaluate(async (key) => {
    const A = window.__app; A.select(key); A.setFocus('attack');
    for (let i = 0; i < 60 && !(A.frameCount && A.frameCount('attack') > 1); i++) await new Promise((r) => setTimeout(r, 100));
    window.__buildControls(); await new Promise((r) => setTimeout(r, 50));
    const marks = [...document.querySelectorAll('#ft-strip .ftkey')].map((el) => +el.parentElement.querySelector('.ftms').dataset.i);
    const head = (document.getElementById('ft-total') || {}).parentElement;
    return { marks, head: head ? head.textContent.replace(/\s+/g, ' ') : '' };
  }, key);
  const s1 = await strip('gravitos2laser');
  ok('gravitos2laser: the strip marks f8 as the blow, and notes the frame it holds longest (f5)', s1.marks.join() === '7' && /blow f8/.test(s1.head) && /held longest: f5/.test(s1.head), s1);
  const s2 = await strip('legosaurusdash');
  ok('legosaurusdash: the blow is f7, not its 700 ms brace (f1)', s2.marks.join() === '6' && /held longest: f1/.test(s2.head), s2);
  const s2b = await strip('gravitossoul');
  ok('gravitossoul: blow f6, and no note - its f5 is held just as long (170 ms), not longer', s2b.marks.join() === '5' && /blow f6/.test(s2b.head) && !/held longest/.test(s2b.head), s2b);
  const s3 = await strip('kingKrook');
  const kkS = t.calib.kingKrook ? strikeOf(t.calib.kingKrook) : -1;
  ok('kingKrook (generated timing): the blow is its strike, and no "held longest" note', s3.marks.join() === String(kkS) && !/held longest/.test(s3.head), { ...s3, strike: kkS });
  const mob = Object.keys(t.calib).find((k) => !(k in GAME_KEYS) && k === 'anglerfish') || 'anglerfish';
  const s4 = await strip(mob);
  ok(`${mob} (monster): the blow is its strike`, t.calib[mob] && s4.marks.join() === String(strikeOf(t.calib[mob])), s4);
  const idle = await p.evaluate(async () => { window.__app.setFocus('idle'); window.__buildControls(); await new Promise((r) => setTimeout(r, 50)); return document.querySelectorAll('#ft-strip .ftkey').length; });
  ok('idle strips carry no blow mark', idle === 0, { idle });

  // 3) the stage flashes the HIT marker exactly while the blow frame is drawn
  const stage = await p.evaluate(async () => {
    const A = window.__app; A.select('gravitos2laser'); A.setFocus('attack');
    for (let i = 0; i < 80 && !(A.frameCount('attack') >= 9); i++) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 400));
    const said = []; const P = CanvasRenderingContext2D.prototype, of = P.fillText;
    P.fillText = function (txt) { said.push(String(txt)); return of.apply(this, arguments); };
    const rows = [];
    try {
      for (const ov of [false, true]) {
        A.setOverlay(ov);
        const t0 = performance.now() + 5000;
        for (let ms = 0; ms < 800; ms += 10) {
          A._setNow(t0 + ms); said.length = 0; A.paint();
          rows.push({ ov, f: A.shownFrame('attack'), hit: said.some((x) => x.includes('HIT')) });
        }
      }
    } finally { P.fillText = of; A.setOverlay(false); }
    return rows;
  });
  const onKey = stage.filter((r) => r.f === 7), offKey = stage.filter((r) => r.f !== 7 && r.f >= 0);
  ok('the stage shows HIT on every paint of the blow frame (columns + overlay)', onKey.length >= 4 && onKey.every((r) => r.hit) && onKey.some((r) => r.ov) && onKey.some((r) => !r.ov), { n: onKey.length, miss: onKey.filter((r) => !r.hit).length });
  ok('and never on another frame', offKey.length > 20 && offKey.every((r) => !r.hit), { n: offKey.length, bad: offKey.filter((r) => r.hit).slice(0, 4) });
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} finally { await b.close(); }
let pass = 0; for (const r of results) { if (r.pass) pass++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.pass ? '' : '  ' + JSON.stringify(r.x).slice(0, 400)}`); }
console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
