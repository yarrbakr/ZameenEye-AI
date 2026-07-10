import { useStore } from "../store/useStore";

// Clears search, filter and selected region, then re-fits zoom to the current
// country. Does NOT change the selected country.
export function ResetButton() {
  const reset = useStore((s) => s.reset);
  return (
    <button
      onClick={reset}
      className="focusable glass rounded-lg px-3 py-2 font-display text-xs font-medium tracking-wide text-ink-dim hover:text-ink"
    >
      ⟲ Reset view
    </button>
  );
}
