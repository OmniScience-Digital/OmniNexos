// src/app/attendance/page.tsx
import { client } from "@/services/schema";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/table/datatable";
import Loading from "@/components/widgets/loading";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { formatDate } from "@/utils/helper/time";

// ── Types ─────────────────────────────────────────────────────────────────────

type VerificationStatus = "VERIFIED" | "PENDING_VERIFICATION" | "REVIEW_REQUIRED";

interface ClockRecord {
  id: string;
  userId: string;
  employeeName: string;
  clockInTime: string;
  clockOutTime?: string | null;
  hoursWorked?: number | null;
  clockInLat?: number | null;
  clockInLng?: number | null;
  clockOutLat?: number | null;
  clockOutLng?: number | null;
  clockInAddress?: string | null;
  clockOutAddress?: string | null;
  verificationStatus: VerificationStatus;
  similarityScore?: number | null;
  syncedOffline: boolean;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

type ActiveTab = "today" | "week" | "all" | "review";

// ── Helpers ───────────────────────────────────────────────────────────────────

const safeFormatTime = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-ZA", {
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch { return "—"; }
};

const formatHours = (h?: number | null) =>
  h == null ? "—" : `${h.toFixed(1)}h`;

const getTodayDate = () => new Date().toISOString().split("T")[0];

const getWeekAgoDate = () =>
  new Date(Date.now() - 7 * 24 * 3600000).toISOString().split("T")[0];

const statusBadge = (status: VerificationStatus) => {
  switch (status) {
    case "VERIFIED":
      return <Badge className="bg-green-100 text-green-700 border-green-200 border">Verified</Badge>;
    case "PENDING_VERIFICATION":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border">Pending Sync</Badge>;
    case "REVIEW_REQUIRED":
      return <Badge className="bg-red-100 text-red-700 border-red-200 border">Review Required</Badge>;
  }
};

// ── CSV export ────────────────────────────────────────────────────────────────

