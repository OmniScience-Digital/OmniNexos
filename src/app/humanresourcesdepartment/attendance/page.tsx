// src/app/humanresourcesdepartment/attendance/page.tsx — Manager view
import { client } from "@/services/schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import Loading from "@/components/widgets/loading";
import ResponseModal from "@/components/widgets/response";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getUrl } from "aws-amplify/storage";
import {
  AlertTriangle, Calendar, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, Clock,
  Download, Eye, MapPin, RefreshCw, Search, Users, X,
} from "lucide-react";
import { formatDate } from "@/utils/helper/time";

// ── Types ─────────────────────────────────────────────────────────────────────
type VerifStatus = "VERIFIED" | "PENDING_VERIFICATION" | "REVIEW_REQUIRED";
type TabKey      = "today" | "week" | "all" | "review";

interface ClockRecord {
  id: string; userId: string; employeeName: string;
  clockInTime: string; clockOutTime?: string | null;
  hoursWorked?: number | null;
  clockInLat?: number | null; clockInLng?: number | null;
  clockOutLat?: number | null; clockOutLng?: number | null;
  clockInAddress?: string | null; clockOutAddress?: string | null;
  verificationStatus: VerifStatus;
  similarityScore?: number | null;
  syncedOffline: boolean; date: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (iso?: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }); }
  catch { return "—"; }
};
const fmtHours = (h?: number | null) => h == null ? "—" : `${h.toFixed(1)}h`;
const today    = () => new Date().toISOString().split("T")[0];
const weekAgo  = () => new Date(Date.now() - 7 * 24 * 3600000).toISOString().split("T")[0];

