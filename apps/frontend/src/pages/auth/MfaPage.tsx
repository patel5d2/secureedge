import { useCallback, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import Button from '../../design-system/components/Button';

const CODE_LENGTH = 6;

export default function MfaPage() {
  const { verifyMfa, user } = useAuth();
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = (idx: number) => {
    inputRefs.current[idx]?.focus();
  };

  const handleChange = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, '').slice(-1);
      setDigits((prev) => {
        const next = [...prev];
        next[index] = digit;
        return next;
      });
      if (digit && index < CODE_LENGTH - 1) {
        focusInput(index + 1);
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        focusInput(index - 1);
      }
      if (e.key === 'ArrowLeft' && index > 0) focusInput(index - 1);
      if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) focusInput(index + 1);
    },
    [digits]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    const newDigits = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    focusInput(Math.min(pasted.length, CODE_LENGTH - 1));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < CODE_LENGTH) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const verifiedUser = await verifyMfa(code);
      const role = verifiedUser.role;
      if (role === 'admin') navigate('/admin', { replace: true });
      else if (role === 'helpdesk') navigate('/helpdesk', { replace: true });
      else navigate('/portal', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid code. Please try again.');
      } else {
        setError('Verification failed. Please try again.');
      }
      setDigits(Array(CODE_LENGTH).fill(''));
      focusInput(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} id="mfa-form">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900/5">
          <ShieldCheck className="h-6 w-6 text-ink-900" strokeWidth={1.6} />
        </div>
        <div>
          <h1 className="font-display text-[32px] leading-[1.08] tracking-[-0.02em] text-ink-900">
            Verify your identity
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
      </div>

      <div className="mt-7 flex justify-center gap-2" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            id={`mfa-digit-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            autoFocus={i === 0}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`h-14 w-11 rounded-md border text-center font-mono text-xl font-semibold transition-colors duration-200 ease-out-soft focus:outline-none focus:ring-2 ${
              error
                ? 'border-danger focus:border-danger focus:ring-danger/20'
                : 'border-ink-100 focus:border-signal-500 focus:ring-signal-500/30'
            }`}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>

      {error && (
        <div
          className="mt-4 rounded-md border border-[#F6C7BD] bg-[#FBEAE7] px-3 py-2 text-center text-sm text-[#8B2613] animate-fade-in"
          role="alert"
        >
          {error}
        </div>
      )}

      <Button
        id="mfa-submit"
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        className="mt-6 w-full"
      >
        Verify →
      </Button>

      <div className="mt-6 space-y-2 text-center">
        <p className="text-[11px] text-ink-500">
          Dev hint: code is <span className="font-mono text-ink-900">123456</span>
        </p>
        <div className="flex flex-col gap-1 text-[11px]">
          <a href="#" className="text-signal-700 underline underline-offset-2 hover:text-signal-600">
            Use a security key instead
          </a>
          <a href="#" className="text-signal-700 underline underline-offset-2 hover:text-signal-600">
            I don't have my device
          </a>
        </div>
      </div>
    </form>
  );
}
