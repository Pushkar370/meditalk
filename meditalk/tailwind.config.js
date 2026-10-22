/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Apple-inspired restrained brand palette
        primary: {
          DEFAULT: "#007A5A", // Apple-style clinical emerald
          dark: "#006247",
          light: "#059669",
          muted: "rgba(0, 122, 90, 0.08)",
          subtle: "rgba(0, 122, 90, 0.12)",
        },
        accent: {
          DEFAULT: "#0071E3", // Apple system blue for interactive links/focus
          light: "#409CFF",
          dark: "#0058B0",
          muted: "rgba(0, 113, 227, 0.08)",
        },
        sage: {
          DEFAULT: "#8FB9B2",
          light: "#A9CBC4",
        },
        // Apple canvas and surface hierarchy
        canvas: {
          DEFAULT: "#F5F5F7",
          light: "#F5F5F7",
          dark: "#000000",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          card: "#FFFFFF",
          elevated: "#FFFFFF",
          dark: "#1C1C1E",
          darkCard: "#2C2C2E",
        },
        // Apple typography colors
        ink: {
          DEFAULT: "#1D1D1F", // Primary label
          secondary: "#6E6E73", // Secondary label
          tertiary: "#86868B", // Tertiary / placeholder
          quaternary: "#AEAEB2",
          dark: "#F5F5F7",
        },
        // Apple system feedback colors
        danger: {
          DEFAULT: "#FF3B30",
          dark: "#D70015",
          light: "#FF453A",
          surface: "rgba(255, 59, 48, 0.08)",
        },
        success: {
          DEFAULT: "#34C759",
          dark: "#248A3D",
          light: "#30D158",
          surface: "rgba(52, 199, 89, 0.08)",
        },
        warning: {
          DEFAULT: "#FF9500",
          dark: "#C96D00",
          light: "#FF9F0A",
          surface: "rgba(255, 149, 0, 0.08)",
        },
        info: {
          DEFAULT: "#0071E3",
          surface: "rgba(0, 113, 227, 0.08)",
        },
        background: "#F5F5F7",
        cream: "#FBFBFC",
        pink: "#FDF2F0",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        "display-2xl": ["3.5rem", { lineHeight: "1.08", letterSpacing: "-0.03em", fontWeight: "700" }],
        "display-xl": ["2.75rem", { lineHeight: "1.12", letterSpacing: "-0.025em", fontWeight: "700" }],
        "display-lg": ["2.25rem", { lineHeight: "1.16", letterSpacing: "-0.022em", fontWeight: "600" }],
        title: ["1.75rem", { lineHeight: "1.25", letterSpacing: "-0.018em", fontWeight: "600" }],
        headline: ["1.25rem", { lineHeight: "1.35", letterSpacing: "-0.015em", fontWeight: "600" }],
        subheadline: ["0.9375rem", { lineHeight: "1.45", letterSpacing: "-0.01em", fontWeight: "500" }],
        body: ["0.9375rem", { lineHeight: "1.5", letterSpacing: "-0.005em", fontWeight: "400" }],
        caption: ["0.8125rem", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "400" }],
      },
      boxShadow: {
        card: "0 2px 12px -2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)",
        "card-hover": "0 12px 28px -4px rgba(0, 0, 0, 0.07), 0 2px 8px rgba(0, 0, 0, 0.03)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.05)",
        popover: "0 16px 36px -8px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04)",
        modal: "0 24px 64px -12px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.06)",
      },
      borderRadius: {
        xl: "0.875rem", // 14px
        "2xl": "1.125rem", // 18px
        "3xl": "1.5rem", // 24px
        "4xl": "2rem", // 32px
      },
    },
  },
  plugins: [],
};
