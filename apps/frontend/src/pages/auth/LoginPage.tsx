import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api, ApiError } from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';

interface SsoConfig {
  enabled: boolean;
  providerName?: string;
  loginUrl?: string;
}

/**
 * Login — editorial serif heading, uppercase eyebrow labels, signal-green CTA.
 * Now with optional OIDC SSO support above the email/password form.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | null>(null);

  // Check if SSO is enabled
  useEffect(() => {
    api
      .get<SsoConfig>('/auth/sso/config')
      .then((cfg) => setSsoConfig(cfg))
      .catch(() => setSsoConfig({ enabled: false }));
  }, []);

  // Check for SSO error params in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get('error');
    if (ssoError) {
      const messages: Record<string, string> = {
        sso_state_invalid: 'SSO session expired. Please try again.',
        sso_state_expired: 'SSO session expired. Please try again.',
        sso_token_error: 'SSO authentication failed. Please try again.',
        sso_no_email: 'Your identity provider did not return an email address.',
        account_not_active: 'Your account is suspended. Contact IT.',
      };
      setError(messages[ssoError] || 'SSO authentication failed.');
    }
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { nextStep } = await login(email, password);
      if (nextStep === 'mfa') {
        navigate('/mfa', { replace: true });
      } else {
        navigate('/portal', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('Check your email and password and try again.');
        else if (err.status === 403) setError('Your account is suspended. Contact IT to get back in.');
        else setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = () => {
    if (ssoConfig?.loginUrl) {
      // Full-page redirect to the backend SSO endpoint
      window.location.href = `${(import.meta.env?.VITE_API_BASE_URL as string) || '/api'}${ssoConfig.loginUrl.replace('/api', '')}`;
    }
  };

  const presets = [
    { label: 'Admin', email: 'admin@secureedge.dev' },
    { label: 'Helpdesk', email: 'helpdesk@secureedge.dev' },
    { label: 'User', email: 'user@secureedge.dev' },
  ];

  return (
    <form onSubmit={onSubmit} id="login-form">
      <h1 className="font-display text-[40px] leading-[1.05] tracking-[-0.02em] text-ink-900">
        Sign in.
      </h1>
      <p className="mt-2 mb-7 text-sm text-ink-500">
        Use your work email or company SSO.
      </p>

      {/* SSO Button */}
      {ssoConfig?.enabled && (
        <>
          <button
            type="button"
            onClick={handleSsoLogin}
            id="sso-login"
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-900 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-ink-300 hover:shadow-md active:translate-y-0"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Sign in with {ssoConfig.providerName || 'SSO'} →
          </button>

          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.08em] text-ink-400">
            <div className="h-px flex-1 bg-ink-100" />
            <span>or sign in with email</span>
            <div className="h-px flex-1 bg-ink-100" />
          </div>
        </>
      )}

      <div className="space-y-4">
        <Input
          id="login-email"
          label="Work email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          autoFocus={!ssoConfig?.enabled}
          required
          error={null}
        />

        <Input
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
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
        id="login-submit"
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        className="mt-6 w-full"
      >
        Continue →
      </Button>

      <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.08em] text-ink-400">
        <div className="h-px flex-1 bg-ink-100" />
        <span>Quick access · demo</span>
        <div className="h-px flex-1 bg-ink-100" />
      </div>
      <div className="mt-3 flex gap-2">
        {presets.map((preset) => (
          <button
            key={preset.email}
            type="button"
            className="flex-1 rounded-md border border-ink-100 bg-transparent py-1.5 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900"
            onClick={() => {
              setEmail(preset.email);
              setPassword('password');
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-[11px] text-ink-400">
        Having trouble?{' '}
        <a href="#" className="text-signal-700 underline underline-offset-2 hover:text-signal-600">
          Contact IT →
        </a>
      </p>
    </form>
  );
}
