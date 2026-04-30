import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontFamily: {
      sans: ['"Inter Tight"', '"Inter"', "system-ui", "sans-serif"],
      display: ['"Playfair Display"', "Georgia", "serif"],
      mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
    },
    extend: {
      transitionTimingFunction: {
        decisive: "cubic-bezier(0.25, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
