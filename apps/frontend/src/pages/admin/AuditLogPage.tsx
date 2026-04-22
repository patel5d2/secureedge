import { useEffect, useState, useCallback } from 'react';
import { Search, Download, ChevronDown } from 'lucide-react';
import { api, type AccessEvent, type AuditLogPage as AuditPage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import Badge from '../../design-system/components/Badge';
import Input from '../../design-system/components/Input';
import Button from '../../design-system/components/Button';
import Table, { type TableColumn } from '../../design-system/components/Table';
import Avatar from '../../design-system/components/Avatar';
import type { PaginationState } from '@tanstack/react-table';

export default function AuditLogPage() {
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const q: Record<string, unknown> = { page: pagination.pageIndex + 1, limit: pagination.pageSize };
      if (search) q.search = search;
      if (outcomeFilter) q.outcome = outcomeFilter;
      const r = await api.get<AuditPage>('/admin/audit-log', q);
      setEvents(r.events); setTotal(r.total);
    } catch { /* noop */ }
    setLoading(false);
  }, [pagination, search, outcomeFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const pageCount = Math.ceil(total / pagination.pageSize);

  const columns: TableColumn<AccessEvent>[] = [
    { accessorKey: 'timestamp', header: 'Time', cell: ({ row }) => <span className="text-xs font-mono text-text-secondary whitespace-nowrap">{formatDateTime(row.original.timestamp)}</span> },
    { id: 'user', header: 'User', cell: ({ row }) => (
      <div className="flex items-center gap-2"><Avatar name={row.original.user_name} size="xs" /><div><p className="text-xs font-medium">{row.original.user_name || '—'}</p></div></div>
    )},
    { id: 'app', header: 'Application', cell: ({ row }) => <span className="text-xs">{row.original.app_name || '—'}</span> },
    { accessorKey: 'outcome', header: 'Outcome', cell: ({ row }) => <Badge variant={row.original.outcome === 'allow' || row.original.outcome === 'allowed' ? 'success' : 'danger'} dot>{row.original.outcome}</Badge> },
    { id: 'reason', header: 'Reason', cell: ({ row }) => <span className="text-xs text-text-muted">{row.original.deny_reason?.replace(/_/g, ' ') || '—'}</span> },
    { id: 'ip', header: 'IP / Location', cell: ({ row }) => <span className="text-xs font-mono text-text-secondary">{row.original.ip}{row.original.country ? ` · ${row.original.country}` : ''}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Audit Log</h1>
        <Button variant="secondary" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>Export</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-72"><Input id="audit-search" placeholder="Search events…" value={search} onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }} leftIcon={<Search className="h-4 w-4" />} /></div>
        <div className="flex gap-2">
          {[['', 'All'], ['allowed', 'Allowed'], ['denied', 'Denied']].map(([val, label]) => (
            <button key={val} onClick={() => { setOutcomeFilter(val); setPagination(p => ({ ...p, pageIndex: 0 })); }} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${outcomeFilter === val ? 'bg-primary text-white' : 'bg-surface-2 text-text-secondary hover:text-text-primary'}`}>{label}</button>
          ))}
        </div>
        <span className="ml-auto text-xs text-text-muted">{total.toLocaleString()} events</span>
      </div>

      <Table
        data={events} columns={columns} loading={loading}
        manualPagination pageCount={pageCount} pagination={pagination} onPaginationChange={setPagination} totalRows={total}
        onRowClick={(ev) => setExpanded(expanded === ev.id ? null : ev.id)}
        dense emptyMessage="No events match your filters."
      />

      {/* Expanded detail */}
      {expanded && (() => {
        const ev = events.find(e => e.id === expanded);
        if (!ev) return null;
        return (
          <div className="rounded-lg border border-border bg-surface-2 p-4 animate-fade-in">
            <h3 className="text-sm font-semibold mb-2">Event Detail</h3>
            <pre className="text-xs text-text-secondary overflow-x-auto">{JSON.stringify(ev, null, 2)}</pre>
          </div>
        );
      })()}
    </div>
  );
}
