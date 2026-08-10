// Does the tutorial teach the keys the game actually dispatches on?
//
// The quest journal moved E -> Q in v0.29.387, but five player-facing places
// kept teaching E — including two toasts that read `player.keybinds`, an object
// that has never existed, so they always printed the pre-move letter. Copy
// drifting from bindings is invisible: nothing throws, nothing 404s, the player
// simply presses the wrong key.
//
// This asserts the taught letters against ACTION_KEY_DEFAULT / actionBinds, and
// that no removed feature is still advertised.
//   node serve.js 8950 && node scripts/tutorial_keys_test.mjs 8950 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8950';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('TUTORIAL_STEPS') === 'object' && typeof eval('ACTION_KEY_DEFAULT') === 'object'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(() => {
  const D = eval('ACTION_KEY_DEFAULT');
  const steps = eval('TUTORIAL_STEPS');
  const text = steps.map(s => [s.title, s.gugumaLine, s.tryIt,
    (typeof s.body === 'function' ? (() => { try { return s.body(); } catch (e) { return ''; } })() : s.body) || ''].join(' ')).join('\n');
  // every <kbd>X</kbd> the tutorial teaches
  const taught = [...new Set([...text.matchAll(/<kbd>([A-Za-z]{1,9})<\/kbd>/g)].map(m => m[1].toLowerCase()))];
  return {
    defaults: { quest: D.questJournal, codex: D.codex, build: D.attributesU, map: D.worldMap,
                rebind: D.characterK, npc: D.talkNpc, dex: D.mojidex },
    hasGearEditor: Object.prototype.hasOwnProperty.call(D, 'gearEditor'),
    taught, text,
    questLabel: (typeof _questKeyLabel === 'function') ? _questKeyLabel() : null,
    // a rebind must flow through to the label
    rebound: (() => {
      try {
        const p = eval('player');
        p.actionBinds = p.actionBinds || {};
        const old = p.actionBinds.questJournal;
        p.actionBinds.questJournal = 'i';
        const v = _questKeyLabel();
        p.actionBinds.questJournal = old;
        return v;
      } catch (e) { return 'THREW'; }
    })(),
    mojimonMentioned: /MojiMon/i.test(text),
    mojimonKey: /<kbd>H<\/kbd>[^<]{0,40}MojiMon|MojiMon[^<]{0,80}<kbd>H<\/kbd>/i.test(text),
  };
});

ok('the Quest Journal default really is Q', r.defaults.quest === 'q', { quest: r.defaults.quest });
ok('the tutorial teaches Q, not E, for quests',
   r.taught.includes('q') && !/<kbd>E<\/kbd>\s*<b>Quest/i.test(r.text), { taught: r.taught });
ok('Guguma\'s line names Q', /Q is your quests/.test(r.text), {});
ok('no tutorial text still says E is your quests', !/E is your quests/i.test(r.text), {});

for (const [label, action, want] of [
  ['Codex', 'codex', r.defaults.codex], ['character panel', 'build', r.defaults.build],
  ['world map', 'map', r.defaults.map], ['rebind menu', 'rebind', r.defaults.rebind],
  ['talk to NPCs', 'npc', r.defaults.npc], ['Mojidex', 'dex', r.defaults.dex],
]) ok(`the ${label} key it teaches (${String(want).toUpperCase()}) matches the real binding`,
      r.taught.includes(String(want).toLowerCase()), { taught: r.taught, want });

ok('the label helper resolves to the real default', r.questLabel === 'Q', { label: r.questLabel });
ok('a REBIND flows through to what the player is told', r.rebound === 'I',
   { afterRebindToI: r.rebound });

ok('the dev weapon editor binding is gone', r.hasGearEditor === false, {});
ok('nothing still advertises a Weapon Editor', !/Weapon Editor/i.test(r.text), {});

ok('MojiMon is covered in the tutorial', r.mojimonMentioned === true, {});
ok('and it teaches the H summon hotkey', r.mojimonKey === true, {});
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null && !x.pass ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
