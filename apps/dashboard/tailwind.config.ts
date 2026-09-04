import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 16, 16, 0.03), 0 8px 30px rgba(16, 16, 16, 0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
