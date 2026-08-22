/**
 * Generates the PWA icon set into public/icons/ with zero dependencies:
 * a tiny PNG encoder on top of node:zlib, and a supersampled rasterizer
 * for the FitHub mark (lime dumbbell on the dark app background).
 *
 *   node scripts/make-icons.mjs
 *
 * Outputs are committed, so this only needs re-running if the mark changes.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [15, 21, 27];    // --c-bg-elev, dark theme
const FG = [185, 242, 39];  // --c-brand, dark theme lime

/* ---------------- PNG encoding ---------------- */

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** rgba: Uint8Array of size*size*4 */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- rasterizer ---------------- */

/** Signed test: is the point inside a rounded rect centred at (cx, cy)? */
function inRoundRect(x, y, cx, cy, w, h, r) {
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  if (dx <= 0 && dy <= 0) return true;
  if (dx > 0 && dy > 0) return dx * dx + dy * dy <= r * r;
  return dx <= r && dy <= r && (dx <= 0 || dy <= 0);
}

/** Dumbbell mark in unit coordinates, scaled by `inset` around the centre. */
function markShapes(inset) {
  const s = (v) => 0.5 + (v - 0.5) * inset;
  const w = (v) => v * inset;
  return [
    { cx: s(0.5), cy: 0.5, w: w(0.5), h: w(0.085), r: w(0.0425) },   // bar
    { cx: s(0.3), cy: 0.5, w: w(0.085), h: w(0.4), r: w(0.0425) },   // left plate
    { cx: s(0.7), cy: 0.5, w: w(0.085), h: w(0.4), r: w(0.0425) },   // right plate
    { cx: s(0.205), cy: 0.5, w: w(0.065), h: w(0.25), r: w(0.0325) },// left cap
    { cx: s(0.795), cy: 0.5, w: w(0.065), h: w(0.25), r: w(0.0325) },// right cap
  ];
}

/**
 * mode 'rounded': rounded-square tile with transparent corners (regular icon)
 * mode 'full':    edge-to-edge background (maskable / apple touch)
 */
function render(size, mode) {
  const SS = 4; // supersamples per axis
  const shapes = markShapes(mode === 'full' ? 0.72 : 0.82);
  const rgba = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0;
      let fgHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const inTile = mode === 'full' || inRoundRect(x, y, 0.5, 0.5, 1, 1, 0.22);
          if (!inTile) continue;
          bgHits++;
          if (shapes.some((r) => inRoundRect(x, y, r.cx, r.cy, r.w, r.h, r.r))) fgHits++;
        }
      }
      const total = SS * SS;
      const alpha = bgHits / total;
      const fg = bgHits ? fgHits / bgHits : 0;
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(BG[0] + (FG[0] - BG[0]) * fg);
      rgba[i + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * fg);
      rgba[i + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * fg);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', render(192, 'rounded')],
  ['icon-512.png', render(512, 'rounded')],
  ['maskable-512.png', render(512, 'full')],
  ['apple-touch-icon.png', render(180, 'full')],
];
for (const [name, buf] of files) {
  writeFileSync(join(OUT, name), buf);
  console.log(`wrote public/icons/${name} (${buf.length} bytes)`);
}
