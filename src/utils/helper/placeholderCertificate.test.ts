// src/utils/helper/placeholderCertificate.test.ts
import { describe, expect, it } from "vitest";
import { buildPlaceholderCertificate, placeholderFileName } from "./placeholderCertificate";

describe("placeholder certificate", () => {
  it("builds a real PDF", async () => {
    const pdf = await buildPlaceholderCertificate({ jcNumber: "JC-QU-0032", customerName: "ESCOM", scaleName: "CV04 ROM accounting", closedAt: "2026-10-22T10:00:00.000Z" });
    const head = new TextDecoder().decode(new Uint8Array(pdf).slice(0, 5));
    expect(head).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
  it("makes a safe file name", () => {
    expect(placeholderFileName({ jcNumber: "JC-QU-0032", scaleName: "CV04 / ROM accounting" })).toBe("JC-QU-0032-CV04_ROM_accounting-certificate-placeholder.pdf");
  });
});