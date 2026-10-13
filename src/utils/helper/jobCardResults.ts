// src/utils/helper/jobCardResults.ts  
// Turns a submitted result (JobCardSubmission.payload) into labelled rows for display. Pure.
import type { WorkItemType } from "@/types/jobcards.types";

export interface ResultField { label: string; value: string }
export interface ResultPhoto { label: string; key: string }
export interface ResultView { fields: ResultField[]; photos: ResultPhoto[] }

type Kind = "text" | "yesno" | "yesnona" | "num2" | "percent";
interface Spec { key: string; label: string; kind?: Kind }

const INSPECTION: Spec[] = [
  { key: "asFoundTotalizer", label: "As found totalizer (tons)" },
  { key: "asFoundSpanCoefficient", label: "As found span coefficient" },
  { key: "asFoundZeroValue", label: "As found zero value" },
  { key: "asFoundSpeedCoefficient", label: "As found speed coefficient" },
  { key: "asFoundMaxTph", label: "As found max running (tph)", kind: "num2" },
  { key: "asFoundMinTph", label: "As found min running (tph)", kind: "num2" },
  { key: "asFoundRunningSpeed", label: "As found running speed (m/s)", kind: "num2" },
  { key: "partsAttached", label: "All parts still attached", kind: "yesno" },
  { key: "weighframeClean", label: "Weighframe free of dirt", kind: "yesno" },
  { key: "integratorPanelClean", label: "Integrator panel free of dirt and water", kind: "yesno" },
  { key: "weighframeMovesFreely", label: "Weighframe moves freely", kind: "yesno" },
  { key: "torsionRodsMoveFreely", label: "Torsion rods move freely", kind: "yesnona" },
  { key: "rollersTurning", label: "Rollers turning smoothly on an empty belt", kind: "yesno" },
  { key: "beltTracking", label: "Belt tracking properly over the scale", kind: "yesno" },
  { key: "integratorOk", label: "Integrator in good working order", kind: "yesno" },
  { key: "speedSensorOk", label: "Speed sensor in good working order", kind: "yesno" },
];
const ZERO: Spec[] = [{ key: "newZeroValue", label: "New zero value (points)" }];
const SPAN: Spec[] = [
  { key: "offset", label: "Offset (kg/m)", kind: "num2" },
  { key: "actual", label: "Actual (kg/m)", kind: "num2" },
  { key: "indicated", label: "Indicated (kg/m)", kind: "num2" },
  { key: "indicatedActual", label: "Indicated actual (kg/m)", kind: "num2" },
  { key: "adjustmentRatio", label: "Adjustment required", kind: "percent" },
  { key: "latestZeroUsed", label: "Latest zero used (points)" },
  { key: "latestSpanUsed", label: "Latest span used (points)" },
  { key: "newPotentialSpan", label: "New potential span (points)", kind: "num2" },
  { key: "spanAdjusted", label: "Span adjusted", kind: "yesno" },
  { key: "newSpan", label: "New span (points)" },
];
const SPECS: Record<WorkItemType, Spec[]> = { INSPECTION, ZERO_CALIBRATION: ZERO, SPAN_CALIBRATION: SPAN };

const PHOTO_LABELS: Record<string, string> = {
  speedSensor: "Speed sensor", integratorPanel: "Integrator panel", scale: "Scale", zero: "Zero calibration",
  offset: "Offset", actual: "Actual", indicated: "Indicated",
};

export function formatValue(value: unknown, kind: Kind = "text"): string {
  if (value === null || value === undefined || value === "") return kind === "yesnona" ? "N/A" : "-";
  switch (kind) {
    case "yesno":
    case "yesnona":
      return value === true ? "Yes" : value === false ? "No" : String(value);
    case "num2": {
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(2) : String(value);
    }
    case "percent": {
      const n = Number(value);
      return Number.isFinite(n) ? `${(n * 100).toFixed(2)} %` : String(value);
    }
    default:
      return String(value);
  }
}

const humanize = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export function describeResult(type: WorkItemType, payload: Record<string, unknown>): ResultView {
  const specs = SPECS[type] ?? [];
  const known = new Set(specs.map((x) => x.key));
  const fields: ResultField[] = [];
  for (const sp of specs) {
    // Optional fields that were never filled in are left out; a torsion-rod "N/A" (null) is kept.
    if (!(sp.key in payload) && sp.kind !== "yesnona") continue;
    fields.push({ label: sp.label, value: formatValue(payload[sp.key], sp.kind) });
  }
  for (const [k, v] of Object.entries(payload)) {
    if (known.has(k) || k === "photos" || typeof v === "object") continue;
    fields.push({ label: humanize(k), value: formatValue(v) });
  }

  const photos: ResultPhoto[] = [];
  const raw = (payload.photos ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) {
    const label = PHOTO_LABELS[k] ?? humanize(k);
    if (Array.isArray(v)) v.forEach((key, i) => typeof key === "string" && photos.push({ label: `${label} ${i + 1}`, key }));
    else if (typeof v === "string" && v) photos.push({ label, key: v });
  }
  return { fields, photos };
}