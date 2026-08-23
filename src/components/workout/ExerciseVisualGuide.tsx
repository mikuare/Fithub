import { ExternalLink, Lock, PlayCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useHasFeature } from '@/lib/selectors';
import { exerciseGuideFor } from '@/lib/fitness/exerciseGuides';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types';

export function ExerciseVisualGuide({ exercise, compact = false }: {
  exercise: Exercise;
  compact?: boolean;
}) {
  const entitled = useHasFeature('exercise_guides');

  if (!entitled) {
    return (
      <section className={cn('rounded-2xl border border-accent/30 bg-accent-soft/30', compact ? 'p-4' : 'p-5')}>
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 shrink-0 rounded-xl bg-accent-soft text-accent-text grid place-items-center">
            <Lock size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">Visual form guide</h3>
              <Badge tone="accent" size="sm">Plus &amp; Pro</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-2 leading-relaxed">
              See the setup, movement path and finish position, then open a video reference for {exercise.name}.
            </p>
            <Button className="mt-3" size="sm" to="/pricing">Unlock visual guides</Button>
          </div>
        </div>
      </section>
    );
  }

  const guide = exerciseGuideFor(exercise);
  const cues = [
    { label: 'Setup', text: guide.setupCue },
    { label: 'Move', text: guide.movementCue },
    { label: 'Finish', text: guide.finishCue },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-brand/35 bg-brand-soft/20" aria-label={`${exercise.name} visual form guide`}>
      <div className="relative border-b border-brand/20 bg-surface-2/70">
        <span className="absolute left-3 top-3 z-10">
          <Badge tone="brand" size="sm" icon={<Sparkles size={10} aria-hidden />}>Visual guide</Badge>
        </span>
        <div className={cn('grid', guide.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {guide.images.map((image, index) => (
            <figure key={image.src} className={cn('relative overflow-hidden', index > 0 && 'border-l border-line')}>
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                className={cn(
                  'w-full object-cover',
                  guide.images.length > 1 ? 'aspect-square' : compact ? 'aspect-[2/1]' : 'aspect-[16/7]',
                )}
              />
              {image.label && (
                <figcaption className="absolute bottom-2 left-2 rounded-md bg-bg/85 px-2 py-1 text-2xs font-bold uppercase tracking-wider text-ink backdrop-blur">
                  {image.label}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>

      <div className={compact ? 'p-4' : 'p-5'}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Watch the movement</h3>
              <p className="mt-0.5 text-xs text-ink-3">Reference videos for {exercise.name}</p>
            </div>
            <a
              href={guide.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-contrast transition-[filter,transform] hover:brightness-95 active:scale-[.98]"
              aria-label={`Open ${exercise.name} reference videos on YouTube`}
            >
              <PlayCircle size={15} aria-hidden /> Watch reference <ExternalLink size={12} aria-hidden />
            </a>
          </div>

          <ol className={cn('mt-4 grid gap-2', compact ? 'grid-cols-1' : 'md:grid-cols-3')}>
            {cues.map((cue, index) => (
              <li key={cue.label} className="rounded-xl border border-line bg-surface/80 p-3">
                <p className="text-2xs font-bold uppercase tracking-wider text-brand-text">
                  {index + 1}. {cue.label}
                </p>
                <p className="mt-1 text-xs text-ink-2 leading-relaxed">{cue.text}</p>
              </li>
            ))}
          </ol>

          <p className="mt-3 flex items-start gap-1.5 text-2xs text-ink-3 leading-relaxed">
            <ShieldCheck size={12} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Use the illustration with the written cues; body proportions and equipment can vary. Video results
              open on YouTube. Prefer a qualified coach, start light, and stop if the movement causes sharp pain.
              {guide.imageSource === 'repdb' && (
                <>{' '}<a href="https://repdb.co" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">Exercise images by RepDB.</a></>
              )}
            </span>
          </p>
      </div>
    </section>
  );
}
