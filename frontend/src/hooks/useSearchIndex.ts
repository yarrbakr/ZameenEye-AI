import { useMemo } from "react";
import Fuse from "fuse.js";
import { useStore } from "../store/useStore";
import { createFuse } from "../lib/search";
import type { RiskRegion } from "../types/risk";

// Combined searchable index for the current country: ADM1 regions always, plus ADM2
// districts once they've preloaded. Everything that searches or looks a region up by
// id (map dimming, search dropdown, alert badge, info panel) goes through here so the
// two admin levels stay consistent.
export function useSearchIndex(): {
  regions: RiskRegion[];
  districts: RiskRegion[];
  fuse: Fuse<RiskRegion>;
  byId: Record<string, RiskRegion>;
} {
  const code = useStore((s) => s.selectedCountry);
  const regionMap = useStore((s) => s.cache[s.selectedCountry]?.regions);
  const districtMap = useStore(
    (s) => s.districtCache[s.selectedCountry]?.regions
  );

  const regions = useMemo(
    () => (regionMap ? Object.values(regionMap) : []),
    [regionMap]
  );
  const districts = useMemo(
    () => (districtMap ? Object.values(districtMap) : []),
    [districtMap]
  );

  const combined = useMemo(
    () => [...regions, ...districts],
    [regions, districts]
  );
  const fuse = useMemo(() => createFuse(combined), [combined]);
  const byId = useMemo(() => {
    const m: Record<string, RiskRegion> = {};
    for (const r of combined) m[r.id] = r;
    return m;
  }, [combined]);

  // `code` keeps the memo identity honest across country switches.
  void code;
  return { regions, districts, fuse, byId };
}

export function searchIdSet(
  fuse: Fuse<RiskRegion>,
  query: string
): Set<string> | null {
  const q = query.trim();
  if (!q) return null;
  return new Set(fuse.search(q).map((r) => r.item.id));
}
