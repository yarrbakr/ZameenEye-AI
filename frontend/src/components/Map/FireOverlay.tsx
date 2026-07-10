import { memo } from "react";
import { scaleSqrt } from "d3-scale";
import type { GeoProjection } from "d3-geo";
import type { FireHotspot } from "../../types/risk";

interface Props {
  hotspots: FireHotspot[];
  projection: GeoProjection;
  reducedMotion: boolean;
}

// Fire hotspots — stand-in for NASA FIRMS thermal anomalies. Radius scales with
// mock intensity; a soft pulsing glow (CSS, disabled under reduced-motion).
function FireOverlayBase({ hotspots, projection, reducedMotion }: Props) {
  const r = scaleSqrt().domain([0, 100]).range([3, 16]);

  return (
    <g aria-hidden="true" pointerEvents="none">
      {hotspots.map((h) => {
        const p = projection([h.lng, h.lat]);
        if (!p) return null;
        const radius = r(h.intensity);
        return (
          <g key={h.id} transform={`translate(${p[0]},${p[1]})`}>
            {/* Glow halo */}
            <circle
              className={reducedMotion ? "" : "animate-fire-pulse"}
              r={radius * 1.9}
              fill="#e0483a"
              opacity={0.25}
              style={{ transformOrigin: "center" }}
            />
            {/* Core marker */}
            <circle r={radius} fill="#e0483a" opacity={0.9} />
            <circle r={radius * 0.4} fill="#ffd9a0" opacity={0.9} />
          </g>
        );
      })}
    </g>
  );
}

export const FireOverlay = memo(FireOverlayBase);
