import { useEffect, useState } from 'react';
import { Users, FileText, ShieldAlert, Activity, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api, type OverviewStats, type AccessEvent, type RecentEventsResponse } from '../../lib/api';
import { formatTime } from '../../lib/format';
import Card, { CardHeader } from '../../design-system/components/Card';
import Badge from '../../design-system/components/Badge';
import Spinner from '../../design-system/components/Spinner';
import { colors } from '../../design-system/tokens';

export default function AdminOverview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<OverviewStats>('/admin/overview'),
      api.get<RecentEventsResponse>('/admin/recent-events'),
    ]).then(([s, e]) => { setStats(s); setEvents(e.events); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading || !stats) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  const chartData = stats.trend.labels.map((l, i) => ({
    time: l.slice(11, 16),
    Allowed: stats.trend.allowed[i],
    Denied: stats.trend.denied[i],
  }));

  const statCards = [
    { label: 'Active Users (24h)', value: stats.activeUsers24h, icon: Users, color: 'text-info' },
    { label: 'Active Policies', value: stats.policiesActive, icon: FileText, color: 'text-primary' },
    { label: 'Denials (24h)', value: stats.denials24h, icon: ShieldAlert, color: 'text-danger' },
    { label: 'Critical Alerts', value: stats.criticalAlerts, icon: Activity, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">{s.label}</p>
                <p className="mt-2 text-3xl font-bold text-text-primary">{s.value.toLocaleString()}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Chart + events */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Access Events (24h)" subtitle="Allowed vs denied access attempts" />
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: colors.textSecondary }} />
                <YAxis tick={{ fontSize: 11, fill: colors.textSecondary }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${colors.border}` }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Allowed" stroke={colors.success} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Denied" stroke={colors.danger} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Recent Denials" subtitle="Last 10 denied access attempts" />
          <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
            {events.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">No recent denials.</p>
            ) : events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary">{ev.user_name || ev.user_email}</p>
                  <p className="text-[11px] text-text-secondary">{ev.app_name} · {ev.deny_reason?.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-text-muted">{formatTime(ev.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* System health */}
      <Card>
        <CardHeader title="System Health" />
        <div className="mt-4 flex flex-wrap gap-3">
          {['Gateway', 'IdP Connection', 'Audit Pipeline', 'MFA Service'].map((svc) => (
            <div key={svc} className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/5 px-3 py-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> {svc}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
