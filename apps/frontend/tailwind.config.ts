import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0F1535', 600: '#1a2252', 700: '#252e63' },
        accent: '#F5A623',
        surface: { DEFAULT: '#FFFFFF', 2: '#F7F8FC', dark: '#0D1117', dark2: '#161B22' },
        border: { DEFAULT: '#E2E6F0', dark: '#30363D' },
        text: { primary: '#0F1535', secondary: '#6B7280', muted: '#9CA3AF', invert: '#F7F8FC' },
        success: '#10B981',
        warning: '#F5A623',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(15, 21, 53, 0.05)',
        md: '0 4px 8px -2px rgba(15, 21, 53, 0.08)',
        lg: '0 12px 24px -6px rgba(15, 21, 53, 0.12)',
        xl: '0 24px 48px -12px rgba(15, 21, 53, 0.18)',
      },
      borderRadius: { sm: '4px', md: '8px', lg: '12px', xl: '16px' },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'fade-in': 'fade-in 300ms ease-out',
        shimmer: 'shimmer 1.4s infinite',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
