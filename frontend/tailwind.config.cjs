const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--canvas) / <alpha-value>)",
        panel: "hsl(var(--panel) / <alpha-value>)",
        "panel-strong": "hsl(var(--panel-strong) / <alpha-value>)",
        line: "hsl(var(--line) / <alpha-value>)",
        ink: "hsl(var(--ink) / <alpha-value>)",
        "ink-soft": "hsl(var(--ink-soft) / <alpha-value>)",
        night: "hsl(var(--night) / <alpha-value>)",
        brand: "hsl(var(--brand) / <alpha-value>)",
        "brand-deep": "hsl(var(--brand-deep) / <alpha-value>)",
        "brand-soft": "hsl(var(--brand-soft) / <alpha-value>)",
        pine: "hsl(var(--pine) / <alpha-value>)",
        "pine-soft": "hsl(var(--pine-soft) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        border: "hsl(var(--line) / <alpha-value>)",
        input: "hsl(var(--panel) / <alpha-value>)",
        ring: "hsl(var(--brand) / <alpha-value>)",
        background: "hsl(var(--canvas) / <alpha-value>)",
        foreground: "hsl(var(--ink) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--brand) / <alpha-value>)",
          foreground: "hsl(var(--on-brand) / <alpha-value>)"
        },
        secondary: {
          DEFAULT: "hsl(var(--night) / <alpha-value>)",
          foreground: "hsl(var(--on-night) / <alpha-value>)"
        },
        destructive: {
          DEFAULT: "hsl(var(--danger) / <alpha-value>)",
          foreground: "hsl(var(--on-danger) / <alpha-value>)"
        },
        successState: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--on-success) / <alpha-value>)"
        },
        warningState: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--on-warning) / <alpha-value>)"
        },
        infoState: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          foreground: "hsl(var(--on-info) / <alpha-value>)"
        },
        muted: {
          DEFAULT: "hsl(var(--panel-strong) / <alpha-value>)",
          foreground: "hsl(var(--ink-soft) / <alpha-value>)"
        },
        accent: {
          DEFAULT: "hsl(var(--panel-strong) / <alpha-value>)",
          foreground: "hsl(var(--ink) / <alpha-value>)"
        },
        popover: {
          DEFAULT: "hsl(var(--panel) / <alpha-value>)",
          foreground: "hsl(var(--ink) / <alpha-value>)"
        },
        card: {
          DEFAULT: "hsl(var(--panel) / <alpha-value>)",
          foreground: "hsl(var(--ink) / <alpha-value>)"
        },
        glow: {
          primary: "hsl(var(--glow-primary) / <alpha-value>)",
          secondary: "hsl(var(--glow-secondary) / <alpha-value>)",
          tertiary: "hsl(var(--glow-tertiary) / <alpha-value>)"
        }
      },
      fontFamily: {
        sans: ["Manrope", ...defaultTheme.fontFamily.sans],
        display: ["Cormorant Garamond", ...defaultTheme.fontFamily.serif]
      },
      boxShadow: {
        card: "0 18px 40px rgba(15, 23, 42, 0.14)",
        soft: "0 10px 30px rgba(15, 23, 42, 0.1)",
        glow: "0 0 0 1px rgba(255, 191, 94, 0.1), 0 22px 60px rgba(76, 182, 255, 0.16)"
      }
    }
  }
};
