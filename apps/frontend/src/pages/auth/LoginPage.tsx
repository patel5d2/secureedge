import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        if (err.status === 401) setError('Invalid email or password. Please try again.');
        else if (err.status === 403) setError('Your account has been suspended. Contact IT support.');
        else setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" id="login-form">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-text-primary">Sign in</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Access your applications securely
        </p>
      </div>

      <Input
        id="login-email"
        label="Work email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        autoComplete="email"
        autoFocus
        required
        leftIcon={<Mail className="h-4 w-4" />}
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

      {error && (
        <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger animate-fade-in" role="alert">
          {error}
        </div>
      )}

      <Button
        id="login-submit"
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        className="w-full"
      >
        Continue
      </Button>

      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <div className="h-px flex-1 bg-border" />
          <span>Quick access</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="flex gap-2">
          {[
            { label: 'Admin', email: 'admin@secureedge.dev' },
            { label: 'Helpdesk', email: 'helpdesk@secureedge.dev' },
            { label: 'User', email: 'user@secureedge.dev' },
          ].map((preset) => (
            <button
              key={preset.email}
              type="button"
              className="flex-1 rounded-md border border-border py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
              onClick={() => {
                setEmail(preset.email);
                setPassword('password');
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-text-muted">
        Having trouble?{' '}
        <a href="#" className="text-info hover:underline">
          Contact IT support
        </a>
      </p>
    </form>
  );
}
