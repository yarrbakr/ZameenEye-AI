import { useEffect } from "react";
import { useStore } from "../store/useStore";
import type { CountryData } from "../types/risk";

// Reads the current country's resolved data from the store cache and ensures it is
// loaded. Components consume ONLY this hook — swapping to live data is done in
// data/loadCountry.ts, never here or in components.
export function useCountryData(): {
  code: ReturnType<typeof useStore.getState>["selectedCountry"];
  data: CountryData | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const code = useStore((s) => s.selectedCountry);
  const data = useStore((s) => s.cache[s.selectedCountry] ?? null);
  const loading = useStore((s) => s.loadingCountry);
  const error = useStore((s) => s.loadError);
  const setCountry = useStore((s) => s.setCountry);
  const retry = useStore((s) => s.retryLoad);

  // Trigger the initial load (and any not-yet-cached country the store points at).
  useEffect(() => {
    if (!data && !error) void setCountry(code);
  }, [code, data, error, setCountry]);

  return { code, data, loading, error, retry };
}
