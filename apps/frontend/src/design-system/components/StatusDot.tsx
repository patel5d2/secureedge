type Status = 'online' | 'offline' | 'warning' | 'danger' | 'idle';

interface StatusDotProps {
  status: Status;
  label?: string;
  pulse?: boolean;
  className?: string;
}

const colorMap: Record<Status, string> = {
  online: 'bg-success',
  offline: 'bg-text-muted',
  warning: 'bg-warning',
  danger: 'bg-danger',
  idle: 'bg-info',
};

export default function StatusDot({ status, label, pulse = false, className = '' }: StatusDotProps) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs ${className}`}>
      <span className="relative inline-flex h-2 w-2">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${colorMap[status]} opacity-60 animate-ping`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${colorMap[status]}`} />
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}
