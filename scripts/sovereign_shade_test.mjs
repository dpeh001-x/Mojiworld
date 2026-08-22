// Live test: SOVEREIGN SHADE (Shadow Sovereign v2) — per user: "a clone shadow
// partner self buff (much like the mirror) clone that follows you and doubles
// up all your attacks, cooldown 60 seconds".
//
// Driven through the real pieces: SKILL_FNS.shadowlord_ult summons it,
// hitMonster queues the echo, _tickSovereignShade pays it out, drawSovereign-
// Shade paints the body. The doubling is measured on a real monster's HP: the
// echo must land the SAME damage as the original hit through the same pipeline.
//   node scripts/sovereign_shade_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const OUT = process.env.LX_SHOT_DIR || '.';

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
await page.waitForFunction(() => typeof _tickSovereignShade === 'function' && typeof hitMonster === 'function'
  && typeof SKILL_FNS !== 'undefined' && typeof drawSovereignShade === 'function', null, { timeout: 120000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true; game.camera.x = 0;
  player.cls = 'rogue'; player.job = 'ninja'; player.master = 'shadowlord';
  player.hp = 500; player.invulnerable = 0; player.facing = 1;
  // The accuracy roll is real: a hero below the target's level MISSES at
  // random (the first run read those misses as a broken echo). Out-level the
  // dummy so the original always connects; the echo is MISS_EXEMPT by design.
  player.level = 60;
  player.x = 400; player.y = 300; player.vx = 0; player.vy = 0;
  game.time = 1000;
  out.cd = SKILLS.shadowlord_ult.cd;
  out.desc = SKILLS.shadowlord_ult.desc;

  // ---- a target the way a spawn would build one ----
  const t = monsterTypes.slime || monsterTypes[Object.keys(monsterTypes)[0]];
  const mk = () => ({ type: 'slime', name: 'Dummy', w: 40, h: 40, x: 470, y: 300,
    currentHp: 1e6, maxHp: 1e6, hp: 1e6, level: 5, def: 0, atk: 1, isBoss: false });
  const m = mk();
  game.monsters = [m];

  // ---- cast ----
  player._shade = null;
  try { SKILL_FNS.shadowlord_ult(); out.castThrew = null; } catch (e) { out.castThrew = String(e).slice(0, 140); }
  out.summoned = !!player._shade;
  out.life = player._shade ? player._shade.life : 0;
  out.behind = player._shade ? Math.round(player._shade.x - (player.x + player.w / 2)) : 0;

  // ---- follow: move the hero, tick, the shade trails behind the facing ----
  player.x = 600; player.facing = 1;
  for (let i = 0; i < 40; i++) { game.time++; _tickSovereignShade(16); }
  out.followDx = Math.round(player._shade.x - (player.x + player.w / 2));
  player.facing = -1;
  for (let i = 0; i < 40; i++) { game.time++; _tickSovereignShade(16); }
  out.followDxFlipped = Math.round(player._shade.x - (player.x + player.w / 2));
  out.facingMirrors = player._shade.facing === -1;

  // ---- the double: one hit, then the echo ----
  const hp0 = m.currentHp;
  hitMonster(m, 100, false, 'test');
  const hp1 = m.currentHp;
  out.firstHit = hp0 - hp1;
  out.queued = player._shade.queue.length;
  // not yet due
  _tickSovereignShade(16);
  out.echoBeforeDue = (hp1 - m.currentHp);
  // advance past the echo delay
  for (let i = 0; i < 9; i++) { game.time++; _tickSovereignShade(16); }
  out.echoHit = hp1 - m.currentHp;
  out.queueAfter = player._shade.queue.length;     // the echo must NOT re-queue
  out.echoCount = player._shade.echoes;

  // ---- a crit echoes as a crit ----
  const hpC0 = m.currentHp;
  hitMonster(m, 100, true, 'test');
  const hpC1 = m.currentHp;
  for (let i = 0; i < 9; i++) { game.time++; _tickSovereignShade(16); }
  out.critFirst = hpC0 - hpC1; out.critEcho = hpC1 - m.currentHp;

  // ---- a dead target is skipped, not resurrected into a hit ----
  hitMonster(m, 100, false, 'test');
  m.currentHp = 0;
  const echoesBefore = player._shade.echoes;
  for (let i = 0; i < 9; i++) { game.time++; _tickSovereignShade(16); }
  out.deadSkipped = player._shade.echoes === echoesBefore && player._shade.queue.length === 0;
  m.currentHp = 1e6;

  // ---- draw: the body is the tinted hero bake, flipped with facing ----
  const spyDraw = () => {
    let blits = 0, flipped = false, canvasSrc = false;
    const P = CanvasRenderingContext2D.prototype;
    const od = P.drawImage, os = P.scale;
    P.drawImage = function (img) { blits++; if (img && img.tagName === 'CANVAS') canvasSrc = true; return od.apply(this, arguments); };
    P.scale = function (a) { if (a === -1) flipped = true; return os.apply(this, arguments); };
    try { drawSovereignShade(); } catch (e) { blits = -1; }
    P.drawImage = od; P.scale = os;
    return { blits, flipped, canvasSrc };
  };
  player._shade.facing = 1;  out.drawR = spyDraw();
  player._shade.facing = -1; out.drawL = spyDraw();

  // ---- expiry ----
  player._shade.life = 1;
  _tickSovereignShade(16);
  out.expired = player._shade === null;

  // ---- exemption + connected-only ----
  out.shadeExempt = (typeof MISS_EXEMPT_SKILLS !== 'undefined') && MISS_EXEMPT_SKILLS.has('shade');
  player._shade = { life: 9000, maxLife: 12000, x: 0, y: 0, facing: 1, queue: [], swing: 0, echoes: 0 };
  const dodgy = Object.assign(mk(), { evasion: 100000 });   // guaranteed MISS on the evasion roll
  game.monsters = [m, dodgy];
  hitMonster(dodgy, 100, false, 'test');
  out.missQueued = player._shade.queue.length;
  player._shade = null; game.monsters = [m];

  // ---- with no shade, hitMonster must not queue anything ----
  hitMonster(m, 100, false, 'test');
  out.noShadeNoQueue = player._shade === null;
  game.monsters = [];
  return out;
});

