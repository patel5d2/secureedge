import { useState, useCallback } from 'react';
import { Search, LogOut, AlertTriangle, KeyRound, Copy } from 'lucide-react';
import { api, type User, type UserSearchResponse, type UserAccessHistoryResponse, type AccessEvent } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import Input from '../../design-system/components/Input';
import Badge from '../../design-system/components/Badge';
import Button from '../../design-system/components/Button';
import Avatar from '../../design-system/components/Avatar';
import { useToast } from '../../hooks/useToast';

interface ResetResponse {
  ok: boolean;
  email: string;
  revoked: number;
  resetToken?: string;
  expiresAt: string;
}

export default function UserLookup() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [history, setHistory] = useState<AccessEvent[]>([]);
  const [searching, setSearching] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [lastReset, setLastReset] = useState<ResetResponse | null>(null);
  const { push } = useToast();

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true); setSelected(null); setHistory([]);
    try {
      const r = await api.get<UserSearchResponse>('/helpdesk/users/search', { q: query });
      setResults(r.users);
    } catch { push('Search failed.', 'error'); }
    setSearching(false);
  }, [query, push]);

  const selectUser = async (u: User) => {
    setSelected(u);
    setLastReset(null);
    try {
      const r = await api.get<UserAccessHistoryResponse>(`/helpdesk/users/${u.id}/access-history`);
      setHistory(r.events);
    } catch { /* noop */ }
  };

  const forceLogout = async () => {
    if (!selected) return;
    try {
      const r = await api.post<{ revoked: number }>(`/helpdesk/users/${selected.id}/force-logout`);
      push(`${r.revoked} session(s) revoked.`, 'success');
    } catch { push('Failed to force logout.', 'error'); }
  };

  const sendPasswordReset = async () => {
    if (!selected) return;
    setResetting(true);
    setLastReset(null);
    try {
      const r = await api.post<ResetResponse>(`/helpdesk/users/${selected.id}/send-password-reset`);
      setLastReset(r);
      push(`Reset sent to ${r.email}. ${r.revoked} session(s) revoked.`, 'success');
    } catch {
      push('Failed to send password reset.', 'error');
    }
    setResetting(false);
  };

  const copyToken = async () => {
    if (!lastReset?.resetToken) return;
    try {
      await navigator.clipboard.writeText(lastReset.resetToken);
      push('Token copied to clipboard.', 'success');
    } catch {
      push('Copy failed.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">User Lookup</h1>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input id="helpdesk-user-search" placeholder="Search by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} leftIcon={<Search className="h-4 w-4" />} className="!bg-[#161B22] !text-white !border-[#30363D] placeholder:!text-white/30" />
        </div>
        <Button variant="accent" onClick={doSearch} loading={searching}>Search</Button>
      </div>

      {/* Results */}
      {!selected && results.length > 0 && (
        <div className="space-y-2">
          {results.map((u) => (
            <button key={u.id} onClick={() => selectUser(u)} className="flex w-full items-center gap-4 rounded-xl border border-[#30363D] bg-[#161B22] p-4 text-left transition-colors hover:bg-white/5">
              <Avatar name={u.name || u.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{u.name || u.full_name}</p>
                <p className="text-xs text-white/40">{u.email} · {u.department || '—'}</p>
              </div>
              <Badge variant={u.status === 'active' ? 'success' : 'danger'} dot>{u.status}</Badge>
            </button>
          ))}
        </div>
      )}

      {/* Selected user detail */}
      {selected && (
        <div className="space-y-6 animate-fade-in">
          {/* User card */}
          <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <Avatar name={selected.name || selected.full_name} size="lg" />
                <div>
                  <h2 className="text-lg font-bold text-white">{selected.name || selected.full_name}</h2>
                  <p className="text-sm text-white/50">{selected.email}</p>
                  <p className="text-xs text-white/30 mt-1">{selected.department || '—'} · {selected.role}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant={selected.status === 'active' ? 'success' : 'danger'} dot>{selected.status}</Badge>
                    <span className="text-xs text-white/30">Last seen {formatRelative(selected.last_login_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-3">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" size="sm" leftIcon={<LogOut className="h-3.5 w-3.5" />} onClick={forceLogout}>Force Logout</Button>
              <Button
                variant="accent"
                size="sm"
                leftIcon={<KeyRound className="h-3.5 w-3.5" />}
                onClick={sendPasswordReset}
                loading={resetting}
              >
                Send Password Reset
              </Button>
              <Button variant="secondary" size="sm" leftIcon={<AlertTriangle className="h-3.5 w-3.5" />} className="!border-[#30363D] !text-white/70">Escalate to Security</Button>
            </div>

            {lastReset && (
              <div className="mt-4 rounded-lg border border-success/30 bg-success/5 p-3 text-xs animate-fade-in">
                <p className="font-semibold text-success">Password reset dispatched</p>
                <p className="mt-1 text-white/60">
                  Sent to <span className="font-mono text-white/80">{lastReset.email}</span> ·{' '}
                  {lastReset.revoked} session(s) revoked · expires{' '}
                  {new Date(lastReset.expiresAt).toLocaleString()}
                </p>
                {lastReset.resetToken && (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 overflow-x-auto rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-white/80">
                      {lastReset.resetToken}
                    </code>
                    <button
                      onClick={copyToken}
                      className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-[11px] text-white/60 hover:text-white"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                )}
                <p className="mt-2 text-[10px] text-white/30">
                  Dev mode shows the raw token here for verbal hand-off. In production this is delivered via email.
                </p>
              </div>
            )}
          </div>

          {/* Access history */}
          <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-3">Access History (30 days)</h3>
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {history.length === 0 ? (
                <p className="py-6 text-center text-sm text-white/30">No access events in the last 30 days.</p>
              ) : history.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs">
                  <div className="flex items-center gap-3">
                    <Badge variant={ev.outcome === 'allow' || ev.outcome === 'allowed' ? 'success' : 'danger'} dot>{ev.outcome}</Badge>
                    <span className="text-white/70">{ev.app_name || '—'}</span>
                    {ev.deny_reason && <span className="text-white/30">{ev.deny_reason.replace(/_/g, ' ')}</span>}
                  </div>
                  <span className="text-white/30">{formatRelative(ev.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => { setSelected(null); setHistory([]); }} className="text-sm text-info hover:underline">← Back to results</button>
        </div>
      )}
    </div>
  );
}
