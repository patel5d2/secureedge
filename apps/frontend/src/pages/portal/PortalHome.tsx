import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, AlertTriangle } from 'lucide-react';
import { api, type AppCard, type AppsResponse } from '../../lib/api';
import { iconForSlug } from '../../lib/app-icons';
import Input from '../../design-system/components/Input';
import Spinner from '../../design-system/components/Spinner';
import AppDetail from './AppDetail';

type Filter = 'all' | 'accessible' | 'restricted';

export default function PortalHome() {
  const [apps, setApps] = useState<AppCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeAppId = searchParams.get('app');

  const closeSheet = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('app');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  useEffect(() => {
    api
      .get<AppsResponse>('/portal/apps')
      .then((r) => {
        setApps(r.apps);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const hasPostureWarning = apps.some((a) => a.posture_required);
  const accessibleCount = apps.filter((a) => a.accessible).length;

  const filtered = useMemo(() => {
    let list = apps;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
      );
    }
    if (filter === 'accessible') list = list.filter((a) => a.accessible);
    if (filter === 'restricted') list = list.filter((a) => !a.accessible);
    return list;
  }, [apps, search, filter]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Posture warning banner */}
      {hasPostureWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-[#F6D880] bg-[#FDF2DC] px-4 py-3 animate-fade-in">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#8C5A0D]" strokeWidth={1.6} />
          <div className="flex-1 text-sm text-ink-700">
            <strong className="text-ink-900">Your device needs attention.</strong>{' '}
            Some apps require an additional posture check.{' '}
            <Link
              to="/portal/devices"
              className="font-medium text-signal-700 underline underline-offset-2 hover:text-signal-600"
            >
              Review your devices →
            </Link>
          </div>
        </div>
      )}

      {/* Header + search */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="pb-1 font-display text-[44px] leading-[1.1] tracking-[-0.02em] text-ink-900">
            Your <em className="font-display italic">applications</em>
          </h1>
          <p className="mt-2 text-[13px] text-ink-500">
            {accessibleCount} of {apps.length} accessible from this device.
          </p>
        </div>
        <div className="w-full flex-shrink-0 sm:w-[280px]">
          <Input
            id="portal-search"
            placeholder="Search apps…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" strokeWidth={1.6} />}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5">
        {(
          [
            ['all', 'All apps', apps.length],
            ['accessible', 'Accessible', accessibleCount],
            ['restricted', 'Restricted', apps.length - accessibleCount],
          ] as [Filter, string, number][]
        ).map(([key, label, count]) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors duration-200 ease-out-soft ${
                active
                  ? 'border-ink-900 bg-ink-900 text-ink-0'
                  : 'border-ink-100 bg-transparent text-ink-700 hover:border-ink-200 hover:bg-ink-50'
              }`}
            >
              {label}
              <span className="font-mono text-[10px] opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* App grid */}
      {filtered.length === 0 ? (
        <EmptyState searching={!!search} />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((app) => (
            <AppTile key={app.id} app={app} />
          ))}
        </div>
      )}

      {/* Side sheet — slides in from the right; portal grid stays mounted behind it */}
      <AppDetail appId={activeAppId} onClose={closeSheet} />
    </div>
  );
}

function AppTile({ app }: { app: AppCard }) {
  const Icon = iconForSlug(app.slug);
  const state: 'allowed' | 'posture' | 'denied' = app.accessible
    ? 'allowed'
    : app.posture_required
      ? 'posture'
      : 'denied';

  return (
    <Link
      to={`/portal?app=${app.id}`}
      id={`app-card-${app.slug}`}
      className="group flex flex-col gap-3.5 rounded-lg border border-ink-100 bg-white p-[18px] shadow-sm transition-all duration-200 ease-out-soft hover:-translate-y-px hover:border-ink-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-ink-900 text-ink-0">
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </div>
        <span className="font-mono text-[10px] text-ink-400">{app.slug}</span>
      </div>
      <div className="min-h-[52px]">
        <h3 className="text-sm font-semibold text-ink-900">{app.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-ink-500">{app.description}</p>
      </div>
      <div className="mt-auto">
        <AccessPill state={state} />
      </div>
    </Link>
  );
}

function AccessPill({ state }: { state: 'allowed' | 'posture' | 'denied' }) {
  const config = {
    allowed: { bg: '#E8F5E7', fg: '#1F6E20', dot: '#3CB13A', label: 'Allowed' },
    posture: { bg: '#FDF2DC', fg: '#8C5A0D', dot: '#D89422', label: 'Posture required' },
    denied: { bg: '#FBEAE7', fg: '#8B2613', dot: '#D1432B', label: 'Restricted' },
  }[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-medium"
      style={{ background: config.bg, color: config.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: config.dot }} />
      {config.label}
    </span>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-ink-200 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-50">
        <Search className="h-7 w-7 text-ink-400" strokeWidth={1.6} />
      </div>
      <div>
        <p className="font-display text-2xl leading-tight text-ink-900">
          {searching ? 'Nothing matches that.' : 'No applications yet.'}
        </p>
        <p className="mt-1 text-[13px] text-ink-500">
          {searching
            ? 'Try a different keyword.'
            : 'Contact IT to get applications assigned to you.'}
        </p>
      </div>
    </div>
  );
}
