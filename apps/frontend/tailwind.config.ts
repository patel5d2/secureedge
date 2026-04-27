import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ink scale — warm neutrals used for text, borders, and dark surfaces.
        ink: {
          0:   '#FDFCF8',
          50:  '#F6F3EA',
          100: '#ECE7D6',
          200: '#D9D2BB',
          300: '#B9B09A',
          400: '#8B8370',
          500: '#5E5749',
          600: '#3D3930',
          700: '#2A2721',
          800: '#1A1814',
          900: '#0E0D0A',
        },
        // Signal green — primary action color, and the "access allowed" state.
        signal: {
          50:  '#E8F5E7',
          100: '#C8E8C5',
          300: '#7FCD7A',
          500: '#3CB13A',
          600: '#2A8F2A',
          700: '#1F6E20',
          900: '#0F3E11',
          DEFAULT: '#3CB13A',
        },
        // Primary = ink-900 (kept for backwards compat with existing className usage).
        primary: { DEFAULT: '#0E0D0A', 600: '#1A1814', 700: '#2A2721' },
        accent: '#E8A838',
        surface: { DEFAULT: '#FFFFFF', 2: '#FDFCF8', dark: '#0E0D0A', dark2: '#1A1814' },
        border: { DEFAULT: '#ECE7D6', dark: '#2A2721' },
        text: { primary: '#0E0D0A', secondary: '#5E5749', muted: '#8B8370', invert: '#FDFCF8' },
        success: '#3CB13A',
        warning: '#D89422',
        danger: '#D1432B',
        info: '#3570B0',
      },
      fontFamily: {
        // Body / UI face
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Editorial display face — used for headings + italicized "emphasized noun"
        display: ['"Instrument Serif"', '"Iowan Old Style"', 'Palatino', 'Georgia', 'serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(14, 13, 10, 0.06)',
        md: '0 4px 10px -2px rgba(14, 13, 10, 0.08), 0 2px 4px rgba(14, 13, 10, 0.04)',
        lg: '0 12px 24px -6px rgba(14, 13, 10, 0.12)',
        xl: '0 24px 48px -12px rgba(14, 13, 10, 0.18)',
      },
      borderRadius: { xs: '4px', sm: '6px', md: '10px', lg: '14px', xl: '20px', '2xl': '28px' },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
      animation: {
        'fade-in':  'fade-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        shimmer:    'shimmer 1.4s infinite',
        'pulse-dot':'pulse-dot 1.6s ease-in-out infinite',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
