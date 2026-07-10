// Contract between the chat UI and whatever answers questions. Today a local,
// data-grounded stand-in implements it (assistant/localProvider.ts); later a teammate
// swaps in a provider that POSTs to the backend LLM — the UI doesn't change as long as
// the backend returns this same { text, actions } shape (an LLM with function/tool
// calling maps naturally onto MapAction).

import type { CountryCode, RiskRegion } from "../types/risk";
import type { FilterKey, Focus } from "../store/useStore";

// An action the assistant can take on the map. The widget executes these when a reply
// arrives and also renders them as re-runnable chips.
export type MapAction =
  | { type: "setCountry"; country: CountryCode; label: string }
  | { type: "setFilter"; filter: FilterKey; label: string }
  | { type: "focusRegion"; regionId: string; label: string }
  | { type: "focusDistrict"; districtId: string; label: string }
  | { type: "focusCountry"; label: string }
  | { type: "toggleLayer"; layer: "fire" | "flood"; label: string };

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions?: MapAction[];
}

// Snapshot of app state the provider can ground answers in. The local provider also
// reads the bundled ADM1 datasets directly so it can answer about other countries; a
// backend provider would have all of this server-side.
export interface AssistantContext {
  country: CountryCode;
  countryLabel: string;
  regions: RiskRegion[]; // current country ADM1
  districts: RiskRegion[]; // current country ADM2 (may be empty until preloaded)
  focus: Focus;
}

export interface AssistantProvider {
  respond(query: string, ctx: AssistantContext): Promise<AssistantMessage>;
}
