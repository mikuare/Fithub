import type { DataState } from '@/store/data';
import { getExercise, EXERCISES } from '@/data/exercises';
import { buildHistory, strengthTrend, suggestProgression } from '@/lib/fitness/progression';
import { computeStreak } from '@/lib/fitness/streaks';
import { computeRecoveryScore } from '@/lib/fitness/recovery';
import { computeFitScore } from '@/lib/fitness/fitscore';
import { goalPercent, requiredWeeklyRate } from '@/lib/fitness/goals';
import { sessionVolume } from '@/lib/fitness/calculations';
import { fmtWeight } from '@/lib/fitness/units';
import { SESSION_KIND_META } from '@/lib/fitness/program';
import { MUSCLE_LABEL } from '@/data/exercises';
import { addDays, formatDate, relativeDay, startOfWeek, today, weekdayOf } from '@/lib/date';
import { humanDuration, pluralize, round } from '@/lib/utils';
import type { MuscleGroup } from '@/types';

export interface CoachAnswer {
  text: string;
  /** Short factual rows the UI renders as a table under the answer. */
  facts?: Array<{ label: string; value: string }>;
  /** Follow-up questions the user can tap. */
  suggestions?: string[];
  link?: { label: string; to: string };
  /** True when FitHub had to say "I don't have that recorded". */
  missingData?: boolean;
}

export const STARTER_QUESTIONS = [
  'What is my workout today?',
  'How did I perform this week?',
  'What muscles did I train yesterday?',
  'What should I do on a recovery day?',
  'Why am I not progressing?',
  'Show my bench press progress',
  'What can replace cable rows?',
  'How consistent was I this month?',
];

/**
 * FitCoach: a deterministic, data-grounded assistant.
 *
 * It only ever answers from what the user has actually recorded. When the data
 * is not there it says so plainly rather than inventing a plausible number —
 * an assistant that guesses about your training is worse than one that admits
 * the gap.
 */
export function askFitCoach(question: string, state: DataState): CoachAnswer {
  const q = question.trim();
  if (!q) return { text: 'Ask me anything about your training and I will answer from your own logs.' };

  const nq = normalise(q);
  // Whole-word matching. Plain substring search would fire "pr" inside
  // "press" and "progress", routing strength questions to the records answer.
  const has = (...phrases: string[]) =>
    phrases.some((p) => new RegExp(`\\b${normalise(p).replace(/ /g, '\\s+')}\\b`).test(nq));

  if (has('today', 'what should i do', "what's my workout", 'what is my workout')) return answerToday(state);
  if (has('this week', 'how did i perform', 'weekly', 'last 7 days')) return answerWeek(state);
  if (has('yesterday')) return answerYesterday(state);
  if (has('recovery day', 'rest day', 'active recovery')) return answerRecoveryDay(state);
  if (has('not progressing', 'plateau', 'stuck', 'why am i not')) return answerPlateau(state);
  if (has('consistent', 'consistency', 'this month', 'how often')) return answerConsistency(state);
  if (has('replace', 'alternative', 'instead of', 'substitute', 'swap')) return answerAlternatives(q, state);
  if (has('recovery', 'readiness', 'how recovered', 'sleep')) return answerRecovery(state);
  if (has('goal', 'target', 'on track')) return answerGoals(state);
  if (has('record', 'pr', 'personal best', 'best lift')) return answerRecords(state);
  if (has('fitscore', 'fit score', 'score')) return answerFitScore(state);
  if (has('volume', 'tonnage', 'how much have i lifted')) return answerVolume(state);
  if (has('muscle', 'balance', 'am i training enough')) return answerBalance(state);
  if (has('nutrition', 'calories', 'protein', 'eat')) return answerNutrition(state);

  // Exercise-specific: "show my bench press progress"
  const exercise = findExercise(q);
  if (exercise) return answerExercise(exercise.slug, state);

  return {
    text:
      'I could not match that to something I can answer from your data. I work best with questions about your programme, this week, a specific exercise, your recovery, your goals or your records.',
    suggestions: STARTER_QUESTIONS.slice(0, 4),
  };
}

