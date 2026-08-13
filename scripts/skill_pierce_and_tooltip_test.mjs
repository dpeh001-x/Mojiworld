// Tester asks:
//   - Dark Pulse's tooltip does not describe what it does (it raises undead).
//   - Mage's S should not pierce ("too strong of a mobbing skill").
//   - Archer's X, S, C should not pierce.
//
// The KEY the player presses is not the `slot` a skill declares:
// KEY_TO_SLOT_DEFAULT maps x->s, s->a, c->e. Reading the request as slot
// letters would target Fireball and Multi Shot, neither of which pierces. This
// resolves KEY -> slot -> skill through the game's own table so the assertions
// are about the buttons the tester actually pressed.
//   node scripts/skill_pierce_and_tooltip_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof SKILLS === 'object' && typeof SKILL_FNS === 'object', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = { keyMap: {}, byKey: {}, fired: {}, desc: {} };
  for (const k of ['x', 's', 'c']) out.keyMap[k] = KEY_TO_SLOT_DEFAULT[k];

  const skillOn = (cls, key, job, master) => {
    const slot = KEY_TO_SLOT_DEFAULT[key];
    for (const id in SKILLS) {
      const s2 = SKILLS[id];
      if (!s2 || s2.cls !== cls || s2.slot !== slot) continue;
      if (s2.job && s2.job !== job) continue;
      if (s2.master && s2.master !== master) continue;
      if (!s2.job && !s2.master) return id;      // base-class skill
      return id;
    }
    return null;
  };
  out.byKey.mageS = skillOn('mage', 's');
  out.byKey.archerX = skillOn('archer', 'x');
  out.byKey.archerS = skillOn('archer', 's');
  out.byKey.archerC = skillOn('archer', 'c');

  // Fire each and inspect the projectiles it produced.
  const fire = (id, cls) => {
    player.cls = cls; player.job = null; player.master = null;
    game.paused = false; player.hp = Math.max(1, player.maxHp || 100);
    player.mp = 9999; player.skillCooldowns = {};
    game.projectiles.length = 0;
    try { SKILL_FNS[id](); } catch (e) { return { err: String(e).slice(0, 60) }; }
    const mine = game.projectiles.filter(p => p && p.owner === 'player');
    return { n: mine.length, anyPierce: mine.some(p => !!p.pierce) };
  };
  out.fired.iceSpike = fire('iceSpike', 'mage');
  out.fired.chargedShot = fire('chargedShot', 'archer');
  out.fired.multiShot = fire('multiShot', 'archer');
  out.fired.fireball = fire('fireball', 'mage');

  out.desc.darkPulse = SKILLS.darkPulse && SKILLS.darkPulse.desc;
  out.desc.chargedShot = SKILLS.chargedShot && SKILLS.chargedShot.desc;
  // Skills that SHOULD still pierce, on other keys.
  out.stillPierce = {};
  for (const id of ['marksman_oneshot', 'elementalArrows']) {
    const s3 = SKILLS[id];
    out.stillPierce[id] = s3 ? s3.slot : null;
  }
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('key -> slot :', JSON.stringify(r.keyMap));
console.log('key -> skill:', JSON.stringify(r.byKey));
console.log('fired       :', JSON.stringify(r.fired));
console.log('darkPulse   :', r.desc.darkPulse);

ok('key S resolves to slot a, not slot s', r.keyMap.s === 'a', r.keyMap);
ok("mage's S key is Ice Spike (not Fireball)", r.byKey.mageS === 'iceSpike', { got: r.byKey.mageS });
ok("archer's S key is Charged Shot", r.byKey.archerS === 'chargedShot', { got: r.byKey.archerS });
ok("archer's X key is Multi Shot", r.byKey.archerX === 'multiShot', { got: r.byKey.archerX });

ok('Ice Spike fires projectiles at all', (r.fired.iceSpike.n | 0) > 0, r.fired.iceSpike);
ok('Ice Spike no longer pierces', r.fired.iceSpike.anyPierce === false, r.fired.iceSpike);
ok('Charged Shot fires projectiles at all', (r.fired.chargedShot.n | 0) > 0, r.fired.chargedShot);
ok('Charged Shot no longer pierces', r.fired.chargedShot.anyPierce === false, r.fired.chargedShot);
ok('Multi Shot (archer X) never pierced and still does not', r.fired.multiShot.anyPierce === false, r.fired.multiShot);
ok('Fireball (mage slot s) is untouched and non-piercing', r.fired.fireball.anyPierce === false, r.fired.fireball);

ok('Dark Pulse tooltip now mentions the undead it raises',
   /undead/i.test(r.desc.darkPulse || '') && /5/.test(r.desc.darkPulse || ''), { desc: r.desc.darkPulse });
ok('Dark Pulse tooltip still states its AoE damage', /3\.5/.test(r.desc.darkPulse || ''), { desc: r.desc.darkPulse });
ok('Charged Shot tooltip stops claiming it pierces',
   !/pierc/i.test(r.desc.chargedShot || ''), { desc: r.desc.chargedShot });
ok('skills on OTHER keys were left piercing (G and V, not x/s/c)',
   r.stillPierce.marksman_oneshot === 'x' && r.stillPierce.elementalArrows === 'c', r.stillPierce);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
