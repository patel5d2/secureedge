import { useEffect, useState } from 'react';
import { api, type Alert, type AlertsResponse } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import Badge from '../../design-system/components/Badge';
import Button from '../../design-system/components/Button';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';

const sevVar = { critical: 'danger', high: 'warning', medium: 'accent', low: 'gray' } as const;
const statusVar = { open: 'danger', acknowledged: 'warning', resolved: 'success', false_positive: 'gray' } as const;

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('open');
  const { push } = useToast();

  useEffect(() => {
    api.get<AlertsResponse>('/helpdesk/alerts').then((r) => { setAlerts(r.alerts); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const update = async (id: string, status: string) => {
    try {
      await api.put(`/helpdesk/alerts/${id}`, { status });
      setAlerts((a) => a.map((x) => x.id === id ? { ...x, status: status as Alert['status'] } : x));
      push(`Alert ${status}.`, 'success');
    } catch { push('Failed to update alert.', 'error'); }
  };

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status === filter);

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Alerts Queue</h1>
      <div className="flex gap-2">
        {['all', 'open', 'acknowledged', 'resolved'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === s ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/30">No alerts in this category.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="rounded-xl border border-[#30363D] bg-[#161B22] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={sevVar[a.severity] || 'gray'} dot>{a.severity}</Badge>
                    <Badge variant={statusVar[a.status] || 'gray'}>{a.status}</Badge>
                  </div>
                  <p className="text-sm font-medium text-white/90">{a.type.replace(/_/g, ' ')}</p>
                  <p className="mt-0.5 text-xs text-white/40">{a.user_name || a.user_email || 'Unknown user'} · {formatRelative(a.triggered_at)}</p>
                  {a.message && <p className="mt-1 text-xs text-white/50">{a.message}</p>}
                </div>
                <div className="flex gap-2">
                  {a.status === 'open' && <Button variant="ghost" size="sm" className="text-accent" onClick={() => update(a.id, 'acknowledged')}>Acknowledge</Button>}
                  {(a.status === 'open' || a.status === 'acknowledged') && <Button variant="ghost" size="sm" className="text-success" onClick={() => update(a.id, 'resolved')}>Resolve</Button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
