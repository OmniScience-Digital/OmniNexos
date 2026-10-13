// src/app/jobcards/components/CertificatesPanel.tsx  
import { useState } from "react";
import { Award, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFileUrl } from "@/services/jobCardTime.service";
import type { Certificate, JobCardScale } from "@/types/jobcards.types";

/** Calibration certificates (CRT-...) issued for this job card. Read-only: the system issues them. */
export default function CertificatesPanel({
  certificates, scales, onError,
}: { certificates: Certificate[]; scales: JobCardScale[]; onError: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const scaleName = new Map(scales.map((s) => [s.id, s.scaleName]));

  const download = async (c: Certificate) => {
    setBusy(c.id);
    try { window.open(await getFileUrl(c.pdfKey), "_blank", "noopener"); }
    catch { onError(`Could not open ${c.certificateNumber}. The file may not be available yet.`); }
    finally { setBusy(null); }
  };

  if (certificates.length === 0) {
    return (
      <Card className="shadow-none">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Award className="mx-auto mb-2 h-6 w-6 opacity-50" />
          No certificates yet. One is issued for a scale once all its Zero and Span calibrations are complete.
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
                  <Button size="sm" variant="outline" className="cursor-pointer" disabled={busy === c.id} onClick={() => download(c)}>
                    {busy === c.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />} PDF
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