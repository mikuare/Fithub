import { vi } from 'vitest';
import { webcrypto } from 'node:crypto';

/**
 * jsdom does not implement several browser APIs the app uses. These stubs keep
 * the render smoke tests honest about component logic without pretending the
 * missing APIs behave differently than they do in a real browser.
 */

// jsdom ships a `crypto` without `subtle`, which the local password hasher needs.
if (!globalThis.crypto || !('subtle' in globalThis.crypto)) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
if (!window.scrollTo) {
  window.scrollTo = vi.fn();
}
