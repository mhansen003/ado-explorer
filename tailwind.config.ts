import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Robinhood-inspired color palette
        'rh-green': '#00C805',
        'rh-dark': '#0F0F0F',
        'rh-card': '#1C1C1E',
        'rh-border': '#2C2C2E',
        'rh-text': '#E5E5E7',
        'rh-text-secondary': '#8E8E93',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
