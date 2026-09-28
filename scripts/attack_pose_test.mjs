// Live test: the warrior's chop and the archer's draw (per user: "the warrior hand arm weapon swing" and "the archer
// pulling bow position of attack can also be nicer"). Read from the game's own rig by hooking the weapon draw (where
// the blade / bow actually is) and the canvas calls of the new pieces:
//   * warrior: the blade hangs BEHIND in the windup and cuts FORWARD-DOWN at the hit, in front of the body (the old
//     windmill had the hands overhead with the blade hanging back at the "hit"); a smear follows the blade tip through
//     the chop and nothing of it shows before or after
//   * archer: the bow is held out AHEAD of the body near shoulder height while aiming (it sat at the chest centre),
//     it stays upright, and a pulled string with a nocked arrow shows while drawing and is gone after the release
//   * the head never lifts off the torso in any basic swing (per user: "the head dislodges from the torso")
//   * layer order (per user): the weapon in front of the head, the front arm and hand in front of the weapon
//   The warrior's smear is a faint red crescent (per user) - detected by its red gradient.
//   node scripts/attack_pose_test.mjs [port]   (MOJI_GAME_FILE honored)
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
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof loadMap === 'function', null, { timeout: 120000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    try { _lxBootGateDone = true; } catch (e) {} try { _lxBootHold.release('menu'); } catch (e) {}
    // one draw: where the weapon is (hand + a point up the weapon, root units, x forward, y up) and what the new pieces drew
    const probe = (cls, t) => {
      const real = HERO_VEC_WEAPON[cls]; let M = null;
      HERO_VEC_WEAPON[cls] = function (c, o) { M = c.getTransform(); return real.call(this, c, o); };
      const oStroke = CanvasRenderingContext2D.prototype.stroke, oFill = CanvasRenderingContext2D.prototype.fill, seen = { gold: 0, pink: 0, str: 0 };
      const oStop = CanvasGradient.prototype.addColorStop;
      // the smear: a fill whose gradient starts in its red (rgba(255,96,96,...)) with a visible alpha
      CanvasGradient.prototype.addColorStop = function (o, col) { const m = /^rgba\(255,96,96,([0-9.e-]+)\)$/.exec(String(col).replace(/\s/g, '')); if (m && +m[1] > 0.1) seen.gold++; return oStop.call(this, o, col); };
      CanvasRenderingContext2D.prototype.stroke = function (...a) { const s = String(this.strokeStyle).replace(/\s/g, '');
        if (s === '#efe0b0' && this.getTransform().a === 1 && this.getTransform().b === 0) seen.str++; return oStroke.apply(this, a); };
      CanvasRenderingContext2D.prototype.fill = function (...a) { if (String(this.fillStyle) === '#ff2f86') seen.pink++; return oFill.apply(this, a); };
      try {
        const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400; const c = cv.getContext('2d');
        c.translate(200, 300); c.scale(2, 2); const R = c.getTransform();
        _drawVectorHero(-14, -44, c, { cls, lookCustom: player.lookCustom || {}, animName: 'attack_' + cls, animTime: t, forcedFacing: 1 });
        if (!M) return { none: true, seen };
        const inv = R.inverse(), pt = (x, y) => { const p = inv.transformPoint(M.transformPoint(new DOMPoint(x, y))); return [p.x, -p.y]; };
        const h = pt(0, 0), tip = pt(0, -14);
        return { hand: h.map((v) => Math.round(v * 10) / 10), tip: tip.map((v) => Math.round(v * 10) / 10), ang: Math.round(Math.atan2(tip[1] - h[1], tip[0] - h[0]) * 180 / Math.PI), seen };
      } finally { HERO_VEC_WEAPON[cls] = real; CanvasRenderingContext2D.prototype.stroke = oStroke; CanvasRenderingContext2D.prototype.fill = oFill; CanvasGradient.prototype.addColorStop = oStop; }
    };
    // the head stays on the neck: the head's bob never lifts it (y < 0) through any basic swing
    const lift = {};
    for (const an of ['attack_warrior', 'attack_rogue', 'attack_mage', 'attack_archer', 'attack']) {
      let worst = 0;
      for (let i = 0; i <= 50; i++) { const t = i / 50;
        const f = (typeof _hvAttackFlow === 'function') ? _hvAttackFlow(an, t, { animName: an }) : null;
        const y = f ? f.bob.head().y : ((HERO_VEC_BOB[an] && HERO_VEC_BOB[an].head) ? HERO_VEC_BOB[an].head(t).y : 0);
        worst = Math.max(worst, -Math.min(0, y)); }
      lift[an] = Math.round(worst * 100) / 100;
    }
    // the draw order in the hero renderer: head, then the weapon, then the front arm and the hand holding it
    const src = _drawVectorHero.toString();
    const iHead = src.indexOf('drawHeadAttached(() => {\n    // v0.25.155'), iWeap = src.lastIndexOf('drawWeaponLayerStack();'),
      iArm = src.lastIndexOf("drawBone('armL', () => {"), iHand = src.lastIndexOf("drawBone('handL', () => {\n    ctx.fillStyle = SKIN.base;");
    const order = { iHead, iWeap, iArm, iHand };
    const out = {};
    for (const cls of ['warrior', 'archer']) {
      try { applyClass(cls); } catch (e) {}
      loadMap('town'); await wait(800); player.vx = 0; player.attacking = false;
      // the archer's samples are named in CURVE time (release at HERO_VEC_ARCHER_RELEASE_T); since the draw quickened
      // (_lxArrowSync) the shot plays on a warped clock, so each is drawn at the raw time that maps onto it
      const C = HERO_VEC_ARCHER_RELEASE_T, RAW = (typeof HV_ARCHER_RELEASE_RAW_T === 'number') ? HV_ARCHER_RELEASE_RAW_T : C;
      const raw = (c) => (c <= C ? c * RAW / C : RAW + (c - C) * (1 - RAW) / (1 - C));
      out[cls] = {}; for (const t of [0, 0.15, 0.2, 0.3, 0.4, 0.5, 0.55, 0.7, 1]) out[cls][t] = probe(cls, cls === 'archer' ? raw(t) : t);
    }
    return { ...out, lift, order };
  });
  const W = r.warrior, A = r.archer;
  ok('the head never lifts off the torso in any basic swing (it rose up to 6 px and left a gap under the chin)', Object.values(r.lift).every((v) => v === 0), r.lift);
  const o = r.order;
  ok('draw order: the weapon is drawn after (in front of) the head', o.iHead > 0 && o.iWeap > o.iHead, o);
  ok('draw order: the front arm and the hand are drawn after (in front of) the weapon', o.iArm > o.iWeap && o.iHand > o.iArm, o);
  const back = (a) => Math.abs(a) >= 115;
  ok('warrior: the blade hangs behind in the windup (t 0.15-0.2)', back(W[0.15].ang) && back(W[0.2].ang), { t15: W[0.15], t20: W[0.2] });
  ok('warrior: at the hit the blade cuts forward-down, out past the hands (t 0.5)', W[0.5].ang <= -5 && W[0.5].ang >= -75 && W[0.5].tip[0] > W[0.5].hand[0] + 4, W[0.5]);
  ok('warrior: the hands are in front of the body at the hit, not overhead (t 0.5)', W[0.5].hand[0] > 4 && W[0.5].hand[1] < 45, W[0.5].hand);
  ok('warrior: a smear follows the blade tip through the chop', W[0.4].seen.gold >= 1, W[0.4].seen);
  ok('warrior: no smear before or after the chop', W[0].seen.gold === 0 && W[1].seen.gold === 0, { t0: W[0].seen, t1: W[1].seen });
  ok('archer: the bow is held out ahead of the body near shoulder height while aiming (t 0.3-0.5)', [0.3, 0.4, 0.5].every((t) => A[t].hand[0] >= 8 && A[t].hand[1] >= 33), { t3: A[0.3].hand, t4: A[0.4].hand, t5: A[0.5].hand });
  ok('archer: the bow stays upright while aiming', [0.3, 0.4, 0.5].every((t) => Math.abs(A[t].ang - 90) <= 12), [0.3, 0.4, 0.5].map((t) => A[t].ang));
  ok('archer: a pulled string and a nocked arrow show while drawing (t 0.3-0.5)', [0.3, 0.4, 0.5].every((t) => A[t].seen.str >= 1 && A[t].seen.pink >= 2), [0.3, 0.4, 0.5].map((t) => A[t].seen));
  ok('archer: the string and arrow are gone after the release (t 0.7, 1)', A[0.7].seen.pink === 0 && A[1].seen.pink === 0 && A[0.7].seen.str === 0, { t7: A[0.7].seen, t1: A[1].seen });
  ok('no page errors', errs.length === 0, errs);
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== WARRIOR CHOP + ARCHER DRAW ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
