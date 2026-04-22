import { useEffect, useState, useCallback } from 'react';
import { Wifi, ShieldAlert, AlertTriangle, Activity, Clock } from 'lucide-react';
import { api, type HelpdeskDashboard as DashStats, type Alert, type AlertsResponse, type AccessEvent } from '../../lib/api';
import { formatTime, formatRelative } from '../../lib/format';
import { useRealtime } from '../../hooks/useRealtime';
import Badge from '../../design-system/components/Badge';
import Button from '../../design-system/components/Button';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';

const sevVar = { critical: 'danger', high: 'warning', medium: 'accent', low: 'gray' } as const;

export default function HelpdeskDashboard() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [feed, setFeed] = useState<AccessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    Promise.all([
      api.get<DashStats>('/helpdesk/dashboard'),
      api.get<AlertsResponse>('/helpdesk/alerts'),
    ]).then(([s, a]) => { setStats(s); setAlerts(a.alerts.filter(x => x.status === 'open').slice(0, 10)); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const onEvent = useCallback((ev: AccessEvent) => {
    setFeed((prev) => [ev, ...prev].slice(0, 50));
  }, []);
  useRealtime<AccessEvent>('/events/stream', onEvent, true);

  const ack = async (id: string) => {
    try {
      await api.put(`/helpdesk/alerts/${id}`, { status: 'acknowledged' });
      setAlerts((a) => a.map((x) => x.id === id ? { ...x, status: 'acknowledged' as const } : x));
      push('Alert acknowledged.', 'success');
    } catch { push('Failed to update alert.', 'error'); }
  };

  if (loading || !stats) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  const statCards = [
    { label: 'Active Connections', value: stats.activeConnections, icon: Wifi, color: 'text-info' },
    { label: 'Denials (24h)', value: stats.denials24h, icon: ShieldAlert, color: 'text-danger' },
    { label: 'Open Alerts', value: stats.openAlerts, icon: AlertTriangle, color: 'text-warning' },
    { label: 'Critical', value: stats.criticalAlerts, icon: Activity, color: 'text-danger' },
  ];

  return (
    <div className="space-y-6">
      {/* Huge stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-[#30363D] bg-[#161B22] p-5">
            <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider"><s.icon className={`h-4 w-4 ${s.color}`} />{s.label}</div>
            <p className="mt-3 text-5xl font-bold text-white tracking-tight">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Feed + Alerts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Live feed */}
        <div className="xl:col-span-3 rounded-xl border border-[#30363D] bg-[#161B22] p-5">
          <h2 className="mb-4 text-sm font-semibold text-white/80">Live Event Feed</h2>
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {feed.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/30">Waiting for events…</p>
            ) : feed.map((ev, i) => (
              <div key={ev.id || i} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs animate-fade-in">
                <div className="flex items-center gap-3">
                  <Badge variant={ev.outcome === 'allow' || ev.outcome === 'allowed' ? 'success' : 'danger'} dot>{ev.outcome}</Badge>
                  <span className="text-white/80">{ev.user_name || ev.user_email || '—'}</span>
                  <span className="text-white/40">→</span>
                  <span className="text-white/60">{ev.app_name || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-white/30">
                  <span className="font-mono">{ev.ip}</span>
                  {ev.country && <span>{ev.country}</span>}
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(ev.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts queue */}
        <div className="xl:col-span-2 rounded-xl border border-[#30363D] bg-[#161B22] p-5">
          <h2 className="mb-4 text-sm font-semibold text-white/80">Open Alerts</h2>
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {alerts.filter(a => a.status === 'open').length === 0 ? (
              <p className="py-10 text-center text-sm text-white/30">No open alerts.</p>
            ) : alerts.filter(a => a.status === 'open').map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={sevVar[a.severity] || 'gray'} dot>{a.severity}</Badge>
                    <span className="text-xs font-medium text-white/80">{a.type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/40">{a.user_name || a.user_email || '—'} · {formatRelative(a.triggered_at)}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80" onClick={() => ack(a.id)}>Take</Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
