import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldOff, ArrowLeft, LogOut } from 'lucide-react';
import Button from '../../design-system/components/Button';
import { useAuth } from '../../hooks/useAuth';

interface DeniedState {
  reason?: string;
  requiredRole?: string;
  attemptedPath?: string;
}

/**
 * Access Denied — shown when a user hits a route their role isn't permitted on,
 * or when a policy decision blocks an app they tried to open.
 *
 * Receives optional state via react-router's navigate:
 *   navigate('/access-denied', { state: { reason, requiredRole, attemptedPath } })
 */
export default function AccessDeniedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const state = (location.state || {}) as DeniedState;

  const goHome = () => {
    if (!user) return navigate('/login', { replace: true });
    if (user.role === 'admin') return navigate('/admin', { replace: true });
    if (user.role === 'helpdesk') return navigate('/helpdesk', { replace: true });
    return navigate('/portal', { replace: true });
  };

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur-sm animate-fade-in">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#F6C7BD] bg-[#FBEAE7]/10">
          <ShieldOff className="h-8 w-8 text-[#FF7555]" strokeWidth={1.6} />
        </div>

        <h1 className="mt-6 text-center font-display text-[32px] leading-[1.08] tracking-[-0.02em] text-ink-0">
          Access denied
        </h1>
        <p className="mt-2 text-center text-[13px] text-ink-0/60">
          {state.reason ||
            'Your account does not have permission to view this resource. If you believe this is a mistake, contact your administrator.'}
        </p>

        {(state.requiredRole || state.attemptedPath) && (
          <div className="mt-6 space-y-2 rounded-md border border-white/10 bg-black/20 p-4 font-mono text-[11px]">
            {state.requiredRole && (
              <div className="flex justify-between">
                <span className="text-ink-0/40">Required role</span>
                <span className="text-ink-0/80">{state.requiredRole}</span>
              </div>
            )}
            {user?.role && (
              <div className="flex justify-between">
                <span className="text-ink-0/40">Your role</span>
                <span className="text-ink-0/80">{user.role}</span>
              </div>
            )}
            {state.attemptedPath && (
              <div className="flex justify-between">
                <span className="text-ink-0/40">Attempted path</span>
                <span className="text-ink-0/80">{state.attemptedPath}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <Button
            variant="secondary"
            className="flex-1 !border-white/20 !bg-white/5 !text-ink-0 hover:!bg-white/10"
            onClick={goHome}
            leftIcon={<ArrowLeft className="h-4 w-4" strokeWidth={1.6} />}
          >
            Back to home
          </Button>
          <Button
            variant="accent"
            className="flex-1"
            onClick={signOut}
            leftIcon={<LogOut className="h-4 w-4" strokeWidth={1.6} />}
          >
            Sign out
          </Button>
        </div>

        <p className="mt-6 text-center font-mono text-[10px] text-ink-0/30">
          Event ID {crypto.randomUUID?.().slice(0, 8) || 'anonymous'} — This attempt has been logged.
        </p>
      </div>
    </div>
  );
}
