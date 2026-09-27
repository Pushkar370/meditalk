/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2F6F68",
          dark: "#265A54",
          light: "#3D897F",
        },
        sage: {
          DEFAULT: "#8FB9B2",
          light: "#A9CBC4",
        },
        accent: {
          DEFAULT: "#F4C95D",
          light: "#F8D77E",
        },
        background: "#F7FAF9",
        cream: "#FFF9F0",
        pink: "#F7D6D0",
        ink: "#26332F",
        danger: "#D9534F",
        success: "#3A8D5D",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Avenir", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(38, 51, 47, 0.08), 0 1px 2px rgba(38, 51, 47, 0.04)",
        "card-hover": "0 4px 12px rgba(38, 51, 47, 0.10)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
