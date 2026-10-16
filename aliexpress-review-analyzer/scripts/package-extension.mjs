// Assembles release/extension (built app + manifest + worker + icons) and zips it.
import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateSync } from 'node:zlib';
import { zipSync } from 'fflate';

const OUT = 'release/extension';
cpSync('extension/manifest.json', join(OUT, 'manifest.json'));
cpSync('extension/background.js', join(OUT, 'background.js'));

/** Minimal PNG writer: a rounded brand-orange tile with a white bar chart. */
function icon(size) {
  const px = Buffer.alloc(size * size * 4);
  const r = size * 0.22;
  const bars = [0.35, 0.6, 0.85];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      const inCorner = cx < r && cy < r && (r - cx) ** 2 + (r - cy) ** 2 > r * r;
      if (inCorner) continue;
      let white = false;
      bars.forEach((h, k) => {
        const x0 = size * (0.22 + k * 0.2);
        if (x >= x0 && x < x0 + size * 0.14 && y >= size * (0.8 - h * 0.6) && y < size * 0.8) white = true;
      });
      px.set(white ? [255, 255, 255, 255] : [232, 70, 30, 255], i);
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync(join(OUT, 'icons'), { recursive: true });
for (const s of [16, 48, 128]) writeFileSync(join(OUT, 'icons', `${s}.png`), icon(s));

const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files[`AliExpress-Review-Analyzer-Extension/${relative(OUT, p).split('\\').join('/')}`] = readFileSync(p);
  }
};
walk(OUT);
writeFileSync('release/AliExpress-Review-Analyzer-Extension.zip', zipSync(files, { level: 9 }));
console.log(`Extension: ${OUT} (${Object.keys(files).length} files) → release/AliExpress-Review-Analyzer-Extension.zip`);
