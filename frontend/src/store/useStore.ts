import { create } from "zustand";
import type { CountryCode, CountryData, RiskType } from "../types/risk";
import {
  loadCountryData,
  loadDistrictData,
  type DistrictData,
} from "../data/loadCountry";

export type FilterKey = "all" | RiskType | "active-alerts";

export type DetailLevel = "country" | "region" | "district";

export interface LayerToggles {
  fire: boolean;
  flood: boolean;
}

// Selection-driven drill state. There is no free zoom — the view is always fitted to
// the current focus, and selecting a piece drills one level deeper.
export type Focus =
  | { level: "country" }
  | { level: "region"; regionId: string }
  | { level: "district"; districtId: string; regionId: string };

// Bumped whenever the map should re-run its fit-to-focus animation (focus change,
// resize, reset) so MapCanvas reacts without the store holding a D3 handle.
export interface FitSignal {
  focus: Focus;
  nonce: number;
}

interface AppState {
  selectedCountry: CountryCode;
  cache: Partial<Record<CountryCode, CountryData>>;
  districtCache: Partial<Record<CountryCode, DistrictData>>;
  loadingCountry: boolean;
  loadError: string | null;

  focus: Focus;
  selectedRegionId: string | null; // what the info panel describes (region or district id)
  activeFilter: FilterKey;
  searchQuery: string;
  layers: LayerToggles; // persistent across country switches (viewing preference)

  fit: FitSignal; // drives the fit-to-focus animation
  crossfadeNonce: number; // bumped on every successful country switch

  setCountry: (code: CountryCode) => Promise<void>;
  loadDistricts: (code: CountryCode) => Promise<void>;
  retryLoad: () => void;
  focusRegion: (regionId: string) => void;
  focusDistrict: (districtId: string) => void;
  focusUp: () => void;
  focusCountry: () => void;
  setFilter: (f: FilterKey) => void;
  setSearch: (q: string) => void;
  toggleLayer: (layer: keyof LayerToggles) => void;
  refit: () => void;
  reset: () => void;
}

let fitCounter = 1;
const inFlight = new Set<CountryCode>();
const inFlightDistricts = new Set<CountryCode>();

const COUNTRY_FOCUS: Focus = { level: "country" };

export const useStore = create<AppState>((set, get) => ({
  selectedCountry: "pakistan",
  cache: {},
  districtCache: {},
  loadingCountry: false,
  loadError: null,

  focus: COUNTRY_FOCUS,
  selectedRegionId: null,
  activeFilter: "all",
  searchQuery: "",
  layers: { fire: false, flood: false },

  fit: { focus: COUNTRY_FOCUS, nonce: 0 },
  crossfadeNonce: 0,

  setCountry: async (code) => {
    const { selectedCountry, cache } = get();
    // Re-selecting the current, loaded country resets it to the country-fit view.
    if (code === selectedCountry && cache[code] && !get().loadError) {
      get().focusCountry();
      return;
    }
    if (inFlight.has(code)) return;

    // Per-country state resets; layer toggles intentionally persist.
    set({
      selectedCountry: code,
      focus: COUNTRY_FOCUS,
      selectedRegionId: null,
      searchQuery: "",
      activeFilter: "all",
      loadError: null,
      fit: { focus: COUNTRY_FOCUS, nonce: fitCounter++ },
    });

    if (cache[code]) {
      set((s) => ({ loadingCountry: false, crossfadeNonce: s.crossfadeNonce + 1 }));
      void get().loadDistricts(code);
      return;
    }

    inFlight.add(code);
    set({ loadingCountry: true });
    try {
      const data = await loadCountryData(code);
      set((s) => ({
        cache: { ...s.cache, [code]: data },
        loadingCountry: get().selectedCountry === code ? false : s.loadingCountry,
        crossfadeNonce:
          get().selectedCountry === code
            ? s.crossfadeNonce + 1
            : s.crossfadeNonce,
      }));
      void get().loadDistricts(code);
    } catch (err) {
      if (get().selectedCountry === code) {
        set({
          loadingCountry: false,
          loadError:
            err instanceof Error
              ? err.message
              : `Failed to load ${code} map data.`,
        });
      }
    } finally {
      inFlight.delete(code);
    }
  },

  loadDistricts: async (code) => {
    if (get().districtCache[code] || inFlightDistricts.has(code)) return;
    inFlightDistricts.add(code);
    try {
      const data = await loadDistrictData(code);
      set((s) => ({ districtCache: { ...s.districtCache, [code]: data } }));
    } catch {
      // Districts are an enhancement — silently skip if they fail to load.
    } finally {
      inFlightDistricts.delete(code);
    }
  },

  retryLoad: () => {
    const code = get().selectedCountry;
    set((s) => {
      const next = { ...s.cache };
      delete next[code];
      return { cache: next, loadError: null };
    });
    void get().setCountry(code);
  },

  focusRegion: (regionId) => {
    const focus: Focus = { level: "region", regionId };
    set({
      focus,
      selectedRegionId: regionId,
      fit: { focus, nonce: fitCounter++ },
    });
    void get().loadDistricts(get().selectedCountry);
  },

  focusDistrict: (districtId) => {
    const code = get().selectedCountry;
    const district = get().districtCache[code]?.regions[districtId];
    const regionId = district?.parentId ?? "";
    const focus: Focus = { level: "district", districtId, regionId };
    set({
      focus,
      selectedRegionId: districtId,
      fit: { focus, nonce: fitCounter++ },
    });
  },

  focusUp: () => {
    const { focus } = get();
    if (focus.level === "district") {
      const up: Focus = { level: "region", regionId: focus.regionId };
      set({ focus: up, selectedRegionId: focus.regionId, fit: { focus: up, nonce: fitCounter++ } });
    } else if (focus.level === "region") {
      get().focusCountry();
    }
  },

  focusCountry: () =>
    set({
      focus: COUNTRY_FOCUS,
      selectedRegionId: null,
      fit: { focus: COUNTRY_FOCUS, nonce: fitCounter++ },
    }),

  setFilter: (f) => set({ activeFilter: f }),
  setSearch: (q) => set({ searchQuery: q }),
  toggleLayer: (layer) =>
    set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),

  refit: () => set((s) => ({ fit: { focus: s.focus, nonce: fitCounter++ } })),

  reset: () =>
    set({
      searchQuery: "",
      activeFilter: "all",
      focus: COUNTRY_FOCUS,
      selectedRegionId: null,
      fit: { focus: COUNTRY_FOCUS, nonce: fitCounter++ },
    }),
}));
