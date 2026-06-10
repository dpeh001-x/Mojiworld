#!/usr/bin/env node
// Dependency-free MP3 trimmer — keeps the FIRST <seconds> of audio by walking
// MPEG frame headers and stopping once the accumulated frame time hits the
// target. No ffmpeg needed. Preserves a leading ID3v2 tag if present. Overwrites
// the file in place. Used to clamp ludo-generated groan voices to a short length.
//   node tools/trim_mp3.mjs <seconds> <file1.mp3> [file2.mp3 ...]
import { readFileSync, writeFileSync } from 'node:fs';

const BR = {                                   // [version][bitrateIndex] kbps (Layer III)
  1: [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0],   // MPEG1
  2: [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0],       // MPEG2 / 2.5
};
const SR = {                                   // [versionId] sample rates
  3: [44100,48000,32000],   // MPEG1
  2: [22050,24000,16000],   // MPEG2
  0: [11025,12000,8000],    // MPEG2.5
};

function trim(buf, seconds) {
  let start = 0;
  // Skip an ID3v2 tag (keep it in the output).
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const size = ((buf[6]&0x7f)<<21)|((buf[7]&0x7f)<<14)|((buf[8]&0x7f)<<7)|(buf[9]&0x7f);
    start = 10 + size;
  }
  let i = start, acc = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xFF || (buf[i+1] & 0xE0) !== 0xE0) { i++; continue; }   // resync
    const verId = (buf[i+1] >> 3) & 0x03;        // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const layer = (buf[i+1] >> 1) & 0x03;        // 1 = Layer III
    if (layer !== 1 || verId === 1) { i++; continue; }
    const brIdx = (buf[i+2] >> 4) & 0x0F;
    const srIdx = (buf[i+2] >> 2) & 0x03;
    const pad   = (buf[i+2] >> 1) & 0x01;
    const verKey = (verId === 3) ? 1 : 2;
    const bitrate = (BR[verKey][brIdx] || 0) * 1000;
    const srTable = SR[verId] || SR[2];
    const sampleRate = srTable[srIdx] || 0;
    if (!bitrate || !sampleRate) { i++; continue; }
    const spf = (verId === 3) ? 1152 : 576;                       // samples/frame (L3)
    const frameLen = Math.floor((spf / 8) * bitrate / sampleRate) + pad;
    if (frameLen < 4) { i++; continue; }
    acc += spf / sampleRate;                                       // seconds this frame adds
    i += frameLen;
    if (acc >= seconds) break;                                    // keep up to here
  }
  return buf.subarray(0, Math.min(i, buf.length));
}

const [secArg, ...files] = process.argv.slice(2);
const seconds = Number(secArg);
if (!seconds || !files.length) { console.error('usage: node tools/trim_mp3.mjs <seconds> <file...>'); process.exit(1); }
for (const f of files) {
  const before = readFileSync(f);
  const after = trim(before, seconds);
  writeFileSync(f, after);
  console.log(`${f}: ${before.length} -> ${after.length} bytes (~${seconds}s)`);
}
