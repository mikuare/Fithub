/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('--c-bg'),
        'bg-elev': c('--c-bg-elev'),
        surface: c('--c-surface'),
        'surface-2': c('--c-surface-2'),
        'surface-3': c('--c-surface-3'),
        line: c('--c-line'),
        'line-strong': c('--c-line-strong'),
        ink: c('--c-ink'),
        'ink-2': c('--c-ink-2'),
        'ink-3': c('--c-ink-3'),
        brand: c('--c-brand'),
        'brand-soft': c('--c-brand-soft'),
        'brand-text': c('--c-brand-text'),
        'brand-contrast': c('--c-brand-contrast'),
        accent: c('--c-accent'),
        'accent-soft': c('--c-accent-soft'),
        'accent-text': c('--c-accent-text'),
        success: c('--c-success'),
        'success-soft': c('--c-success-soft'),
        warn: c('--c-warn'),
        'warn-soft': c('--c-warn-soft'),
        danger: c('--c-danger'),
        'danger-soft': c('--c-danger-soft'),
        info: c('--c-info'),
        'info-soft': c('--c-info-soft'),
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.05), 0 8px 24px -12px rgb(0 0 0 / 0.25)',
        lift: '0 2px 4px rgb(0 0 0 / 0.06), 0 18px 40px -18px rgb(0 0 0 / 0.45)',
        glow: '0 0 0 1px rgb(var(--c-brand) / 0.35), 0 8px 32px -8px rgb(var(--c-brand) / 0.35)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.25)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.14)' },
          '100%': { transform: 'scale(1)' },
        },
        'confetti-fall': {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(105vh) rotate(720deg)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out both',
        'fade-up': 'fade-up .32s cubic-bezier(.2,.8,.2,1) both',
        'scale-in': 'scale-in .18s cubic-bezier(.2,.8,.2,1) both',
        'slide-up': 'slide-up .28s cubic-bezier(.2,.8,.2,1) both',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(.2,.8,.2,1) infinite',
        pop: 'pop .4s cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
};
