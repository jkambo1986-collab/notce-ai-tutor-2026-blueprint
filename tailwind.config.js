/**
 * Tailwind config — production build (replaces the dev-only Play CDN).
 * Mirrors the previous inline CDN config: the "Clinical Trust" design tokens,
 * soft layered shadows, extra radii, and the custom keyframes/animations.
 * Class scanning covers every source file with classNames; all classes in the
 * codebase are literal strings (no runtime-built `bg-${x}` names), so no safelist
 * is needed.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAF7',
        ink: '#0F172A',
        brand: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf',
          500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a',
          DEFAULT: '#0d9488',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.05)',
        'soft-lg': '0 4px 14px rgba(15,23,42,.06), 0 12px 36px rgba(15,23,42,.08)',
        card: '0 1px 3px rgba(15,23,42,.04), 0 10px 30px -10px rgba(15,23,42,.12)',
        'card-hover': '0 10px 28px -8px rgba(13,148,136,.22), 0 22px 56px -16px rgba(15,23,42,.16)',
        'glow-teal': '0 0 0 1px rgba(13,148,136,.10), 0 10px 34px -6px rgba(13,148,136,.40)',
        'inner-soft': 'inset 0 1px 2px rgba(15,23,42,.05)',
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.5rem' },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-in-up': { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in-down': { '0%': { opacity: '0', transform: 'translateY(-14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-7px)' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.55' } },
        'spin-slow': { '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in .4s ease-out both',
        'fade-in-up': 'fade-in-up .55s cubic-bezier(.16,1,.3,1) both',
        'fade-in-down': 'fade-in-down .5s cubic-bezier(.16,1,.3,1) both',
        'scale-in': 'scale-in .35s cubic-bezier(.16,1,.3,1) both',
        shimmer: 'shimmer 1.6s infinite',
        float: 'float 5s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 1.1s linear infinite',
      },
    },
  },
  plugins: [],
};
