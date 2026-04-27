import { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, Download, Calendar, X } from 'lucide-react';
import { api, type AccessEvent, type AuditLogPage as AuditPage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import Input from '../../design-system/components/Input';
import Button from '../../design-system/components/Button';
import Avatar from '../../design-system/components/Avatar';
import Table, { type TableColumn } from '../../design-system/components/Table';

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<'' | 'allowed' | 'denied'>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const q: Record<string, unknown> = { page, limit: PAGE_SIZE };
      if (search) q.search = search;
      if (outcomeFilter) q.outcome = outcomeFilter;
      if (startDate) q.startDate = new Date(startDate).toISOString();
      if (endDate) {
        const d = new Date(endDate);
        d.setHours(23, 59, 59, 999);
        q.endDate = d.toISOString();
      }
      const r = await api.get<AuditPage>('/admin/audit-log', q);
      setEvents(r.events);
      setTotal(r.total);
    } catch {
      setEvents([]);
      setTotal(0);
    }
    setLoading(false);
  }, [page, search, outcomeFilter, startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [search, outcomeFilter, startDate, endDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const resetFilters = () => {
    setSearch('');
    setOutcomeFilter('');
    setStartDate('');
    setEndDate('');
  };

  const filtersDirty = useMemo(
    () => Boolean(search || outcomeFilter || startDate || endDate),
    [search, outcomeFilter, startDate, endDate]
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-page-${page}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<TableColumn<AccessEvent>[]>(() => [
    {
      header: 'Time',
      accessorKey: 'timestamp',
      cell: (info) => <div className="font-mono text-[11px] text-ink-500">{formatDateTime(info.getValue() as string)}</div>,
    },
    {
      header: 'User',
      accessorFn: (row) => row.user_name || row.user_email,
      cell: (info) => {
        const ev = info.row.original;
        return (
          <div className="flex items-center gap-2">
            <Avatar name={ev.user_name} size="xs" />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-900">{ev.user_name || '—'}</p>
              <p className="truncate font-mono text-[10px] text-ink-400">{ev.user_email || ''}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Application',
      accessorKey: 'app_name',
      cell: (info) => <div className="truncate text-ink-900">{info.getValue() as string || '—'}</div>,
    },
    {
      header: 'Outcome',
      accessorKey: 'outcome',
      cell: (info) => {
        const val = info.getValue() as string;
        const allowed = val === 'allow' || val === 'allowed';
        return <OutcomePill allowed={allowed} label={val} />;
      },
    },
    {
      header: 'Reason',
      accessorFn: (row) => row.deny_reason || row.policy_name,
      cell: (info) => {
        const ev = info.row.original;
        const allowed = ev.outcome === 'allow' || ev.outcome === 'allowed';
        return <div className="truncate text-ink-500">{ev.deny_reason?.replace(/_/g, ' ') || (allowed ? ev.policy_name || '—' : '—')}</div>;
      },
    },
    {
      header: 'IP / location',
      accessorFn: (row) => `${row.ip_address} ${row.geo_country}`,
      cell: (info) => {
        const ev = info.row.original;
        return <div className="font-mono text-[11px] text-ink-500">{ev.ip_address || '—'}{ev.geo_country ? ` · ${ev.geo_country}` : ''}</div>;
      },
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* Editorial header */}
      <header className="flex items-end justify-between border-b border-ink-100 pb-6">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            Append-only · immutable
          </p>
          <h1 className="mt-1 font-display text-[44px] leading-[1.05] tracking-[-0.02em] text-ink-900">
            The audit log
          </h1>
          <p className="mt-2 text-[13px] text-ink-500">
            Every access decision, ever. Search, filter, export.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Download className="h-3.5 w-3.5" strokeWidth={1.75} />}
          onClick={exportJson}
          disabled={events.length === 0}
        >
          Export page
        </Button>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-100 bg-white p-4">
        <div className="min-w-[240px] flex-1">
          <Input
            id="audit-search"
            label="Search"
            placeholder="User, email, app, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" strokeWidth={1.75} />}
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            Outcome
          </label>
          <div className="flex gap-1 rounded-md border border-ink-100 bg-ink-50 p-1">
            {(
              [
                ['', 'All'],
                ['allowed', 'Allowed'],
                ['denied', 'Denied'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setOutcomeFilter(val)}
                className={`rounded px-3 py-1 text-[12px] font-medium transition-colors ${
                  outcomeFilter === val
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            From
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" strokeWidth={1.75} />
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-md border border-ink-100 bg-white pl-8 pr-2 text-[13px] text-ink-900 focus:border-signal-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            To
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" strokeWidth={1.75} />
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-md border border-ink-100 bg-white pl-8 pr-2 text-[13px] text-ink-900 focus:border-signal-500 focus:outline-none"
            />
          </div>
        </div>

        {filtersDirty && (
          <button
            onClick={resetFilters}
            className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-[12px] text-ink-500 hover:text-ink-900"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} /> Clear
          </button>
        )}

        <div className="ml-auto text-right">
          <div className="font-display text-[22px] leading-none tracking-[-0.02em] text-ink-900">
            {total.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-ink-400">
            events
          </div>
        </div>
      </div>

      {/* Table */}
      <Table
        data={events}
        columns={columns}
        loading={loading}
        emptyMessage="No events match your filters."
        manualPagination
        pageCount={Math.ceil(total / PAGE_SIZE)}
        pagination={{ pageIndex: page - 1, pageSize: PAGE_SIZE }}
        onPaginationChange={(updater) => {
          if (typeof updater === 'function') {
            const newPagination = updater({ pageIndex: page - 1, pageSize: PAGE_SIZE });
            setPage(newPagination.pageIndex + 1);
          }
        }}
        totalRows={total}
        onRowClick={(row) => setExpanded(expanded === row.id ? null : row.id)}
      />

      {expanded &&
        (() => {
          const ev = events.find((e) => e.id === expanded);
          if (!ev) return null;
          return (
            <div className="rounded-lg border border-ink-100 bg-ink-900 p-5 text-ink-0 animate-fade-in">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-0/60">
                  Event detail · {ev.id}
                </p>
                <button
                  onClick={() => setExpanded(null)}
                  className="text-ink-0/60 transition-colors hover:text-ink-0"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
              <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-ink-0/80">
                {JSON.stringify(ev, null, 2)}
              </pre>
            </div>
          );
        })()}
    </div>
  );
}

function OutcomePill({ allowed, label }: { allowed: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-medium"
      style={{
        background: allowed ? '#E8F5E7' : '#FBEAE7',
        color: allowed ? '#1F6E20' : '#8B2613',
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: allowed ? '#3CB13A' : '#D1432B' }}
      />
      {label}
    </span>
  );
}
