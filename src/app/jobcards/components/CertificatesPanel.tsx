// src/app/jobcards/components/CertificatesPanel.tsx  
import { useState } from "react";
import { Award, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFileUrl } from "@/services/jobCardTime.service";
import type { Certificate, JobCard, JobCardScale, WorkItem } from "@/types/jobcards.types";
import { buildPlaceholderCertificate, placeholderFileName } from "@/utils/helper/placeholderCertificate";

/**
 * Calibration certificates (CRT-...) issued for this job card. Read-only: the system issues them.
 * Until real certificate generation exists, a CLOSED job card also offers a dummy placeholder PDF per scale that has
 * work and no issued certificate yet.
 */
export default function CertificatesPanel({
  jobCard, certificates, scales, items, onError,
}: { jobCard: JobCard; certificates: Certificate[]; scales: JobCardScale[]; items: WorkItem[]; onError: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const scaleName = new Map(scales.map((s) => [s.id, s.scaleName]));

  const download = async (c: Certificate) => {
    setBusy(c.id);
    try { window.open(await getFileUrl(c.pdfKey), "_blank", "noopener"); }
    catch { onError(`Could not open ${c.certificateNumber}. The file may not be available yet.`); }
    finally { setBusy(null); }
  };

  const placeholders = jobCard.status !== "CLOSED" ? [] : [...scales]
    .filter((sc) => items.some((i) => i.scaleId === sc.id) && !certificates.some((c) => c.scaleId === sc.id && c.status === "ISSUED"))
    .sort((a, b) => a.scaleName.localeCompare(b.scaleName));

  const downloadPlaceholder = async (sc: JobCardScale) => {
    setBusy(`ph-${sc.id}`);
    try {
      const pdf = await buildPlaceholderCertificate({
        jcNumber: jobCard.jcNumber, customerName: jobCard.customerName, scaleName: sc.scaleName, closedAt: jobCard.closedAt,
      });
      const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = placeholderFileName({ jcNumber: jobCard.jcNumber, scaleName: sc.scaleName });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch { onError("Could not create the placeholder certificate."); }
    finally { setBusy(null); }
  };

  if (certificates.length === 0 && placeholders.length === 0) {
    return (
      <Card className="shadow-none">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Award className="mx-auto mb-2 h-6 w-6 opacity-50" />
          No certificates yet. One is issued for a scale once all its Zero and Span calibrations are complete.
          {jobCard.status === "OPEN" && " A placeholder PDF is offered here when the job card is closed."}
        </CardContent>
      </Card>
    );
  }

  const sorted = [...certificates].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
  return (
    <Card className="shadow-none">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Certificate</TableHead>
              <TableHead>Scale</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.certificateNumber}{c.version > 1 ? ` (v${c.version})` : ""}</TableCell>
                <TableCell>{scaleName.get(c.scaleId) ?? "-"}</TableCell>
                <TableCell>{new Date(c.issuedAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                <TableCell><Badge variant={c.status === "ISSUED" ? "default" : "secondary"}>{c.status === "ISSUED" ? "Issued" : "Superseded"}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" className="cursor-pointer" disabled={busy === c.id || c.pdfStored === false} title={c.pdfStored === false ? "PDF is still being generated" : undefined} onClick={() => download(c)}>
                    {busy === c.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />} PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {placeholders.map((sc) => (
              <TableRow key={`ph-${sc.id}`}>
                <TableCell className="font-medium text-muted-foreground">Placeholder</TableCell>
                <TableCell>{sc.scaleName}</TableCell>
                <TableCell>-</TableCell>
                <TableCell><Badge variant="outline">Pending template</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" className="cursor-pointer" disabled={busy === `ph-${sc.id}`} onClick={() => downloadPlaceholder(sc)}>
                    {busy === `ph-${sc.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />} PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}