import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLElement> {
  padded?: boolean;
  dark?: boolean;
}

/**
 * Cards — warm paper with a hairline border. Radius is lg (14px).
 * Hover behavior is the caller's responsibility — when used as a clickable tile,
 * add `transition-all duration-220 ease-out-soft hover:-translate-y-px hover:shadow-md hover:border-ink-200`.
 */
export function Card({ padded = true, dark = false, className = '', children, ...rest }: CardProps) {
  const base = dark
    ? 'bg-surface-dark2 border border-ink-700 text-text-invert'
    : 'bg-white border border-ink-100 text-text-primary';
  return (
    <section
      className={`rounded-lg shadow-sm ${base} ${padded ? 'p-6' : ''} ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
  display?: boolean; // render title in Instrument Serif (editorial headings)
}

export function CardHeader({ title, subtitle, right, className = '', display = false }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <div
          className={
            display
              ? 'font-display text-2xl leading-tight text-ink-900'
              : 'text-base font-semibold text-ink-900'
          }
        >
          {title}
        </div>
        {subtitle && <div className="mt-1 text-sm text-text-secondary">{subtitle}</div>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={className}>{children}</div>;
}

export default Card;
