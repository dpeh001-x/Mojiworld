// Ward shield accuracy (v0.30.390): the shield is drawn on exactly the frames the
// ward gates hits to 1 - from the ward's first frame to its last, never outside - and
// it centres on the sprite the boss actually blitted (recorded by the sprite path),
// not on the collision box; co-op guests receive the ward in the monster sync.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10013); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof drawMonster === 'function' && typeof spawnMonster === 'function' && typeof hitMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, hasRec: typeof _lxRecordBossRect === 'function' };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (typeof LX_FX !== 'undefined' && LX_FX.boss_shield) { const im = LX_FX.boss_shield; const t0 = performance.now(); while (!(im.complete && im.naturalWidth > 0) && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50)); }
    try { loadMap('forest', 300); } catch (e) {} await new Promise((r) => setTimeout(r, 300)); game.paused = true; player.level = 70; player.hp = player.maxHp || 1000;
    const img = (typeof LX_FX !== 'undefined') ? LX_FX.boss_shield : null;
    const capture = (m) => { const calls = []; const proto = CanvasRenderingContext2D.prototype; const orig = proto.drawImage; proto.drawImage = function (im, ...a) { if (im === img) calls.push({ alpha: +this.globalAlpha.toFixed(3), x: a[0], y: a[1], w: a[2], h: a[3] }); return orig.apply(this, [im, ...a]); }; try { drawMonster(m); } catch (e) { calls.push({ err: String(e && e.message) }); } finally { proto.drawImage = orig; } return calls; };
    const spawnBoss = (type) => { spawnMonster(player.x + 260, player.y, type, true); const m = game.monsters.filter((x) => x && x.type === type).pop(); if (m) { m.currentHp = m.maxHp; game.camera.x = Math.max(0, m.x + m.w / 2 - W / 2); m._dying = false; m.invulnerable = 0; } return m; };
    // 1. frame-exact gate parity on King Krook: shield drawn <=> a hit deals 1, at every offset around the ward's edges
    const kk = spawnBoss('kingKrook'); if (!kk) return Object.assign(o, { err: 'no krook' }); kk.evasion = 0;
    const swing = (m) => { for (let k = 0; k < 4; k++) { m.invulnerable = 0; m._lastHitAt = 0; const h0 = m.currentHp; try { hitMonster(m, 500000, false, 'melee'); } catch (e) {} const loss = h0 - m.currentHp; m.currentHp = m.maxHp; if (loss > 0) return loss; game.time += 90; } return 0; };
    o.parity = []; let mismatches = 0;
    for (const left of [-2, -1, 0, 1, 2, 3, 6, 7, 30, 90, 179, 180]) {
      kk._wardUntil = (game.time | 0) + left; kk.invulnerable = 0; kk._lastHitAt = 0; game.time += 0;
      const drawn = capture(kk); const shown = drawn.length > 0 && !drawn[0].err && drawn[0].alpha > 0.02;
      const loss = swing(kk); const gated = loss === 1;
      o.parity.push({ left, shown, gated, loss, alpha: drawn.length ? drawn[0].alpha : 0 }); if (shown !== gated) mismatches++;
      game.time += 90;   // a fresh tick for the next hit (post-hit guards)
    }
    o.mismatches = mismatches;
    o.alphaAt7 = (o.parity.find((p) => p.left === 7) || {}).alpha; o.alphaAt1 = (o.parity.find((p) => p.left === 1) || {}).alpha; o.alphaAt180 = (o.parity.find((p) => p.left === 180) || {}).alpha;
    game.monsters.splice(game.monsters.indexOf(kk), 1);
    // 2. a sprite boss: the shield centres on the blitted rectangle, not the box
    o.spriteBoss = null;
    try { for (const type of ['legosaurus', 'mooma', 'barnaby', 'aetherion', 'zodiac_leo']) {
      const b = spawnBoss(type); if (!b) continue;
      const t0 = performance.now(); let rec = null;
      while (performance.now() - t0 < 12000) { b._wardUntil = (game.time | 0) + 90; capture(b); if (b._lxDrawRect && b._lxDrawRect.t === (game.time | 0) && b._lxDrawRect.w > 4) { rec = b._lxDrawRect; break; } await new Promise((r) => setTimeout(r, 100)); }
      if (!rec) { game.monsters.splice(game.monsters.indexOf(b), 1); continue; }
      const d = capture(b)[0]; const sx = b.x - game.camera.x, sy = b.y;
      o.spriteBoss = { type, rect: { w: Math.round(rec.w), h: Math.round(rec.h), cx: +(rec.x + rec.w / 2).toFixed(1), cy: +(rec.y + rec.h / 2).toFixed(1) }, box: { w: b.w, h: b.h, cx: sx + b.w / 2, cy: sy + b.h / 2 }, shield: d ? { cx: +(d.x + d.w / 2).toFixed(1), cy: +(d.y + d.h / 2).toFixed(1), h: Math.round(d.h) } : null };
      game.monsters.splice(game.monsters.indexOf(b), 1); break;
    } } catch (e) { o.spriteErr = String(e && e.message); }
    // 3. co-op: the ward rides the monster sync (static: both sides in the shipped source)
    const src = await (await fetch(location.pathname)).text();
    o.coop = { send: src.indexOf('_e.wd = Math.min(600') >= 0, recv: src.indexOf('if (e.wd > 0) m._wardUntil') >= 0, clear: src.indexOf('the host is not warded: drop a stale local ward') >= 0 };
    return o;
  });
  console.log('build ' + r.ver + (r.err ? '  ' + r.err : '') + '  sprite boss ' + JSON.stringify(r.spriteBoss));
  ok('the sprite path records its blitted rectangle', r.hasRec === true);
  ok('gate parity: the shield is drawn on exactly the frames a hit deals 1 (12 offsets around both edges)', r.mismatches === 0, JSON.stringify(r.parity.map((p) => p.left + ':' + (p.shown ? 'S' : '-') + (p.gated ? 'G' : '-'))));
  ok('the first warded frame already shows the shield (~20%) and the last frame is still visible', r.alphaAt180 > 0.08 && r.alphaAt1 > 0.05, JSON.stringify([r.alphaAt180, r.alphaAt1]));
  ok('with seven or more frames left the shield is at full strength (~55%)', r.alphaAt7 > 0.5 && r.alphaAt7 < 0.62, String(r.alphaAt7));
  ok('a sprite boss: the shield centres on the blitted sprite, not the collision box', !!r.spriteBoss && !!r.spriteBoss.shield && Math.abs(r.spriteBoss.shield.cx - r.spriteBoss.rect.cx) < 2 && Math.abs(r.spriteBoss.shield.cy - r.spriteBoss.rect.cy) < 2, JSON.stringify(r.spriteBoss));
  ok('the blitted rectangle differs from the box (the distinction matters)', !!r.spriteBoss && (Math.abs(r.spriteBoss.rect.cy - r.spriteBoss.box.cy) > 2 || Math.abs(r.spriteBoss.rect.h - r.spriteBoss.box.h) > 4), r.spriteBoss ? `rect h ${r.spriteBoss.rect.h} cy ${r.spriteBoss.rect.cy} vs box h ${r.spriteBoss.box.h} cy ${r.spriteBoss.box.cy}` : 'no sprite boss decoded');
  ok('the shield is sized to the sprite (1.15x its larger side, within the cap)', !!r.spriteBoss && !!r.spriteBoss.shield && Math.abs(r.spriteBoss.shield.h - Math.min(560, Math.max(72, Math.max(r.spriteBoss.rect.w, r.spriteBoss.rect.h) * 1.15))) < Math.max(r.spriteBoss.rect.w, r.spriteBoss.rect.h) * 0.07, r.spriteBoss && r.spriteBoss.shield ? String(r.spriteBoss.shield.h) : '');
  ok('co-op: the host sends the ward and a guest mirrors or clears it', r.coop && r.coop.send && r.coop.recv && r.coop.clear, JSON.stringify(r.coop));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