/* ------------------------------------------------------------------ */

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Words too generic to identify an exercise on their own. */
const WEAK_TOKENS = new Set(['the', 'and', 'with', 'one', 'body', 'out', 'up', 'over']);

/**
 * Finds the exercise a question is about by token overlap rather than exact
 * name match, so "cable rows" resolves to "Seated Cable Row" and "bench press"
 * to "Barbell Bench Press". Simple plural handling covers the common cases.
 */
function findExercise(q: string) {
  const questionTokens = new Set(normalise(q).split(' '));
  const singular = (t: string) => (t.endsWith('s') ? t.slice(0, -1) : t);

  let best: (typeof EXERCISES)[number] | null = null;
  let bestScore = 0;

  for (const e of EXERCISES) {
    const tokens = normalise(e.name).split(' ').filter((t) => t.length > 2 && !WEAK_TOKENS.has(t));
    if (!tokens.length) continue;

    let hits = 0;
    for (const t of tokens) {
      if (
        questionTokens.has(t) ||
        questionTokens.has(`${t}s`) ||
        questionTokens.has(singular(t)) ||
        [...questionTokens].some((qt) => singular(qt) === singular(t))
      ) hits++;
    }

    const coverage = hits / tokens.length;
    if (coverage < 0.5) continue;
    const score = coverage * 10 + hits;
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best;
}

function answerToday(state: DataState): CoachAnswer {
  const program = state.programs.find((p) => p.active);
  if (!program) {
    return {
      text: 'You do not have an active programme yet, so I have nothing scheduled for today. Generating one takes a few seconds and uses the goal, schedule and equipment from your profile.',
      link: { label: 'Create my programme', to: '/program' },
      missingData: true,
    };
  }
  const day = program.days.find((d) => d.weekday === weekdayOf(today()));
  const done = state.sessions.find((s) => s.date === today() && s.status === 'completed');

  if (done) {
    const sets = state.sets.filter((s) => s.session_id === done.id && s.completed && !s.is_warmup);
    return {
      text: `You have already trained today — ${done.title}, ${humanDuration(done.duration_seconds)}. That is the session done.`,
      facts: [
        { label: 'Sets completed', value: String(sets.length) },
        { label: 'Volume', value: sessionVolume(sets) > 0 ? fmtWeight(sessionVolume(sets), state.preferences?.units ?? 'metric', 0) : '—' },
        { label: 'Tomorrow', value: nextDayTitle(state) },
      ],
      link: { label: 'See your progress', to: '/progress' },
    };
  }

  if (!day || day.kind === 'rest') {
    return {
      text: 'Today is a scheduled rest day in your programme. That is deliberate — rest is when the adaptation from your last sessions actually happens, and taking it keeps your consistency streak intact.',
      suggestions: ['What should I do on a recovery day?', 'How did I perform this week?'],
      link: { label: 'Log a recovery check-in', to: '/recovery' },
    };
  }

  const recovery = computeRecoveryScore(state.recovery.find((r) => r.date === today()) ?? {}, state.sessions);
  const caution = recovery.hasInput && recovery.score < 45
    ? ` Your recovery check-in came in at ${recovery.score}/100 today, so consider trimming a set from the heaviest lifts.`
    : '';

  return {
    text: `Today is ${day.title} — ${day.focus}. About ${day.est_minutes} minutes across ${pluralize(day.exercises.length, 'exercise')}.${caution}`,
    facts: day.exercises.slice(0, 6).map((pe, i) => ({
      label: `${i + 1}. ${getExercise(pe.exercise_slug)?.name ?? pe.exercise_slug}`,
      value: pe.target_seconds
        ? `${pe.sets} × ${pe.target_seconds >= 60 ? `${Math.round(pe.target_seconds / 60)} min` : `${pe.target_seconds}s`}`
        : `${pe.sets} × ${pe.target_reps}`,
    })),
    link: { label: 'Start this workout', to: '/workout' },
  };
}

function nextDayTitle(state: DataState): string {
  const program = state.programs.find((p) => p.active);
  if (!program) return 'No programme';
  const day = program.days.find((d) => d.weekday === weekdayOf(addDays(today(), 1)));
  return day?.title ?? 'Nothing scheduled';
}

function answerWeek(state: DataState): CoachAnswer {
  const start = startOfWeek(today(), state.preferences?.week_starts_on ?? 1);
  const done = state.sessions.filter((s) => s.status === 'completed' && s.date >= start);
  const target = state.programs.find((p) => p.active)?.days_per_week ?? 3;

  if (done.length === 0) {
    return {
      text: `Nothing logged so far this week. Your target is ${target} sessions — there is still time, and even one session is worth more than a perfect plan you do not start.`,
      link: { label: "Today's workout", to: '/workout' },
      missingData: true,
    };
  }

  const ids = new Set(done.map((s) => s.id));
  const sets = state.sets.filter((s) => ids.has(s.session_id) && s.completed && !s.is_warmup);
  const minutes = Math.round(done.reduce((a, s) => a + s.duration_seconds / 60, 0));
  const units = state.preferences?.units ?? 'metric';

  const sleepLogs = state.recovery.filter((r) => r.date >= start && r.sleep_hours !== null);
  const avgSleep = sleepLogs.length
    ? round(sleepLogs.reduce((a, r) => a + (r.sleep_hours ?? 0), 0) / sleepLogs.length, 1)
    : null;

  return {
    text: `${done.length} of ${target} sessions done this week, totalling ${humanDuration(minutes * 60)}. ${
      done.length >= target ? 'Target met — anything else this week is a bonus.' : `${target - done.length} to go.`
    }`,
    facts: [
      { label: 'Sessions', value: `${done.length} / ${target}` },
      { label: 'Training time', value: humanDuration(minutes * 60) },
      { label: 'Working sets', value: String(sets.length) },
      { label: 'Volume', value: sessionVolume(sets) > 0 ? fmtWeight(sessionVolume(sets), units, 0) : 'No loaded sets' },
      { label: 'Average sleep', value: avgSleep !== null ? `${avgSleep} h` : 'Not logged' },
    ],
    link: { label: 'Full weekly review', to: '/review' },
    missingData: avgSleep === null,
  };
}

function answerYesterday(state: DataState): CoachAnswer {
  const date = addDays(today(), -1);
  const session = state.sessions.find((s) => s.date === date && s.status === 'completed');
  if (!session) {
    return {
      text: 'You did not log a workout yesterday. If you trained and forgot to record it, you can still log it against that date from the workout screen.',
      missingData: true,
    };
  }
  const sets = state.sets.filter((s) => s.session_id === session.id && s.completed && !s.is_warmup);
  const primary = new Map<MuscleGroup, number>();
  for (const s of sets) {
    const e = getExercise(s.exercise_slug);
    e?.primary.forEach((m) => primary.set(m, (primary.get(m) ?? 0) + 1));
  }
  const ranked = [...primary.entries()].sort((a, b) => b[1] - a[1]);

  return {
    text: `Yesterday you did ${session.title} — ${humanDuration(session.duration_seconds)}, ${pluralize(sets.length, 'working set')}. The muscles that took most of that work were ${
      ranked.slice(0, 3).map(([m]) => MUSCLE_LABEL[m]).join(', ') || 'not recorded'
    }.`,
    facts: ranked.slice(0, 6).map(([m, count]) => ({ label: MUSCLE_LABEL[m], value: pluralize(count, 'set') })),
    suggestions: ['What is my workout today?', 'How recovered am I?'],
  };
}

function answerRecoveryDay(state: DataState): CoachAnswer {
  const readout = computeRecoveryScore(state.recovery.find((r) => r.date === today()) ?? {}, state.sessions);
  return {
    text:
      'A recovery day is not an empty day. Twenty to forty minutes of easy walking or cycling, some mobility work through the ranges you use in training, and a genuine effort on sleep and food will do more for your next session than an extra workout would.' +
      (readout.hasInput ? ` Your readiness today is ${readout.score}/100 — ${readout.label.toLowerCase()}.` : ''),
    facts: [
      { label: 'Easy cardio', value: '20–40 min, conversational pace' },
      { label: 'Mobility', value: '10 min through your training ranges' },
      { label: 'Sleep target', value: '7–9 hours' },
      { label: 'Protein', value: 'Spread across the day, not one meal' },
    ],
    link: { label: 'Log your recovery', to: '/recovery' },
  };
}

function answerPlateau(state: DataState): CoachAnswer {
  const reasons: string[] = [];
  const facts: Array<{ label: string; value: string }> = [];

  const start4w = addDays(today(), -28);
  const recent = state.sessions.filter((s) => s.status === 'completed' && s.date >= start4w);
  const target = state.programs.find((p) => p.active)?.days_per_week ?? 3;
  const expected = target * 4;
  facts.push({ label: 'Sessions in 4 weeks', value: `${recent.length} of about ${expected}` });

  if (recent.length < expected * 0.7) {
    reasons.push(`consistency — you have logged ${recent.length} sessions in four weeks against a target of roughly ${expected}. Frequency is almost always the first thing to fix`);
  }

  const recentRecovery = state.recovery.filter((r) => r.date >= start4w);
  if (recentRecovery.length) {
    const avg = Math.round(recentRecovery.reduce((a, r) => a + r.score, 0) / recentRecovery.length);
    facts.push({ label: 'Average readiness', value: `${avg} / 100` });
    if (avg < 55) reasons.push('recovery — your readiness has averaged below 55, which usually means sleep, stress or training density needs attention before load does');
  } else {
    facts.push({ label: 'Recovery check-ins', value: 'None logged' });
  }

  const sleepLogs = recentRecovery.filter((r) => r.sleep_hours !== null);
  if (sleepLogs.length) {
    const avgSleep = round(sleepLogs.reduce((a, r) => a + (r.sleep_hours ?? 0), 0) / sleepLogs.length, 1);
    facts.push({ label: 'Average sleep', value: `${avgSleep} h` });
    if (avgSleep < 6.5) reasons.push('sleep — averaging under 6.5 hours blunts both strength output and adaptation');
  }

  const dates = new Map(state.sessions.map((s) => [s.id, s.date]));
  const staleLifts: string[] = [];
  const slugs = [...new Set(state.sets.filter((s) => s.weight_kg !== null).map((s) => s.exercise_slug))];
  for (const slug of slugs.slice(0, 12)) {
    const history = buildHistory(state.sets.filter((s) => s.exercise_slug === slug), (id) => dates.get(id) ?? null);
    if (history.length < 3) continue;
    const trend = strengthTrend(history, 6);
    if (trend !== null && trend <= 0) staleLifts.push(getExercise(slug)?.name ?? slug);
  }
  if (staleLifts.length) {
    facts.push({ label: 'Lifts not moving', value: staleLifts.slice(0, 3).join(', ') });
    reasons.push('load progression — some lifts have not moved in six weeks. Chasing an extra rep per set before adding weight usually restarts it');
  }

  if (reasons.length === 0) {
    return {
      text: 'From what you have logged, nothing obvious is holding you back — your frequency, recovery and load progression all look reasonable. Progress is not linear, and a few flat weeks inside a good trend is normal rather than a problem to solve.',
      facts,
      link: { label: 'Check your strength trends', to: '/progress' },
    };
  }

  return {
    text: `Looking at your data, the most likely factors are: ${reasons.join('; ')}. I would fix them in that order — adding intensity on top of an unaddressed recovery or consistency problem tends to make things worse.`,
    facts,
    link: { label: 'Review your programme', to: '/program' },
  };
}

function answerConsistency(state: DataState): CoachAnswer {
  const streak = computeStreak(state.sessions, state.programs.find((p) => p.active) ?? null);
  const month = today().slice(0, 7);
  const monthSessions = state.sessions.filter((s) => s.status === 'completed' && s.date.startsWith(month));
  const target = state.programs.find((p) => p.active)?.days_per_week ?? 3;

  if (monthSessions.length === 0) {
    return {
      text: 'Nothing logged this month yet. The most useful number in this whole app is how many weeks in a row you hit your own target — and that starts with one session.',
      link: { label: "Today's workout", to: '/workout' },
      missingData: true,
    };
  }

  const weeksElapsed = Math.max(1, Math.ceil(new Date().getDate() / 7));
  const perWeek = round(monthSessions.length / weeksElapsed, 1);

  return {
    text: `You have completed ${pluralize(monthSessions.length, 'workout')} this month, averaging ${perWeek} per week against a target of ${target}. ${
      perWeek >= target ? 'That is on or ahead of plan.' : 'Slightly behind plan, but the month is not over.'
    }`,
    facts: [
      { label: 'Workouts this month', value: String(monthSessions.length) },
      { label: 'Average per week', value: `${perWeek} of ${target}` },
      { label: 'Current streak', value: pluralize(streak.current, 'day') },
      { label: 'Longest streak', value: pluralize(streak.longest, 'day') },
      { label: 'Consistent weeks', value: pluralize(streak.consistent_weeks, 'week') },
    ],
    link: { label: 'Open the calendar', to: '/calendar' },
  };
}

function answerAlternatives(q: string, state: DataState): CoachAnswer {
  const exercise = findExercise(q);
  if (!exercise) {
    return {
      text: 'Tell me which exercise you want to replace and I will suggest alternatives that train the same thing — for example, "what can replace cable rows?".',
      suggestions: ['What can replace cable rows?', 'What can replace back squats?'],
    };
  }
  const equipment = state.fitnessProfile?.equipment ?? ['bodyweight'];
  const alts = exercise.alternatives.map(getExercise).filter(Boolean);
  const available = alts.filter((a) => a!.equipment.every((e) => equipment.includes(e) || e === 'bodyweight'));
  const list = available.length ? available : alts;

  if (!list.length) {
    return {
      text: `I do not have alternatives recorded for ${exercise.name}. Anything that trains ${exercise.primary.map((m) => MUSCLE_LABEL[m]).join(' and ')} through a similar range will work — the exercise library lets you filter by muscle.`,
      link: { label: 'Browse the library', to: '/exercises' },
      missingData: true,
    };
  }

  return {
    text: `For ${exercise.name}, these train the same primary muscles (${exercise.primary.map((m) => MUSCLE_LABEL[m]).join(', ')})${
      available.length ? ' and only use equipment you have listed' : ''
    }:`,
    facts: list.map((a) => ({ label: a!.name, value: a!.equipment.join(', ').replace(/_/g, ' ') })),
    link: { label: `Open ${exercise.name}`, to: `/exercises/${exercise.slug}` },
  };
}

function answerExercise(slug: string, state: DataState): CoachAnswer {
  const exercise = getExercise(slug)!;
  const dates = new Map(state.sessions.map((s) => [s.id, s.date]));
  const history = buildHistory(state.sets.filter((s) => s.exercise_slug === slug), (id) => dates.get(id) ?? null);
  const units = state.preferences?.units ?? 'metric';

  if (history.length === 0) {
    return {
      text: `You have not logged ${exercise.name} yet, so I have no progress to show. Once you record a couple of sessions I can chart your estimated one-rep max and suggest when to add load.`,
      link: { label: `See how to do it`, to: `/exercises/${slug}` },
      missingData: true,
    };
  }

  const trend = strengthTrend(history, 6);
  const first = history[history.length - 1];
  const latest = history[0];
  const suggestion = suggestProgression(history, exercise, state.fitnessProfile?.experience ?? 'beginner', 10, 3);

  const change =
    first.best1RM && latest.best1RM && first !== latest
      ? round(latest.best1RM - first.best1RM, 1)
      : null;

  return {
    text: `${exercise.name}: ${pluralize(history.length, 'logged session')} since ${formatDate(first.date, 'medium')}.${
      change !== null ? ` Your estimated one-rep max has moved ${change >= 0 ? '+' : ''}${change} kg over that period.` : ''
    } ${suggestion.headline} — ${suggestion.detail}`,
    facts: [
      { label: 'Last session', value: `${relativeDay(latest.date)}` },
      { label: 'Top set', value: latest.topWeight !== null ? `${fmtWeight(latest.topWeight, units)} × ${latest.topReps}` : `${latest.sets[0]?.reps ?? '—'} reps` },
      { label: 'Best estimated 1RM', value: latest.best1RM ? fmtWeight(Math.max(...history.map((h) => h.best1RM ?? 0)), units) : '—' },
      ...(trend !== null ? [{ label: '6-week trend', value: `${trend > 0 ? '+' : ''}${trend}%` }] : []),
      ...(suggestion.suggestedWeightKg !== null ? [{ label: 'Suggested next load', value: fmtWeight(suggestion.suggestedWeightKg, units) }] : []),
    ],
    link: { label: `Open ${exercise.name}`, to: `/exercises/${slug}` },
  };
}

function answerRecovery(state: DataState): CoachAnswer {
  const log = state.recovery.find((r) => r.date === today());
  const readout = computeRecoveryScore(log ?? {}, state.sessions);
  if (!readout.hasInput) {
    return {
      text: 'You have not checked in today, so I cannot give you a readiness score. It takes about twenty seconds — sleep, energy, soreness and stress.',
      link: { label: 'Recovery check-in', to: '/recovery' },
      missingData: true,
    };
  }
  return {
    text: `Your readiness today is ${readout.score}/100 — ${readout.label.toLowerCase()}. ${readout.advice}`,
    facts: readout.contributions.map((c) => ({ label: c.label, value: `${Math.round(c.value)} / 100` })),
    link: { label: 'Open recovery', to: '/recovery' },
  };
}

function answerGoals(state: DataState): CoachAnswer {
  const live = state.goals.filter((g) => !g.archived);
  if (!live.length) {
    return {
      text: 'You do not have any goals set. A goal with a number and a date is what turns "get fitter" into something you can actually check.',
      link: { label: 'Create a goal', to: '/goals' },
      missingData: true,
    };
  }
  const behind = live.filter((g) => g.status === 'needs_attention');
  return {
    text: behind.length
      ? `You have ${pluralize(live.length, 'active goal')}. ${behind.length} ${behind.length === 1 ? 'is' : 'are'} behind pace: ${behind.map((g) => g.title).join(', ')}.`
      : `You have ${pluralize(live.length, 'active goal')} and none are behind pace.`,
    facts: live.map((g) => {
      const rate = requiredWeeklyRate(g);
      return {
        label: g.title,
        value: `${goalPercent(g)}%${rate !== null ? ` · ${rate > 0 ? '+' : ''}${rate} ${g.unit}/week needed` : ''}`,
      };
    }),
    link: { label: 'Open goals', to: '/goals' },
  };
}

function answerRecords(state: DataState): CoachAnswer {
  if (!state.records.length) {
    return {
      text: 'No personal records yet. They are detected automatically the first time you log a set — heaviest lift, estimated one-rep max, most reps, longest hold, furthest distance and fastest pace.',
      link: { label: 'Log a workout', to: '/workout' },
      missingData: true,
    };
  }
  const units = state.preferences?.units ?? 'metric';
  const recent = [...state.records].sort((a, b) => b.achieved_at.localeCompare(a.achieved_at)).slice(0, 6);
  return {
    text: `You have set ${pluralize(state.records.length, 'record')}. The most recent was ${
      getExercise(recent[0].exercise_slug)?.name ?? recent[0].exercise_slug
    } on ${formatDate(recent[0].achieved_at.slice(0, 10), 'medium')}.`,
    facts: recent.map((r) => ({
      label: getExercise(r.exercise_slug)?.name ?? r.exercise_slug,
      value: r.unit === 'kg' ? fmtWeight(r.value, units) : `${r.value} ${r.unit}`,
    })),
    link: { label: 'All records', to: '/records' },
  };
}

function answerFitScore(state: DataState): CoachAnswer {
  const program = state.programs.find((p) => p.active) ?? null;
  const score = computeFitScore({
    sessions: state.sessions, recovery: state.recovery, goals: state.goals,
    records: state.records, program, targetSessionsPerWeek: program?.days_per_week ?? 3,
  });
  const weakest = ([
    ['Consistency', score.consistency], ['Strength', score.strength], ['Cardio', score.cardio],
    ['Recovery', score.recovery], ['Goal progress', score.goals],
  ] as Array<[string, number]>).sort((a, b) => a[1] - b[1])[0];

  return {
    text: `Your FitScore is ${score.total} out of 1000. The component with most room is ${weakest[0].toLowerCase()} at ${weakest[1]}/100. FitScore is an engagement and progress indicator, not a health measurement.`,
    facts: [
      { label: 'Consistency', value: `${score.consistency} / 100` },
      { label: 'Strength', value: `${score.strength} / 100` },
      { label: 'Cardio', value: `${score.cardio} / 100` },
      { label: 'Recovery', value: `${score.recovery} / 100` },
      { label: 'Goal progress', value: `${score.goals} / 100` },
    ],
    link: { label: 'See the breakdown', to: '/progress' },
  };
}

function answerVolume(state: DataState): CoachAnswer {
  const units = state.preferences?.units ?? 'metric';
  const cutoff = addDays(today(), -28);
  const ids = new Set(state.sessions.filter((s) => s.date >= cutoff).map((s) => s.id));
  const sets = state.sets.filter((s) => ids.has(s.session_id) && s.completed && !s.is_warmup);
  const volume = sessionVolume(sets);

  if (volume === 0) {
    return {
      text: 'No loaded sets in the last four weeks, so there is no tonnage to report. Bodyweight work still counts as training — it just does not produce a volume figure.',
      missingData: true,
    };
  }
  return {
    text: `Over the last four weeks you have moved ${fmtWeight(volume, units, 0)} of total volume across ${pluralize(sets.length, 'working set')}.`,
    facts: [
      { label: 'Total volume (28 days)', value: fmtWeight(volume, units, 0) },
      { label: 'Working sets', value: String(sets.length) },
      { label: 'Average per session', value: fmtWeight(volume / Math.max(1, ids.size), units, 0) },
    ],
    link: { label: 'Volume chart', to: '/progress' },
  };
}

function answerBalance(state: DataState): CoachAnswer {
  const cutoff = addDays(today(), -7);
  const ids = new Set(state.sessions.filter((s) => s.status === 'completed' && s.date >= cutoff).map((s) => s.id));
  const counts = new Map<MuscleGroup, number>();
  for (const s of state.sets) {
    if (!ids.has(s.session_id) || !s.completed || s.is_warmup) continue;
    const e = getExercise(s.exercise_slug);
    e?.primary.forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1));
  }
  if (!counts.size) {
    return {
      text: 'Nothing logged in the last seven days, so I cannot tell you how your volume is distributed.',
      missingData: true,
    };
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const under = ranked.filter(([, n]) => n < 6).map(([m]) => MUSCLE_LABEL[m]);
  return {
    text: `In the last seven days, most of your hard sets went to ${ranked.slice(0, 3).map(([m]) => MUSCLE_LABEL[m]).join(', ')}.${
      under.length ? ` Getting less than six sets: ${under.slice(0, 5).join(', ')}.` : ' The distribution looks fairly even.'
    } Ten to twenty hard sets per muscle per week is the range most people do well in.`,
    facts: ranked.slice(0, 8).map(([m, n]) => ({ label: MUSCLE_LABEL[m], value: pluralize(n, 'set') })),
    link: { label: 'Weekly volume by muscle', to: '/program' },
  };
}

