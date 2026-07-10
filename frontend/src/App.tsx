import { useEffect, useState } from "react";
import { MapCanvas } from "./components/Map/MapCanvas";
import { CountrySelector } from "./components/CountrySelector";
import { AlertBadge } from "./components/AlertBadge";
import { AlertStream } from "./components/Alerts/AlertStream";
import { SearchBar } from "./components/SearchBar";
import { FilterTabs } from "./components/FilterTabs";
import { InfoPanel } from "./components/InfoPanel";
import { Legend } from "./components/Legend";
import { LayerToggles } from "./components/LayerToggles";
import { ResetButton } from "./components/ResetButton";
import { Breadcrumb } from "./components/Breadcrumb";
import { AssistantWidget } from "./components/Assistant/AssistantWidget";
import { useMediaQuery } from "./hooks/useMediaQuery";

export default function App() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  // Live hazard feed is open by default on desktop (it's the console's live activity
  // monitor); collapsed on mobile so it doesn't fight the map for space.
  const [streamOpen, setStreamOpen] = useState(false);
  useEffect(() => setStreamOpen(!isMobile), [isMobile]);

  return (
    <div className="flex h-full flex-col bg-base text-ink">
      {/* ===== Header ===== */}
      <header className="z-30 flex flex-col gap-3 border-b border-panel-border px-4 py-3 md:flex-row md:items-center md:gap-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-mark.png"
            alt="ZameenEye AI"
            className="h-9 w-9 rounded-md object-cover ring-1 ring-white/10"
          />
          <div className="leading-tight">
            <div className="font-display text-sm font-bold tracking-wide">
              ZameenEye AI
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">
              Climate Risk Console
            </div>
          </div>
        </div>

        {/* Country selector — center on desktop */}
        <div className="md:mx-auto">
          <CountrySelector />
        </div>

        {/* Alert triage badge — right (also the live-feed launcher) */}
        <div className="md:ml-auto">
          <AlertBadge
            streamOpen={streamOpen}
            onToggleStream={() => setStreamOpen((o) => !o)}
          />
        </div>
      </header>

      {/* ===== Controls row ===== */}
      <div className="z-20 flex flex-col gap-2 border-b border-panel-border px-4 py-2 md:flex-row md:items-center md:justify-between">
        <SearchBar />
        <div className="min-w-0 overflow-x-auto md:overflow-visible">
          <FilterTabs />
        </div>
        <div className="hidden md:block">
          <ResetButton />
        </div>
      </div>

      {/* ===== Main: map + panel ===== */}
      <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Map area */}
        <div className="relative min-h-0 flex-1">
          <MapCanvas />

          {/* Floating controls over the map */}
          <div className="pointer-events-none absolute inset-0">
            <div className="pointer-events-auto absolute left-3 top-3 flex max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col items-start gap-2">
              <Breadcrumb />
              <AlertStream
                open={streamOpen}
                onClose={() => setStreamOpen(false)}
              />
            </div>
            <div className="pointer-events-auto absolute right-3 top-3">
              <LayerToggles />
            </div>
            <div className="pointer-events-auto absolute bottom-3 left-3 w-44">
              <Legend />
            </div>
            {/* Mobile Reset sits above the legend chip so it clears the assistant
                launcher in the bottom-right. */}
            <div className="pointer-events-auto absolute bottom-16 left-3 md:hidden">
              <ResetButton />
            </div>
          </div>
        </div>

        {/* Info panel — right drawer (desktop) / bottom sheet (mobile) */}
        {isMobile ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
            <div className="pointer-events-auto">
              <InfoPanel />
            </div>
          </div>
        ) : (
          <div className="shrink-0 p-3">
            <InfoPanel />
          </div>
        )}
      </main>

      {/* Floating assistant (Q&A widget) */}
      <AssistantWidget />
    </div>
  );
}
