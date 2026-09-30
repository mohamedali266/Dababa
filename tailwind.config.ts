import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          deep: "var(--bg-deep)",
          navy: "var(--bg-navy)",
          indigo: "var(--bg-indigo)"
        },
        brand: {
          blue: "var(--brand-blue)",
          glow: "var(--brand-blue-glow)"
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)"
        },
        glass: {
          fill: "var(--glass-fill)",
          strong: "var(--glass-fill-strong)",
          border: "var(--glass-border)"
        },
        live: "var(--accent-live)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        ice: "var(--ice)",
        cta: {
          bg: "var(--cta-bg)",
          text: "var(--cta-text)"
        }
      },
      borderRadius: {
        screen: "40px",
        card: "28px",
        panel: "20px"
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        glow: "0 0 36px color-mix(in oklab, var(--brand-blue-glow) 42%, transparent)"
      },
      fontFamily: {
        arabic: ["var(--font-arabic)", "sans-serif"],
        latin: ["var(--font-latin)", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
