import Fuse from "fuse.js";
import type { RiskRegion } from "../types/risk";

// Shared Fuse config so the map's dimming and the search dropdown agree on matches.
export function createFuse(regions: RiskRegion[]): Fuse<RiskRegion> {
  return new Fuse(regions, {
    keys: ["regionName"],
    threshold: 0.3,
    includeMatches: true,
    ignoreLocation: true,
    minMatchCharLength: 1,
  });
}

export type FuseResult = ReturnType<Fuse<RiskRegion>["search"]>;
