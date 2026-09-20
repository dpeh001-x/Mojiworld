// Live test: DUO TRIAL - the co-op-only reward at the Echo Keeper.
// Co-op is faked at the net-state level (no relay): the Echo Keeper offers the
// trial only with a partner present; a standing clear pays the FULL drop via
// _duoTrialReward; any down fails the live trial; the kill frame carries dt.
//   node scripts/duo_trial_test.mjs   (MOJI_GAME_FILE overrides the build)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _duoTrialReward === 'function' && typeof openNPC === 'function' && typeof spawnMonster === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true;
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  const c = document.querySelector('.cls-card'); if (c) c.click();
  const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
  if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);
const g = await page.evaluate(async () => {
  const out = {}; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try { loadMap('forest'); } catch (e) {} await wait(400);
  const keeper = { name: 'Echo Keeper', role: 'echoKeeper', _bossType: 'kingKrook', x: player.x, y: player.y };
  const optsText = () => Array.from(document.querySelectorAll('#dialog-options button, #dialog-options .dialog-opt, #dialog-modal button')).map(b => b.textContent).join(' | ');
  // solo: no trial offered
  try { openNPC(keeper); } catch (e) { out.openErr = String(e).slice(0, 120); } await wait(150);
  out.soloOffers = /DUO TRIAL/.test(optsText()); try { closeDialog(); } catch (e) {}
  // fake a partner on the session, host side.
  // v0.30.518 ("the Duo Trial reads the room"): a partner is a peer ALIVE ON MY MAP and heard from in the last 6 s
  // (_coopPeerAliveOnMyMap). A bare id in net.peers - which is what this fixture used to be - is exactly what that release
  // stopped counting (a second client parked in town unlocked a solo x1.5 trial that paid the full drop).
  const sent = []; net.connected = true; net.myId = 1; net.isHost = true; net.peers = { 2: { name: 'P2', map: game.currentMap, hp: 100, _last: performance.now() } }; net.ws = { readyState: 1, send: (s) => sent.push(JSON.parse(s)) };
  try { openNPC(keeper); } catch (e) { out.openErr2 = String(e).slice(0, 120); } await wait(150);
  out.duoOffered = /DUO TRIAL/.test(optsText());
  const btn = Array.from(document.querySelectorAll('button')).find(x => /DUO TRIAL/.test(x.textContent));
  game.monsters = []; if (btn) btn.click(); await wait(200);
  const m = game.monsters.find(x => x._duoTrial); out.spawned = !!m; out.named = !!(m && /Duo Trial/.test(m.name)); out.echo = !!(m && m._echoBoss);
  // standing clear: the host kill frame carries dt=1 and pays the host the FULL drop
  player.setshards = 0; player.titles = {}; player.equippedTitle = null; game.duoTrials = 0;
  if (m) { m.level = 50; try { _coopBroadcastKill(m, 0, 0); } catch (e) { out.kfErr = String(e).slice(0, 120); } }
  const kf = sent.find(x => x && x.t === 'kill'); out.dt = kf && kf.dt; out.bx = kf && kf.bx;
  out.hostShards = player.setshards; out.title = !!(player.titles && player.titles['Twin Star']); out.trials = game.duoTrials;
  out.ach = !!ACHIEVEMENTS.find(a => a.id === 'duoTrial' && a.test());
  // guest side: a dt frame pays the guest the full drop too
  // the guest handler is host-only and fail-closed: not the host, and the frame must come from net.hostId
  // v0.30.524 put the Duo Trial on the repeat ladder, keyed per boss on each player's OWN save (it "was flat every time: a respawned
  // boss paid the full drop again, forever"). Host and guest share one page here, so the host's clear above has already stamped
  // duo_kingKrook: first read what a SECOND clear pays on this save (40%, LX_REFIGHT_SHARD_MUL), then give the guest a save of its own.
  player.setshards = 0; try { _duoTrialReward(50, 'kingKrook'); } catch (e) {} out.secondClear = player.setshards; out.refightMul = (typeof LX_REFIGHT_SHARD_MUL === 'number') ? LX_REFIGHT_SHARD_MUL : null;
  if (game._bossKills) delete game._bossKills.duo_kingKrook; game.duoTrials = 1;
  player.setshards = 0; net.isHost = false; net.hostId = 7;
  // A guest only pays for a monster it has actually SEEN: _coopApplyKill asks _lxCoopRewardInfo for the uid's
  // mirrored record and drops the frame when there is none, or when the frame's type disagrees with it. That
  // hardening arrived with the v0.30.85x guest-reward work; this synthetic uid had no record, so it earned 0.
  game.monsters.push({ uid: 999, type: 'kingKrook', _coopMirror: true, isBoss: true, level: 50,
                       exp: 1000, mojicoins: 500, currentHp: 1, maxHp: 1, x: 0, y: 0, w: 40, h: 40 });
  try { _coopApplyKill({ t: 'kill', id: 7, u: 999, e: 0, c: 0, x: 0, y: 0, map: game.currentMap, tp: 'kingKrook', b: 1, bl: 50, dt: 1 }); } catch (e) { out.guestErr = String(e).slice(0, 120); }
  out.guestShards = player.setshards; net.isHost = true; net.hostId = 1;
  // shared fate: a partner going down fails the live trial -> plain echo frame (bx=1, no dt)
  game.monsters = []; if (btn) { try { openNPC(keeper); await wait(120); Array.from(document.querySelectorAll('button')).find(x => /DUO TRIAL/.test(x.textContent)).click(); } catch (e) {} } await wait(150);
  const m2 = game.monsters.find(x => x._duoTrial); _coopApplyDown({ id: 2, map: game.currentMap, x: 0, y: 0 });
  out.failed = !!(m2 && m2._duoTrialFailed); sent.length = 0; if (m2) { m2.level = 50; try { _coopBroadcastKill(m2, 0, 0); } catch (e) {} }
  const kf2 = sent.find(x => x && x.t === 'kill'); out.failFrame = kf2 ? { dt: kf2.dt, bx: kf2.bx } : null;
  net.connected = false; net.peers = {}; net.ws = null; game.monsters = []; try { closeDialog(); } catch (e) {}
  return out;
});
ok('solo: the Echo Keeper does not offer the Duo Trial', !g.openErr && g.soloOffers === false, { err: g.openErr, solo: g.soloOffers });
ok('with a partner on the session the DUO TRIAL option appears and summons a tagged echo', g.duoOffered && g.spawned && g.named && g.echo, { offered: g.duoOffered, spawned: g.spawned, err: g.openErr2 });
ok('a standing clear: kill frame carries dt=1 (no bx), host is paid the FULL level² drop, title + counter + achievement', g.dt === 1 && g.bx !== 1 && g.hostShards === 2500 && g.title && g.trials === 1 && g.ach, { dt: g.dt, bx: g.bx, shards: g.hostShards, title: g.title, err: g.kfErr });
ok('a guest receiving dt=1 pays itself the same full drop (on its own, fresh counter)', g.guestShards === 2500, { guest: g.guestShards, err: g.guestErr });
ok('a second Duo clear of the same boss walks the repeat ladder: 40% of the full drop (v0.30.524)', g.refightMul === 0.4 && g.secondClear === 1000, { second: g.secondClear, mul: g.refightMul });
ok('shared fate: a partner going down fails the live trial and the kill frame becomes a plain echo (bx=1, no dt)', g.failed === true && g.failFrame && g.failFrame.bx === 1 && !g.failFrame.dt, { failed: g.failed, frame: g.failFrame });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });
await b.close(); srv.kill();
let pass = 0; for (const t of results) { console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n); if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 360)); if (t.pass) pass++; }
console.log('\n' + pass + '/' + results.length + ' checks passed'); process.exit(pass === results.length ? 0 : 1);
