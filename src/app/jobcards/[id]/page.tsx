// src/app/jobcards/[id]/page.tsx  
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, Loader2, Lock } from "lucide-react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import Loading from "@/components/widgets/loading";
import ResponseModal from "@/components/widgets/response";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { usePermission } from "@/hooks/usePermission";
import { useJobCardLive } from "@/hooks/useJobCardLive";
import { closeJobCard, syncTimeTracking } from "@/services/jobCardTime.service";
import type { TimeUser } from "@/types/jobcards.types";
import { planStop } from "@/utils/helper/jobCardTime";
import TimeTrackingPanel from "../components/TimeTrackingPanel";
import WorkItemsCard from "../components/WorkItemsCard";

export default function JobCardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { permission } = useAuth();
  const canEdit = usePermission("crm.jobcards.edit");
  const { jobCard, scales, items, entries, loading } = useJobCardLive(id);

  const [closing, setClosing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      {loading ? (
        <Loading />
      ) : (
        <main className="flex-1 px-2 sm:px-4 mt-25 pb-20">
          {msg && <ResponseModal successful={false} message={msg} setShow={() => setMsg(null)} />}
          <div className="container mx-auto max-w-7xl mt-5 space-y-4">
            <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => navigate("/jobcards")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Job cards
            </Button>

            {!jobCard ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Job card not found.</CardContent></Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <ClipboardList className="h-4 w-4" />
                          {jobCard.jcNumber}
                          <Badge variant={jobCard.status === "OPEN" ? "default" : "secondary"} className="text-xs">
                            {jobCard.status === "OPEN" ? "Open" : "Closed"}
                          </Badge>
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[jobCard.customerName, jobCard.title].filter(Boolean).join(" - ") || "No customer details"}
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
                          {closing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Lock className="h-4 w-4 mr-1" />}
                          Close job card
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                </Card>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <WorkItemsCard jobCard={jobCard} scales={scales} items={items} user={user} canEdit={canEdit} onError={setMsg} />
                  <TimeTrackingPanel entries={entries} items={items} />
                </div>
              </>
            )}
          </div>
        </main>
      )}
      <Footer />
    </div>
  );
}