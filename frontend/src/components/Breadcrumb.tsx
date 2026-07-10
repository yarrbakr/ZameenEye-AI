import { useStore } from "../store/useStore";
import { useSearchIndex } from "../hooks/useSearchIndex";

const COUNTRY_LABEL: Record<string, string> = {
  pakistan: "Pakistan",
  india: "India",
  kenya: "Kenya",
};

// Drill breadcrumb + back control. Since there's no free zoom, this is how you move
// back up levels (Country › Region › District). Each crumb is clickable.
export function Breadcrumb() {
  const code = useStore((s) => s.selectedCountry);
  const focus = useStore((s) => s.focus);
  const focusCountry = useStore((s) => s.focusCountry);
  const focusRegion = useStore((s) => s.focusRegion);
  const focusUp = useStore((s) => s.focusUp);
  const { byId } = useSearchIndex();

  const regionId =
    focus.level === "region"
      ? focus.regionId
      : focus.level === "district"
        ? focus.regionId
        : null;
  const districtId = focus.level === "district" ? focus.districtId : null;
  const regionName = regionId ? byId[regionId]?.regionName : null;
  const districtName = districtId ? byId[districtId]?.regionName : null;

  const atCountry = focus.level === "country";

  return (
    <div className="glass flex items-center gap-1.5 rounded-lg px-2.5 py-1.5">
      {!atCountry && (
        <button
          onClick={focusUp}
          aria-label="Back one level"
          className="focusable mr-1 rounded px-1.5 text-ink-dim hover:text-ink"
        >
          ←
        </button>
      )}
      <button
        onClick={focusCountry}
        disabled={atCountry}
        className={`focusable font-display text-xs font-semibold tracking-wide ${
          atCountry ? "text-ink" : "text-ink-dim hover:text-ink"
        }`}
      >
        {COUNTRY_LABEL[code]}
      </button>
      {regionName && (
        <>
          <span className="text-ink-dim/50">›</span>
          <button
            onClick={() => regionId && focusRegion(regionId)}
            disabled={focus.level === "region"}
            className={`focusable font-display text-xs font-semibold tracking-wide ${
              focus.level === "region"
                ? "text-ink"
                : "text-ink-dim hover:text-ink"
            }`}
          >
            {regionName}
          </button>
        </>
      )}
      {districtName && (
        <>
          <span className="text-ink-dim/50">›</span>
          <span className="font-display text-xs font-semibold tracking-wide text-ink">
            {districtName}
          </span>
        </>
      )}
    </div>
  );
}
