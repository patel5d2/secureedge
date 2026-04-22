import { Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-primary via-primary-600 to-[#0b1230] flex items-center justify-center p-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
            <Shield className="h-6 w-6 text-accent" />
          </span>
          <span className="text-lg font-semibold tracking-tight">SecureEdge</span>
        </div>
        <div className="rounded-xl bg-surface shadow-xl border border-white/5 p-8">
          <Outlet />
        </div>
        <p className="mt-6 text-center text-xs text-white/60">
          Zero Trust Network Access · Continuously verified
        </p>
      </div>
    </div>
  );
}
