import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Loading from "@/components/widgets/loading";

interface DataTableProps<TData extends object> {
  title: string;
  data: TData[];
  columns: ColumnDef<TData, any>[];
  pageSize?: number;
  storageKey?: string;
  searchColumn?: string;
}

export function DataTable<TData extends object>({
  title,
  data,
  columns,
  pageSize = 10,
  storageKey,
  searchColumn = "catname",
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [isMounted, setIsMounted] = React.useState(false);

  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: pageSize,
  });

  React.useEffect(() => {
    setIsMounted(true);
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setPagination({
            pageIndex: parsed.pageIndex || 0,
            pageSize: pageSize,
          });
        } catch (e) {
          console.error("Failed to parse saved pagination", e);
        }
      }
    }
  }, [storageKey, pageSize]);

  React.useEffect(() => {
    if (isMounted && storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(pagination));
    }
  }, [pagination, storageKey, isMounted]);

  const memoData = React.useMemo(() => data, [data]);
  const memoColumns = React.useMemo(() => columns, [columns]);

  const table = useReactTable({
    data: memoData,
    columns: memoColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    autoResetPageIndex: false,
  });

  React.useEffect(() => {
    if (isMounted) {
      table.setPageIndex(0);
    }
  }, [columnFilters, table, isMounted]);

  const searchValue =
    (table.getColumn(searchColumn)?.getFilterValue() as string) ?? "";

  if (!isMounted) {
    return (
      <div className="bg-background text-foreground p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="flex items-center py-4">
          <Input
            placeholder={`Search ${searchColumn}`}
            className="max-w-sm"
            value=""
            onChange={() => { }}
          />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {typeof header.column.columnDef.header === "function"
                        ? header.column.columnDef.header(header.getContext())
                        : header.column.columnDef.header}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-muted-foreground">
            Page 1 of {Math.ceil(data.length / pageSize)}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">{title}</h2>

      <div className="flex items-center py-4">
        <Input
          placeholder={`Search ${searchColumn}`}
          value={searchValue}
          onChange={(e) => {
            const col = table.getColumn(searchColumn);
            if (col) col.setFilterValue(e.target.value);
          }}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {typeof header.column.columnDef.header === "function"
                      ? header.column.columnDef.header(header.getContext())
                      : header.column.columnDef.header}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {typeof cell.column.columnDef.cell === "function"
                        ? cell.column.columnDef.cell(cell.getContext())
                        : cell.getValue()}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}





interface ServerDataTableProps<TData extends object> {
  title: string;
  data: TData[];
  columns: ColumnDef<TData, any>[];
  pageSize?: number;
  searchColumn?: string;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSearch?: (searchTerm: string) => void;
  loading?: boolean;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export function ServerDataTable<TData extends object>({
  title,
  data,
  columns,
  pageSize = 10,
  searchColumn = "catname",
  totalCount,
  currentPage,
  totalPages,
  onPageChange,
  onSearch,
  loading = false,
  onNextPage,
  onPreviousPage,
  hasNextPage = false,
  hasPreviousPage = false,
}: ServerDataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [searchTimeout, setSearchTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const [localSearchValue, setLocalSearchValue] = React.useState("");

  const memoData = React.useMemo(() => data, [data]);
  const memoColumns = React.useMemo(() => columns, [columns]);

  const table = useReactTable({
    data: memoData,
    columns: memoColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
    manualPagination: true,
    pageCount: totalPages,
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchValue(value);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      if (onSearch) {
        onSearch(value);
      }
    }, 500);

    setSearchTimeout(timeout);
  };

  const handleNextPage = () => {
    if (onNextPage) {
      onNextPage();
    } else {
      onPageChange(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (onPreviousPage) {
      onPreviousPage();
    } else {
      onPageChange(currentPage - 1);
    }
  };

  const canNextPage = onNextPage ? hasNextPage : currentPage < totalPages;
  const canPreviousPage = onPreviousPage ? hasPreviousPage : currentPage > 1;

  const startEntry = totalCount === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
  const endEntry = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="bg-background text-foreground p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">{title}</h2>

      <div className="flex items-center py-4">
        <Input
          placeholder={`Search ${searchColumn}`}
          value={localSearchValue}
          onChange={handleSearch}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {typeof header.column.columnDef.header === "function"
                      ? header.column.columnDef.header(header.getContext())
                      : header.column.columnDef.header}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex justify-center items-center h-24">
                    <Loading />
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {typeof cell.column.columnDef.cell === "function"
                        ? cell.column.columnDef.cell(cell.getContext())
                        : cell.getValue()}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-sm text-muted-foreground">
          {totalCount > 0 ? (
            <>Showing {startEntry} to {endEntry} of {totalCount} entries</>
          ) : (
            <>Showing 0 entries</>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={!canPreviousPage || loading}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!canNextPage || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}