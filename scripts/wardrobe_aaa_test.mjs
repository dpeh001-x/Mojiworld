// Live test: every wardrobe tab, AAA (per user: "The rest of the tabs can also be more POP and much nicer AAA standard ...
// the posture editor can still be even more beautified"). On the open wardrobe at 1920x1080 and 1280x720:
//   * hair / eyes / mouth / skin options are cards, each with a thumbnail of YOUR character wearing that option: the
//     thumbnails draw, differ from one another, and follow the hair dye; names carry no emoji
//   * clicking a card still picks the option (state, the one active card, the slot tile)
//   * the paint studio is dressed (tool icons, framed stage) and still paints: a real mouse stroke lands on the canvas,
//     and leaving a card tab for it drops the card grid
//   * the posture editor has a part rail that selects parts, and its stage is dressed (curtains, valance)
//   node scripts/wardrobe_aaa_test.mjs [port]   (MOJI_GAME_FILE honored)
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
// in-page helpers, installed once per page
const HELP = () => {
  window.__w = (ms) => new Promise((z) => setTimeout(z, ms));
  window.__slot = async (re) => { const s = [...document.querySelectorAll('#char-studio-overlay .wardrobe-slot')].find((x) => re.test(x.textContent)); if (s) s.click(); await __w(400); return !!s; };
  window.__cards = () => { const c = [...document.querySelectorAll('#wardrobe-picker .lx-style-card')]; return c.length ? c : [...document.querySelectorAll('#wardrobe-picker .face-style-btn, #wardrobe-picker .skin-swatch')]; };   // the plain buttons on an old build, so it fails instead of crashing
  window.__ink = (cv) => { if (!cv) return 0; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n / (d.length / 4); };
  window.__sig = (cv) => { if (!cv) return 0; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; return h; };
  window.__ready = async () => { for (let i = 0; i < 80; i++) { const c = __cards(); if (c.length && c.every((e) => e.querySelector('canvas.lx-ready'))) return true; await __w(100); } return false; };
  window.__cardTab = async (re, kind, opts) => {
    await __slot(re); const ready = await __ready(); const cards = __cards(), cvs = cards.map((c) => c.querySelector('canvas'));
    const inked = cvs.filter((cv) => cv && __ink(cv) > 0.12).length, sigs = new Set(cvs.map((cv) => cv ? __sig(cv) : 0));
    const names = cards.map((c) => (c.querySelector('.lx-sc-name') || c).textContent);
    return { kind, ready, cards: cards.length, want: opts, inked, distinct: sigs.size, emoji: names.filter((n) => /[\u2190-\u2BFF\u{1F000}-\u{1FAFF}]/u.test(n)).length,
      grid: getComputedStyle(document.querySelector('#wardrobe-picker .lx-sc-grid-skin') || document.getElementById('wardrobe-picker')).gridTemplateColumns.split(' ').length };
  };
};
try {
  for (const [vw, vh] of [[1920, 1080], [1280, 720]]) {
    const page = await (await b.newContext({ viewport: { width: vw, height: vh }, serviceWorkers: 'block' })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof openCharStudio === 'function' && typeof loadMap === 'function', null, { timeout: 120000 });
    await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
    await page.evaluate(HELP);
    const r = await page.evaluate(async () => {
      try { _lxBootGateDone = true; } catch (e) {} try { _lxBootHold.release('menu'); } catch (e) {}
      ['loading-overlay', 'lo-menu'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
      try { if (!player.cls) applyClass('warrior'); } catch (e) {}
      player.mojicoins = 99999; loadMap('town'); await __w(2000); _csGrantWardrobe(); openCharStudio(); await __w(2500);
      const out = { block: !!document.getElementById('lx-wardrobe-aaa') };
      out.hair = await __cardTab(/^\s*hair/i, 'hair', HERO_VEC_HAIR_OPTIONS.length);
      // pick a card: state, one active card, the tile follows
      const pick = __cards().find((c) => !c.classList.contains('active') && c.title === 'bob') || __cards()[3];
      pick.click(); await __w(150);
      const tileImg = [...document.querySelectorAll('.wardrobe-slot')].find((s) => /hair/i.test(s.textContent)).querySelector('img');
      out.pick = { want: pick.title, got: CHAR_STUDIO.hairId, active: __cards().filter((c) => c.classList.contains('active')).map((c) => c.title),
        tile: !!(tileImg && LX_HAIR[_migrateHairId(pick.title)] && tileImg.src === LX_HAIR[_migrateHairId(pick.title)].src) };
      // the dye: a hue change re-draws the hair cards in the new colour
      const cv0 = __cards()[0].querySelector('canvas'), s0 = __sig(cv0), dye = document.querySelector('#wardrobe-picker .lx-dye input[type=range]');
      if (dye) { dye.value = '180'; dye.dispatchEvent(new Event('input', { bubbles: true })); dye.dispatchEvent(new Event('change', { bubbles: true })); }
      await __w(1600); out.dye = { hue: CHAR_STUDIO.hairHue, changed: __sig(__cards()[0].querySelector('canvas')) !== s0, card: !!document.querySelector('.lx-dye.lx-dye') };
      if (dye) { dye.value = '0'; dye.dispatchEvent(new Event('input', { bubbles: true })); }
      out.eye = await __cardTab(/^\s*eyes/i, 'eye', HERO_VEC_EYE_OPTIONS.length);
      out.eyeFace = __cards().every((c) => c.classList.contains('lx-sc-face'));
      const ec = __cards()[2]; ec.click(); await __w(100); out.eyePick = CHAR_STUDIO.eyeId === ec.title;
      out.mouth = await __cardTab(/^\s*mouth/i, 'mouth', HERO_VEC_MOUTH_OPTIONS.length);
      out.skin = await __cardTab(/^\s*skin/i, 'skin', HERO_VEC_SKIN.length);
      const sc = __cards()[5]; sc.click(); await __w(100);
      out.skinPick = { idx: CHAR_STUDIO.skinIdx, dot: !!sc.querySelector('.lx-sc-dot'), active: sc.classList.contains('active') };
      // the paint studio, reached from a card tab
      await __slot(/^\s*hat/i);
      document.documentElement.classList.remove('lx-nobackdrop'); await __w(100);   // headless trips low-fx, which strips box-shadows
      const pk = document.getElementById('wardrobe-picker'), box = pk.querySelector('.paint-toolbox');
      const erase = pk.querySelector('.lx-pt-erase') || [...pk.querySelectorAll('.paint-toolbox .face-style-btn')].find((x) => /erase/i.test(x.textContent)); if (erase) { erase.click(); await __w(50); }
      out.paint = { cards: pk.classList.contains('lx-cards'), dressed: !!(box && box.classList.contains('lx-paint')), icons: pk.querySelectorAll('svg.lx-pt-ico').length,
        eraseToggles: !!(erase && erase.classList.contains('active')), frame: box ? getComputedStyle(box.querySelector('.paint-stage')).boxShadow : '' };
      const sw = pk.querySelector('.paint-swatch'); if (sw) { sw.click(); await __w(50); }   // Erase is a mode, not a toggle: a colour brings the brush back
      const pc = pk.querySelector('canvas.char-paint-canvas'), rr = pc.getBoundingClientRect();
      out.stroke = { before: __ink(pc), x: rr.left + rr.width * 0.35, y: rr.top + rr.height * 0.4, x2: rr.left + rr.width * 0.65, y2: rr.top + rr.height * 0.6 };
      return out;
    });
    // a real mouse stroke on the paint canvas
    await page.mouse.move(r.stroke.x, r.stroke.y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(r.stroke.x + (r.stroke.x2 - r.stroke.x) * i / 8, r.stroke.y + (r.stroke.y2 - r.stroke.y) * i / 8);
    await page.mouse.up(); await page.waitForTimeout(300);
    const p2 = await page.evaluate(async () => {
      const after = __ink(document.querySelector('#wardrobe-picker canvas.char-paint-canvas'));
      try { const c = document.querySelector('#wardrobe-picker .lx-pt-clear'); if (c) c.click(); } catch (e) {}
      await __slot(/^\s*posture/i);
      const rail = [...document.querySelectorAll('.lx-pz-rail .lx-pz-part')], leg = rail.find((x) => x.dataset.part === 'legL');
      if (leg) { leg.click(); await __w(150); }
      const cv = document.querySelector('canvas.lx-pz-cv'), px = (x, y) => [...cv.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data];
      const sl = document.querySelector('.lx-pz-slider'), wrap = document.querySelector('#char-studio-overlay .wardrobe-picker-wrap');
      const sr = sl && sl.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      return { after, rail: rail.length, sel: _getDollSelected(), legActive: !!(leg && leg.classList.contains('active')), chip: (document.querySelector('.lx-pz-chip') || {}).textContent || '',
        curtain: px(8, DOLL_H * 0.3), valance: px(DOLL_W / 2, 6), sliderInView: !!(sr && sr.bottom <= wr.bottom + 1) };
    });
    const tag = `${vw}x${vh}`;
    ok(`${tag}: the AAA block is loaded`, r.block, r.block);
    for (const t of [r.hair, r.eye, r.mouth, r.skin])
      ok(`${tag}: ${t.kind} options are cards whose thumbnails all draw, each different, no emoji in the names`, t.ready && t.cards === t.want && t.inked === t.cards && t.distinct >= t.cards - 1 && t.emoji === 0, t);
    ok(`${tag}: the skin cards sit four to a row`, r.skin.grid === 4, r.skin.grid);
    ok(`${tag}: a hair card still picks the style (state, one active card, the tile)`, r.pick.got === r.pick.want && r.pick.active.length === 1 && r.pick.active[0] === r.pick.want && r.pick.tile, r.pick);
    ok(`${tag}: the dye is a card, and a hue change re-draws the hair cards in the new colour`, r.dye.card && r.dye.hue === 180 && r.dye.changed, r.dye);
    ok(`${tag}: eyes are face close-ups and a card picks the eyes`, r.eyeFace && r.eyePick, { face: r.eyeFace, pick: r.eyePick });
    ok(`${tag}: a skin card picks the tone and wears its colour dot`, r.skinPick.idx === 5 && r.skinPick.dot && r.skinPick.active, r.skinPick);
    ok(`${tag}: the paint studio drops the card grid, is dressed (5 tool icons, framed stage) and Erase still toggles`, !r.paint.cards && r.paint.dressed && r.paint.icons === 5 && r.paint.eraseToggles && /245, 201, 90/.test(r.paint.frame), r.paint);
    ok(`${tag}: a real mouse stroke still paints on the canvas`, p2.after > r.stroke.before + 0.002, { before: r.stroke.before, after: p2.after });
    ok(`${tag}: the posture part rail selects parts (10 chips, Left Leg in hand)`, p2.rail === 10 && p2.sel === 'legL' && p2.legActive && /left leg/i.test(p2.chip), p2);
    ok(`${tag}: the posture stage is dressed - velvet curtain at the side, pink valance on top`, p2.curtain[0] > 90 && p2.curtain[1] < 90 && p2.valance[0] > 110 && p2.valance[1] < 110, { curtain: p2.curtain, valance: p2.valance });
    ok(`${tag}: the posture slider stays in view with the rail added`, p2.sliderInView, p2.sliderInView);
    ok(`${tag}: no page errors`, errs.length === 0, errs);
    await page.close();
  }
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== WARDROBE AAA ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
