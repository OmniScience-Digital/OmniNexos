// src/utils/helper/jobCardResults.test.ts 
import { describe, expect, it } from "vitest";
import { ALL, describeResult, formatValue, isFiltering, matchesResultFilter, NO_FILTER } from "./jobCardResults";

describe("describeResult", () => {
  it("formats a zero calibration", () => {
    const v = describeResult("ZERO_CALIBRATION", { newZeroValue: "1250", photos: { zero: "jobcards/jc1/zero.jpg" } });
    expect(v.fields).toEqual([{ label: "New zero value (points)", value: "1250" }]);
    expect(v.photos).toEqual([{ label: "Zero calibration", key: "jobcards/jc1/zero.jpg" }]);
  });

  it("formats a span calibration: 2 dp, percent, yes/no", () => {
    const v = describeResult("SPAN_CALIBRATION", {
      offset: 10, actual: 90.5, indicated: 95, indicatedActual: 100.5, adjustmentRatio: 0.0625,
      newPotentialSpan: 12345.678, spanAdjusted: true, newSpan: "12400", photos: { offset: "a", actual: "b", indicated: "c" },
    });
    const get = (l: string) => v.fields.find((f) => f.label === l)?.value;
    expect(get("Offset (kg/m)")).toBe("10.00");
    expect(get("Adjustment required")).toBe("6.25 %");
    expect(get("New potential span (points)")).toBe("12345.68");
    expect(get("Span adjusted")).toBe("Yes");
    expect(v.photos.map((p) => p.label)).toEqual(["Offset", "Actual", "Indicated"]);
  });

  it("inspection: N/A for torsion rods, optional fields skipped, scale photos numbered", () => {
    const v = describeResult("INSPECTION", {
      asFoundTotalizer: "1234567", partsAttached: true, weighframeClean: false, torsionRodsMoveFreely: null,
      photos: { speedSensor: "s", integratorPanel: "i", scale: ["p1", "p2", "p3"] },
    });
    const get = (l: string) => v.fields.find((f) => f.label === l)?.value;
    expect(get("Torsion rods move freely")).toBe("N/A");
    expect(get("Weighframe free of dirt")).toBe("No");
    expect(v.fields.some((f) => f.label.includes("max running"))).toBe(false);
    expect(v.photos.filter((p) => p.label.startsWith("Scale")).map((p) => p.label)).toEqual(["Scale 1", "Scale 2", "Scale 3"]);
  });

  it("shows unknown simple fields instead of dropping them", () => {
    expect(describeResult("ZERO_CALIBRATION", { newZeroValue: "1", note: "ok" }).fields).toContainEqual({ label: "Note", value: "ok" });
  });

  it("formatValue handles empties and bad numbers", () => {
    expect(formatValue(undefined)).toBe("-");
    expect(formatValue("abc", "num2")).toBe("abc");
  });
});

describe("results filter", () => {
  const zero = { scaleId: "s1", moduleType: "ZERO_CALIBRATION" as const, payload: { newZeroValue: "1250" } };
  const span = { scaleId: "s2", moduleType: "SPAN_CALIBRATION" as const, payload: { offset: 10, newSpan: "12400" } };
  const ctx1 = { scaleName: "CV04 ROM accounting", submitterName: "Ayanda" };
  const ctx2 = { scaleName: "RunFed 1", submitterName: "Ben" };

  it("passes everything with no filter", () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(matchesResultFilter(zero, ctx1, NO_FILTER)).toBe(true);
  });
  it("filters by scale", () => {
    const f = { ...NO_FILTER, scaleId: "s1" };
    expect(matchesResultFilter(zero, ctx1, f)).toBe(true);
    expect(matchesResultFilter(span, ctx2, f)).toBe(false);
  });
  it("filters by work item type", () => {
    const f = { ...NO_FILTER, type: "ZERO_CALIBRATION" as const };
    expect(matchesResultFilter(zero, ctx1, f)).toBe(true);
    expect(matchesResultFilter(span, ctx2, f)).toBe(false);
  });
  it("scale and type combine", () => {
    expect(matchesResultFilter(zero, ctx1, { scaleId: "s1", type: "SPAN_CALIBRATION", term: "" })).toBe(false);
  });
  it("search needs every word, in any order, across scale, type, person and values", () => {
    const q = (term: string, r: { scaleId: string; moduleType: "ZERO_CALIBRATION" | "SPAN_CALIBRATION"; payload: Record<string, unknown> } = zero, c = ctx1) => matchesResultFilter(r, c, { scaleId: ALL, type: ALL, term });
    expect(q("zero calibration")).toBe(true);
    expect(q("cv04 zero")).toBe(true);
    expect(q("ayanda 1250")).toBe(true);
    expect(q("ZERO   rom")).toBe(true);
    expect(q("span")).toBe(false);
    expect(q("cv04 span")).toBe(false);
    expect(q("12400", span, ctx2)).toBe(true);
  });
});