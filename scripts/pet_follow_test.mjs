// IDLE PETS FOLLOW YOU ACROSS LEVELS (v0.30.x pet-follow). Per user: "make the idle pets follow me onto platforms too".
//   node scripts/pet_follow_test.mjs      (MOJI_GAME_FILE=<build.html>, PORT=<port>, MOJI_DATA_REF=<git ref for data/>)
// An idle wolf only roamed left/right around the player and jumped only toward a monster, so it paced the floor under
// the platform you stood on. On the forest map, with every monster cleared each tick:
//   A  you on a jumpable platform (~95 px up), the pet on the ground under it -> it JUMPS up (before the 2.5 s hop);
//   B  you on a platform out of jump reach (~200 px up) -> it hops to your side after ~2.5 s;
//   C  you back on the ground, off the platform's end -> the pet comes down;
//   D  the Call of the Wild pack and the Apex Bond werewolf follow too;
//   E  on your own level it just roams - no hop, no teleport.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '11481', DATA_REF = process.env.MOJI_DATA_REF || '';
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })).newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  if (DATA_REF) await page.route((u) => /^[/]data[/][^/]+[.](js|json)$/.test(u.pathname), (r) => {
    try { r.fulfill({ status: 200, contentType: 'text/javascript', body: execFileSync('git', ['show', DATA_REF + ':' + decodeURIComponent(new URL(r.request().url()).pathname).slice(1)], { cwd: ROOT, maxBuffer: 1 << 26 }) }); } catch (e) { r.continue(); } });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof SKILL_FNS === 'object', null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; loadMap('forest'); await wait(2500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false; player._god = true; player.master = 'beastmaster';
    const P = game.mapData.platforms, G = P.filter((p) => p.type === 'ground').sort((a, b) => b.w - a.w)[0];
    const plats = P.filter((p) => p.type === 'platform' && p.w >= 130);
    const low = plats.filter((p) => G.y - p.y >= 80 && G.y - p.y <= 105)[0], high = plats.filter((p) => G.y - p.y >= 180 && G.y - p.y <= 240)[0];
    let hold = null;
    const keep = setInterval(() => { game.monsters = []; player.vx = 0; if (hold) { player.x = hold.x; } }, 16);
    const standOn = async (surf, x) => { hold = { x: x - player.w / 2 }; player.x = hold.x; player.y = surf.y - player.h - 1; player.vy = 0; await wait(500); };
    const pets = () => [player.pet, player.ultPet, ...(player.pack || [])].filter(Boolean);
    const footOn = (e, surf) => e.onGround && Math.abs(e.y + e.h - surf.y) <= 2;
    // watch a set of pets until each stands on `surf`; returns seconds to arrive (null = never) and whether it jumped
    const watch = async (list, surf, ms) => {
      const t0 = performance.now(), res = list.map(() => ({ t: null, jumped: false, maxStep: 0 }));
      const last = list.map((e) => ({ x: e.x, y: e.y }));
      while (performance.now() - t0 < ms && res.some((r) => r.t === null)) {
        await new Promise((r) => requestAnimationFrame(r));
        list.forEach((e, i) => { if (e.vy < -3) res[i].jumped = true; res[i].maxStep = Math.max(res[i].maxStep, Math.hypot(e.x - last[i].x, e.y - last[i].y)); last[i] = { x: e.x, y: e.y };
          if (res[i].t === null && footOn(e, surf)) res[i].t = +((performance.now() - t0) / 1000).toFixed(2); });
      }
      return res;
    };
    const summon = () => { game.minions = []; player.pet = null; player.ultPet = null; player.pack = []; SKILL_FNS.wildBond(); SKILL_FNS.beastmaster_ult(); SKILL_FNS.beastmaster_pack && SKILL_FNS.beastmaster_pack(); };
    const toGround = (x) => { pets().forEach((e, i) => { e.x = x + (i - 1) * 70 - e.w / 2; e.y = G.y - e.h; e.vx = 0; e.vy = 0; e.onGround = false; e._lxFollowSince = 0; }); };
    const out = { low: low && [low.x, low.y, low.w], high: high && [high.x, high.y, high.w] };
    if (!low || !high) return out;
    // E - your own level: roam only, no hop / teleport
    await standOn(G, 900); summon(); await wait(800);
    const e = await watch(pets(), { y: -1e6 }, 3000);
    out.E = { maxStep: Math.max(...e.map((r) => r.maxStep)), n: pets().length };
    // A - a jumpable platform
    await standOn(low, low.x + low.w / 2); toGround(low.x + low.w / 2); out.A = await watch([player.pet], low, 4500);
    // D - the pack and the werewolf, same platform
    toGround(low.x + low.w / 2); out.D = await watch(pets(), low, 5500); out.Dn = pets().length;
    // B - out of jump reach
    await standOn(high, high.x + high.w / 2); toGround(high.x + high.w / 2); out.B = await watch([player.pet], high, 5500);
    // C - back down: you on the ground past the platform's end
    await standOn(G, high.x + high.w + 260); out.C = await watch([player.pet], G, 5500);
    clearInterval(keep); return out;
  });
  check(!!R.low && !!R.high, 'the forest has a jumpable platform (~95 px up) and a high one (~200 px up)', { low: R.low, high: R.high });
  if (R.A) {
    check(R.E.n >= 3 && R.E.maxStep < 40, 'on your own level the pets just roam - no hop, no teleport', R.E);
    check(R.A[0].t !== null && R.A[0].jumped && R.A[0].t < 2.4, 'A: an idle wolf under your platform JUMPS up to you (before the 2.5 s hop)', R.A[0]);
    check(R.Dn >= 3 && R.D.every((r) => r.t !== null), 'D: the Call of the Wild pack and the Apex Bond werewolf follow onto the platform too', { n: R.Dn, D: R.D });
    check(R.B[0].t !== null, 'B: out of jump reach, the wolf hops to your side (after ~2.5 s)', R.B[0]);
    check(R.C[0].t !== null, 'C: when you go back down, the wolf comes down too', R.C[0]);
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); srv.kill(); }
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
