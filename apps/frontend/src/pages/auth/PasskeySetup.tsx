import { useState, useEffect, useCallback } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, Trash2, Plus, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';

interface Passkey {
  id: string;
  friendlyName: string | null;
  deviceType: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function PasskeySetup() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [friendlyName, setFriendlyName] = useState('');

  const fetchPasskeys = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<{ credentials: Passkey[] }>('/auth/webauthn/credentials');
      setPasskeys(data.credentials);
    } catch (err) {
      setError('Failed to load passkeys.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setRegistering(true);

    try {
      // 1. Get options from server
      const options = await api.post<any>('/auth/webauthn/register/options');

      // 2. Start browser registration ceremony
      const credential = await startRegistration({ optionsJSON: options });

      // 3. Verify with server
      await api.post('/auth/webauthn/register/verify', {
        response: credential,
        friendlyName: friendlyName || 'Passkey',
      });

      setSuccess('Passkey registered successfully.');
      setFriendlyName('');
      await fetchPasskeys();
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Registration was cancelled.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Registration failed.');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this passkey?')) return;
    
    try {
      setError(null);
      await api.del(`/auth/webauthn/credentials/${id}`);
      await fetchPasskeys();
    } catch (err) {
      setError('Failed to remove passkey.');
    }
  };

  if (loading && passkeys.length === 0) {
    return <div className="animate-pulse h-32 bg-ink-50 rounded-lg"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-signal-50">
          <Fingerprint className="h-5 w-5 text-signal-700" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Passkeys</h2>
          <p className="text-sm text-ink-500">Sign in securely with Touch ID, Face ID, or a security key.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-danger-50 p-3 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-signal-50 p-3 text-sm text-signal-700">
          <p>{success}</p>
        </div>
      )}

      {passkeys.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-ink-900">Registered Passkeys</h3>
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100 bg-white">
            {passkeys.map((pk) => (
              <li key={pk.id} className="flex items-center justify-between p-4">
                <div className="flex flex-col">
                  <span className="font-medium text-ink-900">
                    {pk.friendlyName || 'Passkey'}
                  </span>
                  <span className="text-xs text-ink-500">
                    Added {new Date(pk.createdAt).toLocaleDateString()}
                    {pk.lastUsedAt && ` • Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(pk.id)}
                  className="rounded-md p-2 text-ink-400 hover:bg-danger-50 hover:text-danger-600 transition-colors"
                  title="Remove passkey"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ink-500">No passkeys registered yet.</p>
      )}

      <form onSubmit={handleRegister} className="space-y-4 rounded-lg border border-ink-100 bg-ink-50/50 p-4">
        <h3 className="text-sm font-medium text-ink-900">Add a new passkey</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              id="passkey-name"
              label="Device name (optional)"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="e.g. MacBook Pro Touch ID"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            loading={registering}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Register
          </Button>
        </div>
      </form>
    </div>
  );
}
