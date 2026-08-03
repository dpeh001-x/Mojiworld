import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // 1) HTML: drop the floating sparkles + swap the 🥺 emoji for the tombstone img
  {
    old: `    <div class="death-sparkles" aria-hidden="true">
      <span>✦</span><span>✧</span><span>★</span><span>✦</span>
      <span>✧</span><span>✦</span><span>★</span><span>✧</span>
    </div>
    <div class="emoji" aria-hidden="true">🥺</div>`,
    neu: `    <img class="death-tomb" src="Sprites/ui/death_tombstone.png" alt="R.I.P" aria-hidden="true">`,
  },
  // 2) CSS: simpler, more-opaque near-solid black panel (drop the pink radial glow)
  {
    old: `    background:
      radial-gradient(ellipse at 50% 38%, rgba(255,200,225,0.25) 0%, transparent 55%),
      radial-gradient(ellipse at center, rgba(80,40,90,0.55) 0%, rgba(15,8,30,0.96) 80%);`,
    neu: `    background:
      radial-gradient(ellipse at center, rgba(22,18,30,0.97) 0%, rgba(0,0,0,0.99) 78%);`,
  },
  // 3) CSS: .emoji rule -> .death-tomb image rule (keep the gentle bob animation)
  {
    old: `  #death-overlay .emoji {
    font-size: 56px;
    filter: drop-shadow(0 6px 18px rgba(255,180,220,0.5));
    margin-bottom: 6px;
    animation: deathEmoji 2.2s ease-in-out infinite;
  }`,
    neu: `  #death-overlay .death-tomb {
    width: 132px; height: 132px;
    object-fit: contain;
    margin-bottom: 10px;
    filter: drop-shadow(0 8px 22px rgba(0,0,0,0.65));
    animation: deathEmoji 2.6s ease-in-out infinite;
  }`,
  },
  // 4) CSS: simpler title — solid soft colour instead of the multi-stop gradient clip
  {
    old: `  #death-overlay .title {
    font: 700 64px/1 "Cinzel", "Playfair Display", Georgia, serif;
    letter-spacing: 4px;
    background: linear-gradient(180deg, #fff7fb 0%, #ffd1e8 55%, #c89aff 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 4px 28px rgba(255,170,220,0.45);
    margin: 4px 0 18px;
  }`,
    neu: `  #death-overlay .title {
    font: 700 56px/1 "Cinzel", "Playfair Display", Georgia, serif;
    letter-spacing: 3px;
    color: #f3eaff;
    text-shadow: 0 2px 18px rgba(0,0,0,0.6);
    margin: 4px 0 16px;
  }`,
  },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1 match, got ${c} for:\n${old.slice(0, 70)}...`); process.exit(2); }
  src = src.replace(old, neu);
  n++;
}
if (src === orig) { console.error('No change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: applied ${n} death-screen edits.`);
