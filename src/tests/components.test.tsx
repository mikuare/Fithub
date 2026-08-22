import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Input, Select, Toggle, ScaleInput, ChoiceCard } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { MuscleMap } from '@/components/MuscleMap';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/layout/AppShell';
import { profileImageProblem } from '@/lib/profileImage';

let reactErrors: string[] = [];
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  reactErrors = [];
  error = vi.spyOn(console, 'error').mockImplementation((...args) => {
    reactErrors.push(String(args[0]));
  });
});
afterEach(() => { cleanup(); error.mockRestore(); });

describe('form fields', () => {
  it('associates a label with its input and exposes the error to assistive tech', () => {
    render(<Input label="Weight" error="Enter a number" defaultValue="" />);
    const input = screen.getByLabelText(/Weight/);
    expect(input).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby')!;
    expect(document.getElementById(describedBy)?.textContent).toMatch(/Enter a number/);
    // An error inside another paragraph would be invalid DOM nesting.
    expect(reactErrors).toEqual([]);
  });

  it('marks a required field and keeps the hint linked', () => {
    render(<Input label="Height" hint="Optional" required defaultValue="" />);
    expect(screen.getByLabelText(/Height/).hasAttribute('required')).toBe(true);
    expect(reactErrors).toEqual([]);
  });

  it('renders a select with its options', () => {
    render(<Select label="Units" options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]} defaultValue="metric" />);
    expect(screen.getByLabelText(/Units/)).toBeTruthy();
    expect(screen.getByText('Imperial')).toBeTruthy();
    expect(reactErrors).toEqual([]);
  });

  it('exposes a toggle as a switch and reports its state', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Timer sounds" />);
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('exposes the 1-5 scale as a radio group', () => {
    const onChange = vi.fn();
    render(<ScaleInput name="Energy" value={3} onChange={onChange} labels={['Low', 'High']} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(radios[2].getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radios[4]);
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('exposes single and multi choice cards with the right role', () => {
    const { rerender } = render(<ChoiceCard selected onSelect={() => {}} title="Beginner" />);
    expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe('true');
    rerender(<ChoiceCard multi selected={false} onSelect={() => {}} title="Dumbbells" />);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false');
  });
});

describe('progress indicators', () => {
  it('reports the correct ARIA values and clamps out-of-range input', () => {
    const { rerender } = render(<ProgressBar value={30} max={60} label="Weekly target" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    rerender(<ProgressBar value={999} max={60} label="Weekly target" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    rerender(<ProgressBar value={-5} max={60} label="Weekly target" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('survives a zero maximum without producing NaN', () => {
    // A zero max is degenerate; the contract is only that it stays a valid
    // 0-100 number rather than rendering NaN into the DOM.
    render(<ProgressBar value={5} max={0} label="Empty" />);
    const now = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
    expect(Number.isNaN(now)).toBe(false);
    expect(now).toBeGreaterThanOrEqual(0);
    expect(now).toBeLessThanOrEqual(100);
  });

  it('labels the ring for screen readers', () => {
    render(<ProgressRing value={82} label="Recovery 82 of 100" />);
    expect(screen.getByLabelText('Recovery 82 of 100')).toBeTruthy();
  });
});

describe('MuscleMap', () => {
  it('renders both views with an accessible description', () => {
    render(<MuscleMap primary={['chest']} secondary={['triceps']} view="both" />);
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('aria-label')).toMatch(/chest/);
    expect(reactErrors).toEqual([]);
  });

  it('expands full_body into every muscle without crashing', () => {
    expect(() => render(<MuscleMap primary={['full_body']} view="front" />)).not.toThrow();
    expect(reactErrors).toEqual([]);
  });

  it('renders with no muscles at all', () => {
    expect(() => render(<MuscleMap />)).not.toThrow();
  });
});

describe('Modal', () => {
  it('is a labelled dialog and closes on Escape', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Delete goal"><p>Body</p></Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Delete goal')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="Hidden"><p>Body</p></Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Button', () => {
  it('renders a router link when given a destination', () => {
    render(<MemoryRouter><Button to="/goals">Goals</Button></MemoryRouter>);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/goals');
  });

  it('disables itself and reports busy while loading', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});

describe('profile photos', () => {
  it('uses initials until a photo is uploaded, then renders the saved image', () => {
    const { container, rerender } = render(<Avatar profile={{ full_name: 'Alex Rivera', avatar_color: '#B9F227' }} />);
    expect(container.textContent).toBe('AR');
    expect(container.querySelector('img')).toBeNull();

    rerender(<Avatar profile={{
      full_name: 'Alex Rivera', avatar_color: '#B9F227', avatar_data_url: 'data:image/jpeg;base64,dGVzdA==',
    }} />);
    expect(container.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/jpeg/);
  });

  it('rejects non-images and oversized phone photos before decoding', () => {
    expect(profileImageProblem({ type: 'application/pdf', size: 100 })).toMatch(/image file/i);
    expect(profileImageProblem({ type: 'image/jpeg', size: 25_000_001 })).toMatch(/25 MB/i);
    expect(profileImageProblem({ type: 'image/png', size: 500_000 })).toBeNull();
  });

  it('accepts JPG files from phone pickers even when their MIME type is missing or generic', () => {
    expect(profileImageProblem({ name: 'portrait.jpg', type: '', size: 2_000_000 })).toBeNull();
    expect(profileImageProblem({ name: 'IMG_2048.JPEG', type: 'application/octet-stream', size: 8_000_000 })).toBeNull();
    expect(profileImageProblem({ name: 'not-a-photo.pdf', type: '', size: 100 })).toMatch(/JPG/i);
  });
});
