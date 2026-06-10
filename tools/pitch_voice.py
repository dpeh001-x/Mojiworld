#!/usr/bin/env python3
"""Pitch-shift the player character voice grunts (audio/voice/*.mp3) UP to sound
like a younger / teen voice, preserving clip duration.

Why this approach: raising pitch *and* formants together (asetrate) makes a voice
sound smaller/younger — which is what "young teen" calls for — unlike a
formant-preserving shift, which just sounds like the same adult higher up. We
compensate tempo (atempo=1/P) so the grunt keeps its original length.

Originals are backed up to audio/voice/_orig_backup/ on first run (never
overwritten), so this is fully reversible: copy them back to revert.

Usage:
  python tools/pitch_voice.py                # default factor 1.20 (~+3.2 semitones)
  python tools/pitch_voice.py 1.26           # stronger lift (~+4 semitones)
  python tools/pitch_voice.py 1.20 warrior   # only files matching a substring
"""
import os, sys, glob, shutil, subprocess
import imageio_ffmpeg
from mutagen.mp3 import MP3

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
VOICE_DIR = os.path.join('audio', 'voice')
BACKUP = os.path.join(VOICE_DIR, '_orig_backup')

factor = float(sys.argv[1]) if len(sys.argv) > 1 else 1.20
match = sys.argv[2] if len(sys.argv) > 2 else ''
if not (1.01 <= factor <= 2.0):
    sys.exit('pitch factor must be between 1.01 and 2.0')

os.makedirs(BACKUP, exist_ok=True)
files = sorted(f for f in glob.glob(os.path.join(VOICE_DIR, '*.mp3')) if match in os.path.basename(f))
if not files:
    sys.exit('no matching voice files found')

print(f'Pitch-shifting {len(files)} voice clip(s) by x{factor:.2f} (duration preserved)...')
made = fail = 0
for src in files:
    name = os.path.basename(src)
    backup = os.path.join(BACKUP, name)
    if not os.path.exists(backup):
        shutil.copy2(src, backup)          # preserve the TRUE original once
    base = backup                          # always shift FROM the pristine original
    sr = MP3(base).info.sample_rate
    tmp = src + '.tmp.mp3'
    # asetrate raises pitch+formants; aresample restores stream rate; atempo
    # divides speed back so the clip length is unchanged.
    af = f'asetrate={int(sr*factor)},aresample={sr},atempo={1/factor:.5f}'
    cmd = [FFMPEG, '-y', '-i', base, '-af', af, '-codec:a', 'libmp3lame',
           '-q:a', '4', '-loglevel', 'error', tmp]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0 and os.path.exists(tmp) and os.path.getsize(tmp) > 0:
        os.replace(tmp, src)
        made += 1
        print(f'  OK   {name}  (sr={sr})')
    else:
        fail += 1
        if os.path.exists(tmp):
            os.remove(tmp)
        print(f'  FAIL {name}: {r.stderr.strip()[:120]}')
print(f'Done. {made} shifted, {fail} failed. Originals backed up in {BACKUP}/')
sys.exit(2 if fail else 0)
