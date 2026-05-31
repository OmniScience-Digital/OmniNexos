// src/app/attendance/page.tsx — Employee self-service ATS
import { client } from "@/services/schema";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useRef, useState, useCallback } from "react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ResponseModal from "@/components/widgets/response";
import { uploadData, getUrl } from "aws-amplify/storage";
import {
  Camera, CheckCircle2, Clock, LogIn, LogOut,
  MapPin, Timer, Upload, User, AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type VerifStatus = "VERIFIED" | "PENDING_VERIFICATION" | "REVIEW_REQUIRED";

interface ClockRecord {
  id: string;
  userId: string;
  employeeName: string;
  clockInTime: string;
  clockOutTime?: string | null;
  hoursWorked?: number | null;
  clockInAddress?: string | null;
  clockOutAddress?: string | null;
  verificationStatus: VerifStatus;
  syncedOffline: boolean;
  date: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (iso?: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }); }
  catch { return "—"; }
};

const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
};

const calcHours = (i: string, o: string) =>
  Math.round(((new Date(o).getTime() - new Date(i).getTime()) / 3600000) * 100) / 100;

const toDateStr = () => new Date().toISOString().split("T")[0];

// ── Live timer ────────────────────────────────────────────────────────────────
function LiveTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("00:00:00");
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const tick = () => {
      const ms = Date.now() - new Date(since).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    ref.current = setInterval(tick, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [since]);
  return <span className="font-mono text-2xl font-bold tracking-widest text-green-600">{elapsed}</span>;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function VerifBadge({ status }: { status: VerifStatus }) {
  switch (status) {
    case "VERIFIED":           return <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">Verified</Badge>;
    case "PENDING_VERIFICATION": return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">Pending</Badge>;
    case "REVIEW_REQUIRED":    return <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">Review</Badge>;
  }
}

// ── Reference photo section ───────────────────────────────────────────────────
function ReferencePhotoSection({ userId, employeeId }: { userId: string; employeeId?: string }) {
  const [photoUrl,    setPhotoUrl]    = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [show,        setShow]        = useState(false);
  const [successful,  setSuccessful]  = useState(false);
  const [message,     setMessage]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const s3Key   = `hr/reference-faces/${userId}/profile.jpg`;

  // Load existing photo
  useEffect(() => {
    getUrl({ path: s3Key }).then(({ url }) => setPhotoUrl(url.toString())).catch(() => setPhotoUrl(null));
  }, [s3Key]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadData({ path: s3Key, data: file, options: { contentType: file.type } }).result;
      // Save key to Employee record if we have employeeId
      if (employeeId) {
        await (client.models.Employee as any).update({ id: employeeId, referencePhotoKey: s3Key });
      }
      const { url } = await getUrl({ path: s3Key });
      setPhotoUrl(url.toString());
      setSuccessful(true);
      setMessage("Reference photo uploaded successfully. It will be used for face verification.");
    } catch {
      setSuccessful(false);
      setMessage("Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
      setShow(true);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card className="border-slate-200 bg-background">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-4 w-4 text-indigo-600" />
          Face Verification Photo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Photo preview */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 overflow-hidden bg-slate-50 flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt="Reference" className="w-full h-full object-cover" onError={() => setPhotoUrl(null)} />
              ) : (
                <User className="h-10 w-10 text-slate-300" />
              )}
            </div>
            {photoUrl && (
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </div>

          {/* Info + upload */}
          <div className="flex-1">
            <p className="text-sm text-slate-600 mb-1">
              {photoUrl
                ? "Your reference photo is set. You can update it anytime."
                : "Upload a clear front-facing photo. This will be used to verify your identity when clocking in."}
            </p>
            <p className="text-xs text-slate-400 mb-3">JPG or PNG · Max 5MB · Good lighting, no sunglasses</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />
            <Button
              size="sm"
              variant={photoUrl ? "outline" : "default"}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={photoUrl ? "border-slate-300" : "bg-indigo-600 hover:bg-indigo-700"}
            >
              {uploading ? (
                <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />Uploading...</>
              ) : (
                <><Upload className="h-3.5 w-3.5 mr-2" />{photoUrl ? "Update Photo" : "Upload Photo"}</>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
      {show && <ResponseModal successful={successful} message={message} setShow={setShow} />}
    </Card>
  );
}

// ── Shift history row ─────────────────────────────────────────────────────────
function ShiftRow({ record, onClockOut, isClockingOut }: {
  record: ClockRecord;
  onClockOut?: () => void;
  isClockingOut?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = !record.clockOutTime;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isOpen
          ? "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10"
          : "border-slate-200 bg-background hover:border-slate-300"
      }`}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Date block */}
        <div className="shrink-0 w-12 text-center">
          <div className="text-lg font-bold text-foreground leading-none">
            {new Date(record.clockInTime).getDate()}
          </div>
          <div className="text-xs text-slate-400 uppercase">
            {new Date(record.clockInTime).toLocaleDateString("en-ZA", { month: "short" })}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {fmtDate(record.clockInTime).split(",")[0]}
            </span>
            {isOpen
              ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">Open shift</Badge>
              : <VerifBadge status={record.verificationStatus} />
            }
            {record.syncedOffline && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 border text-xs">Offline</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <LogIn className="h-3 w-3 text-green-500" />{fmt(record.clockInTime)}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <LogOut className="h-3 w-3 text-slate-400" />{fmt(record.clockOutTime)}
            </span>
            {record.hoursWorked != null && (
              <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />{record.hoursWorked.toFixed(1)}h
              </span>
            )}
          </div>
        </div>

        {/* Clock out button for open shifts */}
        {isOpen && onClockOut && (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onClockOut(); }}
            disabled={isClockingOut}
            className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs"
          >
            {isClockingOut
              ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
              : <><LogOut className="h-3 w-3 mr-1" />Clock Out</>
            }
          </Button>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {record.clockInAddress && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />Clock In Location
                </p>
                <p className="text-sm text-foreground">{record.clockInAddress}</p>
              </div>
            )}
            {record.clockOutAddress && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />Clock Out Location
                </p>
                <p className="text-sm text-foreground">{record.clockOutAddress}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Clock In</p>
              <p className="text-sm text-foreground font-mono">{record.clockInTime ? new Date(record.clockInTime).toLocaleString("en-ZA") : "—"}</p>
            </div>
            {record.clockOutTime && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Clock Out</p>
                <p className="text-sm text-foreground font-mono">{new Date(record.clockOutTime).toLocaleString("en-ZA")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { user, permission } = useAuth();

  const userId       = user?.sub ?? user?.username ?? "";
  const employeeName = permission?.name || user?.preferred_username || user?.email?.split("@")[0] || "Employee";

  const [activeRecord,  setActiveRecord]  = useState<ClockRecord | null>(null);
  const [history,       setHistory]       = useState<ClockRecord[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [closingId,     setClosingId]     = useState<string | null>(null);
  const [show,          setShow]          = useState(false);
  const [successful,    setSuccessful]    = useState(false);
  const [message,       setMessage]       = useState("");
  const [page,          setPage]          = useState(0);
  const [hasMore,       setHasMore]       = useState(false);
  const [nextToken,     setNextToken]     = useState<string | null>(null);
  const PAGE_SIZE = 10;

  // ── Week stats ──────────────────────────────────────────────────────────────
  const weekAgo      = new Date(Date.now() - 7 * 24 * 3600000).toISOString().split("T")[0];
  const weekRecords  = history.filter((r) => r.date >= weekAgo && r.hoursWorked != null);
  const weekHours    = weekRecords.reduce((s, r) => s + (r.hoursWorked ?? 0), 0);
  const weekDays     = new Set(weekRecords.map((r) => r.date)).size;

  // ── Fetch employee records (paginated) ─────────────────────────────────────
  const fetchRecords = useCallback(async (token: string | null = null, append = false) => {
    if (!userId) return;
    try {
      const result: any = await (client.models.ClockRecord as any).clockRecordsByUserAndTime(
        { userId },
        { limit: PAGE_SIZE, nextToken: token ?? undefined, sortDirection: "DESC" }
      );
      const items: ClockRecord[] = result.data ?? [];
      setHistory((prev) => append ? [...prev, ...items] : items);
      setNextToken(result.nextToken ?? null);
      setHasMore(!!result.nextToken);

      // Recover active record — most recent open shift
      if (!append) {
        const open = items.find((r) => !r.clockOutTime);
        setActiveRecord(open ?? null);
      }
    } catch (e) {
      console.error("Failed to fetch records:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const loadMore = () => {
    if (!hasMore || !nextToken) return;
    setPage((p) => p + 1);
    fetchRecords(nextToken, true);
  };

  // ── Get geolocation ────────────────────────────────────────────────────────
  const getLocation = (): Promise<{ lat: number; lng: number; address: string } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          try {
            const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
            const data = await res.json();
            resolve({ lat, lng, address: data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
          } catch {
            resolve({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
          }
        },
        () => resolve(null),
        { timeout: 8000, maximumAge: 60000 }
      );
    });

  // ── Clock In ───────────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      const [loc] = await Promise.all([getLocation()]);
      const now   = new Date().toISOString();
      const input = {
        userId,
        employeeName,
        clockInTime:        now,
        verificationStatus: "VERIFIED" as VerifStatus,
        syncedOffline:      false,
        date:               toDateStr(),
        ...(loc && { clockInLat: loc.lat, clockInLng: loc.lng, clockInAddress: loc.address }),
      };
      const { data, errors }: any = await client.models.ClockRecord.create(input as any);
      if (errors?.length) throw new Error(errors[0].message);
      setActiveRecord(data as ClockRecord);
      setHistory((prev) => [data as ClockRecord, ...prev]);
      setSuccessful(true);
      setMessage("Clocked in successfully.");
    } catch (e: any) {
      setSuccessful(false);
      setMessage(e?.message ?? "Failed to clock in.");
    } finally {
      setActionLoading(false);
      setShow(true);
    }
  };

  // ── Clock Out ──────────────────────────────────────────────────────────────
  const handleClockOut = async (record?: ClockRecord) => {
    const target = record ?? activeRecord;
    if (!target) return;
    if (record) setClosingId(record.id);
    else setActionLoading(true);

    try {
      const loc         = await getLocation();
      const now         = new Date().toISOString();
      const hoursWorked = calcHours(target.clockInTime, now);
      const input: any  = {
        id:           target.id,
        clockOutTime: now,
        hoursWorked,
        ...(loc && { clockOutLat: loc.lat, clockOutLng: loc.lng, clockOutAddress: loc.address }),
      };
      const { data, errors }: any = await client.models.ClockRecord.update(input);
      if (errors?.length) throw new Error(errors[0].message);
      if (!record) setActiveRecord(null);
      setHistory((prev) => prev.map((r) => r.id === target.id ? (data as ClockRecord) : r));
      setSuccessful(true);
      setMessage(`Clocked out · ${hoursWorked.toFixed(1)}h worked.`);
    } catch (e: any) {
      setSuccessful(false);
      setMessage(e?.message ?? "Failed to clock out.");
    } finally {
      setActionLoading(false);
      setClosingId(null);
      setShow(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 mt-20 pb-20">
        <div className="container mx-auto max-w-3xl mt-8 space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Attendance</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Clock card */}
          <Card className={`border-2 transition-colors duration-500 ${
            activeRecord ? "border-green-300 bg-green-50/30 dark:bg-green-950/10" : "border-slate-200 bg-background"
          }`}>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">

                {/* Status + timer */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${activeRecord ? "bg-green-500 animate-pulse" : "bg-slate-300"}`} />
                    <span className="text-sm font-medium text-slate-600">
                      {activeRecord ? "On shift" : "Off shift"}
                    </span>
                  </div>

                  {activeRecord ? (
                    <div className="space-y-1">
                      <LiveTimer since={activeRecord.clockInTime} />
                      <p className="text-xs text-slate-500 flex items-center gap-1 justify-center sm:justify-start">
                        <Clock className="h-3 w-3" />
                        Started at {fmt(activeRecord.clockInTime)}
                      </p>
                      {activeRecord.clockInAddress && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 justify-center sm:justify-start">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate max-w-65">{activeRecord.clockInAddress}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">Tap Clock In to start your shift</p>
                  )}
                </div>

                {/* Clock button */}
                <button
                  onClick={activeRecord ? () => handleClockOut() : handleClockIn}
                  disabled={actionLoading}
                  className={`
                    shrink-0 w-28 h-28 rounded-full font-semibold text-white text-sm
                    flex flex-col items-center justify-center gap-1.5
                    shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-60
                    ${activeRecord
                      ? "bg-linear-to-br from-red-500 to-red-600 shadow-red-500/30 hover:from-red-600 hover:to-red-700"
                      : "bg-linear-to-br from-indigo-500 to-indigo-600 shadow-indigo-500/30 hover:from-indigo-600 hover:to-indigo-700"
                    }
                  `}
                >
                  {actionLoading
                    ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                    : activeRecord
                      ? <><LogOut className="h-6 w-6" />Clock Out</>
                      : <><LogIn className="h-6 w-6" />Clock In</>
                  }
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Week stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Hours this week", value: `${weekHours.toFixed(1)}h`, icon: Timer,        color: "text-indigo-600" },
              { label: "Days worked",     value: String(weekDays),           icon: CheckCircle2, color: "text-green-600" },
              { label: "Total shifts",    value: String(history.length),     icon: Clock,        color: "text-slate-600" },
            ].map((s) => (
              <Card key={s.label} className="bg-background border-slate-200">
                <CardContent className="p-4 text-center">
                  <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Reference photo */}
          <ReferencePhotoSection userId={userId} />

          {/* Open shifts warning */}
          {history.filter((r) => !r.clockOutTime && r.id !== activeRecord?.id).length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Unclosed shifts found</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      These shifts were not clocked out — tap "Clock Out" on the record below.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shift history */}
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              Shift History
            </h2>

            {history.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
                <Timer className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No shifts yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((r) => (
                  <ShiftRow
                    key={r.id}
                    record={r}
                    onClockOut={!r.clockOutTime ? () => handleClockOut(r) : undefined}
                    isClockingOut={closingId === r.id}
                  />
                ))}

                {/* Pagination */}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    className="w-full py-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50/50 transition-colors"
                  >
                    Load more shifts
                  </button>
                )}

                {!hasMore && history.length > PAGE_SIZE && (
                  <p className="text-center text-xs text-slate-400 py-2">All shifts loaded</p>
                )}
              </div>
            )}
          </div>

        </div>
      </main>

      <Footer />
      {show && <ResponseModal successful={successful} message={message} setShow={setShow} />}
    </div>
  );
}