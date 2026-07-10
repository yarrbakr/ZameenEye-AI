// Local, data-grounded stand-in for the backend LLM. It parses the question for
// intent, grounds the answer in the mock risk data, and returns map actions that
// drive the console. This whole file is the swap point: replace it with a provider
// that calls the real backend and the chat UI is unchanged.

import type { AssistantMessage, AssistantProvider, MapAction } from "./types";
import type { CountryCode, RiskRegion, RiskType } from "../types/risk";
import { RISK_LABEL, bandFor } from "../types/risk";
import pakistanRisk from "../data/mock/pakistan-risk.json";
import indiaRisk from "../data/mock/india-risk.json";
import kenyaRisk from "../data/mock/kenya-risk.json";

const DATASETS: Record<CountryCode, RiskRegion[]> = {
  pakistan: pakistanRisk as RiskRegion[],
  india: indiaRisk as RiskRegion[],
  kenya: kenyaRisk as RiskRegion[],
};
const COUNTRY_LABEL: Record<CountryCode, string> = {
  pakistan: "Pakistan",
  india: "India",
  kenya: "Kenya",
};
const COUNTRY_WORDS: Record<CountryCode, string[]> = {
  pakistan: ["pakistan", "pak"],
  india: ["india", "indian", "bharat"],
  kenya: ["kenya", "kenyan"],
};
const RISK_WORDS: Record<RiskType, string[]> = {
  drought: ["drought", "dry", "water shortage", "arid"],
  flood: ["flood", "flooding", "inundation", "monsoon"],
  fire: ["fire", "wildfire", "burn", "thermal", "blaze"],
  "soil-degradation": ["soil", "erosion", "degradation", "salinity"],
};

let msgSeq = 0;
const nextId = () => `a-${Date.now()}-${msgSeq++}`;

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function describe(r: RiskRegion): string {
  const b = bandFor(r.severity, r.activeAlert);
  return `${RISK_LABEL[r.riskType]}, ${r.severity}/100 (${b.label}${r.activeAlert ? ", active alert" : ""})`;
}

function topBySeverity(list: RiskRegion[], n: number): RiskRegion[] {
  return [...list]
    .sort((a, b) => Number(b.activeAlert) - Number(a.activeAlert) || b.severity - a.severity)
    .slice(0, n);
}

function detectCountry(q: string): CountryCode | null {
  for (const c of Object.keys(COUNTRY_WORDS) as CountryCode[]) {
    if (COUNTRY_WORDS[c].some((w) => q.includes(w))) return c;
  }
  return null;
}

function detectRisk(q: string): RiskType | null {
  for (const t of Object.keys(RISK_WORDS) as RiskType[]) {
    if (RISK_WORDS[t].some((w) => q.includes(w))) return t;
  }
  return null;
}

// Longest region/district name mentioned in the query.
function detectPlace(q: string, places: RiskRegion[]): RiskRegion | null {
  let best: RiskRegion | null = null;
  for (const p of places) {
    const n = norm(p.regionName);
    if (n.length > 3 && q.includes(n)) {
      if (!best || n.length > norm(best.regionName).length) best = p;
    }
  }
  return best;
}

function msg(text: string, actions?: MapAction[]): AssistantMessage {
  return { id: nextId(), role: "assistant", text, actions };
}

