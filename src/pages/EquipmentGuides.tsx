import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronDown, Clock, Dumbbell, ExternalLink, PlayCircle,
  ShieldAlert, Sparkles, Target, VideoOff, WifiOff,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { EquipmentArt } from '@/components/EquipmentArt';
import { BandSetSetupDiagram } from '@/components/equipment/BandSetSetupDiagram';
import { useData } from '@/store/data';
import { useOnline } from '@/lib/hooks';
import { EQUIPMENT_LABEL, EQUIPMENT_OPTIONS } from '@/data/exercises';
import {
  equipmentGoalRoutine, equipmentGuideFor, equipmentVideoUrl, exercisesUsing, guideMinutes,
  type EquipmentGuide,
} from '@/lib/fitness/equipmentGuides';
import { GOAL_LABEL } from '@/lib/fitness/program';
import { cn } from '@/lib/utils';
import type { Equipment, GoalKind } from '@/types';

/* ============================================================
   My equipment
   Only shows guides for kit the user has actually ticked. The
   rest is behind a "browse everything" toggle, so this page
   answers "what do I do with what I own" first and "what else
   is out there" second.
   ============================================================ */

export default function EquipmentGuides() {
  const fitnessProfile = useData((s) => s.fitnessProfile);
  const [showAll, setShowAll] = useState(false);

  const owned = useMemo<Equipment[]>(() => {
    const set = new Set<Equipment>(fitnessProfile?.equipment ?? []);
    set.add('bodyweight'); // always true, never worth hiding
    return EQUIPMENT_OPTIONS.filter((eq) => set.has(eq));
  }, [fitnessProfile?.equipment]);

  const rest = useMemo(
    () => EQUIPMENT_OPTIONS.filter((eq) => !owned.includes(eq)),
    [owned],
  );

  const goal: GoalKind = fitnessProfile?.primary_goal ?? 'general_fitness';

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Training"
        title="My equipment"
        subtitle="How to use every piece of kit you told FitHub you have — the order to do things in, how long a session should take, and where it goes wrong."
        actions={
          <>
            <Button to="/practice" size="sm" icon={<Sparkles size={14} />}>Build a practice</Button>
            <Button to="/profile" variant="outline" size="sm" iconRight={<ArrowRight size={14} />}>Edit my equipment</Button>
          </>
        }
      />

      {!fitnessProfile ? (
        <EmptyState
          icon={<Dumbbell size={22} />}
          title="No equipment on file yet"
          body="Finish setting up your fitness profile and your kit will show up here with a guide for each piece."
          action={<Button to="/onboarding">Set up my profile</Button>}
        />
      ) : (
        <>
          <div className="space-y-4">
            {owned.map((eq) => (
              <EquipmentGuideCard key={eq} equipment={eq} goal={goal} owned />
            ))}
          </div>

          {rest.length > 0 && (
            <section className="mt-8">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 px-4 py-3 text-left transition-colors hover:border-line-strong"
              >
                <span>
                  <span className="font-semibold">Everything else FitHub knows</span>
                  <span className="ml-2 text-sm text-ink-3">{rest.length} more pieces of kit</span>
                </span>
                <ChevronDown size={18} className={cn('shrink-0 text-ink-3 transition-transform', showAll && 'rotate-180')} />
              </button>

              {showAll && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-ink-3">
                    Tick any of these on your profile and FitHub will start programming with them.
                  </p>
                  {rest.map((eq) => (
                    <EquipmentGuideCard key={eq} equipment={eq} goal={goal} owned={false} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EquipmentGuideCard({ equipment, goal, owned }: {
  equipment: Equipment;
  goal: GoalKind;
  owned: boolean;
}) {
  const [open, setOpen] = useState(false);
  const guide = equipmentGuideFor(equipment);
  const label = EQUIPMENT_LABEL[equipment] ?? equipment;

  if (!guide) return null;

  return (
    <article className={cn('card', !owned && 'opacity-90')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-surface-2/60"
      >
        <EquipmentArt equipment={equipment} className="h-16 w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold">{label}</h2>
            {owned ? <Badge tone="brand" size="sm">You have this</Badge> : <Badge tone="muted" size="sm">Not on your list</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-3 line-clamp-2">{guide.summary}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-ink-3">
            <Clock size={12} aria-hidden /> {guideMinutes(guide)} min session · {guide.frequency}
          </p>
        </div>
        <ChevronDown size={18} className={cn('shrink-0 text-ink-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && <GuideDetail guide={guide} label={label} goal={goal} />}
    </article>
  );
}

function GuideDetail({ guide, label, goal }: {
  guide: EquipmentGuide;
  label: string;
  goal: GoalKind;
}) {
  const online = useOnline();
  const videoUrl = equipmentVideoUrl(guide);
  const exercises = exercisesUsing(guide.equipment);
  const total = guideMinutes(guide);
  const routine = equipmentGoalRoutine(guide.equipment, goal);

  return (
    <div className="border-t border-line p-4 sm:p-5 space-y-5">
      <div className="grid gap-5 md:grid-cols-[1fr,1.4fr]">
        <div className="space-y-3">
          <EquipmentArt equipment={guide.equipment} className="aspect-[8/5] w-full" />
          <p className="text-sm text-ink-2 leading-relaxed">{guide.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-ink-3">
              <Target size={12} aria-hidden /> Trains
            </span>
            {guide.trains.map((t) => <Badge key={t} tone="muted" size="sm">{t}</Badge>)}
          </div>

          {/* A video reference where one genuinely helps, and a plain
              statement where it does not — never a dead link. */}
          {videoUrl && online ? (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-contrast transition-[filter,transform] hover:brightness-95 active:scale-[.98]"
              aria-label={`Open ${label} video references on YouTube`}
            >
              <PlayCircle size={15} aria-hidden /> Watch reference <ExternalLink size={12} aria-hidden />
            </a>
          ) : (
            <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-2/70 p-3 text-xs text-ink-2 leading-relaxed">
              {videoUrl ? <WifiOff size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                : <VideoOff size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />}
              <span>
                <strong className="font-semibold text-ink">No video.</strong>{' '}
                {videoUrl
                  ? 'You are offline, so FitHub cannot open a video reference right now. The illustration and the steps below are all you need — they work without a connection.'
                  : `There is no video reference worth watching for a ${label.toLowerCase()}. Use the illustration and follow the steps.`}
              </span>
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text">How to use it</h3>
            <ol className="mt-2 space-y-2">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-brand-soft text-brand-text grid place-items-center text-2xs font-bold tabular">
                    {index + 1}
                  </span>
                  <span className="text-sm text-ink-2 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {guide.equipment === 'band_set' && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text">
            Setting it up — follow the pictures
          </h3>
          <p className="mt-1 text-sm text-ink-3 leading-relaxed">
            Five steps, in order. Steps 3 and 4 are the ones that hurt people.
          </p>
          <BandSetSetupDiagram className="mt-3" />
        </div>
      )}

      {routine && (
        <section className="rounded-2xl border border-brand/30 bg-brand-soft/15 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-text">
              <Target size={13} aria-hidden /> For your goal — {GOAL_LABEL[goal].toLowerCase()}
            </h3>
            <Badge tone="brand" size="sm">Matched to your profile</Badge>
          </div>
          <p className="mt-2 text-sm font-bold leading-snug">{routine.headline}</p>
          <p className="mt-1 text-xs text-ink-2 leading-relaxed">{routine.why}</p>

          <ol className="mt-3.5 space-y-3">
            {routine.steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-brand text-brand-contrast grid place-items-center text-xs font-bold tabular">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{step.title}</p>
                  <p className="mt-0.5 text-xs text-ink-2 leading-relaxed">{step.detail}</p>
                  <p className="mt-1 flex items-start gap-1.5 text-2xs text-ink-3 leading-relaxed">
                    <Check size={12} className="mt-0.5 shrink-0 text-brand-text" aria-hidden />
                    <span><span className="font-semibold text-ink-2">How you know it worked:</span> {step.cue}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="text-2xs font-bold uppercase tracking-wider text-ink-3">Sets and reps</p>
              <p className="mt-0.5 text-xs text-ink-2 leading-relaxed">{routine.dose}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="text-2xs font-bold uppercase tracking-wider text-ink-3">How often</p>
              <p className="mt-0.5 text-xs text-ink-2 leading-relaxed">{routine.weekly}</p>
            </div>
          </div>

          {/* Where the kit is a compromise for this goal, said out loud rather
              than left for the user to discover after three flat months. */}
          {routine.caveat && (
            <p className="mt-2.5 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn-soft/30 p-3 text-2xs text-ink-2 leading-relaxed">
              <ShieldAlert size={13} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              <span><strong className="font-semibold text-ink">Where this kit falls short.</strong> {routine.caveat}</span>
            </p>
          )}
        </section>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text">
          Recommended session — {total} minutes
        </h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {guide.plan.map((row) => (
            <li key={row.label} className="rounded-xl border border-line bg-surface-2/50 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{row.label}</p>
                <p className="text-sm font-bold tabular text-brand-text">{row.minutes} min</p>
              </div>
              <p className="mt-1 text-xs text-ink-3 leading-relaxed">{row.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-2 leading-relaxed">
          <span className="font-semibold text-ink">Sets and reps:</span> {guide.dose}
        </p>
        <p className="mt-1 text-sm text-ink-2 leading-relaxed">
          <span className="font-semibold text-ink">How often:</span> {guide.frequency}
        </p>
      </div>

      <div className="rounded-xl border border-warn/30 bg-warn-soft/40 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-warn">
          <ShieldAlert size={13} aria-hidden /> Keep it safe
        </h3>
        <ul className="mt-1.5 space-y-1">
          {guide.safety.map((note) => (
            <li key={note} className="text-xs text-ink-2 leading-relaxed">• {note}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button to="/practice" size="sm" icon={<Sparkles size={14} />}>
          Build a practice with this
        </Button>
      </div>

      {exercises.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text">
            Exercises in your library that use it
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {exercises.map((e) => (
              <Link
                key={e.slug}
                to={`/exercises/${e.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-brand/40 hover:text-ink"
              >
                {e.name} <ArrowRight size={12} aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
