#!/usr/bin/env python3
"""SUPERSEDED (v0.26.445): the game now adds a RANDOM 7-15s gap between ambient
repeats in code (_ambientEl in mojiworld_game.html), so this fixed file-padding
is no longer used. Running it again would stack a fixed pause on top of the
code gap — don't, unless you also revert the code change. Kept for reference.

Append a period of silence to the END of each ambient loop so the game's
native loop (audio.loop = true) leaves a quiet gap between repeats instead of
droning continuously.

The trailing silence is inside the looped file, so the cycle becomes:
  [sound] -> [silence pause] -> [sound] -> [silence pause] -> ...
No code change needed — the engine already loops these files.

Originals are backed up to audio/ambient/_orig_backup/ on first run (never
overwritten); each run re-derives from the pristine original, so changing the
pause length never compounds. Revert by copying the backups back.

Usage:
  python tools/pad_ambient_silence.py            # default 10s pause, all loops
  python tools/pad_ambient_silence.py 14         # 14s pause
  python tools/pad_ambient_silence.py 10 beach    # only files matching substring
"""
import os, sys, glob, shutil, subprocess
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
AMB = os.path.join('audio', 'ambient')
BACKUP = os.path.join(AMB, '_orig_backup')

pause = float(sys.argv[1]) if len(sys.argv) > 1 else 10.0
match = sys.argv[2] if len(sys.argv) > 2 else ''
if not (1.0 <= pause <= 60.0):
    sys.exit('pause seconds must be between 1 and 60')

os.makedirs(BACKUP, exist_ok=True)
files = sorted(f for f in glob.glob(os.path.join(AMB, '*.mp3')) if match in os.path.basename(f))
if not files:
    sys.exit('no matching ambient files found')

print(f'Appending {pause:g}s silence to {len(files)} ambient loop(s)...')
made = fail = 0
for src in files:
    name = os.path.basename(src)
    backup = os.path.join(BACKUP, name)
    if not os.path.exists(backup):
        shutil.copy2(src, backup)        # preserve TRUE original once
    tmp = src + '.tmp.mp3'
    # apad with a finite pad_dur appends exactly `pause` seconds of silence.
    cmd = [FF, '-y', '-i', backup, '-af', f'apad=pad_dur={pause}',
           '-codec:a', 'libmp3lame', '-q:a', '5', '-loglevel', 'error', tmp]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0 and os.path.exists(tmp) and os.path.getsize(tmp) > 0:
        os.replace(tmp, src)
        made += 1
        print(f'  OK   {name}')
    else:
        fail += 1
        if os.path.exists(tmp):
            os.remove(tmp)
        print(f'  FAIL {name}: {r.stderr.strip()[:120]}')
print(f'Done. {made} padded, {fail} failed. Originals in {BACKUP}/')
sys.exit(2 if fail else 0)
