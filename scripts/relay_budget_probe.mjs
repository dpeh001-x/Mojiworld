// What does the relay do to a HOST's real message mix? Two plain ws clients in one room; the "host" sends the mix a
// 60 fps host produces in a boss fight, the "guest" counts what arrives. The relay's token bucket is 40 msg/s
// sustained, 60 burst, and it drops silently.   node scripts/relay_budget_probe.mjs [--secs=10] [--mix=old|new]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const SERVE_ROOT = process.env.SERVE_ROOT || ROOT;
const require = createRequire(path.join(SERVE_ROOT, 'mp', 'server.mjs')); const { WebSocket } = require('ws');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SECS = Number(arg('secs', 10)), PORT = process.env.PORT || '11122';
const relay = spawn(process.execPath, [path.join(SERVE_ROOT, 'mp', 'server.mjs')], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, PORT } });
await new Promise((r) => setTimeout(r, 1200));
const open = (name, room) => new Promise((res) => { const ws = new WebSocket(`ws://localhost:${PORT}`); ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', name, room, map: 'm', x: 0, y: 0 })); }); ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.t === 'welcome') res(ws); }); });
const run = async (label, mix) => {
  const room = 'bud' + Math.floor(Math.random() * 1e9); const host = await open('H', room), guest = await open('G', room);
  const got = {}, sent = {}; guest.on('message', (raw) => { try { const m = JSON.parse(raw); got[m.t] = (got[m.t] || 0) + 1; if (m.t === 'kill') got._killSeq = (got._killSeq || []).concat(m.n); } catch (e) {} });
  const t0 = Date.now(); const timers = [];
  for (const [t, everyMs, body] of mix) { let n = 0; timers.push(setInterval(() => { sent[t] = (sent[t] || 0) + 1; host.send(JSON.stringify({ t, n: n++, map: 'm', ...(body || {}) })); }, everyMs)); }
  await new Promise((r) => setTimeout(r, SECS * 1000)); timers.forEach(clearInterval); await new Promise((r) => setTimeout(r, 400));
  const secs = (Date.now() - t0) / 1000; let S = 0, G = 0; const rows = [];
  for (const t of Object.keys(sent)) { S += sent[t]; G += got[t] || 0; rows.push(`${t} ${sent[t]}->${got[t] || 0} (${(100 * (1 - (got[t] || 0) / sent[t])).toFixed(0)}% lost)`); }
  console.log(`${label}: host sent ${(S / secs).toFixed(0)}/s, guest got ${(G / secs).toFixed(0)}/s, lost ${(100 * (1 - G / S)).toFixed(0)}%   ${rows.join('  ')}`);
  host.close(); guest.close();
};
const LIST = { list: new Array(12).fill({ u: 1, x: 100, y: 200, vx: 1, vy: 0, f: 1, h: 900, m: 1000, t: 'slime', b: 0, a: 12 }) };
// today: four independent tickers + the events that must arrive
await run('TODAY  (state 70 ms + mon/proj/haz 50 ms each + 3 kills/s + 2 bosshits/s)', [['state', 70], ['mon', 50, LIST], ['proj', 50, LIST], ['haz', 50, LIST], ['kill', 333], ['bosshit', 500]]);
// bundled: proj + haz ride the mon frame
await run('BUNDLED (state 70 ms + one mon frame 50 ms carrying proj + haz + the same events)', [['state', 70], ['mon', 50, { ...LIST, pl: LIST.list, hl: LIST.list }], ['kill', 333], ['bosshit', 500]]);
relay.kill(); process.exit(0);
