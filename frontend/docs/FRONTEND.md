# ZameenEye AI — Frontend Architecture Summary

A complete map of the ZameenEye frontend: every part that exists and how it fits
together. Companion to the top-level [README.md](../README.md) — the README is the
"what/why for users", this is the "how it's built" for developers.

---

## 1. What it is

A single-page, **offline-capable climate-risk map console** for farmers across
**Pakistan, India, and Kenya**. It visualizes **drought / flood / fire /
soil-degradation** risk per administrative region, lets you drill from country →
province → district, search regions, filter by hazard, read localized advisories
(Urdu/Hindi/Swahili), and triage hazards by **High/Medium/Low severity** via a **live
hazard feed**. A floating **assistant** answers questions and drives the map.

It's the **UI track**: all data is *mock-but-realistic*, bundled locally, and structured
so that going live is a **one-file change** per data source. No runtime fetches to
external services.

## 2. Tech stack

- **Build/runtime:** Vite 8 + React 19 + TypeScript (strict), Tailwind 3.
- **Animation:** Framer Motion. **Maps:** D3 (`d3-geo`, `d3-zoom`, `d3-selection`,
  `d3-scale`, `d3-transition`).
- **State:** Zustand. **Search:** Fuse.js. **Lint:** oxlint.
- Fonts: Space Grotesk (display) + Space Mono (numeric readouts), loaded from Google
  Fonts in `src/styles/globals.css`.
- Entry: `index.html` → `src/main.tsx` (React StrictMode) → `src/App.tsx`.

## 3. The core mental model (5 big ideas)

1. **Selection-driven navigation, no free pan/zoom.** The map is always *fitted* to the
   current focus. You don't drag/scroll — you **click a region to drill in**, click empty
   space or the breadcrumb to go back. All movement flows through a `Focus` value in the
   store.
2. **Color is a pure function of `(severity, activeAlert)`.** Defined once in
   `src/types/risk.ts` and shared by the map fill, legend, tooltip, info panel, and alert
   feed — change the palette in one place, it propagates everywhere.
3. **One swap point per data source.** `src/data/loadCountry.ts` (geometry/risk/overlays)
   and `src/assistant/index.ts` (the assistant "brain") are the only files a teammate
   edits to go live. Components never touch data directly — they go through hooks.
4. **Two admin levels, lazy-loaded.** ADM1 (provinces) load with the country; ADM2
   (districts — Pakistan 126, Kenya 290, India 735) preload as a separate chunk right
   after, so drilling and search feel instant.
5. **Everything degrades under `prefers-reduced-motion`** and is accessible (native
   buttons, aria labels, severity never conveyed by color alone).

## 4. Data layer

**Domain types — `src/types/risk.ts`** (the vocabulary of the whole app):

- `RiskRegion` — the central record: `id, regionName, country, riskType, severity
  (0–100), activeAlert, lastUpdated, summary, advisoryScript, advisoryLanguage,
  relatedRegionIds`, plus ADM2 fields (`adminLevel, parentId, parentName`) and optional
  `scoreMethod`.
- `severity` is a **modeled/illustrative** index (labeled as such in the UI until the
  compute team supplies a real method via `scoreMethod`).
- `CountryData` = `{ code, geo (GeoJSON), regions (keyed by id), overlays }`.
  `CountryOverlays` = `{ fire: FireHotspot[], flood: FeatureCollection }`.
- **Severity bands** (`SEVERITY_BANDS`): Normal 0–24 (green), Watch 25–49 (amber),
  Warning 50–74 (orange), Critical 75–100 (red). `bandFor()` / `colorFor()` —
  `activeAlert` forces Critical regardless of the number.
- **Alert triage:** `AlertSeverity = high | medium | low`, `ALERT_SEVERITY` spec
  (label/short/color/action guidance), and `alertSeverityFor()` mapping band → priority
  (Critical→High, Warning→Medium, Watch→Low, Normal→not an alert).
