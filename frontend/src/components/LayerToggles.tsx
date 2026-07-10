import { useStore, type LayerToggles as LayerState } from "../store/useStore";

const LAYERS: { key: keyof LayerState; label: string; dot: string }[] = [
  { key: "fire", label: "Fire Hotspots", dot: "#e0483a" },
  { key: "flood", label: "Flood Perimeters", dot: "#3a7ce0" },
];

// Overlay visibility switches — independent of country and filter/search state.
// Separate from the severity legend so "region color" isn't confused with "overlay".
export function LayerToggles() {
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);

  return (
    <div className="glass rounded-lg p-3">
      <div className="mb-2 font-display text-[10px] font-semibold uppercase tracking-widest text-ink-dim">
        Layers
      </div>
      <div className="space-y-2">
        {LAYERS.map((l) => {
          const on = layers[l.key];
          return (
            <button
              key={l.key}
              role="switch"
              aria-checked={on}
              onClick={() => toggleLayer(l.key)}
              className="focusable flex w-full items-center gap-2.5"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: l.dot }}
                aria-hidden="true"
              />
              <span className="font-display text-xs text-ink">{l.label}</span>
              <span
                className={`ml-auto flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${
                  on ? "bg-flood-blue" : "bg-white/15"
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white transition-transform ${
                    on ? "translate-x-3" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
