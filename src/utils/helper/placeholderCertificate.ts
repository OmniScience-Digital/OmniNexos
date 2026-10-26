// src/utils/helper/placeholderCertificate.ts
// A dummy calibration certificate PDF, handed out when a job card is closed, until the real certificate template
// is finalised and the backend generates the actual certificates. It is made in the browser, so it needs no backend
// and is never stored or numbered: it carries no CRT number and says plainly that it is not a certificate.

export interface PlaceholderInfo {
  jcNumber: string;
  customerName?: string | null;
  scaleName: string;
  closedAt?: string | null;
}

export const placeholderFileName = (i: Pick<PlaceholderInfo, "jcNumber" | "scaleName">) =>
  `${i.jcNumber}-${i.scaleName}-certificate-placeholder.pdf`.replace(/[^\w.-]+/g, "_");

export async function buildPlaceholderCertificate(info: PlaceholderInfo): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf"); // loaded only when someone asks for the placeholder
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Calibration certificate", 105, 40, { align: "center" });
  doc.setFontSize(13);
  doc.setTextColor(180, 0, 0);
  doc.text("PLACEHOLDER - NOT A VALID CERTIFICATE", 105, 52, { align: "center" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const lines: [string, string][] = [
    ["Job card", info.jcNumber],
    ["Customer", info.customerName || "-"],
    ["Scale", info.scaleName],
    ["Job card closed", info.closedAt ? new Date(info.closedAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "-"],
  ];
  lines.forEach(([label, value], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 30, 80 + i * 10);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 75, 80 + i * 10);
  });
  doc.setFontSize(10);
  doc.text(
    doc.splitTextToSize(
      "This page only marks where the calibration certificate will be. The certificate itself is generated once the " +
      "certificate template is finalised. It carries no certificate number and must not be issued to the customer.",
      150,
    ),
    30, 135,
  );
  return doc.output("arraybuffer");
}