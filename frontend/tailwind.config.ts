import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // ─── Luminous Editorial AI — Light palette ───────────────────────────────
      // Typography: Merriweather (headlines) + Lato (body/UI) — per hyperverge.co
      colors: {
        // Surface layers (light)
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-dim": "rgb(var(--surface-dim-rgb) / <alpha-value>)",
        "surface-bright": "rgb(var(--surface-bright-rgb) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--surface-container-lowest-rgb) / <alpha-value>)",
        "surface-container-low": "rgb(var(--surface-container-low-rgb) / <alpha-value>)",
        "surface-container": "rgb(var(--surface-container-rgb) / <alpha-value>)",
        "surface-container-high": "rgb(var(--surface-container-high-rgb) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--surface-container-highest-rgb) / <alpha-value>)",
        "surface-subtle": "rgb(var(--surface-subtle-rgb) / <alpha-value>)",
        "surface-variant": "rgb(var(--surface-variant-rgb) / <alpha-value>)",
        "surface-card": "rgb(var(--surface-card-rgb) / <alpha-value>)",
        "surface-tint": "rgb(var(--surface-tint-rgb) / <alpha-value>)",

        // Background (alias for canvas-base)
        "canvas-base": "rgb(var(--canvas-base-rgb) / <alpha-value>)",

        // Foreground / text
        "text-display": "rgb(var(--text-display-rgb) / <alpha-value>)",
        "text-body": "rgb(var(--text-body-rgb) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted-rgb) / <alpha-value>)",

        // Primary
        primary: "rgb(var(--primary-rgb) / <alpha-value>)",
        "primary-foreground": "rgb(var(--primary-foreground-rgb) / <alpha-value>)",
        "on-primary": "rgb(var(--on-primary-rgb) / <alpha-value>)",
        "primary-container": "rgb(var(--primary-container-rgb) / <alpha-value>)",
        "on-primary-container": "rgb(var(--on-primary-container-rgb) / <alpha-value>)",
        "primary-fixed": "rgb(var(--primary-fixed-rgb) / <alpha-value>)",
        "primary-fixed-dim": "rgb(var(--primary-fixed-dim-rgb) / <alpha-value>)",
        "on-primary-fixed": "rgb(var(--on-primary-fixed-rgb) / <alpha-value>)",
        "on-primary-fixed-variant": "rgb(var(--on-primary-fixed-variant-rgb) / <alpha-value>)",
        "inverse-primary": "rgb(var(--inverse-primary-rgb) / <alpha-value>)",

        // Secondary
        secondary: "rgb(var(--secondary-rgb) / <alpha-value>)",
        "on-secondary": "rgb(var(--on-secondary-rgb) / <alpha-value>)",
        "secondary-container": "rgb(var(--secondary-container-rgb) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--on-secondary-container-rgb) / <alpha-value>)",
        "secondary-fixed": "rgb(var(--secondary-fixed-rgb) / <alpha-value>)",
        "secondary-fixed-dim": "rgb(var(--secondary-fixed-dim-rgb) / <alpha-value>)",
        "on-secondary-fixed": "rgb(var(--on-secondary-fixed-rgb) / <alpha-value>)",
        "on-secondary-fixed-variant": "rgb(var(--on-secondary-fixed-variant-rgb) / <alpha-value>)",

        // Tertiary
        tertiary: "rgb(var(--tertiary-rgb) / <alpha-value>)",
        "on-tertiary": "rgb(var(--on-tertiary-rgb) / <alpha-value>)",
        "tertiary-container": "rgb(var(--tertiary-container-rgb) / <alpha-value>)",
        "on-tertiary-container": "rgb(var(--on-tertiary-container-rgb) / <alpha-value>)",
        "tertiary-fixed": "rgb(var(--tertiary-fixed-rgb) / <alpha-value>)",
        "tertiary-fixed-dim": "rgb(var(--tertiary-fixed-dim-rgb) / <alpha-value>)",
        "on-tertiary-fixed": "rgb(var(--on-tertiary-fixed-rgb) / <alpha-value>)",
        "on-tertiary-fixed-variant": "rgb(var(--on-tertiary-fixed-variant-rgb) / <alpha-value>)",

        // Surface-card inversion hover (shared between light + dark)
        "surface-card-hover-start": "rgb(var(--surface-card-hover-start-rgb) / <alpha-value>)",
        "surface-card-hover-end": "rgb(var(--surface-card-hover-end-rgb) / <alpha-value>)",

        // Borders
        "border-subtle": "rgb(var(--border-subtle-rgb) / <alpha-value>)",
        "border-hover": "rgb(var(--border-hover-rgb) / <alpha-value>)",

        // Outline / muted surfaces
        outline: "rgb(var(--outline-rgb) / <alpha-value>)",
        "outline-variant": "rgb(var(--outline-variant-rgb) / <alpha-value>)",

        // Inverse surfaces (used on hover-inversion)
        "inverse-surface": "rgb(var(--inverse-surface-rgb) / <alpha-value>)",
        "inverse-on-surface": "rgb(var(--inverse-on-surface-rgb) / <alpha-value>)",

        // Error
        error: "rgb(var(--error-rgb) / <alpha-value>)",
        "on-error": "rgb(var(--on-error-rgb) / <alpha-value>)",
        "error-container": "rgb(var(--error-container-rgb) / <alpha-value>)",
        "on-error-container": "rgb(var(--on-error-container-rgb) / <alpha-value>)",

        // shadcn/ui base tokens (kept for compatibility with existing UI components)
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card-rgb) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground-rgb) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover-rgb) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground-rgb) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted-rgb) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground-rgb) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive-rgb) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground-rgb) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--success-rgb) / <alpha-value>)",
          foreground: "rgb(var(--success-foreground-rgb) / <alpha-value>)",
        },
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        input: "rgb(var(--input-rgb) / <alpha-value>)",
        ring: "rgb(var(--ring-rgb) / <alpha-value>)",
      },

      // ─── Spacing ─────────────────────────────────────────────────────────────
      spacing: {
        "space-2xs": "0.25rem",
        "space-xs": "0.5rem",
        "space-sm": "0.75rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2rem",
        "space-2xl": "3rem",
        "space-3xl": "4rem",
        "sidebar-width": "17.5rem",
        "layout-gutter": "1.25rem",
        "layout-margin-mobile": "1rem",
        "layout-margin-desktop": "2.5rem",
      },

      // ─── Border radius ───────────────────────────────────────────────────────
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.25rem",
        lg: "0.5rem",
        md: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
        full: "9999px",
      },

      // ─── Font families ───────────────────────────────────────────────────────
      fontFamily: {
        // Headlines use Merriweather (editorial serif — matches hyperverge.co)
        serif: ["var(--font-merriweather)", "Georgia", "serif"],
        "headline-lg": ["var(--font-merriweather)", "Georgia", "serif"],
        "headline-lg-mobile": ["var(--font-merriweather)", "Georgia", "serif"],
        "headline-md": ["var(--font-merriweather)", "Georgia", "serif"],
        "headline-sm": ["var(--font-merriweather)", "Georgia", "serif"],
        "display-hero": ["var(--font-merriweather)", "Georgia", "serif"],
        "display-hero-mobile": ["var(--font-merriweather)", "Georgia", "serif"],
        // Body / UI uses Lato (clean sans — matches hyperverge.co)
        sans: ["var(--font-lato)", "system-ui", "sans-serif"],
        body: ["var(--font-lato)", "system-ui", "sans-serif"],
        "body-lg": ["var(--font-lato)", "system-ui", "sans-serif"],
        "body-md": ["var(--font-lato)", "system-ui", "sans-serif"],
        "body-sm": ["var(--font-lato)", "system-ui", "sans-serif"],
        "title-lg": ["var(--font-lato)", "system-ui", "sans-serif"],
        "title-sm": ["var(--font-lato)", "system-ui", "sans-serif"],
        "label-md": ["var(--font-lato)", "system-ui", "sans-serif"],
        "label-xs": ["var(--font-lato)", "system-ui", "sans-serif"],
      },

      // ─── Font sizes ──────────────────────────────────────────────────────────
      fontSize: {
        // Headlines (Merriweather — only ships 400, 700, 900. Always force
        // weight 700 or higher so the browser doesn't pick the thin 400
        // fallback when a "medium" weight is requested.)
        "display-hero": ["3rem", { lineHeight: "3.5rem", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-hero-mobile": ["2.125rem", { lineHeight: "2.625rem", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-lg": ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.015em", fontWeight: "700" }],
        "headline-lg-mobile": ["1.625rem", { lineHeight: "2.125rem", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-md": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.01em", fontWeight: "700" }],
        // Card / sub-headlines — also Merriweather, must be 700+
        "title-lg": ["1.125rem", { lineHeight: "1.625rem", letterSpacing: "-0.01em", fontWeight: "700" }],
        "title-md": ["1rem", { lineHeight: "1.5rem", letterSpacing: "0em", fontWeight: "700" }],
        // UI / Body (Lato — full 100-900 range available)
        "body-lg": ["1rem", { lineHeight: "1.625rem", letterSpacing: "0em", fontWeight: "400" }],
        "body-md": ["0.875rem", { lineHeight: "1.375rem", letterSpacing: "0em", fontWeight: "400" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.125rem", letterSpacing: "0.005em", fontWeight: "400" }],
        "title-sm": ["0.9375rem", { lineHeight: "1.375rem", letterSpacing: "0em", fontWeight: "600" }],
        "label-md": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.04em", fontWeight: "600" }],
        "label-xs": ["0.625rem", { lineHeight: "0.875rem", letterSpacing: "0.06em", fontWeight: "700" }],
      },

      // ─── Shadows ─────────────────────────────────────────────────────────────
      boxShadow: {
        "card-light":
          "0 4px 20px -2px rgba(93, 59, 232, 0.05), 0 2px 6px -1px rgba(14, 9, 31, 0.03)",
        "card-dark":
          "0 4px 20px -2px rgba(0, 0, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.2)",
        "sidebar": "0 1px 8px rgba(0, 0, 0, 0.04)",
        "header": "0 1px 8px rgba(0, 0, 0, 0.04)",
      },

      // ─── Animations ──────────────────────────────────────────────────────────
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
