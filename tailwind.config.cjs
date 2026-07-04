/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d4d8e0",
          300: "#aab2c1",
          400: "#7a8598",
          500: "#525d72",
          600: "#3d4658",
          700: "#2d3545",
          800: "#1e2532",
          900: "#0f131c",
          950: "#080b11",
        },
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bbddfd",
          300: "#7cc1fb",
          400: "#36a1f6",
          500: "#0c85eb",
          600: "#0069c9",
          700: "#0154a1",
          800: "#064785",
          900: "#0a3c6e",
          950: "#07264b",
        },
        accent: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        warn: {
          400: "#fbbf24",
          500: "#f59e0b",
        },
        danger: {
          400: "#f87171",
          500: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-ring": "pulseRing 2s ease-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "gradient": "gradient 8s ease infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(12, 133, 235, 0.4)" },
          "70%": { boxShadow: "0 0 0 12px rgba(12, 133, 235, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(12, 133, 235, 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        gradient: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
}
