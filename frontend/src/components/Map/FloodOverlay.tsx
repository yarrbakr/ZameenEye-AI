import { memo } from "react";
import type { GeoPath } from "d3-geo";

interface Props {
  flood: GeoJSON.FeatureCollection;
  pathGen: GeoPath;
}

// Flood perimeters — stand-in for UNOSAT flood extent. Low-opacity blue fill with a
// dashed full-opacity stroke so it reads as an overlay, not a base region fill.
function FloodOverlayBase({ flood, pathGen }: Props) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      {flood.features.map((f, i) => {
        const d = pathGen(f as GeoJSON.Feature);
        if (!d) return null;
        return (
          <path
            key={(f.properties?.name as string) ?? i}
            d={d}
            fill="#3a7ce0"
            fillOpacity={0.25}
            stroke="#3a7ce0"
            strokeOpacity={0.95}
            strokeWidth={1.4}
            strokeDasharray="5 4"
          />
        );
      })}
    </g>
  );
}

export const FloodOverlay = memo(FloodOverlayBase);