const exportCSV = (records: ClockRecord[], name: string) => {
  const headers = ["Employee", "Date", "Clock In", "Clock Out", "Hours", "Status", "Clock In Location", "Clock Out Location", "Offline"];
  const rows    = records.map((r) => [
    r.employeeName, r.date, fmtTime(r.clockInTime), fmtTime(r.clockOutTime),
    fmtHours(r.hoursWorked), r.verificationStatus,
    r.clockInAddress ?? "", r.clockOutAddress ?? "",
    r.syncedOffline ? "Yes" : "No",
  ]);
  const csv  = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

// ── Status badge ──────────────────────────────────────────────────────────────
function VerifBadge({ status }: { status: VerifStatus }) {
  switch (status) {
    case "VERIFIED":             return <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">Verified</Badge>;
    case "PENDING_VERIFICATION": return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">Pending</Badge>;
    case "REVIEW_REQUIRED":      return <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">Review</Badge>;
  }
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function RecordDetailModal({ record, onClose, onResolve }: {
  record: ClockRecord;
  onClose: () => void;
  onResolve: (id: string) => void;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const s3Key = `hr/reference-faces/${record.userId}/profile.jpg`;

  useEffect(() => {
    getUrl({ path: s3Key }).then(({ url }) => setPhotoUrl(url.toString())).catch(() => setPhotoUrl(null));
  }, [s3Key]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {/* Reference photo */}
            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              {photoUrl
                ? <img src={photoUrl} alt="" className="w-full h-full object-cover" onError={() => setPhotoUrl(null)} />
                : <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">
                    {record.employeeName.charAt(0).toUpperCase()}
                  </div>
              }
            </div>
            <div>
              <p className="font-semibold text-foreground">{record.employeeName}</p>
              <p className="text-xs text-slate-500">{formatDate(record.date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <VerifBadge status={record.verificationStatus} />
            <button onClick={onClose} className="text-slate-400 hover:text-foreground p-1 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
              <p className="text-xs text-green-600 font-medium mb-1">Clock In</p>
              <p className="text-lg font-bold text-green-700 font-mono">{fmtTime(record.clockInTime)}</p>
              <p className="text-xs text-green-600 mt-0.5">{record.clockInTime ? new Date(record.clockInTime).toLocaleDateString("en-ZA") : ""}</p>
            </div>
            <div className={`rounded-xl p-3 border ${record.clockOutTime ? "bg-slate-50 border-slate-100" : "bg-amber-50 border-amber-100"}`}>
              <p className={`text-xs font-medium mb-1 ${record.clockOutTime ? "text-slate-600" : "text-amber-600"}`}>Clock Out</p>
              <p className={`text-lg font-bold font-mono ${record.clockOutTime ? "text-foreground" : "text-amber-600"}`}>
                {record.clockOutTime ? fmtTime(record.clockOutTime) : "Still open"}
              </p>
              {record.hoursWorked != null && (
                <p className="text-xs text-slate-500 mt-0.5">{fmtHours(record.hoursWorked)} worked</p>
              )}
            </div>
          </div>

          {/* Locations */}
          {(record.clockInAddress || record.clockOutAddress) && (
            <div className="space-y-2">
              {record.clockInAddress && (
                <div className="flex gap-2">
                  <MapPin className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Clock In Location</p>
                    <p className="text-sm text-foreground">{record.clockInAddress}</p>
                    {record.clockInLat && record.clockInLng && (
                      <a
                        href={`https://maps.google.com/?q=${record.clockInLat},${record.clockInLng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:underline"
                      >
                        View on Google Maps →
                      </a>
                    )}
                  </div>
                </div>
              )}
              {record.clockOutAddress && (
                <div className="flex gap-2">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Clock Out Location</p>
                    <p className="text-sm text-foreground">{record.clockOutAddress}</p>
                    {record.clockOutLat && record.clockOutLng && (
                      <a
                        href={`https://maps.google.com/?q=${record.clockOutLat},${record.clockOutLng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:underline"
                      >
                        View on Google Maps →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Extra flags */}
          <div className="flex gap-2 flex-wrap">
            {record.syncedOffline && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 border text-xs">Submitted offline</Badge>
            )}
            {record.similarityScore != null && (
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 border text-xs">
                Face match {(record.similarityScore * 100).toFixed(0)}%
              </Badge>
            )}
          </div>
        </div>

        {/* Footer */}
        {record.verificationStatus === "REVIEW_REQUIRED" && (
          <div className="p-5 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500 mb-3">
              This record needs manual verification. Review the location and details above before approving.
            </p>
            <Button
              onClick={() => onResolve(record.id)}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark as Verified
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sortable table header ─────────────────────────────────────────────────────
type SortKey = "employeeName" | "date" | "clockInTime" | "hoursWorked" | "verificationStatus";

function SortHeader({ label, sortKey, current, dir, onClick }: {
  label: string; sortKey: SortKey; current: SortKey; dir: "asc" | "desc";
  onClick: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onClick(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col">
          <ChevronUp   className={`h-2.5 w-2.5 ${active && dir === "asc"  ? "text-indigo-600" : "text-slate-300"}`} />
          <ChevronDown className={`h-2.5 w-2.5 ${active && dir === "desc" ? "text-indigo-600" : "text-slate-300"} -mt-0.5`} />
        </span>
      </div>
    </th>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────
const PAGE_SIZE = 15;

export default function AdminAttendancePage() {
  const [records,     setRecords]     = useState<ClockRecord[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeTab,   setActiveTab]   = useState<TabKey>("today");
  const [search,      setSearch]      = useState("");
  const [selected,    setSelected]    = useState<ClockRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey,     setSortKey]     = useState<SortKey>("clockInTime");
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("desc");
  const [show,        setShow]        = useState(false);
  const [successful,  setSuccessful]  = useState(false);
  const [message,     setMessage]     = useState("");

  // ── Fetch all with pagination ───────────────────────────────────────────────
  const fetchAll = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      let all: ClockRecord[] = [];
      let token: string | null | undefined = null;
      do {
        const r: any = await client.models.ClockRecord.list({ limit: 100, nextToken: token ?? undefined });
        all   = [...all, ...r.data];
        token = r.nextToken;
      } while (token);
      setRecords(all);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Resolve record ──────────────────────────────────────────────────────────
  const resolveRecord = async (id: string) => {
    try {
      await (client.models.ClockRecord as any).update({ id, verificationStatus: "VERIFIED" });
      setRecords((prev) => prev.map((r) => r.id === id ? { ...r, verificationStatus: "VERIFIED" } : r));
      setSelected(null);
      setSuccessful(true);
      setMessage("Record marked as verified.");
    } catch {
      setSuccessful(false);
      setMessage("Failed to update record.");
    }
    setShow(true);
  };

  // ── Sort handler ────────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };

  // ── Filtered + sorted + paginated ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const t = today(); const w = weekAgo();
    let base = records;
    if (activeTab === "today")  base = records.filter((r) => r.date === t);
    if (activeTab === "week")   base = records.filter((r) => r.date >= w);
    if (activeTab === "review") base = records.filter((r) => r.verificationStatus === "REVIEW_REQUIRED");
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter((r) => r.employeeName.toLowerCase().includes(q) || r.date.includes(q));
    }
    return [...base].sort((a, b) => {
      let av: any = a[sortKey] ?? ""; let bv: any = b[sortKey] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [records, activeTab, search, sortKey, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page on filter change
  const prevTab = useRef(activeTab);
  useEffect(() => {
    if (prevTab.current !== activeTab) { setCurrentPage(1); prevTab.current = activeTab; }
  }, [activeTab]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const t = today(); const w = weekAgo();
    return {
      uniqueToday:  new Set(records.filter((r) => r.date === t).map((r) => r.userId)).size,
      openShifts:   records.filter((r) => !r.clockOutTime).length,
      reviewNeeded: records.filter((r) => r.verificationStatus === "REVIEW_REQUIRED").length,
      weekHours:    records.filter((r) => r.date >= w && r.hoursWorked != null).reduce((s, r) => s + (r.hoursWorked ?? 0), 0),
    };
  }, [records]);

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "today",  label: "Today",       count: records.filter((r) => r.date === today()).length },
    { key: "week",   label: "This Week" },
    { key: "all",    label: "All Records" },
    { key: "review", label: "Review",      count: stats.reviewNeeded },
  ];

  if (loading) return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar /><Loading /><Footer />
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 mt-20 pb-20">
        <div className="container mx-auto max-w-7xl mt-8">

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Attendance Management</h1>
              <p className="text-slate-600 text-sm">Monitor all employee clock records and verify attendance.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => fetchAll(true)} disabled={refreshing} className="border-slate-300">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={() => exportCSV(filtered, `attendance_${activeTab}_${today()}.csv`)}
                className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/25 shadow-lg"
              >
                <Download className="h-4 w-4 mr-2" />Export CSV
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Clocked In Today", value: stats.uniqueToday,                icon: Users,         bg: "bg-indigo-100", color: "text-indigo-600" },
              { label: "Open Shifts",       value: stats.openShifts,                 icon: Clock,         bg: "bg-amber-100",  color: "text-amber-600"  },
              { label: "Review Required",   value: stats.reviewNeeded,               icon: AlertTriangle, bg: "bg-red-100",    color: "text-red-600"    },
              { label: "Hours This Week",   value: `${stats.weekHours.toFixed(1)}h`, icon: Calendar,      bg: "bg-green-100",  color: "text-green-600"  },
            ].map((s) => (
              <Card key={s.label} className="bg-background border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500">{s.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
                    </div>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${s.bg}`}>
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Table card */}
          <Card className="border-slate-200 shadow-sm bg-background">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Clock Records</CardTitle>
                  <CardDescription>{filtered.length} record{filtered.length !== 1 ? "s" : ""} · page {currentPage} of {totalPages}</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search employee or date..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="pl-10 h-9 w-full sm:w-64 border-slate-300"
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-3 border-b border-slate-200 -mx-6 px-6">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeTab === t.key
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-foreground"
                    }`}
                  >
                    {t.label}
                    {t.count !== undefined && t.count > 0 && (
                      <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                        t.key === "review" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-600"
                      }`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <SortHeader label="Employee"   sortKey="employeeName"       current={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="Date"        sortKey="date"               current={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="Clock In"    sortKey="clockInTime"        current={sortKey} dir={sortDir} onClick={handleSort} />
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Clock Out</th>
                      <SortHeader label="Hours"       sortKey="hoursWorked"        current={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="Status"      sortKey="verificationStatus" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                          No records found
                        </td>
                      </tr>
                    ) : paginated.map((r) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          r.verificationStatus === "REVIEW_REQUIRED" ? "bg-red-50/30" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                              {r.employeeName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm text-foreground whitespace-nowrap">{r.employeeName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(r.date)}</td>
                        <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">{fmtTime(r.clockInTime)}</td>
                        <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">
                          {r.clockOutTime
                            ? fmtTime(r.clockOutTime)
                            : <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">Open</Badge>
                          }
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap">{fmtHours(r.hoursWorked)}</td>
                        <td className="px-4 py-3"><VerifBadge status={r.verificationStatus} /></td>
                        <td className="px-4 py-3 max-w-50">
                          {r.clockInAddress ? (
                            <span className="text-xs text-slate-500 line-clamp-2 leading-tight">{r.clockInAddress}</span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelected(r)}
                            className="text-indigo-600 hover:text-indigo-700 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | "...")[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) => p === "..." ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`min-w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === p
                            ? "bg-indigo-600 text-white"
                            : "hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        {p}
                      </button>
                    ))
                  }

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />

      {selected && (
        <RecordDetailModal
          record={selected}
          onClose={() => setSelected(null)}
          onResolve={resolveRecord}
        />
      )}
      {show && <ResponseModal successful={successful} message={message} setShow={setShow} />}
    </div>
  );
}