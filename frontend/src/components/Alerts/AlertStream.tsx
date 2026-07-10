import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../../store/useStore";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import {
  useAlertStream,
  timeAgo,
  type StreamedAlert,
} from "../../hooks/useAlertStream";
import {
  ALERT_SEVERITY,
  ALERT_SEVERITY_ORDER,
  RISK_ICON,
  RISK_LABEL,
  type AlertSeverity,
} from "../../types/risk";

// Triage view modes — the alert-fatigue control. "priority" is the default: Low
// hazards are muted so the farmer sees only what needs a decision. This is the
// concrete UX expression of the backend's High/Medium/Low classification.
type Mode = "critical" | "priority" | "all";

const MODES: { key: Mode; label: string; shows: AlertSeverity[] }[] = [
  { key: "critical", label: "Critical", shows: ["high"] },
  { key: "priority", label: "Priority", shows: ["high", "medium"] },
  { key: "all", label: "All", shows: ["high", "medium", "low"] },
];

// Small rectangular inset "LED" — steady, no glow (per the console design language).
function SeverityLed({ severity }: { severity: AlertSeverity }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-[2px] border border-black/40"
      style={{ backgroundColor: ALERT_SEVERITY[severity].color }}
      aria-hidden="true"
    />
  );
}

function TriageCounts({
  counts,
}: {
  counts: Record<AlertSeverity, number>;
}) {
  return (
    <div className="flex items-center gap-3">
      {ALERT_SEVERITY_ORDER.map((k) => (
        <div key={k} className="flex items-center gap-1.5">
          <SeverityLed severity={k} />
          <span
            className="font-mono text-xs font-bold"
            style={{ color: ALERT_SEVERITY[k].color }}
          >
            {counts[k]}
          </span>
          <span className="font-display text-[10px] uppercase tracking-wide text-ink-dim">
            {ALERT_SEVERITY[k].label}
          </span>
        </div>
      ))}
    </div>
  );
}

function AlertRow({
  row,
  now,
  onSelect,
  reducedMotion,
}: {
  row: StreamedAlert;
  now: number;
  onSelect: (row: StreamedAlert) => void;
  reducedMotion: boolean;
}) {
  const { region, severity } = row;
  const spec = ALERT_SEVERITY[severity];
  const isDistrict = region.adminLevel === 2;

  return (
    <motion.button
      layout={!reducedMotion}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 14 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onClick={() => onSelect(row)}
      className="focusable flex w-full items-center gap-2.5 border-l-2 bg-white/[0.03] px-2.5 py-2 text-left hover:bg-white/[0.06]"
      style={{ borderColor: spec.color }}
    >
      <SeverityLed severity={severity} />
      <span
        className="w-11 shrink-0 font-mono text-[10px] font-bold tracking-wider"
        style={{ color: spec.color }}
      >
        {spec.short}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true">{RISK_ICON[region.riskType]}</span>
          <span className="truncate font-display text-xs font-semibold text-ink">
            {region.regionName}
          </span>
        </div>
        <div className="truncate font-mono text-[10px] text-ink-dim">
          {RISK_LABEL[region.riskType]}
          {isDistrict && region.parentName ? ` · ${region.parentName}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className="font-mono text-sm font-bold leading-none"
          style={{ color: spec.color }}
        >
          {region.severity}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-ink-dim">
          {timeAgo(row.ts, now)}
        </div>
      </div>
    </motion.button>
  );
}

export function AlertStream({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("priority");
  const reducedMotion = useReducedMotion();
  const focusRegion = useStore((s) => s.focusRegion);
  const focusDistrict = useStore((s) => s.focusDistrict);

  const { rows, now, counts, total } = useAlertStream(open);

  const shows = MODES.find((m) => m.key === mode)!.shows;
  const visibleRows = useMemo(
    () => rows.filter((r) => shows.includes(r.severity)),
    [rows, shows]
  );
  // How many streamed hazards this mode is deliberately muting — the number the
  // farmer is being spared from having to read.
  const mutedCount = rows.length - visibleRows.length;

  const select = (row: StreamedAlert) => {
    if (row.region.adminLevel === 2) focusDistrict(row.region.id);
    else focusRegion(row.region.id);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="glass flex max-h-[min(70vh,32rem)] w-[19rem] flex-col overflow-hidden rounded-xl"
          aria-label="Live hazard feed"
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-panel-border px-3 py-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              {!reducedMotion && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-band-critical opacity-60" />
              )}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-[2px] bg-band-critical" />
            </span>
            <div className="leading-tight">
              <div className="font-display text-xs font-bold uppercase tracking-widest text-ink">
                Live Hazard Feed
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-dim">
                {total} classified · real-time
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close hazard feed"
              className="focusable ml-auto rounded p-1 text-ink-dim hover:text-ink"
            >
              ✕
            </button>
          </div>

          {/* Triage summary + alert-fatigue mode control */}
          <div className="space-y-2 border-b border-panel-border px-3 py-2.5">
            <TriageCounts counts={counts} />
            <div
              role="group"
              aria-label="Alert triage filter"
              className="flex overflow-hidden rounded-md border border-panel-border"
            >
              {MODES.map((m) => {
                const active = m.key === mode;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    aria-pressed={active}
                    className={`focusable flex-1 px-2 py-1 font-display text-[11px] font-semibold tracking-wide transition-colors ${
                      active
                        ? "bg-flood-blue/25 text-ink"
                        : "text-ink-dim hover:text-ink"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-[10px] leading-snug text-ink-dim">
              {mode === "all"
                ? "Showing every classified hazard."
                : "Low-priority noise is muted so farmers act on what matters."}
            </p>
          </div>

          {/* Live feed */}
          <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">
            {total === 0 ? (
              <div className="px-3 py-8 text-center font-mono text-xs text-ink-dim">
                No active hazards in this country.
              </div>
            ) : (
              <div className="flex flex-col gap-1 p-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {visibleRows.map((row) => (
                    <AlertRow
                      key={row.key}
                      row={row}
                      now={now}
                      onSelect={select}
                      reducedMotion={reducedMotion}
                    />
                  ))}
                </AnimatePresence>
                {mutedCount > 0 && (
                  <div className="px-2.5 py-1.5 font-mono text-[10px] text-ink-dim">
                    {mutedCount} lower-priority{" "}
                    {mutedCount === 1 ? "hazard" : "hazards"} muted
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
