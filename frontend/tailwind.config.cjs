const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        brand: {
          50: "#fff1f5",
          100: "#ffe4ee",
          200: "#fecddf",
          300: "#fda4c6",
          400: "#fb6ea5",
          500: "#f33f8b",
          600: "#e21a73",
          700: "#be0f5d",
          800: "#9b104f",
          900: "#811046"
        },
        ink: {
          50: "#f7f4fb",
          100: "#ede7f7",
          200: "#d9cfee",
          300: "#bfa8df",
          400: "#9d77cb",
          500: "#7a4eb1",
          600: "#643a9a",
          700: "#4f2d7d",
          800: "#3e2463",
          900: "#2f1b4a"
        },
        gold: {
          100: "#fff1c2",
          200: "#ffe08a",
          300: "#ffd15a",
          400: "#f8ba2f",
          500: "#e9a913"
        },
        mint: {
          100: "#d8fff3",
          200: "#a7f6e2",
          300: "#6ee8cb",
          400: "#36d2b2",
          500: "#1ab79a"
        },
        success: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b"
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f"
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d"
        }
      },
      fontFamily: {
        sans: ["\"DM Sans\"", ...defaultTheme.fontFamily.sans],
        display: ["\"Playfair Display\"", ...defaultTheme.fontFamily.serif]
      },
      boxShadow: {
        card: "0 18px 40px rgba(31, 13, 61, 0.12)",
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};
