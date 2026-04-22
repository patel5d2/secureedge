import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Button from '../design-system/components/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-primary-600 to-[#0b1230] p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
          <ShieldAlert className="h-10 w-10 text-accent" />
        </div>
        <h1 className="text-6xl font-bold text-white">404</h1>
        <p className="mt-3 text-lg font-medium text-white/80">Page not found</p>
        <p className="mt-2 text-sm text-white/50">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/portal" className="mt-8">
          <Button variant="accent" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to portal
          </Button>
        </Link>
      </div>
    </div>
  );
}