function answerNutrition(state: DataState): CoachAnswer {
  const targets = state.nutritionTargets;
  const logs = state.nutrition.filter((n) => n.date === today());
  if (!logs.length) {
    return {
      text: `Nothing logged today. Your current estimated targets are ${targets?.calories ?? '—'} kcal and ${targets?.protein_g ?? '—'} g of protein. These are estimates — if they do not match what you see in practice, change them.`,
      link: { label: 'Open nutrition', to: '/nutrition' },
      missingData: true,
    };
  }
  const totals = logs.reduce(
    (a, n) => ({
      calories: a.calories + n.calories * n.servings,
      protein: a.protein + n.protein_g * n.servings,
    }),
    { calories: 0, protein: 0 },
  );
  return {
    text: `So far today you have logged ${Math.round(totals.calories)} kcal and ${Math.round(totals.protein)} g of protein against estimated targets of ${targets?.calories ?? '—'} and ${targets?.protein_g ?? '—'}.`,
    facts: [
      { label: 'Calories', value: `${Math.round(totals.calories)} / ${targets?.calories ?? '—'}` },
      { label: 'Protein', value: `${Math.round(totals.protein)} g / ${targets?.protein_g ?? '—'} g` },
      { label: 'Meals logged', value: String(logs.length) },
    ],
    link: { label: 'Open nutrition', to: '/nutrition' },
  };
}

export { SESSION_KIND_META };
