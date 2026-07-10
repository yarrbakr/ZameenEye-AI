# ZameenEye AI · Climate Risk Console

Interactive multi-country climate-risk map visualizing **drought, flood, fire and
soil-degradation** risk across **Pakistan, India and Kenya**, with country switching,
fuzzy region search, filterable risk layers and localized advisory context.

It's aimed at **farmers** facing rapidly shifting climate — helping them see the risk
in their district and act on it, with advisories in their **native language**
(Urdu / Hindi / Swahili) standing in for the TTS audio the compute team will produce.

This is the **UI track** — compute/telemetry is handled by teammates, so the data
layer is mock-but-realistic and structured to swap in live data with a **one-file
change** (`src/data/loadCountry.ts`).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Everything (all three countries' boundaries + risk + overlay data) is bundled
locally — the demo runs fully offline; no runtime fetch to external services.

```bash
npm run build      # typecheck (tsc -b) + production build
npm run preview    # serve the production build
```

## How it works

- **Stack:** Vite + React + TypeScript, Tailwind CSS, Framer Motion, D3
  (`d3-geo`/`d3-zoom`/`d3-selection`/`d3-scale`), Fuse.js, Zustand.
- **Map:** `d3.geoMercator().fitSize()` re-fit per country and on resize. React owns
  the DOM (one memoized `<path>` per piece keyed by a stable id); D3 handles the
  projection math and the fit-to-focus transform interpolation. There is **no free
  pan/zoom** — navigation is selection-driven (see below). Region fill is a **pure
  function of `(severity, activeAlert)`**.
- **State (`src/store/useStore.ts`):** selected country, selected region, active
  filter, search query, and layer toggles. Loaded country data is **cached per
  country code** so switching back is instant. Country switches reset
  region/search/filter but **keep layer toggles** (a viewing preference). Layer
  toggles (fire/flood) are independent of country and filter/search.
- **Overlays:** fire hotspots (stand-in for NASA FIRMS) and flood perimeters
  (stand-in for UNOSAT flood extent), each independently toggleable.
- **Selection-driven drill (ADM1 → ADM2):** the default view fits the whole country
  and shows its provinces/counties. **Selecting a region** zooms it to fit the screen,
  the sibling regions **break away like lego bricks** (fling outward, shrink, tumble,
  fade), and that region's **districts** appear inside it (ADM2 — Pakistan 126,
  Kenya 290, India 735). **Selecting a district** zooms it to fit and its siblings
  break away in turn. A **breadcrumb** (Country › Region › District) and clicking empty
  space step back up one level. District geometry + risk are a **separate lazy chunk**
  preloaded after the country loads, so search finds districts and drilling is instant.
  Each district carries its parent province (assigned at build time by point-in-polygon)
  for breadcrumb context and sibling "related districts".
- **Modeled severity:** the 0–100 severity is a **modeled/illustrative** index, not a
  measured figure — the info panel labels it as such. When the compute team supplies a
  real method, set `scoreMethod` on a record and that label replaces the disclaimer.
- **Per-country cultural backdrop:** a faded agriculture photo sits behind each
  country's map (Pakistan wheat, India rice harvest, Kenya farmers) — it crossfades on
  country change and stays fixed while drilling to districts. Images are bundled locally
  (offline-safe) and credited in [`CREDITS.md`](CREDITS.md); swap a file in
  `public/backgrounds/` to change one.
- **Alert severity triage & live hazard feed:** every hazard is classified into a
  **High / Medium / Low** priority (derived once in `types/risk.ts` from the severity
  band, so triage stays in lockstep with the map fill). The header **triage badge**
  shows the H/M/L breakdown for whatever is on screen and launches the **Live Hazard
  Feed** — a real-time activity monitor that streams classified hazards in newest-first,
  color-coded, and lets you click any row to zoom the map to it. The feed's default
  **"Priority" mode mutes Low-priority noise** so farmers act on what matters — the
  console's concrete defense against **alert fatigue** — with "Critical" and "All"
  modes alongside. The stream's liveness is the only simulated part (`useAlertStream`);
  swap that emitter for the compute team's WebSocket push and the feed UI is unchanged.
