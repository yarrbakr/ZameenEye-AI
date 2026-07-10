import { useState } from "react";
import { SEVERITY_BANDS } from "../types/risk";

// Severity legend. Severity is never conveyed by color alone — the numeric range is
// shown beside each chip, and the info panel/tooltip always show the number too.
export function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass rounded-lg">
      {/* Mobile: collapsed chip that expands. Desktop: always expanded. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="focusable flex w-full items-center gap-2 px-3 py-2 md:hidden"
      >
        <span className="font-display text-xs font-semibold uppercase tracking-widest text-ink-dim">
          Legend
        </span>
        <span className="ml-auto text-ink-dim">{open ? "▾" : "▸"}</span>
      </button>

      <div className={`${open ? "block" : "hidden"} p-3 md:block`}>
        <div className="mb-2 hidden font-display text-[10px] font-semibold uppercase tracking-widest text-ink-dim md:block">
          Severity
        </div>
        <ul className="space-y-1.5">
          {SEVERITY_BANDS.map((b) => (
            <li key={b.band} className="flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 rounded-[3px] border border-black/40"
                style={{ backgroundColor: b.color }}
                aria-hidden="true"
              />
              <span className="font-display text-xs text-ink">{b.label}</span>
              <span className="ml-auto pl-3 font-mono text-[10px] text-ink-dim">
                {b.max === 100 ? `${b.min}–100` : `${b.min}–${b.max}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
