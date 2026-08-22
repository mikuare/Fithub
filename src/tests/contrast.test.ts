import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Colour tokens are the one part of the design system that cannot be verified
 * by looking at a component tree. These tests parse the real stylesheet and
 * check the pairs the UI actually renders against WCAG 2.1 contrast minima.
 */

type RGB = [number, number, number];

function parseTokens(css: string): { light: Record<string, RGB>; dark: Record<string, RGB> } {
  const grab = (blockStart: string) => {
    const start = css.indexOf(blockStart);
    if (start < 0) throw new Error(`missing block ${blockStart}`);
    const end = css.indexOf('}', start);
    const body = css.slice(start, end);
    const out: Record<string, RGB> = {};
    for (const m of body.matchAll(/(--c-[a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) {
      out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
    }
    return out;
  };
  return { light: grab(':root {'), dark: grab('.dark {') };
}

function luminance([r, g, b]: RGB): number {
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
const { light, dark } = parseTokens(css);

/** [foreground, background, minimum, description] */
const TEXT_PAIRS: Array<[string, string, number, string]> = [
  ['--c-ink', '--c-bg', 4.5, 'body text on the page'],
  ['--c-ink', '--c-surface', 4.5, 'body text on a card'],
  ['--c-ink-2', '--c-bg', 4.5, 'secondary text on the page'],
  ['--c-ink-2', '--c-surface', 4.5, 'secondary text on a card'],
  ['--c-ink-3', '--c-surface', 3.0, 'muted supporting text on a card'],
  ['--c-brand-text', '--c-bg', 4.5, 'brand-coloured text on the page'],
  ['--c-brand-text', '--c-surface', 4.5, 'brand-coloured text on a card'],
  ['--c-brand-contrast', '--c-brand', 4.5, 'label on a primary button'],
  ['--c-accent-text', '--c-surface', 4.5, 'accent text on a card'],
  ['--c-success', '--c-surface', 3.0, 'success text on a card'],
  ['--c-warn', '--c-surface', 3.0, 'warning text on a card'],
  ['--c-danger', '--c-surface', 4.5, 'error text on a card'],
  ['--c-info', '--c-surface', 3.0, 'info text on a card'],
];

/** Badges pair tinted text with a tinted background of the same hue. */
const BADGE_PAIRS: Array<[string, string, number, string]> = [
  ['--c-brand-text', '--c-brand-soft', 4.5, 'brand badge'],
  ['--c-accent-text', '--c-accent-soft', 4.5, 'accent badge'],
  ['--c-success', '--c-success-soft', 4.5, 'success badge'],
  ['--c-warn', '--c-warn-soft', 4.5, 'warning badge'],
  ['--c-danger', '--c-danger-soft', 4.5, 'danger badge'],
  ['--c-info', '--c-info-soft', 4.5, 'info badge'],
  ['--c-ink-2', '--c-surface-2', 4.5, 'default badge'],
  ['--c-ink-3', '--c-surface-2', 3.0, 'muted badge'],
];

/** Non-text UI needs 3:1 against its own background. */
const UI_PAIRS: Array<[string, string, number, string]> = [
  ['--c-brand', '--c-surface', 3.0, 'progress fill against a card'],
  ['--c-line-strong', '--c-surface', 1.4, 'borders against a card'],
  ['--c-ink-3', '--c-surface-3', 3.0, 'icon on a raised surface'],
];

for (const [themeName, tokens] of [['light', light], ['dark', dark]] as const) {
  describe(`${themeName} theme contrast`, () => {
    it('defines every token the app references', () => {
      for (const [fg, bg] of [...TEXT_PAIRS, ...BADGE_PAIRS, ...UI_PAIRS]) {
        expect(tokens[fg], `${themeName} ${fg}`).toBeDefined();
        expect(tokens[bg], `${themeName} ${bg}`).toBeDefined();
      }
    });

    for (const [fg, bg, min, what] of TEXT_PAIRS) {
      it(`${what} meets ${min}:1`, () => {
        const ratio = contrast(tokens[fg], tokens[bg]);
        expect(
          Math.round(ratio * 100) / 100,
          `${themeName}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(min);
      });
    }

    for (const [fg, bg, min, what] of BADGE_PAIRS) {
      it(`${what} meets ${min}:1`, () => {
        const ratio = contrast(tokens[fg], tokens[bg]);
        expect(
          Math.round(ratio * 100) / 100,
          `${themeName}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(min);
      });
    }

    for (const [fg, bg, min, what] of UI_PAIRS) {
      it(`${what} meets ${min}:1`, () => {
        const ratio = contrast(tokens[fg], tokens[bg]);
        expect(
          Math.round(ratio * 100) / 100,
          `${themeName}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(min);
      });
    }
  });
}
