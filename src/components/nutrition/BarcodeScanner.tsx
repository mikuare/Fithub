import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Camera, Check, ImagePlus, Info, Keyboard, Loader2, ScanBarcode, Search,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Field';
import { barcodeValid, mapOffProduct, normalizeBarcode, offProductUrl, type ScannedProduct } from '@/lib/fitness/barcode';
import {
  CAMERA_BLOCKER_COPY, createScanEngine, describeCameraFailure, diagnoseCamera, requestCameraStream,
  type CameraBlocker, type ScanEngine,
} from '@/lib/fitness/scanEngine';
import type { MealSlot, NutritionLog } from '@/types';

/* iOS 13+ gates motion/camera-adjacent APIs behind permission prompts that must
   originate in a user gesture; getUserMedia itself prompts natively. */

const SLOT_OPTIONS: Array<{ value: MealSlot; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
];

type Phase = 'idle' | 'scanning' | 'lookup' | 'found' | 'not_found' | 'error';
type CameraState = 'off' | 'starting' | 'live' | 'denied' | 'failed';

function waitForVideoEvent(video: HTMLVideoElement, eventName: 'loadedmetadata' | 'loadeddata', timeoutMs = 10000) {
  if ((eventName === 'loadedmetadata' && video.readyState >= 1)
    || (eventName === 'loadeddata' && video.readyState >= 2)) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(eventName, ready);
      video.removeEventListener('error', failed);
    };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new DOMException('Camera video failed', 'InvalidStateError')); };
    const timer = setTimeout(() => {
      cleanup();
      reject(new DOMException('Camera video timed out', 'InvalidStateError'));
    }, timeoutMs);
    video.addEventListener(eventName, ready, { once: true });
    video.addEventListener('error', failed, { once: true });
  });
}

async function startVideoPreview(video: HTMLVideoElement, stream: MediaStream) {
  video.setAttribute('playsinline', 'true');
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  await waitForVideoEvent(video, 'loadedmetadata');
  await video.play();
  await waitForVideoEvent(video, 'loadeddata');
  if (!video.videoWidth || !video.videoHeight) {
    throw new DOMException('Camera returned no video frames', 'InvalidStateError');
  }
}

