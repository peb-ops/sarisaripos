// Generates the PWA PNG icons (a striped sari-sari awning over a store counter)
// without any image library. Run: npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [28, 25, 23];
const RED = [220, 38, 38];
const WHITE = [255, 255, 255];
const AMBER = [245, 158, 11];
const DARK = [69, 26, 3];
const CREAM = [254, 243, 199];

// Shapes stay inside the central 80% so the icon survives "maskable" cropping.
function colorAt(u, v) {
  const stripes = 6, left = 0.2, right = 0.8, w = (right - left) / stripes;
  const awningTop = 0.26, awningBottom = 0.42, r = w / 2;
  if (u >= left && u < right) {
    const i = Math.floor((u - left) / w);
    const stripe = i % 2 === 0 ? RED : WHITE;
    if (v >= awningTop && v < awningBottom) return stripe;
    const cx = left + (i + 0.5) * w;
    if (v >= awningBottom && (u - cx) ** 2 + (v - awningBottom) ** 2 <= r * r) return stripe;
  }
  if (u >= 0.25 && u < 0.75 && v >= 0.47 && v < 0.76) {
    if (u >= 0.32 && u < 0.68 && v >= 0.51 && v < 0.64) return DARK;
    if (u >= 0.32 && u < 0.68 && v >= 0.64 && v < 0.67) return CREAM;
    return AMBER;
  }
  return BG;
}

function render(size) {
  const ss = 4; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let rr = 0, gg = 0, bb = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const [r, g, b] = colorAt((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          rr += r; gg += g; bb += b;
        }
      const n = ss * ss, o = row + 1 + x * 4;
      raw[o] = rr / n; raw[o + 1] = gg / n; raw[o + 2] = bb / n; raw[o + 3] = 255;
    }
  }
  return png(size, size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Windows .ico for the desktop shortcut; modern ICO files can hold PNGs directly.
function ico(sizes) {
  const images = sizes.map((s) => render(s));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const e = 6 + 16 * i;
    header[e] = sizes[i] >= 256 ? 0 : sizes[i]; // 0 means 256
    header[e + 1] = sizes[i] >= 256 ? 0 : sizes[i];
    header.writeUInt16LE(1, e + 4); // color planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(img.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  return Buffer.concat([header, ...images]);
}

writeFileSync(new URL('../launcher/system/app.ico', import.meta.url), ico([16, 32, 48, 256]));
console.log('launcher/system/app.ico');

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/pwa-${size}.png`, import.meta.url), render(size));
  console.log(`public/pwa-${size}.png`);
}
writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), render(180));
console.log('public/apple-touch-icon.png');
