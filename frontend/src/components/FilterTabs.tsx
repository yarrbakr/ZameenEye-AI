import { useStore, type FilterKey } from "../store/useStore";

const TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "drought", label: "Drought" },
  { key: "flood", label: "Flood" },
  { key: "fire", label: "Fire" },
  { key: "soil-degradation", label: "Soil Degradation" },
  { key: "active-alerts", label: "Active Alerts" },
];

// Single-select filter. Selecting a tab triggers the lego-pop eject on matching
// regions and dims the rest (handled in RegionPath via selectionActive/matched).
export function FilterTabs() {
  const activeFilter = useStore((s) => s.activeFilter);
  const setFilter = useStore((s) => s.setFilter);
  const searchQuery = useStore((s) => s.searchQuery);

  // While searching, the search overrides the filter — reflect that as disabled.
  const searchActive = searchQuery.trim().length > 0;

  return (
    <div
      role="group"
      aria-label="Filter by risk type"
      className="flex flex-wrap items-center gap-1.5"
    >
      {TABS.map((t) => {
        const active = !searchActive && activeFilter === t.key;
        const isAlerts = t.key === "active-alerts";
        return (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            aria-pressed={active}
            className={`focusable rounded-full border px-3 py-1 font-display text-xs font-medium tracking-wide transition-colors ${
              active
                ? isAlerts
                  ? "border-band-critical bg-band-critical/20 text-band-critical"
                  : "border-flood-blue bg-flood-blue/20 text-ink"
                : "border-panel-border bg-white/[0.03] text-ink-dim hover:text-ink"
            } ${searchActive ? "opacity-50" : ""}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
