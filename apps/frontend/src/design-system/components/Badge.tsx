import type { HTMLAttributes, ReactNode } from 'react';

type BadgeVariant =
  | 'success' // signal-green — "allowed"
  | 'warning' // amber posture-required
  | 'danger'  // warm red deny
  | 'info'    // blue, read-only session
  | 'gray'    // neutral
  | 'accent'  // amber highlight
  | 'primary' // ink
  | 'signal'; // alias for success where the semantic is explicit

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-signal-50 text-signal-700 ring-1 ring-inset ring-signal-100',
  signal:  'bg-signal-50 text-signal-700 ring-1 ring-inset ring-signal-100',
  warning: 'bg-[#FDF2DC] text-[#8C5A0D] ring-1 ring-inset ring-[#F6D880]',
  danger:  'bg-[#FBEAE7] text-[#8B2613] ring-1 ring-inset ring-[#F6C7BD]',
  info:    'bg-[#E4EEF8] text-[#1F4770] ring-1 ring-inset ring-[#BFD4EA]',
  gray:    'bg-ink-50 text-ink-500 ring-1 ring-inset ring-ink-100',
  accent:  'bg-[#FDF5E2] text-[#9E6A12] ring-1 ring-inset ring-[#F6D880]',
  primary: 'bg-ink-900/5 text-ink-900 ring-1 ring-inset ring-ink-200',
};

const dotStyles: Record<BadgeVariant, string> = {
  success: 'bg-signal-500',
  signal:  'bg-signal-500',
  warning: 'bg-[#D89422]',
  danger:  'bg-danger',
  info:    'bg-info',
  gray:    'bg-ink-400',
  accent:  'bg-accent',
  primary: 'bg-ink-900',
};

export default function Badge({
  variant = 'gray',
  dot = false,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[variant]}`} />}
      {children}
    </span>
  );
}
