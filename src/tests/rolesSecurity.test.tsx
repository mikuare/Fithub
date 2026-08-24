import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignUp from '@/pages/auth/SignUp';
import { useAuth } from '@/store/auth';
import { ROLE_RANK } from '@/types';

/* ============================================================
   Role escalation
   A sign-up form must never be able to hand out access to other
   people's data. These lock in both halves of that: the picker
   does not offer privileged roles, and the database clamps what
   is sent regardless of what the client asks for.
   ============================================================ */

const rls = readFileSync('supabase/migrations/0009_tenancy_fixes.sql', 'utf8');

describe('sign-up cannot grant privileged roles', () => {
  beforeEach(() => {
    cleanup();
    useAuth.setState({ status: 'anon', profile: null, error: null, busy: false });
  });

  it('offers only roles that carry no access to anyone else', () => {
    render(<MemoryRouter><SignUp /></MemoryRouter>);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/Gym Member/i);
    for (const forbidden of ['Super Administrator', 'Gym Manager', 'Gym Staff']) {
      expect(text, `sign-up must not offer "${forbidden}"`).not.toMatch(new RegExp(forbidden, 'i'));
    }
  });

  it('points a gym owner at the flow that legitimately promotes them', () => {
    render(<MemoryRouter><SignUp /></MemoryRouter>);
    expect(screen.getByText(/Running a gym\?/i)).toBeTruthy();
  });

  it('keeps trainer the ceiling for self-registration', () => {
    // Anything above trainer can read other people's data, so it has to be
    // granted rather than chosen. The database enforces the same bound.
    expect(ROLE_RANK.trainer).toBeLessThan(ROLE_RANK.staff);
    expect(rls).toMatch(/clamp_signup_role/);
    expect(rls).toMatch(/role_rank\(new\.role\)\s*>\s*public\.role_rank\('trainer'\)/);
  });
});

describe('the database is the one that enforces it', () => {
  it('guards role changes on update, not just at sign-up', () => {
    expect(rls).toMatch(/create trigger profiles_guard_role\s+before update of role/);
    expect(rls).toMatch(/Only an administrator can change an account role/);
  });

  it('promotes a gym creator server-side rather than trusting the client', () => {
    expect(rls).toMatch(/create trigger gyms_claim\s+after insert on public\.gyms/);
    expect(rls).toMatch(/claim_new_gym/);
  });

  it('lets any signed-in account create a gym it owns, without pre-existing rights', () => {
    expect(rls).toMatch(/create policy gyms_create_own[\s\S]*?with check \(created_by = auth\.uid\(\)\)/);
  });

  it('breaks the leaderboard policy out of its own table to stop the recursion', () => {
    expect(rls).toMatch(/create or replace function public\.in_challenge/);
    expect(rls).toMatch(/using \(on_leaderboard and public\.in_challenge\(auth\.uid\(\), challenge_id\)\)/);
    // The recursive form must be gone: the policy may not select from the
    // table it is guarding.
    const policy = /create policy challenge_members_leaderboard[\s\S]*?;/.exec(rls)![0];
    expect(policy).not.toMatch(/from public\.challenge_members/);
  });
});
