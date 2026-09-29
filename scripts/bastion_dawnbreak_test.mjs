// Bastion of Dawn (the crusader's ultimate): Dawnbreak does not miss, and its armed timer survives a debuff. Per user: "most
// of the time the attack misses and if hit with another debuff the timer disappears temporarily".
//   - misses: every Dawnbreak hit rolled the target's evasion (three rolls a release). Measured at level 100 on the previous
//     build: 60% of the hits missed Leo, 62% Scorpio, 18% King Krook. Now each hit lands; other skills still roll.
//   - timer: the armed banner shared one overhead slot with stun / freeze / stagger / silence / bubble and lost it to any of
//     them. Now it stacks one slot above the debuff (and the heal-lock seal above both).
//   node scripts/bastion_dawnbreak_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11823);
let bad = 0, total = 0; const check = (ok, label, d) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d !== undefined ? '  ' + JSON.stringify(d) : ''}`); if (!ok) bad++; };
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof loadMap === 'function' && typeof _drawPlayerStatusIcons === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
    window.showToast = function () {}; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true;
    player.cls = 'warrior'; player.job = 'knight'; player.master = 'crusader'; player.level = 100;
    loadMap('forest', 300); await wait(2500); game.paused = false;
    const out = { miss: {}, plain: null };
    const log = []; const oHit = window.hitMonster;
    window.hitMonster = function (m, dmg, crit, skill) { const hp0 = m.currentHp; const r = oHit.apply(this, arguments);
      if (skill === 'aoe' && window.__rec) log.push(m.currentHp >= hp0); return r; };
    const target = (type, boss) => { game.monsters.length = 0; player.x = 600; player.vx = 0;
      const m = spawnMonster(player.x + 150, player.y - 40, type, boss, false) || game.monsters[game.monsters.length - 1];
      if (/^zodiac_/.test(type)) { m.zodiacSign = type.slice(7); m.zodiacBoss = true; } m.currentHp = m.maxHp = 1e9; return m; };
    // A. a full Dawnbreak (nova + two after-waves), ten releases per target
    for (const [type, boss] of [['zodiac_leo', true], ['zodiac_scorpio', true], ['kingKrook', true]]) {
      let hits = 0, misses = 0, eva = 0;
      for (let rep = 0; rep < 10; rep++) {
        const m = target(type, boss); eva = m.evasion || 0;
        player.hp = getMaxHp(); player.invulnerable = 9e9; player.mp = 9999; player.skillCooldowns = {};
        player._bastionArmedUntil = 0; player._bastionArmHeld = false;
        SKILL_FNS.crusader_ult(); player._bastionArmAt = game.time - 600; player._bastionArmHeld = false; game.keys = {};
        log.length = 0; window.__rec = true; SKILL_FNS.crusader_ult(); await wait(1300); window.__rec = false;
        for (const miss of log) { if (miss) misses++; else hits++; }
      }
      out.miss[type] = { eva, hits, misses };
    }
    // B. the exemption is Dawnbreak's alone: a plain performAround still rolls against Scorpio
    { let hits = 0, misses = 0; target('zodiac_scorpio', true);
      for (let i = 0; i < 40; i++) { log.length = 0; window.__rec = true; performAround(400, 1, { noShock: true }); window.__rec = false; for (const miss of log) { if (miss) misses++; else hits++; } }
      out.plain = { hits, misses, flag: player._lxSureHit === true }; }
    window.hitMonster = oHit; game.monsters.length = 0;
    // C. the overhead stack: which stickers draw, and where
    const oS = window._lxStatusSticker, drawn = [];
    window._lxStatusSticker = function (x, y, kind, tint, label, secs) { drawn.push({ y: Math.round(y), kind, label: String(label).split(' ')[0], secs }); };
    const clear = () => { player.stunTimer = 0; player.frozenTimer = 0; player._skillLockTimer = 0; player._cancerBubble = 0; player._heavyStunUntil = 0; player.hitStun = 0;
      player._healLockUntil = 0; player.burnTimer = 0; player.invulnerable = 0; };
    const shot = () => { drawn.length = 0; _drawPlayerStatusIcons(400, 300); return drawn.slice(); };
    player.hp = getMaxHp(); clear();
    player._bastionArmedUntil = game.time + 600; player._bastionArmAt = game.time - 60;
    out.alone = shot();
    out.debuffs = {};
    for (const [nm, set] of [['stun', () => { player.stunTimer = 2000; }], ['frozen', () => { player.frozenTimer = 1500; }],
      ['silence', () => { player._skillLockTimer = 2000; }], ['bubble', () => { player._cancerBubble = 1500; }],
      ['stagger', () => { player._heavyStunUntil = game.time + 60; player.hitStun = 400; }]]) { clear(); set(); out.debuffs[nm] = shot(); }
    clear(); player.stunTimer = 2000; player._healLockUntil = game.time + 300; player._healLockTotalF = 300;
    player._healLockAt = game.time - 1; player._healLockMap = game.currentMap;   // _lxHealLocked: started, and on this map
    out.withSeal = shot(); out.sealOn = (typeof _lxHealLocked === 'function') && _lxHealLocked();
    clear(); player._bastionArmedUntil = 0; player.stunTimer = 2000; out.unarmed = shot();
    clear(); window._lxStatusSticker = oS;
    return out;
  });
  for (const [t, r] of Object.entries(R.miss)) check(r.hits >= 25 && r.misses === 0, `a full Dawnbreak never misses ${t} (evasion ${r.eva}): ${r.hits} hits, ${r.misses} misses over 10 releases`, r);
  check(R.plain.misses > 0 && R.plain.flag === false, `other AoE still rolls its miss on Scorpio (${R.plain.misses} of ${R.plain.hits + R.plain.misses}), and the sure-hit flag does not leak`, R.plain);
  check(R.alone.length === 1 && R.alone[0].kind === 'bastion', 'armed, no debuff: the Bastion banner alone', R.alone);
  for (const [nm, d] of Object.entries(R.debuffs)) {
    const ctl = d.find((x) => x.kind !== 'bastion'), bas = d.find((x) => x.kind === 'bastion');
    check(!!ctl && !!bas && bas.y === ctl.y - 30, `${nm}: the debuff banner shows AND the Bastion timer stays, one slot above it`, d);
  }
  const W = R.withSeal, c = W.find((x) => x.kind !== 'bastion' && x.kind !== 'heallock'), b = W.find((x) => x.kind === 'bastion'), h = W.find((x) => x.kind === 'heallock');
  check(R.sealOn && c && b && h && b.y === c.y - 30 && h.y === c.y - 60, 'stun + armed Bastion + heal lock: three stickers stacked in that order', W);
  check(R.unarmed.length === 1 && R.unarmed[0].kind !== 'bastion', 'not armed: the debuff alone (no stray Bastion)', R.unarmed);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
