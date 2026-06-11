#!/usr/bin/env node
// Mini-boss damage/death SFX (ludo /audio/sound-effect) → the game's zero-code
// per-monster override slots: audio/monster/mob_<type>_<hit|die>.mp3.
//   node tools/_gen_miniboss_sfx.mjs --generate
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'audio', 'monster');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

const ITEMS = {
  mob_blightElder_hit:  'A heavy wet wood-crack impact — a massive rotten tree trunk struck hard, damp bark splintering with a soft squelchy moss puff, deep and woody, ONE single impact, clean and dry, about 0.5 seconds, abrupt end, no music, no reverb tail.',
  mob_blightElder_die:  'A huge rotten ancient tree groaning and collapsing — a cascade of creaking timber cracks, then one heavy damp ground crash with a soft hissing spore-puff settling after, single event about 1.3 seconds, clean and dry, no music.',
  mob_ossuaryTyrant_hit:'A heavy bone armor impact — a thick ivory bone plate struck hard, a deep skeletal KNOCK with a faint hollow rattle of smaller bones, ONE single impact, clean and dry, about 0.5 seconds, abrupt end, no music, no reverb tail.',
  mob_ossuaryTyrant_die:'A massive bone golem collapsing — a heavy cascade of thick bones clattering and tumbling onto stone, ending in one deep hollow skull knock and a faint ghostly sigh, single event about 1.4 seconds, clean and dry, no music.',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!has('--generate')) { for (const k in ITEMS) console.log('## ' + k + '\n' + ITEMS[k] + '\n'); process.exit(0); }
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

let fail = 0;
for (const k in ITEMS) {
  const dest = join(DIR, k + '.mp3');
  process.stdout.write('  ' + k + ' ... ');
  if (!has('--force') && await exists(dest)) { console.log('skip'); continue; }
  let done = false, last;
  for (let a = 1; a <= 4 && !done; a++) {
    try {
      const res = await fetch(`${API}/audio/sound-effect`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(180000),
        body: JSON.stringify({ description: ITEMS[k], duration: k.endsWith('_hit') ? 1.0 : 1.5, loop: false, augment_prompt: false }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 120)); }
      const data = await res.json();
      const url = data?.url || (Array.isArray(data) ? data[0]?.url : null);
      if (!url) throw new Error('no url');
      const a2 = await fetch(url, { signal: AbortSignal.timeout(120000) });
      const buf = Buffer.from(await a2.arrayBuffer());
      if (!buf.length) throw new Error('empty');
      await mkdir(DIR, { recursive: true });
      await writeFile(dest, buf);
      console.log('OK ' + buf.length + ' bytes'); done = true; await sleep(500);
    } catch (e) { last = e; if (/402/.test(e.message)) { console.log('FAIL: ' + e.message); process.exit(3); } if (a < 4) await sleep(3000 * a); }
  }
  if (!done) { fail++; console.log('FAIL: ' + (last && last.message)); }
}
process.exit(fail ? 2 : 0);
