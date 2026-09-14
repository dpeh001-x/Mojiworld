// Chain entry point: re-measure Cancer's three states in the manifest.
// The chain re-syncs data/anim_calib_manifest.js from origin first (LX_EXTRA),
// so this always patches origin's current copy, never a stale local one.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath,
  [path.join(ROOT, 'scripts', 'apply_zodiac_manifest.mjs'), 'zodiac_cancer', 'cancer', 'idle', 'walk', 'attack'],
  { cwd: ROOT, stdio: 'inherit' });
