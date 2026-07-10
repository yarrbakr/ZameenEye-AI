import { memo } from "react";
import { motion } from "framer-motion";
import type { RiskRegion } from "../../types/risk";
import { RISK_LABEL, bandFor } from "../../types/risk";

interface Props {
  d: string;
  region: RiskRegion | null;
  fill: string;
  matched: boolean;
  selectionActive: boolean; // a filter or search is narrowing the map
  selected: boolean;
  hovered: boolean;
  focused: boolean; // the piece the view is zoomed to fit
  broken: boolean; // a sibling of the focused piece — breaks away like a lego brick
  breakVector: [number, number]; // outward fling direction for the break-away
  delay: number; // stagger delay in seconds
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null, evt?: React.MouseEvent) => void;
}

function RegionPathBase({
  d,
  region,
  fill,
  matched,
  selectionActive,
  selected,
  hovered,
  focused,
  broken,
  breakVector,
  delay,
  reducedMotion,
  onSelect,
  onHover,
}: Props) {
  const dimmed = selectionActive && !matched;

  // Resting state: opacity/scale/translate/rotate targets.
  let targetOpacity = 1;
  let targetScale = 1;
  let tx = 0;
  let ty = 0;
  let rot = 0;

  if (broken) {
    // Lego break-away: fling outward, shrink, tumble, fade.
    targetOpacity = 0;
    targetScale = 0.35;
    if (!reducedMotion) {
      tx = breakVector[0];
      ty = breakVector[1];
      rot = breakVector[0] > 0 ? 22 : -22;
    }
  } else if (dimmed) {
    targetOpacity = 0.07;
  } else if (!reducedMotion && !focused) {
    // lego-pop eject on filter/search match; steady lift when selected/hovered.
    if (selectionActive && matched) targetScale = 1.06;
    else if (selected) targetScale = 1.04;
    if (hovered) targetScale = Math.max(targetScale, 1.05);
  }

  const label = region
    ? `${region.regionName}. ${RISK_LABEL[region.riskType]} risk, severity ${region.severity} of 100, ${bandFor(region.severity, region.activeAlert).label}${region.activeAlert ? ", active alert" : ""}.`
    : "Region, no risk data";

  return (
    <motion.path
      className="region-path"
      d={d}
      fill={fill}
      stroke={
        selected || focused
          ? "#e8e8ee"
          : hovered
            ? "rgba(232,232,238,0.85)"
            : "rgba(7,9,16,0.65)"
      }
      strokeWidth={selected || focused ? 1.3 : hovered ? 1.1 : 0.5}
      // Keep borders a constant screen width instead of scaling up with the
      // zoom-to-fit transform (a tight district fit otherwise renders a huge bezel).
      vectorEffect="non-scaling-stroke"
      role="button"
      tabIndex={broken ? -1 : 0}
      aria-hidden={broken}
      aria-label={label}
      aria-pressed={selected}
      style={{ pointerEvents: broken ? "none" : "auto" }}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={{
        opacity: targetOpacity,
        scale: targetScale,
        x: tx,
        y: ty,
        rotate: rot,
      }}
      transition={
        reducedMotion
          ? { duration: 0.15 }
          : {
              opacity: { delay: broken ? 0 : delay, duration: broken ? 0.4 : 0.3 },
              scale: { type: "spring", stiffness: broken ? 200 : 300, damping: broken ? 16 : 20 },
              x: { type: "spring", stiffness: 180, damping: 16 },
              y: { type: "spring", stiffness: 180, damping: 16 },
              rotate: { type: "spring", stiffness: 180, damping: 16 },
            }
      }
      onClick={(e) => {
        e.stopPropagation();
        if (region && !broken) onSelect(region.id);
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && region && !broken) {
          e.preventDefault();
          onSelect(region.id);
        }
      }}
      onMouseEnter={(e) => region && !broken && onHover(region.id, e)}
      onMouseMove={(e) => region && !broken && onHover(region.id, e)}
      onMouseLeave={() => onHover(null)}
    />
  );
}

// Keyed by region id upstream; re-renders only when its own inputs change.
export const RegionPath = memo(RegionPathBase);
