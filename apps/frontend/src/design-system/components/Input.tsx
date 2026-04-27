import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  hint?: string;
  helperText?: string;
  containerClassName?: string;
}

/**
 * Inputs pick up the signal-green focus ring (our primary action color).
 * Label is a small uppercase eyebrow; keep labels sentence case otherwise.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    leftIcon,
    rightIcon,
    hint,
    helperText,
    id,
    type = 'text',
    className = '',
    containerClassName = '',
    disabled,
    ...rest
  },
  ref
) {
  const hintText = hint || helperText;
  const uid = useId();
  const inputId = id || uid;
  const hasError = !!error;
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-secondary"
        >
          {label}
        </label>
      )}
      <div
        className={`relative flex h-10 items-center rounded-md border bg-white transition-colors duration-200 ease-out-soft ${
          hasError
            ? 'border-danger focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20'
            : 'border-ink-100 focus-within:border-signal-500 focus-within:ring-2 focus-within:ring-signal-500/30'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        {leftIcon && <span className="pl-3 text-text-muted">{leftIcon}</span>}
        <input
          id={inputId}
          ref={ref}
          type={type}
          disabled={disabled}
          className={`w-full bg-transparent px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none ${leftIcon ? 'pl-2' : ''} ${rightIcon ? 'pr-2' : ''} ${className}`}
          {...rest}
        />
        {rightIcon && <span className="pr-3 text-text-muted">{rightIcon}</span>}
      </div>
      {hasError ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hintText ? (
        <span className="text-xs text-text-muted">{hintText}</span>
      ) : null}
    </div>
  );
});

export default Input;
