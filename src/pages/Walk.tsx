import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, Check, Footprints, Info, MapPin, Pause, Play,
  Satellite, Square, Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useData } from '@/store/data';
import { DistanceTracker, StepDetector, formatPace, walkPaceMinPerKm } from '@/lib/fitness/walk';
import { formatDuration } from '@/lib/utils';
import { today } from '@/lib/date';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';

/* iOS 13+ gates motion sensors behind a permission prompt that must be
   triggered by a user gesture; this is the non-standard hook for it. */
type MotionPermissionFn = () => Promise<'granted' | 'denied'>;
function motionPermission(): MotionPermissionFn | null {
  const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: MotionPermissionFn } }).DeviceMotionEvent;
  return DM?.requestPermission ?? null;
}

type Phase = 'setup' | 'live' | 'paused' | 'done';
type SensorState = 'off' | 'waiting' | 'active' | 'denied' | 'unavailable';

export default function Walk() {
  const navigate = useNavigate();
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const logHabit = useData((s) => s.logHabit);
  const startSession = useData((s) => s.startSession);
  const logSet = useData((s) => s.logSet);
  const finishSession = useData((s) => s.finishSession);

  const [phase, setPhase] = useState<Phase>('setup');
  const [useMotion, setUseMotion] = useState(true);
  const [useGps, setUseGps] = useState(true);
  const [motionState, setMotionState] = useState<SensorState>('off');
  const [gpsState, setGpsState] = useState<SensorState>('off');
  const [discarding, setDiscarding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Live readouts (state mirrors of the mutable trackers, updated on a tick).
  const [steps, setSteps] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const detector = useRef(new StepDetector());
  const tracker = useRef(new DistanceTracker());
  const segmentStart = useRef(0);
  const accumulated = useRef(0);
  const sawMotionSample = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const running = phase === 'live';

  /* ---- elapsed ticker (wall clock, so backgrounding never desyncs it) ---- */
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setElapsedMs(accumulated.current + (Date.now() - segmentStart.current));
      setSteps(detector.current.steps);
      setDistanceKm(tracker.current.totalKm);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [running]);

  /* ---- motion sensor ---- */
  useEffect(() => {
    if (!running || !useMotion || motionState === 'denied' || motionState === 'unavailable') return;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      if (!sawMotionSample.current) {
        sawMotionSample.current = true;
        setMotionState('active');
      }
      detector.current.addSample(performance.now(), Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z));
    };
    window.addEventListener('devicemotion', onMotion);
    // Desktop browsers expose the event but never fire it — report that honestly.
    const probe = setTimeout(() => {
      if (!sawMotionSample.current) setMotionState('unavailable');
    }, 4000);
    return () => {
      window.removeEventListener('devicemotion', onMotion);
      clearTimeout(probe);
    };
  }, [running, useMotion, motionState]);

  /* ---- GPS ---- */
  useEffect(() => {
    if (!running || !useGps || gpsState === 'denied' || gpsState === 'unavailable') return;
    if (!('geolocation' in navigator)) { setGpsState('unavailable'); return; }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsState('active');
        tracker.current.addPoint({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          t: pos.timestamp,
        });
      },
      (err) => setGpsState(err.code === err.PERMISSION_DENIED ? 'denied' : 'waiting'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [running, useGps, gpsState]);

  /* ---- keep the screen on while counting; re-acquire when the tab returns ---- */
  useEffect(() => {
    if (!running) return;
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null; });
        }
      } catch { /* unsupported — the walk still works, the screen may sleep */ }
    };
    void acquire();
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      try { void wakeLockRef.current?.release(); } catch { /* ignore */ }
      wakeLockRef.current = null;
    };
  }, [running]);

  const start = async () => {
    // iOS requires the permission call inside this click.
    if (useMotion) {
      const request = motionPermission();
      if (request) {
        try {
          const result = await request();
          setMotionState(result === 'granted' ? 'waiting' : 'denied');
        } catch {
          setMotionState('denied');
        }
      } else {
        setMotionState('waiting');
      }
    }
    if (useGps) setGpsState('waiting');
    detector.current = new StepDetector();
    tracker.current = new DistanceTracker();
    sawMotionSample.current = false;
    accumulated.current = 0;
    segmentStart.current = Date.now();
    setSteps(0); setDistanceKm(0); setElapsedMs(0);
    setPhase('live');
  };

  const pause = () => {
    accumulated.current += Date.now() - segmentStart.current;
    setPhase('paused');
  };
  const resume = () => {
    segmentStart.current = Date.now();
    setPhase('live');
  };
  const end = () => {
    if (phase === 'live') accumulated.current += Date.now() - segmentStart.current;
    setElapsedMs(accumulated.current);
    setSteps(detector.current.steps);
    setDistanceKm(tracker.current.totalKm);
    setPhase('done');
  };

  const stepsHabit = habits.find((h) => h.key === 'steps' && h.active) ?? null;
  const durationSeconds = Math.round(elapsedMs / 1000);
  const pace = walkPaceMinPerKm(distanceKm, elapsedMs);
  const roundedKm = Math.round(distanceKm * 100) / 100;

  const save = async () => {
    setSaving(true);
    try {
      const session = await startSession({ title: 'Walk', kind: 'cardio', planned: [{
        id: uid('pe'), exercise_slug: 'brisk-walk', order: 0, sets: 1,
        target_reps: null, target_seconds: durationSeconds, target_weight_kg: null,
        rest_seconds: 0, notes: '', superset_group: null,
      }] });
      await logSet({
        id: uid('set'), session_id: session.id, exercise_slug: 'brisk-walk', set_index: 0,
        weight_kg: null, reps: null, seconds: durationSeconds,
        distance_km: roundedKm > 0 ? roundedKm : null,
        rpe: null, completed: true, is_warmup: false, logged_at: new Date().toISOString(),
      });
      await finishSession(session.id, {
        durationSeconds, difficulty: null, feeling: null,
        notes: steps > 0 ? `Walk Mode — ${steps} steps counted` : 'Walk Mode',
      });
      if (stepsHabit && steps > 0) {
        const existing = habitLogs.find((l) => l.habit_id === stepsHabit.id && l.date === today())?.value ?? 0;
        await logHabit(stepsHabit.id, today(), existing + steps);
      }
      toast.success('Walk saved', `${formatDuration(durationSeconds)}${roundedKm ? ` · ${roundedKm} km` : ''}${steps ? ` · ${steps} steps` : ''}`);
      navigate('/');
    } catch {
      toast.error('Could not save the walk');
      setSaving(false);
    }
  };

  const sensorBadge = (state: SensorState, activeLabel: string) => {
    switch (state) {
      case 'active': return <Badge tone="success" size="sm">{activeLabel}</Badge>;
      case 'waiting': return <Badge tone="info" size="sm">searching…</Badge>;
      case 'denied': return <Badge tone="warn" size="sm">permission blocked</Badge>;
      case 'unavailable': return <Badge tone="muted" size="sm">not available here</Badge>;
      default: return <Badge tone="muted" size="sm">off</Badge>;
    }
  };

  const liveStats = useMemo(() => ([
    { label: 'Distance', value: roundedKm > 0 ? `${roundedKm.toFixed(2)}` : '—', unit: 'km' },
    { label: 'Pace', value: formatPace(pace), unit: '' },
  ]), [roundedKm, pace]);

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <PageHeader
        eyebrow="Walk Mode"
        title={phase === 'done' ? 'Walk complete' : 'Take it outside'}
        subtitle={phase === 'setup'
          ? 'Real step counting and GPS distance, measured on this device — nothing typed, nothing guessed.'
          : undefined}
      />

      {phase === 'setup' && (
        <>
          <Card>
            <div className="p-5 space-y-4">
              <Toggle
                checked={useMotion}
                onChange={setUseMotion}
                label="Count steps with the motion sensor"
                description="Uses the accelerometer. iOS will ask for permission when you start."
              />
              <Toggle
                checked={useGps}
                onChange={setUseGps}
                label="Track distance and pace with GPS"
                description="Location stays on this device — it is used for distance maths and never stored as a route."
              />
              <Button size="xl" block onClick={() => void start()} disabled={!useMotion && !useGps} icon={<Play size={18} />}>
                Start walking
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="What it counts toward" dense />
            <ul className="px-5 pb-4 pt-1 space-y-2 text-sm text-ink-2">
              <li className="flex items-start gap-2"><Check size={15} className="text-brand-text shrink-0 mt-0.5" />Steps go into your steps habit — step challenges and the daily-steps goal update from it.</li>
              <li className="flex items-start gap-2"><Check size={15} className="text-brand-text shrink-0 mt-0.5" />Distance is logged as a walking session — distance challenges and your streak count it.</li>
              <li className="flex items-start gap-2"><Check size={15} className="text-brand-text shrink-0 mt-0.5" />Calories are estimated from the walk's duration and your body weight, labelled as estimates.</li>
            </ul>
          </Card>

          <Card className="border-info/30">
            <div className="p-4">
              <p className="flex items-start gap-2 text-xs text-ink-2 leading-relaxed">
                <Info size={14} className="shrink-0 mt-0.5 text-info" />
                <span>
                  <span className="font-semibold">The honest limits:</span> counting runs only while FitHub is open
                  with the screen on — web apps get no background pedometer on iOS or Android. FitHub keeps the
                  screen awake during a walk, but locking the phone pauses the sensors. For pocket walks,
                  log steps manually in Habits as before.
                </span>
              </p>
            </div>
          </Card>
        </>
      )}

      {(phase === 'live' || phase === 'paused') && (
        <>
          <Card className={phase === 'paused' ? 'border-warn/40' : 'border-brand/40'}>
            <div className="p-6 text-center">
              <p className="text-2xs uppercase tracking-widest text-ink-3">
                {phase === 'paused' ? 'Paused' : 'Walking'} · {formatDuration(Math.round(elapsedMs / 1000))}
              </p>
              <p className="mt-2 text-6xl font-black tabular leading-none">{steps}</p>
              <p className="mt-1 text-sm text-ink-3">steps</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {liveStats.map((s) => (
                  <div key={s.label} className="rounded-xl bg-surface-2 border border-line p-3">
                    <p className="text-2xs text-ink-3 uppercase tracking-wide">{s.label}</p>
                    <p className="text-xl font-black tabular mt-0.5">{s.value}<span className="text-xs font-semibold text-ink-3"> {s.unit}</span></p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1.5"><Footprints size={13} /> Motion {useMotion ? sensorBadge(motionState, 'counting') : sensorBadge('off', '')}</span>
              <span className="inline-flex items-center gap-1.5"><Satellite size={13} /> GPS {useGps ? sensorBadge(gpsState, 'tracking') : sensorBadge('off', '')}</span>
            </div>
            {(motionState === 'unavailable' || motionState === 'denied') && useMotion && (
              <p className="px-5 pb-3 -mt-1 flex items-start gap-1.5 text-2xs text-ink-3 leading-relaxed">
                <AlertTriangle size={12} className="shrink-0 mt-0.5 text-warn" />
                {motionState === 'denied'
                  ? 'Motion permission was blocked — steps will stay at zero. Allow motion access in browser settings and restart the walk.'
                  : 'No motion sensor is reporting — normal on laptops and desktops. On a phone, steps count here.'}
              </p>
            )}
          </Card>

          <div className="flex gap-3">
            {phase === 'live' ? (
              <Button variant="outline" size="lg" className="flex-1" onClick={pause} icon={<Pause size={16} />}>Pause</Button>
            ) : (
              <Button size="lg" className="flex-1" onClick={resume} icon={<Play size={16} />}>Resume</Button>
            )}
            <Button variant="danger" size="lg" className="flex-1" onClick={end} icon={<Square size={16} />}>End walk</Button>
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <Card className="border-brand/40">
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-3xl font-black tabular">{steps}</p>
                  <p className="text-2xs text-ink-3 uppercase tracking-wide mt-1">steps</p>
                </div>
                <div>
                  <p className="text-3xl font-black tabular">{roundedKm > 0 ? roundedKm.toFixed(2) : '—'}</p>
                  <p className="text-2xs text-ink-3 uppercase tracking-wide mt-1">km</p>
                </div>
                <div>
                  <p className="text-3xl font-black tabular">{formatDuration(durationSeconds)}</p>
                  <p className="text-2xs text-ink-3 uppercase tracking-wide mt-1">time</p>
                </div>
              </div>
              {pace !== null && (
                <p className="mt-4 text-center text-sm text-ink-3 tabular">Average pace {formatPace(pace)}</p>
              )}
              {steps === 0 && roundedKm === 0 && (
                <p className="mt-4 flex items-start gap-2 text-xs text-ink-3 leading-relaxed">
                  <Info size={13} className="shrink-0 mt-0.5" />
                  Nothing was measured — the sensors may be unavailable on this device. Saving would record only the time.
                </p>
              )}
            </div>
          </Card>

          {!stepsHabit && steps > 0 && (
            <Card className="border-warn/30">
              <p className="p-4 flex items-start gap-2 text-xs text-ink-2 leading-relaxed">
                <Activity size={14} className="shrink-0 mt-0.5 text-warn" />
                <span>
                  The steps habit is off, so these {steps} steps will not feed step challenges.
                  Turn it on in <Link to="/habits" className="font-semibold text-brand-text">Healthy Habits</Link> first if you want them counted — the walk itself still saves.
                </span>
              </p>
            </Card>
          )}

          <div className="flex gap-3">
            <Button size="lg" className="flex-1" onClick={() => void save()} loading={saving} icon={<Check size={16} />}>
              Save walk
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setDiscarding(true)} icon={<Trash2 size={16} />}>
              Discard
            </Button>
          </div>
          <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
            <MapPin size={12} className="shrink-0 mt-0.5" />
            Distance is a total only — FitHub never stores where you walked.
          </p>
        </>
      )}

      <ConfirmDialog
        open={discarding}
        onClose={() => setDiscarding(false)}
        onConfirm={() => { setDiscarding(false); navigate('/'); }}
        title="Discard this walk?"
        body="Nothing has been saved yet — the steps, distance and time from this session will be gone."
        confirmLabel="Discard walk"
      />
    </div>
  );
}
