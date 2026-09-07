// Weakness (v0.30.394): every regular monster is weak to physical or to magic (1.3x,
// WEAK) and resists the other (0.8x, RESIST); bosses are exempt; summons are neutral;
// crits carry their flag on the main number. MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10057); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof hitMonster === 'function' && typeof spawnMonster === 'function' && typeof loadMap === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, has: typeof _lxWeakAffinity === 'function' && typeof LX_MOB_WEAK === 'object' }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true; player.level = 30; player.hp = player.maxHp || 1000; player.cls = 'warrior';
    // the table
    const keys = Object.keys(LX_MOB_WEAK); o.tableN = keys.length; o.missing = keys.filter((k) => !monsterTypes[k]); o.nMagic = keys.filter((k) => LX_MOB_WEAK[k] === 'magic').length; o.nPhys = keys.filter((k) => LX_MOB_WEAK[k] === 'phys').length;
    // the classifier
    const mageSkill = Object.keys(SKILLS).find((k) => SKILLS[k].cls === 'mage');
    o.cls = { melee: _lxDmgClass('melee'), magic: _lxDmgClass('magic'), slash: _lxDmgClass('slash'), mageSkill: _lxDmgClass(mageSkill), pet: _lxDmgClass('pet'), unknownAsWarrior: _lxDmgClass('some_new_tag') };
    player.cls = 'mage'; o.cls.unknownAsMage = _lxDmgClass('some_new_tag'); player.cls = 'warrior';
    // the hits
    const spawnT = (type, boss) => { spawnMonster(player.x + 140, player.y, type, !!boss); const m = game.monsters.filter((x) => x && x.type === type).pop(); m.maxHp = 1000000; m.currentHp = m.maxHp; m.evasion = 0; m.invulnerable = 0; m.freezeTimer = 0; m._wardUntil = 0; return m; };
    const hit = (m, skill, crit) => { m.invulnerable = 0; m._lastHitAt = 0; game.time += 120; game.damageNumbers.length = 0; game.comboMult = 1; game.combo = 0; /* the combo multiplier scales every non-thorns hit; pinned so the ratios are exact */ const h0 = m.currentHp; try { hitMonster(m, 1000, !!crit, skill); } catch (e) { return { err: String(e && e.message) }; } const nums = game.damageNumbers.map((d) => ({ t: d.text, c: d.color, s: d.size, crit: !!d.crit, big: !!d.big })); const loss = h0 - m.currentHp; m.currentHp = m.maxHp; return { loss, nums }; };
    // a monster mitigates physical and magic hits differently (DEF vs MDEF), so each class is measured against its own neutral baseline: the same hit with the type's table entry removed
    const pair = (m, type) => { const w = LX_MOB_WEAK[type]; delete LX_MOB_WEAK[type]; const bMelee = hit(m, 'melee').loss, bMagic = hit(m, 'magic').loss; LX_MOB_WEAK[type] = w; return { weak: w, bMelee, bMagic, melee: hit(m, 'melee'), magic: hit(m, 'magic'), magicCrit: hit(m, 'magic', true), pet: hit(m, 'pet') }; };
    const snail = spawnT('snail'); o.snail = pair(snail, 'snail'); o.snail.thorns = hit(snail, 'thorns');
    const slime = spawnT('slime'); o.slime = pair(slime, 'slime');
    const krook = spawnT('kingKrook', true); o.boss = { aff: _lxWeakAffinity(krook, 'magic'), melee: hit(krook, 'melee'), magic: hit(krook, 'magic') };
    return o;
  });
  const sn = r.snail, sl = r.slime; console.log('build ' + r.ver + '  snail ' + JSON.stringify({ bMelee: sn.bMelee, bMagic: sn.bMagic, melee: sn.melee.loss, magic: sn.magic.loss, pet: sn.pet.loss }) + '  slime ' + JSON.stringify({ bMelee: sl.bMelee, bMagic: sl.bMagic, melee: sl.melee.loss, magic: sl.magic.loss }) + '  boss ' + JSON.stringify({ melee: r.boss.melee.loss, magic: r.boss.magic.loss }));
  ok('the table covers 80+ regular monsters, all real types, both classes well represented', r.has && r.tableN >= 80 && r.missing.length === 0 && r.nMagic >= 35 && r.nPhys >= 35, JSON.stringify([r.tableN, r.missing, r.nMagic, r.nPhys]));
  ok('the classifier: melee/slash are physical, magic and a mage skill are magic, a summon is neutral, an unknown tag follows the player class', r.cls.melee === 'phys' && r.cls.slash === 'phys' && r.cls.magic === 'magic' && r.cls.mageSkill === 'magic' && r.cls.pet === null && r.cls.unknownAsWarrior === 'phys' && r.cls.unknownAsMage === 'magic', JSON.stringify(r.cls));
  ok('a snail (weak to magic): a magic hit deals 1.3x its neutral baseline, a melee hit 0.8x of its own', sn.bMagic > 0 && sn.bMelee > 0 && sn.magic.loss === Math.floor(sn.bMagic * 1.3) && sn.melee.loss === Math.floor(sn.bMelee * 0.8), JSON.stringify([sn.bMagic, sn.magic.loss, sn.bMelee, sn.melee.loss]));
  ok('a summon\'s hit carries no tag (neutral)', sn.pet.loss > 0 && !sn.pet.nums.some((d) => /WEAK|RESIST/.test(d.t)), JSON.stringify(sn.pet.nums));
  ok('a slime (weak to physical): melee 1.3x, magic 0.8x, each of its own baseline', sl.melee.loss === Math.floor(sl.bMelee * 1.3) && sl.magic.loss === Math.floor(sl.bMagic * 0.8), JSON.stringify([sl.bMelee, sl.melee.loss, sl.bMagic, sl.magic.loss]));
  ok('a boss is exempt: no affinity, no tag on either class', r.boss.aff === null && r.boss.melee.loss > 0 && r.boss.magic.loss > 0 && ![...r.boss.melee.nums, ...r.boss.magic.nums].some((d) => /WEAK|RESIST/.test(d.t)), JSON.stringify([r.boss.aff, r.boss.melee.loss, r.boss.magic.loss]));
  const wk = sn.magic.nums, rs = sn.melee.nums, cr = sn.magicCrit.nums;
  ok('a WEAK hit prints an orange, big number suffixed WEAK', wk.some((d) => /WEAK$/.test(d.t) && d.c === '#ff9a3c' && d.big), JSON.stringify(wk));
  ok('a RESIST hit prints a grey-blue number suffixed RESIST, a size under the same plain hit', rs.some((d) => /RESIST$/.test(d.t) && d.c === '#9fb4c8') && Math.max(...rs.map((d) => d.s)) < Math.max(...wk.map((d) => d.s)), JSON.stringify(rs));
  ok('a crit on a weakness keeps the crit flag and the warm crit colour', cr.some((d) => d.crit && d.c === '#ffb347' && /WEAK/.test(d.t)), JSON.stringify(cr));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
