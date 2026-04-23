import { useEffect, useState } from 'react';
import { Monitor, Globe, Clock, Trash2 } from 'lucide-react';
import { api, type Session, type SessionsResponse } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import Badge from '../../design-system/components/Badge';
import Button from '../../design-system/components/Button';
import Card from '../../design-system/components/Card';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const { push } = useToast();

  useEffect(() => {
    api.get<SessionsResponse>('/portal/sessions').then((r) => {
      setSessions(r.sessions);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await api.del(`/portal/sessions/${id}`);
      setSessions((s) => s.filter((x) => x.id !== id));
      push('Session revoked.', 'success');
    } catch {
      push('Failed to revoke session.', 'error');
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  const active = sessions.filter((s) => !s.revoked_at && new Date(s.expires_at) > new Date());
  const past = sessions.filter((s) => s.revoked_at || new Date(s.expires_at) <= new Date());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">My Sessions</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Manage your active login sessions
        </p>
      </div>

      {/* Active */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <Card>
            <p className="py-6 text-center text-sm text-text-muted">No active sessions.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onRevoke={() => revoke(s.id)}
                revoking={revoking === s.id}
                isActive
              />
            ))}
          </div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
            Past sessions ({past.length})
          </h2>
          <div className="space-y-3">
            {past.map((s) => (
              <SessionCard key={s.id} session={s} isActive={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  isActive,
  onRevoke,
  revoking,
}: {
  session: Session;
  isActive: boolean;
  onRevoke?: () => void;
  revoking?: boolean;
}) {
  const ua = session.user_agent || 'Unknown device';
  const browser = ua.includes('Chrome')
    ? 'Chrome'
    : ua.includes('Firefox')
    ? 'Firefox'
    : ua.includes('Safari')
    ? 'Safari'
    : 'Browser';

  return (
    <Card className={`${!isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2">
            <Monitor className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">{browser}</span>
              {isActive && (
                <Badge variant="success" dot>
                  Active
                </Badge>
              )}
              {session.revoked_at && <Badge variant="danger">Revoked</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" /> {session.ip_address || 'unknown'}
                {session.geo_country && ` · ${session.geo_country}`}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Started {formatRelative(session.started_at)}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Expires {formatDateTime(session.expires_at)}
            </p>
          </div>
        </div>
        {isActive && onRevoke && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevoke}
            loading={revoking}
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            className="text-danger hover:bg-danger/5 hover:text-danger"
          >
            Revoke
          </Button>
        )}
      </div>
    </Card>
  );
}
