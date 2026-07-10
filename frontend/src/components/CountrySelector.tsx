import { useStore } from "../store/useStore";
import type { CountryCode } from "../types/risk";

const COUNTRIES: { code: CountryCode; label: string }[] = [
  { code: "pakistan", label: "Pakistan" },
  { code: "india", label: "India" },
  { code: "kenya", label: "Kenya" },
];

// Native <button> segmented control — keyboard/tab operable out of the box.
export function CountrySelector() {
  const selected = useStore((s) => s.selectedCountry);
  const setCountry = useStore((s) => s.setCountry);

  return (
    <div
      role="tablist"
      aria-label="Select country"
      className="glass inline-flex rounded-lg p-1"
    >
      {COUNTRIES.map((c) => {
        const active = c.code === selected;
        return (
          <button
            key={c.code}
            role="tab"
            aria-selected={active}
            onClick={() => void setCountry(c.code)}
            className={`focusable rounded-md px-4 py-1.5 font-display text-sm font-medium tracking-wide transition-colors ${
              active
                ? "bg-flood-blue/90 text-white shadow"
                : "text-ink-dim hover:text-ink"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
