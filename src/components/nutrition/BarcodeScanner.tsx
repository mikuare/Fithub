import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, CameraOff, Check, Info, Keyboard, Loader2, ScanBarcode, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Field';
import { barcodeValid, mapOffProduct, normalizeBarcode, offProductUrl, type ScannedProduct } from '@/lib/fitness/barcode';
import { cn } from '@/lib/utils';
import type { MealSlot, NutritionLog } from '@/types';

/* Minimal typing for the native Shape Detection API — not yet in lib.dom. */
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorInstance { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> }
interface BarcodeDetectorCtor { new (options?: { formats?: string[] }): BarcodeDetectorInstance }

function getDetector(): BarcodeDetectorInstance | null {
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  } catch {
    return null;
  }
}

const SLOT_OPTIONS: Array<{ value: MealSlot; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
];

type Phase = 'scan' | 'lookup' | 'found' | 'not_found' | 'error';

export function BarcodeScanner({ defaultSlot, onClose, onAdd }: {
  defaultSlot: MealSlot;
  onClose: () => void;
  onAdd: (log: Omit<NutritionLog, 'id' | 'user_id' | 'created_at' | 'date'>) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const detector = useMemo(() => getDetector(), []);
  const cameraPossible = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!detector;

  const [cameraState, setCameraState] = useState<'starting' | 'live' | 'denied' | 'unavailable'>(
    cameraPossible ? 'starting' : 'unavailable',
  );
  const [phase, setPhase] = useState<Phase>('scan');
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const [servings, setServings] = useState('1');
  const [basis, setBasis] = useState<'serving' | '100g'>('serving');

  /* ---- camera lifecycle: runs while the scan view is showing, restarts on retry ---- */
  useEffect(() => {
    if (!cameraPossible || phase !== 'scan') return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    setCameraState('starting');
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraState('live');
        interval = setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || !detector) return;
          try {
            const found = await detector.detect(video);
            const hit = found.find((b) => barcodeValid(b.rawValue));
            if (hit && !cancelled) void lookUp(hit.rawValue);
          } catch {
            /* a frame that fails to decode is not an error worth surfacing */
          }
        }, 350);
      } catch {
        if (!cancelled) setCameraState('denied');
      }
    })();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cameraPossible]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  /* ---- lookup ---- */
  const lookUp = async (raw: string) => {
    const normalized = normalizeBarcode(raw);
    setCode(normalized);
    setPhase('lookup');
    if (!navigator.onLine) { setPhase('error'); return; }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(offProductUrl(normalized), { signal: controller.signal });
      clearTimeout(timer);
      const mapped = mapOffProduct(await res.json());
      if (!mapped) { setPhase('not_found'); return; }
      setProduct(mapped);
      setBasis(mapped.perServing ? 'serving' : '100g');
      setPhase('found');
    } catch {
      setPhase('error');
    }
  };

  const submitManual = () => {
    setManualError(null);
    if (!barcodeValid(manualCode)) {
      setManualError('That does not look like a valid barcode — EAN-8, UPC or EAN-13 digits, including the last check digit.');
      return;
    }
    void lookUp(manualCode);
  };

  /* ---- add to log ---- */
  const chosen = product && (basis === 'serving' && product.perServing ? product.perServing : product.per100g);
  const n = Math.max(0.25, Number(servings) || 1);
  const canAdd = !!product && !!chosen && chosen.calories !== null;

  const add = () => {
    if (!product || !chosen || chosen.calories === null) return;
    const basisLabel = basis === 'serving' ? (product.servingSize ?? 'serving') : '100 g';
    void onAdd({
      slot,
      name: `${product.name}${product.brand ? ` — ${product.brand}` : ''} (${basisLabel})`,
      servings: n,
      calories: chosen.calories,
      protein_g: chosen.protein_g ?? 0,
      carbs_g: chosen.carbs_g ?? 0,
      fat_g: chosen.fat_g ?? 0,
    });
  };

  const macroLine = (m: NonNullable<typeof chosen>) =>
    [`${m.protein_g ?? '—'}p`, `${m.carbs_g ?? '—'}c`, `${m.fat_g ?? '—'}f`].join(' · ');

  return (
    <Modal
      open
      onClose={() => { stopCamera(); onClose(); }}
      title="Scan a barcode"
      description="Packaged foods only — point the camera at the barcode, or type it."
      size="md"
      footer={phase === 'found' ? (
        <Button block disabled={!canAdd} onClick={add} icon={<Check size={15} />}>
          Add to log
        </Button>
      ) : undefined}
    >
      {(phase === 'scan' || phase === 'lookup') && (
        <div className="space-y-4">
          {/* Camera viewport */}
          <div className="relative rounded-2xl overflow-hidden bg-surface-3 aspect-video grid place-items-center">
            {cameraState === 'live' || cameraState === 'starting' ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-20 rounded-xl border-2 border-brand/80 pointer-events-none" aria-hidden />
                {phase === 'lookup' ? (
                  <span className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg/80 text-sm font-semibold">
                    <Loader2 size={14} className="animate-spin" /> Looking up {code}…
                  </span>
                ) : cameraState === 'starting' ? (
                  <span className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg/80 text-sm font-semibold">
                    <Camera size={14} /> Starting camera…
                  </span>
                ) : null}
              </>
            ) : (
              <div className="p-6 text-center">
                <CameraOff size={22} className="mx-auto text-ink-3" />
                <p className="mt-2 text-sm font-semibold">
                  {cameraState === 'denied' ? 'Camera access was blocked' : 'Live scanning is not available in this browser'}
                </p>
                <p className="mt-1 text-2xs text-ink-3 leading-relaxed max-w-sm mx-auto">
                  {cameraState === 'denied'
                    ? 'Allow camera access in your browser settings, or type the barcode below — it works exactly the same.'
                    : 'This browser does not expose the barcode detector (most Android browsers do). Type the digits under the barcode instead.'}
                </p>
              </div>
            )}
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
            <Button variant="outline" onClick={submitManual} disabled={phase === 'lookup'} icon={<Search size={14} />}>
              Look up
            </Button>
          </div>

          <div className="space-y-1.5">
            <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
              <Info size={12} className="shrink-0 mt-0.5" />
              <span>
                Only the barcode digits leave this device, sent to <span className="font-medium">Open Food Facts</span> —
                a free, open, community-run food database. Values are as the community recorded them.
              </span>
            </p>
            <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
              <ScanBarcode size={12} className="shrink-0 mt-0.5" />
              <span>
                FitHub reads barcodes; it does not guess food from photos. For whole foods without a
                barcode, the food search already knows the common ones.
              </span>
            </p>
          </div>
        </div>
      )}

      {phase === 'not_found' && (
        <ScanProblem
          title="Not in the database"
          body={`Barcode ${code} is not in Open Food Facts yet — common for local and store-brand products. Add it as a custom entry from the label instead.`}
          onRetry={() => setPhase('scan')}
        />
      )}
      {phase === 'error' && (
        <ScanProblem
          title="Could not reach the food database"
          body="The lookup needs an internet connection. Check the connection and try again, or log the food manually from its label."
          onRetry={() => setPhase('scan')}
        />
      )}

      {phase === 'found' && product && chosen && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold truncate">{product.name}</p>
                {product.brand && <p className="text-2xs text-ink-3">{product.brand}</p>}
              </div>
              <Badge tone="muted" size="sm">Open Food Facts</Badge>
            </div>
            <p className="mt-2 text-sm tabular">
              <span className="font-black text-lg">{chosen.calories ?? '—'}</span>
              <span className="text-ink-3"> kcal · {macroLine(chosen)}</span>
            </p>
            {!product.complete && (
              <p className="mt-2 flex items-start gap-1.5 text-2xs text-warn leading-relaxed">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                Some values are missing from the database entry — missing macros log as 0. Check the label if precision matters.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <Input label="Servings" type="number" inputMode="decimal" step="0.25" min="0.25"
              value={servings} onChange={(e) => setServings(e.target.value)} className="w-32" />
            {chosen.calories !== null && (
              <p className="text-sm text-ink-3 pb-2.5 tabular">= {Math.round(chosen.calories * n)} kcal</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ScanProblem({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  return (
    <div className="text-center py-6">
      <span className={cn('mx-auto h-12 w-12 rounded-2xl grid place-items-center bg-warn-soft text-warn')}>
        <AlertTriangle size={22} />
      </span>
      <p className="mt-3 font-bold">{title}</p>
      <p className="mt-1.5 text-sm text-ink-3 leading-relaxed max-w-sm mx-auto">{body}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry} icon={<ScanBarcode size={15} />}>
        Scan again
      </Button>
    </div>
  );
}
