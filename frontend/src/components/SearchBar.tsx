import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store/useStore";
import { useSearchIndex } from "../hooks/useSearchIndex";
import { RISK_LABEL } from "../types/risk";

// Renders a region name with the fuzzy-matched character ranges bolded.
function Highlighted({
  name,
  indices,
}: {
  name: string;
  indices: readonly [number, number][];
}) {
  if (!indices.length) return <>{name}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const sorted = [...indices].sort((a, b) => a[0] - b[0]);
  for (const [start, end] of sorted) {
    if (start > cursor) parts.push(name.slice(cursor, start));
    parts.push(
      <b key={start} className="font-bold text-ink">
        {name.slice(start, end + 1)}
      </b>
    );
    cursor = end + 1;
  }
  if (cursor < name.length) parts.push(name.slice(cursor));
  return <>{parts}</>;
}

export function SearchBar() {
  const { fuse, byId } = useSearchIndex();
  const setSearch = useStore((s) => s.setSearch);
  const focusRegion = useStore((s) => s.focusRegion);
  const focusDistrict = useStore((s) => s.focusDistrict);
  const searchQuery = useStore((s) => s.searchQuery);

  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep local input in sync when the store search is cleared elsewhere (Reset).
  useEffect(() => {
    if (searchQuery === "") setInput("");
  }, [searchQuery]);

  // Debounce writes to the store (drives map dimming) by 150ms.
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(input), 150);
    return () => window.clearTimeout(t);
  }, [input, setSearch]);

  const results = useMemo(() => {
    const q = input.trim();
    if (!q) return [];
    return fuse.search(q).slice(0, 8);
  }, [fuse, input]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => setHighlight(0), [input]);

  function select(id: string, name: string) {
    setInput(name);
    setSearch(name);
    // Drill straight to the picked piece: a district focuses its district (which
    // also drills through its parent region), a region focuses the region.
    if (byId[id]?.adminLevel === 2) focusDistrict(id);
    else focusRegion(id);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[highlight];
      if (r) select(r.item.id, r.item.regionName);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && input.trim().length > 0 && results.length > 0;

  return (
    <div ref={wrapRef} className="relative w-full max-w-xs">
      <div className="glass flex items-center gap-2 rounded-lg px-3 py-2">
        <span className="text-ink-dim" aria-hidden="true">
          ⌕
        </span>
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-listbox"
          aria-autocomplete="list"
          placeholder="Search regions…"
          className="focusable w-full bg-transparent font-display text-sm text-ink placeholder:text-ink-dim focus:outline-none"
        />
        {input && (
          <button
            onClick={() => {
              setInput("");
              setSearch("");
              setOpen(false);
            }}
            aria-label="Clear search"
            className="focusable text-ink-dim hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.ul
            id="search-listbox"
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="glass absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-lg p-1 panel-scroll"
          >
            {results.map((r, i) => {
              const indices =
                (r.matches?.[0]?.indices as [number, number][]) ?? [];
              return (
                <li key={r.item.id} role="option" aria-selected={i === highlight}>
                  <button
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => select(r.item.id, r.item.regionName)}
                    className={`focusable flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${
                      i === highlight ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="min-w-0 truncate text-ink-dim">
                      <Highlighted name={r.item.regionName} indices={indices} />
                      {r.item.adminLevel === 2 && (
                        <span className="ml-1.5 text-[11px] text-ink-dim/70">
                          · {r.item.parentName}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-dim">
                      {r.item.adminLevel === 2 && (
                        <span className="rounded bg-white/10 px-1 py-0.5 text-[9px]">
                          district
                        </span>
                      )}
                      {RISK_LABEL[r.item.riskType]}
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
