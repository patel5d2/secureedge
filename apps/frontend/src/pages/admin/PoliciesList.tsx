import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api, type Policy, type PoliciesResponse } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import Badge from '../../design-system/components/Badge';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import Table, { type TableColumn } from '../../design-system/components/Table';
import Spinner from '../../design-system/components/Spinner';

const statusVariant = { active: 'success', draft: 'warning', disabled: 'gray' } as const;

export default function PoliciesList() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    api.get<PoliciesResponse>('/admin/policies').then((r) => { setPolicies(r.policies); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = policies.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const columns: TableColumn<Policy>[] = [
    { accessorKey: 'name', header: 'Policy', cell: ({ row }) => (
      <div><span className="font-medium text-text-primary">{row.original.name}</span>{row.original.description && <p className="mt-0.5 text-xs text-text-muted line-clamp-1">{row.original.description}</p>}</div>
    )},
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusVariant[row.original.status] || 'gray'} dot>{row.original.status}</Badge> },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <span className="font-mono text-xs">{row.original.priority}</span> },
    { id: 'affected', header: 'Users', cell: ({ row }) => <span className="text-xs">{row.original.affected_user_count ?? '—'}</span> },
    { id: 'apps', header: 'Apps', cell: ({ row }) => <span className="text-xs">{row.original.app_count ?? '—'}</span> },
    { accessorKey: 'updated_at', header: 'Updated', cell: ({ row }) => <span className="text-xs text-text-muted">{formatRelative(row.original.updated_at)}</span> },
  ];

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Policies</h1>
        <Link to="/admin/policies/new"><Button variant="accent" leftIcon={<Plus className="h-4 w-4" />}>New Policy</Button></Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-72"><Input id="policy-search" placeholder="Search policies…" value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search className="h-4 w-4" />} /></div>
        <div className="flex gap-2">
          {['all', 'active', 'draft', 'disabled'].map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-surface-2 text-text-secondary hover:text-text-primary'}`}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>
      <Table data={filtered} columns={columns} pageSize={10} onRowClick={(p) => navigate(`/admin/policies/${p.id}`)} emptyMessage="No policies found." />
    </div>
  );
}
