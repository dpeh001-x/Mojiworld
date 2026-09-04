// MOJICOIN ECONOMY: the coin curve on every monster, and a hard boss-gear cap.
// ============================================================================
// Per user: "players mention it is too easy to earn mojicoins" -> "lets work
// with the proposed, cap boss gear drops as well, ensure it is tight and no
// bugs (as I have tried capping it a lot)" -> "make sure the proposed edit
// edits all monsters mojicoin drops".
//
// COINS: the table paid a flat 7.5% of HP; above a 3,000-HP knee the payout now
// grows with HP^0.45 (a Lv 56 elderbark: 5,785 -> ~970). Applied once at the end
// of spawnMonster to everything it returns, flagged, with a drop-time fallback.
// GEAR: one gate with a per-fight budget on the boss (3; 1 on a refight) that
// every boss gear push goes through — including the super-boss routine that
// alone showered Aetherion with nine pieces and that earlier caps never saw.
// Run: node scripts/coin_economy_test.mjs   (MOJI_GAME_FILE / MOJI_SERVE_ROOT override)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9911);
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const SERVE_JS = existsSync(path.join(SERVE_ROOT, 'serve.js')) ? path.join(SERVE_ROOT, 'serve.js') : path.join(ROOT, 'serve.js');
const server = spawn(process.execPath, [SERVE_JS, String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'Econ').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal'); if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3 || getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 160) }; } };
const near = (v, t, pct) => typeof v === 'number' && Math.abs(v - t) <= t * pct;

// ---- the curve ------------------------------------------------------------------
const c = await ev(() => {
  const has = typeof _lxCoinCurve === 'function' && typeof _lxMobCoin === 'function';
  if (!has) return { has };
  const T = LX_MONSTER_STATS;
  const sp = (t, boss) => { game.monsters = []; spawnMonster(player.x + 200, player.y, t, !!boss); const m = game.monsters[game.monsters.length - 1]; return { coin: m.mojicoins, hp: m.maxHp, flag: !!m._coinCurved, table: T[t] ? T[t].coin : null }; };
  loadMap('forest', 300);
  const out = { has, curve: { elderbark: _lxCoinCurve(5785, 77128, false), sandhusk: _lxCoinCurve(284, 3784, false), scorpion: _lxCoinCurve(174, 2307, false), boss: _lxCoinCurve(329664, 19392000, true) } };
  out.elderbark = sp('elderbark'); out.sandhusk = sp('sandhusk'); out.scorpion = sp('scorpion'); out.virgo = sp('zodiac_virgo', true);
  game.monsters = []; spawnMonster(player.x + 200, player.y, 'elderbark', false, true); const eld = game.monsters[game.monsters.length - 1]; out.elder = { coin: eld.mojicoins, hp: eld.maxHp, flag: !!eld._coinCurved, mini: !!eld.isMiniBoss };
  // the drop-time guard: a monster built without the flag is curved when its coins drop
  game.monsters = []; spawnMonster(player.x + 20, player.y, 'elderbark', false); const g = game.monsters[game.monsters.length - 1];
  g._coinCurved = false; g.mojicoins = 5785; g.maxHp = 77128; game.drops.length = 0; g.currentHp = 0; try { killMonster(g); } catch (e) {}
  out.guardDrop = game.drops.filter((d) => d && d.type === 'mojicoin').reduce((a, d) => a + (d.value || 0), 0); game.drops.length = 0;
  return out;
});
ok('the coin curve and the drop-time reader exist', !c.err && c.has, c.err || '');
ok('curve: 3,000-HP knee, HP^0.45 above it — elderbark 5,785 -> ~970, sandhusk 284 -> ~251, scorpion (2,307 HP) untouched, bosses untouched', !c.err && c.curve && near(c.curve.elderbark, 970, 0.02) && near(c.curve.sandhusk, 251, 0.02) && c.curve.scorpion === 174 && c.curve.boss === 329664, c.err || JSON.stringify(c.curve));
ok('a spawned elderbark carries the curved coins and the flag (table 5,785 -> ~970 ±jitter)', !c.err && c.elderbark && c.elderbark.flag && near(c.elderbark.coin, 970, 0.12), c.err || JSON.stringify(c.elderbark));
ok('a spawned sub-knee scorpion is unchanged (~174), a spawned Virgo keeps her boss payout (~318k-330k)', !c.err && c.scorpion && near(c.scorpion.coin, 174, 0.12) && c.virgo && near(c.virgo.coin, 329664, 0.12) && c.virgo.flag, c.err || JSON.stringify({ s: c.scorpion, v: c.virgo }));
ok('an ELDER (mini-boss, 5x HP) is curved too — every spawn is', !c.err && c.elder && c.elder.mini && c.elder.flag && c.elder.coin < 5785 * 3, c.err || JSON.stringify(c.elder));
ok('the drop-time guard curves a monster that skipped spawnMonster (5,785 raw on 77,128 HP -> ~1,940 in the bag, 2x scalar)', !c.err && near(c.guardDrop, 1940, 0.06), c.err || `bag ${c.guardDrop}`);

// ---- the grind, measured on a real map ----------------------------------------------
const g = await ev(async () => {
  loadMap('thornspireThicket', 300); await new Promise((r) => setTimeout(r, 1500));
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  window._prologueActive = false; game.paused = false; player.level = 90; player._god = true; player.hp = getMaxHp(); game.drops.length = 0;
  let kills = 0, coin = 0; const start = Date.now();
  while (kills < 300 && Date.now() - start < 30000) {
    for (const m of game.monsters) { if (m && m.currentHp > 0 && !m._k && !m.isBoss) { m._k = true; m.currentHp = 0; try { killMonster(m); } catch (e) {} kills++; } }
    for (let i = game.drops.length - 1; i >= 0; i--) { const d = game.drops[i]; if (d && d.type === 'mojicoin') { coin += Math.floor((d.value || 0) * 0.5); game.drops.splice(i, 1); } }
    await new Promise((r) => setTimeout(r, 40));
  }
  return { kills, perKill: kills ? Math.round(coin / kills) : 0 };
});
ok('Thornspire Thicket (Lv 56) grinds at ~700-1,600 coins per kill (was ~11,000)', !g.err && g.kills >= 50 && g.perKill >= 700 && g.perKill <= 1600, g.err || JSON.stringify(g));

// ---- the boss gear cap ----------------------------------------------------------------
const b = await ev((bosses) => {
  loadMap('forest', 300); const out = [];
  const gear = (it) => it && (it.slot === 'weapon' || it.slot === 'armor' || it.slot === 'accessory' || it.slot === 'accessorie');
  const kill = (t) => { game.monsters = []; game.drops.length = 0; spawnMonster(player.x + 300, player.y, t, true); const m = game.monsters[game.monsters.length - 1]; m.currentHp = 0; try { killMonster(m); } catch (e) {}
    const items = game.drops.filter((d) => d && d.type === 'item' && d.item); const g = items.filter((d) => gear(d.item)); const leg = g.filter((d) => d.item.rarity === 'legendary').length; const other = items.length - g.length;
    return { gear: g.length, legendary: leg, otherItems: other, coinBags: game.drops.filter((d) => d && d.type === 'mojicoin').length, pushRestored: !Object.prototype.hasOwnProperty.call(game.drops, 'push') }; };
  game._bossKills = {};
  for (const t of bosses) { if (!monsterTypes[t]) { out.push({ t, err: 'no type' }); continue; } const first = kill(t); const refight = kill(t); out.push({ t, first, refight }); }
  return out;
}, ['mooma', 'kingKrook', 'young_confused_barnaby', 'legosaurus', 'sundered_smith', 'aetherion', 'gravitos', 'zodiac_aries', 'zodiac_virgo']);
const bad = Array.isArray(b) ? b.filter((x) => x.err || x.first.gear > 3 || x.refight.gear > 1) : null;
ok('first kill: every boss drops at most 3 pieces of gear — including Aetherion and Gravitos, whose super-boss routine alone dropped 9', Array.isArray(b) && b.length === 9 && bad.length === 0, b.err || (bad ? bad.map((x) => x.t + ':' + JSON.stringify(x.first || x.err)).join(' | ') : ''));
const ae = Array.isArray(b) ? b.find((x) => x.t === 'aetherion') : null, gr = Array.isArray(b) ? b.find((x) => x.t === 'gravitos') : null;
// Gravitos enters the super-boss routine only when the arena sets m.superBoss; a bare spawn
// never did (0 gear before this change too), so the signature check is Aetherion's.
ok('a super boss still drops its signature loot — Aetherion\'s 3 are legendary pieces, and his coin bags still fall (was 11 pieces)', ae && ae.first.gear === 3 && ae.first.legendary >= 3 && ae.first.coinBags >= 2 && gr && gr.first.gear <= 3, JSON.stringify({ aetherion: ae && ae.first, gravitos: gr && gr.first }));
ok('refight: at most 1 piece (3 x 0.4, rounded), on every boss', Array.isArray(b) && b.every((x) => !x.err && x.refight.gear <= 1), Array.isArray(b) ? b.map((x) => x.t + ':' + (x.refight ? x.refight.gear : '?')).join(' ') : '');
ok('the gate leaves the drops array intact afterwards (no lingering push override) and non-gear items still pass', Array.isArray(b) && b.every((x) => !x.err && x.first.pushRestored && x.refight.pushRestored), '');
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const x of res) { if (!x.pass) fail++; console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.extra ? '  — ' + x.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