const exportCSV = (records: ClockRecord[], filename: string) => {
  const headers = ["Employee", "Date", "Clock In", "Clock Out", "Hours Worked", "Status", "Location", "Offline"];
  const rows = records.map((r) => [
    r.employeeName,
    r.date,
    safeFormatTime(r.clockInTime),
    safeFormatTime(r.clockOutTime),
    formatHours(r.hoursWorked),
    r.verificationStatus,
    r.clockInAddress ?? "",
    r.syncedOffline ? "Yes" : "No",
  ]);
  const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Column definitions ────────────────────────────────────────────────────────

const columns: ColumnDef<ClockRecord, any>[] = [
  {
    accessorKey: "employeeName",
    header: "Employee",
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.employeeName}</span>
    ),
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="text-slate-600 text-sm">{formatDate(row.original.date)}</span>
    ),
  },
  {
    accessorKey: "clockInTime",
    header: "Clock In",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{safeFormatTime(row.original.clockInTime)}</span>
    ),
  },
  {
    accessorKey: "clockOutTime",
    header: "Clock Out",
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.original.clockOutTime
          ? safeFormatTime(row.original.clockOutTime)
          : <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">Open</Badge>
        }
      </span>
    ),
  },
  {
    accessorKey: "hoursWorked",
    header: "Hours",
    cell: ({ row }) => (
      <span className="font-semibold text-sm">{formatHours(row.original.hoursWorked)}</span>
    ),
  },
  {
    accessorKey: "verificationStatus",
    header: "Status",
    cell: ({ row }) => statusBadge(row.original.verificationStatus),
  },
  {
    accessorKey: "clockInAddress",
    header: "Location",
    cell: ({ row }) => (
      <span className="text-slate-500 text-xs truncate max-w-[180px] block">
        {row.original.clockInAddress ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "syncedOffline",
    header: "Offline",
    cell: ({ row }) => row.original.syncedOffline
      ? <Badge className="bg-blue-100 text-blue-700 border-blue-200 border text-xs">Offline</Badge>
      : null,
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const [records,    setRecords]    = useState<ClockRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<ActiveTab>("today");
  const [searchTerm, setSearchTerm] = useState("");

  // ── Fetch all records with pagination ──────────────────────────────────────
  const fetchRecords = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      let all: ClockRecord[]               = [];
      let token: string | null | undefined = null;

      do {
        const result: any = await client.models.ClockRecord.list({
          limit:     100,
          nextToken: token ?? undefined,
        });
        all   = [...all, ...result.data];
        token = result.nextToken;
      } while (token);

      all.sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime());
      setRecords(all);
    } catch (e) {
      console.error("Failed to fetch attendance records:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  // ── Resolve a REVIEW_REQUIRED record ───────────────────────────────────────
  const resolveRecord = async (id: string) => {
    try {
      await (client.models.ClockRecord as any).update({
        id,
        verificationStatus: "VERIFIED",
      });
      await fetchRecords(true);
    } catch (e) {
      console.error("Failed to resolve record:", e);
    }
  };

  // ── Filtered records per tab ───────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    const today   = getTodayDate();
    const weekAgo = getWeekAgoDate();

    let base: ClockRecord[];
    switch (activeTab) {
      case "today":  base = records.filter((r) => r.date === today);              break;
      case "week":   base = records.filter((r) => r.date >= weekAgo);             break;
      case "review": base = records.filter((r) => r.verificationStatus === "REVIEW_REQUIRED"); break;
      default:       base = records;
    }

    if (!searchTerm.trim()) return base;
    const q = searchTerm.toLowerCase();
    return base.filter(
      (r) => r.employeeName.toLowerCase().includes(q) || r.date.includes(q)
    );
  }, [records, activeTab, searchTerm]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today   = getTodayDate();
    const weekAgo = getWeekAgoDate();
    return {
      uniqueToday:   new Set(records.filter((r) => r.date === today).map((r) => r.userId)).size,
      openShifts:    records.filter((r) => !r.clockOutTime).length,
      reviewNeeded:  records.filter((r) => r.verificationStatus === "REVIEW_REQUIRED").length,
      weekHours:     records
        .filter((r) => r.date >= weekAgo && r.hoursWorked != null)
        .reduce((s, r) => s + (r.hoursWorked ?? 0), 0),
    };
  }, [records]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <Loading />
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 mt-20 pb-20">
        <div className="container mx-auto max-w-7xl mt-8">

          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Attendance</h1>
                <p className="text-slate-600 max-w-2xl text-sm">
                  Monitor employee clock-in records, open shifts, and verification status.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => fetchRecords(true)}
                  disabled={refreshing}
                  className="border-slate-300"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  onClick={() => exportCSV(filteredRecords, `attendance_${activeTab}_${getTodayDate()}.csv`)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Clocked In Today", value: stats.uniqueToday,                Icon: Users,         color: "blue"  },
              { label: "Open Shifts",       value: stats.openShifts,                 Icon: Clock,         color: "amber" },
              { label: "Review Required",   value: stats.reviewNeeded,               Icon: AlertTriangle, color: "red"   },
              { label: "Hours This Week",   value: `${stats.weekHours.toFixed(1)}h`, Icon: Calendar,      color: "green" },
            ].map((s) => (
              <Card key={s.label} className="bg-background border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500">{s.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
                    </div>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center bg-${s.color}-100`}>
                      <s.Icon className={`h-5 w-5 text-${s.color}-600`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main card */}
          <Card className="border-slate-200 shadow-sm bg-background">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Clock Records</CardTitle>
                  <CardDescription>
                    {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""} shown
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search employee or date..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 w-full sm:w-64 border-slate-300 focus:border-blue-500"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)} className="px-6">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="today" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 cursor-pointer">
                    Today
                    <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-700">
                      {records.filter((r) => r.date === getTodayDate()).length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="week" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 cursor-pointer">
                    This Week
                  </TabsTrigger>
                  <TabsTrigger value="all" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 cursor-pointer">
                    All Records
                  </TabsTrigger>
                  <TabsTrigger value="review" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700 cursor-pointer">
                    Review
                    {stats.reviewNeeded > 0 && (
                      <Badge className="ml-2 bg-red-200 text-red-700">{stats.reviewNeeded}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Review panel */}
              {activeTab === "review" && filteredRecords.length > 0 && (
                <div className="px-6 mb-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700 font-medium mb-3">
                      These records need manual verification — face capture failed or was submitted offline and could not be verified automatically.
                    </p>
                    <div className="space-y-2">
                      {filteredRecords.map((r) => (
                        <div key={r.id} className="flex items-center justify-between bg-white border border-red-100 rounded-lg p-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{r.employeeName}</span>
                            <span className="text-xs text-slate-500 flex items-center gap-2">
                              {formatDate(r.date)} · {safeFormatTime(r.clockInTime)}
                              {r.clockInAddress && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {r.clockInAddress}
                                </span>
                              )}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => resolveRecord(r.id)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Mark Verified
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Empty review state */}
              {activeTab === "review" && filteredRecords.length === 0 && (
                <div className="px-6 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-green-700 font-medium">All records verified</p>
                    <p className="text-green-600 text-sm mt-1">No records require manual review.</p>
                  </div>
                </div>
              )}

              {/* Data table */}
              <div className="border-t border-slate-200">
                <DataTable
                  title="Attendance Records"
                  data={filteredRecords}
                  columns={columns}
                  pageSize={20}
                  storageKey="attendanceTablePagination"
                  searchColumn="employeeName"
                />
              </div>
            </CardContent>
          </Card>

        </div>
      </main>

      <Footer />
    </div>
  );
}