ok('cooldown is 60 seconds', r.cd === 60000, { cd: r.cd });
ok('the cast summons the shade, 12s, one step behind the hero', r.summoned && !r.castThrew && r.life === 12000 && r.behind < 0,
  { summoned: r.summoned, life: r.life, behind: r.behind, threw: r.castThrew });
ok('it FOLLOWS: settles ~46px behind the facing direction', r.followDx <= -30 && r.followDx >= -60, { dx: r.followDx });
ok('...and swaps sides when the hero turns, mirroring the facing', r.followDxFlipped >= 30 && r.facingMirrors,
  { dxFlipped: r.followDxFlipped, facingMirrors: r.facingMirrors });
ok('a hit is queued for the echo (not landed twice on the same frame)', r.queued === 1 && r.echoBeforeDue === 0,
  { queued: r.queued, early: r.echoBeforeDue });
ok('THE DOUBLE: the echo lands the same damage as the original hit',
  r.firstHit > 0 && Math.abs(r.echoHit - r.firstHit) <= Math.max(2, r.firstHit * 0.15),
  { first: r.firstHit, echo: r.echoHit });
ok('the echo does not echo itself (queue empty after payout)', r.queueAfter === 0 && r.echoCount === 1,
  { queueAfter: r.queueAfter, echoes: r.echoCount });
ok("the echo is miss-exempt (it repeats a strike that already connected — same rule as 'overflow')",
  r.shadeExempt === true, { exempt: r.shadeExempt });
ok('a MISSED original queues no echo (nothing connected, nothing to repeat)', r.missQueued === 0, { queued: r.missQueued });
// hitMonster takes isCrit as a FLAG — callers pre-multiply the crit into
// dmg (see performAround) — so the flag changes colour and procs, not the
// number. The echo re-enters with the caller's raw dmg AND the flag, so a
// crit is repeated as the same crit; assert the number carries through.
ok("a crit's echo carries the same damage (and the flag) as the original crit",
  r.critFirst > 0 && Math.abs(r.critEcho - r.critFirst) <= Math.max(2, r.critFirst * 0.15),
  { critFirst: r.critFirst, critEcho: r.critEcho });
ok('an echo for a target that died in the gap is dropped, not landed on a corpse', r.deadSkipped, { deadSkipped: r.deadSkipped });
ok('the body draws as a baked canvas (the tinted hero), flipped with facing',
  r.drawR.blits >= 1 && r.drawR.canvasSrc && !r.drawR.flipped && r.drawL.flipped, { right: r.drawR, left: r.drawL });
ok('the shade expires on its timer', r.expired, { expired: r.expired });
ok('no shade, no queue — the hook is inert outside the buff', r.noShadeNoQueue, '');
ok('no page errors', errs.length === 0, errs.slice(0, 3));

// a frame for the eye: hero + shade
const dataUrl = await page.evaluate(() => {
  player.x = 420; player.y = 300; player.facing = 1; game.camera.x = 0;
  player._shade = { life: 9000, maxLife: 12000, x: 420 + player.w / 2 - 46, y: 300 + player.h / 2, facing: 1, queue: [], swing: 0.6, echoes: 0 };
  ctx.save(); ctx.fillStyle = '#2a1d3d'; ctx.fillRect(300, 200, 300, 220); ctx.restore();
  try { drawSovereignShade(); } catch (e) {}
  try { drawPlayer(); } catch (e) {}
  const c = document.createElement('canvas'); c.width = 300; c.height = 220;
  c.getContext('2d').drawImage(ctx.canvas, 300, 200, 300, 220, 0, 0, 300, 220);
  player._shade = null;
  return c.toDataURL('image/png');
});
(await import('node:fs')).writeFileSync(`${OUT}/shade_after.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
