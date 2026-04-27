export default function Skeleton({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-ink-200/50 ${className}`}
      {...props}
    />
  );
}
