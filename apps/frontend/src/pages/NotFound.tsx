import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Button from '../design-system/components/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 p-6">
      <div className="flex max-w-md flex-col items-center text-center animate-fade-in">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
          <ShieldAlert className="h-10 w-10 text-accent" strokeWidth={1.6} />
        </div>
        <h1 className="font-display text-[72px] leading-none tracking-[-0.03em] text-ink-0">404</h1>
        <p className="mt-3 font-display text-[22px] leading-tight text-ink-0/80">Page not found</p>
        <p className="mt-2 text-[13px] text-ink-0/50">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/portal" className="mt-8">
          <Button variant="accent" leftIcon={<ArrowLeft className="h-4 w-4" strokeWidth={1.6} />}>
            Back to portal
          </Button>
        </Link>
      </div>
    </div>
  );
}
