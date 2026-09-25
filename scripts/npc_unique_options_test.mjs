// NO TWO NPCS SHARE A COPY-PASTED OPTION (v0.30.959).
//
// Will (High Commander), Yun (Jade Sentinel) and Coach Stride each offered the identical
// "Train with me ✦" - one line, pasted three times, all routing to the level-up panel. The first two
// are not even trainers. Each now has an option in its own voice: Will answers the question his own
// greeting invites, Yun talks about the patrol, and Stride - who actually runs the training pits -
// keeps the panel behind his own words plus a toast, the way Will's trial warp already does.
//
// The static half of this generalises the complaint: inside openNPC, no option label may be pushed by
// more than one role, with the generic Leave and the shop / map staples deliberately exempt.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/npc_unique_options_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11350';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);

// ---- static: which option labels are pushed by more than one role?
{
  const src = readFileSync(PAGE, 'utf8');
  const head = src.indexOf('function openNPC('), tail = src.indexOf("opts.push({ t:'Leave', cb: closeDialog });", head);
  const body = src.slice(head, tail);
  // split the chain by role branch, collect each branch's plain-string labels
  const parts = body.split(/\} else if \(npc\.role === '([a-zA-Z_]+)'\) \{/);
  const byLabel = {};
  for (let i = 1; i < parts.length; i += 2) {
    const role = parts[i], code = parts[i + 1] || '';
    for (const m of code.matchAll(/opts\.push\(\{ t:'([^'\\]*(?:\\.[^'\\]*)*)'/g)) {
      const label = m[1].replace(/\\'/g, "'");
      (byLabel[label] = byLabel[label] || new Set()).add(role);
    }
  }
  // staples several roles legitimately share: the generic Leave, shop / menu chrome (two smiths offer the
  // same services through the same sub-menu), decline answers, and "Who are you?" - a question anyone
  // asks a stranger, with a different answer each time. The complaint is copy-pasted CHARACTER lines.
  // The four class instructors (taiga / champion / archmage / archer) share the Mirror Trial, class
  // advancement and Distorted Portal routes BY DESIGN: each is gated on player.cls, so a player only
  // ever sees the one from their own master. System routes, not pasted character lines.
  const STAPLE = /^(Leave|Buy .*|Sell .*|Browse .*|Inspect my gear|Not yet|Maybe later|Close|Thanks|Understood|On it|No.*|Yes.*|Who are you\?|◀ Back|Enhance Gear.*|Reforge.*|🛒 Shop.*|✦ Improve.*|Prove yourself in the Inner Dimension ✦|Advance my class ✦|🌀 Begin the Distorted Portal trial ✦)$/i;
  const shared = Object.entries(byLabel).filter(([l, roles]) => roles.size > 1 && !STAPLE.test(l))
    .map(([l, roles]) => l + ' <- ' + [...roles].join(','));
  check(!/t:'Train with me/.test(body) && !/opts\.push\(\{ t:'Level up ✦'/.test(body), "no role pushes 'Train with me' or 'Level up ✦' any more", 'openNPC scanned');
  check(shared.length === 0, 'no character line is pushed by more than one role', shared.length ? J(shared.slice(0, 6)) : Object.keys(byLabel).length + ' distinct labels');
}

// ---- live: open each of the three and use the new line
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const clearCine = async () => { for (let i = 0; i < 14; i++) { const c = await page.evaluate(() => (document.body.className.match(/cinematic|sb-active/g) || []).join('+')); if (!c) break; await page.keyboard.press('Space'); await page.waitForTimeout(400); } };
const CASES = [
  { who: 'Will',   map: 'bastionThrone',  role: 'champion', label: 'Tell me if I am enough.',      reply: /ground you refuse to give/ },
  { who: 'Yun',    map: 'emeraldVillage', role: 'sentinel', label: 'What have you seen out there?', reply: /boundary stones/ },
  { who: 'Stride', map: 'bastion',        role: 'arena',    label: /^Put me through a set/,        panel: /Stride/ },
  { who: 'Elena',  map: 'bastionThrone',  role: 'scribe',   label: /^Set my deeds in the ledger/,  panel: /Elena/ },
  { who: 'Auron',  map: 'azureAcademia',  role: 'scholar',  label: /^Add my forms to the tome/,    panel: /Auron/ },
];
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40;
  });
  for (const c of CASES) {
    const r = await page.evaluate(async ({ map, role, label, rx }) => {
      try { closeAllModals(); } catch (e) {}
      loadMap(map, 300); await new Promise((x) => setTimeout(x, 1800)); game.paused = false;
      const n = (game.npcs || []).find((x) => x && x.role === role);
      if (!n) return { no: 'no ' + role + ' on ' + map };
      openNPC(n); await new Promise((x) => setTimeout(x, 600));
      const labels = [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
      const re = rx ? new RegExp(label) : new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
      const btn = [...document.querySelectorAll('#dialog-options button')].find((b) => re.test((b.textContent || '').trim()));
      if (!btn) return { labels, no: 'option' };
      window.__toasts = []; const f = window.showToast; if (f && !f.__w) { window.showToast = function (m) { try { window.__toasts.push(String(m).slice(0, 100)); } catch (e) {} return f.apply(this, arguments); }; window.showToast.__w = true; }
      btn.click();
      // the dialog typewriters text in: wait until it stops growing rather than reading a prefix
      { let last = -1; for (let k = 0; k < 40; k++) { await new Promise((x) => setTimeout(x, 150)); const len = (document.getElementById('dialog-text').textContent || '').length; if (len === last && k > 2) break; last = len; } }
      const lv = document.getElementById('attributes-modal');   // openLevelUpPanel shows the U panel
      const full = (document.getElementById('dialog-text').textContent || '').replace(/\s+/g, ' ').trim();
      return { labels, full, said: full.slice(0, 140),
        toasts: window.__toasts, panelOpen: !!(lv && lv.getClientRects().length && getComputedStyle(lv).display !== 'none'),
        dialogOpen: (() => { const d = document.getElementById('dialog'); return !!(d && d.getClientRects().length && getComputedStyle(d).display !== 'none'); })() };
    }, { map: c.map, role: c.role, label: c.label instanceof RegExp ? c.label.source : c.label, rx: c.label instanceof RegExp });
    await clearCine();
    if (r.no) { check(false, c.who + ': ' + r.no, J(r.labels || '')); continue; }
    check(!r.labels.some((l) => /Train with me/.test(l)), c.who + ' no longer offers "Train with me"', J(r.labels));
    if (c.reply) check(c.reply.test(r.full), c.who + "'s new line gets a reply in his own voice", r.said.slice(0, 90));
    if (c.panel) check(r.panelOpen && !r.dialogOpen && r.toasts.some((t) => c.panel.test(t)), c.who + "'s line still opens the growth panel, with their own words on the way out", J({ panel: r.panelOpen, toast: r.toasts[0] }));
  }
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
