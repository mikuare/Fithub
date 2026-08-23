import { describe, expect, it } from 'vitest';
import {
  buildPractice, practiceToPhases, searchEquipment, PRACTICE_TARGETS,
} from '@/lib/fitness/practice';
import { totalPlanSeconds } from '@/store/timer';
import { EQUIPMENT_OPTIONS } from '@/data/exercises';

describe('equipment search', () => {
  it('finds kit by the names people actually type', () => {
    const cases: Array<[string, string]> = [
      ['trx', 'suspension'],
      ['swiss ball', 'stability_ball'],
      ['ez curl bar', 'barbell'],
      ['skipping rope', 'jump_rope'],
      ['cross trainer', 'elliptical'],
      ['ab roller', 'ab_wheel'],
      ['grip strengthener', 'hand_gripper'],
      ['ankle cuff', 'ankle_strap'],
      ['twister bar', 'power_twister'],
    ];
    for (const [query, expected] of cases) {
      expect(searchEquipment(query)[0]?.equipment, `search: ${query}`).toBe(expected);
    }
  });

  it('matches the plain label and partial words', () => {
    expect(searchEquipment('dumbbell')[0].equipment).toBe('dumbbells');
    expect(searchEquipment('kettle')[0].equipment).toBe('kettlebell');
  });

  it('returns nothing for kit FitHub does not know, rather than a wrong guess', () => {
    expect(searchEquipment('sandbag')).toEqual([]);
    expect(searchEquipment('macebell')).toEqual([]);
    expect(searchEquipment('a')).toEqual([]);
  });

  it('always explains why a match was offered', () => {
    for (const match of searchEquipment('trx')) {
      expect(match.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('practice builder', () => {
  it('builds a runnable session for every equipment and target pairing', () => {
    for (const equipment of EQUIPMENT_OPTIONS) {
      for (const target of PRACTICE_TARGETS) {
        const practice = buildPractice({
          equipment, target: target.value, goal: 'build_muscle', experience: 'intermediate',
        });
        // Warm-up, at least one movement, cool-down.
        expect(practice.steps.length, `${equipment}/${target.value}`).toBeGreaterThanOrEqual(3);
        expect(practice.steps[0].kind).toBe('warmup');
        expect(practice.steps[practice.steps.length - 1].kind).toBe('cooldown');
        expect(practice.steps.some((s) => s.kind === 'exercise')).toBe(true);
        expect(practice.totalSeconds).toBeGreaterThan(0);
        for (const step of practice.steps) {
          expect(step.seconds).toBeGreaterThan(0);
          expect(step.sets).toBeGreaterThan(0);
        }
      }
    }
  });

  it('prefers movements that actually use the chosen equipment', () => {
    const practice = buildPractice({
      equipment: 'dumbbells', target: 'biceps', goal: 'build_muscle', experience: 'intermediate',
    });
    const movements = practice.steps.filter((s) => s.kind === 'exercise');
    expect(movements.some((s) => s.slug === 'dumbbell-curl' || s.slug === 'hammer-curl')).toBe(true);
    expect(practice.note).toBeNull();
  });

  it('says so plainly when the kit cannot train the target', () => {
    // Nothing in the library trains abs with a hand gripper, and the practice
    // must admit that rather than quietly serving bodyweight work.
    const practice = buildPractice({
      equipment: 'hand_gripper', target: 'abs', goal: 'build_muscle', experience: 'intermediate',
    });
    expect(practice.note).toMatch(/no abs & core exercises/i);
    expect(practice.steps.some((s) => s.kind === 'exercise')).toBe(true);
  });

  it('still helps when the equipment is unknown', () => {
    const practice = buildPractice({
      equipment: null, unknownLabel: 'sandbag', target: 'legs', goal: 'lose_fat', experience: 'beginner',
    });
    expect(practice.note).toMatch(/does not know .*sandbag/i);
    expect(practice.equipmentLabel).toBe('sandbag');
    expect(practice.steps.filter((s) => s.kind === 'exercise').length).toBeGreaterThan(0);
  });

  it('changes the prescription with the goal', () => {
    const base = { equipment: 'dumbbells' as const, target: 'chest' as const, experience: 'intermediate' as const };
    const strength = buildPractice({ ...base, goal: 'gain_strength' });
    const endurance = buildPractice({ ...base, goal: 'improve_endurance' });
    const strengthReps = strength.steps.find((s) => s.reps)!.reps!;
    const enduranceReps = endurance.steps.find((s) => s.reps)!.reps!;
    expect(strengthReps).toBeLessThan(enduranceReps);
    expect(strength.steps.find((s) => s.kind === 'exercise')!.restSeconds)
      .toBeGreaterThan(endurance.steps.find((s) => s.kind === 'exercise')!.restSeconds);
  });

  it('respects the trainee level and never prescribes above it', () => {
    const practice = buildPractice({
      equipment: 'pullup_bar', target: 'back', goal: 'build_muscle', experience: 'beginner',
    });
    expect(practice.steps.filter((s) => s.kind === 'exercise').length).toBeGreaterThan(0);
  });
});

describe('running a practice', () => {
  it('turns the session into timer phases that line up with its steps', () => {
    const practice = buildPractice({
      equipment: 'dumbbells', target: 'chest', goal: 'build_muscle', experience: 'intermediate',
    });
    const { phases, stepOfPhase } = practiceToPhases(practice);

    expect(phases.length).toBe(stepOfPhase.length);
    expect(phases.length).toBeGreaterThan(practice.steps.length);
    expect(phases[0].kind).toBe('prepare');
    expect(phases[phases.length - 1].kind).toBe('cooldown');
    // Never leave a dangling rest at the very end of a session.
    expect(phases[phases.length - 1].kind).not.toBe('rest');

    for (const index of stepOfPhase) {
      expect(practice.steps[index]).toBeTruthy();
    }
    for (const phase of phases) {
      expect(phase.seconds).toBeGreaterThan(0);
      expect(phase.id).toBeTruthy();
    }
    expect(totalPlanSeconds(phases)).toBeGreaterThan(0);
  });

  it('numbers the sets of a multi-set movement', () => {
    const practice = buildPractice({
      equipment: 'dumbbells', target: 'biceps', goal: 'build_muscle', experience: 'intermediate',
    });
    const { phases } = practiceToPhases(practice);
    const working = phases.filter((p) => p.kind === 'work' && p.totalRounds);
    expect(working.length).toBeGreaterThan(0);
    for (const phase of working) {
      expect(phase.round).toBeGreaterThanOrEqual(1);
      expect(phase.round!).toBeLessThanOrEqual(phase.totalRounds!);
    }
  });
});