- Also: `RISK_TYPES/RISK_LABEL/RISK_ICON`, `LANGUAGE_LABEL`.

**Data files — `src/data/`:**

- `countries/*.geo.json` — simplified ADM1 boundaries (geoBoundaries, mapshaper-
  simplified, rewound clockwise for d3-geo).
- `districts/*.adm2.json` — simplified ADM2 boundaries (lazy chunk).
- `mock/*-risk.json` / `*-risk-adm2.json` — generated risk records (e.g. 7 provinces for
  Pakistan; every region colored).
- `mock/*-overlays.json` — fire hotspots (stand-in for NASA FIRMS) + flood perimeters
  (stand-in for UNOSAT).
- Regeneration scripts in `scripts/`: `gen:risk`, `fix:winding`, `build:districts`.

**The swap point — `src/data/loadCountry.ts`:** resolves each country's parts via
per-country dynamic `import()` (so Vite emits a chunk each). `loadCountryData()` (ADM1)
and `loadDistrictData()` (ADM2). Going live = replace the `import()` bodies with
`fetch()`; nothing else changes.

## 5. State — `src/store/useStore.ts` (Zustand)

Holds: `selectedCountry`, per-country `cache` + `districtCache` (so switching back is
instant), `loadingCountry`/`loadError`, `focus` (the drill position), `selectedRegionId`
(what the InfoPanel describes), `activeFilter`, `searchQuery`, `layers` (fire/flood
toggles), and animation signals (`fit`, `crossfadeNonce`).

Key behaviors:

- `Focus` is a discriminated union: `{level:"country"}` |
  `{level:"region", regionId}` | `{level:"district", districtId, regionId}`.
- **`fit: {focus, nonce}`** — bumping the nonce is how the store tells the map "re-run
  your fit-to-focus animation" without holding a D3 handle. Same trick for
  `crossfadeNonce` (country change) and `refit()` (resize).
- Actions: `setCountry` (resets region/search/filter but **keeps layer toggles**),
  `focusRegion/focusDistrict/focusUp/focusCountry`, `setFilter/setSearch/toggleLayer`,
  `retryLoad`, `reset`.
- `FilterKey = "all" | RiskType | "active-alerts"`.

## 6. The map — `src/components/Map/`

**`MapCanvas.tsx`** is the hero and the most complex file. Pipeline:

1. **Measure** the container with a `ResizeObserver`.
2. **Project:** `geoMercator().fitSize([w,h], geo)` (memoized per country/size) →
   `geoPath` generator.
3. **Compute shapes:** one `<path>` per ADM1 feature, with a **center-out stagger delay**
   (regions nearest the country centroid animate first). District shapes computed
   similarly when loaded.
4. **Render** (React owns the DOM; D3 only does projection math): province paths, then the
   focused region's district paths, then flood/fire overlays — all inside a zoom `<g>`.
5. **Fit-to-focus effect:** when `fit.nonce` changes, compute `pathGen.bounds()` of the
   focused feature and animate the zoom transform via `applyTransform`.

Notable details: a **faded per-country agriculture backdrop** (`/backgrounds/{code}.jpg`)
crossfades on country change and sits *behind* the zoom `<g>` so it stays fixed while
drilling; an ambient glow; **loading skeleton** (shimmer) and **error+Retry** overlays; a
**hover tooltip** (150ms debounce) showing name/risk/severity/band; a top **level hint**
("Select a region to zoom in", etc.); clicking the background `<rect>` calls `focusUp()`.

**`RegionPath.tsx`** — a `React.memo`'d `motion.path` (keyed by region id, so
filter/search changes don't re-render the whole map). It encodes the visual states:

- **broken** — a sibling of the focused piece: *"lego break-away"* (flings outward along
  `breakVector`, shrinks to 0.35, tumbles ±22°, fades). This is the signature drill
  animation.
