import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full bg-surface-2 border border-line rounded-xl px-3.5 text-ink placeholder:text-ink-3/70 ' +
  'transition-colors focus:border-brand/60 focus:bg-surface disabled:opacity-60';

export function Label({ htmlFor, children, hint, required }: { htmlFor?: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-2 mb-1.5">
      {children}
      {required && <span className="text-danger ml-0.5" aria-hidden>*</span>}
      {hint && <span className="block text-xs text-ink-3 font-normal mt-0.5">{hint}</span>}
    </label>
  );
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-xs text-danger flex items-start gap-1">
      <span aria-hidden>⚠</span>
      <span>{children}</span>
    </p>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  hint?: string;
  error?: string;
  suffix?: ReactNode;
  prefix?: ReactNode;
  inputSize?: 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, suffix, prefix, className, inputSize = 'md', id, required, ...rest }, ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cn('min-w-0', className)}>
      {label && <Label htmlFor={inputId} hint={hint} required={required}>{label}</Label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3.5 text-ink-3 text-sm pointer-events-none">{prefix}</span>}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            base,
            inputSize === 'lg' ? 'h-13 py-3 text-base' : 'h-11 text-sm',
            Boolean(prefix) && 'pl-9',
            Boolean(suffix) && 'pr-14',
            error && 'border-danger focus:border-danger',
          )}
          {...rest}
        />
        {suffix && <span className="absolute right-3.5 text-ink-3 text-sm pointer-events-none">{suffix}</span>}
      </div>
      <FieldError id={`${inputId}-err`}>{error}</FieldError>
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, className, id, required, ...rest }, ref,
) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className={cn('min-w-0', className)}>
      {label && <Label htmlFor={selectId} hint={hint} required={required}>{label}</Label>}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(base, 'h-11 text-sm appearance-none pr-9 cursor-pointer', error && 'border-danger')}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, required, ...rest }, ref,
) {
  const auto = useId();
  const areaId = id ?? auto;
  return (
    <div className={cn('min-w-0', className)}>
      {label && <Label htmlFor={areaId} hint={hint} required={required}>{label}</Label>}
      <textarea
        ref={ref}
        id={areaId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(base, 'py-3 text-sm min-h-[92px] resize-y leading-relaxed', error && 'border-danger')}
        {...rest}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
});

export function Toggle({
  checked, onChange, label, description, disabled, id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  const auto = useId();
  const toggleId = id ?? auto;
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={toggleId} className="text-sm font-medium text-ink cursor-pointer">{label}</label>
        {description && <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200 disabled:opacity-50',
          checked ? 'bg-brand' : 'bg-surface-3 border border-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function Checkbox({
  checked, onChange, label, description, disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4.5 w-4.5 shrink-0 rounded border-line-strong bg-surface-2 accent-[rgb(var(--c-brand))] cursor-pointer"
        style={{ width: 18, height: 18 }}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm text-ink cursor-pointer leading-snug">{label}</label>
        {description && <p className="text-xs text-ink-3 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

/** Large tappable option card used throughout onboarding. */
export function ChoiceCard({
  selected, onSelect, title, description, icon, badge, disabled, multi,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'group relative w-full text-left rounded-2xl border p-4 transition-all duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
        selected
          ? 'border-brand bg-brand-soft/60 shadow-[0_0_0_1px_rgb(var(--c-brand)/.5)]'
          : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
      )}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <span className={cn('shrink-0 mt-0.5 transition-colors', selected ? 'text-brand-text' : 'text-ink-3 group-hover:text-ink-2')}>
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('font-semibold text-sm', selected ? 'text-ink' : 'text-ink')}>{title}</span>
            {badge}
          </span>
          {description && <span className="block text-xs text-ink-3 mt-1 leading-relaxed">{description}</span>}
        </span>
        <span
          className={cn(
            'shrink-0 mt-0.5 grid place-items-center border transition-all',
            multi ? 'h-5 w-5 rounded-md' : 'h-5 w-5 rounded-full',
            selected ? 'bg-brand border-brand' : 'border-line-strong bg-surface-2',
          )}
          aria-hidden
        >
          {selected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-brand-contrast))" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </span>
      </div>
    </button>
  );
}

/** Compact 1–5 scale used by recovery check-ins and workout feedback. */
export function ScaleInput({
  value, onChange, min = 1, max = 5, labels, name,
}: {
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  labels?: [string, string];
  name: string;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div>
      <div className="flex gap-2" role="radiogroup" aria-label={name}>
        {options.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${name}: ${n} of ${max}`}
            onClick={() => onChange(n)}
            className={cn(
              'flex-1 h-12 rounded-xl border font-semibold tabular transition-all duration-150 active:scale-95',
              value === n
                ? 'bg-brand text-brand-contrast border-brand'
                : 'bg-surface-2 text-ink-2 border-line hover:border-line-strong hover:text-ink',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {labels && (
        <div className="flex justify-between mt-1.5 text-2xs text-ink-3">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}
