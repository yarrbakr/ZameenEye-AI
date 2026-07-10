import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { useSearchIndex } from "./useSearchIndex";
import { alertEvents, type AlertEvent } from "../lib/selectors";
import type { AlertSeverity } from "../types/risk";

// A hazard event as it arrives in the live feed: the classified alert plus the
// wall-clock time it streamed in and a stable key for React + flash animation.
export interface StreamedAlert extends AlertEvent {
  key: string;
  ts: number; // Date.now() when this row streamed in
}

// The compute team's poller pushes hazards as they're detected. Here the data is
// static, so we *simulate* that push: on a fixed cadence we emit one classified
// hazard to the top of the feed, weighted so High-priority events dominate the
// stream (mirroring a real feed where critical hazards recur most). This is the
// only place that fakes "liveness" — swap this emitter for a WebSocket subscription
// and the feed UI is unchanged.
const EMIT_MS = 3400; // a new hazard scrolls in ~every 3.4s
const SEED_ROWS = 6; // pre-fill so the feed is populated the instant it opens
const MAX_ROWS = 40; // rolling buffer cap
const WEIGHT: Record<AlertSeverity, number> = { high: 6, medium: 3, low: 1 };

interface Buckets {
  high: AlertEvent[];
  medium: AlertEvent[];
  low: AlertEvent[];
}

function pickWeighted(buckets: Buckets): AlertEvent | null {
  const present = (Object.keys(WEIGHT) as AlertSeverity[]).filter(
    (k) => buckets[k].length > 0
  );
  if (present.length === 0) return null;
  const total = present.reduce((sum, k) => sum + WEIGHT[k], 0);
  let roll = Math.random() * total;
  for (const k of present) {
    roll -= WEIGHT[k];
    if (roll <= 0) {
      const list = buckets[k];
      return list[Math.floor(Math.random() * list.length)];
    }
  }
  return buckets[present[0]][0];
}

export function useAlertStream(active: boolean): {
  rows: StreamedAlert[];
  now: number;
  counts: Record<AlertSeverity, number>;
  total: number;
} {
  const code = useStore((s) => s.selectedCountry);
  const { regions, districts } = useSearchIndex();

  // Full pool of classified hazards for the current country (ADM1 + ADM2), split
  // into weighted buckets. Recomputes on country switch / district preload.
  const { buckets, counts, total } = useMemo(() => {
    const events = alertEvents([...regions, ...districts]);
    const b: Buckets = { high: [], medium: [], low: [] };
    for (const e of events) b[e.severity].push(e);
    return {
      buckets: b,
      counts: { high: b.high.length, medium: b.medium.length, low: b.low.length },
      total: events.length,
    };
  }, [regions, districts]);

  const [rows, setRows] = useState<StreamedAlert[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const seq = useRef(0);

  const emit = useMemo(
    () => (): StreamedAlert | null => {
      const event = pickWeighted(buckets);
      if (!event) return null;
      return { ...event, key: `${code}-${seq.current++}`, ts: Date.now() };
    },
    [buckets, code]
  );

  // Reset + seed the feed whenever the country (and thus the pool) changes.
  useEffect(() => {
    const seeded: StreamedAlert[] = [];
    for (let i = 0; i < SEED_ROWS; i++) {
      const row = emit();
      if (row) seeded.push(row);
    }
    setRows(seeded);
    setNow(Date.now());
  }, [emit]);

  // Stream new hazards in while the feed is open (pause the emitter when closed).
  useEffect(() => {
    if (!active || total === 0) return;
    const id = window.setInterval(() => {
      const row = emit();
      if (row) setRows((prev) => [row, ...prev].slice(0, MAX_ROWS));
    }, EMIT_MS);
    return () => window.clearInterval(id);
  }, [active, total, emit]);

  // Tick once a second so relative timestamps ("12s ago") stay current.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  return { rows, now, counts, total };
}

// Compact relative-time label for feed rows.
export function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}