- **dimmed** — filter/search active and this region doesn't match (opacity 0.07).
- **lego-pop** — matched-by-filter/search regions scale to 1.06; selected 1.04; hover
  1.05.
- Full `aria-label` (name, risk, severity, band, alert), keyboard operable,
  `vectorEffect="non-scaling-stroke"` so borders stay constant width under deep zoom.

**Overlays:** `FireOverlay.tsx` (radius via `scaleSqrt(intensity)`, pulsing glow disabled
under reduced motion) and `FloodOverlay.tsx` (low-opacity blue fill + dashed stroke so it
reads as an overlay, not a base fill). Both `memo`'d, `pointerEvents="none"`,
`aria-hidden`.

**`src/hooks/useZoomBehavior.ts`** — wires d3-zoom to the `<g>` but **disables all user
gestures** (`.filter(() => false)`); it exists purely to apply programmatic fit-to-bounds
transforms (650ms transitions, instant under reduced motion). `scaleExtent [1,200]`
allows tight district fits.

## 7. Hooks — `src/hooks/`

- **useCountryData** — reads current country from cache, triggers load; the only data
  hook components use.
- **useSearchIndex** — builds the combined ADM1+ADM2 list, the Fuse index, and a `byId`
  lookup for the current country. `searchIdSet()` turns a query into a Set of matching ids
  (used for map dimming *and* the dropdown, so they always agree).
- **useDisplaySet** — the pieces currently on screen given the drill focus
  (country→provinces, region→its districts, district→the one district), with a `noun`
  label.
- **useZoomBehavior** — described above.
- **useReducedMotion / useMediaQuery** — media-query hooks (the 767px mobile breakpoint).
- **useAlertStream** — synthesizes a *live* hazard feed from the static data: classifies
  all regions+districts into H/M/L, then on a 3.4s interval emits one (High-weighted)
  event to the top of a rolling buffer with a real timestamp; a 1s tick keeps "12s ago"
  labels fresh. Swap the emitter for a WebSocket and the feed UI is unchanged.

## 8. Components — `src/components/`

**Layout (`App.tsx`):** header (logo · country selector · alert badge) → controls row
(search · filter tabs · reset) → main (map with floating overlays + right InfoPanel
drawer, which becomes a bottom sheet on mobile) → floating assistant.

- **CountrySelector** — native tablist segmented control (Pakistan/India/Kenya).
- **SearchBar** — fuzzy combobox (Fuse, top 8), 150ms-debounced writes to the store,
  bolded match highlighting, full keyboard nav; selecting drills straight to the
  region/district.
- **FilterTabs** — single-select filter (All / each risk type / Active Alerts); overridden
  and visually disabled while a search is active.
