import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  hint?: string;
  containerClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    leftIcon,
    rightIcon,
    hint,
    id,
    type = 'text',
    className = '',
    containerClassName = '',
    disabled,
    ...rest
  },
  ref
) {
  const uid = useId();
  const inputId = id || uid;
  const hasError = !!error;
  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div
        className={`relative flex items-center rounded-md border bg-white transition-colors ${
          hasError
            ? 'border-danger focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20'
            : 'border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        {leftIcon && <span className="pl-3 text-text-muted">{leftIcon}</span>}
        <input
          id={inputId}
          ref={ref}
          type={type}
          disabled={disabled}
          className={`w-full bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none ${leftIcon ? 'pl-2' : ''} ${rightIcon ? 'pr-2' : ''} ${className}`}
          {...rest}
        />
        {rightIcon && <span className="pr-3 text-text-muted">{rightIcon}</span>}
      </div>
      {hasError ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-text-muted">{hint}</span>
      ) : null}
    </div>
  );
});

export default Input;
