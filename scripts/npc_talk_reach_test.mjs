// NPC TALK REACH (v0.30.1113, the 2026-09-26 NPC audit). One shared talk target for every input, height-aware:
//   - LEVEL: on the street between Bravo (a step up) and the Amnesiac (a ledge up), the talk key picks Bravo
//   - LIMITS: an NPC more than a step below you, or more than a storey above, is out of reach; a ledge above is not
//   - PROMPT: with two NPCs in reach across, only the one the key would open shows [N] Talk
//   - N: opens that NPC; with a shop open it opens nothing under the shop
//   - P: the courier does not open under the advancement card and counts for no daily talk
//   - CLICK: a click on an NPC's head opens them
//   - PHONE: the interact button next to Nurse Joyce opens her dialog
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/npc_talk_reach_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11382';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
check(/function _lxTalkTarget\(\)/.test(readFileSync(PAGE, 'utf8')), 'static: the shared talk target exists');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const boot = async (opts) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 30; try { closeAllModals(); } catch (e) {}
    window.__W8 = (ms) => new Promise((res) => setTimeout(res, ms));
  });
  return { ctx, page };
};
try {
  const { ctx, page } = await boot({ viewport: { width: 1280, height: 760 } });
  const r = await page.evaluate(async () => {
    const W8 = window.__W8, out = {};
    loadMap('town', 300); await W8(1200); try { closeAllModals(); } catch (e) {} game.paused = false;
    const npc = (n) => game.npcs.find((x) => x.name === n), dlg = document.getElementById('dialog');
    const bravo = npc('Bravo'), amn = npc('The Amnesiac');
    const street = (x) => { player.x = x - player.w / 2; player.y = 480 - player.h; player.vx = 0; player.vy = 0; };
    // LEVEL + PROMPT (live frames)
    street((bravo.x + amn.x) / 2); await W8(700); street((bravo.x + amn.x) / 2); await W8(300);
    const tgt = _lxTalkTarget();
    out.level = { at: Math.round(player.x + player.w / 2), bravoDx: Math.round(Math.abs(player.x + player.w / 2 - bravo.x)), amnDx: Math.round(Math.abs(player.x + player.w / 2 - amn.x)), target: tgt && tgt.name };
    out.prompt = game.npcs.filter((n) => (n._talkA || 0) > 0.3).map((n) => n.name);
    // LIMITS (pure reads, paused)
    game.paused = true; const f = (n) => n.y + 44;
    const at = (n, feetOff) => { player.x = n.x - player.w / 2; player.y = f(n) + feetOff - player.h; const t = _lxTalkTarget(); return t ? t.name : null; };
    out.limits = { ledge250: at(amn, 250), storey300: at(amn, 300), below100: at(amn, -100), step40: at(amn, -40) };
    game.paused = false;
    // N: talks to the target; nothing under a shop
    street((bravo.x + amn.x) / 2); await W8(250);
    const pressN = async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN', bubbles: true })); await W8(60); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'n', code: 'KeyN', bubbles: true })); await W8(200); };
    await pressN(); out.n = { open: dlg.style.display === 'block', name: document.getElementById('dialog-name').textContent }; closeDialog();
    openShop('potion'); await W8(200); await pressN();
    out.nUnderShop = { dialog: dlg.style.display === 'block', shop: document.getElementById('shop-modal').style.display }; closeAllModals(); game.paused = false;
    // P: under the advancement card; daily tally
    const talks = []; const _td = window.tickDaily; window.tickDaily = function (k, v) { if (k === 'talk') talks.push(v); return _td.apply(this, arguments); };
    const adv = document.getElementById('advancement-modal'); adv.style.display = 'flex';
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true })); await W8(250);
    out.pUnderAdv = dlg.style.display === 'block'; adv.style.display = 'none'; try { closeAllModals(); } catch (e) {} game.paused = false;
    openPostalWisp(); await W8(150); out.pOpens = dlg.style.display === 'block' && document.getElementById('dialog-name').textContent; closeDialog();
    out.pTalks = talks.slice(); window.tickDaily = _td;
    // CLICK the Amnesiac's head
    street(amn.x - 90); game.paused = false; await W8(700);
    const c = document.getElementById('game') || document.querySelector('canvas'), b = c.getBoundingClientRect();
    const top = amn.y + 44 - _lxNpcDrawnH(amn), wy = top + 10;
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: b.left + (amn.x - (game.camera.x || 0)) * b.width / W, clientY: b.top + (wy - (game.camera.y || 0)) * b.height / H }));
    await W8(200); out.click = { drawnH: Math.round(_lxNpcDrawnH(amn)), open: dlg.style.display === 'block', name: document.getElementById('dialog-name').textContent }; closeDialog();
    return out;
  });
  check(r.level.target === 'Bravo' && r.level.amnDx < r.level.bravoDx + 30, 'LEVEL: between Bravo (a step up) and the Amnesiac (a ledge up), the talk key picks Bravo', J(r.level));
  check(r.limits.ledge250 === 'The Amnesiac' && r.limits.storey300 !== 'The Amnesiac' && r.limits.below100 !== 'The Amnesiac' && r.limits.step40 === 'The Amnesiac', 'LIMITS: a ledge 250 px up and a step 40 px down are in reach; 300 px up or 100 px down are not', J(r.limits));
  check(r.prompt.length === 1 && r.prompt[0] === 'Bravo', 'PROMPT: only the NPC the key would open shows [N] Talk', J(r.prompt));
  check(r.n.open && r.n.name === 'Bravo' && !r.nUnderShop.dialog && r.nUnderShop.shop === 'flex', 'N: opens Bravo; with the shop open it opens nothing under it', J([r.n, r.nUnderShop]));
  check(!r.pUnderAdv && r.pOpens === 'Postal Wisp' && r.pTalks.length === 0, 'P: no courier card under the advancement card, and the hotkey courier counts for no daily talk', J({ under: r.pUnderAdv, opens: r.pOpens, talks: r.pTalks }));
  check(r.click.open && r.click.name === 'The Amnesiac' && r.click.drawnH > 80, 'CLICK: a click 10 px under the top of the Amnesiac\'s drawn head opens him', J(r.click));
  await ctx.close();
  // PHONE
  const P = await boot({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await P.page.evaluate(async () => { loadMap('everdawn_megamall', 300); await window.__W8(1200); try { closeAllModals(); } catch (e) {} game.paused = false;
    const j = game.npcs.find((x) => x.name === 'Nurse Joyce'); player.x = j.x - player.w / 2; player.y = j.y + 44 - player.h; await window.__W8(700); });
  // the phone deck mounts a moment after boot; wait for the button rather than a fixed delay
  try { await P.page.waitForSelector('.mobile-deck [data-dynamic="f-block"]', { state: 'visible', timeout: 20000 }); } catch (e) {}
  await P.page.waitForTimeout(400);
  const fb = await P.page.$('.mobile-deck [data-dynamic="f-block"]');
  let phone = { button: !!fb, body: await P.page.evaluate(() => document.body.className.slice(0, 120)) };
  if (fb && await fb.isVisible()) { const bb = await fb.boundingBox(); await P.page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await P.page.waitForTimeout(500);
    phone = { ...phone, ...(await P.page.evaluate(() => ({ state: document.querySelector('.mobile-deck [data-dynamic="f-block"]').dataset.fstate, open: document.getElementById('dialog').style.display === 'block', name: document.getElementById('dialog-name').textContent }))) }; }
  check(phone.open && phone.name === 'Nurse Joyce', 'PHONE: tapping the interact button next to Nurse Joyce opens her dialog', J(phone));
  await P.ctx.close();
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
