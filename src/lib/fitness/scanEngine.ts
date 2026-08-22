import { barcodeValid } from '@/lib/fitness/barcode';

/* ============================================================
   Barcode decoding, one interface over two engines.

   Chrome/Android expose the native BarcodeDetector, which is fast
   and battery-cheap. iOS Safari does not expose it at all, so we
   fall back to ZXing compiled to JS — slower, but it means live
   scanning works on iPhones instead of showing an apology.

   ZXing is loaded lazily so the ~200 kB only downloads for the
   people who actually open the scanner on a browser that needs it.
   ============================================================ */

const FORMAT_NAMES = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface DetectedBarcode { rawValue: string }
interface NativeDetector { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
interface NativeDetectorCtor {
  new (options?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

function nativeCtor(): NativeDetectorCtor | null {
  return (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector ?? null;
}

export type ScanEngineKind = 'native' | 'zxing';

export interface ScanEngine {
  kind: ScanEngineKind;
  /** Returns the first valid product barcode found, or null. */
  decode(source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<string | null>;
  dispose(): void;
}

/** Reusable canvas so ZXing decoding does not allocate a bitmap per frame. */
function drawToCanvas(source: HTMLVideoElement | HTMLImageElement, canvas: HTMLCanvasElement): boolean {
  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!w || !h) return false;
  // Cap the working size: barcodes decode fine at moderate resolution and
  // full-resolution phone frames make ZXing crawl.
  const scale = Math.min(1, 1280 / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return true;
}

/**
 * Picks the best available engine. Returns null only when neither the native
 * detector nor ZXing can run at all, which the UI reports honestly.
 */
export async function createScanEngine(): Promise<ScanEngine | null> {
  const Ctor = nativeCtor();
  if (Ctor) {
    try {
      // Chrome exposes the constructor but may support no formats we need.
      const supported = (await Ctor.getSupportedFormats?.()) ?? FORMAT_NAMES;
      const usable = FORMAT_NAMES.filter((f) => supported.includes(f));
      if (usable.length) {
        const detector = new Ctor({ formats: usable });
        return {
          kind: 'native',
          async decode(source) {
            const found = await detector.detect(source);
            return found.map((b) => b.rawValue).find((v) => barcodeValid(v)) ?? null;
          },
          dispose() { /* nothing to release */ },
        };
      }
    } catch {
      // fall through to ZXing
    }
  }

  try {
    // The core reader decodes a canvas we control; the Browser* wrappers would
    // insist on owning the camera stream, which this component already manages.
    const {
      MultiFormatReader, BinaryBitmap, HybridBinarizer,
      HTMLCanvasElementLuminanceSource, DecodeHintType, BarcodeFormat,
    } = await import('@zxing/library');

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);
    const canvas = document.createElement('canvas');

    return {
      kind: 'zxing',
      async decode(source) {
        const target = source instanceof HTMLCanvasElement ? source : (drawToCanvas(source, canvas) ? canvas : null);
        if (!target) return null;
        try {
          const bitmap = new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(target)));
          const text = reader.decode(bitmap).getText();
          return barcodeValid(text) ? text : null;
        } catch {
          return null; // no barcode in this frame — the common case
        } finally {
          reader.reset();
        }
      },
      dispose() {
        try { reader.reset(); } catch { /* ignore */ }
      },
    };
  } catch {
    return null;
  }
}

/* ---------------- environment diagnosis ---------------- */

export type CameraBlocker = 'insecure_context' | 'no_camera_api' | 'no_engine' | null;

/**
 * Explains *why* live scanning cannot start, so the UI never shows a black
 * panel with a vague message. The insecure-context case is the one that trips
 * people testing over a plain-HTTP LAN address on their phone.
 */
export function diagnoseCamera(engineAvailable: boolean): CameraBlocker {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure_context';
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'no_camera_api';
  if (!engineAvailable) return 'no_engine';
  return null;
}

export const CAMERA_BLOCKER_COPY: Record<NonNullable<CameraBlocker>, { title: string; body: string }> = {
  insecure_context: {
    title: 'Camera needs a secure connection',
    body: 'Browsers only allow camera access over HTTPS or on localhost. Opening FitHub through a plain http:// address on your phone blocks it. Use the deployed HTTPS site — or scan a photo, or type the barcode below.',
  },
  no_camera_api: {
    title: 'No camera available here',
    body: 'This browser or device is not offering a camera. Scan a photo of the barcode instead, or type its digits.',
  },
  no_engine: {
    title: 'Barcode decoding is unavailable',
    body: 'This browser cannot run either barcode decoder. Typing the digits under the barcode works exactly the same.',
  },
};
