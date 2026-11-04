import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070b12",
          900: "#0b1119",
          850: "#0f1720",
          800: "#141d28",
          700: "#1b2734",
          600: "#263543",
        },
        // Light blue
        brand: {
          300: "#7dd3fc",
          400: "#5cc4f4",
          500: "#38b6ea",
          600: "#1f9ad0",
        },
        // Green
        mint: {
          300: "#6ee7b7",
          400: "#47d69b",
          500: "#2bbf84",
          600: "#1fa471",
        },
        ink: {
          100: "#e9f0f6",
          200: "#c8d4df",
          300: "#a3b2c0",
          400: "#7f8e9c",
          500: "#61707e",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 16px 32px -24px rgba(0,0,0,0.9)",
        rise: "0 18px 36px -24px rgba(0,0,0,0.95)",
      },
      animation: {
        "fade-up": "fadeUp .5s cubic-bezier(.16,1,.3,1) both",
        "fade-in": "fadeIn .3s ease both",
        "page-in": "pageIn .35s cubic-bezier(.16,1,.3,1) both",
        "pop-in": "popIn .35s cubic-bezier(.16,1,.3,1) both",
        "slide-down": "slideDown .2s ease-out both",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        pageIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
