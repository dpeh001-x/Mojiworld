// The skill bar's MP chip and its red "cost-high" flag read the price a cast really takes (fix-bar-mp-cost).
//   node scripts/bar_mp_cost_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// castSkill / isReady charge a mage ceil(mp x 0.80), but renderSkillBar printed and compared the table cost: a mage's Fireball chip read 13 though it costs 11,
// and with 11-12 MP the slot went red (cost-high) although it casts. Every mage skill was ~25% high on the bar (Apotheosis 125 for 100). An armed Bastion release
// never bounces on MP in isReady but the bar still painted it red at low MP. The keybind card printed the same table cost.
// Measured, not assumed: the real price of each skill is the smallest MP at which isReady() says yes, and castSkill is cast at that MP and one below it.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10742';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let R = null; const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderSkillBar === 'function' && typeof isReady === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._lxAwaitingCreation = false; window._lxInWorld = true;
    player._tutorialSeen = true; applyClass('mage'); player.level = 60; player.hp = getMaxHp(); player.maxMp = 99999;
    for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true;
    loadMap('town'); await new Promise((s) => setTimeout(s, 2000)); document.getElementById('everdawn-welcome-overlay')?.remove();
    const out = {};
    const calm = () => { cancelPendingSkillTimers(); game.monsters.length = 0; game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0; player.skillCooldowns = {}; player._castLockUntil = 0; player.stunTimer = 0; player.frozenTimer = 0; player.hitStun = 0; player._skillLockTimer = 0; game.paused = false; player._god = true; };
    // every bar slot of the current hero: the real price (smallest MP isReady accepts), the chip, and the flag just at / just under that price
    const sweep = () => {
      const rows = [];
      for (const sid of _SB_SLOT_IDS) {
        calm(); player.mp = player.maxMp; renderSkillBar();
        const s = _sbSlots[sid]; if (!s || !s.skillId || !SKILLS[s.skillId]) continue;
        const id = s.skillId; let thr = -1;
        for (let mp = 0; mp <= 400; mp++) { calm(); player.mp = mp; if (isReady(id)) { thr = mp; break; } }
        calm(); player.mp = Math.max(0, thr); renderSkillBar(); const atChip = s.mpEl.textContent, atHigh = s.root.classList.contains('cost-high'), atReady = s.root.classList.contains('ready');
        let underHigh = null; if (thr > 0) { calm(); player.mp = thr - 1; renderSkillBar(); underHigh = s.root.classList.contains('cost-high'); }
        rows.push({ sid, id, table: SKILLS[id].mp, thr, atChip, atHigh, atReady, underHigh });
      }
      return rows;
    };
    out.mage = sweep();
    // castSkill itself: Fireball at exactly its price casts and spends it all; one under does not cast
    { const fb = SKILLS.fireball; const price = Math.ceil(fb.mp * 0.8); calm(); player.mp = price; castSkill('fireball'); const castAt = { cd: player.skillCooldowns.fireball | 0, mp: player.mp };
      calm(); player.mp = price - 1; castSkill('fireball'); const castUnder = { cd: player.skillCooldowns.fireball | 0, mp: player.mp };
      out.fireball = { table: fb.mp, price, castAt, castUnder }; }
    // the master kits: Archmage + Sage, Archmage + Elementalist (Apotheosis is 125 on the table)
    player.job = 'archmage'; player.master = 'sage'; calm(); out.sage = sweep();
    player.master = 'elementalist'; calm(); out.elem = sweep(); player.job = null; player.master = null; calm(); renderSkillBar();
    // the keybind card prints the same price
    { let body = document.getElementById('kbm-info-body'); const made = !body; if (made) { body = document.createElement('div'); body.id = 'kbm-info-body'; document.body.appendChild(body); }
      const slot = SKILLS.fireball.slot; const prev = _kbHover; _kbHover = 'fn:skill:' + slot; _kbRenderInfo();
      const b = body.querySelector('.kbm-i-stats b'); out.card = { txt: b ? b.textContent : null, html: body.innerHTML.slice(0, 160) }; _kbHover = prev; if (made) body.remove(); }
    // a non-mage hero is unchanged: the table price, a free skill shows no chip
    applyClass('warrior'); player.level = 60; player.maxMp = 99999;
    out.warrior = sweep();
    // an ARMED Bastion release is a banked cast: never red, whatever the MP (isReady already agrees)
    { const cu = SKILLS.crusader_ult; applyClass('warrior'); player.level = 60; player.job = cu.job; player.master = cu.master; player.maxMp = 99999; calm(); renderSkillBar();
      const s = _sbSlots.b; const o = {};
      if (s) { player.mp = 0; player._bastionArmedUntil = game.time + 600; renderSkillBar(); o.armed = { high: s.root.classList.contains('cost-high'), ready: s.root.classList.contains('ready'), isReady: isReady('crusader_ult') };
        player._bastionArmedUntil = 0; renderSkillBar(); o.unarmed = { high: s.root.classList.contains('cost-high'), isReady: isReady('crusader_ult') }; }
      out.bastion = o; }
    return out;
  });
} finally { await browser.close(); srv.kill(); }
if (!R) { check(false, 'the harness produced results', errs.slice(0, 3)); process.exit(1); }
const priceOk = (r) => r.thr >= 0 && r.atChip === (r.thr > 0 ? String(r.thr) : '') && r.atHigh === false && (r.thr === 0 || r.underHigh === true);
const badMage = R.mage.filter((r) => !priceOk(r));
check(R.mage.length >= 5 && R.sage.length >= 8 && R.elem.length >= 8, 'the mage bars have their skills to measure', R.mage.map((r) => r.id));
const badAll = [...R.mage, ...R.sage, ...R.elem].filter((r) => !priceOk(r));
check(badAll.length === 0, 'every mage slot (base kit, Sage, Elementalist): the chip is the MP isReady needs, red one MP under it and never at it', badAll);
const dearer = [...R.mage, ...R.sage, ...R.elem].filter((r) => r.table > 0 && r.thr < r.table);
check(dearer.length >= 12 && dearer.every((r) => r.thr === Math.ceil(r.table * 0.8)), 'the mage price is the table cost x 0.80 rounded up on every costed skill (the chip used to print the table cost)', dearer.map((r) => [r.id, r.table, r.thr]));
check(R.fireball.price === 11 && R.fireball.table === 13 && R.mage.find((r) => r.id === 'fireball').atChip === '11', 'a mage Fireball chip reads 11 (it read 13)', R.fireball);
check(R.fireball.castAt.cd > 0 && R.fireball.castAt.mp === 0 && R.fireball.castUnder.cd === 0 && R.fireball.castUnder.mp === R.fireball.price - 1, 'castSkill spends exactly that price: it casts at 11 MP (leaving 0) and refuses at 10', R.fireball);
check(R.mage.find((r) => r.id === 'fireball').atReady === true, 'a Fireball at exactly 11 MP shows ready, not red', R.mage.find((r) => r.id === 'fireball'));
const badWar = R.warrior.filter((r) => !priceOk(r) || r.thr !== r.table);
check(R.warrior.length >= 5 && badWar.length === 0, 'a warrior is unchanged: chip and gate are the table cost, a 0-cost skill shows no chip', badWar.length ? badWar : R.warrior.map((r) => [r.id, r.table, r.atChip]));
check(R.card.txt === '11', 'the keybind card prints the mage price too (11, was 13)', R.card);
check(R.bastion.armed && R.bastion.armed.high === false && R.bastion.armed.ready === R.bastion.armed.isReady, 'an armed Bastion release is never red at 0 MP and reads as isReady does', R.bastion);
check(R.bastion.unarmed && R.bastion.unarmed.high === true && R.bastion.unarmed.isReady === false, 'control: unarmed, Bastion at 0 MP is red and not ready', R.bastion);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
