import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"SF Pro Display"',
          '"SF Pro Text"',
          "-apple-system",
          "BlinkMacSystemFont",
          "var(--font-inter, Inter)",
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        /* Semantic tokens (CSS-variable driven for shadcn compat) */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Ink shortcut */
        ink: "#1D1D1F",
        /* Document-class accent colours */
        "cls-csp": "#3B82F6",
        "cls-ib": "#8B5CF6",
        "cls-icf": "#22C55E",
        "cls-crf": "#F59E0B",
        "cls-csr": "#F97316",
        "cls-etmf": "#06B6D4",
        "cls-regulatory": "#EF4444",
        "cls-synopsis": "#0EA5E9",
        "cls-questionnaire": "#84CC16",
        "cls-infosheet": "#14B8A6",
        "cls-publication": "#A855F7",
        "cls-noise": "#9CA3AF",
        /* Alert severity */
        "sev-error": "#D98080",
        "sev-warning": "#D9A766",
        "sev-info": "#7EBC8E",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04)",
        toolbar:
          "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
}

export default config
