import { hashHue, initials } from '../../lib/format';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: Size;
  className?: string;
}

const sizeMap: Record<Size, { box: string; text: string }> = {
  xs: { box: 'h-6 w-6', text: 'text-[10px]' },
  sm: { box: 'h-8 w-8', text: 'text-xs' },
  md: { box: 'h-10 w-10', text: 'text-sm' },
  lg: { box: 'h-14 w-14', text: 'text-lg' },
  xl: { box: 'h-20 w-20', text: 'text-2xl' },
};

export default function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const { box, text } = sizeMap[size];
  const label = initials(name);
  const hue = hashHue(name || 'user');
  if (src) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        className={`${box} rounded-full object-cover ring-1 ring-border ${className}`}
      />
    );
  }
  return (
    <span
      aria-label={name}
      className={`${box} ${text} inline-flex items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/5 ${className}`}
      style={{ background: `hsl(${hue} 55% 42%)` }}
    >
      {label}
    </span>
  );
}
