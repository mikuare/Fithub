/**
 * Generates the start/finish artwork for the anchored resistance-band
 * exercises into public/exercise-guides/ as SVG.
 *
 *   node scripts/make-band-guides.mjs
 *
 * Schematic on purpose, in the same spirit as the equipment art: one fixed
 * standing silhouette, and per exercise only the things that actually differ
 * — where the band is anchored, where the handle starts, where it finishes,
 * and the direction it travels. Those are the two facts people get wrong
 * (anchor height and movement path); the written steps carry the rest.
 *
 * SVG rather than PNG because these are line drawings: crisp at any size,
 * a fraction of the weight, and no encoder needed. Outputs are committed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'exercise-guides');

const W = 320, H = 180;
const INK = '#0F151B';
const BAND = '#7A9E12';
const GHOST = '#B6C0CB';
const MUTED = '#8A95A1';
const GROUND = 158;

/* The silhouette is identical in every drawing, so it only has to be right
   once. Facing right, standing in a light split stance. */
const SHOULDER = [214, 64];
const HIP = [214, 106];
const FIGURE =
  `<circle cx="214" cy="45" r="11"/>` +
  `<path d="M214 56V106"/>` +
  `<path d="M214 106L228 132L228 158"/>` +
  `<path d="M214 106L198 132L194 158"/>`;

const n = (v) => Math.round(v * 10) / 10;
const poly = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join('');

/** Two-segment arm from the shoulder to the handle, elbow pushed clear of the line. */
function arm([hx, hy], bend) {
  const [sx, sy] = SHOULDER;
  const mx = (sx + hx) / 2, my = (sy + hy) / 2;
  const dx = hx - sx, dy = hy - sy;
  const len = Math.hypot(dx, dy) || 1;
  return poly([[sx, sy], [mx - (dy / len) * bend, my + (dx / len) * bend], [hx, hy]]);
}

/** Arrow from start handle to finish handle, bowed so it never sits on the band. */
function arrow([x1, y1], [x2, y2]) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const [bx, by] = [mx - (dy / len) * 16, my + (dx / len) * 16];
  // Head, aimed along the final approach.
  const a = Math.atan2(y2 - by, x2 - bx);
  const wing = (off) => [x2 - 11 * Math.cos(a - off), y2 - 11 * Math.sin(a - off)];
  return `<path d="M${n(x1)} ${n(y1)}Q${n(bx)} ${n(by)} ${n(x2)} ${n(y2)}" stroke="${INK}" stroke-width="3" stroke-dasharray="7 5" fill="none"/>`
    + `<path d="${poly([wing(0.45), [x2, y2], wing(-0.45)])}" stroke="${INK}" stroke-width="3" fill="none"/>`;
}

/** Some movements move the body, not the handle. A squat's handle stays at the
    shoulder throughout — the hips are what travel. */
function bodyArrow(dy) {
  const [x, y] = [168, 104];
  const y2 = y + dy;
  const dir = Math.sign(dy);
  return `<path d="M${x} ${y}V${y2}" stroke="${INK}" stroke-width="3" stroke-dasharray="7 5" fill="none"/>`
    + `<path d="${poly([[x - 7, y2 - 9 * dir], [x, y2], [x + 7, y2 - 9 * dir]])}" stroke="${INK}" stroke-width="3" fill="none"/>`;
}

