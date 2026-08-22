import { describe, expect, it } from 'vitest';
import { hasIcon } from '@/components/Icon';
import { NAV } from '@/components/layout/nav';
import { ACHIEVEMENTS } from '@/data/achievements';
import { HABIT_TEMPLATES } from '@/data/habits';
import { seedChallenges } from '@/data/challenges';
import { SESSION_KIND_META } from '@/lib/fitness/program';
import { GOAL_STATUS_META } from '@/lib/fitness/goals';

/**
 * Icons referenced as strings bypass the type system, so this guards against a
 * name silently falling back to a generic circle in the UI.
 */
describe('icon registry', () => {
  it('resolves every navigation icon', () => {
    for (const section of NAV) {
      for (const item of section.items) {
        expect(hasIcon(item.icon), `nav icon "${item.icon}"`).toBe(true);
      }
    }
  });

  it('resolves every achievement icon', () => {
    for (const a of ACHIEVEMENTS) {
      expect(hasIcon(a.icon), `achievement icon "${a.icon}"`).toBe(true);
    }
  });

  it('resolves every habit icon', () => {
    for (const h of HABIT_TEMPLATES) {
      expect(hasIcon(h.icon), `habit icon "${h.icon}"`).toBe(true);
    }
  });

  it('resolves every challenge icon', () => {
    for (const c of seedChallenges(null)) {
      expect(hasIcon(c.icon), `challenge icon "${c.icon}"`).toBe(true);
    }
  });

  it('resolves every session-kind icon', () => {
    for (const [kind, meta] of Object.entries(SESSION_KIND_META)) {
      expect(hasIcon(meta.icon), `session kind "${kind}" icon "${meta.icon}"`).toBe(true);
    }
  });

  it('resolves every goal-status icon', () => {
    for (const [status, meta] of Object.entries(GOAL_STATUS_META)) {
      expect(hasIcon(meta.icon), `goal status "${status}" icon "${meta.icon}"`).toBe(true);
    }
  });
});
