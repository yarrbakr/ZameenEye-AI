import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store/useStore";
import { useCountryData } from "../hooks/useCountryData";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useSearchIndex, searchIdSet } from "../hooks/useSearchIndex";
import { summarizeRegions } from "../lib/selectors";
import {
  ALERT_SEVERITY,
  alertSeverityFor,
  bandFor,
  colorFor,
  LANGUAGE_LABEL,
  RISK_ICON,
  RISK_LABEL,
  SEVERITY_BANDS,
  type RiskRegion,
} from "../types/risk";

const COUNTRY_LABEL: Record<string, string> = {
  pakistan: "Pakistan",
  india: "India",
  kenya: "Kenya",
};

// ---- Segmented severity bar (green→red) with a marker at the current value ----
function SeverityBar({ severity, activeAlert }: { severity: number; activeAlert: boolean }) {
  const markerPct = activeAlert ? 100 : severity;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {SEVERITY_BANDS.map((b) => (
          <div
            key={b.band}
            className="h-full"
            style={{
              backgroundColor: b.color,
              width: `${((b.max - b.min + 1) / 100) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="relative h-3">
        <div
          className="absolute top-0 -ml-1.5 h-3 w-0.5 bg-ink"
          style={{ left: `${markerPct}%` }}
          aria-hidden="true"
        >
          <div className="mx-auto -mt-1 h-2 w-2 rotate-45 border border-base bg-ink" />
        </div>
      </div>
    </div>
  );
}

// ---- Mock audio player (stand-in for the TTS output the compute team produces) ----
function MockAudioPlayer({ regionId }: { regionId: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);

  // Reset when the region changes.
  useEffect(() => {
    setPlaying(false);
    setProgress(0);
  }, [regionId]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => {
        const next = p + dt / 6; // ~6s of "audio"
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  return (
    <div className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2">
      <button
        onClick={() => {
          if (progress >= 1) setProgress(0);
          setPlaying((p) => !p);
        }}
        aria-label={playing ? "Pause advisory" : "Play advisory"}
        className="focusable flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-flood-blue text-white"
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-flood-blue transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-ink-dim">
        {Math.round(progress * 6)}s
      </span>
    </div>
  );
}

// ---- Country-wide summary (panel resting state at the country level) ----
function SummaryView() {
  const { code } = useCountryData();
  const activeFilter = useStore((s) => s.activeFilter);
  const searchQuery = useStore((s) => s.searchQuery);
  const { regions, fuse } = useSearchIndex();

  const searchIds = useMemo(
    () => searchIdSet(fuse, searchQuery),
    [fuse, searchQuery]
  );

  const s = useMemo(
    () => summarizeRegions(regions, activeFilter, searchIds),
    [regions, activeFilter, searchIds]
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="font-display text-[10px] font-semibold uppercase tracking-widest text-ink-dim">
          Country Overview
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight">
          {COUNTRY_LABEL[code]}
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          Select a region to zoom in — sibling regions break away and the region's
          districts appear.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/5 p-3">
          <div className="font-mono text-2xl text-ink">{s.total}</div>
          <div className="text-xs text-ink-dim">Total regions</div>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <div className="font-mono text-2xl text-band-critical">
            {s.byBand.critical}
          </div>
          <div className="text-xs text-ink-dim">Active alerts &amp; critical</div>
        </div>
      </div>

      <div>
        <div className="mb-2 font-display text-[10px] font-semibold uppercase tracking-widest text-ink-dim">
          Regions by severity band
        </div>
        <ul className="space-y-2">
          {SEVERITY_BANDS.map((b) => {
            const count = s.byBand[b.band];
            const pct = s.total ? (count / s.total) * 100 : 0;
            return (
              <li key={b.band} className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: b.color }}
                />
                <span className="w-16 shrink-0 font-display text-xs text-ink">
                  {b.label}
                </span>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: b.color }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right font-mono text-xs text-ink-dim">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ---- Selected-region detail ----
function RegionView({ region }: { region: RiskRegion }) {
  const focusRegion = useStore((s) => s.focusRegion);
  const focusDistrict = useStore((s) => s.focusDistrict);
  const { byId } = useSearchIndex();
  const band = bandFor(region.severity, region.activeAlert);
  const alertSev = alertSeverityFor(region.severity, region.activeAlert);

  const goTo = (r: RiskRegion) =>
    r.adminLevel === 2 ? focusDistrict(r.id) : focusRegion(r.id);

  const related = region.relatedRegionIds
    .map((id) => byId[id])
    .filter(Boolean) as RiskRegion[];

  const dateLabel = new Date(region.lastUpdated).toISOString().slice(0, 10);
  const isDistrict = region.adminLevel === 2;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              backgroundColor: `${colorFor(region.severity, region.activeAlert)}22`,
              color: colorFor(region.severity, region.activeAlert),
            }}
          >
            <span aria-hidden="true">{RISK_ICON[region.riskType]}</span>
            {RISK_LABEL[region.riskType]}
          </span>
          {alertSev && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${ALERT_SEVERITY[alertSev].color}22`,
                color: ALERT_SEVERITY[alertSev].color,
              }}
            >
              <span
                className="h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: ALERT_SEVERITY[alertSev].color }}
                aria-hidden="true"
              />
              {ALERT_SEVERITY[alertSev].label} priority
            </span>
          )}
          {region.activeAlert && (
            <span className="animate-flash-in rounded-full bg-band-critical px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
              Active Alert
            </span>
          )}
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
          {region.regionName}
        </h2>
        <div className="font-mono text-xs text-ink-dim">
          {isDistrict && region.parentName ? (
            <span>
              {region.parentName}{" "}
              <span className="text-ink-dim/60">/ district</span> ·{" "}
              {COUNTRY_LABEL[region.country]}
            </span>
          ) : (
            COUNTRY_LABEL[region.country]
          )}
        </div>
      </div>

      <div className="rounded-lg bg-white/5 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-display text-[10px] font-semibold uppercase tracking-widest text-ink-dim">
              Severity index
            </div>
            <div
              className="font-mono text-4xl font-bold leading-none"
              style={{ color: band.color }}
            >
              {region.severity}
              <span className="text-lg text-ink-dim">/100</span>
            </div>
          </div>
          <div
            className="rounded px-2 py-1 font-display text-xs font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${band.color}22`, color: band.color }}
          >
            {band.label}
          </div>
        </div>
        <div className="mt-3">
          <SeverityBar
            severity={region.severity}
            activeAlert={region.activeAlert}
          />
        </div>
        {/* The index is a modeled stand-in until the compute team supplies a real
            method (region.scoreMethod). Labeled so it's never read as measured. */}
        <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-dim">
          <span aria-hidden="true">ⓘ</span>
          {region.scoreMethod ?? "Modeled · illustrative (no measured method yet)"}
        </div>
        {alertSev && (
          <div
            className="mt-3 border-l-2 pl-2.5 text-xs leading-snug text-ink"
            style={{ borderColor: ALERT_SEVERITY[alertSev].color }}
          >
            {ALERT_SEVERITY[alertSev].action}
          </div>
        )}
      </div>

      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink-dim">
          Updated {dateLabel}
        </div>
        <p className="text-sm leading-relaxed text-ink">{region.summary}</p>
      </div>

      <div>
        <div className="mb-1.5 font-display text-[10px] font-semibold uppercase tracking-widest text-ink-dim">
          Advisory ({LANGUAGE_LABEL[region.advisoryLanguage]})
        </div>
        <div
          className="rounded-lg border-l-2 border-flood-blue bg-white/5 p-3 text-sm leading-relaxed text-ink"
          lang={region.advisoryLanguage}
          dir={region.advisoryLanguage === "ur" ? "rtl" : "ltr"}
        >
          {region.advisoryScript}
        </div>
        <div className="mt-2">
          <MockAudioPlayer regionId={region.id} />
        </div>
      </div>

      {related.length > 0 && (
        <div>
          <div className="mb-2 font-display text-[10px] font-semibold uppercase tracking-widest text-ink-dim">
            Related regions · {RISK_LABEL[region.riskType]}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {related.map((r) => (
              <button
                key={r.id}
                onClick={() => goTo(r)}
                className="focusable flex items-center gap-1.5 rounded-full border border-panel-border bg-white/[0.03] px-2.5 py-1 text-xs text-ink-dim hover:text-ink"
              >
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{
                    backgroundColor: colorFor(r.severity, r.activeAlert),
                  }}
                />
                {r.regionName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function InfoPanel() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const focusUp = useStore((s) => s.focusUp);
  const { byId } = useSearchIndex();

  const region = selectedRegionId ? (byId[selectedRegionId] ?? null) : null;

  const content = region ? <RegionView region={region} /> : <SummaryView />;

  if (isMobile) {
    return (
      <motion.div
        drag={region ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          // Dragging the sheet down goes back up one drill level.
          if (info.offset.y > 120) focusUp();
        }}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="glass panel-scroll max-h-[45vh] overflow-y-auto rounded-t-2xl p-4"
      >
        {region && (
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedRegionId ?? "summary"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.aside
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="glass panel-scroll h-full w-[340px] shrink-0 overflow-y-auto rounded-2xl p-5"
      aria-label="Region information"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedRegionId ?? "summary"}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </motion.aside>
  );
}
