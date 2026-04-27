import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';

interface SignupResponse {
  ok: true;
  nextStep: 'verify_email';
}

interface PasswordCheck {
  ok: boolean;
  label: string;
}

function passwordChecks(pw: string): PasswordCheck[] {
  return [
    { ok: pw.length >= 12, label: '12+ characters' },
    { ok: /[a-z]/.test(pw), label: 'lowercase letter' },
    { ok: /[A-Z]/.test(pw), label: 'uppercase letter' },
    { ok: /\d/.test(pw), label: 'number' },
    { ok: /[^A-Za-z0-9]/.test(pw), label: 'symbol' },
  ];
}

// Cloudflare's published "always-passes" sitekey, documented at
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/.
// Used as a fallback so dev/staging doesn't need a real Cloudflare account.
// In production, set VITE_TURNSTILE_SITE_KEY at build time to a real sitekey.
const TURNSTILE_SITE_KEY: string =
  (import.meta.env && (import.meta.env as { VITE_TURNSTILE_SITE_KEY?: string }).VITE_TURNSTILE_SITE_KEY) ||
  '1x00000000000000000000AA';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; 'error-callback'?: () => void }
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef<HTMLDivElement | null>(null);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const passwordOk = checks.every((c) => c.ok);
  const confirmOk = confirm.length > 0 && confirm === password;

  // Turnstile widget. Falls back to Cloudflare's published test sitekey when
  // VITE_TURNSTILE_SITE_KEY is not provided, so the form works in dev/staging.
  useEffect(() => {
    let cancelled = false;
    const SCRIPT_ID = 'cf-turnstile-script';
    function mount() {
      if (cancelled || !captchaRef.current || !window.turnstile) return;
      window.turnstile.render(captchaRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t) => setCaptchaToken(t),
        'error-callback': () => setCaptchaToken(''),
      });
    }
    if (window.turnstile) {
      mount();
    } else if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true;
      s.defer = true;
      s.onload = mount;
      document.head.appendChild(s);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit =
    email.length > 0 &&
    fullName.length >= 2 &&
    passwordOk &&
    confirmOk &&
    acceptTerms &&
    !!captchaToken &&
    !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await api.post<SignupResponse>('/auth/signup', {
        email,
        full_name: fullName,
        password,
        accept_terms: true,
        captcha_token: captchaToken,
      });
      navigate(`/verify?sent=${encodeURIComponent(email)}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 && err.message === 'captcha_failed') {
          setError('Captcha check failed. Please retry.');
        } else if (err.status === 400 && err.message === 'validation_error') {
          setError('Some fields are invalid. Please review the form.');
        } else if (err.status === 429) {
          setError('Too many sign-up attempts. Try again in an hour.');
        } else {
          setError('Could not complete sign-up. Please try again.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
      setCaptchaToken('');
      window.turnstile?.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} id="signup-form" noValidate>
      <h1 className="font-display text-[40px] leading-[1.05] tracking-[-0.02em] text-ink-900">
        Create your account.
      </h1>
      <p className="mt-2 mb-7 text-sm text-ink-500">
        Use your work email. We'll send a verification link.
      </p>

      <div className="space-y-4">
        <Input
          id="signup-email"
          label="Work email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          inputMode="email"
          required
        />
        <Input
          id="signup-name"
          label="Full name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Alex Chen"
          autoComplete="name"
          required
        />
        <div>
          <Input
            id="signup-password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            autoComplete="new-password"
            aria-describedby="password-rules"
            required
          />
          <ul id="password-rules" className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            {checks.map((c) => (
              <li
                key={c.label}
                className={c.ok ? 'text-signal-700' : 'text-ink-400'}
                aria-live="polite"
              >
                <span aria-hidden="true">{c.ok ? '✓' : '·'}</span> {c.label}
              </li>
            ))}
          </ul>
        </div>
        <Input
          id="signup-confirm"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••••••"
          autoComplete="new-password"
          error={confirm.length > 0 && !confirmOk ? "Passwords don't match." : null}
          required
        />
        <label className="flex items-start gap-2 text-xs text-ink-600">
          <input
            id="signup-terms"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-ink-200 text-signal-600 focus:ring-signal-500"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            required
          />
          <span>
            I agree to the{' '}
            <a href="/terms" className="text-signal-700 underline underline-offset-2">terms</a> and{' '}
            <a href="/privacy" className="text-signal-700 underline underline-offset-2">privacy policy</a>.
          </span>
        </label>
        <div ref={captchaRef} className="flex min-h-[65px] items-center" aria-label="captcha" />
      </div>

      {error && (
        <div
          className="mt-4 rounded-md border border-[#F6C7BD] bg-[#FBEAE7] px-3 py-2 text-sm text-[#8B2613] animate-fade-in"
          role="alert"
        >
          {error}
        </div>
      )}

      <Button
        id="signup-submit"
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        disabled={!canSubmit}
        className="mt-6 w-full"
      >
        Create account →
      </Button>

      <p className="mt-6 text-center text-[11px] text-ink-400">
        Already have an account?{' '}
        <Link to="/login" className="text-signal-700 underline underline-offset-2 hover:text-signal-600">
          Sign in →
        </Link>
      </p>
    </form>
  );
}
