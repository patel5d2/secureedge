import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api, type Policy, type PoliciesResponse } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import Spinner from '../../design-system/components/Spinner';

const statusConfig = {
  active: { bg: '#E8F5E7', fg: '#1F6E20', dot: '#3CB13A', label: 'Active' },
  draft: { bg: '#FDF2DC', fg: '#8C5A0D', dot: '#D89422', label: 'Draft' },
  disabled: { bg: '#F0EFEB', fg: '#6A655D', dot: '#A9A49A', label: 'Disabled' },
} as const;

export default function PoliciesList() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<PoliciesResponse>('/admin/policies')
      .then((r) => {
        setPolicies(r.policies);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = policies.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between border-b border-ink-100 pb-6">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            {policies.length} policies · ordered by priority
          </p>
          <h1 className="mt-1 font-display text-[44px] leading-[1.05] tracking-[-0.02em] text-ink-900">
            Policies
          </h1>
        </div>
        <Link to="/admin/policies/new">
          <Button variant="signal" leftIcon={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
            New policy
          </Button>
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-[280px]">
          <Input
            id="policy-search"
            placeholder="Search policies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" strokeWidth={1.75} />}
          />
        </div>
        <div className="flex gap-1">
          {['all', 'active', 'draft', 'disabled'].map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`inline-flex h-8 items-center rounded-full border px-3.5 text-[12px] font-medium transition-colors ${
                  active
                    ? 'border-ink-900 bg-ink-900 text-ink-0'
                    : 'border-ink-100 bg-transparent text-ink-700 hover:border-ink-200 hover:bg-ink-50'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-ink-200 py-16 text-center">
          <p className="font-display text-[22px] leading-tight text-ink-900">No policies found.</p>
          <p className="text-[12px] text-ink-400">Try clearing your filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
          <div className="grid grid-cols-[50px_1.8fr_110px_90px_90px_90px_120px] gap-3 border-b border-ink-100 bg-ink-50 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            <div className="text-right">Pri</div>
            <div>Policy</div>
            <div>Status</div>
            <div className="text-right">Users</div>
            <div className="text-right">Apps</div>
            <div className="text-right">Conds</div>
            <div className="text-right">Updated</div>
          </div>
          {filtered.map((p) => {
            const cfg = statusConfig[p.status] || statusConfig.disabled;
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/admin/policies/${p.id}`)}
                className="grid w-full grid-cols-[50px_1.8fr_110px_90px_90px_90px_120px] items-center gap-3 border-b border-ink-100/70 px-5 py-3.5 text-left text-[13px] transition-colors last:border-b-0 hover:bg-ink-50/60"
              >
                <div className="text-right font-mono text-[12px] text-ink-400">{p.priority}</div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900">{p.name}</p>
                  {p.description && (
                    <p className="mt-0.5 truncate text-[11px] text-ink-500">{p.description}</p>
                  )}
                </div>
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-medium"
                    style={{ background: cfg.bg, color: cfg.fg }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: cfg.dot }}
                    />
                    {cfg.label}
                  </span>
                </div>
                <div className="text-right font-mono text-[12px] text-ink-700">
                  {p.affected_user_count ?? '—'}
                </div>
                <div className="text-right font-mono text-[12px] text-ink-700">
                  {p.app_count ?? '—'}
                </div>
                <div className="text-right font-mono text-[12px] text-ink-700">
                  {(p as unknown as { conditions_count?: number }).conditions_count ?? '—'}
                </div>
                <div className="text-right font-mono text-[11px] text-ink-400">
                  {formatRelative(p.updated_at)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
