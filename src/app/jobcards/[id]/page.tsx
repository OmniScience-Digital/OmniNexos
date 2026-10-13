// src/app/jobcards/[id]/page.tsx  (NEW FILE)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Award, CheckCircle2, ClipboardList, Clock, ExternalLink, Loader2, Lock } from "lucide-react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import Loading from "@/components/widgets/loading";
import ResponseModal from "@/components/widgets/response";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { usePermission } from "@/hooks/usePermission";
import { useJobCardLive, useNow } from "@/hooks/useJobCardLive";
import { closeJobCard, syncTimeTracking } from "@/services/jobCardTime.service";
import type { TimeUser } from "@/types/jobcards.types";
import { allSubmitted, formatDuration, isOpen, personSeconds, planStop } from "@/utils/helper/jobCardTime";
import BackendNotReady from "../components/BackendNotReady";
import CertificatesPanel from "../components/CertificatesPanel";
import ResultsPanel from "../components/ResultsPanel";
import TelegramGroupPicker from "../components/TelegramGroupPicker";
import TimeTrackingPanel from "../components/TimeTrackingPanel";
import WorkItemsCard from "../components/WorkItemsCard";

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "-";

function Tile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-1 p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export default function JobCardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { permission } = useAuth();
  const canEdit = usePermission("crm.jobcards.edit");
  const { jobCard, scales, items, entries, results, certificates, loading, unavailable } = useJobCardLive(id);

  const [closing, setClosing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const showError = useCallback((m: string) => setMsg(m), []);

  const user: TimeUser | null = useMemo(
    () => (permission?.username ? { id: permission.username, name: permission.name || permission.email } : null),
    [permission],
  );

  // Passive STOP. Results are usually submitted on the mobile app, so when this page sees that the
  // last work item is now submitted it closes the open entries (idempotent: the stop time is the
  // last submission's time, so it does not matter who runs it).
  const stopping = useRef(false);
  useEffect(() => {
    if (loading || !jobCard || stopping.current) return;
    if (!planStop(items, entries, new Date().toISOString())) return;
    stopping.current = true;
    syncTimeTracking(jobCard.id)
      .catch((e) => console.error("[jobcard] stop failed", e))
      .finally(() => { stopping.current = false; });
  }, [loading, jobCard, items, entries]);

  const running = entries.some(isOpen);
  const now = useNow(running);
  const submitted = items.filter((i) => i.status === "SUBMITTED").length;
  const complete = allSubmitted(items);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      {loading ? (
        <Loading />
      ) : (
        <main className="flex-1 px-2 sm:px-4 mt-25 pb-20">
          {msg && <ResponseModal successful={false} message={msg} setShow={() => setMsg(null)} />}
          <div className="container mx-auto max-w-7xl mt-3 space-y-4">
            <Button variant="ghost" size="sm" className="cursor-pointer -ml-2" onClick={() => navigate("/jobcards")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Job cards
            </Button>

            {unavailable ? (
              <BackendNotReady />
            ) : !jobCard ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Job card not found.</CardContent></Card>
            ) : (
              <>
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
                      <ClipboardList className="h-5 w-5" /> {jobCard.jcNumber}
                      <Badge variant={jobCard.status === "OPEN" ? "default" : "secondary"}>{jobCard.status === "OPEN" ? "Open" : "Closed"}</Badge>
                      {running && <Badge variant="outline" className="gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Timer running</Badge>}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {[jobCard.customerName, jobCard.title].filter(Boolean).join(" - ") || "No customer details"}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {jobCard.quoteNumber && <span>Quote {jobCard.quoteNumber}</span>}
                      <span>Opened {fmtDate(jobCard.openedAt)}</span>
                      {jobCard.status === "CLOSED" && <span>Closed {fmtDate(jobCard.closedAt)}</span>}
                      {jobCard.clickupTaskId && (
                        <a className="inline-flex items-center gap-1 underline-offset-2 hover:underline" target="_blank" rel="noreferrer"
                           href={`https://app.clickup.com/t/${jobCard.clickupTaskId}`}>
                          ClickUp task <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </p>
                  </div>
                  {canEdit && jobCard.status === "OPEN" && (
                    <Button
                      variant="outline" className="cursor-pointer" disabled={closing || !user}
                      onClick={async () => {
                        setClosing(true);
                        try { await closeJobCard(jobCard.id, user!); }
                        catch (e) { setMsg(e instanceof Error ? e.message : "Could not close the job card."); }
                        finally { setClosing(false); }
                      }}
                    >
                      {closing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Lock className="mr-1 h-4 w-4" />} Close job card
                    </Button>
                  )}
                </div>

                {/* Summary tiles */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Tile icon={<Clock className="h-3.5 w-3.5" />} label="Time spent (all users)">
                    <p className="text-xl font-semibold tabular-nums">{formatDuration(personSeconds(entries, now))}</p>
                  </Tile>
                  <Tile icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Work submitted">
                    <p className="text-xl font-semibold tabular-nums">{submitted} <span className="text-sm font-normal text-muted-foreground">of {items.length}</span></p>
                    <Progress value={items.length ? (submitted / items.length) * 100 : 0} className="h-1.5" />
                    {complete && <p className="text-[11px] text-emerald-600">All work submitted</p>}
                  </Tile>
                  <Tile icon={<Award className="h-3.5 w-3.5" />} label="Certificates">
                    <p className="text-xl font-semibold tabular-nums">{certificates.filter((c) => c.status === "ISSUED").length}</p>
                  </Tile>
                  <Card className="shadow-none"><CardContent className="p-4">
                    <TelegramGroupPicker jobCard={jobCard} canEdit={canEdit} onError={showError} />
                  </CardContent></Card>
                </div>

                {/* Detail */}
                <Tabs defaultValue="work">
                  <TabsList>
                    <TabsTrigger value="work">Work items</TabsTrigger>
                    <TabsTrigger value="results">Results ({results.length})</TabsTrigger>
                    <TabsTrigger value="time">Time</TabsTrigger>
                    <TabsTrigger value="certificates">Certificates ({certificates.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="work" className="pt-3">
                    <WorkItemsCard jobCard={jobCard} scales={scales} items={items} user={user} canEdit={canEdit} onError={showError} />
                  </TabsContent>
                  <TabsContent value="results" className="pt-3">
                    <ResultsPanel scales={scales} items={items} results={results} entries={entries} />
                  </TabsContent>
                  <TabsContent value="time" className="pt-3">
                    <TimeTrackingPanel entries={entries} items={items} />
                  </TabsContent>
                  <TabsContent value="certificates" className="pt-3">
                    <CertificatesPanel certificates={certificates} scales={scales} onError={showError} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </main>
      )}
      <Footer />
    </div>
  );
}