- **Breadcrumb** — Country › Region › District, each crumb clickable + a back arrow (the
  primary "go up" control since there's no free zoom).
- **InfoPanel** — the right drawer. Two states: **SummaryView** (country totals, critical
  count, regions-by-band bars) and **RegionView** (risk badge, **triage priority chip +
  action line**, Active-Alert flash, segmented severity bar with marker,
  "modeled/illustrative" disclaimer, summary, **localized advisory** with RTL handling for
  Urdu, a **mock audio player** standing in for TTS, and related-region chips).
- **Legend** — severity bands with numeric ranges (collapsible on mobile, always open
  desktop).
- **LayerToggles** — fire/flood switches (persist across country switches).
- **ResetButton** — clears search/filter/selection and re-fits to the country (does not
  change country).
- **AlertBadge** — header H/M/L triage LEDs for what's on screen; doubles as the launcher
  for the live feed.
- **Alerts/AlertStream** — the **Live Hazard Feed**: pulsing "live" indicator, H/M/L
  triage counts, a three-mode control (**Critical / Priority (default, mutes Low noise) /
  All**) that is the concrete **alert-fatigue** defense, and a streaming, click-to-zoom,
  color-coded row list with a "N lower-priority muted" counter.

## 9. Severity & alert domain (the classification system)

Two layers, one source of truth:

- **Severity index (0–100) → 4 bands** (Normal/Watch/Warning/Critical) — drives every fill
  color.
- **Alert triage (High/Medium/Low)** — the farmer-facing priority derived from the band;
  Normal regions are deliberately *not* alerts (that omission is the noise reduction).
  Surfaced in the header badge, the live feed, and the info panel.

## 10. The assistant — `src/assistant/` + `src/components/Assistant/`

A floating Q&A widget that also **drives the map**. Architecture is a clean provider seam:

- **Contract** (`types.ts`): `respond(query, ctx) → { text, actions }` where `actions` are
  `MapAction`s (setCountry/setFilter/focusRegion/focusDistrict/focusCountry/toggleLayer).
- **Swap point** (`index.ts`): returns the provider. Today → **`localProvider.ts`**, a
  data-grounded stand-in that parses intent (country, risk type, place name, "worst",
  "alerts", "summary", greetings), grounds answers in the bundled data, and returns
  actions. Replace it with a backend-LLM provider (tool-calling maps straight onto
  `MapAction`) and the UI is unchanged.
- **`src/hooks/useAssistant.ts`** — chat state + `execute`; auto-applies navigation
  actions from a reply but keeps layer toggles opt-in (a reply can't silently flip
  overlays).
- **`AssistantWidget.tsx`** — launcher + panel, typing dots, suggestion chips,
  re-runnable action chips.

## 11. Accessibility & performance

Native buttons with visible focus rings; every region path has an aria-label; severity
always shown as a number (never color-only); `prefers-reduced-motion` swaps
springs/stagger/pulses for plain crossfades; memoized projection + `React.memo`'d paths
keyed by id; simplified boundary GeoJSON; districts lazy-chunked; per-country data cached.

## 12. Design system — `tailwind.config.js` + `src/styles/globals.css`

Dark-only. Palette: base `#070910`, ink/ink-dim, glass panels (blurred translucent).
Severity tokens `band-normal/watch/warning/critical`; overlay accents `fire-hot`,
`flood-blue`. Keyframes: `fire-pulse`, `shimmer` (loading), `flash-in` (200ms
state-change flash). Rectangular inset "LED" indicators (rounded-[2px] + bezel), not
glowing dots.

## 13. Build & run

```bash
npm run dev      # Vite dev server (5173)
npm run build    # tsc -b + vite build
npm run preview  # serve the production build
npm run lint     # oxlint
```

## 14. Directory reference

```
src/
  App.tsx                      # layout shell
  main.tsx                     # React entry
  types/risk.ts                # domain types + severity/alert helpers (source of truth)
  store/useStore.ts            # Zustand global state
  data/
    loadCountry.ts             # ← single swap point for live data
    countries/*.geo.json       # ADM1 province boundaries (lazy)
    districts/*.adm2.json      # ADM2 district boundaries (lazy)
    mock/*-risk.json           # ADM1 risk records
    mock/*-risk-adm2.json      # ADM2 risk records
    mock/*-overlays.json       # fire hotspots + flood perimeters
  lib/
    selectors.ts               # match/summary/alert-event helpers
    search.ts                  # shared Fuse config
  hooks/
    useCountryData, useSearchIndex, useDisplaySet, useZoomBehavior,
    useReducedMotion, useMediaQuery, useAssistant, useAlertStream
  components/
    Map/                       # MapCanvas, RegionPath, FireOverlay, FloodOverlay
    Alerts/AlertStream.tsx     # live hazard feed
    Assistant/AssistantWidget.tsx
    CountrySelector, SearchBar, FilterTabs, Breadcrumb, InfoPanel,
    Legend, LayerToggles, ResetButton, AlertBadge
  assistant/
    index.ts                   # ← single swap point for the assistant brain
    localProvider.ts           # data-grounded stand-in
    types.ts                   # provider contract + MapAction
scripts/                       # gen-risk, fix-winding, build-districts
```
