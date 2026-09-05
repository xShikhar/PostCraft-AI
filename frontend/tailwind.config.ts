import type { Config } from "tailwindcss";

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
      colors: {
        // Surface layers (light)
        surface: "var(--surface)",
        "surface-dim": "var(--surface-dim)",
        "surface-bright": "var(--surface-bright)",
        "surface-container-lowest": "var(--surface-container-lowest)",
        "surface-container-low": "var(--surface-container-low)",
        "surface-container": "var(--surface-container)",
        "surface-container-high": "var(--surface-container-high)",
        "surface-container-highest": "var(--surface-container-highest)",
        "surface-subtle": "var(--surface-subtle)",
        "surface-variant": "var(--surface-variant)",
        "surface-card": "var(--surface-card)",
        "surface-tint": "var(--surface-tint)",

        // Background (alias for canvas-base)
        "canvas-base": "var(--canvas-base)",

        // Foreground / text
        "text-display": "var(--text-display)",
        "text-body": "var(--text-body)",
        "text-muted": "var(--text-muted)",

        // Primary
        primary: "var(--primary)",
        "on-primary": "var(--on-primary)",
        "primary-container": "var(--primary-container)",
        "on-primary-container": "var(--on-primary-container)",
        "primary-fixed": "var(--primary-fixed)",
        "primary-fixed-dim": "var(--primary-fixed-dim)",
        "on-primary-fixed": "var(--on-primary-fixed)",
        "on-primary-fixed-variant": "var(--on-primary-fixed-variant)",
        "inverse-primary": "var(--inverse-primary)",

        // Secondary
        secondary: "var(--secondary)",
        "on-secondary": "var(--on-secondary)",
        "secondary-container": "var(--secondary-container)",
        "on-secondary-container": "var(--on-secondary-container)",
        "secondary-fixed": "var(--secondary-fixed)",
        "secondary-fixed-dim": "var(--secondary-fixed-dim)",
        "on-secondary-fixed": "var(--on-secondary-fixed)",
        "on-secondary-fixed-variant": "var(--on-secondary-fixed-variant)",

        // Tertiary
        tertiary: "var(--tertiary)",
        "on-tertiary": "var(--on-tertiary)",
        "tertiary-container": "var(--tertiary-container)",
        "on-tertiary-container": "var(--on-tertiary-container)",
        "tertiary-fixed": "var(--tertiary-fixed)",
        "tertiary-fixed-dim": "var(--tertiary-fixed-dim)",
        "on-tertiary-fixed": "var(--on-tertiary-fixed)",
        "on-tertiary-fixed-variant": "var(--on-tertiary-fixed-variant)",

        // Surface-card inversion hover (shared between light + dark)
        "surface-card-hover-start": "var(--surface-card-hover-start)",
        "surface-card-hover-end": "var(--surface-card-hover-end)",

        // Borders
        "border-subtle": "var(--border-subtle)",
        "border-hover": "var(--border-hover)",

        // Outline / muted surfaces
        outline: "var(--outline)",
        "outline-variant": "var(--outline-variant)",

        // Inverse surfaces (used on hover-inversion)
        "inverse-surface": "var(--inverse-surface)",
        "inverse-on-surface": "var(--inverse-on-surface)",

        // Error
        error: "var(--error)",
        "on-error": "var(--on-error)",
        "error-container": "var(--error-container)",
        "on-error-container": "var(--on-error-container)",

        // shadcn/ui base tokens (kept for compatibility with existing UI components)
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
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
        // Headings use Playfair Display (editorial serif)
        serif: ["Playfair Display", "Georgia", "serif"],
        "headline-lg": ["Playfair Display", "Georgia", "serif"],
        "headline-lg-mobile": ["Playfair Display", "Georgia", "serif"],
        "headline-md": ["Playfair Display", "Georgia", "serif"],
        "headline-sm": ["Playfair Display", "Georgia", "serif"],
        "display-hero": ["Playfair Display", "Georgia", "serif"],
        "display-hero-mobile": ["Playfair Display", "Georgia", "serif"],
        // Body / UI uses Inter (neo-grotesque sans)
        sans: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        "body-lg": ["Inter", "system-ui", "sans-serif"],
        "body-md": ["Inter", "system-ui", "sans-serif"],
        "body-sm": ["Inter", "system-ui", "sans-serif"],
        "title-lg": ["Inter", "system-ui", "sans-serif"],
        "title-sm": ["Inter", "system-ui", "sans-serif"],
        "label-md": ["Inter", "system-ui", "sans-serif"],
        "label-xs": ["Inter", "system-ui", "sans-serif"],
      },

      // ─── Font sizes ──────────────────────────────────────────────────────────
      fontSize: {
        // Headlines (Playfair Display)
        "display-hero": ["3rem", { lineHeight: "3.5rem", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-hero-mobile": ["2.125rem", { lineHeight: "2.625rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-lg": ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-lg-mobile": ["1.625rem", { lineHeight: "2.125rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-md": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.01em", fontWeight: "500" }],
        // UI / Body (Inter)
        "body-lg": ["1rem", { lineHeight: "1.625rem", letterSpacing: "0em", fontWeight: "400" }],
        "body-md": ["0.875rem", { lineHeight: "1.375rem", letterSpacing: "0em", fontWeight: "400" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.125rem", letterSpacing: "0.005em", fontWeight: "400" }],
        "title-lg": ["1.125rem", { lineHeight: "1.625rem", letterSpacing: "-0.01em", fontWeight: "600" }],
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
  plugins: [require("tailwindcss-animate")],
};

export default config;
