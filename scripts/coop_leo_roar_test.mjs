// LEO'S ROYAL ROAR IN CO-OP (v0.30.1436). The host roared its own player with the solo cone (340 px past his body, on the side
// it was fired toward) and then broadcast a 260 px circle round his centre for 20% of max HP - and only when its own player
// was caught. One page plays both roles (no relay needed): as HOST it fires real roars and keeps what it would send; as
// GUEST it applies those messages through _coopApplyBossHit with its player placed around Leo:
//   host: its own player in the cone takes 15% of max HP (unchanged); the roar still goes out when that player dodged;
//   guest: in the cone 300 px past his edge it is roared; 60 px behind him it is not; its share is the host's 15%.
//   node scripts/coop_leo_roar_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.argv[2] || process.env.PORT || 10261); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof _coopApplyBossHit === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(600); player.level = 99;
    game.paused = false; { const tl = performance.now(); while (!player.onGround && performance.now() - tl < 4000) await sleep(30); } await sleep(200);
    const floor = player.y + player.h, max = () => getMaxHp();
    const stand = (x) => { player.x = x; player.y = floor - player.h; player.vx = 0; player.vy = 0; player.onGround = true; };
    const oActive = window._coopActive, oFollow = window._coopFollowingHost, oWs = net.ws, oHost = net.isHost, oHostId = net.hostId;
    const sent = [];
    try {
      // ---- HOST: fire real roars, keep what would go out
      net.isHost = true; net.ws = { readyState: 1, send: (s) => { try { const m = JSON.parse(s); if (m && m.t === 'bosshit' && (m.k === 'lrRoar' || m.sl === "Leo's Royal Roar")) sent.push(m); } catch (e) {} } }; window._coopActive = () => true;
      const roar = async (gap, dodging) => {
        game.monsters.length = 0; game.projectiles = []; game.hazards = [];
        spawnMonster(1200, floor - monsterTypes.zodiac_leo.h, 'zodiac_leo', true); const L = game.monsters.filter((x) => x && x.type === 'zodiac_leo').pop();
        L.y = floor - L.h; L.currentHp = L.maxHp = 1e12; const lx = L.x; player._god = true; player.invulnerable = 1e9; stand(lx + L.w + gap); await sleep(300);
        const n0 = sent.length; player._god = false; player.invulnerable = dodging ? 1e9 : 0; player.hp = max(); player._lastDamageSource = '';
        L.patternState = 'roarWindup'; L.patternTimer = 705; L._leoRoarDir = 1; let lost = 0; const t0 = performance.now();
        while (performance.now() - t0 < 1500 && sent.length === n0 && !lost) { L.x = lx; L.vx = 0; stand(lx + L.w + gap); if (!dodging) player.invulnerable = Math.min(player.invulnerable, 0);
          if (player.hp < max() - 0.5 && player._lastDamageSource === "Leo's Royal Roar") lost = max() - player.hp; await sleep(8); }
        await sleep(60); if (!lost && player.hp < max() - 0.5 && player._lastDamageSource === "Leo's Royal Roar") lost = max() - player.hp;
        player._god = true; player.invulnerable = 1e9; player.hp = max();
        return { lx, lw: L.w, lost: Math.round(lost), msgs: sent.slice(n0).map((m) => ({ k: m.k || null, r: m.r, fr: m.fr, p: m.p || null, x: m.x })), raw: sent.slice(n0) };
      };
      out.hostHit = await roar(100, false);
      out.hostDodge = await roar(100, true);
      // ---- GUEST: apply the first message with the guest's player placed around Leo
      net.isHost = false; net.ws = null; net.hostId = 1; window._coopFollowingHost = () => true;
      const msg = out.hostHit.raw[0] ? JSON.parse(JSON.stringify(out.hostHit.raw[0])) : null; delete out.hostHit.raw; delete out.hostDodge.raw;
      if (msg) { msg.id = 1; msg.map = game.currentMap; }
      const lx = out.hostHit.lx, lw = out.hostHit.lw;
      const guest = (x) => { if (!msg) return null; stand(x); player._god = false; player.invulnerable = 0; player.hp = max(); _coopApplyBossHit(JSON.parse(JSON.stringify(msg))); const l = Math.round(max() - player.hp); player._god = true; player.invulnerable = 1e9; player.hp = max(); return l; };
      game.paused = false;
      out.gFar = guest(lx + lw + 300);
      out.gBehind = guest(lx - 60 - player.w);
      out.gNear = guest(lx + lw + 100);
      out.share = Math.floor(max() * 0.20 * LX_ZODIAC_DMG_MUL);
    } finally { window._coopActive = oActive; window._coopFollowingHost = oFollow; net.ws = oWs; net.isHost = oHost; net.hostId = oHostId; game.paused = true; }
    return out;
  });
  console.log('build ' + r.ver);
  ok('host: its own player in the cone (100 px) takes 15% of max HP, as in solo', Math.abs(r.hostHit.lost - r.share) <= 1, { lost: r.hostHit.lost, share: r.share });
  ok('host: the roar reaches the guests even when the host\'s own player dodged it', r.hostDodge.msgs.length > 0, r.hostDodge);
  ok('guest: in the cone 300 px past his edge, it is roared (was: outside a 260 px circle round his centre)', r.gFar > 0, { lost: r.gFar, msg: r.hostHit.msgs[0] });
  ok('guest: 60 px behind him, it is NOT roared (was: inside the circle)', r.gBehind === 0, { lost: r.gBehind });
  ok('guest: its share is the host\'s 15% of max HP (was 20%)', r.gNear != null && Math.abs(r.gNear - r.share) <= 1, { lost: r.gNear, share: r.share });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
