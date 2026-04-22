import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLElement> {
  padded?: boolean;
  dark?: boolean;
}

export function Card({ padded = true, dark = false, className = '', children, ...rest }: CardProps) {
  const base = dark
    ? 'bg-surface-dark2 border border-border-dark text-text-invert'
    : 'bg-surface border border-border text-text-primary';
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
}

export function CardHeader({ title, subtitle, right, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <div className="text-base font-semibold">{title}</div>
        {subtitle && <div className="mt-0.5 text-sm text-text-secondary">{subtitle}</div>}
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
