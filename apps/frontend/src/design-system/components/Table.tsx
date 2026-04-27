import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

export type TableColumn<T> = ColumnDef<T, unknown>;

interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  pageSize?: number;
  emptyMessage?: string;
  className?: string;
  dense?: boolean;
  zebra?: boolean;
  onRowClick?: (row: T) => void;
  // Manual pagination (server-side)
  manualPagination?: boolean;
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  totalRows?: number;
  loading?: boolean;
}

export default function Table<T>({
  data,
  columns,
  pageSize = 10,
  emptyMessage = 'No records yet.',
  className = '',
  dense = false,
  zebra = false,
  onRowClick,
  manualPagination = false,
  pageCount,
  pagination,
  onPaginationChange,
  totalRows,
  loading = false,
}: TableProps<T>) {
  const initialPagination = useMemo<PaginationState>(() => ({ pageIndex: 0, pageSize }), [pageSize]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination,
    pageCount: manualPagination ? pageCount ?? -1 : undefined,
    state: {
      sorting,
      ...(manualPagination && pagination ? { pagination } : {}),
    },
    onSortingChange: setSorting,
    onPaginationChange: manualPagination ? onPaginationChange : undefined,
    initialState: !manualPagination ? { pagination: initialPagination } : undefined,
  });

  const rows = table.getRowModel().rows;
  const paddingY = dense ? 'py-1.5' : 'py-3';
  const currentPageIndex = manualPagination && pagination ? pagination.pageIndex : table.getState().pagination.pageIndex;
  const totalPages = manualPagination ? pageCount ?? 1 : table.getPageCount();

  return (
    <div className={`overflow-hidden rounded-lg border border-border bg-surface ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-surface-2">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`border-b border-border px-4 ${paddingY} text-left text-xs font-semibold uppercase tracking-wider text-text-secondary ${
                      header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-surface-2' : ''
                    }`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-text-muted">
                          {{
                            asc: <ArrowUp className="h-3 w-3" />,
                            desc: <ArrowDown className="h-3 w-3" />,
                          }[header.column.getIsSorted() as string] ?? <ChevronsUpDown className="h-3 w-3" />}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={`border-b border-border last:border-0 transition-colors hover:bg-surface-2 ${
                    zebra && idx % 2 === 1 ? 'bg-surface-2/40' : ''
                  } ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`px-4 ${paddingY} text-sm text-text-primary align-middle`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-text-secondary">
          <div>
            Page <span className="font-medium text-text-primary">{currentPageIndex + 1}</span> of{' '}
            <span className="font-medium text-text-primary">{totalPages}</span>
            {totalRows !== undefined && <span className="ml-2 text-text-muted">· {totalRows} rows</span>}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-2 disabled:opacity-40"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-2 disabled:opacity-40"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
