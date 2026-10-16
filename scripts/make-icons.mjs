// Генерує PNG-іконки локально, без залежностей і без мережі.
// Запуск: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [14, 16, 19];
const PAGE = [232, 234, 237];
const LINE = [14, 16, 19];
const ACCENT = [242, 163, 58];

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundRect(u, v, x0, y0, x1, y1, r) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const cx = Math.min(Math.max(u, x0 + r), x1 - r);
  const cy = Math.min(Math.max(v, y0 + r), y1 - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}

// Повертає [r,g,b,a] для точки (u,v) у 0..1
function sample(u, v, rounded) {
  if (rounded && !inRoundRect(u, v, 0, 0, 1, 1, 0.22)) return [0, 0, 0, 0];
  let c = BG;
  if (inRoundRect(u, v, 0.29, 0.22, 0.67, 0.76, 0.04)) {
    c = PAGE;
    for (const ly of [0.36, 0.46, 0.56]) {
      if (inRoundRect(u, v, 0.35, ly - 0.014, 0.61, ly + 0.014, 0.014)) c = LINE;
    }
  }
  if ((u - 0.67) ** 2 + (v - 0.71) ** 2 <= 0.125 ** 2) c = BG;
  if ((u - 0.67) ** 2 + (v - 0.71) ** 2 <= 0.1 ** 2) c = ACCENT;
  return [...c, 255];
}

function render(size, rounded) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 4; // суперсемплінг для згладжування
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const s = sample((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, rounded);
          acc[0] += s[0] * s[3];
          acc[1] += s[1] * s[3];
          acc[2] += s[2] * s[3];
          acc[3] += s[3];
        }
      }
      const i = (y * size + x) * 4;
      const a = acc[3];
      buf[i] = a ? Math.round(acc[0] / a) : 0;
      buf[i + 1] = a ? Math.round(acc[1] / a) : 0;
      buf[i + 2] = a ? Math.round(acc[2] / a) : 0;
      buf[i + 3] = Math.round(a / (ss * ss));
    }
  }
  return png(size, buf);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', render(192, true));
writeFileSync('public/icon-512.png', render(512, true));
writeFileSync('public/icon-maskable-512.png', render(512, false));
writeFileSync('public/apple-touch-icon.png', render(180, false));
console.log('Іконки згенеровано в public/');
