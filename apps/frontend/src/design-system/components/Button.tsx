import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Spinner from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent' | 'signal';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * Variant guide:
 *   primary — default ink-on-paper. Use for the main CTA on most screens.
 *   signal  — signal-green. Reserved for "confirm access / publish / allow" moments.
 *   secondary — outlined ghost on paper.
 *   ghost   — chromeless, text only.
 *   danger  — warm red, destructive.
 *   accent  — amber, rare highlights.
 */
const variantStyles: Record<Variant, string> = {
  primary:   'bg-ink-900 text-ink-0 hover:bg-ink-800 focus-visible:ring-ink-900/30',
  signal:    'bg-signal-500 text-white hover:bg-signal-600 focus-visible:ring-signal-500/40',
  secondary: 'bg-transparent text-ink-700 border border-ink-100 hover:bg-ink-50 hover:border-ink-200 focus-visible:ring-ink-900/20',
  danger:    'bg-danger text-white hover:brightness-95 focus-visible:ring-danger/40',
  ghost:     'text-ink-500 hover:bg-ink-50 hover:text-ink-900 focus-visible:ring-ink-900/15',
  accent:    'bg-accent text-ink-900 hover:brightness-95 focus-visible:ring-accent/50',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-sm',
  md: 'h-9 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-base gap-2 rounded-md',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    disabled,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-medium transition-colors duration-200 ease-out-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-60 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 18 : 14} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export default Button;
