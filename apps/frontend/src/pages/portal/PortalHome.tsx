import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, AlertTriangle, ExternalLink, Lock, CheckCircle2 } from 'lucide-react';
import { api, type AppCard, type AppsResponse } from '../../lib/api';
import { iconForSlug } from '../../lib/app-icons';
import Input from '../../design-system/components/Input';
import Badge from '../../design-system/components/Badge';
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
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('app');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    api.get<AppsResponse>('/portal/apps').then((r) => {
      setApps(r.apps);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const hasPostureWarning = apps.some((a) => a.posture_required);

  const filtered = useMemo(() => {
    let list = apps;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
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
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 animate-fade-in">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
          <div className="flex-1 text-sm text-text-primary">
            <strong>Device posture issue detected.</strong> Some applications require additional security checks.{' '}
            <Link to="/portal/devices" className="font-medium text-info hover:underline">
              Review your devices →
            </Link>
          </div>
        </div>
      )}

      {/* Header + search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Your Applications</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {apps.length} application{apps.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            id="portal-search"
            placeholder="Search apps…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {([
          ['all', 'All Apps'],
          ['accessible', 'Accessible'],
          ['restricted', 'Restricted'],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-primary text-white'
                : 'bg-surface-2 text-text-secondary hover:bg-border hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* App grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
            <Search className="h-7 w-7 text-text-muted" />
          </div>
          <p className="text-sm font-medium text-text-secondary">
            {search ? 'No apps match your search' : 'No applications available'}
          </p>
          <p className="text-xs text-text-muted">
            {search ? 'Try a different keyword' : 'Contact IT to get applications assigned to you'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((app) => (
            <AppCardUI key={app.id} app={app} />
          ))}
        </div>
      )}

      {/* Side sheet — slides in from the right; portal grid stays mounted behind it */}
      <AppDetail appId={activeAppId} onClose={closeSheet} />
    </div>
  );
}

function AppCardUI({ app }: { app: AppCard }) {
  const Icon = iconForSlug(app.slug);
  return (
    <Link
      to={`/portal?app=${app.id}`}
      id={`app-card-${app.slug}`}
      className="group relative flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 transition-colors group-hover:bg-primary/5">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary">{app.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{app.description}</p>
      <div className="mt-auto flex items-center justify-between pt-4">
        {app.accessible ? (
          <Badge variant="success" dot>
            <CheckCircle2 className="h-3 w-3" /> Access OK
          </Badge>
        ) : app.posture_required ? (
          <Badge variant="warning" dot>
            <Lock className="h-3 w-3" /> Posture required
          </Badge>
        ) : (
          <Badge variant="danger" dot>
            <Lock className="h-3 w-3" /> Restricted
          </Badge>
        )}
        <ExternalLink className="h-3.5 w-3.5 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}
