// BUG HUNT, ROUND 6 (2026-10-11) - findings from four read-only hunters (H13-H16), each proven in the running game. Base FAIL / fix PASS.
//   [1] a QUEUED boss boon with a full bag says why it waits   ([2] retired: v0.30.1734 release12 saves the owed wheel, game._lxBoonOwed)
//   [3] the Journal's coin preview carries the Ticket Rush repeat rate   [4] a guest's Slaughter Ladder measures from the kill's centre
//   [5] photo mode: Up pans, it does not walk through a door   [6] Keybinds do not open over the boss boon wheel
//   [7] a held key's auto-repeat skips no film   [8] ...and no story scene   [9] Space presses the pause card's focused button
//   [10] Granitehorn's Immovable counts a monster's touch and holds its shove   [11] Gravitos's strikes take block before the band
//   [12] ...and reach a co-op guest inside his band   [13] Holy Shield's DR reaches a rolled projectile
//   [14] a nested hit keeps the killing blow's lifesteal ledger (source)   [15] a title tab does not save over a newer save
//   [16] the Hourglass's reward when the game closed before its scene opened (once)   [S1] a CDN copy in the old art generation moves to the CDN cache
//   [last] no page errors
//   node scripts/bughunt_round6_test.mjs        PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import http from 'node:http';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11956), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
const WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const cdn = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'image/webp', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }); r.end(WEBP); });
await new Promise((r) => cdn.listen(PORT + 7, '127.0.0.1', r));
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio'] });
const errs = [];
const URL0 = `http://localhost:${PORT}/${FILE}`;
const boot = async () => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`${URL0}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.cls = 'warrior'; player.job = 'berserker'; player.level = 60; player.hp = player.maxHp = 9e6;
    window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    window.__clear = () => { try { closeAllModals(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } game.paused = false; };
    window.__key = (key, opt, tgt) => (tgt || window).dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key, bubbles: true }, opt || {})));
  });
  return { ctx, page };
};
try {
  const { ctx, page } = await boot();
  const a = await page.evaluate(async () => {
    loadMap('forest'); game.paused = false; await __steps(5); game.monsters.length = 0;
    const out = {};
    // [1] a queued boss boon with a full bag
    { const bs = player.boons; player.boons = []; while (player.boons.length < BOON_INVENTORY_CAP) player.boons.push(rollBoonInstance(POWERUPS[0].id));
      game._pendingBossBoon = { name: 'Test Boss', icon: '', maxRoll: false }; _lxDeliverPendingBoon(0);
      out.queued = { waits: !!(game._pendingBossBoon && game._pendingBossBoon._bagFull) };
      game._pendingBossBoon = null; game._lxBoonOwed = null; player.boons = bs; }
    // [3] the Journal's preview of a repeat Ticket Rush stage
    { const id = 'q_clockwork_underpass', q = QUESTS[id], r0 = player._pqChainRuns;
      player._pqChainRuns = 0; const full = _lxQuestCoinPreview(id, q); player._pqChainRuns = 1; const rep = _lxQuestCoinPreview(id, q); player._pqChainRuns = r0;
      out.pq = { full, rep, mul: (typeof _lxPqRepeatMul === 'function') ? (player._pqChainRuns = 1, _lxPqRepeatMul(id)) : null }; player._pqChainRuns = r0; }
    // [4] a guest's Ladder credit, from the kill's centre
    { const was = { host: net.isHost, hostId: net.hostId }, ks = _ksOnKill; let n = 0; _ksOnKill = function () { n++; };
      try { net.isHost = false; net.hostId = 1; _lxCoopRewardSeen.set(616161, { tp: 'slime', boss: false, lv: 10, e: 1, c: 1 });
        _coopApplyKill({ map: game.currentMap, id: 1, u: 616161, tp: 'slime', b: 0, e: 0, c: 0, x: Math.round(player.x + 900), y: Math.round(player.y), kx: Math.round(player.x + player.w / 2), ky: Math.round(player.y + player.h / 2) }); }
      finally { _ksOnKill = ks; net.isHost = was.host; net.hostId = was.hostId; }
      out.ladder = n; }
    // [5] photo mode at a door
    { const po = (game.portals || [])[0]; player.x = po.x - player.w / 2; player.y = ((typeof po.y === 'number') ? po.y : _defaultPortalY(po.x)) - player.h; player.vy = 0; player.hitStun = 0;
      togglePhotoMode(true); __key('ArrowUp', { code: 'ArrowUp' }); await __wait(300); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
      out.photo = { map: game.currentMap, pan: game._photoPan ? game._photoPan.y : null }; togglePhotoMode(false);
      if (game.currentMap !== 'forest') { loadMap('forest'); game.paused = false; await __steps(5); } game.monsters.length = 0; }
    // [6] Keybinds over the boss boon wheel
    { showPowerupChoice({ name: 'Test Boss', icon: '' }); await __wait(200); toggleKeybindModal(); await __wait(100);
      const kb = document.getElementById('keybind-modal'); out.kbOverWheel = !!(kb && kb.style.display === 'flex'); __clear(); }
    // [7] a held key's auto-repeat and a kill film
    { const row = LX_KILL_FILMS.sundered_smith; delete player._storyBeatsSeen[row.key]; _lxPlayKillFilm(row); await __wait(150);
      const opened = !!document.getElementById('kill-film-overlay');
      __key('ArrowRight', { repeat: true }); await __wait(800);
      out.filmRepeat = { opened, still: !!document.getElementById('kill-film-overlay') };
      __key('Escape'); await __wait(800); { const o = document.getElementById('kill-film-overlay'); if (o) o.remove(); } player._storyBeatsSeen[row.key] = true; delete player._lxFilmOpen; window._lxKillFilmPending = 0; __clear(); }
    // [8] ...and a story scene
    { const beat = 'advancement_1'; delete player._storyBeatsSeen[beat]; _playStoryBeat(beat); await __wait(400);
      const on = () => !!document.querySelector('#story-beat-overlay.on'); const opened = on();
      __key('Escape', { repeat: true }, document); await __wait(300);
      out.beatRepeat = { opened, still: on() };
      __key('Escape', {}, document); await __wait(400); player._storyBeatsSeen[beat] = true; delete player._lxBeatOpen; __clear(); }
    // [9] Space on the pause card
    { _lxPauseOpen(); await __wait(100); const b = document.querySelector('#lx-pause .lxp-btn'); if (b) b.focus();
      __key(' ', { code: 'Space' }, document.activeElement || window); await __wait(300);
      out.pauseSpace = { focused: !!b, closed: !document.getElementById('lx-pause') }; try { _lxPauseClose(); } catch (e) {} __clear(); }
    return out;
  });
  ok('[1] a queued boss boon with a full bag waits for room (and says so)', a.queued.waits === true, a.queued);
  ok('[3] the Journal\'s coins for a repeat Ticket Rush stage carry its 25% rate', a.pq.mul < 1 && a.pq.full > 0 && Math.abs(a.pq.rep - Math.round(a.pq.full * a.pq.mul)) <= 1, a.pq);
  ok('[4] a co-op guest earns Ladder credit by the kill\'s centre (not its top-left corner)', a.ladder === 1, { ksOnKill: a.ladder });
  ok('[5] in photo mode Up pans the camera - it does not walk through the door', a.photo.map === 'forest', a.photo);
  ok('[6] Keybinds do not open over the boss boon wheel', a.kbOverWheel === false, { open: a.kbOverWheel });
  ok('[7] a held key\'s auto-repeat does not skip a once-per-save film', a.filmRepeat.opened && a.filmRepeat.still, a.filmRepeat);
  ok('[8] ...nor a story scene', a.beatRepeat.opened && a.beatRepeat.still, a.beatRepeat);
  ok('[9] Space presses the pause card\'s focused button', a.pauseSpace.focused && a.pauseSpace.closed, a.pauseSpace);
  const b = await page.evaluate(async () => {
    const out = {};
    loadMap('forest'); game.paused = false; await __steps(5); game.monsters.length = 0;
    // [10] Granitehorn's Immovable: a monster's touch counts and its shove is held
    { const os = _lxSetSig; _lxSetSig = function (id) { return id === 'granitehorn' ? true : os.apply(this, arguments); };
      try { const m = spawnMonster(player.x + 600, player.y, 'slime'); game.monsters.length = 0;
        player.onGround = true; player.vx = 0; player.vy = 0; player._graniteN = 0; player._graniteUntil = 0; player.invulnerable = 0; player._god = false;
        _lxContactLanding(m, 10, 10, 10);
        out.granite = { n: player._graniteN | 0, vx: +(player.vx || 0).toFixed(2) }; }
      catch (e) { out.granite = { err: String(e.message).slice(0, 80) }; }
      finally { _lxSetSig = os; player._god = true; player.vx = 0; player.hp = player.maxHp; } }
    // [11] Gravitos's strikes take block (the helper his charge and slam now call before the band)
    { player.blockTimer = 10; let v = null; try { v = _lxGravStrikeMitig(1000); } catch (e) { v = 'missing'; } player.blockTimer = 0;
      out.gravMitig = { v, want: Math.max(1, Math.floor(300 * ((player.cls === 'warrior' && typeof _warriorDr === 'function') ? _warriorDr() : 1))) }; }   // block x0.3, then the warrior's DR
    // [12] ...and a co-op guest is clamped to his band
    { const band = _gravHeavyBand(1, 'skill'), cap = _gravBandClamp(1e12, band), mx = (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp;
      const was = { host: net.isHost, hostId: net.hostId }, ofh = _coopFollowingHost;
      try { _coopFollowingHost = () => true; net.isHost = false; net.hostId = 7; player._god = false; player.invulnerable = 0; player.hp = mx; game.paused = false;
        _coopApplyBossHit({ map: game.currentMap, id: 7, r: 0, x: 0, y: 0, d: 5e6, fr: 0, sl: "Gravitos's charge", c: '#ff4466',
          gbd: [+band.floor || 0, +band.cap || 0, +band.mul || 1, Math.round(+band.ref || 0)] });
        out.guestBand = { cap, lost: Math.round(mx - player.hp) }; }
      finally { _coopFollowingHost = ofh; net.isHost = was.host; net.hostId = was.hostId; player._god = true; player.hp = mx; player.invulnerable = 0; } }
    // [13] Holy Shield's DR on a rolled projectile
    { player.blockTimer = 0; const ag = player._aegis; player._aegis = null;
      player._holyShieldDr = 0.25; player._holyShieldDrUntil = (game.time | 0) + 600; const withHs = _lxRolledProjLoss(1000, 1000);
      player._holyShieldDr = 0; const without = _lxRolledProjLoss(1000, 1000); player._holyShieldDrUntil = 0; player._aegis = ag;
      out.holy = { withHs, without }; }
    // [14] the lifesteal ledger around the nested hits (source: a nested hitMonster cannot be driven alone)
    { const src = await (await fetch(location.pathname)).text(); out.ledgerRestores = src.split('[_lxLsSpentHp, _lxLsDealt, _lxLsPending] = _ls;').length - 1; }
    // [15] a tab on the title does not flush its copy over the save on disk
    { const ov = document.getElementById('loading-overlay'), wasIn = window._lxInWorld, lv = player.level;
      _flushSaveStateNow(); const disk0 = JSON.parse(localStorage.getItem(SAVE_KEY)).player.level;
      ov.classList.remove('fade'); ov.style.display = ''; window._lxInWorld = false; player.level = lv + 7;
      try { _lxCreateBackup('bh6 - a title tab'); } finally { ov.classList.add('fade'); ov.style.display = 'none'; window._lxInWorld = wasIn; }   // Save Backups on the title
      const disk1 = JSON.parse(localStorage.getItem(SAVE_KEY)).player.level; player.level = lv;
      out.title = { disk0, disk1 }; }
    // [16] the Hourglass's reward when the game closed inside the 1.6 s between the turn-in and its scene (release12 pays the close and the replay)
    { const settle = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (game.paused && !document.querySelector('#story-beat-overlay.on')) { try { closeAllModals(); } catch (e) {} game.paused = false; } await __wait(100); } };
      _flushSaveStateNow(); loadState(); await settle(2500);   // the first load of the day brings its bonus card
      player.quests.completed.q_hourglass_5 = player.quests.completed.q_hourglass_5 || Date.now(); delete player.quests.active.q_hourglass_5;
      player._storyChoices = Object.assign(player._storyChoices || {}, { hourglass: 'resealed' });
      delete player._storyChoices.hourglass_paid; delete player._storyBeatsSeen.hourglass_verdict; delete player._lxBeatOpen; player._hourglassDue = 1;   // turned in, the scene never opened
      if (!player.consumables) player.consumables = {}; const hp0 = player.consumables.hp_l | 0;
      _flushSaveStateNow(); loadState(); game.paused = false;
      let opened = false; for (let i = 0; i < 80 && !opened; i++) { await __wait(100); opened = !!document.querySelector('#story-beat-overlay.on'); }
      if (opened) { __key('Escape', {}, document); await __wait(600); }
      const hp1 = player.consumables.hp_l | 0, paid = !!(player._storyChoices && player._storyChoices.hourglass_paid);
      _flushSaveStateNow(); loadState(); game.paused = false; let again = false;   // and once: the next load neither replays nor pays
      for (let i = 0; i < 40 && !again; i++) { await __wait(100); again = !!document.querySelector('#story-beat-overlay.on'); }
      out.hourglass = { opened, hpDelta: hp1 - hp0, paid, again, hpAfter: (player.consumables.hp_l | 0) - hp1, owed: !!player._hourglassDue }; __clear(); }
    return out;
  });
  ok('[10] Granitehorn\'s Immovable counts a monster\'s touch and holds its shove', !b.granite.err && b.granite.n === 1 && b.granite.vx === 0, b.granite);
  ok('[11] Gravitos\'s charge and slam take block before his band (the shared helper)', b.gravMitig.v === b.gravMitig.want, b.gravMitig);
  ok('[12] ...and a co-op guest takes them inside his band', b.guestBand.lost > 0 && b.guestBand.lost <= b.guestBand.cap + 1, b.guestBand);
  ok('[13] Holy Shield\'s +25% DR reaches a rolled projectile', b.holy.withHs < b.holy.without, b.holy);
  ok('[14] the two nested hits hand the killing blow its lifesteal ledger back', b.ledgerRestores === 2, { restores: b.ledgerRestores });
  ok('[15] a Save Backups slot made on the title does not save the tab copy over the save on disk', b.title.disk1 === b.title.disk0, b.title);
  ok('[16] the Hourglass\'s reward is paid once when the game closed before its scene opened', b.hourglass.opened && b.hourglass.hpDelta === 4 && b.hourglass.paid && !b.hourglass.again && b.hourglass.hpAfter === 0 && !b.hourglass.owed, b.hourglass);
  await ctx.close();
  // [S1] the service worker: a CDN copy held in the old art generation moves into the CDN cache as it answers
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await sctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const sp = await sctx.newPage(); sp.on('pageerror', (e) => errs.push('sw: ' + String(e.message).slice(0, 140)));
  await sp.goto(URL0, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await sp.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await sp.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await sp.evaluate(() => !!navigator.serviceWorker.controller))) { await sp.reload({ waitUntil: 'domcontentloaded' }); await sp.waitForFunction(() => typeof loadMap === 'function', null, { timeout: 240000 }); }
  const s1 = await sp.evaluate(async (cdnPort) => {
    const u = 'http://127.0.0.1:' + cdnPort + '/Sprites/bh6_legacy.webp';
    const gen = (await caches.keys()).find((k) => k.startsWith('mojiworld-assets-'));
    if (!gen) return { err: 'no art generation' };
    await (await caches.open(gen)).put(u, new Response(new Blob(['legacy'], { type: 'image/webp' }), { status: 200, headers: { 'Content-Type': 'image/webp' } }));
    const r = await fetch(u); const body = await r.text(); await new Promise((x) => setTimeout(x, 800));
    const inCdn = !!(await (await caches.open('mojiworld-cdn-v1')).match(u));
    return { controlled: !!navigator.serviceWorker.controller, servedLegacy: body === 'legacy', inCdn };
  }, PORT + 7);
  ok('[S1] a CDN copy in the old art generation moves into the CDN cache as it answers', !s1.err && s1.controlled && s1.servedLegacy && s1.inCdn, s1);
  await sctx.close();
  ok('[last] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); cdn.close(); await browser.close(); }
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
