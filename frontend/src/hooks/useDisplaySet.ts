import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { useSearchIndex } from "./useSearchIndex";
import type { RiskRegion } from "../types/risk";

// The set of pieces currently on screen, derived from the drill focus:
//  country  -> all provinces/regions
//  region   -> that region's districts (or the region itself until districts load)
//  district -> the single focused district
export function useDisplaySet(): {
  set: RiskRegion[];
  noun: string;
  level: "country" | "region" | "district";
} {
  const focus = useStore((s) => s.focus);
  const { regions, districts } = useSearchIndex();

  return useMemo(() => {
    if (focus.level === "country") {
      return { set: regions, noun: "regions", level: "country" as const };
    }
    if (focus.level === "region") {
      const kids = districts.filter((d) => d.parentId === focus.regionId);
      return kids.length
        ? { set: kids, noun: "districts", level: "region" as const }
        : { set: regions, noun: "regions", level: "region" as const };
    }
    const d = districts.find((x) => x.id === focus.districtId);
    return { set: d ? [d] : [], noun: "district", level: "district" as const };
  }, [focus, regions, districts]);
}
