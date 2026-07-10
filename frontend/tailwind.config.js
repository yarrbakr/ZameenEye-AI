/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base theme
        base: "#070910",
        panel: "rgba(255,255,255,0.05)",
        "panel-solid": "#0e1220",
        "panel-border": "rgba(255,255,255,0.10)",
        ink: "#e8e8ee",
        "ink-dim": "#8a8a99",
        // Severity bands (single source shared with the legend + region fill)
        "band-normal": "#3aa15e",
        "band-watch": "#e0a63a",
        "band-warning": "#e0763a",
        "band-critical": "#e0483a",
        // Overlay accents
        "fire-hot": "#e0483a",
        "flood-blue": "#3a7ce0",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        mono: ['"Space Mono"', "ui-monospace", "monospace"],
      },
      backdropBlur: {
        panel: "14px",
      },
      keyframes: {
        "fire-pulse": {
          "0%, 100%": { opacity: "0.85", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(1.35)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "flash-in": {
          "0%": { filter: "brightness(2.2)" },
          "100%": { filter: "brightness(1)" },
        },
      },
      animation: {
        "fire-pulse": "fire-pulse 2.2s ease-in-out infinite",
        shimmer: "shimmer 1.4s infinite",
        "flash-in": "flash-in 200ms ease-out",
      },
    },
  },
  plugins: [],
};