export function BarcodeScanner({ defaultSlot, onClose, onAdd }: {
  defaultSlot: MealSlot;
  onClose: () => void;
  onAdd: (log: Omit<NutritionLog, 'id' | 'user_id' | 'created_at' | 'date'>) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<ScanEngine | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const cameraAttemptRef = useRef(0);

  const [engineReady, setEngineReady] = useState<boolean | null>(null);
  const [blocker, setBlocker] = useState<CameraBlocker>(null);
  const [cameraState, setCameraState] = useState<CameraState>('off');
  const [cameraIssue, setCameraIssue] = useState<ReturnType<typeof describeCameraFailure> | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMiss, setPhotoMiss] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const [servings, setServings] = useState('1');
  const [basis, setBasis] = useState<'serving' | '100g'>('serving');

  /* ---- build the decoder once, then diagnose the environment ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const engine = await createScanEngine();
      if (cancelled) { engine?.dispose(); return; }
      engineRef.current = engine;
      setEngineReady(!!engine);
      setBlocker(diagnoseCamera(!!engine));
    })();
    return () => {
      cancelled = true;
      cameraAttemptRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  /* ---- decoder loop, only after the camera is genuinely producing frames ---- */
  useEffect(() => {
    if (phase !== 'scanning' || cameraState !== 'live') return;
    let cancelled = false;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scanFrame = async () => {
      if (cancelled) return;
      const engine = engineRef.current;
      const video = videoRef.current;
      if (engine && video && video.readyState >= 2 && video.videoWidth > 0 && !busyRef.current) {
        busyRef.current = true;
        try {
          const hit = await engine.decode(video);
          if (hit && !cancelled) { void lookUp(hit); return; }
        } catch { /* one undecodable frame is normal; keep scanning */ } finally { busyRef.current = false; }
      }
      // Native detection is cheap enough for rAF; ZXing needs pacing.
      if (engine?.kind === 'native') raf = requestAnimationFrame(() => void scanFrame());
      else timer = setTimeout(() => void scanFrame(), 220);
    };
    void scanFrame();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cameraState]);

  const releaseCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    busyRef.current = false;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  };

  const stopCamera = () => {
    cameraAttemptRef.current += 1;
    releaseCamera();
    setCameraState('off');
    setPhase('idle');
  };

  const startCamera = async () => {
    if (!cameraUsable) return;
    const attempt = cameraAttemptRef.current + 1;
    cameraAttemptRef.current = attempt;
    releaseCamera();
    setCameraIssue(null);
    setCameraState('starting');
    setPhase('scanning');

    try {
      // This request begins directly inside the tap handler. That matters for
      // installed iOS PWAs, where permission-sensitive APIs can lose the user gesture.
      const stream = await requestCameraStream();
      if (attempt !== cameraAttemptRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new DOMException('Camera preview is unavailable', 'InvalidStateError');
      await startVideoPreview(video, stream);
      if (attempt !== cameraAttemptRef.current) return;
      setCameraState('live');
    } catch (error) {
      if (attempt !== cameraAttemptRef.current) return;
      releaseCamera();
      const issue = describeCameraFailure(error);
      setCameraIssue(issue);
      setCameraState(issue.kind === 'denied' ? 'denied' : 'failed');
    }
  };

  /* ---- lookup ---- */
  const lookUp = async (raw: string) => {
    cameraAttemptRef.current += 1;
    releaseCamera();
    setCameraState('off');
    const normalized = normalizeBarcode(raw);
    setCode(normalized);
    setPhase('lookup');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setPhase('error'); return; }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(offProductUrl(normalized), { signal: controller.signal });
        if (!res.ok) throw new Error(`Food lookup failed (${res.status})`);
        const mapped = mapOffProduct(await res.json());
        if (!mapped) { setPhase('not_found'); return; }
        setProduct(mapped);
        setBasis(mapped.perServing ? 'serving' : '100g');
        setPhase('found');
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      setPhase('error');
    }
  };

  const submitManual = () => {
    setManualError(null);
    if (!barcodeValid(manualCode)) {
      setManualError('That does not look like a valid barcode — enter all the digits under the bars, including the last one.');
      return;
    }
    void lookUp(manualCode);
  };

  /* ---- scan from a photo (also the iOS "take a picture" path) ---- */
  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoMiss(false);
    setPhotoBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'sync';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('load failed'));
        img.src = url;
      });
      const hit = await engineRef.current?.decode(img);
      if (hit) void lookUp(hit);
      else setPhotoMiss(true);
    } catch {
      setPhotoMiss(true);
    } finally {
      URL.revokeObjectURL(url);
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /* ---- add to log ---- */
  const chosen = product && (basis === 'serving' && product.perServing ? product.perServing : product.per100g);
  const n = Math.max(0.25, Number(servings) || 1);
  const chosenComplete = !!chosen
    && chosen.calories !== null
    && chosen.protein_g !== null
    && chosen.carbs_g !== null
    && chosen.fat_g !== null;
  const canAdd = !!product && chosenComplete;
  const scaled = (value: number | null) => {
    if (value === null) return null;
    const total = value * n;
    return Number.isInteger(total) ? total : Math.round(total * 10) / 10;
  };

  const add = () => {
    if (!product || !chosen || chosen.calories === null || chosen.protein_g === null
      || chosen.carbs_g === null || chosen.fat_g === null) return;
    const basisLabel = basis === 'serving' ? (product.servingSize ?? 'serving') : '100 g';
    void onAdd({
      slot,
      name: `${product.name}${product.brand ? ` — ${product.brand}` : ''} (${basisLabel})`,
      servings: n,
      calories: chosen.calories,
      protein_g: chosen.protein_g,
      carbs_g: chosen.carbs_g,
      fat_g: chosen.fat_g,
    });
  };

  const restart = () => {
    cameraAttemptRef.current += 1;
    releaseCamera();
    setCameraState('off');
    setCameraIssue(null);
    setProduct(null);
    setCode(null);
    setPhase('idle');
  };
  const cameraUsable = engineReady === true && blocker === null;
  const cameraRunning = cameraState === 'starting' || cameraState === 'live';

  return (
    <Modal
      open
      onClose={() => { stopCamera(); onClose(); }}
      title="Scan a barcode"
      description="Packaged foods — scan live, use a photo, or type the digits."
      size="md"
      footer={phase === 'found' ? (
        <Button block disabled={!canAdd} onClick={add} icon={<Check size={15} />}>Add to log</Button>
      ) : undefined}
    >
      {(phase === 'idle' || phase === 'scanning' || phase === 'lookup') && (
        <div className="space-y-4">
          {/* Viewport / start panel */}
          <div className="relative rounded-2xl overflow-hidden bg-surface-3 aspect-[4/3] sm:aspect-video grid place-items-center">
            {/* Keep this element mounted before the permission tap; iOS PWAs are
                more reliable when getUserMedia can attach to an existing video. */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef} playsInline muted autoPlay
              className={`absolute inset-0 h-full w-full object-cover transition-opacity ${
                phase === 'scanning' && cameraRunning ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {phase === 'scanning' && cameraRunning ? (
              <>
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 rounded-xl border-2 border-brand/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] pointer-events-none" aria-hidden />
                <div className="relative z-10 mt-auto mb-3 rounded-xl bg-bg/90 px-3 py-2 text-center shadow-sm">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold">
                    {cameraState === 'starting'
                      ? <><Camera size={13} /> Starting camera…</>
                      : <><ScanBarcode size={13} /> Keep every black bar inside the box</>}
                  </p>
                  {cameraState === 'live' && (
                    <p className="mt-0.5 text-2xs text-ink-3">Move closer · hold steady · avoid glare</p>
                  )}
                </div>
              </>
            ) : (
              <div className="p-5 text-center">
                {phase === 'lookup' ? (
                  <>
                    <Loader2 size={22} className="mx-auto animate-spin text-brand-text" />
                    <p className="mt-2 text-sm font-semibold">Looking up {code}…</p>
                    <p className="mt-1 text-2xs text-ink-3">Checking Open Food Facts for this product.</p>
                  </>
                ) : cameraState === 'denied' || cameraState === 'failed' ? (
                  <>
                    <AlertTriangle size={22} className="mx-auto text-warn" />
                    <p className="mt-2 text-sm font-semibold">{cameraIssue?.title ?? 'The camera could not start'}</p>
                    <p className="mt-1 text-2xs text-ink-3 leading-relaxed max-w-xs mx-auto">
                      {cameraIssue?.body ?? 'Try again, use a photo, or type the barcode digits.'}
                    </p>
                  </>
                ) : blocker ? (
                  <>
                    <Info size={22} className="mx-auto text-info" />
                    <p className="mt-2 text-sm font-semibold">{CAMERA_BLOCKER_COPY[blocker].title}</p>
                    <p className="mt-1 text-2xs text-ink-3 leading-relaxed max-w-xs mx-auto">{CAMERA_BLOCKER_COPY[blocker].body}</p>
                  </>
                ) : (
                  <>
                    <ScanBarcode size={26} className="mx-auto text-ink-3" />
                    <p className="mt-2 text-sm font-semibold">Scan the black bars on the package</p>
                    <p className="mt-1 text-2xs text-ink-3 max-w-xs mx-auto leading-relaxed">
                      Use the UPC or EAN barcode, usually found on the back or bottom—not the product photo or nutrition label.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => { if (cameraRunning) stopCamera(); else void startCamera(); }}
              disabled={!cameraUsable || phase === 'lookup'}
              icon={<Camera size={15} />}
            >
              {engineReady === null
                ? 'Preparing…'
                : cameraRunning
                  ? 'Stop camera'
                  : cameraIssue
                    ? 'Try camera again'
                    : 'Start camera'}
            </Button>
            <Button
              variant="outline"
              onClick={() => { if (cameraRunning) stopCamera(); fileRef.current?.click(); }}
              disabled={engineReady !== true || photoBusy || phase === 'lookup'}
              loading={photoBusy}
              icon={<ImagePlus size={15} />}
            >
              Scan a photo
            </Button>
            <input
              ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only"
              onChange={(e) => void onPhoto(e.target.files?.[0])}
              aria-label="Choose or take a photo of a barcode"
            />
          </div>
          {photoMiss && (
            <p className="flex items-start gap-2 text-2xs text-warn leading-relaxed">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              No barcode found in that image. Get closer so the bars fill the frame, keep it level and in focus, then try again.
            </p>
          )}

          <div className="rounded-xl border border-line bg-surface-2/60 p-3">
            <p className="text-xs font-semibold">How barcode scanning helps</p>
            <ol className="mt-2 grid gap-2 text-2xs text-ink-3 leading-relaxed sm:grid-cols-3">
              <li className="flex gap-2"><span className="font-bold text-brand-text">1.</span><span>FitHub reads and validates the digits under the bars to reduce wrong scans.</span></li>
              <li className="flex gap-2"><span className="font-bold text-brand-text">2.</span><span>The digits find the matching packaged food in Open Food Facts.</span></li>
              <li className="flex gap-2"><span className="font-bold text-brand-text">3.</span><span>You confirm the serving, then calories and macros are added to your daily log.</span></li>
            </ol>
          </div>

          {/* Manual entry — always available */}
          <div className="flex items-end gap-2">
            <Input
              label="Or type the barcode"
              inputMode="numeric"
              placeholder="e.g. 5449000000996"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              error={manualError ?? undefined}
              prefix={<Keyboard size={14} />}
              className="flex-1"
            />
            <Button variant="secondary" onClick={submitManual} disabled={phase === 'lookup'} icon={<Search size={14} />}>
              Look up
            </Button>
          </div>

          <div className="space-y-1.5 border-t border-line pt-3">
            {engineReady !== null && (
              <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
                <ScanBarcode size={12} className="shrink-0 mt-0.5" />
                <span>
                  {engineReady
                    ? `Decoder ready (${engineRef.current?.kind === 'native' ? 'built into this browser' : 'bundled — works on iPhone Safari'}). FitHub reads barcodes, not photos of meals.`
                    : 'No barcode decoder available here — typing the digits works exactly the same.'}
                </span>
              </p>
            )}
            <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
              <Info size={12} className="shrink-0 mt-0.5" />
              <span>Only the barcode digits leave this device, sent to <span className="font-medium">Open Food Facts</span>. Camera frames are processed on your phone and never uploaded.</span>
            </p>
            <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
              <Info size={12} className="shrink-0 mt-0.5" />
              <span>Scanning identifies packaged foods; it does not estimate a meal from a photo. Always compare community-provided values with the package label.</span>
            </p>
          </div>
        </div>
      )}

      {phase === 'not_found' && (
        <ScanProblem
          title="Not in the database"
          body={`Barcode ${code} is not in Open Food Facts yet — common for local and store-brand products. Add it as a custom entry from the label instead.`}
          onRetry={restart}
        />
      )}
      {phase === 'error' && (
        <ScanProblem
          title="Could not reach the food database"
          body="The lookup needs an internet connection. Check the connection and try again, or log the food manually from its label."
          onRetry={restart}
        />
      )}

      {phase === 'found' && product && chosen && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold truncate">{product.name}</p>
                {product.brand && <p className="text-2xs text-ink-3 truncate">{product.brand}</p>}
                {code && <p className="mt-1 font-mono text-2xs text-ink-3">Barcode {code}</p>}
              </div>
              <Badge tone="muted" size="sm">Open Food Facts</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 tabular">
              {[
                ['Calories', scaled(chosen.calories), 'kcal'],
                ['Protein', scaled(chosen.protein_g), 'g'],
                ['Carbs', scaled(chosen.carbs_g), 'g'],
                ['Fat', scaled(chosen.fat_g), 'g'],
              ].map(([label, value, unit]) => (
                <div key={label} className="rounded-xl bg-surface-2 px-3 py-2">
                  <p className="text-2xs text-ink-3">{label}</p>
                  <p className="font-bold">{value ?? '—'} <span className="text-2xs font-medium text-ink-3">{value === null ? '' : unit}</span></p>
                </div>
              ))}
            </div>
            {!chosenComplete && (
              <p className="mt-2 flex items-start gap-1.5 text-2xs text-warn leading-relaxed">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                This database entry is missing a nutrition value, so FitHub will not log an incorrect zero. Try the per-100 g basis or add the values from the package label manually.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-line p-3 text-2xs text-ink-3 leading-relaxed">
            <p className="font-semibold text-ink">What the numbers mean</p>
            <p className="mt-1"><span className="font-medium text-ink-2">Calories</span> measure energy; <span className="font-medium text-ink-2">protein</span> supports muscle repair; <span className="font-medium text-ink-2">carbs</span> provide training fuel; and <span className="font-medium text-ink-2">fat</span> provides concentrated energy and supports nutrient absorption.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Amount basis"
              value={basis}
              onChange={(e) => setBasis(e.target.value as 'serving' | '100g')}
              options={[
                ...(product.perServing ? [{ value: 'serving', label: `Per serving${product.servingSize ? ` (${product.servingSize})` : ''}` }] : []),
                { value: '100g', label: 'Per 100 g' },
              ]}
            />
            <Select label="Meal" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)} options={SLOT_OPTIONS} />
          </div>
          <div className="flex items-end gap-3">
            <Input label={basis === 'serving' ? 'Servings' : '100 g portions'} type="number" inputMode="decimal" step="0.25" min="0.25"
              value={servings} onChange={(e) => setServings(e.target.value)} className="w-32" />
            {chosen.calories !== null && (
              <p className="text-sm text-ink-3 pb-2.5 tabular">Nutrition shown above for this amount</p>
            )}
          </div>
          <button type="button" onClick={restart} className="text-xs font-semibold text-ink-3 hover:text-ink">
            ← Scan a different product
          </button>
        </div>
      )}
    </Modal>
  );
}

function ScanProblem({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  return (
    <div className="text-center py-6">
      <span className="mx-auto h-12 w-12 rounded-2xl grid place-items-center bg-warn-soft text-warn">
        <AlertTriangle size={22} />
      </span>
      <p className="mt-3 font-bold">{title}</p>
      <p className="mt-1.5 text-sm text-ink-3 leading-relaxed max-w-sm mx-auto">{body}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry} icon={<ScanBarcode size={15} />}>
        Try another barcode
      </Button>
    </div>
  );
}
