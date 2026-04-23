import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Search, Download, Calendar, X, Loader2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api, type AccessEvent, type AuditLogPage as AuditPage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import Badge from '../../design-system/components/Badge';
import Input from '../../design-system/components/Input';
import Button from '../../design-system/components/Button';
import Avatar from '../../design-system/components/Avatar';

/**
 * Audit Log — virtualized TanStack-style table over a large server-paginated window.
 * Strategy: fetch a large page (default 500) matching the current filter, then
 * virtualize the rendered rows with @tanstack/react-virtual. "Load more" swaps
 * the window forward rather than accumulating (keeps memory bounded).
 */

const PAGE_SIZE = 500;
const ROW_HEIGHT = 56; // px

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

  const parentRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const q: Record<string, unknown> = { page, limit: PAGE_SIZE };
      if (search) q.search = search;
      if (outcomeFilter) q.outcome = outcomeFilter;
      if (startDate) q.startDate = new Date(startDate).toISOString();
      if (endDate) {
        // endDate is inclusive through the end of that day
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

  // Reset to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [search, outcomeFilter, startDate, endDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const items = virtualizer.getVirtualItems();
  const totalWindow = virtualizer.getTotalSize();

  const hasNext = page * PAGE_SIZE < total;
  const hasPrev = page > 1;

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Audit Log</h1>
          <p className="text-xs text-text-muted">Append-only record of every access decision.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Download className="h-3.5 w-3.5" />}
          onClick={exportJson}
          disabled={events.length === 0}
        >
          Export page
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex-1 min-w-[220px]">
          <label className="mb-1 block text-[11px] font-medium text-text-muted">Search</label>
          <Input
            id="audit-search"
            placeholder="User, email, app, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-text-muted">Outcome</label>
          <div className="flex gap-1">
            {([
              ['', 'All'],
              ['allowed', 'Allowed'],
              ['denied', 'Denied'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setOutcomeFilter(val)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  outcomeFilter === val
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-text-muted">From</label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface pl-8 pr-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-text-muted">To</label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface pl-8 pr-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {filtersDirty && (
          <button
            onClick={resetFilters}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-text-muted hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}

        <div className="ml-auto text-right text-xs text-text-muted">
          <div>
            <span className="font-semibold text-text-primary">{total.toLocaleString()}</span> events
          </div>
          <div>
            Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </div>
        </div>
      </div>

      {/* Virtualized table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {/* Column header */}
        <div className="grid grid-cols-[168px_1.4fr_1.2fr_110px_1.5fr_180px] gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          <div>Time</div>
          <div>User</div>
          <div>Application</div>
          <div>Outcome</div>
          <div>Reason</div>
          <div>IP / Location</div>
        </div>

        {loading ? (
          <div className="flex h-[400px] items-center justify-center text-sm text-text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center text-sm text-text-muted">
            No events match your filters.
          </div>
        ) : (
          <div
            ref={parentRef}
            className="relative overflow-auto"
            style={{ height: 'min(640px, 70vh)', contain: 'strict' }}
          >
            <div style={{ height: totalWindow, position: 'relative' }}>
              {items.map((virtualRow) => {
                const ev = events[virtualRow.index];
                const allowed = ev.outcome === 'allow' || ev.outcome === 'allowed';
                const isExpanded = expanded === ev.id;
                return (
                  <div
                    key={ev.id}
                    data-index={virtualRow.index}
                    className={`absolute left-0 right-0 grid cursor-pointer grid-cols-[168px_1.4fr_1.2fr_110px_1.5fr_180px] items-center gap-3 border-b border-border/50 px-4 text-xs transition-colors hover:bg-surface-2/60 ${
                      isExpanded ? 'bg-primary/5' : ''
                    }`}
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => setExpanded(isExpanded ? null : ev.id)}
                  >
                    <div className="font-mono text-text-secondary whitespace-nowrap">
                      {formatDateTime(ev.timestamp)}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={ev.user_name} size="xs" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text-primary">{ev.user_name || '—'}</p>
                        <p className="truncate text-[10px] text-text-muted">{ev.user_email || ''}</p>
                      </div>
                    </div>
                    <div className="truncate text-text-primary">{ev.app_name || '—'}</div>
                    <div>
                      <Badge variant={allowed ? 'success' : 'danger'} dot>
                        {ev.outcome}
                      </Badge>
                    </div>
                    <div className="truncate text-text-muted">
                      {ev.deny_reason?.replace(/_/g, ' ') || (allowed ? ev.policy_name || '—' : '—')}
                    </div>
                    <div className="font-mono text-text-secondary">
                      {ev.ip_address || '—'}
                      {ev.geo_country ? ` · ${ev.geo_country}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pager */}
        {!loading && events.length > 0 && (
          <div className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-2.5 text-xs text-text-muted">
            <span>
              Showing rows {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (() => {
        const ev = events.find((e) => e.id === expanded);
        if (!ev) return null;
        return (
          <div className="rounded-xl border border-border bg-surface-2 p-4 animate-fade-in">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Event detail</h3>
              <button
                onClick={() => setExpanded(null)}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="overflow-x-auto text-xs text-text-secondary">
              {JSON.stringify(ev, null, 2)}
            </pre>
          </div>
        );
      })()}
    </div>
  );
}
