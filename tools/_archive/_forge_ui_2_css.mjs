// Forge UI redesign · 2/3 — CSS: anvil + fx live on the dedicated stage;
// new two-column layout, info strip, floating stage item, empty-state hint.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // 1) z-lift rule: include the new id'd layout containers
  { old: `  #enhance-modal #enhance-list,
  #enhance-modal #enhance-preview,
  #enhance-modal > .modal > div:not([id]) { position: relative; z-index: 1; }`,
    neu: `  #enhance-modal #enhance-list,
  #enhance-modal #enhance-preview,
  #enhance-modal #enhance-topstrip,
  #enhance-modal #enhance-body,
  #enhance-modal > .modal > div:not([id]) { position: relative; z-index: 1; }
  /* v0.26.873 — Forge-stage layout. Gear rack (left) · stage + preview (right). */
  #enhance-topstrip {
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    gap: 12px; flex-wrap: wrap; margin: 2px 0 8px; font-size: 11.5px; color: #aab2c0;
  }
  #enhance-topstrip .sep { color: #3c4150; }
  #enhance-body { flex: 1; min-height: 0; display: flex; gap: 12px; }
  #enhance-list {
    flex: 0 0 236px; min-height: 0; overflow-y: auto; padding: 2px 4px 2px 2px;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(54px, 1fr));
    gap: 7px; align-content: start; justify-items: center;
    background: rgba(0,0,0,0.22); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; padding: 8px;
  }
  #enhance-stage-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  #enhance-stage {
    position: relative; flex: 0 0 200px; border-radius: 12px; overflow: hidden;
    background:
      radial-gradient(ellipse at 50% 105%, rgba(255,140,50,0.20), rgba(255,120,40,0.05) 45%, transparent 70%),
      linear-gradient(180deg, #1a1d25 0%, #14161d 100%);
    border: 1px solid #3c4150;
    box-shadow: inset 0 0 34px rgba(0,0,0,0.55), inset 0 -14px 26px rgba(255,130,40,0.10);
  }
  #enhance-stage-item {
    position: absolute; left: calc(50% - 28px); bottom: 102px;
    width: 56px; height: 56px; z-index: 2; pointer-events: none;
    filter: drop-shadow(0 6px 10px rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgba(255,200,110,0.35));
    animation: stageItemBob 3s ease-in-out infinite;
  }
  @keyframes stageItemBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
  #enhance-stage-hint {
    position: absolute; left: 0; right: 0; top: 34%;
    text-align: center; font-size: 12px; line-height: 1.6; color: #8a93a6;
    pointer-events: none; z-index: 2;
  }
  #enhance-preview { flex: 1 1 auto; min-height: 0; overflow-y: auto; margin-top: 0;
    padding: 10px 12px; background: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; font-size: 12px; }`,
  },

  // 2) anvil: top-left corner decoration -> stage centrepiece
  { old: `  #enhance-anvil {
    position: absolute;
    left: 8px; top: 8px;
    width: 148px; height: 148px;
    background: url('Sprites/ui/anvil.webp') left top/contain no-repeat;
    pointer-events: none;
    z-index: 0;
    filter: drop-shadow(0 8px 14px rgba(0,0,0,0.55))
            drop-shadow(0 0 16px rgba(176,186,204,0.30));
    animation: anvilBob 4.5s ease-in-out infinite;
  }`,
    neu: `  #enhance-anvil {
    /* v0.26.873 — centre-stage anvil: sits on the forge-stage floor, item
       floats above it, the result fx fires right here. left:calc keeps the
       centring outside transform so the bob/strike keyframes can own it. */
    position: absolute;
    left: calc(50% - 70px); bottom: 2px;
    width: 140px; height: 112px;
    background: url('Sprites/ui/anvil.webp') center bottom/contain no-repeat;
    pointer-events: none;
    z-index: 1;
    filter: drop-shadow(0 8px 14px rgba(0,0,0,0.55))
            drop-shadow(0 0 16px rgba(255,160,80,0.30));
    animation: anvilBob 4.5s ease-in-out infinite;
  }`,
  },

  // 3) forge fx: title banner -> centred ON the stage, bigger
  { old: `  #enhance-modal #enhance-forge-fx {
    position: absolute;
    top: 6px; left: 50%;
    transform: translateX(calc(-50% + 10px));   /* v0.26.x — nudged +10px right per user */
    width: 200px; height: 200px;
    background-size: contain; background-repeat: no-repeat; background-position: center top;
    pointer-events: none; z-index: 6; display: none;
    filter: drop-shadow(0 0 18px rgba(255,200,90,0.45));
  }`,
    neu: `  #enhance-modal #enhance-forge-fx {
    /* v0.26.873 — the success/fail animation now takes CENTRE-STAGE: played
       large, anchored to the forge-stage floor over the anvil. */
    position: absolute;
    bottom: -6px; left: calc(50% - 112px);
    width: 224px; height: 198px;
    background-size: contain; background-repeat: no-repeat; background-position: center bottom;
    pointer-events: none; z-index: 3; display: none;
    filter: drop-shadow(0 0 22px rgba(255,200,90,0.55));
  }`,
  },

  // 4) sparks ring: centre it over the anvil (stage-relative now)
  { old: `  #enhance-sparks .ring {
    position: absolute;
    left: 50%; top: 50%;
    width: 30px; height: 30px;`,
    neu: `  #enhance-sparks .ring {
    position: absolute;
    left: 50%; top: 58%;   /* v0.26.873 — over the anvil on the stage */
    width: 30px; height: 30px;`,
  },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' CSS edits applied.');
