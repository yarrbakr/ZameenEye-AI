import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { useSearchIndex, searchIdSet } from "../hooks/useSearchIndex";
import { useDisplaySet } from "../hooks/useDisplaySet";
import { regionMatches } from "../lib/selectors";
import {
  ALERT_SEVERITY,
  ALERT_SEVERITY_ORDER,
  alertSeverityFor,
  type AlertSeverity,
} from "../types/risk";

// Header triage badge: High / Medium / Low alert counts for the pieces currently on
// screen (country provinces, a region's districts, or one district) with the active
// filter + search applied. Doubles as the launcher for the live hazard feed — the
// whole badge is a toggle so the severity classification is always one click from the
// stream. Updates live.
export function AlertBadge({
  streamOpen,
  onToggleStream,
}: {
  streamOpen: boolean;
  onToggleStream: () => void;
}) {
  const activeFilter = useStore((s) => s.activeFilter);
  const searchQuery = useStore((s) => s.searchQuery);
  const { fuse } = useSearchIndex();
  const { set } = useDisplaySet();

  const searchIds = useMemo(
    () => searchIdSet(fuse, searchQuery),
    [fuse, searchQuery]
  );

  const counts = useMemo(() => {
    const c: Record<AlertSeverity, number> = { high: 0, medium: 0, low: 0 };
    for (const r of set) {
      if (!regionMatches(r, activeFilter, searchIds)) continue;
      const sev = alertSeverityFor(r.severity, r.activeAlert);
      if (sev) c[sev]++;
    }
    return c;
  }, [set, activeFilter, searchIds]);

  const totalAlerts = counts.high + counts.medium + counts.low;

  return (
    <button
      onClick={onToggleStream}
      aria-pressed={streamOpen}
      aria-label={`${totalAlerts} active alerts — ${streamOpen ? "hide" : "show"} live hazard feed`}
      className={`glass focusable flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.08] ${
        streamOpen ? "ring-1 ring-flood-blue/60" : ""
      }`}
      title="Toggle the live hazard feed"
    >
      {ALERT_SEVERITY_ORDER.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px] border border-black/40"
            style={{ backgroundColor: ALERT_SEVERITY[k].color }}
            aria-hidden="true"
          />
          <span
            className="font-mono text-xs font-bold"
            style={{ color: counts[k] ? ALERT_SEVERITY[k].color : undefined }}
          >
            {counts[k]}
          </span>
        </span>
      ))}
      <span className="ml-0.5 hidden font-display text-[10px] uppercase tracking-widest text-ink-dim sm:inline">
        Alerts
      </span>
    </button>
  );
}