function draw({ anchor, route, start, finish, bend = 14, note, doorY, body, limb = 'arm' }) {
  const bandPath = (end) => poly(route ? [anchor, route, end] : [anchor, end]);
  // The ankle-cuff movements hang the band off a leg, not a hand.
  const link = (end) => (limb === 'leg' ? poly([HIP, end]) : arm(end, bend));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none">`
    + `<rect width="${W}" height="${H}" fill="#F5F7F9"/>`
    + `<path d="M18 ${GROUND}H302" stroke="${MUTED}" stroke-width="2.5" stroke-linecap="round"/>`
    // Door slab and anchor, or the tube trapped under both feet.
    + (doorY !== undefined
      ? `<path d="M40 22V${GROUND}" stroke="${MUTED}" stroke-width="7" stroke-linecap="round"/>`
        + `<circle cx="40" cy="${doorY}" r="6" stroke="${MUTED}" stroke-width="3" fill="#F5F7F9"/>`
      : `<path d="M186 ${GROUND}h44" stroke="${BAND}" stroke-width="6" stroke-linecap="round"/>`)
    // Start: ghosted band, arm and handle.
    + `<g stroke="${GHOST}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round">`
    + `<path d="${bandPath(start)}"/><path d="${link(start)}"/></g>`
    + `<circle cx="${n(start[0])}" cy="${n(start[1])}" r="6" fill="${GHOST}"/>`
    // Finish: the position the rep is aiming for.
    + `<path d="${bandPath(finish)}" stroke="${BAND}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<g stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">${FIGURE}<path d="${link(finish)}"/></g>`
    + `<circle cx="${n(finish[0])}" cy="${n(finish[1])}" r="7" fill="${INK}"/>`
    + (body ? bodyArrow(body) : arrow(start, finish))
    // Key.
    + `<circle cx="26" cy="18" r="5" fill="${GHOST}"/><text x="37" y="23" font-family="system-ui,sans-serif" font-size="12" fill="${MUTED}">Start</text>`
    + `<circle cx="92" cy="18" r="6" fill="${INK}"/><text x="104" y="23" font-family="system-ui,sans-serif" font-size="12" fill="${INK}">Finish</text>`
    + `<text x="302" y="23" text-anchor="end" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="${BAND}">${note}</text>`
    + `</svg>`;
}

const GUIDES = {
  // Anchored behind you at chest height, pressing away.
  'banded-chest-press': { doorY: 84, anchor: [40, 84], route: [200, 78], start: [196, 78], finish: [268, 74], bend: 16, note: 'Anchor: chest height' },
  // Anchored in front at chest height, pulling the handles to the ribs.
  'banded-row': { doorY: 84, anchor: [40, 84], start: [274, 80], finish: [206, 92], bend: -16, note: 'Anchor: chest height' },
  // Anchored high, pulling down and back.
  'banded-lat-pulldown': { doorY: 34, anchor: [40, 34], start: [244, 30], finish: [212, 88], bend: -18, note: 'Anchor: as high as it goes' },
  // Stood on the tube, pressing overhead.
  'banded-overhead-press': { anchor: [208, GROUND], start: [232, 62], finish: [222, 14], bend: 14, note: 'Stand on the tube' },
  'banded-lateral-raise': { anchor: [208, GROUND], start: [220, 116], finish: [272, 64], bend: 10, note: 'Stand on the tube' },
  // The handle never moves in these two — the hips do, so the arrow marks the body.
  'banded-squat': { anchor: [208, GROUND], start: [230, 66], finish: [230, 66], bend: 14, body: 40, note: 'Handles stay at the shoulders' },
  'banded-romanian-deadlift': { anchor: [208, GROUND], start: [226, 104], finish: [226, 104], bend: 12, body: 34, note: 'Hips travel back, not down' },
  'banded-bicep-curl': { anchor: [208, GROUND], start: [228, 116], finish: [232, 68], bend: 14, note: 'Elbows pinned to your sides' },
  // Anchored high, pressing straight down.
  'banded-triceps-pressdown': { doorY: 34, anchor: [40, 34], start: [230, 78], finish: [232, 118], bend: -14, note: 'Anchor: above head height' },
  // Anchored at the floor and faced, so the leg drives AWAY from the anchor and
  // the band tightens through the rep. Driving toward it would unload the band.
  'banded-glute-kickback': { doorY: 148, anchor: [40, 148], start: [206, 152], finish: [268, 134], limb: 'leg', note: 'Face the anchor · cuff on the ankle' },
};

mkdirSync(OUT, { recursive: true });
for (const [slug, spec] of Object.entries(GUIDES)) {
  writeFileSync(join(OUT, `${slug}.svg`), draw(spec));
}
console.log(`wrote ${Object.keys(GUIDES).length} band exercise guides to ${OUT}`);
