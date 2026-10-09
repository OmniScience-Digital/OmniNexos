// Presentational table for the redesigned modules (sorting + pagination).
// Search is intentionally NOT built in: each page owns one toolbar search, which
// removes the duplicate "second search box" the old table had.
import { useEffect, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSurface, TableFooter } from "./toolbar";

interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  pageSize?: number;
  /** localStorage key used to remember the current page. */
  storageKey?: string;
  noun?: string;
  emptyMessage?: string;
}

function readPage(key?: string): number {
  if (!key) return 0;
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(JSON.parse(raw)?.pageIndex ?? 0) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function DataGrid<T>({
  data,
  columns,
  pageSize = 10,
  storageKey,
  noun = "items",
  emptyMessage = "No results found.",
}: DataGridProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: readPage(storageKey), pageSize });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const total = data.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  // Keep the page index valid when the filtered data shrinks.
  useEffect(() => {
    if (pagination.pageIndex > pageCount - 1) {
      setPagination((p) => ({ ...p, pageIndex: pageCount - 1 }));
    }
  }, [pageCount, pagination.pageIndex]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ pageIndex: pagination.pageIndex }));
    } catch {
      /* storage unavailable: ignore */
    }
  }, [storageKey, pagination.pageIndex]);

  const from = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const to = Math.min((pagination.pageIndex + 1) * pagination.pageSize, total);

  return (
    <>
      <TableSurface>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>
      <TableFooter summary={`Showing ${from}–${to} of ${total} ${noun}`}>
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </Button>
        <span className="text-xs">Page {pagination.pageIndex + 1} of {pageCount}</span>
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
      </TableFooter>
    </>
  );
}
