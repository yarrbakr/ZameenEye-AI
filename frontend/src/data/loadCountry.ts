// SINGLE SWAP POINT for the data layer.
// Every country's geometry + risk + overlay data is resolved here via dynamic
// import() so nothing is bundled into the initial JS payload. To go live, a
// teammate replaces the import() bodies below with fetch() calls to real endpoints
// — no component or store code changes.

import type {
  CountryCode,
  CountryData,
  CountryOverlays,
  RiskRegion,
} from "../types/risk";

type RiskModule = { default: RiskRegion[] };
type GeoModule = { default: GeoJSON.FeatureCollection };
type OverlayModule = { default: CountryOverlays };

async function loadParts(code: CountryCode): Promise<{
  geo: GeoJSON.FeatureCollection;
  regions: RiskRegion[];
  overlays: CountryOverlays;
}> {
  // Explicit per-country dynamic imports so Vite emits a separate chunk each.
  switch (code) {
    case "pakistan": {
      const [geo, risk, ov] = await Promise.all([
        import("./countries/pakistan.geo.json") as Promise<GeoModule>,
        import("./mock/pakistan-risk.json") as Promise<RiskModule>,
        import("./mock/pakistan-overlays.json") as Promise<OverlayModule>,
      ]);
      return { geo: geo.default, regions: risk.default, overlays: ov.default };
    }
    case "india": {
      const [geo, risk, ov] = await Promise.all([
        import("./countries/india.geo.json") as Promise<GeoModule>,
        import("./mock/india-risk.json") as Promise<RiskModule>,
        import("./mock/india-overlays.json") as Promise<OverlayModule>,
      ]);
      return { geo: geo.default, regions: risk.default, overlays: ov.default };
    }
    case "kenya": {
      const [geo, risk, ov] = await Promise.all([
        import("./countries/kenya.geo.json") as Promise<GeoModule>,
        import("./mock/kenya-risk.json") as Promise<RiskModule>,
        import("./mock/kenya-overlays.json") as Promise<OverlayModule>,
      ]);
      return { geo: geo.default, regions: risk.default, overlays: ov.default };
    }
    default: {
      const _exhaustive: never = code;
      throw new Error(`Unknown country: ${_exhaustive}`);
    }
  }
}

export async function loadCountryData(code: CountryCode): Promise<CountryData> {
  const { geo, regions, overlays } = await loadParts(code);
  if (!geo?.features?.length) {
    throw new Error(`GeoJSON for ${code} is empty or malformed.`);
  }
  const byId: Record<string, RiskRegion> = {};
  for (const r of regions) byId[r.id] = r;
  return { code, geo, regions: byId, overlays };
}

export interface DistrictData {
  geo: GeoJSON.FeatureCollection;
  regions: Record<string, RiskRegion>;
}

// ADM2 (district) geometry + risk, loaded lazily so it never bloats the initial
// payload. Same swap-point convention: replace the import()s with fetch() to go live.
export async function loadDistrictData(
  code: CountryCode
): Promise<DistrictData> {
  let geoMod: GeoModule;
  let riskMod: RiskModule;
  switch (code) {
    case "pakistan":
      [geoMod, riskMod] = await Promise.all([
        import("./districts/pakistan.adm2.json") as Promise<GeoModule>,
        import("./mock/pakistan-risk-adm2.json") as Promise<RiskModule>,
      ]);
      break;
    case "india":
      [geoMod, riskMod] = await Promise.all([
        import("./districts/india.adm2.json") as Promise<GeoModule>,
        import("./mock/india-risk-adm2.json") as Promise<RiskModule>,
      ]);
      break;
    case "kenya":
      [geoMod, riskMod] = await Promise.all([
        import("./districts/kenya.adm2.json") as Promise<GeoModule>,
        import("./mock/kenya-risk-adm2.json") as Promise<RiskModule>,
      ]);
      break;
    default: {
      const _exhaustive: never = code;
      throw new Error(`Unknown country: ${_exhaustive}`);
    }
  }
  const byId: Record<string, RiskRegion> = {};
  for (const r of riskMod.default) byId[r.id] = r;
  return { geo: geoMod.default, regions: byId };
}
