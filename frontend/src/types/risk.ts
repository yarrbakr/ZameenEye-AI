// Core domain types for ZameenEye AI Console.
// The data layer is mock-but-realistic; swapping in live data is a one-file change
// in `hooks/useCountryData.ts` — no component touches these shapes directly except
// through that hook.

export type CountryCode = "pakistan" | "india" | "kenya";

export type RiskType = "drought" | "flood" | "fire" | "soil-degradation";

export type AdvisoryLanguage = "ur" | "hi" | "sw";

export interface RiskRegion {
  id: string;
  regionName: string;
  country: CountryCode;
  riskType: RiskType;
  severity: number; // 0-100 — a MODELED / illustrative index (no measured method yet)
  activeAlert: boolean; // true forces the region into the red/critical band regardless of severity
  lastUpdated: string; // ISO date
  summary: string; // 1-2 sentence human-readable context
  advisoryScript: string; // sample localized advisory text standing in for TTS output
  advisoryLanguage: AdvisoryLanguage;
  relatedRegionIds: string[]; // other regions sharing the same active riskType
  // Populated for ADM2 (district) records surfaced by the zoom-reveal detail level.
  adminLevel?: 1 | 2;
  parentId?: string; // ADM1 region id this district belongs to
  parentName?: string; // ADM1 region name, for breadcrumb context
  // Present only when the severity number came from a real method. Absent => the
  // number is a modeled/illustrative stand-in and the UI labels it as such.
  scoreMethod?: string;
}

// A single thermal-anomaly hotspot (stand-in for NASA FIRMS).
export interface FireHotspot {
  id: string;
  lat: number;
  lng: number;
  intensity: number; // 0-100, drives marker radius via scaleSqrt
}

// Flood extent is a GeoJSON FeatureCollection (stand-in for UNOSAT flood extent).
export interface CountryOverlays {
  fire: FireHotspot[];
  flood: GeoJSON.FeatureCollection;
}

// The full bundle a country needs, resolved by useCountryData and cached per code.
export interface CountryData {
  code: CountryCode;
  geo: GeoJSON.FeatureCollection;
  regions: Record<string, RiskRegion>; // keyed by region id
  overlays: CountryOverlays;
}

// ---- Severity bands (identical across all three countries) ----

export type SeverityBand = "normal" | "watch" | "warning" | "critical";

export interface BandSpec {
  band: SeverityBand;
  label: string;
  color: string;
  min: number;
  max: number;
}

export const SEVERITY_BANDS: BandSpec[] = [
  { band: "normal", label: "Normal", color: "#3aa15e", min: 0, max: 24 },
  { band: "watch", label: "Watch", color: "#e0a63a", min: 25, max: 49 },
  { band: "warning", label: "Warning", color: "#e0763a", min: 50, max: 74 },
  { band: "critical", label: "Critical", color: "#e0483a", min: 75, max: 100 },
];

// Fill color is a pure function of (severity, activeAlert). An active alert forces
// the critical band regardless of the numeric severity. Never key color off region name.
export function bandFor(severity: number, activeAlert: boolean): BandSpec {
  if (activeAlert) return SEVERITY_BANDS[3];
  return (
    SEVERITY_BANDS.find((b) => severity >= b.min && severity <= b.max) ??
    SEVERITY_BANDS[0]
  );
}

export function colorFor(severity: number, activeAlert: boolean): string {
  return bandFor(severity, activeAlert).color;
}

export const RISK_TYPES: RiskType[] = [
  "drought",
  "flood",
  "fire",
  "soil-degradation",
];

export const RISK_LABEL: Record<RiskType, string> = {
  drought: "Drought",
  flood: "Flood",
  fire: "Fire",
  "soil-degradation": "Soil Degradation",
};

export const RISK_ICON: Record<RiskType, string> = {
  drought: "☀",
  flood: "🌊",
  fire: "🔥",
  "soil-degradation": "🌱",
};

export const LANGUAGE_LABEL: Record<AdvisoryLanguage, string> = {
  ur: "Urdu",
  hi: "Hindi",
  sw: "Swahili",
};

// ---- Alert severity classification (triage: High / Medium / Low) ----
//
// This is the farmer-facing TRIAGE layer that sits on top of the 0-100 severity
// index. The backend categorizes every active hazard into one of three priorities
// so the console can surface the few that demand action and mute the rest — the core
// defense against "alert fatigue". It's derived from the severity band + activeAlert
// flag (see bandFor above) so triage stays in lockstep with the region fill color and
// there is one source of truth. When the compute team ships real thresholds, this is
// the only mapping that changes.

export type AlertSeverity = "high" | "medium" | "low";

export interface AlertSeveritySpec {
  key: AlertSeverity;
  label: string; // "High" / "Medium" / "Low"
  short: string; // "HIGH" / "MED" / "LOW" — compact feed chip
  color: string;
  action: string; // one-line triage guidance shown to the farmer
}

export const ALERT_SEVERITY: Record<AlertSeverity, AlertSeveritySpec> = {
  high: {
    key: "high",
    label: "High",
    short: "HIGH",
    color: "#e0483a",
    action: "Act now — imminent threat to crops or livestock.",
  },
  medium: {
    key: "medium",
    label: "Medium",
    short: "MED",
    color: "#e0763a",
    action: "Plan ahead — conditions worsening this week.",
  },
  low: {
    key: "low",
    label: "Low",
    short: "LOW",
    color: "#e0a63a",
    action: "Stay aware — elevated but not urgent.",
  },
};

// Highest priority first — the order the feed and the badge iterate in.
export const ALERT_SEVERITY_ORDER: AlertSeverity[] = ["high", "medium", "low"];

// Map the severity band -> alert triage priority. A `normal` region is NOT an alert
// (returns null) — that omission is deliberate: not surfacing calm regions as alerts
// is what keeps the feed actionable. An active alert / critical index is always High.
export function alertSeverityFor(
  severity: number,
  activeAlert: boolean
): AlertSeverity | null {
  switch (bandFor(severity, activeAlert).band) {
    case "critical":
      return "high";
    case "warning":
      return "medium";
    case "watch":
      return "low";
    default:
      return null; // normal — kept out of the alert stream on purpose
  }
}
