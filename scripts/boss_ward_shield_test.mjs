// Ward shield (v0.30.389): while a boss is warded (every hit deals 1), a translucent
// shield icon is drawn over its sprite - centred, boss-sized, ~55% alpha - and it is
// not drawn otherwise; the art ships and decodes; the ward really does gate hits to 1.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10003); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof drawMonster === 'function' && typeof spawnMonster === 'function' && typeof hitMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, hasFn: typeof _drawBossWardShield === 'function', hasImg: !!(typeof LX_FX !== 'undefined' && LX_FX.boss_shield) };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { const rs = await fetch('Sprites/fx/boss_shield.webp'); o.artStatus = rs.status; o.artBytes = (await rs.arrayBuffer()).byteLength; } catch (e) { o.artStatus = 'err'; }
    if (o.hasImg) { const im = LX_FX.boss_shield; const t0 = performance.now(); while (!(im.complete && im.naturalWidth > 0) && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50)); o.imgDecoded = im.complete && im.naturalWidth > 0; o.imgSize = [im.naturalWidth, im.naturalHeight]; }
    try { loadMap('forest', 300); } catch (e) {} await new Promise((r) => setTimeout(r, 300)); game.paused = true; player.level = 60; player.hp = player.maxHp || 1000;
    spawnMonster(player.x + 220, player.y, 'kingKrook', true); const m = game.monsters.filter((x) => x && x.type === 'kingKrook').pop(); if (!m) return Object.assign(o, { spawnErr: 'no boss' });
    m.currentHp = m.maxHp; m.evasion = 0; game.camera.x = Math.max(0, m.x + m.w / 2 - W / 2); m._dying = false;   // evasion pinned: King Krook rolls 130 evasion, which ate a hit and made this flaky
    const img = o.hasImg ? LX_FX.boss_shield : null;
    const capture = () => { const calls = []; const proto = CanvasRenderingContext2D.prototype; const orig = proto.drawImage; proto.drawImage = function (im, ...a) { if (im === img) calls.push({ alpha: +this.globalAlpha.toFixed(3), x: a[0], y: a[1], w: a[2], h: a[3] }); return orig.apply(this, [im, ...a]); }; try { drawMonster(m); } catch (e) { calls.push({ err: String(e && e.message) }); } finally { proto.drawImage = orig; } return calls; };
    // warded, mid-ward: one shield draw, centred on the boss, boss-sized, translucent
    m._wardUntil = (game.time | 0) + 90; const mid = capture();
    // v0.30.390 centres the shield on the sprite the boss actually blitted (recorded by the sprite path) when that record is from this frame, else on the box
    const sx = m.x - game.camera.x, sy = m.y; const _rr = (m._lxDrawRect && m._lxDrawRect.t === (game.time | 0)) ? m._lxDrawRect : null; const ecx = _rr ? _rr.x + _rr.w / 2 : sx + m.w / 2, ecy = _rr ? _rr.y + _rr.h / 2 : sy + m.h / 2;
    o.mid = mid; o.midOk = mid.length === 1 && !mid[0].err && Math.abs((mid[0].x + mid[0].w / 2) - ecx) < 2 && Math.abs((mid[0].y + mid[0].h / 2) - ecy) < 2 && mid[0].h >= Math.max(m.w, m.h) * 1.1 && mid[0].alpha > 0.45 && mid[0].alpha < 0.62;
    // v0.30.390: on from the ward's first frame (~20%), full by the fifth, off only over the last six
    m._wardUntil = (game.time | 0) + 180; o.frame0Count = capture().length;
    m._wardUntil = (game.time | 0) + 179; const first = capture(); o.firstAlpha = first.length ? first[0].alpha : null;
    m._wardUntil = (game.time | 0) + 3; const last = capture(); o.lastAlpha = last.length ? last[0].alpha : null;
    // not warded: no shield
    m._wardUntil = 0; o.noneCount = capture().length;
    // the ward really gates hits to 1
    m._wardUntil = (game.time | 0) + 90; m.invulnerable = 0; const h0 = m.currentHp; try { hitMonster(m, 500000, false, 'melee'); } catch (e) { o.hitErr = String(e && e.message); } o.wardedLoss = h0 - m.currentHp;
    m._wardUntil = 0; m.invulnerable = 0; game.time += 120; m._lastHitAt = 0; const h1 = m.currentHp;   // a fresh tick: the same-tick / post-hit guards must not eat the second swing
    try { hitMonster(m, 500000, false, 'melee'); } catch (e) {} o.openLoss = h1 - m.currentHp;
    return o;
  });
  console.log('build ' + r.ver + '  mid ' + JSON.stringify(r.mid));
  ok('the shield art ships and decodes (Sprites/fx/boss_shield.webp, 512x512)', r.artStatus === 200 && r.artBytes > 10000 && r.imgDecoded === true && r.imgSize && r.imgSize[0] === 512, JSON.stringify([r.artStatus, r.artBytes, r.imgSize]));
  ok('the overlay function and the FX entry exist', r.hasFn === true && r.hasImg === true);
  ok('mid-ward: one translucent shield draw, centred on the boss, at least 1.1x its size, ~55% alpha', r.midOk === true, JSON.stringify(r.mid));
  ok('it is on from the ward\'s first frame (~20%), brighter one step in, and dimmer over its last frames', r.frame0Count === 1 && r.firstAlpha != null && r.firstAlpha > 0.15 && r.firstAlpha < 0.35 && r.lastAlpha != null && r.lastAlpha < 0.35 && r.lastAlpha > 0.05, JSON.stringify([r.frame0Count, r.firstAlpha, r.lastAlpha]));
  ok('no shield when the boss is not warded', r.noneCount === 0, String(r.noneCount));
  ok('the ward really gates a 500k hit to 1 damage; the same hit lands for more once it lifts', r.wardedLoss === 1 && r.openLoss > 1, JSON.stringify([r.wardedLoss, r.openLoss, r.hitErr]));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
