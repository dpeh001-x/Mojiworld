import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const URL = 'file:///home/user/Mojiworld/tools/map_editor.html';
const OUT = '/tmp/claude-0/-home-user-Mojiworld/1652515c-62db-56d2-8863-1459f775405a/scratchpad';
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const p = await b.newContext({ viewport: { width: 1360, height: 800 } }).then(c => c.newPage());
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => typeof state === 'object' && state.npcs);
await p.waitForTimeout(400);
await p.screenshot({ path: OUT + '/editor_main.png' });
await p.click('#worldMapBtn');
await p.waitForTimeout(400);
await p.screenshot({ path: OUT + '/editor_worldmap.png' });
await b.close();
console.log('shots saved');
