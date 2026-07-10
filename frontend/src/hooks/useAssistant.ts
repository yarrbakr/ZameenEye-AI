import { useCallback, useState } from "react";
import { useStore } from "../store/useStore";
import { useSearchIndex } from "./useSearchIndex";
import { getProvider } from "../assistant";
import type { AssistantMessage, MapAction } from "../assistant/types";

const COUNTRY_LABEL: Record<string, string> = {
  pakistan: "Pakistan",
  india: "India",
  kenya: "Kenya",
};

const INTRO: AssistantMessage = {
  id: "intro",
  role: "assistant",
  text: "Hi — I’m the ZameenEye assistant. Ask me about climate risk and I’ll answer and move the map for you. (I’m a local stand-in until the ZameenEye model is connected.)",
};

export const SUGGESTIONS = [
  "Which regions have active alerts?",
  "Show drought risk in India",
  "What’s the worst-hit region?",
  "Zoom to Sindh",
];

export function useAssistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([INTRO]);
  const [loading, setLoading] = useState(false);

  const country = useStore((s) => s.selectedCountry);
  const focus = useStore((s) => s.focus);
  const { regions, districts } = useSearchIndex();

  const setCountry = useStore((s) => s.setCountry);
  const setFilter = useStore((s) => s.setFilter);
  const focusRegion = useStore((s) => s.focusRegion);
  const focusDistrict = useStore((s) => s.focusDistrict);
  const focusCountry = useStore((s) => s.focusCountry);
  const toggleLayer = useStore((s) => s.toggleLayer);

  const execute = useCallback(
    (a: MapAction) => {
      switch (a.type) {
        case "setCountry":
          void setCountry(a.country);
          break;
        case "setFilter":
          setFilter(a.filter);
          break;
        case "focusRegion":
          focusRegion(a.regionId);
          break;
        case "focusDistrict":
          focusDistrict(a.districtId);
          break;
        case "focusCountry":
          focusCountry();
          break;
        case "toggleLayer":
          toggleLayer(a.layer);
          break;
      }
    },
    [setCountry, setFilter, focusRegion, focusDistrict, focusCountry, toggleLayer]
  );

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || loading) return;
      const userMsg: AssistantMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: q,
      };
      setMessages((m) => [...m, userMsg]);
      setLoading(true);
      try {
        const reply = await getProvider().respond(q, {
          country,
          countryLabel: COUNTRY_LABEL[country],
          regions,
          districts,
          focus,
        });
        // Auto-apply navigation actions (except layer toggles, which stay opt-in
        // clicks so a reply can't silently flip an overlay on and off).
        reply.actions
          ?.filter((a) => a.type !== "toggleLayer")
          .forEach(execute);
        setMessages((m) => [...m, reply]);
      } finally {
        setLoading(false);
      }
    },
    [loading, country, regions, districts, focus, execute]
  );

  return { messages, loading, send, execute };
}
