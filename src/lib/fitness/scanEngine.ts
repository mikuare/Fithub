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

type DrawMode = 'full' | 'scan-area';

/** Reusable canvas so ZXing decoding does not allocate a bitmap per frame. */
function drawToCanvas(
  source: HTMLVideoElement | HTMLImageElement,
  canvas: HTMLCanvasElement,
  mode: DrawMode,
): boolean {
  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!w || !h) return false;

  // Live scanning tells the user to place the barcode in the middle guide.
  // Decode that region at a higher effective resolution instead of shrinking an
  // entire high-resolution phone frame until the bars are only a few pixels wide.
  const crop = mode === 'scan-area';
  const sx = crop ? Math.round(w * 0.08) : 0;
  const sy = crop ? Math.round(h * 0.28) : 0;
  const sw = crop ? Math.round(w * 0.84) : w;
  const sh = crop ? Math.round(h * 0.44) : h;
  // Cap the working size: barcodes decode fine at moderate resolution and
  // full-resolution phone frames make ZXing crawl.
  const scale = Math.min(1, 1280 / Math.max(sw, sh));
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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
    let frame = 0;

    const decodeCanvas = (target: HTMLCanvasElement): string | null => {
      try {
        const bitmap = new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(target)));
        // setHints() + decodeWithState() is ZXing's continuous-scanning path. It
        // reuses its readers rather than rebuilding them on every video frame.
        const text = reader.decodeWithState(bitmap).getText();
        return barcodeValid(text) ? text : null;
      } catch {
        return null; // no barcode in this frame — the common case
      }
    };

    return {
      kind: 'zxing',
      async decode(source) {
        if (source instanceof HTMLCanvasElement) return decodeCanvas(source);

        frame += 1;
        const live = source instanceof HTMLVideoElement;
        const firstMode: DrawMode = live ? 'scan-area' : 'full';
        if (!drawToCanvas(source, canvas, firstMode)) return null;
        const first = decodeCanvas(canvas);
        if (first) return first;

        // Periodically inspect the whole live frame in case the barcode is just
        // outside the guide. Still photos get both passes immediately.
        if (!live || frame % 6 === 0) {
          const secondMode: DrawMode = live ? 'full' : 'scan-area';
          if (drawToCanvas(source, canvas, secondMode)) return decodeCanvas(canvas);
        }
        return null;
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

/* ---------------- camera startup ---------------- */

type GetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

/**
 * Requests the rear camera, with a plain-video fallback for mobile browsers
 * that reject facingMode or resolution constraints despite having a camera.
 */
export async function requestCameraStream(getUserMedia?: GetUserMedia): Promise<MediaStream> {
  const request = getUserMedia
    ?? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  try {
    return await request({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name ?? '';
    // Permission and hardware-in-use failures will not improve with another
    // prompt. Constraint/device-selection failures often do on older phones.
    if (!['OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError', 'TypeError'].includes(name)) {
      throw error;
    }
    return request({ video: true, audio: false });
  }
}

export type CameraFailure = 'denied' | 'missing' | 'busy' | 'playback' | 'unknown';

/** Converts browser-specific camera errors into useful, mobile-sized copy. */
export function describeCameraFailure(error: unknown): {
  kind: CameraFailure;
  title: string;
  body: string;
} {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      kind: 'denied',
      title: 'Camera permission was blocked',
      body: 'Allow Camera for this site in your browser settings, then tap Try camera again. You can also scan a photo.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      kind: 'missing',
      title: 'No camera was found',
      body: 'This browser cannot find a usable camera. Try Scan a photo or type the barcode digits.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return {
      kind: 'busy',
      title: 'The camera is busy',
      body: 'Close other apps using the camera, return here, then tap Try camera again.',
    };
  }
  if (name === 'NotSupportedError' || name === 'InvalidStateError') {
    return {
      kind: 'playback',
      title: 'The camera preview could not start',
      body: 'Reload the app and try again. If it still fails, use Scan a photo—the barcode is decoded on your phone.',
    };
  }
  return {
    kind: 'unknown',
    title: 'The camera could not start',
    body: 'Try the camera again. If it stays black, reload the app or use Scan a photo.',
  };
}
