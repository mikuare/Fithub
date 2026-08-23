import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Practice from '@/pages/Practice';
import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { emptyFitnessProfile } from '@/lib/defaults';

/**
 * The builder from the outside: pick kit, pick a target, get steps, run them.
 * Covers the "my equipment is not listed" path, which is the one that has to
 * stay honest rather than guessing.
 */

const USER = 'user-practice';
let reactErrors: string[] = [];
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  reactErrors = [];
  error = vi.spyOn(console, 'error').mockImplementation((...args) => { reactErrors.push(String(args[0])); });

  const fitnessProfile = emptyFitnessProfile(USER, 'Alex');
  fitnessProfile.equipment = ['bodyweight', 'dumbbells'];
  fitnessProfile.experience = 'intermediate';
  useData.setState({ fitnessProfile });
  useTimer.getState().stop();
});

afterEach(() => { cleanup(); error.mockRestore(); useTimer.getState().stop(); });

function renderPage() {
  return render(<MemoryRouter><Practice /></MemoryRouter>);
}

describe('practice builder page', () => {
  it('waits for a choice before inventing a session', () => {
    renderPage();
    expect(screen.getByText(/Pick your equipment to see the steps/i)).toBeTruthy();
    expect(reactErrors).toEqual([]);
  });

  it('builds steps for the chosen kit and target', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: /Dumbbells/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Biceps$/ }));

    expect(screen.getByText(/Your practice/i)).toBeTruthy();
    expect(document.body.textContent).toMatch(/Curl/i);
    expect(document.body.textContent).toMatch(/Warm-up/i);
    expect(document.body.textContent).toMatch(/Cool down/i);
    expect(document.body.textContent).toMatch(/about \d+ minutes/i);
    expect(reactErrors).toEqual([]);
  });

  it('shows the numbered how-to for a movement on demand', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: /Dumbbells/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Chest$/ }));

    const toggles = screen.getAllByRole('button', { name: /Show the \d+ steps/i });
    expect(toggles.length).toBeGreaterThan(0);
    fireEvent.click(toggles[0]);
    expect(screen.getAllByRole('button', { name: /Hide the steps/i }).length).toBe(1);
    expect(reactErrors).toEqual([]);
  });

  it('marks the equipment the user already owns', () => {
    renderPage();
    const dumbbells = screen.getByRole('radio', { name: /Dumbbells/ });
    expect(within(dumbbells).getByText(/Yours/i)).toBeTruthy();
  });

  it('finds kit that is not on the list by its common name', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Other — search for it/i }));
    fireEvent.change(screen.getByLabelText(/What do you have\?/i), { target: { value: 'trx' } });

    const suggestion = screen.getByRole('button', { name: /Suspension trainer/i });
    fireEvent.click(suggestion);
    expect(screen.getByText(/Your practice/i)).toBeTruthy();
    expect(document.body.textContent).toMatch(/Suspension trainer/);
  });

  it('admits when it does not know the equipment, and still helps', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Other — search for it/i }));
    fireEvent.change(screen.getByLabelText(/What do you have\?/i), { target: { value: 'sandbag' } });

    expect(screen.getByText(/does not know/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Build me a practice anyway/i }));

    expect(screen.getByText(/Your practice/i)).toBeTruthy();
    expect(document.body.textContent).toMatch(/does not know .*sandbag/i);
    expect(reactErrors).toEqual([]);
  });

  it('hands the session to the timer, phase by phase', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: /Dumbbells/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Chest$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Start with timer/i }));

    const timer = useTimer.getState();
    expect(timer.plan.length).toBeGreaterThan(3);
    expect(timer.running).toBe(true);
    // The countdown names the movement, not just "work".
    expect(screen.getAllByRole('button', { name: /Pause/i }).length).toBe(1);
    expect(document.body.textContent).toMatch(/Warm-up/i);
    expect(reactErrors).toEqual([]);
  });
});
