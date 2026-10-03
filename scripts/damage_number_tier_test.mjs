// Damage-number tier + hit-spark size measure a hit against the player's REAL ATK (v0.30.1607). Both used to read player.atk,
// which nothing ever set, so the "multiple of ATK" was the raw damage and every hit of 3.5+ wore the top tier and the
// biggest spark. Hits at fixed multiples of getAtk() on a pinned dummy must land in the tier the scale gives that multiple,
// with the matching spark size, and the same raw damage against a smaller ATK must land higher.
//   node scripts/damage_number_tier_test.mjs      MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree
// Negative control: v0.30.1604 puts every one of these hits in tier 4 with a 68 px spark.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10271); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const VARIANT = 'double';   // the scale this build ships: double = 1/2/4/7x ATK, keep = 0.5/1/2/3.5x, atk = 0.5/1/2/3.5x + raw floors
const SCALE = VARIANT === 'double' ? [1, 2, 4, 7] : [0.5, 1, 2, 3.5];
const SPARK = VARIANT === 'double' ? { lo: 1, span: 6 } : { lo: 0.5, span: 3 };
const tierOf = (dealt, atk) => { const r = dealt / atk; let t = r >= SCALE[3] ? 4 : r >= SCALE[2] ? 3 : r >= SCALE[1] ? 2 : r >= SCALE[0] ? 1 : 0;
  if (VARIANT === 'atk') { if (dealt >= 1500 && t < 4) t = 4; else if (dealt >= 700 && t < 3) t = 3; } return t; };
const sparkOf = (dealt, atk) => Math.round(44 + Math.max(0, Math.min(1, (dealt / atk - SPARK.lo) / SPARK.span)) * 24);
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof hitMonster === 'function' && typeof getAtk === 'function' && typeof spawnMonster === 'function' && typeof refreshGearCache === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const o = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'mage'; player.level = 50; player.mods = player.mods || {}; player.mods.atk = 0; player.mods.atkPct = 0;
    player.equipped = { weapon: null, armor: null, accessory: null }; refreshGearCache();
    game.monsters.length = 0;
    const m = spawnMonster(player.x + 200, player.y - 10, 'slime', false);
    Object.assign(m, { maxHp: 1e12, currentHp: 1e12, def: 0, evasion: 0, dodge: 0, level: 1, traits: null });
    const sparks = []; const _sb = spawnSpriteBurst;
    spawnSpriteBurst = function (x, y, key, opts) { if (/^hit_/.test(String(key))) sparks.push(opts && opts.size); return _sb.apply(this, arguments); };
    const hit = (raw) => {
      game.time += 5;   // a new frame: the ATK memo refreshes and the one-spark-a-frame gate opens
      game.damageNumbers.length = 0; const s0 = sparks.length; m.currentHp = m.maxHp;
      hitMonster(m, raw, false, 'fireball');
      const d = game.damageNumbers.filter((x) => x && x.tier !== undefined && !x.taken).pop();
      return { raw, dealt: d ? +String(d.text).replace(/[^\d]/g, '') : null, tier: d ? d.tier : null, big: d ? d.big : null, color: d ? d.color : null, spark: sparks.length > s0 ? sparks[sparks.length - 1] : null };
    };
    try {
      player.baseAtk = 1000; game.time += 5; o.atk = getAtk();
      o.rows = [0.4, 0.8, 1.5, 2.2, 3, 5, 8, 12].map((k) => Object.assign({ mult: k }, hit(Math.round(k * o.atk))));
      // the same raw damage against a tenth of the ATK
      player.baseAtk = 100; game.time += 5; o.atkLow = getAtk();
      o.low = hit(o.rows[3].raw);
    } finally { spawnSpriteBurst = _sb; player.baseAtk = 1000; }
    return o;
  });
  console.log('build ' + r.ver + ' (variant ' + VARIANT + ')  ATK ' + r.atk + ' / ' + r.atkLow);
  for (const x of r.rows) console.log(`  ${String(x.mult).padStart(4)}x  dealt ${x.dealt}  tier ${x.tier}  spark ${x.spark}  ${x.color}`);
  ok('every hit lands in the tier its multiple of the REAL ATK gives', r.rows.every((x) => x.dealt > 0 && x.tier === tierOf(x.dealt, r.atk)),
    r.rows.map((x) => x.tier + '/' + tierOf(x.dealt, r.atk)).join(' '));
  ok('the scale is in use: a chip hit sits at the bottom, a 12x hit at the top, never falling as the hit grows',
    r.rows[0].tier === 0 && r.rows[r.rows.length - 1].tier === 4 && r.rows.every((x, i) => !i || x.tier >= r.rows[i - 1].tier), r.rows.map((x) => x.tier).join(' '));
  ok(VARIANT === 'double' ? 'a basic-sized hit (2.2x ATK since v0.30.1604) sits in tier 2, as its 1.1x did' : 'a basic-sized hit (2.2x ATK) sits where the scale puts it',
    r.rows[3].tier === tierOf(r.rows[3].dealt, r.atk) && (VARIANT !== 'double' || r.rows[3].tier === 2), 'tier ' + r.rows[3].tier);
  ok('the hit spark grows with the hit, by the same yardstick (44 px at the bottom, 68 px at the top)',
    r.rows.every((x) => x.spark != null && Math.abs(x.spark - sparkOf(x.dealt, r.atk)) <= 1) && r.rows[0].spark < r.rows[r.rows.length - 1].spark,
    r.rows.map((x) => x.spark + '/' + sparkOf(x.dealt, r.atk)).join(' '));
  ok('the same raw hit against a tenth of the ATK lands in a higher tier', r.low.tier > r.rows[3].tier && r.low.tier === tierOf(r.low.dealt, r.atkLow),
    `${r.low.dealt} dmg: tier ${r.rows[3].tier} at ATK ${r.atk}, ${r.low.tier} at ATK ${r.atkLow}`);
  ok('nothing reads the unset player.atk any more; both readers ask _lxAtkThisFrame',
    !src.includes('(player && player.atk) || 1') && !src.includes('(player.atk || 1)') && src.includes('const _pATK = _lxAtkThisFrame();') && src.includes('const _hATK = _lxAtkThisFrame();'));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
