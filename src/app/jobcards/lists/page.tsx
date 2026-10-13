// src/app/jobcards/list/page.tsx 
// Job cards are created and opened automatically when a Xero quote is marked as accepted,
// so this page deliberately has no "create" or "open" action.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList } from "lucide-react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import Loading from "@/components/widgets/loading";
import { DataTable } from "@/components/table/datatable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { client } from "@/services/schema";
import { mapJobCard } from "@/services/jobCardTime.service";
import type { JobCard } from "@/types/jobcards.types";
import { formatMinutes } from "@/utils/helper/jobCardTime";

type Filter = "OPEN" | "CLOSED" | "ALL";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "ALL", label: "All" },
];

export default function JobCardsListPage() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("OPEN");

  useEffect(() => {
    const sub = client.models.JobCard.observeQuery().subscribe({
      next: ({ items, isSynced }) => {
        setCards(items.map((r) => mapJobCard(r as Record<string, unknown>)));
        if (isSynced) setLoading(false);
      },
      error: (e) => { console.error("[jobcards] subscription error", e); setLoading(false); },
    });
    return () => sub.unsubscribe();
  }, []);

  const rows = useMemo(
    () => cards
      .filter((c) => filter === "ALL" || c.status === filter)
      .sort((a, b) => Date.parse(b.openedAt ?? "0") - Date.parse(a.openedAt ?? "0")),
    [cards, filter],
  );

  const columns = useMemo<ColumnDef<JobCard>[]>(() => [
    { accessorKey: "jcNumber", header: "Job card", cell: ({ row }) => <span className="font-medium">{row.original.jcNumber}</span> },
    { accessorKey: "customerName", header: "Customer", cell: ({ row }) => row.original.customerName ?? "-" },
    {
      accessorKey: "status", header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "OPEN" ? "default" : "secondary"}>
          {row.original.status === "OPEN" ? "Open" : "Closed"}
        </Badge>
      ),
    },
    { accessorKey: "totalMinutes", header: "Time spent", cell: ({ row }) => <span className="tabular-nums">{formatMinutes(row.original.totalMinutes)}</span> },
    {
      accessorKey: "openedAt", header: "Opened",
      cell: ({ row }) => row.original.openedAt
        ? new Date(row.original.openedAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
        : "-",
    },
    {
      id: "view", header: "",
      cell: ({ row }) => (
        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => navigate(`/jobcards/${row.original.id}`)}>View</Button>
      ),
    },
  ], [navigate]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      {loading ? (
        <Loading />
      ) : (
        <main className="flex-1 px-2 sm:px-4 mt-25 pb-20">
          <div className="container mx-auto max-w-7xl mt-5">
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Job Cards
                  <Badge variant="secondary" className="text-xs">{rows.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-2">
                  {FILTERS.map((f) => (
                    <Button
                      key={f.value} size="sm" className="h-8 text-xs cursor-pointer"
                      variant={filter === f.value ? "default" : "outline"} onClick={() => setFilter(f.value)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
            <DataTable title="" data={rows} columns={columns} searchColumn="jcNumber" storageKey="jobcards-list" />
          </div>
        </main>
      )}
      <Footer />
    </div>
  );
}