import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
      },
      fontFamily: {
        sans: ["var(--font-arabic)", "system-ui", "sans-serif"],
      },
      // أحجام أكبر للتابلت (Touch Friendly)
      spacing: {
        "tablet-btn": "3.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