export const localProvider: AssistantProvider = {
  async respond(query, ctx) {
    // Small delay so the typing indicator reads as "thinking".
    await new Promise((r) => setTimeout(r, 350));

    const q = norm(query);
    const targetCountry = detectCountry(q) ?? ctx.country;
    const switching = targetCountry !== ctx.country;
    const targetLabel = COUNTRY_LABEL[targetCountry];
    const regions = DATASETS[targetCountry];
    // District-level answers are only possible for the loaded country.
    const districts = targetCountry === ctx.country ? ctx.districts : [];
    const switchAction: MapAction[] = switching
      ? [{ type: "setCountry", country: targetCountry, label: `Switch to ${targetLabel}` }]
      : [];

    // ---- Help / capabilities ----
    if (/\b(help|what can you|how do you|capabilities)\b/.test(q)) {
      return msg(
        "I can answer questions about drought, flood, fire and soil-degradation risk across Pakistan, India and Kenya — and drive the map for you. Try:\n• “Which regions have active alerts?”\n• “Show drought risk in India”\n• “What’s the worst-hit region?”\n• “Zoom to Sindh”"
      );
    }

    // ---- Named place ----
    const place = detectPlace(q, [...regions, ...districts]);
    if (place) {
      if (place.adminLevel === 2 && !switching) {
        return msg(
          `${place.regionName} district (${place.parentName ?? ""}, ${targetLabel}) — ${describe(place)}. ${place.summary}`,
          [{ type: "focusDistrict", districtId: place.id, label: `Zoom to ${place.regionName}` }]
        );
      }
      if (!switching) {
        return msg(`${place.regionName} (${targetLabel}) — ${describe(place)}. ${place.summary}`, [
          { type: "focusRegion", regionId: place.id, label: `Zoom to ${place.regionName}` },
        ]);
      }
      // Place is in another country: switch first, then the user can drill in.
      return msg(
        `${place.regionName} is in ${targetLabel} — ${describe(place)}. Switching there so you can zoom in.`,
        switchAction
      );
    }

    // ---- Active alerts ----
    if (/\b(alert|alerts|critical|emergency|urgent)\b/.test(q)) {
      const alerts = topBySeverity(regions.filter((r) => r.activeAlert), 6);
      const actions: MapAction[] = [
        ...switchAction,
        { type: "setFilter", filter: "active-alerts", label: "Filter: Active Alerts" },
      ];
      if (!alerts.length)
        return msg(`No regions are under an active alert in ${targetLabel} right now.`, switchAction);
      const list = alerts.map((r) => `• ${r.regionName} — ${describe(r)}`).join("\n");
      return msg(`${alerts.length} region(s) under active alert in ${targetLabel}:\n${list}`, actions);
    }

    // ---- Risk type ----
    const risk = detectRisk(q);
    if (risk) {
      const of = regions.filter((r) => r.riskType === risk);
      const top = topBySeverity(of, 5);
      const actions: MapAction[] = [
        ...switchAction,
        { type: "setFilter", filter: risk, label: `Filter: ${RISK_LABEL[risk]}` },
      ];
      if (!top.length)
        return msg(`No ${RISK_LABEL[risk]} risk is flagged in ${targetLabel} right now.`, actions);
      const list = top.map((r) => `• ${r.regionName} — ${r.severity}/100 (${bandFor(r.severity, r.activeAlert).label})`).join("\n");
      return msg(
        `Top ${RISK_LABEL[risk]} risk in ${targetLabel}:\n${list}\n\nI’ve filtered the map to ${RISK_LABEL[risk]}.`,
        actions
      );
    }

    // ---- Worst / highest ----
    if (/\b(worst|highest|most|riskiest|dangerous|severe|hardest)\b/.test(q)) {
      const top = topBySeverity(regions, 3);
      const lead = top[0];
      const list = top.map((r) => `• ${r.regionName} — ${describe(r)}`).join("\n");
      const actions: MapAction[] = [...switchAction];
      if (lead && !switching)
        actions.push({ type: "focusRegion", regionId: lead.id, label: `Zoom to ${lead.regionName}` });
      return msg(`Most at-risk in ${targetLabel}:\n${list}`, actions);
    }

    // ---- Summary / counts ----
    if (/\b(summary|overview|how many|breakdown|status|situation|report)\b/.test(q)) {
      const alerts = regions.filter((r) => r.activeAlert).length;
      const crit = regions.filter((r) => bandFor(r.severity, r.activeAlert).band === "critical").length;
      return msg(
        `${targetLabel}: ${regions.length} regions monitored — ${crit} in the critical band, ${alerts} under active alert.`,
        switchAction
      );
    }

    // ---- Greeting ----
    if (/^(hi|hello|hey|yo|salaam|namaste|jambo)\b/.test(q)) {
      return msg(
        `Hi! I’m the ZameenEye assistant. Ask me about climate risk in ${targetLabel} — e.g. “which regions have active alerts?” or “show drought risk in India”.`
      );
    }

    // ---- Fallback ----
    return msg(
      `I’m not sure how to answer that yet — I’m a local stand-in until the ZameenEye model is connected. Try asking about active alerts, a specific risk type (drought/flood/fire/soil), the worst-hit region, or a place name like “Sindh” or “Turkana”.`
    );
  },
};
