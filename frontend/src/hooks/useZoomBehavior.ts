import { useCallback, useEffect, useRef } from "react";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import "d3-transition"; // registers selection.transition()

// Encapsulates the d3-zoom wiring: scaleExtent [1,8], pan/zoom applied to the <g>
// wrapper, double-click-to-zoom disabled (conflicts with mobile double-tap), and
// pinch-zoom enabled by default. Exposes imperative helpers for fly-to / re-fit.
export function useZoomBehavior(
  svgRef: React.RefObject<SVGSVGElement | null>,
  gRef: React.RefObject<SVGGElement | null>,
  reducedMotion: boolean,
  onScale?: (k: number) => void,
  // The <svg>/<g> only mount after the container is measured, so attachment must
  // wait until they exist — pass true once they're rendered.
  ready = true
) {
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Keep the latest callback without re-binding the zoom behavior.
  const onScaleRef = useRef(onScale);
  onScaleRef.current = onScale;

  useEffect(() => {
    if (!ready) return;
    const svgEl = svgRef.current;
    const gEl = gRef.current;
    if (!svgEl || !gEl) return;

    const svg = select(svgEl);
    const g = select(gEl);

    const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 200]) // wide range for programmatic fit-to-district
      .filter(() => false) // navigation is selection-driven; no user pan/zoom gestures
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
        onScaleRef.current?.(event.transform.k);
      });

    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    return () => {
      svg.on(".zoom", null);
      zoomRef.current = null;
    };
  }, [svgRef, gRef, ready]);

  // Apply an arbitrary transform (used for fit-to-bounds and fly-to-region).
  const applyTransform = useCallback(
    (transform: typeof zoomIdentity, animate = true) => {
      const svgEl = svgRef.current;
      const zoomBehavior = zoomRef.current;
      if (!svgEl || !zoomBehavior) return;
      const svg = select(svgEl);
      if (animate && !reducedMotion) {
        svg
          .transition()
          .duration(650)
          .call(zoomBehavior.transform, transform);
      } else {
        svg.call(zoomBehavior.transform, transform);
      }
    },
    [svgRef, reducedMotion]
  );

  const resetZoom = useCallback(
    (animate = true) => applyTransform(zoomIdentity, animate),
    [applyTransform]
  );

  return { zoomRef, applyTransform, resetZoom };
}
