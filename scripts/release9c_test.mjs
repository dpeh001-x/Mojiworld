// RELEASE 9c (text + key words) stays fixed:
//   1 no J in the tour   2 fixed key words follow a rebind (close footers, U jump keys, class tip, gift toast, skill texts)
//   3 the tour's own <kbd> keys follow a rebind   4 tour Boons step   5 Lv 5 class tip + Chain Cast card   6 skill text marks
//   7 style buttons hover with the name   8 Foxhunt monster names   9 phone Potions step says HP once
//   node scripts/release9c_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 14617), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const bootIn = async (page) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
};
const setup = `try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  player._tutorialSeen = true; window._prologueAfterCreation = false;
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls) applyClass('warrior'); player._gravitosCineSeen = true; player.invulnerable = 1e12; player._god = true;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;`;
try {
  // ---- desktop keyboard
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await bootIn(page);
  const D = await page.evaluate(async (setup) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    eval(setup); await sleep(300);
    const body = (s) => (s ? String(typeof s.body === 'function' ? s.body() : s.body) + ' ' + String(s.tryIt || '') : '');
    const allTour = TUTORIAL_STEPS.map(body).join('\n');
    out.j = { kbdJ: /<kbd>J<\/kbd>/.test(allTour) };
    // 3 - the tour's keys before and after a rebind
    const ctl = TUTORIAL_STEPS.find((s) => /<kbd>A<\/kbd> blocks/.test(body(s)));
    const before = _tutTouchify(typeof ctl.body === 'function' ? ctl.body() : ctl.body);
    // 2a / 3 - rebind: Block -> I, World Map -> J, MojiDex -> [, Character -> ;
    _kbAssign('block', 'i'); _kbAssign('worldMap', 'j'); _kbAssign('codex', '['); _kbAssign('attributesU', ';'); await sleep(200);
    const after = _tutTouchify(typeof ctl.body === 'function' ? ctl.body() : ctl.body);
    out.tour = { beforeA: /<kbd>A<\/kbd> blocks/.test(before), afterI: /<kbd>I<\/kbd> blocks/.test(after), afterA: /<kbd>A<\/kbd> blocks/.test(after), zKept: /<kbd>Z<\/kbd> attacks/.test(after) };
    const pot = TUTORIAL_STEPS.find((s) => /Potions/.test(s.title));
    out.tour.potKb = _tutTouchify(pot.tryIt);
    // 2a - close footers + U panel
    const wm = document.querySelector('.wm-hd-key'), cdx = document.querySelector('.cdx-foot');
    out.foot = { wm: wm && wm.innerHTML, cdx: cdx && cdx.innerHTML };
    try { openLevelUpPanel(); } catch (e) { out.uErr = String(e); } await sleep(400);
    const uc = document.querySelector('.u-close-hint');
    out.u = { close: uc && uc.innerHTML, jump: [...document.querySelectorAll('#u-jump-row .u-jump kbd')].map((k) => k.textContent) };
    try { closeAllModals(); } catch (e) {}
    // 2b / 2c / 5 - source
    const src = [...document.scripts].map((x) => x.textContent).join('\n');
    out.src = {
      tipLive: src.includes("_lxKeyHint('characterK', null, true) + ' for full controls.'") && !src.includes('Press K for full controls.'),
      giftLive: src.includes("'held at the post office, ' + ((typeof _lxTouchHints === 'function' && _lxTouchHints()) ? 'ask the Postal Wisp in Everdawn' : _lxKeyHint('mail'))") && !src.includes('held at the post office, press P'),
      lv5: !src.includes('At Lv 20 your job advances') && src.includes('Archers can hold a skill to draw the bow') && src.includes('if it is Dimensional Warp, Meteor,'),
    };
    out.tipKey = _lxKeyHint('characterK', null, true);
    out.giftKey = _lxKeyHint('mail');
    // 4 - Boons step
    out.boons = body(TUTORIAL_STEPS.find((s) => /^Boons/.test(s.title)));
    // 5 - Chain Cast card
    out.chain = CLASSES.mage.identity.desc;
    // 2d / 6 - skill texts
    const sk = (id) => SKILLS[id].desc;
    out.skills = { bl: sk('bloodlust'), wb: sk('warlord_ult'), ms: sk('sage_ult'), ab: sk('archbishop_ult'), pc: sk('sage_meteorshower'), nu: sk('necromancer_ult') };
    // 7 - style buttons
    const host = document.createElement('div'); document.body.appendChild(host);
    const res7 = {};
    for (const [kind, build, opts] of [['hair', buildCharStudioHairStyles, HERO_VEC_HAIR_OPTIONS], ['eye', buildCharStudioEyeStyles, HERO_VEC_EYE_OPTIONS], ['mouth', buildCharStudioMouthStyles, HERO_VEC_MOUTH_OPTIONS]]) {
      host.innerHTML = ''; build(host);
      const btns = [...host.querySelectorAll('.face-style-btn')];
      const ids = new Set(opts.map((o) => o.id));
      res7[kind] = { n: btns.length, idTitles: btns.filter((b) => ids.has(b.title) && !opts.some((o) => o.name === b.title)).map((b) => b.title).slice(0, 4),
        styleIds: btns.filter((b) => ids.has(b.dataset.styleId)).length };
      if (kind === 'hair') {
        const seen = []; const _orig = window._lxThumbInto; window._lxThumbInto = (cv, k, id) => { seen.push(id); };
        try { _lxStyleCards(host, 'hair'); } catch (e) { res7.cardErr = String(e); }
        await sleep(600); window._lxThumbInto = _orig;
        res7.thumbIds = seen.length && seen.every((id) => ids.has(id));
      }
    }
    host.remove(); out.style = res7;
    // 8
    out.fox = QUESTS.q_kill_nimbusFox.desc;
    return out;
  }, setup);
  // ---- phone (touch)
  const mctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' });
  const mp = await mctx.newPage(); mp.on('pageerror', (e) => errs.push('phone: ' + String(e.message).slice(0, 120)));
  await bootIn(mp);
  const M = await mp.evaluate(async (setup) => {
    eval(setup); await new Promise((r) => setTimeout(r, 300));
    const pot = TUTORIAL_STEPS.find((s) => /Potions/.test(s.title));
    return { pot: _tutTouchify(pot.tryIt), touch: typeof _lxTouchHints === 'function' && _lxTouchHints(), wm: (document.querySelector('.wm-hd-key') || {}).innerHTML };
  }, setup);

  ok('1. the tour no longer says J opens the Quest Journal', D.j.kbdJ === false, D.j);
  ok('2a. world map / MojiDex footers name the rebound keys', /<kbd>J<\/kbd> to close/.test(D.foot.wm || '') && /<kbd>\[<\/kbd> to close/.test(D.foot.cdx || ''), D.foot);
  ok('2a. the U panel close hint and jump buttons name the live keys', /<kbd>;<\/kbd> to close/.test(D.u.close || '') && D.u.jump.join(',') === 'J,Q,[,L', D.u);
  ok('2a. on a phone the map footer still says tap the cross', M.touch && /Tap \u2715 to close/.test(M.wm || ''), M);
  ok('2b/2c. the class tip and the gift toast use the live K / mail keys (touch: no K, the Wisp in Everdawn)', D.src.tipLive && D.src.giftLive && D.tipKey === 'Press K' && D.giftKey === 'press P', { src: D.src, tip: D.tipKey, gift: D.giftKey });
  ok('2d. War of Banners / Meteor Sigil / Bloodlust name no key', !/re-press B|tap B|basic Z/.test(D.skills.bl + D.skills.wb + D.skills.ms) && /press it again/.test(D.skills.wb) && /tap it up to 10 times/.test(D.skills.ms) && /basic attacks launch/.test(D.skills.bl), D.skills);
  ok('3. the tour says the rebound Block key (and keeps unchanged keys)', D.tour.beforeA && D.tour.afterI && !D.tour.afterA && D.tour.zKept, D.tour);
  ok('4. tour Boons step: bosses drop boons, other monsters rarely from Lv 20', /Bosses drop <b>boons<\/b>; other monsters rarely, from Lv 20\./.test(D.boons) && !/Mini-bosses/.test(D.boons), D.boons.slice(0, 120));
  ok('5. Lv 5 class tip: no "at Lv 20", archer Hold to Draw, mage Dimensional Warp (and the class card)', D.src.lv5 && /Dimensional Warp, Meteor/.test(D.chain) && !/Blink/.test(D.chain), D.chain.slice(0, 120));
  ok('6. "an 8.6\u00D7" and the \u00D7 / \u2014 marks in Pyre Columns, Meteor Sigil, Necrotic Ascendance',
    /an 8\.6\u00D7/.test(D.skills.ab) && [D.skills.pc, D.skills.ms, D.skills.nu].every((t) => !/\d+(\.\d+)?x\b/.test(t) && !/ - /.test(t)), D.skills);
  ok('7. hair / eye / mouth buttons hover with the name; the cards still draw by id', ['hair', 'eye', 'mouth'].every((k) => D.style[k].n > 0 && D.style[k].idTitles.length === 0 && D.style[k].styleIds > 0) && D.style.thumbIds === true && !D.style.cardErr, D.style);
  ok('8. Foxhunt names Mochi Galaxies and Spooks (not Cosmic Mochi / wraiths)', /Mochi Galaxies unspool/.test(D.fox) && /drift Spooks/.test(D.fox) && !/Cosmic Mochi|wraiths/.test(D.fox), D.fox.slice(0, 200));
  ok('9. phone Potions step says HP / MP once; the keyboard text keeps its brackets', !/\(HP\)|\(MP\)/.test(M.pot) && /\(HP\)/.test(D.tour.potKb), { phone: M.pot, kb: D.tour.potKb });
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
