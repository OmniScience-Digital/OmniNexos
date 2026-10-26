// src/app/jobcards/list/page.tsx 
// Job cards are created and opened automatically when a Xero quote is marked as accepted,
// so this page deliberately has no "create" or "open" action.
//
// Paging: one page at a time, read from the status index. Open is the default and Closed job cards are
// only requested when the Closed or All filter is chosen.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ClipboardList, Loader2, RefreshCw, Search, X } from "lucide-react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { client } from "@/services/schema";
import { findJobCards, jobCardBackendReady, loadJobCardsPage } from "@/services/jobCardTime.service";
import type { JobCard } from "@/types/jobcards.types";
import {
  DEFAULT_PAGE_SIZE, PAGE_SIZES, type PageCursor, type StatusFilter,
} from "@/utils/helper/jobCardPaging";
import BackendNotReady from "../components/BackendNotReady";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "ALL", label: "All" },
];

const EMPTY_TEXT: Record<StatusFilter, string> = {
  OPEN: "No open job cards. They are created automatically when a Xero quote is accepted.",
  CLOSED: "No closed job cards.",
  ALL: "No job cards yet.",
};

interface PageData { key: string; items: JobCard[]; next: PageCursor | null; error?: string }

export default function JobCardsListPage() {
  const navigate = useNavigate();
  const ready = jobCardBackendReady();

  const [filter, setFilter] = useState<StatusFilter>("OPEN"); // always start on Open
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [cursors, setCursors] = useState<(PageCursor | null)[]>([null]); // cursors[i] is where page i starts
  const [pageIndex, setPageIndex] = useState(0);
  const [nonce, setNonce] = useState(0); // bumped to force a re-read
  const [data, setData] = useState<PageData | null>(null);

  const [term, setTerm] = useState("");
  const [found, setFound] = useState<{ term: string; items: JobCard[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const cursor = cursors[pageIndex] ?? null;
  const requestKey = `${filter}|${pageSize}|${pageIndex}|${nonce}|${cursor?.status ?? ""}:${cursor?.token ?? ""}`;
  const loading = ready && data?.key !== requestKey;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    loadJobCardsPage(filter, cursor, pageSize)
      .then((res:any) => { if (!cancelled) setData({ key: requestKey, ...res }); })
      .catch((e:any) => {
        console.error("[jobcards] load failed", e);
        if (!cancelled) setData({ key: requestKey, items: [], next: null, error: e instanceof Error ? e.message : "Could not load job cards." });
      });
    return () => { cancelled = true; };
  }, [ready, filter, cursor, pageSize, requestKey]);

  // A new job card appears the moment a quote is accepted: re-read the current page.
  useEffect(() => {
    if (!ready) return;
    const sub = client.models.JobCard.onCreate().subscribe({
      next: () => setNonce((n) => n + 1),
      error: (e) => console.error("[jobcards] live updates unavailable", e),
    });
    return () => sub.unsubscribe();
  }, [ready]);

  const resetPaging = () => { setCursors([null]); setPageIndex(0); };
  const changeFilter = (f: StatusFilter) => { setFilter(f); resetPaging(); };
  const changePageSize = (n: number) => { setPageSize(n); resetPaging(); };
  const goNext = () => {
    if (!data?.next) return;
    const next = data.next;
    setCursors((c) => { const copy = c.slice(0, pageIndex + 1); copy[pageIndex + 1] = next; return copy; });
    setPageIndex((i) => i + 1);
  };
  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));

  const runSearch = async () => {
    const t = term.trim();
    if (!t) return;
    setSearching(true);
    setSearchError(null);
    try { setFound({ term: t, items: await findJobCards(t) }); }
    catch (e) { setSearchError(e instanceof Error ? e.message : "Search failed."); }
    finally { setSearching(false); }
  };
  const clearSearch = () => { setFound(null); setTerm(""); setSearchError(null); };

  const rows = found ? found.items : data?.items ?? [];
  const from = pageIndex * pageSize + 1;
  const to = pageIndex * pageSize + rows.length;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="flex-1 px-2 sm:px-4 mt-25 pb-20">
        <div className="container mx-auto max-w-7xl mt-3 space-y-3">
          {!ready ? (
            <BackendNotReady />
          ) : (
            <>
              {/* One compact toolbar: title, filters, search, refresh */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="flex items-center gap-2 text-lg font-semibold">
                  <ClipboardList className="h-4 w-4" /> Job Cards
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1" role="group" aria-label="Status filter">
                    {FILTERS.map((f) => (
                      <Button
                        key={f.value} size="sm" className="h-8 cursor-pointer px-3 text-xs"
                        variant={filter === f.value && !found ? "default" : "outline"}
                        onClick={() => { clearSearch(); changeFilter(f.value); }}
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                  <form className="relative" onSubmit={(e) => { e.preventDefault(); void runSearch(); }}>
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="h-8 w-56 pl-8 text-xs" placeholder="Find JC or quote no. (Enter)"
                      value={term} onChange={(e) => setTerm(e.target.value)}
                    />
                  </form>
                  <Button size="icon-sm" variant="outline" className="cursor-pointer" aria-label="Refresh" onClick={() => setNonce((n) => n + 1)}>
                    <RefreshCw className={loading ? "animate-spin" : ""} />
                  </Button>
                </div>
              </div>

              {found && (
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
                  <span>{found.items.length} result{found.items.length === 1 ? "" : "s"} for <strong>{found.term}</strong></span>
                  <Button size="sm" variant="ghost" className="h-7 cursor-pointer" onClick={clearSearch}><X className="mr-1 h-3.5 w-3.5" /> Clear</Button>
                </div>
              )}
              {searching && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...</p>}
              {(searchError || data?.error) && (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{searchError ?? data?.error}</p>
              )}

              <Card className="shadow-none overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job card</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && !found
                        ? Array.from({ length: Math.min(pageSize, 8) }, (_, i) => (
                            <TableRow key={i}>
                              <TableCell colSpan={3}><div className="h-5 w-full animate-pulse rounded bg-muted" /></TableCell>
                            </TableRow>
                          ))
                        : rows.map((c) => (
                            <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/jobcards/${c.id}`)}>
                              <TableCell>
                                <Link to={`/jobcards/${c.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{c.jcNumber}</Link>
                                {/* Only marked when closed, so the All filter stays readable. */}
                                {c.status === "CLOSED" && <Badge variant="secondary" className="ml-2 text-[10px]">Closed</Badge>}
                              </TableCell>
                              <TableCell>{c.customerName ?? "-"}</TableCell>
                              <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                            </TableRow>
                          ))}
                      {!loading && rows.length === 0 && !data?.error && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                            {found ? `No job card matches "${found.term}".` : EMPTY_TEXT[filter]}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Pager (hidden for search results, which are a short exact lookup) */}
              {!found && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {rows.length > 0 ? `Showing ${from}-${to}` : "No rows"}{filter !== "OPEN" ? "" : " (open job cards only)"}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Rows per page</span>
                    <Select value={String(pageSize)} onValueChange={(v) => changePageSize(Number(v))}>
                      <SelectTrigger className="h-8 w-16 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-8 cursor-pointer" disabled={pageIndex === 0 || loading} onClick={goPrev}>
                      <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground">Page {pageIndex + 1}</span>
                    <Button size="sm" variant="outline" className="h-8 cursor-pointer" disabled={!data?.next || loading} onClick={goNext}>
                      Next <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}