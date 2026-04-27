import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import Button from '../../design-system/components/Button';

type Status = 'idle' | 'verifying' | 'success' | 'expired' | 'error' | 'pending_email';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const sentTo = params.get('sent');
  const [status, setStatus] = useState<Status>(token ? 'verifying' : sentTo ? 'pending_email' : 'idle');
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        await api.post('/auth/verify-email', { token });
        if (!cancelled) setStatus('success');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.message === 'token_invalid_or_expired') {
          setStatus('expired');
        } else {
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onResend = async () => {
    if (!sentTo) return;
    setResending(true);
    setResendNote(null);
    try {
      await api.post('/auth/resend-verification', { email: sentTo, captcha_token: 'dev-bypass' });
      setResendNote('If that email is on file, a fresh link is on its way.');
    } catch {
      setResendNote('Could not resend right now. Try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-[40px] leading-[1.05] tracking-[-0.02em] text-ink-900">
        {status === 'success' ? 'Email verified.' : 'Verify your email.'}
      </h1>

      {status === 'pending_email' && (
        <>
          <p className="mt-2 mb-6 text-sm text-ink-500">
            We sent a link to <span className="font-medium text-ink-900">{sentTo}</span>.
            Open it within 10 minutes to activate your account.
          </p>
          <Button onClick={onResend} loading={resending} variant="secondary" className="w-full">
            Resend link
          </Button>
          {resendNote && (
            <p className="mt-3 text-xs text-ink-500" role="status">{resendNote}</p>
          )}
        </>
      )}

      {status === 'verifying' && (
        <p className="mt-2 text-sm text-ink-500" role="status">Confirming your link…</p>
      )}

      {status === 'success' && (
        <>
          <p className="mt-2 mb-6 text-sm text-ink-500">
            Your account is active. You can sign in now.
          </p>
          <Link to="/login">
            <Button variant="primary" size="lg" className="w-full">
              Continue to sign in →
            </Button>
          </Link>
        </>
      )}

      {status === 'expired' && (
        <>
          <p className="mt-2 mb-6 text-sm text-ink-500">
            That link has expired or already been used. Request a fresh one from the sign-up
            confirmation page, or sign in if you've already verified.
          </p>
          <Link to="/login">
            <Button variant="secondary" className="w-full">Go to sign in</Button>
          </Link>
        </>
      )}

      {status === 'error' && (
        <p className="mt-2 text-sm text-[#8B2613]" role="alert">
          Something went wrong verifying your email. Try the link again, or contact IT.
        </p>
      )}

      {status === 'idle' && (
        <p className="mt-2 text-sm text-ink-500">No verification token found in this URL.</p>
      )}
    </div>
  );
}
