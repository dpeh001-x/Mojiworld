// A boss fight should look like a boss fight.
//
// The game already draws a proper boss bar — plate, name, gradient fill, tick
// marks — in drawSuperBossBar(). It only ever fired for `superBoss`, which is
// three monsters: aetherion, gravitos, octobaby. The other 22 bosses, Legosaurus
// at 2.98M HP and the Sundered Smith at 1.8M among them, fought behind the same
// 4px sliver a snail gets, drawn `m.w - 6` wide above the head and suppressed
// entirely at full HP (`if (m.currentHp < m.maxHp)`).
//
// Measured through the real renderer: ctx.fillText is spied on, drawSuperBossBar
// is called, and the question is simply whether the boss's name was painted.
//   node scripts/boss_bar_test.mjs [port]
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
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof drawSuperBossBar === 'function' && typeof monsterTypes === 'object',
  null, { timeout: 120000 });
// the bar furniture streams with the rest of LX_FX at boot — wait for the two
// pieces to decode before asserting on them (same pattern as the telegraph
// art suite).
await page.waitForFunction(() => window._lxBossFontReady === true, null, { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => typeof LX_FX !== 'undefined'
  && LX_FX.ui_bossbar_frame && LX_FX.ui_bossbar_frame.complete && LX_FX.ui_bossbar_frame.naturalWidth > 0
  && LX_FX.ui_bossbar_fill && LX_FX.ui_bossbar_fill.complete && LX_FX.ui_bossbar_fill.naturalWidth > 0,
  null, { timeout: 30000 }).catch(() => {});

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.hp = getMaxHp(); player.x = 800; player.y = 400;

  // Build a monster the way a spawn would, from its authored type.
  // _bbSeen: 0 pre-dates the v0.29.958 acquisition sweep — this suite asserts
  // the settled bar (furniture, name, geometry), so its bosses are built
  // "already acquired"; the sweep and the damage chip have their own suite
  // (boss_bar_chip_test.mjs) on a virtual clock.
  const mk = (key, over) => {
    const t = monsterTypes[key] || {};
    return Object.assign({
      type: key, name: t.name || key, w: t.w || 60, h: t.h || 60,
      x: 900, y: 400, currentHp: Math.floor((t.hp || 1000) * 0.6), maxHp: t.hp || 1000,
      isBoss: !!t.boss, boss: !!t.boss, superBoss: !!t.superBoss, hyperBoss: !!t.hyperBoss,
      level: t.level || 50, traits: t.traits, _bbSeen: 0,
    }, over || {});
  };

  // Spy the renderer: what text does the bar actually paint?
  const draw = (mon) => {
    game.monsters.length = 0;
    game._superBossRef = null;
    if (mon) game.monsters.push(mon);
    const real = ctx.fillText.bind(ctx);
    const painted = [];
    ctx.fillText = function (t) { painted.push(String(t)); return real.apply(this, arguments); };
    try { drawSuperBossBar(); } catch (e) { painted.push('THREW:' + e); }
    ctx.fillText = real;
    return painted;
  };

  // v0.29.x — BAR FURNITURE: with the frame + ribbon decoded, the bar paints
  // drawImage-framed with NO border rectangles; with the art blocked, the
  // original procedural plate (borders included) must draw unchanged.
  const paint = (mon, blockArt) => {
    game.monsters.length = 0; game._superBossRef = null;
    game.monsters.push(mon);
    let savedF, savedR;
    if (blockArt && typeof LX_FX !== 'undefined') {
      savedF = LX_FX.ui_bossbar_frame; savedR = LX_FX.ui_bossbar_fill;
      LX_FX.ui_bossbar_frame = null; LX_FX.ui_bossbar_fill = null;
    }
    const counts = { drawImage: 0, strokeRect: 0 };
    const _di = ctx.drawImage, _sr = ctx.strokeRect;
    ctx.drawImage = function () { counts.drawImage++; return _di.apply(this, arguments); };
    ctx.strokeRect = function () { counts.strokeRect++; return _sr.apply(this, arguments); };
    try { drawSuperBossBar(); } catch (e) { counts.threw = String(e).slice(0, 80); }
    ctx.drawImage = _di; ctx.strokeRect = _sr;
    if (blockArt && typeof LX_FX !== 'undefined') {
      LX_FX.ui_bossbar_frame = savedF; LX_FX.ui_bossbar_fill = savedR;
    }
    return counts;
  };
  out.barArtReady = !!(typeof LX_FX !== 'undefined' && LX_FX.ui_bossbar_frame && LX_FX.ui_bossbar_frame.complete && LX_FX.ui_bossbar_frame.naturalWidth > 0
    && LX_FX.ui_bossbar_fill && LX_FX.ui_bossbar_fill.complete && LX_FX.ui_bossbar_fill.naturalWidth > 0);
  // v0.29.x — TITLE FACE + OUTLINES: the embedded Cinzel loads, the name draws
  // in it, and every text on the bar is stroke-outlined before it is filled.
  out.fontLoaded = window._lxBossFontReady === true
    && (typeof document !== 'undefined' && document.fonts && document.fonts.check('700 19px LXBossTitle'));
  {
    game.monsters.length = 0; game._superBossRef = null;
    game.monsters.push(mk('legosaurus'));
    const strokes = []; let nameFont = null;
    const _st = ctx.strokeText, _ft = ctx.fillText;
    ctx.strokeText = function (t) { strokes.push(String(t)); return _st.apply(this, arguments); };
    ctx.fillText = function (t) {
      if (String(t).includes('LEGOSAURUS')) nameFont = String(ctx.font);
      return _ft.apply(this, arguments);
    };
    try { drawSuperBossBar(); } catch (e) { strokes.push('THREW:' + e); }
    ctx.strokeText = _st; ctx.fillText = _ft;
    out.nameFont = nameFont;
    out.nameOutlined = strokes.filter(t => t.includes('LEGOSAURUS')).length;
    out.hpOutlined = strokes.some(t => /[KM]\s*\/|·/.test(t) || /%/.test(t));
  }
  out.paintArt = paint(mk('legosaurus'), false);
  out.paintFallback = paint(mk('legosaurus'), true);

  out.superBoss  = draw(mk('gravitos'));
  out.plainBoss  = draw(mk('legosaurus'));
  out.smith      = draw(mk('sundered_smith'));
  out.ordinary   = draw(mk('snail'));
  out.elite      = draw(mk('snail', { isElite: true }));
  out.deadBoss   = draw(mk('legosaurus', { currentHp: 0 }));
  out.noMonsters = draw(null);

  // How many bosses in the roster would show a bar at all?
  let bosses = 0, supers = 0;
  for (const k in monsterTypes) { const t = monsterTypes[k]; if (!t || !t.boss) continue; bosses++; if (t.superBoss) supers++; }
  out.bosses = bosses; out.supers = supers;

  game.monsters.length = 0; game._superBossRef = null; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

const said = (arr, s) => (arr || []).some(t => t.toUpperCase().includes(s.toUpperCase()));
const hpText = (arr) => (arr || []).find(t => /\d/.test(t) && /\/|%/.test(t)) || '';
console.log('roster:', r.bosses, 'bosses,', r.supers, 'of them superBoss');
console.log('gravitos       ->', JSON.stringify(r.superBoss));
console.log('legosaurus     ->', JSON.stringify(r.plainBoss));
console.log('sundered smith ->', JSON.stringify(r.smith));
console.log('snail          ->', JSON.stringify(r.ordinary));
console.log('font loaded:', r.fontLoaded, '| name font:', r.nameFont, '| name strokes:', r.nameOutlined, '| hp outlined:', r.hpOutlined);
console.log('bar art ready:', r.barArtReady, '| paint w/ art:', JSON.stringify(r.paintArt), '| fallback:', JSON.stringify(r.paintFallback));

ok('a super boss still gets its bar (no regression)',
   said(r.superBoss, 'GRAVITOS'), { painted: r.superBoss });
ok('an ordinary boss gets the boss bar — the gap',
   said(r.plainBoss, 'LEGOSAURUS'), { painted: r.plainBoss });
ok('...and so does another one, so it is the tier and not one special case',
   said(r.smith, 'SUNDERED'), { painted: r.smith });
ok('an ordinary mob gets no boss bar', !said(r.ordinary, 'SNAIL'), { painted: r.ordinary });
ok('an elite is not a boss and gets no boss bar', !said(r.elite, 'SNAIL'), { painted: r.elite });
ok('a dead boss gets no bar', !said(r.deadBoss, 'LEGOSAURUS'), { painted: r.deadBoss });
ok('an empty map draws nothing', (r.noMonsters || []).length === 0, { painted: r.noMonsters });
ok('the HP readout is legible, not an 8-digit wall',
   /[KM]|%/.test(hpText(r.plainBoss)), { hp: hpText(r.plainBoss) });
ok('...for the 63-million-HP one too', /[KM]|%/.test(hpText(r.superBoss)), { hp: hpText(r.superBoss) });
ok('the bar frame + ribbon fill are decoded by the live loader', r.barArtReady === true, {});
ok('with the art, the bar is drawImage-framed — no border rectangles',
   r.paintArt && r.paintArt.drawImage >= 2 && r.paintArt.strokeRect === 0, r.paintArt);
ok('with the art blocked, the procedural plate still draws (fallback intact)',
   r.paintFallback && r.paintFallback.drawImage === 0 && r.paintFallback.strokeRect >= 2, r.paintFallback);
ok('the embedded Cinzel title face loads (offline, no machine fonts)', r.fontLoaded === true, {});
ok('the name draws IN the title face', typeof r.nameFont === 'string' && r.nameFont.includes('LXBossTitle'), { font: r.nameFont });
ok('the name is stroke-outlined (dark ring + accent ring)', r.nameOutlined >= 2, { strokes: r.nameOutlined });
ok('the HP readout is outlined over the ribbon', r.hpOutlined === true, {});
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
