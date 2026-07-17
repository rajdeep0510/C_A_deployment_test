import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        border: "var(--glass-border)",
        input: "var(--input-border)",
        ring: "var(--accent-color)",
        background: "var(--bg-color)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--accent-color)",
          foreground: "#050505",
        },
        secondary: {
          DEFAULT: "var(--surface-2)",
          foreground: "var(--text-primary)",
        },
        muted: {
          DEFAULT: "var(--surface-1)",
          foreground: "var(--text-secondary)",
        },
        card: {
          DEFAULT: "var(--surface-1)",
          foreground: "var(--text-primary)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        DEFAULT: "var(--radius-md)",
      },
    },
  },
  plugins: [],
};

export default config;
