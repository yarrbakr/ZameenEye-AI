import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { geoMercator, geoPath } from "d3-geo";
import { zoomIdentity } from "d3-zoom";
import { useCountryData } from "../../hooks/useCountryData";
import { useZoomBehavior } from "../../hooks/useZoomBehavior";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useSearchIndex, searchIdSet } from "../../hooks/useSearchIndex";
import { useStore } from "../../store/useStore";
import { colorFor, RISK_LABEL, bandFor } from "../../types/risk";
import { regionMatches } from "../../lib/selectors";
import { RegionPath } from "./RegionPath";
import { FireOverlay } from "./FireOverlay";
import { FloodOverlay } from "./FloodOverlay";

const NEUTRAL_FILL = "#1a2032";
const BREAK_MAG = 55; // outward fling distance for break-away pieces (projected units)

interface HoverState {
  id: string;
  x: number;
  y: number;
}

interface Shape {
  id: string;
  d: string;
  cx: number;
  cy: number;
  delay: number;
}

export function MapCanvas() {
  const { data, loading, error, retry, code } = useCountryData();
  const reducedMotion = useReducedMotion();
  const { fuse, byId } = useSearchIndex();

  const districts = useStore((s) => s.districtCache[s.selectedCountry]);
  const focus = useStore((s) => s.focus);
  const fit = useStore((s) => s.fit);
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const activeFilter = useStore((s) => s.activeFilter);
  const searchQuery = useStore((s) => s.searchQuery);
  const layers = useStore((s) => s.layers);
  const crossfadeNonce = useStore((s) => s.crossfadeNonce);
  const focusRegion = useStore((s) => s.focusRegion);
  const focusDistrict = useStore((s) => s.focusDistrict);
  const focusUp = useStore((s) => s.focusUp);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<HoverState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const firstFit = useRef(true);

  const mapReady = !!(data && size.width > 0 && size.height > 0);
  const { applyTransform } = useZoomBehavior(
    svgRef,
    gRef,
    reducedMotion,
    undefined,
    mapReady
  );

  // ---- Measure container ----
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Projection + path generator ----
  const projection = useMemo(() => {
    if (!data || size.width === 0 || size.height === 0) return null;
    return geoMercator().fitSize([size.width, size.height], data.geo);
  }, [data, size.width, size.height]);

  const pathGen = useMemo(
    () => (projection ? geoPath(projection) : null),
    [projection]
  );

  // ---- ADM1 shapes + center-out stagger ----
  const shapes = useMemo<Shape[]>(() => {
    if (!data || !pathGen) return [];
    const items = data.geo.features.map((f) => {
      const id = (f.properties?.id as string) ?? "";
      const c = pathGen.centroid(f as GeoJSON.Feature);
      return { id, d: pathGen(f as GeoJSON.Feature) ?? "", cx: c[0], cy: c[1] };
    });
    const mx = items.reduce((s, i) => s + i.cx, 0) / (items.length || 1);
    const my = items.reduce((s, i) => s + i.cy, 0) / (items.length || 1);
    const ranked = [...items].sort(
      (a, b) => Math.hypot(a.cx - mx, a.cy - my) - Math.hypot(b.cx - mx, b.cy - my)
    );
    const delay = new Map<string, number>();
    ranked.forEach((it, i) => delay.set(it.id, Math.min(i * 0.02, 0.5)));
    return items.map((it) => ({ ...it, delay: delay.get(it.id) ?? 0 }));
  }, [data, pathGen]);

  // ---- District shapes (all), keyed for filtering by parent ----
  const districtShapes = useMemo(() => {
    if (!districts?.geo || !pathGen) return [];
    return districts.geo.features.map((f, i) => {
      const id = (f.properties?.id as string) ?? "";
      const c = pathGen.centroid(f as GeoJSON.Feature);
      return {
        id,
        d: pathGen(f as GeoJSON.Feature) ?? "",
        cx: c[0],
        cy: c[1],
        delay: Math.min(i * 0.006, 0.4),
      };
    });
  }, [districts, pathGen]);

  // Feature lookups for fit-to-bounds.
  const regionFeatureById = useMemo(() => {
    const m: Record<string, GeoJSON.Feature> = {};
    data?.geo.features.forEach((f) => (m[f.properties?.id as string] = f as GeoJSON.Feature));
    return m;
  }, [data]);
  const districtFeatureById = useMemo(() => {
    const m: Record<string, GeoJSON.Feature> = {};
    districts?.geo.features.forEach((f) => (m[f.properties?.id as string] = f as GeoJSON.Feature));
    return m;
  }, [districts]);

  const searchIds = useMemo(
    () => searchIdSet(fuse, searchQuery),
    [fuse, searchQuery]
  );
  const selectionActive = searchIds !== null || activeFilter !== "all";

  const focusedRegionId = focus.level !== "country" ? focus.regionId : null;
  const focusedDistrictId = focus.level === "district" ? focus.districtId : null;

  const regionDistricts = useMemo(
    () =>
      focusedRegionId
        ? districtShapes.filter(
            (s) => districts?.regions[s.id]?.parentId === focusedRegionId
          )
        : [],
    [districtShapes, districts, focusedRegionId]
  );
  const showDistricts = focus.level !== "country" && regionDistricts.length > 0;

  // Centroid the break-away pieces fling away from.
  const focusCentroid = useMemo(() => {
    if (focus.level === "district") {
      const s = districtShapes.find((x) => x.id === focusedDistrictId);
      return s ? [s.cx, s.cy] : null;
    }
    if (focus.level === "region") {
      const s = shapes.find((x) => x.id === focusedRegionId);
      return s ? [s.cx, s.cy] : null;
    }
    return null;
  }, [focus, shapes, districtShapes, focusedRegionId, focusedDistrictId]);

  function breakVector(cx: number, cy: number): [number, number] {
    if (!focusCentroid) return [0, 0];
    const dx = cx - focusCentroid[0];
    const dy = cy - focusCentroid[1];
    const len = Math.hypot(dx, dy) || 1;
    return [(dx / len) * BREAK_MAG, (dy / len) * BREAK_MAG];
  }

  // ---- Fit-to-focus (the only thing that moves the map) ----
  useEffect(() => {
    if (!pathGen || !projection || size.width === 0) return;
    const animate = !firstFit.current && !reducedMotion;
    firstFit.current = false;

    const fitFeature = (feature: GeoJSON.Feature | undefined) => {
      if (!feature) return applyTransform(zoomIdentity, animate);
      const [[x0, y0], [x1, y1]] = pathGen.bounds(feature);
      const dx = x1 - x0;
      const dy = y1 - y0;
      if (dx <= 0 || dy <= 0) return applyTransform(zoomIdentity, animate);
      const k = Math.min(
        200,
        0.88 * Math.min(size.width / dx, size.height / dy)
      );
      const t = zoomIdentity
        .translate(size.width / 2 - k * (x0 + x1) / 2, size.height / 2 - k * (y0 + y1) / 2)
        .scale(k);
      applyTransform(t, animate);
    };

    if (fit.focus.level === "country") applyTransform(zoomIdentity, animate);
    else if (fit.focus.level === "region")
      fitFeature(regionFeatureById[fit.focus.regionId]);
    else fitFeature(districtFeatureById[fit.focus.districtId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit.nonce, crossfadeNonce, projection, size.width, size.height, districts]);

  function handleHover(id: string | null, evt?: React.MouseEvent) {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    if (id === null) {
      setHoveredId(null);
      setHover(null);
      return;
    }
    setHoveredId(id);
    const rect = containerRef.current?.getBoundingClientRect();
    const x = evt && rect ? evt.clientX - rect.left : 0;
    const y = evt && rect ? evt.clientY - rect.top : 0;
    hoverTimer.current = window.setTimeout(() => setHover({ id, x, y }), 150);
  }

  const hoverRegion = hover ? (byId[hover.id] ?? null) : null;
  const atCountry = focus.level === "country";

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {/* Faded per-country cultural backdrop. Lives behind the map SVG (not inside the
          zoom <g>), so it stays fixed while drilling to districts; crossfades on
          country change. A dark scrim keeps region fills and the critical band legible. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <AnimatePresence>
          <motion.div
            key={code}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(/backgrounds/${code}.jpg)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.2 : 0.6 }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-base/[0.68]" />
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/40 to-base/70" />
      </div>
      <div className="ambient-glow pointer-events-none absolute inset-0" />

      {error && !loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-base/80">
          <div className="glass max-w-sm rounded-lg p-6 text-center">
            <div className="mb-2 font-display text-lg font-semibold text-band-critical">
              Map data failed to load
            </div>
            <p className="mb-4 text-sm text-ink-dim">{error}</p>
            <button
              onClick={retry}
              className="focusable rounded-md border border-panel-border bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-base/60">
          <div className="glass w-64 space-y-3 rounded-lg p-5">
            <div className="shimmer-bar h-3 w-3/4 rounded bg-white/5" />
            <div className="shimmer-bar h-3 w-full rounded bg-white/5" />
            <div className="shimmer-bar h-3 w-5/6 rounded bg-white/5" />
            <div className="shimmer-bar h-24 w-full rounded bg-white/5" />
            <div className="text-center font-mono text-xs uppercase tracking-widest text-ink-dim">
              Loading {code}…
            </div>
          </div>
        </div>
      )}

      {projection && pathGen && data && (
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          className="absolute inset-0"
          role="group"
          aria-label={`Climate risk map of ${code}`}
        >
          <rect
            width={size.width}
            height={size.height}
            fill="transparent"
            onClick={() => !atCountry && focusUp()}
          />
          <g ref={gRef}>
            <AnimatePresence mode="wait">
              <motion.g
                key={code}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                {/* ---- ADM1 provinces ---- */}
                {shapes.map((s) => {
                  const region = data.regions[s.id] ?? null;
                  const isFocused = s.id === focusedRegionId;
                  if (isFocused && showDistricts) {
                    // At district level a single district fills the view — drop the
                    // province base entirely. At region level keep it as a faint base
                    // so any gaps between districts don't flash the background.
                    if (focus.level === "district") return null;
                    return (
                      <path
                        key={s.id}
                        d={s.d}
                        fill={
                          region
                            ? colorFor(region.severity, region.activeAlert)
                            : NEUTRAL_FILL
                        }
                        opacity={0.12}
                        pointerEvents="none"
                      />
                    );
                  }
                  const broken = !atCountry && !isFocused;
                  const fill = region
                    ? colorFor(region.severity, region.activeAlert)
                    : NEUTRAL_FILL;
                  const matched = region
                    ? regionMatches(region, activeFilter, searchIds)
                    : false;
                  return (
                    <RegionPath
                      key={s.id}
                      d={s.d}
                      region={region}
                      fill={fill}
                      matched={matched}
                      selectionActive={selectionActive}
                      selected={selectedRegionId === s.id}
                      hovered={hoveredId === s.id}
                      focused={isFocused && !showDistricts}
                      broken={broken}
                      breakVector={broken ? breakVector(s.cx, s.cy) : [0, 0]}
                      delay={s.delay}
                      reducedMotion={reducedMotion}
                      onSelect={focusRegion}
                      onHover={handleHover}
                    />
                  );
                })}

                {/* ---- ADM2 districts of the focused region ---- */}
                {showDistricts &&
                  regionDistricts.map((s) => {
                    const region = districts!.regions[s.id] ?? null;
                    const isFocused = s.id === focusedDistrictId;
                    const broken = focus.level === "district" && !isFocused;
                    const fill = region
                      ? colorFor(region.severity, region.activeAlert)
                      : NEUTRAL_FILL;
                    const matched = region
                      ? regionMatches(region, activeFilter, searchIds)
                      : false;
                    return (
                      <RegionPath
                        key={s.id}
                        d={s.d}
                        region={region}
                        fill={fill}
                        matched={matched}
                        selectionActive={selectionActive}
                        selected={selectedRegionId === s.id}
                        hovered={hoveredId === s.id}
                        focused={isFocused}
                        broken={broken}
                        breakVector={broken ? breakVector(s.cx, s.cy) : [0, 0]}
                        delay={s.delay}
                        reducedMotion={reducedMotion}
                        onSelect={focusDistrict}
                        onHover={handleHover}
                      />
                    );
                  })}

                {/* Overlays */}
                {layers.flood && (
                  <FloodOverlay flood={data.overlays.flood} pathGen={pathGen} />
                )}
                {layers.fire && (
                  <FireOverlay
                    hotspots={data.overlays.fire}
                    projection={projection}
                    reducedMotion={reducedMotion}
                  />
                )}
              </motion.g>
            </AnimatePresence>
          </g>
        </svg>
      )}

      {/* ---- Level hint ---- */}
      {data && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <div className="glass rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-dim">
            {focus.level === "country"
              ? "Select a region to zoom in"
              : focus.level === "region"
                ? showDistricts
                  ? "Districts · select one, or click away to go back"
                  : "Region · click away to go back"
                : "District · click away to go back"}
          </div>
        </div>
      )}

      {/* ---- Hover tooltip ---- */}
      {hoverRegion && (
        <div
          className="glass pointer-events-none absolute z-20 hidden max-w-[220px] rounded-md px-3 py-2 text-xs md:block"
          style={{
            left: Math.min(hover!.x + 14, size.width - 230),
            top: Math.max(hover!.y - 10, 8),
          }}
        >
          <div className="font-display text-sm font-semibold">
            {hoverRegion.regionName}
            {hoverRegion.adminLevel === 2 && (
              <span className="ml-1 text-ink-dim">· {hoverRegion.parentName}</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-3 text-ink-dim">
            <span>{RISK_LABEL[hoverRegion.riskType]}</span>
            <span className="font-mono text-ink">
              {hoverRegion.severity}
              <span className="text-ink-dim">/100</span>
            </span>
          </div>
          <div
            className="mt-1 font-mono text-[10px] uppercase tracking-wide"
            style={{
              color: bandFor(hoverRegion.severity, hoverRegion.activeAlert).color,
            }}
          >
            {bandFor(hoverRegion.severity, hoverRegion.activeAlert).label}
            {hoverRegion.activeAlert ? " · ALERT" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