- **Assistant widget:** a floating Q&A assistant (bottom-right) answers questions about
  climate risk and **drives the map** — switching country, applying a filter, or zooming
  to a region/district. The answering logic sits behind a provider seam
  (`src/assistant/index.ts`): today a **local, data-grounded stand-in** replies from the
  bundled data so it works offline; swap that one file for a provider that POSTs to the
  ZameenEye backend LLM and the chat UI is unchanged (an LLM with tool-calling maps
  straight onto the `{ text, actions }` / `MapAction` contract in `assistant/types.ts`).

## Data layer (swapping in live data)

The **only** file to change for live data is `src/data/loadCountry.ts`. It resolves
each country's geometry + risk + overlays via dynamic `import()` (so each country is
a separate lazy-loaded chunk). Replace the `import()` bodies with `fetch()` calls to
real endpoints — **no component or store code changes**. Components consume data only
through the `useCountryData()` hook.

Data shapes live in `src/types/risk.ts`. The severity → color bands (Normal / Watch /
Warning / Critical) are defined once there and shared by the map fill, the legend, the
tooltip and the info panel, so a palette change propagates everywhere.

### Regenerating the mock data

Boundary GeoJSON is simplified geoBoundaries ADM1 data. The mock risk data is
generated so **every** region on the map is colored, with hand-curated narratives for
featured/high-signal regions and deterministic plausible data for the rest.

```bash
npm run gen:risk        # regenerate ADM1 risk from the province GeoJSON
npm run fix:winding     # normalize province ring winding for d3-geo (see note below)
npm run build:districts # rebuild ADM2 district geometry + risk (needs geo-adm2/<C>.simpl.json)
```

> **Note on winding order:** d3-geo's spherical `geoMercator` renders the *complement*
> of a polygon (filling the whole viewport) when ring winding is wrong. geoBoundaries
> data has inconsistent winding, so `scripts/fix-winding.mjs` rewinds every geometry to
> clockwise-exterior, which d3-geo renders correctly. Re-run it after replacing any
> boundary file.

## Accessibility & performance

- Every region `<path>` has an `aria-label` (name, risk type, severity). Country
  selector and filter tabs are **native buttons** with visible focus states.
- Severity is **never conveyed by color alone** — the number is always shown in the
  tooltip and info panel.
- `prefers-reduced-motion` disables the stagger/spring animations and the fire pulse,
  falling back to plain opacity crossfades.
- The D3 projection/path generator is memoized per country; `RegionPath` is
  `React.memo`'d and keyed by region id so filter/search changes don't re-render the
  whole map. Boundary GeoJSON is simplified (mapshaper) to keep rendering snappy.

## Project structure

```
src/
  data/
    loadCountry.ts          # ← single swap point for live data
    countries/*.geo.json    # simplified ADM1 province boundaries (lazy-loaded)
    districts/*.adm2.json   # simplified ADM2 district boundaries (lazy, zoom-reveal)
    mock/*-risk.json        # generated ADM1 risk (one record per province)
    mock/*-risk-adm2.json   # generated ADM2 risk (one record per district)
    mock/*-overlays.json    # fire hotspots + flood perimeters per country
  types/risk.ts            # domain types + severity band helpers
  store/useStore.ts        # Zustand global state
  hooks/                   # useCountryData, useZoomBehavior, useReducedMotion, useMediaQuery
  lib/                     # selectors (match/summary), search (Fuse config)
  components/
    Map/                   # MapCanvas, RegionPath, FireOverlay, FloodOverlay
    CountrySelector, SearchBar, FilterTabs, InfoPanel, Legend, LayerToggles,
    AlertBadge, ResetButton
scripts/                   # gen-risk.mjs, fix-winding.mjs (build-time data tooling)
```
